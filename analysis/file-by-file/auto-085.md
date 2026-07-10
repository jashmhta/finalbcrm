
# Batch 085

## `src/features/modeling/maModel.ts`

- **Lines:** 542 | **Bytes:** 21299
- **Kind:** Application module
- **Header intent:** M&A screening model - accretion/dilution + goodwill + acquirer deal IRR (FINANCIAL_MODELING_SPEC §5). A banker's first-pass M&A model: Sources & Uses, purchase-price allocation to goodwill (IFRS 3 / Ind AS 103 acquisition method), pro-forma EPS accretion/dilution, and the acquirer's IRR on the total capital deployed. The full merger model with purchase accounting schedules, stepping synergies, and standalone vs. pro-forma balance-sheet stays in Excel alongside (§5.4, §7.2); this gives a decision
- **Exported functions:** computeSourcesAndUses, computeGoodwill, computeAccretionDilution, computeDealIrr, computeMaModel, maDefaults, cr, inrAbs, pctFmt, epsFmt
- **Exported types:** MaAcquirerInputs, MaTargetInputs, MaConsideration, MaDealInputs, MaInputs, MaSourceItem, MaUseItem, MaSourcesAndUses, MaGoodwill, MaAccretionDilution, MaDealIrr, MaResult
- **Security signals:** india-compliance
- **Domain terms:** allocation, mandate

## `src/features/modeling/projectFinance.ts`

- **Lines:** 358 | **Bytes:** 13533
- **Kind:** Application module
- **Header intent:** Quick project-finance calculator - single-tranche, single-tenor sketch for mandate screening (FINANCIAL_MODELING_SPEC §2). Full multi-tranche sculpting stays in Excel alongside (§2.7, §7.2); this gives a decision-speed answer.  Implements: CFADS build, periodic DSCR, min/avg DSCR, LLCR (discounted at the cost of debt Kd - NOT WACC, per §2.3), PLCR, and debt sizing/sculpting for a target DSCR with capped tenor. Indian conventions: 25.17% tax default (Sec 115BAA), DSRA = 6 months debt service defa
- **Exported functions:** computeProjectFinance
- **Exported types:** ProjectFinanceInputs, PeriodResult, ProjectFinanceResult
- **Domain terms:** mandate

## `src/features/modeling/queries.ts`

- **Lines:** 241 | **Bytes:** 7321
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side financial-model data access (FINANCIAL_MODELING_SPEC §6, §7.1). Reads the `financial_model` table (§2.17) and joins deal/party for the library list and detail views. RLS-aware once policies are migrated; until then these are plain queries (withRls GUCs are no-ops on tables without RLS).
- **Exported functions:** listModels, getModelDetail
- **Exported types:** ModelListItem, ModelListResult, ModelDetail
- **DB ops patterns:** from, leftJoin, select, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/db/schema, @/lib/rbac
- **Domain terms:** party

## `src/features/modeling/scenarioAnalysis.ts`

- **Lines:** 651 | **Bytes:** 23235
- **Kind:** Application module
- **Header intent:** Scenario analysis - best / base / worst case views + two-variable sensitivity grids for every pure-function model in the modelling desk (FINANCIAL_MODELING_SPEC §9). A registry wraps each engine's compute function behind a uniform driver abstraction: the banker flexes a small set of key drivers across their [min, max] range, and the module returns the corner-case outcomes (all drivers at their improving extreme = best, all at their worsening extreme = worst) plus a 2-D sensitivity grid over any 
- **Exported functions:** driverBaseOverrides, defaultDriverState, formatDriver, formatOutcome, getScenarioModel, classifyDrivers, computeScenarios, computeSensitivity
- **Exported const:** SCENARIO_MODELS, SCENARIO_MODEL_LIST
- **Exported types:** ScenarioModelType, DriverUnit, OutcomeFormat, DriverSpec, ScenarioOutcome, ScenarioModelDef, ScenarioCases, DriverState, DriverStateMap, SensitivityGrid
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **Internal imports (5):** @/features/modeling/bondPricing, @/features/modeling/projectFinance, @/features/modeling/dcf, @/features/modeling/maModel, @/features/modeling/lboModel
- **Domain terms:** Bond, bond
