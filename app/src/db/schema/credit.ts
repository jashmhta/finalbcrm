// Credit analysis subsystem.
// DATA_MODEL §2.12-2.16, §2.20, §2.23.6-2.23.7. CREDIT_ANALYSIS_SPEC §13.
//
// Tables: sector_code, credit_analysis, financial_statement,
// credit_analysis_fs_link (junction), ratio_result, credit_score, scorecard,
// scorecard_template, external_rating, rating_ladder, exposure, credit_limit,
// kyc_record, kyc_beneficial_owner (junction).
//
// Interpretation note: DATA_MODEL §2.23.6 `scorecard` carries factor_weights
// (a template), while CREDIT_ANALYSIS_SPEC §13 distinguishes `Scorecard`
// (per-file instance: total_score, band, computed_at) from `ScorecardTemplate`
// (factor_weights, benchmark_overrides). Reconciled here as:
//   - scorecard_template = canonical template (factor_weights, benchmark_overrides,
//     obligor_type, sector_code, version, status) - satisfies DATA_MODEL §2.23.6
//     field shape AND credit spec §13 ScorecardTemplate.
//   - scorecard = per-credit-analysis instance (credit_analysis_id, template_id,
//     total_score, band, computed_at) - satisfies credit spec §13 Scorecard.
//   - credit_score.scorecard_id → scorecard (the instance), which references
//     scorecard_template. This adds a level vs DATA_MODEL §2.14 (which pointed
//     credit_score directly at the template) but keeps both tables meaningful
//     and non-redundant.

import {
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import {
  creditAnalysisTypeEnum,
  exposureTypeEnum,
  financialRatioEnum,
  fsLinkRoleEnum,
  fsSourceEnum,
  internalRatingActionEnum,
  kycRiskEnum,
  kycStatusEnum,
  kycTypeEnum,
  limitTypeEnum,
  obligorTypeEnum,
  outlookEnum,
  periodTypeEnum,
  ratingActionEnum,
  ratingAgencyEnum,
  ratingScaleEnum,
  scoreComponentEnum,
  scorecardStatusEnum,
  segmentClassEnum,
  statementTypeEnum,
  unitsEnum,
} from "./enums";

import { appUser } from "./rbac";
import { party } from "./party";
import { deal } from "./deals";
import { instrument } from "./deals";
import { informationBarrier } from "./information_barrier";
import { contact } from "./contact";
// Real value import - relations() one() accesses documentTable.documentId at runtime.
import { document as documentTable } from "./documents";

// ---------------------------------------------------------------------------
// sector_code - reference table (credit spec §13 SectorCode; consolidates the
// DATA_MODEL §2.23.11 `segment` concept). Hierarchical via parent_sector_code_id.
// ---------------------------------------------------------------------------

export const sectorCode = pgTable(
  "sector_code",
  {
    sectorCodeId: uuid("sector_code_id").defaultRandom().primaryKey(),
    // Dotted path, e.g. `infra.roads`, `nbfc.gold_loan` (§2.23.11 `code`).
    code: text("code").notNull(),
    nicCode: text("nic_code"),
    rbiSectoralDeploymentCode: text("rbi_sectoral_deployment_code"),
    label: text("label").notNull(),
    // Self-FK to sectorCode.sectorCodeId (hierarchy). Declared as a plain uuid
    // column (NOT via `references()`) to avoid TS error 7022 - a `references(() =>
    // sectorCode.sectorCodeId)` lambda is a direct self-reference in this
    // table's own initializer. This matches the pattern already used by
    // `deal.parentDealId` and `party.ultimateParentPartyId` (plain columns, FK
    // via migration). MIGRATION NOTE:
    //   ALTER TABLE sector_code
    //     ADD CONSTRAINT sector_code_parent_sector_code_id_fk
    //     FOREIGN KEY (parent_sector_code_id) REFERENCES sector_code(sector_code_id)
    //     ON DELETE SET NULL;
    parentSectorCodeId: uuid("parent_sector_code_id"),
    segmentClass: segmentClassEnum("segment_class"),
    level: integer("level").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
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
    codeUnique: uniqueIndex("sector_code_code_uidx")
      .on(table.code)
      .where(sql`deleted_at IS NULL`),
    parentIdx: index("sector_code_parent_idx").on(table.parentSectorCodeId),
  }),
);

