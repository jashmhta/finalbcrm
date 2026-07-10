// Portfolio & Exposure Analytics - server-side data access.
//
// READ-ONLY aggregate queries powering the four portfolio pages (overview,
// concentration, risk-metrics, limits). They reuse the existing `exposure` +
// `credit_limit` tables (DATA_MODEL §2.16) plus `party`, `sector_code`,
// `external_rating`, and `instrument`. The aggregates are raw SQL (GROUP BY +
// CTE + window + jsonb/Pivot via `filter (where ...)`) executed via
// `db.execute(sql\`...\`)` - the same pattern as `src/features/reports/queries`
// - because Drizzle's query builder is clumsier than SQL for these shapes.
//
// The "current book" is the LATEST exposure snapshot per party
// (DISTINCT ON party_id ORDER BY as_of_date DESC) so a party with multiple
// snapshots only contributes its most-recent row - matching the reports
// `latest_exposure` CTE. credit_limit rows are the current set
// (effective_to IS NULL + deleted_at IS NULL).
//
// All functions are safe to call from Server Components. They run plain SELECTs
// (RLS GUCs are no-ops on tables without policies enabled yet). Every numeric
// column from postgres-js comes back as a string for `numeric`/`text` casts and
// a number for `::int` casts; the mappers below coerce to plain JSON numbers so
// payloads serialize across the RSC boundary.

import { sql } from "drizzle-orm";

import { db } from "@/db";
import {
  creditLimit,
  exposure,
  externalRating,
  instrument,
  party,
  sectorCode,
} from "@/db/schema";
import { can, type CrmUser } from "@/lib/rbac";
import {
  aggregatePortfolioRisk,
  convexity,
  herfindahlIndex,
  modifiedDuration,
  TENOR_BUCKETS,
  tenorBucketKey,
  topNSharePct,
  type PortfolioRiskMetrics,
  type RiskPosition,
} from "./risk";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Coerce a postgres-js numeric/string/Date cell to a number, defaulting to 0
 *  for null/empty so chart mappers never feed NaN into a formatter. */
function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Coerce to string | null for display columns (legal names, codes, dates). */
function str(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

/** Nullable numeric - returns null (not 0) for null/empty cells. */
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Normalize a snake_case enum to a display string. */
function titleizeEnum(v: string | null): string {
  if (!v) return "-";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function canReadAllPortfolio(user?: Pick<CrmUser, "roles" | "permissions"> | null) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "portfolio") ||
    can(user, "read_all", "party") ||
    can(user, "manage", "user")
  );
}

function exposureScopeSql(user?: CrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllPortfolio(user) || !userId) return sql`true`;
  return sql`EXISTS (
    SELECT 1
    FROM party p_scope
    WHERE p_scope.party_id = ${exposure.partyId}
      AND p_scope.deleted_at IS NULL
      AND (
        p_scope.assigned_user_id = ${userId}
        OR p_scope.data_owner_user_id = ${userId}
        OR p_scope.created_by_user_id = ${userId}
      )
  )`;
}

function creditLimitScopeSql(user?: CrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllPortfolio(user) || !userId) return sql`true`;
  return sql`(
    ${party.assignedUserId} = ${userId}
    OR ${party.dataOwnerUserId} = ${userId}
    OR ${party.createdByUserId} = ${userId}
  )`;
}

// SQL CASE: classify a party's sector_code into its top-level family for the
// sector-exposure donut + concentration views. Mirrors the dashboard's
// SECTOR_FAMILY_CASE.
const SECTOR_FAMILY_CASE = sql<string>`
  CASE
    WHEN ${sectorCode.code} ILIKE 'infra.%' THEN 'Infrastructure'
    WHEN ${sectorCode.code} ILIKE 'real_estate.%' THEN 'Real estate'
    WHEN ${sectorCode.code} ILIKE 'mfg.%' THEN 'Manufacturing'
    WHEN ${sectorCode.code} ILIKE 'nbfc.%' THEN 'NBFC'
    WHEN ${sectorCode.code} ILIKE 'services.%' THEN 'Services'
    ELSE 'Other'
  END
`;

// SQL CASE: bucket a long-term external rating letter into a display band.
// Ordered so AA+/AA- are caught before AA, A+ before A, BBB+/- before BBB, etc.
// Sub-IG (BB, B, CCC, CC, C, D) collapses to a single "Sub-IG" band; unrated
// (no external_rating row, or a non-matching value) → "Unrated".
const RATING_BAND_CASE = sql<string>`
  CASE
    WHEN er.rating_value ILIKE 'AAA%' THEN 'AAA'
    WHEN er.rating_value ILIKE 'AA+%' THEN 'AA+'
    WHEN er.rating_value ILIKE 'AA-%' THEN 'AA-'
    WHEN er.rating_value ILIKE 'AA%' THEN 'AA'
    WHEN er.rating_value ILIKE 'A+%' THEN 'A+'
    WHEN er.rating_value ILIKE 'A-%' THEN 'A-'
    WHEN er.rating_value ILIKE 'A%' THEN 'A'
    WHEN er.rating_value ILIKE 'BBB+%' THEN 'BBB+'
    WHEN er.rating_value ILIKE 'BBB-%' THEN 'BBB-'
    WHEN er.rating_value ILIKE 'BBB%' THEN 'BBB'
    WHEN er.rating_value ILIKE 'BB%' OR er.rating_value ILIKE 'B%' OR er.rating_value ILIKE 'C%' OR er.rating_value ILIKE 'D%' THEN 'Sub-IG'
    ELSE 'Unrated'
  END
`;

// SQL CASE: bucket residual tenor (years to maturity) into the desk grid.
const TENOR_BUCKET_CASE = sql<string>`
  CASE
    WHEN le.maturity_date IS NULL THEN 'unknown'
    WHEN (le.maturity_date - current_date) / 365.25 < 0 THEN '0_1'
    WHEN (le.maturity_date - current_date) / 365.25 < 1 THEN '0_1'
    WHEN (le.maturity_date - current_date) / 365.25 < 3 THEN '1_3'
    WHEN (le.maturity_date - current_date) / 365.25 < 5 THEN '3_5'
    WHEN (le.maturity_date - current_date) / 365.25 < 7 THEN '5_7'
    WHEN (le.maturity_date - current_date) / 365.25 < 10 THEN '7_10'
    ELSE '10p'
  END
`;

// The canonical rating-band display order (prime IG → sub-IG → unrated).
export const RATING_BAND_ORDER = [
  "AAA",
  "AA+",
  "AA",
  "AA-",
  "A+",
  "A",
  "A-",
  "BBB+",
  "BBB",
  "BBB-",
  "Sub-IG",
  "Unrated",
] as const;

