// Ratio engine - computes the Binary Capital ratio library (CREDIT_ANALYSIS_SPEC §3)
// from a single financial_statement period, with optional prior-period statement for
// averaging (ROE / ROA / ROCE / debtor / creditor / inventory days).
//
// Line items are read from financial_statement.line_items (jsonb) keyed by a canonical
// `crisil_lineitem_code`-style code set defined below. Values may be stored as numbers
// or numeric strings; `li()` coerces to a finite number or returns null.
//
// Formula conventions (spec §3.1):
//   EBIT   = PBT + Interest (gross), unless provided directly.
//   EBITDA = EBIT + Depreciation & Amortization, unless provided directly.
//   FFO    = CFO before working-capital changes (= PAT + D&A + deferred tax + other
//            non-cash). Spec treats CFO as *before interest paid* (analyst adjustment).
//   FCF    = CFO - CapEx (dividends excluded - financing decision, not operating).
//   CapEx  = purchase of fixed assets (incl. capitalized CWIP).
//
// Every ratio returns number | null (null = inputs missing). Ratios whose code is in
// `financialRatioEnum` are persistable to ratio_result; the rest (cash_ratio,
// net_debt_ebitda, ffo_debt, fcf_debt, asset_turnover, cost_to_income) are computed
// for scorecard/UI use but are NOT persisted because the enum has no code for them
// (see report - recommended schema extension).

import type { FinancialStatement } from "@/db/schema";

// ---------------------------------------------------------------------------
// Canonical line-item codes (keys into financial_statement.line_items).
// ---------------------------------------------------------------------------

export type LineItemCode =
  // P&L
  | "revenue"
  | "cogs" // cost of goods sold / purchases
  | "ebit" // operating profit / PBIT (PBT + interest)
  | "depreciation_amortization"
  | "ebitda" // optional direct input; else derived
  | "interest_expense"
  | "pbt" // profit before tax
  | "tax"
  | "pat" // profit after tax
  // Balance sheet - debt & cash
  | "total_debt"
  | "long_term_debt"
  | "short_term_debt"
  | "cash_and_equivalents"
  | "marketable_securities"
  // Balance sheet - working capital
  | "current_assets"
  | "current_liabilities"
  | "inventory"
  | "trade_receivables"
  | "trade_payables"
  // Balance sheet - capital
  | "total_assets"
  | "net_worth" // book equity
  | "tangible_net_worth" // adjusted (net of intangibles, revalued assets, deferred tax)
  | "capital_employed" // equity + debt - cash (optional; else derived)
  // Cash flow
  | "cfo" // cash from operations (before interest paid - analyst adjustment)
  | "cfo_before_wc_changes" // FFO base = PAT + D&A + deferred tax + other non-cash
  | "capex" // purchase of fixed assets (incl. capitalized CWIP)
  | "dividends_paid"
  | "cfads" // cash flow available for debt service (project / SPV)
  | "debt_service" // principal + interest (project / SPV)
  // Working-capital limit utilization (fraction 0-1)
  | "wc_limit_utilization_pct"
  // NBFC / HFC passthrough metrics (already-computed ratios supplied by analyst)
  | "gnpa_pct"
  | "nnpa_pct"
  | "nim"
  | "crar"
  | "tier1_ratio"
  | "cost_to_income"
  // Prior-period closing values for averaging (only used on the "current" statement
  // when a separate prior statement is not supplied). Optional.
  | "prev_net_worth"
  | "prev_total_assets"
  | "prev_capital_employed"
  | "prev_trade_receivables"
  | "prev_trade_payables"
  | "prev_inventory";

/** Map of line-item code → numeric value, read off the jsonb column. */
type LineItemMap = Partial<Record<LineItemCode, number>>;

