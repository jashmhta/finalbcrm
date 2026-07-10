// financial_model - versioned, type-specific financial models (§2.17).
// Inputs and outputs are JSONB; the engine is pluggable but the *shape* is
// constrained by model_type. Per-type output schemas (bond_pricing,
// project_finance, securitization, dcf, m_and_a, lbo) are enforced by CHECK
// constraints / JSON schema at the app layer (§2.17).

import {
  char,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { modelTypeEnum } from "./enums";

import { appUser } from "./rbac";
import { party } from "./party";
import { deal } from "./deals";
// Real value import - relations() one() accesses creditAnalysisTable at runtime.
import { creditAnalysis as creditAnalysisTable } from "./credit";

export const financialModel = pgTable(
  "financial_model",
  {
    financialModelId: uuid("financial_model_id").defaultRandom().primaryKey(),
    // Nullable - can be standalone M&A/valuation work not tied to a deal.
    dealId: uuid("deal_id").references(() => deal.dealId, {
      onDelete: "set null",
    }),
    // The credit-analysis this model feeds (1:N - a credit analysis may have
    // multiple model versions/scenarios). Null when standalone.
    creditAnalysisId: uuid("credit_analysis_id"),
    partyId: uuid("party_id").references(() => party.partyId, {
      onDelete: "restrict",
    }),
    modelType: modelTypeEnum("model_type").notNull(),
    // Versioned, append-only (§2.17).
    version: integer("version").notNull(),
    // Self-FK: prior version.
    parentModelId: uuid("parent_model_id"),
    currencyCode: char("currency_code", { length: 3 }),
    // Input parameters, schema-validated per model_type.
    params: jsonb("params"),
    // Computed outputs, schema-validated per model_type.
    outputs: jsonb("outputs"),
    assumptionsDoc: text("assumptions_doc"),
    scenarioTag: text("scenario_tag"),
    engineVersion: text("engine_version"),
    computedAt: timestamp("computed_at", { withTimezone: true, mode: "date" }),
    computedByUserId: uuid("computed_by_user_id").references(() => appUser.userId, {
      onDelete: "set null",
    }),
    // Model approval - four-eyes (§2.17).
    approvedByUserId: uuid("approved_by_user_id").references(() => appUser.userId, {
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
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    dealIdx: index("financial_model_deal_idx").on(table.dealId),
    partyIdx: index("financial_model_party_idx").on(table.partyId),
    typeIdx: index("financial_model_type_idx").on(table.modelType),
    parentIdx: index("financial_model_parent_idx").on(table.parentModelId),
    // JSONB GIN indexes for params/outputs queries (§5.2):
    //   CREATE INDEX financial_model_params_gin_idx ON financial_model USING gin (params);
    //   CREATE INDEX financial_model_outputs_gin_idx ON financial_model USING gin (outputs);
  }),
);

export const financialModelRelations = relations(financialModel, ({ one }) => ({
  deal: one(deal, {
    fields: [financialModel.dealId],
    references: [deal.dealId],
  }),
  creditAnalysis: one(creditAnalysisTable, {
    fields: [financialModel.creditAnalysisId],
    references: [creditAnalysisTable.creditAnalysisId],
  }),
  party: one(party, {
    fields: [financialModel.partyId],
    references: [party.partyId],
  }),
  parentModel: one(financialModel, {
    fields: [financialModel.parentModelId],
    references: [financialModel.financialModelId],
    relationName: "financialModelParent",
  }),
  computedBy: one(appUser, {
    fields: [financialModel.computedByUserId],
    references: [appUser.userId],
    relationName: "financialModelComputedBy",
  }),
  approvedBy: one(appUser, {
    fields: [financialModel.approvedByUserId],
    references: [appUser.userId],
    relationName: "financialModelApprovedBy",
  }),
}));

export type FinancialModel = typeof financialModel.$inferSelect;
export type FinancialModelInsert = typeof financialModel.$inferInsert;
