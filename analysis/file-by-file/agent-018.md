# Agent 018 — File-by-file analysis

Batch: `batch-018.list`  
Scope: 4 files under app root  
Workspace: `/home/Jashmhta/crm/bc-crm/app`

---

## 1. `src/app/ai/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/ai/page.tsx` |
| **Lines** | 38 |
| **Directive** | Server Component (no `"use client"`) |
| **Route** | App Router page → `/ai` |

### Role

Server page entry for the **AI Insights hub**. Loads deterministic, non-LLM “AI” aggregates for the signed-in user and hands serializable props to a client presentation component (`AiHubView`). Explicitly `force-dynamic` so build-time prerender never runs the aggregate DB queries.

### Exports

```ts
export const dynamic = "force-dynamic";

export default async function AiHubPage(): Promise<JSX.Element>
```

- **Default export**: `AiHubPage` — async RSC page component.
- **Named export**: `dynamic` — Next.js route segment config forcing dynamic rendering.

### Imports

| Import | From | Purpose |
|--------|------|---------|
| `PageShell`, `PageHeader` | `@/components/brand/page-shell` | Layout chrome / page title |
| `requireUser` | `@/lib/rbac` | Auth gate; returns `CrmUser` or redirects `/login` |
| `getNextActions` | `@/features/ai/nextAction` | User-scoped next-best-actions |
| `getRecentInteractionSummaries` | `@/features/ai/interactionSummary` | Recent interaction one-liners |
| `getClientInsights` | `@/features/ai/clientInsights` | Per-party relationship / deal scores |
| `Reveal`, `SectionHeading` | `@/components/brand` | **Imported but unused** in this file |
| `AiHubView` | `./ai-hub-view` | Client view that renders the three panels |

### Business purpose

Surface a coverage-desk “intelligence” home:

1. **Next best actions** — overdue tasks, stuck deals, pending credit committee, KYC expiry, no recent interaction (`getNextActions(user.appUserId, { limit: 5 })`).
2. **Recent interaction auto-summaries** — last 6 firm interactions with heuristic topic/action extraction (`getRecentInteractionSummaries(6, user)`).
3. **Client insights** — up to 8 parties with relationship strength / deal potential / recommended nurture action (`getClientInsights({ limit: 8, user })`).

Product framing in the header: *“Deterministic credit and relationship summaries.”* — not external LLM calls; engines live under `src/features/ai/*`.

### Key logic

```ts
export default async function AiHubPage() {
  const user = await requireUser();

  const [nextActions, recentSummaries, clientInsights] = await Promise.all([
    getNextActions(user.appUserId, { limit: 5 }),
    getRecentInteractionSummaries(6, user),
    getClientInsights({ limit: 8, user }),
  ]);

  return (
    <PageShell>
      <PageHeader title="AI Insights" description="Deterministic credit and relationship summaries." />
      <AiHubView
        actions={nextActions.actions}
        recentSummaries={recentSummaries}
        clientInsights={clientInsights}
        userName={user.name ?? user.email ?? undefined}
      />
    </PageShell>
  );
}
```

- Parallel `Promise.all` for three independent feature queries.
- Only **serializable** data crosses the RSC → client boundary (no function props).
- `userName` prefers `user.name`, falls back to `user.email`.

### Types / data shapes (consumed, defined elsewhere)

From `@/features/ai` (via feature modules / `types.ts`):

```ts
// NextActionsResult
{ actions: NextAction[]; userId: string }

// NextAction
{
  kind: NextActionKind; // "task_overdue" | "deal_stuck" | "credit_committee_pending" | "kyc_expiring" | "no_recent_interaction"
  title: string;
  description: string;
  href: string;
  priority: AiPriority; // "critical" | "warning" | "info" | "positive"
  entityLabel: string;
  occurredAt: string;
  relative: string;
}

// RecentInteractionSummary
{
  interactionId: string;
  subject: string | null;
  partyName: string | null;
  dealCode: string | null;
  channel: string | null;
  occurredAt: string;
  relative: string;
  topic: string;
  actionItem: string | null;
  href: string;
}

// ClientInsight
{
  partyId: string;
  legalName: string;
  relationshipStrength: number; // 0..100
  relationshipBand: string;
  dealPotential: number; // 0..100
  dealPotentialBand: string;
  recommendedAction: InsightActionKind;
  actionRationale: string;
  interactionCount: number;
  dealCount: number;
  activeDealCount: number;
  daysSinceLastInteraction: number | null;
  totalTargetSizeCr: number;
  href: string;
}
```

