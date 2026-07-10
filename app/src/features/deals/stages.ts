// Per-deal-type stage flows (the deal pipeline ladder per mandate type).
//
// The schema's `deal_status` enum is a single flat set of pipeline stages
// (lead, mandated, in_dd, structuring, rating_marketing, pricing, allocation,
// settled, closed + off-pipeline dropped/on_hold). A flat enum is necessary at
// the DB level but is NOT business-logic appropriate on its own: a G-Sec
// auction does not go through "structuring"/"rating_marketing", and an M&A
// mandate does not have an "allocation" stage. This module encodes, per
// deal_type, the ordered ladder of schema statuses that actually apply, with a
// per-stage semantics note that documents how the generic status maps to the
// deal-type-specific phase (e.g. for M&A, `structuring` = valuation +
// negotiation; for G-Sec, `pricing` = auction bidding).
//
// Verified against scrape/BUSINESS_CONTEXT.md §2-3 (BC/Binary Bonds service
// processes) and the per-type flows specified for this audit:
//   - Bond underwriting: lead → mandated → DD → structuring → rating →
//     marketing → pricing → allocation → settlement → closed.
//   - M&A: lead → mandated → DD → valuation → negotiation → signing → closing.
//   - G-Sec: pre-auction → auction → allotment → settlement.
//
// Pure helpers - no DB access. Used by deal mutation/validation logic and
// available to the view layer to render a per-type ladder instead of the
// generic one.

import type { DealStatus, DealType } from "./catalog";

// Off-pipeline (terminal / pausing) statuses apply to every deal type.
export const OFF_PIPELINE_STATUSES = ["dropped", "on_hold"] as const;
export type OffPipelineStatus = (typeof OFF_PIPELINE_STATUSES)[number];

/** The active stages, in canonical order, that apply to a given deal type. */
export interface DealStageFlow {
  /** Ordered ladder of deal_status values that apply to this deal type. */
  ladder: DealStatus[];
  /**
   * Per-stage semantics: how the generic deal_status maps to the deal-type-
   * specific phase. Keys are schema statuses; absent = use the generic label.
   */
  semantics: Partial<Record<DealStatus, string>>;
}

