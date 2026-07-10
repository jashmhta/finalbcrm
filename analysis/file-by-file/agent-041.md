# Agent 041 — File-by-file analysis

**Batch:** `batch-041.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Home dashboard + party detail + assign ownership form + parties loading skeleton.

---

## 1. `src/app/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/page.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/page.tsx` |
| **Lines** | 351 |
| **Directive** | None (Server Component) |
| **Route** | `/` — authenticated home dashboard |
| **Role** | Personalized CRM home: KPIs, open-pipeline stage strip, recent deals, recent interactions, quick links |

### Exports + signatures

```ts
export const dynamic = "force-dynamic";

export default async function HomePage(): Promise<JSX.Element>

// Internal helpers (non-exported)
function formatDate(value: Date | string | null): string
function formatRelative(value: Date | string | null): string
function timeOfDayGreeting(): "morning" | "afternoon" | "evening"
function stageBadge(status: string): "neutral" | "emerald" | "gold" | "info" | "outline"
```

**Module constants:**

```ts
const OPEN_DEAL_STATUSES = [
  "lead", "mandated", "in_dd", "structuring",
  "rating_marketing", "pricing", "allocation", "on_hold",
] as const;

const STAGE_LABELS: Record<string, string> // human labels for funnel stages
```

### Imports

| Source | Symbols |
|--------|---------|
| `@/components/brand/page-shell` | `PageShell`, `PageHeader`, `KpiStrip` |
| `next/link` | `Link` |
| `@/features/dashboard/queries` | `getDashboardData` |
| `@/lib/rbac` | `requireUser` |
| `@/components/brand` | `Button`, `Card`, `Badge` |
| `@/components/brand/icons` | `ArrowRight`, `Crosshair`, `Plus` |
| `@/components/brand/money` | `compactINR` |
| `@/lib/utils` | `cn` |

### Business purpose

Land the authenticated banker on a **desk blotter**: parties/investors/issuers counts, open mandates + booked exposure by stage, credit analyses in progress, KYC expiring ≤30d, interaction volume, then two activity rails (deals + interactions) and four deep-link tiles (Parties, Calendar, Notifications, KYC).

### Key logic

1. `requireUser()` then `getDashboardData({ user, recentLimit: 6 })`.
2. Builds issuer/deal/party name maps from join rows for list labels.
3. Aggregates `kpis.openDealByStage` into fixed 8-stage grid (`OPEN_DEAL_STATUSES`); missing stages show count 0.
4. Greeting: IST hour via `Intl` → morning/afternoon/evening + first token of `user.name` or email.
5. Subline: super_admin brand scope (Capital/Bonds/shared) else joined role labels.
6. Header actions: `/matching` (Match), `/leads/new` (New lead).
7. Stage tiles link to `/deals?status=<status>`.
8. Quick links: `/parties`, `/calendar`, `/notifications`, `/compliance/kyc`.

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Auth | `requireUser()` |
| DB reads | `getDashboardData` (counts, recent deals/interactions, name joins) |
| Mutations | None |

### Security / RBAC

- Auth gate only (`requireUser`). No page-level `can()` checks.
- Visibility delegated to `getDashboardData({ user })` — brand/desk scoping lives in feature queries + RLS.
- No secrets rendered; KYC due count is aggregate only.

### Coupling

| Direction | Target |
|-----------|--------|
| Strong | `@/features/dashboard/queries` return shape (`kpis`, `recentDeals`, `recentInteractions`, issuer/party/deal name rows) |
| Strong | Brand shell + money + badge stage palette |
| Nav targets | `/deals`, `/interactions`, `/matching`, `/leads/new`, portal/compliance tiles |

### Risks / TODOs

1. **Stage set hardcoded** — if deals schema adds/removes statuses, dashboard and pipeline can diverge.
2. **`formatRelative` uses local `Date.now()` vs DB timestamps** without explicit TZ for relative; absolute dates use Asia/Kolkata.
3. **No empty-state CTAs** beyond “No deals yet” text (no create buttons in cards).
4. **KpiStrip “Credit in progress” / “KYC due”** are opaque aggregates — no drill-down query params.
5. Unused potential: no charts from `_components/*` on this home (charts live on older dashboard components / portfolio).

---

## 2. `src/app/parties/[id]/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/parties/[id]/page.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/parties/[id]/page.tsx` |
| **Lines** | 858 |
| **Directive** | None (Server Component) |
| **Route** | `/parties/[id]` — party master detail |
| **Role** | Full counterparty 360: ownership assign, relationship graph, contacts, hierarchy, deals, credit exposure, KYC |

### Exports + signatures

```ts
export const dynamic = "force-dynamic";

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element>

// Local presentational
function SectionReveal({ index, className, children })
function SectionCard({ eyebrow, icon, title, description, count, footer, children })
function SectionBlock({ eyebrow, icon, title, description, className, children })
function DefRow({ label, value })
function MetaItem({ icon, label, children })
function formatDate(d: Date | null | undefined): string
function shortId(id: string): string // first 8 chars uppercased
```

**Label maps:** `NATURE_LABEL`, `RISK_TONE`, `BRAND_LABEL`, `SOURCE_LABEL`.

### Imports

| Source | Symbols |
|--------|---------|
| `next/link`, `next/navigation` | `Link`, `notFound` |
| `@/lib/rbac` | `requireUser`, `canReadAllInScope` |
| `@/features/parties/queries` | `getPartyDetail`, `listAssignableStaff` |
| `../assign-party-form` | `AssignPartyForm` |
| `../party-icon` | `PartyAvatar` |
| `../relationship-graph` | `RelationshipGraph` |
| `../party-signals` | `BAND_LABEL`, `StrengthBar`, `deriveStrength`, `formatRelative` |
| Brand | `Card`, `Badge`, `Button`, marks, `Reveal`, `StatCard`, table suite, money, page-shell |

**Note:** `BAND_LABEL` and `StrengthBar` are imported but strength UI is only via `deriveStrength` for scoring context; StrengthBar not rendered on detail header (score computed, band not shown as meter on this page).

### Business purpose

Render the **relationship master record**: legal identity, multi-type badges, KYC state, ownership assignment (scoped), ownership graph, people on `party_contact`, parent/child edges, mandates via `deal_party`, group exposure cache, KYC completion/staleness/risk.

### Key logic

1. `requireUser()` → `getPartyDetail(id, user)` → `notFound()` if null.
2. Staff list loaded **only if** `canReadAllInScope(user)` → ownership card with `AssignPartyForm`.
3. Counts: contacts, relationships, deals, lead deals, parent vs child edges.
4. Credit presence gate: group exposure / listed / exchange / ticker / CRISIL sector.
5. `deriveStrength` from relationship/deal/contact/KYC for consistency with explorer (used for last-touch display path).
6. Sections: meta rail → StatCards → RelationshipGraph full → identifiers DL → contacts + relationships tables → deals table → credit + KYC cards.
7. Deal name links go to **`/deals` not `/deals/[id]`** (list only).

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Auth | `requireUser` |
| DB reads | `getPartyDetail`, optional `listAssignableStaff` |
| Mutations | Via child form `assignParty` only when staff card shown |

### Security / RBAC

| Layer | Behavior |
|-------|----------|
| Auth | Required |
| Row access | `getPartyDetail(id, user)` — scope/visibility in feature |
| Assign UI | Gated by `canReadAllInScope` (not a fine-grained `party:assign` can-check in page) |
| Action recheck | `assignParty` server action must re-authorize (feature layer) |

### Coupling

- Heavy brand composition + three sibling party modules (avatar, graph, signals).
- Feature query shape: `party`, `types[]`, `contacts[]`, `relationships[]`, `deals[]`.
- KYC copy references trigger-maintained `kyc_record` + BO edges.

### Risks / TODOs

1. **Deal links incomplete** — `href="/deals"` loses deep link to mandate.
2. **`BAND_LABEL` / possibly StrengthBar unused** — dead imports / incomplete strength header vs explorer.
3. **Assign visible only for `canReadAllInScope`** — desk-scoped users never see ownership UI even if they own the party.
4. **No edit party master fields** on this page (read-only identity).
5. **`PageHeader` description** omits strength band despite computing `strength`.
6. Large RSC (~858 LOC) with many local primitives — hard to unit-test without extracting.

---

## 3. `src/app/parties/assign-party-form.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/parties/assign-party-form.tsx` |
| **Lines** | 67 |
| **Directive** | `"use client"` |
| **Role** | Ownership reassignment form for a single party |

### Exports + signatures

```ts
export interface StaffOption {
  userId: string;
  email: string;
  label: string;
  desk: string | null;
}

export function AssignPartyForm({
  partyId,
  currentAssigneeId,
  staff,
}: {
  partyId: string;
  currentAssigneeId: string | null;
  staff: StaffOption[];
}): JSX.Element
```

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React`, `useActionState` |
| `@/features/parties/actions` | `assignParty`, `PartyActionState` |
| `@/components/brand` | `Button` |

### Business purpose

Let privileged staff set `assigneeUserId` (or Unassigned) on a party; success copy states a **follow-up task is created for the assignee**.

### Key logic

1. `useActionState(assignParty, undefined)`.
2. Hidden `partyId`; native `<select name="assigneeUserId">` defaulted to current.
3. Options: empty = Unassigned; else `email (desk)`.
4. Pending disables submit; shows error (`role="alert"`) or success (`role="status"`).

### Side effects

- Server action `assignParty` (mutation + likely revalidate + task insert).
- No local router navigation.

### Security / RBAC

- UI trust only; real gate in action + page visibility (`canReadAllInScope`).
- Staff list provided by server — client cannot invent staff without spoofing action.

### Coupling

- Tight to `assignParty` FormData contract (`partyId`, `assigneeUserId`).
- Parent supplies `StaffOption[]` from `listAssignableStaff`.

### Risks / TODOs

1. **`label` on StaffOption unused** — UI shows email only.
2. **No optimistic UI** — success message stays until remount; may desync with other panels.
3. **Empty staff array** — form still usable with only Unassigned if parent renders card (parent currently hides when empty).

---

## 4. `src/app/parties/loading.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/parties/loading.tsx` |
| **Lines** | 71 |
| **Directive** | None (RSC) |
| **Role** | Route-level Suspense fallback for `/parties` |

### Exports

```ts
export default function PartiesLoading(): JSX.Element
```

### Imports

`Skeleton`, `SkeletonCard`, `SkeletonPage` from brand skeleton; `cn` from utils.

### Business purpose

Mirror **list + preview explorer**: 8 skeleton list rows + desktop-only right preview skeleton so navigation doesn’t flash blank while `listParties` + `getPartyPreview` hit Neon.

### Key logic

`SkeletonPage` eyebrow `"Relationship master"`, title `"Parties"`, `cards={0}`; grid `lg:grid-cols-[1fr_340-400px]`.

### Side effects / Security

None. Presentational only.

### Coupling

- Layout must stay aligned with `PartiesExplorer` two-pane design.
- Brand skeleton language shared app-wide.

### Risks / TODOs

1. Detail route `/parties/[id]` may fall through to this or root loader depending on segment structure — skeleton is list-shaped, not detail-shaped.
2. Preview column `hidden lg:block` matches desktop explorer only.

---

## Cross-file summary (batch 041)

```
/ (HomePage) ──getDashboardData──► KPI + pipeline + activity
/parties/[id] ──getPartyDetail──► 360 detail
                 ├── canReadAllInScope? AssignPartyForm ──assignParty──► mutation
                 ├── RelationshipGraph / PartyAvatar / party-signals
                 └── contacts / relationships / deals / credit / KYC
/parties loading ── skeleton for list explorer (sibling route)
```

### Highest-priority risks

1. Party deal deep-links incomplete.
2. Assign UI only for full-scope readers.
3. Home dashboard stage enum drift vs deals.
4. Dead/unused strength imports on detail.

### Tables / entities (via features)

`party`, `party_type`, `party_contact`, `relationship`, `deal`/`deal_party`, KYC fields on party, `app_user` (staff), dashboard aggregates over deals/interactions/credit/kyc.

---

*End of agent-041 analysis.*
