// document - metadata only (§2.20). The file blob lives in S3-compatible object
// storage with a reference; KYC documents are encryption-at-rest + access-logged
// separately (ARCHITECTURE §4.3). barrier_id is the information-wall tag for
// RLS (§1.7).

import {
  bigint,
  boolean,
  char,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { documentTypeEnum, kycCategoryEnum } from "./enums";

import { appUser } from "./rbac";
import { party } from "./party";
import { contact } from "./contact";
import { deal } from "./deals";
import { informationBarrier } from "./information_barrier";

export const document = pgTable(
  "document",
  {
    documentId: uuid("document_id").defaultRandom().primaryKey(),
    // All nullable - a document anchors to at least one of these in practice,
    // but the model allows e.g. a firm-wide policy doc linked to none.
    dealId: uuid("deal_id").references(() => deal.dealId, {
      onDelete: "cascade",
    }),
    partyId: uuid("party_id").references(() => party.partyId, {
      onDelete: "cascade",
    }),
    contactId: uuid("contact_id").references(() => contact.contactId, {
      onDelete: "cascade",
    }),
    documentType: documentTypeEnum("document_type"),
    // Only meaningful for KYC documents (§2.20).
    kycCategory: kycCategoryEnum("kyc_category"),
    // S3 key (object storage ref - blob not in DB).
    fileStoreRef: text("file_store_ref"),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    // Integrity hash.
    sha256: char("sha256", { length: 64 }),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    isConfidential: boolean("is_confidential").default(false),
    // Information-wall tag for RLS (§1.7).
    barrierId: uuid("barrier_id").references(
      () => informationBarrier.barrierId,
      { onDelete: "set null" },
    ),
    // MNPI flag - disables download/copy/email-forward in UI, forces watermark
    // (ARCHITECTURE §4.5).
    isMnpi: boolean("is_mnpi").default(false),
    // DPDP retention clock (§5.6).
    retentionUntil: date("retention_until"),
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
    dealIdx: index("document_deal_idx").on(table.dealId),
    partyIdx: index("document_party_idx").on(table.partyId),
    contactIdx: index("document_contact_idx").on(table.contactId),
    typeIdx: index("document_type_idx").on(table.documentType),
    barrierIdx: index("document_barrier_idx").on(table.barrierId),
    retentionIdx: index("document_retention_idx").on(table.retentionUntil),
    sha256Idx: index("document_sha256_idx").on(table.sha256),
  }),
);

export const documentRelations = relations(document, ({ one }) => ({
  deal: one(deal, {
    fields: [document.dealId],
    references: [deal.dealId],
  }),
  party: one(party, {
    fields: [document.partyId],
    references: [party.partyId],
  }),
  contact: one(contact, {
    fields: [document.contactId],
    references: [contact.contactId],
  }),
  uploadedBy: one(appUser, {
    fields: [document.uploadedByUserId],
    references: [appUser.userId],
  }),
  barrier: one(informationBarrier, {
    fields: [document.barrierId],
    references: [informationBarrier.barrierId],
  }),
}));

export type Document = typeof document.$inferSelect;
export type DocumentInsert = typeof document.$inferInsert;
