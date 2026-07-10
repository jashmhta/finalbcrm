// LBO screening model - sources & uses, multi-tranche debt schedule with
// cash sweep, sponsor IRR + MOIC, and an entry×exit multiple sensitivity grid
// (FINANCIAL_MODELING_SPEC §6). A sponsor's first-pass LBO: capitalization,
// annual debt service with mandatory amortization + excess-cash sweep, exit
// at a hold-period multiple, and the returns to the sponsor's equity cheque.
// The full LBO with covenant models, PIK toggles, and monthly sculpting stays
// in Excel alongside (§6.4, §7.2); this gives a decision-speed answer for
// mandate screening and IC pre-read.
//
// Indian conventions: tax rate default 0.2517 (Sec 115BAA), fees as % of EV
// and new debt, debt tranches ordered by seniority (1 = most senior / cheapest
// / first repaid in a sweep). Currency units are absolute (₹).

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface LboTrancheInput {
  name: string;
  /** Principal raised (₹). */
  amount: number;
  /** Annual interest rate (decimal). */
  rate: number;
  /**
   * Mandatory amortization as a fraction of ORIGINAL principal per year
   * (decimal). 0 = bullet / interest-only until exit.
   */
  amortizationPct: number;
}

export interface LboInputs {
  /** Last-twelve-months EBITDA at entry. */
  ltmEbitda: number;
  /** Entry EV / LTM EBITDA multiple. */
  entryEvEbitda: number;
  /** Exit EV / EBITDA multiple (at hold-period end). */
  exitEvEbitda: number;
  /** Holding period in years. */
  holdPeriodYears: number;
  /** Annual EBITDA growth rate (decimal). */
  ebitdaGrowth: number;

  /** Target's existing debt (refinanced as part of the LBO). */
  existingDebt: number;
  /** Target's existing cash (netted into the entry equity bridge). */
  existingCash: number;

  /** Transaction (advisory + legal) fees as % of entry EV (decimal). */
  transactionFeePct: number;
  /** Financing fees as % of total new debt raised (decimal). */
  financingFeePct: number;

  /** Equity rolled over by management (kept invested at exit pro-rata). */
  managementRollover: number;

  /** Marginal tax rate (decimal), default 0.2517. */
  taxRate: number;
  /** Capex as % of EBITDA (decimal). */
  capexPctOfEbitda: number;
  /** ΔNWC as % of the YoY EBITDA change (decimal) - NWC grows with the business. */
  nwcPctOfEbitdaChange: number;
  /** D&A as % of EBITDA (decimal) - drives the EBIT tax shield. */
  daPctOfEbitda: number;
  /**
   * Cash sweep - fraction of FCF after mandatory amort + interest used to
   * prepay debt (decimal). 0 = accumulate cash, 1 = full sweep. Sweep hits
   * the highest-rate tranche first (de-leveraging optimally).
   */
  cashSweepPct: number;