`AiHubView` props (sibling file):

```ts
interface AiHubViewProps {
  actions: NextAction[];
  recentSummaries: RecentInteractionSummary[];
  clientInsights: ClientInsight[];
  userName?: string;
}
```

### Side effects

- **Auth redirect** via `requireUser()` → `/login` if unauthenticated.
- **DB reads** (three feature modules); no writes, no cookies set here.
- **No caching** intended: `dynamic = "force-dynamic"`.

### Security / RBAC

- **Auth only at page level**: `requireUser()` — any signed-in CRM user can open `/ai`.
- **No permission check** such as `can(user, "read", "ai")` — access is “any authenticated user”.
- Data scoping is delegated into feature functions:
  - `getNextActions(user.appUserId, …)` — user-scoped by assignee/ownership in scans.
  - `getRecentInteractionSummaries(…, user)` — uses `interactionVisibilityClause(user)`.
  - `getClientInsights({ user })` — may scope by user when provided (feature-layer).
- Risk: if feature queries under-scope, the hub could leak firm-wide relationship stats to restricted desks. Trust is in feature modules, not this page.

### Coupling

| Direction | Target |
|-----------|--------|
| → | `@/lib/rbac` (`requireUser`, `CrmUser`) |
| → | `@/features/ai/nextAction`, `interactionSummary`, `clientInsights` |
| → | `@/components/brand/page-shell`, unused brand imports |
| → | `./ai-hub-view` (client) |
| ← | App Router navigation / shell layout |

### Risks / TODOs

1. **Unused imports**: `Reveal`, `SectionHeading` — dead code / lint noise.
2. **No dedicated AI capability gate** — any logged-in role reaches insights.
3. **`user.appUserId` nullability**: `getNextActions` accepts `string | null` and returns empty actions if null; page still renders empty hero rather than erroring.
4. **No metadata export** (unlike calendar) — browser tab title may fall back to layout default.
5. **No error boundary / try-catch** — any query failure fails the whole page.

---

## 2. `src/app/api/auth/[...nextauth]/route.ts`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/api/auth/[...nextauth]/route.ts` |
| **Lines** | 10 |
| **Directive** | Route Handler (Node.js runtime) |
| **Route** | Catch-all Auth.js endpoints under `/api/auth/*` |

### Role

Thin App Router **Auth.js v5 route handler** adapter. Re-exports HTTP methods from `NextAuth()` configured in `@/lib/auth`. Serves sign-in, callback, session, sign-out, CSRF, etc. under the `[...nextauth]` catch-all segment.

### Exports

```ts
export const { GET, POST } = handlers;
export const runtime = "nodejs";
```

- **`GET`**, **`POST`**: Route Handler functions from Auth.js `handlers`.
- **`runtime = "nodejs"`**: Forces Node.js (not Edge) — required for bcrypt, Drizzle, TOTP (`otpauth`), etc. used in credentials `authorize`.

### Imports

| Import | From | Purpose |
|--------|------|---------|
| `handlers` | `@/lib/auth` | `{ handlers, signIn, signOut, auth } = NextAuth({…})` |

### Business purpose

Authentication API surface for Binary CRM:

- Credentials login (email/password + optional TOTP) implemented in `lib/auth`.
- Session read/write for client and server (`auth()`, JWT strategy currently).
- Adapter-backed tables: `users`, `accounts`, `sessions`, `verificationTokens`, `authenticators` (Drizzle).

Comments in this file note: Route Handlers are dynamic by default (cookies/headers), so `force-dynamic` is unnecessary and `next build` will not prerender this route.

### Key logic

Entire file body:

```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
export const runtime = "nodejs";
```

No local business logic — all policy lives in `/src/lib/auth.ts`:

```ts
// lib/auth.ts (referenced)
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, { usersTable, accountsTable, sessionsTable, … }),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [Credentials({ … authorize … })],
  // jwt / session callbacks stamp appUserId, wall, roles, desk, brandScope
});
```

### Side effects

- **HTTP**: all Auth.js endpoints mutate cookies/session on POST, read session on GET.
- **DB**: via adapter + credentials `authorize` (app_user lookup, lockout counters, bcrypt).
- **No app-level logging** in this shim file.

