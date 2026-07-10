// AI engines - heuristic generator invariants.
// Source of truth: src/features/ai/{creditSummary,interactionSummary,clientInsights}.ts.
//
// Pins the deterministic behaviour of the "no external LLM" generators:
//   - creditSummary: recommendation posture by band, NBFC framing, trend line,
//     strengths/concerns thresholds, rating line.
//   - interactionSummary: topic extraction, action-item extraction, empty
//     scope, per-note mini-summary.
//   - clientInsights: score bounding + the recommended-action taxonomy.
//
// Only the PURE generators are exercised - the server loaders (getCreditSummary,
// getInteractionSummary, getClientInsights, getNextActions) hit the live DB and
// are covered by the route smoke test, not here.

import { describe, expect, it } from "vitest";

import {
  generateCreditSummary,
  type CreditSummaryInput,
} from "@/features/ai/creditSummary";
import {
  summarizeInteractions,
  summarizeOneInteraction,
  type InteractionSummaryInput,
  type InteractionNote,
} from "@/features/ai/interactionSummary";
import {
  relationshipStrengthScore,
  dealPotentialScore,
  recommendAction,
} from "@/features/ai/clientInsights";

// ---------------------------------------------------------------------------
// creditSummary - fixtures
// ---------------------------------------------------------------------------

const baseStrongCorporate = (): CreditSummaryInput => ({
  creditAnalysisId: "ca-1",
  issuerName: "Acme Steel Pvt Ltd",
  obligorType: "corporate",
  sectorLabel: "Iron & steel",
  isListed: false,
  domicileState: "Maharashtra",
  analysisType: "origination",
  internalRatingShort: "AA",
  internalRatingAction: "assign",
  recommendation: null,
  watchlist: false,
  score: 78,
  band: "BC-2",
  bandGrade: "Strong",
  pd1yPct: 0.1,
  ratios: {
    debtEbitda: 2.1,
    netDebtEbitda: 1.4,
    debtEquity: 0.9,
    interestCoverage: 5.2,
    dscr: null,
    currentRatio: 1.6,
    quickRatio: 1.1,
    ebitdaMargin: 0.18,
    patMargin: 0.09,
    roce: 0.14,
    roe: 0.13,
    gnpaPct: null,
    nnpaPct: null,
    crar: null,
    nim: null,
  },
  externalRatings: [
    { agency: "CRISIL", ratingValue: "AA+", scale: "long_term", outlook: "stable" },
  ],
  grossExposureInrCr: 125.5,
  latestPeriodEnd: "2025-03-31",
  priorPeriodEnd: "2024-03-31",
});

const baseWeakCorporate = (): CreditSummaryInput => ({
  ...baseStrongCorporate(),
  issuerName: "Acme Distressed Ltd",
  score: 30,
  band: "BC-5",
  bandGrade: "Weak / sub-IG",
  pd1yPct: 5,
  // Clean BC-5 decline - no watchlist flag / no negative action so the
  // band-based decline posture is exercised (the watchlist + negative-action
  // overrides are covered by their own tests below).
  internalRatingAction: "maintain",
  watchlist: false,
  ratios: {
    debtEbitda: 6.4,
    netDebtEbitda: 5.1,
    debtEquity: 3.2,
    interestCoverage: 1.1,
    dscr: null,
    currentRatio: 0.8,
    quickRatio: 0.4,
    ebitdaMargin: 0.06,
    patMargin: -0.02,
    roce: 0.05,
    roe: 0.03,
    gnpaPct: null,
    nnpaPct: null,
    crar: null,
    nim: null,
  },
  externalRatings: [
    { agency: "ICRA", ratingValue: "BB", scale: "long_term", outlook: "negative" },
  ],
});

// ---------------------------------------------------------------------------
// creditSummary - recommendation posture
// ---------------------------------------------------------------------------

