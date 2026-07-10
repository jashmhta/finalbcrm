# MEGA-AGENT B — Rollup (batches 076–090)

**Scope stated:** features remainder + lib + components + tests start  
**Actual batch lists:** features remainder through **reports export start** (no standalone `src/lib/*`, `src/components/*`, or `src/tests/*` paths in batch-076…090 lists). Those areas begin later (091+).  

**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Output:** `agent-076.md` … `agent-090.md` (overwritten, full-file narratives)  
**Files covered:** 60 source modules across 15 batches  

---

## 1. Area map

| Batches | Feature / package | Themes |
|--------:|-------------------|--------|
| 076 | deals (roles, stages), documents | Pure deal domain catalogs; document vault stub |
| 077–080 | integrations | §11 India adapters registry (12), env HTTP, actions, status cache |
| 081 | integrations/whatsapp, interactions, leads/actions | Comms adapter; activity log; lead mutations |
| 082–083 | leads (rest), matching | Lead read/seed/types; investor matching USP |
| 084–086a | modeling | Pure FI engines + financial_model persistence + scenarios |
| 086b–087 | onboarding, parties/actions | PMLA onboarding state machine; party create/assign/segment |
| 088–089a | parties queries, portal | Brand-scoped explorer; investor/client portals |
| 089b–090 | portfolio, reports export | Exposure/risk/limits; CSV export primitives |

---

## 2. Architectural patterns (cross-cutting)

### 2.1 Pure domain vs I/O boundary
- **Pure (testable, client-safe where needed):** deals roles/stages, matching engine, all modeling engines + scenarioAnalysis, portfolio risk, reports export formatters, segmentation catalogs, leads/onboarding types, lead/onboarding icons (client).
- **Server queries:** drizzle + raw SQL for JSONB columns outside frozen schema (`lead_meta`, `onboarding_meta`).
- **Server actions:** `"use server"` + zod + `requireUser` + `can` + `withRls` + revalidate/redirect.

### 2.2 JSONB extension columns
Leads (0006) and onboarding (0007) store workflow state on `party` without expanding Drizzle schema. Pattern: `normalizeX` + `mutateX` load→mutate→write inside RLS txn. Risk: corrupt JSON, uuid cast failures, no DB CHECK on stage enums.

### 2.3 Visibility dual model
Almost every query implements app-layer OR-clauses (admin / read_all / ownership EXISTS). Comments admit **RLS fail-open** until policies fully enforced. **Critical:** omitting `user` often means full visibility — callers must pass session.

### 2.4 Brand multi-tenancy
Parties list uses `@/lib/org` brand scope for Capital vs Bonds supers. Firm-wide shared brand sees all. Portals/matching generally use ownership, not brand filter.

### 2.5 Unit conventions (important inconsistency)
| Domain | Amount unit |
|--------|-------------|
| Portfolio exposure, matching targetSize, report formatCr | **₹ Crore** as stored number |
| Lead winLead target_size | `estSizeCr * 1e7` (absolute ₹) |
| Matching sendToDeal targetSize | String crores |
| Portal toCr | amount / 1e7 |

**Risk:** cross-feature deal size display and risk aggregation can mis-scale if units mix.

---

## 3. Feature deep summaries

### 3.1 Deals domain completion (076)
`roles.ts` / `stages.ts` encode BC/Binary Bonds mandate semantics over flat schema enums: valid deal_party roles, lead role, stage ladders, no-skip transitions, on_hold/dropped rules. Together with prior catalog/allocations, mutation layer can enforce per-type correctness.

### 3.2 Documents (076)
Metadata-only vault: create stub accepts client-supplied `fileStoreRef`/sha256; list/detail with strong ownership visibility. Production needs presigned upload + document RLS + MNPI download controls.

### 3.3 Integrations (077–081 whatsapp)
**12 adapters** in registry order: accountAggregator, kra, ckyc, gstinPan, mca, ratingFeed, fiuInd, emailCalendar, whatsapp, bseNse, ccil, demat.

