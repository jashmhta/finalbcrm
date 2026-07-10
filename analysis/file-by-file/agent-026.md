# Agent 026 — File-by-file analysis

**Batch:** `batch-026.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope note:** Paths are relative to app root. Docs ignored per instructions. Related modules (`@/features/deals/queries`, `@/features/documents/queries`, `@/lib/rbac`, sibling `deal-type-icon.tsx`) consulted only for types, coupling, and RBAC context.

---

## 1. `src/app/deals/deals-board-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/deals/deals-board-view.tsx` |
| **Lines** | 2268 |
| **Role** | Client-side “Pipeline Explorer” UI for IB/DCM mandates: kanban board (stage or deal-type swimlanes) + sticky inspector pane, alternate dense blotter (list) view, KPI strip, command bar (search/filters/export), progressive “Load more” per column |
| **Module kind** | `"use client"` React component module |

### Exports

```ts
export interface DealsBoardViewProps {
  groups: DealPipelineGroup[];
  /** Full non-deleted deal count (the "Showing X of Y" denominator). */
  total?: number;
  initialSearch?: string;
}

export function DealsBoardView({
  groups,
  total,
  initialSearch,
}: DealsBoardViewProps): JSX.Element
```

All other symbols are file-private helpers/components (not exported).

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React` |
| `next/link` | `Link` |
| `framer-motion` | `motion`, `type Variants` |
| `@phosphor-icons/react` | `ArrowsOutCardinal`, `ArrowUpRight`, `Buildings`, `CalendarBlank`, `CaretRight`, `Clock`, `DotsThree`, `FolderOpen`, `Handshake`, `List as ListIcon`, `Pause`, `ProhibitInset`, `Sparkle`, `SquaresFour`, `Star`, `Tag`, `Target` |
| `@/lib/utils` | `cn` |
| `@/features/deals/queries` | `type DealPipelineGroup`, `type DealPipelineRow` |
| `@/components/brand` | `Badge`, `Card`, `CommandBar`, `EmptyState`, `Num`, `PreviewPane`, `StatCard`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `TableEmpty`, `compactINR`, `formatMoney`, `type Density` |
| `@/components/brand/text` | `Eyebrow` |
| `@/features/reports/export-button` | `ExportCsvButton` |
| `./deal-type-icon` | `DealTypeGlyph`, `PartyRoleGlyph`, `creditBand` |

**Upstream type shapes (quoted from `@/features/deals/queries`):**

```ts
export interface DealPipelineRow {
  dealId: string;
  dealCode: string | null;
  dealName: string | null;
  dealType: string;
  status: string | null;
  brand: string;
  targetSize: string | null;
  currencyCode: string | null;
  targetCloseDate: string | null;
  targetTenorYears: string | null;
  leadUserId: string | null;
  creditAnalystUserId: string | null;
  parties: {
    partyId: string;
    legalName: string;
    role: string;
    isLead: boolean | null;
  }[];
}

export interface DealPipelineGroup {
  status: string;
  deals: DealPipelineRow[];
}
```

### Business purpose

Primary UX surface for the firm’s **deal/mandate pipeline**:

1. Show all in-scope mandates staged from **lead → mandated → diligence → structuring → rating & marketing → pricing → allocation → settled → closed**, plus off-pipeline **dropped / on_hold**.
2. Let bankers **explore** the book as a two-pane inspector (board + preview) rather than only a table; switch to a dense **blotter** when preferred.
3. Re-group by **deal type** (desk/instrument swimlanes: bond UW, HY, PP debt, G-Sec, structured/SCF/project, ECM suite, advisory/M&A/valuation, portfolio/secondary).
4. Surface **target book size (INR)**, stage counts, credit-band chips (derived from deal type, not agency rating), linked parties, brand (Binary Capital / Binary Bonds / Shared).
5. Support **client-side search** over code/name/type/brand/parties and **stage filter** without a full navigation round-trip (server filters arrive via `page.tsx` URL params into `groups` + `initialSearch`).

