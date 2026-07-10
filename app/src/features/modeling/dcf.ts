// Quick DCF / WACC calculator (FINANCIAL_MODELING_SPEC §4). Screening-stage
// valuation range before the banker builds the full model. The full DCF with
// peer set stays in Excel alongside (§4.5, §7.2).

export interface WaccInputs {
  riskFreeRate: number; // matched GoI G-Sec YTM, decimal
  equityRiskPremium: number; // India ERP ~0.065-0.075, decimal
  beta: number; // levered beta
  sizePremium: number; // decimal
  countryRiskPremium: number; // decimal
  preTaxCostOfDebt: number; // YTM on target debt, decimal
  taxRate: number; // decimal
  equityWeight: number; // E/(E+D)
  debtWeight: number; // D/(E+D)
}

export interface FcffInputs {
  /**
   * Base-year (LTM / year-0) revenue - the year immediately before the
   * explicit forecast. The spec (§4.1) lists revenue as a historical input;
   * taking it directly avoids the under-determined back-out of revenue from
   * EBIT (which requires an EBIT margin or D&A assumption the forecast
   * schedule does not provide for the base year).
   */
  revenueYear0: number;
  /** Revenue & EBITDA growth + margin schedule for the explicit forecast. */
  forecast: { revenueGrowth: number; ebitdaMargin: number; capexPctOfRevenue: number; daPctOfRevenue: number; nwcPctOfRevenue: number }[];
  taxRate: number;
}

export interface TerminalInputs {
  method: "gordon" | "exit_multiple";
  // Gordon:
  gordonGrowth?: number;
  // Exit multiple:
  exitEvEbitda?: number;
  exitYearEbitda?: number;
}

export interface DcfResult {
  wacc: number;
  costOfEquity: number;
  fcffSchedule: { year: number; revenue: number; ebitda: number; ebit: number; fcff: number; discountFactor: number; pv: number }[];
  /** Sum of PV of explicit-period FCFF. */
  pvExplicit: number;
  terminalValue: number;
  pvTerminal: number;
  enterpriseValue: number;
  equityValue: number;
  /** Equity bridge components (§4.2): EV - Net Debt - Minority - Preferred + Investments. */
  bridge: {
    enterpriseValue: number;
    totalDebt: number;
    cash: number;
    netDebt: number;
    minorityInterest: number;
    preferredEquity: number;
    nonOperatingInvestments: number;
    equityValue: number;
  };
  notes: string[];
}

export function costOfEquity(inputs: WaccInputs): number {
  // Ke = Rf + β·ERP + SP + CRP (§4.2)
  return (
    inputs.riskFreeRate +
    inputs.beta * inputs.equityRiskPremium +
    inputs.sizePremium +
    inputs.countryRiskPremium
  );
}

export function computeWacc(inputs: WaccInputs): { wacc: number; costOfEquity: number } {
  const ke = costOfEquity(inputs);
  const kd = inputs.preTaxCostOfDebt;
  const wacc =
    inputs.equityWeight * ke +
    inputs.debtWeight * kd * (1 - inputs.taxRate);
  return { wacc, costOfEquity: ke };
}

export interface EquityBridgeInputs {
  totalDebt: number;
  cash: number;
  minorityInterest: number;
  preferredEquity: number;
  nonOperatingInvestments: number;
}

/**
 * Equity bridge (§4.2):
 *   Equity Value = EV - Net Debt - Minority Interest - Preferred + Investments
 * where Net Debt = Total Debt - Cash (cash is netted INSIDE Net Debt - do NOT
 * add it back; the +Cash form double-counts). The gross-debt equivalent is
 *   Equity = EV - Total Debt + Cash - Minority - Preferred + Investments.
 */
export function equityBridge(
  ev: number,
  b: EquityBridgeInputs,
): DcfResult["bridge"] {
  const netDebt = b.totalDebt - b.cash;
  const equityValue =
    ev - netDebt - b.minorityInterest - b.preferredEquity + b.nonOperatingInvestments;
  return {
    enterpriseValue: ev,
    totalDebt: b.totalDebt,
    cash: b.cash,
    netDebt,
    minorityInterest: b.minorityInterest,
    preferredEquity: b.preferredEquity,
    nonOperatingInvestments: b.nonOperatingInvestments,
    equityValue,
  };
}

