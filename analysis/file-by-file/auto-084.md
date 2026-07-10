
# Batch 084

## `src/features/modeling/actions.ts`

- **Lines:** 194 | **Bytes:** 5820
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createModel
- **Exported types:** CreateModelState
- **Zod schemas:** createModelSchema
- **DB ops patterns:** from, insert, returning, select, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm, next/cache, next/navigation, zod/v4
- **Internal imports (4):** @/lib/rbac, @/db/context, @/db, @/db/schema
- **Domain terms:** party

## `src/features/modeling/bondPricing.ts`

- **Lines:** 743 | **Bytes:** 24237
- **Kind:** Server Actions module
- **Directive:** `use server`
- **Header intent:** Bond pricing & fixed-income analytics - Indian conventions. Source of truth: /home/Jashmhta/crm/docs/FINANCIAL_MODELING_SPEC.md §1.  This is a PURE TypeScript library (no "use server", no DB, no React) so it can run identically in a Server Component, a Server Action, and a Client Component for the interactive calculator. The math is deterministic and side-effect free.  Conventions implemented (FINANCIAL_MODELING_SPEC §1.1-1.2): - ACT/365 default (Indian G-Secs & most corporate bonds); 30/360; AC
- **Exported functions:** computeBondMetrics, instrumentDefaults, pct, inr, bp, years
- **Exported types:** DayCount, InstrumentType, BondInputs, CashFlow, BondMetrics, InstrumentDefaults
- **Domain terms:** Bond, GSEC, bond

## `src/features/modeling/dcf.ts`

- **Lines:** 199 | **Bytes:** 6846
- **Kind:** Application module
- **Header intent:** Quick DCF / WACC calculator (FINANCIAL_MODELING_SPEC §4). Screening-stage valuation range before the banker builds the full model. The full DCF with peer set stays in Excel alongside (§4.5, §7.2).
- **Exported functions:** costOfEquity, computeWacc, equityBridge, computeDcf
- **Exported types:** WaccInputs, FcffInputs, TerminalInputs, DcfResult, EquityBridgeInputs, FullDcfInputs

## `src/features/modeling/lboModel.ts`

- **Lines:** 526 | **Bytes:** 18708
- **Kind:** Application module
- **Header intent:** LBO screening model - sources & uses, multi-tranche debt schedule with cash sweep, sponsor IRR + MOIC, and an entry×exit multiple sensitivity grid (FINANCIAL_MODELING_SPEC §6). A sponsor's first-pass LBO: capitalization, annual debt service with mandatory amortization + excess-cash sweep, exit at a hold-period multiple, and the returns to the sponsor's equity cheque. The full LBO with covenant models, PIK toggles, and monthly sculpting stays in Excel alongside (§6.4, §7.2); this gives a decision
- **Exported functions:** computeLbo, lboDefaults, cr, inrAbs, pctFmt, multipleFmt
- **Exported types:** LboTrancheInput, LboInputs, LboTrancheSchedule, LboSourcesAndUses, LboPeriodRow, LboSensitivityCell, LboResult
- **Domain terms:** mandate
