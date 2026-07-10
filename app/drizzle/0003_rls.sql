-- 0003_rls.sql — Row Level Security + immutable, tamper-evident audit_log
-- ===========================================================================
-- Track B / RLS. Owns: drizzle/0003_rls.sql, src/db/rls.ts.
--
-- This migration is a POLICY + ROLE + GRANT + TRIGGER layer. It does NOT alter
-- any table's columns (schema is preserved per the track rules). It:
--   (a) creates a non-superuser, non-BYPASSRLS application role `crm_app`;
--   (b) ENABLES + FORCES ROW LEVEL SECURITY on the 16 walled tables;
--   (c) creates SELECT/INSERT/UPDATE policies driven by the GUCs set in
--       src/db/context.ts (app.user_id, app.wall text[], app.mandate_ids uuid[]);
--   (d) installs an audit_log hash-chain BEFORE INSERT trigger (tamper-evident
--       row_hash = sha256(prev_hash || payload)) and a reject-non-INSERT
--       BEFORE UPDATE/DELETE/TRUNCATE trigger;
--   (e) GRANTs: crm_app gets SELECT/INSERT/UPDATE on operational tables and
--       INSERT-ONLY on audit_log (no UPDATE/DELETE/TRUNCATE).
--
-- Idempotent: re-running is safe (DROP ... IF EXISTS + CREATE, IF NOT EXISTS,
-- DO-block role provisioning). FORCE RLS is reapplied as a no-op.
--
-- Privilege note: steps (a) CREATE ROLE and the pgcrypto extension require a
-- superuser / DBA one-time. Steps (b)-(e) only require the table OWNER (`crm`).
-- Apply as a superuser the first time:
--   sudo -u postgres psql -d binary_crm -f drizzle/0003_rls.sql
-- Re-applying the policy/trigger/grant layer from Node (as `crm`) is supported
-- by src/db/rls.ts `applyRlsMigration()` — the role/extension statements are
-- tolerated (skipped with a warning) when the caller lacks CREATEROLE.

-- ---------------------------------------------------------------------------
-- (a) pgcrypto (for digest()) + the application role
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Provision crm_app idempotently. CREATE ROLE has no IF NOT EXISTS, so guard it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_app') THEN
    CREATE ROLE crm_app
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS
      PASSWORD 'crm_app';
  END IF;
END $$;

-- Login + password are set every run so the role is usable regardless of how
-- it was first created.
ALTER ROLE crm_app
  LOGIN
  NOSUPERUSER
  NOBYPASSRLS
  PASSWORD 'crm_app';

-- ---------------------------------------------------------------------------
-- (e.0) Schema + sequence grants (must precede table grants for usability)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO crm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO crm_app;

