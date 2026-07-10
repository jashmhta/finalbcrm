# Agent 020 — File-by-file analysis

**Batch:** `batch-020.list`  
**Scope root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files:** 4 (KYC compliance UI: detail actions, detail page, status timeline, board view)

---

## 1. `src/app/compliance/kyc/[id]/kyc-action-forms.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/compliance/kyc/[id]/kyc-action-forms.tsx` |
| **Lines** | 478 |
| **Directive** | `"use client"` |
| **Role** | Client-side lifecycle action panel for a single KYC record: status transitions, risk re-rating, and beneficial-owner attachment. |

### Exports

```ts
export interface KycActionsProps {
  kycRecordId: string;
  currentStatus: KycStatus;
  currentRisk: KycRisk | null;
  /** Contacts on the party (for the beneficial-owner selector). */
  contacts: { contactId: string; fullName: string }[];
}

export function KycActions({
  kycRecordId,
  currentStatus,
  currentRisk,
  contacts,
}: KycActionsProps): JSX.Element
```

Internal (non-exported) components:
- `TransitionForm({ kycRecordId, current, allowed })`
- `RiskForm({ kycRecordId, current })`
- `AddBoForm({ kycRecordId, contacts })`
- `FieldSelect({ id, name, value, onChange, options, required?, placeholder? })`

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React`, `useActionState` |
| `@phosphor-icons/react` | `ShieldCheck`, `ShieldWarning`, `XCircle`, `CheckCircle`, `Warning`, `Plus`, `ArrowRight`, `ArrowFatDown` |
| `@/lib/utils` | `cn` |
| `@/components/brand/button` | `Button` |
| `@/components/brand/text` | `Eyebrow` |
| `@/components/brand/badge` | `Badge` |
| `@/features/compliance/actions` | `transitionKycStatus`, `setKycRiskRating`, `addBeneficialOwner`, `TransitionKycState`, `SetKycRiskState`, `AddBoState` |
| `@/features/compliance/kyc` | `allowedTransitions`, `KycRisk`, `KycStatus` |

**Import discipline (documented in file header):** server actions come from `@/features/compliance/actions` (not the feature barrel, which re-exports queries → postgres and would break the client bundle). Pure helpers/types from `@/features/compliance/kyc` (no DB imports).

### Related types (quoted from dependencies)

```ts
// @/features/compliance/kyc
export type KycStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "expired"
  | "rekyc_due"
  | "under_eds_check";

export type KycRisk = "low" | "medium" | "high";

export const allowedTransitions: Record<KycStatus, KycStatus[]> = {
  pending: ["in_review"],
  in_review: ["under_eds_check", "approved", "rejected"],
  under_eds_check: ["approved", "rejected", "in_review"],
  approved: ["expired", "rekyc_due"],
  rejected: ["in_review"],
  expired: ["rekyc_due"],
  rekyc_due: ["in_review"],
};

// @/features/compliance/actions
export type TransitionKycState = { error?: string } | undefined;
export type SetKycRiskState = { error?: string } | undefined;
export type AddBoState = { error?: string } | undefined;

// Server action signatures (wired via useActionState):
// transitionKycStatus(_prev: TransitionKycState, formData: FormData): Promise<TransitionKycState>
// setKycRiskRating(_prev: SetKycRiskState, formData: FormData): Promise<SetKycRiskState>
// addBeneficialOwner(_prev: AddBoState, formData: FormData): Promise<AddBoState>
```

Local constant:

```ts
const TARGET_META: Record<
  KycStatus,
  { label: string; tone: "emerald" | "down" | "gold" | "neutral" }
