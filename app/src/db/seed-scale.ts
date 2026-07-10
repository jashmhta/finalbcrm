// 20k-party scale seed + full-module mock + performance proof (IMPORT-PERF).
//
// Run:  npx tsx src/db/seed-scale.ts
//
// This is a SEPARATE, additive seed - it does NOT replace the demo seed
// (src/db/seed.ts). It seeds ~20,000 scale parties + identifiers + types +
// addresses + contacts + party_contact + deals + interactions + tasks +
// lead_meta / onboarding_meta subsets into LIVE Postgres, then runs a
// performance check that mirrors the production `listParties` query path
// (src/features/parties/queries.ts) - fuzzy name search (ilike) + OFFSET
// pagination + the per-page signals bundle - and prints the latency.
// Target: <250ms at 20k parties with the trigram + btree indexes.
//
// Re-runnable: every run first deletes only the rows it previously inserted
// (identified by party.source_ref = 'seed-scale' and deal.deal_code LIKE
// 'SCALE-%'), so the demo seed and any real data are untouched.
//
// Determinism: a seeded mulberry32 PRNG drives every choice so two runs
// produce identical row shapes.
//
// Indexes: the schema notes trigram + FTS indexes as MIGRATION TODOs (the
// generated 0000 migration only creates btree indexes). For substring search
// (`legal_name ilike '%q%'`) to be index-backed at 10k, this script
// idempotently creates the pg_trgm GIN indexes as a setup step (CREATE
// EXTENSION / CREATE INDEX IF NOT EXISTS). This keeps the perf proof
// self-contained without touching the shared drizzle migration journal (owned
// by another track).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { sql, and, asc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

// Load .env.local manually (tsx does not load Next env). MUST run before the
// db import, which constructs the postgres-js client from DATABASE_URL at
// module-eval time. The drizzle-orm imports above are safe (no env at eval).
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore - fall back to db client placeholder, which fails loudly on first query */
  }
}

// ---------------------------------------------------------------------------
// Deterministic PRNG + helpers.
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

const rnd = mulberry32(20260627);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const chance = (p: number) => rnd() < p;
const round = (v: number, d = 2): string => {
  const f = 10 ** d;
  return String(Math.round(v * f) / f);
};

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
const PARTY_TYPES = [
  "issuer",
  "investor",
  "arranger",
  "intermediary",
  "spv",
] as const;
const DEAL_TYPES = [
  "bond_underwriting",
  "high_yield_bond",
  "private_placement_debt",
  "dcm_advisory",
  "ecm_qip",
] as const;
const DEAL_STATUSES = [
  "lead",
  "mandated",
  "in_dd",
  "pricing",
  "settled",
] as const;
const DEAL_ROLES = [
  "issuer",
  "arranger",
  "underwriter",
  "investor",
  "book_runner",
] as const;
const CONTACT_ROLES = [
  "director",
  "cfo",
  "treasurer",
  "compliance",
  "relationship_manager",
  "authorised_signatory",
] as const;
const FIRST_NAMES = [
  "Aarav",
  "Vivaan",
  "Aditya",
  "Vihaan",
  "Arjun",
  "Sai",
  "Reyansh",
  "Ayaan",
  "Krishna",
  "Ishaan",
  "Rohan",
  "Karan",
  "Dhruv",
  "Kabir",
  "Ritvik",
  "Priya",
  "Ananya",
  "Diya",
  "Saanvi",
  "Aadhya",
  "Ira",
  "Kiara",
  "Riya",
  "Anika",
  "Myra",
  "Neha",
  "Pooja",
  "Shreya",
  "Kavya",
  "Meera",
] as const;
const LAST_NAMES = [
  "Sharma",
  "Verma",
  "Gupta",
  "Mehta",
  "Patel",
  "Reddy",
  "Nair",
  "Iyer",
  "Banerjee",
  "Mukherjee",
  "Singh",
  "Khanna",
  "Kapoor",
  "Malhotra",
  "Agarwal",
  "Jain",
  "Bansal",
  "Shah",
  "Desai",
  "Pillai",
  "Menon",
  "Rao",
  "Naidu",
  "Das",
  "Bose",
  "Ghosh",
  "Pandey",
  "Tripathi",
  "Mishra",
  "Bhat",
] as const;
const SCALE_REF = "seed-scale";
const SCALE_DEAL_PREFIX = "SCALE-";
const N_PARTIES = 20_000;
const CHUNK = 1_000; // keep postgres-js param count well under the 65535 protocol limit

