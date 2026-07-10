// Scenario analysis - best / base / worst case views + two-variable
// sensitivity grids for every pure-function model in the modelling desk
// (FINANCIAL_MODELING_SPEC §9). A registry wraps each engine's compute
// function behind a uniform driver abstraction: the banker flexes a small
// set of key drivers across their [min, max] range, and the module returns
// the corner-case outcomes (all drivers at their improving extreme = best,
// all at their worsening extreme = worst) plus a 2-D sensitivity grid over
// any two chosen drivers.
//
// The "best/worst" direction is NOT hard-coded (a higher yield is bad for a
// bond's price but a higher EBITDA margin is good for an LBO's IRR); instead
// each driver is classified by a one-sided perturbation probe against the
// base run - robust to model changes and free of magic signs.
//
// Reuses: computeBondMetrics (§1), computeProjectFinance (§2), computeDcf
// (§4), computeMaModel (§5), computeLbo (§6). No model logic is duplicated.

import { computeBondMetrics, type BondInputs } from "@/features/modeling/bondPricing";
import { computeProjectFinance, type ProjectFinanceInputs } from "@/features/modeling/projectFinance";
import { computeDcf, type FullDcfInputs } from "@/features/modeling/dcf";
import { computeMaModel, type MaInputs } from "@/features/modeling/maModel";
import { computeLbo, type LboInputs } from "@/features/modeling/lboModel";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ScenarioModelType =
  | "bond"
  | "project_finance"
  | "dcf"
  | "ma"
  | "lbo";

export type DriverUnit = "inr_cr" | "pct" | "multiple" | "years" | "ratio" | "number";

export type OutcomeFormat = "pct" | "multiple" | "inr_cr" | "price" | "ratio" | "decimal";

export interface DriverSpec {
  key: string;
  label: string;
  unit: DriverUnit;
  base: number;
  min: number;
  max: number;
  step: number;
  hint?: string;
}

export interface ScenarioOutcome {
  primary: number | null;
  primaryLabel: string;
  primaryFormat: OutcomeFormat;
  secondary?: number | null;
  secondaryLabel?: string;
  secondaryFormat?: OutcomeFormat;
}

export interface ScenarioModelDef {
  type: ScenarioModelType;
  label: string;
  description: string;
  drivers: DriverSpec[];
  /** Default X & Y drivers for the sensitivity grid (keys into `drivers`). */
  defaultSensitivityX: string;
  defaultSensitivityY: string;
  /** Run the model with the given driver overrides (key → value). */
  run: (overrides: Record<string, number>) => ScenarioOutcome;
}

export interface ScenarioCases {
  best: ScenarioOutcome;
  base: ScenarioOutcome;
  worst: ScenarioOutcome;
  /** Per-driver classification: true = moving the driver UP improves primary. */
  direction: Record<string, boolean>;
  /** Per-driver absolute bounds used. */
  bounds: Record<string, { base: number; min: number; max: number }>;
}

/** Editable per-driver state - the UI flexes base + downside/upside bounds. */
export interface DriverState {
  base: number;
  min: number;
  max: number;
}
export type DriverStateMap = Record<string, DriverState>;

/** Build the {key: base} override map from a spec (default) or a UI state. */
export function driverBaseOverrides(
  def: ScenarioModelDef,
  state?: DriverStateMap,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of def.drivers) {
    out[d.key] = state?.[d.key]?.base ?? d.base;
  }
  return out;
}

/** Build a DriverStateMap from a spec's default driver bounds. */
export function defaultDriverState(def: ScenarioModelDef): DriverStateMap {
  const out: DriverStateMap = {};
  for (const d of def.drivers) {
    out[d.key] = { base: d.base, min: d.min, max: d.max };
  }
  return out;
}

export interface SensitivityGrid {
  xDriver: string;
  yDriver: string;
  xLabel: string;
  yLabel: string;
  xUnit: DriverUnit;
  yUnit: DriverUnit;
  xSteps: number[];
  ySteps: number[];
  /** rows index = ySteps, cols index = xSteps. Primary value per cell (null on error). */
  cells: (number | null)[][];
  format: OutcomeFormat;
}

