// Investor Matching Engine - the USP of the Binary Capital CRM.
//
// Given an issuer (a party with type=issuer + their latest external_rating +
// sector + a deal carrying tenor + target_size), score every investor
// (party with type=investor) against seven criteria and rank them. This is the
// feature that makes the CRM worth building custom vs buying Salesforce: it
// turns the firm's 150+ institutional-investor network + 10k+ relationship
// graph into a ranked, actionable placement shortlist for any bond mandate.
//
// BUSINESS LOGIC (Indian bond house - scrape/BUSINESS_CONTEXT.md §3):
//   1. rating band   - investor's minimum acceptable rating vs the issuer's
//                      rating. An AAA-only insurer won't buy a BB issuer.
//   2. tenor         - investor's preferred tenor range vs the bond's tenor.
//   3. sector        - investor's sector mandates/prohibitions vs issuer sector.
//   4. ticket size   - investor's typical ticket vs the deal's target size.
//   5. demat-ready   - investor holds an active NSDL/CDSL demat account
//                      (required for Indian bond settlement - brochure §7).
//   6. KYC-current   - investor's KYC is approved and not expired (PMLA).
//   7. relationship  - the firm has a prior interaction with this investor.
//                      This is the warm-intro path, not a scored criterion.
//
// Match score = weighted sum of the six scored criteria (0–100):
//   rating 25% · tenor 20% · sector 20% · ticket 15% · demat 10% · KYC 10%.
// Partial credit is awarded on tenor / sector / ticket (preferences, not hard
// gates); rating / demat / KYC are binary gates. The seventh criterion
// (relationship) is rendered as a match/no-match indicator and gates the warm
// intro path, but does not feed the base weighted score - a cold investor can
// still score 100 on fit; the warm intro tells you who to call.
//
// This module is PURE - no DB access, no React. It takes already-loaded
// IssuerProfile / InvestorProfile shapes (built by queries.ts from the live
// schema) and returns serializable CriterionResult[] + score. Safe to unit-test
// in isolation and to run on the server.

import type { Band } from "@/features/credit/scorecard";
// Import the pure band helpers from the DB-free module so this engine can be
// imported by client components (matching-workspace.tsx) without pulling
// `postgres` / Node `tls` into the client bundle. ratingMap.ts re-exports the
// same helpers but transitively imports `@/db`.
import { rankToBand, bandToAgencySymbol, type RatingAgency } from "@/features/credit/ratingBands";

// ---------------------------------------------------------------------------
// Criteria + weights
// ---------------------------------------------------------------------------

export type CriterionKey =
  | "rating"
  | "tenor"
  | "sector"
  | "ticket"
  | "demat"
  | "kyc"
  | "relationship";

/** The seven criteria, in display order. */
export const CRITERIA_ORDER: CriterionKey[] = [
  "rating",
  "tenor",
  "sector",
  "ticket",
  "demat",
  "kyc",
  "relationship",
];

/** Human label + short tag for each criterion (used by the UI indicators). */
export const CRITERION_LABEL: Record<CriterionKey, string> = {
  rating: "Rating band",
  tenor: "Tenor fit",
  sector: "Sector mandate",
  ticket: "Ticket size",
  demat: "Demat ready",
  kyc: "KYC current",
  relationship: "Warm intro",
};

export const CRITERION_TAG: Record<CriterionKey, string> = {
  rating: "Rating",
  tenor: "Tenor",
  sector: "Sector",
  ticket: "Ticket",
  demat: "Demat",
  kyc: "KYC",
  relationship: "Intro",
};

/**
 * Weights for the six SCORED criteria (sum = 1.0). `relationship` carries a
 * 0 weight - it is shown as an indicator + gates the warm intro path, but a
 * cold-but-perfect-fit investor can still score 100. This matches the spec
 * exactly: "Weight: rating 25%, tenor 20%, sector 20%, ticket 15%, demat 10%,
 * KYC 10%" - six weights summing to 100%.
 */
export const SCORE_WEIGHTS: Record<CriterionKey, number> = {
  rating: 0.25,
  tenor: 0.2,
  sector: 0.2,
  ticket: 0.15,
  demat: 0.1,
  kyc: 0.1,
  relationship: 0,
};

/** The investor "kinds" the seed models - used to derive a rating floor when an
 *  investor has no deal history yet (a real coverage desk knows each account's
 *  risk appetite by type). Inferred from the party name heuristically; the
 *  behavior-derived floor always wins when history exists. */
