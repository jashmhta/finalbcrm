# MEGA-A-FEATURES — Features + supporting DB layer architecture rollup

**Scope:** Batches 061–075 as listed under `/home/Jashmhta/crm/bc-crm/analysis/file-by-file/batch-06*.list` and `batch-07*.list`.

**Note on scope:** These batches are not features-only. They include:
1. **UI primitives** (061–062 partial) — Base UI / shadcn controls  
2. **DB infrastructure & schema** (062–068) — RLS context, full Drizzle domain model, seeds  
3. **Features core** (069–075) — admin, AI, calendar, compliance, credit, dashboard, deals  

This rollup summarizes how the **features layer** sits on the schema/RLS foundation covered in the same agent set.

---

## 1. Layered architecture

```
┌─────────────────────────────────────────────────────────────┐
│  App routes (RSC / client panels)                           │
│  import from @/features/* barrels + server actions          │
├─────────────────────────────────────────────────────────────┤
│  FEATURES                                                   │
│  actions.ts  "use server"  → auth → can → zod → withRls    │
│  queries.ts  RSC loaders   → app visibility + optional RLS │
│  pure *.ts   domain FSM / formulas (testable, no Next)     │
├─────────────────────────────────────────────────────────────┤
│  @/lib/rbac  requireUser / can  + JWT wall / roles          │
│  @/db/context withRls / withRlsRead  (app.user_id, wall,    │
│              mandate_ids GUCs)                              │
│  @/db + schema/*  Drizzle tables + enums                    │
├─────────────────────────────────────────────────────────────┤
│  Postgres: FORCE RLS on 16 walled tables; audit hash chain  │
└─────────────────────────────────────────────────────────────┘
```

**Mutation contract (ARCHITECTURE §3):**  
`requireUser` → `can(action, resource)` → Zod → `withRls(userId, wall, mandateIds, tx)` → mutate + `audit_log` INSERT → `revalidatePath`.

**Exceptions:** Admin user/role tables are **not** under RLS — use plain `db.transaction` (admin/actions.ts).

---

## 2. Domain map (features ↔ tables)

| Feature | Primary tables | Pure engines | Permissions (typical) |
|---------|----------------|--------------|------------------------|
| **admin** | app_user, role, permission, role_permission, user_role, audit_log, sector_code, rating_ladder | — | `manage`/`user` |
| **ai** | party, deal, deal_party, interaction, kyc, credit_analysis, task, exposure | score formulas, topic regex, memo templates | `requireUser`; scoped read_all overrides |
| **calendar** | task, interaction, kyc_record, deal, party | date key helpers | read_all party or assignee/lead scope |
| **compliance** | kyc_*, consent_record, data_subject_request, audit_log | kyc FSM, DPDP rules, PIT (no tables yet) | create/write kyc, consent, dsr |
| **credit** | credit_analysis, financial_statement, ratio_result, scorecard*, credit_score, external_rating, exposure, credit_limit | ratios, scorecard, ratingMap | write/read credit |
| **dashboard** | party, deal, interaction, credit, kyc, scorecard, sector | chart CASE SQL | read_all dashboard/party or scoped |
| **deals** | deal, deal_party, (+ allocation_event via domain) | catalog, stages, roles, alloc FSM | read_all deal or lead/analyst/creator |

---

## 3. Security model (cross-cutting)

### RBAC + ABAC
- **Roles** time-bounded via `user_role.valid_to`
- **Permissions** codes `resource:action` (e.g. user:manage, kyc:create)
- **Desks** enum on app_user/role (ib_advisory, bond_underwriting, credit, …)
- **Wall clearance** `app_user.barrier_clearance[]` → GUC `app.wall` → RLS on barrier_id rows
- **Mandate scope** `app.mandate_ids` for deal-staffed visibility

### WALLED_TABLES (16)
party, deal, deal_party, interaction, interaction_attendee, document, credit_analysis, financial_model, allocation_event, trade_event, kyc_record, consent_record, external_rating, exposure, credit_limit, audit_log

### Audit
- INSERT-only `audit_log` with prev_hash/row_hash chain
- Admin + compliance + credit/actions append audit in same transaction where possible
- Passwords never stored in audit — only `passwordSet` boolean

### Known gaps / residual risks
1. **withRls post-commit GUC cleanup** hides some barriered rows on revalidatePath re-read (documented trade-off)
2. **Calendar interactions** not scoped for non-admin users
3. **PIT rules** pure-only — trade_event path not enforced yet
4. **Sanctions/PEP** stubs always clear
5. Dual visibility: app-level `or(eq assigned…)` **and** RLS may diverge if pages skip withRlsRead
6. Seed scripts print default passwords — ops only

---

## 4. Credit stack (formulas)

```
financial_statement.line_items (jsonb)
        │ computeRatios
        ▼
     RatioSet  ──persist──► ratio_result (enum codes only)
        │ computeScorecard
        ▼
  total_score 0–100, band BC-1…BC-6, PD from BAND_PD_1Y
        │
        ├── credit_score rows (component_score × weight)
        ├── scorecard instance
        └── AI generateCreditSummary (committee prose)
```

**Band ladder:** ≥85 BC-1 … <25 BC-6  
**Agency rank:** 1=AAA … 19=D → BC bands via ratingBands/ratingMap  
**EL (DB generated):** `pd_1y * lgd_pct/100 * ead`  
**Score formula:** `Σ weight × (sub_score/5) × 100` with DSCR reallocation for non-project obligors

