# Agent 049 — File-by-file analysis

**Batch:** `batch-049.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Risk metrics page + reports credit table + report chart wrapper/impl.

---

## 1. `src/app/portfolio/risk-metrics/page.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 29 |
| **Route** | `/portfolio/risk-metrics` |
| **Directive** | RSC `force-dynamic` |

### Exports

```ts
export const dynamic = "force-dynamic";
export default async function RiskMetricsPage()
```

### Key logic

```ts
const user = await requireUser();
const metrics = await getRiskMetrics(user);
return (
  SectionHeading title="Duration, DV01 & VaR" + disclaimer
  RiskMetricsView metrics={metrics}
);
```

No PageShell (layout provides).

### Business purpose

Surface simplified portfolio rate risk for desk awareness; points users to full risk system for KRD/OAS/historical VaR.

### Side effects

Auth + risk aggregation.

### Security / RBAC

Authenticated portfolio access only.

### Risks

1. Disclaimer in UI only — no hard watermark on exports (none here).
2. Depends entirely on feature risk engine quality.

---

## 2. `src/app/reports/_components/credit-report-view.tsx`

| Field | Value |
|--------|--------|
| **Lines** | large client table (~300+) |
| **Directive** | `"use client"` |
| **Role** | Filterable credit report blotter |

### Exports + signatures

```ts
export interface CreditReportViewProps {
  rows: CreditReportRow[];
  total: number;
  issuerCount: number;
  watchlistCount: number;
  bandDistribution: { band: string; count: number }[];
  q?: string;
  band?: string;
  lifecycle?: "current" | "superseded";
  watchlist?: boolean;
}

export function CreditReportView(props: CreditReportViewProps)
```

### Business purpose

URL-driven filters (issuer search, band, lifecycle, watchlist) with client density + local pagination PAGE_SIZE 25 over server-returned filtered set. Shares filter params with ExportCsvButton on page.

### Key logic

- Debounced search / pushParam for band, lifecycle, watchlist.
- Band badges via `ratingTier` / shared ladder.
- Links to credit analyses / parties as applicable.
- Reset page when filter set changes.

### Side effects

URL navigation only.

### Security

Rows from `getCreditReport({ user })`.

### Risks

1. Same render-phase setState pattern for search sync.
2. Client pagination of potentially large filtered set.
3. Must keep export kind `credit-report` params in sync.

---

## 3. `src/app/reports/_components/report-charts.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 64 |
| **Directive** | `"use client"` |
| **Role** | Lazy recharts wrappers for reports |

### Exports

```ts
export type { LabelCountPoint, LabelValuePoint, ConsentStackPoint }
export const CountBarChart / HorizontalBarChart / AreaTrendChart / StackedBarChart
```

Pattern identical to portfolio-charts / dashboard-charts: `dynamic(..., { ssr: false })` + skeleton.

### Risks

Duplicate wrapper modules across app areas — consistent but three copies of pattern.

---

## 4. `src/app/reports/_components/report-charts-impl.tsx`

| Field | Value |
|--------|--------|
| **Directive** | `"use client"` |
| **Role** | recharts surfaces for report pages |

### Exports + signatures (core)

```ts
export interface LabelCountPoint { label: string; count: number }
export interface LabelValuePoint { label: string; value: number }
export interface ConsentStackPoint { label: string; active: number; withdrawn: number }

export function CountBarChart({ data, height?, color?, cellColors?, valueLabel? })
export function HorizontalBarChart({ data, height?, color?, valueLabel?, compactMode? })
export function AreaTrendChart({ data, color?, valueLabel?, compactMode? })
export function StackedBarChart({ data }) // active vs withdrawn consent
```

### Business purpose

Count bars (pipeline stages, KYC, credit bands with optional per-cell colors), HBars (types/RMs), area trends (exposure/revenue by month), stacked consent active/withdrawn.

### Coupling

`CHART_*` brand theme; `compactCr` for currency modes.

### Risks

1. compactMode "cr" assumptions.
2. Long category labels on small heights.
3. No ARIA data tables alternative.

---

## Cross-file summary (batch 049)

Risk metrics completes portfolio IA; reports charts power pipeline/revenue/credit/compliance pages.

### Highest-priority risks

1. Credit report client-side paging of full result.
2. Chart pattern duplication across dashboard/portfolio/reports.

---

*End of agent-049 analysis.*
