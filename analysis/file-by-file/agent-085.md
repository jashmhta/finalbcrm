# Agent 085 — File-by-file analysis (batch-085)

Files: maModel.ts, projectFinance.ts, queries.ts, scenarioAnalysis.ts | Fully read

---

## src/features/modeling/maModel.ts

- **Lines:** 543  
- **Role:** M&A screening model (FINANCIAL_MODELING_SPEC §5): Sources & Uses, goodwill (IFRS 3 / Ind AS 103), EPS accretion/dilution, acquirer deal IRR.

- **Exports:** Ma* input/result types, `computeSourcesAndUses`, `computeGoodwill`, `computeAccretionDilution`, `computeDealIrr`, `computeMaModel`, `maDefaults`, formatters.

- **Key logic:**
  - Uses: equity price + optional refinance + advisory% + financing% + integration cost.
  - Sources: new debt + stock + target cash + acquirer cash plug; fundingShortfall if plug > cash.
  - Goodwill = consideration + NCI(0) − identifiable net assets FV; bargain purchase if negative.
  - Accretion: pro-forma NI = acquirer+target − AT interest + AT synergies (run-rate × realization); new shares = stock/price.
  - Deal IRR: t0 −totalDeployed; t1..n FCFE + ramped synergy AT; tn +exit equity (exit mult × exit EBITDA).
  - Notes include year-1 partial-synergy accretion.

- **Defaults:** Mid-cap acquirer / complementary target Indian cash deal; tax 25.17% Sec 115BAA.

- **Risks:** NCI always 0; unlevered-on-acquisition-debt deal return view (new debt not in deal CFs); target FCFE constant (no growth).

---

## src/features/modeling/projectFinance.ts

- **Lines:** 359  
- **Role:** Single-tranche project finance screening (FINANCIAL_MODELING_SPEC §2): CFADS, DSCR, LLCR/PLCR, debt sizing/sculpting.

- **Exports:** ProjectFinanceInputs/PeriodResult/ProjectFinanceResult, `computeProjectFinance`.

- **Key logic:**
  - CFADS = EBITDA − cashTax − maint capex − ΔNWC (tax ≈ EBITDA×τ pre-interest screening).
  - Profiles: sculpted (DS = CFADS/D*, residual force-amort), equated annuity, balloon IO+bullet.
  - Sculpted debt size: binary search max debt with min DSCR ≥ target−ε and repaid.
  - LLCR = PV(CFADS at Kd)/Debt; PLCR == LLCR in this sketch (no concession tail).
  - Project IRR on −capex then CFADS; equity IRR on −equity then CFADS−DS.

- **Indian defaults:** tax 25.17%, DSRA months 6.

- **Risks:** IDC during construction skipped; LLCR/PLCR equal; cash tax ignores interest shield.

---

## src/features/modeling/queries.ts

- **Lines:** 242  
- **Role:** Server data access for financial_model library list + detail. Visibility by computer/approver/party/deal ownership.

- **Exports:** `ModelListItem`, `ModelListResult`, `listModels`, `ModelDetail`, `getModelDetail`.

- **headlineOutput:** extracts YTM/clean price, min DSCR, EV, senior loss coverage, IRR from JSONB by modelType.

- **Security:** canReadAll financial_model/model/admin; scoped EXISTS deal_party. Unscoped user → all.

- **Risks:** parentVersion placeholder initially set then fixed if parentModelId; list limit default 50 no offset pagination.

---

## src/features/modeling/scenarioAnalysis.ts

- **Lines:** 652  
- **Role:** Scenario desk over pure engines (FINANCIAL_MODELING_SPEC §9): best/base/worst + 2D sensitivity. No model math duplicated.

- **Exports:**
  - ScenarioModelType bond|project_finance|dcf|ma|lbo
  - DriverSpec, ScenarioOutcome, ScenarioModelDef, ScenarioCases, DriverState*, SensitivityGrid
  - SCENARIO_MODELS registry, getScenarioModel, classifyDrivers, computeScenarios, computeSensitivity
  - formatDriver, formatOutcome, driverBaseOverrides, defaultDriverState

- **Direction probe:** perturb each driver UP by epsilon; if primary improves, upImproves=true — robust to sign of yield vs margin.

- **Best/worst:** all drivers to improving/worsening extremes simultaneously.

- **Sensitivity:** linspace min→max steps (default 7) on two drivers; other drivers at base.

- **Per-model primary metrics:** bond clean price; PF min DSCR; DCF EV; M&A EPS accretion; LBO sponsor IRR.

- **Risks:** Fixed base case inputs (not loaded from saved financial_model rows); try/catch returns null primary on throw.

---

## Batch 085 synthesis

Completes pure modeling suite (MA, PF, scenario) + model library queries. Scenario layer is excellent composition over engines for banker sensitivity without Excel for first pass.