---

## 5. Deals stack (stage + allocation ladders)

**Generic deal_status ladder:**  
`lead → mandated → in_dd → structuring → rating_marketing → pricing → allocation → settled → closed`  
Off-pipeline: `dropped`, `on_hold`

**Allocation event ladder (book-build):**  
`indication → order → revised_order → allocated → oversubscribed_adjusted → settled`  
(+ `withdrawn` terminal from pre-allocation states)

**Product catalog** classifies 18 deal types by family, brand (binarycapital/binarybonds/shared), allocation book usage, and credit character.

**Pipeline query:** per-stage ROW_NUMBER cap (default 40) for balanced kanban columns.

---

## 6. Compliance stack (regulatory encoding)

| Regime | Module | Key constants |
|--------|--------|---------------|
| PMLA KYC | kyc.ts | BO 10%/15%; re-KYC 10/8/2 yr; retention 5 yr; STR 7 wd; CTR ₹10L |
| DPDP | consent.ts | purpose retention years; DSR SLAs 3–30d; withdrawal→restriction vs erasure |
| SEBI PIT | pit.ts | pre-clear 5d; post-disclosure 48h; designated person categories |
| Audit | audit.ts | filterable immutable log |

KYC status machine:  
`pending → in_review → (under_eds_check) → approved|rejected → expired → rekyc_due → in_review`

---

## 7. AI layer design principle

**No external LLM.** Four deterministic engines:
1. **creditSummary** — threshold rules + templated memo  
2. **interactionSummary** — domain regex topics + imperative extraction  
3. **clientInsights** — blended relationship/potential scores + nurture playbook  
4. **nextAction** — user-scoped SLA scanners (task/deal/committee/kyc/touch)

Server actions only for client panels (`fetchCreditSummary`, `fetchInteractionSummary`); pure functions remain unit-testable.

---

## 8. UI primitives in this batch

Label, Select, Separator, Sheet, Sonner, Table, Tabs — Base UI + CVA design system. No domain logic; consumed by feature forms. Sheet = dialog-as-drawer for filters/editors. Toaster themes via next-themes.

---

## 9. Seed / ops tooling

| Script | Purpose |
|--------|---------|
| seed.ts | Full demo TRUNCATE + insert (~801 shape-stable rows) |
| seed-admin.ts | Shray password + admin role |
| seed-org-users.ts | 7-person org roster dual-brand |
| seed-scale.ts | 10k parties + &lt;200ms listParties proof |
| domain-check.ts | Bond + ratio + scorecard sanity |
| rls.ts | apply/verify 0003_rls.sql + wall smoke test |

---

## 10. Coupling graph (high level)

```
admin ──► audit_log, rbac tables, sector/rating masters
ai ──► credit (detail+scorecard+ratios), party/deal/interaction/kyc/task
calendar ──► task, interaction, kyc, deal
compliance ──► kyc/consent pure + actions withRls + audit queries
credit ──► ratios/scorecard/ratingMap pure; schema credit.*; AI summary consumer
dashboard ──► party/deal/interaction/credit/kyc aggregates (same scope model as features)
deals ──► catalog/stages/roles/allocations pure; deal/deal_party pipeline SQL
schema ──► enums as single vocabulary for Zod mirrors in every actions.ts
context ──► every withRls write path
```

---

## 11. Priority follow-ups (from file risks)

1. Wire PIT pre-clearance + trading window onto trade_event mutations  
2. Live sanctions/PEP providers behind existing ScreeningResult seam  
3. Scope calendar interactions for non-admin  
4. Align all feature reads on withRlsRead for walled tables  
5. Persist missing ratio enum codes or drop extras from scorecard inputs  
6. Fix SystemHealth.activeUsers always 0  
7. Encrypt mfa_secret at rest; unify bcrypt cost  
8. Materialize relationship ultimate-parent job + BO EDD automation  

---

## 12. File index (batches → agents)

| Batch | Agent report | Contents |
|-------|--------------|----------|
| 061 | agent-061.md | label, select, separator, sheet |
| 062 | agent-062.md | sonner, table, tabs, db/context |
| 063 | agent-063.md | domain-check, db/index, rls, schema/audit |
| 064 | agent-064.md | auth, compliance, contact, credit schemas |
| 065 | agent-065.md | deals, demat, documents, enums |
| 066 | agent-066.md | schema index, information_barrier, interactions, modeling |
| 067 | agent-067.md | party, rbac, relationship, tasks |
| 068 | agent-068.md | seed-admin, seed-org-users, seed-scale, seed |
| 069 | agent-069.md | admin actions/index/queries, ai actions |
| 070 | agent-070.md | clientInsights, creditSummary, ai index, interactionSummary |
| 071 | agent-071.md | nextAction, ai types, calendar, compliance actions |
| 072 | agent-072.md | audit, consent, kyc, pit |
| 073 | agent-073.md | compliance queries, credit actions/queries, ratingBands |
| 074 | agent-074.md | ratingMap, ratios, scorecard, dashboard queries |
| 075 | agent-075.md | deals allocations/catalog/index/queries |

Absolute paths root: `/home/Jashmhta/crm/bc-crm/analysis/file-by-file/`
