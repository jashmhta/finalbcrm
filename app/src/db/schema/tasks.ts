// task - standard task model (§2.19). Tasks auto-generate from deal-stage
// transitions (e.g., entering `rating_marketing` creates "Coordinate agency
// management meeting" tasks per agency). depends_on is modeled as a separate
// junction table (task_dependency) to preserve FK integrity - an array could
// not.

import {
  date,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import { taskPriorityEnum, taskStatusEnum } from "./enums";

import { appUser } from "./rbac";
import { party } from "./party";
import { deal } from "./deals";

export const task = pgTable(
  "task",
  {
    taskId: uuid("task_id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id").references(() => deal.dealId, {
      onDelete: "cascade",
    }),
    partyId: uuid("party_id").references(() => party.partyId, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    assigneeUserId: uuid("assignee_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    dueDate: date("due_date"),
    priority: taskPriorityEnum("priority").default("medium"),
    status: taskStatusEnum("status").default("pending"),
    // Self-FK: parent task (sub-tasks).
    parentTaskId: uuid("parent_task_id"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).defaultNow(),
    createdByUserId: uuid("created_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    assigneeIdx: index("task_assignee_idx").on(table.assigneeUserId),
    dealIdx: index("task_deal_idx").on(table.dealId),
    partyIdx: index("task_party_idx").on(table.partyId),
    dueDateIdx: index("task_due_date_idx").on(table.dueDate),
    statusIdx: index("task_status_idx").on(table.status),
    parentIdx: index("task_parent_idx").on(table.parentTaskId),
    openIdx: index("task_open_idx")
      .on(table.assigneeUserId, table.dueDate)
      .where(
        sql`status NOT IN ('completed','cancelled') AND deleted_at IS NULL`,
      ),
  }),
);

// Task dependencies - junction replacing the former depends_on_task_ids[] array
// (§2.19). PK (task_id, depends_on_task_id).
export const taskDependency = pgTable(
  "task_dependency",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => task.taskId, { onDelete: "cascade" }),
    dependsOnTaskId: uuid("depends_on_task_id")
      .notNull()
      .references(() => task.taskId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.taskId, table.dependsOnTaskId] }),
    // MIGRATION NOTE: prevent a task from depending on itself:
    //   ALTER TABLE task_dependency ADD CONSTRAINT task_dep_no_self
    //     CHECK (task_id <> depends_on_task_id);
  }),
);

export const taskRelations = relations(task, ({ one, many }) => ({
  deal: one(deal, {
    fields: [task.dealId],
    references: [deal.dealId],
  }),
  party: one(party, {
    fields: [task.partyId],
    references: [party.partyId],
  }),
  assignee: one(appUser, {
    fields: [task.assigneeUserId],
    references: [appUser.userId],
    relationName: "taskAssignee",
  }),
  createdBy: one(appUser, {
    fields: [task.createdByUserId],
    references: [appUser.userId],
    relationName: "taskCreatedBy",
  }),
  parent: one(task, {
    fields: [task.parentTaskId],
    references: [task.taskId],
    relationName: "taskParent",
  }),
  dependencies: many(taskDependency, { relationName: "taskDependencies" }),
  dependents: many(taskDependency, { relationName: "taskDependents" }),
}));

export const taskDependencyRelations = relations(taskDependency, ({ one }) => ({
  task: one(task, {
    fields: [taskDependency.taskId],
    references: [task.taskId],
    relationName: "taskDependencies",
  }),
  dependsOn: one(task, {
    fields: [taskDependency.dependsOnTaskId],
    references: [task.taskId],
    relationName: "taskDependents",
  }),
}));

export type Task = typeof task.$inferSelect;
export type TaskInsert = typeof task.$inferInsert;
export type TaskDependency = typeof taskDependency.$inferSelect;
export type TaskDependencyInsert = typeof taskDependency.$inferInsert;
