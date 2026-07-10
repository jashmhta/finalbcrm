// Server-side dashboard data access.
//
// The command-center dashboard mixes headline KPIs, recent rows, and chart
// aggregates. Every loader accepts the current user and applies the same
// party/deal/interaction visibility model as the underlying feature pages.

import { unstable_cache } from "next/cache";

import { and, asc, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  creditAnalysis,
  deal,
  dealParty,
  interaction,
  kycRecord,
  party,
  partyTypeAssignment,
  scorecard,
  sectorCode,
} from "@/db/schema";
import { can } from "@/lib/rbac-core";

interface ScopedCrmUser {
  appUserId: string | null;
  roles: string[];
  permissions: Set<string>;
}

const OPEN_DEAL_STATUSES = [
  "lead",
  "mandated",
  "in_dd",
  "structuring",
  "rating_marketing",
  "pricing",
  "allocation",
  "on_hold",
] as const;

const CLOSED_DEAL_STATUSES = ["settled", "closed"] as const;
const KYC_SOON_DAYS = 30;

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

const INVESTOR_KIND_CASE = sql<string>`
  CASE
    WHEN ${party.partyNature} = 'natural_person' THEN 'HNI'
    WHEN ${party.displayName} ILIKE '%Bank%' THEN 'Bank'
    WHEN ${party.displayName} ILIKE '%Insurer%' THEN 'Insurer'
    WHEN ${party.displayName} ILIKE '%Mutual Fund%' THEN 'Mutual Fund'
    WHEN ${party.displayName} ILIKE '%Pension Fund%' THEN 'Pension Fund'
    WHEN ${party.displayName} ILIKE '%AIF%' THEN 'AIF'
    WHEN ${party.displayName} ILIKE '%Family Office%' THEN 'Family Office'
    WHEN ${party.displayName} ILIKE '%NBFC%' THEN 'NBFC'
    ELSE 'Other'
  END
`;

export interface DashboardKpis {
  totalParties: number;
  investorCount: number;
  issuerCount: number;
  openDealByStage: { status: string | null; count: number; exposure: number }[];
  creditInProgress: number;
  kycExpiring: number;
  totalDeals: number;
  totalInteractions: number;
  monthly: { monthKey: string; deals: number; exposure: number }[];
}

export interface DashboardRecentDeal {
  dealId: string;
  dealCode: string | null;
  dealName: string | null;
  dealType: string;
  status: string | null;
  targetSize: string | null;
  currencyCode: string | null;
  createdAt: Date | null;
}

export interface DashboardRecentInteraction {
  interactionId: string;
  subject: string | null;
  channel: string | null;
  direction: string | null;
  occurredAt: Date | null;
  partyId: string | null;
  dealId: string | null;
  containsMnpi: boolean;
}

export interface DashboardChartData {
  dealVelocityRows: { monthKey: string; closed: number }[];
  sectorRows: { sector: string | null; exposure: string }[];
  latestScorecards: { creditAnalysisId: string; totalScore: string | null }[];
  kycStatusRows: { status: string | null; n: number }[];
  investorTypeRows: { kind: string | null; n: number }[];
}

export interface DashboardData {
  kpis: DashboardKpis;
  recentDeals: DashboardRecentDeal[];
  recentInteractions: DashboardRecentInteraction[];
  dealIssuerRows: { dealId: string; legalName: string }[];
  interactionPartyNames: { partyId: string; legalName: string }[];
  interactionDealNames: { dealId: string; dealName: string | null }[];
  charts: DashboardChartData;
}

function canReadAllDashboard(user?: Pick<ScopedCrmUser, "roles" | "permissions"> | null) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "dashboard") ||
    can(user, "read_all", "party") ||
    can(user, "manage", "user")
  );
}

function partyScopeClause(user?: ScopedCrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllDashboard(user) || !userId) return undefined;
  return or(
    eq(party.assignedUserId, userId),
    eq(party.dataOwnerUserId, userId),
    eq(party.createdByUserId, userId),
  );
}

function dealScopeClause(user?: ScopedCrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllDashboard(user) || !userId) return undefined;
  return or(
    eq(deal.leadUserId, userId),
    eq(deal.creditAnalystUserId, userId),
    eq(deal.createdByUserId, userId),
    sql`EXISTS (
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
    )`,
  );
}

