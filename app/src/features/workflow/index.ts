// Workflow Automation - feature barrel.
//
// Re-exports the domain types/constants, the trigger engine, the server-side
// reads, and the server actions so server routes import from one path.
//
// IMPORTANT (client-component import discipline - see the leads barrel):
// `@/features/workflow` re-exports ./queries, which imports the `db` (postgres)
// client. A "use client" component that imports from THIS barrel would pull
// the postgres driver into the client bundle and break compilation. Client
// components (the notification bell, the notifications center view) MUST deep-
// import instead:
//   - server actions → from "@/features/workflow/actions"
//   - types/constants → from "@/features/workflow/types"
// Server components (the notifications page) may import from the barrel.

export * from "./types";
export {
  generateNotifications,
} from "./engine";
export {
  listNotifications,
  computeStats,
  getUnreadCount,
  getNotificationsAndStats,
  readReadIds,
  READ_COOKIE,
  READ_COOKIE_CAP,
  type NotificationView,
  type Severity,
} from "./queries";
export {
  markAsRead,
  markAllAsRead,
  getBellData,
  loadMoreNotifications,
  type MarkReadResult,
  type MarkAllReadResult,
  type BellData,
  type LoadMoreResult,
} from "./actions";
