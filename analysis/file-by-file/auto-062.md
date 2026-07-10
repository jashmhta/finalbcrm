
# Batch 062

## `src/components/ui/sonner.tsx`

- **Lines:** 49 | **Bytes:** 1226
- **Kind:** Client component
- **Directive:** `use client`
- **External deps:** lucide-react, next-themes, sonner

## `src/components/ui/table.tsx`

- **Lines:** 116 | **Bytes:** 2402
- **Kind:** Client component
- **Directive:** `use client`
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (1):** @/lib/utils

## `src/components/ui/tabs.tsx`

- **Lines:** 82 | **Bytes:** 3497
- **Kind:** Client component
- **Directive:** `use client`
- **Security signals:** india-compliance
- **External deps:** @base-ui/react/tabs, class-variance-authority
- **Internal imports (1):** @/lib/utils

## `src/db/context.ts`

- **Lines:** 159 | **Bytes:** 7893
- **Kind:** DB infrastructure
- **Header intent:** RLS context helper - sets Postgres session GUCs per-transaction so Row Level Security policies on `deal`, `deal_party`, `allocation_event`, `credit_*`, `interaction`, `document`, `party` can consult them (ARCHITECTURE §4.4).  GUCs: app.user_id      text         - the acting app_user.user_id (uuid as text) app.wall         text[]       - barrier clearance tags (ABAC compartments) app.mandate_ids  uuid[]       - deals the user is staffed on (mandate scope)  Per §4.4, arrays are set directly as Pos
- **Exported functions:** withContext, withRls, withRlsRead
- **Security signals:** rbac/rls
- **External deps:** drizzle-orm
- **Internal imports (1):** @/db
- **Domain terms:** barrier, mandate, party
