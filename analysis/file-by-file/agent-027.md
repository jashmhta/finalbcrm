# Agent 027 — File-by-file analysis

**Batch:** `batch-027.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  

---

## 1. `src/app/documents/documents-list-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/documents/documents-list-view.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/documents/documents-list-view.tsx` |
| **Lines** | 490 |
| **Directive** | `"use client"` |
| **Role** | Documents index client view layer — type filter rail, command bar (search / MNPI / density / CSV export / upload dialog), density-aware data table, and windowed pagination. Server page supplies rows + filter state; this component owns URL-driven filter UX and pure client density. |

### Exports

```ts
export interface DocumentsListViewProps {
  rows: DocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
  typeKey: string;
  mnpiOnly: boolean;
  typeFilters: readonly string[];
}

export function DocumentsListView({
  rows,
  total,
  page,
  pageSize,
  totalPages,
  q,
  typeKey,
  mnpiOnly,
  typeFilters,
}: DocumentsListViewProps): JSX.Element
```

**Internal (non-exported) components / helpers:**

| Name | Signature / shape | Purpose |
|------|-------------------|---------|
| `formatSize` | `(bytes: number \| null) => string` | Human file size (B / KB / MB / GB) or `"-"` |
| `Pagination` | `({ page, totalPages, typeKey, mnpiOnly, q? })` | Prev/next + windowed page pills preserving filters |
| `PagePill` | `({ href, active, children })` | Single page number link |
| `TYPE_ICON` | `Record<string, React.ReactNode>` | Per-`documentType` Phosphor icon map (partial) |

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React` |
| `next/link` | `Link` |
| `next/navigation` | `useRouter`, `usePathname`, `useSearchParams` |
| `@phosphor-icons/react` | `ArrowLeft`, `ArrowRight`, `ArrowFatDown` (**unused**), `Files`, `FileText`, `Sparkle`, `SealWarning`, `LockSimple`, `Eye`, `UploadSimple` (**unused**) |
| `@/lib/utils` | `cn` |
| `@/features/documents/queries` | type `DocumentListItem` |
| `@/components/brand` | `Card`, `Badge`, `Button`, `CommandBar`, `Reveal`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `TableEmpty`, type `Density` |
| `@/features/reports/export-button` | `ExportCsvButton` |
| `./new-document-dialog` | `NewDocumentDialog` |

**Referenced external type (`DocumentListItem` from `@/features/documents/queries`):**

```ts
export interface DocumentListItem {
  documentId: string;
  documentType: string | null;
  kycCategory: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  isConfidential: boolean | null;
  isMnpi: boolean | null;
  barrierId: string | null;
  retentionUntil: string | null;
  dealId: string | null;
  dealCode: string | null;
  partyId: string | null;
  partyName: string | null;
  contactId: string | null;
  contactName: string | null;
  uploadedByEmail: string | null;
  createdAt: Date | null;
}
```

### Business purpose

Operator-facing **document vault index** for Binary CRM:

1. **Browse** registered document metadata (not blob bytes) with type pills, free-text file-name search, and MNPI-only toggle.
2. **Inspect flags** at a glance: MNPI, confidential, information-barrier (“walled”).
3. **Navigate** to document detail (`/documents/:id`), linked party (`/parties/:partyId`), and deals list for deal code.
4. **Export** documents CSV via `ExportCsvButton type="documents"`.
5. **Register** new document metadata via embedded `NewDocumentDialog`.
6. **Paginate** large vaults while preserving `type`, `mnpi`, and `q` query params.

This is the client half of a classic server-fetch + client-filter-UX pattern used across list pages (tasks, interactions, etc.).

### Key logic

**URL-driven search (debounced 280ms):**

```ts
// Local `search` state mirrors prop `q`.
// onSearchChange → setSearch + setTimeout → pushSearch
// pushSearch mutates URLSearchParams:
//   - set/delete "q"
//   - delete "page" (reset to page 1 on new search)
// router.replace(pathname?qs)
```

Cleanup effect clears debounce timer on unmount.

**MNPI filter href:**

```ts
function mnpiHref(on: boolean) {
  // toggle "mnpi=1", delete "page", preserve other params
}
```

Rendered as `Button asChild` wrapping `Link` — active style when `mnpiOnly`.

