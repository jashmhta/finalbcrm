-- 0009_rls_guc_safe.sql — make RLS GUC array casts resilient to empty/missing values.
-- ===========================================================================
-- Track B / RLS fix. Owns: drizzle/0009_rls_guc_safe.sql.
--
-- PROBLEM: rls_wall_clear + rls_deal_visible cast the app.wall / app.mandate_ids
-- GUCs to text[]/uuid[] inline:
--   COALESCE(current_setting('app.wall', true)::text[], ARRAY[]::text[])
-- That cast throws "malformed array literal: ''" when the GUC holds an empty
-- STRING (not NULL, not '{}'). Postgres OR does not guarantee short-circuit
-- evaluation, so even when the fail-open branch (app.user_id IS NULL) is TRUE,
-- the array cast can still be evaluated and throw — which aborts the whole
-- query. This surfaces as a 500 on the RSC re-render after ANY withRls write
-- action (createLead, updateBant, …): the withRls transaction sets the GUCs
-- via SET LOCAL, the transaction commits, the connection returns to the pool,
-- and the subsequent read pass (revalidatePath re-render) on a reused
-- connection sees the GUC in an empty-string state and the RLS function blows
-- up. The /leads/[id] re-render after updateBant was the reproducer.
--
-- FIX: add two stable helper functions that parse a GUC text value to an array
-- WITHOUT throwing on NULL / '' / malformed input, then redefine rls_wall_clear
-- + rls_deal_visible to use them. The helpers return an empty array for any
-- non-parseable value, so the ANY() check simply matches nothing. There is no
-- fail-open branch for missing app.user_id; request code must set RLS context
-- when it needs access to walled rows.
--
-- Idempotent (CREATE OR REPLACE). Safe to re-run.
--
-- Apply with:
--   psql "$DATABASE_URL" -f drizzle/0009_rls_guc_safe.sql

-- ── 1. rls_guc_text_array — safely parse a GUC to text[] ───────────────────
-- NULL / '' / unparseable → ARRAY[]::text[] (never throws).
CREATE OR REPLACE FUNCTION rls_guc_text_array(val text)
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN val IS NULL OR btrim(val) = '' THEN ARRAY[]::text[]
    ELSE
      COALESCE(
        NULLIF(val, '')::text[],
        ARRAY[]::text[]
      )
  END
$$;

-- ── 2. rls_guc_uuid_array — safely parse a GUC to uuid[] ───────────────────
-- NULL / '' / unparseable → ARRAY[]::uuid[] (never throws). Wraps the cast in
-- a CASE so a malformed literal never aborts the calling query.
CREATE OR REPLACE FUNCTION rls_guc_uuid_array(val text)
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN val IS NULL OR btrim(val) = '' THEN ARRAY[]::uuid[]
    ELSE
      COALESCE(
        NULLIF(val, '')::uuid[],
        ARRAY[]::uuid[]
      )
  END
$$;

-- ── 3. rls_wall_clear — use the safe text-array helper ────────────────────
CREATE OR REPLACE FUNCTION rls_wall_clear(barrier uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT barrier IS NULL
      OR barrier::text = ANY(rls_guc_text_array(current_setting('app.wall', true)))
$$;

-- ── 4. rls_deal_visible — use the safe text-array + uuid-array helpers ────
CREATE OR REPLACE FUNCTION rls_deal_visible(d_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM deal d
    WHERE d.deal_id = d_id
      AND (rls_wall_clear(d.barrier_id)
           OR d.deal_id = ANY(rls_guc_uuid_array(current_setting('app.mandate_ids', true)))))
$$;
