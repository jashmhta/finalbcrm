
# Batch 030

## `src/app/interactions/[id]/page.tsx`

- **Lines:** 351 | **Bytes:** 11846
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (7):** @/components/brand/icons, @/lib/rbac, @/features/interactions/queries, @/components/brand, @/components/brand/text, @/components/brand/money, @/components/brand/page-shell
- **Domain terms:** Barrier, Party

## `src/app/interactions/interactions-list-view.tsx`

- **Lines:** 462 | **Bytes:** 15484
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** InteractionsListView
- **Exported types:** InteractionsListViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (6):** @/lib/utils, @/features/interactions/queries, @/components/brand, @/components/brand/money, @/features/reports/export-button, ./new-interaction-dialog

## `src/app/interactions/new-interaction-dialog.tsx`

- **Lines:** 488 | **Bytes:** 17710
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** NewInteractionDialog
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (5):** @/components/ui/dialog, @/lib/utils, @/components/brand/button, @/components/brand/text, @/features/interactions/actions
- **Domain terms:** Party, party

## `src/app/interactions/page.tsx`

- **Lines:** 49 | **Bytes:** 1409
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/interactions/queries, @/components/brand, ./interactions-list-view