**Type filter rail:** maps `typeFilters` to `Link`s at `/documents?type=…` plus optional `mnpi` and `q`. Active pill uses `aria-current="page"`. Labels prettify underscores (`term_sheet` → `term sheet`); `"all"` → `"All"`.

**Range display:**

```ts
rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1
rangeTo   = Math.min(page * pageSize, total)
// Locale: en-IN for numbers and uploaded dates
```

**`formatSize`:** null → `"-"`; &lt;1KB raw B; &lt;1MB one-decimal KB; &lt;1GB one-decimal MB; else two-decimal GB.

**Table columns:** File | Type (md+) | Size (md+) | Linked to (md+) | Flags | Uploaded. Mobile drops Type/Size/Linked-to so vault reads File · Flags · Uploaded.

**Row content:**

| Column | Rendering |
|--------|-----------|
| File | Link to `/documents/${documentId}`; icon from `TYPE_ICON` or default `FileText`; name or `"(unnamed)"`; subline mime type |
| Type | Neutral badge for `documentType`; optional outline badge for `kycCategory` |
| Size | `formatSize(sizeBytes)` with `nums tabular-nums` |
| Linked to | Party link if `partyName`/`partyId`; deal code link to **`/deals`** (list, not deal detail); contact name as plain text; else `"-"` |
| Flags | MNPI (`Badge variant="down"`), confidential (neutral + lock), walled if `barrierId` (outline + eye); else `"-"` |
| Uploaded | `createdAt.toLocaleDateString("en-IN", { year, month: "short", day: "2-digit" })`; uploader email subline |

**Empty states:**

- `total === 0` → “The vault is empty.” / register-first hint  
- `rows.length === 0` but `total > 0` (filter miss) → “No documents match this view.”

**Pagination window:** `win = 1` around current page; always can jump to 1 and last when outside window; ellipsis when gap &gt; 1. Prev/next use `pointer-events-none opacity-40` when disabled (still render `Link` to clamped page).

**`TYPE_ICON` coverage (partial):** only `kyc_pack`, `financial_statement`, `credit_memo`, `term_sheet`, `legal_dd_report`, `site_report` — everything else falls back to `FileText`.

**Density:** local `useState<Density>("comfortable")`; not URL-persisted; passed to `Table density={density}` and `CommandBar`.

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Navigate (search) | `router.replace` on debounced query change |
| Navigate (filters/pagination) | `<Link href=…>` full navigation |
| CSV export | `ExportCsvButton` (reports feature; side effects inside that component) |
| Document create | `NewDocumentDialog` → server action (not in this file) |
| Local UI only | `density`, `search`, debounce ref — no DB access |

No cookies, no direct `fetch`, no server actions invoked from this file itself.

### Security / RBAC

- **Presentation only.** Row visibility / MNPI / barrier filtering is enforced in `listDocuments` (server query + RLS / `documentVisibilityClause`). This file trusts props.
- **Sensitive metadata in DOM:** file names, mime types, party/deal/contact names, uploader emails, MNPI/confidential/barrier flags, and UUIDs as link targets — any authenticated user who can load `/documents` receives whatever the server returned.
- **No client-side permission checks** for upload button or export; `NewDocumentDialog` / `createDocument` and export endpoint must enforce independently.
- **Deal link** does not pass `dealId` — only displays `dealCode` and links to generic `/deals` list (information leak risk is low; navigation incomplete rather than over-exposed).

### Coupling

| Coupling | Detail |
|----------|--------|
| Strong | Parent `DocumentsPage` must pass full pagination + filter props matching URL |
| Strong | `DocumentListItem` shape from `@/features/documents/queries` |
| Strong | `./new-document-dialog` for upload CTA |
| Medium | `@/features/reports/export-button` with `type="documents"` contract |
| Medium | Next.js App Router navigation hooks + Link query-string conventions (`type`, `q`, `mnpi`, `page`) |
| UI | Brand design system (`CommandBar`, `Table*`, `Badge`, `Button`, `Card`, `Reveal`) |

Does **not** import `@/db` or runtime document query modules (`import type` only for `DocumentListItem`).

### Risks / TODOs

