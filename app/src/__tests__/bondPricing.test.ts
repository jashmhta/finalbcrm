// Bond pricing engine - canonical-case verification.
// Source of truth for expected behaviour: src/features/modeling/bondPricing.ts
// and docs/FINANCIAL_MODELING_SPEC.md §1.
//
// These tests pin the financially-meaningful invariants, not floating-point
// exactness: a par bond prices cleanly at 100 with YTM == coupon, a discount
// bond prices below par, Macaulay duration is bounded by (0, maturity),
// convexity is strictly positive, and accrued interest follows the strict
// ACT/365 form (Face × c × days/DaysInYear) for a semi-annual G-Sec.

import { describe, expect, it } from "vitest";

import {
  computeBondMetrics,
  instrumentDefaults,
  pct,
  inr,
  bp,
  years,
  type BondInputs,
} from "@/features/modeling/bondPricing";

const baseCorp = (overrides: Partial<BondInputs>): BondInputs => ({
  instrumentType: "CORP_IG",
  faceValue: 100,
  couponRate: 0.08,
  couponFrequency: 1,
  dayCount: "ACT_365",
  lastCouponDate: "2024-01-01",
  nextCouponDate: "2025-01-01",
  maturityDate: "2034-01-01",
  settlementDate: "2024-01-01",
  ...overrides,
});

describe("computeBondMetrics - par bond", () => {
  const metrics = computeBondMetrics(baseCorp({ yield: 0.08 }));

  it("clean price is ~100 when YTM equals the coupon", () => {
    expect(metrics.cleanPrice).toBeCloseTo(100, 6);
  });

  it("YTM equals the coupon rate for a par bond", () => {
    expect(metrics.ytm).toBeCloseTo(0.08, 8);
  });

  it("has no accrued interest when settling on the coupon date", () => {
    expect(metrics.accruedInterest).toBeCloseTo(0, 10);
  });

  it("dirty price equals clean price when there is no accrued", () => {
    expect(metrics.dirtyPrice).toBeCloseTo(metrics.cleanPrice, 10);
  });
});

describe("computeBondMetrics - discount bond", () => {
  // YTM (10%) > coupon (8%) → trades below par.
  const metrics = computeBondMetrics(baseCorp({ yield: 0.1 }));

  it("clean price is below 100", () => {
    expect(metrics.cleanPrice).toBeLessThan(100);
    expect(metrics.cleanPrice).toBeGreaterThan(0);
  });

  it("YTM equals the input yield", () => {
    expect(metrics.ytm).toBeCloseTo(0.1, 8);
  });
});

describe("computeBondMetrics - premium bond", () => {
  // YTM (6%) < coupon (8%) → trades above par.
  const metrics = computeBondMetrics(baseCorp({ yield: 0.06 }));

  it("clean price is above 100", () => {
    expect(metrics.cleanPrice).toBeGreaterThan(100);
  });
});

describe("computeBondMetrics - duration & convexity bounds", () => {
  const metrics = computeBondMetrics(baseCorp({ yield: 0.08 }));
  const maturityYears = 10; // 2024-01-01 → 2034-01-01

  it("Macaulay duration is positive and below maturity", () => {
    expect(metrics.macaulayDuration).toBeGreaterThan(0);
    expect(metrics.macaulayDuration).toBeLessThan(maturityYears);
  });

  it("modified duration is positive and ≤ Macaulay duration", () => {
    expect(metrics.modifiedDuration).toBeGreaterThan(0);
    expect(metrics.modifiedDuration).toBeLessThanOrEqual(metrics.macaulayDuration);
  });

  it("convexity is strictly positive (years²)", () => {
    expect(metrics.convexity).toBeGreaterThan(0);
  });

  it("DV01 is positive (price falls as yields rise)", () => {
    expect(metrics.dv01).toBeGreaterThan(0);
  });
});

