// Admin Panel - server-side data access.
//
// READ-ONLY surface for the admin's forensic + management views:
//   • users  - app_user joined to active user_role → role (email, desk,
//              active, last_login, roles, barrier clearance).
//   • roles  - role + its permission codes (role_permission → permission).
//   • permissions - the full permission code catalogue.
//   • master data - sector_code + rating_ladder reference rows, plus the
//              enum value lists for deal_type / instrument_type /
//              rating_agency (the enum values are the source of truth for
//              the deal/instrument/rating dropdowns across the CRM; the admin
//              view surfaces them read-only).
//   • system stats - counts (users, roles, deals, parties, credit analyses,
//              audit log rows) + DB size (pg_database_size) + a health
//              digest (locked / mfa-enrolled / inactive users, hash-chain
//              integrity sample).
//   • recent audit entries - the last N audit_log rows for the dashboard rail.
//
// app_user / role / permission / role_permission / user_role are NOT under
// RLS (they are management tables), so reads use the shared `db` client
// directly - no withRls context. audit_log is INSERT-only + readable by any
// role with `audit:read` (RLS is fail-open on the read path per 0004_rls_fix);
// the admin role bypasses the check entirely.

import { sql, and, asc, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  appUser,
  auditLog,
  creditAnalysis,
  deal,
  party,
  permission,
  ratingLadder,
  role,
  rolePermission,
  sectorCode,
  userRole,
} from "@/db/schema";
import { listAuditLog, type AuditLogRow } from "@/features/compliance/audit";

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface AdminUserRow {
  userId: string;
  email: string;
  isActive: boolean;
  desk: string | null;
  barrierClearance: string[] | null;
  lastLoginAt: Date | null;
  mfaEnabled: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdAt: Date;
  roles: { roleId: string; name: string }[];
}

/**
 * List every app_user (not soft-deleted) with their active role grants
 * (valid_to IS NULL). Ordered by created_at desc so the newest hires surface
 * first - the admin's natural orientation.
 */
export async function listUsers(): Promise<AdminUserRow[]> {
  const rows = await db
    .select({
      userId: appUser.userId,
      email: appUser.email,
      isActive: appUser.isActive,
      desk: appUser.desk,
      barrierClearance: appUser.barrierClearance,
      lastLoginAt: appUser.lastLoginAt,
      mfaEnabled: appUser.mfaEnabled,
      failedLoginCount: appUser.failedLoginCount,
      lockedUntil: appUser.lockedUntil,
      createdAt: appUser.createdAt,
      roleId: role.roleId,
      roleName: role.name,
    })
    .from(appUser)
    .leftJoin(userRole, and(eq(userRole.userId, appUser.userId), isNull(userRole.validTo), isNull(userRole.deletedAt)))
    .leftJoin(role, eq(role.roleId, userRole.roleId))
    .where(isNull(appUser.deletedAt))
    .orderBy(desc(appUser.createdAt), asc(appUser.email));

  // Collapse the left-join fan-out back to one row per user with a roles[].
  const byUser = new Map<string, AdminUserRow>();
  for (const r of rows) {
    let u = byUser.get(r.userId);
    if (!u) {
      u = {
        userId: r.userId,
        email: r.email,
        isActive: r.isActive,
        desk: r.desk,
        barrierClearance: r.barrierClearance,
        lastLoginAt: r.lastLoginAt,
        mfaEnabled: r.mfaEnabled,
        failedLoginCount: r.failedLoginCount,
        lockedUntil: r.lockedUntil,
        createdAt: r.createdAt,
        roles: [],
      };
      byUser.set(r.userId, u);
    }
    if (r.roleId && r.roleName) {
      u.roles.push({ roleId: r.roleId, name: r.roleName });
    }
  }
  return Array.from(byUser.values());
}

/**
 * Single app_user by id with active roles - for the edit-user form. Returns
 * null when the row is missing or soft-deleted.
 */