1. **Unused imports:** `ArrowFatDown`, `UploadSimple` — dead code / lint noise.
2. **Deal link incomplete:** `d.dealCode` links to `/deals` not `/deals/${d.dealId}` (or deal detail route); operators cannot deep-link from vault to the specific deal.
3. **Contact is not a link** even when `contactId` exists — inconsistent with party linking.
4. **`retentionUntil` unused** in UI despite being on `DocumentListItem` — DPDP retention not surfaced in the index.
5. **Type filter set is subset** of full document types (see `TYPE_FILTERS` on page / fuller list in dialog) — documents of types not in the rail only appear under “All”.
6. **Search is server-side only on commit** — intermediate typing is local; 280ms debounce + `router.replace` can race if user types quickly then navigates away.
7. **Pagination disabled buttons still produce hrefs** (clamped) but rely on CSS `pointer-events-none` — accessible keyboard users might still activate depending on Button/Link composition.
8. **No sort controls** — order fully server-defined.
9. **Date serialization:** `createdAt` is a `Date` in the type; if the RSC boundary serializes to string without reviver, `toLocaleDateString` could throw at runtime (depends on Next serialization; often Dates become strings across client boundary — **risk** if not rehydrated).
10. **`TYPE_ICON` incomplete** relative to `DOCUMENT_TYPES` / `TYPE_FILTERS`.

---

## 2. `src/app/documents/new-document-dialog.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/documents/new-document-dialog.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/documents/new-document-dialog.tsx` |
| **Lines** | 450 |
| **Directive** | `"use client"` |
| **Role** | “Upload document” dialog — **metadata registration stub**. Operator pastes object-store key + optional SHA-256; file input is disabled. Submits `FormData` to `createDocument` server action via `useActionState`. |

### Exports

```ts
export function NewDocumentDialog(): JSX.Element
```

No exported props interface (self-contained; no external props).

**Internal (non-exported) components / constants:**

| Name | Signature / shape | Purpose |
|------|-------------------|---------|
| `DOCUMENT_TYPES` | `readonly` string tuple (23 values) | Document type select options |
| `KYC_CATEGORIES` | `readonly` string tuple (7 values) | Optional KYC category select options |
| `Field` | `({ label, htmlFor?, required?, hint?, children })` | Label + optional required gold star + hint |
| `CheckRow` | `({ name, icon, title, hint })` | Styled checkbox row (`isConfidential` / `isMnpi`) |
| `BezelInput` | `React.InputHTMLAttributes<HTMLInputElement>` | Double-bezel text/number/date input shell |
| `BezelSelect` | controlled select + optional hidden `name` input | Type / KYC selects for form submit |

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React`, `useActionState` |
| `@/components/ui/dialog` | `Dialog`, `DialogContent`, `DialogDescription`, `DialogTitle`, `DialogTrigger`, `DialogClose` |
| `@phosphor-icons/react` | `X`, `ArrowRight`, `CircleNotch`, `ArrowFatDown`, `UploadSimple`, `SealWarning`, `LockSimple`, `FileText` |
| `@/lib/utils` | `cn` |
| `@/components/brand/button` | `Button` |
| `@/components/brand/text` | `Eyebrow` |
| `@/features/documents/actions` | `createDocument`, type `CreateDocumentState` |

**Referenced action state type:**

```ts
export type CreateDocumentState = { error?: string } | undefined;
```

**Server action contract (not defined here; invoked by form):**

```ts
export async function createDocument(
  _prev: CreateDocumentState,
  formData: FormData,
): Promise<CreateDocumentState>
// → requireUser + can(user, "create", "document")
// → createDocumentSchema.safeParse(parseForm(formData))
// → withRls insert into `document`
// → revalidatePath("/documents"); redirect(`/documents/${documentId}`)
```

**`parseForm` fields expected by action (must match form `name`s):**

```ts
{
  documentType, kycCategory, fileName, mimeType, sizeBytes,
  sha256, fileStoreRef, dealId, partyId, contactId,
  isConfidential, // FormData "on" when checked
  isMnpi,         // FormData "on" when checked
  barrierId,      // parsed by action but NOT present in this form
  retentionUntil,
}
```

### Constants (quoted)

```ts
const DOCUMENT_TYPES = [
  "engagement_letter",
  "mandate_letter",
  "rating_rationale",
  "offering_circular",
  "drhp",
  "information_memorandum",
  "term_sheet",
  "security_document",
  "trustee_deed",
  "kyc_pack",
  "pan_card",
  "aadhaar",
  "board_resolution",
  "form60",
  "form61",
  "financial_statement",
  "financial_model_file",
  "credit_memo",
  "valuation_report",
  "legal_dd_report",
  "site_report",
  "consent_form",
  "other",
] as const;

