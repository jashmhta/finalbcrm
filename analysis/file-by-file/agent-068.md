# Agent 068 — Extreme detail analysis

Batch files: `src/db/seed-admin.ts`, `src/db/seed-org-users.ts`, `src/db/seed-scale.ts`, `src/db/seed.ts`

Deterministic and operational seed scripts for local/dev CRM data and performance proof.

---

## `src/db/seed-admin.ts`

- **Lines:** 134 | **Role:** Provision admin credentials (Track B AUTH)
- **Exports:** none (CLI `npx tsx src/db/seed-admin.ts`)
- **Imports:** dynamic db/schema; bcryptjs; drizzle and/eq/isNull
- **Business purpose:** Ensure `shray@binarycapital.in` can log in with bcrypt password
- **Key logic:**
  - ADMIN_EMAIL = `shray@binarycapital.in`
  - ADMIN_PASSWORD = `BinaryCapital@2026` (printed once to stdout; rotate in prod)
  - bcrypt cost **10** hashSync
  - Upsert app_user: set password_hash, clear lockout, mfa disabled
  - If missing: insert desk=management, barrierClearance `["wall-ib","wall-credit"]`
  - Ensure current user_role grant to role name `admin`
- **Side effects:** Writes app_user + user_role; prints plaintext password
- **Security:** Dev default password risk if run against prod; password never written to files
- **Coupling:** role name `admin` from main seed
- **Risks / TODOs:** Hardcoded password in source; cost 10 vs seed-org 12 inconsistency

---

## `src/db/seed-org-users.ts`

- **Lines:** 236 | **Role:** Binary Capital/Bonds org roster from CEO notes
- **ORG roster:**
  | Email | Name | Level | Brand | Desk | Roles |
  |-------|------|-------|-------|------|-------|
  | shray@binarycapital.in | Shray Vasudeva | super_admin | shared | management | super_admin, admin |
  | shahrukh@binarycapital.in | Shahrukh Sheikh | super_admin | binarycapital | ib_advisory | super_admin, admin |
  | rati@binarybonds.in | Rati Ravi Kant | super_admin | binarybonds | credit | super_admin, admin |
  | niraj@binarybonds.in | Niraj | super_admin | binarybonds | bond_underwriting | super_admin, admin |
  | yash@binarycapital.in | Yash | employee | binarycapital | ib_advisory | coverage_rm |
  | pranjali@binarycapital.in | Pranjali | employee | binarycapital | operations | coverage_rm |
  | tashmit@binarybonds.in | Tashmit | employee | binarybonds | bond_underwriting | bond_desk |
- **DEFAULT_PASSWORD:** env `SEED_ORG_PASSWORD` ?? `BinaryCrm!2026`; bcrypt cost **12**
- Creates roles if missing: super_admin, admin, coverage_rm, bond_desk with desk-specific descriptions
- Idempotent upsert by email; grants current roles
- **Security:** Shared default password for all; printed at end
- **Risks:** Super_admin barrier clearance empty for employees comment; supers get open wall “later via admin”

---

## `src/db/seed-scale.ts`

- **Lines:** large (~400+) | **Role:** 10k-party scale seed + listParties perf proof (IMPORT-PERF)
- **Business:** Additive to demo seed; does NOT truncate demo data
- **Key logic:**
  - Identifies scale rows via `party.source_ref = 'seed-scale'` and `deal.deal_code LIKE 'SCALE-%'`
  - Re-run deletes only its own rows first
  - mulberry32 PRNG seed **20260627** for determinism
  - Indian states/cities, name PREFIX×SUFFIX generators, party types, deal types
  - Creates pg_trgm extension + GIN indexes IF NOT EXISTS (self-contained perf, doesn't touch drizzle journal)
  - Performance check mirrors production listParties (ilike + OFFSET + signals) — **target <200ms at 10k**
- **Side effects:** Heavy inserts; index creation
- **Security:** Local ops; not for prod
- **Coupling:** parties/queries path; schema tables
- **Risks:** Large DB growth; trgm indexes outside migration journal

---

## `src/db/seed.ts`

- **Lines:** very large (1000+) | **Role:** Full demo dataset for binary_crm
- **Run:** `npx tsx src/db/seed.ts` — **TRUNCATEs every table CASCADE** then inserts (destructive)
- **PRNG:** mulberry32 seed **20260626** — shape/relationships deterministic; UUIDs differ per run
- **Insertion order** (FK-respecting, mirrors schema/index header):
  sector_code → rbac → app_user → user_role → users(auth) → party → types → identifiers → address → contact → party_contact → information_barrier (+ update party.barrier_id) → relationship → demat → instrument → deal → deal_party → allocation_event → credit_analysis → financial_statement → links → ratio_result → scorecard_template/scorecard → credit_score → external_rating → rating_ladder → exposure → credit_limit → kyc → BO → consent → DSR → interaction → attendee → task → document → audit_log → update employee_party_id
- **Domain engines used:**
  - `computeBondMetrics` for bond_pricing financial_model outputs JSONB
  - Lead + onboarding JSONB shapes from features/leads/types + features/onboarding/types written via **raw SQL** (lead_meta/onboarding_meta columns not in Drizzle party schema — migrations 0006/0007)
- **Imports schema symbols:** address through tradeEvent, financialModel, etc.
- **Side effects:** Wipes DB; not safe on shared prod
- **Security:** Creates users/roles/permissions for demo; passwords may be unset until seed-admin
- **Coupling:** Entire product surface for demos
- **Risks / TODOs:** Destructive truncate; lead_meta/onboarding_meta schema drift; long runtime

### Seed layer architecture summary
| Script | Destructiveness | Scale | Auth |
|--------|-----------------|-------|------|
| seed.ts | Full truncate | ~801 rows (comment) | roles + users without guaranteed passwords |
| seed-admin.ts | Upsert one admin | 1 | sets password for Shray |
| seed-org-users.ts | Upsert roster | 7 | shared password |
| seed-scale.ts | Additive / self-clean | ~10k parties | none |