function creditScopeClause(user?: ScopedCrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllDashboard(user) || !userId) return undefined;
  return or(
    eq(creditAnalysis.createdByUserId, userId),
    eq(creditAnalysis.updatedByUserId, userId),
    eq(party.assignedUserId, userId),
    eq(party.dataOwnerUserId, userId),
    eq(party.createdByUserId, userId),
  );
}

function kycScopeClause(user?: ScopedCrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllDashboard(user) || !userId) return undefined;
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

function interactionScopeClause(user?: ScopedCrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllDashboard(user) || !userId) return undefined;
  return or(
    eq(interaction.userId, userId),
    eq(party.assignedUserId, userId),
    eq(party.dataOwnerUserId, userId),
    eq(party.createdByUserId, userId),
    eq(deal.leadUserId, userId),
    eq(deal.creditAnalystUserId, userId),
    eq(deal.createdByUserId, userId),
    sql`EXISTS (
      SELECT 1
      FROM party_contact pc_scope
      JOIN party p_scope ON p_scope.party_id = pc_scope.party_id
      WHERE pc_scope.contact_id = ${interaction.contactId}
        AND pc_scope.deleted_at IS NULL
        AND p_scope.deleted_at IS NULL
        AND (
          p_scope.assigned_user_id = ${userId}
          OR p_scope.data_owner_user_id = ${userId}
          OR p_scope.created_by_user_id = ${userId}
        )
    )`,
  );
}

async function fetchDashboardKpis(user?: ScopedCrmUser | null): Promise<DashboardKpis> {
  const [
    [partyCountRow],
    [investorCountRow],
    [issuerCountRow],
    openDealByStageRows,
    [creditInProgressRow],
    [kycExpiringRow],
    [totalDealsRow],
    [totalInteractionsRow],
    monthlyRows,
  ] = await Promise.all([
    db.select({ n: count() }).from(party).where(and(isNull(party.deletedAt), partyScopeClause(user))),
    db
      .select({ n: sql<number>`count(distinct ${partyTypeAssignment.partyId})::int` })
      .from(partyTypeAssignment)
      .innerJoin(party, eq(party.partyId, partyTypeAssignment.partyId))
      .where(
        and(
          eq(partyTypeAssignment.partyType, "investor"),
          isNull(partyTypeAssignment.deletedAt),
          isNull(party.deletedAt),
          partyScopeClause(user),
        ),
      ),
    db
      .select({ n: sql<number>`count(distinct ${partyTypeAssignment.partyId})::int` })
      .from(partyTypeAssignment)
      .innerJoin(party, eq(party.partyId, partyTypeAssignment.partyId))
      .where(
        and(
          eq(partyTypeAssignment.partyType, "issuer"),
          isNull(partyTypeAssignment.deletedAt),
          isNull(party.deletedAt),
          partyScopeClause(user),
        ),
      ),
    db
      .select({
        status: deal.status,
        n: sql<number>`count(*)::int`,
        exposure: sql<string>`coalesce(sum(${deal.targetSize}), 0)::numeric`,
      })
      .from(deal)
      .where(and(isNull(deal.deletedAt), dealScopeClause(user), or(...OPEN_DEAL_STATUSES.map((s) => eq(deal.status, s)))))
      .groupBy(deal.status),
    db
      .select({ n: count() })
      .from(creditAnalysis)
      .innerJoin(party, eq(party.partyId, creditAnalysis.partyId))
      .where(
        and(
          isNull(creditAnalysis.deletedAt),
          isNull(party.deletedAt),
          creditScopeClause(user),
          isNull(creditAnalysis.validTo),
          isNull(creditAnalysis.supersededBy),
        ),
      ),
    db
      .select({ n: count() })
      .from(kycRecord)
      .where(
        and(
          isNull(kycRecord.deletedAt),
          kycScopeClause(user),
          sql`${kycRecord.rekycDueDate} IS NOT NULL`,
          sql`${kycRecord.rekycDueDate} <= (CURRENT_DATE + INTERVAL '${sql.raw(String(KYC_SOON_DAYS))} days')`,
        ),
      ),
    db.select({ n: count() }).from(deal).where(and(isNull(deal.deletedAt), dealScopeClause(user))),
    db
      .select({ n: count() })
      .from(interaction)
      .leftJoin(party, eq(party.partyId, interaction.partyId))
      .leftJoin(deal, eq(deal.dealId, interaction.dealId))
      .where(and(isNull(interaction.deletedAt), interactionScopeClause(user))),
    db
      .select({
        monthKey: sql<string>`to_char(date_trunc('month', ${deal.createdAt}), 'YYYY-MM')`,
        deals: sql<number>`count(*)::int`,
        exposure: sql<string>`coalesce(sum(${deal.targetSize}), 0)::numeric`,
      })
      .from(deal)
      .where(and(isNull(deal.deletedAt), dealScopeClause(user)))
      .groupBy(sql`date_trunc('month', ${deal.createdAt})`)
      .orderBy(sql`date_trunc('month', ${deal.createdAt})`),
  ]);

  return {
    totalParties: partyCountRow?.n ?? 0,
    investorCount: investorCountRow?.n ?? 0,
    issuerCount: issuerCountRow?.n ?? 0,
    openDealByStage: openDealByStageRows.map((r) => ({
      status: r.status,
      count: Number(r.n) ?? 0,
      exposure: Number(r.exposure) || 0,
    })),
    creditInProgress: creditInProgressRow?.n ?? 0,
    kycExpiring: kycExpiringRow?.n ?? 0,
    totalDeals: totalDealsRow?.n ?? 0,
    totalInteractions: totalInteractionsRow?.n ?? 0,
    monthly: monthlyRows.map((r) => ({
      monthKey: r.monthKey,
      deals: Number(r.deals) ?? 0,
      exposure: Number(r.exposure) || 0,
    })),
  };
}