// ---------------------------------------------------------------------------
// RBI prudential exposure norms - the reference ceiling the concentration
// view compares the live book against. These are the RBI Master Direction on
// NBFC prudential exposure norms (single-borrower 25% of owned funds, group
// 50%, sectoral caps on real estate / capital markets / inter-NBFC) expressed
// as a % of total exposure for the sector comparison. Sectors with no
// single-sector cap carry `null` (the single-borrower / group caps still
// apply at the name level). Surfaced in the UI as the model reference.
// ---------------------------------------------------------------------------

export interface RbiSectoralLimit {
  sector: string;
  /** RBI single-sector cap as % of total exposure (null = no sectoral cap). */
  rbiCapPct: number | null;
  /** The norm this cap comes from. */
  norm: string;
}

export const RBI_SECTORAL_LIMITS: readonly RbiSectoralLimit[] = [
  {
    sector: "Infrastructure",
    rbiCapPct: 40,
    norm: "RBI infra-lending glide path; no hard single-sector cap for IB book",
  },
  {
    sector: "Real estate",
    rbiCapPct: 15,
    norm: "NBFC prudential cap on real-estate exposure (% of owned funds)",
  },
  {
    sector: "NBFC",
    rbiCapPct: 25,
    norm: "Inter-NBFC exposure ceiling (single NBFC)",
  },
  {
    sector: "Manufacturing",
    rbiCapPct: null,
    norm: "No sectoral cap; single-borrower 25% / group 50% applies at name level",
  },
  {
    sector: "Services",
    rbiCapPct: null,
    norm: "No sectoral cap; single-borrower 25% / group 50% applies at name level",
  },
  {
    sector: "Other",
    rbiCapPct: null,
    norm: "Residual; single-borrower 25% / group 50% applies at name level",
  },
] as const;

/** RBI single-borrower prudential cap (% of capital / owned funds). */
export const RBI_SINGLE_BORROWER_CAP_PCT = 25;
/** RBI group exposure prudential cap (% of capital / owned funds). */
export const RBI_GROUP_CAP_PCT = 50;
/** House single-name "elevated concentration" threshold (% of book). */
export const HOUSE_ELEVATED_NAME_PCT = 5;
/** House single-name "high concentration" threshold (% of book). */
export const HOUSE_HIGH_NAME_PCT = 10;

// ===========================================================================
// 1. PORTFOLIO OVERVIEW - the dashboard hero + breakdowns.
// ===========================================================================

export interface ExposureByTypeRow {
  exposureType: string;
  exposureTypeLabel: string;
  grossCr: number;
  sharePct: number;
}

export interface PortfolioOverview {
  totalGrossCr: number;
  totalNetCr: number;
  positionCount: number;
  partyCount: number;
  exposureByType: ExposureByTypeRow[];
}

type OverviewDbRow = {
  total_gross: string | null;
  total_net: string | null;
  position_count: number | string;
  party_count: number | string;
};

type ByTypeDbRow = {
  exposure_type: string | null;
  gross: string | null;
};

/**
 * Portfolio overview - total gross/net exposure (₹ Cr) across the current
 * book, position + issuer counts, and the by-exposure-type breakdown
 * (portfolio_holding / secondary_inventory / underwriting_unsold /
 * advisory_fee_at_risk / settlement_counterparty / repo).
 */
export async function getPortfolioOverview(
  user?: CrmUser | null,
): Promise<PortfolioOverview> {
  const [overviewRows, typeRows] = await Promise.all([
    db.execute<OverviewDbRow>(sql`
      WITH latest_exposure AS (
        SELECT DISTINCT ON (${exposure.partyId})
               ${exposure.grossExposure} AS gross_exposure,
               ${exposure.netExposure} AS net_exposure
        FROM ${exposure}
        WHERE ${exposure.deletedAt} IS NULL
          AND ${exposureScopeSql(user)}
        ORDER BY ${exposure.partyId}, ${exposure.asOfDate} DESC
      )
      SELECT coalesce(sum(gross_exposure), 0)::text AS total_gross,
             coalesce(sum(net_exposure), 0)::text AS total_net,
             count(*)::int AS position_count,
             count(*)::int AS party_count
      FROM latest_exposure
    `),
    db.execute<ByTypeDbRow>(sql`
      WITH latest_exposure AS (
        SELECT DISTINCT ON (${exposure.partyId})
               ${exposure.exposureType} AS exposure_type,
               ${exposure.grossExposure} AS gross_exposure
        FROM ${exposure}
        WHERE ${exposure.deletedAt} IS NULL
          AND ${exposureScopeSql(user)}
        ORDER BY ${exposure.partyId}, ${exposure.asOfDate} DESC
      )
      SELECT exposure_type,
             coalesce(sum(gross_exposure), 0)::text AS gross
      FROM latest_exposure
      GROUP BY exposure_type
      ORDER BY coalesce(sum(gross_exposure), 0) DESC
    `),
  ]);

  const ov = overviewRows[0] ?? ({} as OverviewDbRow);
  const totalGrossCr = num(ov.total_gross);
  const totalNetCr = num(ov.total_net);

  const byTypeRaw = typeRows.map((r) => ({
    exposureType: str(r.exposure_type) ?? "unknown",
    grossCr: num(r.gross),
  }));
  const exposureByType: ExposureByTypeRow[] = byTypeRaw.map((r) => ({
    exposureType: r.exposureType,
    exposureTypeLabel: titleizeEnum(r.exposureType),
    grossCr: r.grossCr,
    sharePct: totalGrossCr > 0 ? (r.grossCr / totalGrossCr) * 100 : 0,
  }));

  return {
    totalGrossCr,
    totalNetCr,
    positionCount: num(ov.position_count),
    partyCount: num(ov.party_count),
    exposureByType,
  };
}

// ===========================================================================
// 2. EXPOSURE BY SECTOR - donut.
// ===========================================================================

export interface ExposureBySectorRow {
  sector: string;
  grossCr: number;
  sharePct: number;
}

type SectorDbRow = {
  sector: string | null;
  gross: string | null;
};

/** Exposure by top-level sector family (₹ Cr + % of book), donut-ready. */
export async function getExposureBySector(
  user?: CrmUser | null,
): Promise<ExposureBySectorRow[]> {
  const rows = await db.execute<SectorDbRow>(sql`
    WITH latest_exposure AS (
      SELECT DISTINCT ON (${exposure.partyId})
             ${exposure.partyId} AS party_id,
             ${exposure.grossExposure} AS gross_exposure
      FROM ${exposure}
      WHERE ${exposure.deletedAt} IS NULL
        AND ${exposureScopeSql(user)}
      ORDER BY ${exposure.partyId}, ${exposure.asOfDate} DESC
    )
    SELECT ${SECTOR_FAMILY_CASE} AS sector,
           coalesce(sum(le.gross_exposure), 0)::text AS gross
    FROM latest_exposure le
    INNER JOIN ${party} ON ${party.partyId} = le.party_id
    LEFT JOIN ${sectorCode} ON ${sectorCode.sectorCodeId} = ${party.industrySegmentId}
    WHERE ${party.deletedAt} IS NULL
    GROUP BY ${SECTOR_FAMILY_CASE}
    ORDER BY coalesce(sum(le.gross_exposure), 0) DESC
  `);

  const total = rows.reduce((acc, r) => acc + num(r.gross), 0);
  return rows.map((r) => ({
    sector: str(r.sector) ?? "Other",
    grossCr: num(r.gross),
    sharePct: total > 0 ? (num(r.gross) / total) * 100 : 0,
  }));
}