export type InvestorKind =
  | "Bank"
  | "Insurer"
  | "Mutual Fund"
  | "Pension Fund"
  | "AIF"
  | "Family Office"
  | "HNI"
  | "NBFC"
  | "Corporate"
  | "Unknown";

/** Kind-derived minimum acceptable rating (cross-agency rank, 1=AAA … 10=BBB−).
 *  Conservative institutional accounts (banks / insurers / pension funds) sit
 *  at the top of the stack; AIFs / family offices / HNIs reach into sub-IG for
 *  yield. Defaults reflect typical Indian fixed-income mandates. */
const KIND_MIN_RATING_RANK: Record<InvestorKind, number> = {
  Bank: 4, // AA− floor - banks hold mostly AAA/AA paper
  Insurer: 3, // AA floor - IRDAI mandates heavily IG
  "Mutual Fund": 7, // A− floor - debt funds hold a mix, some reach to BBB
  "Pension Fund": 4, // AA− floor - EPFO/NPS conservative
  AIF: 10, // BBB− floor - credit funds chase yield into sub-IG
  "Family Office": 9, // BBB floor - opportunistic, some HY allocation
  HNI: 10, // BBB− floor - yield-seeking, BYDy appetite
  NBFC: 7, // A− floor - lend against, hold mixed paper
  Corporate: 7, // A− floor - treasury short-term
  Unknown: 9, // BBB floor - generalist default
};

/** A compact default tenor range (years) per kind, used only when an investor
 *  has no deal history. Banks/insurers hold longer paper; corporates shorter. */
const KIND_TENOR_RANGE: Record<InvestorKind, [number, number]> = {
  Bank: [3, 10],
  Insurer: [7, 20],
  "Mutual Fund": [2, 7],
  "Pension Fund": [10, 30],
  AIF: [2, 5],
  "Family Office": [3, 8],
  HNI: [2, 5],
  NBFC: [2, 7],
  Corporate: [1, 3],
  Unknown: [3, 7],
};

// ---------------------------------------------------------------------------
// Profiles - the serializable shapes queries.ts builds from the live schema
// ---------------------------------------------------------------------------

export interface IssuerProfile {
  partyId: string;
  legalName: string;
  displayName: string | null;
  /** Cross-agency ordinal (1=AAA … 10=BBB− for the seeded long-term scale). */
  ratingRank: number | null;
  ratingValue: string | null;
  ratingAgency: RatingAgency | null;
  ratingBand: Band | null;
  /** Dotted sector code, e.g. `infra.roads` (party.industrySegmentId → sectorCode). */
  sectorCode: string | null;
  sectorLabel: string | null;
  /** Top-level sector family (the part before the dot) - used for related-sector credit. */
  sectorFamily: string | null;
  /** From the issuer's primary deal. */
  tenorYears: number | null;
  targetSizeCrores: number | null;
  dealId: string | null;
  dealCode: string | null;
  dealName: string | null;
  dealType: string | null;
  dealStatus: string | null;
}

export interface InvestorProfile {
  partyId: string;
  legalName: string;
  displayName: string | null;
  partyNature: string;
  kind: InvestorKind;
  /** Minimum acceptable rating (floor) - the WORST rating this investor will
   *  buy. Derived from the worst-rated issuer in their deal history, falling
   *  back to the kind-based default. Cross-agency rank (1=AAA … 10=BBB−). */
  minRatingRank: number;
  minRatingValue: string;
  /** Preferred tenor range [min, max] in years, from deal history or kind default. */
  tenorMin: number;
  tenorMax: number;
  /** Sector codes the investor has bought before (their mandate). Empty = open
   *  mandate (no sector restriction). */
  mandateSectors: string[];
  /** Median commitment across the investor's deal_party rows, in ₹ Cr. */
  typicalTicketCrores: number;
  /** True when the investor has an active NSDL/CDSL demat account. */
  dematReady: boolean;
  /** True when the investor's latest KYC is approved and not expired. */
  kycCurrent: boolean;
  kycStatus: string | null;
  kycValidUntil: string | null;
  /** True when the firm has ≥1 interaction touching this investor. */
  hasRelationship: boolean;
  interactionCount: number;
  dealCount: number;
  /** Display hint - where the preferences were derived from. */
  preferenceSource: "history" | "kind" | "default";
}

