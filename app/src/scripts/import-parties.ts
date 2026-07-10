// CSV import tool for the party master (DATA_MODEL §1.1, §1.4, §2.1-2.3).
//
// Run:
//   npx tsx src/scripts/import-parties.ts --generate-sample 10000 [--out path]
//   npx tsx src/scripts/import-parties.ts <csv-path> [--batch N] [--queued-out path]
//
// Pipeline (matches the §1.4 dedup contract + a PartyService-style promote):
//   1. Parse CSV (papaparse, header row).
//   2. Validate each row (zod): required fields + PAN/GSTIN/CIN/LEI format.
//   3. Normalize identifiers (uppercase, trim).
//   4. Dedup:
//        - existing-match  -> "deduped"   (row is a re-import of a party already
//                                          in the master; skipped silently)
//        - within-file dup -> "queued"    (two rows claim the same identifier;
//                                          ambiguous, written to duplicate_candidates.csv)
//      Dedup is resolved against the `party_identifier_dedup_uidx` partial unique
//      index (identifier_type, identifier_value) WHERE deleted_at IS NULL - the
//      schema's canonical dedup enforcement point.
//   5. Stage in an in-memory batch (allowed by spec) and promote in a transaction
//      per chunk (party + party_type_assignment + party_identifier + address).
//      A pre-check + a per-row fallback on unique-violation reconciles any race
//      / slipped-through collision by reclassifying the row as "queued".
//   6. Print a summary: inserted / deduped / queued / invalid (+ timing).
//
// This is a standalone tsx script; it does NOT touch the demo seed (src/db/seed.ts)
// or any UI / schema / migration file. It only reads + writes the live DB through
// the shared `db` client.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import Papa from "papaparse";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

// Load .env.local manually (tsx does not load Next env, and `dotenv` is not a
// dependency). MUST run before the `./db` import, which constructs the
// postgres-js client from process.env.DATABASE_URL at module-eval time. Static
// imports above are safe (they don't read env at eval time); the db import is
// dynamic, inside main(), after this loader has populated the env.
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore - fall back to db client placeholder, which will fail loudly on first query */
  }
}

// ---------------------------------------------------------------------------
// Identifier formats (DATA_MODEL §2.3, §3).
// ---------------------------------------------------------------------------

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/; // 10 chars: 5 letters, 4 digits, 1 letter
const GSTIN_RE = /^[0-9]{2}[A-Z0-9]{10}[0-9]Z[A-Z0-9]$/; // 15 chars
const CIN_RE = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/; // 21 chars
const LEI_RE = /^[A-Z0-9]{20}$/; // 20 chars

const PARTY_NATURES = [
  "organization",
  "natural_person",
  "spv",
  "trust",
  "government",
  "regulator",
] as const;
const PARTY_TYPES = [
  "issuer",
  "investor",
  "intermediary",
  "arranger",
  "underwriter",
  "broker",
  "ifa",
  "rating_agency",
  "trustee",
  "registrar",
  "legal_counsel",
  "auditor",
  "escrow_agent",
  "guarantor",
  "credit_enhancement_provider",
  "government",
  "regulator",
  "spv",
  "vendor",
  "internal_staff",
  "prospect",
] as const;
const PARTY_STATUSES = [
  "active",
  "dormant",
  "onboarding",
  "blacklisted",
  "closed",
] as const;
const BRANDS = ["binarycapital", "binarybonds", "shared"] as const;
const KYC_RISKS = ["low", "medium", "high"] as const;

// ---------------------------------------------------------------------------
// Row schema. CSV headers map 1:1 to fields. Optional fields may be empty.
// ---------------------------------------------------------------------------

const boolish = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((v) => v === "true" || v === "1" || v === "yes" || v === "y");