describe("generateCreditSummary - recommendation posture", () => {
  it("approves an investment-grade obligor (BC-2) with positive priority", () => {
    const s = generateCreditSummary(baseStrongCorporate());
    expect(s.recommendation).toMatch(/Approve/);
    expect(s.recommendationPriority).toBe("positive");
  });

  it("declines a sub-IG obligor (BC-5) with warning priority", () => {
    const s = generateCreditSummary(baseWeakCorporate());
    expect(s.recommendation).toMatch(/Decline/);
    expect(s.recommendationPriority).toBe("warning");
  });

  it("overrides to watchlist posture when the watchlist flag is set, even for an IG band", () => {
    const input = { ...baseStrongCorporate(), watchlist: true };
    const s = generateCreditSummary(input);
    expect(s.recommendation).toMatch(/Watchlist/);
    expect(s.recommendationPriority).toBe("warning");
  });

  it("overrides to watchlist posture on a negative rating action (downgrade)", () => {
    const input = {
      ...baseStrongCorporate(),
      watchlist: false,
      internalRatingAction: "watch_negative",
    };
    const s = generateCreditSummary(input);
    expect(s.recommendation).toMatch(/Watchlist/);
    expect(s.recommendationPriority).toBe("warning");
  });

  it("approves BC-4 with conditions (info priority)", () => {
    const input = { ...baseStrongCorporate(), band: "BC-4", bandGrade: "Below average", score: 47 };
    const s = generateCreditSummary(input);
    expect(s.recommendation).toMatch(/Approve with conditions/);
    expect(s.recommendationPriority).toBe("info");
  });

  it("declines a distressed obligor (BC-6) with critical priority", () => {
    const input = { ...baseStrongCorporate(), band: "BC-6", bandGrade: "Distressed", score: 18, pd1yPct: 15 };
    const s = generateCreditSummary(input);
    expect(s.recommendation).toMatch(/Decline/);
    expect(s.recommendationPriority).toBe("critical");
  });

  it("returns a pending posture when no score or band is present", () => {
    const input: CreditSummaryInput = {
      ...baseStrongCorporate(),
      score: null,
      band: null,
      bandGrade: null,
      pd1yPct: null,
      internalRatingShort: null,
    };
    const s = generateCreditSummary(input);
    expect(s.recommendation).toMatch(/Pending/);
    expect(s.recommendationPriority).toBe("info");
  });
});

// ---------------------------------------------------------------------------
// creditSummary - strengths / concerns thresholds
// ---------------------------------------------------------------------------

describe("generateCreditSummary - strengths & concerns", () => {
  it("flags strong coverage and conservative leverage as strengths", () => {
    const s = generateCreditSummary(baseStrongCorporate());
    expect(s.strengths.some((x) => /Strong debt service coverage/.test(x))).toBe(true);
    expect(s.strengths.some((x) => /Conservative leverage/.test(x))).toBe(true);
    // IG external rating support should appear.
    expect(s.strengths.some((x) => /investment-grade/.test(x))).toBe(true);
  });

  it("flags elevated leverage, thin coverage, and liquidity pressure as concerns", () => {
    const s = generateCreditSummary(baseWeakCorporate());
    expect(s.concerns.some((x) => /Elevated leverage/.test(x))).toBe(true);
    expect(s.concerns.some((x) => /Thin debt service coverage/.test(x))).toBe(true);
    expect(s.concerns.some((x) => /Liquidity pressure/.test(x))).toBe(true);
    // Sub-IG external rating flag.
    expect(s.concerns.some((x) => /sub-investment-grade/.test(x))).toBe(true);
  });

  it("emits a 'within prudent limits' concerns fallback when no thresholds breach", () => {
    const input = { ...baseStrongCorporate(), watchlist: false, internalRatingAction: "assign" };
    const s = generateSummaryWithNoConcerns(input);
    expect(s.concerns.some((x) => /within prudent limits/.test(x))).toBe(true);
  });
});

// Helper: build a strong IG input whose only potential concern is the band -
// force band to BC-1 so no band-concern fires, and clear rating action.
function generateSummaryWithNoConcerns(input: CreditSummaryInput) {
  const clean: CreditSummaryInput = {
    ...input,
    band: "BC-1",
    bandGrade: "Excellent",
    score: 90,
    internalRatingAction: "assign",
    watchlist: false,
    externalRatings: [
      { agency: "CRISIL", ratingValue: "AAA", scale: "long_term", outlook: "stable" },
    ],
  };
  return generateCreditSummary(clean);
}

// ---------------------------------------------------------------------------
// creditSummary - NBFC framing + trend
// ---------------------------------------------------------------------------

