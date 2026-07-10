# Batch 016 — File-by-file analysis

**Agent:** 016  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Batch list:** `analysis/file-by-file/batch-016.list`  
**Files:** 4 (admin dashboard page, roles page, roles client view, users page)

---

## 1. `src/app/admin/page.tsx`

| Field | Value |
|---|---|
| **Path** | `src/app/admin/page.tsx` |
| **Absolute** | `/home/Jashmhta/crm/bc-crm/app/src/app/admin/page.tsx` |
| **Lines** | 66 |
| **Kind** | Next.js App Router **server page** (`async` RSC) |
| **Route** | `/admin` |
| **Directive** | none (`"use client"` absent → Server Component) |

### Role

Admin area home / system dashboard entrypoint. Loads firm-wide operational and security posture aggregates server-side, mutates one health field with active-user count from stats (avoids a second count query), and hands pure data to a client dashboard view for motion and count-ups.

### Exports

```ts
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Binary Capital CRM",
};

export default async function AdminDashboardPage(): Promise<JSX.Element>
```

- **`dynamic`**: forces dynamic rendering (no static cache); appropriate for live counts / audit.
- **`metadata`**: document title only (no `description` / OpenGraph).
- **Default export**: page component.

### Imports

| Symbol | From | Purpose |
|---|---|---|
| `PageHeader`, `PageShell` | `@/components/brand/page-shell` | Layout chrome |
| `requireUser`, `can` | `@/lib/rbac` | Auth gate + capability check |
| `redirect` | `next/navigation` | Soft-deny unauthorized users |
| `getSystemStats` | `@/features/admin/queries` | KPI counts + DB size |
| `getSystemHealth` | `@/features/admin/queries` | Security / MFA / lock / audit-chain digest |
| `listRecentAuditEntries` | `@/features/admin/queries` | Recent audit rail (limit 12) |
| `getAuditEntityBreakdown` | `@/features/admin/queries` | Top entity types by event count (limit 10) |
| `getAuditOperationBreakdown` | `@/features/admin/queries` | Operation mix (insert/update/…) |
| `getTopAuditActors` | `@/features/admin/queries` | Top actors by event count (limit 8) |
| `Reveal` | `@/components/brand` | **Imported but unused** |
| `AdminDashboardView` | `./dashboard-view` | Client presentation layer |

### Business purpose

Gives administrators (and anyone who can read audit) an at-a-glance firm posture:

1. **Volume KPIs** — users, active users, roles, permissions, deals, parties, credit analyses, audit rows, DB size (`SystemStats`).
2. **Security health** — inactive / locked / MFA-enrolled / never-logged-in users; audit hash-chain population (`SystemHealth`).
3. **Audit activity** — last 12 events, entity-type breakdown (top 10), full operation breakdown, top 8 actors.

Comment in file states proxy only checks authentication; RBAC is enforced in-page (ARCHITECTURE §4.6).

### Key logic

```ts
export default async function AdminDashboardPage() {
  const user = await requireUser();
  if (!can(user, "manage", "user") && !can(user, "read", "audit")) {
    redirect("/parties");
  }

  const [stats, health, recent, entityBreak, opBreak, topActors] =
    await Promise.all([
      getSystemStats(),
      getSystemHealth(),
      listRecentAuditEntries(12),
      getAuditEntityBreakdown(10),
      getAuditOperationBreakdown(),
      getTopAuditActors(8),
    ]);

  health.activeUsers = stats.activeUserCount;

  return (
    <PageShell>
      <PageHeader title="Admin" description="Users, roles, master data, and audit." />
      <AdminDashboardView
        stats={stats}
        health={health}
        recent={recent}
        entityBreak={entityBreak}
        opBreak={opBreak}
        topActors={topActors}
      />
    </PageShell>
  );
}
```

**Data shapes consumed (from `@/features/admin/queries`, not defined here):**

