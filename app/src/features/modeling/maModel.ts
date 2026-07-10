// M&A screening model - accretion/dilution + goodwill + acquirer deal IRR
// (FINANCIAL_MODELING_SPEC §5). A banker's first-pass M&A model: Sources &
// Uses, purchase-price allocation to goodwill (IFRS 3 / Ind AS 103 acquisition
// method), pro-forma EPS accretion/dilution, and the acquirer's IRR on the
// total capital deployed. The full merger model with purchase accounting
// schedules, stepping synergies, and standalone vs. pro-forma balance-sheet
// stays in Excel alongside (§5.4, §7.2); this gives a decision-speed answer
// for mandate screening and IC pre-read.
//
// All currency units are absolute (₹). Indian conventions: tax rate default
// 0.2517 (Sec 115BAA corporate), fees as % of consideration, synergies
// after-tax at the acquirer's marginal rate.

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface MaAcquirerInputs {
  /** LTM revenue (screening; informational). */
  revenue: number;
  /** EBITDA margin (decimal) - informational for the headline. */
  ebitdaMargin: number;
  /** LTM net income (after-tax, attributable to common). */
  netIncome: number;
  /** Diluted shares outstanding (pre-deal). */
  sharesOutstanding: number;
  /** Acquirer share price (for stock-issuance pricing + standalone market cap). */
  sharePrice: number;
  /** Existing gross debt (informational; not part of deal funding). */
  existingDebt: number;
  /** Cash on hand (the funding plug is capped against this). */
  cash: number;
  /** Marginal tax rate (decimal), default 0.2517. */
  taxRate: number;
}

export interface MaTargetInputs {
  revenue: number;
  /** LTM EBITDA (drives exit value). */
  ebitda: number;
  /** LTM net income (for pro-forma combined NI). */
  netIncome: number;
  /**
   * Annual free cash flow to equity (FCFE) the target generates - post
   * interest, post tax, post capex & NWC. Used as the deal IRR's inflow.
   */
  freeCashFlow: number;
  /** Target's existing gross debt (refinanced or assumed per deal flag). */
  existingDebt: number;
  /** Target's cash (captured by the acquirer if `targetCashAcquired`). */
  cash: number;
  /**
   * Fair value of the target's identifiable net assets at acquisition
   * (FV assets − FV liabilities, EXCLUDING goodwill). Per IFRS 3 / Ind AS 103
   * the acquirer remeasures these to fair value; goodwill is the residual.
   */
  identifiableNetAssetsFairValue: number;
}

export type MaConsideration = "cash" | "stock" | "mixed";

export interface MaDealInputs {
  /** Equity purchase price paid to the target's shareholders (consideration). */
  equityPurchasePrice: number;
  /** Refinance & retire the target's existing debt at close (LBO-style clean-up). */
  refinanceTargetDebt: boolean;
  /** Use the target's cash as a funding source (captured at close). */
  targetCashAcquired: boolean;

  /** Advisory / legal / advisory fees as % of equity purchase price (decimal). */
  advisoryFeePct: number;
  /** Financing fees as % of new debt raised (decimal). */
  financingFeePct: number;
  /** One-time integration / restructuring cost, year 0. */
  integrationCost: number;

  // Financing (Sources) ------------------------------------------------------
  /** New debt raised to fund the purchase (cash & mixed deals). */
  newDebt: number;
  /** Annual pre-tax cost of the new debt (decimal). */
  newDebtCost: number;
  /** Equity portion funded by issuing acquirer stock at `sharePrice` (stock & mixed). */
  stockConsideration: number;

  // Synergies ----------------------------------------------------------------
  /** Annual run-rate cost synergies (EBITDA-positive) once fully phased in. */
  runRateSynergies: number;
  /** Years to reach full run-rate (linear ramp). */
  synergyPhaseInYears: number;
  /** Realization haircut on run-rate (decimal) - the banker's conservatism. */
  synergyRealizationPct: number;

