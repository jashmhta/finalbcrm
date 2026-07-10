# Binary CRM — Executive architecture key findings

**Source analysis:** MEGA-AGENT D deep file-by-file reads (batches 024–025, 029, 031–032, 034, 036, 039–040, 091–095) plus structural patterns across credit, deals, leads, matching, onboarding, notifications, reports, tasks, workflow, auth, org, proxy, and ops scripts.  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Audience:** architecture / risk / product leadership  

---

## 1. Mutation boundary pattern

**What it is.** UI never talks to Postgres directly. Writes flow:

```
Client component ("use client")
  → useActionState / useTransition
  → "use server" feature action
  → requireUser() + can(user, action, resource)
  → [ideal] withRls(appUserId, wall, mandateIds, tx => …)
  → revalidatePath / redirect
```

**Where it is solid**

- Tasks (`createTask`, `updateTaskStatus`) wrap inserts/updates in `withRls` and stamp `createdByUserId` / `completedAt` carefully.
- Leads, onboarding, credit create, matching `sendToDeal`, modeling `createModel` all use server actions with Zod (or equivalent) validation and revalidation.
- Client import discipline is explicit: never import feature barrels that re-export `./queries` (postgres) into `"use client"` bundles — deep-import `actions` + `types` instead.

**Where it leaks**

- Many **reads** (and some pages, e.g. deal detail) use the shared `db` client **without** `withRls`, relying on app-layer `WHERE` clauses instead of session GUCs.
- Reports module comments that **RLS GUCs are no-ops** on tables without policies yet — so the mutation boundary is only as strong as each action’s `can()` + SQL scope.
- Fallback `user.appUserId ?? crypto.randomUUID()` in task RLS context can attribute work to a random id if profile is missing.
- Ops script `import-parties.ts` is a **side door**: live inserts with no Auth.js user, no `withRls`, no audit path.

**Finding:** Mutation boundary is a first-class design rule in app code, but it is **not yet a closed security perimeter**. Treat `withRls` + complete RLS policies as unfinished infrastructure; code review must assume fail-open DB until proven otherwise.

---

## 2. RLS (Row-Level Security)

**Intent (stated in proxy and engine comments)**

- Proxy: coarse auth only; **RLS** (`SET LOCAL app.user_id / app.wall / app.mandate_ids`) is the authoritative data control.
- Workflow engine: migration 0004 posture is **fail-open** on reads — no GUC required for notification scans.

**Practice observed**

| Layer | Behavior |
|-------|----------|
| Proxy | JWT cookie present/absent only |
| requireUser / can() | Role + permission Set (with admin/super bypass) |
| App SQL scopes | OR of assignee / creator / deal lead / party owner fields |
| withRls | Used on selected mutations (tasks, some features) |
| Postgres policies | Partially present in drizzle migrations; not assumed effective on all tables |

**Critical inconsistency:** visibility predicates do **not** use one party-ownership model:

- Deal detail scope: `party.assigned_rm_user_id` / `assigned_analyst_user_id`
- Reports / tasks / workflow scopes: `assigned_user_id` / `data_owner_user_id` / `created_by_user_id`

If both sets of columns exist, users can see different subsets per surface; if some columns are legacy, entire scopes may be wrong (over- or under-sharing).

**Finding:** RLS is **architected but not the runtime guarantee**. Production readiness requires: (1) enable policies on all sensitive tables, (2) require withRls on every write and sensitive read, (3) unify party ownership columns, (4) add integration tests that prove denial for out-of-scope UUIDs.

---

## 3. Party-centric model

**Party is the spine of the CRM.**

| Domain | How party appears |
|--------|-------------------|
| Leads | `lead_meta` on party; board/detail keyed by `partyId` |
| Onboarding | Case = party in funnel; activate flips party status |
| Credit | Analysis always on issuer/obligor party |
| Matching | Issuer + investors are parties; shortlist → deal_party |
| Deals | deal_party roster (issuer/investor/arranger/…) |
| Tasks / docs / interactions | Optional or required party anchors |
| Notifications | Labels resolved via party_id batches |
| Import | Bulk party + identifier + address promote |

**Implications**

- Dedup is strategic (import script + `party_duplicate_candidate` notification type).
- “Stop tracking” a lead clears lead meta but **keeps the party** — correct for a master ledger.
- Soft-delete (`deleted_at`) appears consistently in scopes.

**Finding:** Product and schema are correctly party-first for an IB/bond house relationship book. The main risk is **data quality** (duplicates, incomplete identifiers) and **assignment field fragmentation**, not a wrong aggregate root.

---

## 4. Matching USP

**Investor Matching Engine** is the clearest product differentiator in these batches.

**Mechanics**

1. Matchable issuers: rating + issuer role on at least one deal.
2. Score investors 0–100 across **seven criteria:** rating, tenor, sector, ticket, demat, KYC, relationship.
3. **Warm intro** path: banker name, desk, interaction count, strength (strong/warm/cold/none).
4. Workspace: two-pane instrument, filters (demat/KYC/relationship/warm), top 24 of capped 200.
5. Full matrix: select investors, indicated ₹ Cr commitments, **Send to deal** creates/updates placement mandate.

**Why it matters**

- Encodes bond-placement workflow (not generic CRM lead routing).
- Ties KYC/demat readiness into commercial shortlisting — compliance meets coverage.

**Risks**

- Caps (200/100/24) vs copy that implies full pool “scanned.”
- Possible invalid `?id=` selection without fallback to first issuer.
- Auth-only gate (no dedicated matching permission).
- Success UX links to board, not created deal id — operator re-submit risk.

