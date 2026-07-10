
# Batch 025

## `src/app/dashboard-exposure-chart.tsx`

- **Lines:** 303 | **Bytes:** 11168
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** HeroExposureChart, StageStrip, MiniBars
- **Exported types:** ExposurePoint, StageDatum
- **Security signals:** india-compliance
- **External deps:** framer-motion, react, recharts
- **Internal imports (1):** @/lib/utils
- **Domain terms:** Mandate, allocation, mandate

## `src/app/deals/[id]/page.tsx`

- **Lines:** 589 | **Bytes:** 21839
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** auth, india-compliance
- **External deps:** drizzle-orm, next/link, next/navigation
- **Internal imports (12):** @/components/brand/page-shell, @/components/brand/icons, @/lib/rbac, @/lib/utils, @/db, @/db/schema, @/features/deals/catalog, @/features/deals/stages, @/components/brand, @/components/brand, ../deal-type-icon, ../deal-type-credit
- **Domain terms:** KYC, Mandate, Party, allocation, mandate, matching, party

## `src/app/deals/deal-type-credit.ts`

- **Lines:** 42 | **Bytes:** 1823
- **Kind:** Client component
- **Directive:** `use client`
- **Header intent:** Server-safe home for `creditBand` - the view-derived credit-character "rating chip" for a deal. This is a PURE function (no React, no Phosphor, no hooks) so it is safe to call from Server Components. It was previously co-located in `deal-type-icon.tsx`, which is `"use client"` (it imports Phosphor + IconTile), so calling it from the /deals/[id] Server Component threw "Attempted to call creditBand() from the server but creditBand is on the client." Moving it here lets both the server detail page 
- **Exported functions:** creditBand
- **Exported types:** CreditBand
- **Security signals:** india-compliance
- **Internal imports (1):** @/components/brand/icon-language
- **Domain terms:** bond, mandate

## `src/app/deals/deal-type-icon.tsx`

- **Lines:** 264 | **Bytes:** 10915
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** dealTypeConcept, DealTypeGlyph, partyRoleConcept, PartyRoleGlyph
- **Exported types:** DealTypeGlyphProps, PartyRoleGlyphProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (4):** @/components/brand/icons, @/components/brand, @/lib/utils, ./deal-type-credit
- **Domain terms:** KYC, bond, investor, issuer, mandate, party
