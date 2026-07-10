# File-by-file analysis — agent-093

**Batch:** `batch-093.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (workflow queries/types; auth; org)

---

## 1. `src/features/workflow/queries.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/features/workflow/queries.ts` |
| **Lines** | 177 |
| **Directive** | Server |
| **Role** | Notification list + stats + cookie **reads**. |

### Exports

```ts
export const READ_COOKIE = "bc_notif_read"
export const READ_COOKIE_CAP = 50
export async function readReadIds(): Promise<Set<string>>
export async function listNotifications(opts?): Promise<NotificationView[]>
export function computeStats(items: NotificationView[]): NotificationStats
export async function getUnreadCount(user?): Promise<number>
export async function getNotificationsAndStats(opts?): Promise<{ items; stats }>
export type { NotificationView, Severity }
```

### Key logic

- Cookie stores dismissed **entity ids** (not type:entity) for size.
- relativeTime stamped server-side for hydration safety.
- getNotificationsAndStats: full engine once for stats; slice for items.

### Side effects

cookies().get only (render-safe).

### Risks

Same cookie CAP/entity-key design as actions.

---

## 2. `src/features/workflow/types.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/features/workflow/types.ts` |
| **Lines** | 187 |
| **Directive** | Client-safe pure types |
| **Role** | Notification domain model + labels + relativeTime. |

### Exports

```ts
export type Severity = "info" | "warning" | "critical"
export type NotificationType =
  | "kyc_expiring" | "kyc_expired" | "deal_stuck"
  | "credit_committee_pending" | "task_overdue" | "task_due_soon"
  | "consent_withdrawn" | "party_duplicate"

export interface Notification { id, type, severity, title, description, href, entityLabel, entityId, occurredAt }
export interface NotificationView extends Notification { read, relative }
export interface NotificationStats { total, unread, critical, warning, info }

export const SEVERITY_ORDER, SEVERITY_LABELS, SEVERITY_BADGE_VARIANT
export const NOTIFICATION_TYPE_ORDER, NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPE_GROUP
export function notificationId(type, entityId): string  // `${type}:${entityId}`
export function relativeTime(iso, now = Date.now()): string
```

### Business purpose

Deterministic ids for stable dismiss matching; pure relativeTime en-IN style strings for SSR.

### Coupling

Engine builds Notification; UI imports labels; cookie uses entityId subset of id.

### Risks

Cookie key ≠ full notificationId — documented tradeoff.

---

## 3. `src/lib/auth.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/lib/auth.ts` |
| **Lines** | 288 |
| **Directive** | Auth.js v5 config |
| **Role** | Credentials auth + JWT session + CRM profile stamping. |

### Exports

```ts
export const { handlers, signIn, signOut, auth } = NextAuth({ ... })
```

### Session strategy

JWT now; TODO PRODUCTION: database sessions + Redis ap-south-1 revocation; prefer OIDC/SAML IdP; encrypt mfa_secret; WebAuthn.

### authorize pipeline

1. Lookup app_user by email citext, not deleted.
2. Dummy bcrypt on unknown/inactive (enumeration timing).
3. Lockout: LOCKOUT_THRESHOLD=5, WINDOW=15m; locked returns null indistinguishably.
4. bcrypt password; on fail registerFailedLogin (atomic count + lock).
5. If mfaEnabled: require mfaSecret + 6-digit TOTP window 1; fail closed if secret missing.
6. Success: reset failed_login_count, lastLoginAt.
7. Return User { id, email, name from email local, appUserId }.

### JWT/session callbacks

On first sign-in load barrierClearance (wall), desk, roles (userRole valid_to null), brandFromDesk(desk) → token/session.

### Type augmentation

session.user: appUserId, wall, roles, desk, brandScope (binarycapital|binarybonds|shared).

### Security

- trustHost: true (IP deploy caveat).
- Dummy hash at module load.
- MFA optional per user.
- No password reset/email verification flows.

### Side effects

DB reads/writes on login path.

### Risks / TODOs (production)

- JWT non-revocable until DB sessions.
- MFA secret at rest plaintext Base32.
- Credentials-only IdP.
- trustHost broad.
- Display name from email not profile.

---

## 4. `src/lib/org.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/lib/org.ts` |
| **Lines** | 118 |
| **Directive** | Pure org model |
| **Role** | Dual-brand desk→brand map, super helpers, credit module access, roster. |

### Exports

```ts
export type BrandScope = "binarycapital" | "binarybonds" | "shared"
export function brandFromDesk(desk): BrandScope
export function isSuperAdmin(roles): boolean
export function isAdminish(roles): boolean  // super_admin | admin | director
export function isFirmWide(brand): boolean
export function partyBrandSqlValues(brand): string[]  // shared always visible with either brand
export const ORG_ROSTER: readonly { email, name, brand, level }[]
export function isCreditModuleActive(): boolean
export function canAccessCreditModule(roles): boolean
```

### brandFromDesk

| Desk | Brand |
|------|-------|
| bond_underwriting, gsec_trading, secondary_mm, portfolio_mgmt, credit, rating_advisory | binarybonds |
| ib_advisory, operations | binarycapital |
| management, compliance, default | shared |

### ORG_ROSTER

Shray (shared super), Shahrukh (capital super), Rati/Niraj (bonds supers), Yash/Pranjali (capital employees), Tashmit (bonds employee).

### canAccessCreditModule

super_admin | admin | credit_analyst | director OR env CREDIT_ANALYSIS_ACTIVE / NEXT_PUBLIC_CREDIT_ANALYSIS_ACTIVE true.

### Business purpose

CEO meeting dual-brand model without schema migration (desk-derived). Shared parties visible to both supers via partyBrandSqlValues.

### Risks

- isCreditModuleActive() logic is weak (returns true for most values).
- Roster is documentation/seed aid — not runtime ACL alone.

---

## Cross-file architecture (batch 093)

```
auth.authorize → jwt(wall,roles,desk,brandScope) → rbac.getCurrentUser
org.brandFromDesk + canAccessCreditModule
workflow types/queries support notifications MVP
```

**Dual brand** centers on org.ts + auth brandScope.  
**Compliance** MFA/lockout partial; production IdP TODO.

*End of agent-093 analysis.*