describe("generateCreditSummary - framing & trend", () => {
  it("frames an NBFC with NPA / CRAR / NIM instead of leverage / coverage", () => {
    const input: CreditSummaryInput = {
      ...baseStrongCorporate(),
      obligorType: "nbfc",
      issuerName: "Acme NBFC Ltd",
      band: "BC-2",
      ratios: {
        debtEbitda: null,
        netDebtEbitda: null,
        debtEquity: null,
        interestCoverage: null,
        dscr: null,
        currentRatio: null,
        quickRatio: null,
        ebitdaMargin: null,
        patMargin: null,
        roce: null,
        roe: null,
        gnpaPct: 0.015,
        nnpaPct: 0.008,
        crar: 0.175,
        nim: 0.038,
      },
    };
    const s = generateCreditSummary(input);
    expect(s.financials).toMatch(/NPA/);
    expect(s.financials).toMatch(/CRAR/);
    expect(s.financials).toMatch(/NIM/);
    // Should NOT use the corporate leverage framing.
    expect(s.financials).not.toMatch(/Debt\/EBITDA/);
  });

  it("adds a trend sentence when prior-period ratios are supplied", () => {
    const input: CreditSummaryInput = {
      ...baseStrongCorporate(),
      priorRatios: {
        debtEbitda: 3.0, // leverage has improved (down from 3.0 to 2.1)
        interestCoverage: 4.0, // coverage has improved (up from 4.0 to 5.2)
        ebitdaMargin: 0.14, // margin has improved
      },
    };
    const s = generateCreditSummary(input);
    expect(s.financials).toMatch(/Versus the prior period/);
    expect(s.financials).toMatch(/leverage has improved/);
    expect(s.financials).toMatch(/interest coverage has improved/);
  });

  it("emits a 'no financial statements' sentence when ratios are all null", () => {
    const input: CreditSummaryInput = {
      ...baseStrongCorporate(),
      ratios: {
        debtEbitda: null, netDebtEbitda: null, debtEquity: null, interestCoverage: null,
        dscr: null, currentRatio: null, quickRatio: null, ebitdaMargin: null,
        patMargin: null, roce: null, roe: null, gnpaPct: null, nnpaPct: null,
        crar: null, nim: null,
      },
      latestPeriodEnd: null,
    };
    const s = generateCreditSummary(input);
    expect(s.financials).toMatch(/No financial statements are linked/);
  });

  it("builds a compact rating line from band + score + PD", () => {
    const s = generateCreditSummary(baseStrongCorporate());
    expect(s.ratingLine).toContain("BC-2");
    expect(s.ratingLine).toContain("Strong");
    expect(s.ratingLine).toContain("/100");
    expect(s.ratingLine).toContain("1-yr PD");
  });
});

// ---------------------------------------------------------------------------
// interactionSummary - topic + action extraction
// ---------------------------------------------------------------------------

function note(over: Partial<InteractionNote>): InteractionNote {
  return {
    interactionId: over.interactionId ?? "i-1",
    subject: over.subject ?? null,
    body: over.body ?? null,
    channel: over.channel ?? "meeting",
    occurredAt: over.occurredAt ?? new Date().toISOString(),
    nextAction: over.nextAction ?? null,
    partyName: over.partyName ?? "Acme Steel",
    dealCode: over.dealCode ?? null,
    dealName: over.dealName ?? null,
  };
}

