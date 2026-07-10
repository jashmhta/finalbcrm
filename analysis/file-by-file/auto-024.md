
# Batch 024

## `src/app/credit/layout.tsx`

- **Lines:** 21 | **Bytes:** 558
- **Kind:** Next.js layout
- **Default export:** yes
- **Security signals:** auth, rbac/rls
- **External deps:** next/navigation
- **Internal imports (2):** @/lib/rbac, @/lib/org

## `src/app/credit/new/new-credit-analysis-form.tsx`

- **Lines:** 297 | **Bytes:** 10425
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** NewCreditAnalysisForm
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, next/link, react
- **Internal imports (3):** @/lib/utils, @/components/brand, @/features/credit/actions
- **Domain terms:** Issuer, credit_analysis, issuer, party, scorecard

## `src/app/credit/new/page.tsx`

- **Lines:** 35 | **Bytes:** 1148
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **External deps:** next/link
- **Internal imports (5):** @/lib/rbac, @/features/parties/queries, @/components/brand, ./new-credit-analysis-form, @/components/brand/page-shell
- **Domain terms:** issuer, scorecard

## `src/app/credit/page.tsx`

- **Lines:** 46 | **Bytes:** 1321
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/credit/queries, @/components/brand, ./credit-list-view
