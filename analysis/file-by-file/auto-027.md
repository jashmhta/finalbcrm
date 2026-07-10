
# Batch 027

## `src/app/documents/documents-list-view.tsx`

- **Lines:** 490 | **Bytes:** 16531
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** DocumentsListView
- **Exported types:** DocumentsListViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (5):** @/lib/utils, @/features/documents/queries, @/components/brand, @/features/reports/export-button, ./new-document-dialog

## `src/app/documents/new-document-dialog.tsx`

- **Lines:** 450 | **Bytes:** 15161
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** NewDocumentDialog
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (5):** @/components/ui/dialog, @/lib/utils, @/components/brand/button, @/components/brand/text, @/features/documents/actions
- **Domain terms:** KYC, Party

## `src/app/documents/page.tsx`

- **Lines:** 78 | **Bytes:** 1860
- **Kind:** Next.js page route
- **Exported const:** dynamic, TYPE_FILTERS
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/documents/queries, @/components/brand, ./documents-list-view
- **Domain terms:** KYC

## `src/app/error.tsx`

- **Lines:** 65 | **Bytes:** 2398
- **Kind:** Client component
- **Directive:** `use client`
- **Default export:** yes
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (2):** @/components/brand, @/components/brand/text
