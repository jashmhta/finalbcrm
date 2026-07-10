# Agent 046 — File-by-file analysis

**Batch:** `batch-046.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Portfolio charts wrapper, sub-nav, risk metrics view, concentration page.

---

## 1. `src/app/portfolio/_components/portfolio-charts.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 76 |
| **Directive** | `"use client"` |
| **Role** | Lazy recharts boundary for portfolio pages |

### Exports + signatures

```ts
export type { DonutPoint, LabelValuePoint, StackedPoint, GaugePoint } from "./portfolio-charts-impl";
export { SECTOR_PALETTE, EXPOSURE_TYPE_COLORS, EXPOSURE_TYPE_LABELS } from "./portfolio-charts-impl";

export const DonutChart = /* dynamic ssr:false */
export const HBarChart
export const StackedBarChart
export const VBarChart
export const RadialGauge
```

### Key logic

`next/dynamic` with `ssr: false` + `ChartSkeleton` pulse placeholders; all impls share one vendor chunk from `portfolio-charts-impl`.

### Business purpose

Keep recharts out of RSC first-load JS; allow server pages to import typed wrappers only.

### Side effects

Client-side chunk fetch after paint.

### Security

N/A.

### Risks

1. **Flash of skeleton** CLS mitigated by fixed heights.
2. Must not import impl from server components directly.
3. Constants re-exported from impl — ok, still pulled if constants used (small).

---

## 2. `src/app/portfolio/_components/portfolio-sub-nav.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 95 |
| **Directive** | `"use client"` |
| **Role** | Four-tab portfolio section nav |

### Exports

```ts
export function PortfolioSubNav(): JSX.Element
```

### NAV_ITEMS

| href | label | match |
|------|-------|-------|
| `/portfolio` | Overview | exact |
| `/portfolio/concentration` | Concentration | prefix |
| `/portfolio/risk-metrics` | Risk metrics | prefix |
| `/portfolio/limits` | Limits | prefix |

### Key logic

`usePathname`; active = gold pill + fill icon + gold dot; glass floating pill.

### Side effects

None (links).

### Coupling

Mounted from `portfolio/layout.tsx`.

### Risks

1. If nested routes added under overview, exact match only — fine today.
2. Phosphor in client only — correct.

---

## 3. `src/app/portfolio/_components/risk-metrics-view.tsx`

| Field | Value |
|--------|--------|
| **Lines** | ~220+ |
| **Directive** | `"use client"` |
| **Role** | Duration / DV01 / VaR presentation |

### Exports + signatures

```ts
export interface RiskMetricsViewProps { metrics: RiskMetrics }
export function RiskMetricsView({ metrics }: RiskMetricsViewProps)
```

### Imports

`VAR_ASSUMPTIONS` from `@/features/portfolio/risk`; `compactCr`, `compactINR`; VBarChart; brand StatCard/Table.

### Business purpose

Client KPIs need custom `format` functions (RSC cannot pass functions): modified duration yrs, convexity, DV01 ₹ L, 1d 99% VaR. DV01-by-tenor bar; assumptions card; top DV01 contributors table.

### Key logic

Filters tenor buckets with `dv01Lakh > 0`; assumptions list from `VAR_ASSUMPTIONS` + portfolio position count; top table uses brand Table.

### Side effects

Chart lazy load.

### Security

Model is simplified parametric — disclaimer in page copy; not a regulatory VaR engine.

### Risks

1. **Model risk** if used for compliance decisions without caveats.
2. `compactINR` imported — verify usage in table.
3. Depends on feature `RiskMetrics` shape stability.

---

## 4. `src/app/portfolio/concentration/page.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 72 |
| **Route** | `/portal` no — `/portfolio/concentration` |
| **Directive** | RSC `force-dynamic` |

### Exports

```ts
export const dynamic = "force-dynamic";
export default async function ConcentrationPage()
```

### Key logic

```ts
const user = await requireUser();
const [sectors, issuers, ratings, alerts] = await Promise.all([
  getSectorConcentration(user),
  getIssuerConcentration(25, user),
  getRatingConcentration(user),
  getConcentrationAlerts(user),
]);
// KPI: top1, CR3, HHI (tone by 1500/2500), sectoral breaches
// RBI caps from RBI_SINGLE_BORROWER_CAP_PCT / RBI_GROUP_CAP_PCT in copy
```

Renders inside layout shell (no own PageShell — layout provides).

### Side effects

Auth + 4 parallel aggregates.

### Security / RBAC

User-scoped portfolio queries.

### Risks

1. **Double chrome risk** if page also wrapped incorrectly (this page does not use PageShell — good for layout).
2. HHI thresholds 1500/2500 are US DOJ-style, may not match Indian desk policy.
3. Top issuer KPI vs RBI single borrower cap comparison in StatCard tone only.

---

## Cross-file summary (batch 046)

```
layout → PortfolioSubNav
concentration/page → KPIs + ConcentrationView (batch 045)
risk-metrics uses RiskMetricsView + portfolio-charts
```

### Highest-priority risks

1. Risk metrics simplified model overtrust.
2. Chart lazy-load pattern must stay consistent.

---

*End of agent-046 analysis.*
