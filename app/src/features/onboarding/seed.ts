// Client Onboarding - seed.
//
// Run AFTER the main seed (src/db/seed.ts):  npx tsx src/features/onboarding/seed.ts
//
// Populates party.onboarding_meta (migration 0007) with a realistic Indian
// bond-house onboarding pipeline: ~28 prospect parties created fresh and
// promoted across the full funnel (initiated → profile_created →
// documents_collected → kyc_verified → compliance_approved → active), each
// with a 7-document checklist at a stage-appropriate completion state, a linked
// kyc_record (approved for kyc_verified+), and backdated stageHistory so the
// SLA clocks show a realistic mix of on-track / due-soon / overdue.
//
// Re-runnable + self-cleaning: deletes the parties it created on a previous run
// (by legal_name) - which cascades their documents and requires deleting their
// seed kyc_records first (kyc_record.party_id is ON DELETE RESTRICT) - then
// recreates them, so the pipeline is identical every time. Deterministic via a
// seeded mulberry32 PRNG.
//
// NOTE: the main seed TRUNCATEs every table on re-run, which wipes these
// parties + onboarding_meta - re-run this script after any main-seed re-run to
// restore the onboarding pipeline.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";

// Load .env.local before importing the db client (same pattern as the leads
// seed - tsx does not load Next env, and the postgres-js client reads
// DATABASE_URL at module-eval time). The `@/db` import is DYNAMIC (inside
// main) because static imports are hoisted above this block.
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore */
  }
}

import {
  ONBOARDING_DOC_LABELS,
  ONBOARDING_DOC_ORDER,
  ONBOARDING_DOC_TO_DOCUMENT_TYPE,
  ONBOARDING_STAGE_ORDER,
  type OnboardingClientType,
  type OnboardingDocItem,
  type OnboardingMeta,
  type OnboardingStage,
} from "./types";

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) - deterministic choices across runs.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0x0b0a7d1e);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const chance = (p: number) => rnd() < p;
const intIn = (lo: number, hi: number) => Math.floor(rnd() * (hi - lo + 1)) + lo;

// ---------------------------------------------------------------------------
// Domain vocabularies (kept narrow + realistic for an Indian bond house).
// ---------------------------------------------------------------------------

const STATES = [
  "Maharashtra",
  "Gujarat",
  "Karnataka",
  "Tamil Nadu",
  "Telangana",
  "Delhi",
  "Rajasthan",
  "West Bengal",
];

const CITIES = [
  "Mumbai",
  "Ahmedabad",
  "Bengaluru",
  "Chennai",
  "Hyderabad",
  "New Delhi",
  "Pune",
  "Kolkata",
];

const CONTACT_FIRST = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna",
  "Ishaan", "Rohan", "Ananya", "Diya", "Aadhya", "Saanvi", "Priya", "Kavya",
];
const CONTACT_LAST = [
  "Mehta", "Reddy", "Iyer", "Nair", "Joshi", "Kapoor", "Agarwal", "Gupta",
  "Shah", "Patel", "Rao", "Naidu", "Bose", "Chopra", "Malhotra", "Saxena",
];
const CONTACT_TITLES = [
  "CFO", "Treasurer", "MD & CEO", "Vice President - Finance", "Head of Treasury",
  "Director", "Promoter", "Company Secretary",
];

/** 28 realistic Indian company names - the seed's onboarding set. Fixed so the
 *  clean step can delete them by legal_name on re-run. */