```ts
interface SystemStats {
  userCount: number;
  activeUserCount: number;
  roleCount: number;
  permissionCount: number;
  dealCount: number;
  partyCount: number;
  creditAnalysisCount: number;
  auditLogCount: number;
  dbSizeBytes: number;
}

interface SystemHealth {
  activeUsers: number;          // filled post-query from stats.activeUserCount
  inactiveUsers: number;
  lockedUsers: number;
  mfaEnrolledUsers: number;
  neverLoggedIn: number;
  auditChainedRows: number;
  auditTotalRows: number;
  lastEventAt: Date | null;
}

// recent: AuditLogRow[] (via listAuditLog)
// entityBreak: { entityType: string; n: number }[]
// opBreak: { operation: string; n: number }[]
// topActors: { actorEmail: string | null; n: number }[]
```

**Parallelism:** six independent reads under `Promise.all`.  
**Mutation of query result:** `health.activeUsers = stats.activeUserCount` — in-memory patch only; `getSystemHealth` intentionally returns `activeUsers: 0`.

### Side effects

| Effect | When |
|---|---|
| Session/DB load via `requireUser` → `getCurrentUser` | every request |
| Redirect to `/login` if unauthenticated | `requireUser` |
| Redirect to `/parties` if lacking both `user:manage` and `audit:read` | RBAC fail |
| Multiple read-only DB queries (counts, audit aggregates, `pg_database_size`) | successful auth |
| No writes / no server actions | — |

### Security / RBAC

- **Auth:** `requireUser()` — unauthenticated → `/login`.
- **Capability gate (OR):**
  - `can(user, "manage", "user")` → permission code `user:manage` (or admin/super_admin role bypass in `can`)
  - **or** `can(user, "read", "audit")` → permission code `audit:read`
- **Fail closed:** anyone else → `redirect("/parties")` (soft deny, no 403 page).
- **Note:** broader than roles/users pages (those require only `user:manage`). Audit-only roles can view the dashboard.
- **`can` implementation** (`@/lib/rbac-core`): admin / super_admin roles always true; else `permissions.has(\`${resource}:${action}\`)`.
- **No CSRF concern** on this page (reads only).
- **Data sensitivity:** exposes aggregate security posture, actor emails, recent audit events — intended for privileged staff only.

### Coupling

| Peer | Relationship |
|---|---|
| `./dashboard-view` (`AdminDashboardView`) | Presentation contract for all six props |
| `@/features/admin/queries` | Entire data plane |
| `@/lib/rbac` | Auth + authorization |
| `@/components/brand/page-shell` | Layout |
| Downstream admin routes (users, roles, audit, master-data) | Linked from client view, not this file |

### Risks / TODOs / code quality

1. **Unused import:** `Reveal` is imported and never used (dead code; lint noise).
2. **OR gate asymmetry:** roles/users require `user:manage` only; dashboard also allows `audit:read` — intentional per comments, but audit-only users see user-lock/MFA aggregates they may not be allowed to act on.
3. **No error boundary / try-catch** around `Promise.all` — any query failure fails the whole page.
4. **Force-dynamic** on every hit may be expensive if admin is frequently opened (multiple count queries + `pg_database_size` + audit aggregates).
5. **In-place mutation** of `health` object is fine for RSC serialisation to client but is a mild purity smell.
6. No TODO/FIXME comments in file.

---

## 2. `src/app/admin/roles/page.tsx`

| Field | Value |
|---|---|
| **Path** | `src/app/admin/roles/page.tsx` |
| **Absolute** | `/home/Jashmhta/crm/bc-crm/app/src/app/admin/roles/page.tsx` |
| **Lines** | 46 |
| **Kind** | Next.js App Router **server page** |
| **Route** | `/admin/roles` |
| **Directive** | Server Component |

### Role

Server shell for the role–permission matrix UI. Enforces `user:manage`, loads full role catalogue (with current grants + user counts) and full permission catalogue, renders header + client `RolesManagerView`.

### Exports

```ts
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Roles · Admin · Binary Capital CRM",
};

export default async function AdminRolesPage(): Promise<JSX.Element>
```

### Imports

