// Compliance: consent_record (DPDP Act 2023) + data_subject_request.
// DATA_MODEL §2.21, §2.23.8. Consent is purpose-bound - a marketing consent
// does not authorize sharing data with a rating agency; that requires its own
// consent_record. Withdrawal triggers a data_subject_request workflow.

import {
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import { consentMethodEnum, consentPurposeEnum, dsrStatusEnum, dsrTypeEnum } from "./enums";

import { appUser } from "./rbac";
import { party } from "./party";
import { contact } from "./contact";

// ---------------------------------------------------------------------------
// consent_record (§2.21)
// ---------------------------------------------------------------------------

export const consentRecord = pgTable(
  "consent_record",
  {
    consentRecordId: uuid("consent_record_id").defaultRandom().primaryKey(),
    // Org-side principal (signatory). Nullable when only a natural-person principal.
    partyId: uuid("party_id").references(() => party.partyId, {
      onDelete: "cascade",
    }),
    // Natural-person principal. Nullable when only an org principal.
    contactId: uuid("contact_id").references(() => contact.contactId, {
      onDelete: "cascade",
    }),
    purpose: consentPurposeEnum("purpose").notNull(),
    purposeDescription: text("purpose_description"),
    consentGivenAt: timestamp("consent_given_at", {
      withTimezone: true,
      mode: "date",
    }),
    // null = active.
    consentWithdrawnAt: timestamp("consent_withdrawn_at", {
      withTimezone: true,
      mode: "date",
    }),
    consentMethod: consentMethodEnum("consent_method"),
    // Which data categories covered (DPDP granular consent).
    dataCategories: text("data_categories").array(),
    // Derived from purpose + Privacy Policy (~2yr for web leads per site).
    retentionUntil: date("retention_until"),
    // Which privacy-policy version they consented to.
    versionOfPolicy: text("version_of_policy"),
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
    partyIdx: index("consent_record_party_idx").on(table.partyId),
    contactIdx: index("consent_record_contact_idx").on(table.contactId),
    purposeIdx: index("consent_record_purpose_idx").on(table.purpose),
    activeIdx: index("consent_record_active_idx")
      .on(table.purpose)
      .where(sql`consent_withdrawn_at IS NULL AND deleted_at IS NULL`),
  }),
);

// ---------------------------------------------------------------------------
// data_subject_request - DPDP principal-rights workflow (§2.23.8).
// Triggered by consent withdrawal (§2.21) or a direct principal request;
// fulfillment of `erasure` runs the documented purge job (§5.6) within DPDP
// timelines.
// ---------------------------------------------------------------------------

export const dataSubjectRequest = pgTable(
  "data_subject_request",
  {
    dsrId: uuid("dsr_id").defaultRandom().primaryKey(),
    // Org-side principal (nullable).
    partyId: uuid("party_id").references(() => party.partyId, {
      onDelete: "cascade",
    }),
    // Natural-person principal (nullable).
    contactId: uuid("contact_id").references(() => contact.contactId, {
      onDelete: "cascade",
    }),
    requestType: dsrTypeEnum("request_type").notNull(),
    status: dsrStatusEnum("status").notNull(),
    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    handledByUserId: uuid("handled_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    // Link to the consent withdrawal that triggered this DSR (if applicable).
    triggeringConsentRecordId: uuid("triggering_consent_record_id"),
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
    // CHECK: at least one of party_id/contact_id must be set (§2.23.8).
    principalCheck: check(
      "dsr_principal_check",
      sql`${table.partyId} IS NOT NULL OR ${table.contactId} IS NOT NULL`,
    ),
    statusIdx: index("dsr_status_idx").on(table.status),
    partyIdx: index("dsr_party_idx").on(table.partyId),
    contactIdx: index("dsr_contact_idx").on(table.contactId),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const consentRecordRelations = relations(consentRecord, ({ one }) => ({
  party: one(party, {
    fields: [consentRecord.partyId],
    references: [party.partyId],
  }),
  contact: one(contact, {
    fields: [consentRecord.contactId],
    references: [contact.contactId],
  }),
}));

export const dataSubjectRequestRelations = relations(
  dataSubjectRequest,
  ({ one }) => ({
    party: one(party, {
      fields: [dataSubjectRequest.partyId],
      references: [party.partyId],
    }),
    contact: one(contact, {
      fields: [dataSubjectRequest.contactId],
      references: [contact.contactId],
    }),
    handledBy: one(appUser, {
      fields: [dataSubjectRequest.handledByUserId],
      references: [appUser.userId],
    }),
    triggeringConsent: one(consentRecord, {
      fields: [dataSubjectRequest.triggeringConsentRecordId],
      references: [consentRecord.consentRecordId],
    }),
  }),
);

export type ConsentRecord = typeof consentRecord.$inferSelect;
export type ConsentRecordInsert = typeof consentRecord.$inferInsert;
export type DataSubjectRequest = typeof dataSubjectRequest.$inferSelect;
export type DataSubjectRequestInsert = typeof dataSubjectRequest.$inferInsert;
