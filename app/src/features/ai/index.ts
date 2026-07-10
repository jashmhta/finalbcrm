// AI Features barrel - the "no external LLM" intelligence layer.
//
// Four deterministic engines generate text + scores from structured CRM data:
//   - creditSummary    : credit_analysis + ratios + scorecard → 3-paragraph memo.
//   - interactionSummary: interaction notes → overview + key topics + action items.
//   - clientInsights   : per-party relationship strength / deal potential / next action.
//   - nextAction       : user-scoped 3-5 prioritised next-best-actions.
//
// Server actions live in ./actions and should be imported directly by client
// panels. Keeping them out of this barrel preserves the pure generator import
// path for tests and non-Next runtimes.

// Pure generators (safe to import from tests + client data paths - no @/db in
// their runtime import graph).
export {
  generateCreditSummary,
  getCreditSummary,
  BAND_PD_RANGE,
  type CreditSummaryInput,
  type CreditSummaryRatios,
  type CreditSummaryExternalRating,
} from "./creditSummary";

export {
  summarizeInteractions,
  summarizeOneInteraction,
  getInteractionSummary,
  getRecentInteractionSummaries,
  type InteractionNote,
  type InteractionSummaryInput,
} from "./interactionSummary";

export {
  relationshipStrengthScore,
  dealPotentialScore,
  recommendAction,
  getClientInsights,
  type ActionInput,
} from "./clientInsights";

export { getNextActions, type NextActionsResult } from "./nextAction";

// Shared types + display maps.
export {
  AI_PRIORITY_BADGE,
  AI_PRIORITY_LABEL,
  AI_PRIORITY_RANK,
  NEXT_ACTION_KIND_LABEL,
  INSIGHT_ACTION_LABEL,
  type AiPriority,
  type NextAction,
  type NextActionKind,
  type InsightActionKind,
  type ClientInsight,
  type InteractionSummary,
  type RecentInteractionSummary,
  type CreditSummary,
} from "./types";