export interface WarmIntroPath {
  bankerUserId: string;
  bankerName: string;
  bankerEmail: string;
  bankerDesk: string | null;
  interactionCount: number;
  lastTouchAt: string | null;
  lastChannel: string | null;
  lastSubject: string | null;
  /** Derived strength band - drives the UI tone + the "who to call" cue. */
  strength: WarmIntroStrength;
}

export type WarmIntroStrength = "strong" | "warm" | "cold" | "none";

export interface CriterionResult {
  key: CriterionKey;
  label: string;
  /** Binary pass/fail for the emerald-check / muted-x indicator. */
  matched: boolean;
  /** 0..1 partial credit feeding the weighted sum. */
  score: number;
  weight: number;
  /** Human-readable explanation, e.g. "Issuer AA+ ≥ floor AA−". */
  detail: string;
  /** The issuer's value for this criterion (display). */
  issuerValue: string;
  /** The investor's value / preference (display). */
  investorValue: string;
}

export interface InvestorMatch {
  investor: InvestorProfile;
  criteria: CriterionResult[];
  /** 0..100 weighted score across the six scored criteria. */
  score: number;
  /** How many of the seven criteria matched (indicator count). */
  matchCount: number;
  /** The warm-intro path (null only when the investor has no interactions). */
  warmIntro: WarmIntroPath | null;
}

// ---------------------------------------------------------------------------
// Kind inference - derive an investor's kind from its name/nature when the
// schema has no explicit column. The seed bakes the kind into the legal/display
// name (e.g. "Bharat Bank 123 Pvt Ltd", "Vedanta AIF 045 Ltd"); a real coverage
// desk would maintain this as a tagged field, but name-heuristic + behavior is a
// sound, honest derivation for the seeded data.
// ---------------------------------------------------------------------------

const KIND_PATTERNS: { kind: InvestorKind; pattern: RegExp }[] = [
  { kind: "Bank", pattern: /\bbank\b/i },
  { kind: "Insurer", pattern: /\binsur|insurance\b/i },
  { kind: "Mutual Fund", pattern: /\bmutual fund\b/i },
  { kind: "Pension Fund", pattern: /\bpension\b/i },
  { kind: "AIF", pattern: /\baif\b/i },
  { kind: "Family Office", pattern: /\bfamily office\b/i },
  { kind: "NBFC", pattern: /\bnbfc\b/i },
];

export function inferInvestorKind(input: {
  legalName: string;
  displayName: string | null;
  partyNature: string;
}): InvestorKind {
  // HNIs are natural persons (the seed models HNI investors as natural_person).
  if (input.partyNature === "natural_person") return "HNI";
  const haystack = `${input.legalName} ${input.displayName ?? ""}`;
  for (const { kind, pattern } of KIND_PATTERNS) {
    if (pattern.test(haystack)) return kind;
  }
  return "Unknown";
}

// ---------------------------------------------------------------------------
// Rating helpers - bridge ranks ↔ symbols ↔ bands for display
// ---------------------------------------------------------------------------

/** The canonical CRISIL symbol for a rank (display; the seeded ladder is CRISIL). */
export function rankToSymbol(rank: number): string {
  const band = rankToBand(rank);
  if (!band) return "NR";
  return bandToAgencySymbol(band, "CRISIL");
}

/** Display the investor's rating floor as a symbol. */
export function ratingFloorSymbol(rank: number): string {
  return rankToSymbol(rank);
}

// ---------------------------------------------------------------------------
// Scoring functions - one per criterion. Each returns { matched, score, detail,
// issuerValue, investorValue }. `score` is 0..1 partial credit.
// ---------------------------------------------------------------------------

function scoreRating(
  issuer: IssuerProfile,
  inv: InvestorProfile,
): Omit<CriterionResult, "key" | "label" | "weight"> {
  const issuerRank = issuer.ratingRank;
  const floor = inv.minRatingRank;
  const issuerSym = issuer.ratingValue ?? (issuerRank != null ? rankToSymbol(issuerRank) : "NR");
  const floorSym = ratingFloorSymbol(floor);
  if (issuerRank == null) {
    // Issuer is unrated - cannot place to rating-gated investors. Soft 0.
    return {
      matched: false,
      score: 0,
      detail: "Issuer unrated - no rating band to match",
      issuerValue: "Unrated",
      investorValue: `≥ ${floorSym}`,
    };
  }
  // ratingRank is an ordinal where LOWER = stronger (AAA=1). The investor's
  // floor is the WORST rank they'll accept, so a match = issuer rank <= floor.
  const matched = issuerRank <= floor;
  return {
    matched,
    score: matched ? 1 : 0, // hard gate - no partial credit on credit quality
    detail: matched
      ? `Issuer ${issuerSym} ≥ floor ${floorSym}`
      : `Issuer ${issuerSym} below floor ${floorSym}`,
    issuerValue: issuerSym,
    investorValue: `≥ ${floorSym}`,
  };
}

