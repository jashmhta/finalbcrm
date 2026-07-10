# Agent 002 — File-by-file analysis

Batch: `batch-002.list`  
Workspace root: `/home/Jashmhta/crm/bc-crm/app`  
Files analyzed: 4 (SQL migrations under `drizzle/`)

---

## 1. `drizzle/0003_rls.sql`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/drizzle/0003_rls.sql` |
| **Lines** | 383 |
| **Role** | Database migration — Row Level Security (RLS) wall, application role provisioning, grants, and immutable tamper-evident `audit_log` |
| **Track / ownership** | Track B / RLS; owns `drizzle/0003_rls.sql` and pairs with `src/db/rls.ts` |
| **Exports** | None (SQL DDL/DCL). Defines: role `crm_app`; functions `rls_wall_clear`, `rls_deal_visible`, `rls_party_visible`, `audit_log_immutable`, `audit_log_chain`; 16 table FORCE RLS; 16 policies; 2 triggers; GRANTs/REVOKEs |
| **Imports** | Depends on existing schema tables/columns (from earlier migrations/Drizzle schema): `party`, `deal`, `deal_party`, `interaction`, `interaction_attendee`, `document`, `credit_analysis`, `financial_model`, `allocation_event`, `trade_event`, `kyc_record`, `consent_record`, `external_rating`, `exposure`, `credit_limit`, `audit_log`. Extension `pgcrypto` for `digest()`. Runtime GUC contract from `src/db/context.ts`: `app.user_id`, `app.wall` (`text[]`), `app.mandate_ids` (`uuid[]`). |
| **Business purpose** | Enforce Chinese-wall / information-barrier visibility at the database layer so users only see parties/deals/documents/etc. they are wall-cleared for (or mandated deals). Make `audit_log` append-only and hash-chained for compliance/tamper-evidence. Introduce a non-superuser, non-BYPASSRLS role (`crm_app`) for least-privilege app access. |

### Key logic

#### (a) Extension + application role

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Idempotent role provision (CREATE ROLE has no IF NOT EXISTS)
CREATE ROLE crm_app
  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD 'crm_app';

