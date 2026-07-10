# Agent 050 — File-by-file analysis

**Batch:** `batch-050.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Reports hub UI, compliance & credit report pages, CSV export route.

---

## 1. `src/app/reports/_components/reports-hub-view.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 194 |
| **Directive** | `"use client"` |
| **Role** | 8-card reports hub grid |

### Exports

```ts
export function ReportsHubView({ kpis }: { kpis: ReportsHubKpis })
```

### Card map

| Title | href | primary |
|-------|------|---------|
| Pipeline | `/reports/pipeline` | yes |
| Revenue | `/reports/revenue` | yes |
| Credit | `/reports/credit` | yes |
| Compliance | `/reports/compliance` | yes |
| KYC status | `/compliance/kyc` | no |
| Client analytics | `/parties` | no |
| Investor analytics | `/matching` | no |
| Portfolio | `/deals` | no |

### Business purpose

Landing for reports IA; KPI strings from hub aggregates; module cards deep-link related CRM surfaces (not all true “report” pages).

### Key logic

Framer-motion staggered fade-in; interactive Cards as Links; phosphor icons stay client-side.

### Side effects

None (navigation).

### Risks

1. **Misleading card titles**: “Portfolio” → `/deals`, “Investor analytics” → `/matching`, “Client analytics” → `/parties` — not portal/portfolio modules.
2. Motion may conflict with reduced-motion preference (not checked).
3. KPI formatting via compactCr.

---

## 2. `src/app/reports/compliance/page.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 321 |
| **Route** | `/reports/compliance` |
| **Directive** | RSC `force-dynamic` |

### Key logic

`getComplianceReport(user)` → KYC/audit/consent aggregates.  
KPIs: KYC total, due ≤30d, audit events, active consents.  
Charts: KYC status bars, DPDP consent stacked, audit ops HBar.  
Tables: KYC by status, consent by purpose; audit summary cells.

Export: `ExportCsvButton type="compliance-kyc"`.

### Security / RBAC

Auth via requireUser; compliance data sensitivity high — scope in query.

### Risks

1. Unused PageHeader/DetailTopBar imports possible.
2. Audit chart empty “genesis” message.
3. fmtDate handles Date|string (good).

---

## 3. `src/app/reports/credit/page.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 127 |
| **Route** | `/reports/credit` |
| **Directive** | RSC `force-dynamic` |

### Key logic

Parse `q`, `band`, `lifecycle` (current|superseded), `watchlist=1`.  
`getCreditReport(filters, user)`.  
KPIs + band CountBarChart with `ratingTierColor` per band.  
`CreditReportView` + ExportCsvButton `credit-report`.

### Security

User-scoped credit analyses.

### Risks

1. Band distribution only when non-empty.
2. Full row set to client for local paging.

---

## 4. `src/app/reports/export/route.ts`

| Field | Value |
|--------|--------|
| **Lines** | 392 |
| **Route** | `GET /reports/export` |
| **Role** | RFC 4180 CSV download handler |

### Exports + signatures

```ts
export const dynamic = "force-dynamic";
export type ExportKind =
  | "pipeline" | "revenue" | "credit-report" | "compliance-kyc"
  | "parties" | "deals" | "credit" | "kyc" | "interactions"
  | "tasks" | "documents";

export async function GET(req: Request): Promise<Response>
async function buildExport(kind: string, sp: URLSearchParams): Promise<ExportBundle | null>
```

### Key logic

1. `requireUser()` then **`canUseCsvExport(user)`** → 403 plain text if denied.
2. Dispatch on `kind` query param (**not** `type` — avoids collision with documents type filter).
3. Report kinds use dedicated export row queries; list kinds reuse feature list* with `EXPORT_PAGE_SIZE = 5000`.
4. Headers: `text/csv`, Content-Disposition attachment, `Cache-Control: no-store`.
5. Column defs with `titleize` / `inrCr` / `dateStr`.

### Side effects

Heavy DB reads; no mutations.

### Security / RBAC

| Layer | Behavior |
|-------|----------|
| Auth | requireUser |
| Export allow | canUseCsvExport (super admin typically) |
| Row visibility | **Inconsistent**: some list* calls pass `user`, **parties branch does not pass user** to `listParties` |

### Critical risk — parties export

```ts
case "parties": {
  const { rows } = await listParties({
    q: optionalQ(sp),
    page: 1,
    pageSize: EXPORT_PAGE_SIZE,
  }); // no user / filters beyond q
}
```

If `listParties` without user defaults to broader visibility or fails open, this is an **RBAC hole** for super-admin exports only — still may export more than UI filters (missing type/risk/etc. params entirely).

Similarly several list exports omit rich filters present in UI (parties segmentation, credit list filters, etc.).

### Other risks

1. Cap 5000 may truncate 10k party book silently.
2. Deals export flattens pipeline with perStage 200.
3. Documents type filter uses `type` param; kind is separate.

---

## Cross-file summary (batch 050)

```
/reports hub cards
/reports/compliance | credit
GET /reports/export?kind= ──► CSV (super-admin)
```

### Highest-priority risks

1. Export param/user completeness vs on-screen filters.
2. Hub card href/title mismatches.
3. Export is high-value data exfil path — correctly restricted but high impact.

---

*End of agent-050 analysis.*