| Symbol | From | Purpose |
|---|---|---|
| `redirect` | `next/navigation` | Soft deny |
| `requireUser`, `can` | `@/lib/rbac` | Auth + RBAC |
| `listRoles`, `listPermissions` | `@/features/admin/queries` | Data loaders |
| `type AdminRoleRow`, `type AdminPermissionRow` | `@/features/admin/queries` | **Type-only imports; unused in this file** (props inferred via child) |
| `Reveal` | `@/components/brand` | Header enter animation wrapper |
| `RolesManagerView` | `./roles-view` | Client manager |
| `PageShell`, `PageHeader`, `DetailTopBar` | `@/components/brand/page-shell` | Layout; **`DetailTopBar` unused** |

### Business purpose

Admin surface to inspect the firm’s role catalogue and **assign/revoke permission codes** per role. Comments document:

- Gated to `user:manage` (admin-capable roles).
- The **`admin` role is protected** — its permissions cannot be edited here (prevents bricking the panel by revoking `user:manage` from admin).

Header copy states toggles update effective permissions immediately on save; admin grants not editable.

### Key logic

```ts
export default async function AdminRolesPage() {
  const user = await requireUser();
  if (!can(user, "manage", "user")) redirect("/parties");

  const [roles, permissions] = await Promise.all([
    listRoles(),
    listPermissions(),
  ]);

  return (
    <PageShell>
      <Reveal y={10} duration={0.55} noBlur>
        <PageHeader
          title="Roles"
          description="The firm's role catalogue and the permission codes granted to each. Toggle a permission to assign or revoke it - the role's effective permissions update immediately. The admin role is protected; its grants are not editable here."
        />
      </Reveal>
      <RolesManagerView roles={roles} permissions={permissions} />
    </PageShell>
  );
}
```

**Row shapes passed to client:**

```ts
interface AdminRoleRow {
  roleId: string;
  name: string;
  desk: string | null;
  description: string | null;
  permissions: { permissionId: string; code: string }[];
  userCount: number;
}

interface AdminPermissionRow {
  permissionId: string;
  code: string;
  description: string | null;
}
```

`listRoles()` joins `role` ⟕ `role_permission` ⟕ `permission`, collapses fan-out, then counts active `user_role` grants per role.  
`listPermissions()` returns non-deleted permission catalogue ordered by `code`.

### Side effects

| Effect | When |
|---|---|
| Auth + RBAC | every request |
| Redirect `/login` or `/parties` | fail |
| Parallel read of roles + permissions | success |
| **No mutations in this file** | mutations live in client → `updateRolePermissions` action |

### Security / RBAC

- **Requires:** `can(user, "manage", "user")` → `user:manage` (or admin/super_admin).
- **Does not** allow audit-only users (stricter than `/admin` dashboard).
- **Defense in depth:** client marks admin role read-only; server action also refuses `target.name === "admin"` (see `updateRolePermissions` in `@/features/admin/actions`).
- Soft redirect (not HTTP 403).

### Coupling

| Peer | Relationship |
|---|---|
| `./roles-view` | Sole UI consumer of props |
| `@/features/admin/queries` | `listRoles`, `listPermissions` |
| `@/features/admin/actions` | Indirect via client view |
| DB tables | `role`, `role_permission`, `permission`, `user_role` (via queries) |

### Risks / TODOs / code quality

1. **Unused imports:** `AdminRoleRow`, `AdminPermissionRow`, `DetailTopBar`.
2. **No empty-state at server layer** — empty roles handled in client.
3. **Full catalogue always loaded** — fine for small permission matrices; could grow heavy if permission table balloons.
4. **No pagination**.
5. `description` on roles/permissions is loaded in rows but **role `description` is never displayed** in `roles-view` (data waste / incomplete UX).
6. No TODO/FIXME in file.

---

## 3. `src/app/admin/roles/roles-view.tsx`

| Field | Value |
|---|---|
| **Path** | `src/app/admin/roles/roles-view.tsx` |
| **Absolute** | `/home/Jashmhta/crm/bc-crm/app/src/app/admin/roles/roles-view.tsx` |
| **Lines** | 320 |
| **Kind** | Client UI module for role permission management |
| **Directive** | `"use client"` |