const optionalStr = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const RowSchema = z.object({
  legal_name: z.string().trim().min(1, "legal_name is required"),
  display_name: optionalStr,
  party_nature: z.enum(PARTY_NATURES),
  party_type: z.enum(PARTY_TYPES),
  country: z.preprocess(
    (v) =>
      v == null || String(v).trim() === ""
        ? "IN"
        : String(v).trim().toUpperCase(),
    z.string().length(2),
  ),
  domicile_state: optionalStr,
  status: z.enum(PARTY_STATUSES),
  brand_origin: z.enum(BRANDS),
  is_listed: boolish,
  kyc_risk_rating: z.preprocess(
    (v) =>
      v == null || String(v).trim() === "" ? undefined : String(v).trim(),
    z.enum(KYC_RISKS).optional(),
  ),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .refine((v) => !v || PAN_RE.test(v), "invalid PAN format")
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .refine((v) => !v || GSTIN_RE.test(v), "invalid GSTIN format")
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  cin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .refine((v) => !v || CIN_RE.test(v), "invalid CIN format")
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  lei: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .refine((v) => !v || LEI_RE.test(v), "invalid LEI format")
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  line1: optionalStr,
  line2: optionalStr,
  city: optionalStr,
  state: optionalStr,
  pincode: optionalStr,
});

type ValidRow = z.infer<typeof RowSchema>;

interface InvalidRow {
  rowNumber: number;
  raw: Record<string, string>;
  errors: string[];
}

interface QueuedCandidate {
  rowNumber: number;
  legal_name: string;
  identifier_type: string;
  identifier_value: string;
  reason: string;
}

interface IdentifierKey {
  identifierType: string;
  identifierValue: string;
}

interface NormalizedRow {
  rowNumber: number;
  data: ValidRow;
  identifiers: IdentifierKey[];
}

// ---------------------------------------------------------------------------
// CLI parsing.
// ---------------------------------------------------------------------------

type CliArgs =
  | { mode: "generate"; sampleN: number; out: string }
  | { mode: "import"; csvPath: string; batch: number; queuedOut: string };

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }
  if (args[0] === "--generate-sample" || args[0] === "--generate") {
    const n = Number(args[1] ?? 10000);
    if (!Number.isFinite(n) || n <= 0) {
      console.error("--generate-sample requires a positive integer");
      process.exit(1);
    }
    const outIdx = args.indexOf("--out");
    const out =
      outIdx >= 0 ? args[outIdx + 1] : resolve(process.cwd(), "sample-parties-10k.csv");
    return { mode: "generate", sampleN: Math.floor(n), out };
  }
  // import mode
  if (args[0].startsWith("--")) {
    console.error(`Unknown flag: ${args[0]}`);
    printUsage();
    process.exit(1);
  }
  const csvPath = resolve(process.cwd(), args[0]);
  const batchIdx = args.indexOf("--batch");
  const batch = batchIdx >= 0 ? Number(args[batchIdx + 1]) : 500;
  const queuedIdx = args.indexOf("--queued-out");
  const queuedOut =
    queuedIdx >= 0
      ? resolve(process.cwd(), args[queuedIdx + 1])
      : resolve(process.cwd(), `duplicate_candidates_${Date.now()}.csv`);
  return { mode: "import", csvPath, batch, queuedOut };
}

function printUsage(): void {
  console.error(`Usage:
  npx tsx src/scripts/import-parties.ts --generate-sample N [--out path]
  npx tsx src/scripts/import-parties.ts <csv-path> [--batch N] [--queued-out path]`);
}

