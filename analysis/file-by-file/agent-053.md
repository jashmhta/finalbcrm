# Agent 053 — File-by-file analysis

**Batch:** `batch-053.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Tasks list view + brand Badge / Button / Card primitives.

---

## 1. `src/app/tasks/tasks-list-view.tsx`

| Field | Value |
|--------|--------|
| **Lines** | ~470 |
| **Directive** | `"use client"` |
| **Role** | Worklist table with status rail + filters |

### Exports + signatures

```ts
export interface TasksListViewProps {
  rows: TaskListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
  statusKey: string;
  assigneeUserId?: string;
  assignees: AssigneeOption[];
  statusFilters: ReadonlyArray<{ key: string; label: string; openOnly?: boolean }>;
}

export function TasksListView(props: TasksListViewProps)
```

### Key logic

1. Status pill rail → `/tasks?status=&assignee=&q=`.
2. CommandBar: search debounce 280ms, density, assignee select, ExportCsv tasks, NewTaskDialog.
3. Table: Due (overdue red+warning), Task title+blocked-by count, Status, Priority, Assignee, Context (party/deal).
4. Mobile hides priority/assignee/context.
5. Server pagination via Link Pagination.

### Side effects

URL nav; export; create dialog.

### Security

Rows server-filtered; export super-admin.

### Risks

1. Overdue ignores status cancelled/deferred (only completed excluded via due formatter using raw date — actually overdue is purely date-based; completed tasks still show overdue styling if past due).
2. Deal context links to `/deals` list.
3. Export type tasks must forward status/assignee/q (button behavior external).

---

## 2. `src/components/brand/badge.tsx`

| Field | Value |
|--------|--------|
| **Lines** | ~120+ |
| **Role** | Brand status pills + ActionBadge for audit |

### Exports + signatures

```ts
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
  dot?: boolean;
}
export function Badge(...)
export const badgeVariants
export function ActionBadge(...)
export const ACTION_VARIANT / actionFromVerb
export type ActionType / ActionBadgeProps
```

### Variants

neutral, emerald, gold, highlight, up, down, info, outline, action-create/update/delete/read/export.

**Note:** In current file, `emerald` and `gold` share gold styling (`bg-gold/10 text-gold-deep`) — **semantic emerald may not render green** (design drift vs comments).

### Business purpose

Unified hairline pills for CRM states; ActionBadge monochrome audit verbs.

### Side effects / Security

None.

### Risks

1. emerald≈gold visual collision.
2. Server-safe (no hooks) — good.

---

## 3. `src/components/brand/button.tsx`

| Field | Value |
|--------|--------|
| **Role** | Primary CRM button primitive |

### Exports

```ts
export interface ButtonProps extends ButtonHTMLAttributes, VariantProps {
  asChild?: boolean;
  trailingIcon?: React.ReactNode;
  leadingIcon?: React.ReactNode;
}
export const Button = forwardRef(...)
export function ButtonIcon(...)
export const buttonVariants
```

### Variants

primary-emerald, primary-gold (both gold fill), secondary-hairline, ghost.  
Sizes: sm/md/lg/icon/icon-sm.

### Key logic

cva composition; asChild clones child with merged classes (Slot-like); leading/trailing icon slots.

### Risks

1. Naming primary-emerald but styling is gold — confusing for agents.
2. asChild implementation must handle non-element children carefully.

---

## 4. `src/components/brand/card.tsx`

| Field | Value |
|--------|--------|
| **Role** | Surface container (Stripe single panel) |

### Exports

```ts
Card, CardBody, CardHeader, CardTitle, CardDescription, CardFooter
```

### Props

`shellRadius?: "2xl"|"3xl"|"xl"`, `interactive?`, `ambient?` (accepted but `_ambient` ignored — ambient glow removed in day theme).

### Business purpose

Default surface for sections/tables; interactive hover lift for hub cards.

### Risks

1. ambient prop dead — callers may expect glow.
2. Radius prop maps 2xl→rounded-xl (naming mismatch).

---

## Cross-file summary (batch 053)

Tasks list is a flagship consumer of Badge/Button/Card; brand primitives are global design system.

### Highest-priority risks

1. Badge/Button emerald/gold naming vs actual gold chrome.
2. Task overdue styling on completed rows.
3. Deal links incomplete in list.

---

*End of agent-053 analysis.*
