// Party master + typing + canonical identifiers + address.
// DATA_MODEL §2.1-2.3, §2.23.9, §3 (Indian-specific fields), §1.4 (dedup).
// The party master is the single source of truth - no deal/contact/exposure/
// credit record references free-text names; all reference party_id (§1.1).

import {
  boolean,
  char,
  check,
  integer,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import {
  addressTypeEnum,
  brandEnum,
  citext,
  dataSourceEnum,
  dedupStatusEnum,
  identifierTypeEnum,
  kycRiskEnum,
  partyNatureEnum,
  partyStatusEnum,
  partyTypeEnum,
} from "./enums";

import { appUser } from "./rbac";
import { informationBarrier } from "./information_barrier";
// sectorCode lives in credit.ts - real value import because the relations()
// one() helper accesses sectorCodeTable.sectorCodeId at runtime.
import { sectorCode as sectorCodeTable } from "./credit";

// ---------------------------------------------------------------------------
// party - the party master (§2.1)
// ---------------------------------------------------------------------------

export const party = pgTable(
  "party",
  {
    partyId: uuid("party_id").defaultRandom().primaryKey(),
    // Stable internal sequence for sorting/display (§2.1).
    partySeq: numeric("party_seq", { precision: 20 }),
    legalName: citext("legal_name").notNull(),
    displayName: text("display_name"),
    // Double-Metaphone of legal_name; dedup aid. MIGRATION NOTE: generated column
    // computed via a trigger or app-layer; declared as a regular text column here.
    // A migration may add: `name_phonetic text GENERATED ALWAYS AS (dmetaphone(legal_name)) STORED`.
    namePhonetic: text("name_phonetic"),
    partyNature: partyNatureEnum("party_nature").notNull(),
    countryOfIncorporation: char("country_of_incorporation", {
      length: 2,
    })
      .default("IN")
      .notNull(),
    domicileState: text("domicile_state"),
    // Denormalized cache; canonical via `relationship` (§1.5). Recomputed by a
    // job on edge change. NOT a generated column (cross-row).
    ultimateParentPartyId: uuid("ultimate_parent_party_id"),
    isListed: boolean("is_listed").default(false).notNull(),
    // listingExchange uses the shared exchange enum (defined in deals.ts use-site).
    // Declared as text to avoid a cross-module enum import cycle; constrained by app.
    listingExchange: text("listing_exchange"),
    ticker: text("ticker"),
    // FK to sectorCode (credit.ts) - consolidates the DATA_MODEL `segment` concept
    // into the credit-spec `sector_code` reference table (see report).
    industrySegmentId: uuid("industry_segment_id"),
    crisilSectorCode: text("crisil_sector_code"),
    // Denormalized cache; recomputed by exposure job. NOT a generated column.
    groupExposureInr: numeric("group_exposure_inr", { precision: 18, scale: 4 }),
    // trigger-maintained - NOT a GENERATED column. Recomputed by an
    // AFTER INSERT/UPDATE/DELETE trigger on kyc_record (and on kyc_beneficial_owner
    // / relationship BO-edge changes). See DATA_MODEL §2.1 note.
    isKycComplete: boolean("is_kyc_complete").default(false),
    isKycStale: boolean("is_kyc_stale").default(false),
    // Party-side information wall (§1.7). Nullable FK→information_barrier.
    barrierId: uuid("barrier_id").references(() => informationBarrier.barrierId, {
      onDelete: "set null",
    }),
    kycRiskRating: kycRiskEnum("kyc_risk_rating"),
    status: partyStatusEnum("status").notNull(),
    brandOrigin: brandEnum("brand_origin").notNull(),
    source: dataSourceEnum("source"),
    sourceRef: text("source_ref"),
    assignedUserId: uuid("assigned_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    dataOwnerUserId: uuid("data_owner_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    annualTurnoverCr: numeric("annual_turnover_cr", { precision: 18, scale: 4 }),
    turnoverBand: text("turnover_band"),
    industrySector: text("industry_sector"),
    industrySubsector: text("industry_subsector"),
    latestRating: text("latest_rating"),
    latestRatingAgency: text("latest_rating_agency"),
    latestRatingYear: integer("latest_rating_year"),
    latestRatingHeader: text("latest_rating_header"),
    investorType: text("investor_type"),
    portfolioSizeCr: numeric("portfolio_size_cr", { precision: 18, scale: 4 }),
    portfolioSizeBand: text("portfolio_size_band"),
    riskAppetite: text("risk_appetite"),
    highYieldAppetite: boolean("high_yield_appetite").default(false),
    existingSecuritiesNote: text("existing_securities_note"),
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
    // UQ(legal_name, country_of_incorporation) partial where deleted_at IS NULL.
    legalNameCountryUnique: uniqueIndex("party_legal_name_country_uidx")
      .on(table.legalName, table.countryOfIncorporation)
      .where(sql`deleted_at IS NULL`),
    ultimateParentIdx: index("party_ultimate_parent_idx").on(
      table.ultimateParentPartyId,
    ),
    statusBrandIdx: index("party_status_brand_idx").on(
      table.status,
      table.brandOrigin,
    ),
    barrierIdx: index("party_barrier_idx").on(table.barrierId),
    assignedUserIdx: index("party_assigned_user_idx").on(table.assignedUserId),
    turnoverBandIdx: index("party_turnover_band_idx").on(table.turnoverBand),
    industrySectorIdx: index("party_industry_sector_idx").on(
      table.industrySector,
      table.industrySubsector,
    ),
    latestRatingIdx: index("party_latest_rating_idx").on(
      table.latestRating,
      table.latestRatingAgency,
      table.latestRatingYear,
    ),
    investorSuitabilityIdx: index("party_investor_suitability_idx").on(
      table.investorType,
      table.portfolioSizeBand,
      table.riskAppetite,
    ),
    softDeleteIdx: index("party_soft_delete_idx")
      .on(table.partyId)
      .where(sql`deleted_at IS NULL`),
    // MIGRATION NOTE: add trigram + FTS indexes via raw SQL in a migration:
    //   CREATE EXTENSION IF NOT EXISTS pg_trgm;
    //   CREATE INDEX party_legal_name_trgm_idx ON party USING gin (legal_name gin_trgm_ops);
    //   CREATE INDEX party_name_phonetic_gin_idx ON party USING gin (name_phonetic);
    //   CREATE INDEX party_legal_name_fts_idx ON party USING gin (to_tsvector('english', legal_name || ' ' || coalesce(display_name,'')));
  }),
);

// ---------------------------------------------------------------------------
// party_type_assignment - multi-valued typing (§2.2). PK (party_id, party_type).
// Types are append-only; removal writes an audit row, never a hard delete.
// ---------------------------------------------------------------------------

export const partyTypeAssignment = pgTable(
  "party_type_assignment",
  {
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    partyType: partyTypeEnum("party_type").notNull(),
    assignedAt: timestamp("assigned_at", {
      withTimezone: true,
      mode: "date",
    }).defaultNow(),
    assignedByUserId: uuid("assigned_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    evidenceNote: text("evidence_note"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.partyId, table.partyType] }),
  }),
);

// ---------------------------------------------------------------------------
// party_identifier - canonical identifiers, the dedup backbone (§2.3, §1.4).
// ---------------------------------------------------------------------------

export const partyIdentifier = pgTable(
  "party_identifier",
  {
    partyIdentifierId: uuid("party_identifier_id").defaultRandom().primaryKey(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    identifierType: identifierTypeEnum("identifier_type").notNull(),
    // normalized: PAN uppercase alphanumeric, LEI 20-char, GSTIN 15-char uppercase.
    identifierValue: text("identifier_value").notNull(),
    isPrimary: boolean("is_primary").default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
    verificationSource: text("verification_source"),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }),
    validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
    // SEBI registration category (only meaningful for identifier_type='SEBI_regn').
    regnCategory: text("regn_category"),
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
    // THE dedup enforcement point - UQ(identifier_type, identifier_value)
    // WHERE deleted_at IS NULL (§1.4, §2.3).
    dedupUnique: uniqueIndex("party_identifier_dedup_uidx")
      .on(table.identifierType, table.identifierValue)
      .where(sql`deleted_at IS NULL`),
    partyIdx: index("party_identifier_party_idx").on(table.partyId),
  }),
);

