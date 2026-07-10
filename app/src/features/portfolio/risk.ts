// Portfolio risk math - simplified, decision-speed analytics for the desk.
// (FINANCIAL_MODELING_SPEC spirit: a screening-grade answer, not a full OAS /
// key-rate model. The full duration/KRD/OAS work stays in Excel / Bloomberg
// alongside.)
//
// Per-bond Macaulay + modified duration + convexity from tenor + coupon + yield
// (par-bond assumption: when no market yield is stored we take yield ≈ coupon,
// which is the standard first-pass for a freshly-placed par bond). Then
// portfolio-level DV01 (₹ per 1bp), value-weighted modified duration + convexity,
// and a simplified 1-day parametric Value-at-Risk from a duration × yield-shock
// shock (the canonical fixed-income parametric VaR).
//
// Indian conventions:
//   - exposure.gross_exposure is stored in CRORES (the IB convention; see
//     seed.ts + reports/export.ts). grossExposureCr is the face/market value
//     in ₹ Cr; 1 Cr = 1e7 rupees.
//   - couponPct / yieldPct are annual rates in PERCENT (8.5 = 8.5%).
//   - DV01 is reported in RUPEES per 1 basis-point yield move (and in ₹ lakh
//     for compact display); VaR in ₹ Cr.
//
// All functions are PURE (no DB, no I/O) so they are trivially unit-testable
// and safe to call from Server Components, server actions, and the client.

// ---------------------------------------------------------------------------
// Per-bond analytics
// ---------------------------------------------------------------------------

/** Annual coupon rate as a decimal (8.5% → 0.085). Null coupon → par-bond
 *  fallback of 8% (the Indian corporate-bond benchmark coupon). */
export function couponDecimal(couponPct: number | null | undefined): number {
  if (couponPct == null || !Number.isFinite(couponPct) || couponPct <= 0) {
    return 0.08;
  }
  return couponPct / 100;
}

/**
 * Macaulay duration (years) of a level-coupon annual-pay bond at par.
 *
 * D_mac = [ Σ_{t=1..n} t·c·v^t + n·v^n ] / [ Σ_{t=1..n} c·v^t + v^n ]
 *   where v = 1/(1+y), c = annual coupon (decimal, on face 1), y = yield
 *   (decimal), n = years to maturity.
 *
 * Computed as a numeric sum over annual periods (max ~50y) - robust, no
 * closed-form edge cases at y→0. For a par bond (c = y) this reduces to the
 * familiar (1+y)/y · (1 − 1/(1+y)^n); the loop form is identical and also
 * handles c ≠ y (discount/premium) cleanly.
 *
 * Returns 0 for n ≤ 0 (a maturing / past-maturity position has no residual
 * rate sensitivity). Caps n at 50y so a stray 2099 maturity can't spin a
 * 75-year loop.
 */
export function macaulayDuration(
  yearsToMaturity: number,
  couponPct: number | null | undefined,
  yieldPct: number | null | undefined,
): number {
  const n = Math.max(0, Math.min(50, Math.floor(yearsToMaturity)));
  if (n <= 0) return 0;
  const c = couponDecimal(couponPct);
  // Par-bond assumption: yield ≈ coupon when no market yield is stored. If a
  // market yield is supplied it overrides.
  const y = yieldPct != null && Number.isFinite(yieldPct) && yieldPct > 0
    ? yieldPct / 100
    : c;
  const v = 1 / (1 + y);

  let pvCashflows = 0; // Σ c·v^t + v^n  (price on face 1)
  let pvTimeCashflows = 0; // Σ t·c·v^t + n·v^n
  for (let t = 1; t <= n; t++) {
    const vt = Math.pow(v, t);
    pvCashflows += c * vt;
    pvTimeCashflows += t * c * vt;
  }
  pvCashflows += Math.pow(v, n); // principal at n
  pvTimeCashflows += n * Math.pow(v, n);

  if (pvCashflows <= 0) return 0;
  return pvTimeCashflows / pvCashflows;
}

/**
 * Modified duration = Macaulay / (1 + y). The rate-sensitivity measure: the
 * approximate % price change for a 1bp yield move is modDur × 0.0001.
 */
export function modifiedDuration(
  yearsToMaturity: number,
  couponPct: number | null | undefined,
  yieldPct: number | null | undefined,
): number {
  const d = macaulayDuration(yearsToMaturity, couponPct, yieldPct);
  const c = couponDecimal(couponPct);
  const y = yieldPct != null && Number.isFinite(yieldPct) && yieldPct > 0
    ? yieldPct / 100
    : c;
  const denom = 1 + y;
  if (denom <= 0) return 0;
  return d / denom;
}

