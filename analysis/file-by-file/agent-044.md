# Agent 044 — File-by-file analysis

**Batch:** `batch-044.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Client portal list/loading + investor detail charts and page.

---

## 1. `src/app/portal/client/loading.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/portal/client/loading.tsx` |
| **Lines** | 44 |
| **Role** | Suspense skeleton for `/portal/client` |
| **Exports** | `export default function ClientPortalLoading()` |
| **Imports** | `Skeleton`, `SkeletonCard`, `SkeletonPage` |

### Business purpose

Mirror directory: 4 KPI skeletons + 9 table-like rows while `listClients` runs.

### Side effects / Security

None.

### Risks

Detail subroute may inherit list-shaped skeleton (layout mismatch flash).

---

## 2. `src/app/portal/client/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/portal/client/page.tsx` |
| **Lines** | 43 |
| **Route** | `/portal/client` |
| **Directive** | RSC + `force-dynamic` |

### Exports + signatures

```ts
export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function ClientPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
})
```

### Imports

`requireUser`; `listClients`; `ClientDirectoryView`; `PageShell`, `PageHeader`, `DetailTopBar` (**DetailTopBar unused**).

### Key logic

```ts
const user = await requireUser();
const q = sp.q?.trim() || undefined;
const page = Math.max(1, Number(sp.page) || 1);
const { rows, total, page, pageSize, totalPages, summary } =
  await listClients({ q, page, pageSize: 25, user });
```

Header copy emphasizes read-only issuer book ranked by total raised.

### Side effects

Auth + list query.

### Security / RBAC

`listClients({ user })` scoping; no write surface.

### Risks

1. Unused `DetailTopBar`.
2. Page not clamped to totalPages.
3. No type/KYC filters (search only).

---

## 3. `src/app/portal/investor/[id]/investor-charts.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/portal/investor/[id]/investor-charts.tsx` |
| **Lines** | 143 |
| **Directive** | `"use client"` |
| **Role** | Client-only chart boundary for investor portfolio composition |

### Exports + signatures

```ts
export function InvestorComposition({
  bySector, byRating, byTenor,
}: {
  bySector: BreakdownPoint[];
  byRating: BreakdownPoint[];
  byTenor: BreakdownPoint[];
}): JSX.Element

export function InvestorTopIssuers({
  byIssuer,
}: { byIssuer: BreakdownPoint[] }): JSX.Element
```

### Imports

**Critical:** charts from `@/features/portal/portal-charts` (not barrel) to avoid pulling `postgres` into client. Types from `@/features/portal/queries`. `ChartCard`, `EmptyState`, `compactINR`.

### Business purpose

RSC cannot pass formatter functions to client charts — this module owns `cr = (n) => compactINR(n * 1e7)` and maps breakdown arrays into PortalDonut / VBar / HBar.

### Key logic

- Composition grid 3 charts: sector donut, rating VBar (gold), tenor VBar (emerald) with share hints.
- Top issuers HBar height scales with row count; empty EmptyState.

### Side effects

Lazy recharts via portal-charts wrappers.

### Security

Data already authorized on server; charts pure render.

### Risks

1. **Unit convention**: values assumed crore × 1e7 for INR compact — mismatch if query returns rupees.
2. Bundle size depends on portal-charts dynamic import discipline.
3. Buildings icon direct Phosphor import.

---

## 4. `src/app/portal/investor/[id]/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/portal/investor/[id]/page.tsx` |
| **Lines** | 703 |
| **Route** | `/portal/investor/[id]` |
| **Role** | Read-only buy-side portfolio detail |

### Exports + signatures

```ts
export const dynamic = "force-dynamic";

export default async function InvestorDetailPage({
  params,
}: { params: Promise<{ id: string }> })

// Local tables/helpers: MetaCell, HoldingsTable, AllocationHistoryTable,
// DematTable, KycSnapshot, KycField
// EVENT_TYPE_LABEL, eventTypeBadge, kycVariant, fmtDate, fmtDateTime, ...
```

### Business purpose

Investor portal 360: identity (PAN/LEI), portfolio KPIs, composition charts (if holdings), top issuers + demat, bond book table, allocation event trail, KYC snapshot. “Read-only” badge.

### Key logic

1. `getInvestorDetail(id, user)` or notFound.
2. Destructure holdings, allocationHistory, demat, kyc, breakdowns, summary.
3. `hasBook = holdings.length > 0` gates charts/book vs empty gold EmptyState.
4. Allocation event badges by type (allocated/settled emerald, withdrawn down, oversub gold).
5. Demat status badges: active / frozen|suspended / outline.

### Side effects

Auth + detail query only.

### Security / RBAC

- Read-only; demat IDs sensitive (DP/client IDs shown).
- MNPI not primary surface here (allocation amounts still sensitive commercial data).

### Coupling

Portal feature types; investor-charts client boundary; brand table/money.

### Risks / TODOs

1. **Unused** `PageHeader`/`DetailTopBar`/`fmtDateTime` possible dead imports.
2. Holdings/deals not deep-linked to deal detail.
3. Weighted avg yield StatCard uses `display` override when null.
4. Large page file — similar maintainability concern as client detail.

---

## Cross-file summary (batch 044)

```
/portal/client ──listClients──► ClientDirectoryView
/portal/client/[id] (batch 043)
/portal/investor/[id] ──getInvestorDetail──► tables + InvestorComposition/TopIssuers
```

### Highest-priority risks

1. Currency/crore unit consistency across portal.
2. Sensitive demat + allocation data exposure via RBAC only.
3. Dead imports on list page.

---

*End of agent-044 analysis.*
