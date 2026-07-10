# Agent 063 — Extreme detail analysis

Batch files: `src/db/domain-check.ts`, `src/db/index.ts`, `src/db/rls.ts`, `src/db/schema/audit.ts`

DB client, RLS operational tooling, domain smoke test, and immutable audit schema.

---

## `src/db/domain-check.ts`

- **Lines:** 166 | **Role:** CLI smoke test for bond pricing + credit ratios + scorecard against live DB
- **Exports:** none (script: `npx tsx src/db/domain-check.ts`); `async function main()`, `function fmt(n, d=4)`
- **Imports:** `node:fs`/`path` env loader; dynamic `./index`, `./schema`; `drizzle-orm`; pure engines `@/features/modeling/bondPricing`, `@/features/credit/ratios`, `@/features/credit/scorecard`
- **Business purpose:** Operator eyeball that seeded financials + engines produce sane Indian-market numbers before demos
- **Key logic:**
  - **(a) Bond pricing:** 10y 7% semi-annual G-Sec, settlement `2026-06-26`, maturity `2036-06-26`, yield 0.07, benchmark 0.0685, dayCount `ACT_365`, face 100. Logs clean/dirty price, AI, YTM, current yield, Mac/Mod duration, convexity, DV01, G-spread (bp), remaining coupons. Expect price ~par, YTM~0.07, duration in (0,10), convexity>0
  - **(b) Ratios:** selects up to 5 `financial_statement` with non-null `line_items`; first successful `computeRatios` prints debt_equity, current_ratio, ebitda_margin, interest_coverage, roe, _ebitda
  - **(c) Scorecard:** walks up to 10 `credit_analysis` rows, latest `credit_analysis_fs_link`, runs ratios + `computeScorecard({ ratios, obligorType })` — prints totalScore (0–100), band, notionalGrade, indicativePd1y, subFactors.length
- **Side effects:** Read-only DB; `process.exit(0|1)`
- **Security / RBAC:** Bypasses app auth — local ops only with DATABASE_URL
- **Coupling:** Live engines + schema tables `credit_analysis`, `credit_analysis_fs_link`, `financial_statement`
- **Risks / TODOs:** Hard-coded 2026 bond dates age out; no CI assertion thresholds (human eyeball only)

---

## `src/db/index.ts`

- **Lines:** 69 | **Role:** Drizzle + postgres-js singleton client
- **Exports:** `export const db`, `export type DB = typeof db`, `export { schema }`
- **Imports:** `drizzle-orm/postgres-js`, `postgres`, `./schema`
- **Business purpose:** Single DB entry for all server queries; India data residency posture (Postgres in ap-south-1)
- **Key logic / pool tuning:**
  - URL: `process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost:5432/placeholder"` — **does not throw at import** so `next build` can load route modules without DB
  - `max: 20`, `prepare: false` (serverless/PgBouncer-safe), `idle_timeout: 30`, `connect_timeout: 10`
  - `connection.application_name = "binary-crm"`
  - SSL: require unless `DATABASE_SSL=false` or URL `sslmode=disable`
  - Dev singleton: `globalThis.__dbClient`
- **Side effects:** Lazy pool; first query fails if URL is placeholder
- **Security:** Credentials only via env; SSL default on for Neon/prod
- **Coupling:** Every feature query/action; schema module graph (auth last)
- **Risks / TODOs:** Comment notes statement_timeout via options removed for Neon; timeouts must be SET LOCAL per query if needed

---

## `src/db/rls.ts`

- **Lines:** 364 | **Role:** Apply + verify RLS migration (`drizzle/0003_rls.sql`)
- **Exports:**
  - `export const WALLED_TABLES` — 16 tables:
    `party`, `deal`, `deal_party`, `interaction`, `interaction_attendee`, `document`, `credit_analysis`, `financial_model`, `allocation_event`, `trade_event`, `kyc_record`, `consent_record`, `external_rating`, `exposure`, `credit_limit`, `audit_log`
  - `export type RlsTableStatus = { table, rlsEnabled, rlsForced, policyCount }`
  - `export type RlsVerifyReport = { crmAppRoleExists, crmAppBypassRls, pgcryptoInstalled, auditLogChainTrigger, auditLogImmutableTrigger, auditLogInsertOnly, tables, wallSmokeTest: { ok, detail } }`
  - `async function applyRlsMigration(): Promise<{ statement, ok, skipped?, error? }[]>`
  - `async function verifyRls(): Promise<RlsVerifyReport>`
  - Internal `function splitSql(script: string): string[]` — respects single quotes, dollar-quotes, line/block comments
