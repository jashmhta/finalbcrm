# Agent 082 — File-by-file analysis (batch-082)

Files: leads/index.ts, lead-icons.tsx, queries.ts, seed.ts | Fully read

---

## src/features/leads/index.ts

- **Lines:** 47  
- **Role:** Feature barrel — single import path for app routes (`@/features/leads`).

- **Exports:** Re-exports all of `./types`; icons from lead-icons; query functions/types; action functions/state types. Does **not** re-export seed (CLI-only).

- **Coupling:** App pages import here; avoids deep relative paths. Client components must not import server actions + client icons from same barrel in ways that pull server into client — Next may still tree-shake but barrel can cause accidental client imports of queries.

- **Risks:** Barrel mixes `"use client"` icons with server modules — consumers should import actions/queries only from server components, icons from client.

---

## src/features/leads/lead-icons.tsx

- **Lines:** 122  
- **Role:** `"use client"` Phosphor/brand icon resolver for lead deal types and sources. Avoids phosphor server-bundle hazard by staying client-only.

- **Exports:**
  - `LeadDealTypeIcon({ dealType, className, weight, size })`
  - `leadDealTypeTone(dealType): IconTone`
  - `LeadSourceIcon({ source, className, weight })`

- **Key logic:**
  - Bond/HY/PP use `BondCouponMark` (gold); G-Sec uses `GSecRupeeMark` (emerald); others Phosphor (TreeStructure, Truck, HardHat, ChartLineUp, Scales, ArrowsLeftRight, ChartPie, TrendUp).
  - Sources: Handshake/Globe/CalendarHeart/Phone/Buildings.

- **Side effects:** None. Pure presentational.

- **Coupling:** `@/components/brand`, `@phosphor-icons/react`, `./types`.

---

## src/features/leads/queries.ts

- **Lines:** 669  
- **Role:** Server data access for lead pipeline, detail, and conversion analytics. `lead_meta` via raw SQL (`db.execute`) because column is outside frozen Drizzle schema.

- **Exports:**
  - Types: `RmOption`, `LeadRow`, `LeadPipelineGroup`, `LeadContact`, `LeadTask`, `LeadDetail`, analytics breakdown types, `ConversionAnalytics`
  - `normalizeLead(raw): LeadMeta` — forward-compatible defaults
  - `listRms()`, `fetchAllLeads(user?)`, `getLeadsPipeline(user?)`, `getLeadDetail(partyId, user?)`, `getConversionAnalytics(user?)`
  - re-export `isQualified`

- **Visibility (`leadScopeSql`):** admin/super_admin / read_all:lead / read_all:party / manage:user OR party assigned/owner/created OR lead_meta.assignedRm matches user.

- **LEAD_SELECT:** party fields + lead_meta + RM join via `(lead_meta->>'assignedRm')::uuid` + Auth.js `users.name` via `users.app_user_id = app_user.user_id` (documents Neon linkage quirk: no app_user.auth_user_id).

- **getLeadDetail:** lead row + party types + contacts (party_contact) + listInteractions(pageSize 25) + tasks with assignee name resolution.

- **getConversionAnalytics:** single fetchAllLeads + in-memory rollups: stage/source/dealType/RM, conversion rate, pipeline/won value Cr, overTime last 6 months closedAt, avg BANT score on open leads. Volume assumed small.

- **Security:** Uses `@/lib/rbac-core` `can` (not full rbac) for permission checks in canReadAllLeads. Unscoped user → full read (same pattern as other features).

- **Risks:** No pagination on fetchAllLeads (analytics + board load all); JSONB casting of assignedRm uuid can fail on corrupt meta; contact order uses `asc(isPrimary)` which may put false before true depending on nulls.

---

## src/features/leads/seed.ts

- **Lines:** 360  
- **Role:** CLI seed script (`npx tsx src/features/leads/seed.ts`) after main seed. Deterministic mulberry32 (seed 0x1eafc0de). Populates party.lead_meta + LD-prefixed won deals.

- **Key logic:**
  - Loads `.env.local` before dynamic `@/db` import (tsx doesn't load Next env).
  - Cleans: DELETE deal WHERE deal_code LIKE 'LD-%'; UPDATE party SET lead_meta NULL.
  - Sources prospects (party_type=prospect) + 8 existing issuers/investors.
  - Stage funnel distribution ~40% new / 22% qualified / 22% opportunity / 10% won / 6% lost.
  - Won: INSERT deal LD-{year}-{partyId4} + deal_party lead role; target_size = estSizeCr * 1e7.
  - BANT/probability/contact fake Indian names; notes by stage.

- **Side effects:** Heavy DB writes; process.exit. Re-runnable self-cleaning. Main seed TRUNCATE wipes this — re-run after main seed.

- **Security:** No auth (ops script); needs DATABASE_URL. Uses real RM emails from seed.

- **Risks:** deal_code uniqueness if re-run mid-year same party prefix; clears **all** lead_meta not only seed leads; not production-safe.

---

## Batch 082 synthesis

Leads read path + seed + UI icons + barrel complete the feature surface alongside actions (081). Analytics is intentionally JS-side. Seed is critical for demo pipeline but destructive to all lead_meta.
