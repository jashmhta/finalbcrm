// Investor & Client Portals - read-only server-side data access.
//
// Two external-facing portals over the same party master + deals + KYC +
// documents tables the internal CRM uses:
//
//   INVESTOR PORTAL (src/app/portal/investor/*)
//     An investor party sees the bond book Binary placed for it: holdings
//     derived from allocation_event (event_type allocated/settled) joined to
//     the deal, the issuer (deal_party role='issuer'), the instrument (ISIN,
//     coupon, maturity) and the instrument's latest long-term external rating;
//     portfolio value + weighted-avg yield; the full allocation history; KYC
//     status; demat accounts. Sector / rating / tenor / issuer breakdowns feed
//     the donut + bar charts.
//
//   CLIENT PORTAL (src/app/portal/client/*)
//     A client (issuer / borrowing company) sees its engagement with Binary:
//     its deals (deal_party role='issuer') with placed amounts + investor
//     counts; its documents (KYC packs, financials, engagement letters);
//     KYC status + full history; onboarding stage (onboarding_meta JSONB,
//     migration 0007 - read via raw SQL like src/features/onboarding/queries).
//
// Both portals are READ-ONLY - no edit buttons, no server actions. Every query
// is a plain SELECT run against the shared `db` client (RLS is fail-open on the
// read path per 0004_rls_fix). Numeric columns come back as strings from
// postgres-js; the mappers below coerce to plain JSON numbers so payloads
// serialize across the RSC boundary. Dates come back as Date / ISO strings.
//
// Holdings → instrument derivation: allocation_event has no FK to instrument
// (the schema links allocations to a deal mandate, not a security). To surface
// ISIN / coupon / maturity per holding we LATERAL-join the issuer's most-
// recently-issued non-deleted instrument, and that instrument's latest
// long-term external rating (with an issuer-level rating fallback when no
// instrument exists). This is the same defensible read projection the reports +
// portfolio features use; documented inline so the derivation is auditable.

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { can, type CrmUser } from "@/lib/rbac";

// ---------------------------------------------------------------------------
// Shared coercion helpers - postgres-js returns numeric as string, ::int /
// ::float as number, dates as Date. These keep chart mappers NaN-free and
// payloads RSC-serializable.
// ---------------------------------------------------------------------------

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

function dateOrNull(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;
  const d = new Date(v as string);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Normalize a snake_case enum to a display string. */
function titleizeEnum(v: string | null): string {
  if (!v) return "-";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** INR amount → crore (the domestic paper is INR; cross-border is rare here). */
function toCr(amount: number): number {
  return amount / 1e7;
}

function canReadAllPortalParties(
  user?: Pick<CrmUser, "roles" | "permissions"> | null,
) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "party") ||
    can(user, "read_all", "portal") ||
    can(user, "manage", "user")
  );
}

function partyScopeSql(
  alias: "p" | "issuer" = "p",
  user?: CrmUser | null,
) {
  const userId = user?.appUserId;
  if (canReadAllPortalParties(user) || !userId) return sql``;
  if (alias === "issuer") {
    return sql`AND (
      issuer.assigned_user_id = ${userId}
      OR issuer.data_owner_user_id = ${userId}
      OR issuer.created_by_user_id = ${userId}
    )`;
  }
  return sql`AND (
    p.assigned_user_id = ${userId}
    OR p.data_owner_user_id = ${userId}
    OR p.created_by_user_id = ${userId}
  )`;
}

// ---------------------------------------------------------------------------
// Sector family + rating band + tenor bucket - the JS-side classifiers shared
// by the investor holdings breakdown. Mirror the SQL CASE shapes in
// src/features/portfolio/queries so portal charts read on the same axes.
// ---------------------------------------------------------------------------

const SECTOR_FAMILY_PREFIX: ReadonlyArray<[string, string]> = [
  ["infra.", "Infrastructure"],
  ["real_estate.", "Real estate"],
  ["mfg.", "Manufacturing"],
  ["nbfc.", "NBFC"],
  ["services.", "Services"],
];

function sectorFamily(sectorCode: string | null): string {
  if (!sectorCode) return "Unclassified";
  for (const [prefix, label] of SECTOR_FAMILY_PREFIX) {
    if (sectorCode.startsWith(prefix)) return label;
  }
  return "Other";
}

const RATING_BAND_ORDER = [
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

function ratingBand(ratingValue: string | null): string {
  if (!ratingValue) return "Unrated";
  const v = ratingValue.toUpperCase();
  if (v.startsWith("AAA")) return "AAA";
  if (v.startsWith("AA+")) return "AA+";
  if (v.startsWith("AA-")) return "AA-";
  if (v.startsWith("AA")) return "AA";
  if (v.startsWith("A+")) return "A+";
  if (v.startsWith("A-")) return "A-";
  if (v.startsWith("A")) return "A";
  if (v.startsWith("BBB+")) return "BBB+";
  if (v.startsWith("BBB-")) return "BBB-";
  if (v.startsWith("BBB")) return "BBB";
  if (v.startsWith("BB") || v.startsWith("B") || v.startsWith("C") || v.startsWith("D"))
    return "Sub-IG";
  return "Unrated";
}

const TENOR_BUCKET_ORDER = ["0-1Y", "1-3Y", "3-5Y", "5-7Y", "7-10Y", "10Y+"] as const;

function tenorBucket(maturityDate: string | null, now = new Date()): string {
  if (!maturityDate) return "Unknown";
  const m = new Date(maturityDate);
  if (!Number.isFinite(m.getTime())) return "Unknown";
  const years = (m.getTime() - now.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years < 0) return "0-1Y";
  if (years < 1) return "0-1Y";
  if (years < 3) return "1-3Y";
  if (years < 5) return "3-5Y";
  if (years < 7) return "5-7Y";
  if (years < 10) return "7-10Y";
  return "10Y+";
}

/** Aggregate a list of {label, value} into sorted share points. */
function breakdown(
  rows: ReadonlyArray<{ label: string; value: number }>,
  order?: readonly string[],
): { label: string; value: number; sharePct: number }[] {
  const map = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    const v = Math.max(0, r.value);
    map.set(r.label, (map.get(r.label) ?? 0) + v);
    total += v;
  }
  const points = Array.from(map.entries()).map(([label, value]) => ({
    label,
    value: Number(value.toFixed(4)),
    sharePct: total > 0 ? Number(((value / total) * 100).toFixed(2)) : 0,
  }));
  if (order) {
    const idx = new Map(order.map((k, i) => [k, i]));
    points.sort((a, b) => {
      const ia = idx.get(a.label);
      const ib = idx.get(b.label);
      if (ia !== undefined && ib !== undefined) return ia - ib;
      if (ia !== undefined) return -1;
      if (ib !== undefined) return 1;
      return b.value - a.value;
    });
  } else {
    points.sort((a, b) => b.value - a.value);
  }
  return points;
}