export async function getUser(userId: string): Promise<AdminUserRow | null> {
  const rows = await db
    .select({
      userId: appUser.userId,
      email: appUser.email,
      isActive: appUser.isActive,
      desk: appUser.desk,
      barrierClearance: appUser.barrierClearance,
      lastLoginAt: appUser.lastLoginAt,
      mfaEnabled: appUser.mfaEnabled,
      failedLoginCount: appUser.failedLoginCount,
      lockedUntil: appUser.lockedUntil,
      createdAt: appUser.createdAt,
      roleId: role.roleId,
      roleName: role.name,
    })
    .from(appUser)
    .leftJoin(userRole, and(eq(userRole.userId, appUser.userId), isNull(userRole.validTo), isNull(userRole.deletedAt)))
    .leftJoin(role, eq(role.roleId, userRole.roleId))
    .where(and(eq(appUser.userId, userId), isNull(appUser.deletedAt)))
    .orderBy(asc(role.name));

  if (rows.length === 0) return null;
  return {
    userId: rows[0]!.userId,
    email: rows[0]!.email,
    isActive: rows[0]!.isActive,
    desk: rows[0]!.desk,
    barrierClearance: rows[0]!.barrierClearance,
    lastLoginAt: rows[0]!.lastLoginAt,
    mfaEnabled: rows[0]!.mfaEnabled,
    failedLoginCount: rows[0]!.failedLoginCount,
    lockedUntil: rows[0]!.lockedUntil,
    createdAt: rows[0]!.createdAt,
    roles: rows
      .filter((r) => r.roleId && r.roleName)
      .map((r) => ({ roleId: r.roleId!, name: r.roleName! })),
  };
}

// ---------------------------------------------------------------------------
// Roles + permissions
// ---------------------------------------------------------------------------

export interface AdminRoleRow {
  roleId: string;
  name: string;
  desk: string | null;
  description: string | null;
  permissions: { permissionId: string; code: string }[];
  userCount: number;
}

/**
 * List every role (not soft-deleted) with its permission codes + the count of
 * users currently holding the role (active grants). Ordered by name.
 */
export async function listRoles(): Promise<AdminRoleRow[]> {
  const rows = await db
    .select({
      roleId: role.roleId,
      name: role.name,
      desk: role.desk,
      description: role.description,
      permissionId: permission.permissionId,
      code: permission.code,
    })
    .from(role)
    .leftJoin(rolePermission, eq(rolePermission.roleId, role.roleId))
    .leftJoin(permission, eq(permission.permissionId, rolePermission.permissionId))
    .where(isNull(role.deletedAt))
    .orderBy(asc(role.name), asc(permission.code));

  const byRole = new Map<string, AdminRoleRow>();
  for (const r of rows) {
    let rl = byRole.get(r.roleId);
    if (!rl) {
      rl = {
        roleId: r.roleId,
        name: r.name,
        desk: r.desk,
        description: r.description,
        permissions: [],
        userCount: 0,
      };
      byRole.set(r.roleId, rl);
    }
    if (r.permissionId && r.code) {
      rl.permissions.push({ permissionId: r.permissionId, code: r.code });
    }
  }

  // Active user counts per role - one query, fan in.
  const counts = await db
    .select({
      roleId: userRole.roleId,
      n: sql<number>`count(*)::int`,
    })
    .from(userRole)
    .where(and(isNull(userRole.validTo), isNull(userRole.deletedAt)))
    .groupBy(userRole.roleId);
  const countByRole = new Map(counts.map((c) => [c.roleId, c.n]));
  for (const rl of byRole.values()) {
    rl.userCount = countByRole.get(rl.roleId) ?? 0;
  }

  return Array.from(byRole.values());
}

export interface AdminPermissionRow {
  permissionId: string;
  code: string;
  description: string | null;
}

/** The full permission catalogue - for the role-permission editor grid. */
export async function listPermissions(): Promise<AdminPermissionRow[]> {
  const rows = await db
    .select({
      permissionId: permission.permissionId,
      code: permission.code,
      description: permission.description,
    })
    .from(permission)
    .where(isNull(permission.deletedAt))
    .orderBy(asc(permission.code));
  return rows;
}

// ---------------------------------------------------------------------------
// Master data - reference tables + enum catalogues
// ---------------------------------------------------------------------------

