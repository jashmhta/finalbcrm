// Persisted notification dismissals (multi-device read state).
//
// The workflow engine still COMPUTES live notifications from domain tables;
// this table stores which entity keys a user has dismissed so the bell is
// consistent across browsers/devices (cookie remains a cache fallback).

import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { appUser } from "./rbac";

/**
 * notification_dismissal
 * PK (user_id, entity_key) where entity_key is the stable id used by the
 * engine (`${type}:${entityId}` or legacy entityId — both accepted).
 */
export const notificationDismissal = pgTable(
  "notification_dismissal",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.userId, { onDelete: "cascade" }),
    entityKey: text("entity_key").notNull(),
    dismissedAt: timestamp("dismissed_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.entityKey] }),
    userIdx: index("notification_dismissal_user_idx").on(table.userId),
    dismissedIdx: index("notification_dismissal_at_idx").on(table.dismissedAt),
  }),
);