// ===========================================================================
// INVESTOR PORTAL
// ===========================================================================

// ---------------------------------------------------------------------------
// listInvestors - the landing directory. Investors = parties typed 'investor'
// (party_type_assignment). Each row carries its holding count, portfolio value
// (sum of allocated/settled amounts), last allocation date, and live KYC
// status so the directory reads as a ranked book, not a flat roster.
// ---------------------------------------------------------------------------

export interface InvestorListItem {
  partyId: string;
  legalName: string;
  displayName: string | null;
  partyNature: string;
  countryOfIncorporation: string;
  kycStatus: string | null;
  holdingCount: number;
  portfolioValueCr: number;
  lastAllocationAt: Date | null;
}

export interface InvestorListSummary {
  totalInvestors: number;
  totalPortfolioValueCr: number;
  investorsWithHoldings: number;
  avgPortfolioValueCr: number;
}

type InvestorListDbRow = {
  party_id: string;
  legal_name: string;
  display_name: string | null;
  party_nature: string;
  country_of_incorporation: string;
  kyc_status: string | null;
  holding_count: string;
  portfolio_value: string | number | null;
  last_allocation_at: Date | string | null;
};

export async function listInvestors(opts: {
  q?: string;
  page?: number;
  pageSize?: number;
  user?: CrmUser | null;
} = {}): Promise<{
  rows: InvestorListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: InvestorListSummary;
}> {
  const pageSize = Math.max(1, Math.min(opts.pageSize ?? 25, 100));
  const page = Math.max(1, opts.page ?? 1);
  const offset = (page - 1) * pageSize;
  const q = opts.q?.trim() || null;
  const ilike = q ? `%${q.replace(/[%_]/g, (m) => "\\" + m)}%` : null;
  const scoped = partyScopeSql("p", opts.user);

  const countRows = await db.execute<{ c: string }>(sql`
    SELECT count(*)::text AS c
    FROM party p
    JOIN party_type_assignment pta
      ON pta.party_id = p.party_id
     AND pta.party_type = 'investor'
     AND pta.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
      ${scoped}
      ${q ? sql`AND (p.legal_name ILIKE ${ilike} OR p.display_name ILIKE ${ilike})` : sql``}
  `);
  const total = Number(countRows[0]?.c ?? 0);

  const rows = await db.execute<InvestorListDbRow>(sql`
    SELECT
      p.party_id,
      p.legal_name,
      p.display_name,
      p.party_nature,
      p.country_of_incorporation,
      k.kyc_status,
      COALESCE(COUNT(ae.allocation_event_id)
        FILTER (WHERE ae.event_type IN ('allocated','settled')), 0)::text AS holding_count,
      COALESCE(SUM(ae.amount)
        FILTER (WHERE ae.event_type IN ('allocated','settled')), 0) AS portfolio_value,
      MAX(ae.event_at) FILTER (WHERE ae.event_type IN ('allocated','settled'))
        AS last_allocation_at
    FROM party p
    JOIN party_type_assignment pta
      ON pta.party_id = p.party_id
     AND pta.party_type = 'investor'
     AND pta.deleted_at IS NULL
    LEFT JOIN allocation_event ae ON ae.party_id = p.party_id
    LEFT JOIN LATERAL (
      SELECT k.status AS kyc_status
      FROM kyc_record k
      WHERE k.party_id = p.party_id AND k.deleted_at IS NULL
      ORDER BY k.created_at DESC
      LIMIT 1
    ) k ON TRUE
    WHERE p.deleted_at IS NULL
      ${scoped}
      ${q ? sql`AND (p.legal_name ILIKE ${ilike} OR p.display_name ILIKE ${ilike})` : sql``}
    GROUP BY
      p.party_id, p.legal_name, p.display_name, p.party_nature,
      p.country_of_incorporation, k.kyc_status
    ORDER BY portfolio_value DESC NULLS LAST, p.legal_name ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const mapped: InvestorListItem[] = rows.map((r) => ({
    partyId: r.party_id,
    legalName: r.legal_name,
    displayName: r.display_name,
    partyNature: r.party_nature,
    countryOfIncorporation: r.country_of_incorporation,
    kycStatus: r.kyc_status,
    holdingCount: Number(r.holding_count ?? 0),
    portfolioValueCr: toCr(num(r.portfolio_value)),
    lastAllocationAt: dateOrNull(r.last_allocation_at),
  }));

  // Summary across ALL matching investors (not just this page).
  const summaryRows = await db.execute<{
    n: string;
    with_h: string;
    total_pv: string | number | null;
  }>(sql`
    SELECT
      count(DISTINCT p.party_id)::text AS n,
      count(DISTINCT p.party_id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM allocation_event ae
          WHERE ae.party_id = p.party_id
            AND ae.event_type IN ('allocated','settled')
        )
      )::text AS with_h,
      COALESCE(SUM(hold.amt), 0) AS total_pv
    FROM party p
    JOIN party_type_assignment pta
      ON pta.party_id = p.party_id
     AND pta.party_type = 'investor'
     AND pta.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(ae.amount), 0) AS amt
      FROM allocation_event ae
      WHERE ae.party_id = p.party_id
        AND ae.event_type IN ('allocated','settled')
    ) hold ON TRUE
    WHERE p.deleted_at IS NULL
      ${scoped}
      ${q ? sql`AND (p.legal_name ILIKE ${ilike} OR p.display_name ILIKE ${ilike})` : sql``}
  `);
  const totalInvestors = Number(summaryRows[0]?.n ?? 0);
  const investorsWithHoldings = Number(summaryRows[0]?.with_h ?? 0);
  const totalPortfolioValueCr = toCr(num(summaryRows[0]?.total_pv));

  return {
    rows: mapped,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    summary: {
      totalInvestors,
      totalPortfolioValueCr,
      investorsWithHoldings,
      avgPortfolioValueCr:
        investorsWithHoldings > 0
          ? Number((totalPortfolioValueCr / investorsWithHoldings).toFixed(2))
          : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// getInvestorDetail - one investor's full read-only portal view.
// ---------------------------------------------------------------------------

export interface InvestorHolding {
  allocationEventId: string;
  dealId: string;
  dealCode: string | null;
  dealName: string | null;
  dealType: string;
  dealStatus: string | null;
  currencyCode: string | null;
  issuerPartyId: string | null;
  issuerName: string | null;
  sectorCode: string | null;
  isin: string | null;
  instrumentType: string | null;
  couponPct: number | null;
  maturityDate: string | null;
  ratingValue: string | null;
  amount: number;
  amountCr: number;
  yieldPct: number | null;
  price: number | null;
  allotmentPct: number | null;
  dematAccountId: string | null;
  dpId: string | null;
  clientId: string | null;
  depository: string | null;
  eventAt: Date;
  eventType: string;
}

export interface InvestorAllocationHistoryRow {
  allocationEventId: string;
  dealId: string;
  dealCode: string | null;
  dealName: string | null;
  dealType: string;
  issuerName: string | null;
  eventType: string;
  amount: number;
  amountCr: number;
  yieldPct: number | null;
  price: number | null;
  eventAt: Date;
}

export interface InvestorDematAccount {
  dematAccountId: string;
  dpId: string;
  clientId: string;
  depository: string;
  accountStatus: string;
  verifiedAt: Date | null;
}

export interface InvestorKyc {
  kycRecordId: string;
  status: string | null;
  kycType: string | null;
  riskRating: string | null;
  validUntil: string | null;
  approvedAt: Date | null;
  cddDoneAt: Date | null;
  highestBoOwnershipPct: number | null;
  sourceOfFundsVerified: boolean;
  sourceOfWealthVerified: boolean;
  createdAt: Date;
}

export interface InvestorPartyInfo {
  partyId: string;
  legalName: string;
  displayName: string | null;
  partyNature: string;
  countryOfIncorporation: string;
  domicileState: string | null;
  status: string;
  brandOrigin: string;
  isListed: boolean;
  listingExchange: string | null;
  ticker: string | null;
  kycRiskRating: string | null;
  isKycComplete: boolean;
  identifiers: { type: string; value: string; isPrimary: boolean }[];
  city: string | null;
}

export interface BreakdownPoint {
  label: string;
  value: number;
  sharePct: number;
}

export interface InvestorDetail {
  party: InvestorPartyInfo;
  holdings: InvestorHolding[];
  allocationHistory: InvestorAllocationHistoryRow[];
  dematAccounts: InvestorDematAccount[];
  kyc: InvestorKyc | null;
  bySector: BreakdownPoint[];
  byRating: BreakdownPoint[];
  byTenor: BreakdownPoint[];
  byIssuer: BreakdownPoint[];
  summary: {
    totalValueCr: number;
    weightedAvgYieldPct: number | null;
    holdingCount: number;
    issuerCount: number;
    dematCount: number;
    avgCouponPct: number | null;
  };
}

type HoldingDbRow = {
  allocation_event_id: string;
  deal_id: string;
  deal_code: string | null;
  deal_name: string | null;
  deal_type: string;
  deal_status: string | null;
  currency_code: string | null;
  issuer_party_id: string | null;
  issuer_name: string | null;
  sector_code: string | null;
  isin: string | null;
  instrument_type: string | null;
  coupon_pct: string | number | null;
  maturity_date: string | null;
  rating_value: string | null;
  amount: string | number | null;
  yield_pct: string | number | null;
  price: string | number | null;
  allotment_pct: string | number | null;
  demat_account_id: string | null;
  dp_id: string | null;
  client_id: string | null;
  depository: string | null;
  event_at: Date;
  event_type: string;
};

export async function getInvestorDetail(
  partyId: string,
  user?: CrmUser | null,
): Promise<InvestorDetail | null> {
  const scoped = partyScopeSql("p", user);
  // 1. Party + identifiers + current registered address (parallelizable with
  //    the holdings query - issued as separate round-trips for clarity).
  const partyRows = await db.execute<{
    party_id: string;
    legal_name: string;
    display_name: string | null;
    party_nature: string;
    country_of_incorporation: string;
    domicile_state: string | null;
    status: string;
    brand_origin: string;
    is_listed: boolean;
    listing_exchange: string | null;
    ticker: string | null;
    kyc_risk_rating: string | null;
    is_kyc_complete: boolean;
    city: string | null;
  }>(sql`
    SELECT
      p.party_id, p.legal_name, p.display_name, p.party_nature,
      p.country_of_incorporation, p.domicile_state, p.status, p.brand_origin,
      p.is_listed, p.listing_exchange, p.ticker, p.kyc_risk_rating,
      COALESCE(p.is_kyc_complete, false) AS is_kyc_complete,
      a.city
    FROM party p
    LEFT JOIN LATERAL (
      SELECT a.city FROM address a
      WHERE a.party_id = p.party_id AND a.is_current AND a.deleted_at IS NULL
      ORDER BY (a.address_type = 'registered') DESC, a.created_at DESC
      LIMIT 1
    ) a ON TRUE
    WHERE p.party_id = ${partyId}
      AND p.deleted_at IS NULL
      ${scoped}
      AND EXISTS (
        SELECT 1
        FROM party_type_assignment pta
        WHERE pta.party_id = p.party_id
          AND pta.party_type = 'investor'
          AND pta.deleted_at IS NULL
      )
  `);
  const pr = partyRows[0];
  if (!pr) return null;

  const identifierRows = await db.execute<{
    identifier_type: string;
    identifier_value: string;
    is_primary: boolean;
  }>(sql`
    SELECT identifier_type, identifier_value, COALESCE(is_primary, false) AS is_primary
    FROM party_identifier
    WHERE party_id = ${partyId} AND deleted_at IS NULL
    ORDER BY is_primary DESC, identifier_type
  `);

  // 2. Holdings - allocated/settled events with deal + issuer + instrument +
  //    rating + demat. The instrument is the issuer's most-recent non-deleted
  //    security; the rating is that instrument's latest long-term external
  //    rating, falling back to an issuer-level rating when no instrument exists.
  const holdingRows = await db.execute<HoldingDbRow>(sql`
    SELECT
      ae.allocation_event_id, ae.deal_id, ae.event_type, ae.amount, ae.yield_pct,
      ae.price, ae.allotment_pct, ae.demat_account_id, ae.event_at,
      d.deal_code, d.deal_name, d.deal_type, d.currency_code, d.status AS deal_status,
      dp_issuer.party_id AS issuer_party_id,
      issuer.legal_name AS issuer_name,
      sc.code AS sector_code,
      inst.isin, inst.instrument_type, inst.coupon_pct, inst.maturity_date,
      rtg.rating_value,
      da.dp_id, da.client_id, da.depository
    FROM allocation_event ae
    JOIN deal d ON d.deal_id = ae.deal_id AND d.deleted_at IS NULL
    LEFT JOIN deal_party dp_issuer
      ON dp_issuer.deal_id = ae.deal_id
     AND dp_issuer.role = 'issuer'
     AND dp_issuer.deleted_at IS NULL
    LEFT JOIN party issuer ON issuer.party_id = dp_issuer.party_id
    LEFT JOIN sector_code sc
      ON sc.sector_code_id = issuer.industry_segment_id AND sc.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT i.isin, i.instrument_type, i.coupon_pct, i.maturity_date
      FROM instrument i
      WHERE i.issuer_party_id = issuer.party_id AND i.deleted_at IS NULL
      ORDER BY i.issue_date DESC NULLS LAST, i.created_at DESC
      LIMIT 1
    ) inst ON TRUE
    LEFT JOIN LATERAL (
      SELECT er.rating_value
      FROM external_rating er
      WHERE (
              (er.instrument_id IS NOT NULL AND er.instrument_id = (
                SELECT i2.instrument_id FROM instrument i2
                WHERE i2.issuer_party_id = issuer.party_id AND i2.deleted_at IS NULL
                ORDER BY i2.issue_date DESC NULLS LAST, i2.created_at DESC LIMIT 1
              ))
           OR (inst.isin IS NULL AND er.party_id = issuer.party_id
               AND er.instrument_id IS NULL)
            )
        AND er.rating_scale = 'long_term'
        AND er.withdrawn_date IS NULL
        AND er.deleted_at IS NULL
      ORDER BY er.effective_date DESC
      LIMIT 1
    ) rtg ON TRUE
    LEFT JOIN demat_account da ON da.demat_account_id = ae.demat_account_id
    WHERE ae.party_id = ${partyId}
      AND ae.event_type IN ('allocated','settled')
    ORDER BY ae.event_at DESC, d.deal_code
  `);

  const holdings: InvestorHolding[] = holdingRows.map((r) => {
    const amount = num(r.amount);
    return {
      allocationEventId: r.allocation_event_id,
      dealId: r.deal_id,
      dealCode: r.deal_code,
      dealName: r.deal_name,
      dealType: r.deal_type,
      dealStatus: r.deal_status,
      currencyCode: r.currency_code,
      issuerPartyId: r.issuer_party_id,
      issuerName: r.issuer_name,
      sectorCode: r.sector_code,
      isin: r.isin,
      instrumentType: r.instrument_type,
      couponPct: numOrNull(r.coupon_pct),
      maturityDate: r.maturity_date,
      ratingValue: r.rating_value,
      amount,
      amountCr: toCr(amount),
      yieldPct: numOrNull(r.yield_pct),
      price: numOrNull(r.price),
      allotmentPct: numOrNull(r.allotment_pct),
      dematAccountId: r.demat_account_id,
      dpId: r.dp_id,
      clientId: r.client_id,
      depository: r.depository,
      eventAt: r.event_at,
      eventType: r.event_type,
    };
  });

  // 3. Allocation history - ALL events (indications, orders, allocations,
  //    revisions, withdrawals) so the investor sees the full placement trail.
  const historyRows = await db.execute<{
    allocation_event_id: string;
    deal_id: string;
    deal_code: string | null;
    deal_name: string | null;
    deal_type: string;
    issuer_name: string | null;
    event_type: string;
    amount: string | number | null;
    yield_pct: string | number | null;
    price: string | number | null;
    event_at: Date;
  }>(sql`
    SELECT
      ae.allocation_event_id, ae.deal_id, ae.event_type, ae.amount, ae.yield_pct,
      ae.price, ae.event_at,
      d.deal_code, d.deal_name, d.deal_type,
      issuer.legal_name AS issuer_name
    FROM allocation_event ae
    JOIN deal d ON d.deal_id = ae.deal_id AND d.deleted_at IS NULL
    LEFT JOIN deal_party dp_issuer
      ON dp_issuer.deal_id = ae.deal_id
     AND dp_issuer.role = 'issuer'
     AND dp_issuer.deleted_at IS NULL
    LEFT JOIN party issuer ON issuer.party_id = dp_issuer.party_id
    WHERE ae.party_id = ${partyId}
    ORDER BY ae.event_at DESC, ae.created_at DESC
    LIMIT 200
  `);
  const allocationHistory: InvestorAllocationHistoryRow[] = historyRows.map((r) => {
    const amount = num(r.amount);
    return {
      allocationEventId: r.allocation_event_id,
      dealId: r.deal_id,
      dealCode: r.deal_code,
      dealName: r.deal_name,
      dealType: r.deal_type,
      issuerName: r.issuer_name,
      eventType: r.event_type,
      amount,
      amountCr: toCr(amount),
      yieldPct: numOrNull(r.yield_pct),
      price: numOrNull(r.price),
      eventAt: r.event_at,
    };
  });

  // 4. Demat accounts for the investor.
  const dematRows = await db.execute<{
    demat_account_id: string;
    dp_id: string;
    client_id: string;
    depository: string;
    account_status: string;
    verified_at: Date | null;
  }>(sql`
    SELECT demat_account_id, dp_id, client_id, depository, account_status, verified_at
    FROM demat_account
    WHERE party_id = ${partyId} AND deleted_at IS NULL
    ORDER BY (account_status = 'active') DESC, created_at DESC
  `);
  const dematAccounts: InvestorDematAccount[] = dematRows.map((r) => ({
    dematAccountId: r.demat_account_id,
    dpId: r.dp_id,
    clientId: r.client_id,
    depository: r.depository,
    accountStatus: r.account_status,
    verifiedAt: dateOrNull(r.verified_at),
  }));

  // 5. KYC - latest kyc_record for the investor party.
  const kycRows = await db.execute<{
    kyc_record_id: string;
    status: string | null;
    kyc_type: string | null;
    risk_rating: string | null;
    valid_until: string | null;
    approved_at: Date | null;
    cdd_done_at: Date | null;
    highest_bo_ownership_pct: string | number | null;
    source_of_funds_verified: boolean;
    source_of_wealth_verified: boolean;
    created_at: Date;
  }>(sql`
    SELECT
      kyc_record_id, status, kyc_type, risk_rating, valid_until, approved_at,
      cdd_done_at, highest_bo_ownership_pct,
      COALESCE(source_of_funds_verified, false) AS source_of_funds_verified,
      COALESCE(source_of_wealth_verified, false) AS source_of_wealth_verified,
      created_at
    FROM kyc_record
    WHERE party_id = ${partyId} AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const k = kycRows[0];
  const kyc: InvestorKyc | null = k
    ? {
        kycRecordId: k.kyc_record_id,
        status: k.status,
        kycType: k.kyc_type,
        riskRating: k.risk_rating,
        validUntil: k.valid_until,
        approvedAt: dateOrNull(k.approved_at),
        cddDoneAt: dateOrNull(k.cdd_done_at),
        highestBoOwnershipPct: numOrNull(k.highest_bo_ownership_pct),
        sourceOfFundsVerified: !!k.source_of_funds_verified,
        sourceOfWealthVerified: !!k.source_of_wealth_verified,
        createdAt: k.created_at,
      }
    : null;

  // 6. Breakdowns - computed in JS from the holdings (single-investor set is
  //    small; avoids N more GROUP-BY round-trips).
  const bySector = breakdown(
    holdings.map((h) => ({ label: sectorFamily(h.sectorCode), value: h.amountCr })),
  ).filter((p) => p.value > 0);
  const byRating = breakdown(
    holdings.map((h) => ({ label: ratingBand(h.ratingValue), value: h.amountCr })),
    RATING_BAND_ORDER,
  ).filter((p) => p.value > 0);
  const byTenor = breakdown(
    holdings.map((h) => ({
      label: tenorBucket(h.maturityDate),
      value: h.amountCr,
    })),
    TENOR_BUCKET_ORDER,
  ).filter((p) => p.value > 0);
  const byIssuer = breakdown(
    holdings
      .filter((h) => h.issuerName)
      .map((h) => ({ label: h.issuerName as string, value: h.amountCr })),
  ).slice(0, 10);

  // 7. Summary KPIs.
  const totalValueCr = Number(
    holdings.reduce((a, h) => a + h.amountCr, 0).toFixed(4),
  );
  const yieldWeighted = holdings.reduce(
    (acc, h) => acc + (h.yieldPct ?? 0) * h.amountCr,
    0,
  );
  const yieldBase = holdings.reduce(
    (acc, h) => acc + (h.yieldPct != null ? h.amountCr : 0),
    0,
  );
  const weightedAvgYieldPct =
    yieldBase > 0 ? Number((yieldWeighted / yieldBase).toFixed(2)) : null;
  const couponBase = holdings.reduce(
    (acc, h) => acc + (h.couponPct != null ? h.amountCr : 0),
    0,
  );
  const couponWeighted = holdings.reduce(
    (acc, h) => acc + (h.couponPct ?? 0) * h.amountCr,
    0,
  );
  const avgCouponPct =
    couponBase > 0 ? Number((couponWeighted / couponBase).toFixed(2)) : null;
  const issuerCount = new Set(
    holdings.map((h) => h.issuerPartyId).filter(Boolean),
  ).size;

  return {
    party: {
      partyId: pr.party_id,
      legalName: pr.legal_name,
      displayName: pr.display_name,
      partyNature: pr.party_nature,
      countryOfIncorporation: pr.country_of_incorporation,
      domicileState: pr.domicile_state,
      status: pr.status,
      brandOrigin: pr.brand_origin,
      isListed: !!pr.is_listed,
      listingExchange: pr.listing_exchange,
      ticker: pr.ticker,
      kycRiskRating: pr.kyc_risk_rating,
      isKycComplete: !!pr.is_kyc_complete,
      identifiers: identifierRows.map((r) => ({
        type: r.identifier_type,
        value: r.identifier_value,
        isPrimary: !!r.is_primary,
      })),
      city: pr.city,
    },
    holdings,
    allocationHistory,
    dematAccounts,
    kyc,
    bySector,
    byRating,
    byTenor,
    byIssuer,
    summary: {
      totalValueCr,
      weightedAvgYieldPct,
      holdingCount: holdings.length,
      issuerCount,
      dematCount: dematAccounts.length,
      avgCouponPct,
    },
  };
}

