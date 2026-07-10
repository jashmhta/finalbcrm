"use server";

// Workflow Automation - server actions: read-state writes + the bell's
// client-callable read.
//
// Read state lives in a cookie (see queries.ts). `cookies().set` is only legal
// inside a Server Action / Route Handler, so the WRITE helpers live here (not
// in queries.ts). The actions revalidate /notifications so the center
// re-renders with the updated read set on the next pass.
//
// `getBellData` is a read-only server action the notification bell (a client
// component in the nav) calls on mount + on dropdown open. The nav/seed agent
// wires <NotificationBell/> into site-nav; the bell imports this action
// directly (NOT the barrel - the barrel re-exports queries → postgres → would
// break the "use client" bundle; see the leads pattern in
// app/leads/[id]/lead-workflow-actions.tsx).
//
// A "use server" module may export ONLY async functions - no constant
// re-exports - so the cookie WRITE helper is an internal function, not
// exported. The read helper (render-safe) is imported from ./queries.

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/rbac";
import { generateNotifications } from "./engine";
import {
  READ_COOKIE,
  READ_COOKIE_CAP,
  computeStats,
  readReadIds,
  readDismissedKeys,
  type NotificationView,
} from "./queries";
import type { NotificationStats } from "./types";
import { relativeTime } from "./types";

// ---------------------------------------------------------------------------
// Cookie write helper (internal - action-only, not exported)
// ---------------------------------------------------------------------------

/** Persist the dismissed entity-id set, capped to READ_COOKIE_CAP entries
 *  (most-recently-added kept) to stay under the ~4 KB browser cookie limit.
 *  Action-only: `cookies().set` is illegal during render. */
async function writeReadIds(ids: Set<string>): Promise<void> {
  const arr = Array.from(ids);
  // Keep the tail (most recently appended) when over the cap.
  const pruned = arr.length > READ_COOKIE_CAP ? arr.slice(arr.length - READ_COOKIE_CAP) : arr;
  const store = await cookies();
  store.set(READ_COOKIE, JSON.stringify(pruned), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // 1 year - read state is long-lived. The underlying notifications clear
    // themselves when their trigger condition resolves, so stale entries are
    // inert (they just match no generated notification).
    maxAge: 60 * 60 * 24 * 365,
  });
}

// ---------------------------------------------------------------------------
// markAsRead - dismiss a single notification by entity id
// ---------------------------------------------------------------------------

export type MarkReadResult = { ok: true } | { ok: false; error: string };

async function persistDismissal(userId: string | null | undefined, keys: string[]) {
  if (!userId || keys.length === 0) return;
  try {
    const { db } = await import("@/db");
    const { notificationDismissal } = await import("@/db/schema");
    await db
      .insert(notificationDismissal)
      .values(
        keys.map((entityKey) => ({
          userId,
          entityKey,
        })),
      )
      .onConflictDoNothing();
  } catch {
    // Migration not applied — cookie still holds read state.
  }
}