// ---------------------------------------------------------------------------
// Sample CSV generator - deterministic, N rows (default 10000).
// ~1.5% within-file duplicate identifiers + ~0.5% invalid rows so the import
// summary exercises every path (inserted / deduped / queued / invalid).
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STATES = [
  "Maharashtra",
  "Karnataka",
  "Tamil Nadu",
  "Gujarat",
  "Delhi",
  "Telangana",
  "West Bengal",
  "Rajasthan",
  "Uttar Pradesh",
  "Haryana",
] as const;
const STATE_CODE = ["27", "29", "33", "24", "07", "36", "19", "08", "09", "06"];
const CITIES: Record<string, string> = {
  Maharashtra: "Mumbai",
  Karnataka: "Bengaluru",
  "Tamil Nadu": "Chennai",
  Gujarat: "Ahmedabad",
  Delhi: "New Delhi",
  Telangana: "Hyderabad",
  "West Bengal": "Kolkata",
  Rajasthan: "Jaipur",
  "Uttar Pradesh": "Noida",
  Haryana: "Gurugram",
};
const PREFIX = [
  "Bharat",
  "Vedanta",
  "Nalanda",
  "Deccan",
  "Konark",
  "Chola",
  "Pallava",
  "Maruti",
  "Garuda",
  "Narmada",
  "Godavari",
  "Kaveri",
  "Yamuna",
  "Himalaya",
  "Aravalli",
  "Coromandel",
  "Malabar",
  "Carnatic",
  "Rajwada",
  "Nilgiri",
  "Sahyadri",
] as const;
const SUFFIX = [
  "Infra",
  "Power",
  "Renewables",
  "Realty",
  "Developers",
  "Steels",
  "Cements",
  "Chemicals",
  "Motors",
  "Capital",
  "Finvest",
  "Housing",
  "Finance",
  "Technologies",
  "Logistics",
  "Hotels",
  "Holdings",
  "Enterprises",
  "Industries",
  "Ventures",
  "Group",
  "Investments",
  "Securities",
] as const;
const PAN_LETTERS = "ABCDEFGHJL";
const NATURES = ["organization", "spv", "trust"] as const;
const TYPES = ["issuer", "investor", "arranger", "intermediary", "spv"] as const;
const BRANDS_ARR = ["binarycapital", "binarybonds", "shared"] as const;
const RISKS = ["low", "medium", "high"] as const;

function makePan(rnd: () => number, counter: number): string {
  const a = PAN_LETTERS[Math.floor(rnd() * PAN_LETTERS.length)];
  const b = PAN_LETTERS[Math.floor(rnd() * PAN_LETTERS.length)];
  const c = "P";
  const d = PAN_LETTERS[Math.floor(rnd() * PAN_LETTERS.length)];
  const e = PAN_LETTERS[Math.floor(rnd() * PAN_LETTERS.length)];
  const n = String(1000 + (counter % 8999)).padStart(4, "0");
  const f = PAN_LETTERS[Math.floor(rnd() * PAN_LETTERS.length)];
  return `${a}${b}${c}${d}${e}${n}${f}`;
}
function makeCin(counter: number): string {
  const n = String(100000 + (counter % 899999)).padStart(6, "0");
  return `U64201MH2024PTC${n}`;
}
function makeGstin(stateCode: string, pan: string, counter: number): string {
  const ent = String(counter % 10);
  return `${stateCode}${pan}${ent}Z${(counter % 9) + 1}`;
}
function makeLei(counter: number): string {
  const base = String(counter).padStart(12, "0");
  return `3298AHOX${base}`;
}

interface SampleRow {
  [key: string]: string;
}