// ---------------------------------------------------------------------------
// credit_analysis - internal credit work (§2.12). Point-in-time, version-chained
// via superseded_by. EL = PD × LGD × EAD is a PG GENERATED column (same-row).
// current_credit_score is trigger-maintained (cross-row aggregate over
// credit_score) - NOT a generated column.
// ---------------------------------------------------------------------------

export const creditAnalysis = pgTable(
  "credit_analysis",
  {
    creditAnalysisId: uuid("credit_analysis_id")
      .defaultRandom()
      .primaryKey(),
    // Nullable - can be annual surveillance on an existing issuer (§2.12).
    dealId: uuid("deal_id").references(() => deal.dealId, {
      onDelete: "set null",
    }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    obligorType: obligorTypeEnum("obligor_type").notNull(),
    analystUserId: uuid("analyst_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    reviewerUserId: uuid("reviewer_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    analysisType: creditAnalysisTypeEnum("analysis_type"),
    internalRatingShort: text("internal_rating_short"),
    internalRatingLong: text("internal_rating_long"),
    internalRatingAction: internalRatingActionEnum("internal_rating_action"),
    pd1y: numeric("pd_1y", { precision: 6, scale: 4 }),
    pd5y: numeric("pd_5y", { precision: 6, scale: 4 }),
    lgdPct: numeric("lgd_pct", { precision: 5, scale: 2 }),
    ead: numeric("ead", { precision: 18, scale: 4 }),
    // PG GENERATED column: EL = PD × LGD × EAD. Dimensionally PD (0–1) ×
    // LGD (%, ÷100) × EAD (currency) = currency. Same-row columns - valid as
    // a stored generated column (§2.12, §1.3).
    expectedLoss: numeric("expected_loss", { precision: 18, scale: 4 }).generatedAlwaysAs(
      sql`pd_1y * lgd_pct / 100.0 * ead`,
    ),
    recoveryRatePct: numeric("recovery_rate_pct", { precision: 5, scale: 2 }),
    // trigger-maintained - NOT a GENERATED column. Recomputed by an
    // AFTER INSERT/UPDATE/DELETE trigger on credit_score that sums
    // Σ component_score × component_weight across active components (§2.12).
    currentCreditScore: numeric("current_credit_score", {
      precision: 5,
      scale: 2,
    }),
    recommendation: text("recommendation"),
    watchlistFlag: boolean("watchlist_flag").default(false),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }),
    validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
    // Version chain - FK→credit_analysis (self).
    supersededBy: uuid("superseded_by"),
    // RLS: credit_analysis is barrier-tagged (§1.7, §2.23.2).
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
    partyIdx: index("credit_analysis_party_idx").on(table.partyId),
    dealIdx: index("credit_analysis_deal_idx").on(table.dealId),
    analystIdx: index("credit_analysis_analyst_idx").on(table.analystUserId),
    supersededIdx: index("credit_analysis_superseded_idx").on(
      table.supersededBy,
    ),
    barrierIdx: index("credit_analysis_barrier_idx").on(table.barrierId),
    currentIdx: index("credit_analysis_current_idx")
      .on(table.partyId, table.validTo)
      .where(sql`valid_to IS NULL AND deleted_at IS NULL`),
  }),
);

// ---------------------------------------------------------------------------
// financial_statement (§2.13). Keyed by party_id; carries no credit_analysis_id
// (the link is many-to-many via credit_analysis_fs_link - §2.12).
// ---------------------------------------------------------------------------