// ---------------------------------------------------------------------------
// address - structured postal address, polymorphic over party/contact (§2.23.9).
// Stored normalized (not free-text) so pg_trgm address dedup (§1.4) and GSTIN
// state-code validation work.
// ---------------------------------------------------------------------------

export const address = pgTable(
  "address",
  {
    addressId: uuid("address_id").defaultRandom().primaryKey(),
    partyId: uuid("party_id").references(() => party.partyId, {
      onDelete: "cascade",
    }),
    contactId: uuid("contact_id"),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: char("pincode", { length: 6 }),
    country: char("country", { length: 2 }).notNull(),
    type: addressTypeEnum("address_type").notNull(),
    isCurrent: boolean("is_current").default(true).notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }),
    validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
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
    // CHECK: at least one of party_id/contact_id must be set.
    principalCheck: check(
      "address_principal_check",
      sql`${table.partyId} IS NOT NULL OR ${table.contactId} IS NOT NULL`,
    ),
    partyCurrentIdx: index("address_party_current_idx")
      .on(table.partyId)
      .where(sql`is_current AND deleted_at IS NULL`),
    stateIdx: index("address_state_idx").on(table.state),
    // MIGRATION NOTE: trigram dedup index via raw SQL:
    //   CREATE INDEX address_dedup_trgm_idx ON address USING gin (line1 gin_trgm_ops, city gin_trgm_ops);
  }),
);

