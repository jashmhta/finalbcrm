
# Batch 020

## `src/app/compliance/kyc/[id]/kyc-action-forms.tsx`

- **Lines:** 477 | **Bytes:** 16088
- **Kind:** Server Actions module; Client component
- **Directive:** `use server`
- **Directive:** `use client`
- **Exported functions:** KycActions
- **Exported types:** KycActionsProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (6):** @/lib/utils, @/components/brand/button, @/components/brand/text, @/components/brand/badge, @/features/compliance/actions, @/features/compliance/kyc
- **Domain terms:** KYC, kyc, party

## `src/app/compliance/kyc/[id]/page.tsx`

- **Lines:** 816 | **Bytes:** 30509
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** auth, india-compliance
- **External deps:** drizzle-orm, next/link, next/navigation
- **Internal imports (12):** @/components/brand/icons, @/lib/rbac, @/features/compliance/queries, @/db, @/db/schema, @/lib/utils, @/features/compliance/kyc, ./kyc-action-forms, @/components/brand, @/components/brand, ./status-timeline, @/components/brand/page-shell
- **Domain terms:** KYC, kyc, party

## `src/app/compliance/kyc/[id]/status-timeline.tsx`

- **Lines:** 246 | **Bytes:** 8898
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** StatusTimeline
- **Exported types:** TimelineEntry
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react
- **Internal imports (2):** @/lib/utils, @/components/brand
- **Domain terms:** KYC

## `src/app/compliance/kyc/kyc-board-view.tsx`

- **Lines:** 879 | **Bytes:** 31545
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** KycBoardView
- **Exported types:** KycBoardViewProps
- **DB ops patterns:** delete, from
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, next/navigation, react
- **Internal imports (4):** @/lib/utils, @/features/compliance/queries, @/components/brand, @/features/reports/export-button
- **Domain terms:** KYC, kyc, party