const KYC_CATEGORIES = [
  "id_proof",
  "address_proof",
  "pan",
  "bo_declaration",
  "pep_declaration",
  "source_of_funds",
  "authority_letter",
] as const;
```

### Business purpose

Phase-1 **document registration** without real binary upload:

1. Capture **metadata** that maps to the `document` table: file name, type, optional KYC category, MIME, size, S3 key (`file_store_ref`), integrity hash, polymorphic links (deal / party / contact), DPDP retention date, confidential + MNPI flags.
2. Document intent of a future **presigned-PUT** pipeline (comments + disabled file input + dropzone stub copy).
3. Keep **zod validation + `createDocument` action** unchanged — view-only elevation to double-bezel UI.

On success the server action **redirects** to the new document detail page (dialog does not need client-side success close).

### Key logic

**Action state:**

```ts
const [state, action, pending] = useActionState<CreateDocumentState, FormData>(
  createDocument,
  undefined,
);
const [open, setOpen] = React.useState(false);
const [documentType, setDocumentType] = React.useState<string>("other");
const [kycCategory, setKycCategory] = React.useState<string>("");
```

**Controlled selects via `BezelSelect`:**

- Visible `<select>` has **no `name`** — form payload comes from sibling `<input type="hidden" name={name} value={value} />`.
- KYC: UI value `"none"` maps to empty string; `name={kycCategory ? "kycCategory" : undefined}` so empty choice **omits** the field entirely (action treats missing as `undefined`).

**Required client field:** only `fileName` (`required` attribute). All other fields optional at HTML level; server schema is authoritative.

**Checkboxes:** native `type="checkbox" name="isConfidential" | "isMnpi"` with custom peer-checked styling; unchecked → field absent → action parses as `false` via `=== "on"`.

**Error UI:** `state?.error` in `role="alert"` down-styled banner; no success UI (redirect).

**Pending UI:** submit disabled; spinner `CircleNotch`; label “Registering…”.

**File input stub:**

```tsx
<input id="file" name="file" type="file" disabled className="hidden" />
```

Disabled + hidden; not submitted usefully. Dropzone is decorative.

**No `useEffect` to close dialog on success** — intentional given `redirect()` in action. Dialog `open` state only toggled by user / Radix `onOpenChange`.

**No reset of controlled state** when dialog reopens — `documentType` / `kycCategory` persist across open cycles until remount.

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Create document | Form `action={action}` → `createDocument` server action → DB insert (RLS) → `revalidatePath("/documents")` → `redirect(/documents/:id)` |
| UI-only | Dialog open/close, select state, pending spinner |

No client `fetch`. Blob never leaves the browser as upload (because input disabled).

### Security / RBAC

- **Client presentation only.** Permission gate is server-side: `can(user, "create", "document")`. Users without create still see the dialog trigger if the parent renders it (list view always mounts `NewDocumentDialog`).
- **No client validation** of UUID format for deal/party/contact; invalid IDs fail at schema or FK/insert time on server.
- **SHA-256:** `maxLength={64}` only; no hex-pattern enforcement client-side.
- **MNPI / confidential flags** are operator-asserted; no automatic barrier assignment — form has **no `barrierId` field** even though action `parseForm` accepts `barrierId`. Walled documents cannot be registered as walled from this UI.
- **Object-store key free text:** operator can paste arbitrary `file_store_ref` strings — integrity depends on process/discipline until presigned flow ships.
- **Error messages** from server (`state.error`) rendered to user — must not leak stack/internal details (action returns short strings).

### Coupling

| Coupling | Detail |
|----------|--------|
| Strong | `@/features/documents/actions` — `createDocument` + `CreateDocumentState` + FormData field names |
| Strong | Dialog primitive API (`render` prop on Trigger/Close — custom Dialog wrapper, not stock shadcn) |
| Medium | Brand `Button` / `Eyebrow` paths (`@/components/brand/button`, `@/components/brand/text` — **not** barrel `@/components/brand`) |
| Weak | `DOCUMENT_TYPES` / `KYC_CATEGORIES` duplicated conceptually with DB enums / list page `TYPE_FILTERS` — can drift |

Does **not** import queries or `@/db`.

### Risks / TODOs

1. **Upload is stubbed** — comments explicitly defer presigned-PUT; operators must manually set S3 keys; easy to register orphan metadata with no blob.
2. **`barrierId` not in form** — action supports it; confidential “walled group” hint is misleading without barrier selection.
3. **No client success handling if redirect fails** — state only has `error?`; silent success without redirect would leave dialog open with no confirmation.
4. **Controlled selects don't reset** on reopen; leftover type/KYC from prior attempt.
5. **`name="file"` disabled input** — harmless but noise; if later enabled without removing disabled, large files could be ignored while metadata submits.
6. **Type catalog drift** vs `TYPE_FILTERS` on `page.tsx` and DB enum — dialog allows types (e.g. `drhp`, `aadhaar`) that the index type rail cannot filter directly.
7. **Free-form UUID IDs** without picker — high operator error rate; no existence check before submit beyond server schema.
8. **Retention date** is raw `type="date"` string — timezone/boundary depends on server schema.
9. **BezelSelect without JS** would not submit type/KYC (hidden inputs depend on React state).
10. **Permission UX gap:** no disable/hide of trigger when user lacks `document:create`; failed submit shows generic error only after attempt.

---

## 3. `src/app/documents/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/documents/page.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/documents/page.tsx` |
| **Lines** | 78 |
| **Directive** | None (Server Component) |
| **Role** | App Router page for `/documents` — auth gate, parse search params, load paginated document list, render shell + client list view. Forced dynamic (DB-backed, never prerender). |

### Exports

```ts
export const dynamic = "force-dynamic";

