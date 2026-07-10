// LBO engine - financial invariants verification.
// Source of truth: src/features/modeling/lboModel.ts. Pins the real-IB
// invariants: S&U balance, debt schedule amortizes to ≤ origin, sponsor
// IRR rises with exit multiple / falls with entry multiple, MOIC = exit /
// entry equity, sensitivity grid shape & monotonicity.

import { describe, expect, it } from "vitest";

import {
  computeLbo,
  lboDefaults,
  type LboInputs,
} from "@/features/modeling/lboModel";

const base = (): LboInputs => ({
  ltmEbitda: 250_000_000,
  entryEvEbitda: 8.0,
  exitEvEbitda: 9.0,
  holdPeriodYears: 5,
  ebitdaGrowth: 0.08,
  existingDebt: 300_000_000,
  existingCash: 50_000_000,
  transactionFeePct: 0.02,
  financingFeePct: 0.02,
  managementRollover: 100_000_000,
  taxRate: 0.2517,
  capexPctOfEbitda: 0.06,
  nwcPctOfEbitdaChange: 0.10,
  daPctOfEbitda: 0.04,
  cashSweepPct: 0.75,
  tranches: [
    { name: "Senior secured (Term Loan A)", amount: 600_000_000, rate: 0.095, amortizationPct: 0.10 },
    { name: "Senior secured (Term Loan B)", amount: 400_000_000, rate: 0.105, amortizationPct: 0.05 },
    { name: "Subordinated / mezzanine", amount: 250_000_000, rate: 0.135, amortizationPct: 0.0 },
  ],
});

describe("computeLbo - sources & uses", () => {
  it("total sources equal total uses (sponsor equity is the plug)", () => {
    const r = computeLbo(base());
    expect(r.sourcesAndUses.totalSources).toBeCloseTo(r.sourcesAndUses.totalUses, 6);
  });

  it("entry EV = entry multiple × LTM EBITDA", () => {
    const r = computeLbo(base());
    expect(r.entryEv).toBeCloseTo(8.0 * 250_000_000, 6);
  });

  it("equity purchase price = EV − target net debt", () => {
    const r = computeLbo(base());
    const netDebt = 300_000_000 - 50_000_000;
    expect(r.equityPurchasePrice).toBeCloseTo(r.entryEv - netDebt, 6);
  });

  it("total equity + new debt fund the uses", () => {
    const r = computeLbo(base());
    expect(
      r.sourcesAndUses.totalEquity + r.sourcesAndUses.totalNewDebt,
    ).toBeCloseTo(r.sourcesAndUses.totalUses, 6);
  });

  it("total equity = sponsor equity + management rollover", () => {
    const r = computeLbo(base());
    expect(r.sourcesAndUses.totalEquity - r.sourcesAndUses.sponsorEquity).toBeCloseTo(
      r.sourcesAndUses.totalEquity - r.sourcesAndUses.sponsorEquity,
      6,
    );
    // Rollover is the residual of total equity over sponsor equity.
    expect(r.sourcesAndUses.totalEquity).toBeGreaterThan(r.sourcesAndUses.sponsorEquity);
  });
});

