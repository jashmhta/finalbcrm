# File-by-file analysis — batch 010 (agent-010)

**Batch list:** `/home/Jashmhta/crm/bc-crm/analysis/file-by-file/batch-010.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files in batch:** 4 Vitest unit suites under `src/__tests__/`. All are hermetic pure-logic tests (no DB, no React, no network). Docs ignored per instructions.

---

## 1. `src/__tests__/maModel.test.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/__tests__/maModel.test.ts` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/__tests__/maModel.test.ts` |
| **Lines** | 201 |
| **Role** | Vitest unit suite pinning real-IB financial invariants of the M&A modeling engine |
| **Framework** | `vitest` (`describe` / `expect` / `it`) |
| **Source of truth** | `src/features/modeling/maModel.ts` |

### Exports

None. Test module only (no `export`).

### Imports

```ts
import { describe, expect, it } from "vitest";

import {
  computeMaModel,
  computeSourcesAndUses,
  computeGoodwill,
  computeAccretionDilution,
  computeDealIrr,
  maDefaults,
  type MaInputs,
} from "@/features/modeling/maModel";
```

**Imported production symbols (signatures / types exercised):**

- `type MaInputs` — `{ acquirer: MaAcquirerInputs; target: MaTargetInputs; deal: MaDealInputs }`
- `computeSourcesAndUses(inputs: MaInputs): MaSourcesAndUses`  
  Asserted fields: `totalSources`, `totalUses`, `acquirerCashUsed`, `fundingShortfall`
- `computeGoodwill(inputs: MaInputs): MaGoodwill`  
  Asserted: `goodwill`, `nonControllingInterest`, `bargainPurchase`
- `computeAccretionDilution(inputs: MaInputs): MaAccretionDilution`  
  Asserted: `standaloneEps`, `newSharesIssued`, `proFormaShares`, `proFormaNetIncome`, `accretionPct`, `accretive`
- `computeDealIrr(inputs: MaInputs): MaDealIrr`  
  Asserted: `totalDeployed`, `exitEquity`, `exitEv`, `irr`
- `computeMaModel(inputs: MaInputs): MaResult` — integration path
- `maDefaults(): MaInputs` — default fixture

**Not imported / not covered:** format helpers (`cr`, `inrAbs`, `pctFmt`, `epsFmt`), private `irr` bisection, detailed `sources`/`uses` line items, `combinedMarketCap`, `impliedEv` content.

### Business purpose

Guarantees M&A deal modeling math used by Binary CRM’s modeling feature stays consistent with investment-banking conventions:

1. **Sources & Uses balance** — the acquirer cash plug balances so total sources = total uses.
2. **IFRS 3 / Ind AS 103 goodwill** — goodwill = consideration − identifiable net assets; negative goodwill = bargain purchase.
3. **Accretion / dilution** — cash vs stock share issuance; pro-forma NI = acquirer NI + target NI − after-tax interest + after-tax synergies; EPS accretion sign.
4. **Deal IRR** — year-0 capital deployed (price + refinance + fees + integration); exit equity treatment when debt is refinanced vs assumed; higher exit multiple ⇒ higher IRR.

The suite deliberately pins **invariants and sign/ordering**, not float bit-exactness (uses `toBeCloseTo`).

### Key logic & fixtures

**Canonical `base(): MaInputs` fixture** (lines 18–54):

| Nested object | Notable values |
|---------------|----------------|
| `acquirer` | revenue `4.2e9`, ebitdaMargin `0.22`, NI `520e6`, shares `65e6`, price `340`, debt `1.8e9`, cash `900e6`, taxRate `0.2517` |
| `target` | revenue `1.5e9`, EBITDA `240e6`, NI `150e6`, FCF `130e6`, debt `500e6`, cash `120e6`, identifiableNetAssetsFV `1.05e9` |
| `deal` | equityPurchasePrice `1.4e9`, refinanceTargetDebt `true`, targetCashAcquired `true`, advisoryFeePct `0.012`, financingFeePct `0.015`, integrationCost `60e6`, newDebt `700e6`, newDebtCost `0.095`, stockConsideration `0`, runRateSynergies `90e6`, synergyPhaseInYears `2`, synergyRealizationPct `0.8`, holdPeriodYears `5`, exitEvEbitda `9` |

