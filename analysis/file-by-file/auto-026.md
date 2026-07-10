
# Batch 026

## `src/app/deals/deals-board-view.tsx`

- **Lines:** 2266 | **Bytes:** 80129
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** DealsBoardView
- **Exported types:** DealsBoardViewProps
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, react
- **Internal imports (6):** @/lib/utils, @/features/deals/queries, @/components/brand, @/components/brand/text, @/features/reports/export-button, ./deal-type-icon
- **Domain terms:** Allocation, Bond, Mandate, Underwriting, allocation, binarybonds, binarycapital, mandate, matching, party

## `src/app/deals/loading.tsx`

- **Lines:** 35 | **Bytes:** 1221
- **Kind:** Application module
- **Default export:** yes
- **DB ops patterns:** from
- **Internal imports (1):** @/components/brand/skeleton

## `src/app/deals/page.tsx`

- **Lines:** 75 | **Bytes:** 2823
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (4):** @/components/brand/page-shell, @/lib/rbac, @/features/deals/queries, ./deals-board-view
- **Domain terms:** Mandate, party

## `src/app/documents/[id]/page.tsx`

- **Lines:** 298 | **Bytes:** 10620
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (6):** @/components/brand/icons, @/lib/rbac, @/features/documents/queries, @/components/brand, @/components/brand/text, @/components/brand/page-shell
- **Domain terms:** Barrier, Party
