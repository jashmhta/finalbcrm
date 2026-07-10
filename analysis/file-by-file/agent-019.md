# Agent 019 — File-by-file analysis

**Batch:** `batch-019.list`  
**Scope root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Domain:** Compliance UI — Audit log page + DPDP Consent / Data Subject Request (DSR) workspace

---

## 1. `src/app/compliance/audit/page.tsx`

| Field | Value |
|-------|--------|
| **Path** | `src/app/compliance/audit/page.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/compliance/audit/page.tsx` |
| **Lines** | 90 |
| **Directive** | None (Server Component) |
| **Route** | `/compliance/audit` (Next.js App Router `page.tsx`) |

### Role

Server-side page entry for the **immutable audit log viewer**. Authenticates the user, enforces audit/read RBAC, parses URL `searchParams` into filters/pagination, loads rows via `listAuditLog`, and hands a pure presentation payload to the client `AuditListView`.

### Exports

| Export | Kind | Signature / notes |
|--------|------|-------------------|
| `dynamic` | `const` | `export const dynamic = "force-dynamic"` — disables static prerender for DB-backed immutable log. |
| `AuditLogPage` (default) | `async function` | See signature below. |

```ts
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    entityType?: string;
    operation?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}): Promise<JSX.Element>
```

**Module-local constants (not exported):**

```ts
const PAGE_SIZE = 50;

const ENTITY_TYPES = [
  "party", "contact", "deal", "deal_party",
  "kyc_record", "kyc_beneficial_owner",
  "consent_record", "data_subject_request",
  "credit_analysis", "credit_score", "credit_limit",
  "exposure", "external_rating",
  "interaction", "document", "task",
] as string[]; // declared as string[] via bare array literal

const OPERATIONS = ["insert", "update", "delete", "merge", "approve", "reject"];
```

### Imports

| Source | Symbols | Purpose |
|--------|---------|---------|
| `@/components/brand/page-shell` | `PageHeader`, `PageShell` | Brand layout chrome + title/description. |
| `next/navigation` | `redirect` | Hard redirect when RBAC fails. |
| `@/lib/rbac` | `can`, `requireUser` | Session user load + capability check (`can` re-exported from `rbac-core`). |
| `@/features/compliance/audit` | `listAuditLog` | Read-only paginated `audit_log` query. |
| `./audit-list-view` | `AuditListView` | Client list/filter UI (sibling file; not in this batch). |

### Business purpose

Surfaces the firm’s **immutable change history** for compliance / ops incident review. Entity-type filter whitelist covers CRM core (party/contact/deal), KYC, DPDP consent/DSR, credit, interactions, documents, and tasks. Operation filter covers insert/update/delete plus workflow ops merge/approve/reject.

### Key logic

1. **`export const dynamic = "force-dynamic"`** — comment notes that `searchParams` already opt into dynamic rendering; force-dynamic is explicit so the immutable log is never prerendered.
2. **Auth + RBAC gate:**
   ```ts
   const user = await requireUser();
   if (!can(user, "read", "audit")
       && !can(user, "read_all", "audit")
       && !can(user, "manage", "user")) {
     redirect("/parties");
   }
   ```
   Any of `audit:read`, `audit:read_all`, or `user:manage` grants page access. Admin/super_admin always pass via `can()` short-circuit in `rbac-core`.
3. **URL → filter:**
   - `q` trimmed or `undefined`
   - `entityType`, `operation`, `from`, `to` passed through as-is (or `undefined`)
   - `page = Math.max(1, Number(sp.page) || 1)`
4. **Data load:**
   ```ts
   const { rows, total, page: curPage, pageSize } = await listAuditLog({
     filter: { q, entityType, operation, from, to },
     page,
     pageSize: PAGE_SIZE,
   });
   const totalPages = Math.max(1, Math.ceil(total / pageSize));
   ```
5. **Render:** `PageShell` → `PageHeader title="Audit log" description="Immutable change history."` → `AuditListView` with rows, pagination meta, current filters, and the static `entityTypes` / `operations` option lists.

### Side effects