### Role

Client view layer for `/admin/roles`: renders a responsive grid of role cards; each card is a form that optimistically tracks selected permission codes, grouped by resource prefix, and submits the full selected set to `updateRolePermissions`.

### Exports

```ts
export interface RolesManagerViewProps {
  roles: AdminRoleRow[];
  permissions: AdminPermissionRow[];
}

export function RolesManagerView({
  roles,
  permissions,
}: RolesManagerViewProps): JSX.Element
```

**Internal (non-exported) symbols:**

```ts
function groupByResource(
  perms: AdminPermissionRow[],
): { resource: string; codes: string[] }[]

function RoleCard({
  role,
  groups,
}: {
  role: AdminRoleRow;
  groups: { resource: string; codes: string[] }[];
}): JSX.Element

function PermissionToggle({
  code,
  action,
  checked,
  disabled,
  onToggle,
}: {
  code: string;
  action: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}): JSX.Element

function prettify(s: string): string  // replaces `_` with space
```

### Imports

| Symbol | From | Purpose |
|---|---|---|
| `* as React` | `react` | `useMemo`, `useState`, `useEffect` |
| `useActionState` | `react` | Form action state (pending/error/ok) |
| `Keyhole`, `LockSimple`, `Check`, `SealCheck`, `ShieldCheck`, `CircleNotch` | `@phosphor-icons/react` | Icons |
| `cn` | `@/lib/utils` | className merge |
| `AdminRoleRow`, `AdminPermissionRow` | `@/features/admin/queries` | Prop/row types |
| `Card`, `CardBody`, `CardHeader`, `Eyebrow`, `Badge`, `IconTile`, `EmptyState` | `@/components/brand` | Design system |
| `updateRolePermissions`, `UpdateRolePermissionsState` | `@/features/admin/actions` | Server action + state type |

**Action state type (from actions):**

```ts
export type UpdateRolePermissionsState = {
  error?: string;
  ok?: boolean;
} | undefined;
```

**Action signature (peer):**

```ts
export async function updateRolePermissions(
  _prev: UpdateRolePermissionsState,
  formData: FormData,
): Promise<UpdateRolePermissionsState>
```

FormData fields used here:

- `roleId` — hidden input, `role.roleId` (UUID)
- `permissionCodes` — repeated hidden inputs, one per selected code

### Business purpose

Admin’s mental model of RBAC as a **resource-grouped toggle grid** (`party:…`, `deal:…`, `credit:…`, `kyc:…`, etc.), not a flat alphabetised list. Supports:

- Viewing each role’s name, desk, user count, granted/total permission counts.
- Toggling permission chips (action segment only shown; full code in `title`).
- Resetting local selection to last server grants.
- Saving via server action (replace-all grant set).
- Protecting `admin` role (read-only card, no save controls).

### Key logic

#### `groupByResource`

```ts
// Split permission.code on first ":" → resource key
// codes sorted localeCompare within group; groups sorted by resource
```

Example: `"party:read"` → resource `party`, action label `read`.

#### `RolesManagerView`

- Memoises `groups` from full `permissions` catalogue.
- Empty catalogue → `EmptyState` (“No roles defined… seed script”).
- Else `lg:grid-cols-2` of `RoleCard`.

#### `RoleCard`

```ts
const isAdmin = role.name === "admin";  // string name equality, not roleId
const [state, action, pending] = useActionState(updateRolePermissions, undefined);

const currentCodes = new Set(role.permissions.map((p) => p.code));
const [selected, setSelected] = React.useState<Set<string>>(currentCodes);

React.useEffect(() => {
  setSelected(new Set(role.permissions.map((p) => p.code)));
}, [role]);  // re-sync after revalidate

function toggle(code: string) {
  if (isAdmin || pending) return;
  // optimistic Set add/delete
}
```

**Form submit model:**

- Hidden `roleId`.
- One hidden `permissionCodes` input per **currently selected** code (full replace set, not a diff).
- Save / Reset only if `!isAdmin`.
- Reset sets `selected` back to `currentCodes` (snapshot from render-time role.permissions — see risks).

