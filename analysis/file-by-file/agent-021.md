# Agent 021 — File-by-File Analysis

**Batch:** `batch-021.list`  
**Scope root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files:** 4  
**Themes:** KYC compliance list route (loading + server page); credit analysis client forms (financial statements + committee state)

---

## 1. `src/app/compliance/kyc/loading.tsx`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/compliance/kyc/loading.tsx` |
| **Lines** | 57 |
| **Role** | Next.js App Router route-level `loading.tsx` (Suspense fallback) for `/compliance/kyc` |
| **Runtime** | Server Component (default; no `"use client"`) |
| **Route segment** | `src/app/compliance/kyc/` |

### Exports

```ts
export default function KycLoading(): JSX.Element
```

- **Default export only** — Next.js convention for segment loading UI.
- No named exports, types, or re-exports.

### Imports

| Symbol | From | Purpose |
|--------|------|---------|
| `Skeleton` | `@/components/brand/skeleton` | Shimmer atom for column headers and card lines |
| `SkeletonCard` | `@/components/brand/skeleton` | Double-bezel card shells for stat tiles and board body |
| `SkeletonPage` | `@/components/brand/skeleton` | Page chrome (eyebrow + title) while content streams |
| `cn` | `@/lib/utils` | Classname merge for skeleton card rings |

### Business purpose

Instant perceived-navigation feedback for the KYC / AML board. While the force-dynamic parent `page.tsx` runs `requireUser()` + `listKycRecords()` against Neon, this skeleton mirrors:

1. A **stat-card row** (4 tiles) — intended to stand in for risk / status summary cards in `KycBoardView`.
2. A **5-column horizontal board** — lifecycle columns of stacked entity-card skeletons (5 rows each, min width 960px, horizontal scroll).

Regulatory framing in the skeleton eyebrow: `"PMLA · RBI Master Direction on KYC"`. Page title in skeleton: `"KYC / AML"`.

### Key logic

```tsx
export default function KycLoading() {
  return (
    <SkeletonPage eyebrow="PMLA · RBI Master Direction on KYC" title="KYC / AML" cards={0}>
      {/* 4 × SkeletonCard lines={2} in sm:2 / lg:4 grid */}
      {/* SkeletonCard header={false} wrapping 5-column CSS grid min-w-[960px] */}
      {/* each column: header Skeleton + 5 card shells with 3 Skeleton bars */}
    </SkeletonPage>
  );
}
```

- Pure presentational; **no data fetch, no auth, no params**.
- Grid: `gridTemplateColumns: repeat(5, minmax(0, 1fr))`.
- Card chrome: `rounded-xl p-3 ring-1 ring-hairline/60`.

### Side effects

- None (no network, no cookies, no mutations).
- Rendered only as Next.js loading UI when the segment suspends / navigates.

### Security / RBAC

- None at this layer. Auth is enforced by the sibling `page.tsx` once the real page resolves.
- Skeleton content is static chrome only; no PII.

### Coupling

| Coupled to | How |
|------------|-----|
| `@/components/brand/skeleton` | `Skeleton`, `SkeletonCard`, `SkeletonPage` API |
| `src/app/compliance/kyc/page.tsx` | Suspense pair for same segment |
| `src/app/compliance/kyc/kyc-board-view.tsx` | Layout mirror (stat row + board); **not imported** |
| Brand CSS tokens | `ring-hairline`, shimmer via skeleton primitives |

### Risks / TODOs

1. **Column count drift:** Loading uses **5** columns; `KycBoardView` documents **six** lifecycle columns (CDD → EDD → In review → Approved → Re-KYC due → Rejected). Loading skeleton does not match the live board column taxonomy.
2. **Title / eyebrow mismatch vs page:** Loading shows `"KYC / AML"` + PMLA eyebrow; live `PageHeader` uses `title="KYC"` and `description="PMLA KYC status, expiry, and review."` — minor brand inconsistency.
3. `SkeletonBoard` exists in the same brand module and is documented for deals/KYC boards, but this file **hand-rolls** a 5-column board instead of using `SkeletonBoard` — duplication / drift risk.
4. No `aria-busy` / live region beyond skeleton `aria-hidden` on primitives (acceptable for pure loading chrome).