| Effect | When |
|--------|------|
| Session / DB read via `requireUser()` | Every request |
| DB read via `listAuditLog` (SELECT on `audit_log` + left join `app_user`) | Every request |
| `redirect("/parties")` | Missing permission |
| No mutations | Page is read-only |

### Security / RBAC

- **Authentication:** `requireUser()` — unauthenticated users are redirected/denied by that helper (session required).
- **Authorization (page-level):** explicit `can(user, …)` for `audit:read` \| `audit:read_all` \| `user:manage`.
- **Query layer:** `listAuditLog` in `features/compliance/audit.ts` does **not** accept the `user` object and applies **no row-level visibility clause** in the query helper itself. Effective protection for sensitive old/new values relies on:
  1. this page’s capability gate, and
  2. Postgres RLS (if installed on `audit_log` for the DB role used by the app).
- **Filter injection:** `entityType` / `operation` are free-form strings from the URL (not constrained to the UI whitelist server-side). They are passed into Drizzle `eq()` predicates — not SQL-string-interpolated for those fields. `q` is used with `ilike` with `%${q}%` inside the feature module (parameterized by Drizzle, but unescaped wildcards in user input can broaden matches).
- **No write surface** on this page.

### Coupling

| Coupled to | Nature |
|------------|--------|
| `@/features/compliance/audit` (`listAuditLog`, `AuditLogFilter`, `AuditLogResult`) | Data contract |
| `./audit-list-view` (`AuditListView`) | Presentation |
| `@/lib/rbac` | AuthZ |
| Hard-coded `ENTITY_TYPES` / `OPERATIONS` | Must stay aligned with audit writers / enum of operations in schema and mutation layer |

### Risks / TODOs

1. **Duplicated filter vocabulary:** `ENTITY_TYPES` / `OPERATIONS` live only in this page; writers may log entity types not listed here (UI filter incomplete, not a data bug).
2. **No server-side whitelist** of `entityType` / `operation` against the constants — any string is accepted if it matches DB rows.
3. **`listAuditLog` not user-scoped** — if someone bypasses this page (another route importing the helper) without a similar gate, full audit history may be readable.
4. **`user:manage` grants audit read** — intentional admin escape hatch, but broad; document for least-privilege reviews.
5. No pagination/filter validation for malformed `from`/`to` dates (delegated to `listAuditLog` / `new Date(...)`).
6. Sibling `audit-list-view.tsx` is out of batch; page is incomplete without it.

---

## 2. `src/app/compliance/consent/consent-action-forms.tsx`

| Field | Value |
|-------|--------|
| **Path** | `src/app/compliance/consent/consent-action-forms.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/compliance/consent/consent-action-forms.tsx` |
| **Lines** | 603 |
| **Directive** | `"use client"` |
| **Role** | Client mutation UI for DPDP consent capture/withdrawal and DSR create/transition |

### Role

Client-side **action form suite** for the consent workspace. Wires React 19 `useActionState` to server actions in `@/features/compliance/actions` so the desk can:

1. Capture purpose-bound consent  
2. Withdraw an active consent (two-step arm → confirm)  
3. Open a data-subject request (DSR)  
4. Advance a DSR along the allowed status workflow  

Explicit import discipline (file header): actions from `@/features/compliance/actions` (not the feature barrel, which re-exports queries → postgres → would break the client bundle); pure helpers/types from `@/features/compliance/consent`.

### Exports

| Export | Kind | Signature |
|--------|------|-----------|
| `CaptureConsentDialog` | `function` | `export function CaptureConsentDialog(): JSX.Element` |
| `WithdrawConsentButton` | `function` | `export function WithdrawConsentButton({ consentRecordId }: { consentRecordId: string }): JSX.Element` |
| `CreateDsrDialog` | `function` | `export function CreateDsrDialog(): JSX.Element` |
| `TransitionDsrControls` | `function` | `export function TransitionDsrControls({ dsrId, current }: { dsrId: string; current: DsrStatus }): JSX.Element \| null` |

**Internal (non-exported) helpers:**