// ---------------------------------------------------------------------------
// Formatting helpers (UI-shared, server-safe).
// ---------------------------------------------------------------------------

export function formatDriver(v: number, unit: DriverUnit, digits = 2): string {
  if (!Number.isFinite(v)) return "-";
  switch (unit) {
    case "pct":
      return `${v.toFixed(digits)}%`;
    case "multiple":
      return `${v.toFixed(digits)}×`;
    case "inr_cr":
      return `₹${v.toFixed(digits)} Cr`;
    case "years":
      return `${v.toFixed(digits)} yr`;
    case "ratio":
      return `${v.toFixed(2)}×`;
    default:
      return v.toLocaleString("en-IN", { maximumFractionDigits: digits });
  }
}

export function formatOutcome(v: number | null, format: OutcomeFormat, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "-";
  switch (format) {
    case "pct":
      return `${(v * 100).toFixed(digits)}%`;
    case "multiple":
      return `${v.toFixed(digits)}×`;
    case "inr_cr":
      return `₹${(v / 10_000_000).toFixed(digits)} Cr`;
    case "price":
      return `₹${v.toFixed(digits)}`;
    case "ratio":
      return `${v.toFixed(2)}×`;
    default:
      return v.toFixed(digits);
  }
}

// ---------------------------------------------------------------------------
// Registry - per-model default inputs + driver override → outcome.
// ---------------------------------------------------------------------------

/** Bond scenario: 5y-residual annual corporate, fixed coherent dates; flex
 *  yield & coupon. Primary = clean price, secondary = modified duration. */
function bondRun(overrides: Record<string, number>): ScenarioOutcome {
  const yieldPct = overrides.yield ?? 8.4;
  const couponPct = overrides.coupon ?? 8.25;
  const face = overrides.faceValue ?? 100;
  const inputs: BondInputs = {
    instrumentType: "CORP_IG",
    faceValue: face,
    couponRate: couponPct / 100,
    couponFrequency: 1,
    dayCount: "ACT_365",
    issueDate: "2020-06-25",
    lastCouponDate: "2025-06-25",
    nextCouponDate: "2026-06-25",
    maturityDate: "2030-06-25",
    settlementDate: "2025-11-25",
    yield: yieldPct / 100,
  };
  try {
    const m = computeBondMetrics(inputs);
    if (!Number.isFinite(m.cleanPrice)) {
      return { primary: null, primaryLabel: "Clean price", primaryFormat: "price" };
    }
    return {
      primary: m.cleanPrice,
      primaryLabel: "Clean price",
      primaryFormat: "price",
      secondary: m.modifiedDuration,
      secondaryLabel: "Mod. duration",
      secondaryFormat: "decimal",
    };
  } catch {
    return { primary: null, primaryLabel: "Clean price", primaryFormat: "price" };
  }
}

/** Project-finance scenario: equated (annuity) repayment so min DSCR responds
 *  to the drivers (sculpted repayment pins DSCR at the target by construction).
 *  Flex margin, revenue, debt%, cost of debt. Primary = min DSCR, secondary =
 *  equity IRR. */
function pfRun(overrides: Record<string, number>): ScenarioOutcome {
  const ebitdaMarginPct = overrides.ebitdaMargin ?? 35;
  const revenueCr = overrides.revenueYear1 ?? 160;
  const debtPct = overrides.debtPct ?? 70;
  const costOfDebtPct = overrides.costOfDebt ?? 8.5;
  const inputs: ProjectFinanceInputs = {
    tenorYears: 15,
    constructionYears: 2,
    totalCapex: 5_000_000_000,
    debtPct: debtPct / 100,
    costOfDebt: costOfDebtPct / 100,
    repayment: "equated",
    targetDscr: 1.3, // informational for equated; not a driver
    revenueYear1: revenueCr * 10_000_000,
    revenueEscalation: 0.04,
    ebitdaMargin: ebitdaMarginPct / 100,
    taxRate: 0.2517,
    maintenanceCapexPctOfRevenue: 0.02,
    nwcPctOfRevenue: 0.05,
    dsraMonths: 6,
  };
  try {
    const r = computeProjectFinance(inputs);
    return {
      primary: r.minDscr,
      primaryLabel: "Min DSCR",
      primaryFormat: "ratio",
      secondary: r.equityIrr,
      secondaryLabel: "Equity IRR",
      secondaryFormat: "pct",
    };
  } catch {
    return { primary: null, primaryLabel: "Min DSCR", primaryFormat: "ratio" };
  }
}