---

## 2. `src/app/compliance/kyc/page.tsx`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/compliance/kyc/page.tsx` |
| **Lines** | 53 |
| **Role** | Next.js App Router **server page** for `/compliance/kyc` — KYC queue board data loader |
| **Runtime** | Server Component (`async` page) |
| **Rendering** | `export const dynamic = "force-dynamic"` |

### Exports

```ts
export const dynamic = "force-dynamic";

const BOARD_PAGE_SIZE = 300; // module-private

export default async function KycListPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    risk?: string;
    page?: string;
  }>;
}): Promise<JSX.Element>
```

### Imports

| Symbol | From | Purpose |
|--------|------|---------|
| `PageHeader`, `PageShell` | `@/components/brand/page-shell` | Brand page chrome |
| `requireUser` | `@/lib/rbac` | Session gate → `CrmUser` or redirect `/login` |
| `listKycRecords` | `@/features/compliance/queries` | Paginated KYC list with RBAC scoping |
| `KycBoardView` | `./kyc-board-view` | Client board UI (stats, filters, columns) |

### Business purpose

Compliance officer **working queue** for PMLA / RBI KYC:

- Loads up to **300** KYC records (not a 25-row table page) so every lifecycle column in the board can be populated.
- Filters are **URL-driven** (`q`, `status`, `risk`) so filtered views are shareable; server re-runs the query on each navigation.
- Surfaces honest truncation when ledger > cap (handled in view via `total` vs `rows.length`; page always requests `page: 1`, `pageSize: BOARD_PAGE_SIZE`).

Comment intent: never prerender; Neon query must not run at build time.

### Key logic

```ts
export const dynamic = "force-dynamic";
const BOARD_PAGE_SIZE = 300;

export default async function KycListPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const status = sp.status || undefined;
  const risk = sp.risk || undefined;

  const { rows, total } = await listKycRecords({
    q, status, risk, user, page: 1, pageSize: BOARD_PAGE_SIZE,
  });

  return (
    <PageShell>
      <PageHeader title="KYC" description="PMLA KYC status, expiry, and review." />
      <KycBoardView rows={rows} total={total} q={q} risk={risk} />
    </PageShell>
  );
}
```

#### Related query contract (not in this file, but driving I/O)

```ts
// @/features/compliance/queries
export interface KycListItem {
  kycRecordId: string;
  partyId: string;
  partyLegalName: string;
  contactId: string | null;
  contactFullName: string | null;
  kycType: string | null;
  status: string | null;
  riskRating: string | null;
  highestBoOwnershipPct: string | null;
  pepStatus: string | null;
  validUntil: string | null;
  rekycDueDate: string | null;
  approvedAt: Date | null;
  createdAt: Date | null;
}

export interface KycListResult {
  rows: KycListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listKycRecords({
  q?, status?, risk?, user?, page = 1, pageSize = 25,
}: { ... } = {}): Promise<KycListResult>
```

- Soft-delete filters: `kycRecord.deletedAt IS NULL`, `party.deletedAt IS NULL`.
- Sort: `rekycDueDate ASC`, then `createdAt DESC`.
- Search (`q`): `ilike` on `party.legalName` and `contact.fullName`.

### Side effects

| Effect | Detail |
|--------|--------|
| Auth read | `requireUser()` → session + DB permissions load; may `redirect("/login")` |
| DB read | `listKycRecords` joins `kyc_record` ⋈ `party` ⟕ `contact` |
| No mutations | Read-only page |
| Cache | Forced dynamic; no static cache of KYC queue |

### Security / RBAC

