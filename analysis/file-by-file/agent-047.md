# Agent 047 — File-by-file analysis

**Batch:** `batch-047.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Limit edit dialog, limits table, overview bento, recharts implementations.

---

## 1. `src/app/portfolio/_components/edit-limit-dialog.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 322 |
| **Directive** | `"use client"` |
| **Role** | Inline credit limit editor |

### Exports + signatures

```ts
export function EditLimitDialog({ row }: { row: LimitRow }): JSX.Element
```

### Imports

`updateLimit`, `UpdateLimitState` from `@/features/portfolio/actions`; UI Dialog; brand Button/Eyebrow; `compactCr`.

### Business purpose

Edit **limit amount (₹ Cr)**, **utilized (₹ Cr)**, optional **review due** for one `creditLimitId`. Live preview of available, util %, breach status. Audit-logged on server.

### Key logic

1. `useActionState(updateLimit)`.
2. Reset local fields when dialog opens.
3. Close on `state.ok`.
4. Hidden `creditLimitId`; numbers as controlled inputs.
5. Preview: `available = limit - utilized`, `utilPct`, `willBreach`.

### Side effects

Server mutation + revalidation (`/portfolio/limits` etc. in action).

### Security / RBAC

- UI only shown when parent `canEdit` (`can(user, "approve", "credit_limit")`).
- Action re-checks permission (comment).
- Forged FormData still blocked server-side.

### Risks

1. **Manual utilized** can desync from computed exposure jobs.
2. Amounts entered as Cr strings — zod must coerce carefully.
3. No reason/comment field for audit narrative beyond system log.
4. Number inputs allow empty/NaN until submit validation.

---

## 2. `src/app/portfolio/_components/limits-view.tsx`

| Field | Value |
|--------|--------|
| **Lines** | ~482 |
| **Directive** | `"use client"` |
| **Role** | Filterable counterparty limits blotter |

### Exports + signatures

```ts
export interface LimitsViewProps {
  rows: LimitRow[];
  summary: LimitUtilizationSummary;
  canEdit: boolean;
  limitType?: string;
  status?: "breach" | "stale" | "ok";
  q?: string;
}

export function LimitsView(props: LimitsViewProps)
```

### Key logic

1. URL-driven `limitType`, `status`, `q` (280ms debounce search).
2. **Client pagination** PAGE_SIZE 25 over already-filtered `rows` (server returns full filtered set).
3. Density toggle comfortable/compact.
4. Columns: obligor (link party), type, limit, utilized, available, util%, status badges, review due, edit.
5. Limit types: issuer_underwriting, single_name, group, sector, secondary_inventory, tenor, country, counterparty_concentration.

### Side effects

URL replace; EditLimitDialog mutations.

### Security

`canEdit` from server; rows scoped by getLimits.

### Risks

1. **Client-only page of server-full list** — fine at hundreds of lines; weak at thousands.
2. Render-phase state sync pattern `if ((q??"") !== lastQ) set...` is React anti-pattern (works but concurrent mode risk).
3. Filter status `ok` semantics depend on server flags.

---

## 3. `src/app/portfolio/_components/overview-view.tsx`

| Field | Value |
|--------|--------|
| **Lines** | ~581 |
| **Directive** | `"use client"` |
| **Role** | Portfolio overview bento dashboard |

### Exports + signatures

```ts
export interface OverviewViewProps {
  overview: PortfolioOverview;
  bySector: ExposureBySectorRow[];
  byIssuer: ExposureByIssuerRow[];
  byRating: ExposureByRatingBandRow[];
  byTenor: ExposureByTenorRow[];
  limits: LimitUtilizationSummary;
  alerts: ConcentrationAlertSummary;
}

export function OverviewView(props: OverviewViewProps)
```

### Business purpose

Bento:

1. Sector donut + legend | Top 10 obligors HBar | Concentration alert rail  
2. Rating stacked bar by exposure type | Tenor VBar  
3. Limit utilization radial gauges  
4. Exposure-type strip  

### Key logic

- Maps rows to chart points with `compactCr`.
- `buildRatingStacked` pivots segments by exposure type order.
- AlertRail shows top1/CR3/HHI + up to 6 alerts with severity icons.
- GaugeTile breach vs clean styling.

### Side effects

Lazy charts only.

### Coupling

Heavy on portfolio-charts + feature types.

### Risks

1. Empty chart sections render empty ChartCards (some check length).
2. Sector legend colors local SECTOR_COLOR vs SECTOR_PALETTE must align.
3. Alert IDs must be stable for React keys.

---

## 4. `src/app/portfolio/_components/portfolio-charts-impl.tsx`

| Field | Value |
|--------|--------|
| **Lines** | large recharts module |
| **Directive** | `"use client"` |
| **Role** | Actual recharts implementations |

### Exports (primary)

```ts
export interface DonutPoint / LabelValuePoint / StackedPoint / GaugePoint
export const SECTOR_PALETTE
export const EXPOSURE_TYPE_COLORS / EXPOSURE_TYPE_LABELS
export function DonutChart(...)
export function HBarChart(...)
export function StackedBarChart(...)
export function VBarChart(...)
export function RadialGauge(...)
```

### Imports

recharts primitives; brand `CHART_*`, `ChartTooltip`.

### Business purpose

Single themed chart toolkit for portfolio: donut with center label, horizontal bars, stacked multi-series, vertical bars, radial utilization gauge (>100% breach coloring expected in RadialGauge).

### Side effects

None beyond render.

### Security

N/A.

### Risks

1. **SSR false** required — must only load via wrapper.
2. Accessibility: charts often lack text alternatives (legends help).
3. Tooltip formatter dependency on compactValue prop.

---

## Cross-file summary (batch 047)

```
OverviewView → charts-impl via portfolio-charts
LimitsView → EditLimitDialog → updateLimit
```

### Highest-priority risks

1. Manual limit utilization vs system exposure.
2. Client pagination of full limit set.
3. Chart theme drift vs reports.

---

*End of agent-047 analysis.*
