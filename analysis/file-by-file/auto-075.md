
# Batch 075

## `src/features/deals/allocations.ts`

- **Lines:** 150 | **Bytes:** 5665
- **Kind:** Application module
- **Header intent:** Allocation-event semantics for book-built / auction mandates.  `allocation_event` is an IMMUTABLE append-only event-sourced table (src/db/schema/deals.ts §2.11). The current allocation state per (deal_id, party_id) is derived by replaying these events. This module encodes the business-logic rules the mutation layer must enforce BEFORE appending an event: - which deal types run an allocation book at all (bond underwriting, HY, private placement, G-Sec auction, ECM book-built offers) vs which do n
- **Exported functions:** allocEventIndex, isAllocEventTerminal, canTransitionAllocEvent, isAllocationDeal, isValidAllocEventForDealType
- **Exported const:** ALLOC_EVENT_FLOW, ALLOC_EVENT_TERMINAL, ALLOC_EVENT_WITHDRAWABLE
- **Internal imports (2):** ./catalog, ./catalog
- **Domain terms:** Allocation, Bond, allocation, bond, investor, mandate, underwriting

## `src/features/deals/catalog.ts`

- **Lines:** 341 | **Bytes:** 12193
- **Kind:** Application module
- **Header intent:** Deal-type catalog - the verified Binary Capital / Binary Bonds service map.  Source of truth for "which deal types does this CRM model, and is each one business-logic appropriate for BC?": scrape/BUSINESS_CONTEXT.md §2-3 and docs/CREDIT_ANALYSIS_SPEC.md / FINANCIAL_MODELING_SPEC.md. The schema enum (src/db/schema/enums.ts `dealTypeEnum`) is the DB-level constraint; this module is the domain-level catalog that classifies every enum value into a product family, brand affinity, credit character, an
- **Exported functions:** dealTypeSpec, isAllocationDealType, isIssuerInstrumentDealType, defaultBrandForDealType
- **Exported const:** DEAL_TYPE_CATALOG, DEAL_TYPE_DISPLAY_ORDER
- **Exported types:** DealType, DealStatus, DealPartyRole, AllocEventType, DealFamily, BrandAffinity, CreditCharacter, DealTypeSpec
- **Internal imports (1):** @/db/schema
- **Domain terms:** Bond, Mandate, Underwriting, allocation, binarybonds, binarycapital, bond, credit_analysis, deal_status, gsec, investor, issuer, mandate, party, underwriting

## `src/features/deals/index.ts`

- **Lines:** 15 | **Bytes:** 688
- **Kind:** Application module
- **Header intent:** Deals feature barrel - re-exports the query layer + the per-deal-type domain-logic modules (catalog, stages, roles, allocations).  The query layer (queries.ts) loads the pipeline; the domain modules encode the verified Binary Capital / Binary Bonds business logic (which deal types are appropriate, the per-type stage ladder, the per-type party roles + lead role, and the allocation-event semantics). Together they let deal mutation / validation logic enforce per-type correctness instead of the gene
- **Internal imports (5):** ./catalog, ./stages, ./roles, ./allocations, ./queries
- **Domain terms:** allocation, party

## `src/features/deals/queries.ts`

- **Lines:** 315 | **Bytes:** 10698
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side deal data access. Pipeline view: deals grouped by status with their deal_party parties inlined.  PAGINATION: the pipeline is capped at `perStage` deals per status via a ROW_NUMBER() window (default 40 - see DEFAULT_PER_STAGE). A total LIMIT would pile the first N deals into the earliest stage and leave later stages empty, which breaks the kanban's balanced funnel; partitioning by status keeps every column populated up to the cap. `total` is the full non-deleted deal count so the boar
- **Exported functions:** getDealPipeline
- **Exported const:** DEFAULT_PER_STAGE
- **Exported types:** DealPipelineRow, DealPipelineGroup, DealPipelineResult, DealPipelineFilters
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/db/schema, @/lib/rbac
- **Domain terms:** deal_status, mandate, party