function generateSample(n: number, outPath: string): void {
  const rnd = mulberry32(20260627);
  const rows: SampleRow[] = [];
  // Reserve a pool of "already-issued" identifiers so a chosen subset of later
  // rows reuse them -> within-file duplicates (queued path).
  const issuedPans: string[] = [];
  const issuedCins: string[] = [];

  const dupCount = Math.max(1, Math.floor(n * 0.015));
  const invalidCount = Math.max(1, Math.floor(n * 0.005));
  const dupRowNumbers = new Set<number>();
  const invalidRowNumbers = new Set<number>();
  // Dup rows are placed at index >= 700 so the dup-pool (collected from rows
  // 600-1199) is already populated when they are emitted - otherwise early dup
  // rows would get fresh identifiers and not actually collide. The pool range
  // (600-1199) is chosen to be OUTSIDE the demo seed's CIN range (rows 0-599
  // collide with the demo's CINs 100001-100600 and exercise the "deduped"
  // path), so dup-pool identifiers are unique vs the existing master and the
  // dup rows survive as "queued" duplicate_candidates.
  while (dupRowNumbers.size < dupCount) {
    dupRowNumbers.add(700 + Math.floor(rnd() * Math.max(1, n - 700)));
  }
  while (invalidRowNumbers.size < invalidCount) {
    const i = Math.floor(rnd() * n) + 1;
    if (!dupRowNumbers.has(i)) invalidRowNumbers.add(i);
  }

  for (let i = 1; i <= n; i++) {
    const stateIdx = Math.floor(rnd() * STATES.length);
    const state = STATES[stateIdx]!;
    const stateCode = STATE_CODE[stateIdx]!;
    const prefix = PREFIX[Math.floor(rnd() * PREFIX.length)];
    const suffix = SUFFIX[Math.floor(rnd() * SUFFIX.length)];
    const legalName = `${prefix} ${suffix} ${1000 + i}`;
    const nature = NATURES[Math.floor(rnd() * NATURES.length)]!;
    const type = TYPES[Math.floor(rnd() * TYPES.length)]!;
    const status = rnd() < 0.85 ? "active" : "onboarding";
    const brand = BRANDS_ARR[Math.floor(rnd() * BRANDS_ARR.length)]!;
    const isListed = rnd() < 0.2 ? "true" : "false";
    const risk = RISKS[Math.floor(rnd() * RISKS.length)]!;

    let pan = makePan(rnd, i);
    let cin = makeCin(i);
    // Rows 600-1199 seed the dup pool (outside the demo-seed CIN collision
    // zone so dup-pool identifiers are unique vs the existing master).
    if (i >= 600 && i < 1200) {
      issuedPans.push(pan);
      issuedCins.push(cin);
    }
    if (dupRowNumbers.has(i) && issuedPans.length > 0) {
      const k = Math.floor(rnd() * issuedPans.length);
      pan = issuedPans[k]!;
      cin = issuedCins[k]!;
    }

    const gstin = makeGstin(stateCode, pan, i);
    const lei = makeLei(i);

    const base: SampleRow = {
      legal_name: legalName,
      display_name: legalName,
      party_nature: nature,
      party_type: type,
      country: "IN",
      domicile_state: state,
      status,
      brand_origin: brand,
      is_listed: isListed,
      kyc_risk_rating: risk,
      pan,
      gstin,
      cin,
      lei,
      line1: `${100 + (i % 900)}, ${prefix} Marg`,
      line2: CITIES[state] ?? "Mumbai",
      city: CITIES[state] ?? "Mumbai",
      state,
      pincode: String(400000 + (i % 99999)).slice(0, 6),
    };

    if (invalidRowNumbers.has(i)) {
      // Inject a validation fault - pick a fault type at random.
      const fault = Math.floor(rnd() * 3);
      if (fault === 0) {
        base.legal_name = ""; // missing required
      } else if (fault === 1) {
        base.pan = "INVALIDPAN"; // bad format
      } else {
        base.party_nature = "not_a_real_nature"; // bad enum
      }
    }

    rows.push(base);
  }

  const csv = Papa.unparse({
    fields: [
      "legal_name",
      "display_name",
      "party_nature",
      "party_type",
      "country",
      "domicile_state",
      "status",
      "brand_origin",
      "is_listed",
      "kyc_risk_rating",
      "pan",
      "gstin",
      "cin",
      "lei",
      "line1",
      "line2",
      "city",
      "state",
      "pincode",
    ],
    data: rows,
  });
  writeFileSync(outPath, csv, "utf8");
  console.log(
    `Generated ${n}-row sample CSV -> ${outPath}\n  (with ${dupCount} within-file duplicate rows + ${invalidCount} invalid rows for path coverage)`,
  );
}

