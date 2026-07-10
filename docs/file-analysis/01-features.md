# 01 — Features (`app/src/features`)

Domain modules: pure engines, server actions, queries, and feature UI. This is the business heart of the CRM.

## File inventory

_105 files · 34,291 lines_

### Domain: `admin`

PRD: **Platform Admin/RBAC**

#### `app/src/features/admin/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 578 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (8) | CreateUserState, createUser, UpdateUserState, updateUser, DeactivateUserState, deactivateUser, UpdateRolePermissionsState, updateRolePermissions |
| Has TODO | N |
| Purpose | Exports: CreateUserState, createUser, UpdateUserState, updateUser, DeactivateUserState, deactivateUser, UpdateRolePermissionsState, updateRolePermissions |

#### `app/src/features/admin/index.ts`

| Field | Value |
|---|---|
| Role | `module-api` — Barrel / types export for feature module |
| LOC | 51 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Admin Panel - feature barrel.  Re-exports the server data access + server actions so app routes import from one path. The admin views are server components that call the queries directly; the client views (users/roles/audit) import the actions + the row types they need. |

#### `app/src/features/admin/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 593 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (28) | AdminUserRow, listUsers, getUser, AdminRoleRow, listRoles, AdminPermissionRow, listPermissions, SectorCodeRow |
| Has TODO | N |
| Purpose | Admin Panel - server-side data access.  READ-ONLY surface for the admin's forensic + management views: • users  - app_user joined to active user_role → role (email, desk, active, last_login, roles, barrier clearance). • roles  - role + its permission codes (role_permission → permission). • permissions - the full permission code catalogue. • master data - sector_code + rating_ladder reference rows, |

### Domain: `ai`

PRD: **P3 Intelligence (deterministic)**

#### `app/src/features/ai/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 44 |
| Runtime | server |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | fetchCreditSummary, fetchInteractionSummary |
| Has TODO | N |
| Purpose | Exports: fetchCreditSummary, fetchInteractionSummary |