export const financialStatement = pgTable(
  "financial_statement",
  {
    financialStatementId: uuid("financial_statement_id")
      .defaultRandom()
      .primaryKey(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    periodType: periodTypeEnum("period_type"),
    periodEndDate: date("period_end_date").notNull(),
    periodStartDate: date("period_start_date"),
    statementType: statementTypeEnum("statement_type"),
    currencyCode: char("currency_code", { length: 3 }),
    units: unitsEnum("units"),
    source: fsSourceEnum("source"),
    isConsolidated: boolean("is_consolidated").default(false),
    auditorId: uuid("auditor_id").references(() => party.partyId, {
      onDelete: "set null",
    }),
    rawPayload: jsonb("raw_payload"),
    // Normalized line-item map keyed by crisil_lineitem_code (§2.13).
    lineItems: jsonb("line_items"),
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
    partyPeriodIdx: index("financial_statement_party_period_idx").on(
      table.partyId,
      table.periodEndDate,
    ),
    // Expression index for time-series queries (§5.2):
    //   CREATE INDEX financial_statement_year_idx ON financial_statement (date_part('year', period_end_date));
    typeIdx: index("financial_statement_type_idx").on(
      table.statementType,
      table.isConsolidated,
    ),
  }),
);

// ---------------------------------------------------------------------------
// credit_analysis_fs_link - junction (§2.12). Replaces the ERD's earlier ||--||
// (one-to-one) which was incorrect: the relationship is many-to-many.
// ---------------------------------------------------------------------------

export const creditAnalysisFsLink = pgTable(
  "credit_analysis_fs_link",
  {
    creditAnalysisId: uuid("credit_analysis_id")
      .notNull()
      .references(() => creditAnalysis.creditAnalysisId, {
        onDelete: "cascade",
      }),
    financialStatementId: uuid("financial_statement_id")
      .notNull()
      .references(() => financialStatement.financialStatementId, {
        onDelete: "cascade",
      }),
    linkRole: fsLinkRoleEnum("link_role"),
    linkedAt: timestamp("linked_at", {
      withTimezone: true,
      mode: "date",
    }).defaultNow(),
    linkedByUserId: uuid("linked_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.creditAnalysisId, table.financialStatementId],
    }),
  }),
);

// ---------------------------------------------------------------------------
// ratio_result - computed ratios keyed to a financial_statement (§2.13).
// formula_snapshot captures the formula used (formulas change over time, so
// the snapshot keeps ratio computation auditable).
// ---------------------------------------------------------------------------

export const ratioResult = pgTable(
  "ratio_result",
  {
    ratioResultId: uuid("ratio_result_id").defaultRandom().primaryKey(),
    financialStatementId: uuid("financial_statement_id")
      .notNull()
      .references(() => financialStatement.financialStatementId, {
        onDelete: "cascade",
      }),
    ratioCode: financialRatioEnum("ratio_code").notNull(),
    ratioValue: numeric("ratio_value", { precision: 14, scale: 4 }),
    formulaSnapshot: text("formula_snapshot"),
    computedAt: timestamp("computed_at", {
      withTimezone: true,
      mode: "date",
    }).defaultNow(),
  },
  (table) => ({
    statementIdx: index("ratio_result_statement_idx").on(
      table.financialStatementId,
    ),
    codeIdx: index("ratio_result_code_idx").on(table.ratioCode),
  }),
);

// ---------------------------------------------------------------------------
// scorecard_template - canonical scorecard template (DATA_MODEL §2.23.6 fields
// + credit spec §13 ScorecardTemplate). factor_weights jsonb; weights sum to
// 1.0 (CHECK enforced in app). Templated scorecards are versioned; append-only.
// ---------------------------------------------------------------------------

export const scorecardTemplate = pgTable(
  "scorecard_template",
  {
    templateId: uuid("template_id").defaultRandom().primaryKey(),
    version: integer("version").notNull(),
    obligorType: obligorTypeEnum("obligor_type").notNull(),
    // Sector-specific override (e.g., `nbfc.gold_loan`). Nullable.
    sectorCode: text("sector_code"),
    factorWeights: jsonb("factor_weights").notNull(),
    benchmarkOverrides: jsonb("benchmark_overrides"),
    approvedByUserId: uuid("approved_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    status: scorecardStatusEnum("status").notNull(),
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
    // UQ (obligor_type, sector_code, version) WHERE deleted_at IS NULL (§2.23.6).
    templateUnique: uniqueIndex("scorecard_template_uidx")
      .on(table.obligorType, table.sectorCode, table.version)
      .where(sql`deleted_at IS NULL`),
    statusIdx: index("scorecard_template_status_idx").on(table.status),
  }),
);

