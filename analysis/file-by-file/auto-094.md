
# Batch 094

## `src/lib/rbac-core.ts`

- **Lines:** 17 | **Bytes:** 379
- **Kind:** Shared library
- **Exported functions:** can
- **Exported types:** RbacSubject
- **Security signals:** auth, rbac/rls

## `src/lib/rbac.ts`

- **Lines:** 154 | **Bytes:** 4161
- **Kind:** Shared library
- **Header intent:** RBAC helper + server-side current-user loader. Brand scope + super-admin export rules from CEO org model (lib/org.ts).
- **Exported functions:** requireUser, canReadAllInScope, isFirmWideUser
- **Exported const:** getCurrentUser
- **Exported types:** CrmUser
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm, next/navigation, react
- **Internal imports (5):** @/lib/auth, @/db, @/db/schema, @/lib/org, ./rbac-core
- **Domain terms:** binarybonds, binarycapital, kyc, party

## `src/lib/utils.ts`

- **Lines:** 6 | **Bytes:** 166
- **Kind:** Shared library
- **Exported functions:** cn
- **External deps:** clsx, tailwind-merge

## `src/proxy.ts`

- **Lines:** 56 | **Bytes:** 2214
- **Kind:** Application module
- **Header intent:** Next.js 16 Proxy - the renamed, Node.js-runtime successor to `middleware.ts`. See node_modules/next/dist/docs/01-app/.../proxy.md: "Starting with Next.js 16, Middleware is now called Proxy." The file convention is `proxy.ts` at the same level as `app/` (i.e. in `src/` for this project), and the exported function is `proxy` (named) or a default export.  RESPONSIBILITY: COARSE auth only - redirect unauthenticated users to /login and bounce already-authenticated users off /login. RBAC enforcement (
- **Exported const:** config
- **Default export:** yes
- **Security signals:** auth, rbac/rls
- **External deps:** next/server
- **Internal imports (1):** @/lib/auth
