# Agent 014 — File-by-file analysis

Batch source: `analysis/file-by-file/batch-014.list`  
App root: `/home/Jashmhta/crm/bc-crm/app`  
Files analyzed: 4

---

## 1. `src/app/_components/recent-activity.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/_components/recent-activity.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/_components/recent-activity.tsx` |
| **Lines** | 274 |
| **Directive** | `"use client"` |
| **Role** | Client UI component — dashboard “recent activity” rail (right-hand “what just happened” list) |
| **Coupling level** | Presentation / leaf UI (depends on brand primitives + Next Link + Framer Motion) |

### Exports

| Export | Kind | Signature / shape |
|--------|------|-------------------|
| `RecentInteraction` | `export interface` | See quoted type below |
| `RecentActivity` | `export function` | `RecentActivity({ interactions, totalLogged }: RecentActivityProps): JSX.Element` |

**Exported type:**

```ts
export interface RecentInteraction {
  interactionId: string;
  subject: string | null;
  channel: string | null;
  direction: string | null;
  /** Pre-formatted on the server (e.g. "3d ago") - no client Date math. */
  occurredRelative: string;
  /** Pre-formatted absolute date (e.g. "12 Jun 2025") for the title attribute. */
  occurredAbsolute: string;
  partyId: string | null;
  partyName: string | null;
  dealId: string | null;
  dealName: string | null;
  containsMnpi: boolean;
}
```

**Non-exported:**

| Name | Kind | Notes |
|------|------|-------|
| `RecentActivityProps` | `interface` | `{ interactions: RecentInteraction[]; totalLogged: number }` |
| `CHANNEL_ICON` | `const Record<string, PhosphorIcon>` | Maps channel slug → Phosphor icon component |
| `CHANNEL_LABEL` | `const Record<string, string>` | Maps channel slug → display label |
| `EASE` | `const [0.32, 0.72, 0, 1]` | Cubic-bezier for Framer Motion |
| `ActivityRow` | `function` | Per-row renderer; props `{ item: RecentInteraction; mobileHidden?: boolean }` |

### Imports

| Source | Symbols | Purpose |
|--------|---------|---------|
| `react` (`* as React`) | `useRef` (via `React.useRef`) | List container ref for `useInView` |
| `next/link` | `Link` | Party / deal deep links |
| `framer-motion` | `motion`, `useInView` | Staggered list reveal; viewport-gated animation |
| `@/lib/utils` | `cn` | Conditional class names |
| `@/components/brand/text` | `Eyebrow` | Section eyebrow label |
| `@/components/brand/badge` | `Badge` | Channel + MNPI badges |
| `@phosphor-icons/react` | `Icon` (type), `ArrowDownLeft`, `ArrowUpRight`, `Chats`, `EnvelopeSimple`, `FileText`, `Handshake`, `LinkBreak`, `Phone`, `PresentationChart`, `Users`, `WhatsappLogo` | Channel / direction / empty-state glyphs |

### Business purpose

Renders the CRM desk’s **latest interactions feed** for a dashboard surface:

- Header: “Recent activity” / “Latest interactions” + total logged count (`en-IN` locale).
- Each row: channel glyph, linked counterparty (party preferred, deal fallback, else italic “Unlinked”), relative time, channel badge, inbound/outbound direction, subject, optional **MNPI** badge, optional secondary “on {deal}” line when both party and deal exist.
- Empty state: calm copy (“The desk is quiet, for now.”) rather than generic “No data.”

Designed so the **server pre-formats** relative/absolute timestamps (no `Date.now()` on client) to avoid hydration mismatch. Props are fully serializable.

### Key logic

1. **Channel mapping** — known slugs:
   - `meeting`, `call`, `email`, `whatsapp`, `rfq`, `ndsom_chat`, `site_visit`, `management_presentation`
   - Unknown channel → `Chats` icon; label falls back to `channel.replace(/_/g, " ")`.
2. **Direction** — `direction === "outbound"` → `ArrowUpRight` + “Out” (emerald tint); else inbound `ArrowDownLeft` + “In”.
3. **Counterparty resolution order**:
   1. `partyId && partyName` → `Link` to `/parties/{partyId}`
   2. else `dealId && dealName` → `Link` to `/deals/{dealId}`
   3. else “Unlinked” + `LinkBreak`
