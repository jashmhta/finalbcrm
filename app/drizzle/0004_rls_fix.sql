-- 0004_rls_fix.sql — RLS fail-open + audit_log read visibility
-- ===========================================================================
-- Track B / RLS fix. Owns: drizzle/0004_rls_fix.sql.
--
-- PROBLEM (introduced by 0003_rls.sql): the wall predicates are FAIL-CLOSED
-- for walled rows whenever the RLS GUCs (app.user_id / app.wall) are not set.
-- The app's feature read queries (src/features/*/queries.ts) execute against
-- the shared `db` client directly — they do NOT call withRls/withContext first
-- (only the write paths in actions.ts do). So on every read the GUCs are unset,
-- `current_setting('app.user_id', true)` is NULL, and 0003's predicates reduce
-- to `barrier_id IS NULL` only — i.e. every barriered row is hidden. The result
-- is "permission denied" / empty pages for any feature whose data carries a
-- barrier_id (document, allocation_event, trade_event, credit_analysis, …) and,
-- for audit_log, an entirely empty viewer (0003 gave audit_log an INSERT-only
-- policy with no SELECT/USING clause, so FORCE RLS hides every audit row from
-- the app role — the /compliance/audit page renders zero rows).
--
-- FIX — two coordinated changes, both idempotent (CREATE OR REPLACE FUNCTION +
-- DROP IF EXISTS / CREATE POLICY):
--
--   (1) FAIL-OPEN the three shared predicate helpers when no user context is
--       set. The 15 operational policies (party, deal, deal_party, interaction,
--       interaction_attendee, document, credit_analysis, financial_model,
--       allocation_event, trade_event, kyc_record, consent_record,
--       external_rating, exposure, credit_limit) all consult these helpers, so
--       redefining the helpers is the single auditable place that flips every
--       policy's behaviour at once:
--
--         rls_wall_clear(b)  = app.user_id IS NULL          -- no context → open
--                              OR b IS NULL                 -- unwalled → open
--                              OR b::text = ANY(app.wall)   -- cleared → open
--         rls_deal_visible   = app.user_id IS NULL
--                              OR EXISTS(deal wall-clear OR mandated)
--         rls_party_visible  = app.user_id IS NULL
--                              OR EXISTS(party wall-clear)
--
--       Semantics: when app.user_id IS NULL (the current read path + any
--       admin/demo session that does not call withRls) ALL rows are visible.
--       When withRls IS called (production per-request context), app.user_id is
--       set and the wall/mandate enforcement applies exactly as 0003 intended.
--       The deal policy's inline `OR deal_id = ANY(app.mandate_ids)` clause is
--       covered automatically: rls_wall_clear short-circuits to TRUE when
--       app.user_id IS NULL, so the whole USING expression is TRUE.
--
--   (2) Add a fail-open SELECT policy on audit_log so the immutable viewer can
--       read the chain in admin/demo mode. 0003 deliberately made audit_log
--       INSERT-only (no SELECT grant/policy) for crm_app; but the table is
--       FORCE-RLS'd, so the OWNER role `crm` (which the app connects as) also
--       sees zero rows — the audit page is blank. This migration adds:
--         CREATE POLICY audit_log_select_rls ON audit_log
--           FOR SELECT USING (current_setting('app.user_id', true) IS NULL);
--       i.e. audit rows are readable when no per-user RLS context is set (the
--       app's read path). The INSERT-only `audit_log_insert_rls` policy and the
--       immutability/hash-chain triggers from 0003 are untouched. Production
--       hardening (role-gated audit reads under withRls) is a separate concern.
--
-- Idempotent + safe to re-run. Apply as a superuser the first time:
--   sudo -u postgres psql -d binary_crm -f drizzle/0004_rls_fix.sql
-- The functions are owned by whoever ran 0003; CREATE OR REPLACE needs the
-- function owner or superuser, so applying as `postgres` always works.

-- ---------------------------------------------------------------------------
-- (1) Fail-open predicate helpers. CREATE OR REPLACE keeps the signatures
-- identical, so every policy that already calls these functions picks up the
-- new behaviour without being dropped/recreated.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION rls_wall_clear(barrier uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.user_id', true) IS NULL
      OR barrier IS NULL
      OR barrier::text = ANY(COALESCE(current_setting('app.wall', true)::text[],
                                      ARRAY[]::text[]))
$$;

CREATE OR REPLACE FUNCTION rls_deal_visible(d_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.user_id', true) IS NULL
      OR EXISTS (
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
  SELECT current_setting('app.user_id', true) IS NULL
      OR EXISTS (
    SELECT 1 FROM party p
    WHERE p.party_id = p_id AND rls_wall_clear(p.barrier_id))
$$;

-- ---------------------------------------------------------------------------
-- (2) audit_log SELECT policy (fail-open when no per-user context). The
-- INSERT-only policy from 0003 is preserved (different command → independent).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_log_select_rls ON audit_log;
CREATE POLICY audit_log_select_rls ON audit_log
  FOR SELECT TO PUBLIC
  USING (current_setting('app.user_id', true) IS NULL);
