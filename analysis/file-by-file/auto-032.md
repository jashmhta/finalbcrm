
# Batch 032

## `src/app/leads/leads-board-view.tsx`

- **Lines:** 896 | **Bytes:** 32680
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** LeadsBoardView
- **Exported types:** LeadsBoardViewProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, react, recharts
- **Internal imports (7):** @/lib/utils, @/components/brand, @/components/brand/chart-theme, @/components/brand/text, @/features/leads/lead-icons, @/features/leads/types, @/features/leads/queries
- **Domain terms:** bond, mandate

## `src/app/leads/new/new-lead-form.tsx`

- **Lines:** 565 | **Bytes:** 20831
- **Kind:** Server Actions module; Client component
- **Directive:** `use server`
- **Directive:** `use client`
- **Exported functions:** NewLeadForm
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, next/link, react
- **Internal imports (5):** @/lib/utils, @/components/brand, @/features/leads/lead-icons, @/features/leads/types, @/features/leads/actions
- **Domain terms:** bond, mandate, onboarding, party

## `src/app/leads/new/page.tsx`

- **Lines:** 48 | **Bytes:** 1753
- **Kind:** Next.js page route
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth
- **External deps:** next/link
- **Internal imports (6):** @/lib/rbac, @/features/leads/queries, @/features/parties/queries, @/components/brand, ./new-lead-form, @/components/brand/page-shell
- **Domain terms:** onboarding

## `src/app/leads/page.tsx`

- **Lines:** 39 | **Bytes:** 1316
- **Kind:** Next.js page route
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/leads/queries, @/components/brand, ./leads-board-view
