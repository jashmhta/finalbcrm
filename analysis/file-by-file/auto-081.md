
# Batch 081

## `src/features/integrations/whatsapp.ts`

- **Lines:** 253 | **Bytes:** 8637
- **Kind:** Application module
- **Header intent:** WhatsApp Business API adapter.  §11: OPEN via Meta Cloud API or BSPs (solution partners). Self-serve. Meta Business account + template approval; BSP if using a solution partner. Opt-in/opt-out registry required. Per-24h-conversation pricing by category (marketing/utility/authentication), India-specific rates set by Meta (TO CONFIRM). Template approval + RBI/SEBI communication-record retention rules apply.  Access to swap for real: Meta Business account + template approval; BSP optional. Opt-in/o
- **Exported functions:** buildWhatsappSample
- **Exported const:** whatsapp
- **Exported types:** WhatsappMessage, WhatsappData, WhatsappSendRequest
- **Exported classes:** WhatsappClient
- **Security signals:** auth, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **Domain terms:** Investor, allocation

## `src/features/interactions/actions.ts`

- **Lines:** 223 | **Bytes:** 7056
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createInteraction, updateInteraction
- **Exported types:** CreateInteractionState, UpdateInteractionState
- **Zod schemas:** attendeeSchema, createInteractionSchema, updateInteractionSchema
- **DB ops patterns:** insert, returning, update, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm, next/cache, next/navigation, zod/v4
- **Internal imports (3):** @/lib/rbac, @/db/context, @/db/schema
- **Domain terms:** party

## `src/features/interactions/queries.ts`

- **Lines:** 364 | **Bytes:** 10530
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side interaction data access (DATA_MODEL §2.18). An interaction anchors to ≥1 of party/deal/contact (CHECK num_nonnulls >= 1), links attendees via the interaction_attendee junction, and is walled by barrier_id when it contains MNPI. RLS-aware once policies are migrated; until then these are plain queries (the GUCs set by withRls are no-ops on tables without RLS enabled). All functions are safe to call from Server Components.
- **Exported functions:** listInteractions, getInteractionDetail, listPartyOptions, listDealOptions, listContactOptions
- **Exported types:** InteractionListItem, InteractionListFilters, InteractionListResult, InteractionAttendeeRow, InteractionDetail, PartyOption, DealOption, ContactOption
- **DB ops patterns:** from, innerJoin, leftJoin, select, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/lib/rbac, @/db/schema
- **Domain terms:** party

## `src/features/leads/actions.ts`

- **Lines:** 701 | **Bytes:** 25095
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createLead, updateBant, convertToOpportunity, updateProbability, updateExpectedClose, updateAssignedRm, winLead, loseLead, addLeadNote, deleteLead
- **Exported types:** CreateLeadState, UpdateBantState, ConvertState, FieldState, WinState, LoseState, NoteState, DeleteState
- **Zod schemas:** createSchema, bantSchema, convertSchema, probSchema, closeSchema, rmSchema, winSchema, loseSchema, noteSchema, deleteSchema
- **DB ops patterns:** from, insert, returning, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm, next/cache, next/navigation, zod/v4
- **Internal imports (7):** @/lib/rbac, @/db/context, @/db, @/db/schema, ./queries, ./types, ./types
- **Domain terms:** binarybonds, issuer, mandate, onboarding, party
