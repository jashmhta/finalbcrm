
# Batch 069

## `src/features/admin/actions.ts`

- **Lines:** 578 | **Bytes:** 19845
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createUser, updateUser, deactivateUser, updateRolePermissions
- **Exported types:** CreateUserState, UpdateUserState, DeactivateUserState, UpdateRolePermissionsState
- **Zod schemas:** createUserSchema, updateUserSchema, deactivateUserSchema, updateRolePermissionsSchema
- **DB ops patterns:** delete, from, innerJoin, insert, returning, select, update, where
- **Security signals:** auth, rbac/rls, credentials, india-compliance
- **External deps:** bcryptjs, drizzle-orm, next/cache, zod/v4
- **Internal imports (3):** @/lib/rbac, @/db, @/db/schema
- **Domain terms:** barrier

## `src/features/admin/index.ts`

- **Lines:** 51 | **Bytes:** 1172
- **Kind:** Application module
- **Header intent:** Admin Panel - feature barrel.  Re-exports the server data access + server actions so app routes import from one path. The admin views are server components that call the queries directly; the client views (users/roles/audit) import the actions + the row types they need.
- **Security signals:** rbac/rls, india-compliance
- **Internal imports (2):** ./queries, ./actions

## `src/features/admin/queries.ts`

- **Lines:** 593 | **Bytes:** 19947
- **Kind:** Feature data-access (queries)
- **Header intent:** Admin Panel - server-side data access.  READ-ONLY surface for the admin's forensic + management views: • users  - app_user joined to active user_role → role (email, desk, active, last_login, roles, barrier clearance). • roles  - role + its permission codes (role_permission → permission). • permissions - the full permission code catalogue. • master data - sector_code + rating_ladder reference rows, plus the enum value lists for deal_type / instrument_type / rating_agency (the enum values are the 
- **Exported functions:** listUsers, getUser, listRoles, listPermissions, listSectorCodes, listRatingLadder, countDealsByType, getSystemStats, getSystemHealth, listRecentAuditEntries, getAuditEntityBreakdown, getAuditOperationBreakdown, getTopAuditActors, listAuditEntityTypes, listAuditBarriers
- **Exported const:** DEAL_TYPES, INSTRUMENT_TYPES, RATING_AGENCIES, RATING_SCALES, DESKS
- **Exported types:** AdminUserRow, AdminRoleRow, AdminPermissionRow, SectorCodeRow, RatingLadderRow, EnumCountRow, SystemStats, SystemHealth
- **DB ops patterns:** from, leftJoin, select, where
- **Security signals:** rbac/rls, credentials, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (4):** @/db, @/db/schema, @/features/compliance/audit, @/features/compliance/audit
- **Domain terms:** barrier, gsec, party

## `src/features/ai/actions.ts`

- **Lines:** 44 | **Bytes:** 1752
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** fetchCreditSummary, fetchInteractionSummary
- **Security signals:** auth, india-compliance
- **Internal imports (4):** ./creditSummary, ./interactionSummary, @/lib/rbac, ./types
- **Domain terms:** party