// ===========================================================================
// 3. EXPOSURE BY ISSUER (top N) - horizontal bar.
// ===========================================================================

export interface ExposureByIssuerRow {
  rank: number;
  partyId: string;
  name: string;
  grossCr: number;
  sharePct: number;
  /** Cumulative % of book through this rank (concentration-ratio build). */
  cumulativePct: number;
}

type IssuerDbRow = {
  party_id: string;
  legal_name: string;
  display_name: string | null;
  gross: string | null;
};

/** Top-N issuer exposure (₹ Cr + % of book + cumulative %), hbar-ready. */
export async function getExposureByIssuer(
  limit = 10,
  user?: CrmUser | null,
): Promise<ExposureByIssuerRow[]> {
  // Total book for share % - recompute via the same latest-per-party set so
  // shares are relative to the CURRENT book (not an arbitrary snapshot).
  const totalRows = await db.execute<{ total: string | null }>(sql`
    WITH latest_exposure AS (
      SELECT DISTINCT ON (${exposure.partyId})
             ${exposure.grossExposure} AS gross_exposure
      FROM ${exposure}
      WHERE ${exposure.deletedAt} IS NULL
        AND ${exposureScopeSql(user)}
      ORDER BY ${exposure.partyId}, ${exposure.asOfDate} DESC
    )
    SELECT coalesce(sum(gross_exposure), 0)::text AS total FROM latest_exposure
  `);
  const total = num(totalRows[0]?.total);

  const rows = await db.execute<IssuerDbRow>(sql`
    WITH latest_exposure AS (
      SELECT DISTINCT ON (${exposure.partyId})
             ${exposure.partyId} AS party_id,
             ${exposure.grossExposure} AS gross_exposure
      FROM ${exposure}
      WHERE ${exposure.deletedAt} IS NULL
        AND ${exposureScopeSql(user)}
      ORDER BY ${exposure.partyId}, ${exposure.asOfDate} DESC
    )
    SELECT le.party_id,
           ${party.legalName} AS legal_name,
           ${party.displayName} AS display_name,
           le.gross_exposure::text AS gross
    FROM latest_exposure le
    INNER JOIN ${party} ON ${party.partyId} = le.party_id
    WHERE ${party.deletedAt} IS NULL
    ORDER BY le.gross_exposure DESC NULLS LAST
    LIMIT ${limit}
  `);

  let cumulative = 0;
  return rows.map((r, i) => {
    const grossCr = num(r.gross);
    const sharePct = total > 0 ? (grossCr / total) * 100 : 0;
    cumulative += sharePct;
    return {
      rank: i + 1,
      partyId: r.party_id,
      name: str(r.display_name) ?? str(r.legal_name) ?? "-",
      grossCr,
      sharePct,
      cumulativePct: cumulative,
    };
  });
}

// ===========================================================================
// 4. EXPOSURE BY RATING BAND - stacked bar (segments = exposure types).
// ===========================================================================

export interface ExposureByRatingBandRow {
  band: string;
  /** Per-exposure-type segments (₹ Cr), stacked-bar-ready. */
  segments: { exposureType: string; grossCr: number }[];
  totalCr: number;
  sharePct: number;
}

type RatingBandDbRow = {
  band: string | null;
  underwriting_unsold: string | null;
  secondary_inventory: string | null;
  portfolio_holding: string | null;
  advisory_fee_at_risk: string | null;
  settlement_counterparty: string | null;
  repo: string | null;
  total: string | null;
};

const EXPOSURE_TYPE_KEYS = [
  "underwriting_unsold",
  "secondary_inventory",
  "portfolio_holding",
  "advisory_fee_at_risk",
  "settlement_counterparty",
  "repo",
] as const;

/**
 * Exposure by long-term rating band, pivoted by exposure type for a stacked
 * bar (each band = a bar; segments = the exposure-type composition within
 * that band). Bands are returned in canonical IG→sub-IG→unrated order.
 */
export async function getExposureByRatingBand(
  user?: CrmUser | null,
): Promise<ExposureByRatingBandRow[]> {
  const rows = await db.execute<RatingBandDbRow>(sql`
    WITH latest_exposure AS (
      SELECT DISTINCT ON (${exposure.partyId})
             ${exposure.partyId} AS party_id,
             ${exposure.exposureType} AS exposure_type,
             ${exposure.grossExposure} AS gross_exposure
      FROM ${exposure}
      WHERE ${exposure.deletedAt} IS NULL
        AND ${exposureScopeSql(user)}
      ORDER BY ${exposure.partyId}, ${exposure.asOfDate} DESC
    ),
    latest_rating AS (
      SELECT DISTINCT ON (${externalRating.partyId})
             ${externalRating.partyId} AS party_id,
             ${externalRating.ratingValue} AS rating_value
      FROM ${externalRating}
      WHERE ${externalRating.ratingScale} = 'long_term'
        AND ${externalRating.withdrawnDate} IS NULL
        AND ${externalRating.deletedAt} IS NULL
      ORDER BY ${externalRating.partyId}, ${externalRating.effectiveDate} DESC
    )
    SELECT ${RATING_BAND_CASE} AS band,
      coalesce(sum(le.gross_exposure) filter (where le.exposure_type = 'underwriting_unsold'), 0)::text AS underwriting_unsold,
      coalesce(sum(le.gross_exposure) filter (where le.exposure_type = 'secondary_inventory'), 0)::text AS secondary_inventory,
      coalesce(sum(le.gross_exposure) filter (where le.exposure_type = 'portfolio_holding'), 0)::text AS portfolio_holding,
      coalesce(sum(le.gross_exposure) filter (where le.exposure_type = 'advisory_fee_at_risk'), 0)::text AS advisory_fee_at_risk,
      coalesce(sum(le.gross_exposure) filter (where le.exposure_type = 'settlement_counterparty'), 0)::text AS settlement_counterparty,
      coalesce(sum(le.gross_exposure) filter (where le.exposure_type = 'repo'), 0)::text AS repo,
      coalesce(sum(le.gross_exposure), 0)::text AS total
    FROM latest_exposure le
    LEFT JOIN latest_rating er ON er.party_id = le.party_id
    GROUP BY ${RATING_BAND_CASE}
  `);

  const total = rows.reduce((acc, r) => acc + num(r.total), 0);

  const byBand = new Map<string, ExposureByRatingBandRow>();
  for (const r of rows) {
    const band = str(r.band) ?? "Unrated";
    const segments = EXPOSURE_TYPE_KEYS.map((k) => ({
      exposureType: k,
      grossCr: num((r as Record<string, unknown>)[k]),
    })).filter((s) => s.grossCr > 0);
    byBand.set(band, {
      band,
      segments,
      totalCr: num(r.total),
      sharePct: total > 0 ? (num(r.total) / total) * 100 : 0,
    });
  }

  // Canonical order; append any unexpected bands at the end.
  const ordered: ExposureByRatingBandRow[] = [];
  for (const b of RATING_BAND_ORDER) {
    const row = byBand.get(b);
    if (row && row.totalCr > 0) ordered.push(row);
  }
  for (const [b, row] of byBand) {
    if (!RATING_BAND_ORDER.includes(b as (typeof RATING_BAND_ORDER)[number]) && row.totalCr > 0) {
      ordered.push(row);
    }
  }
  return ordered;
}