Comment in file asserts the pane *is* the detail view (“no `/deals/[id]` route”); the repo **does** contain `src/app/deals/[id]/page.tsx` (batch-025) — this file still does not link to it; selection only drives the local inspector.

### Key logic

#### Local types & constants

```ts
type ViewMode = "board" | "list";
type Swimlane = "stage" | "type";
type StageTone = "neutral" | "emerald" | "gold" | "down" | "info";

const VISIBLE_INCREMENT = 8;

const PIPELINE_ORDER = [
  "lead", "mandated", "in_dd", "structuring", "rating_marketing",
  "pricing", "allocation", "settled", "closed",
] as const;

const OFF_PIPELINE = new Set(["dropped", "on_hold"]);
const OFF_PIPELINE_KEYS = ["dropped", "on_hold"] as const;

const TYPE_ORDER = [
  "bond_underwriting", "high_yield_bond", "private_placement_debt",
  "gsec_auction", "structured_finance", "supply_chain_finance",
  "project_finance", "ecm_ipo", "ecm_fpo", "ecm_qip", "ecm_rights",
  "dcm_advisory", "rating_advisory", "m_and_a", "valuation",
  "fairness_opinion", "portfolio_management_mandate",
  "secondary_trading_advisory",
] as const;
```

Label maps: `STATUS_LABELS`, `STATUS_SHORT`, `TYPE_LABELS`, `TYPE_SHORT`, `BRAND_LABELS` (`binarycapital` → “Binary Capital”, `binarybonds` → “Binary Bonds”, `shared` → “Shared”).

#### Pure helpers (signatures)

```ts
function stageLabel(status: string): string
function stageShort(status: string): string
function typeLabel(t: string): string
function typeShort(t: string): string
function brandLabel(b: string): string
function pipelineIndex(status: string): number
function stageTone(status: string): StageTone
// closed|settled → emerald; on_hold → gold; dropped → down; lead → info; else neutral

function dealSizeText(
  value: string | null,
  currency: string | null,
): { text: string; currency: string | null }
// INR/null currency → compactINR; else formatMoney compact; non-finite → raw

function formatCloseDate(iso: string | null): string | null
// yyyy-mm-dd → en-IN "15 Aug 2026"

function formatTenor(years: string | null): string | null
// → "5y" / "5.5y"

function orderedGroups(groups: DealPipelineGroup[]): DealPipelineGroup[]
function flattenDeals(groups: DealPipelineGroup[]): DealPipelineRow[]
function defaultDealId(groups: DealPipelineGroup[]): string | null
function countsByStatus(groups: DealPipelineGroup[]): Map<string, number>

interface BoardColumn {
  key: string;
  kind: Swimlane;
  deals: DealPipelineRow[];
}

function buildColumns(
  deals: DealPipelineRow[],
  swimlane: Swimlane,
  hasQuery: boolean,
): BoardColumn[]
// type: only types with deals, TYPE_ORDER; stage+query: only present stages;
// stage+no query: full PIPELINE_ORDER (empty columns kept) + off-pipeline if populated

function sumSizesByCurrency(
  deals: DealPipelineRow[],
): { currency: string | null; text: string }[]
// sums targetSize by currencyCode (default INR); INR first
```

#### Framer-motion variants

```ts
const EASE = [0.32, 0.72, 0, 1] as const;
const cardListVariants: Variants  // staggerChildren 0.035
const cardItemVariants: Variants  // opacity/y mount
const mountFade: Variants         // opacity/y mount
```

Explicit design rule: **no `whileInView` opacity-0 gates** on primary content so headless captures see full UI.

#### `DealsBoardView` state & derived data

| State | Type | Default |
|-------|------|---------|
| `density` | `Density` | `"comfortable"` |
| `view` | `ViewMode` | `"board"` |
| `swimlane` | `Swimlane` | `"stage"` |
| `stageFilter` | `string` | `"all"` |
| `search` | `string` | `initialSearch ?? ""` |
| `selectedDealId` | `string \| null` | `defaultDealId(groups)` |
| `visiblePerColumn` | `Record<string, number>` | `{}` (missing → `VISIBLE_INCREMENT` = 8) |