  // Acquirer returns ---------------------------------------------------------
  /** Holding period (years) for the deal IRR. */
  holdPeriodYears: number;
  /** Exit EV/EBITDA multiple applied to the target's exit EBITDA (with synergies). */
  exitEvEbitda: number;
}

export interface MaInputs {
  acquirer: MaAcquirerInputs;
  target: MaTargetInputs;
  deal: MaDealInputs;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface MaSourceItem {
  label: string;
  amount: number;
  note?: string;
}
export interface MaUseItem {
  label: string;
  amount: number;
  note?: string;
}

export interface MaSourcesAndUses {
  sources: MaSourceItem[];
  uses: MaUseItem[];
  totalSources: number;
  totalUses: number;
  /** Balancing item - acquirer cash deployed (the plug). Negative = surplus. */
  acquirerCashUsed: number;
  /** True when the plug exceeds the acquirer's available cash. */
  fundingShortfall: boolean;
}

export interface MaGoodwill {
  /** Consideration transferred (equity purchase price). */
  considerationTransferred: number;
  /** Non-controlling interest (0 for a 100% acquisition). */
  nonControllingInterest: number;
  /** Acquiree's identifiable net assets at fair value. */
  identifiableNetAssetsFairValue: number;
  /** Goodwill = consideration + NCI − identifiable net assets. */
  goodwill: number;
  /** True (negative goodwill) → bargain-purchase gain per IFRS 3. */
  bargainPurchase: boolean;
}

export interface MaAccretionDilution {
  standaloneEps: number;
  newSharesIssued: number;
  proFormaShares: number;
  /** Acquirer LTM NI + target LTM NI − after-tax incremental interest + after-tax synergies. */
  proFormaNetIncome: number;
  proFormaEps: number;
  /** (Pro-forma EPS / Standalone EPS) − 1. > 0 accretive, < 0 dilutive. */
  accretionPct: number;
  /** "$ of EPS impact" = pro-forma EPS − standalone EPS. */
  epsDelta: number;
  accretive: boolean;
  /** After-tax incremental interest expense on new debt. */
  afterTaxInterest: number;
  /** After-tax run-rate synergies (full phase-in, × realization). */
  afterTaxSynergies: number;
}

export interface MaDealIrr {
  /** Total capital deployed at close (year-0 outflow). */
  totalDeployed: number;
  /** Period-by-period cash flow to the deal (outflow t0, FCF+synergy t1..n, exit at n). */
  cashFlows: { year: number; fcf: number; synergyCash: number; exitEquity: number; total: number }[];
  /** Acquirer IRR on the total capital deployed (decimal). null if no sign change. */
  irr: number | null;
  /** Exit enterprise value at the hold-period end. */
  exitEv: number;
  /** Exit equity value = Exit EV − target net debt at exit (0 if refinanced). */
  exitEquity: number;
  /** Target EBITDA at exit (grown) + fully-phased synergies × realization. */
  exitEbitda: number;
}

export interface MaResult {
  sourcesAndUses: MaSourcesAndUses;
  goodwill: MaGoodwill;
  accretionDilution: MaAccretionDilution;
  dealIrr: MaDealIrr;
  /** Combined company market cap (informational, at acquirer price). */
  combinedMarketCap: number;
  /** Implied transaction enterprise value (equity price + target net debt). */
  impliedEv: number;
  notes: string[];
}

// ---------------------------------------------------------------------------
// IRR via bisection - robust, no analytic derivative. Reused shape from
// projectFinance.ts but local to keep maModel self-contained.
// ---------------------------------------------------------------------------

function irr(cashFlows: number[], lo = -0.9, hi = 5): number | null {
  const npv = (r: number) =>
    cashFlows.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0);
  const nLo = npv(lo);
  const nHi = npv(hi);
  if (nLo * nHi > 0) return null; // no sign change ⇒ no IRR in bracket
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
// Sources & Uses
// ---------------------------------------------------------------------------

export function computeSourcesAndUses(inputs: MaInputs): MaSourcesAndUses {
  const { acquirer, target, deal } = inputs;

  const advisoryFees = deal.advisoryFeePct * deal.equityPurchasePrice;
  const financingFees = deal.financingFeePct * deal.newDebt;
  const refinance = deal.refinanceTargetDebt ? target.existingDebt : 0;

  // Uses - everything the acquirer pays at close.
  const uses: MaUseItem[] = [
    { label: "Equity purchase price", amount: deal.equityPurchasePrice, note: "Consideration to target shareholders" },
  ];
  if (deal.refinanceTargetDebt) {
    uses.push({ label: "Refinance target debt", amount: refinance, note: "Retire existing debt at close" });
  }
  uses.push(
    { label: "Advisory & legal fees", amount: advisoryFees, note: `${(deal.advisoryFeePct * 100).toFixed(2)}% of consideration` },
    { label: "Financing fees", amount: financingFees, note: `${(deal.financingFeePct * 100).toFixed(2)}% of new debt` },
    { label: "Integration cost", amount: deal.integrationCost, note: "One-time, year 0" },
  );
  const totalUses = uses.reduce((s, u) => s + u.amount, 0);

  // Sources - how the acquirer funds the uses. The acquirer cash line is the
  // plug that balances Sources to Uses; a shortfall fires when it exceeds the
  // acquirer's cash on hand (the banker then raises more debt / equity).
  const targetCash = deal.targetCashAcquired ? target.cash : 0;
  const nonPlugSources =
    deal.newDebt + deal.stockConsideration + targetCash;
  const acquirerCashUsed = totalUses - nonPlugSources;

  const sources: MaSourceItem[] = [];
  if (deal.newDebt > 0) {
    sources.push({ label: "New debt", amount: deal.newDebt, note: `Cost ${(deal.newDebtCost * 100).toFixed(2)}%` });
  }
  if (deal.stockConsideration > 0) {
    sources.push({ label: "Stock issuance", amount: deal.stockConsideration, note: `${(acquirer.sharePrice > 0 ? deal.stockConsideration / acquirer.sharePrice : 0).toFixed(0)} shares` });
  }
  if (targetCash > 0) {
    sources.push({ label: "Target cash acquired", amount: targetCash, note: "Captured at close" });
  }
  sources.push({
    label: "Acquirer cash on hand",
    amount: acquirerCashUsed,
    note: acquirerCashUsed < 0 ? "Surplus (net inflow)" : "Balancing plug",
  });
  const totalSources = sources.reduce((s, x) => s + x.amount, 0);

  return {
    sources,
    uses,
    totalSources,
    totalUses,
    acquirerCashUsed,
    fundingShortfall: acquirerCashUsed > acquirer.cash,
  };
}

// ---------------------------------------------------------------------------
// Goodwill - IFRS 3 / Ind AS 103 acquisition method
//   Goodwill = Consideration transferred + NCI − Identifiable net assets @FV
// A 100% acquisition ⇒ NCI = 0. Negative goodwill ⇒ bargain-purchase gain
// (recognized in P&L, not an asset).
// ---------------------------------------------------------------------------

export function computeGoodwill(inputs: MaInputs): MaGoodwill {
  const { target, deal } = inputs;
  const consideration = deal.equityPurchasePrice;
  const nci = 0; // 100% acquisition assumed
  const netAssets = target.identifiableNetAssetsFairValue;
  const goodwill = consideration + nci - netAssets;
  return {
    considerationTransferred: consideration,
    nonControllingInterest: nci,
    identifiableNetAssetsFairValue: netAssets,
    goodwill,
    bargainPurchase: goodwill < 0,
  };
}

// ---------------------------------------------------------------------------
// Accretion / Dilution
//   Standalone EPS = Acquirer NI / Acquirer shares
//   New shares = Stock consideration / Acquirer share price
//   Pro-forma NI = Acquirer NI + Target NI − After-tax incremental interest
//                  + After-tax run-rate synergies (× realization)
//   Pro-forma EPS = Pro-forma NI / (Acquirer shares + new shares)
//   Accretion = Pro-forma EPS / Standalone EPS − 1
// Note: pro-forma NI uses full run-rate synergies (steady-state, post
// phase-in) - the standard IC "run-rate accretion" view. A year-1 (partial
// synergies) figure is surfaced in `notes`.
// ---------------------------------------------------------------------------

export function computeAccretionDilution(inputs: MaInputs): MaAccretionDilution {
  const { acquirer, target, deal } = inputs;
  const standaloneEps =
    acquirer.sharesOutstanding > 0 ? acquirer.netIncome / acquirer.sharesOutstanding : 0;

  const newSharesIssued =
    acquirer.sharePrice > 0 ? deal.stockConsideration / acquirer.sharePrice : 0;
  const proFormaShares = acquirer.sharesOutstanding + newSharesIssued;

  const incrementalInterest = deal.newDebt * deal.newDebtCost;
  const afterTaxInterest = incrementalInterest * (1 - acquirer.taxRate);
  const afterTaxSynergies =
    deal.runRateSynergies * deal.synergyRealizationPct * (1 - acquirer.taxRate);

  const proFormaNetIncome =
    acquirer.netIncome + target.netIncome - afterTaxInterest + afterTaxSynergies;
  const proFormaEps = proFormaShares > 0 ? proFormaNetIncome / proFormaShares : 0;

  const epsDelta = proFormaEps - standaloneEps;
  const accretionPct =
    standaloneEps > 0 ? proFormaEps / standaloneEps - 1 : 0;

  return {
    standaloneEps,
    newSharesIssued,
    proFormaShares,
    proFormaNetIncome,
    proFormaEps,
    accretionPct,
    epsDelta,
    accretive: accretionPct > 0,
    afterTaxInterest,
    afterTaxSynergies,
  };
}

// ---------------------------------------------------------------------------
// Acquirer deal IRR - return on the TOTAL capital deployed into the
// acquisition (the "deal IRR"). Cash flows:
//   t=0  : −(Equity purchase price + refinance + advisory + financing fees
//           + integration cost)  [total deployed]
//   t1..n: Target FCFE + after-tax synergy cash (ramped)
//   t=n  : + Exit equity = Exit EV × exit multiple on exit EBITDA − target
//           net debt at exit (0 if debt refinanced at close).
// Synergies ramp linearly over `synergyPhaseInYears`; the steady-state
// (full run-rate × realization) flows into BOTH the periodic cash and the
// exit EBITDA. The new debt the acquirer raised to fund the purchase is NOT
// netted here - it is the acquirer's own financing, separate from the deal
// asset's cash flows (this is the unlevered-on-acquisition-debt deal return,
// the standard "what does the deal itself return" view).
// ---------------------------------------------------------------------------

export function computeDealIrr(inputs: MaInputs): MaDealIrr {
  const { acquirer, target, deal } = inputs;
  const n = Math.max(1, Math.round(deal.holdPeriodYears));

  const advisoryFees = deal.advisoryFeePct * deal.equityPurchasePrice;
  const financingFees = deal.financingFeePct * deal.newDebt;
  const refinance = deal.refinanceTargetDebt ? target.existingDebt : 0;
  const totalDeployed =
    deal.equityPurchasePrice + refinance + advisoryFees + financingFees + deal.integrationCost;

  // Ramp fraction per year (linear): year t (1-indexed) → min(t/phaseIn, 1).
  const rampedSynergy = (t: number) => {
    const frac =
      deal.synergyPhaseInYears > 0
        ? Math.min(t / deal.synergyPhaseInYears, 1)
        : 1;
    return deal.runRateSynergies * frac * deal.synergyRealizationPct;
  };
  const synergyCashAfterTax = (t: number) =>
    rampedSynergy(t) * (1 - acquirer.taxRate);

  // Exit: target EBITDA grown (we assume the user-supplied FCFE + synergies
  // capture the forward profile; exit EBITDA uses the steady-state synergy
  // run-rate). Exit equity nets out target net debt unless refinanced.
  const fullSynergyEbitda = deal.runRateSynergies * deal.synergyRealizationPct;
  const exitEbitda = target.ebitda + fullSynergyEbitda;
  const exitEv = deal.exitEvEbitda * exitEbitda;
  const targetNetDebtAtExit = deal.refinanceTargetDebt
    ? 0 // retired at close
    : Math.max(target.existingDebt - target.cash, 0);
  const exitEquity = exitEv - targetNetDebtAtExit;

  const rows: MaDealIrr["cashFlows"] = [];
  const cf: number[] = [-totalDeployed];
  for (let t = 1; t <= n; t++) {
    const fcf = target.freeCashFlow;
    const synCash = synergyCashAfterTax(t);
    const exit = t === n ? exitEquity : 0;
    const total = fcf + synCash + exit;
    rows.push({ year: t, fcf, synergyCash: synCash, exitEquity: exit, total });
    cf.push(total);
  }

  return {
    totalDeployed,
    cashFlows: rows,
    irr: irr(cf),
    exitEv,
    exitEquity,
    exitEbitda,
  };
}

// ---------------------------------------------------------------------------
// Top-level compute
// ---------------------------------------------------------------------------

export function computeMaModel(inputs: MaInputs): MaResult {
  const notes: string[] = [];
  const { acquirer, target, deal } = inputs;

  const sourcesAndUses = computeSourcesAndUses(inputs);
  if (sourcesAndUses.fundingShortfall) {
    notes.push(
      `Funding shortfall - acquirer cash plug (₹${sourcesAndUses.acquirerCashUsed.toFixed(0)}) exceeds cash on hand (₹${acquirer.cash.toFixed(0)}). Raise more debt/equity or cut price.`,
    );
  }

  const goodwill = computeGoodwill(inputs);
  if (goodwill.bargainPurchase) {
    notes.push(
      `Negative goodwill (₹${(-goodwill.goodwill).toFixed(0)}) - bargain purchase gain recognized in P&L per IFRS 3 / Ind AS 103.`,
    );
  }

  const accretionDilution = computeAccretionDilution(inputs);
  // Year-1 (partial synergy) EPS - the "transaction-day" accretion banks
  // also quote. With zero synergies year-1, the deal must stand on its own.
  const year1SynAfterTax =
    (deal.runRateSynergies *
      (deal.synergyPhaseInYears > 0 ? 1 / deal.synergyPhaseInYears : 1) *
      deal.synergyRealizationPct) *
    (1 - acquirer.taxRate);
  const year1Ni =
    acquirer.netIncome + target.netIncome - accretionDilution.afterTaxInterest + year1SynAfterTax;
  const year1Eps = accretionDilution.proFormaShares > 0 ? year1Ni / accretionDilution.proFormaShares : 0;
  const year1Accretion =
    accretionDilution.standaloneEps > 0 ? year1Eps / accretionDilution.standaloneEps - 1 : 0;
  notes.push(
    `Year-1 (partial-synergy) EPS ₹${year1Eps.toFixed(2)} → ${(year1Accretion * 100).toFixed(2)}% accretion; run-rate (steady-state) shown in the headline.`,
  );

  const dealIrr = computeDealIrr(inputs);
  if (dealIrr.irr == null) {
    notes.push("Deal IRR did not converge - total deployed exceeds all inflows at every rate. Review target FCF / exit multiple.");
  }

  const impliedEv =
    deal.equityPurchasePrice + Math.max(target.existingDebt - target.cash, 0);
  const combinedMarketCap =
    (acquirer.sharesOutstanding + accretionDilution.newSharesIssued) * acquirer.sharePrice;

  return {
    sourcesAndUses,
    goodwill,
    accretionDilution,
    dealIrr,
    combinedMarketCap,
    impliedEv,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Default inputs - a realistic Indian cash-deal example for first paint.
// Acquirer ~ a mid-cap NBFC / infra firm; target a complementary business.
// ---------------------------------------------------------------------------

export function maDefaults(): MaInputs {
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

export function epsFmt(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return "-";
  return `₹${x.toFixed(digits)}`;
}