4. **Deal secondary line** only when both party and deal are present (avoids duplicating deal-as-primary).
5. **MNPI** — `containsMnpi` shows `Badge variant="down"` labeled `MNPI`.
6. **Mobile density** — items with index `>= 4` get `hidden md:flex` (`mobileHidden`); mobile shows first 4, desktop restores full list.
7. **Motion** — parent `motion.ul` staggered children (`staggerChildren: 0.05`); each row opacity/y only; `useInView(listRef, { once: true, margin: "-6%" })`.

### Side effects

- None on data layer (pure presentational).
- Client navigation via `next/link` (soft navigations).
- Framer Motion viewport observer (read-only DOM observation).
- No network calls, no cookies, no server actions.

### Security / RBAC

- **No RBAC inside this file.** Caller must only pass interactions the current user is allowed to see.
- Surfaces **MNPI flag** visually; does not gate or redact content.
- Links assume authenticated app shell; no capability checks on `/parties/*` or `/deals/*` here.
- XSS surface is React-text-escaped; no `dangerouslySetInnerHTML`. Subjects/names rendered as text/Link children.

### Coupling

| Depends on | Used by (repo scan) |
|------------|---------------------|
| Brand `Eyebrow`, `Badge`; `cn`; Phosphor; Framer Motion; Next Link | **No imports found** of `RecentActivity` or this path under `src/` |

Related but separate shapes:

- `DashboardRecentInteraction` in `@/features/dashboard/queries` (raw `occurredAt: Date | null`, no pre-formatted relative/absolute names).
- Home page `src/app/page.tsx` loads dashboard interactions and formats dates itself rather than mounting this component.
- AI hub has `RecentInteractionSummary` — different domain.

**Status note:** Component appears **orphaned / not wired** into the current home dashboard (which inlines activity presentation). It is a polished client island ready for composition once a parent maps server data → `RecentInteraction[]`.

### Risks / TODOs

| Risk | Detail |
|------|--------|
| Dead code / drift | Not imported; can diverge from `page.tsx` activity UI and channel taxonomy. |
| Channel taxonomy drift | Hardcoded `CHANNEL_ICON` / `CHANNEL_LABEL` may miss new interaction channels. |
| MNPI leakage | Only a badge; if parent passes MNPI subjects to unauthorized roles, UI will show them. |
| Accessibility | Rows are not focusable list items with keyboard expand; links inside are fine; empty state is static. |
| Performance | Fine for small rails (~6 items); no virtualization (not needed at this size). |
| Hydration | Correctly avoids client `Date.now()`; parent must still pass stable preformatted strings from RSC. |

---

## 2. `src/app/_components/stage-strip.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/_components/stage-strip.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/_components/stage-strip.tsx` |
| **Lines** | 162 |
| **Directive** | `"use client"` |
| **Role** | Client UI component — horizontal “deals by stage” pipeline strip for the dashboard |
| **Coupling level** | Presentation / leaf UI |

### Exports

| Export | Kind | Signature / shape |
|--------|------|-------------------|
| `StageCardData` | `export interface` | `{ status: string; label: string; count: number; exposure: number }` |
| `StageStrip` | `export function` | `StageStrip({ stages, totalOpen, totalExposure }: StageStripProps): JSX.Element` |

**Exported type:**

```ts
export interface StageCardData {
  status: string;
  label: string;
  count: number;
  exposure: number;
}
```

**Non-exported:**

| Name | Kind | Notes |
|------|------|-------|
| `StageStripProps` | `interface` | `{ stages: StageCardData[]; totalOpen: number; totalExposure: number }` |
| `intFmt` | `function` | `(n: number) => string` — `en-IN` integer or `"-"` |
| `EASE` | cubic-bezier const | Framer Motion easing |
| `StageCard` | `function` | Props: `{ stage: StageCardData; share: number; barShare: number }` |

### Imports

| Source | Symbols | Purpose |
|--------|---------|---------|
| `framer-motion` | `motion` | Staggered stage-card entry (`whileInView`) |
| `@/lib/utils` | `cn` | Class composition on cards |
| `@/components/brand/text` | `Eyebrow` | “Pipeline by stage” + per-card stage label |
| `@/components/brand/money` | `compactINR` | Compact INR formatting for exposure totals |

### Business purpose

Visualizes **open mandate pipeline by deal stage**:

- Header: total open deals (`totalOpen`) + total target exposure (`compactINR(totalExposure)`).
- Rail of stage cards: label, deal **count**, % share of open book, exposure, proportional bar vs max-count stage.
- Empty copy when `totalOpen === 0`: “No open deals in the pipeline - the desk is quiet.”
- Mobile: touch-native horizontal snap filmstrip (`min-w-[168px]`, `snap-x`); `md+`: CSS grid (3 / 4 / 8 cols).

**Design invariant (documented in file header):** counts and bar widths are **direct renders** of props — **no count-up animation** gated on `useInView`. Prior approach left SSR HTML at `0` and broke on Vercel serverless; numbers must match SSR first paint.

### Key logic

```ts
const maxCount = Math.max(1, ...stages.map((s) => s.count));
// per card:
share = totalOpen > 0 ? s.count / totalOpen : 0
barShare = s.count / maxCount
// bar width: `${Math.round(barShare * 100)}%`
// percent label: Math.round(share * 100)
```

- `intFmt`: finite numbers → `toLocaleString("en-IN", { maximumFractionDigits: 0 })`; else `"-"`.
- Motion: container `whileInView="show"` with `viewport={{ once: true, amount: 0.15, margin: "-6%" }}`; children opacity/y only (never animates the numeric text).

### Side effects

- Presentational only; no data fetching or mutations.
- Framer Motion viewport observer.
- No navigation (cards are not links).

### Security / RBAC

- None local. Aggregate pipeline metrics; parent must scope deals (desk / wall / ownership) before aggregation.
- Exposure figures may be commercially sensitive; no redaction here.

### Coupling

| Depends on | Related / consumers |
|------------|---------------------|
| `Eyebrow`, `compactINR`, `cn`, Framer Motion | **No imports found** of this `StageStrip` / `StageCardData` under `src/` |

**Name collision:** A **different** `export function StageStrip` lives in `src/app/dashboard-exposure-chart.tsx` with signature:

```ts
export function StageStrip({ stages, total }: { stages: StageDatum[]; total: number })
```

That is a separate animated bar implementation (different props / purpose). Home page stages are also handled separately via `OPEN_DEAL_STATUSES` / `STAGE_LABELS` in `page.tsx`.

**Status note:** Like `RecentActivity`, this `_components/stage-strip` appears **unused** in the current tree — a refined replacement not yet mounted.

### Risks / TODOs

| Risk | Detail |
|------|--------|
| Dead code / dual StageStrip | Two components named `StageStrip`; risk of importing the wrong one if wiring later. |
| Division / NaN | `maxCount` floored at 1 avoids `/0` for bars; share uses `totalOpen > 0` guard. Non-finite `count`/`exposure` may still show oddly via `intFmt`/`compactINR`. |
| Stage order | Renders `stages` array order as given; parent owns pipeline order (Lead → Allocation). |
| Accessibility | Cards are decorative `div`s with no links or ARIA roles; screen readers get text content only. |
| No drill-down | Cannot click into stage-filtered deal list (product gap if expected). |

---

## 3. `src/app/actions/auth.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/app/actions/auth.ts` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/actions/auth.ts` |
| **Lines** | 11 |
| **Directive** | `"use server"` |
| **Role** | Server action module — auth session teardown (logout) |
| **Coupling level** | Thin adapter over Auth.js |

### Exports

| Export | Kind | Signature |
|--------|------|-----------|
| `logout` | `export async function` | `logout(): Promise<void>` |

Full module body (exhaustive):

```ts
"use server";

import { signOut } from "@/lib/auth";

// Server action wrapper around Auth.js `signOut` so the client nav can call it
// via a <form action={logout}>. `signOut` clears the session cookie and
// redirects to the signIn page (configured in @/lib/auth as /login).
export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
```

### Imports

| Source | Symbols | Purpose |
|--------|---------|---------|
| `@/lib/auth` | `signOut` | NextAuth v5 exported `signOut` from `NextAuth({...})` |

Related config in `@/lib/auth` (not in this file, but defines behavior):

```ts
export const { handlers, signIn, signOut, auth } = NextAuth({
  // ...
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  // ...
});
```

### Business purpose

Expose **logout** as a progressive-enhancement **form action** for client navigation chrome (`SiteNav`). Auth.js `signOut` cannot be passed directly as a form `action` from client components without a server-action boundary; this file is that boundary.

Behavior:

1. Clears Auth.js session cookie (JWT strategy in current config).
2. Redirects to `/login` (`redirectTo: "/login"`).

### Key logic

