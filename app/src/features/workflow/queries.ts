// Workflow Automation - server-side reads + read-state cookie helpers.
//
// The notification set is COMPUTED (engine.ts) - nothing is persisted. Read
// state (which notifications the user has dismissed) lives in a cookie so the
// MVP needs no schema change. The cookie stores the set of dismissed ENTITY
// IDS (uuids), not the full `${type}:${entityId}` notification id: each
// trigger type references a distinct entity row (kyc_record / deal /
// credit_analysis / task / consent_record), so the entityId alone is a stable,
// collision-free read key - and it halves the cookie footprint (~36 chars vs
// ~63), keeping the cookie well under the 4 KB browser limit.
//
// `listNotifications()` runs the engine once, stamps each item with its read
// flag from the cookie, and returns the view shape the page renders.
// `computeStats()` is a pure rollup over that list (unread / critical /
// warning / info) for the StatCards. `getUnreadCount()` is the standalone
// count (the bell uses the client-callable getBellData in actions.ts).
//
// Cookie writes (`markAsRead` / `markAllAsRead`) live in actions.ts -
// `cookies().set` is only legal inside a Server Action / Route Handler, not
// during render. The helpers here are render-safe READS only.

import { cookies } from "next/headers";

import type { CrmUser } from "@/lib/rbac";
import { generateNotifications } from "./engine";
import type {
  Notification,
  NotificationStats,
  NotificationView,
  Severity,
} from "./types";
import { relativeTime } from "./types";

// ---------------------------------------------------------------------------
// Read-state cookie
// ---------------------------------------------------------------------------

/** Cookie name for the dismissed-notification entity-id set. */
export const READ_COOKIE = "bc_notif_read";

/**
 * Hard cap on stored dismissed ids. The cookie is bounded by the ~4 KB browser
 * limit; at ~36 chars per uuid plus JSON overhead, 50 entries sit comfortably
 * under the ceiling. The active notification set for a single desk user is
 * normally far smaller than this - the cap is a safety valve. When exceeded,
 * the most recently dismissed ids are kept (the set is pruned from the front).
 */
export const READ_COOKIE_CAP = 50;

/**
 * Read the dismissed entity-id set from the cookie. Render-safe (get only).
 * Returns an empty Set on a missing/malformed cookie. Defensive parse so a
 * corrupt value never breaks the notification center.
 */
/**
 * Cookie-only read of dismissed ids (render-safe). Prefer
 * `readDismissedKeys(userId)` which unions cookie + DB persistence.
 */
export async function readReadIds(): Promise<Set<string>> {
  const store = await cookies();
  const raw = store.get(READ_COOKIE)?.value;
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    const ids = parsed.filter((x): x is string => typeof x === "string");
    return new Set(ids);
  } catch {
    return new Set();
  }
}

/**
 * Union of cookie dismissals + notification_dismissal rows for multi-device.
 * Falls back to cookie-only if the table is missing (migration not applied).
 */
export async function readDismissedKeys(
  userId: string | null | undefined,
): Promise<Set<string>> {
  const cookieIds = await readReadIds();
  if (!userId) return cookieIds;
  try {
    const { db } = await import("@/db");
    const { notificationDismissal } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ entityKey: notificationDismissal.entityKey })
      .from(notificationDismissal)
      .where(eq(notificationDismissal.userId, userId))
      .limit(500);
    for (const r of rows) cookieIds.add(r.entityKey);
  } catch {
    // Table may not exist yet — cookie path remains valid.
  }
  return cookieIds;
}

// ---------------------------------------------------------------------------
// View shape + list / stats
// ---------------------------------------------------------------------------

// `NotificationView` is defined in ./types (client-safe) so client components
// can import it without pulling this db-importing module into their bundle.
export type { NotificationView };

