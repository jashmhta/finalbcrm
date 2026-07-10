// Server-side deal data access. Pipeline view: deals grouped by status with
// their deal_party parties inlined.
//
// PAGINATION: the pipeline is capped at `perStage` deals per status via a
// ROW_NUMBER() window (default 40 - see DEFAULT_PER_STAGE). A total LIMIT would
// pile the first N deals into the earliest stage and leave later stages empty,
// which breaks the kanban's balanced funnel; partitioning by status keeps every
// column populated up to the cap. `total` is the full non-deleted deal count so
// the board can show "Showing 180 of 1,500 - use search to find more". The
// client view (deals-board-view) further caps the rendered cards per column at
// 20 with a "Load more" reveal, so the initial paint is fast even when a stage
// fills its 40-deal cap.

import { and, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { deal, dealParty, party } from "@/db/schema";
import { can, type CrmUser } from "@/lib/rbac";

export interface DealPipelineRow {
  dealId: string;
  dealCode: string | null;
  dealName: string | null;
  dealType: string;
  status: string | null;
  brand: string;
  targetSize: string | null;
  currencyCode: string | null;
  // Target close + tenor drive the card's target-close line + the preview
  // pane's mandate-readout. Same table, no join - a minimal additive extension
  // that the view layer derives the "when / how long" pipeline signals from.
  targetCloseDate: string | null;
  targetTenorYears: string | null;
  leadUserId: string | null;
  creditAnalystUserId: string | null;
  parties: {
    partyId: string;
    legalName: string;
    role: string;
    isLead: boolean | null;
  }[];
}

export interface DealPipelineGroup {
  status: string;
  deals: DealPipelineRow[];
}

/** Result of getDealPipeline - the grouped, per-stage-capped pipeline plus the
 *  full non-deleted deal count for the "Showing X of Y" indicator. */
export interface DealPipelineResult {
  groups: DealPipelineGroup[];
  total: number;
}

export interface DealPipelineFilters {
  q?: string;
  type?: string;
  status?: string;
  brand?: string;
  leadUserId?: string;
  creditAnalystUserId?: string;
  partyId?: string;
  turnover?: string;
  sector?: string;
  rating?: string;
  agency?: string;
  investorType?: string;
  portfolioSize?: string;
  riskAppetite?: string;
  highYield?: boolean;
}

/**
 * Default per-stage cap. 40 deals per status × ~11 statuses (9 pipeline + 2
 * off-pipeline) = a worst-case ~440 rows, which is a fast single round-trip +
 * a light party join. The client view renders 20 per column with a "Load more"
 * reveal, so 40 gives the user one click of headroom before they hit the cap.
 */
export const DEFAULT_PER_STAGE = 40;

/** Raw row shape returned by the per-stage window query (snake_case columns). */
type DealDbRow = {
  deal_id: string;
  deal_code: string | null;
  deal_name: string | null;
  deal_type: string;
  status: string | null;
  brand: string;
  target_size: string | null;
  currency_code: string | null;
  target_close_date: string | null;
  target_tenor_years: string | null;
  lead_user_id: string | null;
  credit_analyst_user_id: string | null;
};

function canReadAllDeals(user?: Pick<CrmUser, "roles" | "permissions"> | null) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "deal") ||
    can(user, "manage", "user")
  );
}

