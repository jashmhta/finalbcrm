
# Batch 019

## `src/app/compliance/audit/page.tsx`

- **Lines:** 89 | **Bytes:** 2372
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next/navigation
- **Internal imports (4):** @/components/brand/page-shell, @/lib/rbac, @/features/compliance/audit, ./audit-list-view
- **Domain terms:** credit_analysis, party

## `src/app/compliance/consent/consent-action-forms.tsx`

- **Lines:** 603 | **Bytes:** 21303
- **Kind:** Server Actions module; Client component
- **Directive:** `use server`
- **Directive:** `use client`
- **Exported functions:** CaptureConsentDialog, WithdrawConsentButton, CreateDsrDialog, TransitionDsrControls
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (6):** @/components/ui/dialog, @/lib/utils, @/components/brand/button, @/components/brand/text, @/features/compliance/actions, @/features/compliance/consent
- **Domain terms:** Party, credit_analysis, matching, party

## `src/app/compliance/consent/consent-view.tsx`

- **Lines:** 833 | **Bytes:** 27309
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ConsentView
- **Exported types:** ConsentViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, next/navigation, react
- **Internal imports (8):** @/lib/utils, @/features/compliance/queries, @/features/compliance/consent, @/components/brand, @/components/brand, @/components/brand/text, ./consent-action-forms, @/features/compliance/consent
- **Domain terms:** Party, onboarding, party

## `src/app/compliance/consent/page.tsx`

- **Lines:** 104 | **Bytes:** 2332
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/compliance/queries, @/components/brand, ./consent-view
- **Domain terms:** credit_analysis
