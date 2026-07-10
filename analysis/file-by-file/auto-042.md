
# Batch 042

## `src/app/parties/new-party-dialog.tsx`

- **Lines:** 336 | **Bytes:** 11354
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** NewPartyDialog
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (5):** @/components/ui/dialog, @/lib/utils, @/components/brand/button, @/components/brand/text, @/features/parties/actions
- **Domain terms:** Party, investor, issuer, party

## `src/app/parties/page.tsx`

- **Lines:** 97 | **Bytes:** 3227
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/parties/queries, @/components/brand, ./parties-list-view

## `src/app/parties/parties-list-view.tsx`

- **Lines:** 1238 | **Bytes:** 43075
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** PartiesExplorer
- **Exported types:** PartiesExplorerProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (11):** @/components/brand/icons, @/lib/utils, @/features/parties/queries, @/features/parties/segmentation, @/components/brand, @/components/brand/text, @/features/reports/export-button, ./new-party-dialog, ./party-icon, ./relationship-graph, ./party-signals
- **Domain terms:** KYC, Onboarding, Party, investor, issuer, mandate, onboarding, party

## `src/app/parties/party-icon.tsx`

- **Lines:** 145 | **Bytes:** 5288
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** partyConcept, PartyAvatar
- **Exported types:** PartyAvatarProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (3):** @/components/brand/icons, @/components/brand, @/lib/utils
- **Domain terms:** KYC, investor, issuer, mandate, party