Derived:

- `allDeals` / `totalDeals` from flattened groups  
- `grandTotal = total ?? allDeals.length`  
- `leadCount` from group with `status === "lead"`  
- `furthestActiveIndex` — max pipeline index among non-empty on-pipeline stages  
- `bookSize` — sum of `targetSize` where currency is INR (or null treated as INR)  
- `stageFilteredDeals` then `filteredDeals` (case-insensitive substring over code/name/type labels/brand/status labels/party legal names)  
- `hasQuery = search.trim() || stageFilter !== "all"`  
- `columns = buildColumns(filteredDeals, swimlane, hasQuery)`  
- `selectedDeal` resolved from **full** `allDeals` (inspector survives filter narrowing)

Effects:

- On `selectedDealId` change, if viewport `< xl` (`min-width: 1280px` not matched), `paneRef.scrollIntoView({ behavior: "smooth", block: "start" })`.

#### UI composition tree

1. **KPI strip** (`StatCard` ×4): Mandates, Active stages, In lead stage, Book (target)  
2. **`PipelineLadder`** — horizontal stage pills + connector fill up to furthest active stage  
3. **`CommandBar`** — search, density, stage select (md+), swimlane toggle (board only), `ExportCsvButton type="deals"`, board/list toggle  
4. **`StageFilterPills`** — mobile-only (`md:hidden`) horizontal stage filmstrip with counts  
5. “Showing X of Y” when `grandTotal > totalDeals`  
6. Empty state **or** board+preview **or** blotter  

#### Board path

- `Board` → per-column `Column` → `ColumnHeader` + `DealCard` list + `ColumnLoadMore`  
- `DealCard` = `React.memo(DealCardImpl)` — selection, keyboard Enter/Space, gold left accent, stage bar, party avatar links (`stopPropagation`), brand label  
- Sticky `DealPreviewPane` (`PreviewPane`): exposure, full `StageLadder`, linked parties, deal type + credit band  

#### Blotter path

- `Blotter` groups by stage; `StageBlotterGroup` table with memoized `BlotterRow`  
- Columns: Deal, Type (+ band badge), Brand (hidden md on empty shell only partially), Target, Parties  
- Same per-group load-more cadence  

#### Subcomponents (private)

| Component | Role |
|-----------|------|
| `PipelineLadder` | Stage progression rail |
| `Board` / `Column` / `ColumnHeader` / `ColumnEmpty` / `ColumnLoadMore` | Kanban |
| `StagePill` / `StageMicroIndicator` / `OffPipelineGlyph` | Stage chrome |
| `DealCard` / `PartyAvatarLink` / `DealStageBar` | Card object |
| `DealPreviewPane` / `StageLadder` | Inspector |
| `Blotter` / `StageBlotterGroup` / `BlotterRow` | List view |
| `ViewToggle` / `SwimlaneToggle` | Segmented controls |
| `StageFilterSelect` / `StageFilterPills` | Stage filter (desktop select vs mobile pills) |

#### Performance tactics

- Server already caps per stage (page passes `perStage: 20`).  
- Client first paints **8** cards/rows per column (`VISIBLE_INCREMENT`), then +8 on “Load more”.  
- `React.memo` on `DealCard` and `BlotterRow`; stable `onSelect` via `useCallback`.  
- Motion limited to transform/opacity; stage fill uses `scaleX`.

### Side effects

- **Client-only UI state** — no server mutations, no direct DB access.  
- **Navigation:** `Link` to `/parties/{partyId}` from avatars and inspector; export button triggers report export client flow (`ExportCsvButton type="deals"`).  
- **DOM:** smooth scroll of inspector on mobile selection.  
- **No URL write** for client search/stage filter — client filters are ephemeral; initial `q` from server only seeds search state.  
- `onSelect` prop on `DealPreviewPane` is accepted but **unused** inside the pane (dead parameter).