// ---------------------------------------------------------------------------
// party_duplicate_candidate - human-reviewed duplicate queue (§1.4).
// ---------------------------------------------------------------------------

export const partyDuplicateCandidate = pgTable(
  "party_duplicate_candidate",
  {
    duplicateCandidateId: uuid("duplicate_candidate_id").defaultRandom().primaryKey(),
    sourcePartyId: uuid("source_party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "cascade" }),
    candidatePartyId: uuid("candidate_party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "cascade" }),
    matchRule: text("match_rule").notNull(),
    matchScore: numeric("match_score", { precision: 5, scale: 4 }).notNull(),
    status: dedupStatusEnum("status").default("open").notNull(),
    evidence: jsonb("evidence"),
    createdByUserId: uuid("created_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
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
  },
  (table) => ({
    uniqueOpenPair: uniqueIndex("party_duplicate_candidate_pair_uidx")
      .on(table.sourcePartyId, table.candidatePartyId, table.matchRule)
      .where(sql`status = 'open'`),
    statusIdx: index("party_duplicate_candidate_status_idx").on(
      table.status,
      table.createdAt,
    ),
    sourceIdx: index("party_duplicate_candidate_source_idx").on(table.sourcePartyId),
    candidateIdx: index("party_duplicate_candidate_candidate_idx").on(
      table.candidatePartyId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// party_assignment_request — employee reassignment requests (super approves)
// ---------------------------------------------------------------------------

export const partyAssignmentRequest = pgTable(
  "party_assignment_request",
  {
    requestId: uuid("request_id").defaultRandom().primaryKey(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "cascade" }),
    fromUserId: uuid("from_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => appUser.userId, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => appUser.userId, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    note: text("note"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(
      () => appUser.userId,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
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
  },
  (table) => ({
    partyIdx: index("party_assignment_request_party_idx").on(table.partyId),
    toUserIdx: index("party_assignment_request_to_user_idx").on(table.toUserId),
    statusIdx: index("party_assignment_request_status_idx").on(table.status),
    openPartyUidx: uniqueIndex("party_assignment_request_open_party_uidx")
      .on(table.partyId)
      .where(sql`status = 'pending'`),
    openPairUidx: uniqueIndex("party_assignment_request_open_pair_uidx")
      .on(table.partyId, table.toUserId)
      .where(sql`status = 'pending'`),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const partyRelations = relations(party, ({ one, many }) => ({
  barrier: one(informationBarrier, {
    fields: [party.barrierId],
    references: [informationBarrier.barrierId],
  }),
  industrySegment: one(sectorCodeTable, {
    fields: [party.industrySegmentId],
    references: [sectorCodeTable.sectorCodeId],
  }),
  ultimateParent: one(party, {
    fields: [party.ultimateParentPartyId],
    references: [party.partyId],
    relationName: "partyUltimateParent",
  }),
  types: many(partyTypeAssignment),
  identifiers: many(partyIdentifier),
  addresses: many(address),
  assignedUser: one(appUser, {
    fields: [party.assignedUserId],
    references: [appUser.userId],
    relationName: "partyAssignedUser",
  }),
  dataOwner: one(appUser, {
    fields: [party.dataOwnerUserId],
    references: [appUser.userId],
    relationName: "partyDataOwner",
  }),
  createdBy: one(appUser, {
    fields: [party.createdByUserId],
    references: [appUser.userId],
    relationName: "partyCreatedBy",
  }),
  updatedBy: one(appUser, {
    fields: [party.updatedByUserId],
    references: [appUser.userId],
    relationName: "partyUpdatedBy",
  }),
}));

export const partyTypeAssignmentRelations = relations(
  partyTypeAssignment,
  ({ one }) => ({
    party: one(party, {
      fields: [partyTypeAssignment.partyId],
      references: [party.partyId],
    }),
    assignedBy: one(appUser, {
      fields: [partyTypeAssignment.assignedByUserId],
      references: [appUser.userId],
    }),
  }),
);

export const partyIdentifierRelations = relations(
  partyIdentifier,
  ({ one }) => ({
    party: one(party, {
      fields: [partyIdentifier.partyId],
      references: [party.partyId],
    }),
  }),
);

export const addressRelations = relations(address, ({ one }) => ({
  party: one(party, {
    fields: [address.partyId],
    references: [party.partyId],
  }),
}));

export const partyDuplicateCandidateRelations = relations(
  partyDuplicateCandidate,
  ({ one }) => ({
    sourceParty: one(party, {
      fields: [partyDuplicateCandidate.sourcePartyId],
      references: [party.partyId],
      relationName: "duplicateSourceParty",
    }),
    candidateParty: one(party, {
      fields: [partyDuplicateCandidate.candidatePartyId],
      references: [party.partyId],
      relationName: "duplicateCandidateParty",
    }),
    createdBy: one(appUser, {
      fields: [partyDuplicateCandidate.createdByUserId],
      references: [appUser.userId],
      relationName: "partyDuplicateCreatedBy",
    }),
    resolvedBy: one(appUser, {
      fields: [partyDuplicateCandidate.resolvedByUserId],
      references: [appUser.userId],
      relationName: "partyDuplicateResolvedBy",
    }),
  }),
);

export type Party = typeof party.$inferSelect;
export type PartyInsert = typeof party.$inferInsert;
export type PartyTypeAssignment = typeof partyTypeAssignment.$inferSelect;
export type PartyTypeAssignmentInsert = typeof partyTypeAssignment.$inferInsert;
export type PartyIdentifier = typeof partyIdentifier.$inferSelect;
export type PartyIdentifierInsert = typeof partyIdentifier.$inferInsert;
export type Address = typeof address.$inferSelect;
export type AddressInsert = typeof address.$inferInsert;
export type PartyDuplicateCandidate = typeof partyDuplicateCandidate.$inferSelect;
export type PartyDuplicateCandidateInsert = typeof partyDuplicateCandidate.$inferInsert;