| Control | Behavior |
|---------|----------|
| Authentication | `requireUser(): Promise<CrmUser>` — unauthenticated → `/login` |
| Data scoping (query) | If `!canReadAllKyc(user)`, restrict to parties where `assignedUserId`, `dataOwnerUserId`, or `createdByUserId` = `user.appUserId` |
| `canReadAllKyc` | `admin` / `super_admin` / `can(user,"read_all","compliance")` / `can(user,"read_all","kyc")` / `can(user,"manage","user")` |
| Implicit grants | `coverage_rm` / `bond_desk` get `kyc:read` via `getCurrentUser` fallback grants; full-firm KYC queue still needs `read_all` / admin path |
| Page-level permission | **No explicit `can(user, "read", "kyc")` check on the page** — any logged-in user can hit the route; empty or assigned-only rows depend on query scoping |

`CrmUser` shape (from `@/lib/rbac`):

```ts
export interface CrmUser {
  id: string;
  email: string;
  name?: string | null;
  appUserId: string | null;
  roles: string[];
  wall: string[];
  permissions: Set<string>;
  desk: string | null;
  brandScope: BrandScope;
}
```

### Coupling

| Coupled to | How |
|------------|-----|
| `@/lib/rbac` | Auth gate |
| `@/features/compliance/queries` | Data plane + segmentation |
| `./kyc-board-view` | Client presentation (`KycBoardViewProps`) |
| `@/components/brand/page-shell` | Layout |
| URL searchParams | Shareable filters (`q`, `status`, `risk`; `page` typed but unused) |
| Neon / Drizzle tables | Indirect: `kyc_record`, `party`, `contact` |

`KycBoardView` props this page supplies:

```ts
export interface KycBoardViewProps {
  rows: KycListItem[];
  total: number;
  q?: string;
  risk?: string;
}
```

Note: `status` is read and passed into `listKycRecords` but **not** forwarded as a prop to `KycBoardView` (board may re-drive status via its own client routing / command bar).

### Risks / TODOs

1. **Hard cap 300:** Large compliance ledgers only get first page of 300 by `rekycDueDate`; columns can under-count late-queue records. Comment acknowledges UI “showing first N of M” — ensure view always shows when `total > rows.length`.
2. **`page` searchParam accepted but ignored** — always `page: 1`. Dead API surface; confuses future pagination.
3. **`status` filter not passed to board props** — server filters by status, but client may not know status filter state for controlled UI unless it re-reads URL itself.
4. **No page-level `kyc:read` deny** — relies on query scoping; non-KYC roles with login can still open empty board.
5. **SQL `ilike` with `%${q}%`** — user-controlled pattern (not classic SQL injection via Drizzle params, but broad wildcard search cost / DoS on large tables).
6. Build-time safety depends on `force-dynamic` remaining set; removing it risks build-time Neon execution.

---

## 3. `src/app/credit/[id]/add-fs-form.tsx`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/credit/[id]/add-fs-form.tsx` |
| **Lines** | 274 |
| **Role** | Client form to attach one period’s **financial statement** to a credit analysis |
| **Runtime** | Client Component (`"use client"`) |
| **Consumed by** | `src/app/credit/[id]/page.tsx` → `<AddFinancialStatementForm analysisId={id} />` |

### Exports

```ts
export function AddFinancialStatementForm({
  analysisId,
}: {
  analysisId: string;
}): JSX.Element
```

**Private helpers / constants (module scope):**

```ts
const PERIOD_TYPES = ["annual", "half_year", "quarter", "month"] as const;
const STATEMENT_TYPES = [
  "balance_sheet", "profit_loss", "cash_flow", "standalone", "consolidated",
] as const;
const UNITS = ["absolute", "lakhs", "crores", "millions"] as const;
const FS_SOURCES = [
  "audited", "limited_review", "management_provisional", "rating_agency_filing",
] as const;
const LINK_ROLES = ["primary_basis", "supporting", "prior_period", "peer"] as const;

const fieldClass: string;   // cn(...) shared select chrome
const inputClass: string;   // date inputs
const labelClass: string;

const SAMPLE_LINE_ITEMS: string; // multi-line JSON string of demo line items

function FieldSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
): JSX.Element
```

### Imports

