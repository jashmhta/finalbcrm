// Credit committee workflow state machine (pure).
//
// The schema stores committee outcome on credit_analysis
// (internal_rating_action, recommendation, watchlist_flag). This module
// encodes legal transitions so actions don't accept arbitrary jumps.

export type CommitteePhase =
  | "draft"
  | "submitted"
  | "in_committee"
  | "approved"
  | "rejected"
  | "watch";

export type InternalRatingAction =
  | "assign"
  | "maintain"
  | "upgrade"
  | "downgrade"
  | "watch_negative"
  | "watch_positive";

/** Map stored action + watchlist → phase for UI/reporting. */
export function phaseFromAnalysis(input: {
  internalRatingAction: string | null | undefined;
  watchlistFlag?: boolean | null;
  recommendation?: string | null;
}): CommitteePhase {
  if (input.watchlistFlag) return "watch";
  switch (input.internalRatingAction) {
    case "assign":
      return input.recommendation ? "submitted" : "draft";
    case "maintain":
    case "upgrade":
    case "downgrade":
      return "approved";
    case "watch_negative":
    case "watch_positive":
      return "watch";
    default:
      return "draft";
  }
}

const ALLOWED: Record<CommitteePhase, CommitteePhase[]> = {
  draft: ["submitted", "in_committee"],
  submitted: ["in_committee", "draft"],
  in_committee: ["approved", "rejected", "watch", "submitted"],
  approved: ["watch", "in_committee"],
  rejected: ["draft", "submitted"],
  watch: ["in_committee", "approved"],
};

export function canTransition(from: CommitteePhase, to: CommitteePhase): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export interface CommitteeAdvanceInput {
  currentAction: string | null | undefined;
  currentWatchlist: boolean | null | undefined;
  currentRecommendation: string | null | undefined;
  nextAction: InternalRatingAction;
  recommendation?: string | null;
  watchlistFlag?: boolean;
}

export type CommitteeAdvanceResult =
  | {
      ok: true;
      from: CommitteePhase;
      to: CommitteePhase;
      internalRatingAction: InternalRatingAction;
      watchlistFlag: boolean;
      recommendation: string | null;
    }
  | { ok: false; error: string };

/**
 * Validate and resolve a committee advance.
 * Outcome actions (maintain/upgrade/downgrade) imply approved;
 * watch_* imply watch phase; assign with recommendation → submitted.
 */
export function resolveCommitteeAdvance(
  input: CommitteeAdvanceInput,
): CommitteeAdvanceResult {
  const from = phaseFromAnalysis({
    internalRatingAction: input.currentAction,
    watchlistFlag: input.currentWatchlist,
    recommendation: input.currentRecommendation,
  });

  let to: CommitteePhase;
  let watchlistFlag =
    input.watchlistFlag ?? Boolean(input.currentWatchlist);

  switch (input.nextAction) {
    case "assign":
      to = input.recommendation ? "submitted" : "draft";
      break;
    case "maintain":
    case "upgrade":
    case "downgrade":
      to = "approved";
      watchlistFlag = false;
      break;
    case "watch_negative":
    case "watch_positive":
      to = "watch";
      watchlistFlag = true;
      break;
    default:
      return { ok: false, error: "Unknown rating action." };
  }

  if (!canTransition(from, to) && from !== to) {
    // Allow first-time assign from draft freely; block illegal jumps only.
    if (!(from === "draft" && (to === "submitted" || to === "approved" || to === "watch"))) {
      if (!canTransition(from, to)) {
        return {
          ok: false,
          error: `Illegal committee transition: ${from} → ${to}.`,
        };
      }
    }
  }

  return {
    ok: true,
    from,
    to,
    internalRatingAction: input.nextAction,
    watchlistFlag,
    recommendation: input.recommendation ?? input.currentRecommendation ?? null,
  };
}

export const COMMITTEE_PHASE_LABEL: Record<CommitteePhase, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_committee: "In committee",
  approved: "Approved",
  rejected: "Rejected",
  watch: "On watch",
};