function buildDealWhere({
  filters,
  user,
}: {
  filters: DealPipelineFilters;
  user?: CrmUser | null;
}): SQL {
  const clauses: SQL[] = [sql`d.deleted_at IS NULL`];
  const scopedUserId = user?.appUserId;

  if (!canReadAllDeals(user) && scopedUserId) {
    clauses.push(sql`(
      d.lead_user_id = ${scopedUserId}
      OR d.credit_analyst_user_id = ${scopedUserId}
      OR d.created_by_user_id = ${scopedUserId}
      OR EXISTS (
        SELECT 1
        FROM deal_party dp_scope
        JOIN party p_scope ON p_scope.party_id = dp_scope.party_id
        WHERE dp_scope.deal_id = d.deal_id
          AND dp_scope.deleted_at IS NULL
          AND p_scope.deleted_at IS NULL
          AND (
            p_scope.assigned_user_id = ${scopedUserId}
            OR p_scope.data_owner_user_id = ${scopedUserId}
            OR p_scope.created_by_user_id = ${scopedUserId}
          )
      )
    )`);
  }

  if (filters.q) {
    const q = `%${filters.q}%`;
    clauses.push(sql`(
      d.deal_code ILIKE ${q}
      OR d.deal_name ILIKE ${q}
      OR d.deal_type::text ILIKE ${q}
      OR d.status::text ILIKE ${q}
      OR d.brand::text ILIKE ${q}
      OR EXISTS (
        SELECT 1
        FROM deal_party dp_q
        JOIN party p_q ON p_q.party_id = dp_q.party_id
        WHERE dp_q.deal_id = d.deal_id
          AND dp_q.deleted_at IS NULL
          AND p_q.deleted_at IS NULL
          AND p_q.legal_name ILIKE ${q}
      )
    )`);
  }
  if (filters.type) clauses.push(sql`d.deal_type = ${filters.type}`);
  if (filters.status) clauses.push(sql`d.status = ${filters.status}`);
  if (filters.brand) clauses.push(sql`d.brand = ${filters.brand}`);
  if (filters.leadUserId) clauses.push(sql`d.lead_user_id = ${filters.leadUserId}`);
  if (filters.creditAnalystUserId) {
    clauses.push(sql`d.credit_analyst_user_id = ${filters.creditAnalystUserId}`);
  }
  if (filters.partyId) {
    clauses.push(sql`EXISTS (
      SELECT 1 FROM deal_party dp_party
      WHERE dp_party.deal_id = d.deal_id
        AND dp_party.party_id = ${filters.partyId}
        AND dp_party.deleted_at IS NULL
    )`);
  }

  const partyFilters: SQL[] = [];
  if (filters.turnover) partyFilters.push(sql`p_filter.turnover_band = ${filters.turnover}`);
  if (filters.sector) partyFilters.push(sql`p_filter.industry_sector = ${filters.sector}`);
  if (filters.rating) partyFilters.push(sql`p_filter.latest_rating = ${filters.rating}`);
  if (filters.agency) partyFilters.push(sql`p_filter.latest_rating_agency = ${filters.agency}`);
  if (filters.investorType) partyFilters.push(sql`p_filter.investor_type = ${filters.investorType}`);
  if (filters.portfolioSize) partyFilters.push(sql`p_filter.portfolio_size_band = ${filters.portfolioSize}`);
  if (filters.riskAppetite) partyFilters.push(sql`p_filter.risk_appetite = ${filters.riskAppetite}`);
  if (filters.highYield !== undefined) {
    partyFilters.push(sql`p_filter.high_yield_appetite = ${filters.highYield}`);
  }
  if (partyFilters.length) {
    clauses.push(sql`EXISTS (
      SELECT 1
      FROM deal_party dp_filter
      JOIN party p_filter ON p_filter.party_id = dp_filter.party_id
      WHERE dp_filter.deal_id = d.deal_id
        AND dp_filter.deleted_at IS NULL
        AND p_filter.deleted_at IS NULL
        AND ${sql.join(partyFilters, sql` AND `)}
    )`);
  }

  return sql.join(clauses, sql` AND `);
}

/**
 * Load the deal pipeline grouped by deal_status, capped at `perStage` deals per
 * status via a ROW_NUMBER() window. `total` is the full non-deleted deal count
 * (the "Showing X of Y" denominator). Three round-trips: the count, the
 * per-stage-capped deals, and the deal_party→party join for the capped set -
 * then a JS merge + group. Ordered by status then deal_code within each stage
 * for a stable blotter.
 */
export async function getDealPipeline(
  opts: {
    perStage?: number;
    filters?: DealPipelineFilters;
    user?: CrmUser | null;
  } = {},
): Promise<DealPipelineResult> {
  const perStage = Math.max(
    1,
    Math.min(opts.perStage ?? DEFAULT_PER_STAGE, 200),
  );

  // Full count of non-deleted deals - the "Showing X of Y" denominator. A
  // separate count query (not a window aggregate on the main query) so the cap
  // doesn't shrink the total the board reports to the user.
  const where = buildDealWhere({
    filters: opts.filters ?? {},
    user: opts.user,
  });

  const countRows = await db.execute<{ c: string }>(sql`
    SELECT count(*)::text AS c FROM deal d WHERE ${where}
  `);
  const total = Number(countRows[0]?.c ?? 0);

  // Per-stage-capped deals via ROW_NUMBER. The window partitions by status and
  // orders by deal_code within each partition, so the cap is the first
  // `perStage` deals (by deal_code) of each stage - a stable, balanced sample
  // that keeps every populated kanban column visible up to the cap.
  const dealRows = await db.execute<DealDbRow>(sql`
    SELECT deal_id, deal_code, deal_name, deal_type, status, brand,
           target_size, currency_code, target_close_date, target_tenor_years,
           lead_user_id, credit_analyst_user_id
    FROM (
      SELECT
        deal_id, deal_code, deal_name, deal_type, status, brand,
        target_size, currency_code, target_close_date, target_tenor_years,
        lead_user_id, credit_analyst_user_id,
        ROW_NUMBER() OVER (PARTITION BY status ORDER BY deal_code) AS rn
      FROM deal d
      WHERE ${where}
    ) sub
    WHERE rn <= ${perStage}
    ORDER BY status, deal_code
  `);

  const dealIds = dealRows.map((r) => r.deal_id);
  const partyRows = dealIds.length
    ? await db
        .select({
          dealId: dealParty.dealId,
          partyId: dealParty.partyId,
          role: dealParty.role,
          isLead: dealParty.isLead,
          legalName: party.legalName,
        })
        .from(dealParty)
        .innerJoin(party, eq(party.partyId, dealParty.partyId))
        .where(
          and(inArray(dealParty.dealId, dealIds), isNull(dealParty.deletedAt)),
        )
    : [];

  const partiesByDeal = new Map<string, DealPipelineRow["parties"]>();
  for (const p of partyRows) {
    const arr = partiesByDeal.get(p.dealId) ?? [];
    arr.push({
      partyId: p.partyId,
      legalName: p.legalName,
      role: p.role,
      isLead: p.isLead,
    });
    partiesByDeal.set(p.dealId, arr);
  }

  // Group by status, preserving the (status, dealCode) order from the windowed
  // query.
  const groups = new Map<string, DealPipelineRow[]>();
  for (const r of dealRows) {
    const key = r.status ?? "unknown";
    const row: DealPipelineRow = {
      dealId: r.deal_id,
      dealCode: r.deal_code,
      dealName: r.deal_name,
      dealType: r.deal_type,
      status: r.status,
      brand: r.brand,
      targetSize: r.target_size,
      currencyCode: r.currency_code,
      targetCloseDate: r.target_close_date,
      targetTenorYears: r.target_tenor_years,
      leadUserId: r.lead_user_id,
      creditAnalystUserId: r.credit_analyst_user_id,
      parties: partiesByDeal.get(r.deal_id) ?? [],
    };
    const arr = groups.get(key) ?? [];
    arr.push(row);
    groups.set(key, arr);
  }

  return {
    groups: Array.from(groups.entries()).map(([status, ds]) => ({
      status,
      deals: ds,
    })),
    total,
  };
}