function scoreTenor(
  issuer: IssuerProfile,
  inv: InvestorProfile,
): Omit<CriterionResult, "key" | "label" | "weight"> {
  const tenor = issuer.tenorYears;
  const { tenorMin, tenorMax } = inv;
  const issuerVal = tenor != null ? `${tenor.toFixed(1)}y` : "-";
  const invVal = `${tenorMin.toFixed(0)}–${tenorMax.toFixed(0)}y`;
  if (tenor == null) {
    return {
      matched: false,
      score: 0,
      detail: "No tenor on the mandate",
      issuerValue: issuerVal,
      investorValue: invVal,
    };
  }
  // Inside the band = full credit. Just outside = partial (a coverage banker
  // can often stretch a mandate by a year or two); far outside = no fit.
  let score: number;
  let matched: boolean;
  if (tenor >= tenorMin && tenor <= tenorMax) {
    score = 1;
    matched = true;
  } else if (tenor < tenorMin) {
    const ratio = tenorMin > 0 ? tenor / tenorMin : 0;
    score = ratio >= 0.75 ? 0.6 : ratio >= 0.5 ? 0.3 : 0;
    matched = score >= 0.6;
  } else {
    // tenor > tenorMax
    const ratio = tenorMax > 0 ? tenorMax / tenor : 0;
    score = ratio >= 0.75 ? 0.6 : ratio >= 0.5 ? 0.3 : 0;
    matched = score >= 0.6;
  }
  return {
    matched,
    score,
    detail:
      score === 1
        ? `${tenor.toFixed(1)}y inside ${invVal}`
        : matched
          ? `${tenor.toFixed(1)}y near ${invVal}`
          : `${tenor.toFixed(1)}y outside ${invVal}`,
    issuerValue: issuerVal,
    investorValue: invVal,
  };
}

/** Extract the top-level sector family (before the dot) from a dotted code. */
function familyOf(code: string | null): string | null {
  if (!code) return null;
  const i = code.indexOf(".");
  return i > 0 ? code.slice(0, i) : code;
}

function scoreSector(
  issuer: IssuerProfile,
  inv: InvestorProfile,
): Omit<CriterionResult, "key" | "label" | "weight"> {
  const issuerSector = issuer.sectorCode;
  const issuerFamily = issuer.sectorFamily ?? familyOf(issuerSector);
  // An empty mandate = open mandate (the investor buys across sectors) → full.
  if (!inv.mandateSectors || inv.mandateSectors.length === 0) {
    return {
      matched: true,
      score: 1,
      detail: "Open mandate - no sector restriction",
      issuerValue: issuer.sectorLabel ?? issuerSector ?? "-",
      investorValue: "Open",
    };
  }
  if (!issuerSector) {
    return {
      matched: false,
      score: 0,
      detail: "Issuer sector not classified",
      issuerValue: "-",
      investorValue: inv.mandateSectors.length + " sectors",
    };
  }
  const exact = inv.mandateSectors.includes(issuerSector);
  if (exact) {
    return {
      matched: true,
      score: 1,
      detail: `${issuer.sectorLabel ?? issuerSector} in mandate`,
      issuerValue: issuer.sectorLabel ?? issuerSector,
      investorValue: inv.mandateSectors.length + " sectors",
    };
  }
  // Same family (e.g. both infra.*) = related, partial credit.
  const sameFamily = inv.mandateSectors.some((s) => familyOf(s) === issuerFamily);
  if (sameFamily) {
    return {
      matched: true,
      score: 0.5,
      detail: `Related to mandate (same ${issuerFamily} family)`,
      issuerValue: issuer.sectorLabel ?? issuerSector,
      investorValue: inv.mandateSectors.length + " sectors",
    };
  }
  return {
    matched: false,
    score: 0,
    detail: `${issuer.sectorLabel ?? issuerSector} outside mandate`,
    issuerValue: issuer.sectorLabel ?? issuerSector,
    investorValue: inv.mandateSectors.length + " sectors",
  };
}

