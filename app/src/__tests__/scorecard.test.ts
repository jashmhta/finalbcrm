// Scorecard scoring - verifies computeScorecard invariants and band mapping.
// Source: src/features/credit/scorecard.ts (CREDIT_ANALYSIS_SPEC §4).
//
// The scorecard is a weighted 0–100 composite over sub-factors (weights sum to
// 1.0). We assert: total score is bounded in [0, 100], the reported band is
// consistent with bandFromScore, an all-5 override yields exactly 100 / BC-1,
// and an all-1 override yields a low score / BC-6. We also confirm the DSCR
// weight is reallocated to zero for a corporate (non-project) obligor.

import { describe, expect, it } from "vitest";

import {
  computeScorecard,
  bandFromScore,
  defaultBaseWeights,
  resolveWeights,
  BAND_GRADE,
  BAND_PD_1Y,
  type SubFactor,
  type Band,
} from "@/features/credit/scorecard";
import { computeRatios } from "@/features/credit/ratios";
import type { FinancialStatement } from "@/db/schema";

const stmt = {
  lineItems: {
    revenue: 1000,
    cogs: 600,
    interest_expense: 50,
    pbt: 200,
    depreciation_amortization: 40,
    pat: 150,
    total_debt: 400,
    cash_and_equivalents: 50,
    net_worth: 500,
    tangible_net_worth: 450,
    total_assets: 1000,
    current_assets: 300,
    current_liabilities: 150,
    inventory: 100,
    cfo: 180,
    cfo_before_wc_changes: 190,
    capex: 60,
    cfads: 200,
    debt_service: 100,
  },
} as Pick<FinancialStatement, "lineItems">;

const ratios = computeRatios(stmt);

const allScore =
  (score: 1 | 2 | 3 | 4 | 5): Record<string, { score: 1 | 2 | 3 | 4 | 5; justification?: string }> =>
    // Cover every sub-factor code that appears in the default template.
    Object.fromEntries(
      Object.keys(defaultBaseWeights()).map((code) => [code, { score }]),
    );

describe("computeScorecard - invariants", () => {
  const result = computeScorecard({ ratios, obligorType: "corporate" });

  it("total score is in [0, 100]", () => {
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });

  it("reported band matches bandFromScore(totalScore)", () => {
    expect(result.band).toBe(bandFromScore(result.totalScore));
  });

  it("notional grade and PD are populated for the band", () => {
    expect(result.notionalGrade.length).toBeGreaterThan(0);
    expect(result.indicativePd1y).toBeGreaterThanOrEqual(0);
    expect(result.indicativePd1y).toBeLessThanOrEqual(1);
  });

  it("every sub-factor carries a weight and a 1–5 score", () => {
    for (const sf of result.subFactors as SubFactor[]) {
      expect(sf.weight).toBeGreaterThanOrEqual(0);
      expect(sf.score).toBeGreaterThanOrEqual(1);
      expect(sf.score).toBeLessThanOrEqual(5);
    }
  });
});

describe("computeScorecard - weight reallocation (corporate)", () => {
  it("DSCR weight is reallocated to zero for a non-project obligor", () => {
    const eff = resolveWeights(defaultBaseWeights(), "corporate");
    expect(eff["dscr"]).toBe(0);
    // The 7% is split +4% → interest_coverage, +3% → fcf_debt.
    expect(eff["interest_coverage"]).toBeCloseTo(0.08 + 0.04, 8);
    expect(eff["fcf_debt"]).toBeCloseTo(0.05 + 0.03, 8);
  });

  it("DSCR weight is retained for a project obligor", () => {
    const eff = resolveWeights(defaultBaseWeights(), "project");
    expect(eff["dscr"]).toBeCloseTo(0.07, 8);
  });

  it("effective weights still sum to 1.0 after reallocation", () => {
    const eff = resolveWeights(defaultBaseWeights(), "corporate");
    const sum = Object.values(eff).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 8);
  });
});

describe("computeScorecard - boundary scores", () => {
  it("all-5 overrides → totalScore 100 and band BC-1", () => {
    const result = computeScorecard({
      ratios,
      obligorType: "corporate",
      overrides: allScore(5),
    });
    expect(result.totalScore).toBeCloseTo(100, 6);
    expect(result.band).toBe("BC-1");
  });

  it("all-1 overrides → totalScore 20 (floor: score 1 = 1/5 × 100) and band BC-6", () => {
    // The spec formula is Σ weight × (score/5) × 100, with score ∈ {1..5},
    // so the minimum composite is 20 (every sub-factor at 1), not 0.
    const result = computeScorecard({
      ratios,
      obligorType: "corporate",
      overrides: allScore(1),
    });
    expect(result.totalScore).toBeCloseTo(20, 6);
    expect(result.band).toBe("BC-6");
  });
});

