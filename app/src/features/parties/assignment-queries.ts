import { and, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { appUser, party, partyAssignmentRequest } from "@/db/schema";
import { brandFromDesk, isFirmWide, type BrandScope } from "@/lib/org";

export interface AssignmentRequestRow {
  requestId: string;
  partyId: string;
  partyName: string | null;
  fromUserId: string | null;
  fromEmail: string | null;
  toUserId: string;
  toEmail: string | null;
  requestedByUserId: string;
  requestedByEmail: string | null;
  status: string;
  note: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

export async function listPendingAssignmentRequests(): Promise<
  AssignmentRequestRow[]
> {
  const fromU = alias(appUser, "from_u");
  const toU = alias(appUser, "to_u");
  const byU = alias(appUser, "by_u");

  return db
    .select({
      requestId: partyAssignmentRequest.requestId,
      partyId: partyAssignmentRequest.partyId,
      partyName: party.legalName,
      fromUserId: partyAssignmentRequest.fromUserId,
      fromEmail: fromU.email,
      toUserId: partyAssignmentRequest.toUserId,
      toEmail: toU.email,
      requestedByUserId: partyAssignmentRequest.requestedByUserId,
      requestedByEmail: byU.email,
      status: partyAssignmentRequest.status,
      note: partyAssignmentRequest.note,
      createdAt: partyAssignmentRequest.createdAt,
      reviewedAt: partyAssignmentRequest.reviewedAt,
    })
    .from(partyAssignmentRequest)
    .leftJoin(party, eq(party.partyId, partyAssignmentRequest.partyId))
    .leftJoin(fromU, eq(fromU.userId, partyAssignmentRequest.fromUserId))
    .leftJoin(toU, eq(toU.userId, partyAssignmentRequest.toUserId))
    .leftJoin(byU, eq(byU.userId, partyAssignmentRequest.requestedByUserId))
    .where(eq(partyAssignmentRequest.status, "pending"))
    .orderBy(desc(partyAssignmentRequest.createdAt))
    .limit(100);
}

export async function listRecentAssignmentRequests(
  limit = 30,
): Promise<AssignmentRequestRow[]> {
  const fromU = alias(appUser, "from_u2");
  const toU = alias(appUser, "to_u2");
  const byU = alias(appUser, "by_u2");

  return db
    .select({
      requestId: partyAssignmentRequest.requestId,
      partyId: partyAssignmentRequest.partyId,
      partyName: party.legalName,
      fromUserId: partyAssignmentRequest.fromUserId,
      fromEmail: fromU.email,
      toUserId: partyAssignmentRequest.toUserId,
      toEmail: toU.email,
      requestedByUserId: partyAssignmentRequest.requestedByUserId,
      requestedByEmail: byU.email,
      status: partyAssignmentRequest.status,
      note: partyAssignmentRequest.note,
      createdAt: partyAssignmentRequest.createdAt,
      reviewedAt: partyAssignmentRequest.reviewedAt,
    })
    .from(partyAssignmentRequest)
    .leftJoin(party, eq(party.partyId, partyAssignmentRequest.partyId))
    .leftJoin(fromU, eq(fromU.userId, partyAssignmentRequest.fromUserId))
    .leftJoin(toU, eq(toU.userId, partyAssignmentRequest.toUserId))
    .leftJoin(byU, eq(byU.userId, partyAssignmentRequest.requestedByUserId))
    .orderBy(desc(partyAssignmentRequest.createdAt))
    .limit(limit);
}

/** Staff list for reassignment dropdowns (active users).
 *  Non–firm-wide viewers only see same-brand + shared/management staff —
 *  Capital and Bonds employees never mix in the picker. */
export async function listAssignableUsers(viewer?: {
  brandScope: BrandScope;
  roles?: readonly string[];
}) {
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

  if (!viewer || isFirmWide(viewer.brandScope)) {
    return rows.map((r) => ({
      ...r,
      brand: brandFromDesk(r.desk as string | null),
    }));
  }

  return rows
    .filter((r) => {
      const b = brandFromDesk(r.desk as string | null);
      return b === viewer.brandScope || b === "shared";
    })
    .map((r) => ({
      ...r,
      brand: brandFromDesk(r.desk as string | null),
    }));
}