const TURNOVER_BANDS = [
  "lt_50",
  "50_75",
  "75_100",
  "100_150",
  "150_175",
  "175_200",
  "200_300",
  "300_500",
  "500_750",
  "750_1000",
  "1000_plus",
] as const;
const SECTORS = [
  "infra",
  "fintech",
  "epc",
  "roads",
  "buildings",
  "manufacturing",
  "textiles",
  "oem",
  "plastics",
  "recycled_plastics",
] as const;
const RATINGS = ["BBB", "BBB+", "A-", "A", "A+", "AA-", "AA", "AA+", "AAA"] as const;
const AGENCIES = ["CRISIL", "ICRA", "CARE", "India Ratings", "Brickwork"] as const;
const INVESTOR_TYPES = [
  "mutual_fund",
  "insurance",
  "pension",
  "bank",
  "nbfc",
  "family_office",
  "pms",
  "fpi",
  "corporate_treasury",
] as const;
const PORTFOLIO_BANDS = [
  "lt_100",
  "100_500",
  "500_1000",
  "1000_5000",
  "5000_plus",
] as const;
const RISK_APPETITES = ["conservative", "moderate", "aggressive", "high_yield"] as const;
const INTERACTION_CHANNELS = ["meeting", "call", "email", "whatsapp"] as const;
const INTERACTION_DIRS = ["inbound", "outbound"] as const;
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;
const LEAD_STAGES = ["new", "qualified", "opportunity", "won", "lost"] as const;
const LEAD_SOURCES = ["referral", "website", "event", "cold_call", "existing_client"] as const;
const ONB_STAGES = [
  "initiated",
  "profile_created",
  "documents_collected",
  "kyc_verified",
  "compliance_approved",
  "active",
] as const;

// Identifier generators (deterministic, no DB state).
// IMPORTANT: the scale seed uses a DISTINCT identifier namespace from the demo
// seed (src/db/seed.ts) and the import-parties sample (CIN year 2025 + a
// 200000 number offset, LEI prefix 549300SEED, GSTIN PAN-body "SC"+8 digits)
// so the dedup partial unique index party_identifier_dedup_uidx never
// collides with pre-existing rows - the scale seed is purely additive.

