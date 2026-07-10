// Deals: instrument, deal, deal_party, allocation_event, trade_event.
// DATA_MODEL §2.9-2.11, §2.16, §2.23.3. Allocation and trade events are
// IMMUTABLE append-only (§1.3, §2.11, §2.23.3) - post-pricing rows are frozen;
// corrections append a new compensating event. This is the regulator-grade
// trade-record pattern for CCIL/NDS-OM reportable trades (§2.11).

import {
  boolean,
  char,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import {
  allocEventTypeEnum,
  allocSourceChannelEnum,
  auctionBidTypeEnum,
  brandEnum,
  couponTypeEnum,
  dealPartyRoleEnum,
  dealStatusEnum,
  dealTypeEnum,
  exchangeEnum,
  frequencyEnum,
  instrumentTypeEnum,
  priceTypeEnum,
  tradeSideEnum,
} from "./enums";

import { appUser } from "./rbac";
import { party } from "./party";
import { informationBarrier } from "./information_barrier";
import { dematAccount } from "./demat";
// Real value import - relations() one() accesses documentTable.documentId at runtime.
import { document as documentTable } from "./documents";

// ---------------------------------------------------------------------------
// instrument - tradable/issuable security (§2.16, §3 ISIN).
// ---------------------------------------------------------------------------

export const instrument = pgTable(
  "instrument",
  {
    instrumentId: uuid("instrument_id").defaultRandom().primaryKey(),
    isin: char("isin", { length: 12 }),
    instrumentType: instrumentTypeEnum("instrument_type").notNull(),
    issuerPartyId: uuid("issuer_party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    issueDate: date("issue_date"),
    maturityDate: date("maturity_date"),
    couponPct: numeric("coupon_pct", { precision: 6, scale: 4 }),
    couponType: couponTypeEnum("coupon_type"),
    frequency: frequencyEnum("frequency"),
    faceValue: numeric("face_value", { precision: 12, scale: 4 }),
    // Issue size in the instrument's currency (INR for domestic paper, USD/other
    // for cross-border) - renamed from issue_size_inr (§2.16).
    issueSize: numeric("issue_size", { precision: 18, scale: 4 }),
    currencyCode: char("currency_code", { length: 3 }).default("INR"),
    securityPackage: jsonb("security_package"),
    listingExchange: exchangeEnum("listing_exchange"),
    creditEnhancementProviderId: uuid("credit_enhancement_provider_id"),
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
    isinUnique: uniqueIndex("instrument_isin_uidx")
      .on(table.isin)
      .where(sql`isin IS NOT NULL AND deleted_at IS NULL`),
    issuerIdx: index("instrument_issuer_idx").on(table.issuerPartyId),
    typeIdx: index("instrument_type_idx").on(table.instrumentType),
    maturityIdx: index("instrument_maturity_idx").on(table.maturityDate),
  }),
);

// ---------------------------------------------------------------------------
// deal - one row per mandate (§2.9). deal_type drives which sub-tables and
// which FinancialModel types are relevant.
// ---------------------------------------------------------------------------

export const deal = pgTable(
  "deal",
  {
    dealId: uuid("deal_id").defaultRandom().primaryKey(),
    dealCode: text("deal_code"),
    dealType: dealTypeEnum("deal_type").notNull(),
    dealSubtype: text("deal_subtype"),
    dealName: text("deal_name"),
    status: dealStatusEnum("status"),
    brand: brandEnum("brand").notNull(),
    leadUserId: uuid("lead_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    creditAnalystUserId: uuid("credit_analyst_user_id").references(
      () => appUser.userId,
      { onDelete: "set null" },
    ),
    targetCloseDate: date("target_close_date"),
    actualCloseDate: date("actual_close_date"),
    // Deal size in currency_code (multi-currency for ADR/GDR/cross-border ECM).
    targetSize: numeric("target_size", { precision: 18, scale: 4 }),
    targetTenorYears: numeric("target_tenor_years", { precision: 6, scale: 2 }),
    currencyCode: char("currency_code", { length: 3 }).default("INR"),
    feeStructure: jsonb("fee_structure"),
    mandateLetterDocumentId: uuid("mandate_letter_document_id"),
    // Deal-side information wall (§1.7).
    barrierId: uuid("barrier_id").references(
      () => informationBarrier.barrierId,
      { onDelete: "set null" },
    ),
    // Self-FK: e.g., a re-rating tied to a refinance.
    parentDealId: uuid("parent_deal_id"),
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
    createdByUserId: uuid("created_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    updatedByUserId: uuid("updated_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    dealCodeUnique: uniqueIndex("deal_deal_code_uidx")
      .on(table.dealCode)
      .where(sql`deal_code IS NOT NULL AND deleted_at IS NULL`),
    // Covering index for hot read paths (§5.2):
    //   CREATE INDEX deal_type_status_brand_idx ON deal (deal_type, status, brand)
    //     INCLUDE (deal_code, target_size, lead_user_id);
    typeStatusBrandIdx: index("deal_type_status_brand_idx").on(
      table.dealType,
      table.status,
      table.brand,
    ),
    leadIdx: index("deal_lead_idx").on(table.leadUserId),
    barrierIdx: index("deal_barrier_idx").on(table.barrierId),
    parentIdx: index("deal_parent_idx").on(table.parentDealId),
  }),
);

// ---------------------------------------------------------------------------
// deal_party - parties on a deal with roles (§2.10). UQ (deal_id, party_id, role).
// ---------------------------------------------------------------------------

export const dealParty = pgTable(
  "deal_party",
  {
    dealPartyId: uuid("deal_party_id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.dealId, { onDelete: "cascade" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    role: dealPartyRoleEnum("role").notNull(),
    isLead: boolean("is_lead").default(false),
    // Underwriting commitment / investor indicated amount, in deal.currency_code
    // (renamed from commitment_inr - multi-currency).
    commitmentAmount: numeric("commitment_amount", { precision: 18, scale: 4 }),
    participationNote: text("participation_note"),
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
    dealPartyRoleUnique: uniqueIndex("deal_party_role_uidx")
      .on(table.dealId, table.partyId, table.role)
      .where(sql`deleted_at IS NULL`),
    dealIdx: index("deal_party_deal_idx").on(table.dealId),
    partyIdx: index("deal_party_party_idx").on(table.partyId),
    leadIdx: index("deal_party_lead_idx")
      .on(table.dealId)
      .where(sql`is_lead AND deleted_at IS NULL`),
  }),
);

// ---------------------------------------------------------------------------
// allocation_event - IMMUTABLE append-only event-sourced allocations (§2.11).
// Current state is derived from these events (read projection allocation_current
// aggregates to one row per (deal_id, party_id)). Pre-pricing rows are editable
// (by RM); post-pricing rows are frozen - only new events append.
// ---------------------------------------------------------------------------

export const allocationEvent = pgTable(
  "allocation_event",
  {
    allocationEventId: uuid("allocation_event_id")
      .defaultRandom()
      .primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.dealId, { onDelete: "restrict" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    eventType: allocEventTypeEnum("event_type").notNull(),
    // Amount in deal.currency_code (renamed from amount_inr - multi-currency).
    amount: numeric("amount", { precision: 18, scale: 4 }),
    yieldPct: numeric("yield_pct", { precision: 6, scale: 4 }),
    price: numeric("price", { precision: 12, scale: 6 }),
    priceType: priceTypeEnum("price_type"),
    // For G-Sec auction: competitive / non-competitive.
    putCallIndicator: auctionBidTypeEnum("put_call_indicator"),
    allotmentPct: numeric("allotment_pct", { precision: 5, scale: 2 }),
    dematAccountId: uuid("demat_account_id").references(
      () => dematAccount.dematAccountId,
      { onDelete: "set null" },
    ),
    eventAt: timestamp("event_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    eventByUserId: uuid("event_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    sourceChannel: allocSourceChannelEnum("source_channel"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    // IMMUTABLE: no updated_at / deleted_at. INSERT-only permissions enforced
    // via a migration trigger (see MIGRATION NOTE below).
    barrierId: uuid("barrier_id").references(
      () => informationBarrier.barrierId,
      { onDelete: "set null" },
    ),
  },
  (table) => ({
    dealPartyIdx: index("allocation_event_deal_party_idx").on(
      table.dealId,
      table.partyId,
    ),
    eventAtIdx: index("allocation_event_event_at_idx").on(table.eventAt),
    typeIdx: index("allocation_event_type_idx").on(table.eventType),
    // MIGRATION NOTE: INSERT-only trigger:
    //   CREATE OR REPLACE FUNCTION allocation_event_immutable() RETURNS trigger AS $$
    //   BEGIN RAISE EXCEPTION 'allocation_event is INSERT-only'; END;
    //   $$ LANGUAGE plpgsql;
    //   CREATE TRIGGER allocation_event_no_update_delete BEFORE UPDATE OR DELETE
    //     ON allocation_event FOR EACH STATEMENT EXECUTE FUNCTION allocation_event_immutable();
    // MIGRATION NOTE: optional LIST partition by deal_type if a desk-specific
    // hot path emerges (§5.2).
  }),
);

// ---------------------------------------------------------------------------
// trade_event - IMMUTABLE append-only executed secondary trades (§2.23.3).
// G-Sec, corporate bonds, CP. CCIL DVP settlement reference (NDS-OM reportable).
// Feeds `exposure` via the periodic snapshot job.
// ---------------------------------------------------------------------------

export const tradeEvent = pgTable(
  "trade_event",
  {
    eventId: uuid("event_id").defaultRandom().primaryKey(),
    // Null for pure secondary trades (no mandate row) - see §2.23.3 minor (l).
    dealId: uuid("deal_id").references(() => deal.dealId, {
      onDelete: "set null",
    }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instrument.instrumentId, { onDelete: "restrict" }),
    ccilTradeId: text("ccil_trade_id"),
    exchange: exchangeEnum("exchange").notNull(),
    tradeSide: tradeSideEnum("trade_side").notNull(),
    amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
    currencyCode: char("currency_code", { length: 3 }).default("INR").notNull(),
    price: numeric("price", { precision: 12, scale: 6 }).notNull(),
    priceType: priceTypeEnum("price_type").notNull(),
    yieldPct: numeric("yield_pct", { precision: 6, scale: 4 }),
    quantity: numeric("quantity", { precision: 18, scale: 4 }),
    settlementDate: date("settlement_date").notNull(),
    dematAccountId: uuid("demat_account_id").references(
      () => dematAccount.dematAccountId,
      { onDelete: "set null" },
    ),
    tradeAt: timestamp("trade_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    tradedByUserId: uuid("traded_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    barrierId: uuid("barrier_id").references(
      () => informationBarrier.barrierId,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    // IMMUTABLE: no updated_at / deleted_at. INSERT-only.
  },
  (table) => ({
    ccilTradeIdUnique: uniqueIndex("trade_event_ccil_trade_id_uidx")
      .on(table.ccilTradeId)
      .where(sql`ccil_trade_id IS NOT NULL`),
    partyIdx: index("trade_event_party_idx").on(table.partyId),
    instrumentIdx: index("trade_event_instrument_idx").on(table.instrumentId),
    tradeAtIdx: index("trade_event_trade_at_idx").on(table.tradeAt),
    settlementIdx: index("trade_event_settlement_idx").on(table.settlementDate),
    // MIGRATION NOTE: INSERT-only trigger (same pattern as allocation_event).
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const instrumentRelations = relations(instrument, ({ one, many }) => ({
  issuer: one(party, {
    fields: [instrument.issuerPartyId],
    references: [party.partyId],
  }),
  creditEnhancementProvider: one(party, {
    fields: [instrument.creditEnhancementProviderId],
    references: [party.partyId],
    relationName: "instrumentCreditEnhancementProvider",
  }),
  trades: many(tradeEvent),
}));

export const dealRelations = relations(deal, ({ one, many }) => ({
  lead: one(appUser, {
    fields: [deal.leadUserId],
    references: [appUser.userId],
    relationName: "dealLead",
  }),
  creditAnalyst: one(appUser, {
    fields: [deal.creditAnalystUserId],
    references: [appUser.userId],
    relationName: "dealCreditAnalyst",
  }),
  barrier: one(informationBarrier, {
    fields: [deal.barrierId],
    references: [informationBarrier.barrierId],
  }),
  parentDeal: one(deal, {
    fields: [deal.parentDealId],
    references: [deal.dealId],
    relationName: "dealParent",
  }),
  mandateLetterDocument: one(documentTable, {
    fields: [deal.mandateLetterDocumentId],
    references: [documentTable.documentId],
  }),
  parties: many(dealParty),
  allocationEvents: many(allocationEvent),
}));

export const dealPartyRelations = relations(dealParty, ({ one }) => ({
  deal: one(deal, {
    fields: [dealParty.dealId],
    references: [deal.dealId],
  }),
  party: one(party, {
    fields: [dealParty.partyId],
    references: [party.partyId],
  }),
}));

export const allocationEventRelations = relations(
  allocationEvent,
  ({ one }) => ({
    deal: one(deal, {
      fields: [allocationEvent.dealId],
      references: [deal.dealId],
    }),
    party: one(party, {
      fields: [allocationEvent.partyId],
      references: [party.partyId],
    }),
    dematAccount: one(dematAccount, {
      fields: [allocationEvent.dematAccountId],
      references: [dematAccount.dematAccountId],
    }),
    eventBy: one(appUser, {
      fields: [allocationEvent.eventByUserId],
      references: [appUser.userId],
    }),
    barrier: one(informationBarrier, {
      fields: [allocationEvent.barrierId],
      references: [informationBarrier.barrierId],
    }),
  }),
);

export const tradeEventRelations = relations(tradeEvent, ({ one }) => ({
  deal: one(deal, {
    fields: [tradeEvent.dealId],
    references: [deal.dealId],
  }),
  party: one(party, {
    fields: [tradeEvent.partyId],
    references: [party.partyId],
  }),
  instrument: one(instrument, {
    fields: [tradeEvent.instrumentId],
    references: [instrument.instrumentId],
  }),
  dematAccount: one(dematAccount, {
    fields: [tradeEvent.dematAccountId],
    references: [dematAccount.dematAccountId],
  }),
  tradedBy: one(appUser, {
    fields: [tradeEvent.tradedByUserId],
    references: [appUser.userId],
  }),
  barrier: one(informationBarrier, {
    fields: [tradeEvent.barrierId],
    references: [informationBarrier.barrierId],
  }),
}));

export type Instrument = typeof instrument.$inferSelect;
export type InstrumentInsert = typeof instrument.$inferInsert;
export type Deal = typeof deal.$inferSelect;
export type DealInsert = typeof deal.$inferInsert;
export type DealParty = typeof dealParty.$inferSelect;
export type DealPartyInsert = typeof dealParty.$inferInsert;
export type AllocationEvent = typeof allocationEvent.$inferSelect;
export type AllocationEventInsert = typeof allocationEvent.$inferInsert;
export type TradeEvent = typeof tradeEvent.$inferSelect;
export type TradeEventInsert = typeof tradeEvent.$inferInsert;
