// Server-side task data access (DATA_MODEL §2.19). Tasks have due dates,
// priority, status, an assignee (app_user), optional deal/party context, and
// a dependency graph via the task_dependency junction (PK (task_id,
// depends_on_task_id)). RLS-aware once policies are migrated; until then
// these are plain queries. All functions are safe to call from Server
// Components.

import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { can, type CrmUser } from "@/lib/rbac";
import {
  appUser,
  deal,
  party,
  task,
  taskDependency,
  taskStatusEnum,
} from "@/db/schema";

type TaskStatusValue = (typeof taskStatusEnum.enumValues)[number];

export interface TaskListItem {
  taskId: string;
  title: string;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  assigneeUserId: string | null;
  assigneeEmail: string | null;
  dealId: string | null;
  dealCode: string | null;
  partyId: string | null;
  partyName: string | null;
  parentTaskId: string | null;
  blockedByCount: number;
  createdAt: Date | null;
}

export interface TaskListResult {
  rows: TaskListItem[];
  total: number;
  page: number;
  pageSize: number;
}

function canReadAllTasks(user?: Pick<CrmUser, "roles" | "permissions"> | null) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "task") ||
    can(user, "manage", "user")
  );
}

function taskVisibilityClause(user?: CrmUser | null) {
  const scopedUserId = user?.appUserId;
  if (canReadAllTasks(user) || !scopedUserId) return undefined;

  return or(
    eq(task.assigneeUserId, scopedUserId),
    eq(task.createdByUserId, scopedUserId),
    eq(deal.leadUserId, scopedUserId),
    eq(deal.creditAnalystUserId, scopedUserId),
    eq(deal.createdByUserId, scopedUserId),
    eq(party.assignedUserId, scopedUserId),
    eq(party.dataOwnerUserId, scopedUserId),
    eq(party.createdByUserId, scopedUserId),
  );
}

function dealOptionVisibilityClause(user?: CrmUser | null) {
  const scopedUserId = user?.appUserId;
  if (canReadAllTasks(user) || !scopedUserId) return undefined;

  return or(
    eq(deal.leadUserId, scopedUserId),
    eq(deal.creditAnalystUserId, scopedUserId),
    eq(deal.createdByUserId, scopedUserId),
    sql`EXISTS (
      SELECT 1
      FROM deal_party dp_scope
      JOIN party p_scope ON p_scope.party_id = dp_scope.party_id
      WHERE dp_scope.deal_id = ${deal.dealId}
        AND dp_scope.deleted_at IS NULL
        AND p_scope.deleted_at IS NULL
        AND (
          p_scope.assigned_user_id = ${scopedUserId}
          OR p_scope.data_owner_user_id = ${scopedUserId}
          OR p_scope.created_by_user_id = ${scopedUserId}
        )
    )`,
  );
}

function partyOptionVisibilityClause(user?: CrmUser | null) {
  const scopedUserId = user?.appUserId;
  if (canReadAllTasks(user) || !scopedUserId) return undefined;

  return or(
    eq(party.assignedUserId, scopedUserId),
    eq(party.dataOwnerUserId, scopedUserId),
    eq(party.createdByUserId, scopedUserId),
  );
}

/**
 * Paginated task list. Filters by status, assignee, and free-text title. The
 * "open" view (no status filter) excludes completed/cancelled/deleted rows
 * via the partial `task_open_idx` index path - Drizzle expresses the same
 * predicate here so the planner can use it. Ordered by due date (NULLS LAST)
 * then title for a stable worklist.
 */