> = {
  pending: { label: "Re-open as pending", tone: "neutral" },
  in_review: { label: "Send to review", tone: "neutral" },
  under_eds_check: { label: "Route to EDD", tone: "gold" },
  approved: { label: "Approve", tone: "emerald" },
  rejected: { label: "Reject", tone: "down" },
  expired: { label: "Mark expired", tone: "neutral" },
  rekyc_due: { label: "Mark re-KYC due", tone: "gold" },
};
```

### Business purpose

Allows the compliance desk to advance a KYC record through its lifecycle **without leaving the detail page**:

1. **Status transition** — one submit button per allowed next status from `allowedTransitions[currentStatus]`.
2. **Risk re-rating** — low / medium / high; server recomputes valid-until / re-KYC schedule and may escalate to EDD.
3. **Beneficial owner attach** — junction insert into `kyc_beneficial_owner` via contact selector seeded from party contacts.

### Key logic

#### `KycActions`
- Computes `allowed = allowedTransitions[currentStatus] ?? []`.
- Renders three stacked forms: `TransitionForm`, `RiskForm`, `AddBoForm`.

#### `TransitionForm`
- `useActionState(transitionKycStatus, undefined)`.
- Empty `allowed` → message: status has no forward transitions.
- **EDD special path:** target `under_eds_check` does **not** submit immediately. Button arms `eddArmed` state; then a dedicated form with:
  - hidden `kycRecordId`, `toStatus="under_eds_check"`
  - optional text `eddReason` (`maxLength={1000}`)
- All non-EDD targets: separate `<form>` each with hidden `kycRecordId` + `toStatus`, sharing one `useActionState` triple so `pending` disables every button and `state.error` surfaces last error.
- Button variants map tones → `primary-gold` / `secondary-hairline` (note: both emerald and down map to `primary-gold` — visual distinction is icon-only).

#### `RiskForm`
- Controlled select (`low`/`medium`/`high`); defaults to `current ?? "medium"`.
- Submit disabled when `pending || risk === (current ?? "")`.
- Posts hidden `kycRecordId` + `riskRating`.
- Helper copy: “Recomputes the periodic-refresh schedule… escalates to EDD when the inputs warrant it.”

#### `AddBoForm`
- Collapsed by default; disabled if `contacts.length === 0`.
- Open form fields:
  - `contactId` (required, via `FieldSelect`)
  - `ownershipPct` (`type="number"`, min 0, max 100, step 0.01)
  - `relationshipPath` (`maxLength={500}`)
- Submit disabled when `pending || !contactId`.

#### `FieldSelect`
- Controlled native `<select>` with decorative chevron; posts value via **hidden input** (name from props) because the visible select is controlled and not named for FormData.

### Side effects

- **Server mutations** via form actions: `transitionKycStatus`, `setKycRiskRating`, `addBeneficialOwner`.
- On success, actions revalidate `/compliance/kyc/[id]` (documented in file header; implemented in actions module).
- Local React state only for UI arming (`eddArmed`, `open`, select values); no localStorage/cookies.

### Security / RBAC

- **No client-side permission checks.** Authorization is entirely in server actions:
  - `requireUser()` + `requirePermission(user, "update", "kyc")`.
  - Zod parse of UUIDs / enums / string lengths.
  - DB work under `withRls(...)`.
- Client only posts FormData; hidden fields (`kycRecordId`, `toStatus`) can be tampered in DOM — **server must re-validate allowed transitions** (actions use schema + state machine).
- EDD reason is optional on client; max 1000 chars mirrors server `z.string().max(1000).optional()`.

### Coupling

| Couples to | How |
|------------|-----|
| `@/features/compliance/actions` | Direct server-action imports (client-safe boundary) |
| `@/features/compliance/kyc` | `allowedTransitions`, status/risk types (must stay pure) |
| Parent `page.tsx` | Props: id, status, risk, party contacts |
| Brand UI | `Button`, `Eyebrow`, `Badge` |

### Risks / TODOs

1. **Client-only transition gating:** UI hides disallowed transitions via `allowedTransitions`, but a crafted POST could send any `toStatus`; depends on server `canTransition` / action logic.
2. **Approve/Reject share `primary-gold`:** `TARGET_META` tones emerald vs down both map to the same Button variant — risk of accidental approve/reject misclick.
3. **No success toast:** only `state?.error` is shown; success relies on page revalidation/re-render.
4. **Risk form default `"medium"`** when `current` is null may not match true unset state; “Re-rate” disabled only when `risk === (current ?? "")` so null current enables submit of medium.
5. **No optimistic UI** — pending disables buttons only.
6. **BO ownership not validated client-side for thresholds** (company >10% / partnership/trust >15%) — pure data entry; business rules live elsewhere.
7. File comment says actions revalidate path; no local double-check.

---

## 2. `src/app/compliance/kyc/[id]/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/compliance/kyc/[id]/page.tsx` |
| **Lines** | 817 |
| **Directive** | None (React Server Component) |
| **Role** | Server-rendered KYC record detail page: identity header, lifecycle actions, CDD/EDD meta, re-KYC, contact, BO table, PEP/sanctions stubs, documents, audit history. |

### Exports

```ts
export const dynamic = "force-dynamic";

