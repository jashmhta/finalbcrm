
# Batch 037

## `src/app/modeling/ma-calculator/ma-calculator.tsx`

- **Lines:** 978 | **Bytes:** 42878
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** MaCalculator
- **DB ops patterns:** update
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react, recharts
- **Internal imports (13):** @/features/modeling/maModel, @/features/modeling/actions, @/components/brand/button, @/components/brand/card, @/components/brand/badge, @/components/brand/text, @/components/brand/reveal, @/components/brand/input, @/components/brand/select, @/components/brand/table, @/components/ui/dialog, @/components/ui/label, @/lib/utils
- **Domain terms:** Party, allocation, bond, party

## `src/app/modeling/ma-calculator/page.tsx`

- **Lines:** 37 | **Bytes:** 1157
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **External deps:** next/link
- **Internal imports (5):** @/lib/rbac, @/components/brand/badge, @/components/brand/button, @/components/brand/page-shell, ./ma-calculator-lazy

## `src/app/modeling/model-library.tsx`

- **Lines:** 301 | **Bytes:** 10685
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ModelLibrary
- **Exported types:** ModelLibraryRow
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, next/link, react
- **Internal imports (9):** @/components/brand/table, @/components/brand/button, @/components/brand/badge, @/components/brand/card, @/components/brand/text, @/components/brand/reveal, @/components/brand/command-bar, @/components/brand/page-shell, @/components/brand/table
- **Domain terms:** Bond, Party, bond, party

## `src/app/modeling/page.tsx`

- **Lines:** 26 | **Bytes:** 906
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (3):** @/lib/rbac, @/features/modeling/queries, ./model-library
