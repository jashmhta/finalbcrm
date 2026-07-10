# Agent 070 — Extreme detail analysis

Batch files: `src/features/ai/clientInsights.ts`, `src/features/ai/creditSummary.ts`, `src/features/ai/index.ts`, `src/features/ai/interactionSummary.ts`

Core “no external LLM” intelligence engines for relationship scoring, credit memos, and interaction digests.

---

## `src/features/ai/clientInsights.ts`

- **Lines:** 456 | **Role:** Per-party relationship strength + deal potential + recommended action
- **Exports:**
  - `relationshipStrengthScore(weightedInteractions, dealCount, contactCount): number` (0–100)
  - `dealPotentialScore(activeDealCount, totalTargetSizeCr, daysSinceLastInteraction): number`
  - `recommendAction(input: ActionInput): { kind: InsightActionKind; rationale: string }`
  - `getClientInsights({ limit=8, minInteractions=1, user? }): Promise<ClientInsight[]>`
  - `type ActionInput`
- **Imports:** drizzle; db; deal, dealParty, interaction, kycRecord, party, partyContact; can from rbac-core; types

### Scoring formulas
**Relationship strength (0–100):**
- interactionPts = clamp((weightedInteractions / 20) * 50, 0, 50)
- dealPts = clamp((dealCount / 5) * 30, 0, 30)
- contactPts = clamp((contactCount / 4) * 20, 0, 20)
- Bands: ≥70 Strong, ≥45 Established, ≥20 Developing, else At risk

**Deal potential (0–100):**
- countPts = clamp((activeDealCount / 4) * 40, 0, 40)
- sizePts = log10(totalTargetSizeCr+1)*14 capped 40 (₹1Cr~8, ₹100Cr~16, ₹500Cr~40)
- recencyPts: ≤14d → 20; ≥90d → 0; linear decay between
- Bands: ≥60 Hot, ≥35 Active, ≥15 Prospect, else Dormant

**Interaction recency weight SQL:**
```
CASE WHEN occurred_at >= now()-90d THEN 1.0
     WHEN >= now()-180d THEN 0.5
     ELSE 0.2 END
```

**recommendAction priority ladder:**
1. KYC re-KYC due within 30 days → `refresh_kyc`
2. Active mandate + last touch >21d or never → `advance_mandate`
3. No mandate + cold >60d → `re_engage`
4. strength≥70 + ≥2 active deals + touch ≤30d → `deepen_coverage`
5. else `maintain`

### Data pipeline
Four GROUP BY queries (interactions, deals via deal_party, kyc rekyc window, current party_contacts) joined in JS by partyId; candidates = ≥minInteractions OR active deals; batch party names with **clientInsightPartyScope** for non-admin (assigned/data_owner/created_by OR staffed on deal as lead/credit_analyst/creator)

- **Side effects:** Read aggregates
- **Security:** Admin/super_admin/read_all ai_insight|party|manage user → full book; else scoped
- **Coupling:** AI hub UI, party pages
- **Risks:** Interaction query not party-scoped before join (loads firm-wide aggs then filters names — can over-fetch); deal target_size /1e7 assumes INR absolute units

---

## `src/features/ai/creditSummary.ts`

- **Lines:** 749 | **Role:** Deterministic 3-paragraph credit memo generator + server loader
- **Exports:**
  - Types: `CreditSummaryRatios`, `CreditSummaryExternalRating`, `CreditSummaryInput`
  - `generateCreditSummary(input): CreditSummary` — **pure**, no @/db in runtime path for pure function
  - `getCreditSummary(creditAnalysisId, user?): Promise<CreditSummary | null>` — server loader
  - `BAND_PD_RANGE` display map
- **Imports:** getCreditAnalysisDetail; computeScorecard, BAND_GRADE, BAND_PD_1Y, bandFromScore; computeRatios; exposure/sector queries

