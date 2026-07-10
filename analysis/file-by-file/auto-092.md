
# Batch 092

## `src/features/tasks/queries.ts`

- **Lines:** 406 | **Bytes:** 11096
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side task data access (DATA_MODEL §2.19). Tasks have due dates, priority, status, an assignee (app_user), optional deal/party context, and a dependency graph via the task_dependency junction (PK (task_id, depends_on_task_id)). RLS-aware once policies are migrated; until then these are plain queries. All functions are safe to call from Server Components.
- **Exported functions:** listTasks, getTaskDetail, listAssigneeOptions, listDealOptions, listPartyOptions, listTaskDependencyOptions
- **Exported types:** TaskListItem, TaskListResult, TaskDependencyRow, TaskDetail, AssigneeOption, DealOption, PartyOption, TaskOption
- **DB ops patterns:** from, innerJoin, leftJoin, select, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/lib/rbac, @/db/schema
- **Domain terms:** party

## `src/features/workflow/actions.ts`

- **Lines:** 198 | **Bytes:** 7781
- **Kind:** Server Actions module; Client component; Feature mutations (actions)
- **Directive:** `use server`
- **Directive:** `use client`
- **Exported functions:** markAsRead, markAllAsRead, getBellData, loadMoreNotifications
- **Exported types:** MarkReadResult, MarkAllReadResult, BellData, LoadMoreResult
- **DB ops patterns:** from
- **External deps:** next/cache, next/headers
- **Internal imports (5):** @/lib/rbac, ./engine, ./queries, ./types, ./types

## `src/features/workflow/engine.ts`

- **Lines:** 773 | **Bytes:** 27303
- **Kind:** Application module
- **Header intent:** Workflow Automation - the notification trigger engine.  `generateNotifications(db)` scans live tables for workflow trigger conditions and returns a typed, serializable Notification[]. Nothing is persisted: the set is recomputed fresh on every load (the MVP stores only read/dismissed state in a cookie - see queries.ts / actions.ts). A notification naturally disappears when its trigger condition clears (the overdue task is completed, the stuck deal advances, the expired KYC is re-run), so the cent
- **Exported functions:** generateNotifications
- **Exported types:** NotificationEngineOptions
- **DB ops patterns:** from, innerJoin, leftJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (4):** @/db, @/lib/rbac, @/db/schema, ./types
- **Domain terms:** KYC, Mandate, Party, bond, credit_analysis, issuer, kyc, mandate, matching, party

## `src/features/workflow/index.ts`

- **Lines:** 40 | **Bytes:** 1270
- **Kind:** Client component
- **Directive:** `use client`
- **Header intent:** Workflow Automation - feature barrel.  Re-exports the domain types/constants, the trigger engine, the server-side reads, and the server actions so server routes import from one path.  IMPORTANT (client-component import discipline - see the leads barrel): `@/features/workflow` re-exports ./queries, which imports the `db` (postgres) client. A "use client" component that imports from THIS barrel would pull the postgres driver into the client bundle and break compilation. Client components (the noti
- **Internal imports (6):** @/features/workflow/actions, @/features/workflow/types, ./types, ./engine, ./queries, ./actions
