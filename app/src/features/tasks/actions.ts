"use server";

// Task mutations (DATA_MODEL §2.19). Create inserts the task plus its
// task_dependency junction rows in a single RLS transaction. A self-dependency
// is rejected here (the MIGRATION NOTE CHECK on task_dependency is the DB
// backstop). updateTaskStatus advances status and stamps completed_at when the
// task moves to `completed`.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { eq, sql } from "drizzle-orm";

import { can, requireUser } from "@/lib/rbac";
import { withRls } from "@/db/context";
import { task, taskDependency } from "@/db/schema";

const STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
  "blocked",
  "deferred",
] as const;

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(20_000).optional(),
  dealId: z.uuid().optional(),
  partyId: z.uuid().optional(),
  assigneeUserId: z.uuid().optional(),
  dueDate: z.iso.date().optional(),
  priority: z.enum(PRIORITIES).optional(),
  parentTaskId: z.uuid().optional(),
  dependsOnTaskIds: z.array(z.uuid()).max(50).default([]),
});

export type CreateTaskState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  const depsRaw = formData.get("dependsOnTaskIds");
  let dependsOnTaskIds: unknown = [];
  if (typeof depsRaw === "string" && depsRaw.trim()) {
    try {
      dependsOnTaskIds = JSON.parse(depsRaw);
    } catch {
      dependsOnTaskIds = [];
    }
  }
  return {
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    dealId: formData.get("dealId") || undefined,
    partyId: formData.get("partyId") || undefined,
    assigneeUserId: formData.get("assigneeUserId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    priority: formData.get("priority") || undefined,
    parentTaskId: formData.get("parentTaskId") || undefined,
    dependsOnTaskIds,
  };
}

/**
 * Create a task + its dependency edges. Self-dependencies and duplicate edges
 * are filtered before insert; the DB CHECK (task_dep_no_self) and PK
 * (task_id, depends_on_task_id) are backstops.
 */
export async function createTask(
  _prev: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const user = await requireUser();
  if (!can(user, "create", "task")) {
    return { error: "You do not have permission to create tasks." };
  }

  const parsed = createTaskSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const taskId = await withRls(
    user.appUserId ?? crypto.randomUUID(),
    user.wall,
    [],
    async (tx) => {
      const [created] = await tx
        .insert(task)
        .values({
          title: input.title,
          description: input.description ?? null,
          dealId: input.dealId ?? null,
          partyId: input.partyId ?? null,
          assigneeUserId: input.assigneeUserId ?? null,
          dueDate: input.dueDate ?? null,
          priority: input.priority ?? "medium",
          status: "pending",
          parentTaskId: input.parentTaskId ?? null,
          createdByUserId: user.appUserId,
        })
        .returning({ taskId: task.taskId });

      if (!created) throw new Error("Task insert returned no row");

      const deps = Array.from(
        new Set(input.dependsOnTaskIds.filter((id) => id !== created.taskId)),
      );
      if (deps.length > 0) {
        await tx.insert(taskDependency).values(
          deps.map((dependsOnTaskId) => ({
            taskId: created.taskId,
            dependsOnTaskId,
          })),
        );
      }
      return created.taskId;
    },
  );

  revalidatePath("/tasks");
  revalidatePath("/console/tasks");
  const redirectTo = formData.get("redirectTo");
  if (typeof redirectTo === "string" && redirectTo.startsWith("/console")) {
    redirect(redirectTo);
  }
  redirect(`/tasks/${taskId}`);
}

const updateTaskStatusSchema = z.object({
  taskId: z.uuid(),
  status: z.enum(STATUSES),
});

export type UpdateTaskStatusState = { error?: string } | undefined;

/**
 * Advance a task's status. On `completed` we stamp completed_at; on any other
 * transition we clear it (a task re-opened after completion loses its
 * completed_at). Uses a conditional SET so a single UPDATE does the job.
 */
export async function updateTaskStatus(
  _prev: UpdateTaskStatusState,
  formData: FormData,
): Promise<UpdateTaskStatusState> {
  const user = await requireUser();
  if (!can(user, "update", "task")) {
    return { error: "You do not have permission to update tasks." };
  }

  const parsed = updateTaskStatusSchema.safeParse({
    taskId: formData.get("taskId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { taskId, status } = parsed.data;

  await withRls(
    user.appUserId ?? crypto.randomUUID(),
    user.wall,
    [],
    async (tx) => {
      await tx
        .update(task)
        .set({
          status,
          completedAt:
            status === "completed"
              ? sql`now()`
              : null,
          updatedAt: sql`now()`,
        })
        .where(eq(task.taskId, taskId));
    },
  );

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/console/tasks");
  revalidatePath(`/console/tasks/${taskId}`);
  return;
}
