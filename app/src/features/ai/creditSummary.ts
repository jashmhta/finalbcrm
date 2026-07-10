// AI Features - Credit summary generator.
//
// Given a credit_analysis + the latest period's ratios + the scorecard
// (band / score / PD), generate a three-paragraph credit memo summary:
//   1. Issuer description       - who the obligor is, sector, listing, domicile.
//   2. Financial highlights     - leverage / coverage / liquidity / profitability
//                                 (or asset quality / capital for NBFCs & banks),
//                                 with a trend line when a prior period exists.
//   3. Credit assessment        - internal band, score, indicative 1-yr PD,
//                                 strengths, concerns, and a recommendation.
//
// This is a DETERMINISTIC templating engine - no external LLM. The thresholds
// and the recommendation logic encode the credit-committee posture of an
// Indian bond house / IB (Binary Capital + Binary Bonds): investment-grade
// obligors (BC-1..BC-3) clear, BC-4 is conditional, sub-IG (BC-5/BC-6) is
// declined, and a watchlist flag or negative rating action overrides to
// heightened monitoring.
//
// `generateCreditSummary` is PURE (no `@/db` in its runtime import graph) so it
// is safe to unit-test and safe to import from a client component's data path.
// `getCreditSummary` is the SERVER loader: it calls the credit feature's
// existing detail query + scorecard engine and maps the result into the pure
// generator's input.

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  creditAnalysis,
  creditAnalysisFsLink,
  exposure,
  financialStatement,
  party,
  sectorCode,
} from "@/db/schema";
import { getCreditAnalysisDetail } from "@/features/credit/queries";
import {
  computeScorecard,
  BAND_GRADE,
  BAND_PD_1Y,
  bandFromScore,
  type Band,
} from "@/features/credit/scorecard";
import { computeRatios, type RatioSet } from "@/features/credit/ratios";

import type { CreditSummary, AiPriority } from "./types";

type CreditAccessUser = Parameters<typeof getCreditAnalysisDetail>[1];

// ---------------------------------------------------------------------------
// Pure input shape - everything the generator needs, no DB types.
// ---------------------------------------------------------------------------

export interface CreditSummaryRatios {
  debtEbitda: number | null;
  netDebtEbitda: number | null;
  debtEquity: number | null;
  interestCoverage: number | null;
  dscr: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  ebitdaMargin: number | null; // fraction (0.22 = 22%)
  patMargin: number | null;
  roce: number | null;
  roe: number | null;
  // NBFC / bank asset-quality + capital
  gnpaPct: number | null; // fraction
  nnpaPct: number | null; // fraction
  crar: number | null; // fraction
  nim: number | null; // fraction
}

export interface CreditSummaryExternalRating {
  agency: string;
  ratingValue: string | null;
  scale: string;
  outlook: string | null;
}

export interface CreditSummaryInput {
  creditAnalysisId: string;
  issuerName: string;
  obligorType: string | null;
  sectorLabel: string | null;
  isListed: boolean | null;
  domicileState: string | null;
  analysisType: string | null;
  internalRatingShort: string | null;
  internalRatingAction: string | null;
  recommendation: string | null;
  watchlist: boolean;
  score: number | null;
  band: string | null;
  bandGrade: string | null;
  pd1yPct: number | null;
  ratios: CreditSummaryRatios;
  externalRatings: CreditSummaryExternalRating[];
  grossExposureInrCr: number | null;
  latestPeriodEnd: string | null;
  priorPeriodEnd: string | null;
  /** Optional prior-period ratios - when present, the financials paragraph
   *  gets a trend sentence (improved / weakened / stable) on key metrics. */
  priorRatios?: Partial<CreditSummaryRatios>;
}

// ---------------------------------------------------------------------------
// Display helpers - pure
// ---------------------------------------------------------------------------

const VALID_BANDS: ReadonlySet<Band> = new Set([
  "BC-1",
  "BC-2",
  "BC-3",
  "BC-4",
  "BC-5",
  "BC-6",
]);

/** Indicative 1-yr PD range per band (display only - mirrors ratingMap.ts). */
const BAND_PD_RANGE: Record<Band, string> = {
  "BC-1": "< 0.05%",
  "BC-2": "0.05% - 0.15%",
  "BC-3": "0.15% - 0.50%",
  "BC-4": "0.50% - 2.00%",
  "BC-5": "2.00% - 8.00%",
  "BC-6": "> 8.00%",
};

