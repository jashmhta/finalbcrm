# Agent 075 — Extreme detail analysis

Batch files: `src/features/deals/allocations.ts`, `src/features/deals/catalog.ts`, `src/features/deals/index.ts`, `src/features/deals/queries.ts`

Deal domain catalog, allocation event FSM, pipeline query (kanban). Related modules `stages.ts` / `roles.ts` are re-exported via index but not in this batch list — summarized via barrel coupling.

---

## `src/features/deals/allocations.ts`

- **Lines:** 151 | **Role:** Pure allocation_event business rules (immutable event-sourcing)
- **Exports:**
  - `ALLOC_EVENT_FLOW`: indication → order → revised_order → allocated → oversubscribed_adjusted → settled
  - `ALLOC_EVENT_TERMINAL`: settled, withdrawn
  - `ALLOC_EVENT_WITHDRAWABLE`: indication, order, revised_order
  - `allocEventIndex(ev)`, `isAllocEventTerminal(ev)`
  - `canTransitionAllocEvent(from, to): boolean` — full FSM
  - `isAllocationDeal(dealType)`, `isValidAllocEventForDealType(dealType, eventType)`

### Transition rules
| From | Allowed to |
|------|------------|
| null (first) | indication, order |
| indication | order, withdrawn |
| order | revised_order, allocated, withdrawn |
| revised_order | revised_order (re-append), allocated, withdrawn |
| allocated | oversubscribed_adjusted, settled |
| oversubscribed_adjusted | settled |
| settled / withdrawn | ∅ |

- Self-loop only allowed for revised_order
- Non-allocation deal types reject all event types

- **Business:** Binary Bonds book-build 6-step process alignment (mandate→…→pricing & allocation→settlement)
- **Side effects:** Pure — mutations must call before insert
- **Coupling:** catalog.isAllocationDealType
- **Risks:** No amount monotonicity checks; no oversubscription math here

---

## `src/features/deals/catalog.ts`

- **Lines:** ~330+ | **Role:** Verified BC product map for every deal_type enum value
- **Exports:**
  - Types derived from schema enums: DealType, DealStatus, DealPartyRole, AllocEventType
  - DealFamily: fixed_income_primary | gsec | ecm | advisory | structured_credit | portfolio
  - BrandAffinity: binarycapital | binarybonds | shared
  - CreditCharacter: sovereign | investment_grade | high_yield | structured | equity | none
  - `DealTypeSpec`, `DEAL_TYPE_CATALOG: Record<DealType, DealTypeSpec>`
  - `dealTypeSpec`, `isAllocationDealType`, `isIssuerInstrumentDealType`, `defaultBrandForDealType`
  - `DEAL_TYPE_DISPLAY_ORDER`

### Catalog flags (representative)
| Type | Family | Brand | Alloc book | Issuer instrument | Credit character |
|------|--------|-------|------------|-------------------|------------------|
| bond_underwriting | FI primary | binarybonds | yes | yes | investment_grade |
| high_yield_bond | FI primary | binarybonds | yes | yes | high_yield |
| gsec_auction | gsec | binarybonds | yes | yes | sovereign |
| private_placement_debt | FI primary | binarybonds | yes | yes | IG |
| ecm_ipo/fpo/qip/rights | ecm | binarycapital | yes (book-built) | yes | equity |
| m_and_a, valuation, fairness_opinion | advisory | binarycapital | no | no | none |
| rating_advisory | advisory | shared | no | no | none |
| project_finance / structured_finance / SCF | structured | shared/bonds | varies | yes | structured |
| portfolio_management_mandate | portfolio | shared | no | no | none |
| secondary_trading_advisory | advisory | binarybonds | no | no | none |

- Compile-time assert catalog covers enum (assertCatalogCoversEnum pattern)
- **Coupling:** stages, roles, allocations, UI deal create forms
- **Risks:** Enum extension requires catalog entry

---

## `src/features/deals/index.ts`

- **Lines:** 16 | **Role:** Barrel
- **Exports:** `export *` from catalog, stages, roles, allocations, queries
- **Business:** Mutations/UI import one path for stage ladder + roles + allocation FSM + pipeline
- **Note:** `stages.ts` provides per-type stage ladders (lead→…→closed) and `canTransitionStage`; `roles.ts` provides DEAL_TYPE_ROLES + lead role per type — critical for deal_party validation even though not in this batch's file list

---

## `src/features/deals/queries.ts`

- **Lines:** ~250+ | **Role:** Deal pipeline kanban data access
- **Exports:**
  - DealPipelineRow (deal fields + parties[{partyId, legalName, role, isLead}])
  - DealPipelineGroup, DealPipelineResult { groups, total }
  - DealPipelineFilters (q, type, status, brand, lead, creditAnalyst, party, turnover, sector, rating, agency, investorType, portfolioSize, riskAppetite, highYield)
  - `DEFAULT_PER_STAGE = 40`
  - `getDealPipeline({ filters, user, perStage? })`

### Pagination design
- **Per-status ROW_NUMBER() window** capped at perStage (not global LIMIT) so later stages are not empty
- total = full non-deleted matching count for “Showing X of Y”
- Client renders 20/column with Load more

### Visibility
- canReadAll deal|admin|super_admin|manage user
- Else: lead_user_id OR credit_analyst_user_id OR created_by_user_id OR EXISTS deal_party with user-related party ownership (buildDealWhere SQL)

### Filters
- Party suitability filters join party attributes (turnover_band, industry_sector, latest_rating, investor_type, portfolio_size_band, risk_appetite, high_yield_appetite)

- **Side effects:** Read-only; raw SQL window query
- **Security:** App-level scope + RLS if GUC set on read path
- **Coupling:** deals board UI; catalog for display labels elsewhere
- **Risks:** Heavy filter joins at scale; status null deals may group oddly; interactions with barrier walls need withRlsRead at page layer

---

## Cross-cutting (deals feature, this batch)

**Stage ladder (from stages.ts coupling):** deal_status enum order is the generic pipeline:
`lead → mandated → in_dd → structuring → rating_marketing → pricing → allocation → settled → closed` with off-pipeline `dropped`, `on_hold`. Per deal_type, `DEAL_STAGE_FLOWS` may skip stages (e.g. valuation may omit allocation).

**Immutable events:** allocation_event / trade_event schema forbid updates; canTransitionAllocEvent is pre-append gate only.