### Security / RBAC

- This route is **public by design** (login/callback/session).
- Actual security controls in `lib/auth`:
  - bcrypt password verify
  - TOTP when `mfa_enabled`
  - lockout after 5 failures / 15 minutes
  - JWT (not yet revocable DB sessions — production TODO in `lib/auth` header)
  - `trustHost: true` (needed for IP host in dev/deploy; production should set `AUTH_URL`)
- **No RBAC** here; RBAC starts after session exists (`requireUser` / `getCurrentUser`).

### Coupling

| Direction | Target |
|-----------|--------|
| → | `@/lib/auth` → `db`, schema, bcrypt, otpauth, org brand helpers |
| ← | Browser / NextAuth client, middleware, `auth()` server calls |

### Risks / TODOs

1. **Production TODOs live in `lib/auth`**, not this file: switch to database sessions + Redis revocation; prefer OIDC IdP; encrypt MFA secrets; WebAuthn.
2. **`trustHost: true`** widens host acceptance — must pair with correct production `AUTH_URL` / HTTPS.
3. **JWT-only sessions** are not centrally revocable until strategy cutover.
4. File itself has no tests surface; misconfiguration of `handlers` export would break all auth endpoints.

---

## 3. `src/app/calendar/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/calendar/page.tsx` |
| **Lines** | 261 |
| **Directive** | Server Component |
| **Route** | `/calendar` |

### Role

Server-rendered **month calendar + agenda** unifying tasks, interactions, re-KYC dates, and deal targets into one desk-planning view. Reads events via `getCalendarEvents`, groups by ISO date key, renders a Mon-start grid and a month agenda list.

### Exports

```ts
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Calendar",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}): Promise<JSX.Element>
```

### Imports

| Import | From | Purpose |
|--------|------|---------|
| `PageShell`, `PageHeader` | `@/components/brand/page-shell` | Layout |
| `Link` | `next/link` | Event deep-links |
| `requireUser` | `@/lib/rbac` | Auth |
| `getCalendarEvents`, type `CalendarEvent` | `@/features/calendar/queries` | Event load |
| `Card`, `CardBody` | `@/components/brand` | Card chrome |
| `cn` | `@/lib/utils` | className merge |

### Business purpose

Give coverage/desk users a single place to see:

| Kind | Visual | Source (via queries) |
|------|--------|----------------------|
| `task` | gold dot | Tasks due in month |
| `interaction` | info dot | Scheduled/occurred interactions |
| `kyc` | down (red) | Re-KYC due dates |
| `deal` | emerald | Deal target dates |
| `notification` | muted | Kind supported on type; not counted in legend |

Description: *“Tasks, meetings, re-KYC, and deal targets.”*

### Types / signatures

**From feature module** (`@/features/calendar/queries`):

```ts
export type CalendarEventKind =
  | "task"
  | "interaction"
  | "kyc"
  | "deal"
  | "notification";

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  /** ISO date YYYY-MM-DD (date-only for month grid). */
  date: string;
  href: string;
  severity?: "info" | "warning" | "critical";
  meta?: string;
}

export async function getCalendarEvents(
  year: number,
  month: number, // 1–12
  user: CrmUser,
): Promise<CalendarEvent[]>;
```

**Local helpers**:

```ts
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const KIND_DOT: Record<CalendarEvent["kind"], string> = {
  task: "bg-gold",
  interaction: "bg-info",
  kyc: "bg-down",
  deal: "bg-emerald",
  notification: "bg-muted-foreground",
};

function parseMonth(searchParams: { y?: string; m?: string }): { year: number; month: number }
// Clamps year 2000–2100, month 1–12; defaults to current calendar year/month.

function monthLabel(year: number, month: number): string
// en-IN long month + year, Asia/Kolkata timezone — DEFINED BUT UNUSED in JSX.

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number }

function buildGrid(year: number, month: number): (number | null)[]
// Mon-start cells; null = padding days; pads end so length % 7 === 0.
```

**Page signature** (Next 15+/async `searchParams`):

```ts
searchParams: Promise<{ y?: string; m?: string }>
```

Query params: `?y=2026&m=7` select year/month.

### Key logic