/**
 * Convexity of a level-coupon annual-pay bond.
 *
 * Conv = (1 / (P · (1+y)^2)) · Σ_{t=1..n} t(t+1)·CF_t / (1+y)^t
 *   with CF_t = c (coupon) for t<n+1 and CF_n = c + 1 (coupon + principal),
 *   P = bond price on face 1.
 *
 * The second-order term that corrects duration's linear price-yield
 * approximation. Returns 0 for n ≤ 0.
 */
export function convexity(
  yearsToMaturity: number,
  couponPct: number | null | undefined,
  yieldPct: number | null | undefined,
): number {
  const n = Math.max(0, Math.min(50, Math.floor(yearsToMaturity)));
  if (n <= 0) return 0;
  const c = couponDecimal(couponPct);
  const y = yieldPct != null && Number.isFinite(yieldPct) && yieldPct > 0
    ? yieldPct / 100
    : c;
  const v = 1 / (1 + y);

  let price = 0;
  let convNum = 0;
  for (let t = 1; t <= n; t++) {
    const vt = Math.pow(v, t);
    const cf = t === n ? c + 1 : c; // principal returned at maturity
    price += cf * vt;
    convNum += t * (t + 1) * cf * vt;
  }
  if (price <= 0) return 0;
  const denom = price * Math.pow(1 + y, 2);
  if (denom <= 0) return 0;
  return convNum / denom;
}

/**
 * DV01 - the rupee price impact of a 1 basis-point (0.01%) parallel yield
 * shift, using the duration approximation: ΔP ≈ −P · modDur · Δy.
 *
 *   dv01 = faceValueRupees · modDur · 1e-4   (rupees per 1bp)
 *
 * Returned in RUPEES. The sign is dropped (DV01 is conventionally quoted as a
 * positive "loss for a +1bp move"); the desk reads it as the magnitude of
 * rate sensitivity. For a par bond P ≈ 1 so face ≈ market value; for
 * discount/premium paper a price factor would scale this - acceptable for a
 * simplified screening model.
 */
export function bondDv01Rupees(
  faceValueRupees: number,
  modDur: number,
): number {
  if (!Number.isFinite(faceValueRupees) || !Number.isFinite(modDur)) return 0;
  return Math.abs(faceValueRupees * modDur * 1e-4);
}

// ---------------------------------------------------------------------------
// Portfolio aggregation
// ---------------------------------------------------------------------------

/** A single portfolio position for risk aggregation. */
export interface RiskPosition {
  /** Face / market value of the position in ₹ CRORES. */
  grossExposureCr: number;
  /** Years to maturity (maturity − as-of). */
  tenorYears: number;
  /** Annual coupon in PERCENT (8.5 = 8.5%). Null → 8% fallback. */
  couponPct: number | null;
  /** Optional market yield in PERCENT. Null → par-bond (yield ≈ coupon). */
  yieldPct?: number | null;
}

export interface PortfolioRiskMetrics {
  /** Σ gross exposure (₹ Cr). */
  totalExposureCr: number;
  /** Value-weighted portfolio modified duration (years). */
  portfolioModDur: number;
  /** Value-weighted portfolio Macaulay duration (years). */
  portfolioMacDur: number;
  /** Value-weighted portfolio convexity (years²). */
  portfolioConvexity: number;
  /** Σ per-position DV01 - total rupee loss on a +1bp parallel shift (₹). */
  dv01Rupees: number;
  /** DV01 expressed in ₹ lakh (dv01Rupees / 1e5) for compact display. */
  dv01Lakh: number;
  /** 1-day 99% parametric VaR (₹ Cr). */
  var1d99Cr: number;
  /** 1-day 99% parametric VaR (₹). */
  var1d99Rupees: number;
  /** Number of positions with a positive residual tenor. */
  positionCount: number;
}

/**
 * Default parametric VaR assumptions for the simplified model. The 1-day
 * yield shock (6bp) is a conservative round-number for Indian corporate-bond
 * daily yield vol (G-Sec 10Y daily vol is typically 2–4bp; BBB credits 5–
 * 10bp). z99 = 2.33 is the one-tailed 99% normal multiplier.
 *
 * These are surfaced in the UI as the model assumptions so the desk can
 * stress them mentally (the real VaR engine with historical-sim + curve
 * twist lives in the risk system alongside).
 */
export const VAR_ASSUMPTIONS = {
  /** 1-day yield shock (decimal): 6bp = 0.0006. */
  dailyYieldShock: 0.0006,
  /** One-tailed 99% normal z-multiple. */
  z99: 2.33,
  /** Confidence label. */
  confidence: "99%",
  /** Horizon. */
  horizon: "1-day",
} as const;

/**
 * Aggregate per-position risk into portfolio-level metrics.
 *
 *   portfolioModDur    = Σ (w_i · modDur_i)              (value-weighted)
 *   portfolioConvexity = Σ (w_i · convexity_i)
 *   dv01Rupees         = Σ bondDv01(face_i, modDur_i)
 *   var1d99            = totalExposureRupees · portfolioModDur · shock · z99
 *
 * VaR uses the duration approximation (ΔP ≈ −P·modDur·Δy) - the standard
 * parametric fixed-income VaR. A negative-tenor position contributes zero
 * duration/DV01/VaR (it has no residual rate sensitivity) but still counts
 * toward total exposure.
 */
