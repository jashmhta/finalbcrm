// M&A engine - financial invariants verification.
// Source of truth: src/features/modeling/maModel.ts. Pins the real-IB
// invariants (S&U balance, goodwill = consideration − net assets, accretive
// iff combined EPS > standalone, deal IRR sign) rather than float exactness.

import { describe, expect, it } from "vitest";

import {
  computeMaModel,
  computeSourcesAndUses,
  computeGoodwill,
  computeAccretionDilution,
  computeDealIrr,
  maDefaults,
  type MaInputs,
} from "@/features/modeling/maModel";

const base = (): MaInputs => ({
  acquirer: {
    revenue: 4_200_000_000,
    ebitdaMargin: 0.22,
    netIncome: 520_000_000,
    sharesOutstanding: 65_000_000,
    sharePrice: 340,
    existingDebt: 1_800_000_000,
    cash: 900_000_000,
    taxRate: 0.2517,
  },
  target: {
    revenue: 1_500_000_000,
    ebitda: 240_000_000,
    netIncome: 150_000_000,
    freeCashFlow: 130_000_000,
    existingDebt: 500_000_000,
    cash: 120_000_000,
    identifiableNetAssetsFairValue: 1_050_000_000,
  },
  deal: {
    equityPurchasePrice: 1_400_000_000,
    refinanceTargetDebt: true,
    targetCashAcquired: true,
    advisoryFeePct: 0.012,
    financingFeePct: 0.015,
    integrationCost: 60_000_000,
    newDebt: 700_000_000,
    newDebtCost: 0.095,
    stockConsideration: 0,
    runRateSynergies: 90_000_000,
    synergyPhaseInYears: 2,
    synergyRealizationPct: 0.8,
    holdPeriodYears: 5,
    exitEvEbitda: 9,
  },
});

describe("computeSourcesAndUses - balance & funding", () => {
  it("total sources equal total uses (the plug balances)", () => {
    const su = computeSourcesAndUses(base());
    expect(su.totalSources).toBeCloseTo(su.totalUses, 6);
  });

  it("refinancing adds target debt to uses", () => {
    const withRefi = computeSourcesAndUses(base());
    const noRefi = computeSourcesAndUses({ ...base(), deal: { ...base().deal, refinanceTargetDebt: false } });
    expect(withRefi.totalUses - noRefi.totalUses).toBeCloseTo(500_000_000, 6);
  });

  it("target cash acquired reduces the acquirer cash plug", () => {
    const withCash = computeSourcesAndUses(base());
    const noCash = computeSourcesAndUses({ ...base(), deal: { ...base().deal, targetCashAcquired: false } });
    expect(noCash.acquirerCashUsed - withCash.acquirerCashUsed).toBeCloseTo(120_000_000, 6);
  });

  it("flags a funding shortfall when the plug exceeds cash on hand", () => {
    const inputs: MaInputs = {
      ...base(),
      acquirer: { ...base().acquirer, cash: 10_000_000 },
      deal: { ...base().deal, newDebt: 0, stockConsideration: 0 },
    };
    const su = computeSourcesAndUses(inputs);
    expect(su.fundingShortfall).toBe(true);
  });
});

describe("computeGoodwill - IFRS 3 acquisition method", () => {
  it("goodwill = consideration − identifiable net assets (100% acq., NCI 0)", () => {
    const g = computeGoodwill(base());
    expect(g.goodwill).toBeCloseTo(1_400_000_000 - 1_050_000_000, 6);
    expect(g.nonControllingInterest).toBe(0);
    expect(g.bargainPurchase).toBe(false);
  });

  it("negative goodwill flags a bargain-purchase gain", () => {
    const g = computeGoodwill({
      ...base(),
      deal: { ...base().deal, equityPurchasePrice: 900_000_000 },
    });
    expect(g.goodwill).toBeLessThan(0);
    expect(g.bargainPurchase).toBe(true);
  });
});