export default async function KycDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element>
```

Local presentational helpers (not exported):
- `pretty(s: string): string`
- `fmtDate(v: string | Date | null): string` — `en-IN` short date
- `fmtDateTime(v: string | Date | null): string` — `en-IN` date+time
- `MetaCell({ label, value, icon?, tone? })`
- `DL`, `DT`, `DD` — definition-list layout helpers

### Imports

| Source | Symbols |
|--------|---------|
| `next/link` | `Link` |
| `next/navigation` | `notFound` |
| `drizzle-orm` | `and`, `asc`, `eq`, `isNull` |
| `@/components/brand/icons` | `ArrowLeft`, `ArrowUpRight`, `ShieldCheck`, `ShieldWarning`, `Users`, `FileText`, `Clock`, `CheckCircle`, `Scales`, `Fingerprint` |
| `@/lib/rbac` | `requireUser` |
| `@/features/compliance/queries` | `getKycDetail` |
| `@/db` | `db` |
| `@/db/schema` | `contact as contactTable`, `partyContact` |
| `@/lib/utils` | `cn` |
| `@/features/compliance/kyc` | types `KycRisk`, `KycStatus` |
| `./kyc-action-forms` | `KycActions` |
| `@/components/brand` | `Card`, `Badge`, `Button`, `Reveal`, `Table*`, `TableEmpty`, `PreviewPane`, `KycShieldMark`, type `BadgeProps` |
| `./status-timeline` | `StatusTimeline` |
| `@/components/brand/page-shell` | `PageShell`, `PageHeader`, `DetailTopBar` |

**Note:** `DetailTopBar` is imported but **unused** in the file body.

### Related types / query signatures

```ts
// getKycDetail(kycRecordId: string, user?: CrmUser | null): Promise<KycDetail | null>

export interface KycDetail {
  record: typeof kycRecord.$inferSelect;
  party: { partyId: string; legalName: string; partyNature: string };
  contact: {
    contactId: string;
    fullName: string;
    pan: string | null;
    pepStatus: string | null;
    pepVerifiedAt: Date | null;
  } | null;
  approver: { userId: string; email: string } | null;
  beneficialOwners: KycBeneficialOwnerRow[];
  documents: KycDocumentRow[];
  history: KycHistoryRow[];
}
```

Badge maps (local):

```ts
const STATUS_BADGE: Record<string, { variant: BadgeProps["variant"]; dot?: boolean }>
// pending, in_review, under_eds_check, approved, rejected, expired, rekyc_due

const RISK_BADGE: Record<string, BadgeProps["variant"]>
// low → emerald, medium → gold, high → down

const KYC_TYPE_BADGE: Record<string, BadgeProps["variant"]>
// CDD, EDD, simplified