| Phase | Adapters | Notes |
|-------|----------|-------|
| 1 | AA, KRA, CKYC, GSTIN/PAN, email/calendar, WhatsApp | Highest feasibility KYC/comms/credit feed |
| 2 | MCA aggregator, rating feed, FIU-IND | License cost / compliance workflow |
| 3 | BSE/NSE, CCIL, demat | Membership/DP **UNVERIFIED — likely scope OUT** |

**env.ts** is exemplary shared infra: mock precedence, credential any/all, IntegrationError codes, HttpClient timeout/retry/jitter.

**Critical security finding:** `integrations/actions.ts` only `requireUser()` — any authenticated user can run mocks **and** live upstreams (including FIU submit) when creds present. No `integration:run` permission.

**FIU-IND** generates representative STR/CTR XML and can POST FINGate — regulatory act without Principal Officer role gate.

### 3.4 Interactions (081)
Create with multi-attendee JSON + anchor CHECK; update descriptive fields only. List visibility strong; **form option loaders unscoped** (leak vs documents options).

### 3.5 Leads (081–083 types)
Full BANT funnel on `lead_meta`: capture, toggle BANT with auto-qualify, opportunity conversion, win→deal, lose with reason, notes→interaction, delete meta. Analytics JS rollups. Seed LD- deals deterministic. Icons brand-aware.

### 3.6 Matching (083) — USP
Weighted fit score (rating/tenor/sector/ticket/demat/KYC) + warm-intro path from interaction graph. Preferences derived from live deal_party history (or investor-kind heuristics). `sendToDeal` materializes book-build mandates. Matrix capped at 300 matches for SSR payload.

### 3.7 Modeling (084–086)
Screening engines per FINANCIAL_MODELING_SPEC:
- Bond (Indian day-count, YTM solve, DV01, G-spread)
- Project finance (sculpted DSCR sizing, LLCR)
- Securitization (CE / LCM / waterfall)
- DCF/WACC + equity bridge
- M&A (S&U, goodwill Ind AS 103, accretion, deal IRR)
- LBO (tranches, sweep, MOIC, sensitivity grid)
- Scenario desk best/base/worst + 2D sensitivity via direction probe

Persistence: `createModel` JSONB params/outputs + target ACL. Library queries headline extraction.

### 3.8 Onboarding (086–087)
PMLA 7-doc checklist + stage machine + SLA clocks + live KYC gate + compliance officer path (`approve:kyc`) + activate flips party.status. Seed 28 companies with SLA band mix. Doc keys partially map to coarse document_type enum (`other` for COI/BO).

### 3.9 Parties (087–088)
create + trigram duplicate candidates; assign + task; segmentation update. Queries: brand-scoped explorer, signals, detail, preview. Segmentation catalogs for desk taxonomy.

### 3.10 Portal (088–089)
Read-only investor (allocations→holdings with instrument LATERAL) and client (issuer deals/docs/KYC/onboarding) portals. Lazy recharts charts.

### 3.11 Portfolio + reports start (089–090)
Exposure aggregates, RBI reference caps, concentration alerts, pure duration/VaR/HHI, limits edit with audit. CSV BOM/RFC4180 + crore formatters + ExportCsvButton (route-based download).

---

## 4. Security / RBAC heat map

| Severity | Finding | Location |
|----------|---------|----------|
| **High** | Integrations run without resource permission | `integrations/actions.ts` |
| **High** | FIU live submit possible without PO role | `fiuInd` + actions |
| **High** | Document upload accepts client `fileStoreRef` | `documents/actions.ts` |
| **Med** | Unscoped queries when `user` omitted | most `queries.ts` |
| **Med** | Interaction form options unscoped | `interactions/queries` list*Options |
| **Med** | Onboarding doc verify via party:update | `onboarding/actions` |
| **Med** | MNPI flags user-settable without compliance workflow | interactions/documents |
| **Low** | Seeds clear broad state (all lead_meta) | leads/seed |

Positive: withRls on writes; credit_limit update requires `approve:credit_limit` + audit_log; matching/deal/party create permissions checked; brand scope on parties list.

---

## 5. Coupling graph (high level)