// ---------------------------------------------------------------------------
// scorecard - per-credit-analysis instance (credit spec §13 Scorecard).
// References scorecard_template for the factor weights/benchmarks; stores the
// rolled-up total_score and band for this analysis.
// ---------------------------------------------------------------------------

export const scorecard = pgTable(
  "scorecard",
  {
    scorecardId: uuid("scorecard_id").defaultRandom().primaryKey(),
    creditAnalysisId: uuid("credit_analysis_id")
      .notNull()
      .references(() => creditAnalysis.creditAnalysisId, {
        onDelete: "cascade",
      }),
    templateId: uuid("template_id").references(() => scorecardTemplate.templateId, {
      onDelete: "restrict",
    }),
    templateVersion: integer("template_version"),
    totalScore: numeric("total_score", { precision: 5, scale: 2 }),
    band: text("band"),
    computedAt: timestamp("computed_at", {
      withTimezone: true,
      mode: "date",
    }).defaultNow(),
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
    analysisIdx: index("scorecard_analysis_idx").on(table.creditAnalysisId),
    templateIdx: index("scorecard_template_idx").on(table.templateId),
  }),
);

// ---------------------------------------------------------------------------
// credit_score - per-component score breakdown (§2.14). weighted_score is
// generated: component_score × component_weight (same-row).
// ---------------------------------------------------------------------------

export const creditScore = pgTable(
  "credit_score",
  {
    creditScoreId: uuid("credit_score_id").defaultRandom().primaryKey(),
    creditAnalysisId: uuid("credit_analysis_id")
      .notNull()
      .references(() => creditAnalysis.creditAnalysisId, {
        onDelete: "cascade",
      }),
    scorecardId: uuid("scorecard_id").references(() => scorecard.scorecardId, {
      onDelete: "set null",
    }),
    componentCode: scoreComponentEnum("component_code").notNull(),
    componentScore: numeric("component_score", { precision: 5, scale: 2 }),
    componentWeight: numeric("component_weight", { precision: 5, scale: 2 }),
    // generated: component_score × component_weight (same-row - valid PG generated).
    weightedScore: numeric("weighted_score", { precision: 7, scale: 4 }).generatedAlwaysAs(
      sql`component_score * component_weight`,
    ),
    overrideFlag: boolean("override_flag").default(false),
    overrideReason: text("override_reason"),
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
    analysisIdx: index("credit_score_analysis_idx").on(table.creditAnalysisId),
    scorecardIdx: index("credit_score_scorecard_idx").on(table.scorecardId),
    componentIdx: index("credit_score_component_idx").on(table.componentCode),
  }),
);

// ---------------------------------------------------------------------------
// external_rating (§2.15). rating_rank is snapshotted from rating_ladder.rank
// at rating time; populated ONLY for scale='long_term' (§2.23.7 minor k).
// ---------------------------------------------------------------------------

export const externalRating = pgTable(
  "external_rating",
  {
    externalRatingId: uuid("external_rating_id").defaultRandom().primaryKey(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    // Nullable - issuer-level vs instrument-level rating (§2.15).
    instrumentId: uuid("instrument_id").references(() => instrument.instrumentId, {
      onDelete: "set null",
    }),
    agency: ratingAgencyEnum("agency").notNull(),
    ratingScale: ratingScaleEnum("rating_scale").notNull(),
    ratingValue: text("rating_value"),
    // Normalized ordinal across agencies (AAA=1 … D=18). Populated only for
    // scale='long_term' (§2.23.7 minor k).
    ratingRank: smallint("rating_rank"),
    outlook: outlookEnum("outlook"),
    ratingAction: ratingActionEnum("rating_action"),
    effectiveDate: date("effective_date").notNull(),
    withdrawnDate: date("withdrawn_date"),
    rationaleUrl: text("rationale_url"),
    // If rating obtained in support of a mandate (§2.15).
    dealId: uuid("deal_id").references(() => deal.dealId, {
      onDelete: "set null",
    }),
    isSolicited: boolean("is_solicited").default(false),
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
    partyIdx: index("external_rating_party_idx").on(table.partyId),
    instrumentIdx: index("external_rating_instrument_idx").on(table.instrumentId),
    dealIdx: index("external_rating_deal_idx").on(table.dealId),
    // Cross-agency comparability: rank is the join key.
    rankIdx: index("external_rating_rank_idx")
      .on(table.ratingRank)
      .where(sql`rating_rank IS NOT NULL`),
  }),
);