export const DEAL_STAGE_FLOWS: Record<DealType, DealStageFlow> = {
  // ---- Fixed-income primary (full underwriting ladder) ----
  bond_underwriting: {
    ladder: [
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "rating_marketing",
      "pricing",
      "allocation",
      "settled",
      "closed",
    ],
    semantics: {
      in_dd: "Due diligence & structuring inputs",
      structuring: "Structuring: tenor, coupon, security, covenants",
      rating_marketing: "Rating agency coordination + investor marketing",
      pricing: "Pricing & book-building",
      allocation: "Allocation",
      settled: "Issuance & settlement (CCIL/ICCL)",
      closed: "Post-issue support & close",
    },
  },
  high_yield_bond: {
    ladder: [
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "rating_marketing",
      "pricing",
      "allocation",
      "settled",
      "closed",
    ],
    semantics: {
      in_dd: "Enhanced due diligence (HY-weighted)",
      structuring: "Structuring: covenants / security / credit enhancement",
      rating_marketing: "Rating (sub-IG) + investor marketing",
      pricing: "Pricing & book-building",
      allocation: "Allocation",
      settled: "Issuance & settlement",
      closed: "Post-issue monitoring & close",
    },
  },
  private_placement_debt: {
    ladder: [
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "rating_marketing",
      "pricing",
      "allocation",
      "settled",
      "closed",
    ],
    semantics: {
      in_dd: "Due diligence",
      structuring: "Structuring: tenor, coupon, security",
      rating_marketing: "Rating (optional) + investor placement",
      pricing: "Pricing & negotiation",
      allocation: "Investor allocation",
      settled: "Settlement",
      closed: "Close",
    },
  },
  dcm_advisory: {
    // Advisory altitude - BC advises; execution hands to Binary Bonds. No
    // allocation/settlement owned by the advisory mandate.
    ladder: [
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "rating_marketing",
      "pricing",
      "closed",
    ],
    semantics: {
      in_dd: "Due diligence",
      structuring: "Structuring advisory",
      rating_marketing: "Rating + distribution strategy",
      pricing: "Pricing advisory & execution handoff",
      closed: "Advisory close",
    },
  },

  // ---- G-Sec / secondary ----
  gsec_auction: {
    // RBI auction: pre-auction → auction (bidding) → allotment → settlement.
    ladder: ["lead", "mandated", "pricing", "allocation", "settled", "closed"],
    semantics: {
      lead: "Pre-auction assessment",
      mandated: "Mandate / bidding strategy",
      pricing: "Auction bidding (competitive / non-competitive)",
      allocation: "Allotment",
      settled: "CCIL / NDS-OM settlement",
      closed: "Close",
    },
  },
  secondary_trading_advisory: {
    // RFQ → execution → CCIL DVP settlement.
    ladder: ["lead", "mandated", "pricing", "settled", "closed"],
    semantics: {
      lead: "RFQ / order placement",
      mandated: "Mandate / counterparty confirmation",
      pricing: "Price discovery & execution",
      settled: "CCIL DVP settlement",
      closed: "Close",
    },
  },

  // ---- ECM (book-built offers - full ladder) ----
  ecm_ipo: {
    ladder: [
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "rating_marketing",
      "pricing",
      "allocation",
      "settled",
      "closed",
    ],
    semantics: {
      in_dd: "Due diligence (DRHP preparation)",
      structuring: "Offer structuring",
      rating_marketing: "Roadshow & investor marketing",
      pricing: "Price discovery & book-building",
      allocation: "Allocation",
      settled: "Listing & settlement",
      closed: "Close",
    },
  },
  ecm_fpo: {
    ladder: [
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "rating_marketing",
      "pricing",
      "allocation",
      "settled",
      "closed",
    ],
    semantics: {
      in_dd: "Due diligence",
      structuring: "Offer structuring",
      rating_marketing: "Roadshow & investor marketing",
      pricing: "Price discovery & book-building",
      allocation: "Allocation",
      settled: "Listing & settlement",
      closed: "Close",
    },
  },
  ecm_qip: {
    ladder: [
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "rating_marketing",
      "pricing",
      "allocation",
      "settled",
      "closed",
    ],
    semantics: {
      in_dd: "Due diligence",
      structuring: "Offer structuring",
      rating_marketing: "Investor outreach",
      pricing: "Pricing",
      allocation: "QIB allocation",
      settled: "Allotment & settlement",
      closed: "Close",
    },
  },
  ecm_rights: {
    ladder: [
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "rating_marketing",
      "pricing",
      "allocation",
      "settled",
      "closed",
    ],
    semantics: {
      in_dd: "Due diligence",
      structuring: "Offer structuring (entitlement ratio)",
      rating_marketing: "Shareholder communication",
      pricing: "Pricing",
      allocation: "Entitlement / renunciation",
      settled: "Allotment & settlement",
      closed: "Close",
    },
  },

  // ---- Structured credit ----
  structured_finance: {
    ladder: [
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "rating_marketing",
      "pricing",
      "settled",
      "closed",
    ],
    semantics: {
      in_dd: "Asset-pool due diligence",
      structuring: "Tranching / credit enhancement / SPV",
      rating_marketing: "Tranche rating + placement",
      pricing: "Pricing",
      settled: "Issuance & settlement",
      closed: "Close",
    },
  },
  supply_chain_finance: {
    ladder: [
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "pricing",
      "settled",
      "closed",
    ],
    semantics: {
      in_dd: "Anchor / supplier due diligence",
      structuring: "Program design (reverse factoring / discounting)",
      pricing: "Pricing & terms",
      settled: "Program launch",
      closed: "Close",
    },
  },
  project_finance: {
    ladder: [
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "rating_marketing",
      "pricing",
      "settled",
      "closed",
    ],
    semantics: {
      in_dd: "Due diligence (technical / environmental / regulatory)",
      structuring: "SPV structuring + risk allocation",
      rating_marketing: "Project rating advisory",
      pricing: "Financing terms",
      settled: "Financial close",
      closed: "Close & monitoring",
    },
  },

  // ---- Advisory ----
  m_and_a: {
    // lead → mandated → DD → valuation → negotiation → signing → closing,
    // mapped onto the schema statuses.
    ladder: ["lead", "mandated", "in_dd", "structuring", "pricing", "closed"],
    semantics: {
      in_dd: "Due diligence",
      structuring: "Valuation & negotiation",
      pricing: "Signing (SPA)",
      closed: "Closing & post-merger integration",
    },
  },
  rating_advisory: {
    ladder: [
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "rating_marketing",
      "closed",
    ],
    semantics: {
      in_dd: "Pre-rating assessment",
      structuring: "Documentation & presentation",
      rating_marketing: "Agency coordination & management meeting",
      closed: "Rating outcome & ongoing support",
    },
  },
  valuation: {
    ladder: ["lead", "mandated", "in_dd", "structuring", "closed"],
    semantics: {
      in_dd: "Due diligence",
      structuring: "Valuation analysis (DCF / comparables / precedent)",
      closed: "Report delivery",
    },
  },
  fairness_opinion: {
    ladder: ["lead", "mandated", "in_dd", "structuring", "closed"],
    semantics: {
      in_dd: "Due diligence",
      structuring: "Fairness analysis",
      closed: "Opinion issued",
    },
  },

  // ---- Portfolio ----
  portfolio_management_mandate: {
    ladder: ["lead", "mandated", "in_dd", "structuring", "closed"],
    semantics: {
      in_dd: "Mandate & onboarding",
      structuring: "IPS & strategic asset allocation",
      closed: "Mandate live & monitoring",
    },
  },
};