**Describe blocks / cases:**

| Block | Cases | Assertions (summary) |
|-------|-------|----------------------|
| `computeSourcesAndUses - balance & funding` | 4 | S=U; refinance adds target debt to uses (+500e6); target cash reduces acquirer cash plug; shortfall when cash thin + no new debt/stock |
| `computeGoodwill - IFRS 3 acquisition method` | 2 | GW = 1.4e9 − 1.05e9; NCI=0; bargain when price 900e6 |
| `computeAccretionDilution - EPS mechanics` | 6 | standalone EPS; cash issues 0 shares; stock issues `stock/price`; PF NI formula; richer synergies more accretive; overpaid cash deal dilutive |
| `computeDealIrr - acquirer deal return` | 4 | totalDeployed formula; exit equity higher when refinanced; exit multiple ↑ ⇒ IRR ↑; sensible deal IRR ∈ (0, 1) |
| `computeMaModel - integration` | 1 | defaults: S=U, finite IRR, finite accretionPct, notes non-empty |

**Pinned arithmetic examples:**

```text
afterTaxInt = 700e6 * 0.095 * (1 - 0.2517)
afterTaxSyn = 90e6 * 0.8 * (1 - 0.2517)
proFormaNI  = 520e6 + 150e6 - afterTaxInt + afterTaxSyn

totalDeployed (refi=true) =
  equityPurchasePrice + targetDebt + advisoryFee*price + financingFee*newDebt + integration
  = 1.4e9 + 500e6 + 0.012*1.4e9 + 0.015*700e6 + 60e6
```

### Side effects

- **None at runtime of SUT** — pure functions under test.
- **Test side effects:** none (no mocks, no filesystem, no DB). Vitest process only.

### Security / RBAC

- Not applicable. No auth, no tenancy, no user input sanitization.
- Fixture numbers are synthetic corporate-scale INR-scale aggregates; no secrets.

### Coupling

| Direction | Dependency |
|-----------|------------|
| **Hard** | `@/features/modeling/maModel` — every assertion is a regression pin on that module’s formulas |
| **Soft** | Spec comments (“real-IB invariants”, IFRS 3) — documentation only |
| **None** | DB schema, React, API routes |

Breakage of `MaInputs` shape, fee formulas, tax treatment, or IRR solver bracket will fail this suite.

### Risks / TODOs / gaps

1. **Mixed consideration paths lightly covered** — stock deal tested for share count only; mixed cash+stock S&U composition not enumerated item-by-item.
2. **Synergy phase-in** (`synergyPhaseInYears`) not varied; IRR/accretion use full run-rate × realization.
3. **NCI always 0** — 100% acquisition only; partial acquisitions untested.
4. **IRR null path** (no sign change in cash flows) not asserted.
5. **Format helpers** (`cr`, `pctFmt`, etc.) untested.
6. **Floating-point tolerances** vary (`4`–`8` decimal places); still acceptable for financial float.
7. No TODO/FIXME comments in file.

---

## 2. `src/__tests__/matching.test.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/__tests__/matching.test.ts` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/__tests__/matching.test.ts` |
| **Lines** | 676 |
| **Role** | Exhaustive Vitest suite for the Investor Matching Engine (CRM USP scoring + ranking) |
| **Framework** | `vitest` |
| **Source of truth** | `src/features/matching/engine.ts` (comments also reference `scrape/BUSINESS_CONTEXT.md §3`) |

### Exports

None. Test module only.

### Imports