/** Coerce a jsonb value (number | string | null) to a finite number or null. */
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Read a financial_statement's line_items jsonb as a typed numeric map. */
export function readLineItems(stmt: Pick<FinancialStatement, "lineItems">): LineItemMap {
  const raw = (stmt.lineItems ?? {}) as Record<string, unknown>;
  const out: LineItemMap = {};
  for (const k of Object.keys(raw)) {
    const n = toNum(raw[k]);
    if (n !== null) (out as Record<string, number>)[k] = n;
  }
  return out;
}

function avg(closing: number | null, opening: number | null): number | null {
  if (closing === null) return null;
  if (opening === null) return closing; // single-period fallback: use closing
  return (closing + opening) / 2;
}

function safeDiv(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return a / b;
}

// ---------------------------------------------------------------------------
// Ratio set - the full spec §3 library, keyed by stable code.
// Persistable codes (members of financialRatioEnum) are flagged in
// `PERSISTABLE_RATIO_CODES`.
// ---------------------------------------------------------------------------

export interface RatioSet {
  // Leverage
  debt_equity: number | null; // book D/E = total debt / book equity
  debt_to_tangible_nw: number | null; // adjusted D/E = total debt / tangible net worth
  debt_ebitda: number | null;
  net_debt_ebitda: number | null; // extra (no enum code)
  // Coverage
  interest_coverage: number | null; // EBIT / interest
  dscr: number | null; // CFADS / debt service (project / SPV)
  // Liquidity
  current_ratio: number | null;
  quick_ratio: number | null;
  cash_ratio: number | null; // extra (no enum code)
  // Profitability
  ebitda_margin: number | null;
  pat_margin: number | null;
  operating_margin: number | null; // EBIT / revenue
  roe: number | null;
  roa: number | null;
  roce: number | null;
  // Activity
  debtor_days: number | null;
  creditor_days: number | null;
  inventory_days: number | null;
  working_capital_days: number | null;
  asset_turnover: number | null; // extra (no enum code)
  // Bond-specific (cash-flow leverage)
  ffo: number | null; // FFO absolute (= cfo_before_wc_changes)
  fcfo: number | null; // persisted code: fcfo (funds from operations)
  ffo_debt: number | null; // FFO / total debt (extra, no enum code)
  fcf_debt: number | null; // (CFO - CapEx) / total debt (extra, no enum code)
  cfads: number | null; // absolute CFADS (persisted code: cfads)
  // NBFC passthrough
  gnpa_pct: number | null;
  nnpa_pct: number | null;
  nim: number | null;
  crar: number | null;
  tier1_ratio: number | null;
  cost_to_income: number | null; // extra (no enum code)
  // Derived inputs exposed for the scorecard
  _ebit: number | null;
  _ebitda: number | null;
}

/**
 * Codes in `financialRatioEnum` (enums.ts) - only these can be written to
 * ratio_result.ratio_code. Extras are surfaced in the UI/scorecard only.
 */
export const PERSISTABLE_RATIO_CODES: ReadonlySet<string> = new Set([
  "current_ratio",
  "quick_ratio",
  "debt_equity",
  "debt_ebitda",
  "interest_coverage",
  "iscr",
  "dscr",
  "llcr",
  "plcr",
  "roce",
  "roe",
  "roa",
  "nim",
  "gnpa_pct",
  "nnpa_pct",
  "credit_cost_pct",
  "tier1_ratio",
  "crar",
  "gnpa_coverage_ratio",
  "liii_ratio",
  "provision_coverage_ratio",
  "debt_to_tangible_nw",
  "operating_margin",
  "ebitda_margin",
  "pat_margin",
  "ev_ebitda",
  "p_e",
  "p_b",
  "dividend_payout",
  "fcfo",
  "cfads",
  "working_capital_days",
  "creditor_days",
  "debtor_days",
  "inventory_days",
  "lnf_to_tnw",
]);

/**
 * Compute the full ratio set for one period. `prior` (optional) is the
 * immediately-preceding period's statement; its closing values form the
 * "opening" side of averages. If omitted, the engine falls back to `prev_*`
 * line items on the current statement, then to the closing value itself.
 */