// ===========================================================================
// 5. EXPOSURE BY TENOR - distribution bar.
// ===========================================================================

export interface ExposureByTenorRow {
  bucketKey: string;
  label: string;
  grossCr: number;
  sharePct: number;
}

type TenorDbRow = {
  bucket: string | null;
  gross: string | null;
};

/** Exposure by residual-tenor bucket (₹ Cr + % of book), distribution-bar-ready. */
export async function getExposureByTenor(
  user?: CrmUser | null,
): Promise<ExposureByTenorRow[]> {
  const rows = await db.execute<TenorDbRow>(sql`
    WITH latest_exposure AS (
      SELECT DISTINCT ON (${exposure.partyId})
             ${exposure.maturityDate} AS maturity_date,
             ${exposure.grossExposure} AS gross_exposure
      FROM ${exposure}
      WHERE ${exposure.deletedAt} IS NULL
        AND ${exposureScopeSql(user)}
      ORDER BY ${exposure.partyId}, ${exposure.asOfDate} DESC
    )
    SELECT ${TENOR_BUCKET_CASE} AS bucket,
           coalesce(sum(gross_exposure), 0)::text AS gross
    FROM latest_exposure le
    GROUP BY ${TENOR_BUCKET_CASE}
  `);

  const total = rows.reduce((acc, r) => acc + num(r.gross), 0);
  const byKey = new Map<string, number>();
  for (const r of rows) {
    byKey.set(str(r.bucket) ?? "unknown", num(r.gross));
  }

  return TENOR_BUCKETS.map((b) => ({
    bucketKey: b.key,
    label: b.label,
    grossCr: byKey.get(b.key) ?? 0,
    sharePct: total > 0 ? ((byKey.get(b.key) ?? 0) / total) * 100 : 0,
  }));
}

// ===========================================================================
// 6. LIMIT UTILIZATION SUMMARY - the dashboard gauges.
// ===========================================================================

export interface LimitUtilizationByType {
  limitType: string;
  limitTypeLabel: string;
  totalLimitCr: number;
  totalUtilizedCr: number;
  totalAvailableCr: number;
  utilizationPct: number;
  count: number;
  breachCount: number;
}

export interface LimitUtilizationSummary {
  byType: LimitUtilizationByType[];
  overall: {
    totalLimitCr: number;
    totalUtilizedCr: number;
    totalAvailableCr: number;
    utilizationPct: number;
    count: number;
    breachCount: number;
  };
}

type LimitSummaryDbRow = {
  limit_type: string | null;
  total_limit: string | null;
  total_utilized: string | null;
  cnt: number | string;
  breach_cnt: number | string;
};

/** Limit utilization by limit_type + overall - the dashboard gauge cluster. */
export async function getLimitUtilizationSummary(
  user?: CrmUser | null,
): Promise<LimitUtilizationSummary> {
  const rows = await db.execute<LimitSummaryDbRow>(sql`
    SELECT ${creditLimit.limitType} AS limit_type,
           coalesce(sum(${creditLimit.limitAmount}), 0)::text AS total_limit,
           coalesce(sum(${creditLimit.utilized}), 0)::text AS total_utilized,
           count(*)::int AS cnt,
           count(*) filter (where ${creditLimit.utilized} > ${creditLimit.limitAmount})::int AS breach_cnt
    FROM ${creditLimit}
    INNER JOIN ${party} ON ${party.partyId} = ${creditLimit.partyId}
    WHERE ${creditLimit.deletedAt} IS NULL
      AND ${creditLimit.effectiveTo} IS NULL
      AND ${party.deletedAt} IS NULL
      AND ${creditLimitScopeSql(user)}
    GROUP BY ${creditLimit.limitType}
    ORDER BY coalesce(sum(${creditLimit.limitAmount}), 0) DESC
  `);

  const byType: LimitUtilizationByType[] = rows.map((r) => {
    const limit = num(r.total_limit);
    const utilized = num(r.total_utilized);
    return {
      limitType: str(r.limit_type) ?? "unknown",
      limitTypeLabel: titleizeEnum(str(r.limit_type)),
      totalLimitCr: limit,
      totalUtilizedCr: utilized,
      totalAvailableCr: limit - utilized,
      utilizationPct: limit > 0 ? (utilized / limit) * 100 : 0,
      count: num(r.cnt),
      breachCount: num(r.breach_cnt),
    };
  });

  const totalLimitCr = byType.reduce((a, r) => a + r.totalLimitCr, 0);
  const totalUtilizedCr = byType.reduce((a, r) => a + r.totalUtilizedCr, 0);
  const count = byType.reduce((a, r) => a + r.count, 0);
  const breachCount = byType.reduce((a, r) => a + r.breachCount, 0);

  return {
    byType,
    overall: {
      totalLimitCr,
      totalUtilizedCr,
      totalAvailableCr: totalLimitCr - totalUtilizedCr,
      utilizationPct: totalLimitCr > 0 ? (totalUtilizedCr / totalLimitCr) * 100 : 0,
      count,
      breachCount,
    },
  };
}

// ===========================================================================
// 7. CONCENTRATION ALERTS - the dashboard alert rail.
// ===========================================================================

export interface ConcentrationAlert {
  id: string;
  severity: "high" | "elevated" | "info";
  category: "single_name" | "sector" | "rating" | "limit" | "diversification";
  title: string;
  detail: string;
  /** Numeric value the alert is about (e.g. share % or breach count). */
  value: string;
}