### Security / RBAC

- **None in this file.** Visibility/scoping is entirely upstream: `page.tsx` calls `requireUser()` and `getDealPipeline({ user, filters, perStage })`, which applies deal RBAC (lead / credit analyst / admin / `read_all` deal, etc.).  
- Client search cannot expand the loaded set — only filters props already in memory. Users cannot “search past” the server-side per-stage cap without server-side `q`/filters via URL (page does pass URL filters into the query).  
- Party links expose `partyId`/`legalName` already returned by the pipeline query.  
- Export CSV uses the separate export feature path (auth/export ACL not implemented here).  
- No MNPI/document handling.

### Coupling

| Direction | Target |
|-----------|--------|
| **Consumed by** | `src/app/deals/page.tsx` |
| **Types** | `@/features/deals/queries` (`DealPipelineGroup`, `DealPipelineRow`) |
| **Glyphs / credit band** | `./deal-type-icon` (`creditBand(dealType)`, `DealTypeGlyph`, `PartyRoleGlyph`) |
| **Design system** | `@/components/brand/*` (CommandBar, PreviewPane, StatCard, Table, money helpers) |
| **Export** | `@/features/reports/export-button` |
| **Domain stage catalog** | Hard-codes its own `PIPELINE_ORDER` / `TYPE_ORDER` strings rather than importing `@/features/deals/stages` / `catalog` — **duplication risk** vs canonical stage flows |
| **Routes** | `/parties/[id]`; does not link to `/deals/[id]` |

### Risks / TODOs

1. **Stale comment / product inconsistency:** header says there is no `/deals/[id]` route and the pane is the only detail view, but `src/app/deals/[id]/page.tsx` exists. Users cannot open deep-link detail from the board.  
2. **Duplicate stage/type taxonomies:** local `PIPELINE_ORDER` / `TYPE_ORDER` / labels may drift from `@/features/deals/stages` and `@/features/deals/catalog` / DB enums.  
3. **Pagination comment drift:** comments alternate “query caps at 40”, “20”, “Load more from 20”; page uses `perStage: 20`; `DEFAULT_PER_STAGE` in queries is 40; client initial visible is **8**.  
4. **`bookSize` KPI** ignores non-INR currencies entirely (only sums INR / null-as-INR).  
5. **Client search** after server load cannot find deals outside the per-stage cap unless URL `q` reloads the page with server filter.  
6. **`DealPreviewPane` `onSelect` unused** — dead API.  
7. **Unused phosphor import:** `ArrowUpRight` imported but not used in the file body (lint noise).  
8. **Selection not cleared** when selected deal is filtered out of board view — inspector intentionally keeps showing it from `allDeals` (by design; can confuse users who filtered it away).  
9. **Large client bundle:** 2.2k+ LOC client component with framer-motion + phosphor — first-load cost for `/deals`.  
10. **No optimistic updates / realtime** — static props until navigation refresh.

---

## 2. `src/app/deals/loading.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/deals/loading.tsx` |
| **Lines** | 36 |
| **Role** | Next.js App Router **route-level loading UI** for `/deals` — Suspense fallback skeleton mirroring the pipeline board layout |
| **Module kind** | Server-compatible React component (no `"use client"`) |

### Exports

```ts
export default function DealsLoading(): JSX.Element
```

### Imports

```ts
import {
  SkeletonBoard,
  SkeletonCard,
  SkeletonPage,
} from "@/components/brand/skeleton";
```

### Business purpose

Provide an **instant, layout-faithful skeleton** while the force-dynamic deals page runs `requireUser()` + `getDealPipeline()` against Postgres/Neon. Avoids a generic spinner so navigation to Deals feels like “the board is arriving.”

### Key logic

