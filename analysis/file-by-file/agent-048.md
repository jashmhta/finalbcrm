# Agent 048 — File-by-file analysis

**Batch:** `batch-048.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Portfolio layout, limits page, loading, overview page.

---

## 1. `src/app/portfolio/layout.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 31 |
| **Route segment** | `/portfolio/*` layout |
| **Directive** | RSC `force-dynamic` |

### Exports + signatures

```ts
export const dynamic = "force-dynamic";

export default async function PortfolioLayout({
  children,
}: { children: ReactNode })
```

### Key logic

```ts
await requireUser();
return (
  <PageShell>
    <PageHeader title="Portfolio" description="Exposure by sector, issuer, rating, and tenor — ..." />
    <PortfolioSubNav />
    <div className="mt-6">{children}</div>
  </PageShell>
);
```

### Business purpose

Shared chrome + auth for all portfolio sub-routes; children own KPIs/charts.

### Side effects

Auth on every portfolio navigation.

### Security / RBAC

Authenticated only; no portfolio-specific permission beyond requireUser.

### Risks / TODOs

1. **Double PageShell/header** if child pages also render PageShell + PageHeader — **overview page does** (`portfolio/page.tsx`), causing nested shells / duplicate titles.
2. Auth twice when child also calls requireUser (cheap but redundant).
3. Sub-nav client boundary inside server layout — intentional.

---

## 2. `src/app/portfolio/limits/page.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 84 |
| **Route** | `/portfolio/limits` |
| **Directive** | RSC `force-dynamic` |

### Exports + signatures

```ts
export default async function LimitsPage({
  searchParams,
}: {
  searchParams: Promise<{ limitType?: string; status?: string; q?: string }>;
})
```

### Key logic

1. `requireUser`.
2. Parse filters; status allowlist breach|stale|ok.
3. `getLimits({ limitType, status, q }, user)`.
4. `canEdit = can(user, "approve", "credit_limit")`.
5. KPI StatCards: approved / utilized / headroom / breaches with `compactCr` display.
6. `LimitsView` with canEdit.

**No PageShell** — correct under layout.

### Side effects

Auth + limits query.

### Security / RBAC

Explicit `can(..., "approve", "credit_limit")` for edit affordance; view open to any authenticated portfolio user (query-scoped).

### Risks

1. View permission not separated from edit (any user seeing portfolio sees limits).
2. Search/status filters depend on getLimits implementation fidelity.

---

## 3. `src/app/portfolio/loading.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 10 |
| **Exports** | `PortfolioLoading` → `<SkeletonPage />` |
| **Role** | Generic skeleton for portfolio segment |

### Risks

Generic  skeleton may not match limits/concentration layouts (layout shift).

---

## 4. `src/app/portfolio/page.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 99 |
| **Route** | `/portfolio` |
| **Directive** | RSC `force-dynamic` |

### Key logic

```ts
const user = await requireUser();
const [overview, bySector, byIssuer(10), byRating, byTenor, limits, alerts] =
  await Promise.all([...]);
// KPI: gross, net, obligors, limit breaches
// wraps OverviewView
```

**Problem:** Also renders own `<PageShell><PageHeader title="Portfolio" .../></PageShell>` while layout already does — **double chrome**.

### Side effects

7 parallel portfolio aggregates.

### Security / RBAC

User-scoped queries.

### Risks / TODOs

1. **Critical UX:** nested PageShell + duplicate titles under layout.
2. Unused imports possible (`ChartCard`, `SectionHeading`).
3. Heavy first load — all aggregates always run (no lazy sections).

---

## Cross-file summary (batch 048)

```
portfolio/layout (auth + shell + subnav)
  ├── page (overview) ⚠️ re-shells
  ├── concentration (batch 046)
  ├── risk-metrics (batch 049)
  └── limits (KPIs + LimitsView)
```

### Highest-priority risks

1. Overview double PageShell/header.
2. Portfolio auth is all-or-nothing for firm risk data.
3. Generic loading skeleton.

---

*End of agent-048 analysis.*