export interface ConcentrationAlertSummary {
  alerts: ConcentrationAlert[];
  /** Top-1 issuer % of book. */
  top1IssuerSharePct: number;
  /** Top-3 issuer % of book (CR3 concentration ratio). */
  top3IssuerSharePct: number;
  /** Herfindahl-Hirschman Index (0–10,000 scale, squared % shares). */
  hhi: number;
  /** Sub-investment-grade % of book (BB+ and below). */
  subIgSharePct: number;
  /** Number of breached credit limits (utilized > limit). */
  limitBreachCount: number;
  /** Number of sectors over their RBI sectoral cap. */
  sectorBreachCount: number;
}

/**
 * Concentration alerts - the dashboard rail. Computes single-name (top-1 / CR3
 * / HHI), sector-vs-RBI-cap, sub-IG share, and limit-breach signals from the
 * live book and returns a severity-ordered alert list.
 */
export async function getConcentrationAlerts(
  user?: CrmUser | null,
): Promise<ConcentrationAlertSummary> {
  const [issuers, sectors, ratings, limits] = await Promise.all([
    getExposureByIssuer(1000, user),
    getExposureBySector(user),
    getRatingConcentration(user),
    getLimitUtilizationSummary(user),
  ]);

  const totalBook = issuers.reduce((a, r) => a + r.grossCr, 0);
  const issuerShares = issuers.map((r) => r.sharePct);
  const top1IssuerSharePct = topNSharePct(issuerShares, 1);
  const top3IssuerSharePct = topNSharePct(issuerShares, 3);
  const hhi = herfindahlIndex(issuerShares);

  const subIgSharePct = ratings
    .filter((r) => r.band === "Sub-IG")
    .reduce((a, r) => a + r.sharePct, 0);

  const limitBreachCount = limits.overall.breachCount;

  // Sector vs RBI cap.
  const rbiBySector = new Map(
    RBI_SECTORAL_LIMITS.map((r) => [r.sector, r]),
  );
  const sectorBreaches = sectors.filter((s) => {
    const cap = rbiBySector.get(s.sector)?.rbiCapPct;
    return cap != null && s.sharePct > cap;
  });

  const alerts: ConcentrationAlert[] = [];

  // Single-name alerts.
  if (top1IssuerSharePct > RBI_SINGLE_BORROWER_CAP_PCT) {
    alerts.push({
      id: "name-rbi-cap",
      severity: "high",
      category: "single_name",
      title: "Single-name exposure over RBI 25% cap",
      detail: `Largest obligor is ${top1IssuerSharePct.toFixed(2)}% of book - above the RBI single-borrower prudential cap of ${RBI_SINGLE_BORROWER_CAP_PCT}%.`,
      value: `${top1IssuerSharePct.toFixed(2)}%`,
    });
  } else if (top1IssuerSharePct > HOUSE_HIGH_NAME_PCT) {
    alerts.push({
      id: "name-high",
      severity: "high",
      category: "single_name",
      title: "High single-name concentration",
      detail: `Largest obligor is ${top1IssuerSharePct.toFixed(2)}% of book - above the house ${HOUSE_HIGH_NAME_PCT}% high-concentration threshold.`,
      value: `${top1IssuerSharePct.toFixed(2)}%`,
    });
  } else if (top1IssuerSharePct > HOUSE_ELEVATED_NAME_PCT) {
    alerts.push({
      id: "name-elevated",
      severity: "elevated",
      category: "single_name",
      title: "Elevated single-name concentration",
      detail: `Largest obligor is ${top1IssuerSharePct.toFixed(2)}% of book - above the house ${HOUSE_ELEVATED_NAME_PCT}% elevated threshold.`,
      value: `${top1IssuerSharePct.toFixed(2)}%`,
    });
  }

  // Diversification (HHI).
  if (hhi > 2500) {
    alerts.push({
      id: "hhi-high",
      severity: "high",
      category: "diversification",
      title: "Book is highly concentrated (HHI)",
      detail: `Herfindahl-Hirschman Index is ${hhi.toFixed(0)} - above the 2,500 "highly concentrated" threshold. CR3 is ${top3IssuerSharePct.toFixed(2)}%.`,
      value: hhi.toFixed(0),
    });
  } else if (hhi > 1500) {
    alerts.push({
      id: "hhi-moderate",
      severity: "elevated",
      category: "diversification",
      title: "Book is moderately concentrated (HHI)",
      detail: `Herfindahl-Hirschman Index is ${hhi.toFixed(0)} - in the 1,500–2,500 "moderately concentrated" band. CR3 is ${top3IssuerSharePct.toFixed(2)}%.`,
      value: hhi.toFixed(0),
    });
  } else {
    alerts.push({
      id: "hhi-ok",
      severity: "info",
      category: "diversification",
      title: "Book is well diversified",
      detail: `Herfindahl-Hirschman Index is ${hhi.toFixed(0)} - below the 1,500 "unconcentrated" threshold. CR3 is ${top3IssuerSharePct.toFixed(2)}%.`,
      value: hhi.toFixed(0),
    });
  }

  // Sector breaches.
  for (const sb of sectorBreaches) {
    const cap = rbiBySector.get(sb.sector)?.rbiCapPct ?? 0;
    alerts.push({
      id: `sector-${sb.sector}`,
      severity: "high",
      category: "sector",
      title: `${sb.sector} over RBI sectoral cap`,
      detail: `${sb.sector} is ${sb.sharePct.toFixed(2)}% of book - above the RBI sectoral cap of ${cap}% of total exposure.`,
      value: `${sb.sharePct.toFixed(2)}%`,
    });
  }

  // Sub-IG share.
  if (subIgSharePct > 10) {
    alerts.push({
      id: "subig-high",
      severity: "high",
      category: "rating",
      title: "Sub-investment-grade share elevated",
      detail: `${subIgSharePct.toFixed(2)}% of the book sits in BB+ and below - above the house 10% sub-IG ceiling.`,
      value: `${subIgSharePct.toFixed(2)}%`,
    });
  } else if (subIgSharePct > 0) {
    alerts.push({
      id: "subig-info",
      severity: "info",
      category: "rating",
      title: "Sub-investment-grade share",
      detail: `${subIgSharePct.toFixed(2)}% of the book sits in BB+ and below.`,
      value: `${subIgSharePct.toFixed(2)}%`,
    });
  }

  // Limit breaches.
  if (limitBreachCount > 0) {
    alerts.push({
      id: "limit-breach",
      severity: limitBreachCount > 5 ? "high" : "elevated",
      category: "limit",
      title: `${limitBreachCount} credit limit${limitBreachCount === 1 ? "" : "s"} breached`,
      detail: `${limitBreachCount} counterparty limit${limitBreachCount === 1 ? " has" : "s have"} utilization above the approved amount - review on the Limits page.`,
      value: String(limitBreachCount),
    });
  }

  const severityRank: Record<ConcentrationAlert["severity"], number> = {
    high: 0,
    elevated: 1,
    info: 2,
  };
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return {
    alerts,
    top1IssuerSharePct,
    top3IssuerSharePct,
    hhi,
    subIgSharePct,
    limitBreachCount,
    sectorBreachCount: sectorBreaches.length,
  };
}