| Name | Role |
|------|------|
| `pretty(s: string): string` | `s.replace(/_/g, " ")` for labels |
| `Field` | Label + optional required/hint wrapper |
| `BezelInput` | Double-bezel styled `<input>` (`React.InputHTMLAttributes<HTMLInputElement>`) |
| `BezelSelect` | Controlled select + hidden input for form post |
| `fieldClass`, `labelClass` | Shared Tailwind class strings |

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React`, `useActionState` |
| `@/components/ui/dialog` | `Dialog`, `DialogContent`, `DialogDescription`, `DialogTitle`, `DialogTrigger`, `DialogClose` |
| `@phosphor-icons/react` | `Plus`, `X`, `ArrowRight`, `CircleNotch`, `ArrowFatDown`, `XCircle`, `Warning` |
| `@/lib/utils` | `cn` |
| `@/components/brand/button` | `Button` |
| `@/components/brand/text` | `Eyebrow` |
| `@/features/compliance/actions` | `captureConsent`, `withdrawConsent`, `createDsr`, `transitionDsrStatus`, `CaptureConsentState`, `WithdrawConsentState`, `CreateDsrState`, `TransitionDsrState` |
| `@/features/compliance/consent` | `DSR_TRANSITIONS`, `ConsentMethod`, `ConsentPurpose`, `DsrStatus`, `DsrType` |

### Related type quotes (from feature modules, used by this file)

```ts
// actions.ts
export type CaptureConsentState =
  | { error?: string; consentRecordId?: string }
  | undefined;
export type WithdrawConsentState = { error?: string } | undefined;
export type CreateDsrState = { error?: string; dsrId?: string } | undefined;
export type TransitionDsrState = { error?: string } | undefined;

// consent.ts
export type ConsentPurpose =
  | "marketing" | "advisory_engagement" | "kyc_processing"
  | "credit_analysis" | "data_sharing_with_rating_agency"
  | "data_sharing_with_investors" | "regulatory_reporting"
  | "portfolio_management" | "secondary_trading_contact";

export type ConsentMethod =
  | "digital_sign" | "checkbox_email" | "physical_signed" | "verbal_recorded";

export type DsrType =
  | "access" | "erasure" | "rectification" | "restriction"
  | "portability" | "withdraw_consent";

export type DsrStatus =
  | "received" | "in_review" | "fulfilled" | "rejected" | "cancelled";