export function computeRatios(
  stmt: Pick<FinancialStatement, "lineItems">,
  prior?: Pick<FinancialStatement, "lineItems"> | null,
): RatioSet {
  const cur = readLineItems(stmt);
  const prv = prior ? readLineItems(prior) : null;

  const li = (c: LineItemCode): number | null => cur[c] ?? null;
  const liPrev = (c: LineItemCode): number | null =>
    (prv?.[c] ?? li(`prev_${c}` as LineItemCode));

  // Derived P&L
  const interest = li("interest_expense");
  const pbt = li("pbt");
  const ebit =
    li("ebit") ??
    (pbt !== null && interest !== null ? pbt + interest : null);
  const da = li("depreciation_amortization");
  const ebitda =
    li("ebitda") ?? (ebit !== null && da !== null ? ebit + da : null);
  const revenue = li("revenue");
  const cogs = li("cogs");
  const pat = li("pat");

  // Debt & cash
  const totalDebt = li("total_debt");
  const cash = li("cash_and_equivalents");
  const mktSec = li("marketable_securities");
  const netDebt =
    totalDebt !== null && cash !== null
      ? totalDebt - cash - (mktSec ?? 0)
      : null;

  // Capital
  const netWorth = li("net_worth");
  const tangibleNw = li("tangible_net_worth");
  const totalAssets = li("total_assets");
  const capitalEmployed =
    li("capital_employed") ??
    (netWorth !== null && totalDebt !== null && cash !== null
      ? netWorth + totalDebt - cash
      : null);

  // Working capital
  const currentAssets = li("current_assets");
  const currentLiab = li("current_liabilities");
  const inventory = li("inventory");
  const receivables = li("trade_receivables");
  const payables = li("trade_payables");

  // Averages (closing + opening)
  const avgNetWorth = avg(netWorth, liPrev("net_worth"));
  const avgTotalAssets = avg(totalAssets, liPrev("total_assets"));
  const avgCapitalEmployed = avg(capitalEmployed, liPrev("capital_employed"));
  const avgReceivables = avg(receivables, liPrev("trade_receivables"));
  const avgPayables = avg(payables, liPrev("trade_payables"));
  const avgInventory = avg(inventory, liPrev("inventory"));

  // Cash flow
  const cfo = li("cfo");
  const ffo = li("cfo_before_wc_changes"); // FFO base (spec §3.1)
  const capex = li("capex");
  const cfads = li("cfads");
  const debtService = li("debt_service");
  const fcf = cfo !== null && capex !== null ? cfo - capex : null;

  // ---- Leverage ----
  const debt_equity = safeDiv(totalDebt, netWorth);
  const debt_to_tangible_nw = safeDiv(totalDebt, tangibleNw);
  const debt_ebitda = safeDiv(totalDebt, ebitda);
  const net_debt_ebitda = safeDiv(netDebt, ebitda);

  // ---- Coverage ----
  const interest_coverage = safeDiv(ebit, interest);
  const dscr = safeDiv(cfads, debtService);

  // ---- Liquidity ----
  const current_ratio = safeDiv(currentAssets, currentLiab);
  const quick_ratio =
    currentAssets !== null && currentLiab !== null
      ? safeDiv(currentAssets - (inventory ?? 0), currentLiab)
      : null;
  const cash_ratio =
    cash !== null && currentLiab !== null
      ? safeDiv(cash + (mktSec ?? 0), currentLiab)
      : null;

  // ---- Profitability ----
  const ebitda_margin = safeDiv(ebitda, revenue);
  const pat_margin = safeDiv(pat, revenue);
  const operating_margin = safeDiv(ebit, revenue);
  const roe = safeDiv(pat, avgNetWorth);
  const roa = safeDiv(pat, avgTotalAssets);
  const roce = safeDiv(ebit, avgCapitalEmployed);

  // ---- Activity (days) ----
  const debtor_days =
    avgReceivables !== null && revenue !== null
      ? (avgReceivables / revenue) * 365
      : null;
  const creditor_days =
    avgPayables !== null && cogs !== null ? (avgPayables / cogs) * 365 : null;
  const inventory_days =
    avgInventory !== null && cogs !== null ? (avgInventory / cogs) * 365 : null;
  const working_capital_days =
    debtor_days !== null && inventory_days !== null && creditor_days !== null
      ? debtor_days + inventory_days - creditor_days
      : null;
  const asset_turnover = safeDiv(revenue, avgTotalAssets);

  // ---- Bond-specific (cash-flow leverage) ----
  const ffo_debt = safeDiv(ffo, totalDebt);
  const fcf_debt = safeDiv(fcf, totalDebt);

  return {
    debt_equity,
    debt_to_tangible_nw,
    debt_ebitda,
    net_debt_ebitda,
    interest_coverage,
    dscr,
    current_ratio,
    quick_ratio,
    cash_ratio,
    ebitda_margin,
    pat_margin,
    operating_margin,
    roe,
    roa,
    roce,
    debtor_days,
    creditor_days,
    inventory_days,
    working_capital_days,
    asset_turnover,
    ffo: ffo,
    fcfo: ffo,
    ffo_debt,
    fcf_debt,
    cfads,
    gnpa_pct: li("gnpa_pct"),
    nnpa_pct: li("nnpa_pct"),
    nim: li("nim"),
    crar: li("crar"),
    tier1_ratio: li("tier1_ratio"),
    cost_to_income: li("cost_to_income"),
    _ebit: ebit,
    _ebitda: ebitda,
  };
}

