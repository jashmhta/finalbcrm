# Agent 076 — File-by-file analysis (batch-076)

Batch source: `/home/Jashmhta/crm/bc-crm/analysis/file-by-file/batch-076.list`  
Workspace root: `/home/Jashmhta/crm/bc-crm/app`  
Files analyzed: 4 (all read fully)

---

## src/features/deals/roles.ts

- **Lines:** 320  
- **Role in architecture:** Pure domain catalog that maps each `DealType` to the subset of `deal_party_role` values that are valid for that mandate, plus the **lead role** (primary client party role). Complements the flat schema enum in `deal_party_role` with business-logic constraints. Sibling of `catalog.ts`, `stages.ts`, `allocations.ts`. No DB access; imported by deal mutation validation and UI role pickers.

- **Exports + signatures:**
  - `export interface DealRoleSpec { roles: readonly DealPartyRole[]; leadRole: DealPartyRole }`
  - `export const DEAL_TYPE_ROLES: Record<DealType, DealRoleSpec>` — full coverage of every catalog deal type
  - `export function validRolesForDealType(dealType: DealType): readonly DealPartyRole[]`
  - `export function leadRoleForDealType(dealType: DealType): DealPartyRole`
  - `export function isValidRoleForDealType(dealType: DealType, role: DealPartyRole | string | null | undefined): boolean`

- **Imports:**
  - `import type { DealPartyRole, DealType } from "./catalog"`

- **Business purpose & domain concepts:**
  - Schema enum is a flat superset (issuer, underwriter, book_runner, target, acquirer, …). An M&A mandate has no issuer/underwriter; a bond UW has no target/acquirer. This module encodes the subset + lead semantics per BC/Binary Bonds service map.
  - Reusable groups: `FIXED_INCOME_SYNDICATE`, `BOND_FIDUCIARY`, `ADVISORY_PROFESSIONALS`, `M_AND_A_ROLES`.
  - Lead role rules: issuance → `issuer`; G-Sec / secondary / portfolio → `investor`; M&A / valuation / fairness → `target` (sell-side default).
  - Special cases: `dcm_advisory` omits investor/trustee/registrar (execution owned by Binary Bonds); `gsec_auction` has no issuer party (GoI/RBI); `supply_chain_finance` maps anchor buyer as issuer, suppliers as investor.

- **Key logic:**
  - Internal `uniq<T>` dedupes spread role arrays via `Set`.
  - `isValidRoleForDealType` null-guards and casts roles to `readonly string[]` for `.includes`.
  - ECM IPO/FPO/QIP/Rights share full syndicate + registrar/escrow/investor/professionals.
  - `private_placement_debt` is hand-listed (no book_runner/syndicate_member).

- **Side effects:** None (pure). No server actions, no DB, no auth.

- **Security / RBAC:** N/A at this layer. Callers must enforce RBAC on deal_party writes; this only validates role membership against deal type.

- **Coupling:**
  - **Imports:** `./catalog` types only.
  - **Imported by:** deals barrel (`index.ts`), deal actions/validators, potentially UI role dropdowns.
  - **Must stay in sync with:** `deal_party_role` enum and `DealType` catalog keys.

- **Risks / TODOs:**
  - No runtime exhaustiveness check if a new `DealType` is added to schema without updating `DEAL_TYPE_ROLES` (TS will catch if `Record<DealType, …>` is enforced — it is).
  - M&A buy-side lead role is documented as `acquirer` but default in catalog is `target`; UI must allow override.
  - Role groups are duplicated by value across types — intentional for readability.

---

## src/features/deals/stages.ts

- **Lines:** 451  
- **Role in architecture:** Pure domain module encoding per-deal-type **pipeline ladders** over the flat `deal_status` enum, with stage semantics labels and transition rules (no forward skips; dropped terminal; on_hold pausable). Used by deal mutation validation and kanban rendering of type-specific columns.

