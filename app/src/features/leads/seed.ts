// Lead & Opportunity Management - seed.
//
// Run AFTER the main seed (src/db/seed.ts):  npx tsx src/features/leads/seed.ts
//
// Populates party.lead_meta (migration 0006) with a realistic Indian bond-house
// lead pipeline: ~30 prospect parties promoted into leads across the full
// funnel (new → qualified → opportunity → won/lost), plus a handful of
// existing-client leads attached to active issuer/investor parties. Won leads
// get a real deal row (dealCode prefix LD-) linked via deal_party so the
// lead→deal conversion is demonstrated end-to-end.
//
// Re-runnable + self-cleaning: clears every party.lead_meta and deletes the
// LD-prefixed deals it created on a previous run before inserting, so the
// pipeline is identical every time. Deterministic via a seeded mulberry32 PRNG.
//
// NOTE: the main seed TRUNCATEs every table on re-run, which wipes lead_meta
// and the LD-deals - re-run this script after any main-seed re-run to restore
// the lead pipeline.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";

// Load .env.local before importing the db client (same pattern as the main
// seed - tsx does not load Next env, and the postgres-js client reads
// DATABASE_URL at module-eval time). The `@/db` import is DYNAMIC (inside
// main) because static imports are hoisted above this block - a static
// `import { db } from "@/db"` would construct the client against the
// placeholder URL before the env loader runs.
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
  LEAD_DEAL_TYPE_LABELS,
  type LeadDealType,
  type LeadLossReason,
  type LeadMeta,
  type LeadSource,
  type LeadStage,
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
const rnd = mulberry32(0x1eafc0de);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const chance = (p: number) => rnd() < p;
const round = (n: number, d = 2) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
const intIn = (lo: number, hi: number) => Math.floor(rnd() * (hi - lo + 1)) + lo;

// ---------------------------------------------------------------------------
// Domain vocabularies (kept narrow + realistic for an Indian bond house).
// ---------------------------------------------------------------------------
const SOURCES: LeadSource[] = [
  "referral",
  "website",
  "event",
  "cold_call",
  "existing_client",
];

const DEAL_TYPES: LeadDealType[] = [
  "bond_underwriting",
  "high_yield_bond",
  "private_placement_debt",
  "gsec_auction",
  "structured_finance",
  "supply_chain_finance",
  "project_finance",
  "dcm_advisory",
  "rating_advisory",
  "m_and_a",
  "portfolio_management_mandate",
  "secondary_trading_advisory",
];

const LOSS_REASONS: LeadLossReason[] = [
  "pricing_uncompetitive",
  "competitor_selected",
  "deal_deferred",
  "client_withdrew",
  "failed_kyc",
  "no_budget",
  "lost_to_in_house",
  "other",
];

const CONTACT_FIRST = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna",
  "Ishaan", "Rohan", "Ananya", "Diya", "Aadhya", "Saanvi", "Priya", "Kavya",
  "Pooja", "Neha", "Ritu", "Meera",
];
const CONTACT_LAST = [
  "Mehta", "Reddy", "Iyer", "Nair", "Joshi", "Kapoor", "Agarwal", "Gupta",
  "Shah", "Patel", "Rao", "Naidu", "Bose", "Chopra", "Malhotra", "Saxena",
];
const CONTACT_TITLES = [
  "CFO", "Treasurer", "MD & CEO", "Vice President - Finance", "Head of Treasury",
  "Director", "Promoter", "Chief Investment Officer",
];

/** Stage distribution - a healthy funnel: wide top, narrow bottom. */
function pickStage(): LeadStage {
  const r = rnd();
  if (r < 0.4) return "new";
  if (r < 0.62) return "qualified";
  if (r < 0.84) return "opportunity";
  if (r < 0.94) return "won";
  return "lost";
}

/** BANT score by stage - new leads are partially qualified, closed-won leads
 *  always fully qualified, lost leads vary. */