| Symbol | From | Purpose |
|--------|------|---------|
| `* as React` | `react` | Types for select HTML attributes |
| `useActionState` | `react` | Server-action form state (`pending`, result) |
| `Plus`, `CheckCircle`, `Warning` | `@phosphor-icons/react` | CTA + success/error icons |
| `cn` | `@/lib/utils` | Class merge |
| `Button`, `Eyebrow` | `@/components/brand` | Primary CTA + “canonical codes” label |
| `addFinancialStatement`, type `AddFsState` | `@/features/credit/actions` | Server action + result union |

### Business purpose

Credit analysts attach **period financials** (P&L / BS / CF style line items as a JSON map of canonical codes) to a `credit_analysis` row. Data feeds ratio engine + scorecard (`ratios.ts` / `runRatiosAndScore`). This UI is the intake surface; persistence is server-side.

Documented canonical codes (from sample + `LineItemCode` in `@/features/credit/ratios`):

```ts
// SAMPLE_LINE_ITEMS keys (subset of LineItemCode)
revenue, cogs, ebit, depreciation_amortization, interest_expense,
pbt, tax, pat, total_debt, cash_and_equivalents, current_assets,
current_liabilities, inventory, trade_receivables, trade_payables,
total_assets, net_worth, tangible_net_worth, cfo, cfo_before_wc_changes, capex
```

Full `LineItemCode` also includes e.g. `ebitda`, `long_term_debt`, `gnpa_pct`, `crar`, `cfads`, prior-period averages, etc. — form allows free JSON keys.

### Key logic

```ts
export function AddFinancialStatementForm({ analysisId }: { analysisId: string }) {
  const [state, action, pending] = useActionState<AddFsState, FormData>(
    addFinancialStatement,
    undefined,
  );
  // <form action={action}> with hidden creditAnalysisId + fields...
}
```

#### Form fields (name → UX)

| `name` | Control | Required | Default |
|--------|---------|----------|---------|
| `creditAnalysisId` | hidden | yes | prop `analysisId` |
| `periodEndDate` | `input type="date"` | HTML `required` | empty |
| `periodStartDate` | `input type="date"` | optional | empty |
| `periodType` | select | yes | `"annual"` |
| `statementType` | select | yes | `"consolidated"` |
| `units` | select | yes | `"crores"` |
| `source` | select | yes | `"audited"` |
| `linkRole` | select | yes | `"primary_basis"` |
| `isConsolidated` | checkbox `value="on"` | optional | **checked** |
| `lineItemsJson` | textarea | HTML `required` | `SAMPLE_LINE_ITEMS` |

**Not exposed in UI (server defaults):** `currencyCode` → `"INR"`.

#### Server action contract (invoked)

```ts
// @/features/credit/actions
export type AddFsState = { error?: string } | { ok?: boolean } | undefined;

export async function addFinancialStatement(
  _prev: AddFsState,
  formData: FormData,
): Promise<AddFsState>
```

Zod `addFsSchema` (server):

```ts
z.object({
  creditAnalysisId: z.uuidv4(),
  periodEndDate: z.iso.date(),
  periodStartDate: z.iso.date().optional(),
  periodType: z.enum(PERIOD_TYPES),
  statementType: z.enum(STATEMENT_TYPES),
  isConsolidated: z.coerce.boolean().default(false),
  currencyCode: z.string().length(3).default("INR"),
  units: z.enum(UNITS),
  source: z.enum(FS_SOURCES),
  linkRole: z.enum(FS_LINK_ROLES).default("primary_basis"),
  lineItemsJson: z.string().min(2, "Line items JSON is required"),
})
```

Server flow:

1. `requireUser()` + `can(user, "write", "credit")`.
2. Parse FormData; `JSON.parse(lineItemsJson)` must be a non-array object.
3. `withRls(...)` transaction:
   - Load `credit_analysis` (not deleted) → `partyId`.
   - `INSERT financial_statement` (party-scoped FS row + line_items jsonb).
   - `INSERT credit_analysis_fs_link` (`linkRole`, `linkedByUserId`).
4. `revalidatePath(/credit/:id)` and `/workspace`.