/**
 * Run the engine, then stamp each notification with its read flag from the
 * cookie. The single source of truth for the notification center - the page
 * calls this once and derives stats via `computeStats`.
 *
 * PAGINATION: `opts.limit` / `opts.offset` slice the SORTED set (see
 * engine.ts). Default (no opts) returns the full set, preserving the existing
 * call sites. The notifications page passes `{ limit: 50 }` so it renders a
 * bounded window; `getNotificationsAndStats` keeps stats over the FULL set.
 */
export async function listNotifications(
  opts: { limit?: number; offset?: number; user?: CrmUser | null } = {},
): Promise<NotificationView[]> {
  const [items, readIds] = await Promise.all([
    generateNotifications(undefined, opts),
    readDismissedKeys(opts.user?.appUserId),
  ]);
  return items.map((n) => ({
    ...n,
    read: readIds.has(n.entityId) || readIds.has(n.id),
    // Precompute the relative-time string server-side so the client never
    // calls Date.now() (avoids an SSR/hydration mismatch at minute bounds).
    relative: relativeTime(n.occurredAt),
  }));
}

/**
 * Pure rollup over a notification list - the StatCard inputs. `unread` counts
 * non-read items; severity counts are over ALL items (read or not) so the
 * center always reflects the true outstanding workload even after dismissal.
 */
export function computeStats(items: NotificationView[]): NotificationStats {
  let unread = 0;
  let critical = 0;
  let warning = 0;
  let info = 0;
  for (const n of items) {
    if (!n.read) unread++;
    if (n.severity === "critical") critical++;
    else if (n.severity === "warning") warning++;
    else info++;
  }
  return { total: items.length, unread, critical, warning, info };
}

/** Standalone unread count (the bell uses the client-callable getBellData in
 *  actions.ts; this is the server-side equivalent for any server component
 *  that needs just the count). */
export async function getUnreadCount(user?: CrmUser | null): Promise<number> {
  const [items, readIds] = await Promise.all([
    generateNotifications(undefined, { user }),
    readDismissedKeys(user?.appUserId),
  ]);
  return items.reduce(
    (n, item) =>
      n + (readIds.has(item.entityId) || readIds.has(item.id) ? 0 : 1),
    0,
  );
}

/** Convenience: the full set (items + stats) in one engine pass, for server
 *  components that want both.
 *
 *  PAGINATION: `opts.limit` / `opts.offset` bound the RENDERED `items` (sliced
 *  from the sorted set), while `stats` is computed over the FULL set so the
 *  StatCards always reflect the true outstanding workload (unread / critical /
 *  warning / info) - not just the visible window. This is the call the
 *  notifications page uses: it gets 50 cards to render + accurate full-book
 *  stats in a single engine pass. `total` (== stats.total) is the full
 *  notification count for the "Showing 50 of N" indicator.
 */
export async function getNotificationsAndStats(
  opts: { limit?: number; offset?: number; user?: CrmUser | null } = {},
): Promise<{
  items: NotificationView[];
  stats: NotificationStats;
}> {
  // Generate the full set once (no slice) for accurate stats + read-flag
  // stamping, then slice the rendered window from the stamped views. This is
  // one engine pass - the scans run once; only the JS sort + slice differ.
  const [all, readIds] = await Promise.all([
    generateNotifications(undefined, { user: opts.user }),
    readDismissedKeys(opts.user?.appUserId),
  ]);
  const views: NotificationView[] = all.map((n) => ({
    ...n,
    read: readIds.has(n.entityId) || readIds.has(n.id),
    relative: relativeTime(n.occurredAt),
  }));
  const stats = computeStats(views);

  const offset = Math.max(0, opts.offset ?? 0);
  const items =
    opts.limit != null && Number.isFinite(opts.limit)
      ? views.slice(offset, offset + Math.max(0, Math.floor(opts.limit)))
      : offset > 0
        ? views.slice(offset)
        : views;

  return { items, stats };
}

// Re-export the severity helpers for server callers that import from here.
export type { Severity };
