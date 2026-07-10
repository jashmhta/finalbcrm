
# Batch 088

## `src/features/parties/queries.ts`

- **Lines:** 762 | **Bytes:** 25452
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side party data access. RLS-aware once policies are migrated; until then these are plain queries (the GUCs set by withRls are no-ops on tables without RLS enabled). All functions are safe to call from Server Components.
- **Exported functions:** listAssignableStaff, listParties, getPartyDetail, getPartyPreview
- **Exported const:** getPartyListSummary
- **Exported types:** PartyListItem, PartyListSummary, PartyListResult, PartyListFilters, PartyDetail, PartyPreviewRelationship, PartyPreviewDeal, PartyPreview
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm, next/cache
- **Internal imports (4):** @/db, @/lib/rbac, @/lib/org, @/db/schema
- **Domain terms:** KYC, Party, binarybonds, binarycapital, mandate, onboarding, party

## `src/features/parties/segmentation.ts`

- **Lines:** 163 | **Bytes:** 3173
- **Kind:** Application module
- **Exported const:** TURNOVER_BANDS, TURNOVER_BAND_LABELS, INDUSTRY_SECTORS, INDUSTRY_SECTOR_LABELS, RATING_VALUES, RATING_AGENCIES, RATING_AGENCY_LABELS, INVESTOR_TYPES, INVESTOR_TYPE_LABELS, PORTFOLIO_SIZE_BANDS, PORTFOLIO_SIZE_LABELS, RISK_APPETITES, RISK_APPETITE_LABELS
- **Exported types:** TurnoverBand, IndustrySector
- **Domain terms:** Bond, investor

## `src/features/portal/index.ts`

- **Lines:** 45 | **Bytes:** 1013
- **Kind:** Application module
- **Header intent:** Investor & Client Portals - feature barrel.  Re-exports the read-only server queries (data access) + the lazy client chart wrappers (recharts) + the shared types so the portal pages import from a single path. No server actions live here - both portals are strictly read-only.
- **Security signals:** india-compliance
- **Internal imports (4):** ./queries, ./queries, ./portal-charts, ./portal-charts
- **Domain terms:** Investor

## `src/features/portal/portal-charts-impl.tsx`

- **Lines:** 350 | **Bytes:** 10049
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** PortalDonutChart, PortalHBarChart, PortalVBarChart
- **Exported const:** PORTAL_PALETTE
- **Exported types:** DonutPoint, LabelValuePoint
- **External deps:** react, recharts
- **Internal imports (1):** @/components/brand/chart-theme
- **Domain terms:** investor, issuer
