// interactions: interaction + interaction_attendee (junction).
// DATA_MODEL §2.18. An interaction must anchor to at least one of a party, a
// deal, or a contact (CHECK num_nonnulls >= 1). MNPI interactions are walled
// via barrier_id (§1.7). Attendees are a junction (replacing the former
// attendee_contact_ids uuid[] array - §2.18).

import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import {
  attendeeRoleEnum,
  interactionChannelEnum,
  interactionDirectionEnum,
} from "./enums";

import { appUser } from "./rbac";
import { party } from "./party";
import { contact } from "./contact";
import { deal } from "./deals";
import { informationBarrier } from "./information_barrier";

export const interaction = pgTable(
  "interaction",
  {
    interactionId: uuid("interaction_id").defaultRandom().primaryKey(),
    // Nullable if deal-only (but see CHECK below - at least one anchor required).
    partyId: uuid("party_id").references(() => party.partyId, {
      onDelete: "cascade",
    }),
    dealId: uuid("deal_id").references(() => deal.dealId, {
      onDelete: "cascade",
    }),
    contactId: uuid("contact_id").references(() => contact.contactId, {
      onDelete: "cascade",
    }),
    channel: interactionChannelEnum("channel"),
    direction: interactionDirectionEnum("direction"),
    subject: text("subject"),
    body: text("body"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }),
    durationMin: integer("duration_min"),
    // Denormalized for fast listing; always also present as an
    // interaction_attendee row (§2.18).
    primaryContactId: uuid("primary_contact_id").references(
      () => contact.contactId,
      { onDelete: "set null" },
    ),
    userId: uuid("user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    // MNPI interactions are walled (§1.7).
    barrierId: uuid("barrier_id").references(
      () => informationBarrier.barrierId,
      { onDelete: "set null" },
    ),
    // Required flag; if true, RLS walls it from trading desks (§2.18).
    containsMnpi: boolean("contains_mnpi").default(false).notNull(),
    nextAction: text("next_action"),
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
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // CHECK: an interaction must anchor to at least one of a party, a deal, or
    // a contact - no free-floating notes (§2.18).
    anchorCheck: check(
      "interaction_anchor_check",
      sql`num_nonnulls(${table.partyId}, ${table.dealId}, ${table.contactId}) >= 1`,
    ),
    partyIdx: index("interaction_party_idx").on(table.partyId),
    dealIdx: index("interaction_deal_idx").on(table.dealId),
    contactIdx: index("interaction_contact_idx").on(table.contactId),
    occurredAtIdx: index("interaction_occurred_at_idx").on(table.occurredAt),
    // BRIN on occurred_at for large append-only volume (§5.2):
    //   CREATE INDEX interaction_occurred_at_brin_idx ON interaction USING brin (occurred_at);
  }),
);

// ---------------------------------------------------------------------------
// interaction_attendee - junction (§2.18). UQ (interaction_id, contact_id).
// ---------------------------------------------------------------------------

export const interactionAttendee = pgTable(
  "interaction_attendee",
  {
    interactionAttendeeId: uuid("interaction_attendee_id")
      .defaultRandom()
      .primaryKey(),
    interactionId: uuid("interaction_id")
      .notNull()
      .references(() => interaction.interactionId, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contact.contactId, { onDelete: "restrict" }),
    roleAtMeeting: attendeeRoleEnum("role_at_meeting"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    interactionContactUnique: uniqueIndex("interaction_attendee_uidx")
      .on(table.interactionId, table.contactId)
      .where(sql`deleted_at IS NULL`),
    interactionIdx: index("interaction_attendee_interaction_idx").on(
      table.interactionId,
    ),
    contactIdx: index("interaction_attendee_contact_idx").on(table.contactId),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const interactionRelations = relations(interaction, ({ one, many }) => ({
  party: one(party, {
    fields: [interaction.partyId],
    references: [party.partyId],
  }),
  deal: one(deal, {
    fields: [interaction.dealId],
    references: [deal.dealId],
  }),
  contact: one(contact, {
    fields: [interaction.contactId],
    references: [contact.contactId],
  }),
  primaryContact: one(contact, {
    fields: [interaction.primaryContactId],
    references: [contact.contactId],
    relationName: "interactionPrimaryContact",
  }),
  user: one(appUser, {
    fields: [interaction.userId],
    references: [appUser.userId],
  }),
  barrier: one(informationBarrier, {
    fields: [interaction.barrierId],
    references: [informationBarrier.barrierId],
  }),
  attendees: many(interactionAttendee),
}));

export const interactionAttendeeRelations = relations(
  interactionAttendee,
  ({ one }) => ({
    interaction: one(interaction, {
      fields: [interactionAttendee.interactionId],
      references: [interaction.interactionId],
    }),
    contact: one(contact, {
      fields: [interactionAttendee.contactId],
      references: [contact.contactId],
    }),
  }),
);

export type Interaction = typeof interaction.$inferSelect;
export type InteractionInsert = typeof interaction.$inferInsert;
export type InteractionAttendee = typeof interactionAttendee.$inferSelect;
export type InteractionAttendeeInsert = typeof interactionAttendee.$inferInsert;
