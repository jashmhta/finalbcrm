
# Batch 082

## `src/features/leads/index.ts`

- **Lines:** 46 | **Bytes:** 1038
- **Kind:** Application module
- **Header intent:** Lead & Opportunity Management - feature barrel.  Re-exports the domain types/constants, the icon resolver, the server data access, and the server actions so app routes import from one path.
- **Internal imports (4):** ./types, ./lead-icons, ./queries, ./actions

## `src/features/leads/lead-icons.tsx`

- **Lines:** 121 | **Bytes:** 3917
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** LeadDealTypeIcon, leadDealTypeTone, LeadSourceIcon
- **External deps:** @phosphor-icons/react, react
- **Internal imports (4):** @/components/brand, @/components/brand, @/lib/utils, ./types
- **Domain terms:** bond

## `src/features/leads/queries.ts`

- **Lines:** 668 | **Bytes:** 20210
- **Kind:** Feature data-access (queries)
- **Header intent:** Lead & Opportunity Management - server-side data access.  Storage: a JSONB `lead_meta` column on party (migration 0006). A party is a lead iff lead_meta IS NOT NULL. Because lead_meta is not in the frozen Drizzle schema (the schema layer owns src/db/schema/*), the lead read paths use parameterised raw SQL via `db.execute(sql\`...\`)` - postgres-js parses the jsonb column into a JS object and timestamptz into a Date automatically. Writes (actions.ts) set lead_meta via raw SQL inside an RLS transa
- **Exported functions:** normalizeLead, listRms, fetchAllLeads, getLeadsPipeline, getLeadDetail, getConversionAnalytics
- **Exported types:** RmOption, LeadRow, LeadPipelineGroup, LeadContact, LeadTask, LeadDetail, SourceBreakdown, DealTypeBreakdown, RmBreakdown, MonthBucket, ConversionAnalytics
- **DB ops patterns:** from, innerJoin, leftJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (7):** @/db, @/db/schema, @/lib/rbac-core, @/lib/rbac, @/features/interactions/queries, @/features/interactions/queries, ./types
- **Domain terms:** Party, party

## `src/features/leads/seed.ts`

- **Lines:** 359 | **Bytes:** 12386
- **Kind:** Application module
- **Header intent:** Lead & Opportunity Management - seed.  Run AFTER the main seed (src/db/seed.ts):  npx tsx src/features/leads/seed.ts  Populates party.lead_meta (migration 0006) with a realistic Indian bond-house lead pipeline: ~30 prospect parties promoted into leads across the full funnel (new → qualified → opportunity → won/lost), plus a handful of existing-client leads attached to active issuer/investor parties. Won leads get a real deal row (dealCode prefix LD-) linked via deal_party so the lead→deal conver
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, node:fs, node:path
- **Internal imports (2):** @/db, ./types
- **Domain terms:** binarybonds, binarycapital, bond, investor, issuer, mandate, party