/** DCF scenario: 5y FCFF + Gordon terminal; flex revenue, margin, WACC, g.
 *  Primary = enterprise value, secondary = equity value. */
function dcfRun(overrides: Record<string, number>): ScenarioOutcome {
  const revenueCr = overrides.revenueYear0 ?? 500;
  const ebitdaMarginPct = overrides.ebitdaMargin ?? 22;
  const waccPct = overrides.waccOverride ?? 12;
  const gPct = overrides.gordonGrowth ?? 4;
  const margin = ebitdaMarginPct / 100;
  const inputs: FullDcfInputs = {
    wacc: {
      riskFreeRate: 0.0665,
      equityRiskPremium: 0.07,
      beta: 1.1,
      sizePremium: 0.01,
      countryRiskPremium: 0.02,
      preTaxCostOfDebt: 0.09,
      taxRate: 0.2517,
      equityWeight: 0.6,
      debtWeight: 0.4,
    },
    fcff: {
      revenueYear0: revenueCr * 10_000_000,
      forecast: Array.from({ length: 5 }, (_, t) => ({
        revenueGrowth: 0.10 - t * 0.005,
        ebitdaMargin: margin,
        capexPctOfRevenue: 0.04,
        daPctOfRevenue: 0.03,
        nwcPctOfRevenue: 0.08,
      })),
      taxRate: 0.2517,
    },
    terminal: { method: "gordon", gordonGrowth: gPct / 100 },
    bridge: {
      totalDebt: 1_500_000_000,
      cash: 300_000_000,
      minorityInterest: 0,
      preferredEquity: 0,
      nonOperatingInvestments: 0,
    },
    waccOverride: waccPct / 100,
  };
  try {
    const r = computeDcf(inputs);
    return {
      primary: r.enterpriseValue,
      primaryLabel: "Enterprise value",
      primaryFormat: "inr_cr",
      secondary: r.equityValue,
      secondaryLabel: "Equity value",
      secondaryFormat: "inr_cr",
    };
  } catch {
    return { primary: null, primaryLabel: "Enterprise value", primaryFormat: "inr_cr" };
  }
}

/** M&A scenario: flex synergies, purchase price, new debt, exit multiple.
 *  Primary = EPS accretion, secondary = acquirer deal IRR. */
function maRun(overrides: Record<string, number>): ScenarioOutcome {
  const base = maScenarioBase();
  const synergiesCr = overrides.runRateSynergies ?? 9;
  const priceCr = overrides.equityPurchasePrice ?? 140;
  const newDebtCr = overrides.newDebt ?? 70;
  const exitMult = overrides.exitEvEbitda ?? 9;
  const inputs: MaInputs = {
    acquirer: base.acquirer,
    target: base.target,
    deal: {
      ...base.deal,
      runRateSynergies: synergiesCr * 10_000_000,
      equityPurchasePrice: priceCr * 10_000_000,
      newDebt: newDebtCr * 10_000_000,
      exitEvEbitda: exitMult,
    },
  };
  try {
    const r = computeMaModel(inputs);
    return {
      primary: r.accretionDilution.accretionPct,
      primaryLabel: "EPS accretion",
      primaryFormat: "pct",
      secondary: r.dealIrr.irr,
      secondaryLabel: "Deal IRR",
      secondaryFormat: "pct",
    };
  } catch {
    return { primary: null, primaryLabel: "EPS accretion", primaryFormat: "pct" };
  }
}