ALTER ROLE crm_app LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'crm_app';
```

- `NOBYPASSRLS` is essential: even if privileges escalate, the role cannot skip RLS.
- Password is hardcoded `'crm_app'` (dev/demo posture; not production secret management).

#### (e.0) Schema/sequence grants (before table grants)

```sql
GRANT USAGE ON SCHEMA public TO crm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO crm_app;
```

Note: `ALL SEQUENCES` at apply-time only — future sequences need separate grants or `ALTER DEFAULT PRIVILEGES`.

#### Shared predicate helpers (fail-closed as of 0003)

| Function | Signature | Semantics (0003) |
|----------|-----------|------------------|
| `rls_wall_clear` | `(barrier uuid) RETURNS boolean` `LANGUAGE sql` `STABLE` | `barrier IS NULL OR barrier::text = ANY(COALESCE(current_setting('app.wall', true)::text[], ARRAY[]::text[]))` |
| `rls_deal_visible` | `(d_id uuid) RETURNS boolean` `LANGUAGE sql` `STABLE` | `EXISTS (deal d WHERE deal_id = d_id AND (rls_wall_clear(d.barrier_id) OR d.deal_id = ANY(COALESCE(current_setting('app.mandate_ids', true)::uuid[], ARRAY[]::uuid[]))))` |
| `rls_party_visible` | `(p_id uuid) RETURNS boolean` `LANGUAGE sql` `STABLE` | `EXISTS (party p WHERE party_id = p_id AND rls_wall_clear(p.barrier_id))` |

- `current_setting(..., true)` → NULL if GUC unset; `COALESCE` → empty array so `= ANY(...)` is FALSE (fail-closed for walled rows).
- Unwalled rows (`barrier_id IS NULL`) remain visible even with no context.

#### (b) ENABLE + FORCE RLS — 16 tables

Tables: `party`, `deal`, `deal_party`, `interaction`, `interaction_attendee`, `document`, `credit_analysis`, `financial_model`, `allocation_event`, `trade_event`, `kyc_record`, `consent_record`, `external_rating`, `exposure`, `credit_limit`, `audit_log`.

`FORCE ROW LEVEL SECURITY` subjects the table **OWNER** to policies as well (blocks accidental owner-role bypass via connection string).

#### (c) Policies (DROP IF EXISTS + CREATE; `FOR ALL TO PUBLIC` unless noted)

| Policy name | Table | USING / WITH CHECK |
|-------------|-------|--------------------|
| `party_rls` | `party` | `rls_wall_clear(barrier_id)` |
| `deal_rls` | `deal` | `rls_wall_clear(barrier_id) OR deal_id = ANY(app.mandate_ids)` |
| `deal_party_rls` | `deal_party` | `rls_deal_visible(deal_id)` |
| `interaction_rls` | `interaction` | `rls_wall_clear(barrier_id) OR rls_deal_visible(deal_id) OR rls_party_visible(party_id)` |
| `interaction_attendee_rls` | `interaction_attendee` | `EXISTS` parent `interaction` satisfying wall/deal/party visibility |
| `document_rls` | `document` | wall OR deal visible OR party visible |
| `credit_analysis_rls` | `credit_analysis` | wall OR deal visible OR party visible |
| `financial_model_rls` | `financial_model` | `rls_deal_visible(deal_id) OR rls_party_visible(party_id)` (no direct barrier) |
| `allocation_event_rls` | `allocation_event` | wall OR deal OR party |
| `trade_event_rls` | `trade_event` | wall OR deal OR party |
| `kyc_record_rls` | `kyc_record` | `rls_party_visible(party_id)` |
| `consent_record_rls` | `consent_record` | `rls_party_visible(party_id)` — **note**: contact-only rows with `party_id IS NULL` not surfaced |
| `external_rating_rls` | `external_rating` | party OR deal visible |
| `exposure_rls` | `exposure` | `rls_party_visible(party_id)` |
| `credit_limit_rls` | `credit_limit` | `rls_party_visible(party_id)` |
| `audit_log_insert_rls` | `audit_log` | **INSERT only**; `WITH CHECK (true)`; no SELECT/UPDATE/DELETE policy |

#### (d) Audit immutability + hash chain

**Function `audit_log_immutable()`** — `RETURNS trigger` `LANGUAGE plpgsql`:

```sql
RAISE EXCEPTION 'audit_log is INSERT-only (rejected %)', TG_OP;
```

**Trigger `audit_log_no_update_delete`**: `BEFORE UPDATE OR DELETE OR TRUNCATE` `FOR EACH STATEMENT` → rejects non-INSERT.

**Function `audit_log_chain()`** — `RETURNS trigger` `LANGUAGE plpgsql` `SECURITY DEFINER` `SET search_path = pg_catalog, public`:

```sql
SELECT row_hash INTO prev FROM audit_log
  ORDER BY occurred_at DESC, audit_log_id DESC LIMIT 1;
NEW.prev_hash := prev;
NEW.row_hash := encode(
  digest(convert_to(coalesce(prev::text, '') || row_to_json(NEW)::text, 'utf8'), 'sha256'),
  'hex');
```

- Chain: `row_hash = sha256(prev_hash || row_to_json(NEW))`; first row seeds from empty string.
- `SECURITY DEFINER` required because `crm_app` is INSERT-only on `audit_log` and cannot SELECT the prior hash under RLS/grants.
- Fixed `search_path` mitigates search-path hijacking under SECURITY DEFINER.

**Trigger `audit_log_chain`**: `BEFORE INSERT` `FOR EACH ROW`.

#### (e) Table grants

```sql
GRANT SELECT, INSERT, UPDATE ON
  party, deal, deal_party, interaction, interaction_attendee, document,
  credit_analysis, financial_model, allocation_event, trade_event,
  kyc_record, consent_record, external_rating, exposure, credit_limit
  TO crm_app;