// ===========================================================================
// 8. SECTOR CONCENTRATION - concentration page (with RBI cap comparison).
// ===========================================================================

export interface SectorConcentrationRow {
  sector: string;
  grossCr: number;
  sharePct: number;
  partyCount: number;
  /** RBI single-sector cap (% of total exposure), null = no sectoral cap. */
  rbiCapPct: number | null;
  breached: boolean;
  norm: string;
}

type SectorConcDbRow = {
  sector: string | null;
  gross: string | null;
  party_count: number | string;
};

/** Per-sector exposure + party count + RBI cap comparison (concentration page). */
export async function getSectorConcentration(
  user?: CrmUser | null,
): Promise<SectorConcentrationRow[]> {
  const rows = await db.execute<SectorConcDbRow>(sql`
    WITH latest_exposure AS (
      SELECT DISTINCT ON (${exposure.partyId})
             ${exposure.partyId} AS party_id,
             ${exposure.grossExposure} AS gross_exposure
      FROM ${exposure}
      WHERE ${exposure.deletedAt} IS NULL
        AND ${exposureScopeSql(user)}
      ORDER BY ${exposure.partyId}, ${exposure.asOfDate} DESC
    )
    SELECT ${SECTOR_FAMILY_CASE} AS sector,
           coalesce(sum(le.gross_exposure), 0)::text AS gross,
           count(DISTINCT le.party_id)::int AS party_count
    FROM latest_exposure le
    INNER JOIN ${party} ON ${party.partyId} = le.party_id
    LEFT JOIN ${sectorCode} ON ${sectorCode.sectorCodeId} = ${party.industrySegmentId}
    WHERE ${party.deletedAt} IS NULL
    GROUP BY ${SECTOR_FAMILY_CASE}
    ORDER BY coalesce(sum(le.gross_exposure), 0) DESC
  `);

  const total = rows.reduce((acc, r) => acc + num(r.gross), 0);
  const rbiBySector = new Map(RBI_SECTORAL_LIMITS.map((r) => [r.sector, r]));

  return rows.map((r) => {
    const sector = str(r.sector) ?? "Other";
    const grossCr = num(r.gross);
    const sharePct = total > 0 ? (grossCr / total) * 100 : 0;
    const rbi = rbiBySector.get(sector);
    const rbiCapPct = rbi?.rbiCapPct ?? null;
    return {
      sector,
      grossCr,
      sharePct,
      partyCount: num(r.party_count),
      rbiCapPct,
      breached: rbiCapPct != null && sharePct > rbiCapPct,
      norm: rbi?.norm ?? "No sectoral cap; single-borrower 25% / group 50% at name level",
    };
  });
}

// ===========================================================================
// 9. ISSUER CONCENTRATION - concentration page (top-N table).
// ===========================================================================

export interface IssuerConcentrationRow extends ExposureByIssuerRow {
  /** Latest approved limit for the issuer (₹ Cr), if any. */
  limitCr: number | null;
  /** Utilization against that limit (%). */
  utilizationPct: number | null;
  /** Concentration classification from the house thresholds. */
  classification: "high" | "elevated" | "normal";
}

type IssuerConcDbRow = {
  party_id: string;
  legal_name: string;
  display_name: string | null;
  gross: string | null;
  limit_amount: string | null;
  utilized: string | null;
};

/**
 * Top-N issuer concentration with cumulative % + the issuer's latest
 * single-name limit + utilization. The concentration-page table.
 */
export async function getIssuerConcentration(
  limit = 25,
  user?: CrmUser | null,
): Promise<IssuerConcentrationRow[]> {
  const totalRows = await db.execute<{ total: string | null }>(sql`
    WITH latest_exposure AS (
      SELECT DISTINCT ON (${exposure.partyId})
             ${exposure.grossExposure} AS gross_exposure
      FROM ${exposure}
      WHERE ${exposure.deletedAt} IS NULL
        AND ${exposureScopeSql(user)}
      ORDER BY ${exposure.partyId}, ${exposure.asOfDate} DESC
    )
    SELECT coalesce(sum(gross_exposure), 0)::text AS total FROM latest_exposure
  `);
  const total = num(totalRows[0]?.total);

  const rows = await db.execute<IssuerConcDbRow>(sql`
    WITH latest_exposure AS (
      SELECT DISTINCT ON (${exposure.partyId})
             ${exposure.partyId} AS party_id,
             ${exposure.grossExposure} AS gross_exposure
      FROM ${exposure}
      WHERE ${exposure.deletedAt} IS NULL
        AND ${exposureScopeSql(user)}
      ORDER BY ${exposure.partyId}, ${exposure.asOfDate} DESC
    ),
    latest_limit AS (
      SELECT DISTINCT ON (${creditLimit.partyId})
             ${creditLimit.partyId} AS party_id,
             ${creditLimit.limitAmount} AS limit_amount,
             ${creditLimit.utilized} AS utilized
      FROM ${creditLimit}
      WHERE ${creditLimit.deletedAt} IS NULL
        AND ${creditLimit.effectiveTo} IS NULL
        AND ${creditLimit.limitType} = 'single_name'
      ORDER BY ${creditLimit.partyId}, ${creditLimit.createdAt} DESC
    )
    SELECT le.party_id,
           ${party.legalName} AS legal_name,
           ${party.displayName} AS display_name,
           le.gross_exposure::text AS gross,
           ll.limit_amount::text AS limit_amount,
           ll.utilized::text AS utilized
    FROM latest_exposure le
    INNER JOIN ${party} ON ${party.partyId} = le.party_id
    LEFT JOIN latest_limit ll ON ll.party_id = le.party_id
    WHERE ${party.deletedAt} IS NULL
    ORDER BY le.gross_exposure DESC NULLS LAST
    LIMIT ${limit}
  `);

  let cumulative = 0;
  return rows.map((r, i) => {
    const grossCr = num(r.gross);
    const sharePct = total > 0 ? (grossCr / total) * 100 : 0;
    cumulative += sharePct;
    const limitCr = numOrNull(r.limit_amount);
    const utilized = numOrNull(r.utilized);
    return {
      rank: i + 1,
      partyId: r.party_id,
      name: str(r.display_name) ?? str(r.legal_name) ?? "-",
      grossCr,
      sharePct,
      cumulativePct: cumulative,
      limitCr,
      utilizationPct:
        limitCr != null && limitCr > 0 && utilized != null
          ? (utilized / limitCr) * 100
          : null,
      classification:
        sharePct > RBI_SINGLE_BORROWER_CAP_PCT
          ? "high"
          : sharePct > HOUSE_ELEVATED_NAME_PCT
            ? "elevated"
            : "normal",
    };
  });
}