export async function listTasks({
  status,
  assigneeUserId,
  q,
  openOnly,
  user,
  page = 1,
  pageSize = 25,
}: {
  status?: string;
  assigneeUserId?: string;
  q?: string;
  openOnly?: boolean;
  user?: CrmUser | null;
  page?: number;
  pageSize?: number;
} = {}): Promise<TaskListResult> {
  const where = and(
    isNull(task.deletedAt),
    taskVisibilityClause(user),
    status ? eq(task.status, status as TaskStatusValue) : undefined,
    assigneeUserId ? eq(task.assigneeUserId, assigneeUserId) : undefined,
    openOnly
      ? sql`${task.status} NOT IN ('completed','cancelled')`
      : undefined,
    q ? ilike(task.title, `%${q}%`) : undefined,
  );

  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        taskId: task.taskId,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        assigneeUserId: task.assigneeUserId,
        assigneeEmail: appUser.email,
        dealId: task.dealId,
        dealCode: deal.dealCode,
        partyId: task.partyId,
        partyName: party.legalName,
        parentTaskId: task.parentTaskId,
        createdAt: task.createdAt,
      })
      .from(task)
      .leftJoin(appUser, eq(appUser.userId, task.assigneeUserId))
      .leftJoin(deal, eq(deal.dealId, task.dealId))
      .leftJoin(party, eq(party.partyId, task.partyId))
      .where(where)
      .orderBy(asc(task.dueDate), asc(task.title))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(task)
      .leftJoin(deal, eq(deal.dealId, task.dealId))
      .leftJoin(party, eq(party.partyId, task.partyId))
      .where(where),
  ]);

  // Count active blockers per task (dependencies whose blocker task is not
  // completed/cancelled). Lets the list flag "blocked" rows without an N+1.
  const ids = rows.map((r) => r.taskId);
  const blockerRows = ids.length
    ? await db
        .select({
          taskId: taskDependency.taskId,
          n: sql<number>`count(*)::int`,
        })
        .from(taskDependency)
        .innerJoin(
          task,
          eq(task.taskId, taskDependency.dependsOnTaskId),
        )
        .where(
          and(
            inArray(taskDependency.taskId, ids),
            sql`${task.status} NOT IN ('completed','cancelled')`,
          ),
        )
        .groupBy(taskDependency.taskId)
    : [];
  const blockers = new Map(blockerRows.map((r) => [r.taskId, r.n] as const));

  return {
    total: n ?? 0,
    page,
    pageSize,
    rows: rows.map((r) => ({
      ...r,
      // dueDate is a `date` column → drizzle returns it as a string
      // ("yyyy-mm-dd").
      blockedByCount: blockers.get(r.taskId) ?? 0,
    })),
  };
}

export interface TaskDependencyRow {
  dependsOnTaskId: string;
  dependsOnTitle: string;
  dependsOnStatus: string | null;
}

export interface TaskDetail {
  task: typeof task.$inferSelect;
  assigneeEmail: string | null;
  dealCode: string | null;
  dealName: string | null;
  partyName: string | null;
  dependencies: TaskDependencyRow[];
  dependents: { taskId: string; title: string; status: string | null }[];
}

export async function getTaskDetail(
  taskId: string,
  user?: CrmUser | null,
): Promise<TaskDetail | null> {
  const [row] = await db
    .select({
      task: task,
      assigneeEmail: appUser.email,
      dealCode: deal.dealCode,
      dealName: deal.dealName,
      partyName: party.legalName,
    })
    .from(task)
    .leftJoin(appUser, eq(appUser.userId, task.assigneeUserId))
    .leftJoin(deal, eq(deal.dealId, task.dealId))
    .leftJoin(party, eq(party.partyId, task.partyId))
    .where(
      and(
        eq(task.taskId, taskId),
        isNull(task.deletedAt),
        taskVisibilityClause(user),
      ),
    );
  if (!row) return null;

  const [dependencies, dependents] = await Promise.all([
    db
      .select({
        dependsOnTaskId: taskDependency.dependsOnTaskId,
        dependsOnTitle: task.title,
        dependsOnStatus: task.status,
      })
      .from(taskDependency)
      .innerJoin(task, eq(task.taskId, taskDependency.dependsOnTaskId))
      .where(eq(taskDependency.taskId, taskId)),
    db
      .select({
        taskId: taskDependency.taskId,
        title: task.title,
        status: task.status,
      })
      .from(taskDependency)
      .innerJoin(task, eq(task.taskId, taskDependency.taskId))
      .where(eq(taskDependency.dependsOnTaskId, taskId)),
  ]);

  return {
    task: row.task,
    assigneeEmail: row.assigneeEmail,
    dealCode: row.dealCode,
    dealName: row.dealName,
    partyName: row.partyName,
    dependencies,
    dependents,
  };
}

