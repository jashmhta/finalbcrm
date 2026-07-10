# Binary CRM — Exhaustive File-by-File Codebase Analysis

**Generated:** 2026-07-09  
**Scope:** `bc-crm/app` source only (docs/ ignored)  
**Coverage:** **380 files**, ~**116,299** lines of application code + migrations + config

---

## How this analysis was produced

| Layer | Count | What it is |
|--------|------:|------------|
| Parallel subagents (wave 1–2) | **~40** launched | Extreme-detail narrative per 4-file batch |
| Parallel subagents (mega wave) | **4** | Full re-enrichment of remaining batches + domain rollups |
| Structural auto-pass | **95** batches | Symbol/export/import/DB-op/security extraction for every file |
| Inventory JSON | 1 | Machine-readable metrics for every file |
| **Final agent reports** | **95/95 full narrative** | **~29,888 lines / ~1.2 MB** of file-by-file prose |

**Note on “100 agents”:** The corpus was partitioned into **95 four-file batches** (≈100 agents). The subagent coordinator accepted ~40 concurrent agents, then capacity-limited further spawns. A second wave of **4 mega-agents** finished the remaining batches with the same extreme-detail template. **All 95 batch reports are full narrative (0 fallback residual).**

---

## Start here

| File | Purpose |
|------|---------|
| [`00-MASTER-INDEX.md`](./00-MASTER-INDEX.md) | Agent → file mapping for all 95 batches |
| [`00-AREA-ROLLUP.md`](./00-AREA-ROLLUP.md) | Files grouped by domain area with LOC |
| [`00-FULL-STRUCTURAL.md`](./00-FULL-STRUCTURAL.md) | All-files structural extraction (exports, imports, DB, security signals) |
| [`inventory.json`](./inventory.json) | Machine metrics (lines, client/server, todos, imports) |
| `agent-001.md` … `agent-095.md` | Per-batch file-by-file reports |
| `auto-001.md` … `auto-095.md` | Parallel structural auto-analyses |
| `MEGA-*.md` | Domain rollups from mega-agents (when complete) |
| `00-KEY-FINDINGS.md` | Architecture findings (when mega-D completes) |

---

## Project in one paragraph

**Binary CRM** is a single-tenant, India capital-markets CRM for **Binary Capital Advisors LLP** and **Binary Bonds**. It is party-centric (issuers, investors, intermediaries…), deal-pipeline aware (bond underwriting through M&A/ECM), credit-analytic (scorecards BC-1…BC-6, ratios, ratings), placement-oriented (**investor matching engine** as USP), and compliance-heavy (KYC/PMLA, DPDP consent, information barriers, Postgres RLS, audit hash-chain). Stack: **Next.js 16 + React 19 + Drizzle/Postgres + Auth.js v5 + Tailwind/shadcn brand system**.

---

## Architecture map (from code)

```
Browser
  └─ SiteNav (brand-scoped CRM IA)
       └─ App Router pages (src/app/**)
            ├─ Server Components → features/*/queries.ts
            └─ Client views → Server Actions features/*/actions.ts
                 ├─ requireUser() + can(resource, action)   [lib/rbac]
                 ├─ withRls / session GUCs                  [db/context, rls]
                 └─ Drizzle schema                          [db/schema/*]
                      └─ PostgreSQL (enums, tables, RLS policies)
```

**Coarse auth:** `src/proxy.ts` (Next 16 proxy) — login gate only.  
**Fine auth:** server actions + page loaders via `requireUser` / `can`.  
**Data isolation:** RLS on 16 walled tables + information barriers + desk→brand scope.

---

## Corpus statistics

| Metric | Value |
|--------|------:|
| Total analyzed files | 380 |
| Total lines (approx) | 116,299 |
| `use client` modules | 121 |
| `use server` modules | 23 |
| Feature domains under `src/features` | ~20 |
| Schema modules | 17 |
| Vitest test files | 14 |
| SQL migrations | 12 (+ meta) |
| Integration adapters | 12 |

### Largest files (complexity hotspots)

| Lines | Path | Role |
|------:|------|------|
| 3750 | `src/db/seed.ts` | Demo/seed data factory |
| 3298 | `src/app/compliance/audit/audit-list-view.tsx` | Audit UI |
| 2266 | `src/app/deals/deals-board-view.tsx` | Deal pipeline explorer |
| 1554 | `src/app/credit/[id]/workspace/page.tsx` | Credit workspace |
| 1452 | `src/features/portal/queries.ts` | Investor/client portal data |
| 1444 | `src/features/portfolio/queries.ts` | Portfolio/risk queries |
| 1332 | `src/app/modeling/bond-calculator/bond-calculator.tsx` | Bond pricing UI |
| 1328 | `src/app/onboarding/[id]/onboarding-detail-view.tsx` | Onboarding case UI |
| 1238 | `src/app/parties/parties-list-view.tsx` | Party master UI |
| 1217 | `src/features/reports/queries.ts` | Reports data layer |
| 1005 | `src/app/matching/[id]/match-matrix-view.tsx` | Match matrix UI |
| 989 | `src/db/schema/credit.ts` | Credit schema |
| 995 | `drizzle/0000_*.sql` | Baseline migration |
| 920 | `src/components/site-nav.tsx` | App shell navigation |

---

## Domain inventory (what each area does)