export const DSR_TRANSITIONS: Record<DsrStatus, DsrStatus[]> = {
  received: ["in_review", "cancelled"],
  in_review: ["fulfilled", "rejected", "cancelled"],
  fulfilled: [],
  rejected: ["in_review"],
  cancelled: [],
};
```

**Local constants (mirror server enums):**

```ts
const PURPOSES: readonly ConsentPurpose[] = [ /* 9 purposes */ ];
const METHODS: readonly ConsentMethod[] = [ /* 4 methods */ ];
const DSR_TYPES: readonly DsrType[] = [ /* 6 types */ ];
```

### Business purpose

Operational UI for **India DPDP Act 2023** consent ledger mutations and **principal-rights** DSR workflow. Retention/SLA computation happens in server actions (`computeConsentRetentionUntil` / `computeDsrDueDate`); this file only collects FormData and displays errors.

### Key logic (per export)

#### `CaptureConsentDialog`

- State: `useActionState<CaptureConsentState, FormData>(captureConsent, undefined)`, `open`, controlled `purpose` / `method`.
- Form fields posted:
  - `partyId` (uuid text), `contactId` (uuid text) — **at least one required** (enforced server-side; UI shows hint only)
  - `purpose` (hidden via `BezelSelect`), `consentMethod`
  - `purposeDescription` (optional)
- Errors: `state?.error` in `role="alert"` banner.
- Submit disabled while `pending`; spinner + “Capturing…”.
- Does **not** auto-close dialog on success (relies on revalidation from action; `open` state may remain true until user dismisses).

#### `WithdrawConsentButton`

- Props: `{ consentRecordId: string }`
- Two-phase UX: unarmed shows “Withdraw”; armed posts hidden `consentRecordId` with “Confirm” / “Cancel”.
- Server action `withdrawConsent` may auto-spawn restriction/erasure DSR for regulated purposes (server-side; not visible in this UI beyond revalidation).

#### `CreateDsrDialog`

- Fields: `partyId`, `contactId`, `requestType`, `notes` (`textarea`, `maxLength={2000}`).
- Same dialog shell pattern as capture consent.
- SLA due date computed server-side for audit/UI elsewhere (not stored as a column per actions comment).

#### `TransitionDsrControls`

- Props: `dsrId: string`, `current: DsrStatus`
- `allowed = DSR_TRANSITIONS[current] ?? []`; if empty, returns `null` (terminal states).
- Controlled select for next status + hidden `toStatus` + hidden `dsrId`.
- **Prop-sync pattern during render** (not `useEffect`):
  ```ts
  const [lastCurrent, setLastCurrent] = React.useState<string>(current);
  if (current !== lastCurrent) {
    setLastCurrent(current);
    setNext(allowed[0] ?? "");
  }
  ```
- Posts to `transitionDsrStatus`.

#### `BezelSelect`

- Controlled `<select>` **without** `name`; posts via sibling `<input type="hidden" name={name} value={value} />` so FormData receives the controlled value.

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Server mutations | `useActionState` → `"use server"` actions |
| DB writes (via actions) | insert/update `consent_record`, `data_subject_request`; `appendAudit`; optional auto-DSR on withdraw |
| Cache revalidation | Actions call `revalidatePath("/compliance/consent")` |
| Local UI state | dialog open, armed withdraw, controlled selects, pending |

No direct `fetch`/DB access from this module.

### Security / RBAC

- **Client has no capability checks** — trust boundary is server actions:
  - `captureConsent` → `requirePermission(user, "create", "consent")`
  - `withdrawConsent` → `requirePermission(user, "update", "consent")`
  - `createDsr` → `requirePermission(user, "create", "dsr")`
  - `transitionDsrStatus` → `requirePermission(user, "update", "dsr")`
- Plus `withRls(...)` inside actions.
- **Raw UUID entry** for party/contact — no client-side format validation; Zod `uuid` on server. Risk of typos / wrong principal if desk pastes wrong ID.
- Withdraw/transition only pass opaque IDs; authorization for *which* records a user may mutate depends on RLS + action checks, not this UI.
- Error strings from server rendered into DOM (assumed non-HTML; still user-facing).

### Coupling

| Target | How |
|--------|-----|
| `@/features/compliance/actions` | All mutations + state types |
| `@/features/compliance/consent` | Enums + `DSR_TRANSITIONS` (must match DB enums and server validation lists) |
| Brand UI (`Button`, `Eyebrow`) + shadcn-style `Dialog` | Presentation |
| Consumers | `consent-view.tsx` imports all four exported components |

**Enum drift risk:** `PURPOSES` / `METHODS` / `DSR_TYPES` duplicated here, in `page.tsx`, and again in `actions.ts` / `consent.ts`.

### Risks / TODOs

1. **TODO (file header):** swap raw UUID fields for searchable party/contact pickers.
2. **Dialogs do not close on success** and do not show success toast — after capture, user may re-submit or stare at open form.
3. **No client validation** of “at least one of party/contact” before submit.
4. **`CaptureConsentDialog` / `CreateDsrDialog` ignore success payload** (`consentRecordId` / `dsrId`) — no deep-link or highlight of new row.
5. **Withdraw arming is client-only** — accidental double-confirm still possible if network retries (server is idempotent if already withdrawn).
6. **Enum triple-maintenance** across UI constants, pure types, and Zod enums in actions.
7. **Nomination DSR type** missing (noted in `consent.ts` as compliance TODO for schema) — not offered in `DSR_TYPES` here (correct given current schema).
8. Form actions surface only first Zod error message path on server.

---

## 3. `src/app/compliance/consent/consent-view.tsx`

| Field | Value |
|-------|--------|
| **Path** | `src/app/compliance/consent/consent-view.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/compliance/consent/consent-view.tsx` |
| **Lines** | 834 |
| **Directive** | `"use client"` |
| **Role** | Client view layer for DPDP consent workspace (tabs, filters, ledger table, DSR cards) |

### Role

Pure client presentation + **URL-driven filter orchestration** for the consent workspace. Server page loads data; this component owns:

- Tab switch: Consent ledger vs Data-subject requests  
- Floating `CommandBar` filters (purpose / active-only vs DSR type / status)  
- Debounced search (`q`) via `router.replace`  
- Consent ledger `Table` + withdraw controls  
- DSR card grid with SLA progress and transition controls  
- Local-only table density  

### Exports

| Export | Kind | Definition |
|--------|------|------------|
| `ConsentViewProps` | `interface` | See below |
| `ConsentView` | `function` | Main view |

```ts
export interface ConsentViewProps {
  consent: ConsentListResult;
  dsrs: DsrListResult;
  q?: string;
  purpose?: string;
  activeOnly: boolean;
  dsrStatus?: string;
  dsrType?: string;
  tab: string;
  purposes: string[];
  dsrTypes: string[];
  dsrStatuses: string[];
}

