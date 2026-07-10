// Deterministic mock-data seed for the Binary Capital CRM.
//
// Run:  npx tsx src/db/seed.ts
//
// Connects via the shared `db` client (src/db/index.ts) and inserts a realistic
// Indian capital-markets dev dataset into the LIVE local Postgres
// (binary_crm). Re-runnable: TRUNCATEs every table (CASCADE) before inserting.
//
// Determinism: a seeded mulberry32 PRNG drives every "random" choice so two
// runs produce identical rows (stable UUIDs come from the DB's
// gen_random_uuid() default - those differ per run, but the *shape* and
// relationships are identical). This is a standalone node script executed by
// tsx, not a workflow-sandboxed call, so it is free to use the PRNG directly.
//
// Insertion order respects FK dependencies (see schema/index.ts header):
//   sector_code → rbac(role/permission/role_permission) → app_user → user_role
//   → users(auth) → party → party_type_assignment → party_identifier → address
//   → contact → party_contact → information_barrier(+UPDATE party.barrier_id)
//   → relationship → demat_account → instrument → deal → deal_party
//   → allocation_event → credit_analysis → financial_statement
//   → credit_analysis_fs_link → ratio_result → scorecard_template → scorecard
//   → credit_score → external_rating → rating_ladder → exposure → credit_limit
//   → kyc_record → kyc_beneficial_owner → consent_record → data_subject_request
//   → interaction → interaction_attendee → task → document → audit_log
//   → (UPDATE app_user.employee_party_id).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";

// Load .env.local manually (tsx does not load Next env, and `dotenv` is not a
// dependency). MUST run before the `./index` import, which constructs the
// postgres-js client from process.env.DATABASE_URL at module-eval time. Static
// imports are hoisted above this block, so `./index` is imported dynamically
// inside `main()` after this loader has populated the env.
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore - fall back to db client placeholder */
  }
}

import {
  address,
  allocationEvent,
  appUser,
  auditLog,
  consentRecord,
  contact,
  creditAnalysis,
  creditAnalysisFsLink,
  creditLimit,
  creditScore,
  dataSubjectRequest,
  deal,
  dealParty,
  dematAccount,
  document as documentTable,
  exposure,
  externalRating,
  financialModel,
  financialStatement,
  informationBarrier,
  instrument,
  interaction,
  interactionAttendee,
  kycBeneficialOwner,
  kycRecord,
  party,
  partyContact,
  partyIdentifier,
  partyTypeAssignment,
  permission,
  ratingLadder,
  ratioResult,
  relationship,
  role,
  rolePermission,
  scorecard,
  scorecardTemplate,
  sectorCode,
  task as taskTable,
  taskDependency,
  tradeEvent,
  userRole,
} from "./schema";

// Real bond-pricing engine (pure TS, no "use server"/no DB) so saved
// bond_pricing financial_model rows carry the exact JSONB shape the modeling
// detail page renders (clean/dirty, YTM, duration, DV01, convexity, cash-flow
// schedule). Resolved as a relative path - tsx compiles it on import.
import {
  computeBondMetrics,
  type BondInputs,
  type InstrumentType as BondInstrumentType,
} from "../features/modeling/bondPricing";
// Lead + onboarding JSONB shapes + canonical orderings/labels. The main seed
// folds the lead + onboarding pipelines in here (migration 0006 / 0007 added
// the lead_meta / onboarding_meta JSONB columns on party, which the Drizzle
// party schema does not model - so they are written via raw SQL below). The
// types keep the blobs structurally identical to what features/leads + features
// /onboarding read, and the runtime constants (canonical orderings, doc labels,
// doc→document_type map) are the single source of truth the UI uses.
import {
  type LeadDealType,
  type LeadLossReason,
  type LeadMeta,
  type LeadSource,
  type LeadStage,
} from "../features/leads/types";
import {
  ONBOARDING_DOC_LABELS,
  ONBOARDING_DOC_ORDER,
  ONBOARDING_DOC_TO_DOCUMENT_TYPE,
  ONBOARDING_STAGE_ORDER,
  type OnboardingClientType,
  type OnboardingDocItem,
  type OnboardingDocKey,
  type OnboardingMeta,
  type OnboardingStage,
} from "../features/onboarding/types";

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) - deterministic.
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
const rnd = mulberry32(20260626);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const pickN = <T>(arr: readonly T[], n: number): T[] => {
  const out: T[] = [];
  const used = new Set<number>();
  while (out.length < n && used.size < arr.length) {
    const i = Math.floor(rnd() * arr.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(arr[i]);
  }
  return out;
};
const chance = (p: number) => rnd() < p;

// ---------------------------------------------------------------------------
// Scale factor + chunked bulk-insert helper.
//
// SCALE multiplies every headline count (parties, contacts, deals, credit
// analyses, KYC, interactions, tasks, leads, onboarding …) so the dev dataset
// validates the full prototype at ~10k parties instead of ~880. Each block
// below reads its count off this constant - change one number to re-scale.
//
// chunkedInsert: postgres-js caps a single INSERT statement at 65535 bind
// parameters. At 10x scale several tables blow that limit (10k parties × ~12
// cols = 120k params; 13k contacts × ~10 cols = 130k; ratio_result ~21k × 4;
// allocation_event; party_identifier; address …). This helper slices rows into
// safe chunks and concatenates `.returning()` results in input order so the
// existing `.returning()`-based ID plumbing keeps working. Used for every bulk
// insert whose row count × column count could approach the limit at scale; for
// small arrays it collapses to a single chunk (no behavior change).
// ---------------------------------------------------------------------------
const SCALE = 10;
async function chunkedInsert<R = void>(
  table: any,
  rows: readonly Record<string, any>[],
  returning?: Record<string, any>,
  chunkSize = 500,
): Promise<R[]> {
  if (!rows.length) return [] as any;
  const out: R[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize) as any;
    if (returning) {
      const inserted: R[] = await db.insert(table).values(slice).returning(returning);
      for (const r of inserted) out.push(r);
    } else {
      await db.insert(table).values(slice);
    }
  }
  return out as any;
}
// Returns a STRING because every Drizzle `numeric(...)` column is typed as
// `string` (PG numeric round-trips as string to preserve precision). All
// `round(...)` call sites in this seed feed numeric columns, so a string return
// satisfies the insert type without per-site `.toString()` noise.
const round = (v: number, d = 2): string => {
  const f = 10 ** d;
  return String(Math.round(v * f) / f);
};
// Format a local Date as 'yyyy-mm-dd' for PG `date` columns (postgres-js does
// not accept Date for untyped/`date` params via the drizzle path - strings are
// safe). Uses LOCAL components since the Dates are constructed with local y/m/d.
const ymd = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate(),
  ).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// Realism helpers - anchor "now" + skewed date spread.
//
// The vision critic flagged that every party's lastTouchAt collapsed to the
// same "14h ago" (all createdAt defaulted to NOW), every interaction showed
// the same year-ago timestamp, and KYC refresh showed "no schedule" for every
// row. These helpers spread those dates across a realistic last-~90-days
// window with a long tail, driven by the deterministic PRNG so two runs still
// produce identical rows. NOW is pinned to the dev "today" (2026-06-27) - the
// relative formatters in the view layer render "today / 3d ago / 6w ago"
// against the real Date.now(), which stays close enough to this anchor.
// ---------------------------------------------------------------------------
const NOW = new Date(2026, 5, 27, 11, 0, 0, 0);
const DAY_MS = 86_400_000;
// Skewed days-ago: dense near 0 (touched today / yesterday), sparse near `max`
// (a long tail of stale touches). sqrt-style CDF via pow(u, 1.7).
const skewDaysAgo = (max: number) => Math.floor(Math.pow(rnd(), 1.7) * max);
// A Date roughly `skewDaysAgo(max)` in the past, with a random time-of-day so
// timestamps do not all land on midnight.
const recentDate = (maxDays: number) =>
  new Date(
    NOW.getTime() -
      skewDaysAgo(maxDays) * DAY_MS -
      Math.floor(rnd() * DAY_MS),
  );
// A Date a bounded window in the past: `(min + rnd*span)` days ago.
const pastDate = (minDays: number, spanDays: number) =>
  new Date(NOW.getTime() - (minDays + Math.floor(rnd() * spanDays)) * DAY_MS);
// A Date a bounded window in the future: `(min + rnd*span)` days ahead.
const futureDate = (minDays: number, spanDays: number) =>
  new Date(NOW.getTime() + (minDays + Math.floor(rnd() * spanDays)) * DAY_MS);
// Weighted pick - pairs of [value, weight]. Used to give deal stages / KYC
// refresh buckets realistic, non-uniform distributions.
const pickWeighted = <T>(items: readonly [T, number][]): T => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1]![0];
};

// ---------------------------------------------------------------------------
// Financial-statement realism.
//
// The old seed filled 5 line items with i.i.d. uniform noise per period, so
// every party's 3-period ratio sparkline was flat random noise and parties
// did not differ meaningfully. We now assign each credit-analysis issuer a
// trajectory PROFILE (improving / deteriorating / stable / growing / declining
// / volatile / leverage_up / deleveraging / turnaround) and derive a full,
// internally-consistent 25-line-item set per period from a small set of
// profile parameters + per-party jitter. Ratios are then computed from those
// line items (matching src/features/credit/ratios.ts formulas) so the
// workspace sparklines trend (up / down / flat) and diverge across parties.
// ---------------------------------------------------------------------------
type FinProfile =
  | "improving"
  | "deteriorating"
  | "stable"
  | "growing"
  | "declining"
  | "volatile"
  | "leverage_up"
  | "deleveraging"
  | "turnaround";

interface ProfileParams {
  revGrowth: [number, number]; // y2→y1, y1→y0
  ebitdaMargin: [number, number, number]; // y2, y1, y0
  debtToEbitda: [number, number, number]; // y2, y1, y0 (leverage trajectory)
  interestRate: number;
}

const FIN_PROFILES: Record<FinProfile, ProfileParams> = {
  improving:      { revGrowth: [1.08, 1.12], ebitdaMargin: [0.12, 0.14, 0.16], debtToEbitda: [3.5, 3.0, 2.4], interestRate: 0.090 },
  deteriorating:  { revGrowth: [0.97, 0.90], ebitdaMargin: [0.15, 0.12, 0.08], debtToEbitda: [2.5, 3.2, 4.2], interestRate: 0.100 },
  stable:         { revGrowth: [1.03, 1.04], ebitdaMargin: [0.13, 0.13, 0.135],debtToEbitda: [2.0, 2.0, 2.0], interestRate: 0.085 },
  growing:        { revGrowth: [1.20, 1.25], ebitdaMargin: [0.10, 0.11, 0.12], debtToEbitda: [3.0, 3.2, 3.3], interestRate: 0.090 },
  declining:      { revGrowth: [0.92, 0.85], ebitdaMargin: [0.09, 0.07, 0.04], debtToEbitda: [3.0, 3.8, 5.0], interestRate: 0.100 },
  volatile:       { revGrowth: [1.15, 0.88], ebitdaMargin: [0.14, 0.09, 0.13], debtToEbitda: [2.8, 3.6, 3.0], interestRate: 0.095 },
  leverage_up:    { revGrowth: [1.05, 1.06], ebitdaMargin: [0.14, 0.14, 0.14], debtToEbitda: [2.5, 3.8, 4.5], interestRate: 0.100 },
  deleveraging:   { revGrowth: [1.04, 1.05], ebitdaMargin: [0.13, 0.14, 0.15], debtToEbitda: [4.5, 3.5, 2.5], interestRate: 0.085 },
  turnaround:     { revGrowth: [0.85, 1.15], ebitdaMargin: [0.03, 0.06, 0.11], debtToEbitda: [5.0, 4.2, 3.2], interestRate: 0.100 },
};
const FIN_PROFILE_LIST = Object.keys(FIN_PROFILES) as FinProfile[];

// Jitter a base value by ±pct so two parties with the same profile still differ.
const jitter = (v: number, pct: number) => v * (1 + (rnd() * 2 - 1) * pct);

// Generate 3 periods (oldest → latest) of full, consistent line items for one
// issuer. All values in INR crores. Returns numeric values; the caller rounds
// to strings for the numeric columns / jsonb.
interface PeriodLineItems {
  revenue: number; cogs: number; ebit: number; depreciation_amortization: number;
  ebitda: number; interest_expense: number; pbt: number; pat: number;
  total_debt: number; cash_and_equivalents: number; marketable_securities: number;
  current_assets: number; current_liabilities: number; inventory: number;
  trade_receivables: number; trade_payables: number; total_assets: number;
  net_worth: number; tangible_net_worth: number; cfo: number;
  cfo_before_wc_changes: number; capex: number; dividends_paid: number;
  cfads: number; debt_service: number;
}

function genFinancials(profile: FinProfile): PeriodLineItems[] {
  const p = FIN_PROFILES[profile];
  // Per-party jitter on the structural params (small) so same-profile parties
  // are not identical.
  const margin = p.ebitdaMargin.map((m) => jitter(m, 0.08)) as [number, number, number];
  const lev = p.debtToEbitda.map((d) => jitter(d, 0.10)) as [number, number, number];
  const rate = jitter(p.interestRate, 0.06);
  const daPct = jitter(0.045, 0.10);
  const taxRate = jitter(0.252, 0.05);
  const cashPct = jitter(0.040, 0.20);
  const invDays = jitter(48, 0.18);
  const recDays = jitter(58, 0.18);
  const payDays = jitter(52, 0.18);
  const capexPct = jitter(0.055, 0.25);
  const payout = jitter(0.22, 0.30);
  // Log-uniform revenue base (crores): ~250 to ~9000, most mid-cap.
  const revY2 = 250 * Math.pow(36, rnd());
  // Equity base large enough to absorb downside without going negative.
  const nwStart = revY2 * jitter(2.0, 0.18);

  const periods: PeriodLineItems[] = [];
  let revenue = revY2;
  let netWorth = nwStart;
  for (let i = 0; i < 3; i++) {
    // i=0 → oldest (y2), i=1 → y1, i=2 → latest (y0).
    if (i > 0) revenue *= p.revGrowth[i - 1]!;
    revenue = jitter(revenue, 0.015);
    const ebitda = Math.max(revenue * margin[i]!, revenue * 0.01);
    const da = revenue * daPct;
    const ebit = ebitda - da;
    const totalDebt = Math.max(ebitda * lev[i]!, 5);
    const interest = totalDebt * rate;
    const pbt = ebit - interest;
    const tax = pbt > 0 ? pbt * taxRate : 0;
    const pat = pbt - tax;
    const cogs = Math.max(revenue - ebitda, 1);
    const cash = revenue * cashPct;
    const marketableSec = chance(0.5) ? revenue * jitter(0.015, 0.3) : 0;
    const inventory = (cogs * invDays) / 365;
    const tradeRec = (revenue * recDays) / 365;
    const tradePay = (cogs * payDays) / 365;
    const currentAssets = cash + inventory + tradeRec + marketableSec;
    const currentLiab = tradePay + totalDebt * 0.25;
    const dividends = pat > 0 ? pat * payout : 0;
    netWorth = Math.max(netWorth + pat - dividends, revenue * 0.15);
    const tangibleNw = netWorth * 0.9;
    const totalAssets = Math.max(netWorth + totalDebt + tradePay, currentAssets + totalDebt * 0.5);
    const cfo = pat + da;
    const ffo = cfo + da * 0.05;
    const capex = revenue * capexPct;
    const cfads = ebitda - tax - capex * 0.35;
    const debtService = interest + totalDebt * 0.12;
    periods.push({
      revenue, cogs, ebit, depreciation_amortization: da, ebitda,
      interest_expense: interest, pbt, pat, total_debt: totalDebt,
      cash_and_equivalents: cash, marketable_securities: marketableSec,
      current_assets: currentAssets, current_liabilities: currentLiab,
      inventory, trade_receivables: tradeRec, trade_payables: tradePay,
      total_assets: totalAssets, net_worth: netWorth,
      tangible_net_worth: tangibleNw, cfo, cfo_before_wc_changes: ffo,
      capex, dividends_paid: dividends, cfads, debt_service: debtService,
    });
  }
  return periods;
}

// Compute the 8 persisted ratio codes from one period's line items, matching
// src/features/credit/ratios.ts formulas (the workspace recomputes these for
// sparklines, so persisting matching values keeps both views consistent).
const sd = (a: number | null, b: number | null): number | null =>
  a === null || b === null || b === 0 ? null : a / b;
function ratiosFromLineItems(li: PeriodLineItems, prior: PeriodLineItems | null) {
  const avgNw = prior ? (li.net_worth + prior.net_worth) / 2 : li.net_worth;
  const capEmp = li.net_worth + li.total_debt - li.cash_and_equivalents;
  const avgCapEmp = prior ? (capEmp + (prior.net_worth + prior.total_debt - prior.cash_and_equivalents)) / 2 : capEmp;
  return {
    debt_equity: sd(li.total_debt, li.net_worth),
    interest_coverage: sd(li.ebit, li.interest_expense),
    current_ratio: sd(li.current_assets, li.current_liabilities),
    debt_ebitda: sd(li.total_debt, li.ebitda),
    roce: sd(li.ebit, avgCapEmp),
    roe: sd(li.pat, avgNw),
    ebitda_margin: sd(li.ebitda, li.revenue),
    pat_margin: sd(li.pat, li.revenue),
  };
}

// ---------------------------------------------------------------------------
// Reference data - Indian capital markets.
// ---------------------------------------------------------------------------
const STATES = [
  "Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat", "Delhi",
  "Telangana", "West Bengal", "Rajasthan", "Uttar Pradesh", "Haryana",
  "Kerala", "Punjab", "Madhya Pradesh", "Odisha", "Goa",
] as const;
const CITIES: Record<string, string> = {
  Maharashtra: "Mumbai", Karnataka: "Bengaluru", "Tamil Nadu": "Chennai",
  Gujarat: "Ahmedabad", Delhi: "New Delhi", Telangana: "Hyderabad",
  "West Bengal": "Kolkata", Rajasthan: "Jaipur", "Uttar Pradesh": "Noida",
  Haryana: "Gurugram", Kerala: "Kochi", Punjab: "Chandigarh",
  "Madhya Pradesh": "Indore", Odisha: "Bhubaneswar", Goa: "Panaji",
};

const ISSUER_SECTORS = [
  { code: "infra.roads", label: "Infrastructure - Roads" },
  { code: "infra.power", label: "Infrastructure - Power" },
  { code: "infra.renewable", label: "Infrastructure - Renewable Energy" },
  { code: "real_estate.residential", label: "Real Estate - Residential" },
  { code: "real_estate.commercial", label: "Real Estate - Commercial" },
  { code: "mfg.steel", label: "Manufacturing - Steel" },
  { code: "mfg.cement", label: "Manufacturing - Cement" },
  { code: "mfg.chemicals", label: "Manufacturing - Chemicals" },
  { code: "mfg.auto", label: "Manufacturing - Automobile" },
  { code: "nbfc.gold_loan", label: "NBFC - Gold Loan" },
  { code: "nbfc.mfi", label: "NBFC - Microfinance" },
  { code: "nbfc.housing", label: "Housing Finance Company" },
  { code: "services.it", label: "Services - IT" },
  { code: "services.logistics", label: "Services - Logistics" },
  { code: "services.hospitality", label: "Services - Hospitality" },
] as const;

const INVESTOR_KINDS = [
  "Bank", "Insurer", "Mutual Fund", "Pension Fund", "AIF",
  "Family Office", "HNI", "NBFC",
] as const;

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan",
  "Krishna", "Ishaan", "Rohan", "Karan", "Dhruv", "Kabir", "Ritvik", "Arun",
  "Rajesh", "Suresh", "Amit", "Nikhil", "Sanjay", "Vikram", "Anil", "Rahul",
  "Priya", "Ananya", "Diya", "Saanvi", "Aadhya", "Ira", "Kiara", "Riya",
  "Anika", "Myra", "Sara", "Neha", "Pooja", "Shreya", "Kavya", "Meera",
  "Deepika", "Anjali", "Rati", "Ishita", "Tanvi", "Nisha", "Ritu", "Sonia",
] as const;
const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Mehta", "Patel", "Reddy", "Nair", "Iyer",
  "Banerjee", "Mukherjee", "Chowdhury", "Singh", "Khanna", "Kapoor",
  "Malhotra", "Agarwal", "Jain", "Bansal", "Shah", "Desai", "Pillai",
  "Menon", "Rao", "Naidu", "Das", "Bose", "Ghosh", "Sengupta", "Pandey",
  "Tripathi", "Mishra", "Bhat", "Kulkarni", "Deshpande", "Joshi", "Khan",
] as const;
const SALUTATIONS = ["Mr", "Ms", "Mrs", "Dr", "Shri", "Smt"] as const;

const COMPANY_PREFIX = [
  "Bharat", "Vedanta", "Nalanda", "Deccan", "Konark", "Mauger", "Saberwal",
  "Chola", "Pallava", "Maruti", "Garuda", "Narmada", "Godavari", "Kaveri",
  "Yamuna", "Sindhu", "Himalaya", "Aravalli", "Vindhya", "Satpuda",
  "Coromandel", "Malabar", "Carnatic", "Rajwada", "Nilgiri", "Sahyadri",
] as const;
const COMPANY_SUFFIX = [
  "Infra", "Power", "Renewables", "Realty", "Developers", "Steels",
  "Cements", "Chemicals", "Motors", "Capital", "Finvest", "Housing",
  "Finance", "Technologies", "Logistics", "Hotels", "Holdings", "Enterprises",
  "Industries", "Ventures", "Group", "Investments", "Securities",
] as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    "party:create", "party:read", "party:update", "party:delete", "party:merge",
    "deal:create", "deal:read", "deal:update", "deal:delete",
    "credit:read", "credit:write", "credit_score:override",
    "kyc:read", "kyc:approve", "kyc:reject",
    "interaction:read", "interaction:write",
    "user:manage", "barrier:manage", "audit:read",
  ],
  coverage_rm: [
    "party:create", "party:read", "party:update",
    "deal:create", "deal:read", "deal:update",
    "interaction:read", "interaction:write",
    "contact:read", "contact:write",
  ],
  credit_analyst: [
    "credit:read", "credit:write", "credit_score:override",
    "party:read", "deal:read", "kyc:read",
    "financial_statement:read", "financial_statement:write",
  ],
  trader: [
    "deal:read", "instrument:read", "secondary_trade:execute",
    "exposure:read", "party:read",
  ],
  compliance: [
    "kyc:read", "kyc:approve", "kyc:reject",
    "consent:read", "consent:write", "dsr:manage",
    "audit:read", "barrier:read",
  ],
  partner: [
    "deal:read", "deal:approve", "credit:read", "credit_limit:approve",
    "party:read", "user:manage", "audit:read",
  ],
};
const ALL_PERMISSIONS = Array.from(
  new Set(Object.values(ROLE_PERMISSIONS).flat()),
).sort();