function pct(v: number | null, digits = 2): string | null {
  if (v === null || !Number.isFinite(v)) return null;
  return `${(v * 100).toFixed(digits)}%`;
}

function x(v: number | null, digits = 2): string | null {
  if (v === null || !Number.isFinite(v)) return null;
  return `${v.toFixed(digits)}x`;
}

/** Titleize a snake_case enum ("corporate" / "annual_surveillance" /
 *  "watch_negative") into "Corporate" / "Annual surveillance" /
 *  "Watch negative". */
function titleize(v: string | null): string | null {
  if (!v) return null;
  return v
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function obligorLabel(t: string | null): string {
  const map: Record<string, string> = {
    corporate: "a corporate obligor",
    spv: "a special-purpose vehicle (SPV)",
    project: "a project obligor",
    sovereign: "a sovereign obligor",
    state_psu: "a state PSU obligor",
    nbfc: "an NBFC obligor",
    bank: "a bank obligor",
  };
  return t ? (map[t] ?? titleize(t) ?? "an obligor") : "an obligor";
}

function analysisTypeLabel(t: string | null): string {
  const map: Record<string, string> = {
    origination: "an origination analysis",
    annual_surveillance: "an annual surveillance review",
    event_driven: "an event-driven review",
    watchlist_trigger: "a watchlist-triggered review",
    rating_presentation_support: "a rating-presentation support analysis",
  };
  return t ? (map[t] ?? titleize(t) ?? "a credit analysis") : "a credit analysis";
}

function isFinanicalInstitution(obligorType: string | null): boolean {
  return obligorType === "nbfc" || obligorType === "bank";
}

/** Format an external rating line, e.g. "CRISIL AA+ (long term, stable)". */
function fmtRating(r: CreditSummaryExternalRating): string {
  const parts: string[] = [r.agency];
  if (r.ratingValue) parts.push(r.ratingValue);
  const scale = titleize(r.scale);
  const outlook = titleize(r.outlook);
  const tail: string[] = [];
  if (scale) tail.push(scale);
  if (outlook) tail.push(outlook);
  if (tail.length) parts.push(`(${tail.join(", ")})`);
  return parts.join(" ");
}

/** Investment-grade external rating? A coarse proxy on the rating symbol -
 *  anything starting with A or AAA/AA/A (incl. +/-) is IG; BB/B/CCC/C/D are
 *  not. Used only to flavour the strengths line. */
function externalRatingIsIg(r: CreditSummaryExternalRating): boolean | null {
  if (!r.ratingValue) return null;
  const v = r.ratingValue.trim().toUpperCase();
  if (/^A/i.test(v)) return true;
  if (/^(BB|B|CCC|CC|C|D)/i.test(v)) return false;
  return null;
}

// ---------------------------------------------------------------------------
// Trend helper - direction of a metric between prior and latest.
// ---------------------------------------------------------------------------

type Direction = "up" | "down" | "flat";

function trend(latest: number | null, prior: number | null): Direction | null {
  if (latest === null || prior === null) return null;
  if (!Number.isFinite(latest) || !Number.isFinite(prior)) return null;
  if (Math.abs(latest - prior) < 1e-9) return "flat";
  return latest > prior ? "up" : "down";
}

/** Compose a trend phrase for a "higher is better" metric. */
function trendPhraseHigher(latest: number | null, prior: number | null): string | null {
  const d = trend(latest, prior);
  if (!d) return null;
  if (d === "flat") return "broadly stable";
  return d === "up" ? "improved" : "weakened";
}

/** Compose a trend phrase for a "lower is better" metric (leverage, NPA). */
function trendPhraseLower(latest: number | null, prior: number | null): string | null {
  const d = trend(latest, prior);
  if (!d) return null;
  if (d === "flat") return "broadly stable";
  // For a lower-is-better metric, an "up" direction = weakened, "down" = improved.
  return d === "up" ? "weakened" : "improved";
}

// ---------------------------------------------------------------------------
// Strengths / concerns extraction - threshold rules.
// ---------------------------------------------------------------------------

interface RuleCtx {
  r: CreditSummaryRatios;
  band: Band | null;
  watchlist: boolean;
  ratingAction: string | null;
  externalRatings: CreditSummaryExternalRating[];
}

function pushIf(list: string[], cond: boolean, text: string): void {
  if (cond) list.push(text);
}

function extractStrengths(ctx: RuleCtx): string[] {
  const { r, band, externalRatings } = ctx;
  const out: string[] = [];

  pushIf(out, r.interestCoverage !== null && r.interestCoverage >= 4,
    `Strong debt service coverage - interest coverage of ${x(r.interestCoverage)} comfortably above the 4x investment-grade threshold.`);
  pushIf(out, r.debtEbitda !== null && r.debtEbitda <= 3,
    `Conservative leverage - Debt/EBITDA of ${x(r.debtEbitda)} is within the 3x IG benchmark.`);
  pushIf(out, r.currentRatio !== null && r.currentRatio >= 1.3,
    `Healthy liquidity - current ratio of ${x(r.currentRatio)} indicates adequate working-capital headroom.`);
  pushIf(out, r.ebitdaMargin !== null && r.ebitdaMargin >= 0.15,
    `Resilient profitability - EBITDA margin of ${pct(r.ebitdaMargin)} reflects scale and pricing power.`);
  pushIf(out, r.roce !== null && r.roce >= 0.12,
    `Efficient capital deployment - ROCE of ${pct(r.roce)} exceeds the 12% cost-of-capital hurdle.`);
  pushIf(out, r.dscr !== null && r.dscr >= 1.3,
    `Robust project cash flow - DSCR of ${x(r.dscr)} provides a comfortable debt-service cushion.`);
  pushIf(out, r.crar !== null && r.crar >= 0.15,
    `Well-capitalised - CRAR of ${pct(r.crar)} is above the 15% comfort threshold.`);
  pushIf(out, r.gnpaPct !== null && r.gnpaPct <= 0.03,
    `Sound asset quality - gross NPA of ${pct(r.gnpaPct)} is within prudent limits.`);

  if (band && (band === "BC-1" || band === "BC-2" || band === "BC-3")) {
    out.push(`Internal scorecard places the obligor in band ${band} (${BAND_GRADE[band]}), within the firm's investment-grade acceptance.`);
  }
  const igRatings = externalRatings
    .map((er) => ({ er, ig: externalRatingIsIg(er) }))
    .filter((x) => x.ig === true);
  if (igRatings.length > 0) {
    out.push(`External rating support - ${fmtRating(igRatings[0].er)} is investment-grade.`);
  }

  return out;
}

function extractConcerns(ctx: RuleCtx): string[] {
  const { r, band, watchlist, ratingAction, externalRatings } = ctx;
  const out: string[] = [];

  pushIf(out, r.interestCoverage !== null && r.interestCoverage < 1.5,
    `Thin debt service coverage - interest coverage of ${x(r.interestCoverage)} is below the 1.5x stress threshold; earnings are vulnerable to rate or margin shocks.`);
  pushIf(out, r.debtEbitda !== null && r.debtEbitda > 5,
    `Elevated leverage - Debt/EBITDA of ${x(r.debtEbitda)} exceeds the 5x high-leverage benchmark; refinancing risk is material.`);
  pushIf(out, r.currentRatio !== null && r.currentRatio < 1,
    `Liquidity pressure - current ratio of ${x(r.currentRatio)} below 1x signals near-term working-capital strain.`);
  pushIf(out, r.ebitdaMargin !== null && r.ebitdaMargin < 0.08,
    `Sub-scale profitability - EBITDA margin of ${pct(r.ebitdaMargin)} leaves limited buffer against input-cost or rate volatility.`);
  pushIf(out, r.dscr !== null && r.dscr < 1.1,
    `Tight project cash flow - DSCR of ${x(r.dscr)} is close to the 1.0x debt-service cliff; cash flow is sensitive to ramp/operating slippage.`);
  pushIf(out, r.gnpaPct !== null && r.gnpaPct > 0.05,
    `Deteriorating asset quality - gross NPA of ${pct(r.gnpaPct)} is above the 5% concern threshold.`);
  pushIf(out, r.crar !== null && r.crar < 0.12,
    `Capital adequacy pressure - CRAR of ${pct(r.crar)} is close to the regulatory minimum; headroom for growth is limited.`);
  pushIf(out, band === "BC-5",
    `Sub-investment-grade scorecard band (BC-5) - speculative-grade credit with elevated default risk; require enhanced security / pricing cushion.`);
  pushIf(out, band === "BC-6",
    `Distressed scorecard band (BC-6) - near-default credit; exposure should be avoided or wound down.`);
  if (watchlist) {
    out.push("On the internal watchlist - heightened monitoring is in effect pending the next review.");
  }
  if (ratingAction === "downgrade" || ratingAction === "watch_negative") {
    out.push(`Negative internal rating action (${titleize(ratingAction)}) - momentum is adverse; reconfirm before extending exposure.`);
  }
  const subIgRatings = externalRatings
    .map((er) => ({ er, ig: externalRatingIsIg(er) }))
    .filter((x) => x.ig === false);
  if (subIgRatings.length > 0) {
    out.push(`External rating flag - ${fmtRating(subIgRatings[0].er)} is sub-investment-grade.`);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Recommendation derivation - the committee posture.
// ---------------------------------------------------------------------------

function deriveRecommendation(
  band: Band | null,
  watchlist: boolean,
  ratingAction: string | null,
  hasScore: boolean,
): { text: string; priority: AiPriority } {
  if (!hasScore || !band) {
    return {
      text: "Pending - run the scorecard to finalise the internal rating before committee.",
      priority: "info",
    };
  }
  // Negative momentum overrides the band-based posture to heightened monitoring.
  if (ratingAction === "downgrade" || ratingAction === "watch_negative" || watchlist) {
    return {
      text: "Watchlist - approve only with heightened monitoring, enhanced security, and a defined review trigger.",
      priority: "warning",
    };
  }
  switch (band) {
    case "BC-1":
    case "BC-2":
    case "BC-3":
      return {
        text: "Approve - investment-grade obligor; proceed with standard documentation and pricing.",
        priority: "positive",
      };
    case "BC-4":
      return {
        text: "Approve with conditions - adequate but marginal; require enhanced covenants, collateral, or a pricing premium.",
        priority: "info",
      };
    case "BC-5":
      return {
        text: "Decline for new exposure - sub-investment-grade; consider only with strong credit enhancement or a high-yield mandate.",
        priority: "warning",
      };
    case "BC-6":
      return {
        text: "Decline - distressed / near-default; no new exposure. Plan exit on existing exposure.",
        priority: "critical",
      };
    default:
      return {
        text: "Pending - run the scorecard to finalise the internal rating before committee.",
        priority: "info",
      };
  }
}

// ---------------------------------------------------------------------------
// Paragraph builders
// ---------------------------------------------------------------------------

function buildIssuerParagraph(input: CreditSummaryInput): string {
  const name = input.issuerName || "The obligor";
  const segments: string[] = [`${name} is ${obligorLabel(input.obligorType)}`];
  if (input.sectorLabel) {
    segments.push(`operating in the ${input.sectorLabel.toLowerCase()} sector`);
  }
  if (input.isListed) {
    segments.push("a listed entity");
  } else if (input.isListed === false) {
    segments.push("a privately held entity");
  }
  if (input.domicileState) {
    segments.push(`domiciled in ${input.domicileState}`);
  }
  let s = joinNatural(segments) + ".";
  if (input.analysisType) {
    s += ` This is ${analysisTypeLabel(input.analysisType)} prepared by the credit desk.`;
  }
  return s;
}

/** Join a list of phrases with commas + an "and" before the final item. */
function joinNatural(parts: string[]): string {
  const clean = parts.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function buildFinancialsParagraph(input: CreditSummaryInput): string {
  const r = input.ratios;
  const fi = isFinanicalInstitution(input.obligorType);

  if (fi) {
    // NBFC / bank framing - asset quality, capital, margins.
    const bits: string[] = [];
    if (r.gnpaPct !== null) bits.push(`gross NPA of ${pct(r.gnpaPct)}`);
    if (r.nnpaPct !== null) bits.push(`net NPA of ${pct(r.nnpaPct)}`);
    if (r.crar !== null) bits.push(`CRAR of ${pct(r.crar)}`);
    if (r.nim !== null) bits.push(`NIM of ${pct(r.nim)}`);
    if (bits.length === 0) {
      return noRatioSentence(input);
    }
    let s = `On the latest reported period${periodSuffix(input.latestPeriodEnd)}, ${input.issuerName || "the obligor"} carries ${joinNatural(bits)}.`;
    const trendBit = fiTrend(input);
    if (trendBit) s += ` ${trendBit}`;
    return s;
  }

  // Corporate / project framing.
  const bits: string[] = [];
  if (r.debtEbitda !== null) bits.push(`Debt/EBITDA of ${x(r.debtEbitda)}`);
  if (r.interestCoverage !== null) bits.push(`interest coverage of ${x(r.interestCoverage)}`);
  if (r.currentRatio !== null) bits.push(`a current ratio of ${x(r.currentRatio)}`);
  if (r.ebitdaMargin !== null) bits.push(`EBITDA margin of ${pct(r.ebitdaMargin)}`);
  if (r.roce !== null) bits.push(`ROCE of ${pct(r.roce)}`);
  if (r.dscr !== null) bits.push(`DSCR of ${x(r.dscr)}`);
  if (bits.length === 0) {
    return noRatioSentence(input);
  }
  let s = `On the latest period${periodSuffix(input.latestPeriodEnd)}, ${input.issuerName || "the obligor"} reports ${joinNatural(bits)}.`;
  const trendBit = corporateTrend(input);
  if (trendBit) s += ` ${trendBit}`;
  return s;
}

function periodSuffix(latestPeriodEnd: string | null): string {
  if (!latestPeriodEnd) return "";
  try {
    const d = new Date(latestPeriodEnd);
    if (Number.isNaN(d.getTime())) return "";
    const lbl = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short", year: "numeric" });
    return ` (ended ${lbl})`;
  } catch {
    return "";
  }
}

function noRatioSentence(input: CreditSummaryInput): string {
  return `No financial statements are linked to this analysis yet - link an audited or limited-review statement to spread the ratios and complete the financial-highlight review.`;
}

/** Corporate trend sentence - leverage + coverage + margin direction. */
function corporateTrend(input: CreditSummaryInput): string | null {
  const r = input.ratios;
  const p = input.priorRatios ?? {};
  const phrases: string[] = [];

  const lev = trendPhraseLower(r.debtEbitda ?? null, p.debtEbitda ?? null);
  if (lev) phrases.push(`leverage has ${lev}`);
  const cov = trendPhraseHigher(r.interestCoverage ?? null, p.interestCoverage ?? null);
  if (cov) phrases.push(`interest coverage has ${cov}`);
  const liq = trendPhraseHigher(r.currentRatio ?? null, p.currentRatio ?? null);
  if (liq) phrases.push(`liquidity has ${liq}`);
  const mar = trendPhraseHigher(r.ebitdaMargin ?? null, p.ebitdaMargin ?? null);
  if (mar) phrases.push(`EBITDA margin has ${mar}`);

  if (phrases.length === 0) return null;
  return `Versus the prior period, ${joinNatural(phrases)}.`;
}

/** NBFC / bank trend sentence - NPA + CRAR direction. */
function fiTrend(input: CreditSummaryInput): string | null {
  const r = input.ratios;
  const p = input.priorRatios ?? {};
  const phrases: string[] = [];

  const npa = trendPhraseLower(r.gnpaPct ?? null, p.gnpaPct ?? null);
  if (npa) phrases.push(`gross NPA has ${npa}`);
  const cap = trendPhraseHigher(r.crar ?? null, p.crar ?? null);
  if (cap) phrases.push(`capital adequacy has ${cap}`);

  if (phrases.length === 0) return null;
  return `Versus the prior period, ${joinNatural(phrases)}.`;
}

function buildAssessmentParagraph(input: CreditSummaryInput, recText: string): string {
  const name = input.issuerName || "The obligor";
  const bits: string[] = [];

  if (input.band && VALID_BANDS.has(input.band as Band)) {
    const b = input.band as Band;
    bits.push(
      `the internal scorecard places ${name} in band ${b} (${BAND_GRADE[b]})`,
    );
  } else if (input.score !== null) {
    bits.push(`the internal scorecard scores ${name} at ${input.score.toFixed(1)} / 100`);
  } else {
    bits.push(`the internal scorecard has not yet been run for ${name}`);
  }
  if (input.score !== null && input.band && VALID_BANDS.has(input.band as Band)) {
    bits.push(`a weighted score of ${input.score.toFixed(1)} / 100`);
  }
  if (input.pd1yPct !== null) {
    bits.push(`an indicative 1-year probability of default of ${input.pd1yPct.toFixed(3)}%`);
  }
  let s = bits.length ? `On the internal assessment, ${joinNatural(bits)}.` : "";
  if (input.externalRatings.length > 0) {
    const top = input.externalRatings.slice(0, 2).map(fmtRating).join("; ");
    s += ` External ratings: ${top}.`;
  }
  if (input.grossExposureInrCr !== null && input.grossExposureInrCr > 0) {
    s += ` Firm gross exposure stands at ₹${input.grossExposureInrCr.toFixed(2)} Cr.`;
  }
  s += ` ${recText}`;
  return s.trim();
}

function buildRatingLine(input: CreditSummaryInput): string {
  const parts: string[] = [];
  if (input.band && VALID_BANDS.has(input.band as Band)) {
    const b = input.band as Band;
    parts.push(b);
    parts.push(BAND_GRADE[b]);
  }
  if (input.score !== null) {
    parts.push(`${input.score.toFixed(1)}/100`);
  }
  if (input.pd1yPct !== null) {
    parts.push(`${input.pd1yPct.toFixed(3)}% 1-yr PD`);
  }
  return parts.length ? parts.join(" · ") : "Awaiting scorecard";
}

// ---------------------------------------------------------------------------
// generateCreditSummary - the pure entry point.
// ---------------------------------------------------------------------------

export function generateCreditSummary(input: CreditSummaryInput): CreditSummary {
  const band: Band | null =
    input.band && VALID_BANDS.has(input.band as Band) ? (input.band as Band) : null;
  const hasScore = input.score !== null || band !== null;

  const ctx: RuleCtx = {
    r: input.ratios,
    band,
    watchlist: input.watchlist,
    ratingAction: input.internalRatingAction,
    externalRatings: input.externalRatings,
  };
  const strengths = extractStrengths(ctx);
  const concerns = extractConcerns(ctx);
  const rec = deriveRecommendation(
    band,
    input.watchlist,
    input.internalRatingAction,
    hasScore,
  );

  const issuer = buildIssuerParagraph(input);
  const financials = buildFinancialsParagraph(input);
  const assessment = buildAssessmentParagraph(input, rec.text);

  return {
    creditAnalysisId: input.creditAnalysisId,
    issuer,
    financials,
    assessment,
    strengths: strengths.length ? strengths : ["No dominant strengths flagged by the threshold rules - review qualitatively."],
    concerns: concerns.length ? concerns : ["No threshold concerns flagged - the obligor screens within prudent limits."],
    recommendation: rec.text,
    recommendationPriority: rec.priority,
    ratingLine: buildRatingLine(input),
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// getCreditSummary - the SERVER loader. Maps the credit feature's detail
// query + scorecard engine output into the pure generator's input.
// ---------------------------------------------------------------------------

/** Map a RatioSet (the engine's computed ratio set for one period) into the
 *  generator's ratio shape. Pure. */
function ratioSetToSummaryRatios(rs: RatioSet): CreditSummaryRatios {
  return {
    debtEbitda: rs.debt_ebitda,
    netDebtEbitda: rs.net_debt_ebitda,
    debtEquity: rs.debt_equity,
    interestCoverage: rs.interest_coverage,
    dscr: rs.dscr,
    currentRatio: rs.current_ratio,
    quickRatio: rs.quick_ratio,
    ebitdaMargin: rs.ebitda_margin,
    patMargin: rs.pat_margin,
    roce: rs.roce,
    roe: rs.roe,
    gnpaPct: rs.gnpa_pct,
    nnpaPct: rs.nnpa_pct,
    crar: rs.crar,
    nim: rs.nim,
  };
}

/** Resolve the authoritative band - mirrors the credit detail page's logic:
 *  prefer the live engine-computed band, then a persisted/rating value ONLY if
 *  it is actually a valid BC band. */
function resolveBand(
  liveBand: Band | null,
  persistedBand: string | null,
  ratingShort: string | null,
): Band | null {
  if (liveBand) return liveBand;
  if (persistedBand && VALID_BANDS.has(persistedBand as Band)) return persistedBand as Band;
  if (ratingShort && VALID_BANDS.has(ratingShort as Band)) return ratingShort as Band;
  return null;
}

/** Compute gross exposure in ₹ Cr for a party (sum of active exposure rows). */
async function sumGrossExposureCr(partyId: string): Promise<number | null> {
  const rows = await db
    .select({ gross: exposure.grossExposure })
    .from(exposure)
    .where(and(eq(exposure.partyId, partyId), isNull(exposure.deletedAt)));
  const total = rows.reduce((acc, r) => acc + Number(r.gross ?? 0), 0);
  return rows.length ? total / 1e7 : null; // 1 Cr = 1e7 INR
}

/** Resolve the issuer's sector label via party.industrySegmentId. */
async function resolveSectorLabel(p: typeof party.$inferSelect | null): Promise<string | null> {
  if (!p?.industrySegmentId) return null;
  const [s] = await db
    .select({ label: sectorCode.label })
    .from(sectorCode)
    .where(eq(sectorCode.sectorCodeId, p.industrySegmentId));
  return s?.label ?? null;
}

export async function getCreditSummary(
  creditAnalysisId: string,
  user?: CreditAccessUser,
): Promise<CreditSummary | null> {
  const detail = await getCreditAnalysisDetail(creditAnalysisId, user);
  if (!detail) return null;

  const { analysis: a, party: p, financialStatements, latestRatioSet, scorecard: sc, externalRatingsEnriched } = detail;

  // Live scorecard (engine-recomputed for the latest period).
  const liveScorecard =
    latestRatioSet !== null
      ? computeScorecard({ ratios: latestRatioSet as RatioSet, obligorType: a.obligorType })
      : null;

  const persistedScore = a.currentCreditScore ? Number(a.currentCreditScore) : null;
  const score = persistedScore ?? liveScorecard?.totalScore ?? null;
  const band = resolveBand(
    (liveScorecard?.band as Band | undefined) ?? null,
    sc?.band ?? null,
    a.internalRatingShort ?? null,
  );
  const bandGrade = band ? BAND_GRADE[band] : null;
  // PD as a percent (BAND_PD_1Y is a fraction 0..1 → *100).
  const pd1yPct = band ? BAND_PD_1Y[band] * 100 : null;

  const ratios = latestRatioSet
    ? ratioSetToSummaryRatios(latestRatioSet as RatioSet)
    : emptyRatios();

  // Prior-period ratios - recompute for the second-to-latest statement when
  // available so the financials paragraph gets a trend line.
  let priorRatios: Partial<CreditSummaryRatios> | undefined;
  let priorPeriodEnd: string | null = null;
  if (financialStatements.length >= 2) {
    const prior = financialStatements[financialStatements.length - 2];
    const priorPrev = financialStatements.length >= 3 ? financialStatements[financialStatements.length - 3] : null;
    const priorSet = computeRatios(prior, priorPrev);
    priorRatios = ratioSetToSummaryRatios(priorSet);
    priorPeriodEnd = isoDate(prior.periodEndDate);
  }

  const latestPeriodEnd = financialStatements.length
    ? isoDate(financialStatements[financialStatements.length - 1].periodEndDate)
    : null;

  const [sectorLabel, grossExposureCr] = await Promise.all([
    resolveSectorLabel(p),
    p ? sumGrossExposureCr(p.partyId) : Promise.resolve(null),
  ]);

  const externalRatings = externalRatingsEnriched.map((e) => ({
    agency: e.row.agency,
    ratingValue: e.row.ratingValue,
    scale: e.row.ratingScale,
    outlook: e.row.outlook,
  }));

  const input: CreditSummaryInput = {
    creditAnalysisId,
    issuerName: p?.legalName ?? "Unnamed obligor",
    obligorType: a.obligorType,
    sectorLabel,
    isListed: p?.isListed ?? null,
    domicileState: p?.domicileState ?? null,
    analysisType: a.analysisType,
    internalRatingShort: a.internalRatingShort,
    internalRatingAction: a.internalRatingAction,
    recommendation: a.recommendation,
    watchlist: Boolean(a.watchlistFlag),
    score,
    band,
    bandGrade,
    pd1yPct,
    ratios,
    externalRatings,
    grossExposureInrCr: grossExposureCr,
    latestPeriodEnd,
    priorPeriodEnd,
    priorRatios,
  };

  return generateCreditSummary(input);
}

function emptyRatios(): CreditSummaryRatios {
  return {
    debtEbitda: null, netDebtEbitda: null, debtEquity: null, interestCoverage: null,
    dscr: null, currentRatio: null, quickRatio: null, ebitdaMargin: null,
    patMargin: null, roce: null, roe: null, gnpaPct: null, nnpaPct: null,
    crar: null, nim: null,
  };
}

function isoDate(d: Date | string | null): string | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

// Re-export the PD range so the client view + credit detail page can render
// the band PD range without importing the db-backed ratingMap.
export { BAND_PD_RANGE };