#### UI state rendering

- Error: `state && "error" in state && state.error` → red `Warning` text.
- Success: `state && "ok" in state && state.ok` → gold `CheckCircle` “Financial statement added.”
- Submit disabled when `pending`; label “Adding…” / “Add statement”.

#### `FieldSelect`

Native `<select>` + decorative chevron SVG (`aria-hidden`). Applies `fieldClass` + `pr-9`.

### Side effects

| Effect | Where |
|--------|-------|
| Server mutation | Via `addFinancialStatement` on submit |
| DB writes | `financial_statement`, `credit_analysis_fs_link` |
| Cache revalidation | Credit detail + workspace paths |
| Client-only until submit | No local persistence of drafts |

### Security / RBAC

| Layer | Behavior |
|-------|----------|
| Client form | **No RBAC gate** — anyone who can render the parent page sees the form |
| Server action | `requireUser()`; `can(user, "write", "credit")` or error string |
| RLS | `withRls(user.appUserId ?? crypto.randomUUID(), user.wall, [], ...)` |
| ID integrity | Hidden `creditAnalysisId` must be UUIDv4; analysis existence checked server-side |
| Input validation | Zod enums + JSON object parse; **no allowlist of line-item keys** |
| XSS | User JSON displayed only as form value / error messages; stored as jsonb |

**Note:** Parent page may still show the form without mirroring write permission; unauthorized users get action error after submit.

### Coupling

| Coupled to | How |
|------------|-----|
| `@/features/credit/actions` | Action + `AddFsState` |
| Parent `page.tsx` | Passes `analysisId` |
| Enum lists | **Duplicated** locally vs `actions.ts` `PERIOD_TYPES` / `STATEMENT_TYPES` / `UNITS` / `FS_SOURCES` / `FS_LINK_ROLES` |
| `@/features/credit/ratios` | Conceptual coupling to `LineItemCode` (not imported) |
| DB tables | Indirect: `financial_statement`, `credit_analysis_fs_link`, `credit_analysis` |
| Brand UI | `Button`, `Eyebrow`, touch-target `h-11` (44px) conventions |

### Risks / TODOs

1. **Sample data as default:** `defaultValue={SAMPLE_LINE_ITEMS}` means an accidental submit stores demo numbers (1200 revenue etc.) as real FS data for that analysis.
2. **Enum drift:** Form constants re-declared; desync with `actions.ts` / DB enums causes silent client options that fail Zod, or missing new enum values.
3. **No client JSON validation** of structure/keys/numbers before submit; poor UX vs server parse errors.
4. **`statementType` mixes “statement kind” and “consolidation presentation”** (`standalone` / `consolidated` alongside `balance_sheet` / `profit_loss`) while `isConsolidated` is a separate checkbox — conceptual overlap / analyst confusion.
5. **No multi-currency UI** — always INR via server default; foreign FS need a form field later.
6. **Line items not typed to `LineItemCode`** — typos (e.g. `revenues`) silently ignored by ratio engine.
7. **Accessibility:** Decorative chevron only; selects rely on native labels via `htmlFor` — OK. No `aria-invalid` wired to `state.error`.
8. Success state does not reset form; user can double-submit another identical statement unless they navigate away.

---

## 4. `src/app/credit/[id]/committee-form.tsx`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/credit/[id]/committee-form.tsx` |
| **Lines** | 158 |
| **Role** | Client form for **committee workflow stub** (internal rating action + recommendation + watchlist) on a credit analysis |
| **Runtime** | Client Component (`"use client"`) |
| **Consumed by** | `src/app/credit/[id]/page.tsx` → `<CommitteeForm analysisId={...} currentAction={...} currentRecommendation={...} watchlist={...} />` |

### Exports

```ts
export function CommitteeForm({
  analysisId,
  currentAction,
  currentRecommendation,
  watchlist,
}: {
  analysisId: string;
  currentAction: string | null;
  currentRecommendation: string | null;
  watchlist: boolean | null;
}): JSX.Element
```

**Private:**