```ts
import { describe, expect, it } from "vitest";

import {
  scoreInvestor,
  rankInvestors,
  classifyWarmIntro,
  inferInvestorKind,
  defaultMinRatingRank,
  defaultTenorRange,
  bandForScore,
  SCORE_WEIGHTS,
  CRITERIA_ORDER,
  MATCH_FILTERS,
  DEFAULT_TICKET_CRORES,
  SCORE_BAND_LABEL,
  type IssuerProfile,
  type InvestorProfile,
  type WarmIntroPath,
  type CriterionKey,
  type InvestorKind,
} from "@/features/matching/engine";
```

**Imported production API (quoted shapes / signatures):**

- `CriterionKey = "rating" | "tenor" | "sector" | "ticket" | "demat" | "kyc" | "relationship"`
- `SCORE_WEIGHTS: Record<CriterionKey, number>` — rating 0.25, tenor 0.2, sector 0.2, ticket 0.15, demat 0.1, kyc 0.1, relationship 0
- `CRITERIA_ORDER: CriterionKey[]` — length 7, relationship last
- `InvestorKind` — `"Bank" | "Insurer" | "Mutual Fund" | "Pension Fund" | "AIF" | "Family Office" | "HNI" | "NBFC" | "Corporate" | "Unknown"`
- `scoreInvestor(issuer, inv, warmIntro | null)` → match with `score`, `criteria[]`, `matchCount`, `warmIntro`
- `rankInvestors(issuer, investors[], warmMap)` → ordered matches
- `classifyWarmIntro({ interactionCount, lastTouchAt }) → WarmIntroStrength`
- `inferInvestorKind({ legalName, displayName, partyNature }) → InvestorKind`
- `defaultMinRatingRank(kind: InvestorKind): number`
- `defaultTenorRange(kind: InvestorKind): [number, number]`
- `bandForScore(score: number): ScoreBand` — `"excellent" | "strong" | "viable" | "weak"`
- `MATCH_FILTERS` — keys `"demat" | "kyc" | "relationship" | "warm"` with `.test(match)`
- `DEFAULT_TICKET_CRORES` (const, expected positive; production value `25`)
- `SCORE_BAND_LABEL: Record<ScoreBand, string>`

**Not imported:** `CRITERION_LABEL`, `CRITERION_TAG`, `rankToSymbol`, `ratingFloorSymbol`, individual private scorers (exercised only via `scoreInvestor`).

### Business purpose

Locks the pure scoring/ranking USP used to match bond investors to issuer deals:

1. Six weighted criteria sum to 100%; relationship is indicator-only (weight 0).
2. Per-criterion gates and partial credit (rating, tenor band, sector exact/family/open, ticket tiers, demat/KYC binary).
3. Rank order: score ↓ → matchCount ↓ → warm-intro strength.
4. Warm-intro strength from interaction count + recency windows (60d / 180d).
5. Kind inference from legal/display name + party nature; kind-derived rating floors and tenor bands for history-less accounts.
6. Score bands for UI and workspace filter predicates.

### Key logic & fixtures

**`baseIssuer(over?): IssuerProfile`** — AAA / BC-1, CRISIL, sector `infra.roads` / family `infra`, tenor 5y, target 100 Cr, deal `bond_underwriting` / `pricing`.

**`baseInvestor(over?): InvestorProfile`** — Bank, minRatingRank 10 (BBB−), tenor 2–10, mandate `infra.roads`, ticket 100 Cr, demat+KYC ready, has relationship.

**`warmIntro(over?): WarmIntroPath`** — banker `b1@binarycapital.in`, strength `"warm"`, recent touch.

**Coverage matrix (describe groups):**

