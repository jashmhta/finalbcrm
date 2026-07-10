
# Batch 031

## `src/app/layout.tsx`

- **Lines:** 146 | **Bytes:** 5189
- **Kind:** Next.js layout
- **Exported const:** metadata, viewport
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next, next/font/google
- **Internal imports (5):** @/components/theme-provider, @/components/site-nav, @/components/ui/sonner, @/components/brand/page-transition, @/lib/auth
- **Domain terms:** binarycapital

## `src/app/leads/[id]/bant-checklist.tsx`

- **Lines:** 296 | **Bytes:** 9692
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** BantChecklist
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react
- **Internal imports (3):** @/lib/utils, @/features/leads/actions, @/features/leads/types

## `src/app/leads/[id]/lead-workflow-actions.tsx`

- **Lines:** 416 | **Bytes:** 13483
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ConvertToOpportunity, WinLeadButton, LoseLeadButton, DeleteLeadButton, AddNoteForm, LossReasonBadge
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, next/link, react
- **Internal imports (4):** @/lib/utils, @/components/brand, @/features/leads/actions, @/features/leads/types
- **Domain terms:** Mandate, mandate, party

## `src/app/leads/[id]/page.tsx`

- **Lines:** 821 | **Bytes:** 31352
- **Kind:** Client component; Next.js page route
- **Directive:** `use client`
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (12):** @/lib/rbac, @/features/leads/queries, @/features/documents/queries, @/features/leads, @/features/leads/lead-icons, @/components/brand, @/components/brand, @/components/brand/text, @/components/brand/icons, ./bant-checklist, ./lead-workflow-actions, @/components/brand/page-shell
- **Domain terms:** bond, mandate, party