```ts
const ACTIONS = [
  "assign", "maintain", "upgrade", "downgrade",
  "watch_negative", "watch_positive",
] as const;

const fieldClass: string;
const labelClass: string;

function FieldSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
): JSX.Element
```

Module comment:

> Committee-workflow stub form (spec §9). Captures the next state as `internal_rating_action` + `recommendation` (+ watchlist toggle) on the `credit_analysis` row. **CommitteeMeeting / CommitteeDecision tables are a future schema addition**.

### Imports

| Symbol | From | Purpose |
|--------|------|---------|
| `* as React` | `react` | Select HTML attribute typing |
| `useActionState` | `react` | Server-action form state |
| `CheckCircle`, `Warning`, `ArrowRight` | `@phosphor-icons/react` | Icons |
| `cn` | `@/lib/utils` | Class merge |
| `Button` | `@/components/brand` | Submit CTA |
| `advanceCommitteeState`, type `AdvanceCommitteeState` | `@/features/credit/actions` | Server action |

### Business purpose

Stub for **credit committee decisions** without full meeting/decision entities:

- Set / change `internal_rating_action` (rating committee outcome language: assign/maintain/upgrade/downgrade/watch).
- Capture free-text **recommendation / conditions**.
- Optional **watchlist** flag on the analysis.

Supports Binary Capital credit process (surveillance / rating presentation) until formal committee schema lands.

### Key logic

```ts
export function CommitteeForm({ analysisId, currentAction, currentRecommendation, watchlist }) {
  const [state, action, pending] = useActionState<
    AdvanceCommitteeState,
    FormData
  >(advanceCommitteeState, undefined);

  return (
    <form action={action}>
      <input type="hidden" name="creditAnalysisId" value={analysisId} />
      {/* select internalRatingAction, textarea recommendation, checkbox watchlistFlag */}
    </form>
  );
}
```

#### Form fields

| `name` | Control | Default |
|--------|---------|---------|
| `creditAnalysisId` | hidden | `analysisId` |
| `internalRatingAction` | select over `ACTIONS` | `currentAction ?? "assign"` |
| `recommendation` | textarea 4 rows | `currentRecommendation ?? ""` |
| `watchlistFlag` | checkbox `value="on"` | `defaultChecked={watchlist === true}` |

#### Server action contract

```ts
// @/features/credit/actions
const INTERNAL_RATING_ACTIONS = [
  "assign", "maintain", "upgrade", "downgrade",
  "watch_negative", "watch_positive",
] as const;

const advanceSchema = z.object({
  creditAnalysisId: z.uuidv4(),
  internalRatingAction: z.enum(INTERNAL_RATING_ACTIONS),
  recommendation: z.string().max(4000).optional(),
  watchlistFlag: z.coerce.boolean().optional(),
});

export type AdvanceCommitteeState =
  | { error?: string }
  | { ok?: boolean }
  | undefined;

export async function advanceCommitteeState(
  _prev: AdvanceCommitteeState,
  formData: FormData,
): Promise<AdvanceCommitteeState>
```

Server flow:

1. `requireUser()`.
2. **`can(user, "override", "credit_score")`** — stricter than FS write (`write`/`credit`).
3. Zod parse; watchlist true only if form value is `"on"` / `"true"`, else **`undefined`** (not false).
4. `withRls` → `UPDATE credit_analysis SET internalRatingAction, recommendation, watchlistFlag? (if defined), updatedByUserId, updatedAt`.
5. `revalidatePath(/credit/:id)` and `/credit`.

#### UI feedback

- Error / success same pattern as FS form (`text-down` / `text-gold`).
- Success copy: `"Committee state updated."`
- CTA: `"Update committee state"` / `"Saving…"`, `variant="primary-gold"`, trailing `ArrowRight`.

### Side effects

| Effect | Detail |
|--------|--------|
| DB update | `credit_analysis` columns: rating action, recommendation, optional watchlist |
| Revalidation | Detail + list paths |
| No meeting audit trail | No insert into committee decision tables (do not exist) |
| Concurrent edits | Last-write-wins on analysis row |

