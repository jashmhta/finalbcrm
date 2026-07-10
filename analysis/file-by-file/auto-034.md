
# Batch 034

## `src/app/matching/[id]/match-matrix-view.tsx`

- **Lines:** 1005 | **Bytes:** 38867
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** MatchMatrixView
- **DB ops patterns:** delete
- **Security signals:** india-compliance
- **External deps:** next/link, react
- **Internal imports (7):** @/components/brand/icons, @/lib/utils, @/features/matching/queries, @/features/matching/engine, @/features/matching/actions, @/components/brand, @/components/brand/text
- **Domain terms:** Bond, Demat, Investor, KYC, Mandate, bond, demat, investor, issuer, kyc, mandate, matching, underwriting

## `src/app/matching/[id]/page.tsx`

- **Lines:** 48 | **Bytes:** 1914
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **External deps:** next/link, next/navigation
- **Internal imports (7):** @/components/brand/icons, @/lib/rbac, @/features/matching/queries, @/components/brand, @/components/brand/text, ./match-matrix-view, @/components/brand/page-shell
- **Domain terms:** issuer, mandate, matching

## `src/app/matching/matching-workspace.tsx`

- **Lines:** 669 | **Bytes:** 26790
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** MatchingWorkspace
- **Exported types:** MatchingWorkspaceProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** next/link, next/navigation, react
- **Internal imports (6):** @/components/brand/icons, @/lib/utils, @/features/matching/queries, @/features/matching/engine, @/components/brand, @/components/brand/text
- **Domain terms:** Demat, Investor, Issuer, KYC, Matching, bond, demat, investor, issuer, kyc, mandate, matching

## `src/app/matching/page.tsx`

- **Lines:** 56 | **Bytes:** 2066
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (4):** @/components/brand/page-shell, @/lib/rbac, @/features/matching/queries, ./matching-workspace
- **Domain terms:** Investor, Issuer, Matching, investor, issuer, matching