export interface FullDcfInputs {
  wacc: WaccInputs;
  fcff: FcffInputs;
  terminal: TerminalInputs;
  bridge: EquityBridgeInputs;
  /** Optional overrides; if absent, wacc inputs feed wacc, fcff inputs feed tax. */
  waccOverride?: number;
}

/**
 * Full quick DCF: WACC → FCFF schedule (5-yr or N-yr) → terminal value
 * (Gordon or exit multiple) → EV → equity bridge.
 */
export function computeDcf(inputs: FullDcfInputs): DcfResult {
  const notes: string[] = [];
  const { wacc: computedWacc } = computeWacc(inputs.wacc);
  const wacc = inputs.waccOverride ?? computedWacc;
  if (inputs.waccOverride != null) {
    notes.push(`WACC overridden to ${(wacc * 100).toFixed(2)}% (computed was ${(computedWacc * 100).toFixed(2)}%).`);
  }

  // FCFF schedule. EBIT_t = Revenue_t × EBITDA_margin_t - D&A_t.
  // FCFF_t = EBIT_t × (1 - τ) + D&A_t - ΔNWC_t - Capex_t.
  // Screening simplification: ΔNWC_t = NWC% × Revenue_t (treats NWC as growing
  // with revenue, ignoring opening NWC base).
  // Base revenue (year-0) is taken directly from `revenueYear0` (spec §4.1
  // lists revenue as a historical input); year-1 revenue = base × (1+g₁).
  const revenue = inputs.fcff.revenueYear0;
  const schedule: DcfResult["fcffSchedule"] = [];
  let pvExplicit = 0;
  const tau = inputs.fcff.taxRate;
  let prevRevenue = revenue;
  for (let t = 0; t < inputs.fcff.forecast.length; t++) {
    const f = inputs.fcff.forecast[t];
    const rev = prevRevenue * (1 + f.revenueGrowth);
    const ebitda = rev * f.ebitdaMargin;
    const da = rev * f.daPctOfRevenue;
    const ebit = ebitda - da;
    const capex = rev * f.capexPctOfRevenue;
    const dnwc = rev * f.nwcPctOfRevenue;
    const fcff = ebit * (1 - tau) + da - dnwc - capex;
    const df = Math.pow(1 + wacc, -(t + 1));
    const pv = fcff * df;
    pvExplicit += pv;
    schedule.push({ year: t + 1, revenue: rev, ebitda, ebit, fcff, discountFactor: df, pv });
    prevRevenue = rev;
  }

  // Terminal value.
  const n = schedule.length;
  let terminalValue = 0;
  if (inputs.terminal.method === "gordon") {
    const g = inputs.terminal.gordonGrowth ?? 0;
    if (wacc - g <= 0) {
      notes.push("WACC - g ≤ 0; Gordon TV undefined. Check inputs.");
    } else {
      const fcffN1 = schedule[n - 1].fcff * (1 + g);
      terminalValue = fcffN1 / (wacc - g);
      notes.push(`Gordon TV = FCFF(n+1)/(WACC-g) = ${fcffN1.toFixed(0)}/${((wacc - g) * 100).toFixed(2)}%.`);
    }
  } else {
    const mult = inputs.terminal.exitEvEbitda ?? 0;
    const ebitdaN = inputs.terminal.exitYearEbitda ?? schedule[n - 1]?.ebitda ?? 0;
    terminalValue = mult * ebitdaN;
    notes.push(`Exit-multiple TV = ${mult}× × EBITDA(n) = ${ebitdaN.toFixed(0)}.`);
  }
  const pvTerminal = terminalValue / Math.pow(1 + wacc, n);
  const ev = pvExplicit + pvTerminal;
  const bridge = equityBridge(ev, inputs.bridge);

  return {
    wacc,
    costOfEquity: costOfEquity(inputs.wacc),
    fcffSchedule: schedule,
    pvExplicit,
    terminalValue,
    pvTerminal,
    enterpriseValue: ev,
    equityValue: bridge.equityValue,
    bridge,
    notes,
  };
}