export const TYPE_FILTERS = [
  "all",
  "engagement_letter",
  "mandate_letter",
  "term_sheet",
  "offering_circular",
  "information_memorandum",
  "kyc_pack",
  "financial_statement",
  "credit_memo",
  "legal_dd_report",
  "site_report",
  "consent_form",
  "other",
] as const;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    q?: string;
    mnpi?: string;
    page?: string;
  }>;
}): Promise<JSX.Element>
```

No other exports.

### Imports

| Source | Symbols |
|--------|---------|
| `@/components/brand/page-shell` | `PageHeader`, `PageShell` |
| `@/lib/rbac` | `requireUser` |
| `@/features/documents/queries` | `listDocuments` |
| `@/components/brand` | `Reveal` (**imported but unused**) |
| `./documents-list-view` | `DocumentsListView` |

### Business purpose

Server entry for the firm’s **document records index**:

1. Ensure the visitor is authenticated (`requireUser` → redirect `/login` if not).
2. Interpret shareable URL filters: type, free-text `q`, MNPI flag, page.
3. Load a visibility-scoped page of documents via `listDocuments`.
4. Hand data + filter props to `DocumentsListView` inside brand `PageShell` / `PageHeader`.

Comment: `// DB-backed document index - never prerender.`

### Key logic

```ts
const PAGE_SIZE = 25;

const user = await requireUser();
const sp = await searchParams; // Next 15+/16 async searchParams

const q = sp.q?.trim() || undefined;
const page = Math.max(1, Number(sp.page) || 1);
const typeKey = sp.type ?? "all";
const mnpiOnly = sp.mnpi === "1";

const documentType =
  typeKey !== "all" && (TYPE_FILTERS as readonly string[]).includes(typeKey)
    ? typeKey
    : undefined;
// Unknown type query values → treated as no type filter (all), but typeKey
// still passed through to the client rail (may show no active pill match if
// typeKey is not in TYPE_FILTERS — active check is f === typeKey).

const { rows, total, page: curPage, pageSize } = await listDocuments({
  documentType,
  mnpiOnly,
  q,
  user,
  page,
  pageSize: PAGE_SIZE,
});

const totalPages = Math.max(1, Math.ceil(total / pageSize));
```

