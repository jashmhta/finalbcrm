// Ratio engine - verifies computeRatios on a known financial_statement set.
// Source: src/features/credit/ratios.ts (CREDIT_ANALYSIS_SPEC §3).
//
// The line-item map below is hand-constructed so every ratio has a clean,
// checkable expected value. All assertions use closeTo with generous tolerance
// because the engine does plain float arithmetic.

import { describe, expect, it } from "vitest";

import {
  computeRatios,
  ratioSetToResultRows,
  PERSISTABLE_RATIO_CODES,
  ratioCategory,
} from "@/features/credit/ratios";
import type { FinancialStatement } from "@/db/schema";

// A canonical single-period statement. Values chosen so each ratio resolves
// to a tidy number (see comments). No prior period → averages fall back to
// the closing value.
const lineItems = {
  // P&L
  revenue: 1000,
  cogs: 600,
  interest_expense: 50,
  pbt: 200, // → ebit = pbt + interest = 250
  depreciation_amortization: 40, // → ebitda = ebit + D&A = 290
  pat: 150, // tax = 50
  // Debt & cash
  total_debt: 400,
  cash_and_equivalents: 50, // → net debt = 350
  // Capital
  net_worth: 500,
  tangible_net_worth: 450,
  total_assets: 1000,
  // Working capital
  current_assets: 300,
  current_liabilities: 150,
  inventory: 100,
  // Cash flow
  cfo: 180,
  cfo_before_wc_changes: 190, // FFO base
  capex: 60, // → FCF = 120
  cfads: 200,
  debt_service: 100,
};

const stmt = { lineItems } as Pick<FinancialStatement, "lineItems">;

describe("computeRatios - leverage", () => {
  const r = computeRatios(stmt);

  it("debt/equity = total debt / book net worth", () => {
    expect(r.debt_equity).toBeCloseTo(400 / 500, 6); // 0.8
  });

  it("debt / tangible NW uses the adjusted net worth", () => {
    expect(r.debt_to_tangible_nw).toBeCloseTo(400 / 450, 6); // 0.8889
  });

  it("debt / EBITDA", () => {
    expect(r.debt_ebitda).toBeCloseTo(400 / 290, 6); // 1.3793
  });

  it("net debt / EBITDA subtracts cash", () => {
    expect(r.net_debt_ebitda).toBeCloseTo(350 / 290, 6); // 1.2069
  });
});

describe("computeRatios - coverage", () => {
  const r = computeRatios(stmt);

  it("interest coverage = EBIT / interest", () => {
    expect(r.interest_coverage).toBeCloseTo(250 / 50, 6); // 5.0x
  });

  it("DSCR = CFADS / debt service", () => {
    expect(r.dscr).toBeCloseTo(200 / 100, 6); // 2.0x
  });
});

describe("computeRatios - liquidity", () => {
  const r = computeRatios(stmt);

  it("current ratio = current assets / current liabilities", () => {
    expect(r.current_ratio).toBeCloseTo(300 / 150, 6); // 2.0x
  });

  it("quick ratio excludes inventory", () => {
    expect(r.quick_ratio).toBeCloseTo((300 - 100) / 150, 6); // 1.3333x
  });

  it("cash ratio = (cash + mkt sec) / current liabilities", () => {
    expect(r.cash_ratio).toBeCloseTo(50 / 150, 6); // 0.3333x
  });
});

describe("computeRatios - profitability", () => {
  const r = computeRatios(stmt);

  it("EBITDA margin = EBITDA / revenue", () => {
    expect(r.ebitda_margin).toBeCloseTo(290 / 1000, 6); // 0.29
  });

  it("PAT margin = PAT / revenue", () => {
    expect(r.pat_margin).toBeCloseTo(150 / 1000, 6); // 0.15
  });

  it("operating margin = EBIT / revenue", () => {
    expect(r.operating_margin).toBeCloseTo(250 / 1000, 6); // 0.25
  });

  it("ROE = PAT / avg net worth (single-period → closing)", () => {
    expect(r.roe).toBeCloseTo(150 / 500, 6); // 0.30
  });

  it("ROA = PAT / avg total assets", () => {
    expect(r.roa).toBeCloseTo(150 / 1000, 6); // 0.15
  });

  it("ROCE = EBIT / avg capital employed (derived CE = NW + debt − cash)", () => {
    expect(r.roce).toBeCloseTo(250 / (500 + 400 - 50), 6); // 0.2941
  });
});

