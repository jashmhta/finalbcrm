# Agent 069 — Extreme detail analysis

Batch files: `src/features/admin/actions.ts`, `src/features/admin/index.ts`, `src/features/admin/queries.ts`, `src/features/ai/actions.ts`

Admin panel mutations/reads + AI server-action bridge.

---

## `src/features/admin/actions.ts`

- **Lines:** 579 | **Role:** `"use server"` admin mutations for users/roles
- **Exports:**
  - `createUser(_prev, formData): Promise<CreateUserState>`
  - `updateUser(_prev, formData): Promise<UpdateUserState>`
  - `deactivateUser(_prev, formData): Promise<DeactivateUserState>`
  - `updateRolePermissions(_prev, formData): Promise<UpdateRolePermissionsState>`
  - State types: CreateUserState `{ error?, userId? }`, Update/Deactivate `{ error?, ok? }`, UpdateRolePermissionsState
- **Imports:** next/cache revalidatePath; bcryptjs; drizzle; zod/v4; `@/lib/rbac` can/requireUser; db + appUser/auditLog/permission/role/rolePermission/userRole
- **Business purpose:** Admin panel user lifecycle + role permission grid without Auth.js users-table inserts (credentials provider uses app_user only)

### Permission model
- All actions: `requireUser()` then `can(user, "manage", "user")` via `requireManage`
- Management tables **not under RLS** — plain `db.transaction`, not withRls
- Audit INSERT rides same txn (hash-chain trigger)

### createUser
- Zod: email, password min 8 max 200, desk enum (10 desks matching deskEnum), isActive "true"|"false", optional barrierClearance[], roleNames[]
- Validates role names against live `role` table; rejects unknown
- Email uniqueness on citext app_user
- bcrypt.hashSync cost **10**; mfaEnabled false; failedLoginCount 0
- Inserts user_role grants with assignedByUserId
- Audit newValue: email, desk, isActive, barrierClearance, roles, **passwordSet: true** (never plaintext)
- revalidate `/admin/users`, `/admin`

### updateUser
- Optional desk/isActive/barrierClearance/password/roleNames
- Empty password leaves hash untouched
- **Refuses self-deactivation**
- Role sync: close all current grants (valid_to=now), open new set
- Audit old/new desk/active/clearance + passwordSet boolean

### deactivateUser
- is_active=false only (not soft-delete); ends role grants
- Cannot self-deactivate; already-inactive error

### updateRolePermissions
- Replace role_permission set (delete all + insert)
- **Protects role name `admin`** — cannot edit permissions (prevents lockout of user:manage)
- Audit added/removed permission codes

- **Side effects:** DB writes, revalidatePath, audit_log
- **Security:** bcrypt only; passwords never in audit; admin role protected
- **Coupling:** admin UI forms, rbac permission codes, audit schema
- **Risks:** bcrypt cost 10 vs org seed 12; roleNames form field must be repeated FormData; no password complexity beyond length

---

## `src/features/admin/index.ts`

- **Lines:** 51 | **Role:** Feature barrel
- **Exports:** re-exports queries (listUsers, getUser, listRoles, listPermissions, listSectorCodes, listRatingLadder, getSystemStats, getSystemHealth, listRecentAuditEntries, getAuditEntityBreakdown, getAuditOperationBreakdown, getTopAuditActors, listAuditEntries, listAuditEntityTypes, listAuditBarriers, countDealsByType, DEAL_TYPES, INSTRUMENT_TYPES, RATING_AGENCIES, RATING_SCALES, DESKS, types) + actions + action state types
- **Business:** Single import path for admin routes
- **Coupling:** queries + actions only

---

## `src/features/admin/queries.ts`

- **Lines:** 594 | **Role:** Read-only admin forensic + master data surface
- **Exports (functions):** listUsers, getUser, listRoles, listPermissions, listSectorCodes, listRatingLadder, countDealsByType, getSystemStats, getSystemHealth, listRecentAuditEntries, getAuditEntityBreakdown, getAuditOperationBreakdown, getTopAuditActors, listAuditEntityTypes, listAuditBarriers; re-export listAuditLog as listAuditEntries + filter types from compliance/audit
- **Exports (const catalogues):** DEAL_TYPES (18), INSTRUMENT_TYPES (14), RATING_AGENCIES (7), RATING_SCALES (5), DESKS (10) — mirror enums.ts for admin display
- **Exports (types):** AdminUserRow, AdminRoleRow, AdminPermissionRow, SectorCodeRow, RatingLadderRow, EnumCountRow, SystemStats, SystemHealth

### listUsers / getUser
- Left join user_role (valid_to null) + role; collapse fan-out to roles[]
- Fields include mfaEnabled, failedLoginCount, lockedUntil, barrierClearance

### listRoles
- role + permission codes; separate count of active user_role grants

### Master data
- sector_code hierarchy fields; rating_ladder ordered agency/scale/rank

### SystemStats
- Parallel counts: users, active users, roles, permissions, deals, parties, credit analyses, audit_log rows
- `pg_database_size(current_database())` via db.execute

### SystemHealth
- inactive/locked (locked_until > now)/mfa/never-logged-in counts
- audit chain sample: count(row_hash) vs total; lastEventAt
- activeUsers field left 0 with comment “filled below from stats” — **may be incomplete** if caller doesn't merge

### Audit analytics
- Entity/operation breakdowns, top actors by email, distinct entity types/barriers for filters
- listRecentAuditEntries wraps compliance listAuditLog pageSize=limit

- **Side effects:** Read-only; no withRls (management tables + fail-open audit read)
- **Security:** Callers must gate admin pages with can manage user / audit:read
- **Coupling:** compliance/audit, schema, admin UI
- **Risks:** SystemHealth.activeUsers always 0 in return; large audit COUNT(*) on partitioned table; no RBAC inside queries themselves

---

## `src/features/ai/actions.ts`

- **Lines:** 44 | **Role:** `"use server"` bridge for client AI panels
- **Exports:**
  - `fetchCreditSummary(creditAnalysisId: string): Promise<CreditSummary | null>`
  - `fetchInteractionSummary(scope: { partyId?: string; dealId?: string }): Promise<InteractionSummary>`
- **Imports:** getCreditSummary, getInteractionSummary; requireUser; types
- **Business:** Client components cannot receive function props server→client; call these serializable actions instead (NotificationBell pattern). **No external LLM**
- **Key logic:** requireUser then engine with user for scoping
- **Side effects:** Read engines + DB
- **Security:** Auth required; credit detail scopes inside getCreditSummary
- **Coupling:** creditSummary, interactionSummary, /credit/[id] panels
- **Risks:** Interaction summary limit hardcoded 25 in action