export function ConsentView({
  consent, dsrs, q, purpose, activeOnly,
  dsrStatus, dsrType, tab, purposes, dsrTypes, dsrStatuses,
}: ConsentViewProps): JSX.Element
```

**Internal components / helpers (not exported):**

| Name | Purpose |
|------|---------|
| `CountUp` | Framer-motion count-up on enter-view |
| `pretty` | underscore → space |
| `fmtDate` | `en-IN` short date or `"-"` |
| `DsrCard` | One DSR lifecycle card + SLA bar + `TransitionDsrControls` |
| `CardMeta` | 2×2 meta cell on DSR card |
| `RetentionCell` | Retention-until tone (past=down, ≤90d=gold) for active consents |
| `TabPill` | URL Link tab segment |
| `SelectPill` | Native select filter pill |
| `TogglePill` | Active-only toggle with `aria-pressed` |

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React` |
| `next/link` | `Link` |
| `next/navigation` | `useRouter`, `usePathname`, `useSearchParams` |
| `framer-motion` | `animate`, `useInView` |
| `@phosphor-icons/react` | `Sparkle`, `ShieldCheck`, `Scroll`, `Clock`, `CheckCircle`, `XCircle`, `UserCircle`, `CaretRight`, `Timer` |
| `@/lib/utils` | `cn` |
| `@/features/compliance/queries` | types `ConsentListResult`, `DsrListResult` (type-only); `DsrListItem` via inline import on `DsrCard` |
| `@/features/compliance/consent` | `computeDsrDueDate`, type `DsrStatus` |
| `@/components/brand` | `BadgeProps` type; `Card`, `Badge`, `Button`, `CommandBar`, `Reveal`, `Table*` , `TableEmpty`, type `Density` |
| `@/components/brand/text` | `Eyebrow` |
| `./consent-action-forms` | `CaptureConsentDialog`, `WithdrawConsentButton`, `CreateDsrDialog`, `TransitionDsrControls` |

### Data contracts used

```ts
// from queries.ts
export interface ConsentListItem {
  consentRecordId: string;
  partyId: string | null;
  partyLegalName: string | null;
  contactId: string | null;
  contactFullName: string | null;
  purpose: string;
  purposeDescription: string | null;
  consentGivenAt: Date | null;
  consentWithdrawnAt: Date | null;
  consentMethod: string | null;
  dataCategories: string[] | null;
  retentionUntil: string | null;
  versionOfPolicy: string | null;
  active: boolean;
}
export interface ConsentListResult {
  rows: ConsentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DsrListItem {
  dsrId: string;
  partyId: string | null;
  partyLegalName: string | null;
  contactId: string | null;
  contactFullName: string | null;
  requestType: string;
  status: string;
  requestedAt: Date;
  completedAt: Date | null;
  handledByEmail: string | null;
  notes: string | null;
}
export interface DsrListResult {
  rows: DsrListItem[];
  total: number;
  page: number;
  pageSize: number;
}
```

### Business purpose

Gives compliance / relationship desks a **shareable, filterable workspace** for:

1. **Consent ledger** — purpose-bound consents, method, given/withdrawn timestamps, retention horizon, active vs withdrawn state, inline withdraw.  
2. **Data-subject requests** — principal-rights pipeline with SLA countdown (statutory windows from `DSR_TIMELINE_DAYS`), status badges, and workflow advance.