/**
 * Reduce a RatioSet to the rows that can be persisted to ratio_result
 * (code ∈ financialRatioEnum and value non-null). Each row carries a
 * formula snapshot string for auditability.
 */
export function ratioSetToResultRows(
  set: RatioSet,
): { ratioCode: string; ratioValue: number; formulaSnapshot: string }[] {
  const rows: { ratioCode: string; ratioValue: number; formulaSnapshot: string }[] = [];
  for (const [code, value] of Object.entries(set)) {
    if (code.startsWith("_")) continue;
    if (!PERSISTABLE_RATIO_CODES.has(code)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    rows.push({
      ratioCode: code,
      ratioValue: Number(value.toFixed(4)),
      formulaSnapshot: FORMULA_SNAPSHOTS[code] ?? code,
    });
  }
  return rows;
}

export const FORMULA_SNAPSHOTS: Record<string, string> = {
  current_ratio: "Current Assets / Current Liabilities",
  quick_ratio: "(Current Assets - Inventory) / Current Liabilities",
  debt_equity: "Total Debt / Book Net Worth (unadjusted)",
  debt_to_tangible_nw: "Total Debt / Tangible Net Worth (adjusted)",
  debt_ebitda: "Total Debt / EBITDA",
  interest_coverage: "EBIT / Interest Expense",
  dscr: "CFADS / (Principal + Interest)",
  roce: "EBIT / Avg Capital Employed",
  roe: "PAT / Avg Net Worth",
  roa: "PAT / Avg Total Assets",
  ebitda_margin: "EBITDA / Revenue",
  pat_margin: "PAT / Revenue",
  operating_margin: "EBIT / Revenue",
  debtor_days: "(Avg Trade Receivables / Revenue) × 365",
  creditor_days: "(Avg Trade Payables / COGS) × 365",
  inventory_days: "(Avg Inventory / COGS) × 365",
  working_capital_days: "Debtor Days + Inventory Days - Creditor Days",
  fcfo: "CFO before working-capital changes (FFO)",
  cfads: "Cash Flow Available for Debt Service",
  nim: "Net Interest Margin (supplied)",
  gnpa_pct: "Gross NPA % (supplied)",
  nnpa_pct: "Net NPA % (supplied)",
  crar: "CRAR (supplied)",
  tier1_ratio: "Tier-1 CRAR (supplied)",
};

/** Human-readable category for a ratio code (used by the UI). */
export function ratioCategory(code: string): string {
  if (["debt_equity", "debt_to_tangible_nw", "debt_ebitda", "net_debt_ebitda"].includes(code))
    return "Leverage";
  if (["interest_coverage", "dscr"].includes(code)) return "Coverage";
  if (["current_ratio", "quick_ratio", "cash_ratio"].includes(code)) return "Liquidity";
  if (
    ["ebitda_margin", "pat_margin", "operating_margin", "roe", "roa", "roce"].includes(code)
  )
    return "Profitability";
  if (
    ["debtor_days", "creditor_days", "inventory_days", "working_capital_days", "asset_turnover"].includes(
      code,
    )
  )
    return "Activity";
  if (["ffo", "fcfo", "cfads", "ffo_debt", "fcf_debt"].includes(code))
    return "Bond-specific";
  if (["gnpa_pct", "nnpa_pct", "nim", "crar", "tier1_ratio", "cost_to_income"].includes(code))
    return "NBFC";
  return "Other";
}

/** All ratio codes the engine can emit, in display order. */
export const ALL_RATIO_CODES: { code: keyof RatioSet; label: string; unit: string }[] = [
  { code: "debt_to_tangible_nw", label: "Debt / Tangible NW (adj.)", unit: "x" },
  { code: "debt_equity", label: "Debt / Equity (book)", unit: "x" },
  { code: "debt_ebitda", label: "Debt / EBITDA", unit: "x" },
  { code: "net_debt_ebitda", label: "Net Debt / EBITDA", unit: "x" },
  { code: "interest_coverage", label: "Interest Coverage (EBIT/Int)", unit: "x" },
  { code: "dscr", label: "DSCR (CFADS / Debt Service)", unit: "x" },
  { code: "current_ratio", label: "Current Ratio", unit: "x" },
  { code: "quick_ratio", label: "Quick Ratio", unit: "x" },
  { code: "cash_ratio", label: "Cash Ratio", unit: "x" },
  { code: "ebitda_margin", label: "EBITDA Margin", unit: "%" },
  { code: "pat_margin", label: "Net Margin (PAT/Rev)", unit: "%" },
  { code: "operating_margin", label: "Operating Margin (EBIT/Rev)", unit: "%" },
  { code: "roe", label: "ROE", unit: "%" },
  { code: "roa", label: "ROA", unit: "%" },
  { code: "roce", label: "ROCE", unit: "%" },
  { code: "debtor_days", label: "Receivable Days", unit: "days" },
  { code: "creditor_days", label: "Payable Days", unit: "days" },
  { code: "inventory_days", label: "Inventory Days", unit: "days" },
  { code: "working_capital_days", label: "Working-Capital Days", unit: "days" },
  { code: "asset_turnover", label: "Asset Turnover", unit: "x" },
  { code: "ffo_debt", label: "FFO / Debt", unit: "x" },
  { code: "fcf_debt", label: "FCF / Debt", unit: "x" },
  { code: "ffo", label: "FFO (abs.)", unit: "₹" },
  { code: "cfads", label: "CFADS (abs.)", unit: "₹" },
  { code: "gnpa_pct", label: "Gross NPA", unit: "%" },
  { code: "nnpa_pct", label: "Net NPA", unit: "%" },
  { code: "nim", label: "NIM", unit: "%" },
  { code: "crar", label: "CRAR", unit: "%" },
  { code: "tier1_ratio", label: "Tier-1 CRAR", unit: "%" },
  { code: "cost_to_income", label: "Cost / Income", unit: "%" },
];

/** Format a ratio value for display (x, %, days, or ₹ Cr). */
export function formatRatio(code: string, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const unit = ALL_RATIO_CODES.find((r) => r.code === code)?.unit ?? "";
  if (unit === "%") return `${(value * 100).toFixed(2)}%`;
  if (unit === "days") return `${value.toFixed(1)} d`;
  if (unit === "₹") return `₹${value.toFixed(2)}`;
  return `${value.toFixed(2)}x`;
}