GRANT INSERT ON audit_log TO crm_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM crm_app;
```

- Soft-delete model: no DELETE grant on operational tables.
- No SELECT on `audit_log` for `crm_app` in this migration.

### Side effects

- Creates extension `pgcrypto` if missing.
- Creates/alters role `crm_app` with login password.
- Enables/forces RLS on 16 tables — changes visibility for **all** connections including table owner.
- Replaces three STABLE SQL functions (later redefined by 0004).
- Drops/recreates all named policies and audit triggers.
- Grants privileges; revokes audit write-beyond-insert.
- Hash chain trigger mutates every new `audit_log` row’s `prev_hash` / `row_hash` at insert time.

### Security / RBAC

| Concern | Detail |
|---------|--------|
| Wall enforcement | Session GUCs `app.wall`, `app.mandate_ids` (and later `app.user_id` via 0004) |
| Role posture | `crm_app`: no superuser, no BYPASSRLS, no CREATEDB/CREATEROLE/REPLICATION |
| FORCE RLS | Owner cannot bypass wall policies |
| Audit integrity | Trigger + GRANT defense-in-depth; hash chain; SECURITY DEFINER chain reader |
| Hardcoded password | `PASSWORD 'crm_app'` — security risk if used in non-dev |
| Policies `TO PUBLIC` | Apply to all roles subject to RLS, not only `crm_app` |
| Fail-closed (0003) | Unset GUCs hide barriered rows — intentional; breaks app read paths without context (fixed in 0004) |
| consent_record | `party_id IS NULL` consents invisible under policy |
| Superuser required | First apply needs superuser for CREATE ROLE + extension |

### Coupling

- **Tight** with `src/db/context.ts` (GUC names/types).
- **Tight** with `src/db/rls.ts` (`applyRlsMigration()` re-applies policy/trigger/grant layer; tolerates missing CREATEROLE).
- **Tight** with schema columns: `barrier_id`, `deal_id`, `party_id`, `interaction_id`, `audit_log.row_hash` / `prev_hash` / `occurred_at` / `audit_log_id`.
- **Superseded in part** by `0004_rls_fix.sql` (predicate helpers + audit SELECT).
- Cross-table EXISTS in policies (`deal`, `party`, `interaction`) → recursive RLS evaluation on those tables.

### Risks / TODOs

1. **Fail-closed + missing withRls on reads** → empty pages / “permission denied” (documented problem; fixed by 0004).
2. **Hardcoded role password** in migration SQL.
3. **`TO PUBLIC` policies** may be broader than intended if other DB roles exist.
4. **consent_record** NULL `party_id` rows permanently hidden (comment: refine later).
5. **Hash chain concurrency**: `ORDER BY ... LIMIT 1` without locking → concurrent inserts can fork chain (race).
6. **`row_to_json(NEW)` instability**: column order / representation changes can break chain verification if schema evolves.
7. **No DELETE grant** is correct for soft-delete, but hard-delete admin tools need a different role.
8. **Sequence grants** only cover sequences existing at migration time.
9. **Idempotency**: role DO-block + DROP/CREATE policies; FORCE RLS reapplied as no-op — safe to re-run with caveats (password reset every run).
10. Apply: `sudo -u postgres psql -d binary_crm -f drizzle/0003_rls.sql`.

---

## 2. `drizzle/0004_rls_fix.sql`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/drizzle/0004_rls_fix.sql` |
| **Lines** | 112 |
| **Role** | Database migration — corrective RLS semantics (fail-open without user context) + audit_log SELECT visibility |
| **Track / ownership** | Track B / RLS fix; owns `drizzle/0004_rls_fix.sql` |
| **Exports** | None. Redefines: `rls_wall_clear`, `rls_deal_visible`, `rls_party_visible`. Creates policy `audit_log_select_rls`. |
| **Imports** | Depends on 0003 objects: same three helper signatures, `audit_log` table with FORCE RLS, tables `deal`/`party` for EXISTS. GUC `app.user_id` becomes the fail-open switch. App architecture: feature `queries.ts` read paths use shared `db` without `withRls`/`withContext`; writes in `actions.ts` use `withRls`. |
| **Business purpose** | Restore feature read access and the `/compliance/audit` viewer after 0003’s fail-closed wall hid barriered rows and all audit rows when session GUCs were unset. Preserve full wall/mandate enforcement when production sets per-request context via `withRls`. |

### Key logic

#### Problem statement (from header)

1. App feature reads (`src/features/*/queries.ts`) do **not** call `withRls`/`withContext` — only writes do.
2. Unset `app.user_id` → `current_setting(..., true)` NULL → 0003 predicates collapse to “only `barrier_id IS NULL`” for wall-based checks → barriered operational data invisible.
3. `audit_log` had INSERT-only policy, no SELECT → FORCE RLS hides every audit row from owner/app → blank audit page.

#### Fix (1) — Fail-open helpers