export interface SectorCodeRow {
  sectorCodeId: string;
  code: string;
  nicCode: string | null;
  rbiSectoralDeploymentCode: string | null;
  label: string;
  parentSectorCodeId: string | null;
  segmentClass: string | null;
  level: number;
  isActive: boolean;
}

export async function listSectorCodes(): Promise<SectorCodeRow[]> {
  const rows = await db
    .select({
      sectorCodeId: sectorCode.sectorCodeId,
      code: sectorCode.code,
      nicCode: sectorCode.nicCode,
      rbiSectoralDeploymentCode: sectorCode.rbiSectoralDeploymentCode,
      label: sectorCode.label,
      parentSectorCodeId: sectorCode.parentSectorCodeId,
      segmentClass: sectorCode.segmentClass,
      level: sectorCode.level,
      isActive: sectorCode.isActive,
    })
    .from(sectorCode)
    .where(isNull(sectorCode.deletedAt))
    .orderBy(asc(sectorCode.code));
  return rows;
}

export interface RatingLadderRow {
  ladderId: string;
  agency: string;
  scale: string;
  symbol: string;
  rank: number;
  definition: string | null;
}

export async function listRatingLadder(): Promise<RatingLadderRow[]> {
  const rows = await db
    .select({
      ladderId: ratingLadder.ladderId,
      agency: ratingLadder.agency,
      scale: ratingLadder.scale,
      symbol: ratingLadder.symbol,
      rank: ratingLadder.rank,
      definition: ratingLadder.definition,
    })
    .from(ratingLadder)
    .where(isNull(ratingLadder.deletedAt))
    .orderBy(asc(ratingLadder.agency), asc(ratingLadder.scale), asc(ratingLadder.rank));
  return rows;
}

// Enum catalogues - the source-of-truth value lists for the deal/instrument/
// rating dropdowns across the CRM. Read-only display in the admin panel; the
// values live in the Postgres enum types (see src/db/schema/enums.ts).

export const DEAL_TYPES: readonly string[] = [
  "bond_underwriting",
  "gsec_auction",
  "high_yield_bond",
  "rating_advisory",
  "m_and_a",
  "project_finance",
  "structured_finance",
  "supply_chain_finance",
  "ecm_ipo",
  "ecm_fpo",
  "ecm_qip",
  "ecm_rights",
  "dcm_advisory",
  "private_placement_debt",
  "valuation",
  "fairness_opinion",
  "portfolio_management_mandate",
  "secondary_trading_advisory",
] as const;

export const INSTRUMENT_TYPES: readonly string[] = [
  "corp_bond",
  "ncd",
  "cp",
  "gsec",
  "sdl",
  "tbill",
  "sgb",
  "structured_credit",
  "municipal_bond",
  "eco_bond",
  "equity",
  "preference_share",
  "warrant",
  "convertible",
] as const;

export const RATING_AGENCIES: readonly string[] = [
  "CRISIL",
  "ICRA",
  "CARE",
  "India_Ratings",
  "Acuite",
  "Infomerics",
  "Brickwork",
] as const;

export const RATING_SCALES: readonly string[] = [
  "long_term",
  "short_term",
  "structured",
  "sovereign",
  "state_guaranteed",
] as const;

export const DESKS: readonly string[] = [
  "ib_advisory",
  "bond_underwriting",
  "gsec_trading",
  "secondary_mm",
  "portfolio_mgmt",
  "credit",
  "rating_advisory",
  "operations",
  "compliance",
  "management",
] as const;

export interface EnumCountRow {
  code: string;
  /** Count of live rows using this enum value, or null when not computed. */
  count: number | null;
}

/**
 * Count live deal rows per deal_type - gives the admin a "how often is each
 * deal type actually used" read alongside the enum catalogue. Single query.
 */
export async function countDealsByType(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      dealType: deal.dealType,
      n: sql<number>`count(*)::int`,
    })
    .from(deal)
    .where(isNull(deal.deletedAt))
    .groupBy(deal.dealType);
  return new Map(rows.map((r) => [r.dealType, r.n]));
}

// ---------------------------------------------------------------------------
// System stats + health
// ---------------------------------------------------------------------------