**`listDocuments` signature (consumer contract):**

```ts
export async function listDocuments({
  documentType,
  partyId,
  dealId,
  contactId,
  mnpiOnly,
  q,
  user,
  page = 1,
  pageSize = 25,
}: {
  documentType?: string;
  partyId?: string;
  dealId?: string;
  contactId?: string;
  mnpiOnly?: boolean;
  q?: string;
  user?: CrmUser | null;
  page?: number;
  pageSize?: number;
} = {}): Promise<DocumentListResult>
```

Page only uses: `documentType`, `mnpiOnly`, `q`, `user`, `page`, `pageSize` — not party/deal/contact scoped listing (those are for other surfaces).

**Render tree:**

```tsx
<PageShell>
  <PageHeader
    title="Documents"
    description="NDAs, term sheets, KYC packs, and filings."
  />
  <DocumentsListView
    rows={rows}
    total={total}
    page={curPage}
    pageSize={pageSize}
    totalPages={totalPages}
    q={q}
    typeKey={typeKey}
    mnpiOnly={mnpiOnly}
    typeFilters={TYPE_FILTERS}
  />
</PageShell>
```

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Auth redirect | `requireUser()` → `redirect("/login")` if unauthenticated |
| DB read | `listDocuments` (RLS / visibility clause inside feature query) |
| Dynamic rendering | `export const dynamic = "force-dynamic"` — always server-render on request |

No mutations, no cookies written by this file.

### Security / RBAC

- **`requireUser()`** — unauthenticated users never see the page.
- **No explicit `can(user, "read", "document")`** on the page itself — relies on `listDocuments` + `documentVisibilityClause` / `canReadAllDocuments` (admin / super_admin / `document:read_all` / `user:manage` vs scoped visibility). Users with login but zero document visibility get empty list, not 403.
- **MNPI filter** is operator-requested (`mnpi=1`); actual MNPI row inclusion still depends on query visibility rules for the user.
- Search `q` is passed through after trim — SQL injection mitigated by query builder (assumed in `listDocuments`, not visible here).
- **Type whitelist:** only `TYPE_FILTERS` members (except `"all"`) become `documentType`; arbitrary `type=` query values do not inject raw types into the query.

### Coupling

| Coupling | Detail |
|----------|--------|
| Strong | `@/features/documents/queries.listDocuments` |
| Strong | `@/lib/rbac.requireUser` |
| Strong | `./documents-list-view` prop contract |
| Medium | Brand page shell/header |
| Shared constant | `TYPE_FILTERS` exported — available for reuse; currently consumed only by this page → passed as prop |

### Risks / TODOs

1. **Unused import `Reveal`** from `@/components/brand` — dead code.
2. **No page-level authorization beyond login** — empty vault vs forbidden is indistinguishable for users who should not access documents module.
3. **`TYPE_FILTERS` subset of full document types** — documents registered as e.g. `pan_card` / `drhp` only under “All”; type rail cannot isolate them.
4. **Invalid `page` NaN:** `Number(sp.page) || 1` handles NaN; negative becomes 1 via `Math.max(1, …)`. Very large page numbers deferred to `listDocuments` (likely empty rows, high `totalPages` still computed).
5. **`typeKey` not in filters:** if user crafts `?type=pan_card`, server queries all types (`documentType` undefined) but client rail shows no active “all” if `typeKey !== "all"` — all pills inactive; confusing UX.
6. **Async `searchParams: Promise<…>`** — correct for this Next version; do not “fix” to sync object without checking Next docs in `node_modules/next/dist/docs/`.
7. **Date serialization** of `createdAt` to client component — potential Date→string boundary issue (see list-view risks).
8. **Header copy** mentions “NDAs” but NDA is not a first-class type in `TYPE_FILTERS` / dialog list (would be `other` or a missing type).

---

## 4. `src/app/error.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/error.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/error.tsx` |
| **Lines** | 65 |
| **Directive** | `"use client"` |
| **Role** | Root App Router **error boundary** UI for unhandled errors in route segments under the root layout. Replaces Next.js default error chrome with on-brand recovery surface. Must be a Client Component (Next error boundaries are client-side). |

### Exports

```ts
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element
```