| Function | New signature body |
|----------|-------------------|
| `rls_wall_clear(barrier uuid) RETURNS boolean` | `current_setting('app.user_id', true) IS NULL OR barrier IS NULL OR barrier::text = ANY(COALESCE(current_setting('app.wall', true)::text[], ARRAY[]::text[]))` |
| `rls_deal_visible(d_id uuid) RETURNS boolean` | `current_setting('app.user_id', true) IS NULL OR EXISTS (deal … wall-clear OR mandate)` |
| `rls_party_visible(p_id uuid) RETURNS boolean` | `current_setting('app.user_id', true) IS NULL OR EXISTS (party … wall-clear)` |

- `CREATE OR REPLACE` keeps signatures identical → all 15 operational policies pick up new behavior without DROP/CREATE.
- Semantics:
  - **No `app.user_id`**: all rows visible through helpers (admin/demo + current read path).
  - **`app.user_id` set** (withRls): wall/mandate rules as 0003 intended.
- Deal policy’s inline `OR deal_id = ANY(app.mandate_ids)` is covered when fail-open: `rls_wall_clear` short-circuits TRUE when user_id NULL → whole USING TRUE.

#### Fix (2) — audit_log SELECT

```sql
DROP POLICY IF EXISTS audit_log_select_rls ON audit_log;
CREATE POLICY audit_log_select_rls ON audit_log
  FOR SELECT TO PUBLIC
  USING (current_setting('app.user_id', true) IS NULL);
```

- Readable only when no per-user RLS context.
- Preserves `audit_log_insert_rls` and immutability/hash triggers from 0003.
- Explicit non-goal: role-gated audit reads under withRls (production hardening deferred).

### Side effects

- Replaces three STABLE SQL functions globally (all policies affected at once).
- Adds SELECT policy on `audit_log` (visibility opens when GUCs unset).
- Does not change GRANTs (if role has no SELECT grant on `audit_log`, policy alone is insufficient — app connecting as owner `crm` relies on FORCE RLS + this policy; `crm_app` still only has INSERT grant from 0003 unless later granted SELECT).
- Idempotent: CREATE OR REPLACE + DROP POLICY IF EXISTS / CREATE.

### Security / RBAC

| Concern | Detail |
|---------|--------|
| Fail-open tradeoff | Without `app.user_id`, wall is **disabled** at DB layer for all helper-based policies |
| Dual-mode design | Dev/demo/read-path open; production withRls closed |
| Audit SELECT | Open only when `app.user_id` IS NULL — under withRls, still no SELECT visibility via this policy |
| Risk | Any connection that forgets to set `app.user_id` sees all walls open |
| Risk | Malicious/misconfigured session that unsets user_id defeats wall |
| Apply privilege | CREATE OR REPLACE on functions needs function owner or superuser; comment: apply as `postgres` |

### Coupling

- **Direct override** of 0003 helpers — must be applied after 0003.
- **App contract**: `withRls` must set `app.user_id` for enforcement; reads currently omit it intentionally.
- **15 operational policies** remain as defined in 0003; behavior changes only via helpers.
- **audit_log** now has two independent policies: INSERT (`audit_log_insert_rls`) + SELECT (`audit_log_select_rls`).
- References `/compliance/audit` UI, feature query modules, `actions.ts` write path.

### Risks / TODOs

1. **Security model is dual-mode by design** — production must reliably set `app.user_id` on every sensitive session; failure fails open.
2. **Production audit under withRls** still cannot SELECT via this policy; separate hardening needed (comment acknowledges).
3. **GRANT vs policy**: 0003 did not `GRANT SELECT ON audit_log TO crm_app`; if app ever uses `crm_app` for reads, SELECT still denied at privilege level (owner `crm` + FORCE RLS is the intended path for audit viewer).
4. **No WITH CHECK change** — write-time wall still uses same helpers (fail-open if user_id unset on writes too).
5. Apply: `sudo -u postgres psql -d binary_crm -f drizzle/0004_rls_fix.sql`.

---