  tranches: LboTrancheInput[];
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface LboTrancheSchedule {
  name: string;
  rate: number;
  originalPrincipal: number;
  /** Year-by-year: opening balance, interest, mandatory amort, sweep, closing. */
  rows: {
    year: number;
    opening: number;
    interest: number;
    mandatoryAmort: number;
    sweep: number;
    principal: number;
    closing: number;
  }[];
  /** Remaining balance at exit (before any final-period sweep). */
  closingBalance: number;
}

export interface LboSourcesAndUses {
  sources: { label: string; amount: number; note?: string }[];
  uses: { label: string; amount: number; note?: string }[];
  totalSources: number;
  totalUses: number;
  /** Sponsor equity cheque - the balancing plug. */
  sponsorEquity: number;
  /** Total new debt raised (Σ tranches). */
  totalNewDebt: number;
  /** Total equity at entry (sponsor + rollover). */
  totalEquity: number;
}

export interface LboPeriodRow {
  year: number;
  ebitda: number;
  da: number;
  ebit: number;
  interest: number;
  ebt: number;
  tax: number;
  netIncome: number;
  capex: number;
  deltaNwc: number;
  /** Cash available for debt service = NI + D&A − capex − ΔNWC. */
  cashAvailable: number;
  /** Total principal repaid this year (mandatory + sweep). */
  totalPrincipal: number;
  /** Cash retained (sweep < 100% of excess) - accumulates on the balance sheet. */
  cashRetained: number;
  closingCash: number;
  /** Total debt outstanding at year end. */
  totalDebt: number;
}

export interface LboSensitivityCell {
  entryMultiple: number;
  exitMultiple: number;
  irr: number | null;
  moic: number;
}

export interface LboResult {
  entryEv: number;
  equityPurchasePrice: number;
  sourcesAndUses: LboSourcesAndUses;
  trancheSchedules: LboTrancheSchedule[];
  periods: LboPeriodRow[];
  /** Exit enterprise value = exit multiple × exit EBITDA. */
  exitEv: number;
  /** Exit EBITDA at hold-period end (grown). */
  exitEbitda: number;
  /** Total debt outstanding at exit. */
  totalDebtAtExit: number;
  /** Cash accumulated at exit. */
  cashAtExit: number;
  /** Net debt at exit = debt − cash. */
  netDebtAtExit: number;
  /** Exit equity value = Exit EV − net debt. */
  exitEquity: number;
  /** Sponsor's share of total entry equity (0..1). */
  sponsorShare: number;
  /** Sponsor exit proceeds = exitEquity × sponsorShare. */
  sponsorExitProceeds: number;
  /** Sponsor cash flows: t0 = −sponsorEquity, t1..n = 0 (clean sweep hold), tn = +proceeds. */
  sponsorCashFlows: number[];
  /** Sponsor IRR (decimal). null if no sign change. */
  irr: number | null;
  /** Money-on-money = sponsorExitProceeds / sponsorEquity. */
  moic: number;
  /** Entry EV/EBITDA × Exit EV/EBITDA sensitivity grid → IRR + MOIC. */
  sensitivity: LboSensitivityCell[][];
  notes: string[];
}

// ---------------------------------------------------------------------------
// IRR via bisection (local copy - keeps lboModel self-contained).
// ---------------------------------------------------------------------------

function irr(cashFlows: number[], lo = -0.9, hi = 5): number | null {
  const npv = (r: number) =>
    cashFlows.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0);
  const nLo = npv(lo);
  const nHi = npv(hi);
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

// ---------------------------------------------------------------------------
// Core: build the full LBO for a given (entry multiple, exit multiple) pair.
// Isolated so the sensitivity grid can re-run it cheaply.
// ---------------------------------------------------------------------------

function buildLbo(
  inputs: LboInputs,
  entryMultiple: number,
  exitMultiple: number,
): Omit<LboResult, "sensitivity" | "notes"> {
  const n = Math.max(1, Math.round(inputs.holdPeriodYears));
  const tau = inputs.taxRate;

  // ---- Entry: EV, equity bridge, sources & uses ----------------------------
  const entryEv = entryMultiple * inputs.ltmEbitda;
  const targetNetDebt = Math.max(inputs.existingDebt - inputs.existingCash, 0);
  const equityPurchasePrice = entryEv - targetNetDebt; // sponsor pays for equity

  const totalNewDebt = inputs.tranches.reduce((s, t) => s + t.amount, 0);
  const transactionFees = inputs.transactionFeePct * entryEv;
  const financingFees = inputs.financingFeePct * totalNewDebt;
  const totalFees = transactionFees + financingFees;

  // Uses = Equity purchase price + fees (existing debt is refinanced inside
  // the EV purchase - the sponsor buys the enterprise clean).
  const totalUses = equityPurchasePrice + totalFees;
  const sponsorEquity = Math.max(
    totalUses - totalNewDebt - inputs.managementRollover,
    0,
  );
  const totalEquity = sponsorEquity + inputs.managementRollover;
  const totalSources = totalNewDebt + totalEquity;

  // ---- Debt schedule ------------------------------------------------------
  // Each tranche tracks its running balance. Mandatory amort = amortizationPct
  // × ORIGINAL principal per year. Cash sweep targets the highest-rate
  // tranche with remaining balance first (optimal de-leveraging).
  const trancheState = inputs.tranches
    .slice()
    .map((t) => ({
      name: t.name,
      rate: t.rate,
      original: t.amount,
      amortizationPct: t.amortizationPct,
      balance: t.amount,
    }))
    // sweep order: highest rate first (most expensive debt retired first)
    .sort((a, b) => b.rate - a.rate);

  const trancheSchedules: LboTrancheSchedule[] = inputs.tranches.map((t) => ({
    name: t.name,
    rate: t.rate,
    originalPrincipal: t.amount,
    rows: [],
    closingBalance: t.amount,
  }));
  // Map name → schedule index for filling.
  const schedIndex = new Map(trancheSchedules.map((s, i) => [s.name, i]));

  let runningCash = 0;
  let prevEbitda = inputs.ltmEbitda;
  const periods: LboPeriodRow[] = [];

  for (let y = 1; y <= n; y++) {
    const ebitda = prevEbitda * (1 + inputs.ebitdaGrowth);
    const da = ebitda * inputs.daPctOfEbitda;
    const ebit = ebitda - da;

    // Interest on opening balances.
    let interest = 0;
    for (const tr of trancheState) interest += tr.balance * tr.rate;
    const ebt = ebit - interest;
    const tax = ebt > 0 ? ebt * tau : 0;
    const netIncome = ebt - tax;

    const capex = ebitda * inputs.capexPctOfEbitda;
    const deltaNwc = (ebitda - prevEbitda) * inputs.nwcPctOfEbitdaChange;
    const cashAvailable = netIncome + da - capex - deltaNwc;

    // Mandatory amortization per tranche (on original principal).
    let mandatoryAmortTotal = 0;
    const mandatoryByTranche = trancheState.map((tr) => {
      const m = Math.min(tr.amortizationPct * tr.original, tr.balance);
      mandatoryAmortTotal += m;
      return m;
    });

    // Excess cash available for sweep = cashAvailable − mandatory amort.
    // (Interest already deducted inside cashAvailable.)
    const excessForSweep = Math.max(cashAvailable - mandatoryAmortTotal, 0);
    const sweepBudget = excessForSweep * inputs.cashSweepPct;

    // Apply mandatory amort + sweep. Sweep hits highest-rate tranche first.
    const sweepByTranche = new Array(trancheState.length).fill(0);
    let remainingSweep = sweepBudget;
    for (let i = 0; i < trancheState.length && remainingSweep > 0; i++) {
      const tr = trancheState[i];
      const afterMandatory = tr.balance - mandatoryByTranche[i];
      const applied = Math.min(afterMandatory, remainingSweep);
      sweepByTranche[i] = applied;
      remainingSweep -= applied;
    }

    // Apply & record per-tranche.
    for (let i = 0; i < trancheState.length; i++) {
      const tr = trancheState[i];
      const mandatory = mandatoryByTranche[i];
      const sweep = sweepByTranche[i];
      const principal = mandatory + sweep;
      const opening = tr.balance;
      const closing = opening - principal;
      tr.balance = closing;
      const idx = schedIndex.get(tr.name);
      if (idx != null) {
        trancheSchedules[idx].rows.push({
          year: y,
          opening,
          interest: opening * tr.rate,
          mandatoryAmort: mandatory,
          sweep,
          principal,
          closing,
        });
      }
    }

    // Cash retained = cashAvailable − mandatory − sweep (the un-swept excess).
    const totalPrincipal = mandatoryAmortTotal + sweepByTranche.reduce((s, x) => s + x, 0);
    const cashRetained = cashAvailable - totalPrincipal;
    runningCash += Math.max(cashRetained, 0);

    const totalDebt = trancheState.reduce((s, tr) => s + tr.balance, 0);
    periods.push({
      year: y,
      ebitda,
      da,
      ebit,
      interest,
      ebt,
      tax,
      netIncome,
      capex,
      deltaNwc,
      cashAvailable,
      totalPrincipal,
      cashRetained: Math.max(cashRetained, 0),
      closingCash: runningCash,
      totalDebt,
    });

    prevEbitda = ebitda;
  }

  // Record closing balances.
  for (let i = 0; i < trancheState.length; i++) {
    const idx = schedIndex.get(trancheState[i].name);
    if (idx != null) trancheSchedules[idx].closingBalance = trancheState[i].balance;
  }

  // ---- Exit ----------------------------------------------------------------
  const exitEbitda = prevEbitda; // EBITDA at year n (grown)
  const exitEv = exitMultiple * exitEbitda;
  const totalDebtAtExit = trancheState.reduce((s, tr) => s + tr.balance, 0);
  const cashAtExit = runningCash;
  const netDebtAtExit = Math.max(totalDebtAtExit - cashAtExit, 0);
  const exitEquity = exitEv - netDebtAtExit;

  const sponsorShare =
    totalEquity > 0 ? sponsorEquity / totalEquity : 0;
  const sponsorExitProceeds = exitEquity * sponsorShare;

  // Sponsor cash flows: clean hold-to-exit (excess cash swept to debt, no
  // interim dividends). t0 outflow, tn inflow.
  const sponsorCashFlows = new Array(n + 1).fill(0);
  sponsorCashFlows[0] = -sponsorEquity;
  sponsorCashFlows[n] = sponsorExitProceeds;

  const computedIrr = irr(sponsorCashFlows);
  const moic = sponsorEquity > 0 ? sponsorExitProceeds / sponsorEquity : 0;

  return {
    entryEv,
    equityPurchasePrice,
    sourcesAndUses: {
      sources: [
        ...inputs.tranches.map((t) => ({
          label: t.name,
          amount: t.amount,
          note: `${(t.rate * 100).toFixed(2)}%`,
        })),
        { label: "Management rollover", amount: inputs.managementRollover, note: "Rolled equity" },
        { label: "Sponsor equity", amount: sponsorEquity, note: "Balancing plug" },
      ],
      uses: [
        { label: "Equity purchase price", amount: equityPurchasePrice, note: "EV − target net debt" },
        { label: "Transaction fees", amount: transactionFees, note: `${(inputs.transactionFeePct * 100).toFixed(2)}% of EV` },
        { label: "Financing fees", amount: financingFees, note: `${(inputs.financingFeePct * 100).toFixed(2)}% of new debt` },
      ],
      totalSources,
      totalUses,
      sponsorEquity,
      totalNewDebt,
      totalEquity,
    },
    trancheSchedules,
    periods,
    exitEv,
    exitEbitda,
    totalDebtAtExit,
    cashAtExit,
    netDebtAtExit,
    exitEquity,
    sponsorShare,
    sponsorExitProceeds,
    sponsorCashFlows,
    irr: computedIrr,
    moic,
  };
}

// ---------------------------------------------------------------------------
// Sensitivity grid - entry multiple (rows) × exit multiple (cols) → IRR + MOIC.
// Re-runs the LBO for every cell; cheap because the model is O(tranches×years).
// ---------------------------------------------------------------------------

function buildSensitivity(
  inputs: LboInputs,
  entrySteps: number[],
  exitSteps: number[],
): LboSensitivityCell[][] {
  return entrySteps.map((entryMultiple) =>
    exitSteps.map((exitMultiple) => {
      const r = buildLbo(inputs, entryMultiple, exitMultiple);
      return { entryMultiple, exitMultiple, irr: r.irr, moic: r.moic };
    }),
  );
}

// ---------------------------------------------------------------------------
// Top-level compute
// ---------------------------------------------------------------------------

export function computeLbo(inputs: LboInputs): LboResult {
  const notes: string[] = [];
  const base = buildLbo(inputs, inputs.entryEvEbitda, inputs.exitEvEbitda);

  if (base.sourcesAndUses.sponsorEquity <= 0) {
    notes.push(
      "Sponsor equity plug is zero/negative - debt + rollover over-fund the deal. Reduce leverage or check EV.",
    );
  }
  if (base.irr == null) {
    notes.push("Sponsor IRR did not converge - exit proceeds do not recover the entry equity at any rate. Raise exit multiple or EBITDA growth.");
  }
  // Debt / EBITDA leverage at entry (an IC staple).
  const leverage =
    inputs.ltmEbitda > 0
      ? base.sourcesAndUses.totalNewDebt / inputs.ltmEbitda
      : 0;
  notes.push(
    `Entry leverage ${leverage.toFixed(2)}× total debt / LTM EBITDA; sponsor equity ₹${(base.sourcesAndUses.sponsorEquity / 10_000_000).toFixed(2)} Cr (${(base.sponsorShare * 100).toFixed(1)}% of equity).`,
  );

  // Sensitivity: ±20% around entry & exit multiples in 4 steps each (9-cell grid).
  const entrySteps = stepsAround(inputs.entryEvEbitda, 4, 0.2);
  const exitSteps = stepsAround(inputs.exitEvEbitda, 4, 0.2);
  const sensitivity = buildSensitivity(inputs, entrySteps, exitSteps);

  return { ...base, sensitivity, notes };
}

/** Linear ±pct% steps around a center, n steps per side (2n+1 points total). */
function stepsAround(center: number, n: number, pct: number): number[] {
  const out: number[] = [];
  for (let i = -n; i <= n; i++) {
    out.push(Number((center * (1 + (pct * i) / n)).toFixed(2)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Default inputs - a realistic Indian mid-market LBO for first paint.
// ---------------------------------------------------------------------------

export function lboDefaults(): LboInputs {
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
      { name: "Senior secured (Term Loan A)", amount: 600_000_000, rate: 0.095, amortizationPct: 0.10 },
      { name: "Senior secured (Term Loan B)", amount: 400_000_000, rate: 0.105, amortizationPct: 0.05 },
      { name: "Subordinated / mezzanine", amount: 250_000_000, rate: 0.135, amortizationPct: 0.0 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers (UI-shared, server-safe).
// ---------------------------------------------------------------------------

export function cr(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return "-";
  const sign = x < 0 ? "−" : "";
  return `${sign}₹${Math.abs(x / 10_000_000).toFixed(digits)} Cr`;
}

export function inrAbs(x: number, digits = 0): string {
  if (!Number.isFinite(x)) return "-";
  const sign = x < 0 ? "−" : "";
  return `${sign}₹${Math.abs(x).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function pctFmt(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return "-";
  return `${(x * 100).toFixed(digits)}%`;
}

export function multipleFmt(x: number, digits = 1): string {
  if (!Number.isFinite(x)) return "-";
  return `${x.toFixed(digits)}×`;
}
