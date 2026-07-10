-- 0002_auth.sql — Track B / AUTH: credentials auth columns on app_user.
--
-- Adds password + TOTP MFA + account-lockout columns to app_user so the
-- Auth.js Credentials provider (src/lib/auth.ts) can do a REAL bcrypt verify,
-- optional TOTP MFA (otpauth), and lockout enforcement — replacing the
-- DEV-ONLY "any non-empty password" stub.
--
-- All columns are ADDITIVE (no drops, no type changes to existing columns),
-- so this is safe to run on a live, seeded database. `IF NOT EXISTS` guards
-- make it re-runnable.
--
-- PRODUCTION NOTE: `mfa_secret` is stored as plain text here. Before prod,
-- wrap it at rest (pgcrypto `pgp_sym_encrypt` or app-layer AES-GCM with a
-- KMS-wrapped key) — a leaked TOTP secret defeats the second factor
-- (ARCHITECTURE §4.7). That change is a follow-up migration, not this one.

ALTER TABLE "app_user"
  ADD COLUMN IF NOT EXISTS "password_hash" text,
  ADD COLUMN IF NOT EXISTS "mfa_secret" text,
  ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "failed_login_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locked_until" timestamp with time zone;
