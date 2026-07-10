
# Batch 015

## `src/app/admin/audit/page.tsx`

- **Lines:** 102 | **Bytes:** 3186
- **Kind:** Next.js page route
- **Header intent:** Admin → Audit - the admin's forensic view of the immutable audit log. More detailed than the compliance audit page: advanced filters (entity type, operation, actor, date range, barrier) + a per-row diff inspector.  Gated to audit:read (admin / compliance / partner roles). The data layer reuses the compliance audit query (LEFT JOIN app_user for actor email) with the barrier filter exposed.
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth, rbac/rls
- **External deps:** next/navigation
- **Internal imports (5):** @/lib/rbac, @/features/admin/queries, @/components/brand, ./audit-view, @/components/brand/page-shell
- **Domain terms:** barrier

## `src/app/admin/dashboard-view.tsx`

- **Lines:** 563 | **Bytes:** 19807
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** AdminDashboardView
- **Exported types:** AdminDashboardViewProps
- **Security signals:** rbac/rls, credentials, india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, react
- **Internal imports (3):** @/lib/utils, @/features/admin/queries, @/components/brand

## `src/app/admin/loading.tsx`

- **Lines:** 59 | **Bytes:** 2138
- **Kind:** Application module
- **Default export:** yes
- **DB ops patterns:** from
- **Security signals:** rbac/rls, india-compliance
- **Internal imports (1):** @/components/brand/skeleton

## `src/app/admin/master-data/page.tsx`

- **Lines:** 366 | **Bytes:** 14691
- **Kind:** Client component; Next.js page route
- **Directive:** `use client`
- **Header intent:** Admin → Master data - read-only display of the firm's reference data: • sector_code - the hierarchical sector taxonomy (NIC / RBI sectoral deployment codes, segment class, level, active flag). • rating_ladder - the cross-agency rating rank reference (CRISIL long term scale in the seed; extensible to ICRA / CARE / etc.). • deal_type / instrument_type / rating_agency - the Postgres enum value lists that drive the deal/instrument/rating dropdowns across the CRM.  Read-only for now (display the mast
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** next/navigation
- **Internal imports (5):** @/lib/rbac, @/features/admin/queries, @/components/brand, @/components/brand/icons, @/components/brand/page-shell
- **Domain terms:** bond, mandate, scorecard, underwriting