describe("computeBondMetrics - accrued interest (semi-annual G-Sec)", () => {
  // GoI dated G-Sec: semi-annual coupons, ACT/365, dirty-price quote.
  // Settlement 2024-04-01 sits inside the 2024-01-01 → 2024-07-01 coupon period.
  // Days accrued (ACT, UTC) from 2024-01-01 to 2024-04-01 = 31 (Jan) + 29 (Feb,
  // 2024 leap) + 31 (Mar) = 91. Strict form: AI = Face × c × 91/365.
  const gsec: BondInputs = {
    instrumentType: "GSEC",
    faceValue: 100,
    couponRate: 0.08,
    couponFrequency: 2,
    dayCount: "ACT_365",
    lastCouponDate: "2024-01-01",
    nextCouponDate: "2024-07-01",
    maturityDate: "2034-01-01",
    settlementDate: "2024-04-01",
    yield: 0.08,
  };
  const metrics = computeBondMetrics(gsec);
  const expectedAi = 100 * 0.08 * (91 / 365);

  it("accrued interest follows the strict ACT/365 form", () => {
    expect(metrics.accruedInterest).toBeCloseTo(expectedAi, 6);
    expect(metrics.accruedInterest).toBeGreaterThan(0);
  });

  it("daysAccrued is exactly 91", () => {
    expect(metrics.daysAccrued).toBe(91);
  });

  it("dirty price = clean price + accrued interest", () => {
    expect(metrics.dirtyPrice).toBeCloseTo(metrics.cleanPrice + metrics.accruedInterest, 6);
  });

  it("current yield is non-negative and finite", () => {
    expect(Number.isFinite(metrics.currentYield)).toBe(true);
    expect(metrics.currentYield).toBeGreaterThanOrEqual(0);
  });
});

describe("computeBondMetrics - price-yield curve & cash flows", () => {
  const metrics = computeBondMetrics(baseCorp({ yield: 0.08 }));

  it("emits a ±300bp grid of clean prices", () => {
    expect(metrics.priceYieldCurve.length).toBeGreaterThan(0);
    const yields = metrics.priceYieldCurve.map((p) => p.yield);
    expect(Math.min(...yields)).toBeLessThanOrEqual(0.08 - 0.03 + 1e-9);
    expect(Math.max(...yields)).toBeGreaterThanOrEqual(0.08 + 0.03 - 1e-9);
  });

  it("higher yield → lower clean price along the grid (monotonic)", () => {
    const grid = [...metrics.priceYieldCurve].sort((a, b) => a.yield - b.yield);
    for (let i = 1; i < grid.length; i++) {
      expect(grid[i].cleanPrice).toBeLessThanOrEqual(grid[i - 1].cleanPrice + 1e-9);
    }
  });

  it("cash flows end with the face value at maturity", () => {
    const last = metrics.cashFlows[metrics.cashFlows.length - 1];
    expect(last.principal).toBeCloseTo(100, 10);
    expect(last.date).toBe("2034-01-01");
  });
});

// ---------------------------------------------------------------------------
// Zero-coupon bond - price = PV of face; duration = maturity; no accrued.
// ---------------------------------------------------------------------------