-- ---------------------------------------------------------------------------
-- Shared RLS predicate helpers (STABLE SQL functions). Centralising the wall
-- rule keeps the policies auditable and avoids drift across 15 tables.
--
--   rls_wall_clear(barrier)  -> barrier IS NULL OR barrier in app.wall
--   rls_deal_visible(deal)   -> the deal is wall-clear OR in app.mandate_ids
--   rls_party_visible(party) -> the party is wall-clear
--
-- current_setting(..., true) returns NULL when a GUC is unset; COALESCE turns
-- that into an empty array so the `= ANY(...)` test is FALSE rather than NULL.
-- This makes policies FAIL-CLOSED for walled rows when no context is set,
-- while keeping barrier_id IS NULL rows always visible.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rls_wall_clear(barrier uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT barrier IS NULL
      OR barrier::text = ANY(COALESCE(current_setting('app.wall', true)::text[],
                                      ARRAY[]::text[]))
$$;

CREATE OR REPLACE FUNCTION rls_deal_visible(d_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM deal d
    WHERE d.deal_id = d_id
      AND (rls_wall_clear(d.barrier_id)
           OR d.deal_id = ANY(COALESCE(current_setting('app.mandate_ids', true)::uuid[],
                                       ARRAY[]::uuid[]))))
$$;

CREATE OR REPLACE FUNCTION rls_party_visible(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM party p
    WHERE p.party_id = p_id AND rls_wall_clear(p.barrier_id))
$$;

-- ---------------------------------------------------------------------------
-- (b) ENABLE + FORCE ROW LEVEL SECURITY on the 16 walled tables.
-- FORCE makes the table OWNER subject to the policies too, so a connection
-- string that accidentally points at the owner role cannot bypass the wall.
-- ---------------------------------------------------------------------------
ALTER TABLE party               ENABLE ROW LEVEL SECURITY;
ALTER TABLE party               FORCE  ROW LEVEL SECURITY;
ALTER TABLE deal                ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal                FORCE  ROW LEVEL SECURITY;
ALTER TABLE deal_party          ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_party          FORCE  ROW LEVEL SECURITY;
ALTER TABLE interaction         ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction         FORCE  ROW LEVEL SECURITY;
ALTER TABLE interaction_attendee ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_attendee FORCE  ROW LEVEL SECURITY;
ALTER TABLE document            ENABLE ROW LEVEL SECURITY;
ALTER TABLE document            FORCE  ROW LEVEL SECURITY;
ALTER TABLE credit_analysis     ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_analysis     FORCE  ROW LEVEL SECURITY;
ALTER TABLE financial_model     ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_model     FORCE  ROW LEVEL SECURITY;
ALTER TABLE allocation_event    ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_event    FORCE  ROW LEVEL SECURITY;
ALTER TABLE trade_event         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_event         FORCE  ROW LEVEL SECURITY;
ALTER TABLE kyc_record          ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_record          FORCE  ROW LEVEL SECURITY;
ALTER TABLE consent_record      ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_record      FORCE  ROW LEVEL SECURITY;
ALTER TABLE external_rating     ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_rating     FORCE  ROW LEVEL SECURITY;
ALTER TABLE exposure            ENABLE ROW LEVEL SECURITY;
ALTER TABLE exposure            FORCE  ROW LEVEL SECURITY;
ALTER TABLE credit_limit        ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_limit        FORCE  ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           FORCE  ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- (c) POLICIES. PostgreSQL has no `CREATE POLICY IF NOT EXISTS`; the
-- idempotent pattern is DROP IF EXISTS + CREATE. Each operational table gets a
-- single FOR ALL policy (USING for read/UPDATE/DELETE visibility, WITH CHECK
-- gating INSERT/UPDATE to rows the actor may see).
-- ---------------------------------------------------------------------------

-- party — wall-clear only.
DROP POLICY IF EXISTS party_rls ON party;
CREATE POLICY party_rls ON party
  FOR ALL TO PUBLIC
  USING (rls_wall_clear(barrier_id))
  WITH CHECK (rls_wall_clear(barrier_id));

-- deal — wall-clear OR on a mandated deal.
DROP POLICY IF EXISTS deal_rls ON deal;
CREATE POLICY deal_rls ON deal
  FOR ALL TO PUBLIC
  USING (rls_wall_clear(barrier_id)
         OR deal_id = ANY(COALESCE(current_setting('app.mandate_ids', true)::uuid[],
                                   ARRAY[]::uuid[])))
  WITH CHECK (rls_wall_clear(barrier_id)
              OR deal_id = ANY(COALESCE(current_setting('app.mandate_ids', true)::uuid[],
                                         ARRAY[]::uuid[])));

-- deal_party — visible when its deal is visible.
DROP POLICY IF EXISTS deal_party_rls ON deal_party;
CREATE POLICY deal_party_rls ON deal_party
  FOR ALL TO PUBLIC
  USING (rls_deal_visible(deal_id))
  WITH CHECK (rls_deal_visible(deal_id));

-- interaction — wall-clear, or its deal/party is visible.
DROP POLICY IF EXISTS interaction_rls ON interaction;
CREATE POLICY interaction_rls ON interaction
  FOR ALL TO PUBLIC
  USING (rls_wall_clear(barrier_id)
         OR rls_deal_visible(deal_id)
         OR rls_party_visible(party_id))
  WITH CHECK (rls_wall_clear(barrier_id)
              OR rls_deal_visible(deal_id)
              OR rls_party_visible(party_id));

-- interaction_attendee — visible when its interaction is visible.
DROP POLICY IF EXISTS interaction_attendee_rls ON interaction_attendee;
CREATE POLICY interaction_attendee_rls ON interaction_attendee
  FOR ALL TO PUBLIC
  USING (EXISTS (
    SELECT 1 FROM interaction i
    WHERE i.interaction_id = interaction_attendee.interaction_id
      AND (rls_wall_clear(i.barrier_id)
           OR rls_deal_visible(i.deal_id)
           OR rls_party_visible(i.party_id))))
  WITH CHECK (EXISTS (
    SELECT 1 FROM interaction i
    WHERE i.interaction_id = interaction_attendee.interaction_id
      AND (rls_wall_clear(i.barrier_id)
           OR rls_deal_visible(i.deal_id)
           OR rls_party_visible(i.party_id))));

-- document — wall-clear, or its deal/party is visible.
DROP POLICY IF EXISTS document_rls ON document;
CREATE POLICY document_rls ON document
  FOR ALL TO PUBLIC
  USING (rls_wall_clear(barrier_id)
         OR rls_deal_visible(deal_id)
         OR rls_party_visible(party_id))
  WITH CHECK (rls_wall_clear(barrier_id)
              OR rls_deal_visible(deal_id)
              OR rls_party_visible(party_id));

-- credit_analysis — wall-clear, or its deal/party is visible.
DROP POLICY IF EXISTS credit_analysis_rls ON credit_analysis;
CREATE POLICY credit_analysis_rls ON credit_analysis
  FOR ALL TO PUBLIC
  USING (rls_wall_clear(barrier_id)
         OR rls_deal_visible(deal_id)
         OR rls_party_visible(party_id))
  WITH CHECK (rls_wall_clear(barrier_id)
              OR rls_deal_visible(deal_id)
              OR rls_party_visible(party_id));

-- financial_model — visible when its deal or party is visible.
DROP POLICY IF EXISTS financial_model_rls ON financial_model;
CREATE POLICY financial_model_rls ON financial_model
  FOR ALL TO PUBLIC
  USING (rls_deal_visible(deal_id) OR rls_party_visible(party_id))
  WITH CHECK (rls_deal_visible(deal_id) OR rls_party_visible(party_id));

-- allocation_event — wall-clear, or its deal/party is visible.
DROP POLICY IF EXISTS allocation_event_rls ON allocation_event;
CREATE POLICY allocation_event_rls ON allocation_event
  FOR ALL TO PUBLIC
  USING (rls_wall_clear(barrier_id)
         OR rls_deal_visible(deal_id)
         OR rls_party_visible(party_id))
  WITH CHECK (rls_wall_clear(barrier_id)
              OR rls_deal_visible(deal_id)
              OR rls_party_visible(party_id));

-- trade_event — wall-clear, or its deal/party is visible.
DROP POLICY IF EXISTS trade_event_rls ON trade_event;
CREATE POLICY trade_event_rls ON trade_event
  FOR ALL TO PUBLIC
  USING (rls_wall_clear(barrier_id)
         OR rls_deal_visible(deal_id)
         OR rls_party_visible(party_id))
  WITH CHECK (rls_wall_clear(barrier_id)
              OR rls_deal_visible(deal_id)
              OR rls_party_visible(party_id));

-- kyc_record — visible when its party is visible.
DROP POLICY IF EXISTS kyc_record_rls ON kyc_record;
CREATE POLICY kyc_record_rls ON kyc_record
  FOR ALL TO PUBLIC
  USING (rls_party_visible(party_id))
  WITH CHECK (rls_party_visible(party_id));

-- consent_record — visible when its party is visible.
-- (Contact-only consents with party_id IS NULL are not surfaced by this
--  policy; refine in a later migration if contact-scoped consents need to be
--  walled separately.)
DROP POLICY IF EXISTS consent_record_rls ON consent_record;
CREATE POLICY consent_record_rls ON consent_record
  FOR ALL TO PUBLIC
  USING (rls_party_visible(party_id))
  WITH CHECK (rls_party_visible(party_id));

-- external_rating — visible when its party or deal is visible.
DROP POLICY IF EXISTS external_rating_rls ON external_rating;
CREATE POLICY external_rating_rls ON external_rating
  FOR ALL TO PUBLIC
  USING (rls_party_visible(party_id) OR rls_deal_visible(deal_id))
  WITH CHECK (rls_party_visible(party_id) OR rls_deal_visible(deal_id));

-- exposure — visible when its party is visible.
DROP POLICY IF EXISTS exposure_rls ON exposure;
CREATE POLICY exposure_rls ON exposure
  FOR ALL TO PUBLIC
  USING (rls_party_visible(party_id))
  WITH CHECK (rls_party_visible(party_id));

-- credit_limit — visible when its party is visible.
DROP POLICY IF EXISTS credit_limit_rls ON credit_limit;
CREATE POLICY credit_limit_rls ON credit_limit
  FOR ALL TO PUBLIC
  USING (rls_party_visible(party_id))
  WITH CHECK (rls_party_visible(party_id));

-- audit_log — INSERT-ONLY. No SELECT/UPDATE/DELETE policy exists for crm_app,
-- so with RLS enabled + FORCED the role can only append. WITH CHECK (true)
-- lets the app write any audit row; visibility of audit history is a separate
-- concern (audit_purge / DBA roles, not granted here).
DROP POLICY IF EXISTS audit_log_insert_rls ON audit_log;
CREATE POLICY audit_log_insert_rls ON audit_log
  FOR INSERT TO PUBLIC
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- (d) audit_log immutability + tamper-evident hash chain.
-- ---------------------------------------------------------------------------

-- Reject any non-INSERT operation (UPDATE / DELETE / TRUNCATE) on audit_log.
-- Defense-in-depth: GRANTs already deny UPDATE/DELETE to crm_app; this trigger
-- also catches a future role that is accidentally granted write access, and
-- catches TRUNCATE (which GRANT does not distinguish from other DDL).
CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is INSERT-only (rejected %)', TG_OP;
END $$;

DROP TRIGGER IF EXISTS audit_log_no_update_delete ON audit_log;
CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION audit_log_immutable();

-- Tamper-evident hash chain (ARCHITECTURE §5.1):
--   prev_hash = row_hash of the prior row (by occurred_at, then audit_log_id)
--   row_hash  = sha256( prev_hash || row_to_json(NEW) )
-- The first row chains from an empty-string seed. The hash includes every
-- column of the new row (prev_hash already set, row_hash still NULL at compute
-- time), so any after-the-fact mutation breaks the chain.
--
-- SECURITY DEFINER + fixed search_path: the function must read the GLOBAL
-- previous row to chain correctly, but crm_app has no SELECT grant on
-- audit_log (INSERT-only by design). Running as the DBA owner (postgres, who
-- owns this function) lets it read the true chain tail without leaking SELECT
-- to the app role. The function only assigns NEW columns — it exposes no data.
CREATE OR REPLACE FUNCTION audit_log_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  prev char(64);
BEGIN
  SELECT row_hash INTO prev
  FROM audit_log
  ORDER BY occurred_at DESC, audit_log_id DESC
  LIMIT 1;

  NEW.prev_hash := prev;
  NEW.row_hash := encode(
    digest(
      convert_to(coalesce(prev::text, '') || row_to_json(NEW)::text, 'utf8'),
      'sha256'),
    'hex');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_log_chain ON audit_log;
CREATE TRIGGER audit_log_chain
  BEFORE INSERT ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_chain();

-- ---------------------------------------------------------------------------
-- (e) GRANTs on the walled tables.
-- Operational tables: SELECT, INSERT, UPDATE (no DELETE — soft-delete only).
-- audit_log: INSERT only.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON
  party, deal, deal_party, interaction, interaction_attendee, document,
  credit_analysis, financial_model, allocation_event, trade_event,
  kyc_record, consent_record, external_rating, exposure, credit_limit
  TO crm_app;

GRANT INSERT ON audit_log TO crm_app;
-- Explicitly NO UPDATE / DELETE / TRUNCATE on audit_log for crm_app.

-- Defensive: ensure no accidental audit_log writes beyond INSERT are held.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM crm_app;
