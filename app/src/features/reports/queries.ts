// Server-side report data access for the Reports & Export module.
//
// These are READ-ONLY aggregate queries that power the four detail report
// pages (pipeline, revenue, credit, compliance) and the CSV export route.
// Where possible they reuse the existing feature query shapes; the aggregates
// themselves are raw SQL (group-by + jsonb extraction) executed via `db.execute`
// - the same pattern as `getDealPipeline` - because Drizzle's query builder is
// clumsier than SQL for GROUP BY + window + jsonb arrow extraction.
//
// All functions are safe to call from Server Components and the export Route
// Handler. They run plain SELECTs (RLS GUCs are no-ops on tables without
// policies enabled yet). Every numeric column from postgres-js comes back as a
// string for `numeric`/`text` casts and a number for `::int` casts; the mappers
// below coerce to plain JSON numbers so the payloads are serializable across
// the RSC boundary and into CSV rows.

import { sql } from "drizzle-orm";

import { db } from "@/db";
import {
  appUser,
  auditLog,
  consentRecord,
  creditAnalysis,
  deal,
  exposure,
  kycRecord,
  party,
  scorecard,
} from "@/db/schema";
import { can, type CrmUser } from "@/lib/rbac";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Coerce a postgres-js numeric/string/Date cell to a number, defaulting to 0
 *  for null/empty so chart + CSV mappers never feed NaN into a formatter. */
function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Coerce to string | null for display columns (legal names, codes, emails). */
function str(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

/** Normalize a deal_type / status / purpose snake_case enum to a display string. */
function titleizeEnum(v: string | null): string {
  if (!v) return "-";
  return v
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Build a parameterized SQL `IN (...)` list fragment from a string array.
 *  Drizzle binds each value as a separate parameter, so this is injection-safe
 *  for the static enum lists used across the report queries. */
const inList = (vals: readonly string[]) =>
  sql`(${sql.join(
    vals.map((s) => sql`${s}`),
    sql`, `,
  )})`;

function isAdminOrManager(user?: Pick<CrmUser, "roles" | "permissions"> | null) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "manage", "user")
  );
}

function canReadAllReportDeals(user?: Pick<CrmUser, "roles" | "permissions"> | null) {
  return (
    isAdminOrManager(user) ||
    can(user, "read_all", "report") ||
    can(user, "read_all", "deal") ||
    can(user, "read_all", "party")
  );
}

function canReadAllReportCredit(user?: Pick<CrmUser, "roles" | "permissions"> | null) {
  return (
    isAdminOrManager(user) ||
    can(user, "read_all", "report") ||
    can(user, "read_all", "credit") ||
    can(user, "read_all", "party")
  );
}

function canReadAllReportCompliance(user?: Pick<CrmUser, "roles" | "permissions"> | null) {
  return (
    isAdminOrManager(user) ||
    can(user, "read_all", "report") ||
    can(user, "read_all", "compliance") ||
    can(user, "read_all", "kyc") ||
    can(user, "read_all", "consent")
  );
}

function scopedDealClause(user?: CrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllReportDeals(user) || !userId) return sql`true`;
  return sql`(
    ${deal.leadUserId} = ${userId}
    OR ${deal.creditAnalystUserId} = ${userId}
    OR ${deal.createdByUserId} = ${userId}
    OR EXISTS (
      SELECT 1
      FROM deal_party dp_scope
      JOIN party p_scope ON p_scope.party_id = dp_scope.party_id
      WHERE dp_scope.deal_id = ${deal.dealId}
        AND dp_scope.deleted_at IS NULL
        AND p_scope.deleted_at IS NULL
        AND (
          p_scope.assigned_user_id = ${userId}
          OR p_scope.data_owner_user_id = ${userId}
          OR p_scope.created_by_user_id = ${userId}
        )
    )
  )`;
}

function scopedCreditClause(user?: CrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllReportCredit(user) || !userId) return sql`true`;
  return sql`(
    ${creditAnalysis.createdByUserId} = ${userId}
    OR ${creditAnalysis.updatedByUserId} = ${userId}
    OR ${party.assignedUserId} = ${userId}
    OR ${party.dataOwnerUserId} = ${userId}
    OR ${party.createdByUserId} = ${userId}
  )`;
}

function scopedKycClause(user?: CrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllReportCompliance(user) || !userId) return sql`true`;
  return sql`EXISTS (
    SELECT 1
    FROM party p_scope
    WHERE p_scope.party_id = ${kycRecord.partyId}
      AND p_scope.deleted_at IS NULL
      AND (
        p_scope.assigned_user_id = ${userId}
        OR p_scope.data_owner_user_id = ${userId}
        OR p_scope.created_by_user_id = ${userId}
      )
  )`;
}

function scopedConsentClause(user?: CrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllReportCompliance(user) || !userId) return sql`true`;
  return sql`(
    EXISTS (
      SELECT 1
      FROM party p_scope
      WHERE p_scope.party_id = ${consentRecord.partyId}
        AND p_scope.deleted_at IS NULL
        AND (
          p_scope.assigned_user_id = ${userId}
          OR p_scope.data_owner_user_id = ${userId}
          OR p_scope.created_by_user_id = ${userId}
        )
    )
    OR EXISTS (
      SELECT 1
      FROM party_contact pc_scope
      JOIN party p_scope ON p_scope.party_id = pc_scope.party_id
      WHERE pc_scope.contact_id = ${consentRecord.contactId}
        AND pc_scope.deleted_at IS NULL
        AND p_scope.deleted_at IS NULL
        AND (
          p_scope.assigned_user_id = ${userId}
          OR p_scope.data_owner_user_id = ${userId}
          OR p_scope.created_by_user_id = ${userId}
        )
    )
  )`;
}

