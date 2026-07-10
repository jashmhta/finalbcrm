// AI Features - Client insights engine.
//
// For each party (counterparty / client), derive:
//   - Relationship strength score (0..100): interaction volume (recency-
//     weighted) + deal footprint + contact breadth.
//   - Deal potential score (0..100): active mandate count + target size +
//     interaction recency (a warmed-up relationship converts better).
//   - Recommended next action (re-engage / advance mandate / committee /
//     refresh KYC / deepen coverage / maintain), with a one-line rationale.
//
// Deterministic heuristic - no external LLM. The scores are bounded, blended
// sub-scores so a single noisy dimension (e.g. one huge deal) can't dominate;
// the action taxonomy is the relationship-nurture playbook of an Indian bond
// house coverage desk.
//
// Server-only: runs aggregate queries against the live DB (no N+1 - four
// GROUP BY queries joined by party_id in JS). Bounded to the top N by
// relationship strength so the AI hub renders a focused, actionable set.

import { and, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  deal,
  dealParty,
  interaction,
  kycRecord,
  party,
  partyContact,
} from "@/db/schema";
import { can } from "@/lib/rbac-core";

import type { ClientInsight, InsightActionKind } from "./types";

interface ScopedCrmUser {
  appUserId: string | null;
  roles: string[];
  permissions: Set<string>;
}

function canReadAllClientInsights(
  user?: Pick<ScopedCrmUser, "roles" | "permissions"> | null,
) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "ai_insight") ||
    can(user, "read_all", "party") ||
    can(user, "manage", "user")
  );
}

function clientInsightPartyScope(user?: ScopedCrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllClientInsights(user) || !userId) return undefined;
  return or(
    eq(party.assignedUserId, userId),
    eq(party.dataOwnerUserId, userId),
    eq(party.createdByUserId, userId),
    sql`EXISTS (
      SELECT 1
      FROM deal_party dp_scope
      JOIN deal d_scope ON d_scope.deal_id = dp_scope.deal_id
      WHERE dp_scope.party_id = ${party.partyId}
        AND dp_scope.deleted_at IS NULL
        AND d_scope.deleted_at IS NULL
        AND (
          d_scope.lead_user_id = ${userId}
          OR d_scope.credit_analyst_user_id = ${userId}
          OR d_scope.created_by_user_id = ${userId}
        )
    )`,
  );
}

// ---------------------------------------------------------------------------
// Scoring constants
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
/** Terminal deal statuses - not counted as "active" mandates. */
const DEAL_TERMINAL = new Set(["closed", "dropped"]);
/** KYC re-KYC horizon for the "refresh_kyc" recommendation. */
const KYC_DUE_WINDOW_DAYS = 30;
/** "Stale interaction" thresholds for the action taxonomy. */
const STALE_MANDATE_DAYS = 21;
const COLD_RELATIONSHIP_DAYS = 60;

// ---------------------------------------------------------------------------
// Aggregate row shapes (from the GROUP BY queries)
// ---------------------------------------------------------------------------

interface InteractionAgg {
  partyId: string;
  totalInteractions: number;
  /** Recency-weighted count: last 90d full weight, 90-180d half, older 0.2. */
  weightedInteractions: number;
  lastInteractionAt: Date | null;
}

interface DealAgg {
  partyId: string;
  dealCount: number;
  activeDealCount: number;
  totalTargetSizeCr: number;
}

interface KycAgg {
  partyId: string;
  rekycDueDate: Date | null;
}

interface ContactAgg {
  partyId: string;
  contactCount: number;
}

// ---------------------------------------------------------------------------
// Score computation - pure
// ---------------------------------------------------------------------------

/** Relationship strength 0..100. Blends recency-weighted interactions (50),
 *  deal footprint (30), and contact breadth (20). */
export function relationshipStrengthScore(
  weightedInteractions: number,
  dealCount: number,
  contactCount: number,
): number {
  const interactionPts = clamp((weightedInteractions / 20) * 50, 0, 50);
  const dealPts = clamp((dealCount / 5) * 30, 0, 30);
  const contactPts = clamp((contactCount / 4) * 20, 0, 20);
  return Math.round(interactionPts + dealPts + contactPts);
}

/** Deal potential 0..100. Blends active mandate count (40), target size in
 *  ₹ Cr (40, log-scaled so a single mega-deal doesn't saturate), and
 *  interaction recency (20 - a warmed relationship converts). */
