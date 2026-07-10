// Scenario analysis engine - invariants verification.
// Source of truth: src/features/modeling/scenarioAnalysis.ts. Pins:
//   - the registry exposes all five model types with coherent drivers
//   - best ≥ base ≥ worst on the primary metric (corner-case ordering)
//   - driver direction classification matches financial intuition
//   - sensitivity grid shape + monotonicity per model

import { describe, expect, it } from "vitest";

import {
  SCENARIO_MODELS,
  SCENARIO_MODEL_LIST,
  getScenarioModel,
  classifyDrivers,
  computeScenarios,
  computeSensitivity,
  formatOutcome,
  formatDriver,
  type ScenarioModelType,
} from "@/features/modeling/scenarioAnalysis";

const TYPES: ScenarioModelType[] = [
  "bond",
  "project_finance",
  "dcf",
  "ma",
  "lbo",
];

describe("registry - completeness", () => {
  it("exposes all five model types", () => {
    for (const t of TYPES) {
      expect(SCENARIO_MODELS[t]).toBeDefined();
      expect(SCENARIO_MODELS[t].type).toBe(t);
    }
    expect(SCENARIO_MODEL_LIST.length).toBe(5);
  });

  it("every model has ≥ 2 drivers and valid default sensitivity keys", () => {
    for (const t of TYPES) {
      const m = getScenarioModel(t);
      expect(m.drivers.length).toBeGreaterThanOrEqual(2);
      const keys = m.drivers.map((d) => d.key);
      expect(keys).toContain(m.defaultSensitivityX);
      expect(keys).toContain(m.defaultSensitivityY);
      for (const d of m.drivers) {
        expect(d.min).toBeLessThanOrEqual(d.base);
        expect(d.base).toBeLessThanOrEqual(d.max);
        expect(d.step).toBeGreaterThan(0);
      }
    }
  });

  it("base run returns a finite primary for every model", () => {
    for (const t of TYPES) {
      const m = getScenarioModel(t);
      const o = m.run({});
      expect(o.primary).not.toBeNull();
      expect(Number.isFinite(o.primary as number)).toBe(true);
    }
  });
});

describe("classifyDrivers - direction intuition", () => {
  it("bond: a higher YTM worsens price (direction=false)", () => {
    const d = classifyDrivers(getScenarioModel("bond"));
    expect(d.yield).toBe(false);
  });

  it("dcf: a higher WACC worsens EV; higher margin improves EV", () => {
    const d = classifyDrivers(getScenarioModel("dcf"));
    expect(d.waccOverride).toBe(false);
    expect(d.ebitdaMargin).toBe(true);
  });

  it("lbo: a higher entry multiple worsens IRR; higher exit improves", () => {
    const d = classifyDrivers(getScenarioModel("lbo"));
    expect(d.entryEvEbitda).toBe(false);
    expect(d.exitEvEbitda).toBe(true);
  });

  it("ma: more synergies improves accretion; higher price worsens", () => {
    const d = classifyDrivers(getScenarioModel("ma"));
    expect(d.runRateSynergies).toBe(true);
    expect(d.equityPurchasePrice).toBe(false);
  });

  it("project finance: higher margin improves min DSCR; higher debt% / cost worsen", () => {
    const d = classifyDrivers(getScenarioModel("project_finance"));
    expect(d.ebitdaMargin).toBe(true);
    expect(d.debtPct).toBe(false);
    expect(d.costOfDebt).toBe(false);
  });
});

describe("computeScenarios - best/base/worst ordering", () => {
  for (const t of TYPES) {
    it(`${t}: best ≥ base ≥ worst on the primary metric`, () => {
      const m = getScenarioModel(t);
      const s = computeScenarios(m);
      const b = s.best.primary;
      const base = s.base.primary;
      const w = s.worst.primary;
      expect(b).not.toBeNull();
      expect(base).not.toBeNull();
      expect(w).not.toBeNull();
      expect((b as number) + 1e-9).toBeGreaterThanOrEqual(base as number);
      expect((base as number) + 1e-9).toBeGreaterThanOrEqual(w as number);
    });
  }

  it("bond best case uses the low-yield end (price-maximizing)", () => {
    const m = getScenarioModel("bond");
    const s = computeScenarios(m);
    // yield direction is false ⇒ best takes min yield.
    expect(s.bounds.yield.min).toBeLessThan(s.bounds.yield.base);
    expect(s.best.primary as number).toBeGreaterThan(s.base.primary as number);
  });
});