const OP_TONE: Record<string, "emerald" | "info" | "down" | "gold" | "neutral">
// insert, update, delete, merge, approve, reject
```

### Business purpose

Primary compliance officer view for a single KYC file under Indian AML/KYC framing (PMLA §5.2–5.4 CDD/EDD, RBI re-KYC cadence low 10yr / medium 8yr / high 2yr, BO thresholds, PEP/sanctions, document evidence, immutable audit_log).

### Key logic

1. **Auth:** `const user = await requireUser()` — unauthenticated → redirect `/login`.
2. **Params:** Next.js 15-style `params: Promise<{ id: string }>` → `const { id } = await params`.
3. **Load:** `getKycDetail(id, user)`; null → `notFound()`.
4. **Party contacts (extra query on page):**  
   ```ts
   db.select({ contactId, fullName })
     .from(partyContact)
     .innerJoin(contactTable, ...)
     .where(and(
       eq(partyContact.partyId, partyRow.partyId),
       isNull(partyContact.validTo),
       isNull(partyContact.deletedAt),
       isNull(contactTable.deletedAt),
     ))
     .orderBy(asc(contactTable.fullName))
   ```
   Feeds `KycActions.contacts` for BO form.
5. **Re-KYC urgency:**
   - `rekycOverdue` = due date ≤ now
   - `rekycDueSoon` = due ≤ now + 30 days and not overdue  
   Tones MetaCell / Re-KYC DD (`down` / `gold`).
6. **Layout sections:**
   - Breadcrumb + “Open party” → `/parties/{partyId}`
   - `PreviewPane` identity (type, legal name, KYC shield, badges, meta grid)
   - Lifecycle `KycActions` card
   - 3-col grid: `StatusTimeline` | CDD/EDD + Re-KYC + Contact
   - Beneficial owners `Table`
   - PEP screening + Sanctions screening (stubs)
   - KYC documents `Table`
   - History `Table` (history reversed newest-first for display)
7. **`dynamic = "force-dynamic"`** — no static caching of sensitive compliance data.

### Side effects

- **Reads only** on this page (mutations are in client forms → server actions).
- DB: `getKycDetail` + party-contact join.
- `requireUser` may redirect.
- `notFound()` for missing/unauthorized-as-null records.

### Security / RBAC

| Control | Detail |
|---------|--------|
| Authentication | `requireUser()` |
| Read scope | `getKycDetail(id, user)` applies `canReadAllKyc(user)` or `assignedPartyScopeClause(user)` — unauthorized looks like 404 |
| Write | Not on page; delegated to actions with `update`/`kyc` permission |
| PII display | PAN, PEP, legal name, emails of approver/actors rendered in UI |
| Soft deletes | Contact join filters `deletedAt` / `validTo` null |

**Gap:** Party-contact query for BO selector uses raw `db` **without** repeating assigned-party scope. Practically safe because `getKycDetail` already scoped the record and `partyRow.partyId` comes from that load — but the contact query itself is unscoped if `partyId` were ever attacker-controlled (it is not; it is from DB after authz).

### Coupling

| Couples to | How |
|------------|-----|
| `getKycDetail` / `kycRecord` schema shape | All field reads (`status`, `riskRating`, `kycType`, BO %, SoF/SoW, etc.) |
| `kyc-action-forms` | Client island for mutations |
| `status-timeline` | Client island for animated history |
| `partyContact` / `contact` tables | Direct drizzle on page |
| Brand design system | Heavy UI dependency |
| Regulatory copy | Hardcoded PMLA/RBI strings |

### Risks / TODOs

1. **PEP / sanctions are stubs** — UI always shows sanctions “clear”; copy points to `src/features/compliance/kyc.ts` `screenSanctions()`. Live provider pending.
2. **`DetailTopBar` unused import** — dead import noise.
3. **No page-level write RBAC UI** — users without `update`/`kyc` still see action forms; failures only surface as action errors after submit.
4. **History “current state” vs status** — timeline is audit ops, not necessarily current `record.status` label.
5. **Documents not downloadable** — list-only; no link/blob.
6. **Mobile column hiding** — BO/docs/history drop secondary columns below `md` (intentional).
7. **Status cast:** `(record.status ?? "pending") as KycStatus` — invalid DB enum values would silently drive wrong transition set.
8. **Indentation/formatting noise** in several `PageHeader` blocks (cosmetic).

---

## 3. `src/app/compliance/kyc/[id]/status-timeline.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/compliance/kyc/[id]/status-timeline.tsx` |
| **Lines** | 247 |
| **Directive** | `"use client"` |
| **Role** | Client view for KYC lifecycle timeline from audit_log rows: vertical rail, animated nodes, “current state” header. |

### Exports

```ts
export interface TimelineEntry {
  auditLogId: string;
  operation: string;
  fieldName: string | null;
  occurredAt: Date;
  actorEmail: string | null;
  actorRoleAtTime: string | null;
}