/** LBO scenario: flex entry/exit multiple, EBITDA growth, cash sweep.
 *  Primary = sponsor IRR, secondary = MOIC. */
function lboRun(overrides: Record<string, number>): ScenarioOutcome {
  const base = lboScenarioBase();
  const entryMult = overrides.entryEvEbitda ?? 8;
  const exitMult = overrides.exitEvEbitda ?? 9;
  const growthPct = overrides.ebitdaGrowth ?? 8;
  const sweepPct = overrides.cashSweepPct ?? 75;
  const inputs: LboInputs = {
    ...base,
    entryEvEbitda: entryMult,
    exitEvEbitda: exitMult,
    ebitdaGrowth: growthPct / 100,
    cashSweepPct: sweepPct / 100,
  };
  try {
    const r = computeLbo(inputs);
    return {
      primary: r.irr,
      primaryLabel: "Sponsor IRR",
      primaryFormat: "pct",
      secondary: r.moic,
      secondaryLabel: "MOIC",
      secondaryFormat: "multiple",
    };
  } catch {
    return { primary: null, primaryLabel: "Sponsor IRR", primaryFormat: "pct" };
  }
}

// Base inputs for the M&A & LBO scenario runners (kept here, decoupled from the
// calculator defaults so the scenario desk's base case is self-documenting).
function maScenarioBase(): MaInputs {
  return {
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
  };
}

function lboScenarioBase(): LboInputs {
  return {
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
      { name: "Senior secured (TLA)", amount: 600_000_000, rate: 0.095, amortizationPct: 0.10 },
      { name: "Senior secured (TLB)", amount: 400_000_000, rate: 0.105, amortizationPct: 0.05 },
      { name: "Subordinated / mezzanine", amount: 250_000_000, rate: 0.135, amortizationPct: 0.0 },
    ],
  };
}

// ---------------------------------------------------------------------------
// The registry.
// ---------------------------------------------------------------------------