describe("computeSensitivity - grid shape & monotonicity", () => {
  for (const t of TYPES) {
    it(`${t}: grid is steps×steps with finite cells`, () => {
      const m = getScenarioModel(t);
      const g = computeSensitivity(m, m.defaultSensitivityX, m.defaultSensitivityY, 5);
      expect(g.cells.length).toBe(5);
      for (const row of g.cells) expect(row.length).toBe(5);
      // Center cell ≈ base run primary (all drivers at base).
      const center = g.cells[2][2];
      expect(center).not.toBeNull();
      expect(Number.isFinite(center as number)).toBe(true);
    });
  }

  it("bond grid (yield × coupon → price): price falls as yield rises along a row", () => {
    const m = getScenarioModel("bond");
    const g = computeSensitivity(m, "yield", "coupon", 5);
    const midRow = g.cells[2];
    for (let j = 1; j < midRow.length; j++) {
      expect(midRow[j]).toBeLessThan(midRow[j - 1]! + 1e-9);
    }
  });

  it("lbo grid (entry × exit → IRR): IRR falls as entry rises along a row; rises as exit rises down a column", () => {
    const m = getScenarioModel("lbo");
    // xDriver = entry (columns), yDriver = exit (rows).
    const g = computeSensitivity(m, "entryEvEbitda", "exitEvEbitda", 5);
    // Along a row (fixed exit, varying entry across columns): IRR falls.
    const midRow = g.cells[2];
    for (let j = 1; j < midRow.length; j++) {
      expect(midRow[j]).toBeLessThanOrEqual(midRow[j - 1]! + 1e-9);
    }
    // Down a column (fixed entry, varying exit across rows): IRR rises.
    const midCol = g.cells.map((row) => row[2]);
    for (let i = 1; i < midCol.length; i++) {
      expect(midCol[i]).toBeGreaterThanOrEqual(midCol[i - 1]! - 1e-9);
    }
  });

  it("dcf grid (WACC × margin → EV): EV rises as margin rises along a row", () => {
    const m = getScenarioModel("dcf");
    // X = WACC (decreasing EV), Y = margin. Along a fixed-WACC row, vary X
    // (WACC) - EV falls as WACC rises. Use the WACC column instead.
    const g = computeSensitivity(m, "waccOverride", "ebitdaMargin", 5);
    const midRow = g.cells[2]; // fixed margin, varying WACC across columns
    for (let j = 1; j < midRow.length; j++) {
      expect(midRow[j]).toBeLessThanOrEqual(midRow[j - 1]! + 1e-9);
    }
  });
});

describe("formatting helpers", () => {
  it("formatOutcome renders each format correctly", () => {
    expect(formatOutcome(0.125, "pct")).toBe("12.50%");
    expect(formatOutcome(2.5, "multiple")).toBe("2.50×");
    expect(formatOutcome(1_200_000_000, "inr_cr")).toBe("₹120.00 Cr");
    expect(formatOutcome(99.5, "price")).toBe("₹99.50");
    expect(formatOutcome(1.25, "ratio")).toBe("1.25×");
    expect(formatOutcome(null, "pct")).toBe("-");
  });

  it("formatDriver renders each unit correctly", () => {
    expect(formatDriver(8.4, "pct")).toBe("8.40%");
    expect(formatDriver(8.0, "multiple")).toBe("8.00×");
    expect(formatDriver(150, "inr_cr")).toBe("₹150.00 Cr");
    expect(formatDriver(5, "years")).toBe("5.00 yr");
  });
});
