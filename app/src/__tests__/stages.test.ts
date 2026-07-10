// Deal-stage flow - exhaustive verification of the per-deal-type pipeline
// ladder + transition validation.
//
// Source of truth: src/features/deals/stages.ts + catalog.ts (and
// scrape/BUSINESS_CONTEXT.md §2-3 service processes).
//
// Coverage:
//   - Per-deal-type ladder presence + ordering for the canonical deal types:
//     bond underwriting, M&A, G-Sec auction, ECM IPO, structured finance,
//     project finance, DCM advisory, valuation, etc.
//   - Off-pipeline statuses (dropped, on_hold) apply to every deal type.
//   - canTransitionStage: forward-no-skip, back-rework, drop-from-anywhere,
//     on_hold pause/resume, terminal-sink behavior of dropped.
//   - nextStageFor: the next active stage after a given status.
//   - stageIndexInFlow: -1 for off-pipeline / unknown.
//   - catalog: every schema deal_type has a DEAL_TYPE_CATALOG entry; allocation
//     + issuer-instrument flags are correct per deal family.

import { describe, expect, it } from "vitest";

import {
  DEAL_STAGE_FLOWS,
  OFF_PIPELINE_STATUSES,
  stageLadderFor,
  stageSemanticsFor,
  stageIndexInFlow,
  isOffPipelineStatus,
  canTransitionStage,
  nextStageFor,
} from "@/features/deals/stages";
import {
  DEAL_TYPE_CATALOG,
  DEAL_TYPE_DISPLAY_ORDER,
  dealTypeSpec,
  isAllocationDealType,
  isIssuerInstrumentDealType,
  defaultBrandForDealType,
  type DealType,
} from "@/features/deals/catalog";
import { dealTypeEnum, dealStatusEnum } from "@/db/schema";

// ---------------------------------------------------------------------------
// Catalog coverage - every schema enum value has a domain entry.
// ---------------------------------------------------------------------------

describe("DEAL_TYPE_CATALOG - covers every schema enum value", () => {
  it("every dealTypeEnum value is in the catalog", () => {
    for (const t of dealTypeEnum.enumValues) {
      expect(DEAL_TYPE_CATALOG[t as DealType]).toBeDefined();
    }
  });

  it("every catalog entry has a non-empty label + rationale", () => {
    for (const spec of Object.values(DEAL_TYPE_CATALOG)) {
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.rationale.length).toBeGreaterThan(0);
    }
  });

  it("DEAL_TYPE_DISPLAY_ORDER contains every deal type exactly once", () => {
    expect(DEAL_TYPE_DISPLAY_ORDER.length).toBe(dealTypeEnum.enumValues.length);
    const set = new Set(DEAL_TYPE_DISPLAY_ORDER);
    expect(set.size).toBe(DEAL_TYPE_DISPLAY_ORDER.length);
    for (const t of dealTypeEnum.enumValues) {
      expect(set.has(t as DealType)).toBe(true);
    }
  });
});

describe("dealTypeSpec - lookup helpers", () => {
  it("dealTypeSpec returns the same object as the catalog map", () => {
    expect(dealTypeSpec("bond_underwriting")).toBe(DEAL_TYPE_CATALOG.bond_underwriting);
  });
});

// ---------------------------------------------------------------------------
// Per-deal-type stage ladder - canonical flows.
// ---------------------------------------------------------------------------

describe("stageLadderFor - bond underwriting (full ladder)", () => {
  const ladder = stageLadderFor("bond_underwriting");

  it("runs lead → mandated → in_dd → structuring → rating_marketing → pricing → allocation → settled → closed", () => {
    expect(ladder).toEqual([
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "rating_marketing",
      "pricing",
      "allocation",
      "settled",
      "closed",
    ]);
  });

  it("starts with 'lead' and ends with 'closed'", () => {
    expect(ladder[0]).toBe("lead");
    expect(ladder[ladder.length - 1]).toBe("closed");
  });

  it("includes the allocation + settlement stages (usesAllocationBook)", () => {
    expect(ladder).toContain("allocation");
    expect(ladder).toContain("settled");
  });
});

describe("stageLadderFor - high-yield + private placement (same ladder as IG underwriting)", () => {
  it("high_yield_bond has the same 9-stage ladder as bond_underwriting", () => {
    expect(stageLadderFor("high_yield_bond")).toEqual(stageLadderFor("bond_underwriting"));
  });

  it("private_placement_debt has the same 9-stage ladder", () => {
    expect(stageLadderFor("private_placement_debt")).toEqual(stageLadderFor("bond_underwriting"));
  });
});

