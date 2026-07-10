# Agent 071 — Extreme detail analysis

Batch files: `src/features/ai/nextAction.ts`, `src/features/ai/types.ts`, `src/features/calendar/queries.ts`, `src/features/compliance/actions.ts`

User-scoped next-best actions, AI type system, calendar unifier, compliance mutations.

---

## `src/features/ai/nextAction.ts`

- **Lines:** 451 | **Role:** User-scoped next-best-action engine (distinct from firm-wide workflow engine)
- **Exports:**
  - `getNextActions(userId: string | null, opts?: { limit?: number }): Promise<NextActionsResult>`
  - `type NextActionsResult = { actions: NextAction[]; userId: string }`
- **Constants:** DEAL_STUCK_DAYS=14, COMMITTEE_IDLE_DAYS=5, KYC_DUE_WINDOW_DAYS=30, NO_INTERACTION_DAYS=45; DEAL_TERMINAL closed|dropped; TASK_DONE completed|cancelled

### Five parallel scanners (max one each, most imminent)
| Kind | Priority | Scan |
|------|----------|------|
| task_overdue | critical | assignee=user, due_date < today, status open; order due ASC |
| deal_stuck | warning | lead_user_id=user, non-terminal, updated_at < now-14d |
| credit_committee_pending | warning | analyst=user, valid_to null, superseded null, **internal_rating_action null**, updated < now-5d |
| kyc_expiring | warning | parties on user's active deals; rekyc_due in [today, today+30] |
| no_recent_interaction | info | parties on active deals; no interaction in 45d; longest cold first |

### Post-processing
- resolvePartyLabels: if entityLabel is UUID, replace with legal/display name; rewrite titles
- Sort: AI_PRIORITY_RANK then absolute |occurredAt - now|
- Cap limit default 5

- **Side effects:** Read-only multi-query
- **Security:** Scoped to userId only — caller must pass authenticated appUserId
- **Coupling:** AI hub; tasks/deals/credit/kyc/party tables
- **Risks:** Committee pending uses null rating action as proxy (may false-positive); deal href `/deals` not deal detail for stuck; kyc scan only lead_user deals not credit analyst

---

## `src/features/ai/types.ts`

- **Lines:** 201 | **Role:** Shared serializable AI DTOs + display maps
- **Exports:**
  - `AiPriority = critical|warning|info|positive`
  - `AI_PRIORITY_BADGE` → brand Badge variants down|gold|info|up
  - `AI_PRIORITY_LABEL`, `AI_PRIORITY_RANK` (0..3)
  - `NextActionKind` ×5; `NEXT_ACTION_KIND_LABEL`
  - `NextAction` interface (kind, title, description, href, priority, entityLabel, occurredAt ISO, relative)
  - `InsightActionKind` ×6 (re_engage…maintain); `INSIGHT_ACTION_LABEL`
  - `ClientInsight` full card shape
  - `RecentInteractionSummary`, `InteractionSummary`
  - `CreditSummary` (issuer/financials/assessment paragraphs + strengths/concerns + recommendation + ratingLine + generatedAt)
- **Business:** No LLM; JSON-serializable for RSC/client boundary per Next 16 rules
- **Coupling:** All AI engines + app/ai UI
- **Risks:** committee_review in InsightActionKind not currently emitted by recommendAction

---

## `src/features/calendar/queries.ts`

- **Lines:** 244 | **Role:** Month grid unifier: tasks + interactions + KYC + deal targets
- **Exports:**
  - `type CalendarEventKind = task|interaction|kyc|deal|notification`
  - `interface CalendarEvent { id, kind, title, date YYYY-MM-DD, href, severity?, meta? }`
  - `getCalendarEvents(year, month, user: CrmUser): Promise<CalendarEvent[]>`
- **Key logic:**
  - monthDateStrings: inclusive start/end date strings + UTC timestamps for interactions
  - canAll if super_admin|admin|can read_all party
  - Tasks: due in month; if !canAll filter assignee=user; limit 200; overdue → critical; high/urgent → warning
  - Interactions: occurred_at range; **no user scope filter** even for non-admin; limit 200
  - KYC: rekyc_due in month; join party; scope assigned/data_owner if !canAll; severity warning
  - Deals: target_close_date in month; scope lead_user if !canAll; limit 100
  - Sort date then title
- **Side effects:** Read-only
- **Security:** Interaction leak for limited users is a **gap**; tasks/kyc/deals scoped
- **Coupling:** calendar UI; rbac can
- **Risks:** notification kind unused; date keys use local vs ISO inconsistently (toDateKey for Date uses local Y/M/D)

---

## `src/features/compliance/actions.ts`

- **Lines:** ~850+ | **Role:** `"use server"` KYC + consent + DSR mutations under withRls
- **Exports (actions):**
  - KYC: `createKyc`, `transitionKycStatus`, `setKycRiskRating`, `addBeneficialOwner`
  - Consent: `captureConsent`, `withdrawConsent`
  - DSR: `createDsr`, `transitionDsrStatus`
  - State types for each
- **Imports:** withRls; requireUser/can; zod; kyc + consent pure helpers; schema tables + auditLog

### Pattern (ARCHITECTURE §3)
1. requireUser
2. can(action, resource) — kyc create/write, consent, dsr
3. zod parse FormData
4. withRls(userId, wall, [], tx => mutate + appendAudit)
5. revalidatePath

### KYC specifics
- createKyc: status pending; computeValidUntil(risk) + computeRekycDueDate from kyc.ts; optional contactId
- transitionKycStatus: enforces kycCanTransition state machine; on approved sets approved_by/at
- setKycRiskRating: recomputes valid_until/rekyc when risk changes
- addBeneficialOwner: inserts kyc_beneficial_owner; may escalate EDD via shouldEscalateToEdd

### Consent
- captureConsent: purpose + method + retention_until via computeConsentRetentionUntil
- withdrawConsent: sets withdrawn_at; may auto-create DSR via dsrTypeForWithdrawal (restriction vs erasure)

### DSR
- createDsr / transitionDsrStatus: canTransitionDsr; statuses received→in_review→fulfilled|rejected|cancelled

- **Side effects:** RLS txn writes + audit + revalidate `/compliance/*`
- **Security:** withRls wall tags; permission-gated; audit hash chain
- **Coupling:** kyc.ts, consent.ts, queries, compliance UI
- **Risks:** mandateIds always `[]` in withRls calls; crypto.randomUUID fallback if appUserId null weakens user_id GUC; audit throws on failure (documented intentional)
