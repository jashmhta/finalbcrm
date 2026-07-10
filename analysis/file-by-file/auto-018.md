
# Batch 018

## `src/app/ai/page.tsx`

- **Lines:** 38 | **Bytes:** 1598
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (7):** @/components/brand/page-shell, @/lib/rbac, @/features/ai/nextAction, @/features/ai/interactionSummary, @/features/ai/clientInsights, @/components/brand, ./ai-hub-view

## `src/app/api/auth/[...nextauth]/route.ts`

- **Lines:** 10 | **Bytes:** 498
- **Kind:** API route handler
- **Header intent:** Auth.js v5 route handler - App Router convention. `handlers` is exported by NextAuth() in @/lib/auth. The catch-all `[...nextauth]` segment serves all Auth.js endpoints (/api/auth/signin, /callback, /session, /signout, …). Route Handlers are dynamic by default (they touch cookies/headers), so no `force-dynamic` is needed and `next build` won't prerender this route.
- **Exported const:** runtime
- **Security signals:** auth
- **Internal imports (1):** @/lib/auth

## `src/app/calendar/page.tsx`

- **Lines:** 261 | **Bytes:** 9276
- **Kind:** Next.js page route
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next/link
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/calendar/queries, @/components/brand, @/lib/utils
- **Domain terms:** KYC, kyc

## `src/app/compliance/audit/audit-list-view.tsx`

- **Lines:** 3298 | **Bytes:** 119653
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** AuditListView
- **Exported types:** AuditListViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, next/navigation, react
- **Internal imports (4):** @/lib/utils, @/features/compliance/audit, @/components/brand, @/components/brand
- **Domain terms:** Mandate, credit_analysis, kyc, party