// ---------------------------------------------------------------------------
// getDealDetail - single mandate for console / shareable detail views.
// ---------------------------------------------------------------------------

export interface DealDetailParty {
  partyId: string;
  legalName: string;
  role: string;
  isLead: boolean | null;
  commitmentAmount: string | null;
  partyNature: string | null;
}

export interface DealDetail {
  dealId: string;
  dealCode: string | null;
  dealName: string | null;
  dealType: string;
  status: string | null;
  brand: string;
  targetSize: string | null;
  currencyCode: string | null;
  targetCloseDate: string | null;
  targetTenorYears: string | null;
  leadUserId: string | null;
  creditAnalystUserId: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  parties: DealDetailParty[];
}

/**
 * Load one deal (scoped by user visibility) with its deal_party roster.
 * Returns null when missing or outside the caller's scope.
 */
export async function getDealDetail(
  dealId: string,
  user?: CrmUser | null,
): Promise<DealDetail | null> {
  const where = buildDealWhere({
    filters: {},
    user,
  });

  const rows = await db.execute<{
    deal_id: string;
    deal_code: string | null;
    deal_name: string | null;
    deal_type: string;
    status: string | null;
    brand: string;
    target_size: string | null;
    currency_code: string | null;
    target_close_date: string | null;
    target_tenor_years: string | null;
    lead_user_id: string | null;
    credit_analyst_user_id: string | null;
    created_at: Date | string | null;
    updated_at: Date | string | null;
  }>(sql`
    SELECT
      d.deal_id, d.deal_code, d.deal_name, d.deal_type, d.status, d.brand,
      d.target_size, d.currency_code, d.target_close_date, d.target_tenor_years,
      d.lead_user_id, d.credit_analyst_user_id, d.created_at, d.updated_at
    FROM deal d
    WHERE d.deal_id = ${dealId}
      AND ${where}
    LIMIT 1
  `);

  const r = rows[0];
  if (!r) return null;

  const partyRows = await db
    .select({
      partyId: dealParty.partyId,
      legalName: party.legalName,
      role: dealParty.role,
      isLead: dealParty.isLead,
      commitmentAmount: dealParty.commitmentAmount,
      partyNature: party.partyNature,
    })
    .from(dealParty)
    .innerJoin(party, eq(party.partyId, dealParty.partyId))
    .where(and(eq(dealParty.dealId, dealId), isNull(dealParty.deletedAt)));

  const parties = [...partyRows].sort((a, b) => {
    if (a.isLead && !b.isLead) return -1;
    if (!a.isLead && b.isLead) return 1;
    if (a.role < b.role) return -1;
    if (a.role > b.role) return 1;
    return a.legalName.localeCompare(b.legalName);
  });

  return {
    dealId: r.deal_id,
    dealCode: r.deal_code,
    dealName: r.deal_name,
    dealType: r.deal_type,
    status: r.status,
    brand: r.brand,
    targetSize: r.target_size,
    currencyCode: r.currency_code,
    targetCloseDate: r.target_close_date,
    targetTenorYears: r.target_tenor_years,
    leadUserId: r.lead_user_id,
    creditAnalystUserId: r.credit_analyst_user_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    parties,
  };
}