describe("computeBondMetrics - zero-coupon bond", () => {
  // 10-year zero priced at 8% YTM. Modeled with couponFrequency=0 (the
  // documented zero-coupon indicator) and couponRate=0; the engine treats f=1
  // for exponent math, so nextCouponDate is the first annual "coupon" date
  // after settlement (the intermediate 0-coupon flows drop out of PV).
  const zero: BondInputs = {
    instrumentType: "NCD",
    faceValue: 100,
    couponRate: 0,
    couponFrequency: 0,
    dayCount: "ACT_365",
    lastCouponDate: "2024-01-01",
    nextCouponDate: "2025-01-01",
    maturityDate: "2034-01-01",
    settlementDate: "2024-01-01",
    yield: 0.08,
  };
  const metrics = computeBondMetrics(zero);
  const expectedPrice = 100 / Math.pow(1.08, 10); // ≈ 46.3193

  it("clean price = PV of face (100 / 1.08^10 ≈ 46.32)", () => {
    expect(metrics.cleanPrice).toBeCloseTo(expectedPrice, 4);
    expect(metrics.cleanPrice).toBeLessThan(100);
  });

  it("dirty price equals clean price (no accrued interest on a zero)", () => {
    expect(metrics.accruedInterest).toBeCloseTo(0, 10);
    expect(metrics.dirtyPrice).toBeCloseTo(metrics.cleanPrice, 10);
  });

  it("Macaulay duration ≈ 10 years (single cash flow at maturity)", () => {
    expect(metrics.macaulayDuration).toBeCloseTo(10, 6);
  });

  it("modified duration = Macaulay / (1 + YTM)", () => {
    expect(metrics.modifiedDuration).toBeCloseTo(10 / 1.08, 6);
  });

  it("convexity is strictly positive", () => {
    expect(metrics.convexity).toBeGreaterThan(0);
  });

  it("current yield is 0 (no coupon)", () => {
    expect(metrics.currentYield).toBeCloseTo(0, 10);
  });
});

// ---------------------------------------------------------------------------
// Semi-annual vs annual - both price at par when YTM = coupon.
// ---------------------------------------------------------------------------

describe("computeBondMetrics - semi-annual vs annual par bond", () => {
  const annual = computeBondMetrics(
    baseCorp({
      couponFrequency: 1,
      couponRate: 0.08,
      yield: 0.08,
      lastCouponDate: "2024-01-01",
      nextCouponDate: "2025-01-01",
      maturityDate: "2029-01-01", // 5y
      settlementDate: "2024-01-01",
    }),
  );

  const semi = computeBondMetrics({
    instrumentType: "CORP_IG",
    faceValue: 100,
    couponRate: 0.08,
    couponFrequency: 2,
    dayCount: "ACT_365",
    lastCouponDate: "2024-01-01",
    nextCouponDate: "2024-07-01",
    maturityDate: "2029-01-01", // 5y
    settlementDate: "2024-01-01",
    yield: 0.08,
  });

  it("annual par bond prices at 100", () => {
    expect(annual.cleanPrice).toBeCloseTo(100, 6);
  });

  it("semi-annual par bond prices at 100", () => {
    expect(semi.cleanPrice).toBeCloseTo(100, 6);
  });

  it("both solve YTM back to the 8% coupon", () => {
    expect(annual.ytm).toBeCloseTo(0.08, 8);
    expect(semi.ytm).toBeCloseTo(0.08, 8);
  });

  it("semi-annual Macaulay duration <= annual Macaulay (more frequent coupons pull cash flows earlier)", () => {
    // For a par bond, semi-annual coupons arrive sooner on average → shorter
    // duration than the annual-coupon equivalent.
    expect(semi.macaulayDuration).toBeLessThanOrEqual(annual.macaulayDuration + 1e-9);
  });
});

// ---------------------------------------------------------------------------
// Modified duration = Macaulay / (1 + periodic yield) - the spec relationship.
// ---------------------------------------------------------------------------

describe("computeBondMetrics - modified = Macaulay / (1 + r)", () => {
  it("annual bond: modified = Macaulay / (1 + YTM)", () => {
    const m = computeBondMetrics(baseCorp({ yield: 0.08 }));
    expect(m.modifiedDuration).toBeCloseTo(m.macaulayDuration / (1 + 0.08), 6);
  });

  it("semi-annual bond: modified = Macaulay / (1 + YTM/2)", () => {
    const m = computeBondMetrics({
      instrumentType: "GSEC",
      faceValue: 100,
      couponRate: 0.08,
      couponFrequency: 2,
      dayCount: "ACT_365",
      lastCouponDate: "2024-01-01",
      nextCouponDate: "2024-07-01",
      maturityDate: "2034-01-01",
      settlementDate: "2024-01-01",
      yield: 0.08,
    });
    expect(m.modifiedDuration).toBeCloseTo(m.macaulayDuration / (1 + 0.08 / 2), 6);
  });
});

