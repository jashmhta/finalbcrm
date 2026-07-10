// Server-side interaction data access (DATA_MODEL §2.18). An interaction
// anchors to ≥1 of party/deal/contact (CHECK num_nonnulls >= 1), links
// attendees via the interaction_attendee junction, and is walled by
// barrier_id when it contains MNPI. RLS-aware once policies are migrated;
// until then these are plain queries (the GUCs set by withRls are no-ops on
// tables without RLS enabled). All functions are safe to call from Server
// Components.

import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { can, type CrmUser } from "@/lib/rbac";
import {
  appUser,
  contact,
  deal,
  interaction,
  interactionAttendee,
  party,
} from "@/db/schema";

export interface InteractionListItem {
  interactionId: string;
  subject: string | null;
  channel: string | null;
  direction: string | null;
  occurredAt: Date | null;
  durationMin: number | null;
  containsMnpi: boolean;
  partyId: string | null;
  partyName: string | null;
  dealId: string | null;
  dealCode: string | null;
  contactId: string | null;
  contactName: string | null;
  attendeeCount: number;
  nextAction: string | null;
  /** Staff who logged the interaction (coverage RM). */
  ownerUserId: string | null;
  ownerEmail: string | null;
}

export interface InteractionListFilters {
  q?: string;
  channel?: string;
  direction?: string;
  /** Filter to interactions logged by this staff app_user id. */
  ownerUserId?: string;
}

export interface InteractionListResult {
  rows: InteractionListItem[];
  total: number;
  page: number;
  pageSize: number;
}

function canReadAllInteractions(
  user?: Pick<CrmUser, "roles" | "permissions"> | null,
) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "interaction") ||
    can(user, "manage", "user")
  );
}

function interactionVisibilityClause(user?: CrmUser | null) {
  const scopedUserId = user?.appUserId;
  if (canReadAllInteractions(user) || !scopedUserId) return undefined;

  return or(
    eq(interaction.userId, scopedUserId),
    eq(party.assignedUserId, scopedUserId),
    eq(party.dataOwnerUserId, scopedUserId),
    eq(party.createdByUserId, scopedUserId),
    eq(deal.leadUserId, scopedUserId),
    eq(deal.creditAnalystUserId, scopedUserId),
    eq(deal.createdByUserId, scopedUserId),
    eq(contact.createdByUserId, scopedUserId),
    sql`EXISTS (
      SELECT 1
      FROM party_contact pc_scope
      JOIN party p_scope ON p_scope.party_id = pc_scope.party_id
      WHERE pc_scope.contact_id = ${interaction.contactId}
        AND pc_scope.deleted_at IS NULL
        AND p_scope.deleted_at IS NULL
        AND (
          p_scope.assigned_user_id = ${scopedUserId}
          OR p_scope.data_owner_user_id = ${scopedUserId}
          OR p_scope.created_by_user_id = ${scopedUserId}
        )
    )`,
  );
}

/**
 * Paginated interaction timeline, newest first. Filters by anchor entity when
 * provided. Two queries (interactions + attendee counts) - no N+1.
 */
export async function listInteractions({
  partyId,
  dealId,
  contactId,
  mnpiOnly,
  filters = {},
  user,
  page = 1,
  pageSize = 25,
}: {
  partyId?: string;
  dealId?: string;
  contactId?: string;
  mnpiOnly?: boolean;
  filters?: InteractionListFilters;
  user?: CrmUser | null;
  page?: number;
  pageSize?: number;
} = {}): Promise<InteractionListResult> {
  const q = filters.q?.trim();
  const where = and(
    isNull(interaction.deletedAt),
    interactionVisibilityClause(user),
    partyId ? eq(interaction.partyId, partyId) : undefined,
    dealId ? eq(interaction.dealId, dealId) : undefined,
    contactId ? eq(interaction.contactId, contactId) : undefined,
    mnpiOnly ? eq(interaction.containsMnpi, true) : undefined,
    filters.channel ? eq(interaction.channel, filters.channel as never) : undefined,
    filters.direction
      ? eq(interaction.direction, filters.direction as never)
      : undefined,
    filters.ownerUserId
      ? eq(interaction.userId, filters.ownerUserId)
      : undefined,
    q
      ? or(
          ilike(interaction.subject, `%${q}%`),
          ilike(interaction.body, `%${q}%`),
          ilike(interaction.nextAction, `%${q}%`),
          ilike(party.legalName, `%${q}%`),
          ilike(deal.dealCode, `%${q}%`),
          ilike(deal.dealName, `%${q}%`),
          ilike(contact.fullName, `%${q}%`),
        )
      : undefined,
  );

  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        interactionId: interaction.interactionId,
        subject: interaction.subject,
        channel: interaction.channel,
        direction: interaction.direction,
        occurredAt: interaction.occurredAt,
        durationMin: interaction.durationMin,
        containsMnpi: interaction.containsMnpi,
        partyId: interaction.partyId,
        partyName: party.legalName,
        dealId: interaction.dealId,
        dealCode: deal.dealCode,
        contactId: interaction.contactId,
        contactName: contact.fullName,
        nextAction: interaction.nextAction,
        ownerUserId: interaction.userId,
        ownerEmail: appUser.email,
      })
      .from(interaction)
      .leftJoin(party, eq(party.partyId, interaction.partyId))
      .leftJoin(deal, eq(deal.dealId, interaction.dealId))
      .leftJoin(contact, eq(contact.contactId, interaction.contactId))
      .leftJoin(appUser, eq(appUser.userId, interaction.userId))
      .where(where)
      .orderBy(desc(interaction.occurredAt), desc(interaction.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(interaction)
      .leftJoin(party, eq(party.partyId, interaction.partyId))
      .leftJoin(deal, eq(deal.dealId, interaction.dealId))
      .leftJoin(contact, eq(contact.contactId, interaction.contactId))
      .where(where),
  ]);

  const ids = rows.map((r) => r.interactionId);
  const attendeeRows = ids.length
    ? await db
        .select({
          interactionId: interactionAttendee.interactionId,
          n: sql<number>`count(*)::int`,
        })
        .from(interactionAttendee)
        .where(
          and(
            inArray(interactionAttendee.interactionId, ids),
            isNull(interactionAttendee.deletedAt),
          ),
        )
        .groupBy(interactionAttendee.interactionId)
    : [];

  const counts = new Map(attendeeRows.map((r) => [r.interactionId, r.n] as const));

  return {
    total: n ?? 0,
    page,
    pageSize,
    rows: rows.map((r) => ({
      ...r,
      attendeeCount: counts.get(r.interactionId) ?? 0,
    })),
  };
}

