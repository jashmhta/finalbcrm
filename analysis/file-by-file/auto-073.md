
# Batch 073

## `src/features/compliance/queries.ts`

- **Lines:** 587 | **Bytes:** 17389
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side compliance data access (KYC + DPDP consent + DSR).  All functions are safe to call from Server Components. They run plain SELECTs (the GUCs set by withRls are no-ops on tables without RLS enabled yet). The KYC detail query joins party, contact, beneficial owners, PEP flags, KYC documents, and the audit history for the record.
- **Exported functions:** listKycRecords, getKycDetail, listConsentRecords, listDataSubjectRequests
- **Exported types:** KycListItem, KycListResult, KycBeneficialOwnerRow, KycDocumentRow, KycHistoryRow, KycDetail, ConsentListItem, ConsentListResult, DsrListItem, DsrListResult
- **DB ops patterns:** from, innerJoin, leftJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/lib/rbac, @/db/schema
- **Domain terms:** KYC, kyc, party

## `src/features/credit/actions.ts`

- **Lines:** 468 | **Bytes:** 15941
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createCreditAnalysis, addFinancialStatement, runRatiosAndScore, advanceCommitteeState
- **Exported types:** CreateCreditAnalysisState, AddFsState, RunRatiosState, AdvanceCommitteeState
- **Zod schemas:** createSchema, addFsSchema, advanceSchema
- **DB ops patterns:** delete, from, insert, returning, select, update, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm, next/cache, next/navigation, zod/v4
- **Internal imports (6):** @/lib/rbac, @/db/context, @/db, @/db/schema, ./ratios, ./scorecard
- **Domain terms:** Party, credit_analysis, issuer, party, scorecard

## `src/features/credit/queries.ts`

- **Lines:** 385 | **Bytes:** 12454
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side credit-analysis data access. RLS-aware via withRls on writes (see actions.ts); reads are plain queries (the GUCs set by withRls are no-ops on tables without RLS enabled). All functions are safe to call from Server Components.
- **Exported functions:** deriveLifecycleStatus, listCreditAnalyses, getCreditAnalysisDetail
- **Exported types:** CreditLifecycleStatus, CreditAnalysisListItem, CreditAnalysisListResult, CreditAnalysisDetail
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (5):** @/db, @/lib/rbac-core, @/db/schema, ./ratios, ./ratingMap
- **Domain terms:** credit_analysis, issuer, party, scorecard

## `src/features/credit/ratingBands.ts`

- **Lines:** 79 | **Bytes:** 2638
- **Kind:** Application module
- **Header intent:** Pure rating-band helpers - the DB-free subset of ratingMap.ts.  `ratingMap.ts` historically bundled the pure cross-agency ordinal→band mapping with the DB-backed ladder loader (`loadLadder`/`resolveRung`, which import `@/db`). Anything that imported even the pure helpers - notably the Investor Matching Engine (`features/matching/engine.ts`), which is consumed by a client component - transitively pulled `postgres` (and its Node `tls`/ `net`/`fs` deps) into the client bundle, breaking `next build`
- **Exported functions:** rankToBand, bandToAgencySymbol
- **Exported types:** RatingAgency
- **Internal imports (1):** ./scorecard
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6, Investor, Matching, matching, scorecard
