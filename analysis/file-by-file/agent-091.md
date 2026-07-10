# File-by-file analysis — agent-091

**Batch:** `batch-091.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (reports export access, barrel, queries; tasks actions)

---

## 1. `src/features/reports/exportAccess.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/features/reports/exportAccess.ts` |
| **Lines** | 14 |
| **Directive** | None (pure server/client-safe helper) |
| **Role** | CSV export gate — CEO super_admin only. |

### Exports

```ts
export interface ExportAccessSubject {
  roles?: readonly string[];
  brandScope?: "binarycapital" | "binarybonds" | "shared";
}

export function canUseCsvExport(
  user: ExportAccessSubject | null | undefined,
): boolean {
  return user?.roles?.includes("super_admin") ?? false;
}
```

### Business purpose

Comment: brand-scoped supers (Capital/Bonds) may export; firm-wide too; employees never. **Implementation** only checks `super_admin` role presence — brandScope unused. Aligns with dual-brand org where only supers export.

### Side effects / Security

None / primary export authorization helper for export route + ExportCsvButton.

### Risks / TODOs

- `brandScope` field is dead — comment implies brand-scoped supers allowed, but any super_admin works regardless of brand.
- Does not check `reports:export` permission string — role name only.
- Non-super admin with reports:export implicit grant in rbac.ts still blocked for CSV (intentional CEO rule).

---

## 2. `src/features/reports/index.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/features/reports/index.ts` |
| **Lines** | 43 |
| **Directive** | Feature barrel |
| **Role** | Re-export queries, export utils, ExportCsvButton. |

### Exports (re-export)

From `./queries`: getPipelineReport, getRevenueReport, getCreditReport, getComplianceReport, getReportsHubKpis, export row fetchers, column defs, all report types, PIPELINE_STAGE_ORDER.  
From `./export`: rowsToCsv, exportFilename, csvDisposition.  
From `./export-button`: ExportCsvButton, props type.

### Coupling

Server routes import barrel; **client components must not** import barrel if export-button pulls client — ExportCsvButton is client-ish; barrel may pull queries→db into client if misused. Pattern elsewhere: deep-import.

### Risks

Barrel includes both server queries and client button — fragile for "use client" consumers.

---

## 3. `src/features/reports/queries.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/features/reports/queries.ts` |
| **Lines** | ~1218 |
| **Directive** | Server-only data access |
| **Role** | READ-ONLY aggregates for pipeline/revenue/credit/compliance reports + CSV row fetchers. |

### Exports (major)

| Symbol | Purpose |
|--------|---------|
| `PIPELINE_STAGE_ORDER` | 11 status enum order |
| `getPipelineReport(user?)` | by stage/type/RM + totals |
| `getRevenueReport(user?)` | fee from fee_structure jsonb × target_size |
| `getCreditReport(user?, filter?)` | analyses/scorecards |
| `getComplianceReport(user?)` | KYC breakdown, audit, consent |
| `getReportsHubKpis(user?)` | hub tiles |
| `get*ExportRows` + `*_EXPORT_COLUMNS` | CSV |
| helpers re-export: str, num, inrCr, dateStr, titleize |

### Imports

drizzle sql, db, schema (deal, party, creditAnalysis, kycRecord, consentRecord, auditLog, exposure, scorecard, appUser), can/CrmUser.

### Business purpose

India IB reports: pipeline exposure, revenue modeled as upfront+success bps × size (closed/settled recognized; mandated pipeline retainer), credit book, compliance (KYC/consent/audit). Raw SQL GROUP BY + jsonb via db.execute (Drizzle QB weak for these).

### Key logic — app-layer scoping

```ts
scopedDealClause / scopedCreditClause / scopedKycClause / scopedConsentClause
// admin | super_admin | manage:user | read_all:report|deal|party|credit|compliance|kyc|consent
// else: lead/analyst/creator or party assigned_user_id | data_owner | created_by
```

Notes:
- Comment: RLS GUCs no-ops on tables without policies — **app-layer scope is real control**.
- Party scope fields: `assigned_user_id`, `data_owner_user_id` (differs from deal detail page’s rm/analyst fields).
- `!userId` → `sql true` for deal scope when cannot read all — careful: missing appUserId broadens or true depending branch (`canReadAll || !userId return true`).

### Side effects

SELECTs only; numeric coercion to JSON-safe numbers for RSC.

### Security / RBAC

- Dual: can() + SQL clauses.
- Export rows functions may call report without user in some signatures — check export route always passes user.
- `getPipelineExportRows()` signature from grep: no user param — **export may be unscoped if route forgets** — high risk to verify at export route.

### Coupling

Reports app routes; export route; dashboard may share KPI patterns.

### Risks / TODOs

1. Unscoped export fetchers without user arg.
2. RLS fail-open + app scope field inconsistency.
3. Revenue is modeled bps proxy not actual invoices.
4. Large file — hard to review; all report surfaces share one module.

---

## 4. `src/features/tasks/actions.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/features/tasks/actions.ts` |
| **Lines** | 181 |
| **Directive** | `"use server"` |
| **Role** | Task mutations: create + status update. |

### Exports

```ts
export type CreateTaskState = { error?: string } | undefined;
export async function createTask(
  _prev: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState>

export type UpdateTaskStatusState = { error?: string } | undefined;
export async function updateTaskStatus(
  _prev: UpdateTaskStatusState,
  formData: FormData,
): Promise<UpdateTaskStatusState>
```

### Imports

revalidatePath, redirect, zod v4, drizzle, can/requireUser, withRls, task/taskDependency schema.

### Business purpose

DATA_MODEL §2.19: create task + dependency edges in one RLS transaction; reject self-deps; update status stamps completed_at on completed, clears on reopen.

### Key logic

1. createTask: can create task; zod parse; withRls(userId, wall, [], tx) insert; deps filter self; revalidate /tasks; redirect `/tasks/{id}`.
2. updateTaskStatus: can update; conditional completedAt sql`now()` or null; revalidate list + detail.

### Side effects

DB writes under withRls GUCs; cache revalidation; redirect on create.

### Security / RBAC

- Explicit can() checks.
- withRls sets app.user_id / wall — **mutation boundary pattern**.
- Fallback `user.appUserId ?? crypto.randomUUID()` for GUC if null — **risk**: random id breaks RLS attribution if appUserId missing.
- No assignee-self-only check on update (any user with update:task can change any task id if RLS fails open).

### Coupling

Tasks UI dialogs/forms; schema task_dependency CHECK no-self.

### Risks / TODOs

- No soft ownership check before update beyond RLS.
- dependsOnTaskIds JSON parse fails silently → empty deps.
- No cycle detection on dependency graph (only self-edge).

---

## Cross-file architecture (batch 091)

```
Reports: queries (scoped reads) + canUseCsvExport (super_admin)
Tasks: withRls mutations (create/status)
```

**Mutation boundary:** tasks via withRls; reports are read-only.  
**RLS:** tasks wrap writes; reports rely on app SQL + note RLS not fully enabled.  
**Production gaps:** export row scoping, party field name inconsistency, randomUUID RLS fallback.

*End of agent-091 analysis.*