const SEED_COMPANIES: { name: string; type: OnboardingClientType }[] = [
  { name: "Aravali Power Generation Ltd", type: "issuer" },
  { name: "Coromandel Cement Holdings Pvt Ltd", type: "issuer" },
  { name: "Deccan Infra SPV LLP", type: "spv" },
  { name: "Eastern India Tollways Pvt Ltd", type: "spv" },
  { name: "Godavari Renewable Energy Pvt Ltd", type: "issuer" },
  { name: "Himalaya Textiles Mills Ltd", type: "issuer" },
  { name: "Indus Valley Steels Ltd", type: "issuer" },
  { name: "Jayanti Refineries Pvt Ltd", type: "issuer" },
  { name: "Kaveri Agro Processing Ltd", type: "issuer" },
  { name: "Lakshmi Housing Finance Ltd", type: "issuer" },
  { name: "Malabar Ports Logistics Pvt Ltd", type: "vendor" },
  { name: "Narmada Shipbuilders Ltd", type: "issuer" },
  { name: "Ori tea Estates Pvt Ltd", type: "issuer" },
  { name: "Purvanchal Sugar Mills Ltd", type: "issuer" },
  { name: "Qutub Engineering Works Pvt Ltd", type: "vendor" },
  { name: "Rajasthan Solar Parks Ltd", type: "issuer" },
  { name: "Saraswati Pharmaceuticals Ltd", type: "issuer" },
  { name: "Tapiya Construction Materials Pvt Ltd", type: "vendor" },
  { name: "Udayachal Realty Developers Ltd", type: "issuer" },
  { name: "Vindhya Cable Networks Ltd", type: "issuer" },
  { name: "Warora Coal Washeries Pvt Ltd", type: "vendor" },
  { name: "Xerxes Automotive Components Ltd", type: "issuer" },
  { name: "Yamuna Waterways Logistics Pvt Ltd", type: "intermediary" },
  { name: "Zenith Hospitality Ventures Ltd", type: "issuer" },
  { name: "Annapurna Foods Distributors Pvt Ltd", type: "intermediary" },
  { name: "Brindavan Transformers Ltd", type: "issuer" },
  { name: "Chambal Fertilisers Distribution Ltd", type: "issuer" },
  { name: "Dakshin Granites Exports Pvt Ltd", type: "vendor" },
];

/** Stage distribution - a healthy funnel: wide middle, tapered ends. */
function pickStage(): OnboardingStage {
  const r = rnd();
  if (r < 0.1) return "initiated";
  if (r < 0.31) return "profile_created";
  if (r < 0.6) return "documents_collected";
  if (r < 0.79) return "kyc_verified";
  if (r < 0.9) return "compliance_approved";
  return "active";
}

/** Days ago - for backdating stageHistory entries. */
function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString();
}

/** Build the 7-doc checklist for a given stage. Earlier stages have fewer docs
 *  uploaded/verified; kyc_verified+ have all verified. */
function buildChecklist(stage: OnboardingStage): OnboardingDocItem[] {
  return ONBOARDING_DOC_ORDER.map((key) => {
    let status: OnboardingDocItem["status"] = "pending";
    let verification: OnboardingDocItem["verification"] = "pending";
    if (stage === "initiated") {
      // nothing yet
    } else if (stage === "profile_created") {
      // a couple may be uploaded, none verified
      if (chance(0.3)) {
        status = "uploaded";
        verification = "pending";
      }
    } else if (stage === "documents_collected") {
      // most uploaded, mix of verified / pending / occasional rejected
      if (chance(0.85)) {
        status = "uploaded";
        const r = rnd();
        verification = r < 0.55 ? "verified" : r < 0.8 ? "pending" : "rejected";
      }
    } else {
      // kyc_verified + compliance_approved + active → all uploaded + verified
      status = "uploaded";
      verification = "verified";
    }
    return {
      key,
      status,
      verification,
      documentId: null, // populated after the document row is inserted
      uploadedAt: status === "uploaded" ? daysAgo(intIn(2, 40)) : null,
      verifiedAt: verification === "verified" ? daysAgo(intIn(1, 30)) : null,
      verifiedBy: null, // populated with an RM id below
      rejectionReason:
        verification === "rejected" ? "Document illegible - request a clean scan." : null,
    };
  });
}

/** Stage history: initiated at creation, then each subsequent stage entered
 *  backdated. The CURRENT stage's enteredAt is set to land the SLA in the
 *  desired band (overdue / due-soon / on-track) for the mid-funnel stages. */