export function dealPotentialScore(
  activeDealCount: number,
  totalTargetSizeCr: number,
  daysSinceLastInteraction: number | null,
): number {
  const countPts = clamp((activeDealCount / 4) * 40, 0, 40);
  // log-scaled size: ₹1 Cr → ~8pts, ₹100 Cr → ~16pts, ₹500 Cr → ~40pts (cap).
  const sizePts =
    totalTargetSizeCr > 0
      ? clamp(Math.log10(totalTargetSizeCr + 1) * 14, 0, 40)
      : 0;
  // Recency: last interaction within 14d → 20 pts; decays to 0 by 90d; never → 0.
  let recencyPts = 0;
  if (daysSinceLastInteraction !== null) {
    if (daysSinceLastInteraction <= 14) recencyPts = 20;
    else if (daysSinceLastInteraction >= 90) recencyPts = 0;
    else recencyPts = Math.round(20 * (1 - (daysSinceLastInteraction - 14) / 76));
  }
  return Math.round(countPts + sizePts + recencyPts);
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function bandFromScore(score: number, bands: [number, string][]): string {
  for (const [threshold, label] of bands) {
    if (score >= threshold) return label;
  }
  return bands[bands.length - 1][1];
}

const RELATIONSHIP_BANDS: [number, string][] = [
  [70, "Strong"],
  [45, "Established"],
  [20, "Developing"],
  [0, "At risk"],
];

const POTENTIAL_BANDS: [number, string][] = [
  [60, "Hot"],
  [35, "Active"],
  [15, "Prospect"],
  [0, "Dormant"],
];

// ---------------------------------------------------------------------------
// Recommended action - pure
// ---------------------------------------------------------------------------

export interface ActionInput {
  activeDealCount: number;
  daysSinceLastInteraction: number | null;
  rekycDueDate: Date | null;
  relationshipStrength: number;
  now?: number;
}

export function recommendAction(input: ActionInput): {
  kind: InsightActionKind;
  rationale: string;
} {
  const now = input.now ?? Date.now();
  const { activeDealCount, daysSinceLastInteraction, relationshipStrength } = input;

  // 1. Compliance first - KYC re-KYC approaching due.
  if (input.rekycDueDate) {
    const days = Math.round((input.rekycDueDate.getTime() - now) / DAY);
    if (days <= KYC_DUE_WINDOW_DAYS) {
      return {
        kind: "refresh_kyc",
        rationale: `KYC re-KYC is ${days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue` : `due in ${days} day${days === 1 ? "" : "s"}`} - initiate CDD/EDD refresh before the record lapses.`,
      };
    }
  }

  // 2. Active mandate going quiet - chase the issuer / advance the stage.
  if (activeDealCount > 0 && (daysSinceLastInteraction === null || daysSinceLastInteraction > STALE_MANDATE_DAYS)) {
    const when = daysSinceLastInteraction === null
      ? "no interaction is logged"
      : `last touch was ${daysSinceLastInteraction} day${daysSinceLastInteraction === 1 ? "" : "s"} ago`;
    return {
      kind: "advance_mandate",
      rationale: `Active mandate but ${when} - re-engage the issuer to advance the stage or unblock the next gate.`,
    };
  }

  // 3. Relationship going cold with no live mandate - re-engage to revive.
  if ((daysSinceLastInteraction === null || daysSinceLastInteraction > COLD_RELATIONSHIP_DAYS) && activeDealCount === 0) {
    return {
      kind: "re_engage",
      rationale:
        daysSinceLastInteraction === null
          ? "No interaction on record - open the relationship with an introductory outreach."
          : `Last touch was ${daysSinceLastInteraction} day${daysSinceLastInteraction === 1 ? "" : "s"} ago and no live mandate - re-engage before the relationship goes dormant.`,
    };
  }

  // 4. Strong relationship with multiple mandates - deepen coverage.
  if (relationshipStrength >= 70 && activeDealCount >= 2 && daysSinceLastInteraction !== null && daysSinceLastInteraction <= 30) {
    return {
      kind: "deepen_coverage",
      rationale: "Strong, active relationship with multiple mandates - broaden coverage to adjacent desks (rating advisory, secondary trading, portfolio mandates).",
    };
  }

  // 5. Healthy cadence - maintain.
  return {
    kind: "maintain",
    rationale:
      daysSinceLastInteraction !== null && daysSinceLastInteraction <= 30
        ? "Healthy cadence - maintain the current touch rhythm."
        : "Relationship is stable - keep the periodic check-in on the calendar.",
  };
}

// ---------------------------------------------------------------------------
// SERVER - getClientInsights
// ---------------------------------------------------------------------------

/** Recency weight for an interaction occurred_at: 1.0 within 90d, 0.5 within
 *  180d, 0.2 otherwise. Expressed in SQL so the weighting happens in the
 *  GROUP BY query, not in JS over a large row set. */
const RECENCY_WEIGHT_SQL = sql`sum(
  CASE
    WHEN ${interaction.occurredAt} >= now() - interval '90 days' THEN 1.0
    WHEN ${interaction.occurredAt} >= now() - interval '180 days' THEN 0.5
    ELSE 0.2
  END
)`;

export async function getClientInsights({
  limit = 8,
  minInteractions = 1,
  user,
}: {
  limit?: number;
  minInteractions?: number;
  user?: ScopedCrmUser | null;
} = {}): Promise<ClientInsight[]> {
  // A - interaction aggregates per party.
  const interactionRows = await db
    .select({
      partyId: interaction.partyId,
      totalInteractions: sql<number>`count(*)::int`,
      weightedInteractions: sql<number>`coalesce(${RECENCY_WEIGHT_SQL}, 0)::float`,
      lastInteractionAt: sql<Date>`max(${interaction.occurredAt})`,
    })
    .from(interaction)
    .where(and(isNull(interaction.deletedAt), sql`${interaction.partyId} IS NOT NULL`))
    .groupBy(interaction.partyId);

  // B - deal aggregates per party (via deal_party → deal, non-terminal).
  const dealRows = await db
    .select({
      partyId: dealParty.partyId,
      dealCount: sql<number>`count(distinct ${deal.dealId})::int`,
      activeDealCount:
        sql<number>`count(distinct ${deal.dealId}) filter (where ${deal.status} IS NULL OR ${deal.status}::text <> ALL (ARRAY['closed','dropped']::text[]))::int`,
      totalTargetSizeCr:
        sql<number>`coalesce(sum(${deal.targetSize}) filter (where ${deal.status} IS NULL OR ${deal.status}::text <> ALL (ARRAY['closed','dropped']::text[])), 0)::float / 1e7`,
    })
    .from(dealParty)
    .innerJoin(deal, eq(deal.dealId, dealParty.dealId))
    .where(and(isNull(dealParty.deletedAt), isNull(deal.deletedAt)))
    .groupBy(dealParty.partyId);

  // C - KYC re-KYC due soon / overdue per party (min due date within window).
  const kycRows = await db
    .select({
      partyId: kycRecord.partyId,
      rekycDueDate: sql<Date>`min(${kycRecord.rekycDueDate})`,
    })
    .from(kycRecord)
    .where(
      and(
        isNull(kycRecord.deletedAt),
        sql`${kycRecord.rekycDueDate} IS NOT NULL`,
        sql`${kycRecord.rekycDueDate} <= now()::date + ${KYC_DUE_WINDOW_DAYS}::integer`,
      ),
    )
    .groupBy(kycRecord.partyId);

  // D - contact breadth per party.
  const contactRows = await db
    .select({
      partyId: partyContact.partyId,
      contactCount: sql<number>`count(*)::int`,
    })
    .from(partyContact)
    .where(and(isNull(partyContact.deletedAt), sql`${partyContact.validTo} IS NULL`))
    .groupBy(partyContact.partyId);

  // Join in JS by partyId.
  const interactionsByParty = new Map<string, InteractionAgg>();
  for (const r of interactionRows) {
    if (!r.partyId) continue;
    interactionsByParty.set(r.partyId, {
      partyId: r.partyId,
      totalInteractions: r.totalInteractions ?? 0,
      weightedInteractions: Number(r.weightedInteractions ?? 0),
      lastInteractionAt: r.lastInteractionAt ?? null,
    });
  }
  const dealsByParty = new Map<string, DealAgg>();
  for (const r of dealRows) {
    dealsByParty.set(r.partyId, {
      partyId: r.partyId,
      dealCount: r.dealCount ?? 0,
      activeDealCount: r.activeDealCount ?? 0,
      totalTargetSizeCr: Number(r.totalTargetSizeCr ?? 0),
    });
  }
  const kycByParty = new Map<string, KycAgg>();
  for (const r of kycRows) {
    // r.rekycDueDate is typed Date via sql<Date>, but the postgres driver
    // returns the min() aggregate as an ISO string at runtime - normalize to
    // a real Date so recommendAction's .getTime() works.
    kycByParty.set(r.partyId, {
      partyId: r.partyId,
      rekycDueDate: r.rekycDueDate ? new Date(r.rekycDueDate) : null,
    });
  }
  const contactsByParty = new Map<string, ContactAgg>();
  for (const r of contactRows) {
    contactsByParty.set(r.partyId, { partyId: r.partyId, contactCount: r.contactCount ?? 0 });
  }

  // Candidate parties: those with >= minInteractions OR >= 1 active deal.
  const candidateIds = new Set<string>();
  for (const agg of interactionsByParty.values()) {
    if (agg.totalInteractions >= minInteractions) candidateIds.add(agg.partyId);
  }
  for (const agg of dealsByParty.values()) {
    if (agg.activeDealCount > 0) candidateIds.add(agg.partyId);
  }

  // Resolve party legal names in one batched query.
  const partyIds = [...candidateIds];
  if (partyIds.length === 0) return [];
  const partyRows = await db
    .select({ partyId: party.partyId, legalName: party.legalName, status: party.status })
    .from(party)
    .where(
      and(
        sql`${party.partyId} = ANY (${sql`ARRAY[${sql.join(partyIds.map((id) => sql`${id}::uuid`), sql`, `)}]::uuid[]`})`,
        isNull(party.deletedAt),
        clientInsightPartyScope(user),
      ),
    );
  const nameByParty = new Map<string, { legalName: string; status: string }>();
  for (const r of partyRows) {
    nameByParty.set(r.partyId, { legalName: r.legalName, status: r.status ?? "active" });
  }

  const now = Date.now();
  const insights: ClientInsight[] = [];
  for (const partyId of partyIds) {
    const name = nameByParty.get(partyId);
    if (!name) continue;
    const ia = interactionsByParty.get(partyId);
    const da = dealsByParty.get(partyId);
    const ka = kycByParty.get(partyId);
    const ca = contactsByParty.get(partyId);

    const totalInteractions = ia?.totalInteractions ?? 0;
    const weightedInteractions = ia?.weightedInteractions ?? 0;
    const dealCount = da?.dealCount ?? 0;
    const activeDealCount = da?.activeDealCount ?? 0;
    const totalTargetSizeCr = da?.totalTargetSizeCr ?? 0;
    const contactCount = ca?.contactCount ?? 0;
    const rekycDueDate = ka?.rekycDueDate ?? null;

    const lastInteractionAt = ia?.lastInteractionAt ?? null;
    const daysSinceLastInteraction = lastInteractionAt
      ? Math.max(0, Math.round((now - new Date(lastInteractionAt).getTime()) / DAY))
      : null;

    const relScore = relationshipStrengthScore(weightedInteractions, dealCount, contactCount);
    const potScore = dealPotentialScore(activeDealCount, totalTargetSizeCr, daysSinceLastInteraction);

    const action = recommendAction({
      activeDealCount,
      daysSinceLastInteraction,
      rekycDueDate,
      relationshipStrength: relScore,
      now,
    });

    insights.push({
      partyId,
      legalName: name.legalName,
      relationshipStrength: relScore,
      relationshipBand: bandFromScore(relScore, RELATIONSHIP_BANDS),
      dealPotential: potScore,
      dealPotentialBand: bandFromScore(potScore, POTENTIAL_BANDS),
      recommendedAction: action.kind,
      actionRationale: action.rationale,
      interactionCount: totalInteractions,
      dealCount,
      activeDealCount,
      daysSinceLastInteraction,
      totalTargetSizeCr,
      href: `/parties/${partyId}`,
    });
  }

  // Rank by relationship strength (desc), then deal potential (desc). Return top N.
  insights.sort(
    (a, b) =>
      b.relationshipStrength - a.relationshipStrength ||
      b.dealPotential - a.dealPotential ||
      a.legalName.localeCompare(b.legalName),
  );
  return insights.slice(0, limit);
}
