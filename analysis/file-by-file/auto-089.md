
# Batch 089

## `src/features/portal/portal-charts.tsx`

- **Lines:** 55 | **Bytes:** 2311
- **Kind:** Client component
- **Directive:** `use client`
- **Exported const:** PortalDonutChart, PortalHBarChart, PortalVBarChart
- **External deps:** next/dynamic
- **Internal imports (2):** ./portal-charts-impl, ./portal-charts-impl

## `src/features/portal/queries.ts`

- **Lines:** 1452 | **Bytes:** 47330
- **Kind:** Feature data-access (queries)
- **Header intent:** Investor & Client Portals - read-only server-side data access.  Two external-facing portals over the same party master + deals + KYC + documents tables the internal CRM uses:  INVESTOR PORTAL (src/app/portal/investor/*) An investor party sees the bond book Binary placed for it: holdings derived from allocation_event (event_type allocated/settled) joined to the deal, the issuer (deal_party role='issuer'), the instrument (ISIN, coupon, maturity) and the instrument's latest long-term external ratin
- **Exported functions:** listInvestors, getInvestorDetail, listClients, getClientDetail
- **Exported const:** PORTAL_ENUM_LABELS
- **Exported types:** InvestorListItem, InvestorListSummary, InvestorHolding, InvestorAllocationHistoryRow, InvestorDematAccount, InvestorKyc, InvestorPartyInfo, BreakdownPoint, InvestorDetail, ClientListItem, ClientListSummary, ClientDealRow, ClientDocumentRow, ClientKycRow, ClientContactRow, ClientDetail
- **DB ops patterns:** from
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (2):** @/db, @/lib/rbac
- **Domain terms:** Allocation, Demat, INVESTOR, Investor, KYC, Party, allocation, bond, deal_status, demat, investor, issuer, kyc, mandate, matching, onboarding, party

## `src/features/portfolio/actions.ts`

- **Lines:** 161 | **Bytes:** 6011
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** updateLimit
- **Exported types:** UpdateLimitState
- **Zod schemas:** updateLimitSchema
- **DB ops patterns:** from, insert, select, update, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm, next/cache, zod/v4
- **Internal imports (3):** @/lib/rbac, @/db/context, @/db/schema
- **Domain terms:** barrier

## `src/features/portfolio/index.ts`

- **Lines:** 73 | **Bytes:** 1730
- **Kind:** Application module
- **Header intent:** Portfolio & Exposure Analytics - feature barrel.  Re-exports the query types + the updateLimit server action so the app layer imports from one path. The risk math (./risk) is re-exported here too for tests, but the app pages import the aggregate types from ./queries.
- **Internal imports (6):** ./queries, ./queries, ./actions, ./actions, ./risk, ./risk
