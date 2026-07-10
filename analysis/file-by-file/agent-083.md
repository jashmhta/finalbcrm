# Agent 083 — File-by-file analysis (batch-083)

Files: leads/types.ts, matching/actions.ts, matching/engine.ts, matching/queries.ts | Fully read

---

## src/features/leads/types.ts

- **Lines:** 266  
- **Role:** Lead domain types + display constants — single source of truth for funnel stages, BANT, sources, deal types, loss reasons. Pure; no I/O.

- **Exports (summary):**
  - Types: `LeadStage`, `LeadSource`, `LeadDealType`, `BantQualification`, `LeadMeta`, `BantCriterion`, `LeadLossReason`
  - Orders/labels/hints/tones/default probabilities for stages
  - Source + deal-type orders/labels/short labels
  - BANT criteria labels/hints
  - `LEAD_LOSS_REASONS` + labels
  - `isQualified(bant)`, `bantScore(bant)` (0–4)

- **Business purpose:** Lead funnel is **distinct** from deal_status execution pipeline. Won leads mint real deal rows; pre-mandate state stays in JSONB.

- **LeadMeta fields:** stage, source, dealType, estSizeCr, probability, expectedClose, assignedRm, contact*, bant, notes, lossReason, convertedDealId, closedAt, createdAt, updatedAt.

- **Coupling:** actions, queries, seed, icons, all lead UI.

---

## src/features/matching/actions.ts

- **Lines:** 231  
- **Role:** `"use server"` **sendToDeal** — primary CTA of Investor Matching Engine. Creates bond mandate + deal_party rows or links investors to existing deal.

- **Exports:** `SendToDealInput`, `SendToDealResult`, `sendToDeal(input)`.

- **Key logic:**
  - Zod: issuerId, optional existingDealId, dealName, dealType enum (bond_uw/pp_debt/dcm_advisory/hy), targetSize/tenor, investors[] with optional commitmentCrores.
  - RBAC: `create:deal`.
  - Validates issuer typed as issuer; all investors exist.
  - Best-effort find firm party `Binary Capital%` brand binarycapital as lead_manager.
  - withRls: create deal status=lead brand=binarybonds code `BC-M{4hex}` OR attach existing; issuer is_lead; skip already-present investors (UQ).
  - revalidate matching + deals paths.

- **Security:** Permission checked; target size max 100000 Cr; no barrier mandate list beyond wall GUC. Pre-checks use plain `db` outside withRls.

- **Risks:** targetSize stored as String(crores) — unit vs seed *1e7 inconsistency across features; dealType subset only; no redirect (returns dealId for client navigation).

---

## src/features/matching/engine.ts

- **Lines:** 713  
- **Role:** **Pure Investor Matching Engine — CRM USP.** Scores investors vs issuer on 7 criteria; weighted 0–100. No DB, no React; client-importable (uses ratingBands, not ratingMap, to avoid postgres/tls in client bundle).

- **Exports (major):**
  - Criterion types, CRITERIA_ORDER, labels/tags, SCORE_WEIGHTS (rating 25%, tenor 20%, sector 20%, ticket 15%, demat 10%, KYC 10%, relationship 0%)
  - `IssuerProfile`, `InvestorProfile`, `WarmIntroPath`, `CriterionResult`, `InvestorMatch`
  - `inferInvestorKind`, `rankToSymbol`, `scoreInvestor`, `rankInvestors`, `classifyWarmIntro`
  - MATCH_FILTERS, defaults for rating/tenor/ticket, `bandForScore`, SCORE_BAND_LABEL

- **Scoring rules:**
  1. **Rating:** hard gate — issuer rank ≤ investor minRatingRank (lower rank = stronger).
  2. **Tenor:** full credit inside band; partial 0.6/0.3 near edges.
  3. **Sector:** empty mandate = open (full); exact match 1; same family 0.5.
  4. **Ticket:** deal size vs typical ticket multiples (1.5/3/6×); tiny deal vs big ticket mild misfit.
  5. **Demat/KYC:** binary gates.
  6. **Relationship:** indicator only (weight 0); warm intro path separate.

- **Warm intro strength:** ≥3 touches & ≤60d = strong; ≤180d = warm; else cold/none.

- **Kind inference:** natural_person→HNI; regex bank/insur/MF/pension/AIF/FO/NBFC on names.

- **Business purpose:** Turns 150+ institutional investors + relationship graph into ranked placement shortlist for bond mandates (vs Salesforce generic CRM).

- **Risks:** Kind heuristics fragile; empty mandate always full sector credit; no hard exclusion list for prohibited sectors.

---

## src/features/matching/queries.ts

- **Lines:** 876  
- **Role:** Builds IssuerProfile/InvestorProfile from live schema (batched, no N+1), warm intros, ranking entrypoints for RSC pages.

- **Exports:**
  - `IssuerSummary`, `MatchResult`, re-exported engine types
  - `getMatchableIssuers(user?)` — issuer type + rating + primary deal
  - `getIssuerMatchProfile`, `loadInvestorProfiles`, `getWarmIntroPath`, `getWarmIntroByInvestor`
  - `getInvestorMatches(issuerId, limit?, user?)`, `getMatchMatrix` (cap 300 matches)

- **Preference derivation (from deal history):**
  - Rating floor = worst (max) rank of issuers bought; else kind default.
  - Tenor min/max from history ±1y padding; else kind default.
  - Mandate sectors = distinct issuer sectors bought (empty = open).
  - Typical ticket = median commitment; else DEFAULT 25 Cr.
  - dematReady = active demat_account; kycCurrent = latest approved + not expired + not isKycStale.
  - relationship = interaction count > 0.

- **Warm intro SQL:** CTE banker_touches + row_number by touch_count/last_touch; join app_user + users.name (app_user_id linkage).

- **Visibility:** read_all matching/party/admin or assigned/owner/created party.

- **Performance:** MATRIX_MATCH_CAP=300 avoids ~10MB SSR of full 4k investors; investorPool keeps true denominator.

- **Risks:** History-based floor uses **max rank** (worst accepted) — if investor once bought sub-IG, floor stays weak forever; no time-decay. getMatchableIssuers does multiple queries + in-memory join (OK at seed scale).

---

## Batch 083 synthesis

Matching engine is the product differentiator: pure scoring + history-derived preferences + sendToDeal CTA. Leads types complete the lead domain. Tight coupling: engine ↔ queries ↔ credit rating bands; actions ↔ deals schema.
