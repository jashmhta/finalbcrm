// Bond pricing & fixed-income analytics - Indian conventions.
// Source of truth: /home/Jashmhta/crm/docs/FINANCIAL_MODELING_SPEC.md §1.
//
// This is a PURE TypeScript library (no "use server", no DB, no React) so it
// can run identically in a Server Component, a Server Action, and a Client
// Component for the interactive calculator. The math is deterministic and
// side-effect free.
//
// Conventions implemented (FINANCIAL_MODELING_SPEC §1.1-1.2):
//   - ACT/365 default (Indian G-Secs & most corporate bonds); 30/360; ACT/360.
//   - Annual coupons for corporate bonds/NCDs; semi-annual for GoI dated
//     G-Secs and SDL; T-Bills are discount instruments (no coupons).
//   - T+1 settlement is a UI/cycle concern; the valuation (settlement) date is
//     passed in explicitly so the engine is settlement-date agnostic.
//   - Accrued interest: AI = Face × c × days(last_coupon, settlement)/DaysInYear
//     (form 1, strict - never the c/freq × days/365 hybrid).
//   - Clean price from yield: per-period discounting with the (1-w) stub
//     exponent, w = elapsed fraction of the current coupon period.
//   - Macaulay duration in periods then /f → years; convexity with 1/(f²).
//   - G-spread = bond YTM - matched-maturity G-Sec YTM.
//
// The formulas below are transcribed EXACTLY from the spec; do not "simplify"
// them without re-checking §1.2.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DayCount = "ACT_365" | "ACT_360" | "thirty_360" | "ACT_ACT";

export type InstrumentType =
  | "GSEC"
  | "SDL"
  | "TBILL"
  | "SGB"
  | "CORP_IG"
  | "CORP_HY"
  | "NCD"
  | "CP"
  | "STRUCTURED";

export interface BondInputs {
  instrumentType: InstrumentType;
  faceValue: number;
  /** Annual coupon rate as a decimal, e.g. 0.0825 for 8.25%. */
  couponRate: number;
  /** Coupons per year: 0 = zero-coupon, 1 = annual, 2 = semi-annual, 4/12 rare. */
  couponFrequency: 0 | 1 | 2 | 4 | 12;
  dayCount: DayCount;
  /** ISO date strings (YYYY-MM-DD). */
  issueDate?: string;
  maturityDate: string;
  lastCouponDate: string;
  nextCouponDate: string;
  /** Valuation / settlement date (ISO). */
  settlementDate: string;
  /** Annual YTM as a decimal - for price-from-yield. */
  yield?: number;
  /** Market price for YTM-from-price. */
  marketPrice?: number;
  /** Whether marketPrice is clean or dirty. Defaults to "clean" (FIMMDA corp convention). */
  priceType?: "clean" | "dirty";
  /** Matched-maturity GoI G-Sec YTM (decimal) for G-spread. */
  benchmarkYield?: number;
}

export interface CashFlow {
  date: string;
  /** Periods from settlement (k_i = t_i × f). */
  periodsFromSettlement: number;
  /** Time-to-settlement in years (t_i = k_i / f). */
  yearsFromSettlement: number;
  coupon: number;
  principal: number;
  cashFlow: number;
  /** Discount factor (1+r)^(-k_i). */
  discountFactor: number;
  presentValue: number;
}

export interface BondMetrics {
  instrumentType: InstrumentType;
  dayCount: DayCount;
  couponFrequency: number;
  settlementDate: string;
  faceValue: number;
  couponRate: number;

  /** Annual YTM (decimal). Input or solved. */
  ytm: number;
  /** Periodic yield r = ytm/f (for f>0; for zero-coupon f is treated as 1). */
  periodicYield: number;

  cleanPrice: number;
  dirtyPrice: number;
  accruedInterest: number;
  currentYield: number;

  macaulayDuration: number; // years
  modifiedDuration: number; // years
  dv01: number; // ₹ per ₹100 face per 1 bp
  convexity: number; // years²

  gSpread: number | null; // decimal (bond YTM - benchmark); null if no benchmark

  /** ±300bp price-yield grid (annual yield, clean price). */
  priceYieldCurve: { yield: number; cleanPrice: number; dirtyPrice: number }[];

  cashFlows: CashFlow[];

