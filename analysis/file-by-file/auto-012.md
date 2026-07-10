
# Batch 012

## `src/__tests__/scorecard.test.ts`

- **Lines:** 325 | **Bytes:** 11672
- **Kind:** Vitest unit test
- **Header intent:** Scorecard scoring - verifies computeScorecard invariants and band mapping. Source: src/features/credit/scorecard.ts (CREDIT_ANALYSIS_SPEC §4).  The scorecard is a weighted 0–100 composite over sub-factors (weights sum to 1.0). We assert: total score is bounded in [0, 100], the reported band is consistent with bandFromScore, an all-5 override yields exactly 100 / BC-1, and an all-1 override yields a low score / BC-6. We also confirm the DSCR weight is reallocated to zero for a corporate (non-proj
- **External deps:** vitest
- **Internal imports (3):** @/features/credit/scorecard, @/features/credit/ratios, @/db/schema
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6, Scorecard, scorecard

## `src/__tests__/stages.test.ts`

- **Lines:** 518 | **Bytes:** 21222
- **Kind:** Vitest unit test
- **Header intent:** Deal-stage flow - exhaustive verification of the per-deal-type pipeline ladder + transition validation.  Source of truth: src/features/deals/stages.ts + catalog.ts (and scrape/BUSINESS_CONTEXT.md §2-3 service processes).  Coverage: - Per-deal-type ladder presence + ordering for the canonical deal types: bond underwriting, M&A, G-Sec auction, ECM IPO, structured finance, project finance, DCM advisory, valuation, etc. - Off-pipeline statuses (dropped, on_hold) apply to every deal type. - canTransi
- **External deps:** vitest
- **Internal imports (3):** @/features/deals/stages, @/features/deals/catalog, @/db/schema
- **Domain terms:** allocation, binarybonds, binarycapital, bond, issuer, mandate, underwriting

## `src/app/_components/dashboard-charts-impl.tsx`

- **Lines:** 586 | **Bytes:** 19829
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** DealVelocityChart, SectorDonut, CreditScoreChart, KycStatusChart, InvestorTypeChart
- **Exported types:** DealVelocityPoint, SectorSlice, CreditBandSlice, KycStatusSlice, InvestorTypeSlice
- **Security signals:** india-compliance
- **External deps:** react, recharts
- **Internal imports (3):** @/components/brand/money, @/components/brand/text, @/components/brand/chart-theme
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6, Investor, KYC, investor, issuer, mandate

## `src/app/_components/dashboard-charts.tsx`

- **Lines:** 96 | **Bytes:** 4508
- **Kind:** Client component
- **Directive:** `use client`
- **Exported const:** DealVelocityChart, SectorDonut, CreditScoreChart, KycStatusChart, InvestorTypeChart
- **Security signals:** india-compliance
- **External deps:** next/dynamic, react
- **Internal imports (1):** ./dashboard-charts-impl
- **Domain terms:** KYC, investor