// ---------------------------------------------------------------------------
// PIPELINE REPORT - deal pipeline by stage, by type, by RM (relationship
// manager = deal.lead_user_id → app_user.email). Includes target exposure
// (₹, sum of deal.target_size) + weighted exposure by stage.
// ---------------------------------------------------------------------------

/** Pipeline order for the 9 live-mandate + 2 off-pipeline statuses. */
export const PIPELINE_STAGE_ORDER = [
  "lead",
  "mandated",
  "in_dd",
  "structuring",
  "rating_marketing",
  "pricing",
  "allocation",
  "settled",
  "closed",
  "on_hold",
  "dropped",
] as const;

export interface PipelineByStageRow {
  status: string;
  statusLabel: string;
  dealCount: number;
  targetExposure: number;
  /** Average deal size in the stage (₹). */
  avgSize: number;
}

export interface PipelineByTypeRow {
  dealType: string;
  dealTypeLabel: string;
  dealCount: number;
  targetExposure: number;
}

export interface PipelineByRmRow {
  leadUserId: string | null;
  leadEmail: string | null;
  dealCount: number;
  targetExposure: number;
  /** Closed/settled count - the RM's hit rate numerator. */
  closedCount: number;
}

export interface PipelineReport {
  byStage: PipelineByStageRow[];
  byType: PipelineByTypeRow[];
  byRm: PipelineByRmRow[];
  totals: {
    dealCount: number;
    targetExposure: number;
    closedCount: number;
    openCount: number;
  };
}

type PipelineStageDbRow = {
  status: string | null;
  c: string;
  exposure: string | null;
};

type PipelineTypeDbRow = {
  deal_type: string;
  c: string;
  exposure: string | null;
};

type PipelineRmDbRow = {
  lead_user_id: string | null;
  email: string | null;
  c: string;
  exposure: string | null;
  closed_c: string;
};

/**
 * Pipeline report - three group-bys (stage, type, RM) over the non-deleted
 * deal book. Three round-trips; each is a single indexed GROUP BY. The
 * closed/open split uses the terminal trio (settled/closed/dropped) vs the
 * live-mandate set.
 */
export async function getPipelineReport(
  user?: CrmUser | null,
): Promise<PipelineReport> {
  const OPEN_STATUSES = [
    "lead",
    "mandated",
    "in_dd",
    "structuring",
    "rating_marketing",
    "pricing",
    "allocation",
    "on_hold",
  ];
  const CLOSED_STATUSES = ["settled", "closed"];

  const [stageRows, typeRows, rmRows] = await Promise.all([
    db.execute<PipelineStageDbRow>(sql`
      SELECT status, count(*)::text AS c,
             coalesce(sum(${deal.targetSize}), 0)::text AS exposure
      FROM ${deal}
      WHERE ${deal.deletedAt} IS NULL
        AND ${scopedDealClause(user)}
      GROUP BY status
      ORDER BY status
    `),
    db.execute<PipelineTypeDbRow>(sql`
      SELECT ${deal.dealType} AS deal_type, count(*)::text AS c,
             coalesce(sum(${deal.targetSize}), 0)::text AS exposure
      FROM ${deal}
      WHERE ${deal.deletedAt} IS NULL
        AND ${scopedDealClause(user)}
      GROUP BY ${deal.dealType}
      ORDER BY count(*) DESC
    `),
    db.execute<PipelineRmDbRow>(sql`
      SELECT ${deal.leadUserId} AS lead_user_id,
             ${appUser.email} AS email,
             count(*)::text AS c,
             coalesce(sum(${deal.targetSize}), 0)::text AS exposure,
             count(*) filter (where ${deal.status} in ${inList(CLOSED_STATUSES)})::text AS closed_c
      FROM ${deal}
      LEFT JOIN ${appUser} ON ${appUser.userId} = ${deal.leadUserId}
      WHERE ${deal.deletedAt} IS NULL
        AND ${scopedDealClause(user)}
      GROUP BY ${deal.leadUserId}, ${appUser.email}
      ORDER BY coalesce(sum(${deal.targetSize}), 0) DESC
    `),
  ]);

  const stageOrder = (s: string | null): number => {
    const idx = (PIPELINE_STAGE_ORDER as readonly string[]).indexOf(s ?? "");
    return idx === -1 ? 999 : idx;
  };

  const byStage: PipelineByStageRow[] = stageRows
    .map((r) => {
      const status = str(r.status) ?? "unknown";
      const dealCount = num(r.c);
      const targetExposure = num(r.exposure);
      return {
        status,
        statusLabel: titleizeEnum(status),
        dealCount,
        targetExposure,
        avgSize: dealCount > 0 ? targetExposure / dealCount : 0,
      };
    })
    .sort((a, b) => stageOrder(a.status) - stageOrder(b.status));

  const byType: PipelineByTypeRow[] = typeRows.map((r) => ({
    dealType: r.deal_type,
    dealTypeLabel: titleizeEnum(r.deal_type),
    dealCount: num(r.c),
    targetExposure: num(r.exposure),
  }));

  const byRm: PipelineByRmRow[] = rmRows.map((r) => ({
    leadUserId: str(r.lead_user_id),
    leadEmail: str(r.email),
    dealCount: num(r.c),
    targetExposure: num(r.exposure),
    closedCount: num(r.closed_c),
  }));

  const dealCount = byStage.reduce((a, r) => a + r.dealCount, 0);
  const targetExposure = byStage.reduce((a, r) => a + r.targetExposure, 0);
  const closedCount = byStage
    .filter((r) => CLOSED_STATUSES.includes(r.status))
    .reduce((a, r) => a + r.dealCount, 0);
  const openCount = byStage
    .filter((r) => OPEN_STATUSES.includes(r.status))
    .reduce((a, r) => a + r.dealCount, 0);

  return {
    byStage,
    byType,
    byRm,
    totals: { dealCount, targetExposure, closedCount, openCount },
  };
}