Localization of dates uses `en-IN` (India market / DPDP context).

### Key logic

#### URL / filter orchestration

```ts
const isConsentTab = tab !== "dsr"; // default tab "consent" from page

const pushParam = (key, value) => {
  // set or delete key; always delete "page"; router.replace(pathname?qs)
};

// Debounced search (280ms) → updates `q` in URL
// Density is pure client state ("comfortable" default)
```

- Tab pills rebuild query string preserving **tab-relevant** filters only (consent filters vs DSR filters).
- Clear buttons: `/compliance/consent?tab=consent` or `?tab=dsr`.

#### Consent ledger table

Columns: Party/contact · Purpose · Method (md+) · Given · Withdrawn (md+) · Retention until (md+) · State (+ withdraw if active).

Empty states distinguish `consent.total === 0` (none on record) vs filtered empty.

#### `RetentionCell`

- Only tones for **active** consents: past horizon → `text-down`; 0–90 days → `text-gold`.
- Withdrawn: still shows date without warn icons (comment: purge job governs withdrawn retention).

#### `DsrCard` SLA model

```ts
const due = computeDsrDueDate(d.requestType as DsrType, d.requestedAt);
const overdue = due && now > due && status not in fulfilled|rejected|cancelled;
const dueSoon  = due && !overdue && due <= now+7d && same open statuses;

// slaFraction: elapsed / (due - requested), clamped [0, 1.25]
// fillPct: settled → 100; else min(1, fraction)*100
// barTone: settled emerald | overdue down | dueSoon gold | else emerald
```

Meta grid: Requested · SLA due · Completed · Handled by (`handledByEmail`).

#### Status badge map

```ts
const DSR_STATUS_BADGE: Record<string, { variant: BadgeProps["variant"]; dot?: boolean }> = {
  received: { variant: "outline" },
  in_review: { variant: "info" },
  fulfilled: { variant: "emerald", dot: true },
  rejected: { variant: "down" },
  cancelled: { variant: "neutral" },
};
```

#### Footer counts

`CountUp` animates **shown row count** (`consent.rows.length` / `dsrs.rows.length`), not `total` — can understate full corpus when pageSize caps results.

### Side effects

| Effect | Detail |
|--------|--------|
| Client navigation | `router.replace` on filter/search; `Link` for tabs/clear |
| Debounce timer | `setTimeout` 280ms; cleaned on unmount |
| Framer Motion | `animate` on CountUp; `useInView`; `Reveal` wrappers |
| No direct DB | Read data is props-only; mutations only via nested action forms |

### Security / RBAC

- No client-side permission gates (any user who can load the page sees the UI shell).
- Data already scoped by server queries (`consentVisibilityClause` / `dsrVisibilityClause` when user passed).
- Mutation RBAC deferred to server actions inside nested forms.
- `notes` rendered with `line-clamp-2` as text (React escapes HTML).
- Search params are user-controlled; only used as filter inputs re-sent to server via URL.

### Coupling

| Target | Nature |
|--------|--------|
| `consent-action-forms.tsx` | Capture / withdraw / create DSR / transition UI |
| `@/features/compliance/queries` types | Row shape |
| `@/features/compliance/consent` | `computeDsrDueDate`, `DsrStatus` |
| Brand design system | Heavy UI dependency |
| Parent `page.tsx` | Sole data provider + filter option lists |
| Next.js router | Shareable URL state |

### Risks / TODOs

1. **DSR search is non-functional end-to-end:** UI shows “Search principal…” and writes `q` to the URL, but `listDataSubjectRequests` accepts **no `q` parameter** and `page.tsx` does not pass `q` into that query. Consent search works; DSR search only re-fetches unchanged DSR set (and may refilter consent list in the background).
2. **No client pagination UI** despite `ConsentListResult` / `DsrListResult` carrying `page` / `pageSize` / `total` — page always requests `page: 1`. Users cannot see past first `PAGE_SIZE` (25) rows; footer “shown” count reinforces the illusion.
3. **Both datasets always loaded** by parent regardless of tab — performance/cost issue for large ledgers (owned mostly by page, but view always receives both).
4. **`requestType` cast** `as Parameters<typeof computeDsrDueDate>[0]` — if DB enum drifts, SLA silently nulls.
5. **`d.status as DsrStatus`** for transitions — invalid DB status yields empty transitions or wrong select options.
6. **`hasConsentFilters` treats `activeOnly` as filter** even when default false is off — correct; when true, Clear works.
7. Search debounce does **not** reset `page` (page never used for consent pagination yet).
8. Mobile drops Method / Withdrawn / Retention — intentional; compliance full-read needs md+.
9. Framer `CountUp` + `Reveal` whileInView may hide numbers in headless snapshots (contrast with audit page comment about non-whileInView headers).