function scoreTicket(
  issuer: IssuerProfile,
  inv: InvestorProfile,
): Omit<CriterionResult, "key" | "label" | "weight"> {
  const size = issuer.targetSizeCrores;
  const ticket = inv.typicalTicketCrores;
  const issuerVal = size != null ? `₹${size.toFixed(0)} Cr` : "-";
  const invVal = `~₹${ticket.toFixed(0)} Cr`;
  if (size == null) {
    return {
      matched: false,
      score: 0,
      detail: "No target size on the mandate",
      issuerValue: issuerVal,
      investorValue: invVal,
    };
  }
  // The investor's typical ticket is the amount they usually commit. A deal
  // size comfortably within their ticket = full fit; a deal much larger than
  // their ticket still works in syndication (partial); a deal far larger = the
  // account is too small for the mandate. A tiny deal vs a large-ticket
  // account is a mild misfit (not worth their time) - partial.
  let score: number;
  let matched: boolean;
  if (size <= ticket * 1.5) {
    score = 1;
    matched = true;
  } else if (size <= ticket * 3) {
    score = 0.6;
    matched = true;
  } else if (size <= ticket * 6) {
    score = 0.3;
    matched = false;
  } else {
    score = 0;
    matched = false;
  }
  // Tiny deal for a big-ticket account - mild misfit (not worth the desk time).
  if (size < ticket * 0.1 && ticket > 0) {
    score = Math.min(score, 0.5);
    matched = matched && score >= 0.6;
  }
  return {
    matched,
    score,
    detail:
      score === 1
        ? `${issuerVal} within ${invVal} capacity`
        : matched
          ? `${issuerVal} syndicatable vs ${invVal}`
          : `${issuerVal} too large vs ${invVal}`,
    issuerValue: issuerVal,
    investorValue: invVal,
  };
}

function scoreDemat(
  inv: InvestorProfile,
): Omit<CriterionResult, "key" | "label" | "weight"> {
  return {
    matched: inv.dematReady,
    score: inv.dematReady ? 1 : 0,
    detail: inv.dematReady
      ? "Active NSDL/CDSL demat account"
      : "No active demat - required for settlement",
    issuerValue: "Demat required",
    investorValue: inv.dematReady ? "Active" : "None",
  };
}

function scoreKyc(
  inv: InvestorProfile,
): Omit<CriterionResult, "key" | "label" | "weight"> {
  return {
    matched: inv.kycCurrent,
    score: inv.kycCurrent ? 1 : 0,
    detail: inv.kycCurrent
      ? `KYC ${inv.kycStatus ?? "approved"} · current`
      : `KYC ${inv.kycStatus ?? "pending"} · not current`,
    issuerValue: "KYC required",
    investorValue: inv.kycCurrent ? "Current" : (inv.kycStatus ?? "Pending"),
  };
}

function scoreRelationship(
  inv: InvestorProfile,
): Omit<CriterionResult, "key" | "label" | "weight"> {
  return {
    matched: inv.hasRelationship,
    score: inv.hasRelationship ? 1 : 0, // not weighted (weight 0) - indicator only
    detail: inv.hasRelationship
      ? `${inv.interactionCount} prior interaction${inv.interactionCount === 1 ? "" : "s"}`
      : "No prior interaction - cold intro",
    issuerValue: "Warm intro",
    investorValue: inv.hasRelationship ? `${inv.interactionCount} touches` : "Cold",
  };
}

// ---------------------------------------------------------------------------
// Core: score one investor against an issuer
// ---------------------------------------------------------------------------

/**
 * Score a single investor against an issuer. Returns the full CriterionResult
 * array (all seven), the 0–100 weighted score, the match count, and the warm
 * intro path (if any interactions exist for this investor).
 */
export function scoreInvestor(
  issuer: IssuerProfile,
  investor: InvestorProfile,
  warmIntro: WarmIntroPath | null,
): InvestorMatch {
  const rating = scoreRating(issuer, investor);
  const tenor = scoreTenor(issuer, investor);
  const sector = scoreSector(issuer, investor);
  const ticket = scoreTicket(issuer, investor);
  const demat = scoreDemat(investor);
  const kyc = scoreKyc(investor);
  const relationship = scoreRelationship(investor);

  const partials: Record<CriterionKey, Omit<CriterionResult, "key" | "label" | "weight">> = {
    rating,
    tenor,
    sector,
    ticket,
    demat,
    kyc,
    relationship,
  };

  const criteria: CriterionResult[] = CRITERIA_ORDER.map((key) => ({
    key,
    label: CRITERION_LABEL[key],
    weight: SCORE_WEIGHTS[key],
    ...partials[key],
  }));

  // Weighted sum across the six scored criteria (relationship weight = 0).
  const weightedSum = criteria.reduce(
    (acc, c) => acc + c.weight * c.score,
    0,
  );
  const score = Math.round(weightedSum * 100);
  const matchCount = criteria.filter((c) => c.matched).length;

  return {
    investor,
    criteria,
    score: Math.max(0, Math.min(100, score)),
    matchCount,
    warmIntro,
  };
}

