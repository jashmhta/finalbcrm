
# Batch 043

## `src/app/parties/party-signals.tsx`

- **Lines:** 139 | **Bytes:** 5083
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** deriveStrength, formatRelative, StrengthBar
- **Exported const:** BAND_LABEL
- **Exported types:** StrengthBand, Strength, PartySignalInput
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (1):** @/lib/utils
- **Domain terms:** KYC, Party, kyc, mandate, party

## `src/app/parties/relationship-graph.tsx`

- **Lines:** 333 | **Bytes:** 11095
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** RelationshipGraph
- **Exported types:** RelationshipGraphProps
- **Security signals:** india-compliance
- **External deps:** next/link, react
- **Internal imports (4):** @/components/brand/icons, @/features/parties/queries, @/lib/utils, @/components/brand
- **Domain terms:** party

## `src/app/portal/client/[id]/page.tsx`

- **Lines:** 713 | **Bytes:** 26006
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (10):** @/components/brand/icons, @/lib/rbac, @/features/portal, @/features/portal, @/components/brand, @/components/brand, @/components/brand/text, @/components/brand/chart-theme, @/components/brand, @/components/brand/page-shell
- **Domain terms:** KYC, Mandate, Onboarding, allocation, investor, issuer, mandate, party

## `src/app/portal/client/client-directory-view.tsx`

- **Lines:** 323 | **Bytes:** 10884
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ClientDirectoryView
- **Exported types:** ClientDirectoryViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (4):** @/lib/utils, @/components/brand, @/components/brand, @/features/portal
- **Domain terms:** KYC, Onboarding, investor, issuer, matching, party