describe("stageLadderFor - M&A advisory (no allocation/settlement)", () => {
  const ladder = stageLadderFor("m_and_a");

  it("runs lead → mandated → in_dd → structuring → pricing → closed (valuation+negotiation+signing)", () => {
    expect(ladder).toEqual(["lead", "mandated", "in_dd", "structuring", "pricing", "closed"]);
  });

  it("does NOT include allocation or rating_marketing (M&A is advisory, no book)", () => {
    expect(ladder).not.toContain("allocation");
    expect(ladder).not.toContain("rating_marketing");
    expect(ladder).not.toContain("settled");
  });
});

describe("stageLadderFor - G-Sec auction (RBI auction: short ladder)", () => {
  const ladder = stageLadderFor("gsec_auction");

  it("runs lead → mandated → pricing → allocation → settled → closed", () => {
    expect(ladder).toEqual(["lead", "mandated", "pricing", "allocation", "settled", "closed"]);
  });

  it("skips in_dd / structuring / rating_marketing (sovereign credit, no DD/rating)", () => {
    expect(ladder).not.toContain("in_dd");
    expect(ladder).not.toContain("structuring");
    expect(ladder).not.toContain("rating_marketing");
  });
});

describe("stageLadderFor - DCM advisory (advisory altitude; no allocation/settlement)", () => {
  const ladder = stageLadderFor("dcm_advisory");

  it("runs lead → mandated → in_dd → structuring → rating_marketing → pricing → closed", () => {
    expect(ladder).toEqual([
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "rating_marketing",
      "pricing",
      "closed",
    ]);
  });

  it("does NOT own allocation or settlement (execution hands to Binary Bonds)", () => {
    expect(ladder).not.toContain("allocation");
    expect(ladder).not.toContain("settled");
  });
});

describe("stageLadderFor - ECM book-built offers (full ladder)", () => {
  it("ecm_ipo has the full 9-stage ladder", () => {
    expect(stageLadderFor("ecm_ipo")).toEqual(stageLadderFor("bond_underwriting"));
  });

  it("ecm_fpo / ecm_qip / ecm_rights all share the full ladder", () => {
    for (const t of ["ecm_fpo", "ecm_qip", "ecm_rights"] as DealType[]) {
      expect(stageLadderFor(t)).toEqual(stageLadderFor("bond_underwriting"));
    }
  });
});

describe("stageLadderFor - structured credit ladders", () => {
  it("structured_finance skips allocation (no public book)", () => {
    const ladder = stageLadderFor("structured_finance");
    expect(ladder).not.toContain("allocation");
    expect(ladder).toContain("structuring");
    expect(ladder).toContain("rating_marketing");
  });

  it("supply_chain_finance is the shortest structured ladder (no rating_marketing)", () => {
    const ladder = stageLadderFor("supply_chain_finance");
    expect(ladder).not.toContain("rating_marketing");
    expect(ladder).not.toContain("allocation");
  });

  it("project_finance includes rating_marketing (project rating advisory) but no allocation", () => {
    const ladder = stageLadderFor("project_finance");
    expect(ladder).toContain("rating_marketing");
    expect(ladder).not.toContain("allocation");
  });
});

describe("stageLadderFor - advisory mandates (short ladders)", () => {
  it("valuation runs lead → mandated → in_dd → structuring → closed", () => {
    expect(stageLadderFor("valuation")).toEqual([
      "lead",
      "mandated",
      "in_dd",
      "structuring",
      "closed",
    ]);
  });

  it("fairness_opinion matches valuation's ladder", () => {
    expect(stageLadderFor("fairness_opinion")).toEqual(stageLadderFor("valuation"));
  });

  it("rating_advisory includes rating_marketing (agency coordination)", () => {
    const ladder = stageLadderFor("rating_advisory");
    expect(ladder).toContain("rating_marketing");
    expect(ladder).not.toContain("pricing");
    expect(ladder).not.toContain("allocation");
  });

  it("portfolio_management_mandate is a short mandate ladder", () => {
    const ladder = stageLadderFor("portfolio_management_mandate");
    expect(ladder).toEqual(["lead", "mandated", "in_dd", "structuring", "closed"]);
  });
});

