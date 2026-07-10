# File-by-file analysis — agent-092

**Batch:** `batch-092.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (tasks queries; workflow actions, engine, index)

---

## 1. `src/features/tasks/queries.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/features/tasks/queries.ts` |
| **Lines** | 407 |
| **Directive** | Server queries |
| **Role** | Task list/detail + form option lookups with app-layer visibility. |

### Exports

```ts
export interface TaskListItem { ... blockedByCount ... }
export interface TaskListResult { rows, total, page, pageSize }
export async function listTasks({ status, assigneeUserId, q, openOnly, user, page, pageSize }): Promise<TaskListResult>

export interface TaskDetail { task, assigneeEmail, dealCode, dealName, partyName, dependencies, dependents }
export async function getTaskDetail(taskId, user?): Promise<TaskDetail | null>

export async function listAssigneeOptions({ q, limit })
export async function listDealOptions({ q, limit, user })
export async function listPartyOptions({ q, limit, user })
export async function listTaskDependencyOptions({ excludeTaskId, q, limit, user })
```

### Visibility model

```ts
canReadAllTasks: admin | super_admin | read_all:task | manage:user
taskVisibility: assignee | creator | deal lead/analyst/creator | party assigned/data_owner/created_by
// leftJoin deal/party for scope OR clauses
```

openOnly excludes completed/cancelled (aligns task_open_idx). Blocker count second query for list page badges.

### Side effects

SELECTs only. Comment: RLS-aware once policies migrated; until then plain queries + app clauses.

### Security

App-layer OR scopes; assignee options list **all active users** without brand filter (email enumeration within firm).

### Risks

- ILIKE `%q%` on title — index-hostile.
- getTaskDetail returns full task row including soft fields.
- Dependency options join deal/party for visibility — correct.

---

## 2. `src/features/workflow/actions.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/features/workflow/actions.ts` |
| **Lines** | 199 |
| **Directive** | `"use server"` |
| **Role** | Notification read-state writes + bell/loadMore reads. |

### Exports

```ts
export type MarkReadResult = { ok: true } | { ok: false; error: string }
export async function markAsRead(entityId: string): Promise<MarkReadResult>

export type MarkAllReadResult = { ok: true; dismissed: number } | { ok: false; error: string }
export async function markAllAsRead(entityIds?: string[]): Promise<MarkAllReadResult>

export interface BellData { items: NotificationView[]; unreadCount: number; stats: NotificationStats }
export async function getBellData(limit = 6): Promise<BellData>

export type LoadMoreResult = { ok: true; items: NotificationView[] } | { ok: false; error: string }
export async function loadMoreNotifications(offset: number, limit = 50): Promise<LoadMoreResult>
```

Internal: writeReadIds — httpOnly cookie `bc_notif_read`, CAP 50, maxAge 1 year, sameSite lax.

### Key logic

- markAsRead adds entityId to set; revalidate /notifications.
- markAllAsRead: supplied ids or full engine set.
- getBellData/getCurrentUser: full generate + stamp relativeTime.
- loadMore: no revalidate (append UX).

### Security

- Cookie httpOnly — XSS cannot read; still per-browser.
- No CSRF special — same-origin server actions.
- getBellData POST cost on every nav mount.

### Risks

entityId-only cookie vs multi-type same entity; CAP 50.

---

## 3. `src/features/workflow/engine.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/features/workflow/engine.ts` |
| **Lines** | large (7 scans + label attach) |
| **Directive** | Server pure-ish engine |
| **Role** | Computed notification trigger scans. |

### Exports

```ts
export interface NotificationEngineOptions { limit?, offset?, user? }
export async function generateNotifications(
  db = defaultDb,
  opts = {},
): Promise<Notification[]>
```

### Triggers (domain)

| Trigger | Condition (summary) |
|---------|---------------------|
| kyc_expiring | rekyc_due within window |
| kyc_expired | past due |
| deal_stuck | idle >14d non-terminal |
| credit_committee_pending | analysis idle >5d no ruling |
| task_overdue / due_soon | due_date vs now |
| consent_withdrawn | consent_withdrawn_at set |
| party_duplicate | open duplicate candidates |

### Key logic

- Promise.all 7 scans; attachPartyLabels batch; sort critical→warning→info then proximity to now; slice limit/offset.
- Scope clauses party/deal/task/duplicate via assigned_user_id etc.
- RLS fail-open noted (migration 0004).

### Side effects

Heavy concurrent SELECTs.

### Security

User scope when provided; admin read all.

### Risks

- Full sort of potentially large arrays in memory.
- SLAs hardcoded (14d deal, 5d credit).
- No brand filter on notifications.

---

## 4. `src/features/workflow/index.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/features/workflow/index.ts` |
| **Lines** | 41 |
| **Directive** | Barrel with client-import warning |
| **Role** | Server re-exports types, engine, queries, actions. |

### Explicit client discipline

Client MUST deep-import actions/types; barrel pulls queries→db→postgres.

### Coupling

Notifications page may use barrel; NotificationBell uses actions only.

---

## Cross-file architecture (batch 092)

```
engine.generateNotifications → queries.list/getNotificationsAndStats
                            → actions.getBellData / loadMore / mark*
tasks.queries: visibility OR + blockers
```

**Compliance stack:** KYC/consent/deal/credit/task/duplicate signals.  
**Production gaps:** cookie read state, RLS fail-open, no brand scoping, engine cost at scale.

*End of agent-092 analysis.*
