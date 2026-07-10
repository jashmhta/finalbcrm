
# Batch 010

## `src/__tests__/maModel.test.ts`

- **Lines:** 200 | **Bytes:** 7055
- **Kind:** Vitest unit test
- **Header intent:** M&A engine - financial invariants verification. Source of truth: src/features/modeling/maModel.ts. Pins the real-IB invariants (S&U balance, goodwill = consideration − net assets, accretive iff combined EPS > standalone, deal IRR sign) rather than float exactness.
- **External deps:** vitest
- **Internal imports (1):** @/features/modeling/maModel

## `src/__tests__/matching.test.ts`

- **Lines:** 675 | **Bytes:** 25792
- **Kind:** Vitest unit test
- **Header intent:** Investor Matching Engine - exhaustive verification of the scoring + ranking business logic (Binary Capital CRM USP - scrape/BUSINESS_CONTEXT.md §3).  Source of truth: src/features/matching/engine.ts.  Coverage: - Weight distribution: the six SCORED criteria sum to 1.0; relationship is weight 0 (indicator only, not in the base score). - scoreInvestor: 0–100 weighted score, exact values for canonical perfect-fit / all-fail / partial-credit investors. - Per-criterion scorers (rating gate, tenor ban
- **Security signals:** india-compliance
- **External deps:** vitest
- **Internal imports (1):** @/features/matching/engine
- **Domain terms:** BC-1, BC-5, Bond, Investor, Issuer, KYC, Matching, binarycapital, demat, investor, issuer, kyc, mandate, matching

## `src/__tests__/ratingMap.test.ts`

- **Lines:** 324 | **Bytes:** 11828
- **Kind:** Vitest unit test
- **Header intent:** Rating-agency scale mapping - verifies the static (no-DB) mapping functions in src/features/credit/ratingMap.ts (CREDIT_ANALYSIS_SPEC §5).  We exercise only the pure mapping: coreSymbolToRank, symbolToBand, rankToBand, bandToCanonicalRank. These do not touch the database, so the test is hermetic. The DB-backed resolveBand/resolveRung loaders are covered by integration tracks, not here.
- **Security signals:** india-compliance
- **External deps:** vitest
- **Internal imports (1):** @/features/credit/ratingMap
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6

## `src/__tests__/ratios.test.ts`

- **Lines:** 442 | **Bytes:** 15015
- **Kind:** Vitest unit test
- **Header intent:** Ratio engine - verifies computeRatios on a known financial_statement set. Source: src/features/credit/ratios.ts (CREDIT_ANALYSIS_SPEC §3).  The line-item map below is hand-constructed so every ratio has a clean, checkable expected value. All assertions use closeTo with generous tolerance because the engine does plain float arithmetic.
- **External deps:** vitest
- **Internal imports (2):** @/features/credit/ratios, @/db/schema
- **Domain terms:** Bond, bond