- **Exports + signatures:**
  - `export const OFF_PIPELINE_STATUSES = ["dropped", "on_hold"] as const`
  - `export type OffPipelineStatus = (typeof OFF_PIPELINE_STATUSES)[number]`
  - `export interface DealStageFlow { ladder: DealStatus[]; semantics: Partial<Record<DealStatus, string>> }`
  - `export const DEAL_STAGE_FLOWS: Record<DealType, DealStageFlow>`
  - `export function stageLadderFor(dealType: DealType): DealStatus[]`
  - `export function stageSemanticsFor(dealType: DealType, status: DealStatus): string | null`
  - `export function stageIndexInFlow(dealType: DealType, status: DealStatus | string | null | undefined): number`
  - `export function isOffPipelineStatus(status: DealStatus | string | null | undefined): boolean`
  - `export function canTransitionStage(dealType, from, to): boolean`
  - `export function nextStageFor(dealType, status): DealStatus | null`

- **Imports:** `import type { DealStatus, DealType } from "./catalog"`

- **Business purpose:**
  - Flat status enum is DB-necessary but wrong for every mandate: G-Sec skips structuring/rating; M&A has no allocation; valuation is short ladder.
  - Verified against BUSINESS_CONTEXT bond UW / M&A / G-Sec flows.
  - Semantics map generic statuses to type-specific phase names (e.g. M&A `structuring` = “Valuation & negotiation”; G-Sec `pricing` = auction bidding).

- **Key logic — ladders (summary):**
  | Family | Ladder sketch |
  |---|---|
  | Bond UW / HY / PP debt | full FI: lead→…→allocation→settled→closed |
  | DCM advisory | no allocation/settled |
  | G-Sec | lead, mandated, pricing, allocation, settled, closed |
  | Secondary | lead, mandated, pricing, settled, closed |
  | ECM IPO/FPO/QIP/Rights | full book-build ladder |
  | Structured fin / PF | no allocation stage |
  | SCF | lead…structuring, pricing, settled, closed |
  | M&A | lead, mandated, in_dd, structuring, pricing, closed |
  | Rating advisory | …rating_marketing, closed |
  | Valuation / fairness / PMS | short ladders |

- **Key logic — `canTransitionStage`:**
  1. Missing from/to → false; from===to → true.
  2. `to === dropped` from any non-dropped; no exit from dropped.
  3. `to === on_hold` only from active ladder stages; resume from on_hold to any ladder stage.
  4. Active→active: both indices in ladder; `ti <= fi + 1` (no forward skip; backward rework allowed).

- **Side effects:** None.

- **Security / RBAC:** Pure validation; callers enforce who may change deal status.

- **Coupling:** `./catalog` types; consumers = deal actions, pipeline UI. Must stay aligned with `deal_status` enum values.

- **Risks / TODOs:**
  - `stageIndexInFlow` uses cast `as DealStatus` — invalid strings return -1 via `indexOf`.
  - No multi-step forward jumps even for admin override — product may want superuser skip later.
  - `rating_marketing` collapses rating + marketing into one schema status.

---

## src/features/documents/actions.ts

- **Lines:** 149  
- **Role in architecture:** Next.js Server Actions (`"use server"`) for document metadata mutations. Upload-stub foundation: inserts into `document` table (blob lives in S3 via `file_store_ref`); real presigned PUT is a later phase. Sets RLS GUCs via `withRls`.

- **Exports + signatures:**
  - `export type CreateDocumentState = { error?: string } | undefined`
  - `export async function createDocument(_prev: CreateDocumentState, formData: FormData): Promise<CreateDocumentState>`

- **Imports:**
  - `next/cache` (`revalidatePath`), `next/navigation` (`redirect`), `zod/v4`
  - `@/lib/rbac` (`can`, `requireUser`), `@/db/context` (`withRls`), `@/db/schema` (`document`)

- **Business purpose:**
  - DATA_MODEL §2.20: document row is metadata only.
  - Captures document_type, kyc_category, file meta (name/mime/size/sha256), anchors (deal/party/contact), confidentiality/MNPI flags, barrier_id, retention_until.

- **Key logic:**
  - Local const enums `DOCUMENT_TYPES` (23 values matching schema) and `KYC_CATEGORIES` (7).
  - `createDocumentSchema` (zod): optional enums/UUIDs; `fileName` required max 300; `sha256` length 64 optional; `sizeBytes` max Number.MAX_SAFE_INTEGER; checkboxes via `=== "on"`.
  - `parseForm` coerces FormData including sizeBytes Number conversion.
  - Flow: `requireUser` → `can(user, "create", "document")` → safeParse → `withRls(appUserId|randomUUID, wall, [], insert…returning documentId)` → `revalidatePath("/documents")` → `redirect(/documents/${id})`.

