// Quick project-finance calculator - single-tranche, single-tenor sketch for
// mandate screening (FINANCIAL_MODELING_SPEC §2). Full multi-tranche sculpting
// stays in Excel alongside (§2.7, §7.2); this gives a decision-speed answer.
//
// Implements: CFADS build, periodic DSCR, min/avg DSCR, LLCR (discounted at the
// cost of debt Kd - NOT WACC, per §2.3), PLCR, and debt sizing/sculpting for a
// target DSCR with capped tenor. Indian conventions: 25.17% tax default
// (Sec 115BAA), DSRA = 6 months debt service default.

export interface ProjectFinanceInputs {
  /** Tenor in years (door-to-door, including construction). */
  tenorYears: number;
  /** Construction period in years (no revenue, IDC capitalization skipped in this sketch). */
  constructionYears: number;
  /** Total project cost (capex), currency units. */
  totalCapex: number;
  /** Debt fraction of capex, e.g. 0.70 for 70:30. */
  debtPct: number;
  /** All-in cost of debt (annual, decimal) - the loan's interest rate (Kd). */
  costOfDebt: number;
  /** Repayment profile. */
  repayment: "sculpted" | "equated" | "balloon";
  /** Target/sculpt DSCR (e.g. 1.20). Used for sculpted + sizing. */
  targetDscr: number;
  /** Annual revenue in the first operating year (post-COD). */
  revenueYear1: number;
  /** Annual revenue escalation (decimal). */
  revenueEscalation: number;
  /** EBITDA margin (fraction of revenue), operating phase. */
  ebitdaMargin: number;
  /** Cash tax rate (decimal) - default 0.2517 (Sec 115BAA). */
  taxRate: number;
  /** Maintenance capex as fraction of revenue (operating phase). */
  maintenanceCapexPctOfRevenue: number;
  /** ΔNWC as fraction of revenue (operating phase). */
  nwcPctOfRevenue: number;
  /** DSRA target in months of debt service (default 6). */
  dsraMonths: number;
}

export interface PeriodResult {
  year: number;
  revenue: number;
  ebitda: number;
  cashTax: number;
  maintenanceCapex: number;
  deltaNwc: number;
  cfads: number;
  /** Opening debt outstanding. */
  debtOpening: number;
  interest: number;
  principal: number;
  debtService: number;
  dscr: number;
  debtClosing: number;
}

export interface ProjectFinanceResult {
  debtSize: number;
  equitySize: number;
  periods: PeriodResult[];
  minDscr: number;
  avgDscr: number;
  /** LLCR = PV(CFADS over loan life) / Debt outstanding, discounted at Kd. */
  llcr: number;
  /** PLCR = PV(CFADS over project life) / Debt, Kd over loan life. */
  plcr: number;
  /** Project IRR (unlevered) on total capex. */
  projectIrr: number | null;
  /** Equity IRR (levered). */
  equityIrr: number | null;
  /** DSRA funding requirement. */
  dsra: number;
  /** Notes on sizing convergence. */
  notes: string[];
}

/**
 * CFADS build (§2.3): EBITDA - Cash Tax - Maintenance capex - ΔNWC.
 * (DSRA release/build omitted in this sketch for simplicity.)
 */
function buildCfads(
  inputs: ProjectFinanceInputs,
): { revenue: number; ebitda: number; cfads: number; cashTax: number; maint: number; dnwc: number }[] {
  const opYears = inputs.tenorYears - inputs.constructionYears;
  const rows: { revenue: number; ebitda: number; cfads: number; cashTax: number; maint: number; dnwc: number }[] = [];
  let revenue = inputs.revenueYear1;
  for (let y = 0; y < opYears; y++) {
    const ebitda = revenue * inputs.ebitdaMargin;
    // Interest is computed later in the debt schedule; for the cash-tax line
    // we approximate taxable income as EBITDA - interest on opening debt. To
    // keep CFADS independent of the debt schedule (so sculpting can use it as
    // an input), we use EBITDA × (1 - taxRate) as a pre-debt-schedule proxy
    // for cash tax. This is a screening simplification - the full PF model
    // (Excel) computes tax on EBIT less interest less depreciation.
    const cashTax = ebitda * inputs.taxRate;
    const maint = revenue * inputs.maintenanceCapexPctOfRevenue;
    const dnwc = revenue * inputs.nwcPctOfRevenue;
    const cfads = ebitda - cashTax - maint - dnwc;
    rows.push({ revenue, ebitda, cfads, cashTax, maint, dnwc });
    revenue *= 1 + inputs.revenueEscalation;
  }
  return rows;
}

/**
 * Given a debt size, build the debt service schedule per the chosen profile
 * and compute DSCR per period. Returns the schedule + min/avg DSCR.
 */