### Security / RBAC

| Layer | Behavior |
|-------|----------|
| Client | No permission check; relies on parent page render policy |
| Server | Permission **`override` on `credit_score`** — elevated vs ordinary credit write |
| RLS | Same `withRls` pattern as FS add |
| Integrity | UUID analysis id; no explicit “analysis exists / not deleted” check in this action (update may no-op if missing) |

Implication: committee changes are privileged (override score/rating semantics), not generic credit edit.

### Coupling

| Coupled to | How |
|------------|-----|
| `@/features/credit/actions` | `advanceCommitteeState` / `AdvanceCommitteeState` / `INTERNAL_RATING_ACTIONS` |
| Parent credit detail page | Props from analysis fields: `internalRatingAction`, `recommendation`, `watchlistFlag` |
| Schema `credit_analysis` | Direct column names via action |
| Future schema | Comment: `CommitteeMeeting` / `CommitteeDecision` |
| Shared UI pattern | Near-duplicate `FieldSelect` / field classes with `add-fs-form.tsx` |

Parent usage (context):

```tsx
<CommitteeForm
  analysisId={id}
  currentAction={a.internalRatingAction}
  currentRecommendation={a.recommendation}
  watchlist={a.watchlistFlag}
/>
```

### Risks / TODOs

1. **Watchlist cannot be cleared via UI:** Unchecked checkbox omits the field → server maps to `undefined` → `watchlistFlag` is **not** written (`...(input.watchlistFlag !== undefined ? { watchlistFlag } : {})`). Users can **set** watchlist but not **unset** it through this form.
2. **Stub / incomplete workflow:** No committee vote, quorum, multi-approver, or immutable decision history — overwrites analysis fields in place.
3. **Enum duplication:** Local `ACTIONS` mirrors `INTERNAL_RATING_ACTIONS` in actions; drift risk.
4. **No optimistic concurrency** (`updatedAt` not checked) — race between analysts.
5. **Permission surface:** `override`/`credit_score` may be rare in seed grants; form may always fail for typical RMs — UX shows only generic error after submit.
6. **Recommendation max 4000** enforced only server-side; no `maxLength` on textarea.
7. **Duplicate `FieldSelect`:** Same private component in `add-fs-form.tsx` and this file — should be shared brand select.
8. Spec §9 dependency: product/docs expect richer committee model; current form is intentionally temporary.

---

## Cross-file summary

| File | LOC | Kind | Auth / RBAC in-file | Mutates data |
|------|-----|------|---------------------|--------------|
| `compliance/kyc/loading.tsx` | 57 | Loading UI | None | No |
| `compliance/kyc/page.tsx` | 53 | RSC page | `requireUser` + query scoping | Read only |
| `credit/[id]/add-fs-form.tsx` | 274 | Client form | Deferred to action (`write`/`credit`) | Yes (via action) |
| `credit/[id]/committee-form.tsx` | 158 | Client form | Deferred to action (`override`/`credit_score`) | Yes (via action) |

### Domain pairing

- **KYC pair:** Loading skeleton + force-dynamic list page for PMLA board (`listKycRecords` → `KycBoardView`).
- **Credit pair:** Two mutation forms on credit analysis detail, both `useActionState` + server actions in `@/features/credit/actions`, both revalidate `/credit/[id]`.

### Shared patterns

- Brand “double-bezel” field chrome (`ring-hairline`, `h-11` touch targets).
- Native select + SVG chevron (`FieldSelect` duplicated).
- Discriminated result unions: `{ error?: string } | { ok?: boolean } | undefined`.
- Forms do not hide themselves based on permissions; server returns error strings.

### Highest-priority issues across batch

1. Committee watchlist checkbox one-way (cannot clear).
2. FS form prefilled with sample financials ready to submit as production data.
3. KYC loading board is 5 columns vs live 6-column taxonomy.
4. Duplicated enum constants between forms and server actions.
5. KYC page has no explicit feature permission check beyond login + query scope.

---

*End of agent-021 analysis.*