// ===========================================================================
// 10. RATING CONCENTRATION - concentration page.
// ===========================================================================

export interface RatingConcentrationRow {
  band: string;
  grossCr: number;
  sharePct: number;
  partyCount: number;
  /** Tier for color coding (emerald = prime IG, gold = lower IG, info =
   *  crossover, down = sub-IG, neutral = unrated). */
  tier: "emerald" | "gold" | "info" | "down" | "neutral";
}

type RatingConcDbRow = {
  band: string | null;
  gross: string | null;
  party_count: number | string;
};

/** Map a rating band to a semantic color tier. */
function bandTier(band: string): RatingConcentrationRow["tier"] {
  if (band === "AAA" || /^AA[+-]?$/.test(band)) return "emerald";
  if (band === "A+" || band === "A") return "emerald";
  if (band === "A-") return "gold";
  if (/^BBB[+-]?$/.test(band)) return "info";
  if (band === "Sub-IG") return "down";
  return "neutral";
}

/** Per-rating-band exposure + party count + share (concentration page). */
export async function getRatingConcentration(
  user?: CrmUser | null,
): Promise<RatingConcentrationRow[]> {
  const rows = await db.execute<RatingConcDbRow>(sql`
    WITH latest_exposure AS (
      SELECT DISTINCT ON (${exposure.partyId})
             ${exposure.partyId} AS party_id,
             ${exposure.grossExposure} AS gross_exposure
      FROM ${exposure}
      WHERE ${exposure.deletedAt} IS NULL
        AND ${exposureScopeSql(user)}
      ORDER BY ${exposure.partyId}, ${exposure.asOfDate} DESC
    ),
    latest_rating AS (
      SELECT DISTINCT ON (${externalRating.partyId})
             ${externalRating.partyId} AS party_id,
             ${externalRating.ratingValue} AS rating_value
      FROM ${externalRating}
      WHERE ${externalRating.ratingScale} = 'long_term'
        AND ${externalRating.withdrawnDate} IS NULL
        AND ${externalRating.deletedAt} IS NULL
      ORDER BY ${externalRating.partyId}, ${externalRating.effectiveDate} DESC
    )
    SELECT ${RATING_BAND_CASE} AS band,
           coalesce(sum(le.gross_exposure), 0)::text AS gross,
           count(DISTINCT le.party_id)::int AS party_count
    FROM latest_exposure le
    LEFT JOIN latest_rating er ON er.party_id = le.party_id
    GROUP BY ${RATING_BAND_CASE}
  `);

  const total = rows.reduce((acc, r) => acc + num(r.gross), 0);
  const byBand = new Map<string, RatingConcentrationRow>();
  for (const r of rows) {
    const band = str(r.band) ?? "Unrated";
    const grossCr = num(r.gross);
    byBand.set(band, {
      band,
      grossCr,
      sharePct: total > 0 ? (grossCr / total) * 100 : 0,
      partyCount: num(r.party_count),
      tier: bandTier(band),
    });
  }

  const ordered: RatingConcentrationRow[] = [];
  for (const b of RATING_BAND_ORDER) {
    const row = byBand.get(b);
    if (row) ordered.push(row);
  }
  return ordered;
}

// ===========================================================================
// 11. RISK METRICS - DV01, modified duration, convexity, VaR.
// ===========================================================================

export interface RiskPositionRow {
  partyId: string;
  name: string;
  grossCr: number;
  tenorYears: number;
  couponPct: number | null;
  modDur: number;
  convexity: number;
  /** Per-position DV01 in ₹ lakh. */
  dv01Lakh: number;
}

export interface RiskByTenorRow {
  bucketKey: string;
  label: string;
  grossCr: number;
  modDur: number;
  dv01Lakh: number;
  positionCount: number;
}

export interface RiskMetrics {
  portfolio: PortfolioRiskMetrics;
  byTenor: RiskByTenorRow[];
  topDv01: RiskPositionRow[];
}

type RiskDbRow = {
  party_id: string;
  legal_name: string;
  display_name: string | null;
  gross: string | null;
  maturity_date: string | null;
  coupon_pct: string | null;
};

/**
 * Portfolio risk metrics - fetches the current book (latest exposure per
 * party + instrument coupon), runs the pure risk math (Macaulay / modified
 * duration, convexity, DV01, parametric VaR) per position, and aggregates to
 * portfolio level + per-tenor-bucket + top DV01 contributors.
 *
 * Tenor uses exposure.maturity_date (the position's maturity); coupon comes
 * from the linked instrument (LEFT JOIN, null → 8% par fallback in risk.ts).
 */
export async function getRiskMetrics(
  user?: CrmUser | null,
): Promise<RiskMetrics> {
  const rows = await db.execute<RiskDbRow>(sql`
    WITH latest_exposure AS (
      SELECT DISTINCT ON (${exposure.partyId})
             ${exposure.partyId} AS party_id,
             ${exposure.instrumentId} AS instrument_id,
             ${exposure.grossExposure} AS gross_exposure,
             ${exposure.maturityDate} AS maturity_date
      FROM ${exposure}
      WHERE ${exposure.deletedAt} IS NULL
        AND ${exposureScopeSql(user)}
      ORDER BY ${exposure.partyId}, ${exposure.asOfDate} DESC
    )
    SELECT le.party_id,
           ${party.legalName} AS legal_name,
           ${party.displayName} AS display_name,
           le.gross_exposure::text AS gross,
           le.maturity_date::text AS maturity_date,
           ${instrument.couponPct}::text AS coupon_pct
    FROM latest_exposure le
    INNER JOIN ${party} ON ${party.partyId} = le.party_id
    LEFT JOIN ${instrument} ON ${instrument.instrumentId} = le.instrument_id
    WHERE ${party.deletedAt} IS NULL
  `);

  const now = Date.now();
  const positions: (RiskPosition & {
    partyId: string;
    name: string;
    modDur: number;
    convexity: number;
    dv01Lakh: number;
    bucketKey: string;
  })[] = [];

  for (const r of rows) {
    const grossCr = num(r.gross);
    if (grossCr <= 0) continue;
    const maturity = r.maturity_date ? new Date(r.maturity_date) : null;
    const tenorYears = maturity
      ? (maturity.getTime() - now) / (365.25 * 24 * 60 * 60 * 1000)
      : 0;
    const couponPct = numOrNull(r.coupon_pct);
    const md = modifiedDuration(tenorYears, couponPct, null);
    const conv = convexity(tenorYears, couponPct, null);
    // DV01 in rupees = grossCr * 1e7 * md * 1e-4 → in lakh: /1e5 = grossCr * md * 1e-2.
    const dv01Lakh = grossCr * md * 1e-2;
    positions.push({
      grossExposureCr: grossCr,
      tenorYears,
      couponPct,
      partyId: r.party_id,
      name: str(r.display_name) ?? str(r.legal_name) ?? "-",
      modDur: md,
      convexity: conv,
      dv01Lakh,
      bucketKey: tenorBucketKey(tenorYears),
    });
  }

  const portfolio = aggregatePortfolioRisk(
    positions.map((p) => ({
      grossExposureCr: p.grossExposureCr,
      tenorYears: p.tenorYears,
      couponPct: p.couponPct,
    })),
  );

  // Per-tenor-bucket aggregates.
  const byTenor: RiskByTenorRow[] = TENOR_BUCKETS.map((b) => {
    const inBucket = positions.filter((p) => p.bucketKey === b.key);
    const grossCr = inBucket.reduce((a, p) => a + p.grossExposureCr, 0);
    const modDur =
      grossCr > 0
        ? inBucket.reduce((a, p) => a + p.grossExposureCr * p.modDur, 0) / grossCr
        : 0;
    const dv01Lakh = inBucket.reduce((a, p) => a + p.dv01Lakh, 0);
    return {
      bucketKey: b.key,
      label: b.label,
      grossCr,
      modDur,
      dv01Lakh,
      positionCount: inBucket.length,
    };
  });

  // Top DV01 contributors.
  const topDv01: RiskPositionRow[] = [...positions]
    .sort((a, b) => b.dv01Lakh - a.dv01Lakh)
    .slice(0, 10)
    .map((p) => ({
      partyId: p.partyId,
      name: p.name,
      grossCr: p.grossExposureCr,
      tenorYears: p.tenorYears,
      couponPct: p.couponPct,
      modDur: p.modDur,
      convexity: p.convexity,
      dv01Lakh: p.dv01Lakh,
    }));

  return { portfolio, byTenor, topDv01 };
}

