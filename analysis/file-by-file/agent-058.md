# Agent 058 — File-by-file analysis

**Batch:** `batch-058.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Brand table/tabs/text + NotificationBell.

---

## 1. `src/components/brand/table.tsx`

| Field | Value |
|--------|--------|
| **Role** | Data table system with density context |

### Exports

```ts
Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
TableCaption, TableEmpty, useDensity, useTableContext
export type Density = "comfortable" | "compact"
```

### Business purpose

Gold left-accent selection language, density provider for CommandBar toggles, TableEmpty for zero rows, numeric alignment helpers.

### Risks

1. Requires Table wrapper for context — orphan cells may fail.
2. Horizontal scroll on mobile not always configured by consumers.

---

## 2. `src/components/brand/tabs.tsx`

| Field | Value |
|--------|--------|
| **Role** | Brand tabs (list/trigger/content) |

### Business purpose

Segmented navigation within pages (credit workspace etc.).

### Risks

Keyboard roving focus must meet a11y; style parity with portfolio sub-nav (separate implementation).

---

## 3. `src/components/brand/text.tsx`

| Field | Value |
|--------|--------|
| **Role** | Typography primitives |

### Exports

```ts
Eyebrow, SectionHeading, PageHeader (text-level)
```

### Business purpose

Uppercase tracking eyebrows, section titles with optional action/display Fraunces, alternate PageHeader.

### Risks

**Two PageHeaders** (text vs page-shell) — import confusion.

---

## 4. `src/components/notification-bell.tsx`

| Field | Value |
|--------|--------|
| **Lines** | ~300+ |
| **Directive** | `"use client"` |
| **Role** | Nav alerts dropdown |

### Exports

```ts
export function NotificationBell()
```

### Imports

`getBellData`, `markAsRead`, `markAllAsRead` from `@/features/workflow/actions` (not barrel — avoid postgres client pull); types from workflow/types.

### Business purpose

Self-contained bell: fetch 6 recent notifications + unread count on mount and on open; mark one/all read; link to `/notifications`. Badge rose if critical else emerald.

### Key logic

1. Mount fetch once (nav persists across client routes).
2. Click-outside + Escape + pathname change close.
3. Framer AnimatePresence panel.
4. Errors swallowed — stale last-known data.

### Side effects

Server actions for read; cookie-backed read state in workflow feature.

### Security / RBAC

Actions must scope notifications to current user; no raw entity payloads beyond NotificationView.

### Risks

1. No polling — badge stale until open/remount.
2. markAll only marks currently loaded 6 items’ unread ids (not full inbox).
3. Failed fetch silent.
4. 380px panel on mobile max-width constrained.

---

## Cross-file summary (batch 058)

Table/text foundational; NotificationBell is live workflow surface in chrome.

### Highest-priority risks

1. markAll incomplete for full unread set.
2. Dual PageHeader naming.
3. Bell silence on errors.

---

*End of agent-058 analysis.*