function pickBant(stage: LeadStage) {
  if (stage === "won" || stage === "opportunity") {
    return { budget: true, authority: true, need: true, timeline: true };
  }
  if (stage === "qualified") {
    return { budget: true, authority: true, need: true, timeline: true };
  }
  if (stage === "lost") {
    return {
      budget: chance(0.4),
      authority: chance(0.5),
      need: chance(0.6),
      timeline: chance(0.3),
    };
  }
  // new - 0 to 3 criteria met (not yet fully qualified).
  return {
    budget: chance(0.45),
    authority: chance(0.4),
    need: chance(0.5),
    timeline: chance(0.3),
  };
}

/** ISO date n days from today (negative = past). */
function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Probability by stage with a little noise. */
function pickProbability(stage: LeadStage): number {
  switch (stage) {
    case "new":
      return intIn(5, 20);
    case "qualified":
      return intIn(25, 40);
    case "opportunity":
      return intIn(45, 75);
    case "won":
      return 100;
    case "lost":
      return 0;
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  // Dynamic import - see the env-loader note at the top of the file.
  const { db } = await import("@/db");

  console.log("Leads seed: cleaning previous lead data...");
  // Drop LD-prefixed deals (cascades deal_party) from a prior run.
  await db.execute(
    sql`DELETE FROM deal WHERE deal_code LIKE 'LD-%'`,
  );
  // Clear all lead_meta so the pipeline is rebuilt identically.
  await db.execute(sql`UPDATE party SET lead_meta = NULL`);

  // RMs - the coverage_rm users (rati, arjun) plus a couple of senior staff
  // so the by-RM analytics has more than one bar.
  const rmRows = await db.execute<{ user_id: string; email: string }>(sql`
    SELECT u.user_id, u.email FROM app_user u
    WHERE u.is_active = true AND u.deleted_at IS NULL
      AND u.email IN (
        'rati@binarycapital.in',
        'arjun@binarycapital.in',
        'shray@binarycapital.in',
        'rajesh@binarycapital.in'
      )
    ORDER BY u.email
  `);
  const rmIds = rmRows.map((r) => r.user_id);
  if (rmIds.length === 0) {
    throw new Error("No RM app_users found - run the main seed first.");
  }
  const rmByEmail = new Map(rmRows.map((r) => [r.email, r.user_id]));

  // Prospect parties (type=prospect) - the primary lead pool.
  const prospectRows = await db.execute<{ party_id: string; legal_name: string }>(sql`
    SELECT p.party_id, p.legal_name
    FROM party p
    JOIN party_type_assignment pta ON pta.party_id = p.party_id AND pta.deleted_at IS NULL
    WHERE pta.party_type = 'prospect' AND p.deleted_at IS NULL
    ORDER BY p.legal_name
  `);

  // A few active issuers/investors to attach existing-client leads to.
  const existingRows = await db.execute<{ party_id: string; legal_name: string }>(sql`
    SELECT p.party_id, p.legal_name
    FROM party p
    JOIN party_type_assignment pta ON pta.party_id = p.party_id AND pta.deleted_at IS NULL
    WHERE pta.party_type IN ('issuer','investor') AND p.deleted_at IS NULL
      AND p.lead_meta IS NULL
    ORDER BY p.legal_name
    LIMIT 8
  `);

  type SeedLead = {
    partyId: string;
    legalName: string;
    source: LeadSource;
    isExisting: boolean;
  };

  const seedLeads: SeedLead[] = [
    ...prospectRows.map((r) => ({
      partyId: r.party_id,
      legalName: r.legal_name,
      source: pick(SOURCES.filter((s) => s !== "existing_client")),
      isExisting: false,
    })),
    ...existingRows.map((r) => ({
      partyId: r.party_id,
      legalName: r.legal_name,
      source: "existing_client" as const,
      isExisting: true,
    })),
  ];

  console.log(
    `Leads seed: writing ${seedLeads.length} leads (${prospectRows.length} prospects + ${existingRows.length} existing clients)...`,
  );

  let won = 0;
  let lost = 0;
  let open = 0;

  for (const sl of seedLeads) {
    const stage = pickStage();
    const bant = pickBant(stage);
    const dealType = pick(DEAL_TYPES);
    const estSizeCr = round(intIn(25, 2000) + (chance(0.2) ? intIn(0, 500) : 0), 0);
    const probability = pickProbability(stage);
    const assignedRm = chance(0.85) ? pick(rmIds) : null;

    // expectedClose: opportunity + won have a date; new/qualified sometimes.
    let expectedClose: string | null = null;
    if (stage === "opportunity" || stage === "won") {
      expectedClose = dayOffset(intIn(20, 240));
    } else if (stage === "qualified" && chance(0.5)) {
      expectedClose = dayOffset(intIn(60, 300));
    } else if (stage === "new" && chance(0.25)) {
      expectedClose = dayOffset(intIn(120, 365));
    }

    // closedAt: won/lost spread across the last ~6 months for the over-time chart.
    let closedAt: string | null = null;
    if (stage === "won" || stage === "lost") {
      closedAt = new Date(Date.now() - intIn(5, 175) * 86400000).toISOString();
    }

    const contactName = `${pick(CONTACT_FIRST)} ${pick(CONTACT_LAST)}`;
    const meta: LeadMeta = {
      stage,
      source: sl.source,
      dealType,
      estSizeCr,
      probability,
      expectedClose,
      assignedRm,
      contactName,
      contactTitle: pick(CONTACT_TITLES),
      contactEmail: `${contactName.toLowerCase().replace(/\s+/g, ".")}@${pick(["gmail.com", "outlook.com", "corp.in"])}`,
      contactPhone: `+91${intIn(7000000000, 9999999999)}`,
      bant,
      notes:
        stage === "new"
          ? "Initial conversation - qualify on BANT and confirm the financing need."
          : stage === "lost"
            ? `Closed lost: ${pick(LOSS_REASONS).replace(/_/g, " ")}.`
            : chance(0.5)
              ? "Active dialogue - next step is a mandate letter."
              : null,
      lossReason: stage === "lost" ? pick(LOSS_REASONS) : null,
      convertedDealId: null,
      closedAt,
      createdAt: new Date(Date.now() - intIn(10, 220) * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - intIn(0, 30) * 86400000).toISOString(),
    };

    // Won leads → create a real deal row + deal_party link.
    if (stage === "won") {
      const dealCode = `LD-${new Date().getFullYear()}-${sl.partyId.slice(0, 4).toUpperCase()}`;
      const dealRole = dealType === "m_and_a" ? "target" : "issuer";
      const dealName = `${sl.legalName} - ${LEAD_DEAL_TYPE_LABELS[dealType]}`;
      const dealRows = await db.execute<{ deal_id: string }>(sql`
        INSERT INTO deal (deal_code, deal_type, deal_name, status, brand, lead_user_id, target_close_date, target_size, currency_code, created_by_user_id)
        VALUES (${dealCode}, ${dealType}, ${dealName}, 'mandated', 'binarybonds', ${assignedRm}, ${expectedClose}, ${String(estSizeCr * 1e7)}, 'INR', ${rmByEmail.get("shray@binarycapital.in") ?? rmIds[0]})
        RETURNING deal_id
      `);
      const dealId = dealRows[0]?.deal_id;
      if (dealId) {
        meta.convertedDealId = dealId;
        await db.execute(sql`
          INSERT INTO deal_party (deal_id, party_id, role, is_lead)
          VALUES (${dealId}, ${sl.partyId}, ${dealRole}, true)
        `);
      }
      won++;
    } else if (stage === "lost") {
      lost++;
    } else {
      open++;
    }

    await db.execute(
      sql`UPDATE party SET lead_meta = ${JSON.stringify(meta)}::jsonb, updated_at = now() WHERE party_id = ${sl.partyId}`,
    );
  }

  console.log(
    `Leads seed: done. open=${open} won=${won} lost=${lost} total=${seedLeads.length}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Leads seed failed:", err);
  process.exit(1);
});
