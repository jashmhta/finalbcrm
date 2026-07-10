// Demat account - investor depository account (§2.23.1, §3).
// NSDL `IN...` 8-char alphanumeric DP IDs vs CDSL 8-digit numeric. The
// dedup key is (dp_id, client_id, depository) WHERE deleted_at IS NULL.
// Referenced by allocation_event.demat_account_id and by
// party_identifier(identifier_type='demat_dp_client').

import {
  char,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import { depositoryEnum, dematStatusEnum } from "./enums";

import { party } from "./party";

export const dematAccount = pgTable(
  "demat_account",
  {
    dematAccountId: uuid("demat_account_id").defaultRandom().primaryKey(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    dpId: char("dp_id", { length: 8 }).notNull(),
    clientId: char("client_id", { length: 8 }).notNull(),
    depository: depositoryEnum("depository").notNull(),
    accountStatus: dematStatusEnum("account_status").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
    verificationSource: text("verification_source"),
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
    // Dedup key for demat accounts (§2.23.1).
    dedupUnique: uniqueIndex("demat_account_dedup_uidx")
      .on(table.dpId, table.clientId, table.depository)
      .where(sql`deleted_at IS NULL`),
    partyIdx: index("demat_account_party_idx").on(table.partyId),
  }),
);

export const dematAccountRelations = relations(dematAccount, ({ one }) => ({
  party: one(party, {
    fields: [dematAccount.partyId],
    references: [party.partyId],
  }),
}));

export type DematAccount = typeof dematAccount.$inferSelect;
export type DematAccountInsert = typeof dematAccount.$inferInsert;
