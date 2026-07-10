// audit_log - IMMUTABLE, INSERT-only (§1.3, §2.22, ARCHITECTURE §5.1).
// Append-only: enforced by RLS (no UPDATE/DELETE policy for any role) plus a
// Postgres trigger that rejects any non-INSERT on the table. The `audit_purge`
// role is the only role with DELETE, used by a documented, signed-off retention
// purge job (§5.6).
//
// RANGE PARTITIONING by occurred_at (monthly partitions: audit_log_y2026m01, …)
// - Drizzle cannot declare partitioning in the table definition, so the table
// is created as a normal table here and partitioning is applied in a migration
// via raw SQL (see the MIGRATION NOTE below). Hash partitioning was rejected
// (§5.2) because it cannot partition by month and breaks the retention detach
// workflow.

import {
  char,
  index,
  inet,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { auditOpEnum } from "./enums";

// Real value import - references() and relations() access appUserTable at runtime.
import { appUser as appUserTable } from "./rbac";
import { informationBarrier } from "./information_barrier";

export const auditLog = pgTable(
  "audit_log",
  {
    auditLogId: uuid("audit_log_id").defaultRandom().primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    fieldName: text("field_name"),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    operation: auditOpEnum("operation").notNull(),
    actorUserId: uuid("actor_user_id").references(() => appUserTable.userId, {
      onDelete: "set null",
    }),
    actorRoleAtTime: text("actor_role_at_time"),
    barrierId: uuid("barrier_id").references(
      () => informationBarrier.barrierId,
      { onDelete: "set null" },
    ),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    // Ties multi-row changes (e.g., a merge) together.
    correlationId: uuid("correlation_id"),
    // Tamper-evidence (ARCHITECTURE §5.1): hash chain. prev_hash = hash of the
    // prior row's row_hash; row_hash = hash of (prev_hash || payload). Populated
    // by an INSERT trigger. Declared as regular columns (not generated - they
    // reference other rows).
    prevHash: char("prev_hash", { length: 64 }),
    rowHash: char("row_hash", { length: 64 }),
  },
  (table) => ({
    // NOTE: on a partitioned table, unique constraints must include the
    // partition key (occurred_at). The PK above uses only audit_log_id, which
    // is invalid on a partitioned table - the migration that converts this
    // table to partitioned must drop the PK and recreate it as
    // (audit_log_id, occurred_at). See MIGRATION NOTE below.
    occurredAtIdx: index("audit_log_occurred_at_idx").on(table.occurredAt),
    entityIdx: index("audit_log_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
    actorIdx: index("audit_log_actor_idx").on(table.actorUserId),
    correlationIdx: index("audit_log_correlation_idx").on(table.correlationId),
    barrierIdx: index("audit_log_barrier_idx").on(table.barrierId),
    // MIGRATION NOTE - partitioning + immutability, applied via raw SQL:
    //
    //   -- Convert to a partitioned table (monthly RANGE partitions by occurred_at):
    //   CREATE TABLE audit_log_y2026m01 PARTITION OF audit_log
    //     FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
    //   CREATE TABLE audit_log_y2026m02 PARTITION OF audit_log
    //     FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
    //   -- ... create future partitions ahead of time, or use pg_partman.
    //   -- BRIN index on occurred_at is far cheaper than B-tree for append-only:
    //   CREATE INDEX audit_log_occurred_at_brin_idx ON audit_log USING brin (occurred_at);
    //
    //   -- Immutability trigger: reject any non-INSERT.
    //   CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
    //   BEGIN
    //     RAISE EXCEPTION 'audit_log is INSERT-only';
    //   END; $$ LANGUAGE plpgsql;
    //   CREATE TRIGGER audit_log_no_update_delete BEFORE UPDATE OR DELETE OR TRUNCATE
    //     ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
    //
    //   -- Hash-chain trigger (tamper-evidence, ARCHITECTURE §5.1):
    //   CREATE OR REPLACE FUNCTION audit_log_chain() RETURNS trigger AS $$
    //   DECLARE prev char(64);
    //   BEGIN
    //     SELECT row_hash INTO prev FROM audit_log ORDER BY occurred_at DESC, audit_log_id DESC LIMIT 1;
    //     NEW.prev_hash := prev;
    //     NEW.row_hash := encode(digest(prev || convert_to(row_to_json(NEW)::text, 'utf8'), 'sha256'), 'hex');
    //     RETURN NEW;
    //   END; $$ LANGUAGE plpgsql;
    //   CREATE TRIGGER audit_log_chain BEFORE INSERT ON audit_log
    //     FOR EACH ROW EXECUTE FUNCTION audit_log_chain();
    //
    //   -- Permissions: INSERT only for the app role; no UPDATE/DELETE/TRUNCATE
    //   -- except for the sealed audit_purge role.
  }),
);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(appUserTable, {
    fields: [auditLog.actorUserId],
    references: [appUserTable.userId],
  }),
  barrier: one(informationBarrier, {
    fields: [auditLog.barrierId],
    references: [informationBarrier.barrierId],
  }),
}));

export type AuditLog = typeof auditLog.$inferSelect;
export type AuditLogInsert = typeof auditLog.$inferInsert;