describe("stageLadderFor - every deal type has a non-empty ladder", () => {
  it("every deal type returns a ladder starting with 'lead' and ending with 'closed'", () => {
    for (const t of dealTypeEnum.enumValues as DealType[]) {
      const ladder = stageLadderFor(t);
      expect(ladder.length).toBeGreaterThan(0);
      expect(ladder[0]).toBe("lead");
      expect(ladder[ladder.length - 1]).toBe("closed");
    }
  });
});

// ---------------------------------------------------------------------------
// Off-pipeline statuses.
// ---------------------------------------------------------------------------

describe("OFF_PIPELINE_STATUSES", () => {
  it("lists dropped + on_hold", () => {
    expect(OFF_PIPELINE_STATUSES).toContain("dropped");
    expect(OFF_PIPELINE_STATUSES).toContain("on_hold");
    expect(OFF_PIPELINE_STATUSES.length).toBe(2);
  });
});

describe("isOffPipelineStatus", () => {
  it("dropped and on_hold are off-pipeline", () => {
    expect(isOffPipelineStatus("dropped")).toBe(true);
    expect(isOffPipelineStatus("on_hold")).toBe(true);
  });

  it("active ladder statuses are not off-pipeline", () => {
    expect(isOffPipelineStatus("lead")).toBe(false);
    expect(isOffPipelineStatus("closed")).toBe(false);
    expect(isOffPipelineStatus("pricing")).toBe(false);
  });

  it("null / undefined / unknown are not off-pipeline", () => {
    expect(isOffPipelineStatus(null)).toBe(false);
    expect(isOffPipelineStatus(undefined)).toBe(false);
    expect(isOffPipelineStatus("nonsense")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stageSemanticsFor - per-stage label override.
// ---------------------------------------------------------------------------

describe("stageSemanticsFor", () => {
  it("returns the M&A-specific semantics for structuring (valuation & negotiation)", () => {
    expect(stageSemanticsFor("m_and_a", "structuring")).toBe("Valuation & negotiation");
  });

  it("returns the G-Sec-specific semantics for pricing (auction bidding)", () => {
    expect(stageSemanticsFor("gsec_auction", "pricing")).toContain("Auction bidding");
  });

  it("returns null for a status with no per-type override", () => {
    // M&A has no special 'lead' semantics → null (use generic label).
    expect(stageSemanticsFor("m_and_a", "lead")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// stageIndexInFlow.
// ---------------------------------------------------------------------------

describe("stageIndexInFlow", () => {
  it("returns 0 for 'lead' on every deal type", () => {
    for (const t of ["bond_underwriting", "m_and_a", "gsec_auction", "valuation"] as DealType[]) {
      expect(stageIndexInFlow(t, "lead")).toBe(0);
    }
  });

  it("returns the last index for 'closed' on every deal type", () => {
    for (const t of ["bond_underwriting", "m_and_a", "gsec_auction", "valuation"] as DealType[]) {
      const ladder = stageLadderFor(t);
      expect(stageIndexInFlow(t, "closed")).toBe(ladder.length - 1);
    }
  });

  it("returns -1 for off-pipeline statuses", () => {
    expect(stageIndexInFlow("bond_underwriting", "dropped")).toBe(-1);
    expect(stageIndexInFlow("bond_underwriting", "on_hold")).toBe(-1);
  });

  it("returns -1 for null / unknown statuses", () => {
    expect(stageIndexInFlow("bond_underwriting", null)).toBe(-1);
    expect(stageIndexInFlow("bond_underwriting", undefined)).toBe(-1);
    expect(stageIndexInFlow("bond_underwriting", "nonsense")).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// canTransitionStage - the core transition validator.
// ---------------------------------------------------------------------------

describe("canTransitionStage - same-status no-op", () => {
  it("from === to is always allowed", () => {
    expect(canTransitionStage("bond_underwriting", "pricing", "pricing")).toBe(true);
    expect(canTransitionStage("m_and_a", "lead", "lead")).toBe(true);
  });
});

describe("canTransitionStage - active forward, no skipping", () => {
  it("bond_underwriting: lead → mandated is allowed", () => {
    expect(canTransitionStage("bond_underwriting", "lead", "mandated")).toBe(true);
  });

  it("bond_underwriting: mandated → in_dd is allowed", () => {
    expect(canTransitionStage("bond_underwriting", "mandated", "in_dd")).toBe(true);
  });

  it("bond_underwriting: lead → in_dd is NOT allowed (skips mandated)", () => {
    expect(canTransitionStage("bond_underwriting", "lead", "in_dd")).toBe(false);
  });

  it("bond_underwriting: lead → pricing is NOT allowed (skips 3 stages)", () => {
    expect(canTransitionStage("bond_underwriting", "lead", "pricing")).toBe(false);
  });

  it("m_and_a: structuring → pricing is allowed (adjacent)", () => {
    expect(canTransitionStage("m_and_a", "structuring", "pricing")).toBe(true);
  });

  it("m_and_a: in_dd → pricing is NOT allowed (skips structuring)", () => {
    expect(canTransitionStage("m_and_a", "in_dd", "pricing")).toBe(false);
  });
});

describe("canTransitionStage - backward re-work is allowed", () => {
  it("bond_underwriting: pricing → in_dd is allowed (send back to DD)", () => {
    expect(canTransitionStage("bond_underwriting", "pricing", "in_dd")).toBe(true);
  });

  it("bond_underwriting: allocation → lead is allowed (full re-work)", () => {
    expect(canTransitionStage("bond_underwriting", "allocation", "lead")).toBe(true);
  });
});

describe("canTransitionStage - dropped is a terminal sink", () => {
  it("any non-dropped status → dropped is allowed", () => {
    expect(canTransitionStage("bond_underwriting", "lead", "dropped")).toBe(true);
    expect(canTransitionStage("bond_underwriting", "pricing", "dropped")).toBe(true);
    expect(canTransitionStage("m_and_a", "in_dd", "dropped")).toBe(true);
  });

  it("dropped → anything is NOT allowed (terminal)", () => {
    expect(canTransitionStage("bond_underwriting", "dropped", "lead")).toBe(false);
    expect(canTransitionStage("bond_underwriting", "dropped", "closed")).toBe(false);
    expect(canTransitionStage("bond_underwriting", "dropped", "on_hold")).toBe(false);
  });

  it("dropped → dropped is allowed (same-status no-op)", () => {
    expect(canTransitionStage("bond_underwriting", "dropped", "dropped")).toBe(true);
  });
});

describe("canTransitionStage - on_hold pause / resume", () => {
  it("any active ladder stage → on_hold is allowed", () => {
    expect(canTransitionStage("bond_underwriting", "pricing", "on_hold")).toBe(true);
    expect(canTransitionStage("m_and_a", "in_dd", "on_hold")).toBe(true);
  });

  it("on_hold → any active ladder stage is allowed (resume)", () => {
    expect(canTransitionStage("bond_underwriting", "on_hold", "pricing")).toBe(true);
    expect(canTransitionStage("bond_underwriting", "on_hold", "lead")).toBe(true);
  });

  it("on_hold → on_hold is allowed (same-status)", () => {
    expect(canTransitionStage("bond_underwriting", "on_hold", "on_hold")).toBe(true);
  });
});

describe("canTransitionStage - null / missing inputs", () => {
  it("returns false when either status is missing", () => {
    expect(canTransitionStage("bond_underwriting", null, "pricing")).toBe(false);
    expect(canTransitionStage("bond_underwriting", "lead", null)).toBe(false);
    expect(canTransitionStage("bond_underwriting", undefined, undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// nextStageFor.
// ---------------------------------------------------------------------------

describe("nextStageFor", () => {
  it("returns the next active stage for a mid-ladder status", () => {
    expect(nextStageFor("bond_underwriting", "lead")).toBe("mandated");
    expect(nextStageFor("bond_underwriting", "mandated")).toBe("in_dd");
    expect(nextStageFor("m_and_a", "structuring")).toBe("pricing");
  });

  it("returns null for the last active stage ('closed')", () => {
    expect(nextStageFor("bond_underwriting", "closed")).toBeNull();
    expect(nextStageFor("m_and_a", "closed")).toBeNull();
  });

  it("returns null for off-pipeline / unknown statuses", () => {
    expect(nextStageFor("bond_underwriting", "dropped")).toBeNull();
    expect(nextStageFor("bond_underwriting", "on_hold")).toBeNull();
    expect(nextStageFor("bond_underwriting", null)).toBeNull();
    expect(nextStageFor("bond_underwriting", "nonsense")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Catalog - allocation book + issuer-instrument flags.
// ---------------------------------------------------------------------------

describe("isAllocationDealType - allocation-book deals", () => {
  it("bond underwriting / HY / private placement / G-Sec auction / ECM book-built use a book", () => {
    expect(isAllocationDealType("bond_underwriting")).toBe(true);
    expect(isAllocationDealType("high_yield_bond")).toBe(true);
    expect(isAllocationDealType("private_placement_debt")).toBe(true);
    expect(isAllocationDealType("gsec_auction")).toBe(true);
    expect(isAllocationDealType("ecm_ipo")).toBe(true);
    expect(isAllocationDealType("ecm_fpo")).toBe(true);
    expect(isAllocationDealType("ecm_qip")).toBe(true);
    expect(isAllocationDealType("ecm_rights")).toBe(true);
  });

  it("advisory / valuation / portfolio / secondary mandates do NOT use a book", () => {
    expect(isAllocationDealType("m_and_a")).toBe(false);
    expect(isAllocationDealType("valuation")).toBe(false);
    expect(isAllocationDealType("fairness_opinion")).toBe(false);
    expect(isAllocationDealType("dcm_advisory")).toBe(false);
    expect(isAllocationDealType("rating_advisory")).toBe(false);
    expect(isAllocationDealType("portfolio_management_mandate")).toBe(false);
    expect(isAllocationDealType("secondary_trading_advisory")).toBe(false);
    expect(isAllocationDealType("project_finance")).toBe(false);
    expect(isAllocationDealType("supply_chain_finance")).toBe(false);
  });
});

describe("isIssuerInstrumentDealType - instrument-placing deals", () => {
  it("bond / HY / private placement / G-Sec auction / ECM / structured finance place an instrument", () => {
    expect(isIssuerInstrumentDealType("bond_underwriting")).toBe(true);
    expect(isIssuerInstrumentDealType("high_yield_bond")).toBe(true);
    expect(isIssuerInstrumentDealType("private_placement_debt")).toBe(true);
    expect(isIssuerInstrumentDealType("gsec_auction")).toBe(true);
    expect(isIssuerInstrumentDealType("ecm_ipo")).toBe(true);
    expect(isIssuerInstrumentDealType("structured_finance")).toBe(true);
  });

  it("pure advisory mandates place NO instrument", () => {
    expect(isIssuerInstrumentDealType("m_and_a")).toBe(false);
    expect(isIssuerInstrumentDealType("valuation")).toBe(false);
    expect(isIssuerInstrumentDealType("fairness_opinion")).toBe(false);
    expect(isIssuerInstrumentDealType("dcm_advisory")).toBe(false);
    expect(isIssuerInstrumentDealType("rating_advisory")).toBe(false);
    expect(isIssuerInstrumentDealType("project_finance")).toBe(false);
    expect(isIssuerInstrumentDealType("supply_chain_finance")).toBe(false);
  });
});

describe("defaultBrandForDealType", () => {
  it("bond products default to binarybonds", () => {
    expect(defaultBrandForDealType("bond_underwriting")).toBe("binarybonds");
    expect(defaultBrandForDealType("high_yield_bond")).toBe("binarybonds");
    expect(defaultBrandForDealType("gsec_auction")).toBe("binarybonds");
    expect(defaultBrandForDealType("rating_advisory")).toBe("binarybonds");
  });

  it("ECM / M&A / structured credit default to binarycapital", () => {
    expect(defaultBrandForDealType("ecm_ipo")).toBe("binarycapital");
    expect(defaultBrandForDealType("m_and_a")).toBe("binarycapital");
    expect(defaultBrandForDealType("project_finance")).toBe("binarycapital");
    expect(defaultBrandForDealType("valuation")).toBe("binarycapital");
  });
});

// ---------------------------------------------------------------------------
// DEAL_STAGE_FLOWS covers every schema deal type.
// ---------------------------------------------------------------------------

describe("DEAL_STAGE_FLOWS - covers every schema deal type", () => {
  it("every dealTypeEnum value has a stage-flow entry", () => {
    for (const t of dealTypeEnum.enumValues) {
      expect(DEAL_STAGE_FLOWS[t as DealType]).toBeDefined();
      expect(Array.isArray(DEAL_STAGE_FLOWS[t as DealType].ladder)).toBe(true);
    }
  });

  it("every ladder status is a valid dealStatusEnum value", () => {
    const valid = new Set(dealStatusEnum.enumValues);
    for (const flow of Object.values(DEAL_STAGE_FLOWS)) {
      for (const s of flow.ladder) {
        expect(valid.has(s)).toBe(true);
      }
    }
  });
});
