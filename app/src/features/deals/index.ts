// Deals feature barrel - re-exports the query layer + the per-deal-type
// domain-logic modules (catalog, stages, roles, allocations).
//
// The query layer (queries.ts) loads the pipeline; the domain modules encode
// the verified Binary Capital / Binary Bonds business logic (which deal types
// are appropriate, the per-type stage ladder, the per-type party roles + lead
// role, and the allocation-event semantics). Together they let deal mutation /
// validation logic enforce per-type correctness instead of the generic
// flat-enum behaviour.

export * from "./catalog";
export * from "./stages";
export * from "./roles";
export * from "./allocations";
export * from "./queries";