export const SCENARIO_MODELS: Record<ScenarioModelType, ScenarioModelDef> = {
  bond: {
    type: "bond",
    label: "Bond pricing",
    description:
      "Clean price vs yield & coupon. A higher yield lowers price; sensitivity is the price-yield grid.",
    drivers: [
      { key: "yield", label: "YTM", unit: "pct", base: 8.4, min: 6, max: 11, step: 0.1, hint: "Solve price from yield" },
      { key: "coupon", label: "Coupon", unit: "pct", base: 8.25, min: 4, max: 12, step: 0.05 },
    ],
    defaultSensitivityX: "yield",
    defaultSensitivityY: "coupon",
    run: bondRun,
  },
  project_finance: {
    type: "project_finance",
    label: "Project finance",
    description:
      "Equated debt service - min DSCR & equity IRR vs EBITDA margin, revenue, leverage and cost of debt. (Sculpted repayment pins DSCR at the target; equated lets headroom move.)",
    drivers: [
      { key: "ebitdaMargin", label: "EBITDA margin", unit: "pct", base: 35, min: 25, max: 45, step: 0.5 },
      { key: "revenueYear1", label: "Revenue (Yr 1)", unit: "inr_cr", base: 160, min: 100, max: 250, step: 5 },
      { key: "debtPct", label: "Debt %", unit: "pct", base: 70, min: 50, max: 80, step: 1 },
      { key: "costOfDebt", label: "Cost of debt", unit: "pct", base: 8.5, min: 7, max: 11, step: 0.25 },
    ],
    defaultSensitivityX: "ebitdaMargin",
    defaultSensitivityY: "debtPct",
    run: pfRun,
  },
  dcf: {
    type: "dcf",
    label: "DCF / valuation",
    description:
      "Enterprise value vs revenue, EBITDA margin, WACC and Gordon growth. Lower WACC / higher margin → higher EV.",
    drivers: [
      { key: "revenueYear0", label: "Revenue (Yr 0)", unit: "inr_cr", base: 500, min: 200, max: 1200, step: 10 },
      { key: "ebitdaMargin", label: "EBITDA margin", unit: "pct", base: 22, min: 12, max: 32, step: 0.5 },
      { key: "waccOverride", label: "WACC", unit: "pct", base: 12, min: 9, max: 16, step: 0.25 },
      { key: "gordonGrowth", label: "Terminal g", unit: "pct", base: 4, min: 1, max: 6, step: 0.25 },
    ],
    defaultSensitivityX: "waccOverride",
    defaultSensitivityY: "ebitdaMargin",
    run: dcfRun,
  },
  ma: {
    type: "ma",
    label: "M&A",
    description:
      "EPS accretion vs synergies, purchase price, new debt and exit multiple. More synergies / lower price → more accretive.",
    drivers: [
      { key: "runRateSynergies", label: "Run-rate synergies", unit: "inr_cr", base: 9, min: 0, max: 25, step: 0.5 },
      { key: "equityPurchasePrice", label: "Purchase price", unit: "inr_cr", base: 140, min: 80, max: 220, step: 2 },
      { key: "newDebt", label: "New debt", unit: "inr_cr", base: 70, min: 0, max: 160, step: 2 },
      { key: "exitEvEbitda", label: "Exit multiple", unit: "multiple", base: 9, min: 6, max: 12, step: 0.25 },
    ],
    defaultSensitivityX: "runRateSynergies",
    defaultSensitivityY: "equityPurchasePrice",
    run: maRun,
  },
  lbo: {
    type: "lbo",
    label: "LBO",
    description:
      "Sponsor IRR & MOIC vs entry/exit multiples, EBITDA growth and cash sweep. Lower entry / higher exit → higher IRR.",
    drivers: [
      { key: "entryEvEbitda", label: "Entry EV/EBITDA", unit: "multiple", base: 8, min: 6, max: 11, step: 0.25 },
      { key: "exitEvEbitda", label: "Exit EV/EBITDA", unit: "multiple", base: 9, min: 6, max: 12, step: 0.25 },
      { key: "ebitdaGrowth", label: "EBITDA growth", unit: "pct", base: 8, min: 0, max: 15, step: 0.5 },
      { key: "cashSweepPct", label: "Cash sweep", unit: "pct", base: 75, min: 0, max: 100, step: 5 },
    ],
    defaultSensitivityX: "entryEvEbitda",
    defaultSensitivityY: "exitEvEbitda",
    run: lboRun,
  },
};

export const SCENARIO_MODEL_LIST: ScenarioModelDef[] = Object.values(SCENARIO_MODELS);

export function getScenarioModel(type: ScenarioModelType): ScenarioModelDef {
  return SCENARIO_MODELS[type];
}

// ---------------------------------------------------------------------------
// Classification - per-driver direction probe (does moving UP improve the
// primary metric?). Robust to any model: perturb base by a small epsilon,
// compare the primary to the base run.
// ---------------------------------------------------------------------------

function perturb(base: number, min: number, max: number): { up: number; down: number } {
  const span = Math.max(Math.abs(max - min), Math.abs(base) * 1e-3, 1e-9);
  const eps = Math.max(span * 1e-3, 1e-9);
  const up = Math.min(base + eps, max);
  const down = Math.max(base - eps, min);
  // If perturbing both ways lands on base (degenerate range), force a nudge.
  if (up === base && down === base) {
    return { up: base, down: base };
  }
  return { up, down };
}

export function classifyDrivers(
  def: ScenarioModelDef,
  state?: DriverStateMap,
): Record<string, boolean> {
  const baseOverrides = driverBaseOverrides(def, state);
  const baseOutcome = def.run(baseOverrides);
  const basePrimary = baseOutcome.primary;
  const direction: Record<string, boolean> = {};
  for (const d of def.drivers) {
    const s = state?.[d.key] ?? { base: d.base, min: d.min, max: d.max };
    if (!Number.isFinite(basePrimary as number)) {
      direction[d.key] = true; // unknown → assume up-improves; worst/base handle null gracefully
      continue;
    }
    const { up } = perturb(s.base, s.min, s.max);
    if (up === s.base) {
      direction[d.key] = true;
      continue;
    }
    const upOutcome = def.run({ ...baseOverrides, [d.key]: up });
    const upPrimary = upOutcome.primary;
    if (upPrimary == null || !Number.isFinite(upPrimary as number)) {
      direction[d.key] = true;
    } else {
      direction[d.key] = upPrimary > (basePrimary as number);
    }
  }
  return direction;
}

