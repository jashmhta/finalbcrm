# Agent 073 — Extreme detail analysis

Batch files: `src/features/compliance/queries.ts`, `src/features/credit/actions.ts`, `src/features/credit/queries.ts`, `src/features/credit/ratingBands.ts`

Compliance list/detail loaders; credit mutations; credit list/detail; client-safe rating band map.

---

## `src/features/compliance/queries.ts`

- **Lines:** ~560+ | **Role:** Server-side KYC / consent / DSR list+detail
- **Exports:**
  - KYC: `listKycRecords`, `getKycDetail`, types KycListItem/Result, KycBeneficialOwnerRow, KycDocumentRow, KycHistoryRow, KycDetail
  - Consent: `listConsentRecords`, ConsentListItem/Result
  - DSR: `listDataSubjectRequests`, DsrListItem/Result
- **Key logic (typical):**
  - Paginated filters on status/risk/party name; join party legalName
  - getKycDetail: kyc row + party + BOs + documents (kyc_pack / categories) + audit history via listAuditLogForEntity
  - Soft-delete filters throughout
- **Side effects:** Read-only (audit history is read)
- **Security:** Should be called after page-level auth; wall visibility depends on withRlsRead if used at call site (verify callers)
- **Coupling:** compliance UI, audit.ts, kyc pure helpers for display
- **Risks:** Confirm whether queries use withRlsRead for walled kyc_record — if plain `db`, FORCE RLS without GUCs may hide/fail depending on policy fail-open

---

## `src/features/credit/actions.ts`

- **Lines:** ~480+ | **Role:** `"use server"` credit analysis mutations
- **Exports:**
  - `createCreditAnalysis` — partyId, obligorType, optional analysisType/dealId; can write credit; withRls insert; redirect or state error
  - `addFinancialStatement` — line items + period metadata; link via credit_analysis_fs_link
  - `runRatiosAndScore` — computeRatios → ratio_result rows → computeScorecard → credit_score + scorecard + update analysis score/band/pd
  - `advanceCommitteeState` — internalRatingAction transitions (assign/maintain/upgrade/downgrade/watch_*)
- **Enum mirrors:** OBLIGOR_TYPES, ANALYSIS_TYPES, PERIOD_TYPES, STATEMENT_TYPES, UNITS, FS_SOURCES, FS_LINK_ROLES, INTERNAL_RATING_ACTIONS
- **Key algorithm runRatiosAndScore:**
  1. Load linked FS ordered by period
  2. computeRatios(latest, prior)
  3. ratioSetToResultRows persist persistable codes with FORMULA_SNAPSHOTS
  4. computeScorecard({ ratios, obligorType })
  5. Write scorecard + component credit_score rows; set current_credit_score, internal band, pd from BAND_PD_1Y
- **Side effects:** withRls writes; revalidatePath credit routes; possible redirect
- **Security:** can(user,"write","credit"); wall tags
- **Coupling:** ratios.ts, scorecard.ts, schema credit tables
- **Risks:** Template selection may default weights only; qualitative factors default 3 inflating/deflating scores

---

## `src/features/credit/queries.ts`

- **Lines:** ~250+ (detail larger) | **Role:** List + detail credit analyses with derived lifecycle
- **Exports:**
  - `CreditLifecycleStatus = "current" | "superseded"` — **no status column**; derived from valid_to null
  - `deriveLifecycleStatus(validTo)`
  - `listCreditAnalyses({ q, user, page, pageSize })`
  - `getCreditAnalysisDetail(id, user?)` → CreditAnalysisDetail with party, FS list, latestRatioSet (live recompute), scorecard, scores, externalRatingsEnriched (via resolveBand), limits, exposures
  - Types CreditAnalysisListItem/Result, CreditAnalysisDetail
- **Visibility:** canReadAll credit|party|admin|super_admin|manage user; else CA created/updated by user OR party assigned/owner/creator
- **Key logic:** list joins party + latest scorecard band; detail rehydrates engines for live ratios/scorecard/agency bands
- **Side effects:** Read-only
- **Security:** App-level visibility clause (plus RLS if GUCs set)
- **Coupling:** ratingMap resolveBand, ratios, scorecard, AI creditSummary
- **Risks:** Dual visibility models (app OR + RLS) can diverge; list may not show superseded versions by default

---

## `src/features/credit/ratingBands.ts`

- **Lines:** 80 | **Role:** **DB-free** rank→band map (client-safe split from ratingMap)
- **Exports:**
  - `type RatingAgency` (7 Indian CRAs)
  - `rankToBand(rank): Band | null` — RANK_TO_BAND 1→BC-1 … 19→BC-6
  - `bandToAgencySymbol(band, agency)` — AAA/AA/A/BBB/BB/B with IND/BWR prefixes

### Rank → Band ladder (CREDIT_ANALYSIS_SPEC §5)
| Rank | Band | Typical symbol |
|------|------|----------------|
| 1–2 | BC-1 | AAA, AA+ |
| 3–4 | BC-2 | AA, AA- |
| 5–7 | BC-3 | A+/A/A- |
| 8–10 | BC-4 | BBB+/BBB/BBB- |
| 11–14 | BC-5 | BB+…B+ |
| 15–19 | BC-6 | B/C/D tiers |

- **Business:** Prevents `postgres`/`tls` from entering client bundle via matching engine
- **Coupling:** ratingMap re-exports; matching/engine.ts client path
- **Risks:** Static fallback if ladder DB not loaded; ranks 16–19 agency-specific semantics live in ratingMap.agencySymbolToRank
