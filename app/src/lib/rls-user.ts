// High-level RLS runner bound to a CrmUser.
//
// Rules:
//   1. Never invent a random appUserId (old crypto.randomUUID() fallback was a
//      security bug - writes would attribute to a ghost user).
//   2. Always set wall from the session profile.
//   3. Mandate IDs = deals where the user is lead or an active deal_party staff
//      contact's app user (lead_user_id today; extend when staff table lands).

import { and, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { withRls, withRlsRead } from "@/db/context";
import { deal } from "@/db/schema";
import type { CrmUser } from "@/lib/rbac";

type Tx = Parameters<Parameters<typeof withRls>[3]>[0];

export class RlsUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RlsUserError";
  }
}

/** Require a real app_user id on the session profile. */
export function requireAppUserId(user: CrmUser): string {
  if (!user.appUserId) {
    throw new RlsUserError(
      "Session is missing appUserId — cannot open an RLS transaction.",
    );
  }
  return user.appUserId;
}

/**
 * Load deal_ids the user is staffed on (mandate scope for RLS).
 * Currently: deals where lead_user_id = user, not soft-deleted.
 */
export async function loadMandateIds(appUserId: string): Promise<string[]> {
  const rows = await db
    .select({ dealId: deal.dealId })
    .from(deal)
    .where(
      and(
        eq(deal.leadUserId, appUserId),
        isNull(deal.deletedAt),
      ),
    )
    .limit(500);
  return rows.map((r) => r.dealId);
}

/** Write path: transaction + SET LOCAL GUCs + post-commit GUC cleanup. */
export async function runWithUserRls<T>(
  user: CrmUser,
  work: (tx: Tx, ctx: { appUserId: string; mandateIds: string[] }) => Promise<T>,
): Promise<T> {
  const appUserId = requireAppUserId(user);
  const mandateIds = await loadMandateIds(appUserId);
  return withRls(appUserId, user.wall ?? [], mandateIds, (tx) =>
    work(tx, { appUserId, mandateIds }),
  );
}

/** Read path: same GUCs, no post-commit array rewrite needed for reads. */
export async function runWithUserRlsRead<T>(
  user: CrmUser,
  work: (tx: Tx, ctx: { appUserId: string; mandateIds: string[] }) => Promise<T>,
): Promise<T> {
  const appUserId = requireAppUserId(user);
  const mandateIds = await loadMandateIds(appUserId);
  return withRlsRead(appUserId, user.wall ?? [], mandateIds, (tx) =>
    work(tx, { appUserId, mandateIds }),
  );
}

/**
 * Convenience for legacy call sites that already have mandateIds.
 * Prefer runWithUserRls for new code.
 */
export async function withUserRlsSimple<T>(
  user: CrmUser,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return runWithUserRls(user, (tx) => work(tx));
}
