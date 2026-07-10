
# Batch 068

## `src/db/seed-admin.ts`

- **Lines:** 133 | **Bytes:** 4685
- **Kind:** DB infrastructure
- **Header intent:** Track B / AUTH - provision the seeded admin user with a REAL bcrypt-hashed password and MFA disabled.  Run:  npx tsx src/db/seed-admin.ts  Idempotent: looks up `app_user` by email (citext, case-insensitive) and - if found: sets password_hash, resets failed_login_count/locked_until, keeps MFA disabled, and ensures a current 'admin' role grant exists; - if not found: inserts a minimal active admin app_user row + the admin role grant, so this script is safe to run before src/db/seed.ts.  SECURITY: 
- **DB ops patterns:** from, insert, returning, select, update, where
- **Security signals:** rbac/rls, credentials
- **External deps:** node:fs, node:path
- **Domain terms:** BinaryCapital, binarycapital

## `src/db/seed-org-users.ts`

- **Lines:** 235 | **Bytes:** 6576
- **Kind:** DB infrastructure
- **Header intent:** Provision Binary Capital org roster from CEO meeting notes.  Super admins: Shray (both Capital + Bonds), Shahrukh (Capital), Rati (Bonds), Niraj (Bonds) Employees: Yash (Capital), Pranjali (Capital), Tashmit (Bonds)  Run:  npx tsx src/db/seed-org-users.ts Default password (rotate in prod): BinaryCrm!2026  Safe to re-run: upserts by email, refreshes role grants.
- **DB ops patterns:** from, insert, returning, select, update, where
- **Security signals:** rbac/rls, credentials
- **External deps:** bcryptjs, drizzle-orm, node:fs, node:path
- **Domain terms:** barrier, binarybonds, binarycapital, matching

## `src/db/seed-scale.ts`

- **Lines:** 716 | **Bytes:** 23285
- **Kind:** DB infrastructure
- **Header intent:** 10k-party scale seed + performance proof (IMPORT-PERF track).  Run:  npx tsx src/db/seed-scale.ts  This is a SEPARATE, additive seed - it does NOT replace the demo seed (src/db/seed.ts, 801 rows). It seeds ~10,000 scale parties + identifiers + types + addresses + contacts + party_contact + a modest set of deals / deal_party into the LIVE local Postgres (binary_crm), then runs a performance check that mirrors the production `listParties` query path (src/features/parties/queries.ts) - fuzzy name s
- **DB ops patterns:** delete, from, insert, returning, select, where
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, node:fs, node:path, node:perf_hooks
- **TODOs/FIXMEs:** s (the | s. We create
- **Domain terms:** binarybonds, binarycapital, investor, issuer, onboarding, party

## `src/db/seed.ts`

- **Lines:** 3750 | **Bytes:** 174947
- **Kind:** Server Actions module
- **Directive:** `use server`
- **Header intent:** Deterministic mock-data seed for the Binary Capital CRM.  Run:  npx tsx src/db/seed.ts  Connects via the shared `db` client (src/db/index.ts) and inserts a realistic Indian capital-markets dev dataset into the LIVE local Postgres (binary_crm). Re-runnable: TRUNCATEs every table (CASCADE) before inserting.  Determinism: a seeded mulberry32 PRNG drives every "random" choice so two runs produce identical rows (stable UUIDs come from the DB's gen_random_uuid() default - those differ per run, but the
- **DB ops patterns:** from, insert, returning, update, where
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm, node:fs, node:path
- **Internal imports (4):** ./schema, ../features/modeling/bondPricing, ../features/leads/types, ../features/onboarding/types
- **Domain terms:** Allocation, Bond, Investor, KYC, ONBOARDING, Onboarding, Party, allocation, barrier, binarybonds, binarycapital, bond, credit_analysis, demat, gsec, investor, issuer, kyc, mandate, matching, onboarding, party, scorecard, underwriting
