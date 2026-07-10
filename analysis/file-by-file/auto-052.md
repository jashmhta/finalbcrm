
# Batch 052

## `src/app/tasks/[id]/page.tsx`

- **Lines:** 416 | **Bytes:** 14683
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (7):** @/components/brand/icons, @/lib/rbac, @/features/tasks/queries, @/components/brand, @/components/brand/text, ./task-status-form, @/components/brand/page-shell
- **Domain terms:** Party

## `src/app/tasks/[id]/task-status-form.tsx`

- **Lines:** 81 | **Bytes:** 2696
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** TaskStatusForm
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (3):** @/lib/utils, @/components/brand/button, @/features/tasks/actions

## `src/app/tasks/new-task-dialog.tsx`

- **Lines:** 376 | **Bytes:** 13331
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** NewTaskDialog
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (5):** @/components/ui/dialog, @/lib/utils, @/components/brand/button, @/components/brand/text, @/features/tasks/actions
- **Domain terms:** Party

## `src/app/tasks/page.tsx`

- **Lines:** 77 | **Bytes:** 2135
- **Kind:** Next.js page route
- **Exported const:** dynamic, STATUS_FILTERS
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/tasks/queries, @/components/brand, ./tasks-list-view