| Group | What is pinned |
|-------|----------------|
| `SCORE_WEIGHTS - distribution` | Six scored sum ≈ 1.0; relationship 0; exact weight table; CRITERIA_ORDER length/uniqueness/last |
| `scoreInvestor - perfect fit` | score 100; all criteria matched score 1; matchCount 7; warm path carried |
| `scoreInvestor - all-fail` | score 0; rating/demat/kyc/sector/ticket/tenor fail; matchCount 0 |
| `scoreInvestor - partial credit` | tenor 0.6/0.3/0; sector family 0.5; open mandate 1; ticket 1 / 0.6 / 0.3 / 0 / tiny-deal cap 0.5 |
| `scoreInvestor - unrated / missing` | null rating/tenor/size/sector → score 0 on those criteria |
| `scoreInvestor - score bounded` | always ∈ [0, 100] |
| `rankInvestors - score desc` | higher score first |
| `rankInvestors - matchCount tie-break` | relationship lifts matchCount without changing base score |
| `rankInvestors - warm-intro strength` | strong > warm > cold > none |
| `classifyWarmIntro` | 0 → none; ≥3 & ≤60d → strong; 2 recent or 60–180d → warm; >180d or null/invalid date → cold |
| `inferInvestorKind` | Bank/Insurer/MF/Pension/AIF/FO/NBFC/HNI/Unknown; natural_person → HNI; displayName searched |
| `defaultMinRatingRank` | Bank 4, Insurer 3, Pension 4, AIF/HNI 10, FO 9, Unknown 9 |
| `defaultTenorRange` | Bank [3,10], Insurer [7,20], Pension [10,30], Corporate [1,3]; all kinds min≤max, min>0 |
| `bandForScore` | ≥85 excellent, ≥65 strong, ≥40 viable, else weak |
| `MATCH_FILTERS` | demat/kyc/relationship/warm predicates |
| `DEFAULT_TICKET_CRORES` | positive finite |

**Partial-credit thresholds documented in tests:**

| Criterion | Rule encoded by tests |
|-----------|------------------------|
| Tenor below min | ratio ≥0.75 → 0.6 matched; ≥0.5 → 0.3 unmatched; &lt;0.5 → 0 |
| Tenor above max | ratio = max/tenor; same bands |
| Sector | exact full; same family 0.5; empty mandate full; unrelated 0 |
| Ticket vs typical | ≤1.5× → 1; ≤3× → 0.6; ≤6× → 0.3 unmatched; &gt;6× → 0; size &lt; 0.1× ticket caps at 0.5 |

### Side effects

- **SUT pure** — no DB/React.
- **Time-dependent:** `classifyWarmIntro` and `warmIntro()` use `Date.now()` / `new Date()`. Tests use relative day offsets; flaky only if system clock jumps wildly during a run (not a practical issue). Boundary at exactly 60 days is sensitive to ms precision.

### Security / RBAC

- No auth. Fixture emails (`b1@binarycapital.in`) are fake.
- Matching engine outputs drive commercial prioritization; wrong weights/gates are a **business integrity** risk more than a security one.
- Kind inference is name-heuristic — misclassification risk is product risk, documented by tests.

### Coupling

| Direction | Dependency |
|-----------|------------|
| **Hard** | `@/features/matching/engine` constants, scorers, rank comparator, filters |
| **Conceptual** | Credit rating ranks (1=AAA … higher = weaker) align with `ratingMap` / matching issuer `ratingRank` |
| **None** | DB loaders that build `IssuerProfile` / `InvestorProfile` (those live elsewhere) |

Any change to weights, partial-credit ladders, band cutoffs, kind maps, or sort keys will break this suite by design.

### Risks / TODOs / gaps

1. **No multi-sector mandate partial match** beyond exact + family (e.g. multiple unrelated codes).
2. **`Corporate` kind** covered for tenor range but not heavily for kind inference names.
3. **Mutual Fund / NBFC defaultMinRatingRank** not individually asserted (only Bank/Insurer/Pension/AIF/HNI/FO/Unknown).
4. **`preferenceSource`** on investor profile never varied.
5. **Rank stability** for total ties (same score, matchCount, strength) unspecified.
6. Warm-intro **60-day boundary** uses `Date.now()` arithmetic; theoretically flaky at exact boundary under clock skew.
7. No TODO/FIXME in file; header is the coverage contract.

