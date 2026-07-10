// Super-admin coverage / activity feed: employee interactions + audit moves.

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { appUser, auditLog, interaction, party } from "@/db/schema";
import type { CrmUser } from "@/lib/rbac";
import {
  brandFromDesk,
  isFirmWide,
  isSuperAdmin,
  type BrandScope,
} from "@/lib/org";
import { listAuditLog } from "@/features/compliance/audit";
import { listInteractions } from "@/features/interactions/queries";

export interface StaffOption {
  userId: string;
  email: string;
  desk: string | null;
}

export async function listStaffOptions(viewer?: {
  brandScope: BrandScope;
}): Promise<StaffOption[]> {
  const rows = await db
    .select({
      userId: appUser.userId,
      email: appUser.email,
      desk: appUser.desk,
    })
    .from(appUser)
    .where(and(eq(appUser.isActive, true), isNull(appUser.deletedAt)))
    .orderBy(appUser.email)
    .limit(200);

  if (!viewer || isFirmWide(viewer.brandScope)) return rows;

  return rows.filter((r) => {
    const b = brandFromDesk(r.desk as string | null);
    return b === viewer.brandScope || b === "shared";
  });
}

export interface StaffCoverageRow {
  userId: string;
  email: string;
  desk: string | null;
  interactionCount: number;
  lastInteractionAt: Date | null;
  lastLoginAt: Date | null;
  assignedParties: number;
}

/** Per-staff coverage snapshot for supers. */
export async function getStaffCoverageSummary(
  user: CrmUser,
): Promise<StaffCoverageRow[]> {
  if (!isSuperAdmin(user.roles) && !user.roles.includes("admin")) {
    return [];
  }

  const staff = await listStaffOptions();
  if (staff.length === 0) return [];

  const ix = await db
    .select({
      userId: interaction.userId,
      n: sql<number>`count(*)::int`,
      lastAt: sql<Date | null>`max(${interaction.occurredAt})`,
    })
    .from(interaction)
    .where(isNull(interaction.deletedAt))
    .groupBy(interaction.userId);

  const ixMap = new Map(
    ix
      .filter((r) => r.userId)
      .map((r) => [r.userId as string, { n: r.n, lastAt: r.lastAt }]),
  );

  const books = await db
    .select({
      userId: party.assignedUserId,
      n: sql<number>`count(*)::int`,
    })
    .from(party)
    .where(and(isNull(party.deletedAt), sql`${party.assignedUserId} is not null`))
    .groupBy(party.assignedUserId);

  const bookMap = new Map(
    books
      .filter((r) => r.userId)
      .map((r) => [r.userId as string, r.n]),
  );

  const logins = await db
    .select({
      userId: appUser.userId,
      lastLoginAt: appUser.lastLoginAt,
    })
    .from(appUser)
    .where(isNull(appUser.deletedAt));

  const loginMap = new Map(logins.map((r) => [r.userId, r.lastLoginAt]));

  return staff.map((s) => {
    const i = ixMap.get(s.userId);
    return {
      userId: s.userId,
      email: s.email,
      desk: s.desk,
      interactionCount: i?.n ?? 0,
      lastInteractionAt: i?.lastAt ?? null,
      lastLoginAt: loginMap.get(s.userId) ?? null,
      assignedParties: bookMap.get(s.userId) ?? 0,
    };
  });
}

export interface CoverageFeedParams {
  ownerUserId?: string;
  channel?: string;
  days?: number;
  page?: number;
  pageSize?: number;
}

/**
 * Super-admin feed: interactions (optionally by staff) + recent audit moves.
 */
export async function getCoverageFeed(
  user: CrmUser,
  params: CoverageFeedParams = {},
) {
  const canSee =
    isSuperAdmin(user.roles) ||
    user.roles.includes("admin") ||
    user.permissions.has("audit:read_all");
  if (!canSee) {
    return {
      interactions: { rows: [], total: 0, page: 1, pageSize: 40 },
      audit: { rows: [], total: 0 },
      coverage: [] as StaffCoverageRow[],
    };
  }

  const days = Math.min(Math.max(params.days ?? 30, 1), 365);
  const from = new Date(Date.now() - days * 86_400_000).toISOString();

  const [interactions, audit, coverage] = await Promise.all([
    listInteractions({
      user,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 40,
      filters: {
        channel: params.channel,
        ownerUserId: params.ownerUserId,
      },
    }),
    listAuditLog({
      filter: {
        actorUserId: params.ownerUserId,
        from,
      },
      page: 1,
      pageSize: 40,
    }),
    getStaffCoverageSummary(user),
  ]);

  return {
    interactions,
    audit: { rows: audit.rows, total: audit.total },
    coverage,
  };
}
