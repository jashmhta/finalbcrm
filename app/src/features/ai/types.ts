// AI Features - shared types.
//
// This module is the "no external LLM" intelligence layer of the CRM. The four
// engines (creditSummary, interactionSummary, clientInsights, nextAction) are
// deterministic heuristic / templating generators: they read STRUCTURED CRM
// data (credit analyses, interactions, deals, parties, KYC, tasks) and emit
// human-readable text + scores. Nothing here calls an external model - the
// "AI" is a curated rules layer that turns rows into prose a desk officer can
// paste into a committee memo or a client touch-plan.
//
// All exported types are JSON-serializable so the server engines' output can
// cross the RSC boundary into the client views (src/app/ai/*) without a
// function prop ever crossing server→client (per the project's Next 16 rules).

// ---------------------------------------------------------------------------
// Severity / priority - the shared ranking vocabulary for next-best-actions
// and client-insight recommended actions. Maps onto the brand Badge variants.
// ---------------------------------------------------------------------------

export type AiPriority = "critical" | "warning" | "info" | "positive";

/** Brand Badge variant per priority - the single source of truth for the UI. */
export const AI_PRIORITY_BADGE: Record<AiPriority, "down" | "gold" | "info" | "up"> = {
  critical: "down",
  warning: "gold",
  info: "info",
  positive: "up",
};

export const AI_PRIORITY_LABEL: Record<AiPriority, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
  positive: "Opportunity",
};

/** Ordinal rank for sorting - critical first, opportunity last. */
export const AI_PRIORITY_RANK: Record<AiPriority, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3,
};

// ---------------------------------------------------------------------------
// Next-best-action (user-scoped)
// ---------------------------------------------------------------------------

/** The five next-best-action kinds the engine can surface for a user. */
export type NextActionKind =
  | "task_overdue"
  | "deal_stuck"
  | "credit_committee_pending"
  | "kyc_expiring"
  | "no_recent_interaction";

export const NEXT_ACTION_KIND_LABEL: Record<NextActionKind, string> = {
  task_overdue: "Task overdue",
  deal_stuck: "Deal stuck",
  credit_committee_pending: "Committee pending",
  kyc_expiring: "KYC expiring",
  no_recent_interaction: "No recent interaction",
};

export interface NextAction {
  kind: NextActionKind;
  /** One-line headline (e.g. "Re-KYC due in 9 days for Acme Steel"). */
  title: string;
  /** One-sentence context - why it fired + what to do. */
  description: string;
  /** Internal route to the linked entity. */
  href: string;
  /** Criticality for ranking + badge colour. */
  priority: AiPriority;
  /** Human label for the entity (party / deal / task title). */
  entityLabel: string;
  /** ISO instant of the trigger's reference date (due date / last touch). */
  occurredAt: string;
  /** Relative-time string precomputed server-side (no client Date.now()). */
  relative: string;
}

// ---------------------------------------------------------------------------
// Client insight (per-party)
// ---------------------------------------------------------------------------

/** The kind of recommended next action the client-insight engine returns.
 *  Coarser than NextActionKind - this is a relationship-nurture taxonomy, not
 *  an escalation taxonomy. */
export type InsightActionKind =
  | "re_engage"
  | "advance_mandate"
  | "committee_review"
  | "refresh_kyc"
  | "deepen_coverage"
  | "maintain";

export const INSIGHT_ACTION_LABEL: Record<InsightActionKind, string> = {
  re_engage: "Re-engage",
  advance_mandate: "Advance mandate",
  committee_review: "Schedule committee",
  refresh_kyc: "Refresh KYC",
  deepen_coverage: "Deepen coverage",
  maintain: "Maintain cadence",
};

export interface ClientInsight {
  partyId: string;
  legalName: string;
  /** Relationship strength 0..100 - interaction volume (recency-weighted) +
   *  deal footprint + contacts. */
  relationshipStrength: number;
  /** Relationship band label - At risk / Developing / Established / Strong. */
  relationshipBand: string;
  /** Deal potential 0..100 - active mandate footprint + target size + stage. */
  dealPotential: number;
  /** Deal potential band label - Dormant / Prospect / Active / Hot. */
  dealPotentialBand: string;
  recommendedAction: InsightActionKind;
  /** One-line rationale for the recommended action. */
  actionRationale: string;
  /** Supporting counts for the insight card. */
  interactionCount: number;
  dealCount: number;
  activeDealCount: number;
  /** Days since the last interaction (null = never). */
  daysSinceLastInteraction: number | null;
  /** Total target deal size in ₹ Cr (sum of active mandates). */
  totalTargetSizeCr: number;
  /** Internal route to the party. */
  href: string;
}

// ---------------------------------------------------------------------------
// Interaction summary
// ---------------------------------------------------------------------------

/** A single recent interaction rendered in the "recent auto-summaries" rail. */
export interface RecentInteractionSummary {
  interactionId: string;
  subject: string | null;
  partyName: string | null;
  dealCode: string | null;
  channel: string | null;
  occurredAt: string;
  relative: string;
  /** One-line generated topic (the dominant theme of the note). */
  topic: string;
  /** The single most pressing action item extracted, or null. */
  actionItem: string | null;
  /** Internal route to the interaction's anchor (party or deal). */
  href: string;
}

/** A rolled-up summary of a batch of interactions (the workspace summary). */
export interface InteractionSummary {
  scope: { partyId?: string; dealId?: string };
  scopeLabel: string;
  /** 1-2 sentence overview of the recent interaction history. */
  overview: string;
  /** 3-6 dominant topics, ranked by mention frequency. */
  keyTopics: string[];
  /** Action items extracted from next_action fields + body imperatives. */
  actionItems: string[];
  interactionCount: number;
  /** ISO instant of the most recent interaction, or null when empty. */
  lastInteractionAt: string | null;
  /** Distinct channels used, display-labelled. */
  channels: string[];
}

// ---------------------------------------------------------------------------
// Credit summary
// ---------------------------------------------------------------------------

/** A structured credit summary - three paragraphs + extracted lists, generated
 *  from a credit_analysis + ratios + scorecard. Designed to render in the
 *  credit detail overview tab AND to be pasteable into a committee memo. */
export interface CreditSummary {
  creditAnalysisId: string;
  /** Paragraph 1 - issuer / obligor description. */
  issuer: string;
  /** Paragraph 2 - financial highlights from the latest period ratios. */
  financials: string;
  /** Paragraph 3 - credit assessment (band / score / PD / recommendation). */
  assessment: string;
  /** Extracted credit strengths (bullets). */
  strengths: string[];
  /** Extracted credit concerns (bullets). */
  concerns: string[];
  /** The one-line recommendation (Approve / Approve with conditions / Decline /
   *  Watchlist - derived from band + watchlist flag + recommendation text). */
  recommendation: string;
  /** Recommendation badge priority for the UI. */
  recommendationPriority: AiPriority;
  /** A compact rating line for the header (e.g. "BC-2 · Strong · 0.001% 1-yr PD"). */
  ratingLine: string;
  /** Generated at timestamp (ISO). */
  generatedAt: string;
}