// ---------------------------------------------------------------------------
// REVENUE REPORT - fee revenue by deal, by month, by RM. Fees are derived
// from deal.fee_structure jsonb ({ upfront_bps, success_bps }) × target_size,
// the real-world IB model (upfront retainer + success fee, both in bps of
// deal size). Recognized revenue = closed/settled deals (fee earned on
// closing); pipeline/upfront fees = mandated-but-not-closed deals (retainer
// booked on mandate). Per BUSINESS_CONTEXT §2.2: "Fees are retainer, success
// fee, or a combination" - no percentages are disclosed, so the seed's bps
// range (upfront 20–100 bps, success 30–130 bps) is the modeled proxy.
// ---------------------------------------------------------------------------

export interface RevenueByDealRow {
  dealId: string;
  dealCode: string | null;
  dealName: string | null;
  dealType: string;
  status: string;
  leadEmail: string | null;
  actualCloseDate: string | null;
  targetSize: number;
  upfrontBps: number;
  successBps: number;
  /** Recognized fee (₹) = target_size × (upfront + success) / 10000. */
  fee: number;
  brand: string;
}

export interface RevenueByMonthRow {
  monthKey: string;
  /** "Mon YYYY" display label, e.g. "Sep 2025". */
  monthLabel: string;
  dealCount: number;
  revenue: number;
  targetSize: number;
}

export interface RevenueByRmRow {
  leadUserId: string | null;
  leadEmail: string | null;
  dealCount: number;
  revenue: number;
  /** Pipeline (unrecognized) upfront fees on this RM's open mandates. */
  pipelineFee: number;
}

export interface RevenueReport {
  byDeal: RevenueByDealRow[];
  byMonth: RevenueByMonthRow[];
  byRm: RevenueByRmRow[];
  totals: {
    recognizedRevenue: number;
    pipelineFee: number;
    closedDealCount: number;
    closedTargetSize: number;
    avgFeeBps: number;
  };
}

type RevenueDealDbRow = {
  deal_id: string;
  deal_code: string | null;
  deal_name: string | null;
  deal_type: string;
  status: string | null;
  email: string | null;
  actual_close_date: string | null;
  target_size: string | null;
  upfront_bps: string | null;
  success_bps: string | null;
  fee: string | null;
  brand: string;
};

type RevenueMonthDbRow = {
  month_key: string;
  c: string;
  revenue: string | null;
  exposure: string | null;
};

type RevenueRmDbRow = {
  lead_user_id: string | null;
  email: string | null;
  c: string;
  revenue: string | null;
  pipeline_fee: string | null;
};

/** Shared fee-expression: target_size × (upfront + success bps) / 10000. The
 *  jsonb arrow extraction returns text; ::numeric coerces; COALESCE handles
 *  deals with a null fee_structure (0 fee). */
const FEE_EXPR = sql`coalesce(${deal.targetSize}, 0)
  * (coalesce((${deal.feeStructure}->>'upfront_bps')::numeric, 0)
     + coalesce((${deal.feeStructure}->>'success_bps')::numeric, 0)) / 10000.0`;

const UPFRONT_FEE_EXPR = sql`coalesce(${deal.targetSize}, 0)
  * coalesce((${deal.feeStructure}->>'upfront_bps')::numeric, 0) / 10000.0`;

/**
 * Revenue report - recognized fees on closed/settled deals (by deal, by close
 * month, by RM) plus pipeline (upfront) fees on open mandates by RM. Four
 * round-trips: per-deal rows, per-month aggregate, per-RM recognized, per-RM
 * pipeline. The per-deal query is capped at 1000 rows (more than the seeded
 * ~270 closed deals) so a growing book still exports fully; the aggregates
 * are unbounded GROUP BYs.
 */