// ---------------------------------------------------------------------------
// Form lookups
// ---------------------------------------------------------------------------

export interface AssigneeOption {
  userId: string;
  email: string;
  desk: string | null;
}

export async function listAssigneeOptions({
  q,
  limit = 50,
}: { q?: string; limit?: number } = {}): Promise<AssigneeOption[]> {
  const where = and(
    eq(appUser.isActive, true),
    isNull(appUser.deletedAt),
    q ? ilike(appUser.email, `%${q}%`) : undefined,
  );
  return db
    .select({ userId: appUser.userId, email: appUser.email, desk: appUser.desk })
    .from(appUser)
    .where(where)
    .orderBy(asc(appUser.email))
    .limit(limit);
}

export interface DealOption {
  dealId: string;
  dealCode: string | null;
  dealName: string | null;
}
export interface PartyOption {
  partyId: string;
  legalName: string;
}
export interface TaskOption {
  taskId: string;
  title: string;
  status: string | null;
}

export async function listDealOptions({
  q,
  limit = 50,
  user,
}: {
  q?: string;
  limit?: number;
  user?: CrmUser | null;
} = {}): Promise<DealOption[]> {
  const where = and(
    isNull(deal.deletedAt),
    dealOptionVisibilityClause(user),
    q ? or(ilike(deal.dealCode, `%${q}%`), ilike(deal.dealName, `%${q}%`)) : undefined,
  );
  return db
    .select({
      dealId: deal.dealId,
      dealCode: deal.dealCode,
      dealName: deal.dealName,
    })
    .from(deal)
    .where(where)
    .orderBy(asc(deal.dealCode))
    .limit(limit);
}

export async function listPartyOptions({
  q,
  limit = 50,
  user,
}: {
  q?: string;
  limit?: number;
  user?: CrmUser | null;
} = {}): Promise<PartyOption[]> {
  const where = and(
    isNull(party.deletedAt),
    partyOptionVisibilityClause(user),
    q ? ilike(party.legalName, `%${q}%`) : undefined,
  );
  return db
    .select({ partyId: party.partyId, legalName: party.legalName })
    .from(party)
    .where(where)
    .orderBy(asc(party.legalName))
    .limit(limit);
}

/**
 * Candidate tasks to depend on. Excludes the given task itself (a task can't
 * depend on itself - see the MIGRATION NOTE CHECK on task_dependency) and
 * deleted tasks. Ordered by title.
 */
export async function listTaskDependencyOptions({
  excludeTaskId,
  q,
  limit = 50,
  user,
}: {
  excludeTaskId?: string;
  q?: string;
  limit?: number;
  user?: CrmUser | null;
} = {}): Promise<TaskOption[]> {
  const where = and(
    isNull(task.deletedAt),
    taskVisibilityClause(user),
    excludeTaskId ? sql`${task.taskId} <> ${excludeTaskId}::uuid` : undefined,
    q ? ilike(task.title, `%${q}%`) : undefined,
  );
  return db
    .select({ taskId: task.taskId, title: task.title, status: task.status })
    .from(task)
    .leftJoin(deal, eq(deal.dealId, task.dealId))
    .leftJoin(party, eq(party.partyId, task.partyId))
    .where(where)
    .orderBy(asc(task.title))
    .limit(limit);
}
