
# Batch 070

## `src/features/ai/clientInsights.ts`

- **Lines:** 455 | **Bytes:** 16472
- **Kind:** Application module
- **Header intent:** AI Features - Client insights engine.  For each party (counterparty / client), derive: - Relationship strength score (0..100): interaction volume (recency- weighted) + deal footprint + contact breadth. - Deal potential score (0..100): active mandate count + target size + interaction recency (a warmed-up relationship converts better). - Recommended next action (re-engage / advance mandate / committee / refresh KYC / deepen coverage / maintain), with a one-line rationale.  Deterministic heuristic 
- **Exported functions:** relationshipStrengthScore, dealPotentialScore, recommendAction, getClientInsights
- **Exported types:** ActionInput
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (4):** @/db, @/db/schema, @/lib/rbac-core, ./types
- **Domain terms:** KYC, bond, issuer, mandate, party

## `src/features/ai/creditSummary.ts`

- **Lines:** 748 | **Bytes:** 29278
- **Kind:** Application module
- **Header intent:** AI Features - Credit summary generator.  Given a credit_analysis + the latest period's ratios + the scorecard (band / score / PD), generate a three-paragraph credit memo summary: 1. Issuer description       - who the obligor is, sector, listing, domicile. 2. Financial highlights     - leverage / coverage / liquidity / profitability (or asset quality / capital for NBFCs & banks), with a trend line when a prior period exists. 3. Credit assessment        - internal band, score, indicative 1-yr PD, 
- **Exported functions:** generateCreditSummary, getCreditSummary
- **Exported types:** CreditSummaryRatios, CreditSummaryExternalRating, CreditSummaryInput
- **DB ops patterns:** from, select, where
- **External deps:** drizzle-orm
- **Internal imports (6):** @/db, @/db/schema, @/features/credit/queries, @/features/credit/scorecard, @/features/credit/ratios, ./types
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6, Issuer, bond, credit_analysis, issuer, mandate, party, scorecard

## `src/features/ai/index.ts`

- **Lines:** 58 | **Bytes:** 1774
- **Kind:** Application module
- **Header intent:** AI Features barrel - the "no external LLM" intelligence layer.  Four deterministic engines generate text + scores from structured CRM data: - creditSummary    : credit_analysis + ratios + scorecard → 3-paragraph memo. - interactionSummary: interaction notes → overview + key topics + action items. - clientInsights   : per-party relationship strength / deal potential / next action. - nextAction       : user-scoped 3-5 prioritised next-best-actions.  Server actions live in ./actions and should be i
- **Security signals:** india-compliance
- **Internal imports (5):** ./creditSummary, ./interactionSummary, ./clientInsights, ./nextAction, ./types
- **Domain terms:** credit_analysis, party, scorecard

## `src/features/ai/interactionSummary.ts`

- **Lines:** 493 | **Bytes:** 18009
- **Kind:** Application module
- **Header intent:** AI Features - Interaction summary generator.  Given a set of interaction notes (subject + body + channel + next_action), generate a summary with: - a 1-2 sentence overview, - 3-6 key topics (ranked by mention frequency across a domain vocabulary), - action items (extracted from next_action fields + imperative sentences in the body), - supporting counts (interaction count, channels, last interaction date).  Deterministic heuristic - no external LLM. The topic vocabulary is the Indian bond house /
- **Exported functions:** summarizeInteractions, summarizeOneInteraction, getInteractionSummary, getRecentInteractionSummaries
- **Exported types:** InteractionNote, InteractionSummaryInput
- **DB ops patterns:** from, leftJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (4):** @/db, @/db/schema, @/lib/rbac-core, ./types
- **Domain terms:** Allocation, Investor, KYC, Mandate, Underwriting, allocation, bond, demat, investor, kyc, mandate, onboarding, party, underwriting
