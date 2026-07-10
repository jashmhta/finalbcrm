// Admin Panel - feature barrel.
//
// Re-exports the server data access + server actions so app routes import from
// one path. The admin views are server components that call the queries
// directly; the client views (users/roles/audit) import the actions + the
// row types they need.

export {
  listUsers,
  getUser,
  listRoles,
  listPermissions,
  listSectorCodes,
  listRatingLadder,
  getSystemStats,
  getSystemHealth,
  listRecentAuditEntries,
  getAuditEntityBreakdown,
  getAuditOperationBreakdown,
  getTopAuditActors,
  listAuditEntries,
  listAuditEntityTypes,
  listAuditBarriers,
  countDealsByType,
  DEAL_TYPES,
  INSTRUMENT_TYPES,
  RATING_AGENCIES,
  RATING_SCALES,
  DESKS,
  type AdminUserRow,
  type AdminRoleRow,
  type AdminPermissionRow,
  type SectorCodeRow,
  type RatingLadderRow,
  type SystemStats,
  type SystemHealth,
  type EnumCountRow,
  type AuditLogFilter,
  type AuditLogRow,
  type AuditLogResult,
} from "./queries";
export {
  createUser,
  updateUser,
  deactivateUser,
  updateRolePermissions,
  type CreateUserState,
  type UpdateUserState,
  type DeactivateUserState,
  type UpdateRolePermissionsState,
} from "./actions";
