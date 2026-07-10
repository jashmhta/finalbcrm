// audit_log query helpers (immutable viewer).
//
// Schema: audit.ts `audit_log` - INSERT-only (RLS + trigger), monthly RANGE
// partitioned by occurred_at, hash-chained for tamper-evidence. This module is
// READ-ONLY by design: there is no update/delete surface, and writes are
// performed only by the mutation layer via the `auditLog` insert (the hash
// chain is populated by a BEFORE INSERT trigger). See schema audit.ts for the
// migration notes that install immutability + the chain.
//
// Filters mirror the indexes: occurred_at range, entity (type+id), actor,
// operation, correlation_id, barrier. Pagination is OFFSET at this scale; the
// BRIN index on occurred_at (migration note) keeps the range scan cheap.

import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import { appUser, auditLog } from "@/db/schema";

export interface AuditLogFilter {
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  operation?: string;
  correlationId?: string;
  barrierId?: string;
  /** ISO timestamp lower bound (inclusive). */
  from?: string;
  /** ISO timestamp upper bound (inclusive). */
  to?: string;
  /** Case-insensitive substring on entity_type / actor_role_at_time. */
  q?: string;
}

export interface AuditLogRow {
  auditLogId: string;
  entityType: string;
  entityId: string | null;
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  operation: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRoleAtTime: string | null;
  barrierId: string | null;
  occurredAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  prevHash: string | null;
  rowHash: string | null;
}

export interface AuditLogResult {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

const selectFields = {
  auditLogId: auditLog.auditLogId,
  entityType: auditLog.entityType,
  entityId: auditLog.entityId,
  fieldName: auditLog.fieldName,
  oldValue: auditLog.oldValue,
  newValue: auditLog.newValue,
  operation: auditLog.operation,
  actorUserId: auditLog.actorUserId,
  actorEmail: appUser.email,
  actorRoleAtTime: auditLog.actorRoleAtTime,
  barrierId: auditLog.barrierId,
  occurredAt: auditLog.occurredAt,
  ipAddress: auditLog.ipAddress,
  userAgent: auditLog.userAgent,
  correlationId: auditLog.correlationId,
  prevHash: auditLog.prevHash,
  rowHash: auditLog.rowHash,
} as const;

/**
 * Paginated, filtered audit_log read. Newest-first (the natural order for an
// incident review). The actor email is left-joined from app_user for display.
 */
export async function listAuditLog({
  filter = {},
  page = 1,
  pageSize = 50,
}: {
  filter?: AuditLogFilter;
  page?: number;
  pageSize?: number;
} = {}): Promise<AuditLogResult> {
  const conds = [];

  if (filter.entityType) conds.push(eq(auditLog.entityType, filter.entityType));
  if (filter.entityId) conds.push(eq(auditLog.entityId, filter.entityId));
  if (filter.actorUserId) conds.push(eq(auditLog.actorUserId, filter.actorUserId));
  if (filter.operation) conds.push(eq(auditLog.operation, filter.operation as NonNullable<(typeof auditLog.$inferSelect)["operation"]>));
  if (filter.correlationId) conds.push(eq(auditLog.correlationId, filter.correlationId));
  if (filter.barrierId) conds.push(eq(auditLog.barrierId, filter.barrierId));
  if (filter.from) conds.push(gte(auditLog.occurredAt, new Date(filter.from)));
  if (filter.to) conds.push(lte(auditLog.occurredAt, new Date(filter.to)));

  if (filter.q) {
    conds.push(
      or(
        ilike(auditLog.entityType, `%${filter.q}%`),
        ilike(auditLog.actorRoleAtTime, `%${filter.q}%`),
      ),
    );
  }

  const where = conds.length ? and(...conds) : undefined;

  const [rows, [{ n }]] = await Promise.all([
    db
      .select(selectFields)
      .from(auditLog)
      .leftJoin(appUser, eq(appUser.userId, auditLog.actorUserId))
      .where(where)
      .orderBy(desc(auditLog.occurredAt), desc(auditLog.auditLogId))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(where),
  ]);

  return {
    total: n ?? 0,
    page,
    pageSize,
    rows: rows as AuditLogRow[],
  };
}

/**
 * Fetch a single audit log row by id (for a detail / chain-verification view).
 */
export async function getAuditLogEntry(
  auditLogId: string,
): Promise<AuditLogRow | null> {
  const [row] = await db
    .select(selectFields)
    .from(auditLog)
    .leftJoin(appUser, eq(appUser.userId, auditLog.actorUserId))
    .where(eq(auditLog.auditLogId, auditLogId));
  return (row as AuditLogRow | undefined) ?? null;
}

/**
 * Fetch the audit history for a single entity (entity_type + entity_id), oldest
// first - used on detail pages (e.g. a KYC record's history tab).
 */
export async function listAuditLogForEntity(
  entityType: string,
  entityId: string,
  limit = 100,
): Promise<AuditLogRow[]> {
  const rows = await db
    .select(selectFields)
    .from(auditLog)
    .leftJoin(appUser, eq(appUser.userId, auditLog.actorUserId))
    .where(
      and(
        eq(auditLog.entityType, entityType),
        eq(auditLog.entityId, entityId),
      ),
    )
    .orderBy(asc(auditLog.occurredAt), asc(auditLog.auditLogId))
    .limit(limit);
  return rows as AuditLogRow[];
}