```tsx
export default function DealsLoading() {
  return (
    <SkeletonPage eyebrow="Deals" title="Deal pipeline" cards={0}>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
      <div className="overflow-x-auto pb-4">
        <SkeletonBoard
          columns={5}
          cardsPerColumn={4}
          className="min-w-[900px]"
        />
      </div>
    </SkeletonPage>
  );
}
```

- **4** stat-card skeletons (matches KPI strip).  
- **5** board columns × **4** card skeletons; horizontal overflow on narrow viewports (`min-w-[900px]`).  
- `SkeletonPage` `cards={0}` — no extra generic card grid under the title.

### Side effects

- None. Pure presentational; no data fetch, no auth, no cookies.

### Security / RBAC

- N/A. Loading UI is shown only for users who can navigate into the route segment; actual authorization runs in `page.tsx`.  
- Does not leak deal data (placeholders only).

### Coupling

| Direction | Target |
|-----------|--------|
| **Framework** | Next.js `loading.tsx` convention for `src/app/deals/*` segment |
| **UI** | `@/components/brand/skeleton` (`SkeletonPage`, `SkeletonCard`, `SkeletonBoard`) |
| **Visual twin of** | Live layout in `deals-board-view.tsx` (4 KPIs + multi-column board) — skeleton only approximates (5 columns vs 9 pipeline stages) |

### Risks / TODOs

1. Skeleton shows **5** columns while real stage mode can show **9** pipeline stages (+ off-pipeline) — mild layout jump on hydrate.  
2. No blotter/list skeleton variant if user preference were sticky (preference is client-only, so always board skeleton — acceptable).  
3. No command-bar / ladder skeleton — real page has ladder + CommandBar below KPIs.

---

## 3. `src/app/deals/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/deals/page.tsx` |
| **Lines** | 76 |
| **Role** | Server Component **route entry** for `/deals` — auth, URL filter parsing, pipeline data load, shell composition |
| **Module kind** | Next.js App Router page (async Server Component) |

### Exports

```ts
export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    status?: string;
    brand?: string;
    leadUserId?: string;
    creditAnalystUserId?: string;
    partyId?: string;
    turnover?: string;
    sector?: string;
    rating?: string;
    agency?: string;
    investorType?: string;
    portfolioSize?: string;
    riskAppetite?: string;
    highYield?: string;
  }>;
}): Promise<JSX.Element>
```

### Imports

```ts
import { PageHeader, PageShell } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import { getDealPipeline, type DealPipelineFilters } from "@/features/deals/queries";
import { DealsBoardView } from "./deals-board-view";
```

**Related signatures (queries / rbac):**

```ts
// @/lib/rbac
export async function requireUser(): Promise<CrmUser>
// redirects to /login if unauthenticated

// @/features/deals/queries
export interface DealPipelineFilters {
  q?: string;
  type?: string;
  status?: string;
  brand?: string;
  leadUserId?: string;
  creditAnalystUserId?: string;
  partyId?: string;
  turnover?: string;
  sector?: string;
  rating?: string;
  agency?: string;
  investorType?: string;
  portfolioSize?: string;
  riskAppetite?: string;
  highYield?: boolean;
}

export interface DealPipelineResult {
  groups: DealPipelineGroup[];
  total: number;
}

// used as:
await getDealPipeline({ perStage: 20, filters, user })
```

### Business purpose

Gate and feed the deal pipeline explorer:

1. Ensure only authenticated CRM users reach the page.  
2. Map rich **query-string segmentation filters** (party attributes, rating, investor profile, high-yield flag, ownership, deal type/status/brand) into `DealPipelineFilters`.  
3. Load a **per-stage-capped** pipeline (`perStage: 20`) plus uncapped `total` for “Showing X of Y”.  
4. Render brand page chrome + client board.

### Key logic