// ---------------------------------------------------------------------------
// T-Bill - discount-yield pricing (FINANCIAL_MODELING_SPEC §1.2.5).
// ---------------------------------------------------------------------------

describe("computeBondMetrics - T-Bill (discount instrument)", () => {
  // 91-day T-Bill at 6.5% discount yield. Settlement 2024-01-01 (leap year) →
  // maturity 2024-04-01 = 31 (Jan) + 29 (Feb) + 31 (Mar) = 91 days.
  const tbill: BondInputs = {
    instrumentType: "TBILL",
    faceValue: 100,
    couponRate: 0,
    couponFrequency: 0,
    dayCount: "ACT_365",
    lastCouponDate: "2024-01-01",
    nextCouponDate: "2024-04-01",
    maturityDate: "2024-04-01",
    settlementDate: "2024-01-01",
    yield: 0.065, // discount yield
  };
  const metrics = computeBondMetrics(tbill);
  const daysToMaturity = 91;
  const expectedPrice = 100 * (1 - 0.065 * (daysToMaturity / 365));
  const expectedBey = (100 / expectedPrice - 1) * (365 / daysToMaturity);

  it("exposes the T-Bill block (discountYield / days / price / BEY)", () => {
    expect(metrics.tbill).toBeDefined();
    expect(metrics.tbill?.discountYield).toBeCloseTo(0.065, 8);
    expect(metrics.tbill?.daysToMaturity).toBe(91);
  });

  it("price = Face × (1 − Yd × days/365) ≈ 98.379", () => {
    expect(metrics.cleanPrice).toBeCloseTo(expectedPrice, 4);
    expect(metrics.tbill?.price).toBeCloseTo(expectedPrice, 4);
  });

  it("clean = dirty (no accrued on a discount instrument)", () => {
    expect(metrics.accruedInterest).toBeCloseTo(0, 10);
    expect(metrics.cleanPrice).toBeCloseTo(metrics.dirtyPrice, 10);
  });

  it("bond-equivalent YTM > discount yield (BEY converts to a true yield)", () => {
    expect(metrics.ytm).toBeCloseTo(expectedBey, 6);
    expect(metrics.tbill?.bondEquivalentYield).toBeCloseTo(expectedBey, 6);
    expect(metrics.ytm).toBeGreaterThan(0.065);
  });

  it("Macaulay duration ≈ 91/365 years (single cash flow at maturity)", () => {
    expect(metrics.macaulayDuration).toBeCloseTo(91 / 365, 6);
  });

  it("convexity is strictly positive", () => {
    expect(metrics.convexity).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// G-spread = bond YTM − matched-maturity G-Sec YTM.
// ---------------------------------------------------------------------------

describe("computeBondMetrics - G-spread", () => {
  it("gSpread = YTM − benchmarkYield when a benchmark is supplied", () => {
    const m = computeBondMetrics(baseCorp({ yield: 0.08, benchmarkYield: 0.07 }));
    expect(m.gSpread).not.toBeNull();
    expect(m.gSpread).toBeCloseTo(0.01, 8);
  });

  it("gSpread is null when no benchmark is supplied", () => {
    const m = computeBondMetrics(baseCorp({ yield: 0.08 }));
    expect(m.gSpread).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Mid-period accrued interest - corporate annual bond, ACT/365.
// ---------------------------------------------------------------------------

describe("computeBondMetrics - corporate annual mid-period accrued", () => {
  // Annual coupon bond: last coupon 2024-01-01, next 2025-01-01, settle
  // 2024-07-01 (mid-period). Days accrued (ACT, UTC) 2024-01-01 → 2024-07-01 =
  // 31 (Jan) + 29 (Feb, leap) + 31 (Mar) + 30 (Apr) + 31 (May) + 30 (Jun) = 182.
  const m = computeBondMetrics(
    baseCorp({
      couponRate: 0.09,
      couponFrequency: 1,
      yield: 0.09,
      lastCouponDate: "2024-01-01",
      nextCouponDate: "2025-01-01",
      settlementDate: "2024-07-01",
    }),
  );
  const expectedAi = 100 * 0.09 * (182 / 365);

  it("daysAccrued is 182 (Jan–Jun 2024, leap year)", () => {
    expect(m.daysAccrued).toBe(182);
  });

  it("accrued interest follows the strict ACT/365 form (Face × c × days/365)", () => {
    expect(m.accruedInterest).toBeCloseTo(expectedAi, 6);
  });

  it("dirty = clean + accrued", () => {
    expect(m.dirtyPrice).toBeCloseTo(m.cleanPrice + m.accruedInterest, 6);
  });
});

// ---------------------------------------------------------------------------
// instrumentDefaults - Indian-convention defaults per instrument type.
// ---------------------------------------------------------------------------

describe("instrumentDefaults - per-type Indian market conventions", () => {
  it("G-Sec: semi-annual, ACT/365, dirty-price quote", () => {
    const d = instrumentDefaults("GSEC");
    expect(d.couponFrequency).toBe(2);
    expect(d.dayCount).toBe("ACT_365");
    expect(d.priceType).toBe("dirty");
    expect(d.discount).toBe(false);
  });

  it("SDL: semi-annual, ACT/365, dirty-price quote", () => {
    const d = instrumentDefaults("SDL");
    expect(d.couponFrequency).toBe(2);
    expect(d.priceType).toBe("dirty");
  });

  it("T-Bill: discount instrument, no coupons, ACT/365", () => {
    const d = instrumentDefaults("TBILL");
    expect(d.discount).toBe(true);
    expect(d.couponFrequency).toBe(0);
    expect(d.dayCount).toBe("ACT_365");
  });

  it("corporate IG / HY / NCD: annual, ACT/365, clean-price quote (FIMMDA)", () => {
    for (const t of ["CORP_IG", "CORP_HY", "NCD"] as const) {
      const d = instrumentDefaults(t);
      expect(d.couponFrequency).toBe(1);
      expect(d.dayCount).toBe("ACT_365");
      expect(d.priceType).toBe("clean");
      expect(d.discount).toBe(false);
    }
  });

  it("CP: discount instrument (≤1Y)", () => {
    const d = instrumentDefaults("CP");
    expect(d.discount).toBe(true);
    expect(d.couponFrequency).toBe(0);
  });

  it("every instrument type returns a non-empty convention label", () => {
    const types = ["GSEC", "SDL", "TBILL", "SGB", "CORP_IG", "CORP_HY", "NCD", "CP", "STRUCTURED"] as const;
    for (const t of types) {
      expect(instrumentDefaults(t).conventionLabel.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Formatting helpers.
// ---------------------------------------------------------------------------

describe("formatting helpers", () => {
  it("pct formats a decimal as a percentage string", () => {
    expect(pct(0.0825)).toBe("8.2500%");
    expect(pct(0.0825, 2)).toBe("8.25%");
  });

  it("pct returns - for non-finite input", () => {
    expect(pct(NaN)).toBe("-");
    expect(pct(Infinity)).toBe("-");
  });

  it("inr formats a number with the ₹ prefix", () => {
    expect(inr(98.37945, 2)).toBe("₹98.38");
  });

  it("bp formats a decimal spread as basis points", () => {
    expect(bp(0.01)).toBe("100.0 bp");
  });

  it("bp returns - for null / non-finite", () => {
    expect(bp(null)).toBe("-");
    expect(bp(NaN)).toBe("-");
  });

  it("years formats a number with the yr suffix", () => {
    expect(years(7.25)).toBe("7.25 yr");
    expect(years(NaN)).toBe("-");
  });
});