1. `requireUser()` then `parseMonth(await searchParams)`.
2. `events = await getCalendarEvents(year, month, user)`.
3. Bucket into `Map<string /* YYYY-MM-DD */, CalendarEvent[]>`.
4. `buildGrid` → 7-column month matrix.
5. `todayKey` from local `Date` (server local TZ — **not** forced to Asia/Kolkata, unlike `monthLabel`).
6. Legend counts for task / interaction / kyc / deal only.
7. Grid cells: up to **3** event links per day + “+N more”; severity styles `critical` → `text-down`, `warning` → `text-gold-deep`.
8. Agenda section: full event list sorted as returned from query, each row link + kind badge.

### Side effects

- Auth redirect if unauthenticated.
- DB reads via `getCalendarEvents` (tasks, interactions, kyc_record, deals + parties).
- No mutations.
- `force-dynamic` — always runtime.

### Security / RBAC

- **Page**: authenticated only (`requireUser`). No `can(user, …)` on calendar itself.
- **Data layer** (`getCalendarEvents`):

```ts
const canAll =
  user.roles.includes("super_admin") ||
  user.roles.includes("admin") ||
  can(user, "read_all", "party");
// When !canAll: tasks filtered to assignee; parties/deals similarly ownership-scoped.
```

- Event `href`s are internal routes; no secrets rendered beyond titles/meta.

### Coupling

| Direction | Target |
|-----------|--------|
| → | `@/lib/rbac` |
| → | `@/features/calendar/queries` (DB schema: task, interaction, kycRecord, deal, party) |
| → | Brand shell/card, next/link |
| ← | Layout / nav |

### Risks / TODOs / dead code

1. **Month navigation not wired**: `prev` / `next` from `shiftMonth` are computed but **never used**; no prev/next links in UI. Users can only change month via URL `?y=&m=` manually.
2. **`monthLabel` unused** — month title never shown in header (only static “Calendar”).
3. **Header action is a self-link**:

   ```tsx
   <a href="/calendar" …>Open calendar</a>
   ```

   Resets to current month defaults; does not deep-link external calendar. Redundant with being on the page already.
4. **Today highlight TZ mismatch**: `todayKey` uses server local timezone; `monthLabel` documents Asia/Kolkata — possible wrong “today” if server TZ ≠ IST.
5. **`notification` kind** in type/dot map but not in legend or kindCounts.
6. **No empty-state for grid** beyond empty cells; agenda has empty copy.
7. **Max 3 events/day in grid** hides rest except “+N more” text (not a drill-down day view).

---

## 4. `src/app/compliance/audit/audit-list-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/compliance/audit/audit-list-view.tsx` |
| **Lines** | 3298 |
| **Directive** | `"use client"` |
| **Route consumer** | Rendered by `/compliance/audit` server `page.tsx` |

### Role

**Client presentation layer** for the immutable, hash-chained audit log. Implements a “Grouped Narrative” UX:

- Group rows by **calendar day** (Today / Yesterday / dated labels).
- **Day summary cards** (action mix, actor mix, broken-chain count) for dense days (≥3 entries).
- **Cluster cards** for consecutive same-actor + same-op + same-entity runs.
- View-layer **hash-chain verification** (`prevHash` vs older row’s `rowHash`).
- URL-driven filters (entity, op, from, to, q) + client-only **actor** facet.
- Dual modes: **timeline** (default) vs **compact** table.
- Sticky **inspector pane** (lg+) with old→new diff + provenance.

Server page (`page.tsx`, not in this batch) owns authz + `listAuditLog`; this file is pure UI/state over `AuditLogRow[]`.

### Exports

```ts
export interface AuditListViewProps {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
  entityType?: string;
  operation?: string;
  from?: string;
  to?: string;
  entityTypes: string[];
  operations: string[];
}

export function AuditListView(props: AuditListViewProps): JSX.Element
```

All other functions/components in the file are **module-private** (not exported).

### Imports

**Framework / libs**

| Import | From |
|--------|------|
| `* as React` | `react` |
| `Link` | `next/link` |
| `useRouter`, `usePathname`, `useSearchParams` | `next/navigation` |
| `animate`, `motion`, `AnimatePresence` | `framer-motion` |
| Many icons | `@phosphor-icons/react` |
| `type Icon as PhosphorIcon` | `@phosphor-icons/react` |
| `cn` | `@/lib/utils` |
| `type AuditLogRow` | `@/features/compliance/audit` |
| Brand UI: `ActionBadge`, `actionFromVerb`, `type ActionType`, `Badge`, `Button`, `Card`, `CellEmpty`, `CommandBar`, `EmptyState`, `Eyebrow`, `Table*`, `type Density`, `PreviewPane`, `IconTile`, `KycShieldMark`, `MandateMark`, `RatingLadderMark`, `ExposureGaugeMark` | `@/components/brand` |
| `type MarkProps` | `@/components/brand` |