**UI feedback:**

- `state?.error` → alert paragraph (`role="alert"`).
- `state?.ok` → success “Permissions updated.”
- Pending spinner on submit.

#### `PermissionToggle`

- `type="button"` chip with `aria-pressed={checked}`.
- Disabled when admin-protected or action pending.
- Displays **action suffix only** (after `:`), full code in `title`.

### Side effects

| Effect | Mechanism |
|---|---|
| Local optimistic selection | `setSelected` on toggle |
| Server mutation | form `action={action}` → `updateRolePermissions` |
| Cache revalidation | performed inside server action (not this file); comment expects revalidate of `/admin/roles` |
| Effect re-sync of selection | when `role` prop identity/content changes after RSC refresh |
| No localStorage / no network calls from browser besides form action | |

**Server action side effects (peer, security-relevant):**

- `requireUser` + `requireManage` (must re-check `user:manage`).
- Zod: `roleId: z.uuid()`, `permissionCodes?: z.array(z.string().min(1))`.
- Refuses `admin` role by name.
- Resolves codes → permission IDs; errors on unknown codes.
- Transaction: delete all `role_permission` for role, insert new set.
- Audit diff of added/removed codes (action continues past line 548).

### Security / RBAC

| Control | Where |
|---|---|
| Page-level gate `user:manage` | `roles/page.tsx` |
| Server action re-gate | `updateRolePermissions` → `requireManage` |
| Admin role hard-protect | Client UI **and** server (`target.name === "admin"`) |
| Permission code validation | Server resolves codes against DB; unknown rejected |
| Client-only disable of admin card | UX only — must not be sole control (is not) |

**Attack surface notes:**

- Client can POST arbitrary `roleId` + codes; server validates UUID, existence, non-admin, known codes.
- Empty selection (`permissionCodes` absent) is allowed by schema `.optional()` — can strip all grants from a non-admin role (footgun, not exploit).
- Hidden inputs can be manipulated in DevTools — expected for server-action forms; authority is server-side.

### Coupling

| Peer | Strength |
|---|---|
| `@/features/admin/actions.updateRolePermissions` | Hard — form action |
| `@/features/admin/queries` types | Hard — prop contracts |
| Brand components | UI shell |
| Permission code convention `resource:action` | Implicit protocol for grouping / labels |
| Role name `"admin"` magic string | Coupled to seed / role catalogue naming |

### Risks / TODOs / code quality

1. **Reset bug / stale snapshot:**  
   `const currentCodes = new Set(role.permissions.map(...))` is computed every render, but Reset does `setSelected(currentCodes)`. That is correct for current render’s role. However, if user toggles then server revalidates with same `role` object reference without effect firing as expected… Effect depends on `[role]` (object identity). If parent re-renders with a new array of new objects, OK; if shallow-equal identity is reused incorrectly, selection may desync. Typical Next RSC refresh passes new props → usually fine.

2. **`useEffect` dependency on whole `role`:** may re-run often; also ESLint exhaustive-deps may want `role.permissions`. Intentional for revalidate sync.

3. **Magic string `role.name === "admin"`** — brittle if renamed or multiple super roles; `super_admin` role (if present as separate row) is **editable** unless also named `admin`.

4. **Replace-all grants** — accidental full uncheck + save strips all permissions for a role (including production desks). No confirmation dialog.

5. **Optimistic UI without rollback on error:** on `state.error`, `selected` stays at optimistic set (does not auto-revert). Reset still available.

6. **Accessibility:** toggles are buttons with `aria-pressed`; form submit is separate — good. No keyboard “select all resource” helpers.

7. **Performance:** each selected permission becomes a hidden `<input>`; with large catalogues this is fine for dozens of codes, awkward for hundreds.

8. **Permission `description` unused** in UI (only codes/actions shown).

9. **No loading.tsx dependency** in this file (route may have parent admin loading).

10. No TODO/FIXME comments.

---

## 4. `src/app/admin/users/page.tsx`

