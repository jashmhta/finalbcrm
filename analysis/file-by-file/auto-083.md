
# Batch 083

## `src/features/leads/types.ts`

- **Lines:** 265 | **Bytes:** 8517
- **Kind:** Application module
- **Header intent:** Lead & Opportunity Management - shared types + domain constants.  A lead is a prospect relationship the firm is qualifying toward a mandate. Storage: a JSONB `lead_meta` column on party (migration 0006_leads.sql). A party is a lead iff party.lead_meta IS NOT NULL. See the migration header for the full design rationale (single source of truth = party master; the JSONB blob carries the lead-specific state the frozen party schema lacks).  Domain (Indian bond house / IB): Lead        → a new contact
- **Exported functions:** isQualified, bantScore
- **Exported const:** LEAD_STAGE_ORDER, LEAD_STAGE_LABELS, LEAD_STAGE_HINTS, LEAD_STAGE_DEFAULT_PROBABILITY, LEAD_STAGE_TONE, LEAD_SOURCE_ORDER, LEAD_SOURCE_LABELS, LEAD_DEAL_TYPE_ORDER, LEAD_DEAL_TYPE_LABELS, LEAD_DEAL_TYPE_SHORT, BANT_CRITERIA, BANT_LABELS, BANT_HINTS, LEAD_LOSS_REASONS, LEAD_LOSS_REASON_LABELS
- **Exported types:** LeadStage, LeadSource, LeadDealType, BantQualification, LeadMeta, BantCriterion, LeadLossReason
- **Security signals:** india-compliance
- **Domain terms:** Bond, KYC, Mandate, Underwriting, bond, deal_status, mandate, party

## `src/features/matching/actions.ts`

- **Lines:** 230 | **Bytes:** 8224
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Header intent:** Server actions for the Investor Matching Engine.  sendToDeal - the workspace's primary CTA. Takes a selected issuer + a set of matched investors and either (a) creates a new bond-underwriting mandate with the issuer as the lead deal_party and each selected investor as an investor deal_party carrying their indicated commitment, or (b) links the investors to an existing deal (adding deal_party rows, skipping any already present). The result redirects to the deal so the coverage desk can pick up pl
- **Exported functions:** sendToDeal
- **Exported types:** SendToDealInput, SendToDealResult
- **Zod schemas:** sendToDealSchema
- **DB ops patterns:** from, insert, returning, select, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm, next/cache, zod/v4
- **Internal imports (4):** @/lib/rbac, @/db/context, @/db, @/db/schema
- **Domain terms:** Investor, Issuer, Matching, Party, binarybonds, binarycapital, bond, investor, issuer, mandate, matching, party, underwriting

## `src/features/matching/engine.ts`

- **Lines:** 712 | **Bytes:** 25683
- **Kind:** Application module
- **Header intent:** Investor Matching Engine - the USP of the Binary Capital CRM.  Given an issuer (a party with type=issuer + their latest external_rating + sector + a deal carrying tenor + target_size), score every investor (party with type=investor) against seven criteria and rank them. This is the feature that makes the CRM worth building custom vs buying Salesforce: it turns the firm's 150+ institutional-investor network + 10k+ relationship graph into a ranked, actionable placement shortlist for any bond manda
- **Exported functions:** inferInvestorKind, rankToSymbol, ratingFloorSymbol, scoreInvestor, rankInvestors, classifyWarmIntro, defaultMinRatingRank, defaultTenorRange, bandForScore
- **Exported const:** CRITERIA_ORDER, CRITERION_LABEL, CRITERION_TAG, SCORE_WEIGHTS, MATCH_FILTERS, DEFAULT_TICKET_CRORES, SCORE_BAND_LABEL
- **Exported types:** CriterionKey, InvestorKind, IssuerProfile, InvestorProfile, WarmIntroPath, WarmIntroStrength, CriterionResult, InvestorMatch, MatchFilterKey, ScoreBand
- **Security signals:** india-compliance
- **Internal imports (2):** @/features/credit/scorecard, @/features/credit/ratingBands
- **Domain terms:** Demat, Investor, Issuer, KYC, Matching, allocation, bond, demat, investor, issuer, kyc, mandate, matching, party, scorecard

## `src/features/matching/queries.ts`

- **Lines:** 875 | **Bytes:** 31024
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side data access for the Investor Matching Engine.  Builds the IssuerProfile + InvestorProfile shapes the pure engine (engine.ts) scores, by deriving investor preferences from the LIVE schema:  - rating floor  → the worst (max rank) external_rating among issuers the investor has bought via deal_party(role=investor); falls back to the kind-based default when there is no history. - tenor range   → min/max deal.target_tenor_years across the investor's deal history; kind default otherwise. - 
- **Exported functions:** getMatchableIssuers, getIssuerMatchProfile, loadInvestorProfiles, getWarmIntroPath, getWarmIntroByInvestor, getInvestorMatches, getMatchMatrix
- **Exported types:** IssuerSummary, MatchResult, MatchMatrix
- **DB ops patterns:** from, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (5):** @/db, @/db/schema, @/lib/rbac, @/features/credit/ratingMap, ./engine
- **Domain terms:** Demat, Investor, Issuer, KYC, Mandate, Matching, allocation, demat, investor, issuer, kyc, mandate, matching, party
