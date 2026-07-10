// Contact (natural person) + party_contact (role link with interval).
// DATA_MODEL §2.4-2.5. Contacts are decoupled from parties; roles are the link.
// We never delete a contact when they leave a firm - we close the PartyContact
// interval (§1.2).

import {
  boolean,
  char,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import { citext, contactRoleEnum, pepEnum, salutationEnum } from "./enums";

import { appUser } from "./rbac";
import { party } from "./party";

// ---------------------------------------------------------------------------
// contact - natural person (§2.4)
// ---------------------------------------------------------------------------

export const contact = pgTable(
  "contact",
  {
    contactId: uuid("contact_id").defaultRandom().primaryKey(),
    fullName: citext("full_name").notNull(),
    salutation: salutationEnum("salutation"),
    primaryEmail: citext("primary_email"),
    primaryPhone: text("primary_phone"),
    designation: text("designation"),
    linkedinUrl: text("linkedin_url"),
    isKycIndividual: boolean("is_kyc_individual").default(false),
    // Convenience copy for BO/EDD individuals. Canonical PAN store is
    // party_identifier(identifier_type='PAN') (§2.3) - for any regulated
    // decision read party_identifier, not contact.pan.
    pan: char("pan", { length: 10 }),
    pepStatus: pepEnum("pep_status"),
    pepVerifiedAt: timestamp("pep_verified_at", {
      withTimezone: true,
      mode: "date",
    }),
    // FEMA / NRI (§3).
    isNri: boolean("is_nri").default(false),
    femaResidentialStatus: text("fema_residential_status"),
    // Standard audit columns.
    createdByUserId: uuid("created_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
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
    updatedByUserId: uuid("updated_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    emailUnique: uniqueIndex("contact_email_uidx")
      .on(table.primaryEmail)
      .where(sql`primary_email IS NOT NULL AND deleted_at IS NULL`),
    panUnique: uniqueIndex("contact_pan_uidx")
      .on(table.pan)
      .where(sql`pan IS NOT NULL AND deleted_at IS NULL`),
    nameIdx: index("contact_name_idx").on(table.fullName),
    // MIGRATION NOTE: trigram index via raw SQL:
    //   CREATE INDEX contact_full_name_trgm_idx ON contact USING gin (full_name gin_trgm_ops);
  }),
);

// ---------------------------------------------------------------------------
// party_contact - role link with interval (§2.5).
// `reporting_to_party_contact_id` FK→party_contact: org-chart WITHIN the same
// party (renamed from reporting_to_contact_id so the reporting line is per-
// party - the same contact at two firms has two independent reporting lines).
// ---------------------------------------------------------------------------

export const partyContact = pgTable(
  "party_contact",
  {
    partyContactId: uuid("party_contact_id").defaultRandom().primaryKey(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contact.contactId, { onDelete: "restrict" }),
    role: contactRoleEnum("role").notNull(),
    isPrimary: boolean("is_primary").default(false),
    validFrom: timestamp("valid_from", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
    // Self-FK: org-chart within the same party.
    reportingToPartyContactId: uuid("reporting_to_party_contact_id"),
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
    // UNIQUE (party_id, role) WHERE is_primary AND valid_to IS NULL AND
    // deleted_at IS NULL - at most one current primary contact per (party, role).
    primaryUnique: uniqueIndex("party_contact_primary_uidx")
      .on(table.partyId, table.role)
      .where(
        sql`is_primary AND valid_to IS NULL AND deleted_at IS NULL`,
      ),
    partyIdx: index("party_contact_party_idx").on(table.partyId),
    contactIdx: index("party_contact_contact_idx").on(table.contactId),
    currentIdx: index("party_contact_current_idx")
      .on(table.partyId, table.role)
      .where(sql`valid_to IS NULL AND deleted_at IS NULL`),
    // MIGRATION NOTE: exclusion constraint via raw SQL (Drizzle can't declare):
    //   CREATE EXTENSION IF NOT EXISTS btree_gist;
    //   ALTER TABLE party_contact
    //     ADD CONSTRAINT party_contact_no_overlap EXCLUDE USING gist
    //     (party_id WITH =, contact_id WITH =, role WITH =,
    //      tstzrange(valid_from, valid_to) WITH &&);
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const contactRelations = relations(contact, ({ one, many }) => ({
  partyContacts: many(partyContact),
  createdBy: one(appUser, {
    fields: [contact.createdByUserId],
    references: [appUser.userId],
    relationName: "contactCreatedBy",
  }),
  updatedBy: one(appUser, {
    fields: [contact.updatedByUserId],
    references: [appUser.userId],
    relationName: "contactUpdatedBy",
  }),
}));

export const partyContactRelations = relations(partyContact, ({ one }) => ({
  party: one(party, {
    fields: [partyContact.partyId],
    references: [party.partyId],
  }),
  contact: one(contact, {
    fields: [partyContact.contactId],
    references: [contact.contactId],
  }),
  reportingTo: one(partyContact, {
    fields: [partyContact.reportingToPartyContactId],
    references: [partyContact.partyContactId],
    relationName: "partyContactReportingTo",
  }),
}));

export type Contact = typeof contact.$inferSelect;
export type ContactInsert = typeof contact.$inferInsert;
export type PartyContact = typeof partyContact.$inferSelect;
export type PartyContactInsert = typeof partyContact.$inferInsert;