| Field | Value |
|---|---|
| **Path** | `src/app/admin/users/page.tsx` |
| **Absolute** | `/home/Jashmhta/crm/bc-crm/app/src/app/admin/users/page.tsx` |
| **Lines** | 47 |
| **Kind** | Next.js App Router **server page** |
| **Route** | `/admin/users` |
| **Directive** | Server Component |

### Role

Server shell for firm `app_user` administration: list all users with roles, load role catalogue and desk enum for forms, pass `currentUserId` so client can refuse self-deactivation UX (server also enforces).

### Exports

```ts
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Users · Admin · Binary Capital CRM",
};

export default async function AdminUsersPage(): Promise<JSX.Element>
```

### Imports

| Symbol | From | Purpose |
|---|---|---|
| `redirect` | `next/navigation` | Soft deny |
| `requireUser`, `can` | `@/lib/rbac` | Auth + RBAC |
| `listUsers`, `listRoles`, `DESKS` | `@/features/admin/queries` | Users, roles, desk catalogue |
| `type AdminUserRow` | `@/features/admin/queries` | **Unused type import** |
| `Reveal` | `@/components/brand` | Header animation |
| `UsersManagerView` | `./users-view` | Client manager (create/edit/deactivate) |
| `PageShell`, `PageHeader`, `DetailTopBar` | `@/components/brand/page-shell` | Layout; **`DetailTopBar` unused** |

### Business purpose

Admin CRUD surface for application accounts:

- List: email, desk, barrier clearance, active role grants, login posture (last login, MFA, locks — via `AdminUserRow` fields consumed in client).
- Create user with bcrypt-hashed password (in actions, not this file).
- Edit desk / roles / clearance.
- Deactivate; **self-deactivation refused** (page description + `currentUserId` prop).

### Key logic

```ts
export default async function AdminUsersPage() {
  const user = await requireUser();
  if (!can(user, "manage", "user")) redirect("/parties");

  const [users, roles] = await Promise.all([listUsers(), listRoles()]);

  return (
    <PageShell>
      <Reveal y={10} duration={0.55} noBlur>
        <PageHeader
          title="Users"
          description="The firm's app_user accounts - email, desk, barrier clearance, active role grants, and login posture. Create a user with a bcrypt-hashed password, edit their desk/roles/clearance, or deactivate. Self-deactivation is refused."
        />
      </Reveal>

      <UsersManagerView
        users={users}
        roles={roles.map((r) => ({ roleId: r.roleId, name: r.name }))}
        desks={[...DESKS]}
        currentUserId={user.appUserId ?? ""}
      />
    </PageShell>
  );
}
```

**Props derived:**

```ts
// users: AdminUserRow[]
interface AdminUserRow {
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

// roles slimmed for form multi-select:
roles: { roleId: string; name: string }[]

// desks: string[] copy of DESKS readonly catalogue
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

// currentUserId: string  ("" if appUserId null — edge case)
```

**Note:** `listRoles()` also loads full permission matrices + user counts for every role — **over-fetch** relative to what this page needs (`roleId` + `name` only). A lighter `listRoleOptions()` would be cheaper.

### Side effects

| Effect | When |
|---|---|
| Auth + RBAC | every request |
| Redirect `/login` / `/parties` | fail |
| Parallel `listUsers` + `listRoles` | success |
| Mutations | only in client view + admin actions (create/edit/deactivate) |

`listUsers` joins non-deleted `app_user` with active `user_role`/`role` (valid_to null, not soft-deleted), ordered by `created_at` desc.

### Security / RBAC

- **Requires:** `can(user, "manage", "user")` only (same as roles page).
- **Passes `currentUserId={user.appUserId ?? ""}`** so UI can block self-deactivate; empty string if `appUserId` missing (should not happen after `requireUser` which needs `appUserId` in session — `CrmUser.appUserId` is `string | null` but `getCurrentUser` returns null without session `appUserId`, so practical path is non-null).
- Passwords never loaded here (not part of `AdminUserRow`).
- Barrier clearance and MFA status exposed to any `user:manage` holder — expected for admin.
- Soft deny redirect pattern consistent with admin siblings.