const ROLE_DESK: Record<string, "ib_advisory" | "bond_underwriting" | "gsec_trading" | "secondary_mm" | "portfolio_mgmt" | "credit" | "rating_advisory" | "operations" | "compliance" | "management"> = {
  admin: "management",
  coverage_rm: "ib_advisory",
  credit_analyst: "credit",
  trader: "secondary_mm",
  compliance: "compliance",
  partner: "management",
};

const APP_USER_SEED = [
  { email: "shray@binarycapital.in", name: "Shray Mehta", role: "admin", desk: "management" as const },
  { email: "rati@binarycapital.in", name: "Rati Sharma", role: "coverage_rm", desk: "ib_advisory" as const },
  { email: "shahrukh@binarycapital.in", name: "Shahrukh Khan", role: "credit_analyst", desk: "credit" as const },
  { email: "arjun@binarycapital.in", name: "Arjun Verma", role: "coverage_rm", desk: "ib_advisory" as const },
  { email: "neha@binarycapital.in", name: "Neha Gupta", role: "compliance", desk: "compliance" as const },
  { email: "vikram@binarycapital.in", name: "Vikram Rao", role: "trader", desk: "secondary_mm" as const },
  { email: "rajesh@binarycapital.in", name: "Rajesh Malhotra", role: "partner", desk: "management" as const },
];