**Phosphor icons used** (non-exhaustive list from import block):  
`ArrowLeft`, `ArrowRight`, `Sparkle`, `LockSimple`, `Hash`, `Clock`, `CalendarBlank`, `LinkBreak`, `ShieldCheck`, `CaretDown`, `CaretRight`, `Link as LinkIcon`, `Faders`, `Rows`, `ClockCountdown`, `User`, `Users`, `Fingerprint`, `Monitor`, `Plus`, `PencilSimple`, `Trash`, `Eye`, `DownloadSimple`, `Buildings`, `FileText`, `ListChecks`, `Chats`, `IdentificationCard`, `SealWarning`, `DotsThree`.

### Types (file-local)

```ts
type ViewMode = "timeline" | "compact";

type ChainStatus = "unsealed" | "genesis" | "linked" | "broken" | "unverified";

interface FoldGroup {
  key: string;
  rows: AuditLogRow[];
}

interface DaySection {
  key: string;              // YYYY-MM-DD
  date: Date;
  label: string;            // "Today" | "Yesterday" | short date
  longDate: string;
  isToday: boolean;
  isYesterday: boolean;
  rows: AuditLogRow[];
  groups: FoldGroup[];
  actionCounts: [string, number][];
  actorCounts: [string, number][];
  brokenCount: number;
  spanOldest: Date;
  spanNewest: Date;
}

type EntityIconDef =
  | { kind: "phosphor"; Icon: PhosphorIcon }
  | { kind: "mark"; Mark: (props: MarkProps) => React.ReactElement };

type ClusterVariant = "light" | "standard" | "dense"; // 2–3 / 4–7 / 8+
```

**`AuditLogRow`** (from `@/features/compliance/audit` — maps table `audit_log` + join):

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
  actorEmail: string | null;      // joined from app_user.email
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

**Tables / DB coupling (indirect)**: view never queries; parent uses `listAuditLog` against Drizzle `auditLog` + `appUser`. Schema notes (feature module): INSERT-only, RLS + trigger, monthly RANGE partition by `occurred_at`, hash chain via BEFORE INSERT trigger.

Parent page constants (context):

```ts
const PAGE_SIZE = 50;
const ENTITY_TYPES = [
  "party", "contact", "deal", "deal_party", "kyc_record", "kyc_beneficial_owner",
  "consent_record", "data_subject_request", "credit_analysis", "credit_score",
  "credit_limit", "exposure", "external_rating", "interaction", "document", "task",
];
const OPERATIONS = ["insert", "update", "delete", "merge", "approve", "reject"];
// RBAC on server: can(user, "read"|"read_all", "audit") || can(user, "manage", "user")
```

### Local component / function inventory

| Name | Kind | Purpose |
|------|------|---------|
| `fmtTime` / `fmtDateTimeFull` / `fmtDateLabel` / `fmtDateLong` | pure | `en-IN` locale formatting |
| `relativeTime` | pure | “2m ago” style secondary timestamp |
| `fmtDuration` | pure | cluster span “4s” / “12m” / “2h” |
| `snippet` / `prettify` / `isCodeLike` / `formatValue` | pure | display / mono detection / JSON pretty-print |
| `startOfDay` / `dayKey` | pure | day bucketing |
| `foldKey` / `foldRuns` | pure | consecutive same actor\|op\|entity folds |
| `buildDaySections` | pure | newest-first day sections + summaries |
| `computeChainStatuses` | pure | per-row chain status on page (newest-first) |
| `EntityMark` | UI | entity glyph disc (Phosphor or brand mark) |
| `MountReveal` | UI | framer-motion mount animation (not whileInView) |
| `CountUp` | UI | animated numeric display via `animate()` |
| **`AuditListView`** | **exported UI** | main shell: CommandBar, stats, rail, narrative/table, pagination |
| `ViewModeToggle` | UI | timeline \| compact |
| `FilterRail` / `FacetSection` / `FacetPill` | UI | entity / action / actor refine |
| `TimelineNarrative` / `DayDivider` / `DaySectionView` | UI | day-grouped timeline |
| `ActionProportionBar` / `DayMixBar` | UI | action/actor mix graphics |
| `DaySummaryCard` | UI | dense day “at a glance” |
| `ClusterDensityStrip` / `ClusterStat` / `ClusterTimeSpark` | UI | cluster density UX |
| `ClusterCard` / `ClusterSubRow` | UI | expandable consecutive-run cards |
| `TimelineRow` / `TimelineCard` | UI | single-event timeline cards |
| `HashChip` / `ChainStatusBadge` / `ChainCell` | UI | chain presentation |
| `AuditDetailPane` | UI | sticky inspector (`PreviewPane`) |
| `DiffView` / `DiffWell` | UI | old → new payload |
| `ExpandedMeta` / `MetaItem` | UI | hash, IP, UA, correlation, actor id, time |
| `CompactView` / `DayBand` / `CompactGroupView` / `AuditRow` | UI | table mode |
| `FoldPill` | UI | compact fold ×N control |
| `StatTile` | UI | elevated integrity strip tiles |
| `Pagination` / `PagePill` | UI | page links preserving query params |
| `DoubleBezelDatePill` | UI | `datetime-local` from/to filters |