export async function getRevenueReport(
  user?: CrmUser | null,
): Promise<RevenueReport> {
  const CLOSED = ["settled", "closed"];
  const OPEN = [
    "mandated",
    "in_dd",
    "structuring",
    "rating_marketing",
    "pricing",
    "allocation",
    "on_hold",
  ];

  const [dealRows, monthRows, rmRows] = await Promise.all([
    db.execute<RevenueDealDbRow>(sql`
      SELECT ${deal.dealId} AS deal_id,
             ${deal.dealCode} AS deal_code,
             ${deal.dealName} AS deal_name,
             ${deal.dealType} AS deal_type,
             ${deal.status} AS status,
             ${appUser.email} AS email,
             ${deal.actualCloseDate} AS actual_close_date,
             ${deal.targetSize} AS target_size,
             coalesce((${deal.feeStructure}->>'upfront_bps')::numeric, 0)::text AS upfront_bps,
             coalesce((${deal.feeStructure}->>'success_bps')::numeric, 0)::text AS success_bps,
             (${FEE_EXPR})::text AS fee,
             ${deal.brand} AS brand
      FROM ${deal}
      LEFT JOIN ${appUser} ON ${appUser.userId} = ${deal.leadUserId}
      WHERE ${deal.deletedAt} IS NULL
        AND ${scopedDealClause(user)}
        AND ${deal.status} in ${inList(CLOSED)}
      ORDER BY ${deal.actualCloseDate} DESC NULLS LAST, ${deal.dealCode}
      LIMIT 1000
    `),
    db.execute<RevenueMonthDbRow>(sql`
      SELECT to_char(date_trunc('month', ${deal.actualCloseDate}), 'YYYY-MM') AS month_key,
             count(*)::text AS c,
             coalesce(sum(${FEE_EXPR}), 0)::text AS revenue,
             coalesce(sum(${deal.targetSize}), 0)::text AS exposure
      FROM ${deal}
      WHERE ${deal.deletedAt} IS NULL
        AND ${scopedDealClause(user)}
        AND ${deal.status} in ${inList(CLOSED)}
        AND ${deal.actualCloseDate} IS NOT NULL
      GROUP BY date_trunc('month', ${deal.actualCloseDate})
      ORDER BY date_trunc('month', ${deal.actualCloseDate})
    `),
    db.execute<RevenueRmDbRow>(sql`
      WITH recognized AS (
        SELECT ${deal.leadUserId} AS lead_user_id,
               coalesce(sum(${FEE_EXPR}), 0)::text AS revenue,
               count(*)::text AS c
        FROM ${deal}
        WHERE ${deal.deletedAt} IS NULL
          AND ${scopedDealClause(user)}
          AND ${deal.status} in ${inList(CLOSED)}
        GROUP BY ${deal.leadUserId}
      ),
      pipeline AS (
        SELECT ${deal.leadUserId} AS lead_user_id,
               coalesce(sum(${UPFRONT_FEE_EXPR}), 0)::text AS pipeline_fee
        FROM ${deal}
        WHERE ${deal.deletedAt} IS NULL
          AND ${scopedDealClause(user)}
          AND ${deal.status} in ${inList(OPEN)}
        GROUP BY ${deal.leadUserId}
      )
      SELECT r.lead_user_id,
             ${appUser.email} AS email,
             coalesce(r.c, '0') AS c,
             coalesce(r.revenue, '0') AS revenue,
             coalesce(p.pipeline_fee, '0') AS pipeline_fee
      FROM recognized r
      LEFT JOIN pipeline p ON p.lead_user_id = r.lead_user_id
      LEFT JOIN ${appUser} ON ${appUser.userId} = r.lead_user_id
      ORDER BY coalesce(r.revenue, '0')::numeric DESC
    `),
  ]);

  const byDeal: RevenueByDealRow[] = dealRows.map((r) => ({
    dealId: r.deal_id,
    dealCode: str(r.deal_code),
    dealName: str(r.deal_name),
    dealType: r.deal_type,
    status: str(r.status) ?? "closed",
    leadEmail: str(r.email),
    actualCloseDate: str(r.actual_close_date),
    targetSize: num(r.target_size),
    upfrontBps: num(r.upfront_bps),
    successBps: num(r.success_bps),
    fee: num(r.fee),
    brand: r.brand,
  }));

  const byMonth: RevenueByMonthRow[] = monthRows.map((r) => {
    const monthKey = r.month_key;
    const [y, m] = monthKey.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    const monthLabel = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata",
      month: "short",
      year: "numeric",
    });
    return {
      monthKey,
      monthLabel,
      dealCount: num(r.c),
      revenue: num(r.revenue),
      targetSize: num(r.exposure),
    };
  });

  const byRm: RevenueByRmRow[] = rmRows.map((r) => ({
    leadUserId: str(r.lead_user_id),
    leadEmail: str(r.email),
    dealCount: num(r.c),
    revenue: num(r.revenue),
    pipelineFee: num(r.pipeline_fee),
  }));

  const recognizedRevenue = byDeal.reduce((a, r) => a + r.fee, 0);
  const closedTargetSize = byDeal.reduce((a, r) => a + r.targetSize, 0);
  const avgFeeBps =
    closedTargetSize > 0
      ? (recognizedRevenue / closedTargetSize) * 10000
      : 0;

  return {
    byDeal,
    byMonth,
    byRm,
    totals: {
      recognizedRevenue,
      pipelineFee: byRm.reduce((a, r) => a + r.pipelineFee, 0),
      closedDealCount: byDeal.length,
      closedTargetSize,
      avgFeeBps,
    },
  };
}

// ---------------------------------------------------------------------------
// CREDIT REPORT - all credit analyses with issuer, internal rating, current
// score, scorecard band, and the latest gross exposure for the obligor. A
// report-wide view (not the paginated 25-row list), capped at 1000 rows.
// ---------------------------------------------------------------------------

export interface CreditReportRow {
  creditAnalysisId: string;
  partyId: string;
  legalName: string;
  analysisType: string | null;
  obligorType: string;
  internalRatingShort: string | null;
  currentCreditScore: string | null;
  band: string | null;
  watchlistFlag: boolean | null;
  internalRatingAction: string | null;
  lifecycleStatus: "current" | "superseded";
  validFrom: Date | null;
  validTo: Date | null;
  /** Latest gross exposure for the obligor (₹), or null if none on file. */
  grossExposure: number | null;
  exposureAsOf: string | null;
  createdAt: Date | null;
}

export interface CreditReport {
  rows: CreditReportRow[];
  total: number;
  /** Distinct issuer count (one issuer may have multiple analyses). */
  issuerCount: number;
  watchlistCount: number;
  /** Distribution of the latest band per current analysis. */
  bandDistribution: { band: string; count: number }[];
}

type CreditDbRow = {
  credit_analysis_id: string;
  party_id: string;
  legal_name: string;
  analysis_type: string | null;
  obligor_type: string;
  internal_rating_short: string | null;
  current_credit_score: string | null;
  band: string | null;
  watchlist_flag: boolean | null;
  internal_rating_action: string | null;
  valid_from: Date | null;
  valid_to: Date | null;
  created_at: Date | null;
  gross_exposure: string | null;
  exposure_as_of: string | null;
};