function makeCin(counter: number): string {
  // Year 2025 + 200000 number offset -> distinct from demo/import (2024, 1xx).
  const n = String(200000 + (counter % 899999)).padStart(6, "0");
  return `U64201MH2025PTC${n}`;
}
function makeGstin(stateCode: string, counter: number): string {
  // PAN-body "SC" + 8-digit counter -> 10 alphanumeric chars, distinct from any
  // real-shaped PAN (which starts with a single letter). 15 chars total.
  const body = `SC${String(counter).padStart(8, "0")}`;
  const ent = String(counter % 10);
  return `${stateCode}${body}${ent}Z${(counter % 9) + 1}`;
}
function makeLei(counter: number): string {
  // Prefix 549300SEED (10) + 10-digit counter -> 20 chars, distinct prefix.
  return `549300SEED${String(counter).padStart(10, "0")}`;
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

let db: any;
let schema: any;

async function main(): Promise<void> {
  ({ db } = await import("./index"));
  schema = await import("./schema");
  const {
    party,
    partyTypeAssignment,
    partyIdentifier,
    address,
    contact,
    partyContact,
    deal,
    dealParty,
    interaction,
    task,
  } = schema;

  const startedAt = Date.now();
  console.log(`seed-scale: target ${N_PARTIES} parties (ref=${SCALE_REF})`);

  // Resolve org staff for assignment distribution (optional).
  let staffIds: string[] = [];
  try {
    const staffRows = await db.execute(sql`
      SELECT user_id FROM app_user WHERE deleted_at IS NULL
    `);
    const arr = Array.isArray(staffRows)
      ? staffRows
      : ((staffRows as { rows?: unknown[] })?.rows ?? []);
    staffIds = arr
      .map((r: any) => (r.user_id ?? r.userId) as string)
      .filter(Boolean);
  } catch {
    staffIds = [];
  }
  const pickStaff = () =>
    staffIds.length ? staffIds[Math.floor(rnd() * staffIds.length)]! : null;

  // 1. Idempotent perf-index setup (trigram GIN for ilike substring search).
  await ensurePerfIndexes();

  // 2. Cleanup prior scale rows (additive seed - never touches the demo seed).
  await cleanupScaleRows(
    party,
    partyTypeAssignment,
    partyIdentifier,
    address,
    partyContact,
    contact,
    deal,
    dealParty,
    interaction,
    task,
  );

  // 3. Seed parties + identifiers + types + addresses + CEO filter fields.
  console.log("  inserting parties + identifiers + types + addresses ...");
  const partyIdByRow: string[] = new Array(N_PARTIES);
  for (let i = 0; i < N_PARTIES; i += CHUNK) {
    const slice = Array.from({ length: Math.min(CHUNK, N_PARTIES - i) }, (_, k) => i + k);
    const partyRows = slice.map((n) => {
      const prefix = PREFIX[n % PREFIX.length]!;
      const suffix = SUFFIX[(n * 7 + 3) % SUFFIX.length]!;
      // "Scale " prefix + per-row n guarantees legal_name uniqueness vs the demo
      // seed and the import-parties sample (which share the same prefix/suffix
      // vocabulary) -> never trips party_legal_name_country_uidx.
      const legalName = `Scale ${prefix} ${suffix} ${n}`;
      const brandOrigin = pick([
        "binarycapital",
        "binarybonds",
        "shared",
      ] as const);
      const isInvestorBook = brandOrigin === "binarybonds" || chance(0.25);
      const owner = pickStaff();
      const rating = chance(0.65) ? pick(RATINGS) : null;
      return {
        legalName,
        displayName: legalName,
        partyNature: "organization" as const,
        countryOfIncorporation: "IN",
        domicileState: pick(STATES),
        isListed: chance(0.2),
        status: chance(0.88) ? "active" : "onboarding",
        brandOrigin,
        kycRiskRating: pick(["low", "medium", "high"] as const),
        isKycComplete: chance(0.55),
        source: "capital_markets_import" as const,
        sourceRef: SCALE_REF,
        assignedUserId: owner,
        dataOwnerUserId: owner,
        turnoverBand: pick(TURNOVER_BANDS),
        annualTurnoverCr: round(20 + rnd() * 2000, 2),
        industrySector: pick(SECTORS),
        industrySubsector: chance(0.4) ? pick(SECTORS) : null,
        latestRating: rating,
        latestRatingAgency: rating ? pick(AGENCIES) : null,
        latestRatingYear: rating
          ? 2022 + Math.floor(rnd() * 5)
          : null,
        investorType: isInvestorBook ? pick(INVESTOR_TYPES) : null,
        portfolioSizeBand: isInvestorBook ? pick(PORTFOLIO_BANDS) : null,
        portfolioSizeCr: isInvestorBook
          ? round(50 + rnd() * 8000, 2)
          : null,
        riskAppetite: isInvestorBook ? pick(RISK_APPETITES) : null,
        highYieldAppetite: isInvestorBook ? chance(0.35) : false,
      };
    });
    const inserted: { partyId: string }[] = await db
      .insert(party)
      .values(partyRows)
      .returning({ partyId: party.partyId });
    inserted.forEach((r, k) => {
      partyIdByRow[slice[k]!] = r.partyId;
    });

    const ptaRows = slice.map((n) => ({
      partyId: partyIdByRow[n]!,
      partyType: pick(PARTY_TYPES),
    }));
    await db.insert(partyTypeAssignment).values(ptaRows);

    const piRows: any[] = [];
    const addrRows: any[] = [];
    slice.forEach((n) => {
      const pid = partyIdByRow[n]!;
      const stateIdx = n % STATES.length;
      const stateCode = STATE_CODE[stateIdx]!;
      const state = STATES[stateIdx]!;
      piRows.push(
        { partyId: pid, identifierType: "CIN", identifierValue: makeCin(n + 1), isPrimary: true },
        { partyId: pid, identifierType: "GSTIN", identifierValue: makeGstin(stateCode, n + 1) },
        { partyId: pid, identifierType: "LEI", identifierValue: makeLei(n + 1) },
      );
      const city = CITIES[state] ?? "Mumbai";
      addrRows.push({
        partyId: pid,
        line1: `${100 + (n % 900)}, ${PREFIX[n % PREFIX.length]} Marg`,
        line2: city,
        city,
        state,
        pincode: String(400000 + (n % 99999)).slice(0, 6),
        country: "IN",
        type: "registered",
        isCurrent: true,
      });
    });
    await db.insert(partyIdentifier).values(piRows);
    await db.insert(address).values(addrRows);
    if (i % (CHUNK * 2) === 0 && i > 0) console.log(`    ... ${i} parties`);
  }
  console.log(`  parties: ${N_PARTIES}`);

  // 4. Contacts (~1.2 per party) + party_contact with phones for Call/WA/Mail.
  console.log("  inserting contacts + party_contact ...");
  const N_CONTACTS = Math.floor(N_PARTIES * 1.2);
  const contactIds: string[] = new Array(N_CONTACTS);
  for (let i = 0; i < N_CONTACTS; i += CHUNK) {
    const len = Math.min(CHUNK, N_CONTACTS - i);
    const contactRows = Array.from({ length: len }, (_, k) => {
      const n = i + k;
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const mobile = `+91${7000000000 + (n % 2999999999)}`;
      return {
        fullName: `${first} ${last}`,
        primaryEmail: `scale+${n}@example.test`,
        primaryPhone: mobile,
        designation: pick([
          "Director",
          "CFO",
          "Treasurer",
          "Compliance Officer",
          "RM",
        ]),
      };
    });
    const inserted: { contactId: string }[] = await db
      .insert(contact)
      .values(contactRows)
      .returning({ contactId: contact.contactId });
    inserted.forEach((r, k) => {
      contactIds[i + k] = r.contactId;
    });
  }
  // Link contacts round-robin to parties; ~1 primary + extra per party.
  const pcRows: any[] = [];
  for (let i = 0; i < N_CONTACTS; i++) {
    const pid = partyIdByRow[i % N_PARTIES]!;
    pcRows.push({
      partyId: pid,
      contactId: contactIds[i]!,
      role: pick(CONTACT_ROLES),
      isPrimary: i < N_PARTIES,
      validFrom: new Date(),
    });
  }
  for (let i = 0; i < pcRows.length; i += CHUNK) {
    await db.insert(partyContact).values(pcRows.slice(i, i + CHUNK));
  }
  console.log(`  contacts: ${N_CONTACTS}, party_contact: ${pcRows.length}`);

  // 5. Deals (~1.2k) + deal_party.
  console.log("  inserting deals + deal_party ...");
  const N_DEALS = 1_200;
  const dealRows = Array.from({ length: N_DEALS }, (_, n) => ({
    dealCode: `${SCALE_DEAL_PREFIX}${String(n).padStart(5, "0")}`,
    dealType: pick(DEAL_TYPES),
    dealName: `${SCALE_DEAL_PREFIX} deal ${n}`,
    status: pick(DEAL_STATUSES),
    brand: pick(["binarycapital", "binarybonds"] as const),
    targetSize: round(50 + rnd() * 1950, 2),
    currencyCode: "INR",
  }));
  const insertedDeals: { dealId: string }[] = await db
    .insert(deal)
    .values(dealRows)
    .returning({ dealId: deal.dealId });
  const dealIds = insertedDeals.map((r) => r.dealId);

  const dpRows: any[] = [];
  for (let d = 0; d < N_DEALS; d++) {
    const members = 2 + Math.floor(rnd() * 3); // 2-4 parties per deal
    for (let m = 0; m < members; m++) {
      const pid = partyIdByRow[(d * 17 + m * 31) % N_PARTIES]!;
      dpRows.push({
        dealId: dealIds[d]!,
        partyId: pid,
        role: pick(DEAL_ROLES),
        isLead: m === 0,
        commitmentAmount: round(10 + rnd() * 490, 2),
      });
    }
  }
  for (let i = 0; i < dpRows.length; i += CHUNK) {
    await db.insert(dealParty).values(dpRows.slice(i, i + CHUNK));
  }
  console.log(`  deals: ${N_DEALS}, deal_party: ${dpRows.length}`);

  // 6. Interactions (~8k) — call / email / whatsapp / meeting coverage.
  console.log("  inserting interactions ...");
  const N_INTERACTIONS = 8_000;
  for (let i = 0; i < N_INTERACTIONS; i += CHUNK) {
    const len = Math.min(CHUNK, N_INTERACTIONS - i);
    const rows = Array.from({ length: len }, (_, k) => {
      const n = i + k;
      const pid = partyIdByRow[n % N_PARTIES]!;
      const ch = pick(INTERACTION_CHANNELS);
      const daysAgo = Math.floor(rnd() * 365);
      const occurredAt = new Date(Date.now() - daysAgo * 86_400_000);
      return {
        partyId: pid,
        channel: ch,
        direction: pick(INTERACTION_DIRS),
        subject: `Scale ${ch} touch #${n}`,
        body: `Mock ${ch} note for performance / coverage desk (seed-scale).`,
        occurredAt,
        userId: pickStaff(),
        containsMnpi: false,
      };
    });
    await db.insert(interaction).values(rows);
  }
  console.log(`  interactions: ${N_INTERACTIONS}`);

  // 7. Tasks (~5k).
  console.log("  inserting tasks ...");
  const N_TASKS = 5_000;
  for (let i = 0; i < N_TASKS; i += CHUNK) {
    const len = Math.min(CHUNK, N_TASKS - i);
    const rows = Array.from({ length: len }, (_, k) => {
      const n = i + k;
      const pid = partyIdByRow[n % N_PARTIES]!;
      const status = pick(TASK_STATUSES);
      return {
        partyId: pid,
        title: `Scale follow-up #${n}`,
        description: "Mock task from seed-scale for desk load testing.",
        assigneeUserId: pickStaff(),
        priority: pick(TASK_PRIORITIES),
        status,
        dueDate: new Date(Date.now() + (n % 60 - 15) * 86_400_000)
          .toISOString()
          .slice(0, 10),
        completedAt: status === "completed" ? new Date() : null,
        createdByUserId: pickStaff(),
      };
    });
    await db.insert(task).values(rows);
  }
  console.log(`  tasks: ${N_TASKS}`);

  // 8. Lead meta on ~2.5k parties + onboarding meta on ~800 (batched JSONB).
  console.log("  tagging lead_meta + onboarding_meta subsets ...");
  const N_LEADS = 2_500;
  const N_ONB = 800;
  const META_CHUNK = 100;
  for (let i = 0; i < N_LEADS; i += META_CHUNK) {
    const end = Math.min(N_LEADS, i + META_CHUNK);
    const values: string[] = [];
    for (let j = i; j < end; j++) {
      const pid = partyIdByRow[j]!;
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const stage = pick(LEAD_STAGES);
      const now = new Date().toISOString();
      const phone = `+91${9100000000 + (j % 899999999)}`;
      const meta = {
        stage,
        source: pick(LEAD_SOURCES),
        dealType: pick(DEAL_TYPES),
        estSizeCr: Math.round(50 + rnd() * 1500),
        probability: Math.floor(rnd() * 90) + 5,
        expectedClose: null,
        assignedRm: pickStaff(),
        contactName: `${first} ${last}`,
        contactTitle: pick(["CFO", "Treasurer", "CEO", "Director"]),
        contactEmail: `lead+${j}@example.test`,
        contactPhone: phone,
        bant: {
          budget: chance(0.5),
          authority: chance(0.5),
          need: chance(0.6),
          timeline: chance(0.4),
        },
        notes: "Scale lead for desk demos.",
        lossReason: stage === "lost" ? "timing" : null,
        convertedDealId: null,
        closedAt: stage === "won" || stage === "lost" ? now : null,
        createdAt: now,
        updatedAt: now,
      };
      // Escape for SQL string literal via postgres-js param path below.
      values.push(pid + "\t" + JSON.stringify(meta));
    }
    // Per-row updates in a small concurrent batch (param-safe).
    await Promise.all(
      values.map(async (line) => {
        const tab = line.indexOf("\t");
        const pid = line.slice(0, tab);
        const metaJson = line.slice(tab + 1);
        await db.execute(sql`
          UPDATE party
          SET lead_meta = ${metaJson}::jsonb
          WHERE party_id = ${pid}::uuid
        `);
      }),
    );
    if (i % 500 === 0 && i > 0) console.log(`    ... ${i} leads`);
  }
  for (let i = 0; i < N_ONB; i += META_CHUNK) {
    const end = Math.min(N_ONB, i + META_CHUNK);
    const jobs: Promise<unknown>[] = [];
    for (let j = i; j < end; j++) {
      const pid = partyIdByRow[N_LEADS + j]!;
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const stage = pick(ONB_STAGES);
      const now = new Date().toISOString();
      const phone = `+91${9200000000 + (j % 799999999)}`;
      const docKeys = [
        "incorporation_certificate",
        "pan_card",
        "board_resolution",
        "authorised_signatory_kyc",
        "financial_statements",
        "beneficial_ownership_declaration",
        "consent_form",
      ];
      const documents = docKeys.map((key) => ({
        key,
        status: chance(0.55) ? "uploaded" : "pending",
        verification: chance(0.35) ? "verified" : "pending",
        documentId: null,
        uploadedAt: chance(0.55) ? now : null,
        verifiedAt: chance(0.35) ? now : null,
        verifiedBy: null,
        rejectionReason: null,
      }));
      const meta = {
        stage,
        clientType: pick([
          "issuer",
          "investor",
          "intermediary",
          "arranger",
        ] as const),
        assignedRm: pickStaff(),
        contactName: `${first} ${last}`,
        contactTitle: "Authorised Signatory",
        contactEmail: `onb+${j}@example.test`,
        contactPhone: phone,
        pan: `ABCDE${String(1000 + (j % 9000))}F`,
        cin: makeCin(50_000 + j),
        gstin: makeGstin("27", 50_000 + j),
        state: pick(STATES),
        city: "Mumbai",
        documents,
        kycRecordId: null,
        complianceApprovedBy: null,
        complianceApprovedAt: null,
        complianceRejectedBy: null,
        complianceRejectedAt: null,
        complianceNote: null,
        stageHistory: [{ stage, enteredAt: now }],
        rejectionReason: null,
        createdAt: now,
        updatedAt: now,
      };
      jobs.push(
        db.execute(sql`
          UPDATE party
          SET onboarding_meta = ${JSON.stringify(meta)}::jsonb
          WHERE party_id = ${pid}::uuid
        `),
      );
    }
    await Promise.all(jobs);
  }
  console.log(`  leads: ${N_LEADS}, onboarding: ${N_ONB}`);

  // 9. ANALYZE so the planner uses the new indexes.
  await db.execute(sql`ANALYZE party`);
  await db.execute(sql`ANALYZE party_identifier`);
  await db.execute(sql`ANALYZE address`);
  await db.execute(sql`ANALYZE party_contact`);
  await db.execute(sql`ANALYZE deal_party`);
  await db.execute(sql`ANALYZE interaction`);
  await db.execute(sql`ANALYZE task`);

  const seedElapsed = Date.now() - startedAt;
  console.log(`seed-scale: inserted in ${seedElapsed} ms`);

  // 10. Performance check - mirrors listParties (queries.ts).
  await perfCheck(party, partyTypeAssignment, address, dealParty, partyContact);

  console.log("seed-scale: done.");
  // The postgres-js pool holds open connections and would keep the event loop
  // alive past main() - exit explicitly once the work + perf proof are done.
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Idempotent perf indexes (trigram GIN). The schema's 0000 migration only
// creates btree indexes; trigram + FTS are noted as MIGRATION TODOs. We create
// them here so ilike substring search is index-backed - without touching the
// shared drizzle migration journal (owned by another track).
// ---------------------------------------------------------------------------

async function ensurePerfIndexes(): Promise<void> {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS party_legal_name_trgm_idx ON "party" USING gin (legal_name gin_trgm_ops)`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS party_display_name_trgm_idx ON "party" USING gin (display_name gin_trgm_ops)`,
  );
  // A plain btree on legal_name helps the ORDER BY legal_name ASC for the
  // no-search path (the composite party_legal_name_country_uidx is partial and
  // two-column, so a dedicated single-column btree is a cleaner sort key).
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS party_legal_name_bt_idx ON "party" USING btree (legal_name)`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS interaction_party_occurred_idx ON "interaction" (party_id, occurred_at DESC) WHERE deleted_at IS NULL`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS task_party_status_idx ON "task" (party_id, status) WHERE deleted_at IS NULL`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS party_source_ref_idx ON "party" (source_ref) WHERE deleted_at IS NULL`,
  );
  console.log("  perf indexes ensured (pg_trgm + GIN trgm + btree + activity)");
}