```ts
export const dynamic = "force-dynamic"; // never prerender; live Postgres

const user = await requireUser();
const sp = await searchParams;

const filters: DealPipelineFilters = {
  q: sp.q?.trim() || undefined,
  type: sp.type || undefined,
  status: sp.status || undefined,
  brand: sp.brand || undefined,
  leadUserId: sp.leadUserId || undefined,
  creditAnalystUserId: sp.creditAnalystUserId || undefined,
  partyId: sp.partyId || undefined,
  turnover: sp.turnover || undefined,
  sector: sp.sector || undefined,
  rating: sp.rating || undefined,
  agency: sp.agency || undefined,
  investorType: sp.investorType || undefined,
  portfolioSize: sp.portfolioSize || undefined,
  riskAppetite: sp.riskAppetite || undefined,
  highYield:
    sp.highYield === "1" ? true : sp.highYield === "0" ? false : undefined,
};

const { groups, total } = await getDealPipeline({
  perStage: 20,
  filters,
  user,
});

return (
  <PageShell>
    <PageHeader
      title="Deals"
      description="Mandate pipeline across IB and DCM."
    />
    <DealsBoardView
      groups={groups}
      total={total}
      initialSearch={filters.q}
    />
  </PageShell>
);
```

**Pagination rationale (in-file comments):** 9 pipeline + 2 off-pipeline × 20 ≈ worst-case ~220 rows; client further shows 8/column first. Caps HTML payload vs shipping full book (~1,500 deals historically ~141KB).

**Note:** URL filters for type/status/brand/party segmentation are applied **server-side** in `getDealPipeline`. The board’s client `stageFilter` and search are **additional** client-side filters on the already-loaded slice; only `q` is dual-pathed (`filters.q` → query + `initialSearch`).

### Side effects

- **Auth redirect** via `requireUser()` → `/login` if anonymous.  
- **DB read** via `getDealPipeline` (Neon/Postgres, RLS/app scoping as implemented in feature queries).  
- **No writes.**  
- Forces dynamic rendering (`force-dynamic`) — every request hits server + DB.

### Security / RBAC

| Control | Behavior |
|---------|----------|
| Authentication | `requireUser()` mandatory |
| Authorization | Passed `user` into `getDealPipeline`; query applies deal visibility (`canReadAllDeals` / lead / credit analyst scoping — see queries) |
| Soft-delete | Query filters `deleted_at IS NULL` (in feature layer) |
| Filter injection | Filters are plain string equality/search params; parameterized in Drizzle/SQL layer (not string-concatenated here) |
| Sensitive data | Target sizes, party names, deal codes returned to any authorized pipeline reader |

No additional permission check beyond “logged-in user who passes pipeline visibility.”

### Coupling

| Direction | Target |
|-----------|--------|
| **UI** | `./deals-board-view`, `@/components/brand/page-shell` |
| **Auth** | `@/lib/rbac` (`requireUser`, `CrmUser`) |
| **Data** | `@/features/deals/queries` (`getDealPipeline`, `DealPipelineFilters`) |
| **Sibling routes** | `loading.tsx` Suspense fallback; potential `deals/[id]` detail not wired from this page |
| **URL contract** | Many searchParams keys must stay aligned with `DealPipelineFilters` / query builder |

### Risks / TODOs

1. **URL filter UX gap:** board command bar does not surface/control most server filters (`sector`, `rating`, `leadUserId`, `highYield`, etc.) — only `q` is reflected as `initialSearch`. Deep links work; interactive UI for full filter set may live elsewhere or be incomplete.  
2. **Dual filter layers:** client stage filter vs server `status` param can diverge (server may already restrict status; client can re-filter further).  
3. **`perStage: 20` vs feature default 40** — intentional override; comments in board/query still mention 40 in places.  
4. **No error boundary** in this file — query failures bubble to nearest error.tsx.  
5. **No metadata export** (`generateMetadata`) — title/SEO not customized beyond layout defaults.  
6. Server passes only `filters.q` into `initialSearch`; other URL filters are invisible in client UI chrome.

---

## 4. `src/app/documents/[id]/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/documents/[id]/page.tsx` |
| **Lines** | 299 |
| **Role** | Server Component **document detail** page — metadata, sensitivity badges, file facts, linked entities, access-control summary |
| **Module kind** | Next.js dynamic route page (async Server Component) |

