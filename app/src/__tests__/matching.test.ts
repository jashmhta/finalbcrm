// Investor Matching Engine - exhaustive verification of the scoring + ranking
// business logic (Binary Capital CRM USP - scrape/BUSINESS_CONTEXT.md §3).
//
// Source of truth: src/features/matching/engine.ts.
//
// Coverage:
//   - Weight distribution: the six SCORED criteria sum to 1.0; relationship is
//     weight 0 (indicator only, not in the base score).
//   - scoreInvestor: 0–100 weighted score, exact values for canonical
//     perfect-fit / all-fail / partial-credit investors.
//   - Per-criterion scorers (rating gate, tenor band + partial credit, sector
//     exact/related/open, ticket tiers, demat & KYC gates, relationship
//     indicator) - exercised via scoreInvestor's CriterionResult array.
//   - Rank tie-breaks: score desc → matchCount desc → warm-intro strength.
//   - Warm-intro strength classification (none / cold / warm / strong) from
//     interaction count + recency.
//   - Kind inference heuristic + kind-derived default rating floor / tenor
//     range.
//   - Score banding (bandForScore) + filter predicates.
//
// The engine is PURE (no DB, no React) so the suite is hermetic.

import { describe, expect, it } from "vitest";

import {
  scoreInvestor,
  rankInvestors,
  classifyWarmIntro,
  inferInvestorKind,
  defaultMinRatingRank,
  defaultTenorRange,
  bandForScore,
  SCORE_WEIGHTS,
  CRITERIA_ORDER,
  MATCH_FILTERS,
  DEFAULT_TICKET_CRORES,
  SCORE_BAND_LABEL,
  type IssuerProfile,
  type InvestorProfile,
  type WarmIntroPath,
  type CriterionKey,
  type InvestorKind,
} from "@/features/matching/engine";

// ---------------------------------------------------------------------------
// Profile builders - minimal valid shapes with sensible defaults.
// ---------------------------------------------------------------------------

const baseIssuer = (over: Partial<IssuerProfile> = {}): IssuerProfile => ({
  partyId: "iss-1",
  legalName: "Issuer Co",
  displayName: null,
  ratingRank: 1, // AAA
  ratingValue: "AAA",
  ratingAgency: "CRISIL",
  ratingBand: "BC-1",
  sectorCode: "infra.roads",
  sectorLabel: "Infrastructure - Roads",
  sectorFamily: "infra",
  tenorYears: 5,
  targetSizeCrores: 100,
  dealId: "d1",
  dealCode: "BG-001",
  dealName: "Issuer Bond",
  dealType: "bond_underwriting",
  dealStatus: "pricing",
  ...over,
});

const baseInvestor = (over: Partial<InvestorProfile> = {}): InvestorProfile => ({
  partyId: "inv-1",
  legalName: "Investor Co",
  displayName: null,
  partyNature: "organization",
  kind: "Bank",
  minRatingRank: 10, // BBB− floor - accepts AAA..BBB−
  minRatingValue: "BBB-",
  tenorMin: 2,
  tenorMax: 10,
  mandateSectors: ["infra.roads"],
  typicalTicketCrores: 100,
  dematReady: true,
  kycCurrent: true,
  kycStatus: "approved",
  kycValidUntil: "2030-01-01",
  hasRelationship: true,
  interactionCount: 3,
  dealCount: 2,
  preferenceSource: "history",
  ...over,
});

const warmIntro = (over: Partial<WarmIntroPath> = {}): WarmIntroPath => ({
  bankerUserId: "u1",
  bankerName: "Banker One",
  bankerEmail: "b1@binarycapital.in",
  bankerDesk: "Credit",
  interactionCount: 3,
  lastTouchAt: new Date().toISOString(),
  lastChannel: "call",
  lastSubject: "intro",
  strength: "warm",
  ...over,
});

// ---------------------------------------------------------------------------
// Weight distribution.
// ---------------------------------------------------------------------------