export function StatusTimeline({
  history,
}: {
  history: TimelineEntry[];
}): JSX.Element
```

Internal:
- `fmtDateTime(v: string | Date | null): string`
- `NodeIcon({ operation }: { operation: string })`

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React` |
| `framer-motion` | `motion` |
| `@phosphor-icons/react` | `ShieldCheck`, `CheckCircle`, `XCircle`, `Users`, `Clock`, `ArrowRight` |
| `@/lib/utils` | `cn` |
| `@/components/brand` | `Badge` |

### Business purpose

Visual lifecycle rail for compliance review: show chronological audit events for `entity_type = kyc_record` (passed already filtered from detail query), newest first, with semantic coloring by operation.

### Key logic

1. Empty history → empty state copy (“The record has yet to move.”).
2. `ordered = history.slice().reverse()` (assumes server sent oldest → newest).
3. **Current-state header** = `ordered[0]` with tone-colored icon disc + `Badge variant="emerald"` “latest”.
4. **Rail:** `motion.span` with `scaleY` 0→1, `transformOrigin: "top center"`, GPU-disciplined (transform/opacity only).
5. **Nodes:** staggered `whileInView` fade/slide; head node has infinite pulse ring.
6. **Icons:**  
   - `approve` → CheckCircle  
   - `reject` / `delete` → XCircle  
   - `insert` → ShieldCheck  
   - `merge` → Users  
   - default → Clock  
7. Footer: “oldest of N lifecycle events”.
8. `EASE = [0.32, 0.72, 0, 1]` cubic-bezier.

```ts
const OP_TONE: Record<string, "emerald" | "info" | "down" | "gold" | "neutral"> = {
  insert: "emerald",
  update: "info",
  delete: "down",
  merge: "gold",
  approve: "emerald",
  reject: "down",
};
```

### Side effects

- Animation only (framer-motion); no network, no mutations.
- `whileInView` / infinite pulse for head node.

### Security / RBAC

- Pure presentation of already-authorized data from parent RSC.
- Displays actor email + role at time (PII of staff); no additional filtering.
- No XSS vectors beyond React text binding of audit fields.

### Coupling

| Couples to | How |
|------------|-----|
| Parent `page.tsx` | `history` prop shape must match `KycHistoryRow` / `TimelineEntry` |
| framer-motion | Animation dependency |
| Brand `Badge` | “latest” chip |

**Serialization note:** `occurredAt: Date` in the interface — RSC → client serialization typically turns Dates into strings; `fmtDateTime` handles both `string | Date`.

### Risks / TODOs

1. **Misleading “current state”:** header shows latest **audit operation** (e.g. `update` · `risk_rating`), not the KYC status enum — product language may confuse analysts.
2. **Duplicate logic** with page history table (`OP_TONE`, `fmtDateTime` duplicated).
3. **Unknown operations** fall to neutral + Clock; no mapping for status-specific ops if audit uses free-form op names.
4. **`ArrowRight` import used only rotated as visual cue** — fine.
5. Infinite pulse animation on head may be noisy for accessibility / reduced-motion (no `prefers-reduced-motion` handling).

---

## 4. `src/app/compliance/kyc/kyc-board-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/compliance/kyc/kyc-board-view.tsx` |
| **Lines** | 879 |
| **Directive** | `"use client"` |
| **Role** | Client KYC pipeline board: risk overview StatCards, command bar (search/risk/density/export), six lifecycle columns of entity cards. View-layer only — no query/action changes. |

### Exports

```ts
export interface KycBoardViewProps {
  rows: KycListItem[];
  total: number;
  q?: string;
  risk?: string;
}

export function KycBoardView({
  rows,
  total,
  q,
  risk,
}: KycBoardViewProps): JSX.Element
```