function buildDebtSchedule(
  inputs: ProjectFinanceInputs,
  debtSize: number,
  cfads: number[],
): { periods: PeriodResult[]; minDscr: number; avgDscr: number; repaid: boolean } {
  const opYears = cfads.length;
  const r = inputs.costOfDebt;
  const periods: PeriodResult[] = [];
  let opening = debtSize;

  // Pre-compute a sculpted principal profile targeting D* (§2.3):
  //   DebtService_t = CFADS_t / D*
  //   Principal_t = DebtService_t - Interest_t; iterate to amortize.
  // For equated: solve annuity Principal+Interest = P*(r*(1+r)^n)/((1+r)^n-1).
  // For balloon: interest-only + bullet principal at maturity.
  const n = opYears;
  const sculptedPrincipal: number[] = new Array(n).fill(0);
  if (inputs.repayment === "sculpted") {
    // Iterative: sculpt debt service = CFADS/D*, split into interest + principal.
    let bal = debtSize;
    const D = inputs.targetDscr;
    for (let t = 0; t < n; t++) {
      const interest = bal * r;
      const debtService = cfads[t] / D;
      let principal = debtService - interest;
      if (principal < 0) principal = 0;
      if (principal > bal) principal = bal;
      sculptedPrincipal[t] = principal;
      bal -= principal;
    }
    // If a residual balance remains (CFADS too thin), force-amortize the
    // remainder into the final period.
    if (bal > 1e-6) {
      sculptedPrincipal[n - 1] += bal;
    }
  }
  // equated & balloon: sculptedPrincipal stays zero - the main loop below
  // computes equated annuity principal on the running balance, and balloon
  // pays interest-only with a bullet at maturity.

  let openingForEquated = debtSize;
  for (let t = 0; t < n; t++) {
    const interest = opening * r;
    let principal: number;
    if (inputs.repayment === "sculpted") {
      principal = Math.min(sculptedPrincipal[t], opening);
    } else if (inputs.repayment === "balloon") {
      principal = t === n - 1 ? opening : 0;
    } else {
      // equated annuity on opening balance
      const annuity =
        r === 0
          ? openingForEquated / (n - t)
          : (openingForEquated * (r * Math.pow(1 + r, n - t))) /
            (Math.pow(1 + r, n - t) - 1);
      principal = annuity - interest;
      openingForEquated -= principal;
    }
    if (principal < 0) principal = 0;
    if (principal > opening) principal = opening;
    const debtService = interest + principal;
    const closing = opening - principal;
    const dscr = debtService > 0 ? cfads[t] / debtService : cfads[t] > 0 ? Infinity : 0;
    periods.push({
      year: inputs.constructionYears + t + 1,
      revenue: 0, // filled by caller
      ebitda: 0,
      cashTax: 0,
      maintenanceCapex: 0,
      deltaNwc: 0,
      cfads: cfads[t],
      debtOpening: opening,
      interest,
      principal,
      debtService,
      dscr,
      debtClosing: closing,
    });
    opening = closing;
  }

  const finiteDscrs = periods.map((p) => p.dscr).filter((d) => Number.isFinite(d));
  const minDscr = finiteDscrs.length ? Math.min(...finiteDscrs) : 0;
  const totalCfads = periods.reduce((s, p) => s + p.cfads, 0);
  const totalDs = periods.reduce((s, p) => s + p.debtService, 0);
  const avgDscr = totalDs > 0 ? totalCfads / totalDs : 0;
  const repaid = periods[periods.length - 1]?.debtClosing <= 1e-6;
  return { periods, minDscr, avgDscr, repaid };
}

/**
 * Debt sizing optimization: find the maximum debt such that every period's
 * DSCR >= D_min AND the loan is repaid by final maturity (§2.3). Binary search
 * on debt size. For equated/balloon profiles, DSCR is not the constraint, so
 * sizing falls back to debtPct × capex.
 */