---

## 3. `src/__tests__/ratingMap.test.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/__tests__/ratingMap.test.ts` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/__tests__/ratingMap.test.ts` |
| **Lines** | 325 |
| **Role** | Hermetic unit tests for static (no-DB) rating-agency scale mapping |
| **Framework** | `vitest` |
| **Source of truth** | `src/features/credit/ratingMap.ts` (CREDIT_ANALYSIS_SPEC §5; re-exports from `ratingBands`) |

### Exports

None. Test module only.

### Imports

```ts
import { describe, expect, it } from "vitest";

import {
  coreSymbolToRank,
  symbolToBand,
  rankToBand,
  bandToCanonicalRank,
  bandToAgencySymbol,
  agencySymbolToRank,
  AGENCIES,
  BAND_PD_RANGE,
  type RatingAgency,
} from "@/features/credit/ratingMap";
```

**Imported production API:**

| Symbol | Role under test |
|--------|-----------------|
| `coreSymbolToRank(core: string): number \| null` | Cross-agency ordinal ladder (AAA=1 … D=18 in core path) |
| `symbolToBand(agency: RatingAgency, symbol: string \| null \| undefined): Band \| null` | Agency symbol → internal `BC-1`…`BC-6` |
| `rankToBand(rank: number \| null): Band \| null` | Ordinal → band |
| `bandToCanonicalRank(band: Band): number` | Band midpoint rank |
| `bandToAgencySymbol(band, agency): string` | Band → display symbol (with IND/BWR prefixes) |
| `agencySymbolToRank(agency, symbol): number \| null` | Spec-correct agency-aware ranks (1–19 path for sub-IG) |
| `AGENCIES: { code, label, woundDown?, ... }[]` | Seven Indian CRAs |
| `BAND_PD_RANGE: Record<Band, string>` | Indicative 1-yr PD range strings |
| `type RatingAgency` | Agency code union |

**Explicitly out of scope (commented):** async DB loaders `loadLadder`, `resolveBand`, `resolveRung`, `resetLadderCache`; short-term scale via `rating_ladder` table.

### Business purpose

Binary Capital credit analysis normalizes seven Indian CRAs onto:

1. A **core ordinal ladder** (ranks for scoring/matching).
2. An internal **BC-1 … BC-6 band** scale with PD ranges.
3. **Agency-aware sub-IG taxonomies** (India Ratings CCC/CC/C/D vs CRISIL single C + D) so grades are not wrongly collapsed (CREDIT_ANALYSIS_SPEC §5 note 4).

This suite is the hermetic pin for pure mapping so matching (`ratingRank`) and credit UI stay consistent without hitting Postgres.

### Key logic & fixtures

**Seven agencies (looped in cross-agency tests):**

```ts
"CRISIL" | "ICRA" | "CARE" | "India_Ratings" | "Acuite" | "Infomerics" | "Brickwork"
```

**Core ladder pins:**

| Symbol | Expected rank (`coreSymbolToRank`) |
|--------|-------------------------------------|
| AAA | 1 |
| AA+ / AA / AA- | 2 / 3 / 4 |
| D | 18 |
| `IND AA+`, `BWR BBB` | prefix-stripped (2, 9) |
| ZZZ | null |

**Band mapping (CRISIL examples):**

| Symbol | Band |
|--------|------|
| AAA | BC-1 |
| AA | BC-2 |
| A | BC-3 |
| BBB | BC-4 (IG floor) |
| BB | BC-5 |
| D | BC-6 |

**Canonical ranks per band:**

| Band | `bandToCanonicalRank` |
|------|------------------------|
| BC-1 | 1 |
| BC-2 | 3 |
| BC-3 | 6 |
| BC-4 | 9 |
| BC-5 | 12 |
| BC-6 | 15 |

