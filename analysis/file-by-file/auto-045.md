
# Batch 045

## `src/app/portal/investor/investor-directory-view.tsx`

- **Lines:** 313 | **Bytes:** 10802
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** InvestorDirectoryView
- **Exported types:** InvestorDirectoryViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (4):** @/lib/utils, @/components/brand, @/components/brand, @/features/portal
- **Domain terms:** Investor, KYC, allocation, investor, matching, party

## `src/app/portal/investor/loading.tsx`

- **Lines:** 43 | **Bytes:** 1580
- **Kind:** Application module
- **Default export:** yes
- **DB ops patterns:** from
- **Internal imports (1):** @/components/brand/skeleton
- **Domain terms:** Investor

## `src/app/portal/investor/page.tsx`

- **Lines:** 42 | **Bytes:** 1318
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (4):** @/lib/rbac, @/features/portal, ./investor-directory-view, @/components/brand/page-shell
- **Domain terms:** KYC, allocation, bond, demat, investor, party

## `src/app/portfolio/_components/concentration-view.tsx`

- **Lines:** 377 | **Bytes:** 14090
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ConcentrationView
- **Exported types:** ConcentrationViewProps
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (8):** @/lib/utils, @/components/brand, @/components/brand, @/components/brand/chart-theme, @/components/brand, @/features/reports/export, @/features/portfolio, ./portfolio-charts
- **Domain terms:** Issuer, issuer, party