function buildStageHistory(
  stage: OnboardingStage,
  createdAtDaysAgo: number,
): { stage: OnboardingStage; enteredAt: string }[] {
  const order: OnboardingStage[] = [
    "initiated",
    "profile_created",
    "documents_collected",
    "kyc_verified",
    "compliance_approved",
    "active",
  ];
  const targetIdx = order.indexOf(stage);
  const history: { stage: OnboardingStage; enteredAt: string }[] = [];
  // Spread the stages across the case's lifetime, with the current stage entered
  // recently enough to drive the SLA band.
  for (let i = 0; i <= targetIdx; i++) {
    const s = order[i]!;
    if (i < targetIdx) {
      // earlier stages: spread between creation and ~2 days ago
      const frac = targetIdx === 0 ? 0 : i / targetIdx;
      const day = Math.max(1, Math.round(createdAtDaysAgo * (1 - frac)));
      history.push({ stage: s, enteredAt: daysAgo(day) });
    } else {
      // current stage: pick an enteredAt that lands the SLA band
      history.push({ stage: s, enteredAt: currentStageEnteredAt(s) });
    }
  }
  return history;
}

/** The current stage's enteredAt - tuned so the pipeline shows a realistic mix
 *  of on-track / due-soon / overdue. */
function currentStageEnteredAt(stage: OnboardingStage): string {
  switch (stage) {
    case "initiated":
      // SLA 1d - half overdue, half on-track
      return chance(0.5) ? daysAgo(intIn(2, 4)) : daysAgo(0);
    case "profile_created":
      // SLA 3d (documents) - mix
      return chance(0.4) ? daysAgo(intIn(4, 7)) : chance(0.5) ? daysAgo(2) : daysAgo(0);
    case "documents_collected":
      // SLA 7d (KYC) - mix
      return chance(0.4) ? daysAgo(intIn(9, 14)) : chance(0.3) ? daysAgo(6) : daysAgo(intIn(1, 4));
    case "kyc_verified":
      // SLA 2d (compliance) - mix
      return chance(0.4) ? daysAgo(intIn(3, 6)) : chance(0.3) ? daysAgo(1) : daysAgo(0);
    case "compliance_approved":
      // SLA 1d (activate) - mix
      return chance(0.4) ? daysAgo(intIn(2, 4)) : daysAgo(0);
    case "active":
      return daysAgo(intIn(1, 30));
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  // Dynamic import - see the env-loader note at the top of the file.
  const { db } = await import("@/db");

  const seedNames = SEED_COMPANIES.map((c) => c.name);
  // A Postgres text[] literal built from the JS array via sql.join - postgres-js
  // serializes a bare JS array param as a record, so `ANY($arr::text[])` fails
  // with "cannot cast type record to text[]". The ARRAY[...] literal avoids it.
  const seedNamesArr = sql`ARRAY[${sql.join(
    seedNames.map((n) => sql`${n}`),
    sql`, `,
  )}]::text[]`;

  console.log("Onboarding seed: cleaning previous onboarding-seed data...");
  // Delete seed kyc_records first (kyc_record.party_id is ON DELETE RESTRICT,
  // so the party delete below would fail if these rows remained).
  await db.execute(sql`
    DELETE FROM kyc_record
    WHERE edd_reason = 'ONBOARDING_SEED'
      AND party_id IN (SELECT party_id FROM party WHERE legal_name = ANY(${seedNamesArr}))
  `);
  // Delete seed documents (fileName marker) - also cascades with the party
  // delete, but explicit so a partial prior run is cleaned too.
  await db.execute(sql`
    DELETE FROM document
    WHERE file_name LIKE 'ONBOARDING_SEED:%'
      AND party_id IN (SELECT party_id FROM party WHERE legal_name = ANY(${seedNamesArr}))
  `);
  // Delete the seed parties (documents cascade; kyc_records already gone).
  await db.execute(sql`DELETE FROM party WHERE legal_name = ANY(${seedNamesArr})`);

  // RMs - coverage_rm users + senior staff so the by-RM analytics has bars.
  const rmRows = await db.execute<{ user_id: string; email: string }>(sql`
    SELECT u.user_id, u.email FROM app_user u
    WHERE u.is_active = true AND u.deleted_at IS NULL
      AND u.email IN (
        'rati@binarycapital.in',
        'arjun@binarycapital.in',
        'shray@binarycapital.in',
        'rajesh@binarycapital.in',
        'neha@binarycapital.in'
      )
    ORDER BY u.email
  `);
  const rmIds = rmRows.map((r) => r.user_id);
  if (rmIds.length === 0) {
    throw new Error("No RM app_users found - run the main seed first.");
  }
  const complianceUserId =
    rmRows.find((r) => r.email === "neha@binarycapital.in")?.user_id ?? rmIds[0]!;

  console.log(
    `Onboarding seed: creating ${SEED_COMPANIES.length} onboarding cases...`,
  );

  const counts: Record<OnboardingStage, number> = {
    initiated: 0,
    profile_created: 0,
    documents_collected: 0,
    kyc_verified: 0,
    compliance_approved: 0,
    active: 0,
  };

  for (const co of SEED_COMPANIES) {
    const stage = pickStage();
    counts[stage]++;
    const createdAtDaysAgo = intIn(8, 60);
    const stageHistory = buildStageHistory(stage, createdAtDaysAgo);
    const checklist = buildChecklist(stage);
    const assignedRm = chance(0.9) ? pick(rmIds) : null;
    const state = pick(STATES);
    const city = pick(CITIES);
    const contactName = `${pick(CONTACT_FIRST)} ${pick(CONTACT_LAST)}`;

    // Create the prospect party.
    const partyRows = await db.execute<{ party_id: string }>(sql`
      INSERT INTO party (
        legal_name, display_name, party_nature, country_of_incorporation,
        domicile_state, status, brand_origin, source, created_by_user_id
      ) VALUES (
        ${co.name}, ${co.name}, 'organization', 'IN',
        ${state}, ${stage === "active" ? "active" : "onboarding"}, 'binarybonds', 'manual',
        ${assignedRm ?? rmIds[0]!}
      )
      RETURNING party_id
    `);
    const partyId = partyRows[0]?.party_id;
    if (!partyId) throw new Error(`party insert failed for ${co.name}`);

    // party_type = prospect.
    await db.execute(sql`
      INSERT INTO party_type_assignment (party_id, party_type, assigned_by_user_id)
      VALUES (${partyId}, 'prospect', ${assignedRm ?? rmIds[0]!})
    `);

    // File document rows for uploaded checklist items + stamp documentId +
    // verifiedBy. Seed documents carry the 'ONBOARDING_SEED:' fileName marker
    // so the clean step can find them.
    for (const d of checklist) {
      if (d.status !== "uploaded") continue;
      const docRows = await db.execute<{ document_id: string }>(sql`
        INSERT INTO document (party_id, document_type, file_name, uploaded_by_user_id)
        VALUES (${partyId}, ${ONBOARDING_DOC_TO_DOCUMENT_TYPE[d.key]}, ${"ONBOARDING_SEED:" + ONBOARDING_DOC_LABELS[d.key]}, ${assignedRm ?? rmIds[0]!})
        RETURNING document_id
      `);
      d.documentId = docRows[0]?.document_id ?? null;
      if (d.verification === "verified") {
        d.verifiedBy = assignedRm ?? rmIds[0]!;
      }
    }

    // Raise + link a kyc_record for kyc_verified onward. Approved for those
    // stages (the gate that requires an approved KYC); pending for an
    // documents_collected case that has all docs verified (demonstrating a KYC
    // in flight). The seed KYC carries edd_reason='ONBOARDING_SEED' so the
    // clean step can find it (kyc_record.party_id is RESTRICT).
    let kycRecordId: string | null = null;
    if (stage === "kyc_verified" || stage === "compliance_approved" || stage === "active") {
      const kycRows = await db.execute<{ kyc_record_id: string }>(sql`
        INSERT INTO kyc_record (party_id, kyc_type, status, risk_rating, cdd_done_at, approved_at, valid_until, approved_by_user_id, edd_reason)
        VALUES (${partyId}, 'CDD', 'approved', ${pick(["low", "medium", "medium", "high"])}, ${daysAgo(intIn(10, 40))}, ${daysAgo(intIn(8, 38))}, ${daysAgo(-intIn(300, 3500))}, ${complianceUserId}, 'ONBOARDING_SEED')
        RETURNING kyc_record_id
      `);
      kycRecordId = kycRows[0]?.kyc_record_id ?? null;
    } else if (stage === "documents_collected" && checklist.every((d) => d.verification === "verified")) {
      // A documents_collected case with all docs verified but KYC still pending
      // - surfaces the "raise + approve KYC to advance" gate in the UI.
      const kycRows = await db.execute<{ kyc_record_id: string }>(sql`
        INSERT INTO kyc_record (party_id, kyc_type, status, risk_rating, edd_reason)
        VALUES (${partyId}, 'CDD', 'in_review', 'medium', 'ONBOARDING_SEED')
        RETURNING kyc_record_id
      `);
      kycRecordId = kycRows[0]?.kyc_record_id ?? null;
    }

    // Compliance stamps for compliance_approved + active.
    const complianceApprovedBy =
      stage === "compliance_approved" || stage === "active" ? complianceUserId : null;
    const complianceApprovedAt =
      stage === "compliance_approved" || stage === "active"
        ? stageHistory.find((h) => h.stage === "compliance_approved")?.enteredAt ?? daysAgo(1)
        : null;
    // A couple of kyc_verified cases carry a prior compliance rejection (the
    // "re-submit for compliance" state).
    const complianceRejectedBy =
      stage === "kyc_verified" && chance(0.25) ? complianceUserId : null;
    const complianceRejectedAt =
      complianceRejectedBy != null ? daysAgo(intIn(1, 3)) : null;
    const complianceNote = complianceRejectedBy
      ? "Beneficial ownership declaration incomplete - re-submit with the full ownership chain."
      : stage === "compliance_approved" || stage === "active"
        ? "Cleared. Identity, ownership and source-of-funds verified."
        : null;

    const meta: OnboardingMeta = {
      stage,
      clientType: co.type,
      assignedRm,
      contactName,
      contactTitle: pick(CONTACT_TITLES),
      contactEmail: `${contactName.toLowerCase().replace(/\s+/g, ".")}@${pick(["gmail.com", "outlook.com", "corp.in"])}`,
      contactPhone: `+91${intIn(7000000000, 9999999999)}`,
      pan: `${String.fromCharCode(65 + intIn(0, 25))}${String.fromCharCode(65 + intIn(0, 25))}${String.fromCharCode(65 + intIn(0, 25))}${String.fromCharCode(65 + intIn(0, 25))}${String.fromCharCode(65 + intIn(0, 25))}${intIn(1000, 9999)}${String.fromCharCode(65 + intIn(0, 25))}`,
      cin: chance(0.7) ? `U${intIn(10000, 99999)}MH${intIn(2014, 2024)}PTC${intIn(10000, 99999)}` : null,
      gstin: chance(0.8) ? `27${String.fromCharCode(65 + intIn(0, 25))}${String.fromCharCode(65 + intIn(0, 25))}${String.fromCharCode(65 + intIn(0, 25))}${String.fromCharCode(65 + intIn(0, 25))}${String.fromCharCode(65 + intIn(0, 25))}${intIn(1000, 9999)}${String.fromCharCode(65 + intIn(0, 25))}${intIn(0, 9)}Z${intIn(0, 9)}` : null,
      state,
      city,
      documents: checklist,
      kycRecordId,
      complianceApprovedBy,
      complianceApprovedAt: complianceApprovedAt ?? null,
      complianceRejectedBy,
      complianceRejectedAt,
      complianceNote,
      stageHistory,
      rejectionReason: null,
      createdAt: daysAgo(createdAtDaysAgo),
      updatedAt: daysAgo(intIn(0, 3)),
    };

    await db.execute(
      sql`UPDATE party SET onboarding_meta = ${JSON.stringify(meta)}::jsonb, updated_at = now() WHERE party_id = ${partyId}`,
    );
  }

  console.log(
    `Onboarding seed: done. ${SEED_COMPANIES.length} cases - ` +
      ONBOARDING_STAGE_ORDER.map((s) => `${s}=${counts[s]}`).join(", "),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Onboarding seed failed:", err);
  process.exit(1);
});