### Exports

```ts
export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element>
```

Private helpers:

```ts
function formatSize(bytes: number | null): string
function FactRow({ label, icon?, children }: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element
function LinkRow({ icon, label, children }: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}): JSX.Element
```

### Imports

```ts
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, FileText, SealWarning, LockSimple, Eye,
  Hash, CalendarBlank, Buildings, ArrowsLeftRight, User, Clock,
} from "@/components/brand/icons";

import { requireUser } from "@/lib/rbac";
import { getDocumentDetail } from "@/features/documents/queries";
import { Card, Badge, Button, Reveal } from "@/components/brand";
import { Eyebrow, SectionHeading } from "@/components/brand/text";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";
```

**Note:** `PageHeader` and `DetailTopBar` are **imported but unused**. `React.ReactNode` is referenced without an explicit `import React` / `import type { ReactNode }` (relies on ambient React namespace if configured).

**Related types / API (quoted from `@/features/documents/queries`):**

```ts
export interface DocumentDetail {
  document: typeof document.$inferSelect; // Drizzle document row
  dealCode: string | null;
  dealName: string | null;
  partyName: string | null;
  contactName: string | null;
  uploadedByEmail: string | null;
}

export async function getDocumentDetail(
  documentId: string,
  user?: CrmUser | null,
): Promise<DocumentDetail | null>
// joins deal, party, contact, appUser; filters deletedAt IS NULL + documentVisibilityClause(user)
```

Document fields consumed from `row.document` (`d`):

| Field | Usage |
|-------|--------|
| `documentId` | Breadcrumb short id (`slice(0, 8)`) |
| `documentType` | Eyebrow (underscores → spaces) |
| `fileName` | Title (fallback `"(unnamed)"`) |
| `kycCategory` | Description under title |
| `isMnpi` | MNPI badge + policy blurb |
| `isConfidential` | Confidential badge |
| `barrierId` | Walled-garden badge + access section |
| `mimeType` | File fact |
| `sizeBytes` | `formatSize` |
| `fileStoreRef` | Object-store key (code block) |
| `sha256` | Integrity hash (optional) |
| `retentionUntil` | Retention date string |
| `partyId` | Link to `/parties/{id}` |
| `createdAt` | Uploaded-at `toLocaleString("en-IN")` |

### Business purpose

Read-only **document dossier** for compliance/ops:

1. Identify the file (type, name, KYC category).  
2. Surface **information-barrier / MNPI / confidential** markings so bankers treat the object correctly.  
3. Show file technical facts (MIME, size, store key, SHA-256, retention).  
4. Navigate to linked **party** (and show deal code/name, contact).  
5. Show uploader + timestamp + barrier id.  
6. For MNPI, display policy copy: download/copy/email-forward disabled; watermark forced on render (UI notice only — enforcement is not implemented in this page).

### Key logic

```ts
export const dynamic = "force-dynamic";

const user = await requireUser();
const { id } = await params;

const row = await getDocumentDetail(id, user);
if (!row) notFound();

const d = row.document;
```

**`formatSize`:** null/non-finite → `"-"`; else B / KB / MB / GB thresholds with 1–2 decimal places.

**UI sections:**

1. Breadcrumb `Documents / {documentId[0..8]}` + “All documents” button → `/documents`  
2. Header card: `SectionHeading` + sensitivity badges  
   - MNPI → `Badge variant="down"`  
   - Confidential → `Badge variant="neutral"`  
   - Barrier → `Badge variant="outline"` “Walled · {barrierId[0..8]}”  
   - Else → emerald “No restrictions”  
3. File card: MIME, size, object-store key, optional SHA-256, retention until  
4. Two-column grid:  
   - **Linked to:** party (link), deal (link only to `/deals` not `/deals/{id}`), contact name  
   - **Access control:** uploaded by email, uploaded at, barrier short id, MNPI warning paragraph  

Helpers `FactRow` / `LinkRow` are pure layout primitives for label/value rows.