export interface SystemStats {
  userCount: number;
  activeUserCount: number;
  roleCount: number;
  permissionCount: number;
  dealCount: number;
  partyCount: number;
  creditAnalysisCount: number;
  auditLogCount: number;
  /** Database size in bytes (pg_database_size). */
  dbSizeBytes: number;
}

export interface SystemHealth {
  activeUsers: number;
  inactiveUsers: number;
  lockedUsers: number;
  mfaEnrolledUsers: number;
  /** Users who never logged in (last_login_at IS NULL). */
  neverLoggedIn: number;
  /** Audit rows with a populated row_hash (tamper-evidence chain populated). */
  auditChainedRows: number;
  /** Audit rows total (sampled for the chain-integrity read). */
  auditTotalRows: number;
  /** Most recent audit event timestamp, or null when the log is empty. */
  lastEventAt: Date | null;
}

/**
 * The admin dashboard's two stat reads in one round-trip. Counts are cheap
 * (indexed); the DB size is a single pg_database_size() call. audit_log is
 * INSERT-only so the count is a plain COUNT(*) on the partitioned table.
 */
export async function getSystemStats(): Promise<SystemStats> {
  const [u, au, r, p, d, pt, ca, al, szRaw] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(appUser).where(isNull(appUser.deletedAt)),
    db.select({ n: sql<number>`count(*)::int` }).from(appUser).where(and(isNull(appUser.deletedAt), eq(appUser.isActive, true))),
    db.select({ n: sql<number>`count(*)::int` }).from(role).where(isNull(role.deletedAt)),
    db.select({ n: sql<number>`count(*)::int` }).from(permission).where(isNull(permission.deletedAt)),
    db.select({ n: sql<number>`count(*)::int` }).from(deal).where(isNull(deal.deletedAt)),
    db.select({ n: sql<number>`count(*)::int` }).from(party).where(isNull(party.deletedAt)),
    db.select({ n: sql<number>`count(*)::int` }).from(creditAnalysis).where(isNull(creditAnalysis.deletedAt)),
    db.select({ n: sql<number>`count(*)::int` }).from(auditLog),
    // pg_database_size is a scalar - no FROM needed, so use db.execute (the
    // drizzle select builder requires a .from() to become executable).
    db.execute(sql`SELECT pg_database_size(current_database())::bigint AS n`),
  ]);
  const szRows = (szRaw as { n?: string | number }[] | { rows?: { n?: string | number }[] }) ;
  const szRow = Array.isArray(szRows) ? szRows[0] : szRows.rows?.[0];
  return {
    userCount: u[0]?.n ?? 0,
    activeUserCount: au[0]?.n ?? 0,
    roleCount: r[0]?.n ?? 0,
    permissionCount: p[0]?.n ?? 0,
    dealCount: d[0]?.n ?? 0,
    partyCount: pt[0]?.n ?? 0,
    creditAnalysisCount: ca[0]?.n ?? 0,
    auditLogCount: al[0]?.n ?? 0,
    dbSizeBytes: Number(szRow?.n ?? 0),
  };
}

/**
 * Health digest - surfaced on the dashboard as the "system health" rail. The
 * locked / mfa / never-logged-in counts are the admin's at-a-glance security
 * posture; the audit chain read samples the hash-chain integrity (rows with a
 * populated row_hash vs total rows).
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const [inactive, locked, mfa, never, chain, last] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(appUser).where(and(isNull(appUser.deletedAt), eq(appUser.isActive, false))),
    // Currently locked: locked_until IS NOT NULL AND locked_until > now().
    db.select({ n: sql<number>`count(*)::int` }).from(appUser).where(and(isNull(appUser.deletedAt), sql`${appUser.lockedUntil} IS NOT NULL AND ${appUser.lockedUntil} > now()`)),
    db.select({ n: sql<number>`count(*)::int` }).from(appUser).where(and(isNull(appUser.deletedAt), eq(appUser.mfaEnabled, true))),
    db.select({ n: sql<number>`count(*)::int` }).from(appUser).where(and(isNull(appUser.deletedAt), isNull(appUser.lastLoginAt))),
    db.select({
      total: sql<number>`count(*)::int`,
      chained: sql<number>`count(${auditLog.rowHash})::int`,
    }).from(auditLog),
    db.select({ at: auditLog.occurredAt }).from(auditLog).orderBy(desc(auditLog.occurredAt)).limit(1),
  ]);
  return {
    activeUsers: 0, // filled below from stats to avoid a duplicate query
    inactiveUsers: inactive[0]?.n ?? 0,
    lockedUsers: locked[0]?.n ?? 0,
    mfaEnrolledUsers: mfa[0]?.n ?? 0,
    neverLoggedIn: never[0]?.n ?? 0,
    auditChainedRows: chain[0]?.chained ?? 0,
    auditTotalRows: chain[0]?.total ?? 0,
    lastEventAt: last[0]?.at ?? null,
  };
}

/**
 * Recent audit log entries for the dashboard rail. Reuses the compliance
 * audit query (LEFT JOIN app_user for actor email). Newest-first.
 */