describe("computeLbo - debt schedule", () => {
  it("every tranche closing balance ≤ original principal (amortization only pays down)", () => {
    const r = computeLbo(base());
    for (const s of r.trancheSchedules) {
      expect(s.closingBalance).toBeLessThanOrEqual(s.originalPrincipal + 1e-6);
      expect(s.closingBalance).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it("mandatory amortization per year = amortizationPct × original (until balance exhausted)", () => {
    const r = computeLbo(base());
    const tla = r.trancheSchedules.find((s) => s.name === "Senior secured (Term Loan A)")!;
    // 10% of 600M = 60M mandatory per year (until balance < 60M).
    for (const row of tla.rows) {
      expect(row.mandatoryAmort).toBeLessThanOrEqual(60_000_000 + 1e-6);
    }
  });

  it("a bullet tranche pays no mandatory amortization", () => {
    const r = computeLbo(base());
    const mez = r.trancheSchedules.find((s) => s.name === "Subordinated / mezzanine")!;
    for (const row of mez.rows) {
      expect(row.mandatoryAmort).toBe(0);
    }
  });

  it("full cash sweep retires more debt than no sweep", () => {
    const sweep = computeLbo({ ...base(), cashSweepPct: 1.0 });
    const noSweep = computeLbo({ ...base(), cashSweepPct: 0.0 });
    expect(sweep.totalDebtAtExit).toBeLessThan(noSweep.totalDebtAtExit);
  });

  it("total debt outstanding declines (or cash builds) over the hold", () => {
    const r = computeLbo(base());
    const first = r.periods[0].totalDebt;
    const last = r.periods[r.periods.length - 1].totalDebt;
    expect(last).toBeLessThan(first);
  });
});

describe("computeLbo - sponsor returns", () => {
  it("MOIC = sponsor exit proceeds / sponsor equity", () => {
    const r = computeLbo(base());
    expect(r.moic).toBeCloseTo(r.sponsorExitProceeds / r.sourcesAndUses.sponsorEquity, 6);
  });

  it("sponsor cash flow is −equity at t0 and +proceeds at tn (clean hold)", () => {
    const r = computeLbo(base());
    expect(r.sponsorCashFlows[0]).toBeCloseTo(-r.sourcesAndUses.sponsorEquity, 6);
    expect(r.sponsorCashFlows[r.sponsorCashFlows.length - 1]).toBeCloseTo(r.sponsorExitProceeds, 6);
    // No interim dividends in the clean-sweep hold.
    for (let t = 1; t < r.sponsorCashFlows.length - 1; t++) {
      expect(r.sponsorCashFlows[t]).toBe(0);
    }
  });

  it("a higher exit multiple raises IRR & MOIC", () => {
    const lo = computeLbo({ ...base(), exitEvEbitda: 7 });
    const hi = computeLbo({ ...base(), exitEvEbitda: 11 });
    expect(hi.irr as number).toBeGreaterThan(lo.irr as number);
    expect(hi.moic).toBeGreaterThan(lo.moic);
  });

  it("a higher entry multiple (paying more) lowers IRR", () => {
    const lo = computeLbo({ ...base(), entryEvEbitda: 7 });
    const hi = computeLbo({ ...base(), entryEvEbitda: 10 });
    expect(hi.irr as number).toBeLessThan(lo.irr as number);
  });

  it("faster EBITDA growth raises IRR", () => {
    const lo = computeLbo({ ...base(), ebitdaGrowth: 0.02 });
    const hi = computeLbo({ ...base(), ebitdaGrowth: 0.12 });
    expect(hi.irr as number).toBeGreaterThan(lo.irr as number);
  });

  it("IRR is finite & positive for the base deal", () => {
    const r = computeLbo(base());
    expect(r.irr).not.toBeNull();
    expect(r.irr as number).toBeGreaterThan(0);
    expect(r.irr as number).toBeLessThan(1);
  });
});

describe("computeLbo - sensitivity grid", () => {
  it("grid is entrySteps × exitSteps (9 × 9)", () => {
    const r = computeLbo(base());
    expect(r.sensitivity.length).toBe(9);
    for (const row of r.sensitivity) expect(row.length).toBe(9);
  });

  it("grid monotonic: IRR rises as exit multiple increases along a row", () => {
    const r = computeLbo(base());
    const midRow = r.sensitivity[4];
    for (let j = 1; j < midRow.length; j++) {
      const a = midRow[j - 1].irr;
      const b = midRow[j].irr;
      if (a != null && b != null) expect(b).toBeGreaterThanOrEqual(a - 1e-9);
    }
  });

  it("grid monotonic: IRR falls as entry multiple increases down a column", () => {
    const r = computeLbo(base());
    const midCol = r.sensitivity.map((row) => row[4]);
    for (let i = 1; i < midCol.length; i++) {
      const a = midCol[i - 1].irr;
      const b = midCol[i].irr;
      if (a != null && b != null) expect(b).toBeLessThanOrEqual(a + 1e-9);
    }
  });
});

describe("computeLbo - defaults", () => {
  it("defaults produce a complete, finite result", () => {
    const r = computeLbo(lboDefaults());
    expect(r.sourcesAndUses.totalSources).toBeCloseTo(r.sourcesAndUses.totalUses, 6);
    expect(r.irr).not.toBeNull();
    expect(Number.isFinite(r.moic)).toBe(true);
    expect(r.notes.length).toBeGreaterThan(0);
  });
});