---

## 4. `src/app/compliance/consent/page.tsx`

| Field | Value |
|-------|--------|
| **Path** | `src/app/compliance/consent/page.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/compliance/consent/page.tsx` |
| **Lines** | 105 |
| **Directive** | None (Server Component) |
| **Route** | `/compliance/consent` |

### Role

Server page entry for the **DPDP Consent ledger + DSR workspace**. Authenticates, parses filters from `searchParams`, concurrently loads consent records and DSRs under the current user’s visibility, and renders `ConsentView` inside brand chrome.

### Exports

| Export | Kind | Notes |
|--------|------|-------|
| `dynamic` | `const` | `export const dynamic = "force-dynamic"` |
| `ConsentPage` (default) | `async function` | See signature |

```ts
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    purpose?: string;
    active?: string;
    dsrStatus?: string;
    dsrType?: string;
    tab?: string;
  }>;
}): Promise<JSX.Element>
```

**Module-local constants:**

```ts
const PAGE_SIZE = 25;

const PURPOSES = [
  "marketing", "advisory_engagement", "kyc_processing", "credit_analysis",
  "data_sharing_with_rating_agency", "data_sharing_with_investors",
  "regulatory_reporting", "portfolio_management", "secondary_trading_contact",
];

const DSR_TYPES = [
  "access", "erasure", "rectification", "restriction",
  "portability", "withdraw_consent",
];

const DSR_STATUSES = [
  "received", "in_review", "fulfilled", "rejected", "cancelled",
];
```

### Imports

| Source | Symbols |
|--------|---------|
| `@/components/brand/page-shell` | `PageHeader`, `PageShell` |
| `@/lib/rbac` | `requireUser` only (**no `can`**) |
| `@/features/compliance/queries` | `listConsentRecords`, `listDataSubjectRequests` |
| `@/components/brand` | `Reveal` — **imported but unused** |
| `./consent-view` | `ConsentView` |

### Business purpose

Entry point for privacy-ops: list and manage **purpose-bound consent records** and **DPDP principal-rights requests** in one workspace. Title/description: `"Consent"` / `"DPDP consent ledger."`

### Key logic

1. Force dynamic rendering (DB-backed; avoid build-time query execution).
2. `const user = await requireUser();` — auth required.
3. Parse params:
   - `q = sp.q?.trim() || undefined`
   - `purpose = sp.purpose || undefined`
   - `activeOnly = sp.active === "1"`
   - `dsrStatus`, `dsrType` optional strings
   - `tab = sp.tab ?? "consent"`
4. Parallel fetch:
   ```ts
   const [consent, dsrs] = await Promise.all([
     listConsentRecords({
       q, purpose, activeOnly, user, page: 1, pageSize: PAGE_SIZE,
     }),
     listDataSubjectRequests({
       status: dsrStatus, requestType: dsrType, user,
       page: 1, pageSize: PAGE_SIZE,
     }),
   ]);
   ```
5. Render `PageShell` → `PageHeader` → `ConsentView` with datasets + filter option arrays.

### Side effects

| Effect | When |
|--------|------|
| Auth/session load | `requireUser` |
| Two DB list queries | Always, both tabs’ data |
| No mutations | Read path only |
| Unused import `Reveal` | Dead code (lint candidate) |

### Security / RBAC

