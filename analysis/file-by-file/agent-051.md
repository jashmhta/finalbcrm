# Agent 051 — File-by-file analysis

**Batch:** `batch-051.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Reports loading, hub page, pipeline report, revenue report.

---

## 1. `src/app/reports/loading.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 9 |
| **Exports** | `ReportsLoading` → `<SkeletonPage />` |
| **Role** | Instant feedback for force-dynamic report queries |

Presentational only. Generic skeleton for all `/reports/*`.

---

## 2. `src/app/reports/page.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 25 |
| **Route** | `/reports` |
| **Directive** | RSC `force-dynamic` |

### Exports

```ts
export const dynamic = "force-dynamic";
export default async function ReportsHubPage()
```

### Key logic

```ts
const user = await requireUser();
const kpis = await getReportsHubKpis(user);
return (
  <PageShell>
    <PageHeader title="Reports" description="Pipeline, credit, compliance, and revenue." />
    <ReportsHubView kpis={kpis} />
  </PageShell>
);
```

### Side effects

Auth + hub KPI aggregates.

### Security / RBAC

Any authenticated user can open hub; CSV still gated on export route.

### Risks

1. Unused `Reveal`/`SectionHeading` if still imported (file is clean).
2. KPIs still computed for users who cannot export.

---

## 3. `src/app/reports/pipeline/page.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 286 |
| **Route** | `/reports/pipeline` |
| **Directive** | RSC `force-dynamic` |

### Exports

```ts
export default async function PipelineReportPage()
```

### Business purpose

Mandate book by stage, deal type, RM: counts, target exposure, hit rates. Monday meeting pack + CSV.

### Key logic

1. `getPipelineReport(user)`.
2. Chart data: stage counts, stage exposure area, top-10 deal types by count.
3. KPIs: total / open / closed / target exposure (₹ Cr via StatCard prefix/suffix).
4. RM league table with hit rate `closed/dealCount`.
5. Full stage table + total row.
6. ExportCsvButton type `"pipeline"`.

### Side effects

Auth + aggregate query.

### Security / RBAC

User-scoped pipeline report.

### Risks

1. Dead imports PageHeader/DetailTopBar possible.
2. StatCard uses `preset="int"` for exposure with ₹ Cr suffix — values must already be in crore units.
3. Top-10 types omit long tail (table not full type breakdown beyond chart — only stage full table).
4. Num format functions only work because page is server component rendering brand Num client? Actually Num is server-safe component that formats on server — OK.

---

## 4. `src/app/reports/revenue/page.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 279 |
| **Route** | `/reports/revenue` |
| **Directive** | RSC `force-dynamic` |

### Exports

```ts
export default async function RevenueReportPage()
const DEAL_TABLE_CAP = 50
```

### Business purpose

Fee revenue on closed mandates from `deal.fee_structure` (upfront + success bps × size). By month, RM, deal. CSV full set; UI caps deals at 50.

### Key logic

1. `getRevenueReport(user)`.
2. KPIs: recognized revenue, pipeline fees, closed count, avg fee bps.
3. Area chart monthly; HBar top 10 RM.
4. Month table with avg fee.
5. Deal table: size, bps sum, fee.

### Side effects

Auth + revenue aggregates.

### Security / RBAC

User-scoped; fee data is commercial sensitive.

### Risks

1. Fee model simplification may not match finance system of record.
2. Screen cap 50 without in-page pagination (export only for rest).
3. `preset="int"` on revenue StatCards with Cr suffix — same unit assumption.
4. RM email as identity key.

---

## Cross-file summary (batch 051)

```
/reports → hub KPIs + cards
/reports/pipeline → stage/type/RM analytics
/reports/revenue → fee recognition analytics
loading → SkeletonPage
```

### Highest-priority risks

1. Unit conventions (Cr vs rupees) across StatCards.
2. Revenue is model-derived fees not GL postings.
3. Hub allows all authenticated users to view aggregates.

---

*End of agent-051 analysis.*
