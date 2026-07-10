// Application-layer audit append helper.
//
// audit_log is INSERT-only at the DB. Hash-chain columns (prev_hash/row_hash)
// are ideally filled by a DB trigger; when the trigger is absent we still
// insert a complete row so ops scripts and mutations leave a trail.

import { desc } from "drizzle-orm";

import { db } from "@/db";
import { auditLog } from "@/db/schema";
import type { CrmUser } from "@/lib/rbac";
import { createHash } from "node:crypto";

export type AuditOp =
  | "insert"
  | "update"
  | "delete"
  | "merge"
  | "approve"
  | "reject";

export interface WriteAuditInput {
  entityType: string;
  entityId?: string | null;
  operation: AuditOp;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  actor?: CrmUser | null;
  actorUserId?: string | null;
  correlationId?: string | null;
  barrierId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function payloadHash(parts: unknown[]): string {
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex");
}

/**
 * Append one audit_log row. Never throws to callers for hash-chain lookup
 * failures — audit must not block the primary business write. Returns the
 * new audit_log_id or null on failure.
 */
export async function writeAudit(input: WriteAuditInput): Promise<string | null> {
  try {
    const actorUserId =
      input.actorUserId ?? input.actor?.appUserId ?? null;
    const actorRole =
      input.actor?.roles?.[0] ?? null;

    // Best-effort previous hash for chain continuity when trigger is absent.
    let prevHash: string | null = null;
    try {
      const [prev] = await db
        .select({ rowHash: auditLog.rowHash })
        .from(auditLog)
        .orderBy(desc(auditLog.occurredAt))
        .limit(1);
      prevHash = prev?.rowHash ?? null;
    } catch {
      prevHash = null;
    }

    const rowHash = payloadHash([
      prevHash,
      input.entityType,
      input.entityId,
      input.operation,
      input.fieldName,
      input.oldValue,
      input.newValue,
      actorUserId,
      Date.now(),
    ]);

    const [row] = await db
      .insert(auditLog)
      .values({
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        fieldName: input.fieldName ?? null,
        oldValue: (input.oldValue as object) ?? null,
        newValue: (input.newValue as object) ?? null,
        operation: input.operation,
        actorUserId,
        actorRoleAtTime: actorRole,
        barrierId: input.barrierId ?? null,
        correlationId: input.correlationId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        prevHash,
        rowHash,
      })
      .returning({ auditLogId: auditLog.auditLogId });

    return row?.auditLogId ?? null;
  } catch {
    return null;
  }
}