/**
 * Rank all investors against an issuer - maps + sorts by score desc, with
 * tie-breaks on match count then warm-intro strength (a warm contact wins a
 * tie). Pure: takes the loaded profiles + a warm-intro resolver.
 */
export function rankInvestors(
  issuer: IssuerProfile,
  investors: InvestorProfile[],
  warmIntroByInvestor: Map<string, WarmIntroPath | null>,
): InvestorMatch[] {
  const matches = investors.map((inv) =>
    scoreInvestor(issuer, inv, warmIntroByInvestor.get(inv.partyId) ?? null),
  );
  const strengthRank: Record<WarmIntroStrength, number> = {
    strong: 3,
    warm: 2,
    cold: 1,
    none: 0,
  };
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    const sa = strengthRank[a.warmIntro?.strength ?? "none"];
    const sb = strengthRank[b.warmIntro?.strength ?? "none"];
    return sb - sa;
  });
  return matches;
}

// ---------------------------------------------------------------------------
// Warm-intro strength - derived from interaction count + recency
// ---------------------------------------------------------------------------

/** Classify a banker's relationship strength from their touch history. */
export function classifyWarmIntro(input: {
  interactionCount: number;
  lastTouchAt: Date | string | null;
}): WarmIntroStrength {
  if (input.interactionCount <= 0) return "none";
  const last = toDate(input.lastTouchAt);
  if (!last) return "cold";
  const daysSince = (Date.now() - last.getTime()) / DAY_MS;
  if (input.interactionCount >= 3 && daysSince <= 60) return "strong";
  if (daysSince <= 180) return "warm";
  return "cold";
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(d: Date | string | null | undefined): Date | null {
  if (d === null || d === undefined || d === "") return null;
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// ---------------------------------------------------------------------------
// Filters - the workspace's "only demat-ready / only KYC-current" refinements.
// Applied to the ranked list (client-side); pure predicates.
// ---------------------------------------------------------------------------

export type MatchFilterKey = "demat" | "kyc" | "relationship" | "warm";

/** A predicate over an InvestorMatch for each toggle filter. */
export const MATCH_FILTERS: Record<
  MatchFilterKey,
  { label: string; test: (m: InvestorMatch) => boolean }
> = {
  demat: { label: "Demat ready", test: (m) => m.investor.dematReady },
  kyc: { label: "KYC current", test: (m) => m.investor.kycCurrent },
  relationship: { label: "Existing relationship", test: (m) => m.investor.hasRelationship },
  warm: { label: "Warm intro available", test: (m) => (m.warmIntro?.strength ?? "none") !== "none" },
};

// ---------------------------------------------------------------------------
// Default preference derivation - used by queries.ts when an investor has no
// deal history. Exposed so the queries module stays thin.
// ---------------------------------------------------------------------------

export function defaultMinRatingRank(kind: InvestorKind): number {
  return KIND_MIN_RATING_RANK[kind] ?? KIND_MIN_RATING_RANK.Unknown;
}

export function defaultTenorRange(kind: InvestorKind): [number, number] {
  return KIND_TENOR_RANGE[kind] ?? KIND_TENOR_RANGE.Unknown;
}

/** Default typical ticket (₹ Cr) when an investor has no commitment history. */
export const DEFAULT_TICKET_CRORES = 25;

// ---------------------------------------------------------------------------
// Score banding - map a 0–100 score to a qualitative band for the UI ring tone.
// ---------------------------------------------------------------------------

export type ScoreBand = "excellent" | "strong" | "viable" | "weak";

export function bandForScore(score: number): ScoreBand {
  if (score >= 85) return "excellent";
  if (score >= 65) return "strong";
  if (score >= 40) return "viable";
  return "weak";
}

export const SCORE_BAND_LABEL: Record<ScoreBand, string> = {
  excellent: "Excellent fit",
  strong: "Strong fit",
  viable: "Viable fit",
  weak: "Weak fit",
};