describe("bandFromScore - thresholds", () => {
  it("maps score bands to the expected BC grade", () => {
    expect(bandFromScore(100)).toBe("BC-1");
    expect(bandFromScore(85)).toBe("BC-1");
    expect(bandFromScore(70)).toBe("BC-2");
    expect(bandFromScore(55)).toBe("BC-3");
    expect(bandFromScore(40)).toBe("BC-4");
    expect(bandFromScore(25)).toBe("BC-5");
    expect(bandFromScore(0)).toBe("BC-6");
  });
});

describe("bandFromScore - boundary inclusivity (each band's lower bound)", () => {
  // Spec §4.2: 85–100 BC-1, 70–84 BC-2, 55–69 BC-3, 40–54 BC-4,
  // 25–39 BC-5, 0–24 BC-6. Each lower bound is INCLUSIVE.
  it("85 → BC-1 (inclusive lower bound)", () => {
    expect(bandFromScore(85)).toBe("BC-1");
  });
  it("84 → BC-2 (just below BC-1)", () => {
    expect(bandFromScore(84)).toBe("BC-2");
  });
  it("70 → BC-2 (inclusive lower bound)", () => {
    expect(bandFromScore(70)).toBe("BC-2");
  });
  it("69 → BC-3 (just below BC-2)", () => {
    expect(bandFromScore(69)).toBe("BC-3");
  });
  it("55 → BC-3 (inclusive lower bound)", () => {
    expect(bandFromScore(55)).toBe("BC-3");
  });
  it("54 → BC-4 (just below BC-3)", () => {
    expect(bandFromScore(54)).toBe("BC-4");
  });
  it("40 → BC-4 (inclusive lower bound)", () => {
    expect(bandFromScore(40)).toBe("BC-4");
  });
  it("39 → BC-5 (just below BC-4)", () => {
    expect(bandFromScore(39)).toBe("BC-5");
  });
  it("25 → BC-5 (inclusive lower bound)", () => {
    expect(bandFromScore(25)).toBe("BC-5");
  });
  it("24 → BC-6 (just below BC-5)", () => {
    expect(bandFromScore(24)).toBe("BC-6");
  });
  it("0 → BC-6 (floor)", () => {
    expect(bandFromScore(0)).toBe("BC-6");
  });
});

describe("BAND_GRADE - notional grade per band", () => {
  it("every band has a non-empty notional grade", () => {
    const bands: Band[] = ["BC-1", "BC-2", "BC-3", "BC-4", "BC-5", "BC-6"];
    for (const b of bands) {
      expect(BAND_GRADE[b].length).toBeGreaterThan(0);
    }
  });

  it("BC-1 is 'Excellent' and BC-6 is the distressed grade", () => {
    expect(BAND_GRADE["BC-1"]).toBe("Excellent");
    expect(BAND_GRADE["BC-6"]).toBe("Distressed / near-default");
  });
});

describe("BAND_PD_1Y - indicative 1-yr PD per band (spec §4.2)", () => {
  it("PD increases monotonically as the band weakens (BC-1 → BC-6)", () => {
    const bands: Band[] = ["BC-1", "BC-2", "BC-3", "BC-4", "BC-5", "BC-6"];
    for (let i = 1; i < bands.length; i++) {
      expect(BAND_PD_1Y[bands[i]]).toBeGreaterThan(BAND_PD_1Y[bands[i - 1]]);
    }
  });

  it("every PD is in [0, 1]", () => {
    const bands: Band[] = ["BC-1", "BC-2", "BC-3", "BC-4", "BC-5", "BC-6"];
    for (const b of bands) {
      expect(BAND_PD_1Y[b]).toBeGreaterThanOrEqual(0);
      expect(BAND_PD_1Y[b]).toBeLessThanOrEqual(1);
    }
  });

  it("BC-1 PD is < 0.05% (the spec headline)", () => {
    expect(BAND_PD_1Y["BC-1"]).toBeLessThan(0.0005);
  });

  it("BC-6 PD is the largest (distressed)", () => {
    expect(BAND_PD_1Y["BC-6"]).toBe(0.15);
  });
});