describe("SCORE_WEIGHTS - distribution", () => {
  it("the six SCORED criteria sum to 1.0 (relationship excluded)", () => {
    const scored: CriterionKey[] = [
      "rating",
      "tenor",
      "sector",
      "ticket",
      "demat",
      "kyc",
    ];
    const sum = scored.reduce((acc, k) => acc + SCORE_WEIGHTS[k], 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it("relationship carries weight 0 (indicator only, not in base score)", () => {
    expect(SCORE_WEIGHTS.relationship).toBe(0);
  });

  it("weights match the spec: rating 25 / tenor 20 / sector 20 / ticket 15 / demat 10 / kyc 10", () => {
    expect(SCORE_WEIGHTS.rating).toBeCloseTo(0.25, 10);
    expect(SCORE_WEIGHTS.tenor).toBeCloseTo(0.2, 10);
    expect(SCORE_WEIGHTS.sector).toBeCloseTo(0.2, 10);
    expect(SCORE_WEIGHTS.ticket).toBeCloseTo(0.15, 10);
    expect(SCORE_WEIGHTS.demat).toBeCloseTo(0.1, 10);
    expect(SCORE_WEIGHTS.kyc).toBeCloseTo(0.1, 10);
  });

  it("CRITERIA_ORDER lists all seven criteria with relationship last", () => {
    expect(CRITERIA_ORDER).toHaveLength(7);
    expect(CRITERIA_ORDER[CRITERIA_ORDER.length - 1]).toBe("relationship");
    expect(new Set(CRITERIA_ORDER).size).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// scoreInvestor - canonical cases (exact weighted scores).
// ---------------------------------------------------------------------------

describe("scoreInvestor - perfect fit (all criteria pass)", () => {
  const issuer = baseIssuer();
  const inv = baseInvestor();
  const m = scoreInvestor(issuer, inv, warmIntro());

  it("score is exactly 100 (all six scored criteria at full credit)", () => {
    expect(m.score).toBe(100);
  });

  it("every criterion reports matched=true with score 1", () => {
    for (const c of m.criteria) {
      expect(c.matched).toBe(true);
      expect(c.score).toBe(1);
    }
  });

  it("matchCount is 7 (all seven criteria, including the warm-intro indicator)", () => {
    expect(m.matchCount).toBe(7);
  });

  it("carries the warm-intro path through", () => {
    expect(m.warmIntro).not.toBeNull();
    expect(m.warmIntro?.bankerEmail).toBe("b1@binarycapital.in");
  });
});

describe("scoreInvestor - all-fail investor (hard gates fail, no partial credit)", () => {
  // Issuer is sub-IG (BB, rank 12) with a 2y tenor (far below the 10y floor),
  // 100 Cr target, infra.roads. Investor is AAA-only (rank 1 floor), wants
  // 10–20y, energy.power mandate, 10 Cr typical ticket, NO demat, NO KYC, no
  // relationship. Every scored criterion contributes 0.
  const issuer = baseIssuer({
    ratingRank: 12,
    ratingValue: "BB",
    ratingBand: "BC-5",
    tenorYears: 2,
    targetSizeCrores: 100,
    sectorCode: "infra.roads",
    sectorFamily: "infra",
  });
  const inv = baseInvestor({
    minRatingRank: 1, // AAA only
    tenorMin: 10,
    tenorMax: 20,
    mandateSectors: ["energy.power"],
    typicalTicketCrores: 10,
    dematReady: false,
    kycCurrent: false,
    hasRelationship: false,
    interactionCount: 0,
  });
  const m = scoreInvestor(issuer, inv, null);

  it("score is 0 (every scored criterion contributes 0)", () => {
    expect(m.score).toBe(0);
  });

  it("rating gate fails (issuer BB > floor AAA)", () => {
    const rating = m.criteria.find((c) => c.key === "rating")!;
    expect(rating.matched).toBe(false);
    expect(rating.score).toBe(0);
  });

  it("demat and KYC gates fail (binary, no partial credit)", () => {
    const demat = m.criteria.find((c) => c.key === "demat")!;
    const kyc = m.criteria.find((c) => c.key === "kyc")!;
    expect(demat.matched).toBe(false);
    expect(demat.score).toBe(0);
    expect(kyc.matched).toBe(false);
    expect(kyc.score).toBe(0);
  });

  it("sector fails (issuer infra vs mandate energy.power, different family)", () => {
    const sector = m.criteria.find((c) => c.key === "sector")!;
    expect(sector.matched).toBe(false);
    expect(sector.score).toBe(0);
  });

  it("ticket fails (deal 100 Cr >> 10 Cr capacity; beyond 6x)", () => {
    const ticket = m.criteria.find((c) => c.key === "ticket")!;
    expect(ticket.score).toBe(0);
  });

  it("tenor fails with 0 partial credit (2y far below the 10y floor; ratio 0.2)", () => {
    const tenor = m.criteria.find((c) => c.key === "tenor")!;
    expect(tenor.score).toBe(0);
    expect(tenor.matched).toBe(false);
  });

  it("matchCount is 0 (relationship also unmatched)", () => {
    expect(m.matchCount).toBe(0);
  });
});

describe("scoreInvestor - partial credit on tenor, sector, ticket", () => {
  it("tenor just below tenorMin scores 0.6 (ratio >= 0.75)", () => {
    const issuer = baseIssuer({ tenorYears: 8 });
    const inv = baseInvestor({ tenorMin: 10, tenorMax: 20 });
    const m = scoreInvestor(issuer, inv, null);
    const tenor = m.criteria.find((c) => c.key === "tenor")!;
    // 8/10 = 0.8 >= 0.75 → 0.6 partial, matched true
    expect(tenor.score).toBeCloseTo(0.6, 6);
    expect(tenor.matched).toBe(true);
  });

  it("tenor further below tenorMin scores 0.3 (0.5 <= ratio < 0.75)", () => {
    const issuer = baseIssuer({ tenorYears: 6 });
    const inv = baseInvestor({ tenorMin: 10, tenorMax: 20 });
    const m = scoreInvestor(issuer, inv, null);
    const tenor = m.criteria.find((c) => c.key === "tenor")!;
    // 6/10 = 0.6, >= 0.5 → 0.3, matched false
    expect(tenor.score).toBeCloseTo(0.3, 6);
    expect(tenor.matched).toBe(false);
  });

  it("tenor far below tenorMin scores 0 (ratio < 0.5)", () => {
    const issuer = baseIssuer({ tenorYears: 4 });
    const inv = baseInvestor({ tenorMin: 10, tenorMax: 20 });
    const m = scoreInvestor(issuer, inv, null);
    const tenor = m.criteria.find((c) => c.key === "tenor")!;
    // 4/10 = 0.4 → 0
    expect(tenor.score).toBe(0);
    expect(tenor.matched).toBe(false);
  });

  it("tenor above tenorMax scores partial (ratio = tenorMax/tenor)", () => {
    const issuer = baseIssuer({ tenorYears: 12 });
    const inv = baseInvestor({ tenorMin: 2, tenorMax: 10 });
    const m = scoreInvestor(issuer, inv, null);
    const tenor = m.criteria.find((c) => c.key === "tenor")!;
    // 10/12 ≈ 0.833 >= 0.75 → 0.6
    expect(tenor.score).toBeCloseTo(0.6, 6);
    expect(tenor.matched).toBe(true);
  });

  it("sector same-family (infra.*) but not exact scores 0.5", () => {
    const issuer = baseIssuer({ sectorCode: "infra.power", sectorFamily: "infra" });
    const inv = baseInvestor({ mandateSectors: ["infra.roads"] });
    const m = scoreInvestor(issuer, inv, null);
    const sector = m.criteria.find((c) => c.key === "sector")!;
    expect(sector.score).toBeCloseTo(0.5, 6);
    expect(sector.matched).toBe(true);
  });

  it("empty mandate (open investor) scores full credit on sector", () => {
    const issuer = baseIssuer();
    const inv = baseInvestor({ mandateSectors: [] });
    const m = scoreInvestor(issuer, inv, null);
    const sector = m.criteria.find((c) => c.key === "sector")!;
    expect(sector.score).toBe(1);
    expect(sector.matched).toBe(true);
  });

  it("ticket: deal size within 1.5x typical ticket → full credit", () => {
    const issuer = baseIssuer({ targetSizeCrores: 150 });
    const inv = baseInvestor({ typicalTicketCrores: 100 });
    const m = scoreInvestor(issuer, inv, null);
    const ticket = m.criteria.find((c) => c.key === "ticket")!;
    expect(ticket.score).toBe(1);
  });

  it("ticket: deal size within 3x → 0.6 (syndicatable)", () => {
    const issuer = baseIssuer({ targetSizeCrores: 250 });
    const inv = baseInvestor({ typicalTicketCrores: 100 });
    const m = scoreInvestor(issuer, inv, null);
    const ticket = m.criteria.find((c) => c.key === "ticket")!;
    expect(ticket.score).toBeCloseTo(0.6, 6);
    expect(ticket.matched).toBe(true);
  });

  it("ticket: deal size within 6x → 0.3 (not matched)", () => {
    const issuer = baseIssuer({ targetSizeCrores: 500 });
    const inv = baseInvestor({ typicalTicketCrores: 100 });
    const m = scoreInvestor(issuer, inv, null);
    const ticket = m.criteria.find((c) => c.key === "ticket")!;
    expect(ticket.score).toBeCloseTo(0.3, 6);
    expect(ticket.matched).toBe(false);
  });

  it("ticket: deal far beyond 6x → 0", () => {
    const issuer = baseIssuer({ targetSizeCrores: 1000 });
    const inv = baseInvestor({ typicalTicketCrores: 100 });
    const m = scoreInvestor(issuer, inv, null);
    const ticket = m.criteria.find((c) => c.key === "ticket")!;
    expect(ticket.score).toBe(0);
  });

  it("ticket: tiny deal vs big-ticket account → capped at 0.5 (mild misfit)", () => {
    // size < ticket * 0.1 → cap at 0.5
    const issuer = baseIssuer({ targetSizeCrores: 5 });
    const inv = baseInvestor({ typicalTicketCrores: 100 });
    const m = scoreInvestor(issuer, inv, null);
    const ticket = m.criteria.find((c) => c.key === "ticket")!;
    // 5 <= 100*1.5 → score 1, but 5 < 100*0.1=10 → cap at 0.5
    expect(ticket.score).toBeCloseTo(0.5, 6);
  });
});

describe("scoreInvestor - unrated / missing issuer inputs", () => {
  it("unrated issuer → rating criterion scores 0 (no rating band to match)", () => {
    const issuer = baseIssuer({ ratingRank: null, ratingValue: null, ratingBand: null });
    const inv = baseInvestor();
    const m = scoreInvestor(issuer, inv, null);
    const rating = m.criteria.find((c) => c.key === "rating")!;
    expect(rating.matched).toBe(false);
    expect(rating.score).toBe(0);
    expect(rating.issuerValue).toBe("Unrated");
  });

  it("issuer with no tenor → tenor criterion scores 0", () => {
    const issuer = baseIssuer({ tenorYears: null });
    const inv = baseInvestor();
    const m = scoreInvestor(issuer, inv, null);
    const tenor = m.criteria.find((c) => c.key === "tenor")!;
    expect(tenor.score).toBe(0);
    expect(tenor.matched).toBe(false);
  });

  it("issuer with no target size → ticket criterion scores 0", () => {
    const issuer = baseIssuer({ targetSizeCrores: null });
    const inv = baseInvestor();
    const m = scoreInvestor(issuer, inv, null);
    const ticket = m.criteria.find((c) => c.key === "ticket")!;
    expect(ticket.score).toBe(0);
  });

  it("issuer sector unclassified but investor has a mandate → sector scores 0", () => {
    const issuer = baseIssuer({ sectorCode: null, sectorLabel: null, sectorFamily: null });
    const inv = baseInvestor({ mandateSectors: ["infra.roads"] });
    const m = scoreInvestor(issuer, inv, null);
    const sector = m.criteria.find((c) => c.key === "sector")!;
    expect(sector.score).toBe(0);
    expect(sector.matched).toBe(false);
  });
});

describe("scoreInvestor - score is always bounded in [0, 100]", () => {
  it("perfect fit clamps to 100 (not above)", () => {
    const m = scoreInvestor(baseIssuer(), baseInvestor(), warmIntro());
    expect(m.score).toBeLessThanOrEqual(100);
    expect(m.score).toBeGreaterThanOrEqual(0);
  });

  it("all-fail clamps to 0 (not below)", () => {
    const m = scoreInvestor(
      baseIssuer({ ratingRank: 12, sectorCode: "infra.roads", sectorFamily: "infra" }),
      baseInvestor({
        minRatingRank: 1,
        tenorMin: 10,
        tenorMax: 20,
        mandateSectors: ["energy.power"],
        typicalTicketCrores: 10,
        dematReady: false,
        kycCurrent: false,
        hasRelationship: false,
        interactionCount: 0,
      }),
      null,
    );
    expect(m.score).toBeGreaterThanOrEqual(0);
    expect(m.score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// rankInvestors - ordering + tie-breaks.
// ---------------------------------------------------------------------------

describe("rankInvestors - sort by score desc", () => {
  it("ranks a higher-scored investor above a lower-scored one", () => {
    const issuer = baseIssuer();
    const high = baseInvestor({ partyId: "hi" }); // 100
    const low = baseInvestor({
      partyId: "lo",
      dematReady: false, // -10 → 90
    });
    const ranked = rankInvestors(issuer, [low, high], new Map());
    expect(ranked[0].investor.partyId).toBe("hi");
    expect(ranked[1].investor.partyId).toBe("lo");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});

describe("rankInvestors - tie-break on matchCount (same score)", () => {
  it("with equal scores, more matched criteria ranks higher", () => {
    const issuer = baseIssuer();
    // Both score 100 (all scored criteria pass), but A has a relationship
    // (matchCount 7) and B does not (matchCount 6).
    const withRel = baseInvestor({ partyId: "with-rel", hasRelationship: true, interactionCount: 3 });
    const noRel = baseInvestor({ partyId: "no-rel", hasRelationship: false, interactionCount: 0 });
    const warm = new Map<string, WarmIntroPath | null>([
      ["with-rel", warmIntro({ strength: "warm" })],
      ["no-rel", null],
    ]);
    const ranked = rankInvestors(issuer, [noRel, withRel], warm);
    expect(ranked[0].score).toBe(ranked[1].score); // both 100
    expect(ranked[0].matchCount).toBeGreaterThan(ranked[1].matchCount);
    expect(ranked[0].investor.partyId).toBe("with-rel");
  });
});

describe("rankInvestors - tie-break on warm-intro strength (same score + matchCount)", () => {
  it("a strong warm intro outranks a warm one when score & matchCount tie", () => {
    const issuer = baseIssuer();
    const a = baseInvestor({ partyId: "strong-intro" });
    const b = baseInvestor({ partyId: "warm-intro" });
    const warm = new Map<string, WarmIntroPath | null>([
      ["strong-intro", warmIntro({ strength: "strong" })],
      ["warm-intro", warmIntro({ strength: "warm" })],
    ]);
    const ranked = rankInvestors(issuer, [b, a], warm);
    expect(ranked[0].score).toBe(ranked[1].score);
    expect(ranked[0].matchCount).toBe(ranked[1].matchCount);
    expect(ranked[0].investor.partyId).toBe("strong-intro");
    expect(ranked[1].investor.partyId).toBe("warm-intro");
  });

  it("warm intro outranks cold; cold outranks none", () => {
    const issuer = baseIssuer();
    const noneInv = baseInvestor({ partyId: "none" });
    const coldInv = baseInvestor({ partyId: "cold" });
    const warmInv = baseInvestor({ partyId: "warm" });
    const warm = new Map<string, WarmIntroPath | null>([
      ["none", null],
      ["cold", warmIntro({ strength: "cold" })],
      ["warm", warmIntro({ strength: "warm" })],
    ]);
    const ranked = rankInvestors(issuer, [noneInv, coldInv, warmInv], warm);
    expect(ranked.map((m) => m.investor.partyId)).toEqual(["warm", "cold", "none"]);
  });
});

// ---------------------------------------------------------------------------
// Warm-intro strength classification.
// ---------------------------------------------------------------------------

describe("classifyWarmIntro - strength from count + recency", () => {
  it("zero interactions → none", () => {
    expect(classifyWarmIntro({ interactionCount: 0, lastTouchAt: new Date() })).toBe("none");
  });

  it(">=3 interactions within 60 days → strong", () => {
    const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10d
    expect(classifyWarmIntro({ interactionCount: 5, lastTouchAt: recent })).toBe("strong");
  });

  it("exactly 3 interactions within 60 days → strong (boundary)", () => {
    const recent = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60d
    expect(classifyWarmIntro({ interactionCount: 3, lastTouchAt: recent })).toBe("strong");
  });

  it("2 interactions within 60 days → warm (count < 3, recent)", () => {
    const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(classifyWarmIntro({ interactionCount: 2, lastTouchAt: recent })).toBe("warm");
  });

  it("interactions 60–180 days ago → warm", () => {
    const mid = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(); // 100d
    expect(classifyWarmIntro({ interactionCount: 5, lastTouchAt: mid })).toBe("warm");
  });

  it("interactions > 180 days ago → cold", () => {
    const old = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(); // 1y
    expect(classifyWarmIntro({ interactionCount: 5, lastTouchAt: old })).toBe("cold");
  });

  it("interactions but no lastTouchAt → cold", () => {
    expect(classifyWarmIntro({ interactionCount: 5, lastTouchAt: null })).toBe("cold");
  });

  it("invalid lastTouchAt string → cold", () => {
    expect(classifyWarmIntro({ interactionCount: 5, lastTouchAt: "not-a-date" })).toBe("cold");
  });
});

// ---------------------------------------------------------------------------
// Kind inference + kind-derived defaults.
// ---------------------------------------------------------------------------

describe("inferInvestorKind - name + nature heuristic", () => {
  const cases: { name: string; nature: string; expected: InvestorKind }[] = [
    { name: "HDFC Bank 123 Pvt Ltd", nature: "organization", expected: "Bank" },
    { name: "LIC Insurance Corp", nature: "organization", expected: "Insurer" },
    { name: "ICICI Mutual Fund", nature: "organization", expected: "Mutual Fund" },
    { name: "EPFO Pension Fund", nature: "organization", expected: "Pension Fund" },
    { name: "Vedanta AIF 045 Ltd", nature: "organization", expected: "AIF" },
    { name: "Smith Family Office", nature: "organization", expected: "Family Office" },
    { name: "Bajaj NBFC Ltd", nature: "organization", expected: "NBFC" },
    { name: "John Doe", nature: "natural_person", expected: "HNI" },
    { name: "Generic Corp Ltd", nature: "organization", expected: "Unknown" },
  ];
  for (const c of cases) {
    it(`${c.name} → ${c.expected}`, () => {
      expect(inferInvestorKind({ legalName: c.name, displayName: null, partyNature: c.nature })).toBe(
        c.expected,
      );
    });
  }

  it("natural_person always maps to HNI regardless of name", () => {
    expect(
      inferInvestorKind({ legalName: "Bank-like Name", displayName: null, partyNature: "natural_person" }),
    ).toBe("HNI");
  });

  it("displayName is searched alongside legalName", () => {
    expect(
      inferInvestorKind({
        legalName: "Generic Holdco",
        displayName: "AIF Vehicle",
        partyNature: "organization",
      }),
    ).toBe("AIF");
  });
});

describe("defaultMinRatingRank - kind-derived rating floor", () => {
  it("banks/insurers/pension funds are conservative (low rank = strong floor)", () => {
    expect(defaultMinRatingRank("Bank")).toBe(4); // AA−
    expect(defaultMinRatingRank("Insurer")).toBe(3); // AA
    expect(defaultMinRatingRank("Pension Fund")).toBe(4); // AA−
  });

  it("AIFs / HNIs / family offices reach into sub-IG (higher rank = weaker floor)", () => {
    expect(defaultMinRatingRank("AIF")).toBe(10); // BBB−
    expect(defaultMinRatingRank("HNI")).toBe(10); // BBB−
    expect(defaultMinRatingRank("Family Office")).toBe(9); // BBB
  });

  it("Unknown falls back to the generalist default (BBB, rank 9)", () => {
    expect(defaultMinRatingRank("Unknown")).toBe(9);
  });
});

describe("defaultTenorRange - kind-derived tenor band", () => {
  it("banks hold medium-long; insurers & pension funds hold the longest paper", () => {
    expect(defaultTenorRange("Bank")).toEqual([3, 10]);
    expect(defaultTenorRange("Insurer")).toEqual([7, 20]);
    expect(defaultTenorRange("Pension Fund")).toEqual([10, 30]);
  });

  it("corporates hold the shortest paper (treasury)", () => {
    expect(defaultTenorRange("Corporate")).toEqual([1, 3]);
  });

  it("every kind returns a valid [min, max] with min <= max", () => {
    const kinds: InvestorKind[] = [
      "Bank",
      "Insurer",
      "Mutual Fund",
      "Pension Fund",
      "AIF",
      "Family Office",
      "HNI",
      "NBFC",
      "Corporate",
      "Unknown",
    ];
    for (const k of kinds) {
      const [lo, hi] = defaultTenorRange(k);
      expect(lo).toBeGreaterThan(0);
      expect(hi).toBeGreaterThanOrEqual(lo);
    }
  });
});

// ---------------------------------------------------------------------------
// Score banding + filters.
// ---------------------------------------------------------------------------

describe("bandForScore - qualitative band", () => {
  it("maps 0–100 scores to the four bands at the spec thresholds", () => {
    expect(bandForScore(100)).toBe("excellent");
    expect(bandForScore(85)).toBe("excellent");
    expect(bandForScore(84)).toBe("strong");
    expect(bandForScore(65)).toBe("strong");
    expect(bandForScore(64)).toBe("viable");
    expect(bandForScore(40)).toBe("viable");
    expect(bandForScore(39)).toBe("weak");
    expect(bandForScore(0)).toBe("weak");
  });

  it("every band has a human label", () => {
    for (const label of Object.values(SCORE_BAND_LABEL)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe("MATCH_FILTERS - workspace refinement predicates", () => {
  const goodMatch = scoreInvestor(baseIssuer(), baseInvestor(), warmIntro());
  const noDemat = scoreInvestor(
    baseIssuer(),
    baseInvestor({ dematReady: false, kycCurrent: false, hasRelationship: false, interactionCount: 0 }),
    null,
  );

  it("demat filter passes only demat-ready investors", () => {
    expect(MATCH_FILTERS.demat.test(goodMatch)).toBe(true);
    expect(MATCH_FILTERS.demat.test(noDemat)).toBe(false);
  });

  it("kyc filter passes only KYC-current investors", () => {
    expect(MATCH_FILTERS.kyc.test(goodMatch)).toBe(true);
    expect(MATCH_FILTERS.kyc.test(noDemat)).toBe(false);
  });

  it("relationship filter passes only investors with prior interactions", () => {
    expect(MATCH_FILTERS.relationship.test(goodMatch)).toBe(true);
    expect(MATCH_FILTERS.relationship.test(noDemat)).toBe(false);
  });

  it("warm filter passes only matches with a non-none warm intro", () => {
    expect(MATCH_FILTERS.warm.test(goodMatch)).toBe(true);
    expect(MATCH_FILTERS.warm.test(noDemat)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Misc constant sanity.
// ---------------------------------------------------------------------------

describe("DEFAULT_TICKET_CRORES", () => {
  it("is a positive number (₹ Cr fallback for history-less investors)", () => {
    expect(DEFAULT_TICKET_CRORES).toBeGreaterThan(0);
    expect(Number.isFinite(DEFAULT_TICKET_CRORES)).toBe(true);
  });
});