### Coupling

| Peer | Relationship |
|---|---|
| `./users-view` (`UsersManagerView`) | Full UI + mutations |
| `@/features/admin/queries` | `listUsers`, `listRoles`, `DESKS` |
| `@/features/admin/actions` | Indirect (create/update/deactivate via client) |
| `@/lib/rbac` | Gate |
| Desk catalogue | Shared constant used for form options |

### Risks / TODOs / code quality

1. **Unused imports:** `AdminUserRow`, `DetailTopBar`.
2. **Over-fetch:** `listRoles()` pulls permissions + counts; only `{ roleId, name }` used.
3. **`desks={[...DESKS]}`** — unnecessary spread if client accepts `readonly string[]`; cheap.
4. **`currentUserId` fallback `""`** — if ever empty, self-deactivation guard by ID equality may fail open on client (server must still refuse).
5. **No server-side filter** for soft-deleted is already in query; no search/pagination at page level — all users to client (scale risk for large orgs).
6. Header claims “bcrypt-hashed password” — hashing is in actions, not verified in this file (documentation only).
7. No TODO/FIXME in file.

---

## Cross-file summary (batch 016)

| File | Lines | Layer | Primary export | RBAC gate |
|---|---:|---|---|---|
| `src/app/admin/page.tsx` | 66 | RSC page `/admin` | `AdminDashboardPage` | `user:manage` **OR** `audit:read` |
| `src/app/admin/roles/page.tsx` | 46 | RSC page `/admin/roles` | `AdminRolesPage` | `user:manage` |
| `src/app/admin/roles/roles-view.tsx` | 320 | Client view | `RolesManagerView` | inherits page; mutates via `updateRolePermissions` |
| `src/app/admin/users/page.tsx` | 47 | RSC page `/admin/users` | `AdminUsersPage` | `user:manage` |

### Shared patterns

1. **`export const dynamic = "force-dynamic"`** on all three pages.
2. **`requireUser()` + `can(...)` + `redirect("/parties")`** soft authorization.
3. **Server fetch → client present** split (`*View` components).
4. **`PageShell` + `PageHeader`** layout chrome; roles/users wrap header in `Reveal`.
5. Data plane centralized in `@/features/admin/queries`; mutations in `@/features/admin/actions`.

### Shared risks

1. Soft redirects (not 403) may confuse API/crawler clients; fine for browser CRM.
2. Dead imports across pages (`Reveal` on dashboard; `DetailTopBar` on roles/users; unused type imports).
3. Admin role protection is **name-based** (`"admin"`), not capability- or ID-based.
4. Dashboard gate is wider (`audit:read`) than users/roles — intentional product split.
5. No explicit rate limiting or audit of **who opened** the admin pages (only mutations audited in actions).

### Dependency sketch

```
/admin (page.tsx)
  ├─ requireUser / can(user:manage | audit:read)
  ├─ getSystemStats | getSystemHealth | listRecentAuditEntries
  │   getAuditEntityBreakdown | getAuditOperationBreakdown | getTopAuditActors
  └─ AdminDashboardView (./dashboard-view)  [out of batch]

/admin/roles (roles/page.tsx)
  ├─ requireUser / can(user:manage)
  ├─ listRoles + listPermissions
  └─ RolesManagerView (roles/roles-view.tsx)
        └─ updateRolePermissions (features/admin/actions)

/admin/users (users/page.tsx)
  ├─ requireUser / can(user:manage)
  ├─ listUsers + listRoles + DESKS
  └─ UsersManagerView (./users-view)  [out of batch]
```

### Tables / domains touched (via queries, not local SQL)

| Domain table | Via |
|---|---|
| `app_user` | stats, health, listUsers |
| `role`, `role_permission`, `permission`, `user_role` | listRoles, listPermissions, role updates |
| `deal`, `party`, `credit_analysis` | dashboard counts |
| `audit_log` | dashboard rails / chain health |
| PostgreSQL `pg_database_size` | dashboard stats |

---

*End of batch 016 analysis.*