// ===========================================================================
// 12. LIMITS - the limits-management table.
// ===========================================================================

export interface LimitRow {
  creditLimitId: string;
  partyId: string;
  partyName: string;
  limitType: string;
  limitTypeLabel: string;
  currency: string;
  limitAmountCr: number;
  utilizedCr: number;
  availableCr: number;
  utilizationPct: number;
  breached: boolean;
  isStale: boolean;
  reviewDueDate: string | null;
  /** Days until review (negative = overdue). */
  reviewInDays: number | null;
}

export interface LimitsFilter {
  limitType?: string;
  /** "breach" = breached only, "stale" = stale only, undefined = all. */
  status?: "breach" | "stale" | "ok";
  /** Issuer name substring. */
  q?: string;
}

export interface LimitsResult {
  rows: LimitRow[];
  summary: LimitUtilizationSummary;
  /** Whether the current user may edit limits (credit_limit:approve). */
  canEdit: boolean;
}

type LimitDbRow = {
  credit_limit_id: string;
  party_id: string;
  legal_name: string;
  display_name: string | null;
  limit_type: string | null;
  currency_code: string | null;
  limit_amount: string | null;
  utilized: string | null;
  is_stale: boolean | null;
  review_due_date: string | null;
};

/** The current limit set (effective_to IS NULL + deleted_at IS NULL). */
export async function getLimits(
  filter: LimitsFilter = {},
  user?: CrmUser | null,
): Promise<Omit<LimitsResult, "canEdit">> {
  const conds = [
    sql`${creditLimit.deletedAt} IS NULL`,
    sql`${creditLimit.effectiveTo} IS NULL`,
    sql`${party.deletedAt} IS NULL`,
    creditLimitScopeSql(user),
  ];
  if (filter.limitType && filter.limitType !== "all") {
    conds.push(sql`${creditLimit.limitType} = ${filter.limitType}`);
  }
  if (filter.status === "breach") {
    conds.push(sql`${creditLimit.utilized} > ${creditLimit.limitAmount}`);
  } else if (filter.status === "stale") {
    conds.push(sql`${creditLimit.isStale} = true`);
  } else if (filter.status === "ok") {
    conds.push(sql`${creditLimit.utilized} <= ${creditLimit.limitAmount}`);
  }
  if (filter.q) {
    conds.push(sql`${party.legalName} ILIKE ${`%${filter.q}%`}`);
  }
  const where = sql.join(conds, sql` AND `);

  const [rows, summary] = await Promise.all([
    db.execute<LimitDbRow>(sql`
      SELECT ${creditLimit.creditLimitId} AS credit_limit_id,
             ${creditLimit.partyId} AS party_id,
             ${party.legalName} AS legal_name,
             ${party.displayName} AS display_name,
             ${creditLimit.limitType} AS limit_type,
             ${creditLimit.currencyCode} AS currency_code,
             ${creditLimit.limitAmount}::text AS limit_amount,
             ${creditLimit.utilized}::text AS utilized,
             ${creditLimit.isStale} AS is_stale,
             ${creditLimit.reviewDueDate}::text AS review_due_date
      FROM ${creditLimit}
      INNER JOIN ${party} ON ${party.partyId} = ${creditLimit.partyId}
      WHERE ${where}
      ORDER BY
        CASE WHEN ${creditLimit.utilized} > ${creditLimit.limitAmount} THEN 0 ELSE 1 END,
        ${creditLimit.utilized} DESC NULLS LAST
      LIMIT 500
    `),
    getLimitUtilizationSummary(user),
  ]);

  const now = Date.now();
  const mapped: LimitRow[] = rows.map((r) => {
    const limitAmountCr = num(r.limit_amount);
    const utilizedCr = num(r.utilized);
    const reviewDue = r.review_due_date ? new Date(r.review_due_date) : null;
    const reviewInDays = reviewDue
      ? Math.round((reviewDue.getTime() - now) / (24 * 60 * 60 * 1000))
      : null;
    return {
      creditLimitId: r.credit_limit_id,
      partyId: r.party_id,
      partyName: str(r.display_name) ?? str(r.legal_name) ?? "-",
      limitType: str(r.limit_type) ?? "unknown",
      limitTypeLabel: titleizeEnum(str(r.limit_type)),
      currency: str(r.currency_code) ?? "INR",
      limitAmountCr,
      utilizedCr,
      availableCr: limitAmountCr - utilizedCr,
      utilizationPct: limitAmountCr > 0 ? (utilizedCr / limitAmountCr) * 100 : 0,
      breached: utilizedCr > limitAmountCr && limitAmountCr > 0,
      isStale: Boolean(r.is_stale),
      reviewDueDate: r.review_due_date ?? null,
      reviewInDays,
    };
  });

  return { rows: mapped, summary };
}

// Re-exports for the view layer.
export { modifiedDuration, convexity } from "./risk";