## 3. `drizzle/0005_indexes.sql`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/drizzle/0005_indexes.sql` |
| **Lines** | 147 |
| **Role** | Database migration — performance indexes for hot query paths; documentation of intentional omissions |
| **Track / ownership** | Performance pass; schema-only; coexists with `src/db/schema/*` index definitions |
| **Exports** | None. Creates extension `pg_trgm` (if needed) and indexes (IF NOT EXISTS). |
| **Imports** | Tables/columns: `party` (`legal_name`, `deleted_at`, `created_at`), `deal` (`status`, `deleted_at`), `credit_analysis` (`party_id`), `kyc_record` (`status`, `rekyc_due_date`, `party_id`), `audit_log` (`occurred_at`), `interaction` (`occurred_at`, `party_id`), `task` (`status`, `assignee_user_id`, `due_date`), `document` (`document_type`, `deal_id`), `financial_model` (`model_type`, `deal_id`). Operator class `gin_trgm_ops` (pg_trgm). Pre-existing indexes from Drizzle schema (referenced by exact names). |
| **Business purpose** | Speed list explorers, dashboard aggregates, pipeline boards, KYC/credit panels, audit history, tasks, documents, models — without altering tables/columns. Prefer partial indexes for soft-deleted “live” rows. Avoid redundant indexes already covered by composites. |

### Key logic

#### Extension

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Required for GIN trigram ILIKE / `%q%` search on `party.legal_name`.

#### Indexes created (or no-op if exists)

| Index name | Table | Definition | Hot path |
|------------|-------|------------|----------|
| `party_legal_name_trgm_idx` | `party` | `USING gin (legal_name gin_trgm_ops)` | `listParties` fuzzy `q` |
| `party_deleted_at_idx` | `party` | `(deleted_at)` | soft-delete ordering / admin scans |
| `party_created_at_idx` | `party` | `(created_at)` | recent-party / default sort |
| `deal_status_idx` | `deal` | `(status) WHERE deleted_at IS NULL` | dashboard open deals by stage; pipeline board |
| `deal_deleted_at_idx` | `deal` | `(deleted_at)` | soft-delete ordering |
| `credit_analysis_party_idx` | `credit_analysis` | `(party_id)` | credit list / dashboard (likely already exists) |
| `kyc_record_status_idx` | `kyc_record` | `(status)` | KYC list filters |
| `kyc_record_rekyc_idx` | `kyc_record` | `(rekyc_due_date)` | expiring-soon dashboard |
| `kyc_record_party_idx` | `kyc_record` | `(party_id)` | party-scoped KYC |
| `audit_log_occurred_at_idx` | `audit_log` | `(occurred_at)` | entity history ORDER BY |
| `interaction_occurred_at_idx` | `interaction` | `(occurred_at)` | recent-activity rail |
| `interaction_party_idx` | `interaction` | `(party_id)` | party timeline |
| `task_status_idx` | `task` | `(status)` | worklist filters |
| `task_assignee_idx` | `task` | `(assignee_user_id)` | my-tasks |
| `task_due_date_idx` | `task` | `(due_date)` | due-date filters |
| `document_type_idx` | `document` | `(document_type)` | document explorer |
| `document_deal_idx` | `document` | `(deal_id)` | deal documents |
| `financial_model_type_idx` | `financial_model` | `(model_type)` | modeling library |
| `financial_model_deal_idx` | `financial_model` | `(deal_id)` | deal models |

#### Deliberately skipped (documented)

| Omission | Reason |
|----------|--------|
| Standalone `deal_type` index | Leading column of existing `deal_type_status_brand_idx` |
| `credit_analysis.status` btree | **No `status` column** — lifecycle via `valid_to` / `superseded_by`; current rows served by `credit_analysis_current_idx (party_id, valid_to)` |
| Standalone `audit_log.entity_type` | Leading column of `audit_log_entity_idx (entity_type, entity_id)` |
| Standalone `exposure(party_id)` | Leading column of `exposure_party_date_idx (party_id, as_of_date)` |
| New party identifier unique | Already from schema |

#### Notes on partial vs plain btree

- Live filters `WHERE deleted_at IS NULL` partly covered by existing partial uniques (`party_soft_delete_idx`, `party_legal_name_country_uidx`, `deal_deal_code_uidx`).
- Plain `deleted_at` btrees still added for ordering and per optimization spec (low selectivity for IS NULL filter alone).

### Side effects

- Extension install if missing.
- Additional index storage + write amplification on INSERT/UPDATE for tables listed.
- `CREATE INDEX IF NOT EXISTS` — concurrent-safe re-run; may still lock for new indexes depending on PG version/options (not `CONCURRENTLY` here).
- No data/column changes.