/** Filter options for the credit report's filterable table. All optional;
 *  the page passes the current URL filter params and the export route
 *  forwards the same params so the CSV always matches the on-screen view. */
export interface CreditReportFilter {
  /** Issuer legal-name substring (case-insensitive). */
  q?: string;
  /** Scorecard band (e.g. "BC-1" … "BC-6"). */
  band?: string;
  /** Point-in-time lifecycle: "current" (valid_to IS NULL) | "superseded". */
  lifecycle?: "current" | "superseded";
  /** Watchlist-only view. */
  watchlist?: boolean;
}

/**
 * Credit report - every non-deleted credit analysis joined to its issuer, the
 * latest scorecard band, and the latest gross exposure for the obligor. The
 * exposure is fetched as a separate per-party "latest exposure" CTE so a
 * party with many exposure snapshots only contributes its most-recent one.
 * Ordered by created_at desc (newest analyses first). Capped at 1000 rows.
 *
 * Filter params (`q` / `band` / `lifecycle` / `watchlist`) are applied
 * server-side so the filterable table + the CSV export stay in sync - the
 * export route forwards the same URL params.
 */
export async function getCreditReport(
  opts: CreditReportFilter = {},
  user?: CrmUser | null,
): Promise<CreditReport> {
  const conds = [sql`${creditAnalysis.deletedAt} IS NULL`];
  conds.push(scopedCreditClause(user));
  if (opts.q) conds.push(sql`${party.legalName} ILIKE ${`%${opts.q}%`}`);
  if (opts.lifecycle === "current") {
    conds.push(sql`${creditAnalysis.validTo} IS NULL`);
  } else if (opts.lifecycle === "superseded") {
    conds.push(sql`${creditAnalysis.validTo} IS NOT NULL`);
  }
  if (opts.watchlist) conds.push(sql`${creditAnalysis.watchlistFlag} = true`);
  if (opts.band) conds.push(sql`lb.band = ${opts.band}`);
  const where = sql.join(conds, sql` AND `);

  const rows = await db.execute<CreditDbRow>(sql`
    WITH latest_band AS (
      SELECT DISTINCT ON (${scorecard.creditAnalysisId})
             ${scorecard.creditAnalysisId} AS credit_analysis_id,
             ${scorecard.band} AS band
      FROM ${scorecard}
      WHERE ${scorecard.deletedAt} IS NULL
      ORDER BY ${scorecard.creditAnalysisId}, ${scorecard.computedAt} DESC
    ),
    latest_exposure AS (
      SELECT DISTINCT ON (${exposure.partyId})
             ${exposure.partyId} AS party_id,
             ${exposure.grossExposure} AS gross_exposure,
             ${exposure.asOfDate} AS exposure_as_of
      FROM ${exposure}
      WHERE ${exposure.deletedAt} IS NULL
      ORDER BY ${exposure.partyId}, ${exposure.asOfDate} DESC
    )
    SELECT ${creditAnalysis.creditAnalysisId} AS credit_analysis_id,
           ${creditAnalysis.partyId} AS party_id,
           ${party.legalName} AS legal_name,
           ${creditAnalysis.analysisType} AS analysis_type,
           ${creditAnalysis.obligorType} AS obligor_type,
           ${creditAnalysis.internalRatingShort} AS internal_rating_short,
           ${creditAnalysis.currentCreditScore} AS current_credit_score,
           lb.band AS band,
           ${creditAnalysis.watchlistFlag} AS watchlist_flag,
           ${creditAnalysis.internalRatingAction} AS internal_rating_action,
           ${creditAnalysis.validFrom} AS valid_from,
           ${creditAnalysis.validTo} AS valid_to,
           ${creditAnalysis.createdAt} AS created_at,
           le.gross_exposure AS gross_exposure,
           le.exposure_as_of AS exposure_as_of
    FROM ${creditAnalysis}
    INNER JOIN ${party} ON ${party.partyId} = ${creditAnalysis.partyId}
    LEFT JOIN latest_band lb ON lb.credit_analysis_id = ${creditAnalysis.creditAnalysisId}
    LEFT JOIN latest_exposure le ON le.party_id = ${creditAnalysis.partyId}
    WHERE ${where}
    ORDER BY ${creditAnalysis.createdAt} DESC NULLS LAST
    LIMIT 1000
  `);

  const mapped: CreditReportRow[] = rows.map((r) => ({
    creditAnalysisId: r.credit_analysis_id,
    partyId: r.party_id,
    legalName: r.legal_name,
    analysisType: r.analysis_type,
    obligorType: r.obligor_type,
    internalRatingShort: r.internal_rating_short,
    currentCreditScore: r.current_credit_score,
    band: r.band,
    watchlistFlag: r.watchlist_flag,
    internalRatingAction: r.internal_rating_action,
    lifecycleStatus: r.valid_to == null ? "current" : "superseded",
    validFrom: r.valid_from,
    validTo: r.valid_to,
    grossExposure: r.gross_exposure != null ? num(r.gross_exposure) : null,
    exposureAsOf: r.exposure_as_of,
    createdAt: r.created_at,
  }));

  // Band distribution over CURRENT analyses only (valid_to IS NULL) so a
  // superseded prior version doesn't double-count an issuer's band.
  const bandCounts = new Map<string, number>();
  let watchlistCount = 0;
  const currentIssuers = new Set<string>();
  for (const r of mapped) {
    if (r.lifecycleStatus === "current") {
      currentIssuers.add(r.partyId);
      const b = r.band ?? "Unrated";
      bandCounts.set(b, (bandCounts.get(b) ?? 0) + 1);
      if (r.watchlistFlag) watchlistCount += 1;
    }
  }

  return {
    rows: mapped,
    total: mapped.length,
    issuerCount: currentIssuers.size,
    watchlistCount,
    bandDistribution: Array.from(bandCounts.entries())
      .map(([band, count]) => ({ band, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// ---------------------------------------------------------------------------
// COMPLIANCE REPORT - KYC status breakdown, audit-log summary, DPDP consent
// status. Three independent aggregates; the audit summary also surfaces the
// occurred_at range + the top entity types / operations by volume.
// ---------------------------------------------------------------------------

export interface KycStatusBreakdownRow {
  status: string;
  statusLabel: string;
  count: number;
  /** Records with a re-KYC due date in the past or within 30 days. */
  dueSoon: number;
}

export interface AuditSummaryRow {
  operation: string;
  count: number;
}

export interface AuditEntityTypeRow {
  entityType: string;
  count: number;
}

export interface ConsentStatusRow {
  purpose: string;
  purposeLabel: string;
  active: number;
  withdrawn: number;
  total: number;
}

export interface ComplianceReport {
  kyc: {
    byStatus: KycStatusBreakdownRow[];
    total: number;
    complete: number;
    pending: number;
    dueSoon: number;
    highRisk: number;
  };
  audit: {
    byOperation: AuditSummaryRow[];
    byEntityType: AuditEntityTypeRow[];
    total: number;
    firstAt: Date | null;
    lastAt: Date | null;
  };
  consent: {
    byPurpose: ConsentStatusRow[];
    total: number;
    active: number;
    withdrawn: number;
  };
}

type KycStatusDbRow = { status: string | null; c: string; due_soon: string };
type AuditOpDbRow = { operation: string; c: string };
type AuditEntityDbRow = { entity_type: string; c: string };
type AuditRangeDbRow = { first_at: Date | null; last_at: Date | null; c: string };
type ConsentDbRow = {
  purpose: string;
  active: string;
  withdrawn: string;
  total: string;
};

/**
 * Compliance report - three modules (KYC, audit, consent) each surfaced as a
 * small set of group-bys. Six round-trips total, all indexed aggregates. The
 * KYC "due soon" window is 30 days (mirrors the dashboard's KYC_SOON_DAYS).
 */
export async function getComplianceReport(
  user?: CrmUser | null,
): Promise<ComplianceReport> {
  const [
    kycStatusRows,
    kycCountsRows,
    auditOpRows,
    auditEntityRows,
    auditRangeRows,
    consentRows,
  ] = await Promise.all([
    db.execute<KycStatusDbRow>(sql`
      SELECT ${kycRecord.status} AS status, count(*)::text AS c,
             count(*) filter (
               where ${kycRecord.rekycDueDate} IS NOT NULL
                 and ${kycRecord.rekycDueDate} <= (CURRENT_DATE + INTERVAL '30 days')
             )::text AS due_soon
      FROM ${kycRecord}
      WHERE ${kycRecord.deletedAt} IS NULL
        AND ${scopedKycClause(user)}
      GROUP BY ${kycRecord.status}
      ORDER BY count(*) DESC
    `),
    db.execute<{ c: string; complete: string; pending: string; due_soon: string; high_risk: string }>(sql`
      SELECT count(*)::text AS c,
             count(*) filter (where ${kycRecord.status} = 'approved')::text AS complete,
             count(*) filter (where ${kycRecord.status} in ('pending','in_review','under_eds_check'))::text AS pending,
             count(*) filter (
               where ${kycRecord.rekycDueDate} IS NOT NULL
                 and ${kycRecord.rekycDueDate} <= (CURRENT_DATE + INTERVAL '30 days')
             )::text AS due_soon,
             count(*) filter (where ${kycRecord.riskRating} = 'high')::text AS high_risk
      FROM ${kycRecord}
      WHERE ${kycRecord.deletedAt} IS NULL
        AND ${scopedKycClause(user)}
    `),
    db.execute<AuditOpDbRow>(sql`
      SELECT ${auditLog.operation} AS operation, count(*)::text AS c
      FROM ${auditLog}
      GROUP BY ${auditLog.operation}
      ORDER BY count(*) DESC
    `),
    db.execute<AuditEntityDbRow>(sql`
      SELECT ${auditLog.entityType} AS entity_type, count(*)::text AS c
      FROM ${auditLog}
      GROUP BY ${auditLog.entityType}
      ORDER BY count(*) DESC
      LIMIT 20
    `),
    db.execute<AuditRangeDbRow>(sql`
      SELECT min(${auditLog.occurredAt}) AS first_at,
             max(${auditLog.occurredAt}) AS last_at,
             count(*)::text AS c
      FROM ${auditLog}
    `),
    db.execute<ConsentDbRow>(sql`
      SELECT ${consentRecord.purpose} AS purpose,
             count(*) filter (where ${consentRecord.consentWithdrawnAt} IS NULL)::text AS active,
             count(*) filter (where ${consentRecord.consentWithdrawnAt} IS NOT NULL)::text AS withdrawn,
             count(*)::text AS total
      FROM ${consentRecord}
      WHERE ${consentRecord.deletedAt} IS NULL
        AND ${scopedConsentClause(user)}
      GROUP BY ${consentRecord.purpose}
      ORDER BY count(*) DESC
    `),
  ]);

  const kycByStatus: KycStatusBreakdownRow[] = kycStatusRows.map((r) => ({
    status: str(r.status) ?? "unknown",
    statusLabel: titleizeEnum(str(r.status) ?? "unknown"),
    count: num(r.c),
    dueSoon: num(r.due_soon),
  }));

  const kycCounts = kycCountsRows[0] ?? {
    c: "0",
    complete: "0",
    pending: "0",
    due_soon: "0",
    high_risk: "0",
  };

  const auditByOp: AuditSummaryRow[] = auditOpRows.map((r) => ({
    operation: r.operation,
    count: num(r.c),
  }));
  const auditByEntity: AuditEntityTypeRow[] = auditEntityRows.map((r) => ({
    entityType: r.entity_type,
    count: num(r.c),
  }));
  const auditRange = auditRangeRows[0] ?? { first_at: null, last_at: null, c: "0" };

  const consentByPurpose: ConsentStatusRow[] = consentRows.map((r) => ({
    purpose: r.purpose,
    purposeLabel: titleizeEnum(r.purpose),
    active: num(r.active),
    withdrawn: num(r.withdrawn),
    total: num(r.total),
  }));

  return {
    kyc: {
      byStatus: kycByStatus,
      total: num(kycCounts.c),
      complete: num(kycCounts.complete),
      pending: num(kycCounts.pending),
      dueSoon: num(kycCounts.due_soon),
      highRisk: num(kycCounts.high_risk),
    },
    audit: {
      byOperation: auditByOp,
      byEntityType: auditByEntity,
      total: num(auditRange.c),
      firstAt: auditRange.first_at,
      lastAt: auditRange.last_at,
    },
    consent: {
      byPurpose: consentByPurpose,
      total: consentByPurpose.reduce((a, r) => a + r.total, 0),
      active: consentByPurpose.reduce((a, r) => a + r.active, 0),
      withdrawn: consentByPurpose.reduce((a, r) => a + r.withdrawn, 0),
    },
  };
}

// ---------------------------------------------------------------------------
// REPORTS HUB KPIs - a small aggregate for the hub cards' eyebrow stats so
// each card can show a headline number (deal count, revenue, analyses, KYC
// due) without the page firing each detail report's full query set.
// ---------------------------------------------------------------------------

export interface ReportsHubKpis {
  pipelineDealCount: number;
  pipelineOpenCount: number;
  pipelineTargetExposure: number;
  recognizedRevenue: number;
  creditAnalysisCount: number;
  creditWatchlist: number;
  kycDueSoon: number;
  auditEvents: number;
}

/**
 * Hub KPIs - one cheap query per metric, fanned out in parallel. Each is a
 * single aggregate (count / sum) over the non-deleted book. Reused by the
 * reports hub page's StatCard eyebrows.
 */
export async function getReportsHubKpis(
  user?: CrmUser | null,
): Promise<ReportsHubKpis> {
  const [
    [pipelineRow],
    [revenueRow],
    [creditRow],
    [kycRow],
    [auditRow],
  ] = await Promise.all([
    db.execute<{ c: string; open_c: string; exposure: string }>(sql`
      SELECT count(*)::text AS c,
             count(*) filter (where ${deal.status} not in ('settled','closed','dropped'))::text AS open_c,
             coalesce(sum(${deal.targetSize}) filter (where ${deal.status} not in ('settled','closed','dropped')), 0)::text AS exposure
      FROM ${deal}
      WHERE ${deal.deletedAt} IS NULL
        AND ${scopedDealClause(user)}
    `),
    db.execute<{ revenue: string }>(sql`
      SELECT coalesce(sum(
        coalesce(${deal.targetSize}, 0)
        * (coalesce((${deal.feeStructure}->>'upfront_bps')::numeric, 0)
           + coalesce((${deal.feeStructure}->>'success_bps')::numeric, 0)) / 10000.0
      ), 0)::text AS revenue
      FROM ${deal}
      WHERE ${deal.deletedAt} IS NULL
        AND ${scopedDealClause(user)}
        AND ${deal.status} in ('settled','closed')
    `),
    db.execute<{ c: string; watch: string }>(sql`
      SELECT count(*)::text AS c,
             count(*) filter (where ${creditAnalysis.watchlistFlag} = true)::text AS watch
      FROM ${creditAnalysis}
      INNER JOIN ${party} ON ${party.partyId} = ${creditAnalysis.partyId}
      WHERE ${creditAnalysis.deletedAt} IS NULL
        AND ${party.deletedAt} IS NULL
        AND ${scopedCreditClause(user)}
        AND ${creditAnalysis.validTo} IS NULL
    `),
    db.execute<{ c: string }>(sql`
      SELECT count(*)::text AS c
      FROM ${kycRecord}
      WHERE ${kycRecord.deletedAt} IS NULL
        AND ${scopedKycClause(user)}
        AND ${kycRecord.rekycDueDate} IS NOT NULL
        AND ${kycRecord.rekycDueDate} <= (CURRENT_DATE + INTERVAL '30 days')
    `),
    db.execute<{ c: string }>(sql`
      SELECT count(*)::text AS c FROM ${auditLog}
    `),
  ]);

  return {
    pipelineDealCount: num(pipelineRow?.c),
    pipelineOpenCount: num(pipelineRow?.open_c),
    pipelineTargetExposure: num(pipelineRow?.exposure),
    recognizedRevenue: num(revenueRow?.revenue),
    creditAnalysisCount: num(creditRow?.c),
    creditWatchlist: num(creditRow?.watch),
    kycDueSoon: num(kycRow?.c),
    auditEvents: num(auditRow?.c),
  };
}

// ---------------------------------------------------------------------------
// EXPORT ROW FETCHERS - each returns a plain `Record<string, string | number>`
// row array + an ordered column list so the export route can feed them
// directly into `rowsToCsv`. These reuse the report queries above (and the
// existing list queries for the per-module list exports) so the CSV always
// matches what the screen shows.
// ---------------------------------------------------------------------------

/** A column definition for CSV export: a header label + a value accessor. */
export interface ExportColumn<T> {
  /** CSV column header. */
  header: string;
  /** Pull a cell value from a row. Coerced to string by rowsToCsv. */
  value: (row: T) => string | number | null | undefined;
}

/** Format a crore-denominated value as "₹{value} Cr" for CSV. The CRM stores
 *  deal.target_size / fee / exposure.gross_exposure in CRORES (the IB
 *  convention), so NO rupee→crore division is applied - the value is already
 *  crores. Matches the on-screen formatCr so the exported file reads like the
 *  report tables. */
function inrCr(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
}

/** Format a Date / ISO string as dd Mon yyyy (en-IN). */
function dateStr(v: Date | string | null | undefined): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/** Titleize a snake_case enum for a CSV cell. */
function titleize(v: string | null | undefined): string {
  if (!v) return "";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Pipeline export --------------------------------------------------------

export const PIPELINE_EXPORT_COLUMNS: ExportColumn<PipelineByStageRow>[] = [
  { header: "Stage", value: (r) => r.statusLabel },
  { header: "Deal count", value: (r) => r.dealCount },
  { header: "Target exposure (₹ Cr)", value: (r) => r.targetExposure },
  { header: "Target exposure", value: (r) => inrCr(r.targetExposure) },
  { header: "Avg deal size", value: (r) => inrCr(r.avgSize) },
];

export async function getPipelineExportRows(): Promise<PipelineByStageRow[]> {
  const { byStage } = await getPipelineReport();
  return byStage;
}

// --- Revenue export ---------------------------------------------------------

export const REVENUE_EXPORT_COLUMNS: ExportColumn<RevenueByDealRow>[] = [
  { header: "Deal code", value: (r) => r.dealCode ?? "" },
  { header: "Deal name", value: (r) => r.dealName ?? "" },
  { header: "Type", value: (r) => titleize(r.dealType) },
  { header: "Status", value: (r) => titleize(r.status) },
  { header: "RM (lead)", value: (r) => r.leadEmail ?? "" },
  { header: "Actual close", value: (r) => dateStr(r.actualCloseDate) },
  { header: "Deal size (₹ Cr)", value: (r) => r.targetSize },
  { header: "Deal size", value: (r) => inrCr(r.targetSize) },
  { header: "Upfront (bps)", value: (r) => r.upfrontBps },
  { header: "Success (bps)", value: (r) => r.successBps },
  { header: "Recognized fee (₹ Cr)", value: (r) => r.fee },
  { header: "Recognized fee", value: (r) => inrCr(r.fee) },
  { header: "Brand", value: (r) => titleize(r.brand) },
];

export async function getRevenueExportRows(): Promise<RevenueByDealRow[]> {
  const { byDeal } = await getRevenueReport();
  return byDeal;
}

// --- Credit export ----------------------------------------------------------

export const CREDIT_EXPORT_COLUMNS: ExportColumn<CreditReportRow>[] = [
  { header: "Issuer", value: (r) => r.legalName },
  { header: "Analysis type", value: (r) => titleize(r.analysisType) },
  { header: "Obligor type", value: (r) => titleize(r.obligorType) },
  { header: "Internal rating", value: (r) => r.internalRatingShort ?? "" },
  { header: "Score", value: (r) => r.currentCreditScore ?? "" },
  { header: "Band", value: (r) => r.band ?? "" },
  { header: "Lifecycle", value: (r) => r.lifecycleStatus },
  { header: "Rating action", value: (r) => titleize(r.internalRatingAction) },
  { header: "Watchlist", value: (r) => (r.watchlistFlag ? "Yes" : "No") },
  { header: "Gross exposure (₹ Cr)", value: (r) => r.grossExposure ?? "" },
  { header: "Gross exposure", value: (r) => inrCr(r.grossExposure) },
  { header: "Exposure as of", value: (r) => dateStr(r.exposureAsOf) },
  { header: "Valid from", value: (r) => dateStr(r.validFrom) },
  { header: "Created", value: (r) => dateStr(r.createdAt) },
];

export async function getCreditExportRows(
  opts: CreditReportFilter = {},
): Promise<CreditReportRow[]> {
  const { rows } = await getCreditReport(opts);
  return rows;
}

// --- Compliance export (KYC by status) --------------------------------------

export const COMPLIANCE_KYC_EXPORT_COLUMNS: ExportColumn<KycStatusBreakdownRow>[] = [
  { header: "KYC status", value: (r) => r.statusLabel },
  { header: "Count", value: (r) => r.count },
  { header: "Re-KYC due ≤30d", value: (r) => r.dueSoon },
];

export async function getComplianceKycExportRows(): Promise<
  KycStatusBreakdownRow[]
> {
  const { kyc } = await getComplianceReport();
  return kyc.byStatus;
}

// --- Per-module LIST exports (parties / deals / credit / KYC / interactions
//     / tasks / documents) are implemented inline in the export Route Handler
//     (src/app/reports/export/route.ts). They reuse the existing feature
//     `list*` queries directly with the passed filter params so the CSV
//     always matches the on-screen filtered list, and the list-item types
//     stay declared in their owning feature modules. The shared helpers
//     below are re-exported for the route to build column definitions.

export { str, num, inrCr, dateStr, titleize };