#### `app/src/features/ai/clientInsights.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 455 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (5) | relationshipStrengthScore, dealPotentialScore, ActionInput, recommendAction, getClientInsights |
| Has TODO | N |
| Purpose | AI Features - Client insights engine.  For each party (counterparty / client), derive: - Relationship strength score (0..100): interaction volume (recency- weighted) + deal footprint + contact breadth. - Deal potential score (0..100): active mandate count + target size + interaction recency (a warmed-up relationship converts better). - Recommended next action (re-engage / advance mandate / committ |

#### `app/src/features/ai/creditSummary.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 748 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (5) | CreditSummaryRatios, CreditSummaryExternalRating, CreditSummaryInput, generateCreditSummary, getCreditSummary |
| Has TODO | N |
| Purpose | AI Features - Credit summary generator.  Given a credit_analysis + the latest period's ratios + the scorecard (band / score / PD), generate a three-paragraph credit memo summary: 1. Issuer description       - who the obligor is, sector, listing, domicile. 2. Financial highlights     - leverage / coverage / liquidity / profitability (or asset quality / capital for NBFCs & banks), with a trend line  |

#### `app/src/features/ai/index.ts`

| Field | Value |
|---|---|
| Role | `module-api` — Barrel / types export for feature module |
| LOC | 58 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | AI Features barrel - the "no external LLM" intelligence layer.  Four deterministic engines generate text + scores from structured CRM data: - creditSummary    : credit_analysis + ratios + scorecard → 3-paragraph memo. - interactionSummary: interaction notes → overview + key topics + action items. - clientInsights   : per-party relationship strength / deal potential / next action. - nextAction      |

#### `app/src/features/ai/interactionSummary.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 493 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (6) | InteractionNote, InteractionSummaryInput, summarizeInteractions, summarizeOneInteraction, getInteractionSummary, getRecentInteractionSummaries |
| Has TODO | N |
| Purpose | AI Features - Interaction summary generator.  Given a set of interaction notes (subject + body + channel + next_action), generate a summary with: - a 1-2 sentence overview, - 3-6 key topics (ranked by mention frequency across a domain vocabulary), - action items (extracted from next_action fields + imperative sentences in the body), - supporting counts (interaction count, channels, last interactio |

#### `app/src/features/ai/nextAction.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 450 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | NextActionsResult, getNextActions |
| Has TODO | N |
| Purpose | AI Features - Next-best-action engine (user-scoped).  For the LOGGED-IN user, surface 3-5 prioritized next actions drawn from the five coverage-desk attention surfaces: 1. Task overdue            - a task assigned to the user past its due date. 2. Deal stuck              - a deal the user leads, idle past its stage SLA. 3. Credit committee pending - a credit analysis the user owns as analyst, awai |

#### `app/src/features/ai/types.ts`

| Field | Value |
|---|---|
| Role | `module-api` — Barrel / types export for feature module |
| LOC | 200 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (13) | AiPriority, AI_PRIORITY_BADGE, AI_PRIORITY_LABEL, AI_PRIORITY_RANK, NextActionKind, NEXT_ACTION_KIND_LABEL, NextAction, InsightActionKind |
| Has TODO | N |
| Purpose | AI Features - shared types.  This module is the "no external LLM" intelligence layer of the CRM. The four engines (creditSummary, interactionSummary, clientInsights, nextAction) are deterministic heuristic / templating generators: they read STRUCTURED CRM data (credit analyses, interactions, deals, parties, KYC, tasks) and emit human-readable text + scores. Nothing here calls an external model - t |

### Domain: `compliance`

PRD: **M7 KYC/AML/Consent**

#### `app/src/features/compliance/.gitkeep`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 1 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | high |
| Exports (0) | — |
| Has TODO | N |
| Purpose | compliance — placeholder. Implementation after design docs finalized. |

#### `app/src/features/compliance/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 872 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented+TODO |
| Criticality | high |
| Exports (16) | CreateKycState, createKyc, TransitionKycState, transitionKycStatus, SetKycRiskState, setKycRiskRating, AddBoState, addBeneficialOwner |
| Has TODO | Y |
| Purpose | Exports: CreateKycState, createKyc, TransitionKycState, transitionKycStatus, SetKycRiskState, setKycRiskRating, AddBoState, addBeneficialOwner, CaptureConsentState, captureConsent, WithdrawConsentState, withdrawConsent… |

#### `app/src/features/compliance/audit.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 185 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (6) | AuditLogFilter, AuditLogRow, AuditLogResult, listAuditLog, getAuditLogEntry, listAuditLogForEntity |
| Has TODO | N |
| Purpose | audit_log query helpers (immutable viewer).  Schema: audit.ts `audit_log` - INSERT-only (RLS + trigger), monthly RANGE partitioned by occurred_at, hash-chained for tamper-evidence. This module is READ-ONLY by design: there is no update/delete surface, and writes are performed only by the mutation layer via the `auditLog` insert (the hash chain is populated by a BEFORE INSERT trigger). See schema a |

#### `app/src/features/compliance/consent.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 185 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented+TODO |
| Criticality | high |
| Exports (12) | ConsentPurpose, ConsentMethod, DsrType, DsrStatus, DEFAULT_RETENTION_YEARS_BY_PURPOSE, DSR_TIMELINE_DAYS, computeConsentRetentionUntil, computeDsrDueDate |
| Has TODO | Y |
| Purpose | DPDP Act 2023 consent + Data Subject Request (DSR) helpers.  Research: COMPLIANCE_LEGAL_FEASIBILITY.md §6-7. Schema: compliance.ts `consent_record` (purpose-bound, granular per data category, retention clock) and `data_subject_request` (principal-rights workflow). Consent is purpose-bound - a marketing consent does NOT authorize sharing data with a rating agency; that needs its own consent_record. |

#### `app/src/features/compliance/kyc.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 371 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (24) | KycStatus, KycType, KycRisk, PartyNature, BO_THRESHOLD_PCT, LegalForm, PARTNERSHIP_BO_THRESHOLD_PCT, boThresholdFor |
| Has TODO | N |
| Purpose | KYC lifecycle helpers (PMLA 2002 + RBI Master Direction on KYC).  Research: COMPLIANCE_LEGAL_FEASIBILITY.md §5 (PMLA KYC/CDD/EDD, BO thresholds, PEP/sanctions, STR/CTR, retention). Schema: credit.ts `kyc_record` + `kyc_beneficial_owner`; contact.pep_status for PEP. These are PURE helpers - no DB access - so they can be unit-tested and reused by both Server Components (queries.ts) and Server Action |

#### `app/src/features/compliance/pit.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 321 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (19) | DesignatedPersonCategory, DesignatedPersonEntry, isActiveDesignatedPerson, isInsiderCategory, PitUpsiEvent, PreClearanceStatus, PRE_CLEARANCE_TRANSITIONS, canTransitionPreClearance |
| Has TODO | N |
| Purpose | SEBI (Prohibition of Insider Trading) Regulations 2015 - Reg 9 + Schedule B.  Research: COMPLIANCE_LEGAL_FEASIBILITY.md §3.7 (PIT / Chinese walls), §7 item 8 (designated-person & pre-clearance workflow), and §15 risk register (PIT / Chinese-wall failure is a HIGH-severity risk for BC given dual advisory/corporate-finance + potential secondary-trading activity).  This module encodes the PIT busines |

#### `app/src/features/compliance/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 587 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (14) | KycListItem, KycListResult, listKycRecords, KycBeneficialOwnerRow, KycDocumentRow, KycHistoryRow, KycDetail, getKycDetail |
| Has TODO | N |
| Purpose | Server-side compliance data access (KYC + DPDP consent + DSR).  All functions are safe to call from Server Components. They run plain SELECTs (the GUCs set by withRls are no-ops on tables without RLS enabled yet). The KYC detail query joins party, contact, beneficial owners, PEP flags, KYC documents, and the audit history for the record. |

### Domain: `credit`

PRD: **M3 Credit Analysis**

#### `app/src/features/credit/.gitkeep`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 1 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | high |
| Exports (0) | — |
| Has TODO | N |
| Purpose | credit - placeholder. Implementation after design docs finalized. |

#### `app/src/features/credit/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 468 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (8) | CreateCreditAnalysisState, createCreditAnalysis, AddFsState, addFinancialStatement, RunRatiosState, runRatiosAndScore, AdvanceCommitteeState, advanceCommitteeState |
| Has TODO | N |
| Purpose | Exports: CreateCreditAnalysisState, createCreditAnalysis, AddFsState, addFinancialStatement, RunRatiosState, runRatiosAndScore, AdvanceCommitteeState, advanceCommitteeState |

#### `app/src/features/credit/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 385 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (7) | CreditLifecycleStatus, deriveLifecycleStatus, CreditAnalysisListItem, CreditAnalysisListResult, listCreditAnalyses, CreditAnalysisDetail, getCreditAnalysisDetail |
| Has TODO | N |
| Purpose | Server-side credit-analysis data access. RLS-aware via withRls on writes (see actions.ts); reads are plain queries (the GUCs set by withRls are no-ops on tables without RLS enabled). All functions are safe to call from Server Components. |

#### `app/src/features/credit/ratingBands.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 79 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (3) | RatingAgency, rankToBand, bandToAgencySymbol |
| Has TODO | N |
| Purpose | Pure rating-band helpers - the DB-free subset of ratingMap.ts.  `ratingMap.ts` historically bundled the pure cross-agency ordinal→band mapping with the DB-backed ladder loader (`loadLadder`/`resolveRung`, which import `@/db`). Anything that imported even the pure helpers - notably the Investor Matching Engine (`features/matching/engine.ts`), which is consumed by a client component - transitively p |

#### `app/src/features/credit/ratingMap.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 264 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (12) | RatingScale, LadderRung, bandToCanonicalRank, coreSymbolToRank, agencySymbolToRank, symbolToBand, loadLadder, resetLadderCache |
| Has TODO | N |
| Purpose | Indian rating-agency scale mapping (CREDIT_ANALYSIS_SPEC §5).  Bridges the seven Indian CRAs (CRISIL, ICRA, CARE, India Ratings, Acuite, Infomerics, Brickwork) to a normalized internal scale BC-1 … BC-6 using the `rating_ladder` table (schema §2.23.7). The rating_ladder table is the system of record and is editable (agencies refine scales); this module loads it at request time and falls back to th |

#### `app/src/features/credit/ratios.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 478 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (10) | LineItemCode, readLineItems, RatioSet, PERSISTABLE_RATIO_CODES, computeRatios, ratioSetToResultRows, FORMULA_SNAPSHOTS, ratioCategory |
| Has TODO | N |
| Purpose | Ratio engine - computes the Binary Capital ratio library (CREDIT_ANALYSIS_SPEC §3) from a single financial_statement period, with optional prior-period statement for averaging (ROE / ROA / ROCE / debtor / creditor / inventory days).  Line items are read from financial_statement.line_items (jsonb) keyed by a canonical `crisil_lineitem_code`-style code set defined below. Values may be stored as numb |

#### `app/src/features/credit/scorecard.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 462 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (12) | ObligorType, Band, SubFactor, ScorecardResult, resolveWeights, defaultBaseWeights, bandFromScore, BAND_GRADE |
| Has TODO | N |
| Purpose | Scorecard scoring - weighted 0-100 scorecard with band mapping (CREDIT_ANALYSIS_SPEC §4).  Formula (spec §4.1): total_score = Σᵢ [ weightᵢ × (sub_scoreᵢ / 5) ] × 100, sub_score ∈ {1..5}, Σ weights = 1.0. Equivalent: total_score = Σ(component_score × component_weight) × 20, which is what the credit_score.weighted_score generated column (component_score × component_weight) rolls up to - so persistin |

### Domain: `dashboard`

PRD: **M10 Dashboard & Reporting**

#### `app/src/features/dashboard/.gitkeep`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 1 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | high |
| Exports (0) | — |
| Has TODO | N |
| Purpose | dashboard — placeholder. Implementation after design docs finalized. |

#### `app/src/features/dashboard/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 530 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (7) | DashboardKpis, DashboardRecentDeal, DashboardRecentInteraction, DashboardChartData, DashboardData, getDashboardKpis, getDashboardData |
| Has TODO | N |
| Purpose | Server-side dashboard data access.  The command-center dashboard mixes headline KPIs, recent rows, and chart aggregates. Every loader accepts the current user and applies the same party/deal/interaction visibility model as the underlying feature pages. |

### Domain: `deals`

PRD: **M2 Mandate Pipeline**

#### `app/src/features/deals/.gitkeep`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 1 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | high |
| Exports (0) | — |
| Has TODO | N |
| Purpose | deals — placeholder. Implementation after design docs finalized. |

#### `app/src/features/deals/allocations.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 150 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (8) | ALLOC_EVENT_FLOW, ALLOC_EVENT_TERMINAL, ALLOC_EVENT_WITHDRAWABLE, allocEventIndex, isAllocEventTerminal, canTransitionAllocEvent, isAllocationDeal, isValidAllocEventForDealType |
| Has TODO | N |
| Purpose | Allocation-event semantics for book-built / auction mandates.  `allocation_event` is an IMMUTABLE append-only event-sourced table (src/db/schema/deals.ts §2.11). The current allocation state per (deal_id, party_id) is derived by replaying these events. This module encodes the business-logic rules the mutation layer must enforce BEFORE appending an event: - which deal types run an allocation book a |

#### `app/src/features/deals/catalog.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 341 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (14) | DealType, DealStatus, DealPartyRole, AllocEventType, DealFamily, BrandAffinity, CreditCharacter, DealTypeSpec |
| Has TODO | N |
| Purpose | Deal-type catalog - the verified Binary Capital / Binary Bonds service map.  Source of truth for "which deal types does this CRM model, and is each one business-logic appropriate for BC?": scrape/BUSINESS_CONTEXT.md §2-3 and docs/CREDIT_ANALYSIS_SPEC.md / FINANCIAL_MODELING_SPEC.md. The schema enum (src/db/schema/enums.ts `dealTypeEnum`) is the DB-level constraint; this module is the domain-level  |

#### `app/src/features/deals/index.ts`

| Field | Value |
|---|---|
| Role | `module-api` — Barrel / types export for feature module |
| LOC | 15 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Deals feature barrel - re-exports the query layer + the per-deal-type domain-logic modules (catalog, stages, roles, allocations).  The query layer (queries.ts) loads the pipeline; the domain modules encode the verified Binary Capital / Binary Bonds business logic (which deal types are appropriate, the per-type stage ladder, the per-type party roles + lead role, and the allocation-event semantics). |

#### `app/src/features/deals/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 315 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (6) | DealPipelineRow, DealPipelineGroup, DealPipelineResult, DealPipelineFilters, DEFAULT_PER_STAGE, getDealPipeline |
| Has TODO | N |
| Purpose | Server-side deal data access. Pipeline view: deals grouped by status with their deal_party parties inlined.  PAGINATION: the pipeline is capped at `perStage` deals per status via a ROW_NUMBER() window (default 40 - see DEFAULT_PER_STAGE). A total LIMIT would pile the first N deals into the earliest stage and leave later stages empty, which breaks the kanban's balanced funnel; partitioning by statu |

#### `app/src/features/deals/roles.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 319 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (5) | DealRoleSpec, DEAL_TYPE_ROLES, validRolesForDealType, leadRoleForDealType, isValidRoleForDealType |
| Has TODO | N |
| Purpose | Per-deal-type deal_party roles + the lead role for each deal type.  The schema's `deal_party_role` enum is a flat superset of every role across every deal type (issuer, arranger, underwriter, investor, book_runner, lead_manager, syndicate_member, allocator, guarantor, trustee, registrar, rating_agency, legal_counsel, auditor, escrow_agent, selling_broker, buy_side_advisor, sell_side_advisor, targe |

#### `app/src/features/deals/stages.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 450 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (10) | OFF_PIPELINE_STATUSES, OffPipelineStatus, DealStageFlow, DEAL_STAGE_FLOWS, stageLadderFor, stageSemanticsFor, stageIndexInFlow, isOffPipelineStatus |
| Has TODO | N |
| Purpose | Per-deal-type stage flows (the deal pipeline ladder per mandate type).  The schema's `deal_status` enum is a single flat set of pipeline stages (lead, mandated, in_dd, structuring, rating_marketing, pricing, allocation, settled, closed + off-pipeline dropped/on_hold). A flat enum is necessary at the DB level but is NOT business-logic appropriate on its own: a G-Sec auction does not go through "str |

### Domain: `documents`

PRD: **M9 Documents**

#### `app/src/features/documents/.gitkeep`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 1 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | high |
| Exports (0) | — |
| Has TODO | N |
| Purpose | documents — placeholder. Implementation after design docs finalized. |

#### `app/src/features/documents/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 148 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | CreateDocumentState, createDocument |
| Has TODO | N |
| Purpose | Exports: CreateDocumentState, createDocument |

#### `app/src/features/documents/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 377 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (11) | DocumentListItem, DocumentListResult, listDocuments, DocumentDetail, getDocumentDetail, DealOption, PartyOption, ContactOption |
| Has TODO | N |
| Purpose | Server-side document data access (DATA_MODEL §2.20). The document table is metadata only - the file blob lives in S3-compatible object storage with file_store_ref as the key. KYC documents are encryption-at-rest + access- logged separately (ARCHITECTURE §4.3). barrier_id is the information-wall tag for RLS; is_mnpi disables download/copy/email-forward in the UI. RLS- aware once policies are migrat |

### Domain: `integrations`

PRD: **P3/P4 Integrations**

#### `app/src/features/integrations/accountAggregator.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 297 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (6) | AccountAggregatorConsentRequest, FipFi, AccountAggregatorData, buildAccountAggregatorSample, AccountAggregatorClient, accountAggregator |
| Has TODO | N |
| Purpose | Account Aggregator (AA) adapter.  §11: open architecture; Binary onboards as a Financial Information User (FIU) via Sahamati. ~17 AAs, ~179 FIPs, ~955 FIUs as of 2026. ReBIT + Sahamati Central Registry govern API standards. Highest-value, most feasible credit-analysis feed - Phase-1 priority.  Real flow: Binary (FIU) requests a consent handle from an AA; the customer approves via the AA app; the F |

#### `app/src/features/integrations/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 99 |
| Runtime | server |
| Uses DB | N |
| Maturity | partial |
| Criticality | high |
| Exports (4) | runIntegrationMock, runAllIntegrationMocks, runIntegration, runAllIntegrations |
| Has TODO | N |
| Purpose | Exports: runIntegrationMock, runAllIntegrationMocks, runIntegration, runAllIntegrations |

#### `app/src/features/integrations/bseNse.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 246 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (5) | DebtTrade, DebtTradeReport, buildBseNseSample, BseNseClient, bseNse |
| Has TODO | N |
| Purpose | BSE / NSE debt-segment trade reporting adapter.  §11: MEMBER-ONLY; NO public open API. Member-access terminals + member- portal files (NSE Member/CM Download, Bhavcopy) rather than generic REST. Binary's membership UNVERIFIED - likely acts as arranger/advisory, not member. If NOT a member (likely), rely on licensed delayed feeds or manual entry - scope OUT.  Access to swap for real: Binary must be |

#### `app/src/features/integrations/ccil.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 215 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (5) | FtracRecord, FtracReport, buildCcilSample, CcilClient, ccil |
| Has TODO | N |
| Purpose | CCIL F-TRAC trade reporting adapter.  §11: MEMBER WORKFLOW, not public API. CCIL acts as Trade Repository via F-TRAC (ftrac.co.in); reporting members access via login. Binary is NOT a direct CCIL member (membership for banks/PDs/FIs with RBI approval); any CCIL-settled trades clear through a sponsoring bank/PD member.  Access to swap for real: Binary must be a CCIL member/reporting entity. ADVERSA |

#### `app/src/features/integrations/ckyc.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 240 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (6) | CkycLookupRequest, CkycRecord, CkycData, buildCkycSample, CkycClient, ckyc |
| Has TODO | N |
| Purpose | CKYC Registry (CERSAI) adapter.  §11: CKYCRR 2.0 launched with REAL-TIME API (CERSAI notification 5 Jun 2026; prior CKYCRR 1.0 used batch-file/SFTP). Protean and other vendors offer CKYCR API integration.  Access to swap for real: Binary onboarded as Reporting Entity with CERSAI; API credentials + onboarding. Exact API spec/endpoint TO CONFIRM directly with CERSAI. Real-time API is recent (Jun 202 |

#### `app/src/features/integrations/demat.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 194 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (5) | DematHolding, DematAccount, buildDematSample, DematClient, demat |
| Has TODO | N |
| Purpose | CDSL / NSDL depository (demat) adapter.  §11: DP-system access ONLY for SEBI-registered Depository Participants + empaneled software vendors (NSDL SPEED-e, CDSL easi/easiest, STP segments). NO open demat API for non-DP. Binary's DP registration UNVERIFIED - likely NOT a DP.  Access to swap for real: Binary must be a SEBI-registered DP (or work through one). ADVERSARIAL CHECK: DP registration UNVER |

#### `app/src/features/integrations/emailCalendar.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 236 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (6) | EmailMessage, CalendarEvent, EmailCalendarData, buildEmailCalendarSample, EmailCalendarClient, emailCalendar |
| Has TODO | N |
| Purpose | Email / Calendar adapter (Microsoft Graph / Google Workspace).  §11: SELF-SERVE for the customer's tenant via OAuth2. Well-documented APIs (Google Workspace Gmail+Calendar API, Microsoft Graph). Binary consents via OAuth2 (vendor acts as processor); restricted-scope verification for Gmail API. Customer-tenant admin consent. Communication retention/archive needed for SEBI/RBI record-keeping.  Acces |

#### `app/src/features/integrations/env.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 460 |
| Runtime | client |
| Uses DB | N |
| Maturity | partial |
| Criticality | high |
| Exports (17) | AdapterId, IntegrationErrorCode, IntegrationError, envKeysPresent, requireEnv, optionalEnv, isMockMode, AdapterCredentialSpec |
| Has TODO | N |
| Purpose | Shared environment + HTTP plumbing for integration adapters.  This module is the single source of truth for: • the USE_MOCK_INTEGRATIONS toggle (default: true in dev, false in prod when credentials are present), • per-adapter credential discovery against the keys already declared in `.env.example` (plus a small set of additional keys documented in the adapter headers below - they are read via `pro |

#### `app/src/features/integrations/fiuInd.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 332 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (9) | FiuIndData, FiuIndGenerateRequest, FiuIndSubmitRequest, escapeXml, buildStrXml, buildCtrXml, generateFiuIndXml, FiuIndClient |
| Has TODO | N |
| Purpose | FIU-IND FINnet 2.0 adapter (STR/CTR XML generation + filing).  §11: CONFIRMED. Filing via FINGate 2.0 portal (https://fingate.gov.in) in batch XML format (NOT CSV). FIU-IND provides Excel templates + Report Generation/Validation Utilities that produce XML. CTR threshold INR 10 lakh (Rule 3 PML Rules 2005); STR within 7 working days.  Access to swap for real: Binary's reporting-entity registration  |

#### `app/src/features/integrations/gstinPan.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 257 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (6) | GstinVerification, PanVerification, GstinPanData, buildGstinPanSample, GstinPanClient, gstinPan |
| Has TODO | N |
| Purpose | GSTIN + PAN verification adapter.  §11: GSTIN - free public "Search Taxpayer" page (services.gst.gov.in, CAPTCHA-gated); programmatic via GST Suvidita Providers (GSPs) + ASPs on per-API-call fee. PAN - via NSDL/UTIITSL/Protean PAN verification service (regulated, per-call fee) or via CKYC.  Access to swap for real: GSP/ASP license for programmatic GSTIN; NSDL/ Protean PAN verification API credenti |

#### `app/src/features/integrations/kra.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 205 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (6) | KraLookupRequest, KraRecord, KraData, buildKraSample, KraClient, kra |
| Has TODO | N |
| Purpose | SEBI KRA adapter (CVL / CAMS / Kfintech / NDML).  §11: KRAs provide APIs for upload/download/modify of KYC records to SEBI-registered intermediaries. SEBI Circular SEBI/HO/MIRSD/SECFATF/P/CIR/ 2024/79 (6 Jun 2024) governs KRA uploads to CKYCRR. CDSL APIs page confirms CVL KRA APIs.  Access to swap for real: Binary's SEBI registration + KRA onboarding/API credentials. Vendor integrates as processor |

#### `app/src/features/integrations/mca.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 191 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (5) | McaLookupRequest, McaData, buildMcaSample, McaClient, mca |
| Has TODO | N |
| Purpose | MCA21 company master + financials adapter.  §11: NO official open API. Access via MCA portal paid downloads (per-company fee) or third-party aggregators (Tofler, Zauba, Perfins). MCA API URLs returned 403 in research. Portal-scraping is legally risky - avoid.  Access to swap for real: licensed third-party aggregator API subscription (per-call or bulk). Vendor integrates against the aggregator's RE |

#### `app/src/features/integrations/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 43 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | listIntegrationsCached, getIntegrationStatusCounts |
| Has TODO | N |
| Purpose | Cached integration-status data access for the /integrations page.  The adapter registry itself is in-process (src/features/integrations/registry.ts) and its summaries are derived from env + the static adapter list, so they are stable for the lifetime of a deploy and cheap to recompute. We still wrap them in Next's unstable_cache (revalidate 300s / 5 minutes) so a cache hit on the status page skips |

#### `app/src/features/integrations/ratingFeed.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 220 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (5) | RatingAction, RatingFeedData, buildRatingFeedSample, RatingFeedClient, ratingFeed |
| Has TODO | N |
| Purpose | Rating-agency feed adapter (CRISIL / ICRA / CARE Edge / India Ratings / Brickwork).  §11: LICENSED COMMERCIAL DATA, not open. Sold via rating agencies' subscription products or redistributors (Bloomberg/Refinitiv). Low technical risk; cost is the dominant constraint.  Access to swap for real: commercial license agreement with one or more agencies (typical for a bond house). Significant annual lice |

#### `app/src/features/integrations/registry.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 154 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | partial |
| Criticality | high |
| Exports (10) | integrationRegistry, integrationsById, IntegrationSummary, listIntegrations, getAdapter, runAdapterMock, runAdapter, runMock |
| Has TODO | N |
| Purpose | Integration adapter registry.  Single source of truth for the set of India-regulatory / financial-data integrations the CRM must support (per §11 of COMPLIANCE_LEGAL_FEASIBILITY.md). Each adapter ships BOTH a real API client class (typed request/response, env-credential loading, fetch with timeout + retry + structured errors) AND a mock implementation that returns the realistic sample data the UI  |

#### `app/src/features/integrations/types.ts`

| Field | Value |
|---|---|
| Role | `module-api` — Barrel / types export for feature module |
| LOC | 123 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | partial |
| Criticality | medium |
| Exports (5) | AdapterStatus, AdapterResult, AdapterInput, IntegrationAdapter, errorResult |
| Has TODO | N |
| Purpose | Shared types for integration adapters.  Every adapter in this directory implements `IntegrationAdapter`. Each adapter ships BOTH a real API client class (typed request/response, env-credential loading, fetch with timeout + retry + structured errors) AND a mock implementation that returns the realistic sample data the UI screens use.  Which one the registry/Server Actions invoke is driven by env (s |

#### `app/src/features/integrations/whatsapp.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 253 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (6) | WhatsappMessage, WhatsappData, WhatsappSendRequest, buildWhatsappSample, WhatsappClient, whatsapp |
| Has TODO | N |
| Purpose | WhatsApp Business API adapter.  §11: OPEN via Meta Cloud API or BSPs (solution partners). Self-serve. Meta Business account + template approval; BSP if using a solution partner. Opt-in/opt-out registry required. Per-24h-conversation pricing by category (marketing/utility/authentication), India-specific rates set by Meta (TO CONFIRM). Template approval + RBI/SEBI communication-record retention rule |

### Domain: `interactions`

PRD: **M1 Relationship 360**

#### `app/src/features/interactions/.gitkeep`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 1 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | high |
| Exports (0) | — |
| Has TODO | N |
| Purpose | interactions — placeholder. Implementation after design docs finalized. |

#### `app/src/features/interactions/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 223 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (4) | CreateInteractionState, createInteraction, UpdateInteractionState, updateInteraction |
| Has TODO | N |
| Purpose | Exports: CreateInteractionState, createInteraction, UpdateInteractionState, updateInteraction |

#### `app/src/features/interactions/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 364 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (13) | InteractionListItem, InteractionListFilters, InteractionListResult, listInteractions, InteractionAttendeeRow, InteractionDetail, getInteractionDetail, PartyOption |
| Has TODO | N |
| Purpose | Server-side interaction data access (DATA_MODEL §2.18). An interaction anchors to ≥1 of party/deal/contact (CHECK num_nonnulls >= 1), links attendees via the interaction_attendee junction, and is walled by barrier_id when it contains MNPI. RLS-aware once policies are migrated; until then these are plain queries (the GUCs set by withRls are no-ops on tables without RLS enabled). All functions are s |

### Domain: `leads`

PRD: **M2 Pipeline (pre-mandate)**

#### `app/src/features/leads/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 701 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (18) | CreateLeadState, createLead, UpdateBantState, updateBant, ConvertState, convertToOpportunity, FieldState, updateProbability |
| Has TODO | N |
| Purpose | Exports: CreateLeadState, createLead, UpdateBantState, updateBant, ConvertState, convertToOpportunity, FieldState, updateProbability, updateExpectedClose, updateAssignedRm, WinState, winLead… |

#### `app/src/features/leads/index.ts`

| Field | Value |
|---|---|
| Role | `module-api` — Barrel / types export for feature module |
| LOC | 46 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Lead & Opportunity Management - feature barrel.  Re-exports the domain types/constants, the icon resolver, the server data access, and the server actions so app routes import from one path. |

#### `app/src/features/leads/lead-icons.tsx`

| Field | Value |
|---|---|
| Role | `feature-ui` — Feature-scoped UI component |
| LOC | 121 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (3) | LeadDealTypeIcon, leadDealTypeTone, LeadSourceIcon |
| Has TODO | N |
| Purpose | Exports: LeadDealTypeIcon, leadDealTypeTone, LeadSourceIcon |

#### `app/src/features/leads/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 668 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (17) | RmOption, LeadRow, LeadPipelineGroup, LeadContact, LeadTask, LeadDetail, normalizeLead, listRms |
| Has TODO | N |
| Purpose | Lead & Opportunity Management - server-side data access.  Storage: a JSONB `lead_meta` column on party (migration 0006). A party is a lead iff lead_meta IS NOT NULL. Because lead_meta is not in the frozen Drizzle schema (the schema layer owns src/db/schema/*), the lead read paths use parameterised raw SQL via `db.execute(sql\`...\`)` - postgres-js parses the jsonb column into a JS object and times |

#### `app/src/features/leads/seed.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 359 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Lead & Opportunity Management - seed.  Run AFTER the main seed (src/db/seed.ts):  npx tsx src/features/leads/seed.ts  Populates party.lead_meta (migration 0006) with a realistic Indian bond-house lead pipeline: ~30 prospect parties promoted into leads across the full funnel (new → qualified → opportunity → won/lost), plus a handful of existing-client leads attached to active issuer/investor partie |

#### `app/src/features/leads/types.ts`

| Field | Value |
|---|---|
| Role | `module-api` — Barrel / types export for feature module |
| LOC | 265 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (24) | LeadStage, LeadSource, LeadDealType, BantQualification, LeadMeta, LEAD_STAGE_ORDER, LEAD_STAGE_LABELS, LEAD_STAGE_HINTS |
| Has TODO | N |
| Purpose | Lead & Opportunity Management - shared types + domain constants.  A lead is a prospect relationship the firm is qualifying toward a mandate. Storage: a JSONB `lead_meta` column on party (migration 0006_leads.sql). A party is a lead iff party.lead_meta IS NOT NULL. See the migration header for the full design rationale (single source of truth = party master; the JSONB blob carries the lead-specific |

### Domain: `matching`

PRD: **M5 Investor Match**

#### `app/src/features/matching/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 230 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (3) | SendToDealInput, SendToDealResult, sendToDeal |
| Has TODO | N |
| Purpose | Server actions for the Investor Matching Engine.  sendToDeal - the workspace's primary CTA. Takes a selected issuer + a set of matched investors and either (a) creates a new bond-underwriting mandate with the issuer as the lead deal_party and each selected investor as an investor deal_party carrying their indicated commitment, or (b) links the investors to an existing deal (adding deal_party rows, |

#### `app/src/features/matching/engine.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 712 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (26) | CriterionKey, CRITERIA_ORDER, CRITERION_LABEL, CRITERION_TAG, SCORE_WEIGHTS, InvestorKind, IssuerProfile, InvestorProfile |
| Has TODO | N |
| Purpose | Investor Matching Engine - the USP of the Binary Capital CRM.  Given an issuer (a party with type=issuer + their latest external_rating + sector + a deal carrying tenor + target_size), score every investor (party with type=investor) against seven criteria and rank them. This is the feature that makes the CRM worth building custom vs buying Salesforce: it turns the firm's 150+ institutional-investo |

#### `app/src/features/matching/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 875 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (10) | IssuerSummary, MatchResult, getMatchableIssuers, getIssuerMatchProfile, loadInvestorProfiles, getWarmIntroPath, getWarmIntroByInvestor, getInvestorMatches |
| Has TODO | N |
| Purpose | Server-side data access for the Investor Matching Engine.  Builds the IssuerProfile + InvestorProfile shapes the pure engine (engine.ts) scores, by deriving investor preferences from the LIVE schema:  - rating floor  → the worst (max rank) external_rating among issuers the investor has bought via deal_party(role=investor); falls back to the kind-based default when there is no history. - tenor rang |

### Domain: `modeling`

PRD: **M4 Financial Modeling**

#### `app/src/features/modeling/.gitkeep`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 1 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | high |
| Exports (0) | — |
| Has TODO | N |
| Purpose | modeling - placeholder. Implementation after design docs finalized. |

#### `app/src/features/modeling/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 194 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | CreateModelState, createModel |
| Has TODO | N |
| Purpose | Exports: CreateModelState, createModel |

#### `app/src/features/modeling/bondPricing.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 743 |
| Runtime | server |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (12) | DayCount, InstrumentType, BondInputs, CashFlow, BondMetrics, computeBondMetrics, InstrumentDefaults, instrumentDefaults |
| Has TODO | N |
| Purpose | Bond pricing & fixed-income analytics - Indian conventions. Source of truth: /home/Jashmhta/crm/docs/FINANCIAL_MODELING_SPEC.md §1.  This is a PURE TypeScript library (no "use server", no DB, no React) so it can run identically in a Server Component, a Server Action, and a Client Component for the interactive calculator. The math is deterministic and side-effect free.  Conventions implemented (FIN |

#### `app/src/features/modeling/dcf.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 199 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (10) | WaccInputs, FcffInputs, TerminalInputs, DcfResult, costOfEquity, computeWacc, EquityBridgeInputs, equityBridge |
| Has TODO | N |
| Purpose | Quick DCF / WACC calculator (FINANCIAL_MODELING_SPEC §4). Screening-stage valuation range before the banker builds the full model. The full DCF with peer set stays in Excel alongside (§4.5, §7.2). |

#### `app/src/features/modeling/lboModel.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 526 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (13) | LboTrancheInput, LboInputs, LboTrancheSchedule, LboSourcesAndUses, LboPeriodRow, LboSensitivityCell, LboResult, computeLbo |
| Has TODO | N |
| Purpose | LBO screening model - sources & uses, multi-tranche debt schedule with cash sweep, sponsor IRR + MOIC, and an entry×exit multiple sensitivity grid (FINANCIAL_MODELING_SPEC §6). A sponsor's first-pass LBO: capitalization, annual debt service with mandatory amortization + excess-cash sweep, exit at a hold-period multiple, and the returns to the sponsor's equity cheque. The full LBO with covenant mod |

#### `app/src/features/modeling/maModel.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 542 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (22) | MaAcquirerInputs, MaTargetInputs, MaConsideration, MaDealInputs, MaInputs, MaSourceItem, MaUseItem, MaSourcesAndUses |
| Has TODO | N |
| Purpose | M&A screening model - accretion/dilution + goodwill + acquirer deal IRR (FINANCIAL_MODELING_SPEC §5). A banker's first-pass M&A model: Sources & Uses, purchase-price allocation to goodwill (IFRS 3 / Ind AS 103 acquisition method), pro-forma EPS accretion/dilution, and the acquirer's IRR on the total capital deployed. The full merger model with purchase accounting schedules, stepping synergies, and |

#### `app/src/features/modeling/projectFinance.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 358 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (4) | ProjectFinanceInputs, PeriodResult, ProjectFinanceResult, computeProjectFinance |
| Has TODO | N |
| Purpose | Quick project-finance calculator - single-tranche, single-tenor sketch for mandate screening (FINANCIAL_MODELING_SPEC §2). Full multi-tranche sculpting stays in Excel alongside (§2.7, §7.2); this gives a decision-speed answer.  Implements: CFADS build, periodic DSCR, min/avg DSCR, LLCR (discounted at the cost of debt Kd - NOT WACC, per §2.3), PLCR, and debt sizing/sculpting for a target DSCR with  |

#### `app/src/features/modeling/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 241 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (5) | ModelListItem, ModelListResult, listModels, ModelDetail, getModelDetail |
| Has TODO | N |
| Purpose | Server-side financial-model data access (FINANCIAL_MODELING_SPEC §6, §7.1). Reads the `financial_model` table (§2.17) and joins deal/party for the library list and detail views. RLS-aware once policies are migrated; until then these are plain queries (withRls GUCs are no-ops on tables without RLS). |

#### `app/src/features/modeling/scenarioAnalysis.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 651 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (20) | ScenarioModelType, DriverUnit, OutcomeFormat, DriverSpec, ScenarioOutcome, ScenarioModelDef, ScenarioCases, DriverState |
| Has TODO | N |
| Purpose | Scenario analysis - best / base / worst case views + two-variable sensitivity grids for every pure-function model in the modelling desk (FINANCIAL_MODELING_SPEC §9). A registry wraps each engine's compute function behind a uniform driver abstraction: the banker flexes a small set of key drivers across their [min, max] range, and the module returns the corner-case outcomes (all drivers at their imp |

#### `app/src/features/modeling/securitization.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 206 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (5) | TrancheInput, SecuritizationInputs, TrancheResult, SecuritizationResult, computeSecuritization |
| Has TODO | N |
| Purpose | Quick securitization / structured-finance sizing calculator (FINANCIAL_MODELING_SPEC §3). Mandate-screening sketch: tranche sizing + credit enhancement (OC, subordination, cash reserve) + waterfall summary. The full monthly-vector waterfall with default curves stays in Excel (§3.5). |

### Domain: `onboarding`

PRD: **M1/M7 Onboarding**

#### `app/src/features/onboarding/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 855 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (20) | CreateOnboardingState, createOnboarding, AdvanceStageState, advanceStage, StartKycState, startKyc, DocUploadState, markDocumentUploaded |
| Has TODO | N |
| Purpose | Exports: CreateOnboardingState, createOnboarding, AdvanceStageState, advanceStage, StartKycState, startKyc, DocUploadState, markDocumentUploaded, DocVerifyState, verifyDocument, rejectDocument, ComplianceState… |

#### `app/src/features/onboarding/index.ts`

| Field | Value |
|---|---|
| Role | `module-api` — Barrel / types export for feature module |
| LOC | 55 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Client Onboarding - feature barrel.  Re-exports the domain types/constants, the icon resolver, the server data access, and the server actions so app routes import from one path. |

#### `app/src/features/onboarding/onboarding-icons.tsx`

| Field | Value |
|---|---|
| Role | `feature-ui` — Feature-scoped UI component |
| LOC | 100 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (4) | ONBOARDING_STAGE_ICON_TONE, OnboardingDocIcon, OnboardingStageIcon, onboardingStageTone |
| Has TODO | N |
| Purpose | Exports: ONBOARDING_STAGE_ICON_TONE, OnboardingDocIcon, OnboardingStageIcon, onboardingStageTone |

#### `app/src/features/onboarding/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 695 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (18) | RmOption, OnboardingKycState, OnboardingRow, OnboardingPipelineGroup, OnboardingContact, OnboardingTask, OnboardingDetail, normalizeOnboarding |
| Has TODO | N |
| Purpose | Client Onboarding - server-side data access.  Storage: a JSONB `onboarding_meta` column on party (migration 0007). A party is an onboarding case iff onboarding_meta IS NOT NULL. Because onboarding_meta is not in the frozen Drizzle schema (the schema layer owns src/db/schema/*), the onboarding read paths use parameterised raw SQL via `db.execute(sql\`...\`)` - postgres-js parses the jsonb column in |

#### `app/src/features/onboarding/seed.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 458 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Client Onboarding - seed.  Run AFTER the main seed (src/db/seed.ts):  npx tsx src/features/onboarding/seed.ts  Populates party.onboarding_meta (migration 0007) with a realistic Indian bond-house onboarding pipeline: ~28 prospect parties created fresh and promoted across the full funnel (initiated → profile_created → documents_collected → kyc_verified → compliance_approved → active), each with a 7- |

#### `app/src/features/onboarding/types.ts`

| Field | Value |
|---|---|
| Role | `module-api` — Barrel / types export for feature module |
| LOC | 515 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (37) | OnboardingStage, OnboardingClientType, OnboardingDocKey, OnboardingDocStatus, OnboardingDocVerification, OnboardingDocItem, OnboardingStageEntry, OnboardingMeta |
| Has TODO | N |
| Purpose | Client Onboarding - shared types + domain constants.  Onboarding is the workflow that turns a prospect into an active, KYC-cleared, compliance-approved client of the Indian bond house / IB (Binary Capital / Binary Bonds). Storage: a JSONB `onboarding_meta` column on party (migration 0007_onboarding.sql). A party is an onboarding case iff party.onboarding_meta IS NOT NULL. See the migration header  |

### Domain: `parties`

PRD: **M1 Relationship 360**

#### `app/src/features/parties/.gitkeep`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 1 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | high |
| Exports (0) | — |
| Has TODO | N |
| Purpose | parties — placeholder. Implementation after design docs finalized. |

#### `app/src/features/parties/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 349 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (5) | CreatePartyState, PartyActionState, createParty, assignParty, updatePartySegmentation |
| Has TODO | N |
| Purpose | Exports: CreatePartyState, PartyActionState, createParty, assignParty, updatePartySegmentation |

#### `app/src/features/parties/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 717 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (12) | PartyListItem, PartyListSummary, getPartyListSummary, PartyListResult, PartyListFilters, listParties, PartyDetail, getPartyDetail |
| Has TODO | N |
| Purpose | Server-side party data access. RLS-aware once policies are migrated; until then these are plain queries (the GUCs set by withRls are no-ops on tables without RLS enabled). All functions are safe to call from Server Components. |

#### `app/src/features/parties/segmentation.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 163 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (15) | TURNOVER_BANDS, TurnoverBand, TURNOVER_BAND_LABELS, INDUSTRY_SECTORS, IndustrySector, INDUSTRY_SECTOR_LABELS, RATING_VALUES, RATING_AGENCIES |
| Has TODO | N |
| Purpose | Exports: TURNOVER_BANDS, TurnoverBand, TURNOVER_BAND_LABELS, INDUSTRY_SECTORS, IndustrySector, INDUSTRY_SECTOR_LABELS, RATING_VALUES, RATING_AGENCIES, RATING_AGENCY_LABELS, INVESTOR_TYPES, INVESTOR_TYPE_LABELS, PORTFOLIO_SIZE_BANDS… |

### Domain: `portal`

PRD: **P3 Retail/Investor portal**

#### `app/src/features/portal/index.ts`

| Field | Value |
|---|---|
| Role | `module-api` — Barrel / types export for feature module |
| LOC | 45 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Investor & Client Portals - feature barrel.  Re-exports the read-only server queries (data access) + the lazy client chart wrappers (recharts) + the shared types so the portal pages import from a single path. No server actions live here - both portals are strictly read-only. |

#### `app/src/features/portal/portal-charts-impl.tsx`

| Field | Value |
|---|---|
| Role | `feature-ui` — Feature-scoped UI component |
| LOC | 350 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (6) | DonutPoint, LabelValuePoint, PORTAL_PALETTE, PortalDonutChart, PortalHBarChart, PortalVBarChart |
| Has TODO | N |
| Purpose | Exports: DonutPoint, LabelValuePoint, PORTAL_PALETTE, PortalDonutChart, PortalHBarChart, PortalVBarChart |

#### `app/src/features/portal/portal-charts.tsx`

| Field | Value |
|---|---|
| Role | `feature-ui` — Feature-scoped UI component |
| LOC | 55 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (3) | PortalDonutChart, PortalHBarChart, PortalVBarChart |
| Has TODO | N |
| Purpose | Exports: PortalDonutChart, PortalHBarChart, PortalVBarChart |

#### `app/src/features/portal/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 1452 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (21) | InvestorListItem, InvestorListSummary, listInvestors, InvestorHolding, InvestorAllocationHistoryRow, InvestorDematAccount, InvestorKyc, InvestorPartyInfo |
| Has TODO | N |
| Purpose | Investor & Client Portals - read-only server-side data access.  Two external-facing portals over the same party master + deals + KYC + documents tables the internal CRM uses:  INVESTOR PORTAL (src/app/portal/investor/*) An investor party sees the bond book Binary placed for it: holdings derived from allocation_event (event_type allocated/settled) joined to the deal, the issuer (deal_party role='is |

### Domain: `portfolio`

PRD: **M6/Portfolio (secondary+limits)**

#### `app/src/features/portfolio/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 161 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | UpdateLimitState, updateLimit |
| Has TODO | N |
| Purpose | Exports: UpdateLimitState, updateLimit |

#### `app/src/features/portfolio/index.ts`

| Field | Value |
|---|---|
| Role | `module-api` — Barrel / types export for feature module |
| LOC | 73 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Portfolio & Exposure Analytics - feature barrel.  Re-exports the query types + the updateLimit server action so the app layer imports from one path. The risk math (./risk) is re-exported here too for tests, but the app pages import the aggregate types from ./queries. |

#### `app/src/features/portfolio/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 1444 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (38) | RATING_BAND_ORDER, RbiSectoralLimit, RBI_SECTORAL_LIMITS, RBI_SINGLE_BORROWER_CAP_PCT, RBI_GROUP_CAP_PCT, HOUSE_ELEVATED_NAME_PCT, HOUSE_HIGH_NAME_PCT, ExposureByTypeRow |
| Has TODO | N |
| Purpose | Portfolio & Exposure Analytics - server-side data access.  READ-ONLY aggregate queries powering the four portfolio pages (overview, concentration, risk-metrics, limits). They reuse the existing `exposure` + `credit_limit` tables (DATA_MODEL §2.16) plus `party`, `sector_code`, `external_rating`, and `instrument`. The aggregates are raw SQL (GROUP BY + CTE + window + jsonb/Pivot via `filter (where . |

#### `app/src/features/portfolio/risk.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 341 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (14) | couponDecimal, macaulayDuration, modifiedDuration, convexity, bondDv01Rupees, RiskPosition, PortfolioRiskMetrics, VAR_ASSUMPTIONS |
| Has TODO | N |
| Purpose | Portfolio risk math - simplified, decision-speed analytics for the desk. (FINANCIAL_MODELING_SPEC spirit: a screening-grade answer, not a full OAS / key-rate model. The full duration/KRD/OAS work stays in Excel / Bloomberg alongside.)  Per-bond Macaulay + modified duration + convexity from tenor + coupon + yield (par-bond assumption: when no market yield is stored we take yield ≈ coupon, which is  |

### Domain: `reports`

PRD: **M10 Dashboard & Reporting**

#### `app/src/features/reports/export-button.tsx`

| Field | Value |
|---|---|
| Role | `feature-ui` — Feature-scoped UI component |
| LOC | 85 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | ExportCsvButtonProps, ExportCsvButton |
| Has TODO | N |
| Purpose | Exports: ExportCsvButtonProps, ExportCsvButton |

#### `app/src/features/reports/export.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 184 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (9) | rowsToCsv, exportFilename, csvDisposition, formatCr, compactCr, RatingTier, ratingTier, ratingTierColor |
| Has TODO | N |
| Purpose | CSV export utility for the Reports & Export module.  `rowsToCsv` is a PURE function - given an array of rows and an ordered list of column definitions (header + value accessor), it produces an RFC 4180- compliant CSV string with a UTF-8 BOM (so Excel on Windows opens the Indic + rupee figures correctly) and proper field escaping (fields containing a comma, double-quote, CR, or LF are wrapped in do |

#### `app/src/features/reports/exportAccess.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 7 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | ExportAccessSubject, canUseCsvExport |
| Has TODO | N |
| Purpose | Exports: ExportAccessSubject, canUseCsvExport |

#### `app/src/features/reports/index.ts`

| Field | Value |
|---|---|
| Role | `module-api` — Barrel / types export for feature module |
| LOC | 42 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Reports & Export feature barrel. |

#### `app/src/features/reports/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 1217 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (32) | PIPELINE_STAGE_ORDER, PipelineByStageRow, PipelineByTypeRow, PipelineByRmRow, PipelineReport, getPipelineReport, RevenueByDealRow, RevenueByMonthRow |
| Has TODO | N |
| Purpose | Server-side report data access for the Reports & Export module.  These are READ-ONLY aggregate queries that power the four detail report pages (pipeline, revenue, credit, compliance) and the CSV export route. Where possible they reuse the existing feature query shapes; the aggregates themselves are raw SQL (group-by + jsonb extraction) executed via `db.execute` - the same pattern as `getDealPipeli |

### Domain: `tasks`

PRD: **M11 Notifications & Tasks**

#### `app/src/features/tasks/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 180 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (4) | CreateTaskState, createTask, UpdateTaskStatusState, updateTaskStatus |
| Has TODO | N |
| Purpose | Exports: CreateTaskState, createTask, UpdateTaskStatusState, updateTaskStatus |

#### `app/src/features/tasks/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 406 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (14) | TaskListItem, TaskListResult, listTasks, TaskDependencyRow, TaskDetail, getTaskDetail, AssigneeOption, listAssigneeOptions |
| Has TODO | N |
| Purpose | Server-side task data access (DATA_MODEL §2.19). Tasks have due dates, priority, status, an assignee (app_user), optional deal/party context, and a dependency graph via the task_dependency junction (PK (task_id, depends_on_task_id)). RLS-aware once policies are migrated; until then these are plain queries. All functions are safe to call from Server Components. |

### Domain: `workflow`

PRD: **M11 Notifications & Tasks**

#### `app/src/features/workflow/actions.ts`

| Field | Value |
|---|---|
| Role | `server-actions` — Server Actions mutation boundary |
| LOC | 198 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (8) | MarkReadResult, markAsRead, MarkAllReadResult, markAllAsRead, BellData, getBellData, LoadMoreResult, loadMoreNotifications |
| Has TODO | N |
| Purpose | Exports: MarkReadResult, markAsRead, MarkAllReadResult, markAllAsRead, BellData, getBellData, LoadMoreResult, loadMoreNotifications |

#### `app/src/features/workflow/engine.ts`

| Field | Value |
|---|---|
| Role | `domain-engine` — Pure or domain business logic |
| LOC | 773 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | NotificationEngineOptions, generateNotifications |
| Has TODO | N |
| Purpose | Workflow Automation - the notification trigger engine.  `generateNotifications(db)` scans live tables for workflow trigger conditions and returns a typed, serializable Notification[]. Nothing is persisted: the set is recomputed fresh on every load (the MVP stores only read/dismissed state in a cookie - see queries.ts / actions.ts). A notification naturally disappears when its trigger condition cle |

#### `app/src/features/workflow/index.ts`

| Field | Value |
|---|---|
| Role | `module-api` — Barrel / types export for feature module |
| LOC | 40 |
| Runtime | client |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Workflow Automation - feature barrel.  Re-exports the domain types/constants, the trigger engine, the server-side reads, and the server actions so server routes import from one path.  IMPORTANT (client-component import discipline - see the leads barrel): `@/features/workflow` re-exports ./queries, which imports the `db` (postgres) client. A "use client" component that imports from THIS barrel woul |

#### `app/src/features/workflow/queries.ts`

| Field | Value |
|---|---|
| Role | `data-queries` — Server-side DB read queries |
| LOC | 176 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (7) | READ_COOKIE, READ_COOKIE_CAP, readReadIds, listNotifications, computeStats, getUnreadCount, getNotificationsAndStats |
| Has TODO | N |
| Purpose | Workflow Automation - server-side reads + read-state cookie helpers.  The notification set is COMPUTED (engine.ts) - nothing is persisted. Read state (which notifications the user has dismissed) lives in a cookie so the MVP needs no schema change. The cookie stores the set of dismissed ENTITY IDS (uuids), not the full `${type}:${entityId}` notification id: each trigger type references a distinct e |

#### `app/src/features/workflow/types.ts`

| Field | Value |
|---|---|
| Role | `module-api` — Barrel / types export for feature module |
| LOC | 186 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (13) | Severity, NotificationType, NotificationView, Notification, NotificationStats, SEVERITY_ORDER, SEVERITY_LABELS, SEVERITY_BADGE_VARIANT |
| Has TODO | N |
| Purpose | Workflow Automation - notifications, reminders, escalations.  A notification here is a COMPUTED signal: the engine scans the live data (kyc_record, deal, credit_analysis, task, consent_record) for trigger conditions and returns a typed Notification[] - nothing is persisted. Read state (which notifications the user has dismissed) is stored in a cookie (see queries.ts / actions.ts), so the MVP needs |