Default export only — Next.js convention for `error.tsx`.

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React` |
| `@phosphor-icons/react` | `WarningCircle` |
| `@/components/brand` | `Button`, `Card` |
| `@/components/brand/text` | `Eyebrow` |

### Business purpose

Calm operator recovery when any nested route throws:

1. Avoid leaking **exception message**, **digest**, or **stack** into the DOM (dev default chrome and stark prod “Application error” pages are explicitly rejected by comments).
2. Log the full error for operators/devs via `console.error`.
3. Offer **Try again** via Next’s `reset()` to re-render the errored segment without full app reload.

### Key logic

```ts
React.useEffect(() => {
  // Operator-side only - never surfaced to the user.
  console.error("Unhandled route error:", error);
}, [error]);
```

UI structure:

- Centered max-width container (`max-w-[640px]`)
- `Card` with gold-tinted warning icon circle
- `Eyebrow` “Something broke”
- Headline: “That page hit an unexpected error.”
- Body: “Your data is safe. Try loading the page again - if the problem persists, the desk has been notified.”
- Primary gold `Button` → `onClick={() => reset()}`

**Critical comment contract:** never render `error.message`, `error.digest`, or stack in the DOM.

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Console log | `console.error("Unhandled route error:", error)` on mount / error change |
| Segment re-render | `reset()` from Next error boundary protocol |

No network, no DB, no auth calls.

### Security / RBAC

- **Information disclosure prevention:** user-facing copy is static; raw errors stay in console (devtools / server logs depending on environment).
- **Copy claims “the desk has been notified”** — this file only logs to console; **no actual alerting/telemetry** unless an outer logging pipeline scrapes console. Potentially misleading.
- No auth — error UI can appear for authenticated shells when a segment fails; if error occurs before auth UI, behavior depends on which layout segment failed.
- `error.digest` available in props but intentionally unused in render (good for security).

### Coupling

| Coupling | Detail |
|----------|--------|
| Framework | Next.js `error.tsx` file convention + `reset` prop |
| UI | Brand `Button`, `Card`, `Eyebrow` |
| Icons | Phosphor `WarningCircle` |

No feature modules, no RBAC, no data layer.

### Risks / TODOs

1. **“Desk has been notified” is aspirational** unless production error reporting is wired elsewhere — operators may assume ticketing that does not exist.
2. **Console-only logging** — production browser consoles are not a durable incident trail; prefer Sentry/OpenTelemetry hook in the `useEffect`.
3. **Does not wrap root layout errors** — Next.js `error.tsx` does not catch errors in the same layout that exports it; root layout failures need `global-error.tsx` (not in this batch).
4. **No link home / documents** — only `reset()`; if reset loops on persistent failure, user is stuck without navigation affordance.
5. **Accessibility:** icon is `aria-hidden`; title/description are plain text (fine); button is clear.
6. **`error` object identity** may re-trigger effect on remounts — acceptable.

---

## Cross-file notes (batch 027)

| Theme | Detail |
|-------|--------|
| **Documents feature slice** | `page.tsx` (RSC load) → `documents-list-view.tsx` (client UX) → `new-document-dialog.tsx` (create stub) form a vertical slice of the documents module. |
| **Auth model** | Page: `requireUser`. List: trusts props. Create: server `can(…, "create", "document")`. Error: none. |
| **Upload maturity** | Explicit stub phase — metadata + S3 key paste; no presigned upload; disabled file input. |
| **Filter catalog drift** | `TYPE_FILTERS` (page) ⊂ `DOCUMENT_TYPES` (dialog); index cannot pill-filter all creatable types. |
| **Shared patterns** | Debounced URL search, MNPI toggle, density CommandBar, Pagination pills, Bezel form controls — matches interactions/tasks list pages. |
| **Dead code in batch** | `Reveal` unused on page; `ArrowFatDown` + `UploadSimple` unused in list-view. |
| **Tables / entities** | UI targets `document` row fields (via actions/queries): documentType, kycCategory, fileName, mimeType, sizeBytes, sha256, fileStoreRef, dealId, partyId, contactId, isConfidential, isMnpi, barrierId, retentionUntil, uploadedByUserId, createdAt, soft-delete via query `deletedAt`. |

---

*End of agent-027 analysis.*
