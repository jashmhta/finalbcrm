# Agent 084 — File-by-file analysis (batch-084)

Files: modeling/actions.ts, bondPricing.ts, dcf.ts, lboModel.ts | Fully read

---

## src/features/modeling/actions.ts

- **Lines:** 195  
- **Role:** `"use server"` create versioned `financial_model` row (FINANCIAL_MODELING_SPEC §6/§2.17). params+outputs JSONB from form JSON strings.

- **Exports:** `CreateModelState`, `createModel(prev, formData)`.

- **Key logic:**
  - MODEL_TYPES enum: bond_pricing, project_finance, securitization, dcf, m_and_a, lbo, valuation, portfolio_construction, scenario_stress.
  - RBAC `create:financial_model`.
  - `canLinkModelTarget` — non-admin users may only link deal/party they own/are assigned to.
  - withRls with dealId in mandate list when present; version=1; computedAt/By set.
  - revalidate /modeling + redirect to detail.

- **Security:** Target linkage ACL + create permission. JSON parsed server-side — no schema validation per model type yet (app layer TODO §2.17).

- **Risks:** No max JSON size beyond zod string min 2; huge payloads possible; no fork-from-parent (§6.2 later).

---

## src/features/modeling/bondPricing.ts

- **Lines:** 744  
- **Role:** Pure TypeScript Indian bond pricing engine (FINANCIAL_MODELING_SPEC §1). Runs in Server Component, Server Action, or Client calculator identically.

- **Exports (major):**
  - Types: DayCount, InstrumentType, BondInputs, CashFlow, BondMetrics, InstrumentDefaults
  - `computeBondMetrics(inputs): BondMetrics`
  - `instrumentDefaults(type)`, formatters `pct`, `inr`, `bp`, `years`

- **Conventions:** ACT/365 default; annual corp/NCD; semi-annual G-Sec/SDL; T-Bills discount; AI form Face×c×days/DaysInYear; clean price from yield with (1-w) stub; Mac duration /f; convexity 1/f²; G-spread vs benchmark.

- **Key algorithms:**
  - `normalizeCouponDates` rolls schedule so last≤settlement<next.
  - `priceFromYieldCouponBond` per-period DF (1+r)^(-(idx-w)).
  - `solveYtm` bisection y∈(-0.99,10) tolerance 1e-9 on dirty.
  - T-Bill path: discount yield / BEY, single CF duration.
  - Price-yield grid ±300bp / 25bp steps.

- **Side effects:** None pure.

- **Risks:** Odd stubs assume maturity is coupon date; ACT_ACT uses 365 fixed (not true ISDA ACT/ACT); Newton polish mentioned but only bisection implemented.

---

## src/features/modeling/dcf.ts

- **Lines:** 200  
- **Role:** Quick DCF/WACC screening calculator (FINANCIAL_MODELING_SPEC §4). Full peer DCF stays in Excel.

- **Exports:**
  - Types: WaccInputs, FcffInputs, TerminalInputs, DcfResult, EquityBridgeInputs, FullDcfInputs
  - `costOfEquity`, `computeWacc`, `equityBridge`, `computeDcf`

- **Key formulas:**
  - Ke = Rf + β·ERP + SP + CRP
  - WACC = we·Ke + wd·Kd·(1-τ)
  - FCFF_t = EBIT(1-τ)+DA-ΔNWC-Capex; ΔNWC ≈ nwc%×Revenue (screening)
  - Gordon TV = FCFF_{n+1}/(WACC-g); exit multiple path
  - Equity = EV − NetDebt − Minority − Pref + Investments (cash netted inside NetDebt — no double-count)

- **Risks:** Notes if WACC−g≤0; revenueYear0 required historical; no mid-year convention.

---

## src/features/modeling/lboModel.ts

- **Lines:** 527  
- **Role:** LBO screening model (FINANCIAL_MODELING_SPEC §6): S&U, multi-tranche debt with cash sweep, sponsor IRR/MOIC, entry×exit sensitivity grid.

- **Exports:** LboTrancheInput, LboInputs, schedule/result types, `computeLbo`, `lboDefaults`, formatters cr/inrAbs/pctFmt/multipleFmt.

- **Key logic:**
  - Entry EV = multiple × LTM EBITDA; equity purchase = EV − target net debt.
  - Sponsor equity plug after new debt + management rollover + fees.
  - Annual periods: EBITDA growth, interest on opening, tax, capex/NWC, mandatory amort on original principal, sweep highest-rate first.
  - Exit equity = exit EV − net debt; sponsor share pro-rata; clean hold CF (no interim dividends).
  - IRR bisection local copy; sensitivity ±20% around entry/exit (4 steps each side).

- **Defaults:** ₹25 Cr LTM EBITDA-ish mid-market Indian LBO with TLA/TLB/mezz.

- **Risks:** Annual periods only; no PIK/covenants; tax loss years tax=0 when EBT≤0 (no DTA).

---

## Batch 084 synthesis

Modeling feature: persistence action + pure FI engines (bond, DCF, LBO). Engines are high-quality screening math aligned to FINANCIAL_MODELING_SPEC; Excel remains system of record for full models.