```
catalog/roles/stages ──► deal mutations / kanban
documents ──► /documents UI
integrations/* ──► registry ──► actions ──► /integrations
interactions ◄── leads notes / lead detail / matching warm intro
leads types/queries/actions ◄── /leads + seed
matching engine ◄── queries ◄── /matching UI
matching actions ──► deal + deal_party
modeling engines ◄── scenarioAnalysis, client calculators
modeling actions/queries ──► financial_model /modeling
onboarding ◄──► document + kyc_record + party
parties ◄──► address, duplicate_candidate, task, segmentation
portal queries ──► allocation_event, deal, instrument, kyc, onboarding_meta
portfolio queries/risk ──► exposure, credit_limit, instrument
portfolio actions ──► credit_limit + audit_log
reports export ──► route handler + ExportCsvButton
```

Credit `ratingBands` imported by matching engine (client-safe path). Brand chart-theme shared by portal charts.

---

## 6. Risks & TODOs backlog (consolidated)

1. **RBAC:** Add `integration:run` / per-adapter permissions; FIU submit = compliance role only.  
2. **Upload:** Presigned S3 PUT; server-minted refs; virus/mime validation.  
3. **RLS:** Enable document/interaction/financial_model policies; stop relying on app-only clauses.  
4. **Units:** Normalize crore vs absolute INR across deals/leads/matching/portfolio.  
5. **Integrations:** Real ReBIT/CERSAI/F-TRAC envelopes; scope-out demat/BSE/CCIL if non-member.  
6. **Matching:** Time-decay on rating floors; prohibited sector lists; hard gates for non-demat.  
7. **Onboarding:** Compliance-only verifyDocument; map activation to party_type_assignment clientType.  
8. **Modeling:** Per-model JSON schema validation on createModel; scenario load from saved models.  
9. **Portal:** Instrument per allocation accuracy; investor self-serve auth model (currently CRM user scope).  
10. **Performance:** leads/onboarding fetchAll without pagination; matching multi-query latency.

---

## 7. Quality observations

- **Documentation density** in feature headers is excellent (spec citations, adversarial membership checks, Neon users.app_user_id linkage notes).  
- **BANT form bug** fixed by DB toggle (leads/actions) — good production lesson captured in code.  
- **Scenario direction probe** is a clever, model-agnostic design.  
- **Barrel + use server** constraint enforced (no constant re-exports from actions).  
- **Seeds** are deterministic and self-cleaning but dangerous if run against non-demo DBs.

---

## 8. What was *not* in these batches

Despite the brief “lib + components + tests start”, **batch-076…090 lists contain only `src/features/*`**. Next MEGA batches (091+) should cover remaining features (reports queries, tasks, etc.) and then `src/lib`, `src/components`, tests.

---

## 9. Agent file index

| File | Batch contents |
|------|----------------|
| [agent-076.md](./agent-076.md) | deals/roles, stages; documents/actions, queries |
| [agent-077.md](./agent-077.md) | integrations AA, actions, bseNse, ccil |
| [agent-078.md](./agent-078.md) | ckyc, demat, emailCalendar, env |
| [agent-079.md](./agent-079.md) | fiuInd, gstinPan, kra, mca |
| [agent-080.md](./agent-080.md) | integrations queries, ratingFeed, registry, types |
| [agent-081.md](./agent-081.md) | whatsapp; interactions; leads/actions |
| [agent-082.md](./agent-082.md) | leads index, icons, queries, seed |
| [agent-083.md](./agent-083.md) | leads/types; matching actions, engine, queries |
| [agent-084.md](./agent-084.md) | modeling actions, bondPricing, dcf, lboModel |
| [agent-085.md](./agent-085.md) | maModel, projectFinance, modeling queries, scenarioAnalysis |
| [agent-086.md](./agent-086.md) | securitization; onboarding actions, index, icons |
| [agent-087.md](./agent-087.md) | onboarding queries, seed, types; parties/actions |
| [agent-088.md](./agent-088.md) | parties queries, segmentation; portal index, charts-impl |
| [agent-089.md](./agent-089.md) | portal-charts, portal queries; portfolio actions, index |
| [agent-090.md](./agent-090.md) | portfolio queries, risk; reports export-button, export |

---

*MEGA-AGENT B complete for batches 076–090. All listed sources fully read; analyses overwritten with structured extreme-detail narratives.*
