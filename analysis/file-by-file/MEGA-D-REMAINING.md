# MEGA-AGENT D — Remaining thin batches rollup

**Agent:** MEGA-D  
**Date:** 2026-07-09  
**Batches covered:** 024, 025, 029, 031, 032, 034, 036, 039, 040, 091, 092, 093, 094, 095  
**Detail reports:** `agent-NNN.md` co-located (overwritten with full narrative)

---

## Batch map

| Batch | Area | Files (4 each) | agent report |
|-------|------|----------------|--------------|
| 024 | Credit shell | layout, new form/page, list page | agent-024.md |
| 025 | Dashboard chart + deals detail/icons | exposure chart, deals/[id], deal-type-credit, deal-type-icon | agent-025.md |
| 029 | Integrations | explorer, icons, live-stat-tile, page | agent-029.md |
| 031 | Root layout + lead detail | layout, bant, workflow-actions, leads/[id] | agent-031.md |
| 032 | Leads pipeline | board, new form/page, list page | agent-032.md |
| 034 | Matching USP | matrix view/page, workspace, matching page | agent-034.md |
| 036 | Modeling LBO/MA lazy | lbo lazy/full/page, ma lazy | agent-036.md |
| 039 | Notifications + onboarding detail | center, page, onboarding detail view/page | agent-039.md |
| 040 | Onboarding pipeline | wizard, new page, board, list page | agent-040.md |
| 091 | Reports + task mutations | exportAccess, reports index/queries, tasks/actions | agent-091.md |
| 092 | Tasks queries + workflow | tasks/queries, workflow actions/engine/index | agent-092.md |
| 093 | Workflow types + auth/org | workflow queries/types, auth, org | agent-093.md |
| 094 | RBAC + proxy | rbac-core, rbac, utils, proxy | agent-094.md |
| 095 | Ops + config | import-parties, tsconfig, vercel, vitest | agent-095.md |

---

## Thematic remainder coverage

### Credit workspace remainder (024)

- Module hard-gate in layout via `canAccessCreditModule` (CEO inactive default).
- Create form is view-layer naming only (no free-text name column).
- List force-dynamic, pageSize 25, user-scoped `listCreditAnalyses`.

### Deals identity + detail (025)

- Canonical deal detail with **app-layer** `dealVisibilityScope` SQL.
- `creditBand` server/client split (pure module vs use client icon file).
- Dashboard dual-series ₹ Cr chart is presentational only.

### Integrations (029)

- Mock-only India adapter control panel; DPDP/vendor messaging.
- Live counts from run state, not production connectivity.

### Leads + login-adjacent shell (031–032)

- Root layout: dual-brand metadata, forced light theme, sessioned SiteNav, sidebar no-flash.
- Leads are **party-centric** (`lead_meta` on party): BANT → opportunity → win deal / lose / delete tracking.
- Client import discipline (types vs barrel) enforced to avoid postgres in browser.

### Matching USP (034)

- Seven-criteria score + warm intro + sendToDeal placement shortlist.
- Caps: 200 workspace / 24 cards / 100 matrix / preselect ≥65.
- Selection ternary bug risk on invalid `?id=`.

### Modeling (036)

- Lazy ssr:false calculators; pure engines + `createModel` save boundary.
- LBO multi-tranche, cash sweep, 115BAA tax default.

### Notifications + onboarding (039–040)

- Computed engine notifications; cookie read state CAP 50.
- Onboarding 6-stage funnel, 7 docs, KYC/compliance/activate.
- Wizard 4-step capture → createOnboarding.

### Reports / tasks / workflow / lib / scripts (091–095)

- Reports: raw SQL aggregates + scoped clauses; CSV super_admin only.
- Tasks: withRls create/status; list visibility ORs.
- Workflow: 7 trigger scans; fail-open RLS comment.
- Auth: JWT credentials + optional TOTP + lockout; production IdP/Redis TODO.
- Org: desk→brand dual book; credit module env.
- Proxy: coarse auth only; Next 16 `proxy.ts`.
- import-parties: bulk party ingest bypassing RLS.

---

## Cross-cutting patterns observed

### Mutation boundary

| Surface | Boundary |
|---------|----------|
| Credit create | `createCreditAnalysis` |
| Leads | updateBant, convert, win, lose, delete, note, createLead |
| Matching | `sendToDeal` |
| Modeling | `createModel` |
| Onboarding | advance/verify/approve/activate/createOnboarding |
| Tasks | `createTask`, `updateTaskStatus` via **withRls** |
| Notifications | cookie write actions only (no entity table) |
| Reports | read-only |

Pattern: client `useActionState` / `useTransition` → `"use server"` → `requireUser` + `can()` → (ideally) `withRls` → revalidatePath.

**Gap:** many reads/mutations still plain `db` without withRls; reports comment RLS GUCs no-ops.

### Party-centric model

Leads, onboarding, matching, deal_party, credit issuer, tasks optional partyId, documents on party, notifications party labels — master entity is **party**.

### Dual brand

`brandFromDesk` + `brandScope` on session; deal.brand display; party brand_origin on import; shared parties visible to both books.

### Matching USP

Only placement engine ranking investors on rating/tenor/sector/ticket/demat/kyc/relationship with warm-intro banker path and send-to-deal.

### Compliance stack

- Onboarding docs + KYC + compliance sign-off
- Notification triggers: KYC re-KYC, consent withdrawn, tasks, stuck deals, credit committee
- Integrations mock AA/KRA/CKYC/GSTIN framed as DPDP processors
- Auth MFA/lockout partial
- vercel security headers; residency **iad1 vs bom1 gap**

---

## Highest-priority production gaps (from these batches)

1. **RLS fail-open + uneven withRls** — app-layer SQL scopes inconsistent (assigned_rm vs assigned_user_id).
2. **JWT sessions non-revocable**; credentials IdP; MFA secrets plaintext.
3. **vercel regions iad1** contradicts India residency narrative.
4. **Notification dismiss cookie** multi-device/CAP issues.
5. **Matching invalid ?id=** selection fallback bug.
6. **CSV export helpers** may lack user scoping on some fetchers.
7. **import-parties** bypasses audit/RLS.
8. **Credit module env** dual public/server flags.
9. **Implicit RBAC grants** paper over incomplete permission seed.
10. **Party ownership field name split** across deal detail vs reports/tasks/workflow scopes.

---

## Deliverables checklist

- [x] agent-024 … agent-025, 029, 031, 032, 034, 036, 039, 040
- [x] agent-091 … agent-095
- [x] MEGA-D-REMAINING.md (this file)
- [x] 00-KEY-FINDINGS.md (executive architecture)

*End MEGA-D rollup.*
