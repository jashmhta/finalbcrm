// Unified ownership / brand visibility helpers.
//
// Party ownership model (single source of truth after platform completion):
//   party.assigned_user_id  — coverage RM / primary desk owner
//   party.data_owner_user_id — data steward (often same as assigned)
//   party.created_by_user_id — creator
//
// There is NO assigned_rm_user_id / assigned_analyst_user_id column on party.
// Call sites that referenced those names were wrong and must use these helpers.
//
// Brand scope:
//   brandFromDesk(desk) → binarycapital | binarybonds | shared
//   shared / firm-wide supers see all brands; book supers see own + shared.

import { and, eq, inArray, isNull, or, SQL, sql } from "drizzle-orm";

import { party } from "@/db/schema";
import type { CrmUser } from "@/lib/rbac";
import {
  canReadAllInScope,
  isFirmWideUser,
} from "@/lib/rbac";
import { partyBrandSqlValues, type BrandScope } from "@/lib/org";

/** Soft-delete + optional brand filter for party lists. */
export function partyBaseWhere(user: CrmUser | null | undefined): SQL | undefined {
  const parts: SQL[] = [isNull(party.deletedAt)];
  if (user && !isFirmWideUser(user) && user.brandScope !== "shared") {
    const brands = partyBrandSqlValues(user.brandScope);
    parts.push(inArray(party.brandOrigin, brands as [BrandScope, ...BrandScope[]]));
  }
  return and(...parts);
}

/**
 * Visibility for a non-global user: assigned, data owner, or creator.
 * Super/admin/read_all skip this (caller checks canReadAllInScope first).
 */
export function partyOwnershipWhere(userId: string): SQL {
  return or(
    eq(party.assignedUserId, userId),
    eq(party.dataOwnerUserId, userId),
    eq(party.createdByUserId, userId),
  ) as SQL;
}

/**
 * Full party visibility for a user.
 * - No user → only non-deleted (should not be used for authenticated pages).
 * - read_all / admin → brand-scoped base.
 * - else → brand-scoped base AND ownership.
 */
export function partyVisibleWhere(user: CrmUser | null | undefined): SQL | undefined {
  const base = partyBaseWhere(user);
  if (!user?.appUserId) return base;
  if (canReadAllInScope(user)) return base;
  return and(base, partyOwnershipWhere(user.appUserId));
}

/**
 * Raw SQL fragment for pages that still use `sql` templates (deal detail).
 * Prefer Drizzle builders above for new code.
 */
export function partyOwnershipSqlFragment(userId: string) {
  return sql`(
    p.assigned_user_id = ${userId}
    OR p.data_owner_user_id = ${userId}
    OR p.created_by_user_id = ${userId}
  )`;
}

/** Brand values a user may see on party.brand_origin / deal.brand. */
export function visibleBrandValues(user: CrmUser): string[] {
  if (isFirmWideUser(user) || user.brandScope === "shared") {
    return ["binarycapital", "binarybonds", "shared"];
  }
  return partyBrandSqlValues(user.brandScope);
}