**Finding:** Matching is the USP; harden permissions, URL selection, and deal deep-links before scaling the investor book.

---

## 5. Dual brand (Binary Capital + Binary Bonds)

**Model**

- No separate multi-tenant DBs. **Desk → brand** map in `lib/org.ts`:
  - Bonds desks: bond underwriting, G-Sec, secondary, portfolio, credit, rating advisory.
  - Capital desks: IB advisory, operations.
  - Management/compliance → **shared** (firm-wide).
- Auth JWT stamps `brandScope`; `CrmUser` exposes it.
- Parties carry `brand_origin`; shared parties visible to both brand supers via `partyBrandSqlValues`.
- Deals show `brand` badge; ORG_ROSTER encodes named supers (Shray firm-wide; Shahrukh Capital; Rati/Niraj Bonds).

**Credit module as brand/CEO policy**

- Inactive for general employees; supers/admins/credit_analyst/director only unless env opens it.

**CSV export**

- `canUseCsvExport` = `super_admin` only (CEO rule); `brandScope` on the type is unused.

**Finding:** Dual brand is a **desk-derived overlay**, not schema multi-tenancy. That is right for one firm two books, but every list/query must apply brand filters consistently — not only party lists. Notifications and some boards do not brand-filter.

---

## 6. Compliance stack

**Layers present in code**

| Layer | Implementation |
|-------|----------------|
| KYC / re-KYC | Onboarding stages + notification on `rekyc_due_date` (RBI PMLA framing) |
| Consent (DPDP) | Withdrawal trigger; integrations “Vendor = DPDP processor” badges |
| Document checklist | 7 statutory-ish docs upload/verify/reject |
| Compliance officer | Approve/reject before activate client |
| MNPI flags | Shown on interactions/documents (display) |
| Information barrier | `wall` / barrier_clearance on user JWT — **not enforced in can()** |
| Auth hygiene | bcrypt, lockout 5/15m, optional TOTP, timing-safe unknown user |
| Transport headers | HSTS, frame deny, nosniff (vercel.ts) |
| Audit | Reports compliance aggregates over audit_log |

**Gaps**

- Barrier wall loaded but not applied in permission helper.
- Integrations are **mock** — no real AA/KRA/CKYC credentials path yet.
- Notification “compliance” is computed, not a case-management system of record.
- MFA secrets not KMS-encrypted (auth TODO).
- Residency: comments say Mumbai/bom1 + Aurora ap-south-1; **vercel.ts pins iad1**.

**Finding:** Compliance is a **credible product narrative** (onboarding + alerts + framing) but **not yet a closed control system**. Barrier, residency, MFA-at-rest, and real processor integrations are production blockers for SEBI/DPDP claims.

---

## 7. Production gaps (consolidated)

### Security & access

1. RLS fail-open + incomplete withRls coverage.  
2. Inconsistent party visibility columns across modules.  
3. JWT sessions not revocable; credentials IdP not OIDC.  
4. Implicit permission grants for admin/coverage_rm paper over seed gaps.  
5. CSV export / some report export fetchers may under-scope if user not threaded.  
6. import-parties bypasses auth, RLS, audit.  
7. Admin/super_admin `can()` infinite bypass (by design — operational risk).  

### Product & correctness

8. Matching invalid `?id=` ternary.  
9. Notification cookie CAP 50 / entity-only keys / multi-device desync.  
10. Credit name is display-only; party pickers capped (200/300).  
11. Lead win allowed from qualified without opportunity step (policy ambiguity).  
12. Modeling free-text deal/party UUIDs for save.  

### Platform & compliance claims

13. **vercel regions: iad1** vs India data residency architecture.  
14. Forced light theme only (not a blocker; product constraint).  
15. No CSP header; trustHost true.  
16. Engine full scans at scale (bounded WHERE, but multi-query every bell open).  

### Engineering hygiene

17. Unused imports / dead props in places (Reveal, ambient).  
18. Duplicated helpers (formatRelative, disc tones) drift risk.  
19. Large RSC payloads for kanban boards (mitigated by client load-more only partially).  

---

## 8. Architecture snapshot (one page)

```
                    ┌──────────── proxy.ts (JWT only) ────────────┐
                    ▼                                             │
              Root layout (auth session, dual-brand meta, nav)    │
                    │                                             │
     ┌──────────────┼──────────────────┬──────────────────────────┤
     ▼              ▼                  ▼                          ▼
 Parties      Deals / Matching    Leads / Onboarding      Credit (role gate)
 (master)     (mandates + USP)    (party meta funnels)    (env/role gated)
     │              │                  │                          │
     └──────────────┴────────── party spine ──────────────────────┘
                    │
         features/* actions ──► withRls? ──► Postgres (RLS partial)
                    │
         workflow engine ──► computed alerts ──► cookie read state
                    │
         reports aggregates ──► super_admin CSV
                    │
         auth.ts JWT + optional TOTP; org.ts desk→brand
```

---

## 9. Recommended priority order

1. **Close RLS:** policies on + withRls required; fix ownership column model.  
2. **Auth production path:** DB sessions + Redis revocation or IdP; encrypt MFA.  
3. **Residency:** bom1 / ap-south-1 deploy path; do not ship regulated PII to iad1.  
4. **Unify brand scoping** on every list/report/notification.  
5. **Matching polish** (permissions, selection bug, deal deep link).  
6. **Export & import** auditability (who exported; import as auditable job with actor).  
7. **Notification persistence** beyond cookies if multi-device is required.  

---

*This document is executive synthesis from deep file reads; per-file evidence lives in `agent-0NN.md` / `agent-09N.md` and `MEGA-D-REMAINING.md`.*