**`agencySymbolToRank` IG equivalence (all 7 agencies):** AAA→1, AA→3, BBB→9, BB→12, B→15.

**Sub-IG agency differences:**

| Agency | Symbols → ranks |
|--------|-----------------|
| India Ratings | IND CCC→16, IND CC→17, IND C→18, IND D→19; C ≠ CCC |
| CRISIL/ICRA/CARE/Acuite/Infomerics | C→16, D→19; CC/CCC → **null** |
| Brickwork | BWR C→16, BWR D→19 |

**`AGENCIES`:** length 7; codes include all seven; Brickwork `woundDown === true` (SEBI Nov 2022).

**`BAND_PD_RANGE`:** every BC-1…BC-6 non-empty; BC-1 contains `"0.05%"`; BC-6 contains `"10"`.

**Short-term gap documentation:** `A1+`…`A4` → null on pure path (DB short_term ladder is SoR).

### Side effects

- None. Pure maps only; no cache load (`loadLadder` not called).

### Security / RBAC

- N/A. Static credit taxonomy. Incorrect mapping could mis-rank investors or credit bands — **data integrity / regulatory presentation** risk, not auth.

### Coupling

| Direction | Dependency |
|-----------|------------|
| **Hard** | `ratingMap.ts` pure helpers; `rankToBand` / `bandToAgencySymbol` re-exported from `./ratingBands` |
| **Downstream consumers** | Matching engine issuer `ratingRank` / `ratingBand`; credit scorecards; UI agency symbol rendering |
| **Deferred** | DB `rating_ladder` for short-term + authoritative resolve paths |

### Risks / TODOs / gaps

1. **Dual rank scales:** `coreSymbolToRank("D") === 18` vs `agencySymbolToRank(..., "D") === 19` — intentional difference; consumers must pick the right helper. Suite documents both but does not assert cross-API consistency policy.
2. **Short-term / structured / sovereign / state_guaranteed** scales untested here (by design).
3. **Notches / outlook / watch** symbols not covered.
4. **ICRA/CARE symbol variants** (e.g. agency-specific prefixes) only lightly covered beyond AAA/AA/BBB/BB/B/D loops.
5. **`RatingScale` type** exported by module but unused in tests.
6. No TODO/FIXME; short-term gap is intentional documentation in-test.

---

## 4. `src/__tests__/ratios.test.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/__tests__/ratios.test.ts` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/__tests__/ratios.test.ts` |
| **Lines** | 443 |
| **Role** | Vitest suite for credit ratio engine over `financial_statement` line items |
| **Framework** | `vitest` |
| **Source of truth** | `src/features/credit/ratios.ts` (CREDIT_ANALYSIS_SPEC §3) |

### Exports

None. Test module only.

### Imports

```ts
import { describe, expect, it } from "vitest";

import {
  computeRatios,
  ratioSetToResultRows,
  PERSISTABLE_RATIO_CODES,
  ratioCategory,
} from "@/features/credit/ratios";
import type { FinancialStatement } from "@/db/schema";
```

**Imported production API:**

- `computeRatios(stmt: Pick<FinancialStatement, "lineItems">, prior?: Pick<FinancialStatement, "lineItems"> | null): RatioSet`
- `ratioSetToResultRows(r: RatioSet)` — filters to persistable finite codes + formula snapshots
- `PERSISTABLE_RATIO_CODES: ReadonlySet<string>` — intersection with `financialRatioEnum`
- `ratioCategory(code: string): string` — display grouping
- `type FinancialStatement` from `@/db/schema` — only `lineItems` field used via cast

**`RatioSet` fields exercised (from production interface):**

```ts
// Leverage
debt_equity, debt_to_tangible_nw, debt_ebitda, net_debt_ebitda
// Coverage
interest_coverage, dscr
// Liquidity
current_ratio, quick_ratio, cash_ratio
// Profitability
ebitda_margin, pat_margin, operating_margin, roe, roa, roce
// Activity
debtor_days, creditor_days, inventory_days, working_capital_days
// Bond-specific
ffo, fcfo, ffo_debt, fcf_debt, cfads
// Derived
_ebit, _ebitda
```

