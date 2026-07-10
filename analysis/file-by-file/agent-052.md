# Agent 052 — File-by-file analysis

**Batch:** `batch-052.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Tasks detail, status form, create dialog, list page.

---

## 1. `src/app/tasks/[id]/page.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 417 |
| **Route** | `/tasks/[id]` |
| **Directive** | RSC `force-dynamic` |

### Exports + signatures

```ts
export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: { params: Promise<{ id: string }> })

const STATUSES = ["pending","in_progress","completed","cancelled","blocked","deferred"] as const
function statusVariant / priorityVariant / isOverdue
function MetaItem / ContextRow
```

### Business purpose

Task detail: due/assignee/deps/blocks meta, status form, description, context (party/deal/parent), dependency tables both directions.

### Key logic

1. `getTaskDetail(id, user)` or notFound.
2. Overdue if dueDate < today and not completed.
3. Party links `/parties/:id`; deal links **`/deals` not deal id**.
4. Dependency edges link to `/tasks/:id`.

### Side effects

Auth + detail read; status mutation via child form.

### Security / RBAC

Query-scoped detail; status update rechecked in action.

### Risks

1. Priority badges defined but not shown in header meta (only status form area).
2. Deal deep-link incomplete.
3. `priorityVariant` may be unused on page.
4. No edit title/description/due on detail.

---

## 2. `src/app/tasks/[id]/task-status-form.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 82 |
| **Directive** | `"use client"` |
| **Role** | Inline status update |

### Exports

```ts
export function TaskStatusForm({
  taskId, current, statuses,
}: { taskId: string; current: string; statuses: string[] })
```

### Key logic

`useActionState(updateTaskStatus)`; controlled select mirrored to hidden `status`; hidden `taskId`; submit button primary-emerald.

### Side effects

`updateTaskStatus` mutation + revalidate.

### Security

Action validates status enum + task access.

### Risks

1. Local status state may desync if props change without remount.
2. No success toast — relies on revalidation.
3. Can set completed without clearing blocked deps UX warning.

---

## 3. `src/app/tasks/new-task-dialog.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 377 |
| **Directive** | `"use client"` |
| **Role** | Create task dialog |

### Exports

```ts
export function NewTaskDialog()
```

### Form fields

title*, description, dueDate, priority (low|medium|high|urgent), assigneeUserId (raw uuid), dealId, partyId, dependsOnTaskIds (JSON array of uuids).

### Key logic

Client accumulates dep UUIDs; serializes hidden JSON; Bezel inputs; createTask action redirects to detail on success.

### Side effects

`createTask` insert + deps + redirect.

### Security / RBAC

Action must validate UUIDs and visibility of linked entities.

### Risks

1. **Raw UUID UX** for assignee/deal/party/deps — high error rate.
2. No staff picker unlike party assign form.
3. No cycle detection UX (server may reject).
4. Priority default medium.

---

## 4. `src/app/tasks/page.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 78 |
| **Route** | `/tasks` |
| **Directive** | RSC `force-dynamic` |

### Exports

```ts
export const dynamic = "force-dynamic";
export const STATUS_FILTERS = [
  { key: "all", label: "All open", openOnly: true },
  { key: "pending", ... },
  // in_progress, blocked, completed, deferred, cancelled
] as const;

export default async function TasksPage({ searchParams })
```

### Key logic

```ts
statusKey = sp.status ?? "all"
filter = STATUS_FILTERS.find(...) ?? all
listTasks({ status, openOnly, assigneeUserId, q, user, page, pageSize: 25 })
listAssigneeOptions()
→ TasksListView
```

### Side effects

Auth + list + assignee options.

### Security / RBAC

Tasks visibility via listTasks user scope; assignee list may be broader (check feature).

### Risks

1. Unused `Reveal` import.
2. `listAssigneeOptions()` without user arg — possible overshare of staff emails.
3. Page clamp issues.

---

## Cross-file summary (batch 052)

```
/tasks ──listTasks──► TasksListView (batch 053)
  NewTaskDialog ──createTask──► /tasks/[id]
/tasks/[id] ──getTaskDetail──► TaskStatusForm ──updateTaskStatus
```

### Highest-priority risks

1. UUID-only create UX.
2. Incomplete deal deep links.
3. Assignee options scope.

---

*End of agent-052 analysis.*
