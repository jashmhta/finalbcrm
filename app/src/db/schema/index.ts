// Drizzle schema entry point - re-exports all modules.
// Source of truth: /home/Jashmhta/crm/docs/DATA_MODEL.md (full domain model),
// /home/Jashmhta/crm/docs/CREDIT_ANALYSIS_SPEC.md §13 (ScorecardTemplate &
// SectorCode), and /home/Jashmhta/crm/docs/ARCHITECTURE.md §4-5 (RLS /
// information-barrier + immutable audit intent).
//
// Order matters for foreign-key resolution - Drizzle resolves `references()`
// lambdas lazily, so cross-module FKs compile as long as every referenced
// table is exported through this index.
//
//   enums → rbac, information_barrier → party → contact → relationship →
//   demat → deals (instrument, deal, deal_party, allocation_event,
//   trade_event) → credit (sector_code, credit_analysis, financial_statement,
//   credit_analysis_fs_link, ratio_result, scorecard_template, scorecard,
//   credit_score, external_rating, rating_ladder, exposure, credit_limit,
//   kyc_record, kyc_beneficial_owner) → modeling → compliance → interactions →
//   tasks → documents → audit_log → auth
//
// NOTE: `auth` is exported LAST deliberately. `auth.ts` imports `appUser` from
// `./rbac`, and `rbac ↔ contact` form a mutual-FK module cycle that sits right
// at TS's circular type-inference recursion limit. Processing `auth` (which
// pulls in `rbac`) before `rbac`/`contact` changes the evaluation order enough
// to trip error 7022 on `contact`. Exporting `auth` after the rest keeps the
// original resolution order for the rbac↔contact cycle intact.

export * from "./enums";
export * from "./rbac";
export * from "./information_barrier";
export * from "./party";
export * from "./contact";
export * from "./relationship";
export * from "./demat";
export * from "./deals";
export * from "./credit";
export * from "./modeling";
export * from "./compliance";
export * from "./interactions";
export * from "./tasks";
export * from "./documents";
export * from "./notifications";
export * from "./audit";
export * from "./auth";