Internal components/types:
- `type KycColumnId = "cdd" | "edd" | "in_review" | "approved" | "rekyc_due" | "rejected"`
- `type ColumnTone = "info" | "gold" | "neutral" | "emerald" | "down"`
- `interface ColumnConfig { id; label; tone; glyph; step; hint }`
- `type Risk = "high" | "medium" | "low" | "unknown"`
- `bucketColumn(r: KycListItem): KycColumnId`
- `normalizeRisk(r): Risk`
- `relativeDue(due): { text; tone }`
- `Board`, `StageColumn`, `RiskDistribution`, `ColumnEmpty`, `Glyph`, `KycCard`, `MiniProgress`, `RiskSelectPill`

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React` |
| `next/link` | `Link` |
| `next/navigation` | `useRouter`, `usePathname`, `useSearchParams` |
| `framer-motion` | `motion` |
| `@phosphor-icons/react` | many icons + type `Icon as PhosphorIcon` |
| `@/lib/utils` | `cn` |
| `@/features/compliance/queries` | type `KycListItem` only |
| `@/components/brand` | `Badge`, `Card`, `CommandBar`, `IconTile`, `StatCard`, types `BadgeProps`, `Density` |
| `@/features/reports/export-button` | `ExportCsvButton` |

### Related type (quoted)

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
```

### Column taxonomy & bucketing

```ts
const COLUMNS: ColumnConfig[] = [
  { id: "cdd",        step: 0,  tone: "info",    ... },
  { id: "edd",        step: 1,  tone: "gold",    ... },
  { id: "in_review",  step: 2,  tone: "neutral", ... },
  { id: "approved",   step: 3,  tone: "emerald", ... },
  { id: "rekyc_due",  step: -1, tone: "gold",    ... },
  { id: "rejected",   step: -1, tone: "down",    ... },
];

function bucketColumn(r: KycListItem): KycColumnId {
  const s = (r.status ?? "").toLowerCase();
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  if (s === "rekyc_due" || s === "expired") return "rekyc_due";
  if (s === "in_review") return "in_review";
  if (s === "under_eds_check") return "edd";
  if (s === "pending") return (r.kycType ?? "").toUpperCase() === "EDD" ? "edd" : "cdd";
  return (r.kycType ?? "").toUpperCase() === "EDD" ? "edd" : "cdd";
}
```

**Invariant:** every row lands in exactly one column.

### Business purpose

Compliance working queue as a **pipeline board** (not flat table):

- Risk overview: high / medium / low / re-KYC-due counts.
- Filters: debounced search `q`, risk filter, density, CSV export.
- Cards: party legal name, contact or short id, risk dot, top BO %, relative re-KYC due, mini progress (CDD→EDD→Review→Approved), link to `/compliance/kyc/{id}`.

### Key logic

#### URL-driven filters
- Search: local state synced from `q`; debounce 280ms → `router.replace` with `URLSearchParams`; clears `page`.
- Risk: `pushParam("risk", v)` same pattern.
- Clear filters → `Link href="/compliance/kyc"`.
- Server re-runs `listKycRecords` on parent (this component only shapes URL).

#### Risk counts (`useMemo`)
- High/medium/low from `normalizeRisk(riskRating)`.
- Re-KYC due if status `rekyc_due` | `expired` **OR** `rekycDueDate <= now` (status may lag).

#### Column sort
1. Risk rank: high → medium → low → unknown  
2. `rekycDueDate` ascending (nulls last via Infinity)  
3. `partyLegalName` localeCompare  

#### `relativeDue`
- Overdue / due today / Nd / Nmo / Ny with tones `down` | `gold` | `muted`.

#### `KycCard`
- Double-bezel card; `IconTile` User vs Buildings based on `contactFullName`.
- `motion.div whileHover={{ y: -2 }}`.
- Mini progress: 4 steps if `step >= 0`; else “off-pipeline” for re-KYC/rejected.

#### Empty states
- `total === 0`: empty ledger  
- `shown === 0` but total > 0: filter miss  
- Per-column empty lines (e.g. “Review desk is clear.”)

