
# Batch 086

## `src/features/modeling/securitization.ts`

- **Lines:** 206 | **Bytes:** 8083
- **Kind:** Application module
- **Header intent:** Quick securitization / structured-finance sizing calculator (FINANCIAL_MODELING_SPEC §3). Mandate-screening sketch: tranche sizing + credit enhancement (OC, subordination, cash reserve) + waterfall summary. The full monthly-vector waterfall with default curves stays in Excel (§3.5).
- **Exported functions:** computeSecuritization
- **Exported types:** TrancheInput, SecuritizationInputs, TrancheResult, SecuritizationResult
- **Domain terms:** Mandate

## `src/features/onboarding/actions.ts`

- **Lines:** 855 | **Bytes:** 31661
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createOnboarding, advanceStage, startKyc, markDocumentUploaded, verifyDocument, rejectDocument, approveCompliance, rejectCompliance, activateClient, updateAssignedRm, deleteOnboarding
- **Exported types:** CreateOnboardingState, AdvanceStageState, StartKycState, DocUploadState, DocVerifyState, ComplianceState, ActivateState, FieldState, DeleteState
- **Zod schemas:** createSchema, advanceSchema, startKycSchema, docUploadSchema, docVerifySchema, rejectSchema, approveComplianceSchema, rejectComplianceSchema, activateSchema, rmSchema, deleteSchema
- **DB ops patterns:** insert, returning, update
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm, next/cache, next/navigation, zod/v4
- **Internal imports (6):** @/lib/rbac, @/db/context, @/db, @/db/schema, ./queries, ./types
- **Domain terms:** KYC, Onboarding, binarybonds, investor, issuer, kyc, onboarding, party

## `src/features/onboarding/index.ts`

- **Lines:** 55 | **Bytes:** 1300
- **Kind:** Application module
- **Header intent:** Client Onboarding - feature barrel.  Re-exports the domain types/constants, the icon resolver, the server data access, and the server actions so app routes import from one path.
- **Security signals:** india-compliance
- **Internal imports (4):** ./types, ./onboarding-icons, ./queries, ./actions
- **Domain terms:** Onboarding, onboarding

## `src/features/onboarding/onboarding-icons.tsx`

- **Lines:** 100 | **Bytes:** 3190
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** OnboardingDocIcon, OnboardingStageIcon, onboardingStageTone
- **Exported const:** ONBOARDING_STAGE_ICON_TONE
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (3):** @/lib/utils, @/components/brand, ./types
- **Domain terms:** Onboarding, onboarding