export function aggregatePortfolioRisk(
  positions: readonly RiskPosition[],
): PortfolioRiskMetrics {
  let totalExposureCr = 0;
  let modDurWeighted = 0;
  let macDurWeighted = 0;
  let convexityWeighted = 0;
  let dv01Rupees = 0;
  let positionCount = 0;

  for (const p of positions) {
    const face = Number.isFinite(p.grossExposureCr) ? p.grossExposureCr : 0;
    if (face <= 0) continue;
    totalExposureCr += face;
    if (p.tenorYears > 0) positionCount += 1;

    const modDur = modifiedDuration(p.tenorYears, p.couponPct, p.yieldPct);
    const macDur = macaulayDuration(p.tenorYears, p.couponPct, p.yieldPct);
    const conv = convexity(p.tenorYears, p.couponPct, p.yieldPct);

    modDurWeighted += face * modDur;
    macDurWeighted += face * macDur;
    convexityWeighted += face * conv;

    // face in Cr → rupees: × 1e7.
    dv01Rupees += bondDv01Rupees(face * 1e7, modDur);
  }

  const portfolioModDur = totalExposureCr > 0 ? modDurWeighted / totalExposureCr : 0;
  const portfolioMacDur = totalExposureCr > 0 ? macDurWeighted / totalExposureCr : 0;
  const portfolioConvexity =
    totalExposureCr > 0 ? convexityWeighted / totalExposureCr : 0;

  const totalRupees = totalExposureCr * 1e7;
  const var1d99Rupees =
    totalRupees * portfolioModDur * VAR_ASSUMPTIONS.dailyYieldShock * VAR_ASSUMPTIONS.z99;

  return {
    totalExposureCr,
    portfolioModDur,
    portfolioMacDur,
    portfolioConvexity,
    dv01Rupees,
    dv01Lakh: dv01Rupees / 1e5,
    var1d99Cr: var1d99Rupees / 1e7,
    var1d99Rupees,
    positionCount,
  };
}

// ---------------------------------------------------------------------------
// Tenor buckets - the standard Indian desk maturity-bucket grid.
// ---------------------------------------------------------------------------

export interface TenorBucket {
  key: string;
  label: string;
  /** Lower bound (inclusive, years). */
  lo: number;
  /** Upper bound (exclusive, years); Infinity for the open-ended tail. */
  hi: number;
}

export const TENOR_BUCKETS: readonly TenorBucket[] = [
  { key: "0_1", label: "0–1Y", lo: 0, hi: 1 },
  { key: "1_3", label: "1–3Y", lo: 1, hi: 3 },
  { key: "3_5", label: "3–5Y", lo: 3, hi: 5 },
  { key: "5_7", label: "5–7Y", lo: 5, hi: 7 },
  { key: "7_10", label: "7–10Y", lo: 7, hi: 10 },
  { key: "10p", label: "10Y+", lo: 10, hi: Infinity },
] as const;

/** Map a residual tenor (years) to its bucket key. Past-maturity (≤0) → "0_1". */
export function tenorBucketKey(years: number): string {
  for (const b of TENOR_BUCKETS) {
    if (years >= b.lo && years < b.hi) return b.key;
  }
  return TENOR_BUCKETS[0].key;
}

// ---------------------------------------------------------------------------
// Concentration statistics - Herfindahl-Hirschman Index + top-N share.
// ---------------------------------------------------------------------------

/**
 * Herfindahl-Hirschman Index over a set of exposure shares (expressed as
 * PERCENT of total, e.g. 12.5 for 12.5%). HHI = Σ share².
 *
 * Interpretation (US DOJ / RBI concentration yardstick):
 *   < 1,500  → unconcentrated (diversified)
 *   1,500–2,500 → moderately concentrated
 *   > 2,500  → highly concentrated
 *
 * Inputs are PERCENT shares (0–100), so the result is on the 0–10,000 scale
 * (squaring 100 → 10,000 for a single-name monopoly). Returns 0 for an empty
 * set.
 */
export function herfindahlIndex(sharesPct: readonly number[]): number {
  return sharesPct.reduce((acc, s) => acc + s * s, 0);
}

/**
 * Top-N concentration ratio - the combined PERCENT share of the largest N
 * exposures. CR1 = single-largest share; CR3 / CR5 = the desk's "how much of
 * the book sits in the top few names" reading.
 */
export function topNSharePct(
  sharesPct: readonly number[],
  n: number,
): number {
  const sorted = [...sharesPct].sort((a, b) => b - a);
  return sorted.slice(0, n).reduce((acc, s) => acc + s, 0);
}
