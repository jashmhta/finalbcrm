# Agent 067 — Extreme detail analysis

Batch files: `src/db/schema/party.ts`, `src/db/schema/rbac.ts`, `src/db/schema/relationship.ts`, `src/db/schema/tasks.ts`

Party master (CRM spine), staff RBAC, ownership graph, tasks.

---

## `src/db/schema/party.ts`

- **Lines:** 461 | **Role:** **Party master** — single source of truth for names (§1.1)
- **Exports:** `party`, `partyTypeAssignment`, `partyIdentifier`, `address`, `partyDuplicateCandidate`, relations, types

### `party` (§2.1)
- party_seq, legal_name citext, display_name, name_phonetic (Double-Metaphone / future generated)
- party_nature, country_of_incorporation default IN, domicile_state
- ultimate_parent_party_id (denormalized job cache from relationship CTE)
- is_listed, listing_exchange text, ticker, industry_segment_id, crisil_sector_code
- group_exposure_inr (job), is_kyc_complete/stale (trigger)
- barrier_id, kyc_risk_rating, status, brand_origin, source, source_ref
- assigned_user_id, data_owner_user_id
- Investor suitability denorms: annual_turnover_cr, turnover_band, industry_sector/sub, latest_rating*, investor_type, portfolio_size_*, risk_appetite, high_yield_appetite, existing_securities_note
- Unique (legal_name, country) partial; rich indexes for matching (investor suitability, rating, sector)

### `party_type_assignment` (§2.2)
- Composite PK (party_id, party_type); multi-type parties; append-only types with soft delete

### `party_identifier` (§2.3) — **dedup backbone**
- identifier_type: PAN|LEI|CIN|LLPIN|GSTIN|TAN|demat_dp_client|SEBI_regn|NSDL|CDSL|ISIN|CRN
- identifier_value normalized; **UQ (type, value) WHERE deleted_at IS NULL**
- is_primary, verified_at, valid interval, regn_category for SEBI

### `address` (§2.23.9)
- Polymorphic party/contact; structured line1/2, city, state, pincode char(6), country char(2), address_type
- CHECK party_id OR contact_id; is_current; trgm dedup migration note

### `party_duplicate_candidate` (§1.4)
- source/candidate party, match_rule, match_score, status open|confirmed_merge|rejected_merge|deferred, evidence jsonb
- Unique open pair per (source, candidate, rule)

- **Security:** Soft delete; barrier walls; never free-text names on deals
- **Coupling:** Everything references party_id
- **Risks:** Many denormalized caches need jobs; listing_exchange not exchangeEnum

---

## `src/db/schema/rbac.ts`

- **Lines:** 320 | **Role:** Staff users + roles + permissions
- **Exports:** `appUser`, `role`, `permission`, `rolePermission`, `userRole`, relations, types

### `app_user`
- user_id PK; employee_party_id, contact_id plain uuids (migration FKs break cycles)
- email citext unique; is_active; desk deskEnum
- **barrier_clearance text[]** — ABAC wall tags for RLS GUC app.wall
- last_login_at, mfa_enrolled_at
- Auth credentials: password_hash bcrypt, mfa_secret (should encrypt at rest prod), mfa_enabled, failed_login_count, locked_until
- Soft delete

### `role` / `permission` / `role_permission`
- role name unique; desk optional
- permission codes e.g. `deal:create`, `kyc:approve` (resource:action style)
- M2M role_permission composite PK

### `user_role`
- Time-bounded grants: valid_from NOT NULL, valid_to null = current
- Partial unique current grant per (user, role)
- assigned_by_user_id; gist exclusion migration note for non-overlapping intervals

- **Business:** Secondees/temps rotate through desks; portal users may lack employee_party
- **Security:** Lockout fields; MFA; barrier clearance is high-privilege attribute
- **Coupling:** `@/lib/rbac`, admin feature, auth authorize path
- **Risks:** mfa_secret plaintext column; admin permissions not under RLS (management tables)

---

## `src/db/schema/relationship.ts`

- **Lines:** 99 | **Role:** Directed ownership / control edges
- **Exports:** `relationship`, relations, types
- **Shape:** parent_party_id → child_party_id; relationship_type: wholly_owned|subsidiary|associate|jv|promoter|beneficial_owner|guarantor|sister_concern|management_control
- ownership_pct, voting_rights_pct, is_publicly_disclosed, effective interval, evidence_document_id
- UQ active edge (parent, child, type); BO index WHERE type=beneficial_owner
- **Business:** Ultimate parent via recursive CTE (migration view); BO ≥10% → EDD (PMLA)
- **Coupling:** party.ultimate_parent_party_id cache; kyc BO paths
- **Risks:** Path MV is migration TODO; no cycle CHECK

---

## `src/db/schema/tasks.ts`

- **Lines:** 146 | **Role:** Work items + dependencies
- **Exports:** `task`, `taskDependency`, relations, types
- **task:** deal_id/party_id optional anchors; title NOT NULL; description; assignee; due_date; priority low|medium|high|urgent; status pending|in_progress|completed|cancelled|blocked|deferred; parent_task_id; completed_at
- Partial open index: assignee+due WHERE status NOT IN (completed,cancelled)
- **task_dependency:** composite PK (task_id, depends_on_task_id); self-dep CHECK migration note
- **Business:** Auto-generate from deal-stage transitions (e.g. rating_marketing → agency meeting tasks) — orchestration outside this file
- **Coupling:** calendar, AI nextAction overdue scan, workflow
- **Risks:** parent_task_id no Drizzle FK