- Single call: `await signOut({ redirectTo: "/login" })`.
- No input validation (zero parameters).
- No audit log write in this action.
- No CSRF custom handling beyond Next.js server-action / Auth.js defaults.

### Side effects

| Effect | Description |
|--------|-------------|
| Session invalidation | Clears Auth.js session cookie |
| HTTP redirect | Navigates user to `/login` |
| No DB write in this file | With JWT strategy, no `sessions` row delete here; production TODO in `auth.ts` targets DB sessions |

### Security / RBAC

| Topic | Assessment |
|-------|------------|
| Auth required? | Implicit: only meaningful if a session exists; unauthenticated call is effectively a no-op redirect path via Auth.js |
| Privilege | Any authenticated (or unauthenticated) caller may invoke; no role gate needed for logout |
| CSRF | Server Actions use Next.js POST + action ID; prefer `<form action={logout}>` (as SiteNav does) over raw client fetch |
| Open redirect | `redirectTo` hard-coded to `"/login"` — **not** user-controlled |
| Secrets | None handled |
| Audit | Logout not recorded in application audit log here |

**Consumers:**

- `src/components/site-nav.tsx` imports `logout` and binds:
  - Desktop: `<form id="nav-logout-form" action={logout} />` + programmatic submit
  - Mobile: `<form action={logout}>` with submit control

### Coupling

| Upstream | Downstream |
|----------|------------|
| `@/lib/auth` (`signOut`, pages.signIn) | `src/components/site-nav.tsx` |

Only auth-related action under `src/app/actions/` in this batch; login lives at `src/app/login/actions.ts` (separate).

### Risks / TODOs

| Risk | Detail |
|------|--------|
| JWT vs DB sessions | Auth config documents `TODO(PRODUCTION): switch session strategy to database` + Redis revocation; current logout clears cookie only — stolen JWT until expiry remains a residual risk until DB/redis sessions. |
| No audit trail | Compliance desks may want “user logged out” events; not implemented. |
| Hard-coded redirect | Fine for CRM; multi-tenant branding portals would need path param (not present). |
| Error handling | No try/catch; Auth.js failures surface as action errors. |
| Naming | File is `auth.ts` but only logout; expand carefully if adding more auth actions. |

---

## 4. `src/app/admin/audit/audit-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/admin/audit/audit-view.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/admin/audit/audit-view.tsx` |
| **Lines** | 689 |
| **Directive** | `"use client"` |
| **Role** | Client view layer — Admin → Audit forensic table (filterable, expandable, URL-driven) |
| **Coupling level** | Feature view: tightly coupled to admin page props + `AuditLogRow` type + brand design system |

### Exports

| Export | Kind | Signature / shape |
|--------|------|-------------------|
| `AdminAuditViewProps` | `export interface` | See below |
| `AdminAuditView` | `export function` | `AdminAuditView(props: AdminAuditViewProps): JSX.Element` |

**Exported props interface:**

```ts
export interface AdminAuditViewProps {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
  entityType?: string;
  operation?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  barrierId?: string;
  entityTypes: string[];
  operations: string[];
  barriers: { barrierId: string; n: number }[];
  users: { userId: string; email: string }[];
}
```

**Imported row type** (`AuditLogRow` re-exported from `@/features/admin/queries` ← `@/features/compliance/audit`):

```ts
export interface AuditLogRow {
  auditLogId: string;
  entityType: string;
  entityId: string | null;
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  operation: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRoleAtTime: string | null;
  barrierId: string | null;
  occurredAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  prevHash: string | null;
  rowHash: string | null;
}
```

**Non-exported helpers / subcomponents:**

