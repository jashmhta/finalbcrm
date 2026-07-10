
# Batch 063

## `src/db/domain-check.ts`

- **Lines:** 165 | **Bytes:** 7145
- **Kind:** DB infrastructure
- **Header intent:** Domain-logic smoke check - exercises the real modeling/credit/scorecard code paths against a sample instrument and seeded DB rows, then prints results so a human can eyeball whether the values are sane.  Run:  npx tsx src/db/domain-check.ts
- **DB ops patterns:** from, select, where
- **External deps:** drizzle-orm, node:fs, node:path
- **Internal imports (3):** @/features/modeling/bondPricing, @/features/credit/ratios, @/features/credit/scorecard
- **Domain terms:** BOND, GSEC, SCORECARD, credit_analysis, scorecard

## `src/db/index.ts`

- **Lines:** 68 | **Bytes:** 2986
- **Kind:** DB infrastructure
- **Exported const:** db
- **Exported types:** DB
- **Security signals:** india-compliance
- **External deps:** drizzle-orm/postgres-js, postgres
- **Internal imports (1):** ./schema

## `src/db/rls.ts`

- **Lines:** 363 | **Bytes:** 11644
- **Kind:** DB infrastructure
- **Header intent:** RLS apply + verify helper (Track B / RLS).  Pairs with drizzle/0003_rls.sql. The migration provisions: - a non-superuser, non-BYPASSRLS app role `crm_app`; - ENABLE + FORCE ROW LEVEL SECURITY on the 16 walled tables; - GUC-driven policies (app.user_id, app.wall text[], app.mandate_ids uuid[]); - an immutable, tamper-evident audit_log (INSERT-only + sha256 hash chain); - GRANTs: SELECT/INSERT/UPDATE on operational tables, INSERT-only on audit_log.  `applyRlsMigration()` reads the SQL file and exe
- **Exported functions:** applyRlsMigration, verifyRls
- **Exported const:** WALLED_TABLES
- **Exported types:** RlsTableStatus, RlsVerifyReport
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm, node:fs/promises, node:path, node:url
- **Internal imports (1):** @/db
- **Domain terms:** barrier, credit_analysis, party

## `src/db/schema/audit.ts`

- **Lines:** 129 | **Bytes:** 5519
- **Kind:** Drizzle DB schema; Schema tables: audit_log
- **Header intent:** audit_log - IMMUTABLE, INSERT-only (§1.3, §2.22, ARCHITECTURE §5.1). Append-only: enforced by RLS (no UPDATE/DELETE policy for any role) plus a Postgres trigger that rejects any non-INSERT on the table. The `audit_purge` role is the only role with DELETE, used by a documented, signed-off retention purge job (§5.6).  RANGE PARTITIONING by occurred_at (monthly partitions: audit_log_y2026m01, …) - Drizzle cannot declare partitioning in the table definition, so the table is created as a normal table
- **Exported const:** auditLog, auditLogRelations
- **Exported types:** AuditLog, AuditLogInsert
- **pgTable:** audit_log
- **Security signals:** rbac/rls
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (3):** ./enums, ./rbac, ./information_barrier
- **Domain terms:** barrier
