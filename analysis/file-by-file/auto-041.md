
# Batch 041

## `src/app/page.tsx`

- **Lines:** 350 | **Bytes:** 11840
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** next/link
- **Internal imports (7):** @/components/brand/page-shell, @/features/dashboard/queries, @/lib/rbac, @/components/brand, @/components/brand/icons, @/components/brand/money, @/lib/utils
- **Domain terms:** Allocation, KYC, allocation, binarycapital, kyc, matching

## `src/app/parties/[id]/page.tsx`

- **Lines:** 857 | **Bytes:** 32900
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (12):** @/components/brand/icons, @/lib/rbac, @/features/parties/queries, @/lib/utils, ../assign-party-form, @/components/brand, @/components/brand/text, @/components/brand/page-shell, @/components/brand/money, ../party-icon, ../relationship-graph, ../party-signals
- **Domain terms:** Bond, KYC, Party, binarybonds, binarycapital, mandate, party

## `src/app/parties/assign-party-form.tsx`

- **Lines:** 66 | **Bytes:** 1883
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** AssignPartyForm
- **Exported types:** StaffOption
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (2):** @/features/parties/actions, @/components/brand

## `src/app/parties/loading.tsx`

- **Lines:** 70 | **Bytes:** 2478
- **Kind:** Application module
- **Default export:** yes
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **Internal imports (2):** @/components/brand/skeleton, @/lib/utils