| Name | Kind | Role |
|------|------|------|
| `EASE` | const | Framer Motion cubic-bezier |
| `AuditRow` | function | Expandable table row + inspector |
| `DiffPane` | function | JSON/string old/new value pane |
| `Meta` | function | Label/value meta chip |
| `StatTile` | function | Stat strip tile |
| `Pagination` | function | Prev/next + “Showing a–b of n” |
| `FilterField` | function | Labeled filter wrapper |
| `FilterSelect` | function | Native `<select>` |
| `FilterDate` | function | Native `<input type="date">` |
| `prettify` | function | `s.replace(/_/g, " ")` |
| `fmtDateTime` | function | `en-IN` short datetime or `"-"` |

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React` (state, effects, callbacks, refs) |
| `next/navigation` | `useRouter`, `useSearchParams` |
| `framer-motion` | `motion`, `AnimatePresence` |
| `@phosphor-icons/react` | `ArrowLeft`, `ArrowRight`, `ArrowClockwise`, `X`, `Faders`, `Hash`, `ShieldCheck`, `LinkBreak`, `CaretDown`, `CaretRight`, `Link as LinkIcon`, `House` |
| `@/lib/utils` | `cn` |
| `@/features/admin/queries` | `type AuditLogRow` |
| `@/components/brand` | `ActionBadge`, `actionFromVerb`, `Badge`, `Card`, `CardBody`, `CommandBar`, `EmptyState`, `Eyebrow`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `type Density` |

(`Badge` is imported but unused in the body — minor dead import.)

### Business purpose

**Admin forensic audit log UI** — denser and more filterable than the compliance audit page:

- Immutable event log table with expandable **old → new** JSON diff inspector.
- Hash-chain awareness (`prev_hash` / `row_hash`) for tamper evidence.
- URL-driven filters so forensic views are **shareable / bookmarkable**.
- Filters: free-text `q`, entity type, operation, actor, from/to dates, information **barrier**.
- Stat strip: on-page count, total matches, chain intact/broken heuristic, top actor on current page.

Mounted by `src/app/admin/audit/page.tsx` after server-side RBAC + data load.

### Key logic

#### URL state

```ts
function pushParams(updates: Record<string, string | undefined>) {
  const next = new URLSearchParams(searchParams.toString());
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined || v === "") next.delete(k);
    else next.set(k, v);
  }
  if (!("page" in updates)) next.delete("page"); // filter change → page 1
  router.push(`/admin/audit?${next.toString()}`, { scroll: false });
}
```

- Search box debounced **280ms** → `pushParams({ q })`.
- Clear filters → `router.push("/admin/audit")`.
- Refresh → `router.refresh()` (revalidates RSC data).

#### Local UI state

- `density: Density` (`"comfortable" | "compact"`) via brand `CommandBar` / `Table`.
- `search: string` synced from `props.q` on change.
- `expanded: Set<string>` of `auditLogId` for multi-row expand.

#### Stat strip heuristics

```ts
const chainBroken = props.rows.some(
  (r) => r.rowHash && (!r.prevHash || r.prevHash === "") && r.entityType !== "",
);
// top actor = mode of actorEmail on current page (null email → "system")
```

**Note:** “Chain on page” is a **page-local heuristic**, not a full sequential chain verification across the entire log (contrast compliance audit’s richer chain folding). Empty `prevHash` is treated as “broken” (or genesis displayed as “- (genesis)” in the inspector).

#### Table columns

| Column | Responsive |
|--------|------------|
| Expand caret | always |
| Operation (`ActionBadge` + `actionFromVerb(row.operation)`) | always |
| Entity (`prettify(entityType)` + optional `fieldName`) | always |
| Actor email / “system” | `md+` |
| Barrier id (truncated 8) | `lg+` |
| When (`fmtDateTime`) | `md+` |
| Hash (dot color + truncated `rowHash`) | `xl+` |

#### Expanded inspector

- `DiffPane` for `oldValue` / `newValue`: string as-is, else `JSON.stringify(value, null, 2)`, null → empty/`-`.
- Meta grid: entity ID, actor role, IP, correlation ID, `prev_hash`, `row_hash`, user agent.

#### Pagination

```ts
from = total === 0 ? 0 : (page - 1) * pageSize + 1
to = Math.min(total, page * pageSize)
// onPrev / onNext clamp page and pushParams({ page })
```

Server page uses `PAGE_SIZE = 50` and operations list:

```ts
const OPERATIONS = ["insert", "update", "delete", "merge", "approve", "reject"];
```

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Client navigation | `router.push` on filter/page changes (no data mutation) |
| RSC revalidation | `router.refresh()` on refresh button |
| Local UI only | expand set, density, debounced search state |
| Timers | 280ms debounce; cleaned on unmount |
| No writes | Does not insert/update audit rows (read-only view) |

### Security / RBAC

**Not enforced in this client file.** Enforcement is on the server page:

```ts
// src/app/admin/audit/page.tsx
const user = await requireUser();
if (!can(user, "read", "audit") && !can(user, "manage", "user")) {
  redirect("/parties");
}
```

| Concern | Assessment |
|---------|------------|
| Capability | Expect `audit:read` or `user:manage` (admin/compliance/partner path via page gate) |
| Sensitive fields | Exposes **IP**, **user agent**, **actor email**, **old/new values**, **barrier IDs**, hashes — high sensitivity forensic data |
| Client trust | Filters only rewrite URL; actual filtering must be applied in `listAuditEntries` server query |
| XSS | Diff pane uses `<pre>` text nodes from `JSON.stringify` / string values — React-escaped; large JSON still OK |
| Barrier filter | Uses server-joined `barrier_id`; admin view exposes barrier filter that compliance page may handle differently (comment in file) |
| Shareable URLs | Filter state in query string — shared links may leak investigative context (entity IDs, actor IDs) to clipboard/history |

### Coupling

| Peer | Relationship |
|------|----------------|
| `src/app/admin/audit/page.tsx` | Sole consumer; loads data + gates RBAC; passes props |
| `@/features/admin/queries` | Type re-export of `AuditLogRow`; page uses `listAuditEntries`, `listAuditEntityTypes`, `listAuditBarriers`, `listUsers` |
| `@/features/compliance/audit` | Canonical `listAuditLog` / `AuditLogRow` implementation |
| `src/app/compliance/audit/audit-list-view.tsx` | Parallel, richer compliance UI (chain folding, etc.); admin view is simpler forensic table |
| Brand system | Heavy use of CommandBar/Table/Card/ActionBadge |

### Risks / TODOs

| Risk | Detail |
|------|--------|
| Chain integrity oversimplified | Flags any missing `prevHash` as “broken”; genesis rows and first-in-stream may false-positive “broken” on page |
| Page-local top actor / chain stats | Do not represent global log health |
| Unused import | `Badge` imported from brand, never used |
| Debounce + exhaustive-deps | `onSearchChange` intentionally omits `pushParams` deps (`eslint-disable`); relies on `searchParams` in deps — generally OK but can stale if router identity changes |
| Date inputs | Native `type="date"` values are local-calendar strings; timezone alignment with server `from`/`to` parsing must match query layer (IST vs UTC risk) |
| Large diffs | `max-h-64 overflow-auto` on panes; huge JSON values still serialized fully into DOM |
| No export/download | Forensic export not in this view |
| No row-level deep link | Expand state is client-only; shared URL does not open a specific row |
| Operations list static | Page hardcodes operations; UI does not discover operation verbs from DB |
| Concurrent filters | URL is source of truth; local `search` can briefly desync until debounce fires |
| Accessibility | Row expand via `TableRow onClick` without keyboard button semantics / `aria-expanded` |
| Performance | Fine at 50 rows; multi-expand keeps all open diffs in DOM |

---

## Cross-file summary (batch 014)

| File | Lines | Kind | Wired? | Mutates data? | RBAC in-file? |
|------|------:|------|--------|---------------|---------------|
| `_components/recent-activity.tsx` | 274 | Dashboard client rail | **No consumer found** | No | No |
| `_components/stage-strip.tsx` | 162 | Dashboard client strip | **No consumer found** | No | No |
| `actions/auth.ts` | 11 | Server action | Yes (`site-nav`) | Session cookie clear | N/A (logout) |
| `admin/audit/audit-view.tsx` | 689 | Admin forensic client view | Yes (`admin/audit/page`) | No (read UI) | No (page gates) |

### Architectural themes

1. **Dashboard presentation split:** `_components/*` holds polished Framer Motion dashboard islands; current `src/app/page.tsx` does not import the two analyzed components — likely mid-migration or alternate design path.
2. **Server-preformatted dates** in `RecentInteraction` and **direct-render metrics** in `StageStrip` are intentional hydration/serverless safety patterns.
3. **Auth surface area** for clients is minimized: one server action wrapping Auth.js `signOut`.
4. **Admin audit** is a thin interactive shell over server-filtered `AuditLogRow[]`, with URL as the filter bus and brand table/command-bar primitives for IA consistency with the rest of Binary CRM.

### Suggested follow-ups (analysis only; not implemented)

- Wire or delete orphaned `RecentActivity` / `StageStrip` to avoid dual `StageStrip` confusion with `dashboard-exposure-chart.tsx`.
- Align admin chain indicator with compliance page’s real chain verification if forensic accuracy matters.
- Consider audit-of-logout if compliance requires session lifecycle events.
- Drop unused `Badge` import in `audit-view.tsx`.