describe("computeAccretionDilution - EPS mechanics", () => {
  it("standalone EPS = acquirer NI / shares", () => {
    const a = computeAccretionDilution(base());
    expect(a.standaloneEps).toBeCloseTo(520_000_000 / 65_000_000, 8);
  });

  it("cash deal issues no new shares", () => {
    const a = computeAccretionDilution(base());
    expect(a.newSharesIssued).toBe(0);
    expect(a.proFormaShares).toBe(65_000_000);
  });

  it("stock deal issues shares = stock consideration / share price", () => {
    const a = computeAccretionDilution({
      ...base(),
      deal: { ...base().deal, stockConsideration: 680_000_000, newDebt: 0 },
    });
    expect(a.newSharesIssued).toBeCloseTo(680_000_000 / 340, 6);
  });

  it("pro-forma NI adds target NI, subtracts after-tax interest, adds after-tax synergies", () => {
    const a = computeAccretionDilution(base());
    const afterTaxInt = 700_000_000 * 0.095 * (1 - 0.2517);
    const afterTaxSyn = 90_000_000 * 0.8 * (1 - 0.2517);
    expect(a.proFormaNetIncome).toBeCloseTo(
      520_000_000 + 150_000_000 - afterTaxInt + afterTaxSyn,
      4,
    );
  });

  it("a richer synergy deal is more accretive than a thin one", () => {
    const thin = computeAccretionDilution({ ...base(), deal: { ...base().deal, runRateSynergies: 0 } });
    const rich = computeAccretionDilution({ ...base(), deal: { ...base().deal, runRateSynergies: 250_000_000 } });
    expect(rich.accretionPct).toBeGreaterThan(thin.accretionPct);
  });

  it("an overpaid cash deal is dilutive", () => {
    const a = computeAccretionDilution({
      ...base(),
      deal: {
        ...base().deal,
        equityPurchasePrice: 5_000_000_000,
        newDebt: 4_500_000_000,
        newDebtCost: 0.12,
        runRateSynergies: 0,
      },
    });
    expect(a.accretive).toBe(false);
    expect(a.accretionPct).toBeLessThan(0);
  });
});

describe("computeDealIrr - acquirer deal return", () => {
  it("year-0 outflow = total capital deployed (price + refinance + fees + integration)", () => {
    const d = computeDealIrr(base());
    const fees = 0.012 * 1_400_000_000 + 0.015 * 700_000_000;
    expect(d.totalDeployed).toBeCloseTo(
      1_400_000_000 + 500_000_000 + fees + 60_000_000,
      4,
    );
  });

  it("exit equity nets out target net debt only when debt is NOT refinanced", () => {
    const refi = computeDealIrr(base());
    const noRefi = computeDealIrr({ ...base(), deal: { ...base().deal, refinanceTargetDebt: false } });
    // Refinanced ⇒ target debt = 0 at exit ⇒ higher exit equity.
    expect(refi.exitEquity).toBeGreaterThan(noRefi.exitEquity);
    expect(noRefi.exitEquity).toBeCloseTo(
      refi.exitEv - (500_000_000 - 120_000_000),
      4,
    );
  });

  it("a higher exit multiple raises IRR", () => {
    const lo = computeDealIrr({ ...base(), deal: { ...base().deal, exitEvEbitda: 6 } });
    const hi = computeDealIrr({ ...base(), deal: { ...base().deal, exitEvEbitda: 12 } });
    expect(hi.irr).not.toBeNull();
    expect(lo.irr).not.toBeNull();
    expect((hi.irr as number) > (lo.irr as number)).toBe(true);
  });

  it("IRR is finite and positive for a sensible deal", () => {
    const d = computeDealIrr(base());
    expect(d.irr).not.toBeNull();
    expect(d.irr as number).toBeGreaterThan(0);
    expect(d.irr as number).toBeLessThan(1);
  });
});

describe("computeMaModel - integration", () => {
  it("defaults produce a complete result with a finite IRR", () => {
    const r = computeMaModel(maDefaults());
    expect(r.sourcesAndUses.totalSources).toBeCloseTo(r.sourcesAndUses.totalUses, 6);
    expect(r.dealIrr.irr).not.toBeNull();
    expect(Number.isFinite(r.accretionDilution.accretionPct)).toBe(true);
    expect(r.notes.length).toBeGreaterThan(0);
  });
});