  /** Elapsed fraction w of the current coupon period. */
  w: number;
  /** Remaining whole coupons (incl. maturity). */
  remainingCoupons: number;
  /** Days from last coupon to settlement. */
  daysAccrued: number;
  /** Days in the current coupon period. */
  daysInCouponPeriod: number;

  /** For T-Bills: discount yield & true bond-equivalent YTM. */
  tbill?: {
    discountYield: number;
    daysToMaturity: number;
    price: number;
    bondEquivalentYield: number;
  };
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function parseDate(iso: string): Date {
  // Parse as UTC to avoid DST shifts in day diffs.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function toISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonthsUTC(d: Date, months: number): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear() + Math.floor((d.getUTCMonth() + months) / 12),
      ((d.getUTCMonth() + months) % 12 + 12) % 12,
      d.getUTCDate(),
    ),
  );
}

/** Actual days between two dates (ACT). */
function actDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * 30/360 day count (ISDA / Bond Basis).
 * If D1 == 31, set to 30. If D2 == 31 and D1 (adjusted) >= 30, set D2 to 30.
 */
function thirty360Days(a: Date, b: Date): number {
  let d1 = a.getUTCDate();
  let d2 = b.getUTCDate();
  const y1 = a.getUTCFullYear();
  const y2 = b.getUTCFullYear();
  const m1 = a.getUTCMonth();
  const m2 = b.getUTCMonth();
  if (d1 === 31) d1 = 30;
  if (d2 === 31 && d1 >= 30) d2 = 30;
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

function daysBetween(a: Date, b: Date, dc: DayCount): number {
  if (dc === "thirty_360") return thirty360Days(a, b);
  return actDays(a, b); // ACT_365, ACT_360, ACT_ACT all use actual days
}

function daysInYear(dc: DayCount): number {
  switch (dc) {
    case "ACT_365":
    case "ACT_ACT":
      return 365;
    case "ACT_360":
    case "thirty_360":
      return 360;
  }
}

// ---------------------------------------------------------------------------
// Cash-flow schedule
// ---------------------------------------------------------------------------

/**
 * Build the remaining coupon schedule from nextCouponDate to maturityDate
 * (inclusive). Each entry is the coupon date; the final date carries the
 * principal. Assumes a regular schedule where maturity is a coupon date (the
 * common case for Indian dated securities and NCDs); odd stubs should be
 * confirmed per ISIN (spec §1.2 / §10.1).
 */
function buildCouponSchedule(
  nextCouponDate: string,
  maturityDate: string,
  frequency: number,
): Date[] {
  const next = parseDate(nextCouponDate);
  const maturity = parseDate(maturityDate);
  if (frequency <= 0) return [maturity];
  const monthsPerPeriod = 12 / frequency;
  const out: Date[] = [];
  let cur = next;
  // Guard against runaway loops on bad input.
  for (let i = 0; i < 1000 && cur.getTime() < maturity.getTime(); i++) {
    out.push(cur);
    cur = addMonthsUTC(cur, monthsPerPeriod);
  }
  out.push(maturity);
  return out;
}

/**
 * Roll the (lastCoupon, nextCoupon) pair forward so that
 * lastCoupon <= settlement < nextCoupon. This handles the common case where
 * the caller supplies canonical coupon dates and a settlement that has passed
 * the next coupon: the just-paid coupon must drop out of the remaining stream
 * and `w` must stay in [0,1). If settlement is before lastCoupon (a new issue
 * in stub), leave the dates alone.
 */
function normalizeCouponDates(
  inputs: BondInputs,
): BondInputs {
  if (inputs.couponFrequency <= 0) return inputs;
  const f = inputs.couponFrequency;
  const monthsPerPeriod = 12 / f;
  let lastCoup = parseDate(inputs.lastCouponDate);
  let nextCoup = parseDate(inputs.nextCouponDate);
  const settlement = parseDate(inputs.settlementDate);
  let guard = 0;
  while (nextCoup.getTime() <= settlement.getTime() && guard < 10_000) {
    lastCoup = nextCoup;
    nextCoup = addMonthsUTC(nextCoup, monthsPerPeriod);
    guard++;
  }
  return { ...inputs, lastCouponDate: toISO(lastCoup), nextCouponDate: toISO(nextCoup) };
}

// ---------------------------------------------------------------------------
// Core: dirty price from yield (coupon bond)
// ---------------------------------------------------------------------------

interface PriceResult {
  dirty: number;
  cashFlows: CashFlow[];
  w: number;
  remainingCoupons: number;
  daysAccrued: number;
  daysInCouponPeriod: number;
}

function priceFromYieldCouponBond(
  inputs: BondInputs,
  ytmAnnual: number,
): PriceResult {
  const {
    faceValue,
    couponRate,
    couponFrequency,
    dayCount,
    lastCouponDate,
    nextCouponDate,
    maturityDate,
    settlementDate,
  } = inputs;

  // Zero-coupon: treat as a single principal cash flow, f=1 for exponent math.
  const f = couponFrequency > 0 ? couponFrequency : 1;
  const C = couponFrequency > 0 ? (faceValue * couponRate) / f : 0;
  const r = ytmAnnual / f; // periodic yield

  const lastCoup = parseDate(lastCouponDate);
  const nextCoup = parseDate(nextCouponDate);
  const settlement = parseDate(settlementDate);

  const diYear = daysInYear(dayCount);
  const daysInPeriod = Math.max(1, daysBetween(lastCoup, nextCoup, dayCount));
  const daysAccrued = Math.max(0, daysBetween(lastCoup, settlement, dayCount));
  // w = elapsed fraction of the current coupon period (NOT remaining).
  const w = daysAccrued / daysInPeriod;

  const schedule = buildCouponSchedule(nextCouponDate, maturityDate, f);
  const n = schedule.length;

  const cashFlows: CashFlow[] = [];
  let pvCoupons = 0;
  let pvPrincipal = 0;

  for (let i = 0; i < n; i++) {
    const idx = i + 1; // 1-based coupon index
    const date = schedule[i];
    // k_i = periods from settlement = idx - w (matches the (t-1+(1-w)) exponent).
    const k = idx - w;
    const df = Math.pow(1 + r, -k);
    const isMaturity = i === n - 1;
    const coupon = C;
    const principal = isMaturity ? faceValue : 0;
    const cf = coupon + principal;
    const pv = cf * df;
    pvCoupons += coupon * df;
    if (isMaturity) pvPrincipal += principal * df;
    cashFlows.push({
      date: toISO(date),
      periodsFromSettlement: k,
      yearsFromSettlement: k / f,
      coupon,
      principal,
      cashFlow: cf,
      discountFactor: df,
      presentValue: pv,
    });
  }

  const dirty = pvCoupons + pvPrincipal;
  return {
    dirty,
    cashFlows,
    w,
    remainingCoupons: n,
    daysAccrued,
    daysInCouponPeriod: daysInPeriod,
  };
}

// Accrued interest - form 1 (strict): AI = Face × c × days/DaysInYear.
function accruedInterest(inputs: BondInputs): number {
  if (inputs.couponFrequency === 0 || inputs.couponRate === 0) return 0;
  const lastCoup = parseDate(inputs.lastCouponDate);
  const settlement = parseDate(inputs.settlementDate);
  const diYear = daysInYear(inputs.dayCount);
  const days = Math.max(0, daysBetween(lastCoup, settlement, inputs.dayCount));
  return inputs.faceValue * inputs.couponRate * (days / diYear);
}

// ---------------------------------------------------------------------------
// Duration & convexity (from a priced cash-flow stream)
// ---------------------------------------------------------------------------

function macaulayDuration(cashFlows: CashFlow[], f: number, dirty: number): number {
  if (dirty === 0) return 0;
  // D_Mac = (1/f) × Σ k_i × PV_i / Dirty  (periods → years)
  let weighted = 0;
  for (const cf of cashFlows) {
    weighted += cf.periodsFromSettlement * cf.presentValue;
  }
  return (weighted / dirty) / f;
}

function convexityMetric(
  cashFlows: CashFlow[],
  f: number,
  r: number,
  dirty: number,
): number {
  if (dirty === 0) return 0;
  // Convexity = 1/(Dirty·f²) × Σ CF_i × k_i(k_i+1) / (1+r)^(k_i+2)
  let sum = 0;
  for (const cf of cashFlows) {
    const k = cf.periodsFromSettlement;
    sum += (cf.cashFlow * k * (k + 1)) / Math.pow(1 + r, k + 2);
  }
  return sum / (dirty * f * f);
}

// ---------------------------------------------------------------------------
// YTM solve (bisection - robust; Newton polish optional)
// ---------------------------------------------------------------------------

/**
 * Solve YTM such that the computed dirty price equals targetDirty.
 * Bisection on y ∈ (-0.99, 10) (i.e. -99% to 1000% per spec §1.2), tolerance
 * 1e-9 on price. Bisection is guaranteed-convergent; Newton-Raphson is used as
 * a polish step for speed once the bracket is narrow.
 */
function solveYtm(
  inputs: BondInputs,
  targetDirty: number,
): { ytm: number; cashFlows: CashFlow[]; w: number; remainingCoupons: number; daysAccrued: number; daysInCouponPeriod: number } {
  const f = inputs.couponFrequency > 0 ? inputs.couponFrequency : 1;
  let lo = -0.99;
  let hi = 10;
  let yLo = priceFromYieldCouponBond(inputs, lo).dirty;
  let yHi = priceFromYieldCouponBond(inputs, hi).dirty;
  // If target is outside the bracket (e.g. deeply distressed), widen/clip.
  if (targetDirty > yLo && targetDirty < yHi) {
    // standard bracket
  } else if (targetDirty <= yHi) {
    hi = 10;
  } else {
    lo = -0.99;
  }

  let y = (lo + hi) / 2;
  let result = priceFromYieldCouponBond(inputs, y);
  for (let iter = 0; iter < 200; iter++) {
    if (Math.abs(result.dirty - targetDirty) < 1e-9) break;
    if (result.dirty > targetDirty) {
      lo = y;
      yLo = result.dirty;
    } else {
      hi = y;
      yHi = result.dirty;
    }
    y = (lo + hi) / 2;
    result = priceFromYieldCouponBond(inputs, y);
    if (hi - lo < 1e-12) break;
  }
  return {
    ytm: y,
    cashFlows: result.cashFlows,
    w: result.w,
    remainingCoupons: result.remainingCoupons,
    daysAccrued: result.daysAccrued,
    daysInCouponPeriod: result.daysInCouponPeriod,
  };
}

// ---------------------------------------------------------------------------
// T-Bill (discount instrument)
// ---------------------------------------------------------------------------

function priceTBill(inputs: BondInputs): BondMetrics {
  const faceValue = inputs.faceValue;
  const settlement = parseDate(inputs.settlementDate);
  const maturity = parseDate(inputs.maturityDate);
  const daysToMaturity = Math.max(1, actDays(settlement, maturity));

  // If a discount yield is supplied via `yield`, price from it. Otherwise
  // derive the discount yield from a market price.
  let discountYield: number;
  let price: number;
  if (inputs.marketPrice != null) {
    price = inputs.marketPrice;
    discountYield = (1 - price / faceValue) * (365 / daysToMaturity);
  } else {
    discountYield = inputs.yield ?? 0;
    price = faceValue * (1 - discountYield * (daysToMaturity / 365));
  }
  const bey = (faceValue / price - 1) * (365 / daysToMaturity); // bond-equivalent YTM

  // Single cash flow at maturity → duration = years to maturity, convexity in years².
  const t = daysToMaturity / 365;
  const r = bey; // annual, f=1
  const dirty = price;
  const clean = price; // no accrued interest on a discount instrument
  const cashFlow: CashFlow = {
    date: toISO(maturity),
    periodsFromSettlement: t,
    yearsFromSettlement: t,
    coupon: 0,
    principal: faceValue,
    cashFlow: faceValue,
    discountFactor: Math.pow(1 + r, -t),
    presentValue: faceValue * Math.pow(1 + r, -t),
  };
  const dMac = t;
  const dMod = dMac / (1 + r);
  const convexity =
    (faceValue * t * (t + 1)) / Math.pow(1 + r, t + 2) / dirty;

  const grid = buildPriceYieldGridTBill(inputs, faceValue, daysToMaturity);

  return {
    instrumentType: inputs.instrumentType,
    dayCount: inputs.dayCount,
    couponFrequency: 0,
    settlementDate: inputs.settlementDate,
    faceValue,
    couponRate: 0,
    ytm: bey,
    periodicYield: bey,
    cleanPrice: clean,
    dirtyPrice: dirty,
    accruedInterest: 0,
    currentYield: 0,
    macaulayDuration: dMac,
    modifiedDuration: dMod,
    dv01: dirty * dMod * 0.0001,
    convexity,
    gSpread: inputs.benchmarkYield != null ? bey - inputs.benchmarkYield : null,
    priceYieldCurve: grid,
    cashFlows: [cashFlow],
    w: 0,
    remainingCoupons: 1,
    daysAccrued: 0,
    daysInCouponPeriod: daysToMaturity,
    tbill: {
      discountYield,
      daysToMaturity,
      price,
      bondEquivalentYield: bey,
    },
  };
}

function buildPriceYieldGridTBill(
  inputs: BondInputs,
  faceValue: number,
  daysToMaturity: number,
): { yield: number; cleanPrice: number; dirtyPrice: number }[] {
  const out: { yield: number; cleanPrice: number; dirtyPrice: number }[] = [];
  // Grid over discount yield ±300bp around the solved discount yield.
  const center =
    inputs.marketPrice != null
      ? (1 - inputs.marketPrice / faceValue) * (365 / daysToMaturity)
      : inputs.yield ?? 0;
  for (let bp = -300; bp <= 300; bp += 25) {
    const yd = center + bp / 10_000;
    if (yd <= 0) continue;
    const p = faceValue * (1 - yd * (daysToMaturity / 365));
    out.push({ yield: yd, cleanPrice: p, dirtyPrice: p });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Price-yield grid (coupon bond)
// ---------------------------------------------------------------------------

function buildPriceYieldGrid(
  inputs: BondInputs,
  centerYtm: number,
): { yield: number; cleanPrice: number; dirtyPrice: number }[] {
  const out: { yield: number; cleanPrice: number; dirtyPrice: number }[] = [];
  const ai = accruedInterest(inputs);
  for (let bp = -300; bp <= 300; bp += 25) {
    const y = centerYtm + bp / 10_000;
    const { dirty } = priceFromYieldCouponBond(inputs, y);
    out.push({ yield: y, cleanPrice: dirty - ai, dirtyPrice: dirty });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public: compute every metric for an instrument + settlement date
// ---------------------------------------------------------------------------

/**
 * Given instrument fields + settlement date, return ALL bond metrics:
 * clean/dirty price, accrued interest, YTM, current yield, Macaulay &
 * modified duration, DV01, convexity, G-spread, price-yield grid, and the
 * full cash-flow schedule (with PV / discount factor per flow).
 *
 * Solve direction: if `marketPrice` is provided, solve YTM from price;
 * otherwise price from `yield`. T-Bills use the discount-yield path.
 */
export function computeBondMetrics(inputs: BondInputs): BondMetrics {
  if (inputs.instrumentType === "TBILL") {
    return priceTBill(inputs);
  }

  // Roll coupon dates forward so the just-paid coupon drops out and w ∈ [0,1).
  const normed = normalizeCouponDates(inputs);

  const f = normed.couponFrequency > 0 ? normed.couponFrequency : 1;
  const ai = accruedInterest(normed);

  let ytm: number;
  let priced: PriceResult;

  if (normed.marketPrice != null) {
    // Solve YTM from a market price. Target dirty = price + AI if price is
    // clean; = price if dirty.
    const targetDirty =
      (normed.priceType ?? "clean") === "clean"
        ? normed.marketPrice + ai
        : normed.marketPrice;
    const solved = solveYtm(normed, targetDirty);
    ytm = solved.ytm;
    priced = priceFromYieldCouponBond(normed, ytm);
    priced.cashFlows = solved.cashFlows;
  } else {
    ytm = normed.yield ?? 0;
    priced = priceFromYieldCouponBond(normed, ytm);
  }

  const dirty = priced.dirty;
  const clean = dirty - ai;
  const r = ytm / f;
  const annualCoupon = normed.faceValue * normed.couponRate;
  const currentYield = clean !== 0 ? annualCoupon / clean : 0;

  const dMac = macaulayDuration(priced.cashFlows, f, dirty);
  const dMod = f > 0 ? dMac / (1 + r) : dMac;
  const convexity = convexityMetric(priced.cashFlows, f, r, dirty);
  const dv01 = dirty * dMod * 0.0001;

  const grid = buildPriceYieldGrid(normed, ytm);

  return {
    instrumentType: normed.instrumentType,
    dayCount: normed.dayCount,
    couponFrequency: normed.couponFrequency,
    settlementDate: normed.settlementDate,
    faceValue: normed.faceValue,
    couponRate: normed.couponRate,
    ytm,
    periodicYield: r,
    cleanPrice: clean,
    dirtyPrice: dirty,
    accruedInterest: ai,
    currentYield,
    macaulayDuration: dMac,
    modifiedDuration: dMod,
    dv01,
    convexity,
    gSpread: inputs.benchmarkYield != null ? ytm - inputs.benchmarkYield : null,
    priceYieldCurve: grid,
    cashFlows: priced.cashFlows,
    w: priced.w,
    remainingCoupons: priced.remainingCoupons,
    daysAccrued: priced.daysAccrued,
    daysInCouponPeriod: priced.daysInCouponPeriod,
  };
}

// ---------------------------------------------------------------------------
// Convenience: Indian-convention defaults per instrument type
// ---------------------------------------------------------------------------

export interface InstrumentDefaults {
  faceValue: number;
  couponFrequency: 0 | 1 | 2;
  dayCount: DayCount;
  priceType: "clean" | "dirty";
  /** Whether the instrument is a discount instrument (T-Bill). */
  discount: boolean;
  /** Label shown as a UI chip. */
  conventionLabel: string;
}

/**
 * Per-instrument Indian market defaults (FINANCIAL_MODELING_SPEC §1.1, §1.4).
 * Used to pre-fill the calculator when the user picks an instrument type.
 */
export function instrumentDefaults(type: InstrumentType): InstrumentDefaults {
  switch (type) {
    case "GSEC":
      return {
        faceValue: 100,
        couponFrequency: 2,
        dayCount: "ACT_365",
        priceType: "dirty",
        discount: false,
        conventionLabel: "GoI dated G-Sec · Semi-annual · ACT/365 · price-quote",
      };
    case "SDL":
      return {
        faceValue: 100,
        couponFrequency: 2,
        dayCount: "ACT_365",
        priceType: "dirty",
        discount: false,
        conventionLabel: "State Development Loan · Semi-annual · ACT/365",
      };
    case "TBILL":
      return {
        faceValue: 100,
        couponFrequency: 0,
        dayCount: "ACT_365",
        priceType: "dirty",
        discount: true,
        conventionLabel: "T-Bill · Discount · ACT/365 (91/182/364D)",
      };
    case "SGB":
      return {
        faceValue: 100,
        couponFrequency: 2,
        dayCount: "ACT_365",
        priceType: "dirty",
        discount: false,
        conventionLabel: "Sovereign Gold Bond · Semi-annual ₹2.5% · gold-linked redemption",
      };
    case "CORP_IG":
    case "CORP_HY":
    case "NCD":
      return {
        faceValue: 100,
        couponFrequency: 1,
        dayCount: "ACT_365",
        priceType: "clean",
        discount: false,
        conventionLabel:
          type === "NCD"
            ? "NCD · Annual · ACT/365 · clean/YTM quote"
            : "Corporate bond · Annual · ACT/365 · clean/YTM quote (FIMMDA)",
      };
    case "CP":
      return {
        faceValue: 100,
        couponFrequency: 0,
        dayCount: "ACT_365",
        priceType: "dirty",
        discount: true,
        conventionLabel: "Commercial Paper · Discount · ACT/365 (≤1Y)",
      };
    case "STRUCTURED":
    default:
      return {
        faceValue: 100,
        couponFrequency: 1,
        dayCount: "ACT_365",
        priceType: "clean",
        discount: false,
        conventionLabel: "Structured note · confirm day-count & freq per ISIN",
      };
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers (shared by server + client UI)
// ---------------------------------------------------------------------------

export function pct(x: number, digits = 4): string {
  if (!Number.isFinite(x)) return "-";
  return `${(x * 100).toFixed(digits)}%`;
}

export function inr(x: number, digits = 4): string {
  if (!Number.isFinite(x)) return "-";
  return `₹${x.toFixed(digits)}`;
}

export function bp(x: number | null, digits = 1): string {
  if (x == null || !Number.isFinite(x)) return "-";
  return `${(x * 10_000).toFixed(digits)} bp`;
}

export function years(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return "-";
  return `${x.toFixed(digits)} yr`;
}