function sizeDebt(
  inputs: ProjectFinanceInputs,
  cfads: number[],
): { debt: number; periods: PeriodResult[]; minDscr: number; avgDscr: number; notes: string[] } {
  const notes: string[] = [];
  const capexDebt = inputs.totalCapex * inputs.debtPct;

  if (inputs.repayment !== "sculpted") {
    const sched = buildDebtSchedule(inputs, capexDebt, cfads);
    notes.push(
      `${inputs.repayment} profile - debt sized at debt% × capex (₹${capexDebt.toFixed(0)}); DSCR is informational.`,
    );
    return { debt: capexDebt, periods: sched.periods, minDscr: sched.minDscr, avgDscr: sched.avgDscr, notes };
  }

  // Sculpted: binary-search the largest debt with min DSCR >= target and repaid.
  // Tolerance: sculpted debt service = CFADS/D* makes every non-clamped
  // period's DSCR equal to D* by construction, but floating-point rounding
  // can yield 1.1999999 for a 1.20 target - a strict `>=` would falsely
  // reject valid larger sizes and the search would converge to an
  // underestimated debt. The epsilon keeps the comparison sound; the
  // force-amortized final period still drops well below D* when the loan is
  // over-sized, so the constraint stays meaningful.
  const DSCR_TOL = 1e-6;
  let lo = 0;
  let hi = capexDebt * 1.5; // allow some headroom
  let best = 0;
  let bestSched = buildDebtSchedule(inputs, 0, cfads);
  for (let iter = 0; iter < 80; iter++) {
    const mid = (lo + hi) / 2;
    const sched = buildDebtSchedule(inputs, mid, cfads);
    if (sched.minDscr >= inputs.targetDscr - DSCR_TOL && sched.repaid) {
      best = mid;
      bestSched = sched;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  if (best === 0) {
    // CFADS too thin to sculpt at target DSCR even at the capex-implied debt.
    best = capexDebt;
    bestSched = buildDebtSchedule(inputs, capexDebt, cfads);
    notes.push(
      `Could not sculpt at DSCR ≥ ${inputs.targetDscr}× within tenor - fell back to debt% × capex. Review CFADS/tenor.`,
    );
  } else {
    notes.push(
      `Debt sculpted to max size ₹${best.toFixed(0)} at target DSCR ${inputs.targetDscr}× (min realized ${bestSched.minDscr.toFixed(2)}×).`,
    );
  }
  return { debt: best, periods: bestSched.periods, minDscr: bestSched.minDscr, avgDscr: bestSched.avgDscr, notes };
}

/**
 * LLCR = PV(CFADS over loan life) / Debt outstanding, discounted at Kd (§2.3).
 * Using WACC here would overstate the PV. PLCR extends the numerator over the
 * full project life; for the loan-life portion we still discount at Kd.
 */
function coverageRatios(
  inputs: ProjectFinanceInputs,
  debt: number,
  cfads: number[],
): { llcr: number; plcr: number } {
  const r = inputs.costOfDebt;
  const opYears = cfads.length;
  // Loan life = operating years (single tranche amortizing over op life).
  let pvLoanLife = 0;
  for (let t = 0; t < opYears; t++) {
    pvLoanLife += cfads[t] / Math.pow(1 + r, t + 1);
  }
  const llcr = debt > 0 ? pvLoanLife / debt : 0;
  // PLCR: same numerator (no tail beyond loan life in this single-tranche
  // sketch); PLCR == LLCR here. The full model extends CFADS over the
  // concession tail and discounts the equity-tail at project WACC (§2.3).
  const plcr = llcr;
  return { llcr, plcr };
}

/** IRR via bisection (robust, no analytic derivative needed). */
function irr(cashFlows: number[], lo = -0.9, hi = 5): number | null {
  const npv = (r: number) =>
    cashFlows.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0);
  const nLo = npv(lo);
  const nHi = npv(hi);
  // No sign change across the bracket ⇒ no IRR in (lo, hi). Returning the
  // midpoint here would be a fabricated rate, so return null for both the
  // both-positive (never recovers outflow even at -90% discount) and
  // both-negative (outflows exceed inflows at every rate) cases.
  if (nLo * nHi > 0) return null;
  let r = (lo + hi) / 2;
  for (let i = 0; i < 200; i++) {
    const v = npv(r);
    if (Math.abs(v) < 1e-6) break;
    if (v > 0) lo = r;
    else hi = r;
    r = (lo + hi) / 2;
    if (hi - lo < 1e-10) break;
  }
  return r;
}

export function computeProjectFinance(
  inputs: ProjectFinanceInputs,
): ProjectFinanceResult {
  const cfadsRows = buildCfads(inputs);
  const cfads = cfadsRows.map((r) => r.cfads);

  const { debt, periods, minDscr, avgDscr, notes } = sizeDebt(inputs, cfads);
  const equity = inputs.totalCapex - debt;

  // Merge revenue/ebitda/tax/maint/nwc into the period rows.
  for (let i = 0; i < periods.length; i++) {
    periods[i].revenue = cfadsRows[i].revenue;
    periods[i].ebitda = cfadsRows[i].ebitda;
    periods[i].cashTax = cfadsRows[i].cashTax;
    periods[i].maintenanceCapex = cfadsRows[i].maint;
    periods[i].deltaNwc = cfadsRows[i].dnwc;
  }

  const { llcr, plcr } = coverageRatios(inputs, debt, cfads);
  const dsra =
    periods.length > 0
      ? (periods[0].debtService * inputs.dsraMonths) / 12
      : 0;

  // Project IRR: construction outflow (capex, spread over construction years)
  // then operating CFADS (unlevered). Screening simplification: capex all in
  // year 0; unlevered FCF ≈ CFADS (no interest shield).
  const projectCfs: number[] = [-inputs.totalCapex, ...cfads];
  const projectIrr = irr(projectCfs);

  // Equity IRR: equity outflow year 0, then CFADS - debtService per period.
  const equityCfs: number[] = [-equity];
  for (let i = 0; i < periods.length; i++) {
    equityCfs.push(periods[i].cfads - periods[i].debtService);
  }
  const equityIrr = irr(equityCfs);

  return {
    debtSize: debt,
    equitySize: equity,
    periods,
    minDscr,
    avgDscr,
    llcr,
    plcr,
    projectIrr,
    equityIrr,
    dsra,
    notes,
  };
}
