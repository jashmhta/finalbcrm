// Relationship - org hierarchy / beneficial-ownership edges (§1.5, §2.6).
// parent_party_id / child_party_id directed edge. relationship_type ∈
// {wholly_owned, subsidiary, associate, jv, promoter, beneficial_owner,
// guarantor, sister_concern, management_control}. Ultimate parent is
// computed via a recursive CTE; party.ultimate_parent_party_id is a
// denormalized cache refreshed on edge change (§1.5). A beneficial_owner
// edge with ownership_pct >= 10 triggers EDD review (PMLA).

import {
  boolean,
  index,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import { relationshipTypeEnum } from "./enums";

import { party } from "./party";
// Real value import - relations() one() accesses documentTable.documentId at runtime.
import { document as documentTable } from "./documents";

export const relationship = pgTable(
  "relationship",
  {
    relationshipId: uuid("relationship_id").defaultRandom().primaryKey(),
    parentPartyId: uuid("parent_party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    childPartyId: uuid("child_party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    relationshipType: relationshipTypeEnum("relationship_type").notNull(),
    ownershipPct: numeric("ownership_pct", { precision: 5, scale: 2 }),
    votingRightsPct: numeric("voting_rights_pct", { precision: 5, scale: 2 }),
    isPubliclyDisclosed: boolean("is_publicly_disclosed").default(false),
    effectiveFrom: timestamp("effective_from", {
      withTimezone: true,
      mode: "date",
    }),
    effectiveTo: timestamp("effective_to", { withTimezone: true, mode: "date" }),
    evidenceDocumentId: uuid("evidence_document_id"),
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
    // No duplicate directed edges (parent, child, type) while active.
    edgeUnique: uniqueIndex("relationship_edge_uidx")
      .on(
        table.parentPartyId,
        table.childPartyId,
        table.relationshipType,
      )
      .where(sql`deleted_at IS NULL`),
    parentIdx: index("relationship_parent_idx").on(table.parentPartyId),
    childIdx: index("relationship_child_idx").on(table.childPartyId),
    // BO edges with >= 10% ownership - EDD trigger (PMLA).
    boOwnershipIdx: index("relationship_bo_ownership_idx")
      .on(table.childPartyId, table.ownershipPct)
      .where(
        sql`relationship_type = 'beneficial_owner' AND deleted_at IS NULL`,
      ),
    // MIGRATION NOTE: relationship_path materialized view (recursive CTE) for
    // ultimate-parent chains - add via raw SQL in a migration.
  }),
);

export const relationshipRelations = relations(relationship, ({ one }) => ({
  parentParty: one(party, {
    fields: [relationship.parentPartyId],
    references: [party.partyId],
    relationName: "relationshipParent",
  }),
  childParty: one(party, {
    fields: [relationship.childPartyId],
    references: [party.partyId],
    relationName: "relationshipChild",
  }),
  evidenceDocument: one(documentTable, {
    fields: [relationship.evidenceDocumentId],
    references: [documentTable.documentId],
  }),
}));

export type Relationship = typeof relationship.$inferSelect;
export type RelationshipInsert = typeof relationship.$inferInsert;