// ===========================================================================
// CLIENT PORTAL
// ===========================================================================

// ---------------------------------------------------------------------------
// listClients - the landing directory. Clients = parties that appear as
// role='issuer' on a deal (the borrowing company Binary is advising / placing
// paper for). Each row carries deal count, active deal count, total raised
// (sum of target_size across its issuer deals), onboarding stage, KYC status.
// ---------------------------------------------------------------------------

export interface ClientListItem {
  partyId: string;
  legalName: string;
  displayName: string | null;
  partyNature: string;
  countryOfIncorporation: string;
  kycStatus: string | null;
  dealCount: number;
  activeDealCount: number;
  totalRaisedCr: number;
  onboardingStage: string | null;
}

export interface ClientListSummary {
  totalClients: number;
  totalDeals: number;
  totalRaisedCr: number;
  avgDealsPerClient: number;
}

type ClientListDbRow = {
  party_id: string;
  legal_name: string;
  display_name: string | null;
  party_nature: string;
  country_of_incorporation: string;
  kyc_status: string | null;
  deal_count: string;
  active_deal_count: string;
  total_raised: string | number | null;
  onboarding_stage: string | null;
};

export async function listClients(opts: {
  q?: string;
  page?: number;
  pageSize?: number;
  user?: CrmUser | null;
} = {}): Promise<{
  rows: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: ClientListSummary;
}> {
  const pageSize = Math.max(1, Math.min(opts.pageSize ?? 25, 100));
  const page = Math.max(1, opts.page ?? 1);
  const offset = (page - 1) * pageSize;
  const q = opts.q?.trim() || null;
  const ilike = q ? `%${q.replace(/[%_]/g, (m) => "\\" + m)}%` : null;
  const scoped = partyScopeSql("p", opts.user);

  const countRows = await db.execute<{ c: string }>(sql`
    SELECT count(DISTINCT p.party_id)::text AS c
    FROM party p
    JOIN deal_party dp
      ON dp.party_id = p.party_id AND dp.role = 'issuer' AND dp.deleted_at IS NULL
    JOIN deal d ON d.deal_id = dp.deal_id AND d.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
      ${scoped}
      ${q ? sql`AND (p.legal_name ILIKE ${ilike} OR p.display_name ILIKE ${ilike})` : sql``}
  `);
  const total = Number(countRows[0]?.c ?? 0);

  const rows = await db.execute<ClientListDbRow>(sql`
    SELECT
      p.party_id,
      p.legal_name,
      p.display_name,
      p.party_nature,
      p.country_of_incorporation,
      k.kyc_status,
      COUNT(DISTINCT dp.deal_id)::text AS deal_count,
      COUNT(DISTINCT dp.deal_id) FILTER (
        WHERE d.status IN ('mandated','in_dd','structuring','rating_marketing',
                           'pricing','allocation')
      )::text AS active_deal_count,
      COALESCE(SUM(d.target_size) FILTER (WHERE dp.role = 'issuer'), 0) AS total_raised,
      p.onboarding_meta->>'stage' AS onboarding_stage
    FROM party p
    JOIN deal_party dp
      ON dp.party_id = p.party_id AND dp.role = 'issuer' AND dp.deleted_at IS NULL
    JOIN deal d ON d.deal_id = dp.deal_id AND d.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT k.status AS kyc_status
      FROM kyc_record k
      WHERE k.party_id = p.party_id AND k.deleted_at IS NULL
      ORDER BY k.created_at DESC
      LIMIT 1
    ) k ON TRUE
    WHERE p.deleted_at IS NULL
      ${scoped}
      ${q ? sql`AND (p.legal_name ILIKE ${ilike} OR p.display_name ILIKE ${ilike})` : sql``}
    GROUP BY
      p.party_id, p.legal_name, p.display_name, p.party_nature,
      p.country_of_incorporation, k.kyc_status, p.onboarding_meta
    ORDER BY total_raised DESC NULLS LAST, p.legal_name ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const mapped: ClientListItem[] = rows.map((r) => ({
    partyId: r.party_id,
    legalName: r.legal_name,
    displayName: r.display_name,
    partyNature: r.party_nature,
    countryOfIncorporation: r.country_of_incorporation,
    kycStatus: r.kyc_status,
    dealCount: Number(r.deal_count ?? 0),
    activeDealCount: Number(r.active_deal_count ?? 0),
    totalRaisedCr: toCr(num(r.total_raised)),
    onboardingStage: r.onboarding_stage,
  }));

  const summaryRows = await db.execute<{
    n: string;
    d: string;
    total_raised: string | number | null;
  }>(sql`
    SELECT
      count(DISTINCT p.party_id)::text AS n,
      count(DISTINCT dp.deal_id)::text AS d,
      COALESCE(SUM(d.target_size), 0) AS total_raised
    FROM party p
    JOIN deal_party dp
      ON dp.party_id = p.party_id AND dp.role = 'issuer' AND dp.deleted_at IS NULL
    JOIN deal d ON d.deal_id = dp.deal_id AND d.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
      ${scoped}
      ${q ? sql`AND (p.legal_name ILIKE ${ilike} OR p.display_name ILIKE ${ilike})` : sql``}
  `);
  const totalClients = Number(summaryRows[0]?.n ?? 0);
  const totalDeals = Number(summaryRows[0]?.d ?? 0);
  const totalRaisedCr = toCr(num(summaryRows[0]?.total_raised));

  return {
    rows: mapped,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    summary: {
      totalClients,
      totalDeals,
      totalRaisedCr,
      avgDealsPerClient:
        totalClients > 0
          ? Number((totalDeals / totalClients).toFixed(2))
          : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// getClientDetail - one client's full read-only engagement view.
// ---------------------------------------------------------------------------

export interface ClientDealRow {
  dealId: string;
  dealCode: string | null;
  dealName: string | null;
  dealType: string;
  dealSubtype: string | null;
  status: string | null;
  brand: string;
  targetSize: number;
  targetSizeCr: number;
  currencyCode: string | null;
  targetCloseDate: string | null;
  actualCloseDate: string | null;
  targetTenorYears: number | null;
  allocatedCr: number;
  investorCount: number;
}

export interface ClientDocumentRow {
  documentId: string;
  documentType: string | null;
  kycCategory: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  isConfidential: boolean;
  isMnpi: boolean;
  createdAt: Date;
}

export interface ClientKycRow {
  kycRecordId: string;
  status: string | null;
  kycType: string | null;
  riskRating: string | null;
  validUntil: string | null;
  approvedAt: Date | null;
  cddDoneAt: Date | null;
  eddReason: string | null;
  highestBoOwnershipPct: number | null;
  sourceOfFundsVerified: boolean;
  sourceOfWealthVerified: boolean;
  createdAt: Date;
}

export interface ClientContactRow {
  contactId: string;
  fullName: string;
  role: string | null;
  designation: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  isPrimary: boolean;
}

export interface ClientDetail {
  party: InvestorPartyInfo; // same shape as investor (party master + identifiers)
  deals: ClientDealRow[];
  documents: ClientDocumentRow[];
  kycHistory: ClientKycRow[];
  kycCurrent: ClientKycRow | null;
  onboardingStage: string | null;
  contacts: ClientContactRow[];
  summary: {
    dealCount: number;
    activeDealCount: number;
    settledDealCount: number;
    totalRaisedCr: number;
    totalAllocatedCr: number;
    documentCount: number;
    investorCount: number;
  };
}

type ClientDealDbRow = {
  deal_id: string;
  deal_code: string | null;
  deal_name: string | null;
  deal_type: string;
  deal_subtype: string | null;
  status: string | null;
  brand: string;
  target_size: string | number | null;
  currency_code: string | null;
  target_close_date: string | null;
  actual_close_date: string | null;
  target_tenor_years: string | number | null;
  allocated: string | number | null;
  investor_count: string;
};

export async function getClientDetail(
  partyId: string,
  user?: CrmUser | null,
): Promise<ClientDetail | null> {
  const scoped = partyScopeSql("p", user);
  // 1. Party + identifiers + current registered address (reuses the investor
  //    party query shape - same party master).
  const partyRows = await db.execute<{
    party_id: string;
    legal_name: string;
    display_name: string | null;
    party_nature: string;
    country_of_incorporation: string;
    domicile_state: string | null;
    status: string;
    brand_origin: string;
    is_listed: boolean;
    listing_exchange: string | null;
    ticker: string | null;
    kyc_risk_rating: string | null;
    is_kyc_complete: boolean;
    city: string | null;
    onboarding_stage: string | null;
  }>(sql`
    SELECT
      p.party_id, p.legal_name, p.display_name, p.party_nature,
      p.country_of_incorporation, p.domicile_state, p.status, p.brand_origin,
      p.is_listed, p.listing_exchange, p.ticker, p.kyc_risk_rating,
      COALESCE(p.is_kyc_complete, false) AS is_kyc_complete,
      a.city,
      p.onboarding_meta->>'stage' AS onboarding_stage
    FROM party p
    LEFT JOIN LATERAL (
      SELECT a.city FROM address a
      WHERE a.party_id = p.party_id AND a.is_current AND a.deleted_at IS NULL
      ORDER BY (a.address_type = 'registered') DESC, a.created_at DESC
      LIMIT 1
    ) a ON TRUE
    WHERE p.party_id = ${partyId}
      AND p.deleted_at IS NULL
      ${scoped}
      AND EXISTS (
        SELECT 1
        FROM deal_party dp_check
        JOIN deal d_check
          ON d_check.deal_id = dp_check.deal_id
         AND d_check.deleted_at IS NULL
        WHERE dp_check.party_id = p.party_id
          AND dp_check.role = 'issuer'
          AND dp_check.deleted_at IS NULL
      )
  `);
  const pr = partyRows[0];
  if (!pr) return null;

  const identifierRows = await db.execute<{
    identifier_type: string;
    identifier_value: string;
    is_primary: boolean;
  }>(sql`
    SELECT identifier_type, identifier_value, COALESCE(is_primary, false) AS is_primary
    FROM party_identifier
    WHERE party_id = ${partyId} AND deleted_at IS NULL
    ORDER BY is_primary DESC, identifier_type
  `);

  // 2. Deals where the client is the issuer, with placed amount + investor
  //    count. placed amount = sum of allocation_event.amount (allocated/settled)
  //    on the deal; investor count = distinct parties with an allocated/settled
  //    event on the deal.
  const dealRows = await db.execute<ClientDealDbRow>(sql`
    SELECT
      d.deal_id, d.deal_code, d.deal_name, d.deal_type, d.deal_subtype,
      d.status, d.brand, d.target_size, d.currency_code, d.target_close_date,
      d.actual_close_date, d.target_tenor_years,
      COALESCE(placed.amt, 0) AS allocated,
      COALESCE(placed.inv_count, 0)::text AS investor_count
    FROM deal d
    JOIN deal_party dp
      ON dp.deal_id = d.deal_id AND dp.role = 'issuer' AND dp.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(ae.amount), 0) AS amt,
        COUNT(DISTINCT ae.party_id) AS inv_count
      FROM allocation_event ae
      WHERE ae.deal_id = d.deal_id
        AND ae.event_type IN ('allocated','settled')
    ) placed ON TRUE
    WHERE dp.party_id = ${partyId} AND d.deleted_at IS NULL
    ORDER BY d.actual_close_date DESC NULLS LAST, d.target_close_date DESC NULLS LAST,
             d.deal_code
  `);
  const deals: ClientDealRow[] = dealRows.map((r) => {
    const targetSize = num(r.target_size);
    return {
      dealId: r.deal_id,
      dealCode: r.deal_code,
      dealName: r.deal_name,
      dealType: r.deal_type,
      dealSubtype: r.deal_subtype,
      status: r.status,
      brand: r.brand,
      targetSize,
      targetSizeCr: toCr(targetSize),
      currencyCode: r.currency_code,
      targetCloseDate: r.target_close_date,
      actualCloseDate: r.actual_close_date,
      targetTenorYears: numOrNull(r.target_tenor_years),
      allocatedCr: toCr(num(r.allocated)),
      investorCount: Number(r.investor_count ?? 0),
    };
  });

  // 3. Documents anchored to the client party (KYC packs, financials, mandate
  //    letters, etc.). MNPI + confidential flags surfaced so the portal can
  //    show access caveats without exposing a download in a read-only view.
  const docRows = await db.execute<{
    document_id: string;
    document_type: string | null;
    kyc_category: string | null;
    file_name: string | null;
    mime_type: string | null;
    size_bytes: number | null;
    is_confidential: boolean;
    is_mnpi: boolean;
    created_at: Date;
  }>(sql`
    SELECT
      document_id, document_type, kyc_category, file_name, mime_type, size_bytes,
      COALESCE(is_confidential, false) AS is_confidential,
      COALESCE(is_mnpi, false) AS is_mnpi,
      created_at
    FROM document
    WHERE party_id = ${partyId} AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 200
  `);
  const documents: ClientDocumentRow[] = docRows.map((r) => ({
    documentId: r.document_id,
    documentType: r.document_type,
    kycCategory: r.kyc_category,
    fileName: r.file_name,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes ?? null,
    isConfidential: !!r.is_confidential,
    isMnpi: !!r.is_mnpi,
    createdAt: r.created_at,
  }));

  // 4. KYC history - every kyc_record for the client party, newest first.
  const kycRows = await db.execute<{
    kyc_record_id: string;
    status: string | null;
    kyc_type: string | null;
    risk_rating: string | null;
    valid_until: string | null;
    approved_at: Date | null;
    cdd_done_at: Date | null;
    edd_reason: string | null;
    highest_bo_ownership_pct: string | number | null;
    source_of_funds_verified: boolean;
    source_of_wealth_verified: boolean;
    created_at: Date;
  }>(sql`
    SELECT
      kyc_record_id, status, kyc_type, risk_rating, valid_until, approved_at,
      cdd_done_at, edd_reason, highest_bo_ownership_pct,
      COALESCE(source_of_funds_verified, false) AS source_of_funds_verified,
      COALESCE(source_of_wealth_verified, false) AS source_of_wealth_verified,
      created_at
    FROM kyc_record
    WHERE party_id = ${partyId} AND deleted_at IS NULL
    ORDER BY created_at DESC
  `);
  const kycHistory: ClientKycRow[] = kycRows.map((r) => ({
    kycRecordId: r.kyc_record_id,
    status: r.status,
    kycType: r.kyc_type,
    riskRating: r.risk_rating,
    validUntil: r.valid_until,
    approvedAt: dateOrNull(r.approved_at),
    cddDoneAt: dateOrNull(r.cdd_done_at),
    eddReason: r.edd_reason,
    highestBoOwnershipPct: numOrNull(r.highest_bo_ownership_pct),
    sourceOfFundsVerified: !!r.source_of_funds_verified,
    sourceOfWealthVerified: !!r.source_of_wealth_verified,
    createdAt: r.created_at,
  }));
  const kycCurrent = kycHistory[0] ?? null;

  // 5. Contacts - the client's primary people (party_contact join).
  const contactRows = await db.execute<{
    contact_id: string;
    full_name: string;
    role: string | null;
    designation: string | null;
    primary_email: string | null;
    primary_phone: string | null;
    is_primary: boolean;
  }>(sql`
    SELECT
      c.contact_id, c.full_name, pc.role, c.designation,
      c.primary_email, c.primary_phone,
      COALESCE(pc.is_primary, false) AS is_primary
    FROM party_contact pc
    JOIN contact c ON c.contact_id = pc.contact_id
    WHERE pc.party_id = ${partyId}
      AND pc.deleted_at IS NULL
      AND pc.valid_to IS NULL
      AND c.deleted_at IS NULL
    ORDER BY pc.is_primary DESC, pc.role, c.full_name
    LIMIT 25
  `);
  const contacts: ClientContactRow[] = contactRows.map((r) => ({
    contactId: r.contact_id,
    fullName: r.full_name,
    role: r.role,
    designation: r.designation,
    primaryEmail: r.primary_email,
    primaryPhone: r.primary_phone,
    isPrimary: !!r.is_primary,
  }));

  // 6. Summary KPIs.
  const activeStatuses = new Set([
    "mandated",
    "in_dd",
    "structuring",
    "rating_marketing",
    "pricing",
    "allocation",
  ]);
  const activeDealCount = deals.filter((d) =>
    d.status ? activeStatuses.has(d.status) : false,
  ).length;
  const settledDealCount = deals.filter((d) =>
    d.status ? ["settled", "closed"].includes(d.status) : false,
  ).length;
  const totalRaisedCr = Number(
    deals.reduce((a, d) => a + d.targetSizeCr, 0).toFixed(4),
  );
  const totalAllocatedCr = Number(
    deals.reduce((a, d) => a + d.allocatedCr, 0).toFixed(4),
  );
  const investorCount = new Set(
    deals.flatMap((d) => (d.investorCount > 0 ? [d.dealId] : [])),
  ).size;

  return {
    party: {
      partyId: pr.party_id,
      legalName: pr.legal_name,
      displayName: pr.display_name,
      partyNature: pr.party_nature,
      countryOfIncorporation: pr.country_of_incorporation,
      domicileState: pr.domicile_state,
      status: pr.status,
      brandOrigin: pr.brand_origin,
      isListed: !!pr.is_listed,
      listingExchange: pr.listing_exchange,
      ticker: pr.ticker,
      kycRiskRating: pr.kyc_risk_rating,
      isKycComplete: !!pr.is_kyc_complete,
      identifiers: identifierRows.map((r) => ({
        type: r.identifier_type,
        value: r.identifier_value,
        isPrimary: !!r.is_primary,
      })),
      city: pr.city,
    },
    deals,
    documents,
    kycHistory,
    kycCurrent,
    onboardingStage: pr.onboarding_stage,
    contacts,
    summary: {
      dealCount: deals.length,
      activeDealCount,
      settledDealCount,
      totalRaisedCr,
      totalAllocatedCr,
      documentCount: documents.length,
      investorCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Display helpers re-exported for the view layer (enum → label).
// ---------------------------------------------------------------------------

export const PORTAL_ENUM_LABELS = {
  titleizeEnum,
  ratingBand,
  sectorFamily,
  tenorBucket,
  RATING_BAND_ORDER,
  TENOR_BUCKET_ORDER,
};
