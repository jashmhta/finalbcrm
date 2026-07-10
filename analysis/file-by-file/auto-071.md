
# Batch 071

## `src/features/ai/nextAction.ts`

- **Lines:** 450 | **Bytes:** 16913
- **Kind:** Application module
- **Header intent:** AI Features - Next-best-action engine (user-scoped).  For the LOGGED-IN user, surface 3-5 prioritized next actions drawn from the five coverage-desk attention surfaces: 1. Task overdue            - a task assigned to the user past its due date. 2. Deal stuck              - a deal the user leads, idle past its stage SLA. 3. Credit committee pending - a credit analysis the user owns as analyst, awaiting a committee ruling. 4. KYC expiring            - a KYC re-KYC approaching due on a party that i
- **Exported functions:** getNextActions
- **Exported types:** NextActionsResult
- **DB ops patterns:** from, select, where
- **Security signals:** india-compliance
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/db/schema, ./types
- **Domain terms:** KYC, Mandate, issuer, mandate, party

## `src/features/ai/types.ts`

- **Lines:** 200 | **Bytes:** 7689
- **Kind:** Application module
- **Header intent:** AI Features - shared types.  This module is the "no external LLM" intelligence layer of the CRM. The four engines (creditSummary, interactionSummary, clientInsights, nextAction) are deterministic heuristic / templating generators: they read STRUCTURED CRM data (credit analyses, interactions, deals, parties, KYC, tasks) and emit human-readable text + scores. Nothing here calls an external model - the "AI" is a curated rules layer that turns rows into prose a desk officer can paste into a committe
- **Exported const:** AI_PRIORITY_BADGE, AI_PRIORITY_LABEL, AI_PRIORITY_RANK, NEXT_ACTION_KIND_LABEL, INSIGHT_ACTION_LABEL
- **Exported types:** AiPriority, NextActionKind, NextAction, InsightActionKind, ClientInsight, RecentInteractionSummary, InteractionSummary, CreditSummary
- **Security signals:** india-compliance
- **Domain terms:** BC-2, KYC, credit_analysis, issuer, mandate, party, scorecard

## `src/features/calendar/queries.ts`

- **Lines:** 243 | **Bytes:** 6281
- **Kind:** Feature data-access (queries)
- **Header intent:** Calendar — unifies tasks, interactions, KYC re-KYC, and deal target dates into a single month view for desk planning. Server-only; serializable rows.
- **Exported functions:** getCalendarEvents
- **Exported types:** CalendarEventKind, CalendarEvent
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/lib/rbac, @/db/schema
- **Domain terms:** KYC, kyc, party

## `src/features/compliance/actions.ts`

- **Lines:** 872 | **Bytes:** 28624
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createKyc, transitionKycStatus, setKycRiskRating, addBeneficialOwner, captureConsent, withdrawConsent, createDsr, transitionDsrStatus
- **Exported types:** CreateKycState, TransitionKycState, SetKycRiskState, AddBoState, CaptureConsentState, WithdrawConsentState, CreateDsrState, TransitionDsrState
- **Zod schemas:** createKycSchema, transitionKycSchema, setKycRiskSchema, addBoSchema, captureConsentSchema, withdrawConsentSchema, transitionDsrSchema
- **DB ops patterns:** from, insert, returning, select, update, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm, next/cache, zod/v4
- **Internal imports (6):** @/lib/rbac, @/db/context, @/db, @/db/schema, ./kyc, ./consent
- **TODOs/FIXMEs:** .
- **Domain terms:** KYC, credit_analysis, kyc, party
