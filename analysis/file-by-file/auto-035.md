
# Batch 035

## `src/app/modeling/[id]/page.tsx`

- **Lines:** 806 | **Bytes:** 30423
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **DB ops patterns:** from, leftJoin, select, where
- **Security signals:** auth, india-compliance
- **External deps:** drizzle-orm, next/link, next/navigation
- **Internal imports (12):** @/lib/rbac, @/features/modeling/queries, @/db, @/db/schema, @/components/brand/icons, @/components/brand/button, @/components/brand/badge, @/components/brand/card, @/components/brand/text, @/components/brand/reveal, @/components/brand/page-shell, @/components/brand/table
- **Domain terms:** Bond, Party, bond, party

## `src/app/modeling/bond-calculator/bond-calculator-lazy.tsx`

- **Lines:** 57 | **Bytes:** 2232
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** BondCalculator
- **Security signals:** india-compliance
- **External deps:** next/dynamic, react
- **Domain terms:** bond

## `src/app/modeling/bond-calculator/bond-calculator.tsx`

- **Lines:** 1332 | **Bytes:** 49306
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** BondCalculator
- **DB ops patterns:** update
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react, recharts
- **Internal imports (15):** @/features/modeling/bondPricing, @/features/modeling/actions, @/components/brand/button, @/components/brand/card, @/components/brand/badge, @/components/brand/text, @/components/brand/reveal, @/components/brand/input, @/components/brand/select, @/components/brand/tabs, @/components/brand/table, @/components/brand/empty-state, @/components/ui/dialog, @/components/ui/label, @/lib/utils
- **Domain terms:** Bond, GSEC, Party, bond, party

## `src/app/modeling/bond-calculator/page.tsx`

- **Lines:** 38 | **Bytes:** 1221
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **External deps:** next/link
- **Internal imports (5):** @/lib/rbac, @/components/brand/badge, @/components/brand/button, @/components/brand/page-shell, ./bond-calculator-lazy
- **Domain terms:** Bond, bond