**Not imported / lightly covered:** `readLineItems`, `FORMULA_SNAPSHOTS` map (only non-empty length), `ALL_RATIO_CODES`, `formatRatio`, NBFC ratios (`gnpa_pct`, `nnpa_pct`, `nim`, `crar`, `tier1_ratio`, `cost_to_income`), `asset_turnover`, `iscr`/`llcr`/`plcr` enum codes present in persistable set but not computed in these fixtures.

### Business purpose

Validates credit analysis ratio math for issuer financials:

1. **Leverage** — D/E, debt/TNW, debt/EBITDA, net debt/EBITDA (cash + marketable securities).
2. **Coverage** — interest coverage (EBIT/interest), DSCR (CFADS/debt service).
3. **Liquidity** — current / quick / cash ratios.
4. **Profitability** — margins, ROE/ROA/ROCE with prior-period averaging.
5. **Activity** — debtor/creditor/inventory/WC days with averages.
6. **Bond-specific cash-flow leverage** — FFO, FCF/debt, FFO/debt.
7. **Persistence filter** — only enum-backed codes written to `ratio_result`; extras (e.g. `ffo_debt`) UI-only.
8. **Null safety** — missing inputs and divide-by-zero → null (safeDiv).

### Key logic & fixtures

**Canonical `lineItems` map** (tidy expected values):

| Line item | Value | Derived notes |
|-----------|-------|---------------|
| revenue | 1000 | |
| cogs | 600 | |
| interest_expense | 50 | |
| pbt | 200 | ebit = pbt + interest = **250** |
| depreciation_amortization | 40 | ebitda = ebit + D&A = **290** |
| pat | 150 | |
| total_debt | 400 | |
| cash_and_equivalents | 50 | net debt **350** (or 320 with mkt sec 30) |
| net_worth | 500 | |
| tangible_net_worth | 450 | |
| total_assets | 1000 | |
| current_assets / current_liabilities | 300 / 150 | |
| inventory | 100 | |
| cfo / cfo_before_wc_changes | 180 / 190 | FFO base 190 |
| capex | 60 | FCF = 120 |
| cfads / debt_service | 200 / 100 | DSCR 2.0 |

**Pinned ratios (primary fixture):**

| Ratio | Expected |
|-------|----------|
| `debt_equity` | 400/500 = 0.8 |
| `debt_to_tangible_nw` | 400/450 |
| `debt_ebitda` | 400/290 |
| `net_debt_ebitda` | 350/290 |
| `interest_coverage` | 250/50 = 5 |
| `dscr` | 200/100 = 2 |
| `current_ratio` | 2.0 |
| `quick_ratio` | (300−100)/150 |
| `cash_ratio` | 50/150 |
| `ebitda_margin` | 0.29 |
| `pat_margin` | 0.15 |
| `operating_margin` | 0.25 |
| `roe` / `roa` (no prior) | 150/500, 150/1000 |
| `roce` | 250/(500+400−50) |
| `ffo` | 190 |
| `ffo_debt` | 190/400 |
| `fcf_debt` | (180−60)/400 |

**Prior-period averaging** (`cur` + `prior`):

- ROE: PAT / avg(NW) = 150 / ((500+400)/2)
- ROA: 150 / avg(assets)
- debtor_days: (avg recv / revenue) × 365
- creditor_days / inventory_days: (avg / cogs) × 365

**`ratioCategory` groups asserted:**

| Codes | Category string |
|-------|-----------------|
| debt_equity, debt_ebitda, net_debt_ebitda | `"Leverage"` |
| interest_coverage, dscr | `"Coverage"` |
| current_ratio, quick_ratio | `"Liquidity"` |
| roe, roa, ebitda_margin | `"Profitability"` |
| ffo_debt, fcf_debt | `"Bond-specific"` |