### Security / RBAC

- None directly. Indexes do not grant privileges.
- Extension creation may require superuser on first install.
- Indexes on RLS-forced tables still used under policies; no security bypass via index.

### Coupling

- **Name-coupled** to Drizzle schema index names — reuse exact names for no-ops.
- **Query-coupled** to dashboard/command-center, listParties, pipeline board, KYC/credit panels, task worklist, document explorer, financial models.
- Assumes columns exist (`task.assignee_user_id`, `document.document_type`, etc.).
- Independent of RLS migrations 0003/0004 (orthogonal).

### Risks / TODOs

1. **Not `CREATE INDEX CONCURRENTLY`** — can block writes on large tables during apply.
2. **Redundant indexes** if schema already created them — harmless no-ops, but migration noise.
3. **`party_deleted_at_idx` / `deal_deleted_at_idx`** low value for pure `IS NULL` filters (acknowledged).
4. **Drift risk** if schema renames indexes while this file keeps old names → accidental duplicate indexes under different names.
5. **task table** not in 0003 walled list — indexes here imply task is first-class but outside wall policies of 0003.
6. Apply: `sudo -u postgres psql -d binary_crm -f drizzle/0005_indexes.sql`.

---

## 4. `drizzle/0006_leads.sql`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/drizzle/0006_leads.sql` |
| **Lines** | 63 |
| **Role** | Database migration — Lead & Opportunity Management schema extension on `party` |
| **Track / ownership** | Track Leads / CRM; owns `drizzle/0006_leads.sql` |
| **Exports** | None. Adds column `party.lead_meta jsonb`; indexes `party_lead_meta_present_idx`, `party_lead_stage_idx`. |
| **Imports** | Table `party` (must exist with `party_id`, `deleted_at`). Conceptually links to `app_user.user_id`, `deal.deal_id`, `deal_type` enum values — stored as JSON text, not FKs. Application: leads feature (seed, pipeline/kanban, win conversion `winLead`). |
| **Business purpose** | Model CRM leads as prospect relationships qualifying toward a mandate **without** a parallel entity table. A party is a lead iff `lead_meta IS NOT NULL`. Keeps leads on party master (RLS, dedup, identifiers, relationship graph). Won leads convert to real `deal` rows; pre-mandate leads never pollute Deals board. |

### Key logic

#### Column

```sql
ALTER TABLE party
  ADD COLUMN IF NOT EXISTS lead_meta jsonb;
```

- Nullable JSONB; existing parties remain non-leads (`NULL`).
- No default, no backfill — seed/feature writes populate.
- ADDITIVE ONLY: no column alterations, no data mutation, party RLS unchanged (column rides existing `party_rls`).

#### Documented `lead_meta` shape (application contract, not DB CHECK)

| Key | Type / values | Notes |
|-----|----------------|-------|
| `stage` | `new \| qualified \| opportunity \| won \| lost` | Funnel stage |
| `source` | `referral \| website \| event \| cold_call \| existing_client` | Origin |
| `dealType` | deal_type enum string (e.g. `bond_underwriting`, `m_and_a`) | Intended mandate type |
| `estSizeCr` | numeric | Estimated size ₹ Cr |
| `probability` | int 0–100 | Win probability |
| `expectedClose` | ISO date `yyyy-mm-dd` or null | Close target |
| `assignedRm` | uuid text (`app_user.user_id`) or null | RM assignment |
| `contactName` / `contactTitle` / `contactEmail` / `contactPhone` | text | Lead contact |
| `bant` | `{ budget, authority, need, timeline }` booleans | BANT qualification |
| `notes` | free text | |
| `lossReason` | text | When stage = lost |
| `convertedDealId` | `deal.deal_id` uuid text or null | Set on win conversion |
| `createdAt` / `updatedAt` | ISO timestamps | Lead blob lifecycle |

#### Indexes

```sql
CREATE INDEX IF NOT EXISTS party_lead_meta_present_idx
  ON party (party_id)
  WHERE lead_meta IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS party_lead_stage_idx
  ON party ((lead_meta->>'stage'))
  WHERE lead_meta IS NOT NULL AND deleted_at IS NULL;
```