- **Imports:** `node:fs/promises`, `node:path`, `node:url`; `drizzle-orm` `sql`; `@/db`
- **Business purpose:** Ops/CI health for Chinese walls + audit immutability + `crm_app` grants
- **Key logic:**
  - `applyRlsMigration`: reads SQL, splits statements, executes as table owner; DBA-only statements (CREATE ROLE/EXTENSION) marked `skipped` on privilege error
  - `verifyRls`: catalog checks for role bypass, pgcrypto, triggers `audit_log_chain` + `audit_log_no_update_delete`, INSERT-only grants on audit_log for `crm_app`
  - Wall smoke test: pick active party-walled barrier from `information_barrier` (party_id IS NOT NULL), SET LOCAL wall to that UUID, count party rows in_wall vs out_wall; **pass = in_wall≥1 AND out_wall=0**
- **Side effects:** Can mutate policy/trigger/grant layer; wall test runs SELECT under txn GUCs
- **Security:** Owner connection applies policies; smoke test embeds only regex-validated UUIDs
- **Coupling:** Migration file path `drizzle/0003_rls.sql`; `information_barrier` registry
- **Risks / TODOs:** Owner role also subject to FORCE RLS; empty barrier registry → smoke test skipped not failed

---

## `src/db/schema/audit.ts`

- **Lines:** 130 | **Role:** Immutable, hash-chained, partition-ready audit_log table
- **Exports:**
  - `export const auditLog = pgTable("audit_log", { ... })`
  - `export const auditLogRelations`
  - `export type AuditLog`, `AuditLogInsert`
- **Imports:** drizzle pg-core columns; `auditOpEnum` from `./enums`; `appUser` from `./rbac`; `informationBarrier`
- **Business purpose & domain:** DATA_MODEL §1.3/§2.22, ARCHITECTURE §5.1 — regulator-grade change history for KYC, consent, deals, users, ratings
- **Key columns / shapes:**
  - PK: `audit_log_id` uuid defaultRandom
  - `entity_type` text NOT NULL, `entity_id` uuid nullable, `field_name` text
  - `old_value` / `new_value` jsonb
  - `operation` auditOpEnum: `insert | update | delete | merge | approve | reject`
  - `actor_user_id` → app_user SET NULL, `actor_role_at_time` text
  - `barrier_id` → information_barrier SET NULL
  - `occurred_at` timestamptz default now NOT NULL
  - `ip_address` inet, `user_agent` text
  - `correlation_id` uuid (ties multi-row ops e.g. merge)
  - Tamper evidence: `prev_hash` char(64), `row_hash` char(64) — trigger-populated chain: `row_hash = sha256(prev_hash || payload)`
- **Indexes:** occurred_at, (entity_type, entity_id), actor, correlation, barrier
- **Immutability design:**
  - No UPDATE/DELETE policies for app role; `audit_purge` role only for retention (§5.6)
  - Migration SQL notes: monthly RANGE partitions by occurred_at; PK must become `(audit_log_id, occurred_at)` when partitioned; BRIN on occurred_at; trigger rejects UPDATE/DELETE/TRUNCATE; chain BEFORE INSERT
- **Side effects:** INSERT-only writes from feature actions; chain/hash triggers on DB
- **Security / RBAC:** Readable under audit:read; walled via barrier_id; insert-only prevents history rewrite
- **Coupling:** All admin/compliance/credit mutations call `appendAudit`; admin queries join actor email
- **Risks / TODOs:** Drizzle cannot declare partitioning — migration manual; hash chain ORDER BY last row race under concurrency; PK/partition migration note is operational debt