export async function markAsRead(entityId: string): Promise<MarkReadResult> {
  if (!entityId || typeof entityId !== "string") {
    return { ok: false, error: "Invalid notification id." };
  }
  const user = await getCurrentUser();
  const ids = await readReadIds();
  if (!ids.has(entityId)) {
    ids.add(entityId);
    await writeReadIds(ids);
  }
  await persistDismissal(user?.appUserId, [entityId]);
  revalidatePath("/notifications");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// markAllAsRead - dismiss every current notification (or a provided set)
// ---------------------------------------------------------------------------

export type MarkAllReadResult = { ok: true; dismissed: number } | { ok: false; error: string };

/**
 * Dismiss every currently-generated notification. If `entityIds` is supplied
 * (the page passes the visible filtered set), those are marked read; otherwise
 * the full current set is computed from the engine and dismissed. Either way
 * the cookie is capped at READ_COOKIE_CAP.
 */
export async function markAllAsRead(
  entityIds?: string[],
): Promise<MarkAllReadResult> {
  let toMark: string[];
  if (Array.isArray(entityIds) && entityIds.length > 0) {
    toMark = entityIds;
  } else {
    // Compute the current full set so "mark all" clears the bell even when the
    // caller doesn't pass the visible ids (e.g. the bell's compact dropdown).
    const user = await getCurrentUser();
    const items = await generateNotifications(undefined, { user });
    toMark = items.map((n) => n.entityId);
  }

  const userForPersist =
    Array.isArray(entityIds) && entityIds.length > 0
      ? await getCurrentUser()
      : await getCurrentUser();
  const ids = await readReadIds();
  for (const id of toMark) ids.add(id);
  await writeReadIds(ids);
  await persistDismissal(userForPersist?.appUserId, toMark);

  revalidatePath("/notifications");
  return { ok: true, dismissed: toMark.length };
}

// ---------------------------------------------------------------------------
// getBellData - the bell's client-callable read
// ---------------------------------------------------------------------------

/** The compact payload the nav bell renders: the most recent notifications
 *  (top N by the engine's critical-first ordering), the unread count, and the
 *  full severity stats (for the badge tone). */
export interface BellData {
  items: NotificationView[];
  unreadCount: number;
  stats: NotificationStats;
}

/**
 * Read-only server action the bell calls on mount + on dropdown open. Runs the
 * engine, stamps read flags from the cookie, and returns the top `limit`
 * notifications (default 6) + the unread count + the severity stats.
 *
 * Calling a server action for a read is a POST, but the bell is a single
 * small component in the nav - the round-trip is acceptable for the MVP and
 * keeps the bell self-contained (the nav/seed agent can drop it in without
 * wiring server-component data props through the client SiteNav).
 */
export async function getBellData(limit = 6): Promise<BellData> {
  const user = await getCurrentUser();
  const [items, readIds] = await Promise.all([
    generateNotifications(undefined, { user }),
    readDismissedKeys(user?.appUserId),
  ]);
  const views: NotificationView[] = items.map((n) => ({
    ...n,
    read: readIds.has(n.entityId),
    relative: relativeTime(n.occurredAt),
  }));
  const stats = computeStats(views);
  const unreadCount = views.reduce((n, v) => n + (v.read ? 0 : 1), 0);
  return {
    items: views.slice(0, Math.max(1, limit)),
    unreadCount,
    stats,
  };
}

// ---------------------------------------------------------------------------
// loadMoreNotifications - the center's "Load more" client-callable read
// ---------------------------------------------------------------------------

export type LoadMoreResult =
  | { ok: true; items: NotificationView[] }
  | { ok: false; error: string };

/**
 * Read-only server action the notifications center calls when the user clicks
 * "Load more". Returns the next window of the engine's critical-first sorted
 * set (`offset` .. `offset + limit`), stamped with read flags + relative time.
 * No `revalidatePath` - the center appends the window to its in-memory list
 * without resetting the page, so a user mid-scroll through 50 → 100 → 150
 * doesn't snap back to the top on each click. The engine re-runs its bounded
 * scans each call (cheap - each trigger's WHERE narrows to its window), so the
 * window is always fresh relative to the live data.
 */
export async function loadMoreNotifications(
  offset: number,
  limit = 50,
): Promise<LoadMoreResult> {
  if (!Number.isFinite(offset) || offset < 0) {
    return { ok: false, error: "Invalid offset." };
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    return { ok: false, error: "Invalid limit." };
  }
  const user = await getCurrentUser();
  const [items, readIds] = await Promise.all([
    generateNotifications(undefined, {
      offset,
      limit,
      user,
    }),
    readDismissedKeys(user?.appUserId),
  ]);
  const views: NotificationView[] = items.map((n) => ({
    ...n,
    read: readIds.has(n.entityId),
    relative: relativeTime(n.occurredAt),
  }));
  return { ok: true, items: views };
}