### 1. Identity & access (`lib/auth`, `lib/rbac*`, `lib/org`, `proxy`, `db/schema/auth|rbac`)
- Credentials login (bcrypt) + TOTP MFA + lockout (5 fails / 15 min)
- JWT sessions with `appUserId`, `roles`, `desk`, `wall`, `brandScope`
- Permission model `resource:action`; admin/super_admin bypass
- Desk → brand: Binary Bonds vs Binary Capital vs shared
- Proxy: unauthenticated → `/login`; logged-in `/login` → `/parties`

### 2. Party master (`features/parties`, `schema/party|contact|relationship|demat`)
- Legal entity / person master with Indian identifiers (PAN, CIN, GSTIN, LEI, demat…)
- Types: issuer, investor, arranger, rating agency, SPV, prospect…
- Segmentation (sector, investor type, portfolio band, risk appetite)
- Duplicate candidates + merge workflow
- Relationship graph (subsidiary, promoter, guarantor, BO…)

### 3. Pipeline: Leads → Deals → Onboarding
- **Leads:** `party.lead_meta` JSONB; stages new→qualified→opportunity→won/lost; BANT; converts to deal
- **Deals:** instrument + deal + deal_party + allocation_event + trade_event; per-type stage ladders; allocation book for FI/ECM
- **Onboarding:** `party.onboarding_meta`; 7-doc checklist; KYC + compliance gates → activate client

### 4. Matching USP (`features/matching/engine.ts`)
Weighted issuer↔investor score: rating 25%, tenor 20%, sector 20%, ticket 15%, demat 10%, KYC 10%; relationship as warm-intro flag (not in base score).

### 5. Credit (`features/credit/*`, `schema/credit.ts`)
Financial statements → ratios → scorecard (BC-1…BC-6) → external ratings → exposure & limits. Obligor-aware (corporate, NBFC, bank, project/SPV).

### 6. Modeling (`features/modeling/*`)
Bond pricing, DCF, LBO, M&A, project finance, securitization, scenario/stress — pure calc engines + persisted `financial_model` rows.

### 7. Compliance
KYC CDD/EDD, consent (DPDP purposes), DSR, audit log (append-only / hash-chain intent), information barriers.

### 8. Workspace CRM
Interactions (incl. WhatsApp/RFQ/NDS-OM channels), tasks, documents, calendar, notifications.

### 9. Insights
Reports (pipeline/revenue/credit/compliance + CSV export ACL), portfolio concentration/limits/risk, AI summaries (credit, interactions, next action, client insights).

### 10. Integrations (India stack)
Account Aggregator, KRA, CKYC, GSTIN/PAN, MCA, rating feeds, FIU-IND, email/calendar, WhatsApp, BSE/NSE, CCIL, demat — mock-default with real clients behind env credentials.

### 11. Portals
Investor and client directory/detail views over CRM data.

### 12. Admin
Users, roles, master data, audit dashboard.

---

## Cross-cutting patterns (recurring in file analysis)

1. **Mutation boundary:** `requireUser` → `can(action, resource)` → `withRls(...)` → Drizzle write → `revalidatePath`  
2. **Party as SSOT:** no free-text counterparty names on deals/credit; always `party_id`  
3. **JSONB extension columns:** `lead_meta`, `onboarding_meta` extend frozen party schema without new tables  
4. **Pure engines + impure queries:** matching, scorecard, bond pricing, stage flows are unit-tested without DB  
5. **Brand dual-book:** `brand_origin` / `brandFromDesk` filter visibility  
6. **Append-only trade/allocation events:** corrections via compensating events  
7. **Client UI density:** large board/list + inspector panes (deals, parties, matching, onboarding)

---

## Batch → agent guide (high-value first)

| Batches | Contents | Typical depth |
|--------:|----------|---------------|
| 001–004 | Drizzle config + baseline/auth/RLS migrations | Full narrative |
| 005–020 | Scripts, login, dashboard, admin, AI, calendar, compliance UI | Full narrative |
| 021–040 | Credit, deals, documents, integrations, interactions, leads | Mixed full/fallback → mega-enriched |
| 041–060 | Modeling, onboarding, parties, portal, portfolio, reports | Mega-C |
| 061–075 | `src/features/*` domain logic | Mega-A |
| 076–090 | Features tail, lib, components, tests | Mega-B |
| 091–095 | Schema remainder, seeds, import script, config | Mega-D |

Open any `agent-NNN.md` after looking up the file in `00-MASTER-INDEX.md`.

---

## Known production / quality signals surfaced by analysis

- Auth production TODOs: DB sessions + Redis, IdP (OIDC), encrypted MFA secret, WebAuthn  
- Hand-written SQL migrations `0002+` may be outside drizzle-kit journal (ops risk)  
- Integrations default to **mock** until credentials + `USE_MOCK_*=false`  
- Very large UI files (2k–3k LOC) are maintenance hotspots  
- Seed/demo data volume is large (`seed.ts` ~3.7k LOC) — not runtime path but CI/dev cost  

---

## Directory layout of this analysis pack

```
analysis/file-by-file/
  README.md                 ← this file
  00-MASTER-INDEX.md
  00-AREA-ROLLUP.md
  00-FULL-STRUCTURAL.md
  00-KEY-FINDINGS.md        ← mega-agent D
  inventory.json
  batch-001.list … batch-095.list
  agent-001.md … agent-095.md
  auto-001.md … auto-095.md
  MEGA-A-FEATURES.md
  MEGA-B-LIB-UI-TESTS.md
  MEGA-C-APP-ROUTES.md
  MEGA-D-REMAINING.md
```

Total pack size on disk: ~2.5–4+ MB depending on mega-agent completion.
