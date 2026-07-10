
# Batch 087

## `src/features/onboarding/queries.ts`

- **Lines:** 695 | **Bytes:** 22398
- **Kind:** Feature data-access (queries)
- **Header intent:** Client Onboarding - server-side data access.  Storage: a JSONB `onboarding_meta` column on party (migration 0007). A party is an onboarding case iff onboarding_meta IS NOT NULL. Because onboarding_meta is not in the frozen Drizzle schema (the schema layer owns src/db/schema/*), the onboarding read paths use parameterised raw SQL via `db.execute(sql\`...\`)` - postgres-js parses the jsonb column into a JS object and timestamptz into a Date automatically. Writes (actions.ts) set onboarding_meta vi
- **Exported functions:** normalizeOnboarding, listRms, fetchAllOnboarding, getOnboardingPipeline, getOnboardingDetail, getLinkedKycStatus, getOnboardingAnalytics
- **Exported types:** RmOption, OnboardingKycState, OnboardingRow, OnboardingPipelineGroup, OnboardingContact, OnboardingTask, OnboardingDetail, OnboardingStageBreakdown, OnboardingClientTypeBreakdown, OnboardingRmBreakdown, OnboardingAnalytics
- **DB ops patterns:** from, innerJoin, leftJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (7):** @/db, @/db/schema, @/features/interactions/queries, @/features/interactions/queries, @/lib/rbac-core, @/lib/rbac, ./types
- **Domain terms:** KYC, Onboarding, Party, issuer, kyc, onboarding, party

## `src/features/onboarding/seed.ts`

- **Lines:** 458 | **Bytes:** 19416
- **Kind:** Application module
- **Header intent:** Client Onboarding - seed.  Run AFTER the main seed (src/db/seed.ts):  npx tsx src/features/onboarding/seed.ts  Populates party.onboarding_meta (migration 0007) with a realistic Indian bond-house onboarding pipeline: ~28 prospect parties created fresh and promoted across the full funnel (initiated → profile_created → documents_collected → kyc_verified → compliance_approved → active), each with a 7-document checklist at a stage-appropriate completion state, a linked kyc_record (approved for kyc_ve
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, node:fs, node:path
- **Internal imports (1):** ./types
- **Domain terms:** KYC, Onboarding, binarybonds, binarycapital, bond, issuer, onboarding, party

## `src/features/onboarding/types.ts`

- **Lines:** 515 | **Bytes:** 18349
- **Kind:** Application module
- **Header intent:** Client Onboarding - shared types + domain constants.  Onboarding is the workflow that turns a prospect into an active, KYC-cleared, compliance-approved client of the Indian bond house / IB (Binary Capital / Binary Bonds). Storage: a JSONB `onboarding_meta` column on party (migration 0007_onboarding.sql). A party is an onboarding case iff party.onboarding_meta IS NOT NULL. See the migration header for the full design rationale (single source of truth = party master; the JSONB blob carries the onb
- **Exported functions:** canTransitionOnboarding, nextStageOf, computeOnboardingSla, freshChecklist, docsUploaded, docsVerified, docsRejected, allDocsVerified, docsUploadProgress, docsVerifyProgress, onboardingProgress
- **Exported const:** ONBOARDING_STAGE_ORDER, ONBOARDING_STAGE_LABELS, ONBOARDING_STAGE_FULL_LABELS, ONBOARDING_STAGE_HINTS, ONBOARDING_STAGE_TONE, ONBOARDING_STAGE_SLA_DAYS, ONBOARDING_STAGE_SLA_LABEL, ONBOARDING_ALLOWED_TRANSITIONS, ONBOARDING_CLIENT_TYPE_ORDER, ONBOARDING_CLIENT_TYPE_LABELS, ONBOARDING_DOC_ORDER, ONBOARDING_DOC_LABELS, ONBOARDING_DOC_SHORT, ONBOARDING_DOC_HINTS, ONBOARDING_DOC_TO_DOCUMENT_TYPE, ONBOARDING_SLA_DUE_SOON_DAYS
- **Exported types:** OnboardingStage, OnboardingClientType, OnboardingDocKey, OnboardingDocStatus, OnboardingDocVerification, OnboardingDocItem, OnboardingStageEntry, OnboardingMeta, OnboardingSlaStatus, OnboardingSlaState
- **Security signals:** india-compliance
- **Domain terms:** Investor, Issuer, KYC, Onboarding, bond, deal_status, investor, issuer, onboarding, party

## `src/features/parties/actions.ts`

- **Lines:** 357 | **Bytes:** 11957
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createParty, assignParty, updatePartySegmentation
- **Exported types:** CreatePartyState, PartyActionState
- **Zod schemas:** createPartySchema, assignPartySchema, updateSegmentationSchema
- **DB ops patterns:** insert, returning, update, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm, next/cache, next/navigation, zod/v4
- **Internal imports (4):** @/lib/rbac, @/db/context, @/db/schema, ./segmentation
- **Domain terms:** Party, investor, issuer, onboarding, party