#### Truncation honesty
- Footer: `shown of total`; if `total > shown`, note “Showing the first N · refine the search…”.

### Side effects

- **Navigation only:** `router.replace` for query params (no mutations).
- Debounce timer cleanup on unmount.
- Export via `ExportCsvButton type="kyc"` (delegates to reports feature).
- Framer-motion mount animations (not whileInView opacity-0 gating — intentional for headless screenshots).

### Security / RBAC

- **Read-only client view.** Data already scoped by parent server list query (`listKycRecords` + `canReadAllKyc` / assigned party).
- No client auth checks.
- Search params are shareable URLs (no secrets in query string by design).
- Export button inherits whatever auth the export endpoint enforces (outside this file).
- Displays PII: legal names, contact names, BO ownership % — same as list page.

### Coupling

| Couples to | How |
|------------|-----|
| Parent KYC list page | Must pass `rows`, `total`, optional `q`/`risk` |
| `KycListItem` shape | Field names must stay stable |
| Next app router | pathname/searchParams for shareable filters |
| `@/features/reports/export-button` | CSV |
| Brand primitives | CommandBar, StatCard, Card, Badge, IconTile, Density |

### Risks / TODOs

1. **Board vs server pagination mismatch:** Board buckets only the **fetched** rows. If parent caps page size (e.g. 25), columns under-represent the true queue; footer acknowledges truncation but board still looks complete per column.
2. **Status→column folding:** `expired` → `rekyc_due`; `under_eds_check` → `edd`; pending CDD vs EDD by `kycType` — status machine has more states than columns; intentional but can hide nuance.
3. **Risk overview “Re-KYC due” can double-count** across risk buckets (high-risk + overdue still counts in both high and re-KYC cards — different dimensions, OK, but easy to misread as partition).
4. **Unknown/null status falls to CDD/EDD by kycType** — could misplace bad data into intake.
5. **Client clock** for overdue/relative due — timezone skew vs server.
6. **No drag-and-drop status change** — board is read-only navigation; transitions only on detail page.
7. **`pepStatus` on `KycListItem` unused** in cards — PEP not surface on board.
8. **Search debounce 280ms** + full server round-trip — fine at moderate volume; no client-side filter of already-loaded rows for interim feedback.
9. **Density state is local only** — not URL-persisted (unlike q/risk).

---

## Cross-file architecture (batch summary)

```
list page (RSC, not in batch)
  └─ KycBoardView (client) ──→ /compliance/kyc/[id]

KycDetailPage (RSC) ── requireUser + getKycDetail + party contacts
  ├─ KycActions (client) ──→ transitionKycStatus / setKycRiskRating / addBeneficialOwner
  └─ StatusTimeline (client) ── audit history presentation
```

| Concern | Owner |
|---------|--------|
| AuthZ read | `getKycDetail` / `listKycRecords` + `requireUser` on RSC |
| AuthZ write | Server actions `update`/`kyc` |
| Status machine source of truth | `@/features/compliance/kyc` `allowedTransitions` |
| Board column mapping | Pure view-layer in `kyc-board-view` (may diverge from status machine labels) |
| Screening (PEP/sanctions) | Stubbed in detail page UI |

### Shared risks across batch

1. **Stub screening** on detail page — regulatory gap if treated as production clearance.
2. **Action UI shown without pre-check of write permission.**
3. **Date formatting** duplicated (`en-IN`) across page, timeline, board.
4. **Client/server type cast** of DB strings to `KycStatus` / `KycRisk` without runtime validation on the page.

---

## Line counts (wc-equivalent)

| File | Lines |
|------|------:|
| `src/app/compliance/kyc/[id]/kyc-action-forms.tsx` | 478 |
| `src/app/compliance/kyc/[id]/page.tsx` | 817 |
| `src/app/compliance/kyc/[id]/status-timeline.tsx` | 247 |
| `src/app/compliance/kyc/kyc-board-view.tsx` | 879 |
| **Total** | **2421** |

---

*End of agent-020 analysis.*