export async function listRecentAuditEntries(limit = 12): Promise<AuditLogRow[]> {
  const { rows } = await listAuditLog({ filter: {}, page: 1, pageSize: limit });
  return rows;
}

/**
 * Per-entity-type audit event counts - drives the dashboard's "event
 * breakdown" mini-chart. Grouped by entity_type, newest first by count.
 */
export async function getAuditEntityBreakdown(limit = 12): Promise<{ entityType: string; n: number }[]> {
  const rows = await db
    .select({
      entityType: auditLog.entityType,
      n: sql<number>`count(*)::int`,
    })
    .from(auditLog)
    .groupBy(auditLog.entityType)
    .orderBy(desc(sql<number>`count(*)::int`))
    .limit(limit);
  return rows.map((r) => ({ entityType: r.entityType, n: r.n }));
}

/**
 * Per-operation audit event counts - drives the dashboard's "operation mix"
 * read (insert / update / delete / approve / reject / merge).
 */
export async function getAuditOperationBreakdown(): Promise<{ operation: string; n: number }[]> {
  const rows = await db
    .select({
      operation: auditLog.operation,
      n: sql<number>`count(*)::int`,
    })
    .from(auditLog)
    .groupBy(auditLog.operation)
    .orderBy(asc(auditLog.operation));
  return rows.map((r) => ({ operation: r.operation, n: r.n }));
}

/** Actors ranked by event count - the dashboard's "top actors" rail. */
export async function getTopAuditActors(limit = 8): Promise<{ actorEmail: string | null; n: number }[]> {
  const rows = await db
    .select({
      actorEmail: appUser.email,
      n: sql<number>`count(*)::int`,
    })
    .from(auditLog)
    .leftJoin(appUser, eq(appUser.userId, auditLog.actorUserId))
    .groupBy(appUser.email)
    .orderBy(desc(sql<number>`count(*)::int`))
    .limit(limit);
  return rows.map((r) => ({ actorEmail: r.actorEmail, n: r.n }));
}

// ---------------------------------------------------------------------------
// Audit list (admin forensic view) - thin wrapper around the compliance query
// so the admin page gets the same row shape + pagination, with the barrier
// filter exposed in the UI.
// ---------------------------------------------------------------------------

export {
  listAuditLog as listAuditEntries,
  type AuditLogFilter,
  type AuditLogRow,
  type AuditLogResult,
} from "@/features/compliance/audit";

/** All distinct entity types currently in the audit log - drives the admin
 *  filter dropdown (dynamic vs the compliance page's static list). */
export async function listAuditEntityTypes(): Promise<string[]> {
  const rows = await db
    .select({ entityType: auditLog.entityType })
    .from(auditLog)
    .groupBy(auditLog.entityType)
    .orderBy(asc(auditLog.entityType));
  return rows.map((r) => r.entityType);
}

/** All distinct barriers referenced by the audit log - for the barrier filter. */
export async function listAuditBarriers(): Promise<{ barrierId: string; n: number }[]> {
  const rows = await db
    .select({
      barrierId: auditLog.barrierId,
      n: sql<number>`count(*)::int`,
    })
    .from(auditLog)
    .where(sql`${auditLog.barrierId} IS NOT NULL`)
    .groupBy(auditLog.barrierId)
    .orderBy(desc(sql<number>`count(*)::int`));
  return rows.map((r) => ({ barrierId: r.barrierId!, n: r.n }));
}