- **Auth:** `requireUser()` only.
- **No page-level `can(user, "read", "consent")` / `"dsr"` check** — unlike audit page. Any authenticated CRM user who can hit the route sees the shell; **row visibility** is applied inside queries via:
  - `consentVisibilityClause(user)` — full ledger if `canReadAllPrivacyLedger`, else assigned/data-owner/created party scope (and contact→party EXISTS).
  - `dsrVisibilityClause(user)` — full if read-all; else handled-by-self OR assigned party scope OR contact-linked party scope.
- **Mutations** still gated in actions (`create`/`update` on `consent` / `dsr`).
- **Gap vs audit pattern:** users with no consent/dsr permissions may still open the page and see empty or partial lists (depending on visibility helper when `!appUserId` returns `undefined` clause — see queries: if `!scopedUserId` visibility clause is `undefined` → **unscoped**). That edge case depends on whether `requireUser` always populates `appUserId`.

### Coupling

| Target | Nature |
|--------|--------|
| `listConsentRecords` / `listDataSubjectRequests` | Data + visibility |
| `ConsentView` | All UI |
| Filter option constants | Duplicated with action-forms / consent types |
| Tables (indirect) | `consent_record`, `data_subject_request`, `party`, `contact`, `app_user` |

### Risks / TODOs

1. **Missing page-level capability gate** (contrast `/compliance/audit`). Decide whether any logged-in user should open this route.
2. **`q` not applied to DSR list** — UI search on DSR tab ineffective (see consent-view risks).
3. **Hard-coded `page: 1`** — no pagination; `total` can exceed `PAGE_SIZE` without navigation.
4. **Always loads both lists** even when `tab=dsr` or `tab=consent` — extra query cost.
5. **Unused import:** `Reveal` from `@/components/brand`.
6. **No server validation** that `purpose` / `dsrStatus` / `dsrType` are members of the constant arrays — invalid values yield empty filtered results via SQL `eq`.
7. **Enum lists triplicated** with `consent-action-forms.tsx` and `features/compliance/consent.ts`.
8. Description only mentions consent ledger; page also hosts full DSR workspace.

---

## Cross-file architecture (batch-019)

```
/compliance/audit
  page.tsx (RSC, RBAC can(read|read_all, audit)|manage user)
    → listAuditLog(filter, page, pageSize=50)
    → AuditListView (client, sibling)

/compliance/consent
  page.tsx (RSC, requireUser only)
    → listConsentRecords({ q, purpose, activeOnly, user, page:1, pageSize:25 })
    → listDataSubjectRequests({ status, requestType, user, page:1, pageSize:25 })
    → ConsentView (client)
         → CommandBar + Table | DsrCard grid
         → consent-action-forms (client)
              → captureConsent | withdrawConsent | createDsr | transitionDsrStatus
                   (server actions + withRls + appendAudit + revalidatePath)
```

### Shared domain tables / entities

| Entity | Surface in this batch |
|--------|------------------------|
| `audit_log` | Audit page read via `listAuditLog` |
| `consent_record` | Consent list + capture/withdraw |
| `data_subject_request` | DSR list + create/transition |
| `party` / `contact` | Joined names; UUID inputs for create |
| `app_user` | Audit actor email; DSR handled-by email |

### Consistency notes

| Concern | Audit page | Consent page |
|---------|------------|--------------|
| Auth | `requireUser` | `requireUser` |
| Page RBAC | Explicit `can` | None |
| force-dynamic | Yes | Yes |
| Pagination | Wired (`page` param, PAGE_SIZE 50) | Page always 1, PAGE_SIZE 25, no UI |
| Client view | `AuditListView` (out of batch) | `ConsentView` + action forms |

### Highest-priority findings (batch)

1. Consent page lacks page-level resource permission check present on audit.  
2. DSR tab search (`q`) is wired in UI/URL but not in `listDataSubjectRequests` / page query args.  
3. Consent/DSR lists have no pagination UI despite totals and pageSize.  
4. Raw UUID party/contact entry for legal-sensitive consent/DSR creation (acknowledged TODO).  
5. Enum/option lists duplicated across page, action forms, and pure domain module.  
6. Unused `Reveal` import on consent `page.tsx`.  
7. Capture/Create dialogs do not close or celebrate success after action returns IDs.

---

*End of agent-019 report. Docs ignored per instructions. Analysis exhaustive for the four paths in `batch-019.list`.*
