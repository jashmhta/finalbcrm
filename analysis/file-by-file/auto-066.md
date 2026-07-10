
# Batch 066

## `src/db/schema/index.ts`

- **Lines:** 41 | **Bytes:** 1964
- **Kind:** Drizzle DB schema
- **Header intent:** Drizzle schema entry point - re-exports all modules. Source of truth: /home/Jashmhta/crm/docs/DATA_MODEL.md (full domain model), /home/Jashmhta/crm/docs/CREDIT_ANALYSIS_SPEC.md §13 (ScorecardTemplate & SectorCode), and /home/Jashmhta/crm/docs/ARCHITECTURE.md §4-5 (RLS / information-barrier + immutable audit intent).  Order matters for foreign-key resolution - Drizzle resolves `references()` lambdas lazily, so cross-module FKs compile as long as every referenced table is exported through this ind
- **Security signals:** rbac/rls, india-compliance
- **Internal imports (16):** ./enums, ./rbac, ./information_barrier, ./party, ./contact, ./relationship, ./demat, ./deals, ./credit, ./modeling, ./compliance, ./interactions, ./tasks, ./documents, ./audit, ./auth
- **Domain terms:** barrier, credit_analysis, demat, party, scorecard

## `src/db/schema/information_barrier.ts`

- **Lines:** 128 | **Bytes:** 5343
- **Kind:** Drizzle DB schema; Schema tables: information_barrier
- **Header intent:** Information barrier (Chinese wall) - DATA_MODEL §1.7, §2.23.2. ARCHITECTURE §4.4-4.5: RLS policies tag rows by barrier_id on deal, party, interaction, document, credit_analysis, allocation_event. This table is the wall registry; lifting is audited and `lifted_at` null = active.
- **Exported const:** informationBarrier, informationBarrierRelations
- **Exported types:** InformationBarrier, InformationBarrierInsert
- **pgTable:** information_barrier
- **DB ops patterns:** where
- **Security signals:** rbac/rls
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (4):** ./enums, ./deals, ./party, ./rbac
- **Domain terms:** Party, barrier, credit_analysis, issuer, mandate, party

## `src/db/schema/interactions.ts`

- **Lines:** 183 | **Bytes:** 6310
- **Kind:** Drizzle DB schema; Schema tables: interaction, interaction_attendee
- **Header intent:** interactions: interaction + interaction_attendee (junction). DATA_MODEL §2.18. An interaction must anchor to at least one of a party, a deal, or a contact (CHECK num_nonnulls >= 1). MNPI interactions are walled via barrier_id (§1.7). Attendees are a junction (replacing the former attendee_contact_ids uuid[] array - §2.18).
- **Exported const:** interaction, interactionAttendee, interactionRelations, interactionAttendeeRelations
- **Exported types:** Interaction, InteractionInsert, InteractionAttendee, InteractionAttendeeInsert
- **pgTable:** interaction, interaction_attendee
- **DB ops patterns:** where
- **Security signals:** rbac/rls
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (6):** ./enums, ./rbac, ./party, ./contact, ./deals, ./information_barrier
- **Domain terms:** barrier, party

## `src/db/schema/modeling.ts`

- **Lines:** 116 | **Bytes:** 4291
- **Kind:** Drizzle DB schema; Schema tables: financial_model
- **Header intent:** financial_model - versioned, type-specific financial models (§2.17). Inputs and outputs are JSONB; the engine is pluggable but the *shape* is constrained by model_type. Per-type output schemas (bond_pricing, project_finance, securitization, dcf, m_and_a, lbo) are enforced by CHECK constraints / JSON schema at the app layer (§2.17).
- **Exported const:** financialModel, financialModelRelations
- **Exported types:** FinancialModel, FinancialModelInsert
- **pgTable:** financial_model
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (5):** ./enums, ./rbac, ./party, ./deals, ./credit
- **Domain terms:** party
