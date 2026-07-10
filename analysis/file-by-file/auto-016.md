
# Batch 016

## `src/app/admin/page.tsx`

- **Lines:** 65 | **Bytes:** 2157
- **Kind:** Next.js page route
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth, rbac/rls, credentials, india-compliance
- **External deps:** next/navigation
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/admin/queries, @/components/brand, ./dashboard-view

## `src/app/admin/roles/page.tsx`

- **Lines:** 45 | **Bytes:** 1527
- **Kind:** Next.js page route
- **Header intent:** Admin → Roles - list roles + their permissions, assign/revoke permissions. Gated to user:manage (admin role). The admin role itself is protected - its permissions cannot be edited through this surface (an admin locking themselves out of user:manage would brick the panel).
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** next/navigation
- **Internal imports (5):** @/lib/rbac, @/features/admin/queries, @/components/brand, ./roles-view, @/components/brand/page-shell

## `src/app/admin/roles/roles-view.tsx`

- **Lines:** 320 | **Bytes:** 10715
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** RolesManagerView
- **Exported types:** RolesManagerViewProps
- **DB ops patterns:** delete, from
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (4):** @/lib/utils, @/features/admin/queries, @/components/brand, @/features/admin/actions
- **Domain terms:** kyc, party

## `src/app/admin/users/page.tsx`

- **Lines:** 46 | **Bytes:** 1541
- **Kind:** Next.js page route
- **Header intent:** Admin → Users - list all app_user records with email, roles, desk, active status, last login. Create / edit / deactivate actions live in the client view (useActionState forms). Gated to user:manage (admin role).
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth, rbac/rls, credentials
- **External deps:** next/navigation
- **Internal imports (5):** @/lib/rbac, @/features/admin/queries, @/components/brand, ./users-view, @/components/brand/page-shell
- **Domain terms:** barrier