// ---------------------------------------------------------------------------
// rating_ladder - cross-agency rating rank reference (§2.23.7). Editable
// (agencies refine scales); external_rating.rating_rank is snapshotted at
// rating time so historical ratings remain comparable.
// ---------------------------------------------------------------------------

export const ratingLadder = pgTable(
  "rating_ladder",
  {
    ladderId: uuid("ladder_id").defaultRandom().primaryKey(),
    agency: ratingAgencyEnum("agency").notNull(),
    scale: ratingScaleEnum("scale").notNull(),
    symbol: text("symbol").notNull(),
    rank: smallint("rank").notNull(),
    definition: text("definition"),
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
    agencyScaleSymbolUnique: uniqueIndex("rating_ladder_uidx")
      .on(table.agency, table.scale, table.symbol)
      .where(sql`deleted_at IS NULL`),
    scaleRankIdx: index("rating_ladder_scale_rank_idx").on(table.scale, table.rank),
  }),
);

// ---------------------------------------------------------------------------
// exposure - the firm's economic exposure to a party/instrument (§2.16).
// Multi-currency: aggregation to a single group-exposure figure uses FX
// snapshot rates (§2.16).
// ---------------------------------------------------------------------------

export const exposure = pgTable(
  "exposure",
  {
    exposureId: uuid("exposure_id").defaultRandom().primaryKey(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    instrumentId: uuid("instrument_id").references(() => instrument.instrumentId, {
      onDelete: "set null",
    }),
    exposureType: exposureTypeEnum("exposure_type").notNull(),
    currencyCode: char("currency_code", { length: 3 }).default("INR").notNull(),
    grossExposure: numeric("gross_exposure", { precision: 18, scale: 4 }),
    netExposure: numeric("net_exposure", { precision: 18, scale: 4 }),
    asOfDate: date("as_of_date").notNull(),
    maturityDate: date("maturity_date"),
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
    partyDateIdx: index("exposure_party_date_idx").on(
      table.partyId,
      table.asOfDate,
    ),
    instrumentIdx: index("exposure_instrument_idx").on(table.instrumentId),
    typeIdx: index("exposure_type_idx").on(table.exposureType),
  }),
);

// ---------------------------------------------------------------------------
// credit_limit - limits set by the credit/risk desk (§2.16). Multi-currency.
// `utilized` is STORED, derived (job-maintained - recomputed by a periodic
// exposure-snapshot job, NOT a generated column). `available` is a PG
// GENERATED column (limit_amount - utilized, pure same-row arithmetic).
// ---------------------------------------------------------------------------

export const creditLimit = pgTable(
  "credit_limit",
  {
    creditLimitId: uuid("credit_limit_id").defaultRandom().primaryKey(),
    // For limit_type='group' this is the ultimate-parent party_id (§1.5, §2.16);
    // utilization is aggregated across all descendants.
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    limitType: limitTypeEnum("limit_type").notNull(),
    currencyCode: char("currency_code", { length: 3 }).default("INR").notNull(),
    limitAmount: numeric("limit_amount", { precision: 18, scale: 4 }),
    // derived (job-maintained STORED) - NOT a generated column. Recomputed by
    // a periodic exposure-snapshot job that aggregates exposure rows.
    utilized: numeric("utilized", { precision: 18, scale: 4 }).default("0"),
    // PG GENERATED column: pure same-row arithmetic (§2.16).
    available: numeric("available", { precision: 18, scale: 4 }).generatedAlwaysAs(
      sql`limit_amount - utilized`,
    ),
    utilizedAsOf: date("utilized_as_of"),
    isStale: boolean("is_stale").default(false),
    effectiveFrom: timestamp("effective_from", {
      withTimezone: true,
      mode: "date",
    }),
    effectiveTo: timestamp("effective_to", { withTimezone: true, mode: "date" }),
    approvedByUserId: uuid("approved_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    reviewDueDate: date("review_due_date"),
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
    partyTypeIdx: index("credit_limit_party_type_idx").on(
      table.partyId,
      table.limitType,
    ),
    currentIdx: index("credit_limit_current_idx")
      .on(table.partyId, table.limitType)
      .where(sql`effective_to IS NULL AND deleted_at IS NULL`),
    reviewIdx: index("credit_limit_review_idx").on(table.reviewDueDate),
  }),
);