describe("defaultBaseWeights - weight normalization", () => {
  it("the default sub-factor weights sum to 1.0 (spec §4.1)", () => {
    const w = defaultBaseWeights();
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 8);
  });

  it("every weight is in [0, 1]", () => {
    const w = defaultBaseWeights();
    for (const v of Object.values(w)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("DSCR carries 7% in the base weights (before reallocation)", () => {
    const w = defaultBaseWeights();
    expect(w["dscr"]).toBeCloseTo(0.07, 8);
  });
});

describe("resolveWeights - reallocation invariants", () => {
  it("effective weights still sum to 1.0 after reallocation (corporate)", () => {
    const eff = resolveWeights(defaultBaseWeights(), "corporate");
    const sum = Object.values(eff).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 8);
  });

  it("effective weights sum to 1.0 for project / SPV (no reallocation)", () => {
    const effProj = resolveWeights(defaultBaseWeights(), "project");
    const effSpv = resolveWeights(defaultBaseWeights(), "spv");
    expect(Object.values(effProj).reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 8);
    expect(Object.values(effSpv).reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 8);
  });

  it("a custom template with no DSCR weight is returned unchanged (no reallocation)", () => {
    const custom: Record<string, number> = { ...defaultBaseWeights(), dscr: 0 };
    const eff = resolveWeights(custom, "corporate");
    // dscrW = 0 → no reallocation; weights match the input.
    expect(eff["dscr"]).toBe(0);
    expect(eff["interest_coverage"]).toBeCloseTo(custom["interest_coverage"], 8);
  });
});

describe("computeScorecard - quantitative auto-scoring", () => {
  // The hand-built statement above yields:
  //   net_debt_ebitda = 350/290 ≈ 1.207 (≤1.5 → score 5)
  //   interest_coverage = 250/50 = 5.0 (≥4.0 → score 5)
  //   current_ratio = 300/150 = 2.0 (≥1.33 → score 5)
  //   ffo_debt = 190/400 = 0.475 (≥0.30 → score 5)
  //   fcf_debt = (180−60)/400 = 0.30 (≥0.20 → score 5)
  //   roce = 250/850 ≈ 0.294 (≥0.14 → score 5)
  //   debt_to_tangible_nw = 400/450 ≈ 0.889 (≤1.0 → score 5)
  const r = computeRatios(stmt);
  const result = computeScorecard({ ratios: r, obligorType: "corporate" });

  it("auto-scores net_debt_ebitda from the ratio set", () => {
    const sf = result.subFactors.find((s) => s.code === "net_debt_ebitda")!;
    expect(sf.inputValue).toBeCloseTo(1.207, 2);
    expect(sf.score).toBe(5); // ≤1.5x
  });

  it("auto-scores interest_coverage", () => {
    const sf = result.subFactors.find((s) => s.code === "interest_coverage")!;
    expect(sf.score).toBe(5); // 5.0x ≥ 4.0
  });

  it("auto-scores fcf_debt", () => {
    const sf = result.subFactors.find((s) => s.code === "fcf_debt")!;
    expect(sf.score).toBe(5); // 0.30 ≥ 0.20
  });

  it("defaults qualitative sub-factors to score 3 (neutral) with a pending-justification note", () => {
    const sf = result.subFactors.find((s) => s.code === "market_position")!;
    expect(sf.score).toBe(3);
    expect(sf.justification.toLowerCase()).toContain("qualitative");
  });

  it("DSCR sub-factor has weight 0 for a corporate (reallocation) but still reports a score", () => {
    const sf = result.subFactors.find((s) => s.code === "dscr")!;
    expect(sf.weight).toBe(0);
    // DSCR is 2.0 ≥ 1.75 → would score 5, but it carries no weight for a corp.
    expect(sf.score).toBeGreaterThanOrEqual(1);
  });
});

describe("computeScorecard - partial-credit mix (not all 5s)", () => {
  it("an all-3 override yields totalScore 60 (3/5 × 100)", () => {
    const result = computeScorecard({
      ratios,
      obligorType: "corporate",
      overrides: allScore(3),
    });
    expect(result.totalScore).toBeCloseTo(60, 6);
    expect(result.band).toBe("BC-3");
  });

  it("an all-4 override yields totalScore 80", () => {
    const result = computeScorecard({
      ratios,
      obligorType: "corporate",
      overrides: allScore(4),
    });
    expect(result.totalScore).toBeCloseTo(80, 6);
    expect(result.band).toBe("BC-2");
  });
});