describe("summarizeInteractions - topic & action extraction", () => {
  it("returns an empty-scope overview when no notes are provided", () => {
    const input: InteractionSummaryInput = {
      notes: [],
      scope: { partyId: "p-1" },
      scopeLabel: "Acme Steel",
    };
    const s = summarizeInteractions(input);
    expect(s.interactionCount).toBe(0);
    expect(s.overview).toMatch(/No interactions have been logged/);
    expect(s.keyTopics).toHaveLength(0);
    expect(s.actionItems).toHaveLength(0);
  });

  it("extracts the dominant deal topics from subjects + bodies", () => {
    const input: InteractionSummaryInput = {
      notes: [
        note({
          interactionId: "i-1",
          subject: "Rating discussion with CRISIL",
          body: "Walked the rating agency through the structured bond; pricing at 90 bps over G-Sec.",
        }),
        note({
          interactionId: "i-2",
          subject: "Allocation confirm",
          body: "Confirmed allocation and CCIL settlement for the NCD issuance.",
          nextAction: "Send term sheet to investor",
        }),
      ],
      scope: { partyId: "p-1" },
      scopeLabel: "Acme Steel",
    };
    const s = summarizeInteractions(input);
    expect(s.interactionCount).toBe(2);
    expect(s.keyTopics).toContain("Credit rating");
    expect(s.keyTopics).toContain("Pricing & coupon");
    expect(s.keyTopics).toContain("Allocation & settlement");
    expect(s.channels).toContain("Meeting");
  });

  it("extracts action items from next_action fields and body imperatives", () => {
    const input: InteractionSummaryInput = {
      notes: [
        note({ interactionId: "i-1", nextAction: "Schedule the committee review" }),
        note({
          interactionId: "i-2",
          body: "Good meeting. Follow up with the treasurer on the collateral package next week.",
        }),
      ],
      scope: { partyId: "p-1" },
      scopeLabel: "Acme Steel",
    };
    const s = summarizeInteractions(input);
    expect(s.actionItems.some((a) => /Schedule the committee review/.test(a))).toBe(true);
    expect(s.actionItems.some((a) => /Follow up with the treasurer/.test(a))).toBe(true);
  });

  it("summarizeOneInteraction returns the dominant topic + an action item", () => {
    const n = note({
      subject: "KYC refresh walk-through",
      body: "Discussed the re-KYC pack. Send the beneficial-owner declarations by Friday.",
    });
    const mini = summarizeOneInteraction(n);
    expect(mini.topic).toBe("KYC & onboarding");
    expect(mini.actionItem).toMatch(/Send the beneficial-owner declarations/);
  });

  it("summarizeOneInteraction falls back to the subject when no topic matches", () => {
    const n = note({ subject: "Quick hello", body: "Said hi." });
    const mini = summarizeOneInteraction(n);
    // No domain keyword matches → falls back to the subject.
    expect(mini.topic).toBe("Quick hello");
    expect(mini.actionItem).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// clientInsights - score bounding + action taxonomy
// ---------------------------------------------------------------------------

describe("relationshipStrengthScore - bounding", () => {
  it("caps at 100 even with huge inputs", () => {
    expect(relationshipStrengthScore(1000, 50, 30)).toBeLessThanOrEqual(100);
  });
  it("is 0 when nothing is present", () => {
    expect(relationshipStrengthScore(0, 0, 0)).toBe(0);
  });
  it("blends the three sub-scores", () => {
    // 20 weighted interactions → 50pts; 5 deals → 30pts; 4 contacts → 20pts → 100.
    expect(relationshipStrengthScore(20, 5, 4)).toBe(100);
    // 10 weighted → 25pts; 0 deals → 0; 2 contacts → 10pts → 35.
    expect(relationshipStrengthScore(10, 0, 2)).toBe(35);
  });
});

describe("dealPotentialScore - bounding", () => {
  it("caps at 100", () => {
    expect(dealPotentialScore(10, 10000, 0)).toBeLessThanOrEqual(100);
  });
  it("is 0 with no deals and no interaction", () => {
    expect(dealPotentialScore(0, 0, null)).toBe(0);
  });
  it("rewards recent interaction recency", () => {
    const recent = dealPotentialScore(2, 100, 5);
    const cold = dealPotentialScore(2, 100, 80);
    expect(recent).toBeGreaterThan(cold);
  });
});

describe("recommendAction - taxonomy", () => {
  const now = new Date("2026-06-15T00:00:00Z").getTime();
  const inDays = (d: number) => new Date(now + d * 24 * 60 * 60 * 1000);

  it("recommends refresh_kyc when re-KYC is within the 30-day window", () => {
    const a = recommendAction({
      activeDealCount: 1,
      daysSinceLastInteraction: 5,
      rekycDueDate: inDays(9),
      relationshipStrength: 60,
      now,
    });
    expect(a.kind).toBe("refresh_kyc");
    expect(a.rationale).toMatch(/re-KYC/);
  });

  it("recommends advance_mandate when an active deal has gone quiet (>21d)", () => {
    const a = recommendAction({
      activeDealCount: 1,
      daysSinceLastInteraction: 30,
      rekycDueDate: inDays(120),
      relationshipStrength: 50,
      now,
    });
    expect(a.kind).toBe("advance_mandate");
    expect(a.rationale).toMatch(/Active mandate/);
  });

  it("recommends re_engage when a relationship with no live mandate has gone cold (>60d)", () => {
    const a = recommendAction({
      activeDealCount: 0,
      daysSinceLastInteraction: 90,
      rekycDueDate: null,
      relationshipStrength: 25,
      now,
    });
    expect(a.kind).toBe("re_engage");
    expect(a.rationale).toMatch(/re-engage/);
  });

  it("recommends re_engage when there is no interaction on record and no live deal", () => {
    const a = recommendAction({
      activeDealCount: 0,
      daysSinceLastInteraction: null,
      rekycDueDate: null,
      relationshipStrength: 0,
      now,
    });
    expect(a.kind).toBe("re_engage");
    expect(a.rationale).toMatch(/No interaction on record/);
  });

  it("recommends deepen_coverage for a strong, multi-mandate, recently-touched relationship", () => {
    const a = recommendAction({
      activeDealCount: 2,
      daysSinceLastInteraction: 12,
      rekycDueDate: inDays(200),
      relationshipStrength: 80,
      now,
    });
    expect(a.kind).toBe("deepen_coverage");
    expect(a.rationale).toMatch(/broaden coverage/);
  });

  it("recommends maintain for a healthy cadence with no escalation", () => {
    const a = recommendAction({
      activeDealCount: 1,
      daysSinceLastInteraction: 10,
      rekycDueDate: inDays(200),
      relationshipStrength: 55,
      now,
    });
    expect(a.kind).toBe("maintain");
    expect(a.rationale).toMatch(/cadence|stable/);
  });

  it("prioritises refresh_kyc over advance_mandate when both apply", () => {
    const a = recommendAction({
      activeDealCount: 1,
      daysSinceLastInteraction: 40,
      rekycDueDate: inDays(5),
      relationshipStrength: 50,
      now,
    });
    expect(a.kind).toBe("refresh_kyc");
  });
});