### Key logic

#### Hash-chain verification (view-layer)

```ts
// Rows arrive newest-first. Row i's prevHash should equal rows[i+1].rowHash.
function computeChainStatuses(rows: AuditLogRow[]): ChainStatus[] {
  return rows.map((r, i) => {
    if (!r.rowHash) return "unsealed";
    if (!r.prevHash) return "genesis";
    const older = rows[i + 1];
    if (!older || !older.rowHash) return "unverified"; // prior may be off-page
    return r.prevHash === older.rowHash ? "linked" : "broken";
  });
}
```

**Important**: verification is **page-scoped** and does not recompute cryptographic hashes — it only checks pointer equality between adjacent rows’ stored hashes. Oldest row on page is `unverified` if prev is off-page. Actor filtering does not recompute chain (status computed on full page rows).

#### Day grouping + folding

```ts
function foldKey(r: AuditLogRow): string {
  return `${r.actorEmail ?? ""}|${r.operation}|${r.entityType}`;
}
// foldRuns: consecutive identical foldKey → FoldGroup
// buildDaySections: Map by dayKey(occurredAt), newest day first, foldRuns per day
```

#### URL state

```ts
const pushParam = (key: string, value: string) => {
  // URLSearchParams from useSearchParams; delete page on change; router.replace
};

const onSearchChange = (value: string) => {
  // 280ms debounce → set/delete `q`; reset page
};

const clearAll = () => {
  setActorFilter(null);
  router.replace(pathname); // drops all query params
};
```

- Server-backed filters: `q`, `entityType`, `operation`, `from`, `to`, `page`.
- Client-only: `actorFilter` (email or `"system"`).

#### Entity icon map

```ts
const ENTITY_ICON: Record<string, EntityIconDef> = {
  party: Buildings,
  contact: User,
  deal / deal_party: MandateMark,
  kyc_record / kyc_beneficial_owner / consent_record / data_subject_request: KycShieldMark,
  credit_analysis / credit_score / credit_limit / external_rating: RatingLadderMark,
  exposure: ExposureGaugeMark,
  interaction: Chats,
  document: FileText,
  task: ListChecks,
};
// default: IdentificationCard
```

#### Action visual maps

```ts
const ACTION_GLYPH: Record<ActionType, React.ReactNode>; // create|update|delete|read|export
const ACTION_DOT: Record<ActionType, string>;
// actionFromVerb(op) maps DB verbs (insert, update, …) → ActionType
```

#### Cluster density

```ts
const variant: ClusterVariant = count >= 8 ? "dense" : count >= 4 ? "standard" : "light";
// light: header only
// standard: distinct fields + entities + span
// dense: + 14-bucket time sparkline
```

#### Selection / inspector

- `selectedId` state defaults to first row’s `auditLogId`.
- `selectedRow` derived from `displayRows` (falls back to first when filter invalidates selection).
- lg+: `AuditDetailPane`; mobile: inline expand on cards / sub-rows (`lg:hidden`).

#### Pagination

```ts
// Builds /compliance/audit?…&page=N preserving q, entityType, operation, from, to
// Window ±1 around current page + first/last ellipsis pills
```

