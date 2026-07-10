-- 0008_users_app_user_id.sql — add + backfill the app_user_id link column on `users`.
-- ===========================================================================
-- Track B / AUTH linkage fix. Owns: drizzle/0008_users_app_user_id.sql.
--
-- PROBLEM: the Drizzle schema (db/schema/auth.ts) declares `users.app_user_id`
-- as the 1:1 link from the Auth.js identity row to the CRM profile
-- (app_user.user_id), and the feature read queries (leads/onboarding/matching)
-- join `users usr ON usr.app_user_id = app_user.user_id` to surface the RM
-- display name. But the LIVE Neon `users` table was created by the
-- @auth/drizzle-adapter with only the standard adapter columns
-- (id, name, email, email_verified, image) — the `app_user_id` column was
-- never added. As a result every RM-name join throws
-- `column usr.app_user_id does not exist`, the leads / onboarding / matching
-- page queries fail, and those three routes render only their heading (the
-- error boundary swallows the rest). db/seed.ts already tries to backfill
-- `users.app_user_id` but wraps the UPDATE in an EXCEPTION-swallowing DO
-- block, so the missing column fails silently there too.
--
-- FIX: add the column the schema already declares, backfill it from the
-- email join (app_user.email = users.email — the real Neon linkage today),
-- and add the FK the schema's MIGRATION NOTE calls for. This makes the live
-- DB match the declared schema, unblocks the three feature read paths without
-- touching the frozen schema files or the queries, and lets the seed's
-- backfill succeed going forward.
--
-- ADDITIVE ONLY: one nullable column + one backfill UPDATE + one FK. No
-- existing column is changed, no data is destroyed. The UPDATE is idempotent
-- (only fills NULLs). Safe to re-run.
--
-- Apply with:
--   psql "$DATABASE_URL" -f drizzle/0008_users_app_user_id.sql

-- ── 1. Add the link column the schema already declares ────────────────────
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "app_user_id" uuid;

-- ── 2. Backfill from the email join (the real linkage on Neon today) ──────
-- Only fills rows that are still NULL, so re-runs are no-ops and any
-- manually-set link is preserved.
UPDATE "users" u
  SET "app_user_id" = au."user_id"
  FROM "app_user" au
  WHERE u."email" = au."email"
    AND u."app_user_id" IS NULL;

-- ── 3. FK: users.app_user_id → app_user.user_id (ON DELETE SET NULL) ──────
-- Matches the schema's MIGRATION NOTE in db/schema/auth.ts. Drop-then-create
-- so the constraint name is stable and the migration is re-runnable.
ALTER TABLE "users"
  DROP CONSTRAINT IF EXISTS "users_app_user_id_app_user_user_id_fk";

ALTER TABLE "users"
  ADD CONSTRAINT "users_app_user_id_app_user_user_id_fk"
  FOREIGN KEY ("app_user_id") REFERENCES "app_user"("user_id")
  ON DELETE SET NULL;

-- ── 4. Index for the reverse join (app_user → users by app_user_id) ───────
CREATE INDEX IF NOT EXISTS "users_app_user_id_idx"
  ON "users" ("app_user_id")
  WHERE "app_user_id" IS NOT NULL;