| Index | Purpose |
|-------|---------|
| `party_lead_meta_present_idx` | Tiny partial index of live leads; pipeline “is lead” query |
| `party_lead_stage_idx` | Expression index on stage for kanban GROUP BY / stage filter |

### Side effects

- Widens `party` row storage for parties that receive `lead_meta`.
- Two partial indexes; write cost only when `lead_meta` / soft-delete changes for leads.
- Does not touch deals module schema.
- Safe to re-run (`IF NOT EXISTS`).

### Security / RBAC

- **No new policies** — lead data inherits `party_rls` / wall via `barrier_id` on party.
- Under 0004 fail-open: leads visible when `app.user_id` unset like other parties.
- Under withRls: wall-clear on party barrier required.
- JSONB content is not column-level secured; any party-visible actor sees full `lead_meta` (including contact PII: email/phone).
- No FK integrity: `assignedRm` / `convertedDealId` are free-text UUIDs inside JSON — can dangle.

### Coupling

- **Party master** is single source of truth; avoids duplicate entity store.
- **Deals module**: conversion creates deal; `convertedDealId` back-link; no deal until win.
- **party_type** intentionally not forced to `prospect` — existing clients can be leads (`source='existing_client'`).
- App layers: leads seed, pipeline/kanban queries, command-bar stage filter, `winLead` action.
- Expression index couples to key name `'stage'` — rename breaks index usefulness without migration.

### Risks / TODOs

1. **No JSON schema validation in DB** — invalid stages/types accepted; enforcement is application-only.
2. **No foreign keys** for `assignedRm`, `convertedDealId` — orphan references possible.
3. **PII in JSONB** — harder to column-mask/encrypt selectively.
4. **GIN/JSONB query cost** if filtering many keys without expression indexes (only `stage` indexed).
5. **Soft-delete**: partial indexes exclude `deleted_at IS NOT NULL`; restored parties reappear as leads if meta still set.
6. **Won/lost history**: keeping `lead_meta` after conversion may still show party in lead-present index if meta not nullified — product decision (meta likely retained with stage `won` + `convertedDealId`).
7. **RLS/wall**: lead for a barriered party is fully hidden from uncleared users — correct for wall, may surprise sales ops without mandate/wall clear.
8. Apply: `psql "postgresql://crm:crm@127.0.0.1:5432/binary_crm" -f drizzle/0006_leads.sql` (owner `crm`, not necessarily superuser).

---

## Cross-file summary (batch 002)

| Migration | Primary concern | Depends on | Supersedes / extends |
|-----------|-----------------|------------|----------------------|
| `0003_rls.sql` | Wall RLS + audit immutability + `crm_app` | Base schema tables | — |
| `0004_rls_fix.sql` | Fail-open helpers + audit SELECT | 0003 functions/policies | 0003 helper semantics; adds audit SELECT |
| `0005_indexes.sql` | Hot-path indexes | Schema + existing indexes | — (orthogonal to RLS) |
| `0006_leads.sql` | `party.lead_meta` + lead indexes | `party` table | Extends party for Leads track |

### Architectural narrative

1. **0003** installs a **fail-closed** information barrier at PostgreSQL for 15 operational tables + append-only hash-chained audit.
2. **0004** discovers app reads do not set RLS GUCs and **flips helpers to fail-open** when `app.user_id` is null, plus opens audit SELECT in that mode — restoring UX while leaving withRls enforcement for production writes/contexts.
3. **0005** is a **performance-only** pass: pg_trgm + btree/partial indexes aligned to dashboards and lists, carefully avoiding duplicates of Drizzle composites.
4. **0006** implements leads **as JSONB on party**, not a parallel table, so wall RLS and entity identity remain unified; conversion to deal is an application event (`convertedDealId`).

### Global risks across batch

- **RLS dual-mode (fail-open vs withRls)** is the dominant security design tension; incorrect session setup opens walls.
- **Hardcoded `crm_app` password** in 0003.
- **Audit chain concurrency** and **INSERT-only + selective SELECT** split across 0003/0004.
- **Leads integrity** is application-level only (JSONB contract).
- **Indexes** not concurrent; apply-time locks possible on large datasets.
- **task** indexed in 0005 but not in 0003’s 16 walled tables — wall coverage incomplete for tasks if sensitive.

---

*End of agent-002 analysis.*