const getGlobalDashboardKpis = unstable_cache(
  () => fetchDashboardKpis(),
  ["dashboard-kpis-v2"],
  { revalidate: 60, tags: ["dashboard-kpis"] },
);

export async function getDashboardKpis(
  user?: ScopedCrmUser | null,
): Promise<DashboardKpis> {
  return canReadAllDashboard(user) ? getGlobalDashboardKpis() : fetchDashboardKpis(user);
}

export async function getDashboardData({
  user,
  recentLimit = 6,
}: {
  user?: ScopedCrmUser | null;
  recentLimit?: number;
}): Promise<DashboardData> {
  const [kpis, recentDeals, recentInteractions, charts] = await Promise.all([
    getDashboardKpis(user),
    db
      .select({
        dealId: deal.dealId,
        dealCode: deal.dealCode,
        dealName: deal.dealName,
        dealType: deal.dealType,
        status: deal.status,
        targetSize: deal.targetSize,
        currencyCode: deal.currencyCode,
        createdAt: deal.createdAt,
      })
      .from(deal)
      .where(and(isNull(deal.deletedAt), dealScopeClause(user)))
      .orderBy(desc(deal.createdAt))
      .limit(recentLimit),
    db
      .selectDistinctOn([sql`date_trunc('day', ${interaction.occurredAt})`], {
        interactionId: interaction.interactionId,
        subject: interaction.subject,
        channel: interaction.channel,
        direction: interaction.direction,
        occurredAt: interaction.occurredAt,
        partyId: interaction.partyId,
        dealId: interaction.dealId,
        containsMnpi: interaction.containsMnpi,
      })
      .from(interaction)
      .leftJoin(party, eq(party.partyId, interaction.partyId))
      .leftJoin(deal, eq(deal.dealId, interaction.dealId))
      .where(and(isNull(interaction.deletedAt), interactionScopeClause(user)))
      .orderBy(desc(sql`date_trunc('day', ${interaction.occurredAt})`), desc(interaction.occurredAt))
      .limit(recentLimit),
    getDashboardChartData(user),
  ]);

  const dealIds = recentDeals.map((d) => d.dealId);
  const interactionPartyIds = recentInteractions.map((i) => i.partyId).filter((x): x is string => Boolean(x));
  const interactionDealIds = recentInteractions.map((i) => i.dealId).filter((x): x is string => Boolean(x));

  const [dealIssuerRows, interactionPartyNames, interactionDealNames] = await Promise.all([
    dealIds.length
      ? db
          .select({ dealId: dealParty.dealId, legalName: party.legalName })
          .from(dealParty)
          .innerJoin(party, eq(party.partyId, dealParty.partyId))
          .where(
            and(
              inArray(dealParty.dealId, dealIds),
              eq(dealParty.role, "issuer"),
              isNull(dealParty.deletedAt),
              isNull(party.deletedAt),
            ),
          )
          .orderBy(asc(dealParty.createdAt))
      : [],
    interactionPartyIds.length
      ? db
          .select({ partyId: party.partyId, legalName: party.legalName })
          .from(party)
          .where(and(inArray(party.partyId, interactionPartyIds), isNull(party.deletedAt), partyScopeClause(user)))
      : [],
    interactionDealIds.length
      ? db
          .select({ dealId: deal.dealId, dealName: deal.dealName })
          .from(deal)
          .where(and(inArray(deal.dealId, interactionDealIds), isNull(deal.deletedAt), dealScopeClause(user)))
      : [],
  ]);

  return {
    kpis,
    recentDeals,
    recentInteractions,
    dealIssuerRows,
    interactionPartyNames,
    interactionDealNames,
    charts,
  };
}