export interface InteractionAttendeeRow {
  interactionAttendeeId: string;
  contactId: string;
  contactName: string;
  roleAtMeeting: string | null;
}

export interface InteractionDetail {
  interaction: typeof interaction.$inferSelect;
  partyName: string | null;
  dealCode: string | null;
  dealName: string | null;
  contactName: string | null;
  primaryContactName: string | null;
  attendees: InteractionAttendeeRow[];
}

export async function getInteractionDetail(
  interactionId: string,
  user?: CrmUser | null,
): Promise<InteractionDetail | null> {
  const [row] = await db
    .select({
      interaction: interaction,
      partyName: party.legalName,
      dealCode: deal.dealCode,
      dealName: deal.dealName,
      contactName: contact.fullName,
    })
    .from(interaction)
    .leftJoin(party, eq(party.partyId, interaction.partyId))
    .leftJoin(deal, eq(deal.dealId, interaction.dealId))
    .leftJoin(contact, eq(contact.contactId, interaction.contactId))
    .where(
      and(
        eq(interaction.interactionId, interactionId),
        isNull(interaction.deletedAt),
        interactionVisibilityClause(user),
      ),
    );
  if (!row) return null;

  const attendees = await db
    .select({
      interactionAttendeeId: interactionAttendee.interactionAttendeeId,
      contactId: interactionAttendee.contactId,
      contactName: contact.fullName,
      roleAtMeeting: interactionAttendee.roleAtMeeting,
    })
    .from(interactionAttendee)
    .innerJoin(contact, eq(contact.contactId, interactionAttendee.contactId))
    .where(
      and(
        eq(interactionAttendee.interactionId, interactionId),
        isNull(interactionAttendee.deletedAt),
      ),
    );

  let primaryContactName: string | null = null;
  if (row.interaction.primaryContactId) {
    const [pc] = await db
      .select({ name: contact.fullName })
      .from(contact)
      .where(eq(contact.contactId, row.interaction.primaryContactId));
    primaryContactName = pc?.name ?? null;
  }

  return {
    interaction: row.interaction,
    partyName: row.partyName,
    dealCode: row.dealCode,
    dealName: row.dealName,
    contactName: row.contactName,
    primaryContactName,
    attendees,
  };
}

// ---------------------------------------------------------------------------
// Form lookups - small option lists for the create dialog. These are NOT
// paginated; the CRM's party/deal/contact counts stay small enough at this
// stage. A typeahead is the §5.4 target for >1k rows.
// ---------------------------------------------------------------------------

export interface PartyOption {
  partyId: string;
  legalName: string;
}
export interface DealOption {
  dealId: string;
  dealCode: string | null;
  dealName: string | null;
}
export interface ContactOption {
  contactId: string;
  fullName: string;
  primaryEmail: string | null;
}

export async function listPartyOptions({
  q,
  limit = 50,
}: { q?: string; limit?: number } = {}): Promise<PartyOption[]> {
  const where = and(
    isNull(party.deletedAt),
    q ? or(ilike(party.legalName, `%${q}%`), ilike(party.displayName, `%${q}%`)) : undefined,
  );
  return db
    .select({ partyId: party.partyId, legalName: party.legalName })
    .from(party)
    .where(where)
    .orderBy(asc(party.legalName))
    .limit(limit);
}

export async function listDealOptions({
  q,
  limit = 50,
}: { q?: string; limit?: number } = {}): Promise<DealOption[]> {
  const where = and(
    isNull(deal.deletedAt),
    q
      ? or(
          ilike(deal.dealCode, `%${q}%`),
          ilike(deal.dealName, `%${q}%`),
        )
      : undefined,
  );
  return db
    .select({
      dealId: deal.dealId,
      dealCode: deal.dealCode,
      dealName: deal.dealName,
    })
    .from(deal)
    .where(where)
    .orderBy(asc(deal.dealCode))
    .limit(limit);
}

export async function listContactOptions({
  q,
  limit = 50,
}: { q?: string; limit?: number } = {}): Promise<ContactOption[]> {
  const where = and(
    isNull(contact.deletedAt),
    q ? ilike(contact.fullName, `%${q}%`) : undefined,
  );
  return db
    .select({
      contactId: contact.contactId,
      fullName: contact.fullName,
      primaryEmail: contact.primaryEmail,
    })
    .from(contact)
    .where(where)
    .orderBy(asc(contact.fullName))
    .limit(limit);
}
