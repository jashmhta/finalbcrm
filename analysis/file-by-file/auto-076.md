
# Batch 076

## `src/features/deals/roles.ts`

- **Lines:** 319 | **Bytes:** 8307
- **Kind:** Application module
- **Header intent:** Per-deal-type deal_party roles + the lead role for each deal type.  The schema's `deal_party_role` enum is a flat superset of every role across every deal type (issuer, arranger, underwriter, investor, book_runner, lead_manager, syndicate_member, allocator, guarantor, trustee, registrar, rating_agency, legal_counsel, auditor, escrow_agent, selling_broker, buy_side_advisor, sell_side_advisor, target, acquirer, co_arranger). A flat superset is fine at the DB level but is NOT business-logic appropr
- **Exported functions:** validRolesForDealType, leadRoleForDealType, isValidRoleForDealType
- **Exported const:** DEAL_TYPE_ROLES
- **Exported types:** DealRoleSpec
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **Internal imports (1):** ./catalog
- **Domain terms:** bond, investor, issuer, mandate, party, underwriting

## `src/features/deals/stages.ts`

- **Lines:** 450 | **Bytes:** 13531
- **Kind:** Application module
- **Header intent:** Per-deal-type stage flows (the deal pipeline ladder per mandate type).  The schema's `deal_status` enum is a single flat set of pipeline stages (lead, mandated, in_dd, structuring, rating_marketing, pricing, allocation, settled, closed + off-pipeline dropped/on_hold). A flat enum is necessary at the DB level but is NOT business-logic appropriate on its own: a G-Sec auction does not go through "structuring"/"rating_marketing", and an M&A mandate does not have an "allocation" stage. This module en
- **Exported functions:** stageLadderFor, stageSemanticsFor, stageIndexInFlow, isOffPipelineStatus, canTransitionStage, nextStageFor
- **Exported const:** OFF_PIPELINE_STATUSES, DEAL_STAGE_FLOWS
- **Exported types:** OffPipelineStatus, DealStageFlow
- **Internal imports (1):** ./catalog
- **Domain terms:** Allocation, Bond, Investor, Mandate, allocation, deal_status, investor, mandate, onboarding, underwriting

## `src/features/documents/actions.ts`

- **Lines:** 148 | **Bytes:** 4963
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createDocument
- **Exported types:** CreateDocumentState
- **Zod schemas:** createDocumentSchema
- **DB ops patterns:** insert, returning
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** next/cache, next/navigation, zod/v4
- **Internal imports (3):** @/lib/rbac, @/db/context, @/db/schema

## `src/features/documents/queries.ts`

- **Lines:** 377 | **Bytes:** 10922
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side document data access (DATA_MODEL §2.20). The document table is metadata only - the file blob lives in S3-compatible object storage with file_store_ref as the key. KYC documents are encryption-at-rest + access- logged separately (ARCHITECTURE §4.3). barrier_id is the information-wall tag for RLS; is_mnpi disables download/copy/email-forward in the UI. RLS- aware once policies are migrated; until then plain queries. All functions are safe to call from Server Components.
- **Exported functions:** listDocuments, getDocumentDetail, listDealOptions, listPartyOptions, listContactOptions
- **Exported types:** DocumentListItem, DocumentListResult, DocumentDetail, DealOption, PartyOption, ContactOption
- **DB ops patterns:** from, leftJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/lib/rbac, @/db/schema
- **Domain terms:** KYC, party