// ---------------------------------------------------------------------------
// Cleanup prior scale rows. Deletes only rows tagged with the scale marker so
// the demo seed (801) and any real data are never touched.
// ---------------------------------------------------------------------------

async function cleanupScaleRows(
  party: any,
  partyTypeAssignment: any,
  partyIdentifier: any,
  address: any,
  partyContact: any,
  contact: any,
  deal: any,
  dealParty: any,
  interaction?: any,
  task?: any,
): Promise<void> {
  const scaleParties: { partyId: string }[] = await db
    .select({ partyId: party.partyId })
    .from(party)
    .where(eq(party.sourceRef, SCALE_REF));
  if (scaleParties.length === 0) {
    console.log("  no prior scale rows to clean");
    return;
  }
  const ids = scaleParties.map((r) => r.partyId);
  console.log(`  cleaning ${ids.length} prior scale parties ...`);

  // Capture scale contact ids (via party_contact) before unlinking, so we can
  // remove the orphaned contacts afterwards.
  const scalePc: { contactId: string }[] = await db
    .select({ contactId: partyContact.contactId })
    .from(partyContact)
    .where(inArray(partyContact.partyId, ids));
  const contactIds = Array.from(new Set(scalePc.map((r) => r.contactId)));

  // Chunked helper for large IN lists.
  async function chunkedDelete(table: any, col: any, idList: string[]) {
    for (let i = 0; i < idList.length; i += CHUNK) {
      await db.delete(table).where(inArray(col, idList.slice(i, i + CHUNK)));
    }
  }

  if (interaction) await chunkedDelete(interaction, interaction.partyId, ids);
  if (task) await chunkedDelete(task, task.partyId, ids);

  // deal_party rows for scale parties (must precede deal deletion - deal_party
  // references party with ON DELETE RESTRICT, and deal with ON DELETE CASCADE).
  await chunkedDelete(dealParty, dealParty.partyId, ids);
  // Scale deals (by deal_code prefix) - safe now that their deal_party rows are gone.
  await db
    .delete(deal)
    .where(sql`${deal.dealCode} LIKE ${SCALE_DEAL_PREFIX + "%"}`);

  // party_contact (CASCADE on party would handle it, but we delete explicitly
  // to also remove the contacts next).
  await chunkedDelete(partyContact, partyContact.partyId, ids);
  if (contactIds.length) {
    for (let i = 0; i < contactIds.length; i += CHUNK) {
      await db
        .delete(contact)
        .where(inArray(contact.contactId, contactIds.slice(i, i + CHUNK)));
    }
  }

  await chunkedDelete(address, address.partyId, ids);
  await chunkedDelete(partyIdentifier, partyIdentifier.partyId, ids);
  await chunkedDelete(partyTypeAssignment, partyTypeAssignment.partyId, ids);
  await chunkedDelete(party, party.partyId, ids);
  console.log(`  cleaned ${ids.length} scale parties + ${contactIds.length} contacts`);
}

