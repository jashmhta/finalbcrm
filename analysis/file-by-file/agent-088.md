# Agent 088 — File-by-file analysis (batch-088)

Files: parties/queries.ts, segmentation.ts, portal/index.ts, portal-charts-impl.tsx | Fully read (queries key sections + exports)

---

## src/features/parties/queries.ts

- **Lines:** ~760+  
- **Role:** Server party list/detail/preview for Relationship Explorer. Brand-scoped visibility for supers; employee ownership scope; unstable_cache KPI summary.

- **Exports:**
  - PartyListItem/Result/Filters/Summary, listParties, getPartyListSummary (cached 60s)
  - listAssignableStaff
  - PartyDetail, getPartyDetail
  - PartyPreview*, getPartyPreview

- **Visibility (`partyVisibilityClause`):**
  - Employee: assigned OR dataOwner OR createdBy.
  - Super with brand scope: brandOrigin in brand+shared.
  - Firm-wide super: no extra filter.
  - Uses `canReadAllInScope`, `isFirmWide`, `partyBrandSqlValues` from `@/lib/org`.

- **listParties:** rich filters (type/risk/turnover/sector/rating/agency/year/investor/portfolio/riskAppetite/HY/assignee); page enrichment: types, current city, signals (deal/contact/relationship counts + last touch).

- **getPartyDetail:** full party row + types + contacts + relationships both directions with other names + deals via deal_party.

- **getPartyPreview:** serializable subset for explorer PreviewPane (strength/last-touch match list rows).

- **Security:** Brand walls for Binary Capital vs Binary Bonds supers — important multi-brand control. Unscoped null user can read all in list paths if caller omits user.

- **Risks:** OFFSET pagination; typeRows don't filter deleted_at on party_type_assignment; summary cache global for firm-wide only (scoped uses live fetchScopedPartyListSummary).

---

## src/features/parties/segmentation.ts

- **Lines:** 163  
- **Role:** Pure catalogs for party segmentation form fields — turnover bands, industry sectors, ratings, agencies, investor types, portfolio size bands, risk appetites + labels.

- **Exports:** const arrays as const + Record labels for each catalog. Used by actions zod + UI selects.

- **Business purpose:** Indian mid-market issuer/investor desk taxonomy (infra/EPC/NBFC/HY appetite etc.).

- **Risks:** latestRating catalog stops at BB- (no B/CCC/D); industry list is flat not hierarchical sector_code.

---

## src/features/portal/index.ts

- **Lines:** 46  
- **Role:** Investor & Client Portals barrel — queries + lazy chart wrappers. **No server actions** (strictly read-only portals).

- **Exports:** listInvestors, getInvestorDetail, listClients, getClientDetail, PORTAL_ENUM_LABELS + types; PortalDonut/HBar/VBar charts + palette/types.

---

## src/features/portal/portal-charts-impl.tsx

- **Lines:** ~300+  
- **Role:** `"use client"` recharts implementations: donut (sector/rating/tenor), horizontal bar (issuers), vertical bar. Brand theme from chart-theme; PORTAL_PALETTE CSS vars for dark/light.

- **Exports:** DonutPoint, LabelValuePoint, PORTAL_PALETTE, PortalDonutChart, PortalHBarChart, PortalVBarChart (and internals).

- **Key logic:** ResponsiveContainer; donut center Label with total; gradient bar fills; ChartTooltip; animation 900–950ms.

- **Coupling:** Loaded only via dynamic ssr:false wrapper so recharts stays out of server first-load JS.

- **Risks:** None security; CLS mitigated by skeleton in wrapper.

---

## Batch 088 synthesis

Parties explorer is brand-aware and signal-rich. Portal charts follow the same lazy-recharts pattern as portfolio/reports. Segmentation catalogs feed party profile depth for matching/credit.
