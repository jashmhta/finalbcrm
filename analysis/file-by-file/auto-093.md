
# Batch 093

## `src/features/workflow/queries.ts`

- **Lines:** 176 | **Bytes:** 7201
- **Kind:** Feature data-access (queries)
- **Header intent:** Workflow Automation - server-side reads + read-state cookie helpers.  The notification set is COMPUTED (engine.ts) - nothing is persisted. Read state (which notifications the user has dismissed) lives in a cookie so the MVP needs no schema change. The cookie stores the set of dismissed ENTITY IDS (uuids), not the full `${type}:${entityId}` notification id: each trigger type references a distinct entity row (kyc_record / deal / credit_analysis / task / consent_record), so the entityId alone is a 
- **Exported functions:** readReadIds, listNotifications, computeStats, getUnreadCount, getNotificationsAndStats
- **Exported const:** READ_COOKIE, READ_COOKIE_CAP
- **Security signals:** india-compliance
- **External deps:** next/headers
- **Internal imports (4):** @/lib/rbac, ./engine, ./types, ./types
- **Domain terms:** credit_analysis

## `src/features/workflow/types.ts`

- **Lines:** 186 | **Bytes:** 7372
- **Kind:** Application module
- **Header intent:** Workflow Automation - notifications, reminders, escalations.  A notification here is a COMPUTED signal: the engine scans the live data (kyc_record, deal, credit_analysis, task, consent_record) for trigger conditions and returns a typed Notification[] - nothing is persisted. Read state (which notifications the user has dismissed) is stored in a cookie (see queries.ts / actions.ts), so the MVP needs no schema change. The set is recomputed fresh on every load; a notification disappears when its tri
- **Exported functions:** notificationId, relativeTime
- **Exported const:** SEVERITY_ORDER, SEVERITY_LABELS, SEVERITY_BADGE_VARIANT, NOTIFICATION_TYPE_ORDER, NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPE_GROUP
- **Exported types:** Severity, NotificationType, NotificationView, Notification, NotificationStats
- **Security signals:** india-compliance
- **Domain terms:** KYC, bond, credit_analysis, mandate, party

## `src/lib/auth.ts`

- **Lines:** 287 | **Bytes:** 11423
- **Kind:** Shared library
- **Header intent:** Auth.js v5 configuration (next-auth@5.0.0-beta.31) with the Drizzle adapter.  SESSION STRATEGY: JWT (this initial build). PRODUCTION TARGET: DB-stored sessions mirrored to in-region Redis (ElastiCache ap-south-1) so sessions are revocable at the edge (ARCHITECTURE §4.7). The adapter + `sessions` table are wired here so the cutover is `session: { strategy: "database" }` plus a Redis cache, not a re-architecture.  TODO(PRODUCTION): switch `session: { strategy: "database" }` and mirror session rows
- **DB ops patterns:** from, innerJoin, select, update, where
- **Security signals:** auth, rbac/rls, credentials
- **External deps:** @auth/drizzle-adapter, bcryptjs, drizzle-orm, next-auth, next-auth/jwt, next-auth/providers/credentials, otpauth
- **Internal imports (3):** @/db, @/db/schema, @/lib/org
- **TODOs/FIXMEs:** switch `session: { strategy: "database" }` and mirror
- **Domain terms:** binarybonds, binarycapital

## `src/lib/org.ts`

- **Lines:** 117 | **Bytes:** 3454
- **Kind:** Shared library
- **Header intent:** Binary Capital org model (CEO meeting). Brand scope is derived from desk so we need no schema migration.
- **Exported functions:** brandFromDesk, isSuperAdmin, isAdminish, isFirmWide, partyBrandSqlValues, isCreditModuleActive, canAccessCreditModule
- **Exported const:** ORG_ROSTER
- **Exported types:** BrandScope
- **Security signals:** rbac/rls
- **Domain terms:** Party, binarybonds, binarycapital, bond