/** The ordered active ladder for a deal type. */
export function stageLadderFor(dealType: DealType): DealStatus[] {
  return DEAL_STAGE_FLOWS[dealType].ladder;
}

/** Semantics note for a (dealType, status) pair, or null for the generic label. */
export function stageSemanticsFor(
  dealType: DealType,
  status: DealStatus,
): string | null {
  return DEAL_STAGE_FLOWS[dealType].semantics[status] ?? null;
}

/** Index of a status within the deal type's active ladder; -1 if off-pipeline. */
export function stageIndexInFlow(
  dealType: DealType,
  status: DealStatus | string | null | undefined,
): number {
  if (!status) return -1;
  return stageLadderFor(dealType).indexOf(status as DealStatus);
}

/** True for the terminal/pausing off-pipeline statuses (apply to every type). */
export function isOffPipelineStatus(
  status: DealStatus | string | null | undefined,
): boolean {
  return (
    status != null &&
    (OFF_PIPELINE_STATUSES as readonly string[]).includes(status)
  );
}

/**
 * Whether a stage transition is business-logic valid for the given deal type.
 *
 * Rules:
 *  - `to === from` is a no-op (allowed).
 *  - `to === "dropped"` is allowed from any non-dropped status (a mandate can
 *    be dropped at any point). `dropped` is terminal - no transition out.
 *  - `to === "on_hold"` is allowed from any active ladder stage; resume from
 *    `on_hold` is allowed back to any active ladder stage.
 *  - Active → active: `to` must be in this deal type's ladder and must not
 *    SKIP forward (index(to) <= index(from) + 1). Backward moves (re-work)
 *    are allowed; forward jumps past the next stage are not.
 */
export function canTransitionStage(
  dealType: DealType,
  from: DealStatus | string | null | undefined,
  to: DealStatus | string | null | undefined,
): boolean {
  if (!from || !to) return false;
  if (from === to) return true;
  const toStatus = to as DealStatus;

  // dropped is a terminal sink - reachable from anywhere non-dropped.
  if (toStatus === "dropped") return from !== "dropped";
  // No transition out of dropped (terminal).
  if (from === "dropped") return false;

  // on_hold: pausable from any active ladder stage; resumable to any active
  // ladder stage.
  if (toStatus === "on_hold") {
    return stageIndexInFlow(dealType, from) >= 0;
  }
  if (from === "on_hold") {
    return stageIndexInFlow(dealType, to) >= 0;
  }

  // Active → active: no forward skips.
  const ladder = stageLadderFor(dealType);
  const fi = ladder.indexOf(from as DealStatus);
  const ti = ladder.indexOf(toStatus);
  if (fi < 0 || ti < 0) return false;
  return ti <= fi + 1;
}

/**
 * The next active stage in the deal type's ladder after `status`, or null if
 * `status` is the last active stage / off-pipeline.
 */
export function nextStageFor(
  dealType: DealType,
  status: DealStatus | string | null | undefined,
): DealStatus | null {
  const i = stageIndexInFlow(dealType, status);
  if (i < 0) return null;
  const ladder = stageLadderFor(dealType);
  return i + 1 < ladder.length ? (ladder[i + 1] as DealStatus) : null;
}