// ---------------------------------------------------------------------------
// kyc_record (§2.20). highest_bo_ownership_pct is trigger-maintained
// (cross-row aggregate over kyc_beneficial_owner) - NOT a generated column.
// rekyc_due_date is trigger-maintained (valid_until - risk-based lead time).
// ---------------------------------------------------------------------------

export const kycRecord = pgTable(
  "kyc_record",
  {
    kycRecordId: uuid("kyc_record_id").defaultRandom().primaryKey(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.partyId, { onDelete: "restrict" }),
    // For individual KYC / beneficial owner (§2.20).
    contactId: uuid("contact_id").references(() => contact.contactId, {
      onDelete: "set null",
    }),
    kycType: kycTypeEnum("kyc_type"),
    status: kycStatusEnum("status"),
    riskRating: kycRiskEnum("risk_rating"),
    cddDoneAt: timestamp("cdd_done_at", { withTimezone: true, mode: "date" }),
    eddReason: text("edd_reason"),
    // trigger-maintained - NOT a GENERATED column (cannot aggregate over a
    // junction). Recomputed by an AFTER INSERT/UPDATE/DELETE trigger on
    // kyc_beneficial_owner (and on relationship BO-edge changes) that sets
    // highest_bo_ownership_pct = MAX(ownership_pct) over identified BOs.
    // EDD review is triggered when ≥10% (corporate) / ≥25% (trusts/partnerships).
    highestBoOwnershipPct: numeric("highest_bo_ownership_pct", {
      precision: 5,
      scale: 2,
    }),
    sourceOfFundsVerified: boolean("source_of_funds_verified").default(false),
    sourceOfWealthVerified: boolean("source_of_wealth_verified").default(false),
    approvedByUserId: uuid("approved_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    // Risk-based periodicity: low 10yr, medium 8yr, high 2yr (RBI PMLA - §2.20).
    validUntil: date("valid_until"),
    // trigger-maintained - valid_until minus a risk-based lead time. NOT a
    // generated column (lead time depends on risk_rating, not a fixed expression).
    rekycDueDate: date("rekyc_due_date"),
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
    partyIdx: index("kyc_record_party_idx").on(table.partyId),
    contactIdx: index("kyc_record_contact_idx").on(table.contactId),
    statusIdx: index("kyc_record_status_idx").on(table.status),
    rekycIdx: index("kyc_record_rekyc_idx").on(table.rekycDueDate),
  }),
);

// ---------------------------------------------------------------------------
// kyc_beneficial_owner - junction (§2.20). Replaces the former
// beneficial_owner_ids uuid[] array (which could not carry ownership % or
// provenance and could not enforce FK integrity). UQ (kyc_record_id, contact_id).
// ---------------------------------------------------------------------------