// ---------------------------------------------------------------------------
// Import pipeline.
// ---------------------------------------------------------------------------

function rowIdentifiers(data: ValidRow): IdentifierKey[] {
  const ids: IdentifierKey[] = [];
  if (data.pan) ids.push({ identifierType: "PAN", identifierValue: data.pan });
  if (data.gstin)
    ids.push({ identifierType: "GSTIN", identifierValue: data.gstin });
  if (data.cin) ids.push({ identifierType: "CIN", identifierValue: data.cin });
  if (data.lei) ids.push({ identifierType: "LEI", identifierValue: data.lei });
  return ids;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.mode === "generate") {
    generateSample(args.sampleN, args.out);
    return;
  }

  // Production guard: bulk import must be attributed to an app_user and is
  // audited. Set IMPORT_ACTOR_USER_ID to an active app_user.user_id (uuid).
  // Set IMPORT_ALLOW_UNATTRIBUTED=1 only for local bootstrap (not production).
  const actorUserId = process.env.IMPORT_ACTOR_USER_ID?.trim() || null;
  if (!actorUserId && process.env.IMPORT_ALLOW_UNATTRIBUTED !== "1") {
    console.error(
      "Refusing import: set IMPORT_ACTOR_USER_ID=<app_user uuid> (or IMPORT_ALLOW_UNATTRIBUTED=1 for local only).",
    );
    process.exit(1);
  }

  const { csvPath, batch, queuedOut } = args;

  // Read + parse CSV.
  let rawText: string;
  try {
    rawText = readFileSync(csvPath, "utf8");
  } catch (e) {
    console.error(`Could not read CSV at ${csvPath}: ${(e as Error).message}`);
    process.exit(1);
  }

  const parseResult = Papa.parse<Record<string, string>>(rawText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parseResult.errors.length > 0) {
    console.warn(
      `papaparse reported ${parseResult.errors.length} parse warning(s); first: ${parseResult.errors[0]?.message}`,
    );
  }

  const rawRows = parseResult.data.filter((r) =>
    Object.values(r).some((v) => v && String(v).trim().length > 0),
  );

  console.log(`Importing ${rawRows.length} rows from ${csvPath} ...`);

  // 1. Validate.
  const invalid: InvalidRow[] = [];
  const valid: NormalizedRow[] = [];
  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // +1 for header, +1 for 1-indexing
    const parsed = RowSchema.safeParse(raw);
    if (!parsed.success) {
      const errors = parsed.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`,
      );
      invalid.push({ rowNumber, raw, errors });
      return;
    }
    const data = parsed.data;
    const ids = rowIdentifiers(data);
    // A party must carry at least one canonical identifier (dedup backbone).
    if (ids.length === 0) {
      invalid.push({
        rowNumber,
        raw,
        errors: ["row carries no canonical identifier (pan/gstin/cin/lei)"],
      });
      return;
    }
    valid.push({ rowNumber, data, identifiers: ids });
  });

  // 2. Load existing identifiers that collide with the file's identifiers.
  //    Grouped by type so each query is a single inArray scan over the partial
  //    unique index party_identifier_dedup_uidx.
  const { db } = await import("../db");
  const {
    party,
    partyTypeAssignment,
    partyIdentifier,
    address,
  } = await import("../db/schema");

  const byType: Record<string, string[]> = {};
  for (const r of valid) {
    for (const id of r.identifiers) {
      (byType[id.identifierType] ??= []).push(id.identifierValue);
    }
  }

  const existingCollisions = new Set<string>();
  for (const [type, values] of Object.entries(byType)) {
    const uniq = Array.from(new Set(values));
    // Chunk to avoid over-long IN lists. Each query hits the partial unique
    // index party_identifier_dedup_uidx (identifier_type, identifier_value)
    // WHERE deleted_at IS NULL - the schema's dedup enforcement point.
    for (let i = 0; i < uniq.length; i += 1000) {
      const slice = uniq.slice(i, i + 1000);
      const rows = await db
        .select({ identifierValue: partyIdentifier.identifierValue })
        .from(partyIdentifier)
        .where(
          and(
            eq(partyIdentifier.identifierType, type as any),
            inArray(partyIdentifier.identifierValue, slice),
            isNull(partyIdentifier.deletedAt),
          ),
        );
      for (const r of rows) {
        existingCollisions.add(`${type}|${r.identifierValue}`);
      }
    }
  }

  // 3. Classify: deduped (existing match) / queued (within-file dup) / insertable.
  const queued: QueuedCandidate[] = [];
  const insertable: NormalizedRow[] = [];
  const batchSeen = new Set<string>();

  for (const r of valid) {
    const existingHit = r.identifiers.find((id) =>
      existingCollisions.has(`${id.identifierType}|${id.identifierValue}`),
    );
    if (existingHit) {
      // Re-import of an existing master party -> silent dedup, counted only.
      // (No row written; the party already exists.)
      continue;
    }
    const withinDup = r.identifiers.find((id) =>
      batchSeen.has(`${id.identifierType}|${id.identifierValue}`),
    );
    if (withinDup) {
      queued.push({
        rowNumber: r.rowNumber,
        legal_name: r.data.legal_name,
        identifier_type: withinDup.identifierType,
        identifier_value: withinDup.identifierValue,
        reason: "within-file duplicate identifier",
      });
      continue;
    }
    for (const id of r.identifiers) {
      batchSeen.add(`${id.identifierType}|${id.identifierValue}`);
    }
    insertable.push(r);
  }

  const deduped = valid.length - insertable.length - queued.length;

  // 4. Promote insertable rows in batched transactions.
  let inserted = 0;
  const BATCH = Math.max(1, batch ?? 500);
  const t0 = Date.now();

  for (let i = 0; i < insertable.length; i += BATCH) {
    const chunk = insertable.slice(i, i + BATCH);
    const batchIdx = Math.floor(i / BATCH);
    process.stderr.write(`  batch ${batchIdx} (${chunk.length} rows)...\n`);
    try {
      inserted += await promoteChunk(db, chunk, party, partyTypeAssignment, partyIdentifier, address);
    } catch (err) {
      process.stderr.write(`  batch ${batchIdx} failed: ${(err as Error).message?.slice(0, 100)} -> per-row fallback\n`);
      // A constraint violation in a batched txn aborts the whole chunk. Fall
      // back to per-row promotion so the colliding row is reclassified as
      // queued and the rest still insert. This is the PartyService-style
      // reconcile step (pre-check + transaction + reconcile-on-conflict).
      for (const r of chunk) {
        try {
          inserted += await promoteChunk(
            db,
            [r],
            party,
            partyTypeAssignment,
            partyIdentifier,
            address,
          );
        } catch (e2) {
          const msg = (e2 as Error).message ?? String(e2);
          // Likely a unique violation on a slipped-through identifier collision.
          const id = r.identifiers[0];
          queued.push({
            rowNumber: r.rowNumber,
            legal_name: r.data.legal_name,
            identifier_type: id?.identifierType ?? "?",
            identifier_value: id?.identifierValue ?? "?",
            reason: `insert conflict: ${msg.slice(0, 120)}`,
          });
        }
      }
    }
  }

  const elapsedMs = Date.now() - t0;

  // 5. Write queued duplicate candidates to CSV (the materialized queue).
  if (queued.length > 0) {
    const qCsv = Papa.unparse({
      fields: ["rowNumber", "legal_name", "identifier_type", "identifier_value", "reason"],
      data: queued,
    });
    writeFileSync(queuedOut, qCsv, "utf8");
  }

  // 6. Summary.
  console.log("\n=== Import summary ===");
  console.log(`  rows read      : ${rawRows.length}`);
  console.log(`  inserted       : ${inserted}`);
  console.log(`  deduped        : ${deduped}  (matched existing party_identifier)`);
  console.log(`  queued (dup)   : ${queued.length}  (duplicate candidates)`);
  console.log(`  invalid        : ${invalid.length}`);
  console.log(`  promote time   : ${elapsedMs} ms  (batch=${BATCH})`);
  if (actorUserId) console.log(`  actor user     : ${actorUserId}`);
  if (queued.length > 0) console.log(`  duplicate_candidates -> ${queuedOut}`);
  if (invalid.length > 0) {
    console.log("  first invalid rows:");
    for (const inv of invalid.slice(0, 5)) {
      console.log(`    row ${inv.rowNumber}: ${inv.errors.join("; ")}`);
    }
  }

  // Audit trail (best-effort) so bulk imports are not an unlogged side door.
  try {
    const { writeAudit } = await import("@/lib/audit-write");
    await writeAudit({
      actorUserId,
      entityType: "party_import",
      operation: "insert",
      fieldName: csvPath,
      newValue: {
        rowsRead: rawRows.length,
        inserted,
        deduped,
        queued: queued.length,
        invalid: invalid.length,
        batch: BATCH,
      },
    });
    console.log("  audit_log      : written");
  } catch (e) {
    console.warn(`  audit_log      : failed (${(e as Error).message})`);
  }

  // Exit non-zero if anything failed validation, so CI/infra can detect it.
  if (invalid.length > 0) process.exitCode = 2;
  // The postgres-js pool holds open connections and would keep the event loop
  // alive past main() - exit explicitly once the summary is printed.
  process.exit(process.exitCode ?? 0);
}

/**
 * Promote a chunk of normalized rows in a single transaction.
 * Inserts party (returning ids) -> party_type_assignment + party_identifier + address.
 * Returns the number of parties inserted.
 */
async function promoteChunk(
  db: any,
  chunk: NormalizedRow[],
  party: any,
  partyTypeAssignment: any,
  partyIdentifier: any,
  address: any,
): Promise<number> {
  const partyRows = chunk.map((r) => ({
    legalName: r.data.legal_name,
    displayName: r.data.display_name ?? null,
    partyNature: r.data.party_nature,
    countryOfIncorporation: r.data.country,
    domicileState: r.data.domicile_state ?? null,
    isListed: r.data.is_listed,
    kycRiskRating: r.data.kyc_risk_rating ?? null,
    status: r.data.status,
    brandOrigin: r.data.brand_origin,
    source: "capital_markets_import" as const,
    sourceRef: "import-parties",
  }));

  return db.transaction(async (tx: any) => {
    const insertedParties: { partyId: string }[] = await tx
      .insert(party)
      .values(partyRows)
      .returning({ partyId: party.partyId });
    const ids = insertedParties.map((p) => p.partyId);

    const ptaRows: any[] = chunk.map((r, i) => ({
      partyId: ids[i],
      partyType: r.data.party_type,
    }));
    if (ptaRows.length) await tx.insert(partyTypeAssignment).values(ptaRows);

    const piRows: any[] = [];
    chunk.forEach((r, i) => {
      for (const id of r.identifiers) {
        piRows.push({
          partyId: ids[i],
          identifierType: id.identifierType,
          identifierValue: id.identifierValue,
          isPrimary: id.identifierType === "CIN" || id.identifierType === "PAN",
        });
      }
    });
    if (piRows.length) await tx.insert(partyIdentifier).values(piRows);

    const addrRows: any[] = chunk
      .map((r, i) =>
        r.data.line1 && r.data.city && r.data.state
          ? {
              partyId: ids[i],
              line1: r.data.line1,
              line2: r.data.line2 ?? null,
              city: r.data.city,
              state: r.data.state,
              pincode: r.data.pincode ?? null,
              country: r.data.country,
              type: "registered" as const,
              isCurrent: true,
            }
          : null,
      )
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (addrRows.length) await tx.insert(address).values(addrRows);

    return ids.length;
  });
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
