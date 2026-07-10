// Information barrier (Chinese wall) - DATA_MODEL §1.7, §2.23.2.
// ARCHITECTURE §4.4-4.5: RLS policies tag rows by barrier_id on deal, party,
// interaction, document, credit_analysis, allocation_event. This table is the
// wall registry; lifting is audited and `lifted_at` null = active.

import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import { deskEnum } from "./enums";

// Forward references are resolved lazily via the `references()` callback, so
// circular FKs (barrier↔party, barrier↔deal) compile cleanly. Real value
// imports (NOT `import type`) because the lambdas resolve bindings at runtime.
import { deal as dealTable } from "./deals";
import { party as partyTable } from "./party";
import { appUser as appUserTable } from "./rbac";

// `barrier_id` is referenced as a nullable FK from party, deal, interaction,
// document, credit_analysis, allocation_event, trade_event, audit_log. Those
// modules import this table directly.

export const informationBarrier = pgTable(
  "information_barrier",
  {
    barrierId: uuid("barrier_id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    // Deal-side wall (NN when mandate-specific); null for party-side / firm-wide walls.
    //
    // NOTE: `dealId` and `partyId` are declared as plain uuid columns (NOT via
    // `references()`) to break the mutual-FK type-inference cycle
    // (barrier↔deal, barrier↔party) that produces TS error 7022 on `deal`/`party`
    // once the schema is imported by the app. The deal/party → barrierId
    // direction keeps its `references()` (one-directional), so the link is
    // still expressed in Drizzle from the other side. The DB-level FK
    // constraints for barrier.deal_id / barrier.party_id are added via raw SQL
    // in a migration - see MIGRATION NOTE at the bottom of this file.
    dealId: uuid("deal_id"),
    // Party-side wall (e.g., a walled issuer); null when dealId is set.
    partyId: uuid("party_id"),
    // Desk/role tags blocked from MNPI for this wall, e.g. {trading_desk, market_making}.
    restrictedRoleSet: text("restricted_role_set").array().notNull(),
    restrictedDeskSet: deskEnum("restricted_desk").array(),
    reason: text("reason"),
    // Standard audit columns (§2 global note).
    createdByUserId: uuid("created_by_user_id").references(
      () => appUserTable.userId,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    // erected_at alias - same column; documented for clarity.
    erectedAt: timestamp("erected_at", { withTimezone: true, mode: "date" }),
    liftedAt: timestamp("lifted_at", { withTimezone: true, mode: "date" }),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).defaultNow(),
    updatedByUserId: uuid("updated_by_user_id"),
    deletedAt: timestamp("deleted_at", {
      withTimezone: true,
      mode: "date",
    }),
    // Convenience flags for RLS policy predicates.
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => ({
    // CHECK: at least one of deal_id/party_id should be set unless the wall is
    // firm-wide (both null allowed for firm-wide walls per §2.23.2).
    barrierScopeCheck: check(
      "information_barrier_scope_check",
      sql`${table.dealId} IS NOT NULL OR ${table.partyId} IS NOT NULL`,
    ),
    barrierDealIdx: index("information_barrier_deal_idx").on(table.dealId),
    barrierPartyIdx: index("information_barrier_party_idx").on(table.partyId),
    barrierActiveIdx: index("information_barrier_active_idx")
      .on(table.isActive)
      .where(sql`deleted_at IS NULL AND lifted_at IS NULL`),
  }),
);

export const informationBarrierRelations = relations(
  informationBarrier,
  ({ one }) => ({
    deal: one(dealTable, {
      fields: [informationBarrier.dealId],
      references: [dealTable.dealId],
    }),
    party: one(partyTable, {
      fields: [informationBarrier.partyId],
      references: [partyTable.partyId],
    }),
    createdBy: one(appUserTable, {
      fields: [informationBarrier.createdByUserId],
      references: [appUserTable.userId],
    }),
  }),
);

export type InformationBarrier = typeof informationBarrier.$inferSelect;
export type InformationBarrierInsert = typeof informationBarrier.$inferInsert;

// MIGRATION NOTE: DB-level FK constraints for information_barrier.deal_id and
// information_barrier.party_id are declared here as raw SQL because the
// Drizzle `references()` lambdas were removed to break the barrier↔deal /
// barrier↔party mutual-FK type-inference cycle (see the comment on `dealId`
// above). Add these in a migration:
//
//   ALTER TABLE information_barrier
//     ADD CONSTRAINT information_barrier_deal_id_deal_deal_id_fk
//     FOREIGN KEY (deal_id) REFERENCES deal(deal_id) ON DELETE CASCADE;
//   ALTER TABLE information_barrier
//     ADD CONSTRAINT information_barrier_party_id_party_party_id_fk
//     FOREIGN KEY (party_id) REFERENCES party(party_id) ON DELETE CASCADE;
//
// The `relations()` above (informationBarrierRelations.deal / .party) still
// describe the joins for the relational query API - independent of the DB FK.