async function getDashboardChartData(
  user?: ScopedCrmUser | null,
): Promise<DashboardChartData> {
  const [
    dealVelocityRows,
    sectorRows,
    latestScorecards,
    kycStatusRows,
    investorTypeRows,
  ] = await Promise.all([
    db
      .select({
        monthKey: sql<string>`to_char(date_trunc('month', ${deal.actualCloseDate}), 'YYYY-MM')`,
        closed: sql<number>`count(*)::int`,
      })
      .from(deal)
      .where(
        and(
          isNull(deal.deletedAt),
          dealScopeClause(user),
          inArray(deal.status, [...CLOSED_DEAL_STATUSES]),
          sql`${deal.actualCloseDate} IS NOT NULL`,
        ),
      )
      .groupBy(sql`date_trunc('month', ${deal.actualCloseDate})`)
      .orderBy(sql`date_trunc('month', ${deal.actualCloseDate})`),
    db
      .select({
        sector: SECTOR_FAMILY_CASE,
        exposure: sql<string>`coalesce(sum(${deal.targetSize}), 0)::numeric`,
      })
      .from(deal)
      .innerJoin(dealParty, eq(dealParty.dealId, deal.dealId))
      .innerJoin(party, eq(party.partyId, dealParty.partyId))
      .leftJoin(sectorCode, eq(sectorCode.sectorCodeId, party.industrySegmentId))
      .where(
        and(
          isNull(deal.deletedAt),
          dealScopeClause(user),
          eq(dealParty.role, "issuer"),
          isNull(dealParty.deletedAt),
          isNull(party.deletedAt),
        ),
      )
      .groupBy(SECTOR_FAMILY_CASE)
      .orderBy(desc(sql`sum(${deal.targetSize})`)),
    db
      .selectDistinctOn([scorecard.creditAnalysisId], {
        creditAnalysisId: scorecard.creditAnalysisId,
        totalScore: scorecard.totalScore,
      })
      .from(scorecard)
      .innerJoin(creditAnalysis, eq(creditAnalysis.creditAnalysisId, scorecard.creditAnalysisId))
      .innerJoin(party, eq(party.partyId, creditAnalysis.partyId))
      .where(
        and(
          isNull(scorecard.deletedAt),
          isNull(creditAnalysis.deletedAt),
          isNull(party.deletedAt),
          creditScopeClause(user),
          sql`${scorecard.totalScore} IS NOT NULL`,
        ),
      )
      .orderBy(scorecard.creditAnalysisId, desc(scorecard.computedAt)),
    db
      .select({
        status: kycRecord.status,
        n: sql<number>`count(*)::int`,
      })
      .from(kycRecord)
      .where(and(isNull(kycRecord.deletedAt), kycScopeClause(user)))
      .groupBy(kycRecord.status),
    db
      .select({
        kind: INVESTOR_KIND_CASE,
        n: sql<number>`count(*)::int`,
      })
      .from(party)
      .innerJoin(partyTypeAssignment, eq(partyTypeAssignment.partyId, party.partyId))
      .where(
        and(
          isNull(party.deletedAt),
          partyScopeClause(user),
          eq(partyTypeAssignment.partyType, "investor"),
          isNull(partyTypeAssignment.deletedAt),
        ),
      )
      .groupBy(INVESTOR_KIND_CASE)
      .orderBy(desc(sql`count(*)`)),
  ]);

  return {
    dealVelocityRows,
    sectorRows,
    latestScorecards,
    kycStatusRows,
    investorTypeRows,
  };
}