- **Side effects:**
  - DB INSERT into `document` under RLS transaction.
  - Cache revalidation + hard redirect (never returns success state on happy path).
  - `uploadedByUserId` set from session.

- **Security / RBAC:**
  - Auth required; permission `create:document`.
  - RLS context set with user’s wall clearances.
  - **Risk:** client can supply `fileStoreRef` / `sha256` / `barrierId` without server-side object-store proof — intentional stub, insecure for production upload.
  - MNPI flag is user-settable at create time (trust model).

- **Coupling:** Form UI under `/documents`; schema `document`; RBAC + withRls. No queries module coupling on write path.

- **Risks / TODOs:**
  - Comment typo line 98 (`//` inside block comment).
  - No update/delete/soft-delete actions yet.
  - No virus scan / mime validation beyond string length.
  - Fallback `crypto.randomUUID()` when `appUserId` null still sets GUC — edge case for incomplete session.

---

## src/features/documents/queries.ts

- **Lines:** 378  
- **Role in architecture:** Server-side document data access for RSC pages. List + detail + form option loaders. App-layer visibility clauses until document RLS is fully enabled. Soft-delete aware (`deletedAt IS NULL`).

- **Exports + signatures:**
  - Types: `DocumentListItem`, `DocumentListResult`, `DocumentDetail`, `DealOption`, `PartyOption`, `ContactOption`
  - `export async function listDocuments({ documentType, partyId, dealId, contactId, mnpiOnly, q, user, page, pageSize }): Promise<DocumentListResult>`
  - `export async function getDocumentDetail(documentId, user?): Promise<DocumentDetail | null>`
  - `export async function listDealOptions({ q, limit, user })`
  - `export async function listPartyOptions({ q, limit, user })`
  - `export async function listContactOptions({ q, limit, user })`

- **Imports:**
  - `drizzle-orm` operators; `@/db`; `@/lib/rbac`; schema: `appUser`, `contact`, `deal`, `document`, `documentTypeEnum`, `party`

- **Business purpose:**
  - Browse vault metadata; KYC docs flagged for E2E encryption + access logging (ARCHITECTURE §4.3) at infrastructure layer.
  - `is_mnpi` drives UI disable of download/copy/email; `barrier_id` for Chinese walls.

- **Key logic — visibility:**
  - `canReadAllDocuments`: admin/super_admin OR `read_all:document` OR `manage:user` OR no user (system).
  - Scoped users see docs if they uploaded them OR own related party/deal/contact via assigned/owner/created OR EXISTS deal_party / party_contact ownership chains.
  - Option list helpers use parallel narrower clauses.

- **Key logic — listDocuments:**
  - Filters: type, anchors, mnpiOnly, ilike fileName.
  - Joins deal/party/contact/appUser for display names.
  - Parallel count + page (default pageSize 25), order `createdAt desc`.

- **Side effects:** Read-only SELECT; no writes.

- **Security / RBAC:**
  - Visibility is application-enforced; comments note RLS “once policies migrated.”
  - **Gap:** if `user` is omitted, `canReadAllDocuments` returns true → full visibility for unscoped callers. Callers must always pass session user on user-facing pages.
  - MNPI rows still returned (filter optional) — UI must redact content; list still exposes file names of MNPI docs if scoped-visible.

- **Coupling:** Document pages; create form option loaders; interactions/leads may join documents elsewhere. Shares RBAC pattern with interactions/queries.

- **Risks / TODOs:**
  - No soft-delete of joins for deal/party/contact rows (left joins may show deleted entity names).
  - `documentType as DocumentTypeValue` cast without runtime enum guard beyond caller input.
  - Count query joins deal/party/contact for visibility EXISTS paths — performance OK at current scale.

---

## Batch 076 synthesis

Deals domain closes out with pure role/stage catalogs (business rules without I/O). Documents feature opens the vault: stub upload action with proper RBAC/RLS envelope, and scoped list/detail queries. Critical production gap is object-storage-backed upload (presigned PUT + server-minted `file_store_ref`) and document RLS policies still pending.