**Persistence:**

- Rows only if `PERSISTABLE_RATIO_CODES.has(ratioCode)` and finite value.
- `ffo_debt` computed but **not** persisted (no enum code).
- Each row has non-empty `formulaSnapshot`.

### Side effects

- **None** for pure compute path.
- Persistence is **not executed** — only the row-shaping helper is tested; no DB writes.

### Security / RBAC

- N/A for unit suite.
- Casts `as Pick<FinancialStatement, "lineItems">` bypass full statement validation — acceptable for tests; production loaders must supply well-formed JSON line items.

### Coupling

| Direction | Dependency |
|-----------|------------|
| **Hard** | `@/features/credit/ratios` formulas + persistable set |
| **Type-only** | `@/db/schema` `FinancialStatement` (lineItems JSON shape) |
| **Enum coupling** | `PERSISTABLE_RATIO_CODES` must stay aligned with `financialRatioEnum` in enums/schema |
| **Downstream** | Credit scorecard UI, ratio_result persistence pipelines |

### Risks / TODOs / gaps

1. **NBFC-specific ratios** (GNPA, CRAR, NIM, etc.) untested despite `RatioSet` fields and persistable codes.
2. **`asset_turnover`**, **`iscr`**, **`llcr`**, **`plcr`**, valuation multiples (`ev_ebitda`, `p_e`, `p_b`) not covered.
3. **`prev_*` line-item fallback** for averages (when `prior` omitted but prev fields present) not tested.
4. **Explicit `ebit`/`ebitda` override** partially covered (net debt uses supplied ebitda; EBIT derivation tested when only PBT+interest).
5. **ROCE with prior-period capital_employed average** not asserted (prior has `capital_employed` but ROCE test focuses on NW averaging path for ROE).
6. **Negative line items / bad signs** not explored.
7. Float tolerances fixed at 6 decimals via `toBeCloseTo`.
8. No TODO/FIXME comments.

---

## Cross-file batch summary

| File | Lines | Domain | SUT module | Hermetic? |
|------|------:|--------|------------|-----------|
| `maModel.test.ts` | 201 | M&A modeling | `features/modeling/maModel` | Yes |
| `matching.test.ts` | 676 | Investor match USP | `features/matching/engine` | Yes (time-relative) |
| `ratingMap.test.ts` | 325 | Credit rating map | `features/credit/ratingMap` | Yes (static only) |
| `ratios.test.ts` | 443 | Credit ratios | `features/credit/ratios` | Yes |

**Shared characteristics:**

- All four are **Vitest** pure-unit suites; zero production exports.
- All use **fixture builders** + `toBeCloseTo` for float financial math (except integer ranks/weights/bands).
- **No RBAC, no I/O, no malware surface.**
- **Coupling is intentional regression pinning** of financial/credit/matching business rules.

**Cross-domain links:**

1. **Matching ↔ Rating map:** issuer `ratingRank` / `ratingBand` (`BC-*`) must stay consistent with `coreSymbolToRank` / `symbolToBand` / `agencySymbolToRank` conventions (lower rank = stronger credit).
2. **Ratios ↔ Credit analysis:** ratio outputs feed scorecards; rating bands and PD ranges are separate pure maps.
3. **M&A model** is relatively isolated (modeling feature); tax rate 0.2517 appears as corporate default in fixtures only.

**Batch risk themes:**

- Spec drift if CREDIT_ANALYSIS_SPEC / BUSINESS_CONTEXT weights change without updating tests.
- Dual rating ladders (core D=18 vs agency D=19) require careful consumer choice.
- Matching kind inference and warm-intro recency are heuristics with product risk, well pinned here.
- Ratio persistable set can desync from DB enum if schema migrations add codes without engine updates (tests only check membership, not full enum parity).