// ---------------------------------------------------------------------------
// Best / Base / Worst - corner cases. For each driver, the BEST case takes
// the end of [min,max] that improves the primary (per classification); the
// WORST case takes the opposite end. All drivers flexed together = the
// banker's "everything goes right / everything goes wrong" view.
// ---------------------------------------------------------------------------

export function computeScenarios(
  def: ScenarioModelDef,
  state?: DriverStateMap,
): ScenarioCases {
  const direction = classifyDrivers(def, state);
  const bounds: Record<string, { base: number; min: number; max: number }> = {};
  const baseOverrides: Record<string, number> = {};
  const bestOverrides: Record<string, number> = {};
  const worstOverrides: Record<string, number> = {};
  for (const d of def.drivers) {
    const s = state?.[d.key] ?? { base: d.base, min: d.min, max: d.max };
    bounds[d.key] = { base: s.base, min: s.min, max: s.max };
    baseOverrides[d.key] = s.base;
    const upImproves = direction[d.key];
    bestOverrides[d.key] = upImproves ? s.max : s.min;
    worstOverrides[d.key] = upImproves ? s.min : s.max;
  }
  const base = def.run(baseOverrides);
  const best = def.run(bestOverrides);
  const worst = def.run(worstOverrides);
  return { best, base, worst, direction, bounds };
}

// ---------------------------------------------------------------------------
// Two-variable sensitivity grid. Sweeps `xDriver` across `steps` points in
// [min,max] (columns) and `yDriver` across `steps` points (rows); each cell =
// the model's primary outcome at that (x, y) pair, all other drivers at base.
// ---------------------------------------------------------------------------

function linspace(min: number, max: number, steps: number): number[] {
  if (steps <= 1) return [Number(((min + max) / 2).toFixed(4))];
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const v = min + ((max - min) * i) / (steps - 1);
    out.push(Number(v.toFixed(4)));
  }
  return out;
}

export function computeSensitivity(
  def: ScenarioModelDef,
  xDriverKey: string,
  yDriverKey: string,
  steps = 7,
  state?: DriverStateMap,
): SensitivityGrid {
  const xDriver = def.drivers.find((d) => d.key === xDriverKey) ?? def.drivers[0];
  const yDriver = def.drivers.find((d) => d.key === yDriverKey) ?? def.drivers[1] ?? def.drivers[0];
  const xs = state?.[xDriver.key] ?? { base: xDriver.base, min: xDriver.min, max: xDriver.max };
  const ys = state?.[yDriver.key] ?? { base: yDriver.base, min: yDriver.min, max: yDriver.max };
  const xSteps = linspace(xs.min, xs.max, steps);
  const ySteps = linspace(ys.min, ys.max, steps);

  // Other drivers held at their (user) base.
  const baseOverrides = driverBaseOverrides(def, state);

  const cells: (number | null)[][] = [];
  for (const y of ySteps) {
    const row: (number | null)[] = [];
    for (const x of xSteps) {
      const outcome = def.run({ ...baseOverrides, [xDriver.key]: x, [yDriver.key]: y });
      row.push(outcome.primary);
    }
    cells.push(row);
  }

  return {
    xDriver: xDriver.key,
    yDriver: yDriver.key,
    xLabel: xDriver.label,
    yLabel: yDriver.label,
    xUnit: xDriver.unit,
    yUnit: yDriver.unit,
    xSteps,
    ySteps,
    cells,
    format: def.run(baseOverrides).primaryFormat,
  };
}
