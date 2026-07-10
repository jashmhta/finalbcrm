# File-by-file analysis — agent-094

**Batch:** `batch-094.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (rbac-core, rbac, utils, proxy)

---

## 1. `src/lib/rbac-core.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/lib/rbac-core.ts` |
| **Lines** | 18 |
| **Directive** | Pure helper (client-safe) |
| **Role** | Permission check without DB/auth imports. |

### Exports

```ts
export interface RbacSubject {
  roles?: string[];
  permissions: Set<string>;
}

export function can(
  user: RbacSubject | null | undefined,
  action: string,
  resource: string,
): boolean {
  if (!user) return false;
  if (user.roles?.includes("admin") || user.roles?.includes("super_admin")) {
    return true;
  }
  return user.permissions.has(`${resource}:${action}`);
}
```

### Business purpose

Split so client components can import `can` without pulling getCurrentUser/db. Permission codes are `resource:action` strings.

### Security

admin/super_admin bypass all can() checks — no resource granularity for supers.

### Risks

- Stringly-typed resource/action (typos fail closed for non-admins).
- No brand-aware can().

---

## 2. `src/lib/rbac.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/lib/rbac.ts` |
| **Lines** | 156 |
| **Directive** | Server |
| **Role** | Current user loader + requireUser + scope helpers. Re-exports can. |

### Exports

```ts
export { can } from "./rbac-core"
export interface CrmUser {
  id: string;
  email: string;
  name?: string | null;
  appUserId: string | null;
  roles: string[];
  wall: string[];
  permissions: Set<string>;
  desk: string | null;
  brandScope: BrandScope;
}

export const getCurrentUser = cache(async (): Promise<CrmUser | null>)
export async function requireUser(): Promise<CrmUser>
export function canReadAllInScope(user): boolean
export function isFirmWideUser(user): boolean
```

### getCurrentUser logic

1. auth() session; need appUserId.
2. Load permissions via userRole→rolePermission→permission (valid_to null).
3. Load app_user isActive/desk/email; inactive → null.
4. brandScope from JWT or brandFromDesk(desk).
5. **Implicit grants** if seed incomplete:
   - super_admin/admin: party/deal/kyc/reports:export/user:manage/audit/interaction/task/lead codes.
   - coverage_rm/bond_desk: read/create party/deal/interaction/task/lead, document/kyc read.

### requireUser

redirect `/login` if null.

### canReadAllInScope / isFirmWideUser

super_admin/admin or party:read_all or user:manage; firm-wide = shared brand + canReadAllInScope.

### Side effects

DB permission join every request (React cache per request).

### Security / RBAC

- Wall (information barrier) loaded but not enforced inside can().
- Implicit grants paper over incomplete role_permission matrix — production must seed fully.
- permissions Set not serializable to client without conversion (CrmUser stays server).

### Coupling

auth, org, schema auth tables, nearly every page/action.

### Risks

- Dual sources of truth: JWT roles vs DB roles (roles from session JWT; permissions re-queried).
- Role change requires re-login for roles; permissions refresh each request.
- wall unused in this module.

---

## 3. `src/lib/utils.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/lib/utils.ts` |
| **Lines** | 7 |
| **Directive** | Pure |
| **Role** | Tailwind class merge helper. |

### Exports

```ts
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

### Coupling

Nearly all UI components. No business logic.

---

## 4. `src/proxy.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/proxy.ts` |
| **Lines** | 57 |
| **Directive** | Next.js 16 Proxy (successor to middleware) |
| **Role** | Coarse auth gate only. |

### Exports

```ts
export default auth((req) => { ... })
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
}
```

### Key logic

1. `/api/auth/*` passthrough.
2. PUBLIC_PATHS = `/login` only.
3. Unauthenticated + non-public → redirect `/login?callbackUrl=pathname`.
4. Authenticated + `/login` → redirect `/parties`.
5. JWT decode via auth wrapper — no DB.

### Architecture comments (in-file)

RBAC can() server-side; RLS SET LOCAL authoritative for data; proxy must not be sole control.

### Security

- Only /login public — no public marketing pages.
- Logged-in users land on `/parties` not home `/`.
- Matcher still runs on most routes including static-ish pages.

### Risks / TODOs

- No MFA step-up in proxy.
- callbackUrl open redirect? nextUrl relative path — generally same-origin.
- No brand-based routing.
- Portal routes (if any public) not special-cased in this PUBLIC_PATHS list — may require auth.

---

## Cross-file architecture (batch 094)

```
proxy (JWT cookie) → pages requireUser/getCurrentUser → can(resource,action)
                  → withRls(appUserId, wall) on mutations
rbac-core.can shared pure
```

**Mutation boundary pattern:** requireUser + can + withRls in actions.  
**RLS:** proxy comments assert RLS as data authority; practice still app-layer heavy.  
**Dual brand:** brandScope on CrmUser from org/auth.

*End of agent-094 analysis.*