### Side effects

- **Auth redirect** (`requireUser`).  
- **DB read** (`getDocumentDetail`).  
- **`notFound()`** → Next.js 404 when missing or not visible.  
- **No download endpoint** invoked from this page — displays `fileStoreRef` text only; no blob fetch.  
- **No mutations.**  
- Renders object-store keys and hashes into HTML for authorized viewers.

### Security / RBAC

| Control | Behavior |
|---------|----------|
| Authentication | `requireUser()` |
| Authorization | `getDocumentDetail(id, user)` applies `documentVisibilityClause(user)` — uploader, related party ownership/assignment, related deal lead/credit/created, contact creator, or deal_party EXISTS (see queries); admins/`canReadAllDocuments` bypass |
| Soft-delete | `isNull(document.deletedAt)` |
| MNPI UX | Warning only; **does not** enforce download disable / watermark on this page (no download UI at all) |
| Information barrier | Displays `barrierId` truncated; does not evaluate barrier membership in the page itself |
| Data exposure | Authorized users see `fileStoreRef`, `sha256`, uploader email — potential sensitive path leakage if store keys are guessable/shared |
| IDOR | Mitigated only if query visibility clause is correct; page does not re-check roles beyond that |

### Coupling

| Direction | Target |
|-----------|--------|
| **Auth** | `@/lib/rbac` |
| **Data** | `@/features/documents/queries` (`getDocumentDetail`, `DocumentDetail`) |
| **Schema (indirect)** | `document`, `deal`, `party`, `contact`, `app_user` via query joins |
| **Routes** | `/documents` list; `/parties/{partyId}`; deal link → **`/deals` list only** (not deal detail) |
| **UI** | brand Card/Badge/Button/Reveal, PageShell, SectionHeading |
| **List siblings** | `src/app/documents/page.tsx`, `documents-list-view.tsx`, `new-document-dialog.tsx` (batch-027) |

### Risks / TODOs

1. **No actual file preview/download** — detail is metadata-only; `fileStoreRef` shown in cleartext may be sensitive.  
2. **MNPI policy is display-only** on this page; real enforcement must live in download/API routes (not present here).  
3. **Deal deep-link missing** — even when `document.dealId` exists (on `d` via select), UI links to `/deals` with `dealCode` only.  
4. **Contact is not a link** — name only; no `/contacts/...` navigation.  
5. **Unused imports:** `PageHeader`, `DetailTopBar`.  
6. **`React.ReactNode` without import** — may fail under certain `jsx`/`types` configs.  
7. **Retention / barrier** shown as raw strings/ids without human-readable barrier name or policy resolution.  
8. **No audit log** of “document viewed” on this page (if compliance requires view logging, it is absent).  
9. **Short UUID display** (`slice(0, 8)`) can collide visually for support; full id not shown prominently.  
10. **Force-dynamic** every load — no caching of static document metadata.

---

## Cross-file summary (batch-026)

| File | LOC | Kind | Auth | Data I/O |
|------|-----|------|------|----------|
| `src/app/deals/deals-board-view.tsx` | 2268 | Client pipeline explorer | Inherited props only | None (client filter/export button) |
| `src/app/deals/loading.tsx` | 36 | Route loading skeleton | N/A | None |
| `src/app/deals/page.tsx` | 76 | Server page | `requireUser` | `getDealPipeline` |
| `src/app/documents/[id]/page.tsx` | 299 | Server detail page | `requireUser` | `getDocumentDetail` |

**End-to-end deals path:**  
`loading.tsx` (skeleton) → `page.tsx` (auth + filters + `perStage: 20`) → `DealsBoardView` (board/blotter + inspector).

**Documents path:**  
`documents/[id]/page.tsx` alone in this batch (list UI is batch-027).

**Shared themes:** force-dynamic DB pages, brand design system, Phosphor/light iconography, RBAC deferred to feature queries, performance via pagination + memoization on deals, compliance markings surfaced but not fully enforced on the document detail surface.