### Side effects

- **Client-only**: React state, URL `router.replace`, debounced search timers.
- **Framer Motion** `animate` for CountUp (stopped on unmount).
- **No direct DB/API calls** from this file.
- **No cookie / localStorage** persistence of filters (URL + ephemeral actor filter).

### Security / RBAC

- **No RBAC in this client file.** Parent `page.tsx` enforces:

  ```ts
  const user = await requireUser();
  if (!can(user, "read", "audit") && !can(user, "read_all", "audit") && !can(user, "manage", "user")) {
    redirect("/parties");
  }
  ```

- View displays **sensitive forensic data**: old/new values, IP, user agent, actor email/user id, correlation ids, hash chain.
- **Trust boundary**: whoever can open the page sees full page payloads; no field-level redaction in the view.
- Chain “broken” is a **UI integrity signal**, not a cryptographic audit proof (no re-hash of payloads).
- Search `q` is substring on entity_type / actor_role_at_time server-side (not free-text on secrets, but still powerful).

### Coupling

| Direction | Target |
|-----------|--------|
| → | `@/features/compliance/audit` type only (`AuditLogRow`) |
| → | `@/components/brand` (large design system surface) |
| → | Next navigation (shareable filters) |
| → | framer-motion |
| ← | `src/app/compliance/audit/page.tsx` passes props after `listAuditLog` |
| Conceptual | `audit_log` table immutability / triggers in schema |

### Business purpose (forensics / compliance)

Supports SEBI/internal compliance narrative:

- Who changed what (actor email, role-at-time, IP, UA).
- Field-level old/new for mutations.
- Tamper-evidence surface (hash chain status strip + per-row chips).
- Shareable filtered investigations via URL.
- Day-grouped diary for incident review rather than raw 50-row dumps.

### Risks / TODOs

1. **Large monolith client file (~3.3k LOC)** — hard to unit-test; many private components could be split.
2. **Chain verification is adjacent-page only** — multi-page gaps and concurrent inserts off-window not fully verified; “sealed” can be false confidence.
3. **Actor filter page-scoped** — empty state explains this, but users may think they filtered globally.
4. **`pageRows.indexOf(row)` in `statusOf`** — O(n) per call; works at PAGE_SIZE=50 but fragile if reused.
5. **Date bucketing uses local browser TZ** for `startOfDay` / Today labels; server `occurredAt` may be UTC — day boundaries can shift for IST desks.
6. **No export / download** despite `DownloadSimple` icon used for `export` action type only.
7. **DiffView** dumps raw JSON/values — could render PII/secrets stored in audit payloads (by design of immutable log, but UI has no masking).
8. **Pagination hardcodes path** `/compliance/audit?…` — not derived from `pathname` (breaks if route moves).
9. **Accessibility**: many `role="button"` divs (documented as intentional for nested controls); need keyboard coverage (Enter/Space present).
10. **No TODO comments in file**; conceptual TODOs are product polish (critic-driven redesign already applied per header comment).
11. **React “adjust state during render”** for search sync (`committedQ`) — intentional pattern, but can surprise future maintainers.
12. **`ClusterTimeSpark` useMemo deps include `times` array** recreated each render — may recompute every render (perf nit).

---

## Cross-file notes (batch 018)

| Theme | Files |
|-------|--------|
| Auth gate | AI + Calendar: `requireUser` only. Audit view: RBAC on parent page (not in this batch’s view file). Auth route: public Auth.js handlers. |
| Dynamic rendering | AI + Calendar: `export const dynamic = "force-dynamic"`. Auth route: dynamic by default. Audit view: client under dynamic parent. |
| Data ownership | Pages call feature modules; audit view is presentation-only. |
| Dead code | AI: unused `Reveal`/`SectionHeading`. Calendar: unused `monthLabel`, unused `prev`/`next` nav. |
| Design system | All UI pages use `@/components/brand` shell/cards; audit view is the densest brand consumer. |

---

## Line count summary

| Path | Lines |
|------|------:|
| `src/app/ai/page.tsx` | 38 |
| `src/app/api/auth/[...nextauth]/route.ts` | 10 |
| `src/app/calendar/page.tsx` | 261 |
| `src/app/compliance/audit/audit-list-view.tsx` | 3298 |
| **Batch total** | **3607** |

---

*End of agent-018 analysis.*