describe("computeRatios - cash-flow leverage", () => {
  const r = computeRatios(stmt);

  it("FFO is the before-WC-changes CFO base", () => {
    expect(r.ffo).toBeCloseTo(190, 6);
  });

  it("FFO / debt", () => {
    expect(r.ffo_debt).toBeCloseTo(190 / 400, 6); // 0.475
  });

  it("FCF / debt = (CFO − CapEx) / total debt", () => {
    expect(r.fcf_debt).toBeCloseTo((180 - 60) / 400, 6); // 0.30
  });

  it("CFADS is passed through", () => {
    expect(r.cfads).toBeCloseTo(200, 6);
  });
});

describe("computeRatios - derived inputs", () => {
  const r = computeRatios(stmt);

  it("derives EBIT = PBT + interest when ebit is not supplied", () => {
    expect(r._ebit).toBeCloseTo(250, 6);
  });

  it("derives EBITDA = EBIT + D&A when ebitda is not supplied", () => {
    expect(r._ebitda).toBeCloseTo(290, 6);
  });
});

describe("computeRatios - null safety", () => {
  it("returns null ratios when line items are missing", () => {
    const r = computeRatios({ lineItems: {} } as Pick<FinancialStatement, "lineItems">);
    expect(r.debt_equity).toBeNull();
    expect(r.interest_coverage).toBeNull();
    expect(r.current_ratio).toBeNull();
    expect(r.roe).toBeNull();
  });

  it("returns null for every ratio when the statement is empty", () => {
    const r = computeRatios({ lineItems: {} } as Pick<FinancialStatement, "lineItems">);
    expect(r.debt_ebitda).toBeNull();
    expect(r.net_debt_ebitda).toBeNull();
    expect(r.dscr).toBeNull();
    expect(r.quick_ratio).toBeNull();
    expect(r.cash_ratio).toBeNull();
    expect(r.ebitda_margin).toBeNull();
    expect(r.pat_margin).toBeNull();
    expect(r.operating_margin).toBeNull();
    expect(r.roa).toBeNull();
    expect(r.roce).toBeNull();
    expect(r.debtor_days).toBeNull();
    expect(r.creditor_days).toBeNull();
    expect(r.inventory_days).toBeNull();
    expect(r.working_capital_days).toBeNull();
    expect(r.asset_turnover).toBeNull();
    expect(r.ffo_debt).toBeNull();
    expect(r.fcf_debt).toBeNull();
  });

  it("dividing by zero returns null (safeDiv guards against b=0)", () => {
    const r = computeRatios({
      lineItems: { total_debt: 100, net_worth: 0 },
    } as Pick<FinancialStatement, "lineItems">);
    expect(r.debt_equity).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Net debt subtracts marketable securities too.
// ---------------------------------------------------------------------------

describe("computeRatios - net debt subtracts cash + marketable securities", () => {
  it("net_debt_ebitda subtracts both cash and marketable securities", () => {
    const r = computeRatios({
      lineItems: {
        total_debt: 400,
        cash_and_equivalents: 50,
        marketable_securities: 30,
        ebitda: 290,
      },
    } as Pick<FinancialStatement, "lineItems">);
    // net debt = 400 − 50 − 30 = 320; net_debt_ebitda = 320/290
    expect(r.net_debt_ebitda).toBeCloseTo(320 / 290, 6);
  });

  it("net_debt_ebitda falls back to cash only when marketable securities are absent", () => {
    const r = computeRatios({
      lineItems: { total_debt: 400, cash_and_equivalents: 50, ebitda: 290 },
    } as Pick<FinancialStatement, "lineItems">);
    expect(r.net_debt_ebitda).toBeCloseTo(350 / 290, 6);
  });

  it("net_debt_ebitda is null when cash is missing (can't compute net debt)", () => {
    const r = computeRatios({
      lineItems: { total_debt: 400, ebitda: 290 },
    } as Pick<FinancialStatement, "lineItems">);
    expect(r.net_debt_ebitda).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Prior-period averaging (ROE / ROA / ROCE / days).
// ---------------------------------------------------------------------------

describe("computeRatios - prior-period averaging", () => {
  const cur = {
    lineItems: {
      revenue: 1000,
      cogs: 600,
      pat: 150,
      net_worth: 500,
      total_assets: 1000,
      total_debt: 400,
      cash_and_equivalents: 50,
      ebit: 250,
      trade_receivables: 120,
      trade_payables: 80,
      inventory: 100,
    },
  } as Pick<FinancialStatement, "lineItems">;

  const prior = {
    lineItems: {
      net_worth: 400,
      total_assets: 800,
      capital_employed: 700,
      trade_receivables: 100,
      trade_payables: 60,
      inventory: 80,
    },
  } as Pick<FinancialStatement, "lineItems">;

  const r = computeRatios(cur, prior);

  it("ROE uses the average of current + prior net worth", () => {
    // avg NW = (500 + 400)/2 = 450; ROE = 150/450
    expect(r.roe).toBeCloseTo(150 / 450, 6);
  });

  it("ROA uses the average of current + prior total assets", () => {
    // avg TA = (1000 + 800)/2 = 900; ROA = 150/900
    expect(r.roa).toBeCloseTo(150 / 900, 6);
  });

  it("debtor days uses the average receivables", () => {
    // avg recv = (120 + 100)/2 = 110; debtor_days = (110/1000)*365 = 40.15
    expect(r.debtor_days).toBeCloseTo((110 / 1000) * 365, 6);
  });

  it("creditor days uses the average payables", () => {
    // avg pay = (80 + 60)/2 = 70; creditor_days = (70/600)*365
    expect(r.creditor_days).toBeCloseTo((70 / 600) * 365, 6);
  });

  it("inventory days uses the average inventory", () => {
    // avg inv = (100 + 80)/2 = 90; inventory_days = (90/600)*365
    expect(r.inventory_days).toBeCloseTo((90 / 600) * 365, 6);
  });
});

// ---------------------------------------------------------------------------
// Explicit capital_employed override + quick ratio edge cases.
// ---------------------------------------------------------------------------

describe("computeRatios - explicit capital_employed", () => {
  it("ROCE uses the supplied capital_employed rather than deriving it", () => {
    const r = computeRatios({
      lineItems: {
        ebit: 250,
        capital_employed: 900,
        revenue: 1000,
      },
    } as Pick<FinancialStatement, "lineItems">);
    expect(r.roce).toBeCloseTo(250 / 900, 6);
  });
});

describe("computeRatios - quick ratio with no inventory", () => {
  it("quick ratio equals current ratio when inventory is absent (treated as 0)", () => {
    const r = computeRatios({
      lineItems: { current_assets: 300, current_liabilities: 150 },
    } as Pick<FinancialStatement, "lineItems">);
    expect(r.current_ratio).toBeCloseTo(2.0, 6);
    expect(r.quick_ratio).toBeCloseTo(2.0, 6);
  });
});

// ---------------------------------------------------------------------------
// FCF / Debt and FFO / Debt - the bond-specific cash-flow leverage ratios.
// ---------------------------------------------------------------------------

describe("computeRatios - bond-specific cash-flow leverage", () => {
  it("FCF / Debt = (CFO − CapEx) / total debt", () => {
    const r = computeRatios({
      lineItems: { cfo: 180, capex: 60, total_debt: 400 },
    } as Pick<FinancialStatement, "lineItems">);
    expect(r.fcf_debt).toBeCloseTo((180 - 60) / 400, 6);
  });

  it("FFO / Debt = CFO-before-WC-changes / total debt", () => {
    const r = computeRatios({
      lineItems: { cfo_before_wc_changes: 190, total_debt: 400 },
    } as Pick<FinancialStatement, "lineItems">);
    expect(r.ffo_debt).toBeCloseTo(190 / 400, 6);
  });

  it("FFO and FCFO both surface the FFO base", () => {
    const r = computeRatios({
      lineItems: { cfo_before_wc_changes: 190 },
    } as Pick<FinancialStatement, "lineItems">);
    expect(r.ffo).toBeCloseTo(190, 6);
    expect(r.fcfo).toBeCloseTo(190, 6);
  });

  it("FCF / Debt is null when either CFO or CapEx is missing", () => {
    const r = computeRatios({
      lineItems: { cfo: 180, total_debt: 400 },
    } as Pick<FinancialStatement, "lineItems">);
    expect(r.fcf_debt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Working-capital days = debtor + inventory − creditor.
// ---------------------------------------------------------------------------

describe("computeRatios - working-capital days", () => {
  it("working_capital_days = debtor_days + inventory_days − creditor_days", () => {
    const r = computeRatios({
      lineItems: {
        revenue: 1000,
        cogs: 600,
        trade_receivables: 120,
        trade_payables: 80,
        inventory: 100,
      },
    } as Pick<FinancialStatement, "lineItems">);
    const expected =
      (120 / 1000) * 365 + (100 / 600) * 365 - (80 / 600) * 365;
    expect(r.working_capital_days).toBeCloseTo(expected, 6);
  });

  it("working_capital_days is null when any of its components is missing", () => {
    const r = computeRatios({
      lineItems: { revenue: 1000, trade_receivables: 120, trade_payables: 80 },
    } as Pick<FinancialStatement, "lineItems">);
    // No cogs/inventory → inventory_days null → working_capital_days null
    expect(r.working_capital_days).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Persistable ratio rows - only spec-enum codes surface.
// ---------------------------------------------------------------------------

describe("ratioSetToResultRows - persistence filter", () => {
  it("emits only persistable codes with non-null finite values", () => {
    const r = computeRatios(stmt);
    const rows = ratioSetToResultRows(r);
    for (const row of rows) {
      expect(PERSISTABLE_RATIO_CODES.has(row.ratioCode)).toBe(true);
      expect(Number.isFinite(row.ratioValue)).toBe(true);
    }
  });

  it("ffo_debt is NOT persisted (no enum code) but is computed", () => {
    const r = computeRatios(stmt);
    expect(r.ffo_debt).not.toBeNull();
    const rows = ratioSetToResultRows(r);
    expect(rows.find((row) => row.ratioCode === "ffo_debt")).toBeUndefined();
  });

  it("every persisted row carries a formula snapshot string", () => {
    const r = computeRatios(stmt);
    const rows = ratioSetToResultRows(r);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.formulaSnapshot.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// ratioCategory - display grouping.
// ---------------------------------------------------------------------------

describe("ratioCategory - display grouping", () => {
  it("groups leverage ratios under 'Leverage'", () => {
    expect(ratioCategory("debt_equity")).toBe("Leverage");
    expect(ratioCategory("debt_ebitda")).toBe("Leverage");
    expect(ratioCategory("net_debt_ebitda")).toBe("Leverage");
  });

  it("groups coverage ratios under 'Coverage'", () => {
    expect(ratioCategory("interest_coverage")).toBe("Coverage");
    expect(ratioCategory("dscr")).toBe("Coverage");
  });

  it("groups liquidity ratios under 'Liquidity'", () => {
    expect(ratioCategory("current_ratio")).toBe("Liquidity");
    expect(ratioCategory("quick_ratio")).toBe("Liquidity");
  });

  it("groups profitability ratios under 'Profitability'", () => {
    expect(ratioCategory("roe")).toBe("Profitability");
    expect(ratioCategory("roa")).toBe("Profitability");
    expect(ratioCategory("ebitda_margin")).toBe("Profitability");
  });

  it("groups cash-flow leverage under 'Bond-specific'", () => {
    expect(ratioCategory("ffo_debt")).toBe("Bond-specific");
    expect(ratioCategory("fcf_debt")).toBe("Bond-specific");
  });
});