// ---------------------------------------------------------------------------
// Performance check - mirrors `listParties` in src/features/parties/queries.ts:
// a page query (ilike search + ORDER BY legal_name + LIMIT/OFFSET), a count,
// the per-page type/city lookups, and the signals group-by bundle. Reports
// median + min latency over a few warm runs.
// ---------------------------------------------------------------------------

async function perfCheck(
  party: any,
  partyTypeAssignment: any,
  address: any,
  dealParty: any,
  partyContact: any,
): Promise<void> {
  const PAGE_SIZE = 25;
  const searchTerm = "Infra"; // present in a sizeable fraction of scale legal_names

  const runOnce = async (): Promise<number> => {
    const t0 = performance.now();
    const where = and(
      isNull(party.deletedAt),
      or(
        ilike(party.legalName, `%${searchTerm}%`),
        ilike(party.displayName, `%${searchTerm}%`),
      ),
    );
    const [rows, [{ n }]] = await Promise.all([
      db
        .select({
          partyId: party.partyId,
          legalName: party.legalName,
          displayName: party.displayName,
          partyNature: party.partyNature,
          status: party.status,
          isKycComplete: party.isKycComplete,
          kycRiskRating: party.kycRiskRating,
          createdAt: party.createdAt,
          updatedAt: party.updatedAt,
        })
        .from(party)
        .where(where)
        .orderBy(asc(party.legalName))
        .limit(PAGE_SIZE)
        .offset(0),
      db.select({ n: sql<number>`count(*)::int` }).from(party).where(where),
    ]);

    const ids = rows.map((r: any) => r.partyId);
    if (ids.length) {
      await Promise.all([
        db
          .select({ partyId: partyTypeAssignment.partyId, type: partyTypeAssignment.partyType })
          .from(partyTypeAssignment)
          .where(inArray(partyTypeAssignment.partyId, ids)),
        db
          .select({ partyId: address.partyId, city: address.city })
          .from(address)
          .where(
            and(
              inArray(address.partyId, ids),
              eq(address.isCurrent, true),
              isNull(address.deletedAt),
            ),
          ),
        db
          .select({
            partyId: dealParty.partyId,
            n: sql<number>`count(*)::int`,
            last: sql<Date | null>`max(${dealParty.createdAt})`,
          })
          .from(dealParty)
          .where(and(inArray(dealParty.partyId, ids), isNull(dealParty.deletedAt)))
          .groupBy(dealParty.partyId),
        db
          .select({
            partyId: partyContact.partyId,
            n: sql<number>`count(*)::int`,
            last: sql<Date | null>`max(${partyContact.createdAt})`,
          })
          .from(partyContact)
          .where(and(inArray(partyContact.partyId, ids), isNull(partyContact.deletedAt)))
          .groupBy(partyContact.partyId),
      ]);
    }
    void n;
    return performance.now() - t0;
  };

  // Warmup (first run parses the plan + caches pages).
  await runOnce();

  const samples: number[] = [];
  for (let i = 0; i < 5; i++) samples.push(await runOnce());
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)]!;
  const min = samples[0]!;
  const max = samples[samples.length - 1]!;

  // Also measure the no-search first-page path (ORDER BY legal_name LIMIT 25).
  const noSearch = await (async () => {
    await db
      .select({ partyId: party.partyId })
      .from(party)
      .where(isNull(party.deletedAt))
      .orderBy(asc(party.legalName))
      .limit(PAGE_SIZE)
      .offset(0);
    const t0 = performance.now();
    await db
      .select({ partyId: party.partyId, legalName: party.legalName })
      .from(party)
      .where(isNull(party.deletedAt))
      .orderBy(asc(party.legalName))
      .limit(PAGE_SIZE)
      .offset(0);
    return performance.now() - t0;
  })();

  const totalParties: { n: number }[] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(party)
    .where(isNull(party.deletedAt));

  const lines: string[] = [
    "",
    "=== Performance check (listParties-equivalent) ===",
    `  total parties (non-deleted) : ${totalParties[0]!.n}`,
    `  search term                 : ilike '%${searchTerm}%' (trigram-indexed)`,
    `  page size / offset          : ${PAGE_SIZE} / 0`,
    `  latency (median of 5)       : ${median.toFixed(1)} ms`,
    `  latency (min / max)         : ${min.toFixed(1)} / ${max.toFixed(1)} ms`,
    `  no-search first-page        : ${noSearch.toFixed(1)} ms`,
    `  target                      : < 200 ms`,
    `  result                      : ${median < 200 ? "PASS" : "FAIL"} (${median.toFixed(1)} ms)`,
    "",
  ];
  const report = lines.join("\n");
  process.stdout.write(report);
  // Persist the proof alongside the script output for hand-off.
  try {
    writeFileSync(resolve(process.cwd(), "seed-scale-perf.txt"), report, "utf8");
  } catch {
    /* non-fatal */
  }
}

main().catch((err) => {
  console.error("seed-scale failed:", err);
  process.exit(1);
});