export const kycBeneficialOwner = pgTable(
  "kyc_beneficial_owner",
  {
    kycBeneficialOwnerId: uuid("kyc_beneficial_owner_id")
      .defaultRandom()
      .primaryKey(),
    kycRecordId: uuid("kyc_record_id")
      .notNull()
      .references(() => kycRecord.kycRecordId, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contact.contactId, { onDelete: "restrict" }),
    ownershipPct: numeric("ownership_pct", { precision: 5, scale: 2 }),
    declaredAt: timestamp("declared_at", { withTimezone: true, mode: "date" }),
    declarationDocumentId: uuid("declaration_document_id"),
    // Human-readable chain from obligor to BO (audit aid).
    relationshipPath: text("relationship_path"),
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
    kycContactUnique: uniqueIndex("kyc_beneficial_owner_uidx")
      .on(table.kycRecordId, table.contactId)
      .where(sql`deleted_at IS NULL`),
    kycIdx: index("kyc_beneficial_owner_kyc_idx").on(table.kycRecordId),
    contactIdx: index("kyc_beneficial_owner_contact_idx").on(table.contactId),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const sectorCodeRelations = relations(sectorCode, ({ one, many }) => ({
  parent: one(sectorCode, {
    fields: [sectorCode.parentSectorCodeId],
    references: [sectorCode.sectorCodeId],
    relationName: "sectorCodeParent",
  }),
  children: many(sectorCode, { relationName: "sectorCodeParent" }),
}));

export const creditAnalysisRelations = relations(
  creditAnalysis,
  ({ one, many }) => ({
    deal: one(deal, {
      fields: [creditAnalysis.dealId],
      references: [deal.dealId],
    }),
    party: one(party, {
      fields: [creditAnalysis.partyId],
      references: [party.partyId],
    }),
    analyst: one(appUser, {
      fields: [creditAnalysis.analystUserId],
      references: [appUser.userId],
      relationName: "creditAnalysisAnalyst",
    }),
    reviewer: one(appUser, {
      fields: [creditAnalysis.reviewerUserId],
      references: [appUser.userId],
      relationName: "creditAnalysisReviewer",
    }),
    barrier: one(informationBarrier, {
      fields: [creditAnalysis.barrierId],
      references: [informationBarrier.barrierId],
    }),
    supersededBy: one(creditAnalysis, {
      fields: [creditAnalysis.supersededBy],
      references: [creditAnalysis.creditAnalysisId],
      relationName: "creditAnalysisSuperseded",
    }),
    fsLinks: many(creditAnalysisFsLink),
    scores: many(creditScore),
    scorecards: many(scorecard),
  }),
);

export const financialStatementRelations = relations(
  financialStatement,
  ({ one, many }) => ({
    party: one(party, {
      fields: [financialStatement.partyId],
      references: [party.partyId],
    }),
    auditor: one(party, {
      fields: [financialStatement.auditorId],
      references: [party.partyId],
      relationName: "financialStatementAuditor",
    }),
    ratios: many(ratioResult),
    creditAnalysisLinks: many(creditAnalysisFsLink),
  }),
);

export const creditAnalysisFsLinkRelations = relations(
  creditAnalysisFsLink,
  ({ one }) => ({
    creditAnalysis: one(creditAnalysis, {
      fields: [creditAnalysisFsLink.creditAnalysisId],
      references: [creditAnalysis.creditAnalysisId],
    }),
    financialStatement: one(financialStatement, {
      fields: [creditAnalysisFsLink.financialStatementId],
      references: [financialStatement.financialStatementId],
    }),
    linkedBy: one(appUser, {
      fields: [creditAnalysisFsLink.linkedByUserId],
      references: [appUser.userId],
    }),
  }),
);

export const ratioResultRelations = relations(ratioResult, ({ one }) => ({
  financialStatement: one(financialStatement, {
    fields: [ratioResult.financialStatementId],
    references: [financialStatement.financialStatementId],
  }),
}));

export const scorecardTemplateRelations = relations(
  scorecardTemplate,
  ({ one, many }) => ({
    approvedBy: one(appUser, {
      fields: [scorecardTemplate.approvedByUserId],
      references: [appUser.userId],
    }),
    scorecards: many(scorecard),
  }),
);

export const scorecardRelations = relations(scorecard, ({ one, many }) => ({
  creditAnalysis: one(creditAnalysis, {
    fields: [scorecard.creditAnalysisId],
    references: [creditAnalysis.creditAnalysisId],
  }),
  template: one(scorecardTemplate, {
    fields: [scorecard.templateId],
    references: [scorecardTemplate.templateId],
  }),
  componentScores: many(creditScore),
}));

export const creditScoreRelations = relations(creditScore, ({ one }) => ({
  creditAnalysis: one(creditAnalysis, {
    fields: [creditScore.creditAnalysisId],
    references: [creditAnalysis.creditAnalysisId],
  }),
  scorecard: one(scorecard, {
    fields: [creditScore.scorecardId],
    references: [scorecard.scorecardId],
  }),
}));

export const externalRatingRelations = relations(externalRating, ({ one }) => ({
  party: one(party, {
    fields: [externalRating.partyId],
    references: [party.partyId],
  }),
  instrument: one(instrument, {
    fields: [externalRating.instrumentId],
    references: [instrument.instrumentId],
  }),
  deal: one(deal, {
    fields: [externalRating.dealId],
    references: [deal.dealId],
  }),
}));

export const ratingLadderRelations = relations(ratingLadder, () => ({}));

export const exposureRelations = relations(exposure, ({ one }) => ({
  party: one(party, {
    fields: [exposure.partyId],
    references: [party.partyId],
  }),
  instrument: one(instrument, {
    fields: [exposure.instrumentId],
    references: [instrument.instrumentId],
  }),
}));

export const creditLimitRelations = relations(creditLimit, ({ one }) => ({
  party: one(party, {
    fields: [creditLimit.partyId],
    references: [party.partyId],
  }),
  approvedBy: one(appUser, {
    fields: [creditLimit.approvedByUserId],
    references: [appUser.userId],
  }),
}));

export const kycRecordRelations = relations(kycRecord, ({ one, many }) => ({
  party: one(party, {
    fields: [kycRecord.partyId],
    references: [party.partyId],
  }),
  contact: one(contact, {
    fields: [kycRecord.contactId],
    references: [contact.contactId],
  }),
  approvedBy: one(appUser, {
    fields: [kycRecord.approvedByUserId],
    references: [appUser.userId],
  }),
  beneficialOwners: many(kycBeneficialOwner),
}));

export const kycBeneficialOwnerRelations = relations(
  kycBeneficialOwner,
  ({ one }) => ({
    kycRecord: one(kycRecord, {
      fields: [kycBeneficialOwner.kycRecordId],
      references: [kycRecord.kycRecordId],
    }),
    contact: one(contact, {
      fields: [kycBeneficialOwner.contactId],
      references: [contact.contactId],
    }),
    declarationDocument: one(documentTable, {
      fields: [kycBeneficialOwner.declarationDocumentId],
      references: [documentTable.documentId],
    }),
  }),
);

export type SectorCode = typeof sectorCode.$inferSelect;
export type SectorCodeInsert = typeof sectorCode.$inferInsert;
export type CreditAnalysis = typeof creditAnalysis.$inferSelect;
export type CreditAnalysisInsert = typeof creditAnalysis.$inferInsert;
export type FinancialStatement = typeof financialStatement.$inferSelect;
export type FinancialStatementInsert = typeof financialStatement.$inferInsert;
export type CreditAnalysisFsLink = typeof creditAnalysisFsLink.$inferSelect;
export type CreditAnalysisFsLinkInsert = typeof creditAnalysisFsLink.$inferInsert;
export type RatioResult = typeof ratioResult.$inferSelect;
export type RatioResultInsert = typeof ratioResult.$inferInsert;
export type ScorecardTemplate = typeof scorecardTemplate.$inferSelect;
export type ScorecardTemplateInsert = typeof scorecardTemplate.$inferInsert;
export type Scorecard = typeof scorecard.$inferSelect;
export type ScorecardInsert = typeof scorecard.$inferInsert;
export type CreditScore = typeof creditScore.$inferSelect;
export type CreditScoreInsert = typeof creditScore.$inferInsert;
export type ExternalRating = typeof externalRating.$inferSelect;
export type ExternalRatingInsert = typeof externalRating.$inferInsert;
export type RatingLadder = typeof ratingLadder.$inferSelect;
export type RatingLadderInsert = typeof ratingLadder.$inferInsert;
export type Exposure = typeof exposure.$inferSelect;
export type ExposureInsert = typeof exposure.$inferInsert;
export type CreditLimit = typeof creditLimit.$inferSelect;
export type CreditLimitInsert = typeof creditLimit.$inferInsert;
export type KycRecord = typeof kycRecord.$inferSelect;
export type KycRecordInsert = typeof kycRecord.$inferInsert;
export type KycBeneficialOwner = typeof kycBeneficialOwner.$inferSelect;
export type KycBeneficialOwnerInsert = typeof kycBeneficialOwner.$inferInsert;