### Committee recommendation rules (`deriveRecommendation`)
| Condition | Recommendation | Priority |
|-----------|----------------|----------|
| No score/band | Pending scorecard | info |
| watchlist OR downgrade OR watch_negative | Watchlist with enhanced security | warning |
| BC-1..BC-3 | Approve standard docs/pricing | positive |
| BC-4 | Approve with conditions | info |
| BC-5 | Decline new exposure (HY only) | warning |
| BC-6 | Decline / plan exit | critical |

### Strength thresholds (examples)
- Interest coverage ≥4x; Debt/EBITDA ≤3; current ≥1.3; EBITDA margin ≥15%; ROCE ≥12%; DSCR ≥1.3; CRAR ≥15%; GNPA ≤3%; IG external rating

### Concern thresholds
- IC <1.5; D/EBITDA >5; current <1; margin <8%; DSCR <1.1; GNPA >5%; CRAR <12%; BC-5/6 bands; watchlist; sub-IG external

### Paragraph builders
1. Issuer: name is {corporate|SPV|…} + sector + listed + domicile + analysis type
2. Financials: FI path (GNPA/NNPA/CRAR/NIM) vs corporate (D/EBITDA, IC, current, margin, ROCE, DSCR) + prior-period trend phrases
3. Assessment: band + score + PD + external ratings + gross exposure ₹Cr + recommendation text

### getCreditSummary pipeline
1. getCreditAnalysisDetail (scoped)
2. Live scorecard from latestRatioSet
3. resolveBand: live → persisted → internalRatingShort if valid BC
4. Prior period = second-to-last FS with computeRatios
5. sumGrossExposureCr: sum exposure.gross / 1e7
6. generateCreditSummary

- **Side effects:** DB reads
- **Security:** inherits credit detail visibility
- **Coupling:** features/credit/* heavy
- **Risks:** Typo `isFinanicalInstitution`; IG external rating heuristic is symbol-prefix only; BAND_PD_RANGE vs BAND_PD_1Y dual sources

---

## `src/features/ai/index.ts`

- **Lines:** 59 | **Role:** AI feature barrel (excludes actions intentionally)
- **Exports:** creditSummary, interactionSummary, clientInsights, nextAction pure/server APIs + all types maps
- **Business:** Keep server actions out so tests/non-Next can import pure generators without action bundling
- **Coupling:** Four engines + types

---

## `src/features/ai/interactionSummary.ts`

- **Lines:** 494 | **Role:** Topic + action extraction from interaction notes
- **Exports:**
  - Types: `InteractionNote`, `InteractionSummaryInput`
  - `summarizeInteractions(input): InteractionSummary` pure
  - `summarizeOneInteraction(n): { topic, actionItem }` pure
  - `getInteractionSummary(scope, limit=25, user?)`
  - `getRecentInteractionSummaries(limit=6, user?)`
- **Imports:** db; contact, deal, interaction, party; can rbac-core

### Domain TOPIC_DEFS (15 topics with regex)
Credit rating, Underwriting, Pricing & coupon, Allocation & settlement, KYC & onboarding, Mandate & term sheet, Tenor & structure, Due diligence, Investor outreach, Credit committee, Refinancing, M&A/ECM, Project finance, Supply chain finance, Compliance & consent

### Action extraction
- Prefer `next_action` field
- Else first sentence matching IMPERATIVE_RE (follow up, schedule, send, chase, escalate, …)
- Cap 160/140 chars; max 6 items; de-dupe normalized

### RBAC scoping
- canReadAll: admin/super_admin/read_all interaction|party|manage user
- Else: interaction.userId OR party assigned/owner/creator OR deal lead/credit/creator OR EXISTS party_contact path for contact-scoped notes

### Overview template
`"The recent history for {scopeLabel} covers N interactions across channels. Dominant themes: …"`

- **Side effects:** DB reads with leftJoin party/deal
- **Security:** Scoped loaders; empty scope returns soft empty overview
- **Coupling:** AI hub recent rail; fetchInteractionSummary action
- **Risks:** Global IMPERATIVE_RE lastIndex reset; getRecent defaults href `/deals` without deal id path