const DEAL_TYPES = [
  "bond_underwriting", "gsec_auction", "rating_advisory", "m_and_a",
  "project_finance", "structured_finance", "ecm_ipo", "dcm_advisory",
  "private_placement_debt",
] as const;
const BOND_DEAL_TYPES = new Set(["bond_underwriting", "private_placement_debt", "gsec_auction"]);
const DEAL_STATUSES = [
  "lead", "mandated", "in_dd", "structuring", "rating_marketing",
  "pricing", "allocation", "settled", "closed", "dropped", "on_hold",
] as const;
const RATING_AGENCIES = ["CRISIL", "ICRA", "CARE", "India_Ratings", "Acuite"] as const;
const RATING_VALUES = ["AAA", "AA+", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB", "BBB-"];
const RATING_RANK: Record<string, number> = {
  AAA: 1, "AA+": 2, AA: 3, "AA-": 4, "A+": 5, A: 6, "A-": 7,
  "BBB+": 8, BBB: 9, "BBB-": 10,
};
const OUTLOOKS = ["stable", "positive", "negative", "developing", "credit_watch"] as const;
const RATING_ACTIONS = ["initial", "affirm", "upgrade", "downgrade", "rating_solicited"] as const;
const SCORE_COMPONENTS = [
  "business_risk", "financial_risk", "management_risk", "industry_risk",
  "country_risk", "structural_risk", "ESG",
] as const;
const FACTOR_WEIGHTS: Record<string, number> = {
  business_risk: 0.25, financial_risk: 0.3, management_risk: 0.1,
  industry_risk: 0.15, country_risk: 0.05, structural_risk: 0.1, ESG: 0.05,
};

// ---------------------------------------------------------------------------
// Counters / id generators.
// ---------------------------------------------------------------------------
let panCounter = 0;
const PAN_LETTERS = "ABCDEFGHJL";
const nextPan = () => {
  // Real-ish PAN: 5 letters, 4 digits, 1 letter.
  panCounter += 1;
  const a = PAN_LETTERS[(panCounter * 7) % PAN_LETTERS.length];
  const b = PAN_LETTERS[(panCounter * 13) % PAN_LETTERS.length];
  const c = "P"; // person category
  const d = PAN_LETTERS[(panCounter * 17) % PAN_LETTERS.length];
  const e = PAN_LETTERS[(panCounter * 23) % PAN_LETTERS.length];
  const n = String(1000 + (panCounter % 8999));
  const f = PAN_LETTERS[(panCounter * 29) % PAN_LETTERS.length];
  return `${a}${b}${c}${d}${e}${n}${f}`;
};
let cinCounter = 0;
const nextCin = () => {
  cinCounter += 1;
  // U64201MH2024PTC##### - 21 chars
  const n = String(100000 + (cinCounter % 899999)).padStart(6, "0");
  return `U64201MH2024PTC${n}`;
};
let gstCounter = 0;
const nextGstin = (stateCode: string) => {
  gstCounter += 1;
  // 15 chars: 2 state + 10 pan + 1 entity + Z + 1 check
  const pan = nextPan();
  const ent = String(gstCounter % 10);
  return `${stateCode}${pan}${ent}Z${(gstCounter % 9) + 1}`;
};
let leiCounter = 0;
const nextLei = () => {
  leiCounter += 1;
  // 20-char pseudo LEI: 8-char prefix + 12-digit zero-padded counter.
  const base = String(leiCounter).padStart(12, "0");
  return `3298AHOX${base}`;
};

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------
// `db` is assigned via dynamic import inside `main()` so that the env loader
// above runs before the postgres-js client is constructed.
let db: any;

// The 16 operational tables that 0003_rls.sql protects with FORCE RLS. The seed
// lifts RLS on these for the run (see main), then restores it at the end.
const RLS_TABLES = [
  "party", "deal", "deal_party", "interaction", "interaction_attendee",
  "document", "credit_analysis", "financial_model", "allocation_event",
  "trade_event", "kyc_record", "consent_record", "external_rating", "exposure",
  "credit_limit", "audit_log",
] as const;

async function main() {
  ({ db } = await import("./index"));
  const startedAt = Date.now();
  console.log("Seeding binary_crm - truncating existing rows...");

  // The 16 operational tables have FORCE ROW LEVEL SECURITY (0003_rls.sql) with
  // policies driven by GUCs (app.user_id / app.wall / app.mandate_ids) that the
  // app sets per-request via src/db/context.ts. The seed runs as the table
  // owner `crm` (no BYPASSRLS) WITHOUT those GUCs, so the UPDATE policies
  // (e.g. party.barrier_id back-fill) fail their WITH CHECK. The canonical way
  // to reseed RLS-protected tables is to lift RLS for the run, then restore it.
  // `crm` owns every table, so it may DISABLE/ENABLE ROW LEVEL SECURITY. The
  // policies themselves are not dropped - only the filter/check is toggled, so
  // re-enabling + FORCE restores the exact protection the app relies on.
  for (const t of RLS_TABLES) {
    await db.execute(sql.raw(`DO $$ BEGIN ALTER TABLE ${t} NO FORCE ROW LEVEL SECURITY; ALTER TABLE ${t} DISABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$`));
  }

  // Truncate every table (CASCADE wipes dependents). Order irrelevant with CASCADE.
  //
  // audit_log is INSERT-only by design (0003_rls.sql): a BEFORE UPDATE/DELETE/
  // TRUNCATE statement trigger (`audit_log_no_update_delete`) rejects TRUNCATE,
  // and a BEFORE INSERT row trigger (`audit_log_chain`) auto-populates the
  // tamper-evident prev_hash→row_hash chain. The `crm` role owns the table, so
  // it may DISABLE that one trigger for the duration of the reseed, then
  // re-ENABLE it so immutability is restored before any audit rows are written.
  // The chain trigger stays enabled throughout (it only fires on INSERT, which
  // TRUNCATE does not do).
  await db.execute(
    sql.raw(`DO $$ BEGIN ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_update_delete; EXCEPTION WHEN OTHERS THEN NULL; END $$`),
  );
  await db.execute(sql`TRUNCATE TABLE
    audit_log, allocation_event, trade_event, interaction_attendee, interaction,
    task_dependency, task, document, data_subject_request, consent_record,
    kyc_beneficial_owner, kyc_record, credit_limit, exposure, external_rating,
    rating_ladder, credit_score, scorecard, scorecard_template, ratio_result,
    credit_analysis_fs_link, financial_statement, credit_analysis,
    deal_party, deal, instrument, demat_account, relationship, party_contact,
    contact, address, party_identifier, party_type_assignment, party,
    information_barrier, user_role, role_permission, app_user, role, permission,
    sector_code, users, accounts, sessions, verification_tokens, authenticators,
    financial_model
    RESTART IDENTITY CASCADE`);
  await db.execute(
    sql.raw(`DO $$ BEGIN ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_update_delete; EXCEPTION WHEN OTHERS THEN NULL; END $$`),
  );

  // ----- sector_code -----
  const sectorRows = ISSUER_SECTORS.map((s) => ({
    code: s.code as string,
    label: s.label as string,
    segmentClass: (s.code.split(".").length > 1 ? "sub_sector" : "sector") as
      | "sector"
      | "sub_sector",
    level: 1,
    isActive: true,
  }));
  // add a couple parent sectors
  sectorRows.unshift(
    { code: "infra", label: "Infrastructure", segmentClass: "sector" as const, level: 0, isActive: true },
    { code: "real_estate", label: "Real Estate", segmentClass: "sector" as const, level: 0, isActive: true },
    { code: "mfg", label: "Manufacturing", segmentClass: "sector" as const, level: 0, isActive: true },
    { code: "nbfc", label: "NBFC", segmentClass: "sector" as const, level: 0, isActive: true },
    { code: "services", label: "Services", segmentClass: "sector" as const, level: 0, isActive: true },
  );
  const insertedSectors: { sectorCodeId: string; code: string }[] = await db
    .insert(sectorCode)
    .values(sectorRows)
    .returning({ sectorCodeId: sectorCode.sectorCodeId, code: sectorCode.code });
  const sectorByCode = new Map(
    insertedSectors.map((s: { sectorCodeId: string; code: string }) => [
      s.code,
      s.sectorCodeId,
    ]),
  );
  const subSectorIds = insertedSectors
    .filter((s: { sectorCodeId: string; code: string }) => s.code.includes("."))
    .map((s: { sectorCodeId: string; code: string }) => s.sectorCodeId);

  // ----- roles / permissions -----
  const insertedRoles: { roleId: string; name: string }[] = await db
    .insert(role)
    .values(
      Object.keys(ROLE_PERMISSIONS).map((name) => ({
        name,
        desk: ROLE_DESK[name],
        description: `${name} role`,
      })),
    )
    .returning({ roleId: role.roleId, name: role.name });
  const roleByName = new Map(insertedRoles.map((r) => [r.name, r.roleId]));

  const insertedPerms: { permissionId: string; code: string }[] = await db
    .insert(permission)
    .values(ALL_PERMISSIONS.map((code) => ({ code, description: code })))
    .returning({ permissionId: permission.permissionId, code: permission.code });
  const permByCode = new Map(insertedPerms.map((p) => [p.code, p.permissionId]));

  await db.insert(rolePermission).values(
    Object.entries(ROLE_PERMISSIONS).flatMap(([rn, codes]) =>
      codes.map((c) => ({
        roleId: roleByName.get(rn)!,
        permissionId: permByCode.get(c)!,
      })),
    ),
  );

  // ----- app_users -----
  const insertedAppUsers: { userId: string; email: string }[] = await db
    .insert(appUser)
    .values(
      APP_USER_SEED.map((u) => ({
        email: u.email,
        isActive: true,
        desk: u.desk,
        // Inserted empty; back-filled to real barrier UUIDs after the
        // information_barrier rows exist (see the block following the
        // deal-side barrier generation). 0003_rls.sql tags walled rows by
        // barrier_id (uuid) and the RLS predicate compares barrier_id::text
        // against app.wall (text[]), so the wall vocabulary MUST be the
        // barrier UUIDs - not free-text tags like "wall-ib"/"wall-credit",
        // which never match a uuid and would hide every barriered row even
        // when withRls sets the user's context.
        barrierClearance: [],
      })),
    )
    .returning({ userId: appUser.userId, email: appUser.email });
  const appUserByEmail = new Map(insertedAppUsers.map((u) => [u.email, u.userId]));
  const adminUserId = appUserByEmail.get("shray@binarycapital.in")!;
  const analystUserId = appUserByEmail.get("shahrukh@binarycapital.in")!;
  const coverageUserId = appUserByEmail.get("arjun@binarycapital.in")!;
  const complianceUserId = appUserByEmail.get("neha@binarycapital.in")!;
  const traderUserId = appUserByEmail.get("vikram@binarycapital.in")!;

  // ----- user_role -----
  await db.insert(userRole).values(
    APP_USER_SEED.map((u) => ({
      userId: appUserByEmail.get(u.email)!,
      roleId: roleByName.get(u.role)!,
      validFrom: new Date("2024-04-01"),
      assignedByUserId: adminUserId,
    })),
  );

  // ----- users (Auth.js) -----
  // NOTE: the live DB `users` table does NOT have the `app_user_id` column the
  // Drizzle schema models - the 1:1 link lives on the other side as
  // `app_user.auth_user_id → users.id`. The Drizzle `users` table object always
  // emits `app_user_id` in INSERTs (the column is defined in schema), so we
  // insert via raw SQL and back-fill app_user.auth_user_id afterwards.
  const authUserIds: { id: string; email: string }[] = [];
  for (const u of APP_USER_SEED) {
    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO users (id, name, email, email_verified)
      VALUES (${id}, ${u.name}, ${u.email}, '2024-04-01'::timestamp)
    `);
    authUserIds.push({ id, email: u.email });
  }
  for (const u of authUserIds) {
    const appId = appUserByEmail.get(u.email);
    if (!appId) continue;
    // Link Auth.js users → app_user via users.app_user_id (not app_user.auth_user_id -
    // that column doesn't exist in the schema). Wrap in exception handling for DBs
    // where the users table might not have the column yet.
    await db.execute(
      sql.raw(`DO $$ BEGIN UPDATE users SET app_user_id = '${u.id}' WHERE email = '${u.email}'; EXCEPTION WHEN OTHERS THEN NULL; END $$`),
    );
  }

  // ----- parties (~9000, scaled 10x) -----
  console.log("Generating ~9000 parties (10x scale)...");
  const N_PARTIES = 9000;
  const partyRows: typeof party.$inferInsert[] = [];
  // Track each issuer's sector code (by partyRows index) so scorecard template
  // selection can route real-estate issuers to the real-estate template.
  const issuerSectorByPartyIdx = new Map<number, string>();
  // Issuers ~ 2900, investors ~ 4100, intermediaries ~ 1600, internal/prospect ~ 400
  // (10x the original 260/360/140/40 split). +2 special parties (firm + GoI) +
  // 500 leads + 300 onboarding further down ⇒ ~9800 parties total.
  const issuerCount = 2900;
  const investorCount = 4100;
  const intermediaryCount = 1600;
  const miscCount = N_PARTIES - issuerCount - investorCount - intermediaryCount;

  type PType =
    | "issuer" | "investor" | "intermediary" | "ifa" | "broker"
    | "rating_agency" | "internal_staff" | "prospect" | "arranger"
    | "government";
  const partySpecs: { type: PType; nature: "organization" | "natural_person" }[] = [];

  // Monotonic per-party sequence appended to legal_name so the
  // UQ(legal_name, country_of_incorporation) index never trips on the small
  // name-pool.
  let nameSeq = 0;
  const seqName = (base: string) => `${base} ${String(++nameSeq).padStart(3, "0")}`;

  for (let i = 0; i < issuerCount; i++) {
    const sec = pick(ISSUER_SECTORS);
    issuerSectorByPartyIdx.set(i, sec.code);
    partySpecs.push({ type: "issuer", nature: "organization" });
    const state = pick(STATES);
    const listed = chance(0.18);
    const base = `${pick(COMPANY_PREFIX)} ${pick(COMPANY_SUFFIX)}`;
    const name = seqName(base);
    partyRows.push({
      legalName: `${name} Limited`,
      displayName: name,
      partyNature: "organization",
      countryOfIncorporation: "IN",
      domicileState: state,
      isListed: listed,
      listingExchange: listed ? "NSE" : null,
      ticker: listed ? base.slice(0, 4).toUpperCase() : null,
      industrySegmentId: sectorByCode.get(sec.code),
      crisilSectorCode: sec.code.toUpperCase().replace(/\./g, "_"),
      isKycComplete: chance(0.7),
      kycRiskRating: pick(["low", "medium", "high"]),
      status: pick(["active", "active", "active", "onboarding", "dormant"]),
      brandOrigin: "binarybonds",
      source: "manual",
      createdByUserId: adminUserId,
    });
  }
  for (let i = 0; i < investorCount; i++) {
    const kind = pick(INVESTOR_KINDS);
    partySpecs.push({ type: "investor", nature: kind === "HNI" ? "natural_person" : "organization" });
    const state = pick(STATES);
    const isPerson = kind === "HNI";
    const personName = `${pick(SALUTATIONS)} ${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const orgBase = `${pick(COMPANY_PREFIX)} ${kind}`;
    partyRows.push({
      legalName: isPerson ? seqName(personName) : `${seqName(orgBase)} ${pick(["Pvt Ltd", "Ltd", "Trust", "Foundation"])}`,
      displayName: isPerson ? personName : orgBase,
      partyNature: isPerson ? "natural_person" : "organization",
      countryOfIncorporation: "IN",
      domicileState: state,
      isKycComplete: chance(0.8),
      kycRiskRating: isPerson ? pick(["low", "medium", "medium", "high"]) : pick(["low", "low", "medium"]),
      status: pick(["active", "active", "active", "onboarding"]),
      brandOrigin: "binarybonds",
      source: chance(0.3) ? "broker_feed" : "manual",
      createdByUserId: coverageUserId,
    });
  }
  for (let i = 0; i < intermediaryCount; i++) {
    const kind: "ifa" | "broker" | "rating_agency" = pick(["ifa", "broker", "rating_agency"] as const);
    partySpecs.push({ type: kind, nature: "organization" });
    const state = pick(STATES);
    const base = `${pick(COMPANY_PREFIX)} ${kind === "ifa" ? "Wealth" : kind === "broker" ? "Broking" : "Ratings"}`;
    const name = `${seqName(base)} ${pick(["Pvt Ltd", "Ltd", "Advisors"])}`;
    partyRows.push({
      legalName: name,
      displayName: name,
      partyNature: "organization",
      countryOfIncorporation: "IN",
      domicileState: state,
      isKycComplete: chance(0.6),
      kycRiskRating: "low",
      status: "active",
      brandOrigin: "shared",
      source: "manual",
      createdByUserId: coverageUserId,
    });
  }
  // misc: internal_staff + prospects
  for (let i = 0; i < miscCount; i++) {
    const isStaff = chance(0.25);
    partySpecs.push({
      type: isStaff ? "internal_staff" : "prospect",
      nature: isStaff ? "natural_person" : "organization",
    });
    if (isStaff) {
      const personName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      partyRows.push({
        legalName: seqName(personName),
        displayName: personName,
        partyNature: "natural_person",
        countryOfIncorporation: "IN",
        domicileState: "Maharashtra",
        kycRiskRating: "low",
        status: "active",
        brandOrigin: "binarycapital",
        source: "manual",
        createdByUserId: adminUserId,
      });
    } else {
      const base = `${pick(COMPANY_PREFIX)} ${pick(COMPANY_SUFFIX)}`;
      const name = seqName(base);
      partyRows.push({
        legalName: `${name} Pvt Ltd`,
        displayName: name,
        partyNature: "organization",
        countryOfIncorporation: "IN",
        domicileState: pick(STATES),
        status: "onboarding",
        brandOrigin: "binarybonds",
        source: "website_lead",
        createdByUserId: coverageUserId,
      });
    }
  }
  // Internal firm party (Binary Capital - arranger/underwriter on deals).
  const firmPartyIdx = partyRows.length;
  partyRows.push({
    legalName: "Binary Capital Securities Pvt Ltd",
    displayName: "Binary Capital",
    partyNature: "organization",
    countryOfIncorporation: "IN",
    domicileState: "Maharashtra",
    kycRiskRating: "low",
    status: "active",
    brandOrigin: "binarycapital",
    source: "manual",
    createdByUserId: adminUserId,
  });
  partySpecs.push({ type: "arranger", nature: "organization" });

  // Government of India party - sovereign issuer for G-Sec / SDL / T-bill
  // instruments so secondary trade_event rows can reference real sovereign
  // paper (the task asks for G-Sec + corporate-bond trades). Appended to the
  // main partyRows so the shared party_type_assignment / party_identifier /
  // address / party_contact loops below cover it automatically (every party
  // gets ≥1 contact, ≥1 identifier, 1 address).
  const govPartyIdx = partyRows.length;
  partyRows.push({
    legalName: "Government of India",
    displayName: "Government of India",
    partyNature: "organization",
    countryOfIncorporation: "IN",
    domicileState: "Maharashtra",
    kycRiskRating: "low",
    status: "active",
    brandOrigin: "shared",
    source: "manual",
    createdByUserId: adminUserId,
  });
  partySpecs.push({ type: "government", nature: "organization" });

  // Backdate createdAt/updatedAt so the parties-list lastTouchAt (max of
  // party.updatedAt + junction createdAt) spreads across the last ~90 days
  // instead of collapsing to "now" for every row. createdAt lands 200-400 days
  // ago; updatedAt lands within the last 90 days (skewed recent). Junction
  // rows below are backdated to 95-215 days ago so they are always older than
  // updatedAt, making party.updatedAt the dominant lastTouch signal.
  const partyLastTouch = new Map<number, Date>();
  for (let i = 0; i < partyRows.length; i++) {
    const created = pastDate(200, 200);
    const updated = recentDate(90);
    partyRows[i]!.createdAt = created;
    partyRows[i]!.updatedAt = updated;
    partyLastTouch.set(i, updated);
  }

  const insertedParties: { partyId: string }[] = await chunkedInsert<{ partyId: string }>(
    party,
    partyRows as any,
    { partyId: party.partyId },
    500,
  );
  const partyIds = insertedParties.map((p) => p.partyId);
  const firmPartyId = partyIds[firmPartyIdx]!;
  const govPartyId = partyIds[govPartyIdx]!;
  // partyId → sector code (issuers only) for scorecard template routing.
  const sectorByPartyId = new Map<string, string>();
  for (const [idx, code] of issuerSectorByPartyIdx) {
    sectorByPartyId.set(partyIds[idx]!, code);
  }

  // Classify
  const issuerPartyIds: string[] = [];
  const investorPartyIds: string[] = [];
  const intermediaryPartyIds: string[] = [];
  const prospectPartyIds: string[] = [];
  partySpecs.forEach((s, i) => {
    if (s.type === "issuer") issuerPartyIds.push(partyIds[i]!);
    else if (s.type === "investor") investorPartyIds.push(partyIds[i]!);
    else if (s.type === "ifa" || s.type === "broker" || s.type === "rating_agency")
      intermediaryPartyIds.push(partyIds[i]!);
    else if (s.type === "prospect") prospectPartyIds.push(partyIds[i]!);
  });
  console.log(
    `  parties: ${partyIds.length} (issuers ${issuerPartyIds.length}, investors ${investorPartyIds.length}, intermediaries ${intermediaryPartyIds.length})`,
  );

  // ----- party_type_assignment -----
  const ptaRows: typeof partyTypeAssignment.$inferInsert[] = partySpecs.map((s, i) => ({
    partyId: partyIds[i]!,
    partyType: s.type as any,
    assignedByUserId: adminUserId,
    confidence: round(0.7 + rnd() * 0.3, 2),
  }));
  // Some issuers are also underwriters; some investors are also arrangers.
  ptaRows.forEach((r, i) => {
    if (partySpecs[i].type === "issuer" && chance(0.1)) {
      ptaRows.push({ partyId: partyIds[i]!, partyType: "underwriter", assignedByUserId: adminUserId });
    }
  });
  await chunkedInsert(partyTypeAssignment, ptaRows as any, undefined, 1000);

  // ----- party_identifier -----
  console.log("Generating party_identifier / address...");
  const piRows: typeof partyIdentifier.$inferInsert[] = [];
  partyIds.forEach((pid, i) => {
    const spec = partySpecs[i]!;
    if (spec.nature === "organization") {
      const state = pick(STATES);
      const stateCode = String(27 + STATES.indexOf(state)).padStart(2, "0");
      if (spec.type === "issuer" || spec.type === "investor" || spec.type === "arranger") {
        piRows.push({
          partyId: pid, identifierType: "CIN", identifierValue: nextCin(), isPrimary: true,
        });
        piRows.push({
          partyId: pid, identifierType: "GSTIN", identifierValue: nextGstin(stateCode),
        });
        piRows.push({ partyId: pid, identifierType: "LEI", identifierValue: nextLei() });
      } else {
        piRows.push({
          partyId: pid, identifierType: "GSTIN", identifierValue: nextGstin(stateCode), isPrimary: true,
        });
      }
    } else {
      piRows.push({
        partyId: pid, identifierType: "PAN", identifierValue: nextPan(), isPrimary: true,
      });
    }
  });
  await chunkedInsert(partyIdentifier, piRows as any, undefined, 1000);

  // ----- address -----
  const addrRows: typeof address.$inferInsert[] = partyIds.map((pid, i) => {
    const state = pick(STATES);
    return {
      partyId: pid,
      line1: `${Math.floor(rnd() * 900 + 100)}, ${pick(COMPANY_PREFIX)} Marg`,
      line2: `${pick(["Bandra Kurla Complex", "Andheri East", "Worli", "Connaught Place", "MG Road", "HITEC City", "Sector 18"])}`,
      city: CITIES[state] ?? "Mumbai",
      state,
      pincode: String(400000 + Math.floor(rnd() * 99999)).slice(0, 6),
      country: "IN",
      type: "registered",
      isCurrent: true,
    };
  });
  await chunkedInsert(address, addrRows as any, undefined, 1000);

  // ----- contacts (~12000, scaled 10x) + party_contact -----
  console.log("Generating ~12000 contacts + party_contact (10x scale)...");
  const N_CONTACTS = 1200 * SCALE;
  const contactRows: typeof contact.$inferInsert[] = [];
  for (let i = 0; i < N_CONTACTS; i++) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    contactRows.push({
      fullName: `${first} ${last}`,
      salutation: pick(SALUTATIONS),
      primaryEmail: `${first.toLowerCase()}.${last.toLowerCase()}${i}@${pick(["gmail.com", "outlook.com", "yahoo.in", "rediffmail.com"])}`,
      primaryPhone: `+91${Math.floor(7000000000 + rnd() * 999999999)}`.slice(0, 13),
      designation: pick(["CFO", "Treasurer", "Director", "MD & CEO", "Vice President", "Head - Treasury", "Compliance Officer", "Relationship Manager", "Portfolio Manager", "Promoter"]),
      pan: chance(0.6) ? nextPan() : null,
      pepStatus: chance(0.05) ? pick(["suspected", "family_member", "close_associate"]) : "none",
      isNri: chance(0.08),
      femaResidentialStatus: chance(0.08) ? "nri" : "resident",
      isKycIndividual: chance(0.3),
      createdByUserId: coverageUserId,
    });
  }
  const insertedContacts: { contactId: string }[] = await chunkedInsert<{ contactId: string }>(
    contact,
    contactRows as any,
    { contactId: contact.contactId },
    500,
  );
  const contactIds = insertedContacts.map((c) => c.contactId);

  // Link contacts to parties (1-2 contacts per party), with at most one
  // primary per (party, role) - enforced by setting is_primary only on the
  // first assigned contact of each party.
  const pcRows: typeof partyContact.$inferInsert[] = [];
  const primarySeen = new Set<string>();
  for (let i = 0; i < contactIds.length; i++) {
    const pid = partyIds[i % partyIds.length]!;
    const spec = partySpecs[i % partySpecs.length]!;
    const roleByType: Record<string, any> = {
      issuer: pick(["cfo", "treasurer", "md_ceo", "director", "promoter"]),
      investor: pick(["treasurer", "relationship_manager", "director"]),
      ifa: "ifa", broker: "rm_broker", rating_agency: "other",
      arranger: "relationship_manager", internal_staff: "other", prospect: "other",
    };
    const role = roleByType[spec.type] ?? "other";
    const key = `${pid}:${role}`;
    const isPrimary = !primarySeen.has(key);
    primarySeen.add(key);
    pcRows.push({
      partyId: pid,
      contactId: contactIds[i]!,
      role,
      isPrimary,
      validFrom: new Date("2023-04-01"),
      // Backdated 95-215 days ago so the party_contact max(createdAt) signal
      // is always older than party.updatedAt (lastTouch spread, see above).
      createdAt: pastDate(95, 120),
    });
  }
  await chunkedInsert(partyContact, pcRows as any, undefined, 1000);

  // ----- information_barrier (party-side) + link parties -----
  console.log("Generating information_barrier...");
  const walledIssuerIds = pickN(issuerPartyIds, 18 * SCALE);
  const barrierRows = walledIssuerIds.map((pid) => ({
    name: `Wall - ${pick(["MNPI", "Deal-side", "Rating advisory"])}`,
    partyId: pid,
    restrictedRoleSet: ["trader", "market_making"],
    restrictedDeskSet: ["secondary_mm", "gsec_trading"] as any,
    reason: "Chinese wall around MNPI on mandate",
    createdByUserId: adminUserId,
    erectedAt: new Date("2024-06-01"),
    isActive: true,
  }));
  const insertedBarriers: { barrierId: string; partyId: string }[] = await db
    .insert(informationBarrier)
    .values(barrierRows)
    .returning({ barrierId: informationBarrier.barrierId, partyId: informationBarrier.partyId });
  const barrierByParty = new Map(insertedBarriers.map((b) => [b.partyId, b.barrierId]));
  // Update party.barrier_id for walled issuers.
  for (const [pid, bid] of barrierByParty) {
    await db
      .update(party)
      .set({ barrierId: bid })
      .where(sql`${party.partyId} = ${pid}`);
  }

  // ----- relationships (group hierarchies + beneficial owners) -----
  console.log("Generating relationships...");
  const relRows: typeof relationship.$inferInsert[] = [];
  // Group hierarchies: pair issuers into parent/subsidiary.
  for (let i = 0; i < issuerPartyIds.length - 1; i += 2) {
    const parent = issuerPartyIds[i]!;
    const child = issuerPartyIds[i + 1]!;
    relRows.push({
      parentPartyId: parent, childPartyId: child,
      relationshipType: pick(["subsidiary", "wholly_owned", "associate", "jv"] as const),
      ownershipPct: round(50 + rnd() * 50, 2),
      votingRightsPct: round(50 + rnd() * 50, 2),
      isPubliclyDisclosed: chance(0.4),
      effectiveFrom: new Date("2020-04-01"),
    });
  }
  // Promoter / beneficial_owner edges (issuer ← promoter who is a person/investor party).
  for (let i = 0; i < 60 * SCALE; i++) {
    const child = pick(issuerPartyIds);
    const parent = pick([...investorPartyIds, ...issuerPartyIds]);
    if (parent === child) continue;
    relRows.push({
      parentPartyId: parent, childPartyId: child,
      relationshipType: chance(0.5) ? "promoter" : "beneficial_owner",
      ownershipPct: round(rnd() * 35 + 5, 2),
      votingRightsPct: round(rnd() * 30 + 5, 2),
      isPubliclyDisclosed: chance(0.3),
      effectiveFrom: new Date("2019-04-01"),
    });
  }
  // Guarantor edges.
  for (let i = 0; i < 30 * SCALE; i++) {
    const child = pick(issuerPartyIds);
    const parent = pick(issuerPartyIds);
    if (parent === child) continue;
    relRows.push({
      parentPartyId: parent, childPartyId: child,
      relationshipType: "guarantor",
      effectiveFrom: new Date("2022-04-01"),
    });
  }
  // De-duplicate (parent, child, type) - pick unique combos.
  const relSeen = new Set<string>();
  const relUnique = relRows.filter((r) => {
    const k = `${r.parentPartyId}|${r.childPartyId}|${r.relationshipType}`;
    if (relSeen.has(k)) return false;
    relSeen.add(k);
    return true;
  });
  // Backdate relationship createdAt (95-215 days ago) so the relationship
  // signal stays older than party.updatedAt (lastTouch spread).
  for (const r of relUnique) r.createdAt = pastDate(95, 120);
  await chunkedInsert(relationship, relUnique as any, undefined, 1000);

  // ----- demat_account (investor parties) -----
  console.log("Generating demat_account...");
  const dematRows: typeof dematAccount.$inferInsert[] = investorPartyIds.slice(0, 180 * SCALE).map((pid, i) => ({
    partyId: pid,
    dpId: chance(0.5) ? "IN300" + String(100 + i).slice(0, 2) : String(10000000 + i).slice(0, 8),
    clientId: String(10000000 + i * 7).slice(0, 8),
    depository: chance(0.55) ? "NSDL" : "CDSL",
    accountStatus: pick(["active", "active", "active", "frozen", "suspended"] as const),
    verifiedAt: new Date("2024-05-01"),
    verificationSource: "KYC pack",
  }));
  const insertedDemat: { dematAccountId: string; partyId: string }[] = await db
    .insert(dematAccount)
    .values(dematRows)
    .returning({ dematAccountId: dematAccount.dematAccountId, partyId: dematAccount.partyId });
  const dematByParty = new Map(insertedDemat.map((d) => [d.partyId, d.dematAccountId]));

  // ----- instruments (bond deals) -----
  console.log("Generating instruments...");
  const instrumentRows: typeof instrument.$inferInsert[] = [];
  const issuerForInstrument = pickN(issuerPartyIds, 90 * SCALE);
  issuerForInstrument.forEach((pid, i) => {
    instrumentRows.push({
      isin: `INE${String(100000 + i * 13).slice(0, 7)}${String(i % 10)}`,
      instrumentType: pick(["corp_bond", "ncd", "cp"] as const),
      issuerPartyId: pid,
      issueDate: ymd(new Date(2024, Math.floor(rnd() * 12), Math.floor(rnd() * 28) + 1)),
      maturityDate: ymd(new Date(2031, Math.floor(rnd() * 12), Math.floor(rnd() * 28) + 1)),
      couponPct: round(7 + rnd() * 4, 4),
      couponType: "fixed",
      frequency: pick(["annual", "semi_annual"] as const),
      faceValue: "1000",
      issueSize: round(50 + rnd() * 500, 4), // crores
      currencyCode: "INR",
      listingExchange: pick(["NSE", "BSE", "BSE_NSE"] as const),
    });
  });
  const insertedInstruments: { instrumentId: string; issuerPartyId: string }[] = await db
    .insert(instrument)
    .values(instrumentRows)
    .returning({ instrumentId: instrument.instrumentId, issuerPartyId: instrument.issuerPartyId });
  const instrumentsByIssuer = new Map<string, string[]>();
  for (const ins of insertedInstruments) {
    const arr = instrumentsByIssuer.get(ins.issuerPartyId) ?? [];
    arr.push(ins.instrumentId);
    instrumentsByIssuer.set(ins.issuerPartyId, arr);
  }

  // ----- sovereign instruments (G-Sec / SDL / T-bill) issued by GoI -----
  // Needed so secondary trade_event rows can reference real sovereign paper
  // (corp bonds alone cannot represent G-Sec trades). NDS-OM / OTC paper is
  // modeled with listing_exchange='Other' (the enum has no NDS-OM value).
  const gsecInstrumentRows: typeof instrument.$inferInsert[] = [];
  const gsecSpec: { type: "gsec" | "sdl" | "tbill"; coupon: number | null; tenorYears: number }[] = [];
  // 16 dated G-Secs across the 2y–30y curve.
  for (let i = 0; i < 16; i++) {
    const tenor = pick([2, 3, 5, 7, 10, 14, 20, 30]);
    const issueY = 2024 + (i % 2);
    const matY = issueY + tenor;
    const coupon = round(6.8 + rnd() * 0.9, 4);
    gsecInstrumentRows.push({
      isin: `IN002${String(2023000 + i * 7).slice(0, 7)}`,
      instrumentType: "gsec",
      issuerPartyId: govPartyId,
      issueDate: ymd(new Date(issueY, Math.floor(rnd() * 12), Math.floor(rnd() * 28) + 1)),
      maturityDate: ymd(new Date(matY, Math.floor(rnd() * 12), Math.floor(rnd() * 28) + 1)),
      couponPct: coupon,
      couponType: "fixed",
      frequency: "semi_annual",
      faceValue: "100",
      issueSize: round(1000 + rnd() * 29000, 4),
      currencyCode: "INR",
      listingExchange: "Other",
    });
    gsecSpec.push({ type: "gsec", coupon: Number(coupon), tenorYears: tenor });
  }
  // 6 SDLs (state development loans) - same mechanics, slightly wider coupon.
  for (let i = 0; i < 6; i++) {
    const tenor = pick([5, 7, 10, 15]);
    const issueY = 2024 + (i % 2);
    const coupon = round(7.0 + rnd() * 0.6, 4);
    gsecInstrumentRows.push({
      isin: `IN012${String(2001000 + i * 11).slice(0, 7)}`,
      instrumentType: "sdl",
      issuerPartyId: govPartyId,
      issueDate: ymd(new Date(issueY, Math.floor(rnd() * 12), Math.floor(rnd() * 28) + 1)),
      maturityDate: ymd(new Date(issueY + tenor, Math.floor(rnd() * 12), Math.floor(rnd() * 28) + 1)),
      couponPct: coupon,
      couponType: "fixed",
      frequency: "semi_annual",
      faceValue: "100",
      issueSize: round(500 + rnd() * 5000, 4),
      currencyCode: "INR",
      listingExchange: "Other",
    });
    gsecSpec.push({ type: "sdl", coupon: Number(coupon), tenorYears: tenor });
  }
  // 6 T-bills (discount instruments, ≤1y, zero coupon).
  for (let i = 0; i < 6; i++) {
    const tenorDays = pick([91, 182, 364]);
    const issueD = new Date(2026, Math.floor(rnd() * 6), Math.floor(rnd() * 28) + 1);
    gsecInstrumentRows.push({
      isin: `IN001${String(1001000 + i * 13).slice(0, 7)}`,
      instrumentType: "tbill",
      issuerPartyId: govPartyId,
      issueDate: ymd(issueD),
      maturityDate: ymd(new Date(issueD.getTime() + tenorDays * DAY_MS)),
      couponPct: null,
      couponType: "zero",
      frequency: null,
      faceValue: "100",
      issueSize: round(2000 + rnd() * 48000, 4),
      currencyCode: "INR",
      listingExchange: "Other",
    });
    gsecSpec.push({ type: "tbill", coupon: null, tenorYears: tenorDays / 365 });
  }
  const insertedGsecInstruments: { instrumentId: string; isin: string | null; instrumentType: string; issuerPartyId: string }[] = await db
    .insert(instrument)
    .values(gsecInstrumentRows)
    .returning({
      instrumentId: instrument.instrumentId,
      isin: instrument.isin,
      instrumentType: instrument.instrumentType,
      issuerPartyId: instrument.issuerPartyId,
    });
  // Merge sovereign instruments into the by-issuer map.
  for (const ins of insertedGsecInstruments) {
    const arr = instrumentsByIssuer.get(ins.issuerPartyId) ?? [];
    arr.push(ins.instrumentId);
    instrumentsByIssuer.set(ins.issuerPartyId, arr);
  }
  // Flat instrument catalog for trade_event generation: corp bonds + sovereign.
  const allInstruments: {
    instrumentId: string;
    instrumentType: string;
    issuerPartyId: string;
    isin: string | null;
    coupon: number | null;
    frequency: "annual" | "semi_annual" | "monthly" | null;
    faceValue: string;
    maturityDate: string | null;
  }[] = insertedInstruments.map((ins, i) => ({
    instrumentId: ins.instrumentId,
    instrumentType: instrumentRows[i]!.instrumentType!,
    issuerPartyId: ins.issuerPartyId,
    isin: instrumentRows[i]!.isin ?? null,
    coupon: instrumentRows[i]!.couponPct != null ? Number(instrumentRows[i]!.couponPct) : null,
    frequency: (instrumentRows[i]!.frequency ?? null) as "annual" | "semi_annual" | "monthly" | null,
    faceValue: instrumentRows[i]!.faceValue ?? "1000",
    maturityDate: instrumentRows[i]!.maturityDate ?? null,
  }));
  for (let i = 0; i < insertedGsecInstruments.length; i++) {
    const g = insertedGsecInstruments[i]!;
    const s = gsecSpec[i]!;
    allInstruments.push({
      instrumentId: g.instrumentId,
      instrumentType: g.instrumentType,
      issuerPartyId: g.issuerPartyId,
      isin: g.isin,
      coupon: s.coupon,
      frequency: s.type === "tbill" ? null : "semi_annual",
      faceValue: "100",
      maturityDate: gsecInstrumentRows[i]!.maturityDate ?? null,
    });
  }

  // ----- deals (~1500, scaled 10x) + deal_party -----
  console.log("Generating ~1500 deals + deal_party (10x scale)...");
  const N_DEALS = 150 * SCALE;
  const dealRows: (typeof deal.$inferInsert & { __type: string })[] = [];
  const dealPartyPlan: { type: string; issuerId: string; investorIds: string[]; agencyId?: string }[] = [];
  const ratingAgencyPartyIds = partySpecs
    .map((s, i) => (s.type === "rating_agency" ? partyIds[i]! : null))
    .filter((x): x is string => !!x);
  const brokerPartyIds = partySpecs
    .map((s, i) => (s.type === "broker" || s.type === "ifa" ? partyIds[i]! : null))
    .filter((x): x is string => !!x);

  for (let i = 0; i < N_DEALS; i++) {
    const dtype = pick(DEAL_TYPES);
    const issuerId = pick(issuerPartyIds);
    const investorIds = pickN(investorPartyIds, Math.floor(rnd() * 5) + 2);
    dealPartyPlan.push({
      type: dtype, issuerId, investorIds,
      agencyId: ratingAgencyPartyIds.length ? pick(ratingAgencyPartyIds) : undefined,
    });
    const isBond = BOND_DEAL_TYPES.has(dtype);
    // Weighted deal-stage distribution: most deals live in the active middle
    // of the pipeline (mandated / in_dd / structuring / pricing), fewer at the
    // extremes - instead of a uniform pick across all 11 statuses.
    const status = pickWeighted([
      ["lead", 0.12],
      ["mandated", 0.16],
      ["in_dd", 0.14],
      ["structuring", 0.10],
      ["rating_marketing", 0.08],
      ["pricing", 0.08],
      ["allocation", 0.06],
      ["settled", 0.10],
      ["closed", 0.08],
      ["on_hold", 0.04],
      ["dropped", 0.04],
    ] as const);
    const closed = status === "closed" || status === "settled";
    // Log-skew deal size (crores): 25 → ~1200, most mid-cap, a few mega - not
    // a uniform 50-850 band.
    const size = 25 * Math.pow(48, rnd());
    // Target close spread across Sep-2025 → Dec-2026 (around the dev "today").
    const closeMonthIdx = Math.floor(rnd() * 16); // 0..15 months from Sep 2025
    const targetClose = new Date(2025, 8 + closeMonthIdx, Math.floor(rnd() * 28) + 1);
    const actualClose = closed
      ? new Date(2025, 8 + Math.floor(rnd() * 14), Math.floor(rnd() * 28) + 1)
      : null;
    dealRows.push({
      dealCode: `BC-${String(2400 + i).padStart(4, "0")}`,
      dealType: dtype as any,
      dealSubtype: isBond ? pick(["senior_secured", "senior_unsecured", "subordinated"]) : null,
      dealName: `${pick(COMPANY_PREFIX)} ${dtype.replace(/_/g, " ")} ${2024 + (i % 3)}`,
      status: status as any,
      brand: "binarybonds",
      leadUserId: coverageUserId,
      creditAnalystUserId: analystUserId,
      targetCloseDate: ymd(targetClose),
      actualCloseDate: actualClose ? ymd(actualClose) : null,
      targetSize: round(size, 4),
      targetTenorYears: round(rnd() * 8 + 2, 2),
      currencyCode: "INR",
      feeStructure: { upfront_bps: Math.floor(rnd() * 80 + 20), success_bps: Math.floor(rnd() * 100 + 30) },
      createdByUserId: coverageUserId,
      __type: dtype,
    } as any);
  }
  const { __type: _drop, ...dealInsertShape } = dealRows[0]!;
  void dealInsertShape;
  const insertedDeals: { dealId: string }[] = await chunkedInsert<{ dealId: string }>(
    deal,
    dealRows.map((d) => {
      const { __type, ...rest } = d as any;
      return rest;
    }),
    { dealId: deal.dealId },
    500,
  );
  const dealIds = insertedDeals.map((d) => d.dealId);

  // deal-side barriers for ~200 deals, then link deal.barrier_id
  const dealBarrierPlan = pickN(dealIds, 20 * SCALE);
  const dealBarrierRows = dealBarrierPlan.map((did) => ({
    name: `Deal wall - ${did.slice(0, 8)}`,
    dealId: did,
    restrictedRoleSet: ["trader", "market_making"],
    restrictedDeskSet: ["secondary_mm", "gsec_trading"] as any,
    reason: "MNPI around live mandate",
    createdByUserId: adminUserId,
    erectedAt: new Date("2024-07-01"),
    isActive: true,
  }));
  const insertedDealBarriers: { barrierId: string; dealId: string }[] = await db
    .insert(informationBarrier)
    .values(dealBarrierRows)
    .returning({ barrierId: informationBarrier.barrierId, dealId: informationBarrier.dealId });
  for (const b of insertedDealBarriers) {
    await db.update(deal).set({ barrierId: b.barrierId }).where(sql`${deal.dealId} = ${b.dealId}`);
  }
  const dealBarrierByDeal = new Map(
    insertedDealBarriers.map((b) => [b.dealId, b.barrierId]),
  );

  // ----- app_user.barrier_clearance - real barrier UUIDs (Track B / RLS fix) -----
  // Now that every information_barrier row exists (party-side above + deal-side
  // just now), back-fill app_user.barrier_clearance with the actual barrier
  // UUIDs. 0003_rls.sql's rls_wall_clear(barrier_id) tests
  // `barrier_id::text = ANY(app.wall::text[])`, so app.wall must carry the
  // barrier UUIDs for the wall to ever match. withRls (src/db/context.ts) sets
  // app.wall from app_user.barrier_clearance on every write transaction, so
  // this is what makes the production per-request wall enforcement actually
  // fire for the admin. (0004_rls_fix.sql additionally makes the policies
  // fail-open when app.user_id IS NULL, so the app's plain read queries -
  // which do not call withRls - see every row in admin/demo mode regardless.)
  //
  // Clearance model (business logic for an IB + bond house with Chinese walls):
  //   admin / partner / compliance → ALL barrier UUIDs (firm-wide oversight;
  //     the admin must see every party / deal / credit / compliance row, and
  //     compliance must be able to audit any wall).
  //   desk staff → the barriers that do NOT restrict their desk. A barrier's
  //     restricted_desk_set lists the desks BLOCKED from that wall's MNPI; a
  //     user is cleared for every barrier whose restricted set omits their
  //     desk, and walled out of the barriers that name their desk. Concretely
  //     the seeded walls restrict {secondary_mm, gsec_trading}, so the trader
  //     (secondary_mm) is walled out of every MNPI barrier while the IB/credit
  //     desks retain visibility - exactly the information-barrier intent.
  const clearanceBarrierIds: string[] = [
    ...insertedBarriers.map((b) => b.barrierId),
    ...insertedDealBarriers.map((b) => b.barrierId),
  ];
  // barrier_id → restricted_desk_set (zip the .returning() rows with their
  // input rows; .returning() preserves input order).
  const barrierDeskRestriction = new Map<string, readonly string[]>();
  insertedBarriers.forEach((b, i) =>
    barrierDeskRestriction.set(
      b.barrierId,
      (barrierRows[i]?.restrictedDeskSet ?? []) as readonly string[],
    ),
  );
  insertedDealBarriers.forEach((b, i) =>
    barrierDeskRestriction.set(
      b.barrierId,
      (dealBarrierRows[i]?.restrictedDeskSet ?? []) as readonly string[],
    ),
  );
  const OVERSIGHT_ROLES = new Set(["admin", "partner", "compliance"]);
  for (const u of APP_USER_SEED) {
    const uid = appUserByEmail.get(u.email)!;
    const wall = OVERSIGHT_ROLES.has(u.role)
      ? clearanceBarrierIds
      : clearanceBarrierIds.filter(
          (bid) => !(barrierDeskRestriction.get(bid) ?? []).includes(u.desk),
        );
    await db
      .update(appUser)
      .set({ barrierClearance: wall })
      .where(sql`${appUser.userId} = ${uid}`);
  }
  console.log(
    `  app_user.barrier_clearance: back-filled with real barrier UUIDs ` +
      `(${clearanceBarrierIds.length} barriers; admin/partner/compliance=all, desk staff=walled by restricted_desk_set).`,
  );

  // deal_party rows
  const dpRows: typeof dealParty.$inferInsert[] = [];
  dealPartyPlan.forEach((plan, i) => {
    const did = dealIds[i]!;
    dpRows.push({
      dealId: did, partyId: plan.issuerId, role: "issuer", isLead: true,
      commitmentAmount: round(50 + rnd() * 500, 4),
    });
    dpRows.push({
      dealId: did, partyId: firmPartyId, role: pick(["arranger", "lead_manager", "book_runner"] as const),
      isLead: true, commitmentAmount: round(20 + rnd() * 100, 4),
    });
    plan.investorIds.forEach((invId) => {
      dpRows.push({
        dealId: did, partyId: invId, role: "investor",
        commitmentAmount: round(10 + rnd() * 80, 4),
      });
    });
    if (plan.agencyId) {
      dpRows.push({ dealId: did, partyId: plan.agencyId, role: "rating_agency" });
    }
    if (brokerPartyIds.length) {
      dpRows.push({ dealId: did, partyId: pick(brokerPartyIds), role: "selling_broker" });
    }
  });
  // De-duplicate (deal_id, party_id, role)
  const dpSeen = new Set<string>();
  const dpUnique = dpRows.filter((r) => {
    const k = `${r.dealId}|${r.partyId}|${r.role}`;
    if (dpSeen.has(k)) return false;
    dpSeen.add(k);
    return true;
  });
  // Backdate deal_party createdAt (95-215 days ago) so the last-deal signal
  // stays older than party.updatedAt (lastTouch spread).
  for (const r of dpUnique) r.createdAt = pastDate(95, 120);
  await chunkedInsert(dealParty, dpUnique as any, undefined, 1000);

  // ----- allocation_event (bond deals across the full lifecycle) -----
  // Event-sourced: indications → orders → revised orders → allocations →
  // settlements, with event_type chosen per deal stage so the allocation
  // ledger reads realistically across mandates that are still raising orders
  // (not just the settled/closed subset). ~250+ rows across bond underwriting
  // / private placement / G-Sec auction deals, each investor linked to its
  // demat account where known and walled via barrier_id on MNPI deals.
  console.log("Generating allocation_event...");
  const allocRows: typeof allocationEvent.$inferInsert[] = [];
  dealPartyPlan.forEach((plan, i) => {
    const did = dealIds[i]!;
    const row = dealRows[i] as any;
    const dtype: string = row.__type;
    if (!BOND_DEAL_TYPES.has(dtype)) return;
    const status: string = row.status;
    const barrier = dealBarrierByDeal.get(did) ?? null;
    // Stage → which event types fire for each investor on the deal.
    const stageEvents: readonly ("indication" | "order" | "revised_order" | "allocated" | "oversubscribed_adjusted" | "settled" | "withdrawn")[] =
      status === "lead" ? ["indication"]
      : status === "mandated" ? ["indication", "order"]
      : status === "in_dd" ? ["indication", "order"]
      : status === "structuring" ? ["indication", "order"]
      : status === "rating_marketing" ? ["indication", "order"]
      : status === "pricing" ? ["order", "revised_order"]
      : status === "allocation" ? ["order", "allocated", "oversubscribed_adjusted"]
      : status === "settled" ? ["allocated", "settled"]
      : status === "closed" ? ["allocated", "settled"]
      : status === "on_hold" ? ["indication"]
      : ["indication"]; // dropped
    const baseYield = 7 + rnd() * 2.5;
    const basePrice = 98 + rnd() * 3.5;
    plan.investorIds.forEach((invId, k) => {
      const demat = dematByParty.get(invId) ?? null;
      stageEvents.forEach((evType, j) => {
        // Not every investor revises / gets oversubscribed-adjusted - drop a
        // fraction of the optional later events so volumes look organic.
        if ((evType === "revised_order" || evType === "oversubscribed_adjusted") && chance(0.4)) return;
        if (evType === "withdrawn" && chance(0.7)) return;
        const isAuction = dtype === "gsec_auction";
        const isPostPricing = evType === "allocated" || evType === "settled" || evType === "oversubscribed_adjusted";
        allocRows.push({
          dealId: did,
          partyId: invId,
          eventType: evType as any,
          amount: round(15 + rnd() * 120, 4),
          yieldPct: round(baseYield + (rnd() * 0.4 - 0.2), 4),
          price: round(basePrice + (rnd() * 0.5 - 0.25), 6),
          priceType: isAuction ? "dirty" : "clean",
          putCallIndicator: isAuction ? pick(["competitive", "non_competitive"] as const) : null,
          allotmentPct: isPostPricing ? round(40 + rnd() * 60, 2) : round(rnd() * 100, 2),
          dematAccountId: isPostPricing ? demat : null,
          eventAt: pastDate(20 + j * 5 + k, 60),
          eventByUserId: traderUserId,
          sourceChannel: pick(["phone", "email", "rfq_platform", "ndsom", "brokers", "ifa"] as const),
          barrierId: barrier,
        });
      });
    });
  });
  if (allocRows.length) await chunkedInsert(allocationEvent, allocRows as any, undefined, 500);
  console.log(`  allocation_event: ${allocRows.length}`);

  // ----- trade_event (secondary trades - G-Sec + corporate bonds) -----
  // IMMUTABLE, CCIL/NDS-OM reportable. ~110 executed trades across sovereign
  // paper (gsec/sdl/tbill on NDS-OM) and corporate bonds (NSE/BSE), each with a
  // unique CCIL trade ref, instrument + counterparty links, demat account, and
  // the issuer's information wall where the name is walled.
  console.log("Generating trade_event...");
  const tradeRows: typeof tradeEvent.$inferInsert[] = [];
  let ccilCounter = 0;
  const nextCcilId = () => {
    ccilCounter += 1;
    return `CCIL-${String(20260000 + ccilCounter).slice(0, 8)}-${String(ccilCounter).padStart(5, "0")}`;
  };
  // Counterparties: investors with demat accounts + the firm (market maker).
  const tradeCounterparties = [...investorPartyIds, firmPartyId];
  const N_TRADES = 110 * SCALE;
  for (let i = 0; i < N_TRADES; i++) {
    // Bias ~55% sovereign, ~45% corporate so both book sections populate.
    const wantGsec = chance(0.55);
    const pool = wantGsec
      ? allInstruments.filter((x) => x.instrumentType === "gsec" || x.instrumentType === "sdl" || x.instrumentType === "tbill")
      : allInstruments.filter((x) => x.instrumentType === "corp_bond" || x.instrumentType === "ncd" || x.instrumentType === "cp");
    if (!pool.length) continue;
    const ins = pick(pool);
    const cp = pick(tradeCounterparties);
    const side = pick(["buy", "sell"] as const);
    const isGsec = ins.instrumentType === "gsec" || ins.instrumentType === "sdl" || ins.instrumentType === "tbill";
    const isTbill = ins.instrumentType === "tbill";
    // Price around par; G-Secs quote dirty, corp bonds clean (FIMMDA).
    const priceBase = isTbill ? 98 + rnd() * 1.5 : 98 + rnd() * 4;
    const price = round(priceBase, 6);
    const ytm = isTbill
      ? round((100 - Number(price)) / Number(price) * (365 / 91) , 4) // rough BEY
      : round((ins.coupon ?? 7.5) + (rnd() * 1.2 - 0.4), 4);
    const amountCr = round(1 + rnd() * 75, 4); // crores traded
    const face = Number(ins.faceValue) || 100;
    const qty = round((Number(amountCr) * 1e7) / (Number(price) * face / 100), 4);
    const tradeAt = recentDate(120);
    const settleMs = tradeAt.getTime() + 1 * DAY_MS; // T+1
    const settlementDate = ymd(new Date(settleMs));
    // Link ~30% of corporate trades to a live bond deal (placement → flip).
    const linkedDeal = !isGsec && chance(0.3) ? pick(dealIds) : null;
    tradeRows.push({
      dealId: linkedDeal,
      partyId: cp,
      instrumentId: ins.instrumentId,
      ccilTradeId: nextCcilId(),
      exchange: (isGsec ? "Other" : pick(["NSE", "BSE"] as const)) as any,
      tradeSide: side as any,
      amount: amountCr,
      currencyCode: "INR",
      price,
      priceType: (isGsec ? "dirty" : "clean") as any,
      yieldPct: isTbill ? null : ytm,
      quantity: qty,
      settlementDate,
      dematAccountId: dematByParty.get(cp) ?? null,
      tradeAt,
      tradedByUserId: traderUserId,
      barrierId: barrierByParty.get(ins.issuerPartyId) ?? null,
    });
  }
  if (tradeRows.length) await chunkedInsert(tradeEvent, tradeRows as any, undefined, 500);
  console.log(`  trade_event: ${tradeRows.length}`);

  // ----- credit_analysis (~1000, scaled 10x) -----
  console.log("Generating credit_analysis + financials (10x scale)...");
  const creditIssuers = pickN(issuerPartyIds, 100 * SCALE);
  const caRows: typeof creditAnalysis.$inferInsert[] = creditIssuers.map((pid) => ({
    partyId: pid,
    obligorType: pick(["corporate", "nbfc", "spv", "project"] as const),
    analystUserId: analystUserId,
    reviewerUserId: adminUserId,
    analysisType: pick(["origination", "annual_surveillance", "event_driven", "rating_presentation_support"] as const),
    internalRatingShort: pick(["A1", "A2", "A3", "A4", "P1", "P2"]),
    internalRatingLong: pick(["AAA", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB"]),
    internalRatingAction: pick(["assign", "maintain", "upgrade", "downgrade", "watch_negative"] as const),
    pd1y: round(rnd() * 0.05, 4),
    pd5y: round(rnd() * 0.15, 4),
    lgdPct: round(20 + rnd() * 40, 2),
    ead: round(50 + rnd() * 500, 4),
    recoveryRatePct: round(40 + rnd() * 40, 2),
    recommendation: pick(["Approve", "Approve with conditions", "Decline", "Watchlist", "Escalate to committee"]),
    watchlistFlag: chance(0.12),
    validFrom: new Date("2024-08-01"),
    createdByUserId: analystUserId,
  }));
  const insertedCA: { creditAnalysisId: string; partyId: string }[] = await chunkedInsert<{ creditAnalysisId: string; partyId: string }>(
    creditAnalysis,
    caRows as any,
    { creditAnalysisId: creditAnalysis.creditAnalysisId, partyId: creditAnalysis.partyId },
    500,
  );
  const caIds = insertedCA.map((c) => c.creditAnalysisId);
  const caByParty = new Map(insertedCA.map((c) => [c.partyId, c.creditAnalysisId]));

  // ----- financial_statement (3 per analysis party) + fs_link + ratio_result -----
  // Each credit-analysis issuer gets one trajectory profile (improving /
  // deteriorating / stable / growing / declining / volatile / leverage_up /
  // deleveraging / turnaround) so the 3-period ratio sparklines trend
  // meaningfully and diverge across parties. genFinancials() returns the
  // periods oldest→latest; we push FS rows latest→oldest (y=0 is FY2024) to
  // keep the existing period-end math, then re-map for ratio computation.
  const fsRows: typeof financialStatement.$inferInsert[] = [];
  const fsPlan: { caId: string; partyId: string }[] = [];
  // periodsByCa[caIndex] = [y2_oldest, y1, y0_latest] line-item sets.
  const periodsByCa: PeriodLineItems[][] = [];
  for (let i = 0; i < insertedCA.length; i++) {
    const profile = pick(FIN_PROFILE_LIST);
    periodsByCa.push(genFinancials(profile));
  }
  for (let i = 0; i < insertedCA.length; i++) {
    const c = insertedCA[i]!;
    const periods = periodsByCa[i]!; // [y2, y1, y0]
    for (let y = 0; y < 3; y++) {
      const endDate = new Date(2024 - y, 2, 31); // Mar 31
      // y=0 → latest (index 2), y=1 → index 1, y=2 → oldest (index 0).
      const li = periods[2 - y]!;
      fsRows.push({
        partyId: c.partyId,
        periodType: "annual",
        periodEndDate: ymd(endDate),
        periodStartDate: ymd(new Date(2024 - y - 1, 3, 1)),
        statementType: y === 0 ? "consolidated" : "standalone",
        currencyCode: "INR",
        units: "crores",
        source: y === 0 ? "audited" : pick(["audited", "limited_review", "management_provisional"] as const),
        isConsolidated: y === 0,
        lineItems: {
          revenue: round(li.revenue, 2),
          cogs: round(li.cogs, 2),
          ebit: round(li.ebit, 2),
          depreciation_amortization: round(li.depreciation_amortization, 2),
          ebitda: round(li.ebitda, 2),
          interest_expense: round(li.interest_expense, 2),
          pbt: round(li.pbt, 2),
          pat: round(li.pat, 2),
          total_debt: round(li.total_debt, 2),
          cash_and_equivalents: round(li.cash_and_equivalents, 2),
          marketable_securities: round(li.marketable_securities, 2),
          current_assets: round(li.current_assets, 2),
          current_liabilities: round(li.current_liabilities, 2),
          inventory: round(li.inventory, 2),
          trade_receivables: round(li.trade_receivables, 2),
          trade_payables: round(li.trade_payables, 2),
          total_assets: round(li.total_assets, 2),
          net_worth: round(li.net_worth, 2),
          tangible_net_worth: round(li.tangible_net_worth, 2),
          cfo: round(li.cfo, 2),
          cfo_before_wc_changes: round(li.cfo_before_wc_changes, 2),
          capex: round(li.capex, 2),
          dividends_paid: round(li.dividends_paid, 2),
          cfads: round(li.cfads, 2),
          debt_service: round(li.debt_service, 2),
        },
      });
      fsPlan.push({ caId: c.creditAnalysisId, partyId: c.partyId });
    }
  }
  const insertedFS: { financialStatementId: string }[] = await chunkedInsert<{ financialStatementId: string }>(
    financialStatement,
    fsRows as any,
    { financialStatementId: financialStatement.financialStatementId },
    500,
  );
  const fsIds = insertedFS.map((f) => f.financialStatementId);

  // credit_analysis_fs_link (link each analysis to its 3 FS, primary_basis for first)
  const fsLinkRows: typeof creditAnalysisFsLink.$inferInsert[] = [];
  for (let i = 0; i < insertedCA.length; i++) {
    for (let j = 0; j < 3; j++) {
      const fsId = fsIds[i * 3 + j]!;
      fsLinkRows.push({
        creditAnalysisId: caIds[i]!,
        financialStatementId: fsId,
        linkRole: j === 0 ? "primary_basis" : "prior_period",
        linkedByUserId: analystUserId,
      });
    }
  }
  await chunkedInsert(creditAnalysisFsLink, fsLinkRows as any, undefined, 1000);

  // ratio_result - 6-8 ratios per FS, computed from the same line items the
  // workspace engine recomputes (ratiosFromLineItems matches the formulas in
  // src/features/credit/ratios.ts). Ratios therefore trend consistently with
  // the sparklines and differ meaningfully across parties.
  const RATIO_CODES = ["debt_equity", "interest_coverage", "current_ratio", "debt_ebitda", "roce", "roe", "ebitda_margin", "pat_margin"] as const;
  const ratioRows: typeof ratioResult.$inferInsert[] = [];
  for (let i = 0; i < insertedCA.length; i++) {
    const periods = periodsByCa[i]!; // [y2, y1, y0]
    for (let y = 0; y < 3; y++) {
      const fsId = fsIds[i * 3 + y]!;
      // fsRows were pushed y=0(latest)→y=2(oldest); map to chronological period.
      const li = periods[2 - y]!;
      const prior = 2 - y > 0 ? periods[2 - y - 1]! : null;
      const ratios = ratiosFromLineItems(li, prior);
      // Persist a varied but realistic subset (6-8) so the persisted-ratios
      // panel is populated but not identical across FS.
      const codes = pickN(RATIO_CODES, Math.floor(rnd() * 3) + 6);
      for (const code of codes) {
        const v = (ratios as Record<string, number | null>)[code];
        ratioRows.push({
          financialStatementId: fsId,
          ratioCode: code as any,
          ratioValue: v === null ? null : round(v, 4),
          formulaSnapshot: `formula:${code}@v1`,
        });
      }
    }
  }
  await chunkedInsert(ratioResult, ratioRows as any, undefined, 1000);

  // ----- scorecard_template (4: corporate, NBFC, project, real-estate) -----
  // The obligor_type enum has no `real_estate` value, so the real-estate
  // template is modeled as obligor_type='corporate' with a real-estate sector
  // override - the (obligor_type, sector_code, version) UQ keeps it distinct
  // from the plain corporate template. Real-estate-sector issuers are routed
  // to it via sectorByPartyId; every other corporate goes to the plain one.
  const templateRows = [
    {
      version: 1,
      obligorType: "corporate" as const,
      sectorCode: null,
      factorWeights: FACTOR_WEIGHTS,
      benchmarkOverrides: { debt_equity_max: 3, interest_coverage_min: 1.5 },
      approvedByUserId: adminUserId,
      approvedAt: new Date("2024-05-01"),
      status: "approved" as const,
    },
    {
      version: 2,
      obligorType: "nbfc" as const,
      sectorCode: "nbfc.gold_loan",
      factorWeights: { ...FACTOR_WEIGHTS, financial_risk: 0.35, business_risk: 0.2 },
      benchmarkOverrides: { crar_min: 15, gnpa_pct_max: 6, tier1_ratio_min: 10 },
      approvedByUserId: adminUserId,
      approvedAt: new Date("2024-05-04"),
      status: "approved" as const,
    },
    {
      version: 3,
      obligorType: "project" as const,
      sectorCode: null,
      factorWeights: { ...FACTOR_WEIGHTS, structural_risk: 0.2, financial_risk: 0.25, business_risk: 0.2 },
      benchmarkOverrides: { min_dscr: 1.2, llcr_min: 1.15, debt_service_coverage: 1.3 },
      approvedByUserId: adminUserId,
      approvedAt: new Date("2024-05-07"),
      status: "approved" as const,
    },
    {
      version: 4,
      obligorType: "corporate" as const,
      sectorCode: "real_estate.residential",
      factorWeights: { ...FACTOR_WEIGHTS, structural_risk: 0.18, financial_risk: 0.28, business_risk: 0.22 },
      benchmarkOverrides: { debt_equity_max: 4, interest_coverage_min: 1.4, inventory_days_max: 180 },
      approvedByUserId: adminUserId,
      approvedAt: new Date("2024-05-10"),
      status: "approved" as const,
    },
  ];
  const insertedTemplates: { templateId: string; obligorType: string; sectorCode: string | null }[] = await db
    .insert(scorecardTemplate)
    .values(templateRows)
    .returning({
      templateId: scorecardTemplate.templateId,
      obligorType: scorecardTemplate.obligorType,
      sectorCode: scorecardTemplate.sectorCode,
    });
  // Resolve the four template ids by (obligorType, sectorCode) signature.
  const tplSig = (o: string, s: string | null) => `${o}|${s ?? ""}`;
  const templateBySig = new Map(
    insertedTemplates.map((t) => [tplSig(t.obligorType, t.sectorCode), t.templateId]),
  );
  const corporateTemplateId = templateBySig.get(tplSig("corporate", null))!;
  const nbfcTemplateId = templateBySig.get(tplSig("nbfc", "nbfc.gold_loan"))!;
  const projectTemplateId = templateBySig.get(tplSig("project", null))!;
  const realEstateTemplateId = templateBySig.get(tplSig("corporate", "real_estate.residential"))!;

  // ----- scorecard (1 per analysis) + credit_score (7 components) -----
  // Route each analysis to one of the four templates by obligor type + issuer
  // sector so every template is exercised (corporate / NBFC / project /
  // real-estate). spv obligors use the project template (SPVs are project
  // vehicles); real-estate-sector corporates use the real-estate template.
  const scRows: typeof scorecard.$inferInsert[] = caIds.map((caId, i) => {
    const obligor = (caRows[i] as any).obligorType as string;
    const issuerPartyId = insertedCA[i]!.partyId;
    const sector = sectorByPartyId.get(issuerPartyId);
    let templateId: string;
    let templateVersion: number;
    if (obligor === "nbfc") {
      templateId = nbfcTemplateId;
      templateVersion = 2;
    } else if (obligor === "project" || obligor === "spv") {
      templateId = projectTemplateId;
      templateVersion = 3;
    } else if (sector && sector.startsWith("real_estate")) {
      templateId = realEstateTemplateId;
      templateVersion = 4;
    } else {
      templateId = corporateTemplateId;
      templateVersion = 1;
    }
    return {
      creditAnalysisId: caId,
      templateId,
      templateVersion,
      totalScore: round(40 + rnd() * 50, 2),
      band: pick(["AAA", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB"]),
    };
  });
  const insertedSC: { scorecardId: string; creditAnalysisId: string }[] = await chunkedInsert<{ scorecardId: string; creditAnalysisId: string }>(
    scorecard,
    scRows as any,
    { scorecardId: scorecard.scorecardId, creditAnalysisId: scorecard.creditAnalysisId },
    500,
  );
  const scByCa = new Map(insertedSC.map((s) => [s.creditAnalysisId, s.scorecardId]));

  const csRows: typeof creditScore.$inferInsert[] = [];
  for (const c of insertedCA) {
    const scId = scByCa.get(c.creditAnalysisId)!;
    for (const comp of SCORE_COMPONENTS) {
      const w = FACTOR_WEIGHTS[comp];
      csRows.push({
        creditAnalysisId: c.creditAnalysisId,
        scorecardId: scId,
        componentCode: comp as any,
        componentScore: round(40 + rnd() * 55, 2),
        componentWeight: String(w),
      });
    }
  }
  await chunkedInsert(creditScore, csRows as any, undefined, 1000);

  // ----- financial_model (~80 across bond_pricing / project_finance /
  // securitization / dcf / m_and_a) -----
  // Versioned, JSONB params + outputs, linked to deals + parties (+ the
  // credit analysis where one exists for the issuer). bond_pricing models use
  // the real computeBondMetrics engine so the stored outputs match the modeling
  // detail page exactly (clean/dirty, YTM, duration, DV01, convexity, cash-flow
  // schedule). ~20% are v2/v3 forks (parent_model_id), ~60% approved.
  console.log("Generating financial_model...");
  const fmRows: (typeof financialModel.$inferInsert & { __idx: number })[] = [];
  // Bond coupon-date helper: walk back from maturity by the coupon period until
  // the coupon date is at/before settlement - yields aligned last/next coupon
  // dates the pricing engine accepts.
  const addMonthsISO = (iso: string, months: number) => {
    const [y, m, d] = iso.split("-").map(Number);
    const total = y * 12 + (m - 1) + months;
    const ny = Math.floor(total / 12);
    const nm = (total % 12 + 12) % 12 + 1;
    return `${ny}-${String(nm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  const deriveCouponDates = (maturityISO: string, freq: number, settlementISO: string) => {
    const months = 12 / freq;
    let next = maturityISO;
    let guard = 0;
    while (next > settlementISO && guard < 1000) {
      next = addMonthsISO(next, -months);
      guard++;
    }
    return { lastCouponDate: next, nextCouponDate: addMonthsISO(next, months) };
  };
  // Bond-deal + corp-bond-instrument pools.
  const bondDeals = dealIds
    .map((did, i) => ({ did, dtype: (dealRows[i] as any).__type as string, issuer: dealPartyPlan[i]!.issuerId, size: dealRows[i]!.targetSize }))
    .filter((d) => BOND_DEAL_TYPES.has(d.dtype));
  const corpInstruments = allInstruments.filter(
    (x) => x.instrumentType === "corp_bond" || x.instrumentType === "ncd" || x.instrumentType === "cp",
  );
  const pfDeals = dealIds
    .map((did, i) => ({ did, issuer: dealPartyPlan[i]!.issuerId, dtype: (dealRows[i] as any).__type as string }))
    .filter((d) => d.dtype === "project_finance");
  const secDeals = dealIds
    .map((did, i) => ({ did, issuer: dealPartyPlan[i]!.issuerId, dtype: (dealRows[i] as any).__type as string }))
    .filter((d) => d.dtype === "structured_finance" || d.dtype === "supply_chain_finance");
  const maDeals = dealIds
    .map((did, i) => ({ did, issuer: dealPartyPlan[i]!.issuerId, dtype: (dealRows[i] as any).__type as string }))
    .filter((d) => d.dtype === "m_and_a" || d.dtype === "ecm_ipo" || d.dtype === "valuation" || d.dtype === "fairness_opinion");
  let fmIdx = 0;

  // --- bond_pricing (~220, scaled 10x) ---
  const N_BP = Math.min(22 * SCALE, corpInstruments.length);
  for (let i = 0; i < N_BP; i++) {
    const ins = corpInstruments[i % corpInstruments.length]!;
    if (!ins.maturityDate) continue;
    const coupon = ins.coupon ?? 7.5;
    const freq = ins.frequency === "semi_annual" ? 2 : 1;
    const settlement = "2026-06-15";
    const { lastCouponDate, nextCouponDate } = deriveCouponDates(ins.maturityDate, freq, settlement);
    const ytm = coupon / 100 + 0.004 + rnd() * 0.012;
    const instrType: BondInstrumentType =
      ins.instrumentType === "ncd" ? "NCD" : ins.instrumentType === "cp" ? "CP" : "CORP_IG";
    const inputs: BondInputs = {
      instrumentType: instrType,
      faceValue: 100,
      couponRate: coupon / 100,
      couponFrequency: freq as 0 | 1 | 2,
      dayCount: "ACT_365",
      maturityDate: ins.maturityDate,
      lastCouponDate,
      nextCouponDate,
      settlementDate: settlement,
      yield: ytm,
      benchmarkYield: 0.0705,
    };
    const metrics = computeBondMetrics(inputs);
    const linkedDeal = bondDeals.length ? bondDeals[i % bondDeals.length]!.did : null;
    fmIdx += 1;
    fmRows.push({
      dealId: linkedDeal,
      creditAnalysisId: caByParty.get(ins.issuerPartyId) ?? null,
      partyId: ins.issuerPartyId,
      modelType: "bond_pricing",
      version: 1,
      currencyCode: "INR",
      params: {
        instrumentType: instrType,
        isin: ins.isin,
        faceValue: 100,
        couponRate: round(coupon / 100, 6),
        couponFrequency: freq,
        dayCount: "ACT_365",
        maturityDate: ins.maturityDate,
        lastCouponDate,
        nextCouponDate,
        settlementDate: settlement,
        yield: round(ytm, 6),
        benchmarkYield: 0.0705,
      },
      outputs: {
        cleanPrice: Number(metrics.cleanPrice.toFixed(4)),
        dirtyPrice: Number(metrics.dirtyPrice.toFixed(4)),
        accruedInterest: Number(metrics.accruedInterest.toFixed(4)),
        ytm: Number(metrics.ytm.toFixed(6)),
        currentYield: Number(metrics.currentYield.toFixed(6)),
        macaulayDuration: Number(metrics.macaulayDuration.toFixed(4)),
        modifiedDuration: Number(metrics.modifiedDuration.toFixed(4)),
        dv01: Number(metrics.dv01.toFixed(4)),
        convexity: Number(metrics.convexity.toFixed(4)),
        gSpread: metrics.gSpread != null ? Number(metrics.gSpread.toFixed(6)) : null,
        cashFlows: metrics.cashFlows.map((cf) => ({
          date: cf.date,
          periodsFromSettlement: Number(cf.periodsFromSettlement.toFixed(4)),
          yearsFromSettlement: Number(cf.yearsFromSettlement.toFixed(4)),
          cashFlow: Number(cf.cashFlow.toFixed(2)),
          presentValue: Number(cf.presentValue.toFixed(4)),
        })),
      },
      assumptionsDoc: "FIMMDA clean/YTM quote; ACT/365; annual coupons for corp paper.",
      scenarioTag: pick(["base", "yield_up_50bp", "yield_down_50bp", null] as const) ?? undefined,
      engineVersion: "bondPricing.v1",
      computedAt: recentDate(120),
      computedByUserId: analystUserId,
      approvedByUserId: chance(0.6) ? adminUserId : null,
      __idx: fmIdx,
    } as any);
  }

  // --- project_finance (~160, scaled 10x) ---
  for (let i = 0; i < 16 * SCALE; i++) {
    const d = pfDeals.length ? pfDeals[i % pfDeals.length]! : { did: null as string | null, issuer: pick(issuerPartyIds) };
    const debtPct = 0.6 + rnd() * 0.2;
    const projectCost = 200 + rnd() * 1800; // crores
    const debt = projectCost * debtPct;
    const tenor = 10 + Math.floor(rnd() * 12);
    const avgDscr = 1.15 + rnd() * 0.6;
    const minDscr = Math.max(1.02, avgDscr - 0.2 - rnd() * 0.15);
    const projectIrr = 0.1 + rnd() * 0.06;
    const equityIrr = projectIrr + 0.03 + rnd() * 0.05;
    fmIdx += 1;
    fmRows.push({
      dealId: d.did,
      creditAnalysisId: caByParty.get(d.issuer) ?? null,
      partyId: d.issuer,
      modelType: "project_finance",
      version: 1,
      currencyCode: "INR",
      params: {
        projectCostCrores: round(projectCost, 2),
        debtEquityRatio: round(debtPct / (1 - debtPct), 2),
        debtCrores: round(debt, 2),
        tenorYears: tenor,
        interestRate: round(0.085 + rnd() * 0.02, 4),
        doorToDoor: tenor + 1,
        tariffEscalation: round(0.03 + rnd() * 0.02, 4),
        capacityUtilizationPct: round(65 + rnd() * 25, 2),
      },
      outputs: {
        minDscr: Number(minDscr.toFixed(3)),
        averageDscr: Number(avgDscr.toFixed(3)),
        llcr: Number((avgDscr * 1.05).toFixed(3)),
        plcr: Number((avgDscr * 0.95).toFixed(3)),
        debtSizeCrores: round(debt, 2),
        projectIrr: Number(projectIrr.toFixed(4)),
        equityIrr: Number(equityIrr.toFixed(4)),
        npvCrores: round(projectCost * (0.15 + rnd() * 0.25), 2),
        paybackYears: Number((tenor * 0.7).toFixed(2)),
      },
      assumptionsDoc: "Sized on minimum DSCR ≥1.20x; debt sculpting to LLCR.",
      scenarioTag: pick(["base", "stress_low_tarriff", "delayed_cod", null] as const) ?? undefined,
      engineVersion: "projectFinance.v1",
      computedAt: recentDate(120),
      computedByUserId: analystUserId,
      approvedByUserId: chance(0.55) ? adminUserId : null,
      __idx: fmIdx,
    } as any);
  }

  // --- securitization (~140, scaled 10x) ---
  for (let i = 0; i < 14 * SCALE; i++) {
    const d = secDeals.length ? secDeals[i % secDeals.length]! : { did: null as string | null, issuer: pick(issuerPartyIds) };
    const poolSize = 100 + rnd() * 900; // crores
    const seniorPct = 0.78 + rnd() * 0.08;
    const senior = poolSize * seniorPct;
    const mezz = poolSize * (1 - seniorPct) * 0.6;
    const equity = poolSize - senior - mezz;
    const seniorLcm = 2.5 + rnd() * 2.5;
    fmIdx += 1;
    fmRows.push({
      dealId: d.did,
      creditAnalysisId: caByParty.get(d.issuer) ?? null,
      partyId: d.issuer,
      modelType: "securitization",
      version: 1,
      currencyCode: "INR",
      params: {
        poolSizeCrores: round(poolSize, 2),
        assetClass: pick(["retail_loan", "commercial_loan", "auto_loan", "microfinance", "receivables"]),
        weightedAvgLifeYears: Number((2 + rnd() * 4).toFixed(2)),
        poolYield: round(0.11 + rnd() * 0.04, 4),
        cumulativeLossAssumption: round(0.01 + rnd() * 0.03, 4),
      },
      outputs: {
        tranches: [
          { name: "Senior A", sizeCrores: round(senior, 2), coupon: round(0.075 + rnd() * 0.015, 4), rating: "AAA", lossCoverageMultiple: Number(seniorLcm.toFixed(2)), creditEnhancement: round((1 - seniorPct) * 100, 2) },
          { name: "Mezzanine B", sizeCrores: round(mezz, 2), coupon: round(0.095 + rnd() * 0.02, 4), rating: pick(["AA", "AA-", "A+"]), lossCoverageMultiple: Number((seniorLcm * 0.4).toFixed(2)), creditEnhancement: round((1 - seniorPct) * 40, 2) },
          { name: "Equity C", sizeCrores: round(equity, 2), coupon: null, rating: "NR", lossCoverageMultiple: 0, creditEnhancement: 0 },
        ],
        excessSpreadBps: Math.floor(150 + rnd() * 250),
        weightedAverageLifeYears: Number((2 + rnd() * 4).toFixed(2)),
        passthroughRating: pick(["AAA", "AA+", "AA"]),
      },
      assumptionsDoc: "Tranche CE sized to target senior LCM ≥2.5x; static-pool analysis.",
      scenarioTag: pick(["base", "stress_loss_2x", null] as const) ?? undefined,
      engineVersion: "securitization.v1",
      computedAt: recentDate(120),
      computedByUserId: analystUserId,
      approvedByUserId: chance(0.5) ? adminUserId : null,
      __idx: fmIdx,
    } as any);
  }

  // --- dcf / valuation (~160, scaled 10x) ---
  for (let i = 0; i < 16 * SCALE; i++) {
    const d = maDeals.length ? maDeals[i % maDeals.length]! : { did: null as string | null, issuer: pick(issuerPartyIds) };
    const rev = 250 + rnd() * 4000; // crores
    const wacc = 0.105 + rnd() * 0.03;
    const ev = rev * (1.5 + rnd() * 2.5);
    const debt = rev * (0.5 + rnd() * 1.5);
    const cash = rev * 0.05;
    const equityVal = ev - debt + cash;
    fmIdx += 1;
    fmRows.push({
      dealId: d.did,
      creditAnalysisId: caByParty.get(d.issuer) ?? null,
      partyId: d.issuer,
      modelType: "dcf",
      version: 1,
      currencyCode: "INR",
      params: {
        wacc: round(wacc, 4),
        terminalGrowthRate: round(0.03 + rnd() * 0.02, 4),
        forecastYears: 7,
        taxRate: 0.252,
        revenueBaseCrores: round(rev, 2),
      },
      outputs: {
        enterpriseValue: Number((ev * 1e7).toFixed(0)), // stored in absolute ₹ for the headline /1e7 formatter
        equityValue: Number((equityVal * 1e7).toFixed(0)),
        terminalValue: Number((ev * 0.45 * 1e7).toFixed(0)),
        wacc: Number(wacc.toFixed(4)),
        fcfProjection: Array.from({ length: 7 }, (_, k) => ({
          year: k + 1,
          fcfCrores: round(rev * (0.08 + k * 0.01) * (1 + 0.08) ** k, 2),
        })),
        impliedEvEbitda: Number((4 + rnd() * 6).toFixed(2)),
      },
      assumptionsDoc: "7y explicit FCFF + Gordon terminal; WACC via CAPM (ERP 6.5%, Rf 7.05%).",
      scenarioTag: pick(["base", "bull", "bear", null] as const) ?? undefined,
      engineVersion: "dcf.v1",
      computedAt: recentDate(120),
      computedByUserId: analystUserId,
      approvedByUserId: chance(0.55) ? adminUserId : null,
      __idx: fmIdx,
    } as any);
  }

  // --- m_and_a (~120, scaled 10x) ---
  for (let i = 0; i < 12 * SCALE; i++) {
    const d = maDeals.length ? maDeals[i % maDeals.length]! : { did: null as string | null, issuer: pick(issuerPartyIds) };
    const ev = (500 + rnd() * 5000) * 1e7; // absolute ₹
    const offerPerShare = 100 + rnd() * 400;
    const synergyNpv = (50 + rnd() * 500) * 1e7;
    fmIdx += 1;
    fmRows.push({
      dealId: d.did,
      creditAnalysisId: caByParty.get(d.issuer) ?? null,
      partyId: d.issuer,
      modelType: "m_and_a",
      version: 1,
      currencyCode: "INR",
      params: {
        offerPricePerShare: Number(offerPerShare.toFixed(2)),
        premiumToMarketPct: Number((15 + rnd() * 35).toFixed(2)),
        synergyRunRateCrores: round(50 + rnd() * 400, 2),
        financingMix: { cash: 0.4 + rnd() * 0.3, stock: 0.3, debt: 0.3 },
      },
      outputs: {
        enterpriseValue: Number(ev.toFixed(0)),
        equityValue: Number((ev * 0.85).toFixed(0)),
        offerPricePerShare: Number(offerPerShare.toFixed(2)),
        synergyNpv: Number(synergyNpv.toFixed(0)),
        accretionDilutionPct: Number(((rnd() * 12 - 4)).toFixed(2)),
        impliedEvEbitda: Number((6 + rnd() * 6).toFixed(2)),
      },
      assumptionsDoc: "Accretion/dilution vs standalone EPS; synergies phased over 24m.",
      scenarioTag: pick(["base", "high_synergy", null] as const) ?? undefined,
      engineVersion: "m_and_a.v1",
      computedAt: recentDate(120),
      computedByUserId: pick([analystUserId, coverageUserId]),
      approvedByUserId: chance(0.5) ? adminUserId : null,
      __idx: fmIdx,
    } as any);
  }

  // Strip the __idx helper before insert.
  const fmClean = fmRows.map((r) => {
    const { __idx, ...rest } = r as any;
    return rest;
  });
  const insertedFm: { financialModelId: string; modelType: string; partyId: string | null }[] = await chunkedInsert<{ financialModelId: string; modelType: string; partyId: string | null }>(
    financialModel,
    fmClean as any,
    {
      financialModelId: financialModel.financialModelId,
      modelType: financialModel.modelType,
      partyId: financialModel.partyId,
    },
    500,
  );
  // Version forks: ~20% of models get a v2 (and a few a v3) with parent_model_id
  // pointing at a same-type, same-party earlier model.
  const fmByVersion = new Map<string, { financialModelId: string; version: number }[]>();
  for (const f of insertedFm) {
    const key = `${f.modelType}|${f.partyId}`;
    const arr = fmByVersion.get(key) ?? [];
    arr.push({ financialModelId: f.financialModelId, version: 1 });
    fmByVersion.set(key, arr);
  }
  const forkRows: typeof financialModel.$inferInsert[] = [];
  for (let i = 0; i < insertedFm.length; i++) {
    if (!chance(0.2)) continue;
    const parent = insertedFm[i]!;
    const base = fmClean[i] as any;
    const forkRow: typeof financialModel.$inferInsert = {
      ...base,
      version: 2,
      parentModelId: parent.financialModelId,
      computedAt: recentDate(60),
      approvedByUserId: chance(0.4) ? adminUserId : null,
      scenarioTag: pick(["sensitivity", "case_downside", "committee_case", null] as const) ?? undefined,
    };
    forkRows.push(forkRow);
  }
  if (forkRows.length) await chunkedInsert(financialModel, forkRows as any, undefined, 500);
  console.log(`  financial_model: ${insertedFm.length + forkRows.length} (${insertedFm.length} v1 + ${forkRows.length} forks)`);
  const fmIds = insertedFm.map((f) => f.financialModelId);

  // ----- rating_ladder (CRISIL long_term) -----
  const ladderRows = [
    { agency: "CRISIL", scale: "long_term", symbol: "AAA", rank: 1, definition: "Highest degree of safety" },
    { agency: "CRISIL", scale: "long_term", symbol: "AA+", rank: 2 },
    { agency: "CRISIL", scale: "long_term", symbol: "AA", rank: 3 },
    { agency: "CRISIL", scale: "long_term", symbol: "AA-", rank: 4 },
    { agency: "CRISIL", scale: "long_term", symbol: "A+", rank: 5 },
    { agency: "CRISIL", scale: "long_term", symbol: "A", rank: 6 },
    { agency: "CRISIL", scale: "long_term", symbol: "A-", rank: 7 },
    { agency: "CRISIL", scale: "long_term", symbol: "BBB+", rank: 8 },
    { agency: "CRISIL", scale: "long_term", symbol: "BBB", rank: 9 },
    { agency: "CRISIL", scale: "long_term", symbol: "BBB-", rank: 10 },
  ].map((r) => ({ ...r, definition: r.definition ?? null }));
  await db.insert(ratingLadder).values(ladderRows as any);

  // ----- external_rating (~1000, scaled 10x) -----
  const erRows: typeof externalRating.$inferInsert[] = creditIssuers.slice(0, 100 * SCALE).map((pid) => {
    const rv = pick(RATING_VALUES);
    return {
      partyId: pid,
      agency: pick(RATING_AGENCIES) as any,
      ratingScale: "long_term",
      ratingValue: rv,
      ratingRank: RATING_RANK[rv] ?? null,
      outlook: pick(OUTLOOKS) as any,
      ratingAction: pick(RATING_ACTIONS) as any,
      effectiveDate: ymd(new Date(2024, Math.floor(rnd() * 12), 1)),
      isSolicited: chance(0.6),
    };
  });
  await chunkedInsert(externalRating, erRows as any, undefined, 1000);

  // ----- exposure (~1000, scaled 10x) -----
  const expRows: typeof exposure.$inferInsert[] = creditIssuers.slice(0, 100 * SCALE).map((pid) => ({
    partyId: pid,
    instrumentId: (instrumentsByIssuer.get(pid)?.[0]) ?? null,
    exposureType: pick(["underwriting_unsold", "secondary_inventory", "portfolio_holding", "advisory_fee_at_risk"] as const),
    currencyCode: "INR",
    grossExposure: round(10 + rnd() * 300, 4),
    netExposure: round(8 + rnd() * 280, 4),
    asOfDate: ymd(new Date(2025, 5, 1)),
    maturityDate: ymd(new Date(2030, 0, 1)),
  }));
  await chunkedInsert(exposure, expRows as any, undefined, 1000);

  // ----- credit_limit (~1000, scaled 10x) -----
  const clRows: typeof creditLimit.$inferInsert[] = creditIssuers.slice(0, 100 * SCALE).map((pid) => {
    // Review-due spread relative to NOW: some overdue, some due soon, most
    // later this year / next - instead of a flat 2026 month band.
    const reviewDue = pickWeighted([
      ["overdue", 0.15], ["soon", 0.20], ["quarter", 0.25], ["later", 0.25], ["far", 0.15],
    ] as const);
    const reviewDueDate =
      reviewDue === "overdue" ? pastDate(1, 120)
      : reviewDue === "soon" ? futureDate(1, 30)
      : reviewDue === "quarter" ? futureDate(30, 90)
      : reviewDue === "later" ? futureDate(90, 270)
      : futureDate(270, 540);
    return {
      partyId: pid,
      limitType: pick(["issuer_underwriting", "single_name", "group", "sector"] as const),
      currencyCode: "INR",
      limitAmount: round(100 + rnd() * 1000, 4),
      utilized: round(rnd() * 400, 4),
      utilizedAsOf: ymd(pastDate(20, 40)),
      isStale: chance(0.1),
      effectiveFrom: new Date("2024-06-01"),
      approvedByUserId: adminUserId,
      reviewDueDate: ymd(reviewDueDate),
    };
  });
  await chunkedInsert(creditLimit, clRows as any, undefined, 1000);

  // ----- kyc_record (~1500, scaled 10x) + kyc_beneficial_owner -----
  console.log("Generating kyc / consent / dsr (10x scale)...");
  const kycPartyIds = pickN(partyIds.filter((_, i) => partySpecs[i].type !== "internal_staff"), 150 * SCALE);
  const kycRows: typeof kycRecord.$inferInsert[] = kycPartyIds.map((pid) => {
    const risk = pick(["low", "medium", "high"] as const);
    // Refresh-state buckets, spread relative to NOW so the KYC board shows a
    // realistic mix: overdue / due soon / due this quarter / due later / not
    // due for ages / a small slice with no schedule (pending review). This
    // replaces the old "every row validUntil 2034 → no schedule" wall.
    // Lead time (valid_until - rekyc_due_date) by risk: high 6mo, medium 1y, low 2y.
    const leadDays = risk === "high" ? 183 : risk === "medium" ? 365 : 730;
    const bucket = pickWeighted([
      ["overdue", 0.18],
      ["due_soon", 0.14],
      ["due_quarter", 0.18],
      ["due_later", 0.22],
      ["due_far", 0.18],
      ["no_schedule", 0.10],
    ] as const);
    let rekycDue: Date | null;
    let validUntil: Date | null;
    let status: string;
    if (bucket === "overdue") {
      rekycDue = pastDate(1, 120);
      validUntil = new Date(rekycDue.getTime() + leadDays * DAY_MS);
      status = "rekyc_due";
    } else if (bucket === "due_soon") {
      rekycDue = futureDate(1, 30);
      validUntil = new Date(rekycDue.getTime() + leadDays * DAY_MS);
      status = pick(["approved", "approved", "in_review"] as const);
    } else if (bucket === "due_quarter") {
      rekycDue = futureDate(30, 90);
      validUntil = new Date(rekycDue.getTime() + leadDays * DAY_MS);
      status = pick(["approved", "approved", "in_review"] as const);
    } else if (bucket === "due_later") {
      rekycDue = futureDate(120, 245);
      validUntil = new Date(rekycDue.getTime() + leadDays * DAY_MS);
      status = pick(["approved", "approved", "approved"] as const);
    } else if (bucket === "due_far") {
      rekycDue = futureDate(365, 730);
      validUntil = new Date(rekycDue.getTime() + leadDays * DAY_MS);
      status = "approved";
    } else {
      // no schedule - pending/in_review/rejected have no valid_until yet.
      rekycDue = null;
      validUntil = null;
      status = pick(["pending", "in_review", "in_review", "rejected"] as const);
    }
    const approved = status === "approved";
    return {
      partyId: pid,
      kycType: risk === "high" ? "EDD" : chance(0.3) ? "simplified" : "CDD",
      status: status as any,
      riskRating: risk,
      cddDoneAt: status !== "pending" ? pastDate(300, 400) : null,
      eddReason: risk === "high" ? "BO >= 10% identified" : null,
      highestBoOwnershipPct: round(rnd() * 45, 2),
      sourceOfFundsVerified: chance(0.7),
      sourceOfWealthVerified: chance(0.6),
      approvedByUserId: approved ? complianceUserId : null,
      approvedAt: approved ? pastDate(300, 400) : null,
      validUntil: validUntil ? ymd(validUntil) : null,
      rekycDueDate: rekycDue ? ymd(rekycDue) : null,
    };
  });
  const insertedKyc: { kycRecordId: string; partyId: string }[] = await chunkedInsert<{ kycRecordId: string; partyId: string }>(
    kycRecord,
    kycRows as any,
    { kycRecordId: kycRecord.kycRecordId, partyId: kycRecord.partyId },
    500,
  );

  // kyc_beneficial_owner: link 1-2 contacts per kyc record (contacts that belong to the party)
  const contactsByParty = new Map<string, string[]>();
  for (let i = 0; i < contactIds.length; i++) {
    const pid = partyIds[i % partyIds.length]!;
    const arr = contactsByParty.get(pid) ?? [];
    arr.push(contactIds[i]!);
    contactsByParty.set(pid, arr);
  }
  // kyc_beneficial_owner: 1-3 BOs per KYC record, each with an ownership_pct
  // that sums to a realistic 30–90% across the declared BOs. Every KYC record
  // gets at least one BO (falling back to any contact if the party's own
  // contact pool is empty - should not happen, but guarantees coverage).
  const boRows: typeof kycBeneficialOwner.$inferInsert[] = [];
  const boSeen = new Set<string>();
  const boRelationshipPaths = [
    "obligor → shareholder",
    "obligor → promoter → shareholder",
    "obligor → holding company → shareholder",
    "obligor → trustee → beneficiary",
    "obligor → HUF → karta",
  ];
  for (const k of insertedKyc) {
    let partyContacts = contactsByParty.get(k.partyId) ?? [];
    if (!partyContacts.length) partyContacts = [pick(contactIds)];
    const boCount = Math.min(3, Math.max(1, Math.floor(rnd() * 3) + 1));
    // Top up with group-level contacts when the party's own pool is smaller
    // than boCount - represents a parent / holding-company beneficial owner
    // (realistic for group structures) so some KYC records carry 3 BOs.
    const pool = partyContacts.slice();
    let guard = 0;
    while (pool.length < boCount && guard < 30) {
      const extra = pick(contactIds);
      if (!pool.includes(extra)) pool.push(extra);
      guard++;
    }
    const bos = pickN(pool, Math.min(boCount, pool.length));
    // Target total declared ownership 30–90%, split across the BOs.
    const targetTotal = 30 + rnd() * 60;
    const weights = bos.map(() => 0.5 + rnd());
    const wSum = weights.reduce((s, w) => s + w, 0);
    bos.forEach((cid, j) => {
      const key = `${k.kycRecordId}|${cid}`;
      if (boSeen.has(key)) return;
      boSeen.add(key);
      const isGroupBo = !partyContacts.includes(cid);
      const pct = j === bos.length - 1
        ? Math.max(1, targetTotal - weights.slice(0, -1).reduce((s, w) => s + (w / wSum) * targetTotal, 0))
        : (weights[j]! / wSum) * targetTotal;
      boRows.push({
        kycRecordId: k.kycRecordId,
        contactId: cid,
        ownershipPct: round(pct, 2),
        declaredAt: new Date("2024-06-01"),
        relationshipPath: isGroupBo ? "obligor → holding company → shareholder" : pick(boRelationshipPaths),
      });
    });
  }
  await chunkedInsert(kycBeneficialOwner, boRows as any, undefined, 1000);
  console.log(`  kyc_beneficial_owner: ${boRows.length}`);

  // ----- consent_record (~130) + link withdrawn → DSR history -----
  // Purpose-bound DPDP consents across all 9 purposes, ~18% withdrawn
  // (consentWithdrawnAt set), varied data categories / methods / policy
  // versions / retention windows. Withdrawn consent ids are captured so the
  // DSR block can chain the withdraw_consent / erasure requests that
  // DPDP-mandates follow from a withdrawal.
  const N_CONSENTS = 130 * SCALE;
  const consentPurposes = [
    "marketing", "advisory_engagement", "kyc_processing", "credit_analysis",
    "data_sharing_with_rating_agency", "data_sharing_with_investors",
    "regulatory_reporting", "portfolio_management", "secondary_trading_contact",
  ] as const;
  const dataCategorySets = [
    ["identity", "contact"],
    ["identity", "contact", "financial"],
    ["contact", "marketing"],
    ["identity", "contact", "financial", "kyc"],
    ["financial", "credit_history"],
  ];
  const consentRows: typeof consentRecord.$inferInsert[] = [];
  for (let i = 0; i < N_CONSENTS; i++) {
    const useContact = chance(0.4);
    const pid = pick(partyIds);
    const cid = useContact ? (contactsByParty.get(pid)?.[0] ?? pick(contactIds)) : null;
    const givenAt = pastDate(120, 540);
    const withdrawn = chance(0.18);
    const withdrawnAt = withdrawn
      ? new Date(givenAt.getTime() + (30 + Math.floor(rnd() * 300)) * DAY_MS)
      : null;
    consentRows.push({
      partyId: useContact ? null : pid,
      contactId: useContact ? cid : null,
      purpose: pick(consentPurposes),
      purposeDescription: "Consent for CRM processing under DPDP Act 2023",
      consentGivenAt: givenAt,
      consentWithdrawnAt: withdrawnAt && withdrawnAt.getTime() < NOW.getTime() ? withdrawnAt : null,
      consentMethod: pick(["digital_sign", "checkbox_email", "physical_signed", "verbal_recorded"] as const),
      dataCategories: pick(dataCategorySets),
      retentionUntil: ymd(new Date(2027 + Math.floor(rnd() * 2), Math.floor(rnd() * 12), 1)),
      versionOfPolicy: pick(["v1.0", "v1.1", "v1.2", "v1.3"]),
    });
  }
  const insertedConsents: { consentRecordId: string; consentWithdrawnAt: Date | null; partyId: string | null; contactId: string | null }[] = await chunkedInsert<{ consentRecordId: string; consentWithdrawnAt: Date | null; partyId: string | null; contactId: string | null }>(
    consentRecord,
    consentRows as any,
    {
      consentRecordId: consentRecord.consentRecordId,
      consentWithdrawnAt: consentRecord.consentWithdrawnAt,
      partyId: consentRecord.partyId,
      contactId: consentRecord.contactId,
    },
    500,
  );
  const withdrawnConsents = insertedConsents.filter((c) => c.consentWithdrawnAt != null);
  console.log(`  consent_record: ${insertedConsents.length} (withdrawn ${withdrawnConsents.length})`);

  // ----- data_subject_request (~18 across types + statuses) -----
  // Mix of access / rectification (correction) / erasure / restriction /
  // portability / withdraw_consent. The withdraw_consent + erasure rows chain
  // to a real withdrawn consent_record via triggeringConsentRecordId so the
  // DSR → consent lineage is testable. CHECK requires ≥1 of party/contact set.
  const dsrRows: typeof dataSubjectRequest.$inferInsert[] = [];
  const dsrStatuses = ["received", "in_review", "fulfilled", "rejected", "cancelled"] as const;
  const dsrTypes = ["access", "erasure", "rectification", "restriction", "portability", "withdraw_consent"] as const;
  const N_DSR = 18 * SCALE;
  for (let i = 0; i < N_DSR; i++) {
    // First ~8 chain to a withdrawn consent (withdraw_consent / erasure).
    let type: (typeof dsrTypes)[number];
    let triggeringConsentId: string | null = null;
    let pid: string | null = null;
    let cid: string | null = null;
    if (i < withdrawnConsents.length && (i < 8)) {
      const wc = withdrawnConsents[i]!;
      type = pick(["withdraw_consent", "erasure", "restriction"] as const);
      triggeringConsentId = wc.consentRecordId;
      pid = wc.partyId;
      cid = wc.contactId;
    } else {
      type = pick(dsrTypes);
      const useContact = chance(0.45);
      const p = pick(partyIds);
      pid = useContact ? null : p;
      cid = useContact ? (contactsByParty.get(p)?.[0] ?? pick(contactIds)) : null;
    }
    if (!pid && !cid) cid = pick(contactIds);
    const status = pick(dsrStatuses);
    const requestedAt = pastDate(5, 360);
    const completed = status === "fulfilled" || (status === "rejected" && chance(0.6));
    dsrRows.push({
      partyId: pid,
      contactId: cid,
      requestType: type,
      status,
      requestedAt,
      completedAt: completed ? new Date(requestedAt.getTime() + (3 + Math.floor(rnd() * 40)) * DAY_MS) : null,
      notes: `DPDP ${type} request${triggeringConsentId ? " - triggered by consent withdrawal" : ""}`,
      handledByUserId: complianceUserId,
      triggeringConsentRecordId: triggeringConsentId,
    });
  }
  await chunkedInsert(dataSubjectRequest, dsrRows as any, undefined, 500);
  console.log(`  data_subject_request: ${dsrRows.length}`);

  // ----- interaction (~200) + interaction_attendee (2-4 each) -----
  console.log("Generating interactions / tasks / documents / audit...");
  // Build an internal-staff contact pool (the firm's RMs/analysts as contacts)
  // so meetings can list an advisor attendee alongside issuer/investor sides.
  const internalStaffPartyIds = partySpecs
    .map((s, i) => (s.type === "internal_staff" ? partyIds[i]! : null))
    .filter((x): x is string => !!x);
  const internalContactIds = new Set<string>();
  for (const pid of internalStaffPartyIds) {
    for (const c of contactsByParty.get(pid) ?? []) internalContactIds.add(c);
  }
  const internalContactPool = Array.from(internalContactIds);
  // Build 2-4 unique attendees for an interaction anchored on party pid (with a
  // primary contact). Combines the anchor party's contacts + a counterparty
  // party's contacts + an internal advisor, so most interactions have 2-4
  // attendees instead of a single host.
  const buildAttendees = (pid: string | null, primaryCid: string | null): string[] => {
    const set = new Set<string>();
    const addPartyContacts = (p: string) => {
      for (const c of contactsByParty.get(p) ?? []) {
        if (set.size >= 4) break;
        set.add(c);
      }
    };
    if (pid) addPartyContacts(pid);
    if (primaryCid) set.add(primaryCid);
    // ~85% of interactions are multi-party (add a counterparty + advisor).
    const target = 2 + Math.floor(rnd() * 3); // 2, 3, or 4
    if (target > set.size) {
      let guard = 0;
      while (set.size < target && guard < 12) {
        const other = pick(partyIds);
        if (other !== pid) addPartyContacts(other);
        guard++;
      }
    }
    // Sprinkle an internal advisor into ~40% of multi-attendee meetings.
    if (internalContactPool.length && set.size >= 2 && chance(0.4)) {
      set.add(pick(internalContactPool));
    }
    // Guarantee at least 2 attendees (top up from the general contact pool).
    while (set.size < 2) set.add(pick(contactIds));
    return Array.from(set).slice(0, 4);
  };
  const interRows: typeof interaction.$inferInsert[] = [];
  const interPlan: { contactIds: string[] }[] = [];
  for (let i = 0; i < 200 * SCALE; i++) {
    const anchor = pick(["party", "deal", "contact"] as const);
    const pid = anchor === "party" || anchor === "deal" ? pick(partyIds) : null;
    const did = anchor === "deal" ? pick(dealIds) : null;
    const primaryCid = pid ? (contactsByParty.get(pid)?.[0]) ?? null : pick(contactIds);
    const attendees = buildAttendees(pid, primaryCid);
    interRows.push({
      partyId: pid,
      dealId: did,
      contactId: primaryCid,
      channel: pick(["meeting", "call", "email", "whatsapp", "rfq", "ndsom_chat", "site_visit", "management_presentation"] as const),
      direction: pick(["inbound", "outbound"] as const),
      subject: pick(["Bond mandate discussion", "Pricing call", "KYC follow-up", "Investor roadshow", "Rating agency meeting", "Term sheet review", "Site visit", "Refinance proposal", "Allocation call", "DD working session", "Management presentation"]),
      body: pick([
        "Discussed structure and tenor. Investor indicated interest in 5y senior secured.",
        "Reviewed preliminary term sheet; agreed to circulate revised coupon guidance.",
        "Walked through KYC pack outstanding items; BO declarations to be filed this week.",
        "Roadshow feedback positive: two accounts asked for revised allocation.",
        "Rating agency sought additional comfort on debt service coverage; shared model.",
        "Site visit completed; EPC progress ahead of schedule, no cost overrun.",
        "Refinance proposal presented; treasury to revert on swap economics.",
      ]),
      // Spread across the last ~90 days (skewed recent) so the activity feed
      // reads "today / 2d ago / 3w ago" instead of a uniform year-ago stamp.
      occurredAt: recentDate(90),
      durationMin: Math.floor(rnd() * 60 + 15),
      primaryContactId: primaryCid,
      userId: pick([coverageUserId, analystUserId, traderUserId]),
      containsMnpi: chance(0.25),
      nextAction: pick(["Send term sheet", "Schedule DD", "Follow up on KYC", "Share credit memo", null] as const) ?? undefined,
    });
    interPlan.push({ contactIds: attendees });
  }
  const insertedInter: { interactionId: string }[] = await chunkedInsert<{ interactionId: string }>(
    interaction,
    interRows as any,
    { interactionId: interaction.interactionId },
    500,
  );
  const interIds = insertedInter.map((i) => i.interactionId);

  const attRows: typeof interactionAttendee.$inferInsert[] = [];
  let interactionsWith2Plus = 0;
  interPlan.forEach((p, i) => {
    const seen = new Set<string>();
    if (p.contactIds.length >= 2) interactionsWith2Plus++;
    p.contactIds.forEach((cid, j) => {
      if (seen.has(cid)) return;
      seen.add(cid);
      const isInternal = internalContactIds.has(cid);
      const roleAtMeeting =
        j === 0 ? (chance(0.2) ? "chair" : "host")
        : isInternal ? "advisor"
        : j === 1 ? pick(["issuer_side", "investor_side", "presenter"] as const)
        : pick(["issuer_side", "investor_side", "observer", "other"] as const);
      attRows.push({
        interactionId: interIds[i]!,
        contactId: cid,
        roleAtMeeting,
      });
    });
  });
  if (attRows.length) await chunkedInsert(interactionAttendee, attRows as any, undefined, 1000);
  console.log(`  interaction_attendee: ${attRows.length} (${interactionsWith2Plus} interactions with ≥2 attendees)`);

  // ----- task (~1500, scaled 10x) -----
  const taskRows: typeof taskTable.$inferInsert[] = [];
  for (let i = 0; i < 150 * SCALE; i++) {
    const dealAnchored = chance(0.6);
    const did = dealAnchored ? pick(dealIds) : null;
    const pid = !dealAnchored ? pick(partyIds) : null;
    const status = pick(["pending", "in_progress", "completed", "completed", "cancelled", "blocked", "deferred"] as const);
    // Due dates spread around NOW: open tasks are upcoming (next 0-60 days),
    // completed/blocked tasks are in the past (1-90 days ago) so the task board
    // shows a realistic overdue / due-soon / done mix.
    const isOpen = status === "pending" || status === "in_progress" || status === "deferred";
    const dueDate = isOpen ? futureDate(0, 60) : pastDate(1, 90);
    taskRows.push({
      dealId: did,
      partyId: pid,
      title: pick(["Prepare credit memo", "Collect KYC pack", "Send term sheet", "Coordinate rating meeting", "Finalize offering circular", "Investor roadshow prep", "Site visit report", "Update exposure sheet"]),
      description: "Auto-generated from deal stage transition.",
      assigneeUserId: pick([coverageUserId, analystUserId, complianceUserId]),
      dueDate: ymd(dueDate),
      priority: pick(["low", "medium", "medium", "high", "urgent"] as const),
      status: status as any,
      createdByUserId: coverageUserId,
      completedAt: status === "completed" ? pastDate(1, 75) : null,
    });
  }
  const insertedTasks: { taskId: string; dealId: string | null; status: string }[] = await chunkedInsert<{ taskId: string; dealId: string | null; status: string }>(
    taskTable,
    taskRows as any,
    {
      taskId: taskTable.taskId,
      dealId: taskTable.dealId,
      status: taskTable.status,
    },
    500,
  );
  console.log(`  task: ${insertedTasks.length}`);

  // ----- task_dependency (wire dependencies between tasks) -----
  // Build a DAG by only adding edges task_i → depends_on task_j with j < i
  // (by insertion order), so cycles are structurally impossible and a task
  // never depends on itself. Prefer same-deal dependencies; ~35% of tasks get
  // 1-2 dependencies. Open tasks typically depend on completed/blocked ones.
  const tdRows: typeof taskDependency.$inferInsert[] = [];
  const tdSeen = new Set<string>();
  for (let i = 1; i < insertedTasks.length; i++) {
    if (!chance(0.35)) continue;
    const t = insertedTasks[i]!;
    // Candidate predecessors: earlier tasks, preferably same deal.
    const sameDeal = insertedTasks
      .slice(0, i)
      .filter((x) => t.dealId && x.dealId === t.dealId);
    const pool = sameDeal.length >= 2 ? sameDeal : insertedTasks.slice(0, i);
    if (!pool.length) continue;
    const nDeps = Math.min(2, 1 + Math.floor(rnd() * 2));
    const deps = pickN(pool, Math.min(nDeps, pool.length));
    for (const dep of deps) {
      if (dep.taskId === t.taskId) continue;
      const key = `${t.taskId}|${dep.taskId}`;
      if (tdSeen.has(key)) continue;
      tdSeen.add(key);
      tdRows.push({ taskId: t.taskId, dependsOnTaskId: dep.taskId });
    }
  }
  if (tdRows.length) await chunkedInsert(taskDependency, tdRows as any, undefined, 1000);
  console.log(`  task_dependency: ${tdRows.length}`);

  // ----- document (~150+ across types, barrier-classified, deal/party-linked) -----
  // Every deal gets ≥1 document (mandate letter / term sheet / credit memo);
  // active deals get a 2nd (offering circular / IM / rating rationale). A
  // further ~40 party/contact docs cover KYC packs, financial model files,
  // engagement letters, NDAs (modeled as document_type='other' - no NDA enum),
  // board resolutions, valuation / legal-DD / site reports. MNPI / walled docs
  // carry barrier_id (deal wall for deal docs, party wall for party docs).
  console.log("Generating documents...");
  const docRows: typeof documentTable.$inferInsert[] = [];
  const docTypeByDealStage: Record<string, string[]> = {
    lead: ["engagement_letter", "mandate_letter"],
    mandated: ["mandate_letter", "engagement_letter", "credit_memo"],
    in_dd: ["credit_memo", "legal_dd_report", "term_sheet"],
    structuring: ["term_sheet", "information_memorandum", "security_document"],
    rating_marketing: ["rating_rationale", "information_memorandum", "credit_memo"],
    pricing: ["term_sheet", "offering_circular", "board_resolution"],
    allocation: ["offering_circular", "board_resolution", "trustee_deed"],
    settled: ["offering_circular", "trustee_deed", "security_document"],
    closed: ["offering_circular", "valuation_report"],
    on_hold: ["credit_memo", "engagement_letter"],
    dropped: ["engagement_letter"],
  };
  const ACTIVE_STAGES = new Set(["mandated", "in_dd", "structuring", "rating_marketing", "pricing", "allocation"]);
  let docSeq = 0;
  const docSha = () =>
    Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(rnd() * 16)]).join("");
  const docRef = () => `s3://binary-crm-docs/${Math.floor(rnd() * 1e9)}-${docSeq}.pdf`;
  // Per-deal docs.
  dealPartyPlan.forEach((plan, i) => {
    const did = dealIds[i]!;
    const status = (dealRows[i] as any).status as string;
    const barrier = dealBarrierByDeal.get(did) ?? null;
    const types = docTypeByDealStage[status] ?? ["term_sheet", "credit_memo"];
    // 1st doc: lead doc for the stage.
    docSeq += 1;
    const t1 = types[0]!;
    docRows.push({
      dealId: did,
      partyId: plan.issuerId,
      documentType: t1 as any,
      fileStoreRef: docRef(),
      fileName: `${t1}_${dealRows[i]!.dealCode ?? did.slice(0, 8)}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: Math.floor(rnd() * 5_000_000 + 200_000),
      sha256: docSha(),
      uploadedByUserId: coverageUserId,
      isConfidential: chance(0.5),
      isMnpi: chance(0.25),
      barrierId: barrier,
      retentionUntil: ymd(new Date(2031, Math.floor(rnd() * 12), 1)),
    });
    // 2nd doc for active deals.
    if (ACTIVE_STAGES.has(status) && types.length > 1) {
      docSeq += 1;
      const t2 = types[1 + Math.floor(rnd() * (types.length - 1)) % (types.length - 1)]!;
      docRows.push({
        dealId: did,
        partyId: plan.issuerId,
        documentType: t2 as any,
        fileStoreRef: docRef(),
        fileName: `${t2}_${dealRows[i]!.dealCode ?? did.slice(0, 8)}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: Math.floor(rnd() * 8_000_000 + 200_000),
        sha256: docSha(),
        uploadedByUserId: pick([analystUserId, coverageUserId]),
        isConfidential: chance(0.55),
        isMnpi: chance(0.3),
        barrierId: barrier,
        retentionUntil: ymd(new Date(2031, Math.floor(rnd() * 12), 1)),
      });
    }
  });
  // Party / contact docs (KYC packs, model files, engagement letters, NDAs,
  // rating letters, board resolutions, financial statements, consent forms).
  const partyDocTypes = [
    "kyc_pack", "financial_model_file", "engagement_letter", "other",
    "rating_rationale", "board_resolution", "financial_statement",
    "consent_form", "pan_card", "aadhaar", "valuation_report", "legal_dd_report",
  ] as const;
  const kycCats = ["id_proof", "address_proof", "pan", "bo_declaration", "pep_declaration", "source_of_funds", "authority_letter"] as const;
  for (let i = 0; i < 40 * SCALE; i++) {
    docSeq += 1;
    const isContactDoc = chance(0.3);
    const pid = isContactDoc ? null : pick(partyIds);
    const cid = isContactDoc ? pick(contactIds) : null;
    const dtype = pick(partyDocTypes);
    const isKyc = dtype === "kyc_pack" || dtype === "pan_card" || dtype === "aadhaar";
    docRows.push({
      dealId: null,
      partyId: pid,
      contactId: cid,
      documentType: dtype as any,
      kycCategory: isKyc ? pick(kycCats) : null,
      fileStoreRef: docRef(),
      fileName: `${dtype}_${docSeq}.${dtype === "financial_model_file" ? "xlsx" : "pdf"}`,
      mimeType: dtype === "financial_model_file" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      sizeBytes: Math.floor(rnd() * 3_000_000 + 80_000),
      sha256: docSha(),
      uploadedByUserId: pick([complianceUserId, analystUserId, coverageUserId]),
      isConfidential: chance(0.45),
      isMnpi: chance(0.15),
      barrierId: pid ? (barrierByParty.get(pid) ?? null) : null,
      retentionUntil: ymd(new Date(2029 + Math.floor(rnd() * 4), Math.floor(rnd() * 12), 1)),
    });
  }
  await chunkedInsert(documentTable, docRows as any, undefined, 500);
  console.log(`  document: ${docRows.length}`);

  // ----- audit_log (~160, varied ops + entities + actors + hash chain) -----
  // INSERT-only table; the audit_log_chain BEFORE-INSERT trigger (SECURITY
  // DEFINER, owned by postgres) auto-populates prev_hash→row_hash, so the seed
  // does NOT set those columns. audit_op enum is insert/update/delete/merge/
  // approve/reject - there is no `view`/`export` value, so those conceptual
  // actions are represented as `merge`/approve/reject + entity context. oldValue
  // is set for update/delete; correlationId ties multi-row merge groups; a
  // barrier_id is attached to ~15% of rows on walled entities.
  const auditActors = [
    { userId: adminUserId, role: "admin" },
    { userId: coverageUserId, role: "coverage_rm" },
    { userId: analystUserId, role: "credit_analyst" },
    { userId: complianceUserId, role: "compliance" },
    { userId: traderUserId, role: "trader" },
    { userId: appUserByEmail.get("rajesh@binarycapital.in")!, role: "partner" },
  ];
  const auditEntityPools: { entity: string; id: () => string }[] = [
    { entity: "party", id: () => pick(partyIds) },
    { entity: "deal", id: () => pick(dealIds) },
    { entity: "credit_analysis", id: () => pick(caIds) },
    { entity: "kyc_record", id: () => pick(insertedKyc).kycRecordId },
    { entity: "consent_record", id: () => pick(insertedConsents).consentRecordId },
    { entity: "data_subject_request", id: () => crypto.randomUUID() },
    { entity: "user_role", id: () => crypto.randomUUID() },
    { entity: "financial_model", id: () => (fmIds.length ? pick(fmIds) : crypto.randomUUID()) },
    { entity: "allocation_event", id: () => crypto.randomUUID() },
    { entity: "trade_event", id: () => crypto.randomUUID() },
    { entity: "document", id: () => crypto.randomUUID() },
    { entity: "task", id: () => pick(insertedTasks).taskId },
    { entity: "interaction", id: () => pick(interIds) },
    { entity: "scorecard", id: () => pick(insertedSC).scorecardId },
    { entity: "exposure", id: () => crypto.randomUUID() },
    { entity: "credit_limit", id: () => crypto.randomUUID() },
    { entity: "external_rating", id: () => crypto.randomUUID() },
  ];
  const opsByEntity: Record<string, readonly ("insert" | "update" | "delete" | "merge" | "approve" | "reject")[]> = {
    party: ["insert", "update", "update", "merge", "delete"],
    deal: ["insert", "update", "update", "approve", "reject", "delete"],
    credit_analysis: ["insert", "update", "approve", "reject"],
    kyc_record: ["insert", "update", "approve", "reject", "approve"],
    consent_record: ["insert", "update", "reject", "delete"],
    data_subject_request: ["insert", "update", "approve", "reject"],
    user_role: ["insert", "update", "delete"],
    financial_model: ["insert", "update", "approve"],
    allocation_event: ["insert"],
    trade_event: ["insert"],
    document: ["insert", "update", "delete"],
    task: ["insert", "update", "delete"],
    interaction: ["insert", "update", "delete"],
    scorecard: ["insert", "update", "approve"],
    exposure: ["insert", "update"],
    credit_limit: ["insert", "update", "approve"],
    external_rating: ["insert", "update"],
  };
  const actorForOp = (op: string) =>
    op === "approve" ? pick([auditActors[0]!, auditActors[2]!, auditActors[3]!, auditActors[5]!])
    : op === "reject" ? pick([auditActors[3]!, auditActors[0]!, auditActors[2]!])
    : op === "merge" ? pick([auditActors[0]!, auditActors[1]!])
    : op === "delete" ? pick([auditActors[0]!, auditActors[1]!, auditActors[3]!])
    : pick(auditActors);
  const partyBarrierIds = Array.from(barrierByParty.values());
  const dealBarrierIds = Array.from(dealBarrierByDeal.values());
  const allBarrierIds = [...partyBarrierIds, ...dealBarrierIds];
  const auditRows: typeof auditLog.$inferInsert[] = [];
  const N_AUDIT = 160 * SCALE;
  for (let i = 0; i < N_AUDIT; i++) {
    const spec = pick(auditEntityPools);
    const op = pick(opsByEntity[spec.entity] ?? ["insert", "update"]);
    const actor = actorForOp(op);
    const occurredAt = recentDate(90);
    const hasOld = op === "update" || op === "delete";
    const field = op === "update" && chance(0.4) ? pick(["status", "kyc_status", "rating", "limit_amount", "deal_code", "barrier_id", "valid_until"]) : null;
    auditRows.push({
      entityType: spec.entity,
      entityId: spec.id(),
      fieldName: field,
      oldValue: hasOld ? { before: pick(["draft", "pending", "in_review", "lead", "mandated"]), ts: occurredAt.toISOString() } : null,
      newValue: { op, entity: spec.entity, after: op === "insert" ? "created" : op === "approve" ? "approved" : op === "reject" ? "rejected" : op === "merge" ? "merged" : "updated", ...(field ? { field } : {}) },
      operation: op as any,
      actorUserId: actor.userId,
      actorRoleAtTime: actor.role,
      barrierId: allBarrierIds.length && chance(0.15) ? pick(allBarrierIds) : null,
      occurredAt,
      ipAddress: `10.0.${Math.floor(rnd() * 255)}.${Math.floor(rnd() * 255)}`,
      userAgent: pick([
        "Mozilla/5.0 (Macintosh) binary-crm-web/0.1",
        "Mozilla/5.0 (X11; Linux) binary-crm-web/0.1",
        "Mozilla/5.0 (iPhone) binary-crm-web/0.1",
      ]),
      correlationId: null,
    });
  }
  // A handful of party-merge groups: 2-3 rows sharing a correlationId.
  const nMergeGroups = 4;
  for (let g = 0; g < nMergeGroups; g++) {
    const corr = crypto.randomUUID();
    const nRows = 2 + Math.floor(rnd() * 2);
    const actor = pick([auditActors[0]!, auditActors[1]!]);
    for (let r = 0; r < nRows; r++) {
      const occurredAt = recentDate(60);
      auditRows.push({
        entityType: "party",
        entityId: pick(partyIds),
        operation: "merge" as any,
        actorUserId: actor.userId,
        actorRoleAtTime: actor.role,
        occurredAt,
        ipAddress: `10.0.${Math.floor(rnd() * 255)}.${Math.floor(rnd() * 255)}`,
        userAgent: "Mozilla/5.0 (Macintosh) binary-crm-web/0.1",
        newValue: { op: "merge", surviving: r === 0, mergedInto: pick(partyIds) },
        correlationId: corr,
      });
    }
  }
  // Insert audit rows in chronological (occurred_at ASC) order so the
  // audit_log_chain BEFORE-INSERT trigger - which selects the prior row as
  // `ORDER BY occurred_at DESC, audit_log_id DESC LIMIT 1` - chains each new
  // row's prev_hash to the chronologically-preceding row's row_hash. The rows
  // above were generated with random `recentDate(...)` occurred_at values, so
  // bulk-inserting in array order would chain them in insertion order instead
  // of chronological order, and the tamper-evidence viewer (which verifies
  // prev_hash === prior row's row_hash in occurred_at order) would flag nearly
  // every row as a broken link. Sorting first yields a clean, chronologically
  // linked hash chain. occurred_at values are distinct (deterministic PRNG),
  // so the audit_log_id tiebreak in the trigger never changes the ordering.
  auditRows.sort(
    (a, b) =>
      (a.occurredAt as Date).getTime() - (b.occurredAt as Date).getTime(),
  );
  await chunkedInsert(auditLog, auditRows as any, undefined, 500);
  console.log(`  audit_log: ${auditRows.length} (hash chain auto-populated by trigger, chronological order)`);

  // ----- link app_user.employee_party_id to internal_staff parties (raw SQL; column not in Drizzle schema) -----
  // The live DB has app_user.auth_user_id + employee_party_id (FK→party) that the
  // Drizzle schema omits. Set employee_party_id for the staff app_users.
  const staffPartyIds = partySpecs
    .map((s, i) => (s.type === "internal_staff" ? partyIds[i]! : null))
    .filter((x): x is string => !!x);
  const staffAppUsers = APP_USER_SEED.map((u) => appUserByEmail.get(u.email)!);
  for (let i = 0; i < Math.min(staffAppUsers.length, staffPartyIds.length); i++) {
    await db.execute(
      sql`UPDATE app_user SET employee_party_id = ${staffPartyIds[i]} WHERE user_id = ${staffAppUsers[i]}`,
    );
  }

  // ==========================================================================
  // NOTIFICATION-TRIGGER DATA (Workflow / Notifications module)
  // ==========================================================================
  // generateNotifications (features/workflow/engine.ts) scans five tables for
  // seven trigger conditions. The KYC + consent blocks above already produce
  // re-KYC-due / re-KYC-expired + consent-withdrawn alerts. Three remaining
  // triggers are NOT produced by the base seed, so without this block the
  // Notifications center + bell would only ever show KYC + consent alerts:
  //   • deal-stuck        - non-terminal mandates idle > 14d (engine keys on
  //                         deal.updated_at < now()-14d). Base deals default
  //                         updated_at=now() at insert → every mandate reads
  //                         "updated today". Backdate ~30 non-terminal deals.
  //   • credit-committee  - current analyses (valid_to/superseded_by/deleted_at
  //     pending           IS NULL) with internal_rating_action NULL, updated >5d
  //                         ago. Base analyses all set internal_rating_action.
  //                         Null + backdate ~15 analyses.
  //   • task-overdue      - open tasks past due_date (engine: due_date < today,
  //                         status not in completed/cancelled). Base open tasks
  //                         have FUTURE due dates → none are overdue. Pull ~20
  //                         open tasks' due dates into the past.
  console.log("Seeding notification-trigger data (deal-stuck / credit-pending / task-overdue)...");
  {
    const stuckDealIds = dealIds.filter((_, i) => {
      const st = (dealRows[i] as any).status as string;
      return st !== "closed" && st !== "dropped";
    });
    const stuckPicks = pickN(stuckDealIds, Math.min(30 * SCALE, stuckDealIds.length));
    for (const did of stuckPicks) {
      const idleDays = 15 + Math.floor(rnd() * 45);
      await db.execute(
        sql`UPDATE deal SET updated_at = now() - (${idleDays} * interval '1 day') WHERE deal_id = ${did} AND deleted_at IS NULL`,
      );
    }
    console.log(`  deal-stuck triggers: backdated ${stuckPicks.length} non-terminal deals (updated_at 15-59d ago)`);

    const caPickIds = pickN(caIds, Math.min(15 * SCALE, caIds.length));
    for (const caId of caPickIds) {
      const idleDays = 6 + Math.floor(rnd() * 24);
      await db.execute(
        sql`UPDATE credit_analysis SET internal_rating_action = NULL, updated_at = now() - (${idleDays} * interval '1 day') WHERE credit_analysis_id = ${caId} AND deleted_at IS NULL`,
      );
    }
    console.log(`  credit-committee-pending triggers: nulled + backdated ${caPickIds.length} analyses (updated_at 6-29d ago)`);

    const openTasks = insertedTasks.filter(
      (t) => t.status === "pending" || t.status === "in_progress" || t.status === "deferred",
    );
    const overduePicks = pickN(openTasks.map((t) => t.taskId), Math.min(20 * SCALE, openTasks.length));
    for (const tid of overduePicks) {
      const pastDays = 1 + Math.floor(rnd() * 30);
      await db.execute(
        sql`UPDATE task SET due_date = (now() - (${pastDays} * interval '1 day'))::date WHERE task_id = ${tid} AND deleted_at IS NULL`,
      );
    }
    console.log(`  task-overdue triggers: moved ${overduePicks.length} open tasks' due dates 1-30d into the past`);
  }

  // ==========================================================================
  // LEADS (Lead & Opportunity Management - migration 0006)
  // ==========================================================================
  // ~50 prospect parties promoted into leads across the full funnel
  // (new → qualified → opportunity → won/lost), with varied sources
  // (referral/website/event/cold_call/existing_client), deal types, estimated
  // sizes (₹ Cr) and assigned RMs. Won leads are linked to EXISTING deals (the
  // BC- mandates seeded above) via lead_meta.convertedDealId so the lead→deal
  // conversion is demonstrated end-to-end without polluting the deal pipeline
  // with extra rows. lead_meta is a JSONB column on party (not modeled by the
  // Drizzle party schema) so it is written via raw SQL. A party is a lead iff
  // lead_meta IS NOT NULL.
  console.log("Generating leads (~500, 10x scale)...");
  {
    const LEAD_SOURCES: LeadSource[] = [
      "referral", "website", "event", "cold_call", "existing_client",
    ];
    const LEAD_DEAL_TYPES: LeadDealType[] = [
      "bond_underwriting", "high_yield_bond", "private_placement_debt",
      "gsec_auction", "structured_finance", "supply_chain_finance",
      "project_finance", "dcm_advisory", "rating_advisory", "m_and_a",
      "portfolio_management_mandate", "secondary_trading_advisory",
    ];
    const LEAD_LOSS_REASONS: LeadLossReason[] = [
      "pricing_uncompetitive", "competitor_selected", "deal_deferred",
      "client_withdrew", "failed_kyc", "no_budget", "lost_to_in_house", "other",
    ];
    const LEAD_CONTACT_TITLES = [
      "CFO", "Treasurer", "MD & CEO", "Vice President, Finance",
      "Head of Treasury", "Director", "Promoter", "Chief Investment Officer",
    ];
    const rmEmails = [
      "rati@binarycapital.in", "arjun@binarycapital.in",
      "shray@binarycapital.in", "rajesh@binarycapital.in",
    ];
    const leadRmIds = rmEmails
      .map((e) => appUserByEmail.get(e))
      .filter((x): x is string => !!x);

    const pickStage = (): LeadStage => {
      const r = rnd();
      if (r < 0.4) return "new";
      if (r < 0.62) return "qualified";
      if (r < 0.84) return "opportunity";
      if (r < 0.94) return "won";
      return "lost";
    };
    const pickBant = (stage: LeadStage) => {
      if (stage === "won" || stage === "opportunity" || stage === "qualified") {
        return { budget: true, authority: true, need: true, timeline: true };
      }
      if (stage === "lost") {
        return {
          budget: chance(0.4), authority: chance(0.5),
          need: chance(0.6), timeline: chance(0.3),
        };
      }
      return {
        budget: chance(0.45), authority: chance(0.4),
        need: chance(0.5), timeline: chance(0.3),
      };
    };
    const pickProbability = (stage: LeadStage): number => {
      switch (stage) {
        case "new": return 5 + Math.floor(rnd() * 16);
        case "qualified": return 25 + Math.floor(rnd() * 16);
        case "opportunity": return 45 + Math.floor(rnd() * 31);
        case "won": return 100;
        case "lost": return 0;
      }
    };
    const isoDaysFromNow = (days: number) => {
      const d = new Date(NOW.getTime() + days * DAY_MS);
      return d.toISOString();
    };
    const isoDaysAgo = (days: number) => {
      const d = new Date(NOW.getTime() - days * DAY_MS);
      return d.toISOString();
    };
    const ymdDaysFromNow = (days: number) => ymd(new Date(NOW.getTime() + days * DAY_MS));

    const N_LEADS = 50 * SCALE;
    const leadPartyRows: typeof party.$inferInsert[] = [];
    for (let i = 0; i < N_LEADS; i++) {
      const base = `${pick(COMPANY_PREFIX)} ${pick(COMPANY_SUFFIX)}`;
      const name = `${base} (Lead ${String(i + 1).padStart(2, "0")})`;
      leadPartyRows.push({
        legalName: `${name} Pvt Ltd`,
        displayName: base,
        partyNature: "organization",
        countryOfIncorporation: "IN",
        domicileState: pick(STATES),
        kycRiskRating: pick(["low", "medium", "high"]),
        status: "onboarding",
        brandOrigin: "binarybonds",
        source: "website_lead",
        createdByUserId: coverageUserId,
        createdAt: pastDate(10, 220),
        updatedAt: recentDate(30),
      });
    }
    const insertedLeadParties: { partyId: string }[] = await chunkedInsert<{ partyId: string }>(
      party,
      leadPartyRows as any,
      { partyId: party.partyId },
      500,
    );
    const leadPartyIds = insertedLeadParties.map((p) => p.partyId);

    // party_type_assignment = prospect for every lead party.
    const leadPtaRows: typeof partyTypeAssignment.$inferInsert[] = leadPartyIds.map((pid) => ({
      partyId: pid,
      partyType: "prospect" as any,
      assignedByUserId: adminUserId,
      confidence: round(0.7 + rnd() * 0.3, 2),
    }));
    await chunkedInsert(partyTypeAssignment, leadPtaRows as any, undefined, 1000);

    let wonLeads = 0, lostLeads = 0, openLeads = 0;
    for (let i = 0; i < leadPartyIds.length; i++) {
      const pid = leadPartyIds[i]!;
      const stage = pickStage();
      const source = pick(LEAD_SOURCES);
      const dealType = pick(LEAD_DEAL_TYPES);
      const estSizeCr = 25 + Math.floor(rnd() * 1975) + (chance(0.2) ? Math.floor(rnd() * 500) : 0);
      const probability = pickProbability(stage);
      const assignedRm = chance(0.85) && leadRmIds.length ? pick(leadRmIds) : null;

      let expectedClose: string | null = null;
      if (stage === "opportunity" || stage === "won") {
        expectedClose = ymdDaysFromNow(20 + Math.floor(rnd() * 220));
      } else if (stage === "qualified" && chance(0.5)) {
        expectedClose = ymdDaysFromNow(60 + Math.floor(rnd() * 240));
      } else if (stage === "new" && chance(0.25)) {
        expectedClose = ymdDaysFromNow(120 + Math.floor(rnd() * 245));
      }

      let closedAt: string | null = null;
      if (stage === "won" || stage === "lost") {
        closedAt = isoDaysAgo(5 + Math.floor(rnd() * 170));
      }

      // Won leads → link to an EXISTING deal (the BC- mandates above).
      let convertedDealId: string | null = null;
      if (stage === "won" && dealIds.length) {
        convertedDealId = pick(dealIds);
        wonLeads++;
      } else if (stage === "lost") {
        lostLeads++;
      } else {
        openLeads++;
      }

      const contactFirst = pick(FIRST_NAMES);
      const contactLast = pick(LAST_NAMES);
      const contactName = `${contactFirst} ${contactLast}`;
      const meta: LeadMeta = {
        stage,
        source,
        dealType,
        estSizeCr,
        probability,
        expectedClose,
        assignedRm,
        contactName,
        contactTitle: pick(LEAD_CONTACT_TITLES),
        contactEmail: `${contactFirst.toLowerCase()}.${contactLast.toLowerCase()}.l${i + 1}@${pick(["gmail.com", "outlook.com", "corp.in"])}`,
        contactPhone: `+91${7000000000 + Math.floor(rnd() * 2999999999)}`,
        bant: pickBant(stage),
        notes:
          stage === "new"
            ? "Initial conversation: qualify on BANT and confirm the financing need."
            : stage === "lost"
              ? `Closed lost: ${pick(LEAD_LOSS_REASONS).replace(/_/g, " ")}.`
              : chance(0.5)
                ? "Active dialogue: next step is a mandate letter."
                : null,
        lossReason: stage === "lost" ? pick(LEAD_LOSS_REASONS) : null,
        convertedDealId,
        closedAt,
        createdAt: isoDaysAgo(10 + Math.floor(rnd() * 210)),
        updatedAt: isoDaysAgo(Math.floor(rnd() * 30)),
      };
      await db.execute(
        sql`UPDATE party SET lead_meta = ${JSON.stringify(meta)}::jsonb, updated_at = now() WHERE party_id = ${pid}`,
      );
    }
    console.log(
      `  leads: ${leadPartyIds.length} (open=${openLeads} won=${wonLeads} lost=${lostLeads}); won leads linked to existing deals via lead_meta.convertedDealId`,
    );
  }

  // ==========================================================================
  // ONBOARDING (Client Onboarding - migration 0007)
  // ==========================================================================
  // 300 prospect parties created fresh and promoted across the full funnel
  // (initiated → profile_created → documents_collected → kyc_verified →
  // compliance_approved → active), each with a 7-document checklist at a
  // stage-appropriate completion state, a linked kyc_record (approved for
  // kyc_verified+), filed document rows for uploaded checklist items, and
  // backdated stageHistory so the SLA clocks show a realistic mix of on-track
  // / due-soon / overdue. onboarding_meta is a JSONB column on party (not
  // modeled by the Drizzle party schema) so it is written via raw SQL. A party
  // is an onboarding case iff onboarding_meta IS NOT NULL. Scaled 10x (30 →
  // 300): the first 30 keep the hand-crafted realistic names; the remaining 270
  // are generated from the COMPANY_PREFIX/SUFFIX vocabulary with a monotonic
  // suffix so the party_legal_name_country_uidx never trips.
  console.log("Generating onboarding cases (300, 10x scale)...");
  {
    const ONB_STATES = [
      "Maharashtra", "Gujarat", "Karnataka", "Tamil Nadu", "Telangana",
      "Delhi", "Rajasthan", "West Bengal",
    ];
    const ONB_CITIES = [
      "Mumbai", "Ahmedabad", "Bengaluru", "Chennai", "Hyderabad",
      "New Delhi", "Pune", "Kolkata",
    ];
    const ONB_CONTACT_TITLES = [
      "CFO", "Treasurer", "MD & CEO", "Vice President, Finance",
      "Head of Treasury", "Director", "Promoter", "Company Secretary",
    ];
    // 30 fixed, realistic Indian company names - distinctive so they never
    // collide with the generated prospect names above. The main-seed TRUNCATE
    // wipes them on re-run, so no clean step is needed. At 10x scale the
    // remaining 270 are generated below from the shared prefix/suffix
    // vocabulary with a monotonic counter so legal_name stays unique.
    const ONB_COMPANIES_BASE: { name: string; type: OnboardingClientType }[] = [
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
      { name: "Ori Tea Estates Pvt Ltd", type: "issuer" },
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
      { name: "Girnar Wealth Advisors Pvt Ltd", type: "ifa" },
      { name: "Sahyadri Wind Energy Ltd", type: "issuer" },
    ];
    // Generate the additional (SCALE-1) × 30 onboarding cases from the shared
    // COMPANY_PREFIX/SUFFIX vocabulary. The ` Onb ${n}` infix guarantees
    // legal_name uniqueness vs the main party block (which appends a bare
    // 3-digit sequence) and vs the lead parties (which use `(Lead N)`).
    const ONB_GEN_TYPES: OnboardingClientType[] = [
      "issuer", "spv", "vendor", "intermediary", "ifa",
    ];
    const ONB_COMPANIES_GEN: { name: string; type: OnboardingClientType }[] = [];
    for (let i = 0; i < 30 * (SCALE - 1); i++) {
      const prefix = COMPANY_PREFIX[i % COMPANY_PREFIX.length]!;
      const suffix = COMPANY_SUFFIX[(i * 7 + 3) % COMPANY_SUFFIX.length]!;
      ONB_COMPANIES_GEN.push({
        name: `${prefix} ${suffix} Onb ${i + 1} Ltd`,
        type: ONB_GEN_TYPES[i % ONB_GEN_TYPES.length]!,
      });
    }
    const ONB_COMPANIES = [...ONB_COMPANIES_BASE, ...ONB_COMPANIES_GEN];

    const rmEmails = [
      "rati@binarycapital.in", "arjun@binarycapital.in",
      "shray@binarycapital.in", "rajesh@binarycapital.in",
      "neha@binarycapital.in",
    ];
    const onbRmIds = rmEmails
      .map((e) => appUserByEmail.get(e))
      .filter((x): x is string => !!x);
    const onbComplianceUserId =
      appUserByEmail.get("neha@binarycapital.in") ?? complianceUserId;

    const pickOnbStage = (): OnboardingStage => {
      const r = rnd();
      if (r < 0.1) return "initiated";
      if (r < 0.31) return "profile_created";
      if (r < 0.6) return "documents_collected";
      if (r < 0.79) return "kyc_verified";
      if (r < 0.9) return "compliance_approved";
      return "active";
    };
    const isoAgo = (days: number) =>
      new Date(NOW.getTime() - days * DAY_MS).toISOString();
    const isoAhead = (days: number) =>
      new Date(NOW.getTime() + days * DAY_MS).toISOString();

    const currentStageEnteredAt = (stage: OnboardingStage): string => {
      switch (stage) {
        case "initiated":
          return chance(0.5) ? isoAgo(2 + Math.floor(rnd() * 3)) : isoAgo(0);
        case "profile_created":
          return chance(0.4) ? isoAgo(4 + Math.floor(rnd() * 4))
            : chance(0.5) ? isoAgo(2) : isoAgo(0);
        case "documents_collected":
          return chance(0.4) ? isoAgo(9 + Math.floor(rnd() * 6))
            : chance(0.3) ? isoAgo(6) : isoAgo(1 + Math.floor(rnd() * 4));
        case "kyc_verified":
          return chance(0.4) ? isoAgo(3 + Math.floor(rnd() * 4))
            : chance(0.3) ? isoAgo(1) : isoAgo(0);
        case "compliance_approved":
          return chance(0.4) ? isoAgo(2 + Math.floor(rnd() * 3)) : isoAgo(0);
        case "active":
          return isoAgo(1 + Math.floor(rnd() * 30));
      }
    };
    const buildStageHistory = (
      stage: OnboardingStage,
      createdAtDaysAgo: number,
    ): { stage: OnboardingStage; enteredAt: string }[] => {
      const targetIdx = ONBOARDING_STAGE_ORDER.indexOf(stage);
      const history: { stage: OnboardingStage; enteredAt: string }[] = [];
      for (let i = 0; i <= targetIdx; i++) {
        const s = ONBOARDING_STAGE_ORDER[i]!;
        if (i < targetIdx) {
          const frac = targetIdx === 0 ? 0 : i / targetIdx;
          const day = Math.max(1, Math.round(createdAtDaysAgo * (1 - frac)));
          history.push({ stage: s, enteredAt: isoAgo(day) });
        } else {
          history.push({ stage: s, enteredAt: currentStageEnteredAt(s) });
        }
      }
      return history;
    };
    const buildChecklist = (stage: OnboardingStage): OnboardingDocItem[] => {
      return ONBOARDING_DOC_ORDER.map((key) => {
        let status: OnboardingDocItem["status"] = "pending";
        let verification: OnboardingDocItem["verification"] = "pending";
        if (stage === "initiated") {
          // nothing yet
        } else if (stage === "profile_created") {
          if (chance(0.3)) { status = "uploaded"; verification = "pending"; }
        } else if (stage === "documents_collected") {
          if (chance(0.85)) {
            status = "uploaded";
            const r = rnd();
            verification = r < 0.55 ? "verified" : r < 0.8 ? "pending" : "rejected";
          }
        } else {
          status = "uploaded";
          verification = "verified";
        }
        return {
          key,
          status,
          verification,
          documentId: null,
          uploadedAt: status === "uploaded" ? isoAgo(2 + Math.floor(rnd() * 38)) : null,
          verifiedAt: verification === "verified" ? isoAgo(1 + Math.floor(rnd() * 29)) : null,
          verifiedBy: null,
          rejectionReason:
            verification === "rejected" ? "Document illegible: request a clean scan." : null,
        } satisfies OnboardingDocItem;
      });
    };

    const onbCounts: Record<OnboardingStage, number> = {
      initiated: 0, profile_created: 0, documents_collected: 0,
      kyc_verified: 0, compliance_approved: 0, active: 0,
    };

    // Deterministic stage distribution across the 30 cases - guarantees every
    // stage is represented (a pure pickOnbStage() over the shared PRNG can land
    // an empty bucket for a 30-case set). Counts approximate the funnel shape:
    // wide middle, tapered ends. Built as a fixed list then Fisher–Yates
    // shuffled with the shared PRNG so the per-case stage is deterministic but
    // not clustered.
    const ONB_STAGE_PLAN: OnboardingStage[] = [
      ...Array<OnboardingStage>(3 * SCALE).fill("initiated"),
      ...Array<OnboardingStage>(5 * SCALE).fill("profile_created"),
      ...Array<OnboardingStage>(9 * SCALE).fill("documents_collected"),
      ...Array<OnboardingStage>(6 * SCALE).fill("kyc_verified"),
      ...Array<OnboardingStage>(4 * SCALE).fill("compliance_approved"),
      ...Array<OnboardingStage>(3 * SCALE).fill("active"),
    ];
    for (let i = ONB_STAGE_PLAN.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [ONB_STAGE_PLAN[i]!, ONB_STAGE_PLAN[j]!] = [ONB_STAGE_PLAN[j]!, ONB_STAGE_PLAN[i]!];
    }

    for (let onbIdx = 0; onbIdx < ONB_COMPANIES.length; onbIdx++) {
      const co = ONB_COMPANIES[onbIdx]!;
      const stage = ONB_STAGE_PLAN[onbIdx] ?? pickOnbStage();
      onbCounts[stage]++;
      const createdAtDaysAgo = 8 + Math.floor(rnd() * 52);
      const stageHistory = buildStageHistory(stage, createdAtDaysAgo);
      const checklist = buildChecklist(stage);
      const assignedRm = chance(0.9) && onbRmIds.length ? pick(onbRmIds) : null;
      const state = pick(ONB_STATES);
      const city = pick(ONB_CITIES);
      const contactName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      const creatorRm = assignedRm ?? onbRmIds[0] ?? coverageUserId;

      // Create the prospect party (status=active for active cases, else onboarding).
      const onbPartyRows: { partyId: string }[] = await db
        .insert(party)
        .values([
          {
            legalName: co.name,
            displayName: co.name,
            partyNature: "organization",
            countryOfIncorporation: "IN",
            domicileState: state,
            kycRiskRating: pick(["low", "medium", "medium", "high"]),
            status: stage === "active" ? "active" : "onboarding",
            brandOrigin: "binarybonds",
            source: "manual",
            createdByUserId: creatorRm,
            createdAt: pastDate(createdAtDaysAgo, 1),
            updatedAt: recentDate(3),
          },
        ])
        .returning({ partyId: party.partyId });
      const partyId = onbPartyRows[0]!.partyId;

      // party_type = prospect.
      await db.insert(partyTypeAssignment).values([
        {
          partyId,
          partyType: "prospect" as any,
          assignedByUserId: creatorRm,
          confidence: round(0.8 + rnd() * 0.2, 2),
        },
      ]);

      // File document rows for uploaded checklist items + stamp documentId +
      // verifiedBy. The ONBOARDING_SEED: fileName marker mirrors the standalone
      // onboarding seed so the documents page can identify them. Batched per
      // party (one INSERT returning all uploaded-doc IDs in input order) so the
      // 10x-scaled onboarding block does ~1 doc round trip per party instead of
      // up to 7 - keeps the 300-case loop well under the time budget.
      const uploadedDocs = checklist.filter((d) => d.status === "uploaded");
      if (uploadedDocs.length) {
        const docInputs = uploadedDocs.map((d) => ({
          partyId,
          documentType: ONBOARDING_DOC_TO_DOCUMENT_TYPE[d.key] as any,
          fileName: `ONBOARDING_SEED:${ONBOARDING_DOC_LABELS[d.key as OnboardingDocKey]}`,
          uploadedByUserId: creatorRm,
        }));
        const docRows: { documentId: string }[] = await db
          .insert(documentTable)
          .values(docInputs)
          .returning({ documentId: documentTable.documentId });
        uploadedDocs.forEach((d, j) => {
          d.documentId = docRows[j]?.documentId ?? null;
          if (d.verification === "verified") {
            d.verifiedBy = creatorRm;
          }
        });
      }

      // Raise + link a kyc_record for kyc_verified onward (approved for those
      // stages; pending for a documents_collected case with all docs verified).
      let kycRecordId: string | null = null;
      if (stage === "kyc_verified" || stage === "compliance_approved" || stage === "active") {
        const kycRows: { kycRecordId: string }[] = await db
          .insert(kycRecord)
          .values([
            {
              partyId,
              kycType: "CDD",
              status: "approved",
              riskRating: pick(["low", "medium", "medium", "high"]),
              cddDoneAt: new Date(isoAgo(10 + Math.floor(rnd() * 30))),
              approvedAt: new Date(isoAgo(8 + Math.floor(rnd() * 30))),
              validUntil: ymd(new Date(NOW.getTime() + (300 + Math.floor(rnd() * 3200)) * DAY_MS)),
              approvedByUserId: onbComplianceUserId,
              eddReason: "ONBOARDING_SEED",
            },
          ])
          .returning({ kycRecordId: kycRecord.kycRecordId });
        kycRecordId = kycRows[0]?.kycRecordId ?? null;
      } else if (
        stage === "documents_collected" &&
        checklist.every((d) => d.verification === "verified")
      ) {
        const kycRows: { kycRecordId: string }[] = await db
          .insert(kycRecord)
          .values([
            {
              partyId,
              kycType: "CDD",
              status: "in_review",
              riskRating: "medium",
              eddReason: "ONBOARDING_SEED",
            },
          ])
          .returning({ kycRecordId: kycRecord.kycRecordId });
        kycRecordId = kycRows[0]?.kycRecordId ?? null;
      }

      // Compliance stamps for compliance_approved + active.
      const complianceApprovedBy =
        stage === "compliance_approved" || stage === "active" ? onbComplianceUserId : null;
      const complianceApprovedAt =
        stage === "compliance_approved" || stage === "active"
          ? (stageHistory.find((h) => h.stage === "compliance_approved")?.enteredAt ?? isoAgo(1))
          : null;
      const complianceRejectedBy =
        stage === "kyc_verified" && chance(0.25) ? onbComplianceUserId : null;
      const complianceRejectedAt =
        complianceRejectedBy != null ? isoAgo(1 + Math.floor(rnd() * 3)) : null;
      const complianceNote = complianceRejectedBy
        ? "Beneficial ownership declaration incomplete: re-submit with the full ownership chain."
        : stage === "compliance_approved" || stage === "active"
          ? "Cleared. Identity, ownership and source-of-funds verified."
          : null;

      const meta: OnboardingMeta = {
        stage,
        clientType: co.type,
        assignedRm,
        contactName,
        contactTitle: pick(ONB_CONTACT_TITLES),
        contactEmail: `${contactName.toLowerCase().replace(/\s+/g, ".")}.o@${pick(["gmail.com", "outlook.com", "corp.in"])}`,
        contactPhone: `+91${7000000000 + Math.floor(rnd() * 2999999999)}`,
        pan: `${String.fromCharCode(65 + Math.floor(rnd() * 26))}${String.fromCharCode(65 + Math.floor(rnd() * 26))}${String.fromCharCode(65 + Math.floor(rnd() * 26))}${String.fromCharCode(65 + Math.floor(rnd() * 26))}${String.fromCharCode(65 + Math.floor(rnd() * 26))}${1000 + Math.floor(rnd() * 8999)}${String.fromCharCode(65 + Math.floor(rnd() * 26))}`,
        cin: chance(0.7) ? `U${10000 + Math.floor(rnd() * 89999)}MH${2014 + Math.floor(rnd() * 11)}PTC${10000 + Math.floor(rnd() * 89999)}` : null,
        gstin: chance(0.8) ? `27${String.fromCharCode(65 + Math.floor(rnd() * 26))}${String.fromCharCode(65 + Math.floor(rnd() * 26))}${String.fromCharCode(65 + Math.floor(rnd() * 26))}${String.fromCharCode(65 + Math.floor(rnd() * 26))}${String.fromCharCode(65 + Math.floor(rnd() * 26))}${1000 + Math.floor(rnd() * 8999)}${String.fromCharCode(65 + Math.floor(rnd() * 26))}${Math.floor(rnd() * 10)}Z${Math.floor(rnd() * 10)}` : null,
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
        createdAt: isoAgo(createdAtDaysAgo),
        updatedAt: isoAgo(Math.floor(rnd() * 3)),
      };
      await db.execute(
        sql`UPDATE party SET onboarding_meta = ${JSON.stringify(meta)}::jsonb, updated_at = now() WHERE party_id = ${partyId}`,
      );
    }
    console.log(
      `  onboarding: ${ONB_COMPANIES.length} cases - ` +
        ONBOARDING_STAGE_ORDER.map((s) => `${s}=${onbCounts[s]}`).join(", "),
    );
  }

  console.log(`Seed complete in ${Date.now() - startedAt}ms.`);
}

main()
  .then(async () => {
    console.log("Verifying row counts...");
    // RLS is lifted for the whole run (see main), so `crm` can read every
    // table here, including audit_log (which has no SELECT policy under RLS).
    const counts: any = await db.execute(sql`
      SELECT 'sector_code' AS tbl, count(*)::int AS n FROM sector_code UNION ALL
      SELECT 'role', count(*)::int FROM role UNION ALL
      SELECT 'permission', count(*)::int FROM permission UNION ALL
      SELECT 'role_permission', count(*)::int FROM role_permission UNION ALL
      SELECT 'app_user', count(*)::int FROM app_user UNION ALL
      SELECT 'user_role', count(*)::int FROM user_role UNION ALL
      SELECT 'users', count(*)::int FROM users UNION ALL
      SELECT 'information_barrier', count(*)::int FROM information_barrier UNION ALL
      SELECT 'party', count(*)::int FROM party UNION ALL
      SELECT 'party_type_assignment', count(*)::int FROM party_type_assignment UNION ALL
      SELECT 'party_identifier', count(*)::int FROM party_identifier UNION ALL
      SELECT 'address', count(*)::int FROM address UNION ALL
      SELECT 'contact', count(*)::int FROM contact UNION ALL
      SELECT 'party_contact', count(*)::int FROM party_contact UNION ALL
      SELECT 'relationship', count(*)::int FROM relationship UNION ALL
      SELECT 'demat_account', count(*)::int FROM demat_account UNION ALL
      SELECT 'instrument', count(*)::int FROM instrument UNION ALL
      SELECT 'deal', count(*)::int FROM deal UNION ALL
      SELECT 'deal_party', count(*)::int FROM deal_party UNION ALL
      SELECT 'allocation_event', count(*)::int FROM allocation_event UNION ALL
      SELECT 'trade_event', count(*)::int FROM trade_event UNION ALL
      SELECT 'credit_analysis', count(*)::int FROM credit_analysis UNION ALL
      SELECT 'financial_statement', count(*)::int FROM financial_statement UNION ALL
      SELECT 'credit_analysis_fs_link', count(*)::int FROM credit_analysis_fs_link UNION ALL
      SELECT 'ratio_result', count(*)::int FROM ratio_result UNION ALL
      SELECT 'scorecard_template', count(*)::int FROM scorecard_template UNION ALL
      SELECT 'scorecard', count(*)::int FROM scorecard UNION ALL
      SELECT 'credit_score', count(*)::int FROM credit_score UNION ALL
      SELECT 'external_rating', count(*)::int FROM external_rating UNION ALL
      SELECT 'rating_ladder', count(*)::int FROM rating_ladder UNION ALL
      SELECT 'exposure', count(*)::int FROM exposure UNION ALL
      SELECT 'credit_limit', count(*)::int FROM credit_limit UNION ALL
      SELECT 'kyc_record', count(*)::int FROM kyc_record UNION ALL
      SELECT 'kyc_beneficial_owner', count(*)::int FROM kyc_beneficial_owner UNION ALL
      SELECT 'consent_record', count(*)::int FROM consent_record UNION ALL
      SELECT 'data_subject_request', count(*)::int FROM data_subject_request UNION ALL
      SELECT 'interaction', count(*)::int FROM interaction UNION ALL
      SELECT 'interaction_attendee', count(*)::int FROM interaction_attendee UNION ALL
      SELECT 'task', count(*)::int FROM task UNION ALL
      SELECT 'task_dependency', count(*)::int FROM task_dependency UNION ALL
      SELECT 'document', count(*)::int FROM document UNION ALL
      SELECT 'financial_model', count(*)::int FROM financial_model UNION ALL
      SELECT 'audit_log', count(*)::int FROM audit_log
      ORDER BY 1
    `);
    const rows: { tbl: string; n: number }[] = counts.rows ?? counts ?? [];
    for (const r of rows) {
      console.log(`  ${r.tbl.padEnd(28)} ${r.n}`);
    }
    // Audit-chain sanity: confirm the trigger populated prev_hash→row_hash.
    const chain: any = await db.execute(sql`
      SELECT count(*)::int AS rows,
             count(prev_hash)::int AS with_prev,
             count(row_hash)::int AS with_row,
             count(*) FILTER (WHERE row_hash IS NOT NULL AND prev_hash IS NOT NULL AND prev_hash <> '')::int AS chained
      FROM audit_log`);
    const c = (chain.rows ?? chain)?.[0] ?? {};
    console.log(
      `  audit chain: ${c.rows ?? 0} rows, ${c.with_prev ?? 0} prev_hash, ${c.with_row ?? 0} row_hash, ${c.chained ?? 0} chained`,
    );
    // Restore FORCE RLS on the 16 operational tables (policies were preserved).
    for (const t of RLS_TABLES) {
      await db.execute(sql.raw(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`));
      await db.execute(sql.raw(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY`));
    }
    console.log("RLS restored on 16 operational tables. Done.");
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    // Best-effort: restore FORCE RLS so a mid-seed failure does not leave the
    // operational tables unprotected. db may be undefined if the import failed.
    try {
      if (db) {
        for (const t of RLS_TABLES) {
          await db.execute(sql.raw(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`));
          await db.execute(sql.raw(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY`));
        }
        await db.execute(
          sql`ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_update_delete`,
        );
        console.error("RLS + audit trigger restored after failure.");
      }
    } catch {
      /* ignore - best-effort cleanup */
    }
    process.exit(1);
  });
