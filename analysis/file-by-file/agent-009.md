# File-by-file analysis — batch 009 (agent-009)

Batch list: `analysis/file-by-file/batch-009.list`  
App root: `/home/Jashmhta/crm/bc-crm/app`  
Scope: pure unit-test suites under `src/__tests__/` that pin financial, AI-heuristic, and KYC compliance engines. No production runtime code in this batch; all four files are Vitest suites with zero DB / network / auth side effects.

---

## 1. `src/__tests__/aiSummary.test.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/__tests__/aiSummary.test.ts` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/__tests__/aiSummary.test.ts` |
| **Lines** | 512 |
| **Kind** | Vitest unit test suite |
| **Runtime** | Node (vitest); hermetic — no DB, no HTTP, no React |

### Role

Regression suite for the **deterministic (no-LLM) AI generators**:

1. Credit memo summary posture & narrative (`generateCreditSummary`)
2. Interaction topic / action extraction (`summarizeInteractions`, `summarizeOneInteraction`)
3. Client relationship scoring & action taxonomy (`relationshipStrengthScore`, `dealPotentialScore`, `recommendAction`)

Explicitly **does not** exercise server loaders (`getCreditSummary`, `getInteractionSummary`, `getClientInsights`, `getNextActions`) — those hit live DB and are deferred to route smoke tests (header comment lines 11–13).

### Exports

None (test module). Local helpers only:

| Symbol | Kind | Signature / shape |
|--------|------|-------------------|
| `baseStrongCorporate` | fixture factory | `(): CreditSummaryInput` — BC-2 / score 78 corporate with strong ratios + CRISIL AA+ |
| `baseWeakCorporate` | fixture factory | `(): CreditSummaryInput` — BC-5 distressed corporate, ICRA BB negative |
| `generateSummaryWithNoConcerns` | test helper | `(input: CreditSummaryInput) => CreditSummary` — forces BC-1 / AAA / assign / no watchlist so concerns fallback fires |
| `note` | fixture factory | `(over: Partial<InteractionNote>): InteractionNote` — defaults `channel: "meeting"`, `partyName: "Acme Steel"` |

### Imports

```ts
import { describe, expect, it } from "vitest";

import {
  generateCreditSummary,
  type CreditSummaryInput,
} from "@/features/ai/creditSummary";

import {
  summarizeInteractions,
  summarizeOneInteraction,
  type InteractionSummaryInput,
  type InteractionNote,
} from "@/features/ai/interactionSummary";

import {
  relationshipStrengthScore,
  dealPotentialScore,
  recommendAction,
} from "@/features/ai/clientInsights";
```

**Not imported (deliberately):** DB loaders, `types.ts` directly (types come via feature modules), RBAC, schema.

### Business purpose

Pins Binary CRM’s **credit-committee and coverage-desk heuristics** so product copy and risk posture cannot silently drift:

| Domain | Business rule pinned |
|--------|----------------------|
| Credit recommendation | IG (BC-1..BC-3) → Approve / positive; BC-4 → Approve with conditions / info; BC-5 → Decline / warning; BC-6 → Decline / critical; missing score/band → Pending / info |
| Overrides | `watchlist: true` or `internalRatingAction: "watch_negative"` → Watchlist / warning even for IG band |
| Strengths / concerns | Coverage, leverage, liquidity, external rating IG vs sub-IG thresholds; “within prudent limits” fallback when clean |
| NBFC framing | `obligorType: "nbfc"` uses NPA / CRAR / NIM language, not Debt/EBITDA |
| Trend | `priorRatios` produces “Versus the prior period…” sentence |
| Interactions | Bond-house topic vocab (rating, pricing, allocation, KYC…); action items from `nextAction` + body imperatives |
| Client insights | Score caps 0–100; action priority: refresh_kyc > advance_mandate > re_engage / deepen_coverage / maintain |

### Key logic (by `describe` block)

#### `generateCreditSummary - recommendation posture` (7 tests)

Exercises band → recommendation string + `recommendationPriority` (`AiPriority`: `"positive" | "warning" | "info" | "critical"`):

| Input band / flag | Expected `recommendation` regex | `recommendationPriority` |
|-------------------|----------------------------------|--------------------------|
| BC-2 strong | `/Approve/` | `"positive"` |
| BC-5 weak | `/Decline/` | `"warning"` |
| BC-2 + `watchlist: true` | `/Watchlist/` | `"warning"` |
| BC-2 + `internalRatingAction: "watch_negative"` | `/Watchlist/` | `"warning"` |
| BC-4 score 47 | `/Approve with conditions/` | `"info"` |
| BC-6 score 18 | `/Decline/` | `"critical"` |
| `score/band/bandGrade/pd1yPct/internalRatingShort` null | `/Pending/` | `"info"` |

#### `generateCreditSummary - strengths & concerns` (3 tests)

- Strong fixture: strengths match `/Strong debt service coverage/`, `/Conservative leverage/`, `/investment-grade/`
- Weak fixture: concerns match `/Elevated leverage/`, `/Thin debt service coverage/`, `/Liquidity pressure/`, `/sub-investment-grade/`
- Clean BC-1 helper: concerns fallback `/within prudent limits/`

#### `generateCreditSummary - framing & trend` (4 tests)

- NBFC ratios (`gnpaPct`, `nnpaPct`, `crar`, `nim`) → financials mention NPA/CRAR/NIM, not Debt/EBITDA
- `priorRatios: { debtEbitda, interestCoverage, ebitdaMargin }` → trend sentence with “leverage has improved”, “interest coverage has improved”
- All-null ratios + null `latestPeriodEnd` → `/No financial statements are linked/`
- Rating line contains `"BC-2"`, `"Strong"`, `"/100"`, `"1-yr PD"`

#### Fixtures — `CreditSummaryInput` shape exercised

```ts
// From @/features/ai/creditSummary (quoted for analysis)
export interface CreditSummaryRatios {
  debtEbitda: number | null;
  netDebtEbitda: number | null;
  debtEquity: number | null;
  interestCoverage: number | null;
  dscr: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  ebitdaMargin: number | null;
  patMargin: number | null;
  roce: number | null;
  roe: number | null;
  gnpaPct: number | null;
  nnpaPct: number | null;
  crar: number | null;
  nim: number | null;
}

export interface CreditSummaryInput {
  creditAnalysisId: string;
  issuerName: string;
  obligorType: string | null;
  sectorLabel: string | null;
  isListed: boolean | null;
  domicileState: string | null;
  analysisType: string | null;
  internalRatingShort: string | null;
  internalRatingAction: string | null;
  recommendation: string | null;
  watchlist: boolean;
  score: number | null;
  band: string | null;
  bandGrade: string | null;
  pd1yPct: number | null;
  ratios: CreditSummaryRatios;
  externalRatings: CreditSummaryExternalRating[];
  grossExposureInrCr: number | null;
  latestPeriodEnd: string | null;
  priorPeriodEnd: string | null;
  // priorRatios optional (used in trend test)
}
```

Strong fixture highlights: `issuerName: "Acme Steel Pvt Ltd"`, `band: "BC-2"`, `score: 78`, `debtEbitda: 2.1`, `interestCoverage: 5.2`, CRISIL AA+ long_term stable, `grossExposureInrCr: 125.5`.

#### `summarizeInteractions - topic & action extraction` (5 tests)

Uses `InteractionNote` / `InteractionSummaryInput`:

```ts
export interface InteractionNote {
  interactionId: string;
  subject: string | null;
  body: string | null;
  channel: string | null;
  occurredAt: string | null;
  nextAction: string | null;
  partyName: string | null;
  dealCode: string | null;
  dealName: string | null;
}

export interface InteractionSummaryInput {
  notes: InteractionNote[];
  scope: { partyId?: string; dealId?: string };
  scopeLabel: string;
}
```

| Test | Assertion focus |
|------|-----------------|
| Empty notes | `interactionCount === 0`, overview `/No interactions have been logged/`, empty topics/actions |
| Two notes (rating + allocation) | topics: `"Credit rating"`, `"Pricing & coupon"`, `"Allocation & settlement"`; channels include `"Meeting"` |
| nextAction + body imperative | action items match schedule committee + follow up treasurer |
| `summarizeOneInteraction` KYC note | `topic === "KYC & onboarding"`, action `/Send the beneficial-owner declarations/` |
| No topic match | `topic` falls back to subject `"Quick hello"`, `actionItem === null` |

Return shape of mini-summary (from source): `{ topic: string; actionItem: string | null; ... }` (tests only assert `topic` and `actionItem`).

#### `relationshipStrengthScore - bounding` (3 tests)

```ts
// SUT: relationshipStrengthScore(weightedInteractions, dealCount, contactCount): number
// Blend: interactions 50pts (cap at 20 weighted) + deals 30pts (cap 5) + contacts 20pts (cap 4)
```

| Inputs | Expected |
|--------|----------|
| `(1000, 50, 30)` | `≤ 100` |
| `(0, 0, 0)` | `0` |
| `(20, 5, 4)` | `100` |
| `(10, 0, 2)` | `35` |

#### `dealPotentialScore - bounding` (3 tests)

```ts
// SUT: dealPotentialScore(activeDealCount, totalTargetSizeCr, daysSinceLastInteraction): number
```

| Case | Expected |
|------|----------|
| `(10, 10000, 0)` | `≤ 100` |
| `(0, 0, null)` | `0` |
| same deals/size, days 5 vs 80 | recent > cold |

#### `recommendAction - taxonomy` (7 tests)

```ts
export interface ActionInput {
  activeDealCount: number;
  daysSinceLastInteraction: number | null;
  rekycDueDate: Date | null;
  relationshipStrength: number;
  now?: number;
}

// returns { kind: InsightActionKind; rationale: string }
// InsightActionKind = "re_engage" | "advance_mandate" | "committee_review"
//                   | "refresh_kyc" | "deepen_coverage" | "maintain"
```

Frozen clock: `now = Date("2026-06-15T00:00:00Z").getTime()`.

| Scenario | `kind` |
|----------|--------|
| re-KYC due in 9 days | `"refresh_kyc"` |
| active deal, 30d quiet, re-KYC far | `"advance_mandate"` |
| no live deal, 90d cold | `"re_engage"` |
| no interaction ever, no deal | `"re_engage"` |
| 2 active deals, 12d, strength 80 | `"deepen_coverage"` |
| 1 deal, 10d, strength 55 | `"maintain"` |
| both KYC-due and stale mandate | `"refresh_kyc"` (priority) |

Thresholds pinned indirectly (from SUT constants, not redefined in test): `KYC_DUE_WINDOW_DAYS = 30`, `STALE_MANDATE_DAYS = 21`, `COLD_RELATIONSHIP_DAYS = 60`.

### Side effects

- **None.** Pure function calls + Vitest assertions.
- No `db`, no filesystem, no `Date.now()` dependency except via injectable `now` on `recommendAction` and `new Date().toISOString()` default in `note()` fixture (non-asserted timestamps).

### Security / RBAC

- **No RBAC under test.** Server loaders in SUT modules use `can()` / party-deal scope; this suite never imports them.
- **Implication:** RBAC regressions on AI hub data visibility are **out of coverage** here.
- No secrets, no PII beyond fixture names (`Acme Steel`, etc.).

### Coupling

| Coupled to | Strength | Notes |
|------------|----------|-------|
| `@/features/ai/creditSummary` | High | Recommendation string regexes encode product copy |
| `@/features/ai/interactionSummary` | High | Topic labels must match `TOPIC_DEFS` labels exactly |
| `@/features/ai/clientInsights` | High | Action kinds and score arithmetic |
| Scorecard band nomenclature (`BC-1`…`BC-6`) | Medium | Magic strings in fixtures |
| Indian bond-house domain vocab | Medium | Topic extraction keywords |

Loose coupling to DB schema / Next.js routes.

### Risks / TODOs / gaps

1. **Copy fragility:** Assertions use `.toMatch(/Approve/)` etc. — rewording recommendation templates breaks suite without behavioral change.
2. **Incomplete band matrix:** BC-1 and BC-3 approve path not individually asserted (only BC-2); BC-4/5/6 covered.
3. **`committee_review` action kind never asserted** though it exists in `InsightActionKind`.
4. **Server loaders untested** (by design) — DB mapping bugs from `credit_analysis` → `CreditSummaryInput` won’t surface here.
5. **Helper `generateSummaryWithNoConcerns`** embeds BC-1/AAA assumptions; if strengths thresholds change, fallback test may fail for unrelated reasons.
6. No snapshot/golden-file for full `CreditSummary` paragraphs (issuer/financials/assessment) — only fragments.
7. No TODO/FIXME comments in file.

---

## 2. `src/__tests__/bondPricing.test.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/__tests__/bondPricing.test.ts` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/__tests__/bondPricing.test.ts` |
| **Lines** | 481 |
| **Kind** | Vitest unit test suite |
| **Runtime** | Node (vitest); pure numeric / date math |

### Role

Canonical-case verification for the **Indian fixed-income bond pricing engine** (`src/features/modeling/bondPricing.ts`), aligned with `docs/FINANCIAL_MODELING_SPEC.md` §1. Pins financial invariants rather than bit-exact floats (`toBeCloseTo` with 4–10 digits; bound checks for duration/convexity).

### Exports

None. Local helper:

| Symbol | Signature |
|--------|-----------|
| `baseCorp` | `(overrides: Partial<BondInputs>): BondInputs` — CORP_IG, face 100, c=8%, annual, ACT_365, settle/last coupon 2024-01-01, maturity 2034-01-01 |

### Imports

```ts
import { describe, expect, it } from "vitest";

import {
  computeBondMetrics,
  instrumentDefaults,
  pct,
  inr,
  bp,
  years,
  type BondInputs,
} from "@/features/modeling/bondPricing";
```

### Business purpose

Guarantees Binary CRM’s bond calculator matches **Indian market conventions** (FIMMDA corporate clean quote; GoI G-Sec/SDL semi-annual dirty; T-Bill discount yield → BEY) so IC / trading screens never ship inverted price-yield, wrong accrued, or broken T-Bill math.

### Key logic (by `describe` block)

#### Types from SUT (quoted)

```ts
export type DayCount = "ACT_365" | "ACT_360" | "thirty_360" | "ACT_ACT";

export type InstrumentType =
  | "GSEC" | "SDL" | "TBILL" | "SGB"
  | "CORP_IG" | "CORP_HY" | "NCD" | "CP" | "STRUCTURED";

export interface BondInputs {
  instrumentType: InstrumentType;
  faceValue: number;
  couponRate: number;          // decimal e.g. 0.08
  couponFrequency: 0 | 1 | 2 | 4 | 12;  // 0 = zero
  dayCount: DayCount;
  issueDate?: string;
  maturityDate: string;
  lastCouponDate: string;
  nextCouponDate: string;
  settlementDate: string;
  yield?: number;
  marketPrice?: number;
  priceType?: "clean" | "dirty";
  benchmarkYield?: number;
}

// computeBondMetrics(inputs: BondInputs): BondMetrics
// BondMetrics includes: cleanPrice, dirtyPrice, accruedInterest, ytm,
// macaulayDuration, modifiedDuration, dv01, convexity, gSpread,
// priceYieldCurve, cashFlows, daysAccrued, currentYield, tbill?, ...
```

#### Par / discount / premium bonds

| Case | Input yield vs 8% coupon | Expected |
|------|--------------------------|----------|
| Par | y = 0.08 | `cleanPrice ≈ 100`, `ytm ≈ 0.08`, AI ≈ 0, dirty = clean |
| Discount | y = 0.10 | clean ∈ (0, 100), ytm ≈ 0.10 |
| Premium | y = 0.06 | clean > 100 |

#### Duration & convexity bounds (par 10y)

- `0 < macaulayDuration < 10`
- `0 < modifiedDuration ≤ macaulayDuration`
- `convexity > 0`
- `dv01 > 0` (price falls as yields rise)

#### Accrued interest — semi-annual G-Sec

Fixture: `instrumentType: "GSEC"`, f=2, last 2024-01-01, next 2024-07-01, settle 2024-04-01, leap year.

- Days accrued **exactly 91** (31+29+31)
- AI = `100 × 0.08 × 91/365` (strict ACT/365 form — not c/f hybrid)
- `dirty = clean + AI`
- `currentYield` finite and ≥ 0

#### Price-yield curve & cash flows

- Grid spans at least ±300 bp around 8%
- Monotonic: higher yield → lower clean price (sorted ascending yield)
- Last cash flow: `principal ≈ 100` on `"2034-01-01"`

#### Zero-coupon

`couponRate: 0`, `couponFrequency: 0`, y=8%, 10y:

- `cleanPrice ≈ 100 / 1.08^10` (≈ 46.3193), digits=4
- AI ≈ 0, dirty = clean
- Macaulay ≈ 10, modified ≈ 10/1.08
- convexity > 0, current yield ≈ 0

#### Semi-annual vs annual par (5y)

- Both price at 100 when y = c = 8%
- Both solve YTM back to 8%
- Semi Macaulay ≤ annual Macaulay (more frequent coupons pull duration shorter)

#### Modified duration identity

- Annual: `mod = Mac / (1 + YTM)`
- Semi: `mod = Mac / (1 + YTM/2)`

#### T-Bill (FINANCIAL_MODELING_SPEC §1.2.5)

91-day TBILL, discount yield 6.5%, settle 2024-01-01 → maturity 2024-04-01:

```
price = Face × (1 − Yd × days/365)
expectedPrice = 100 * (1 - 0.065 * 91/365)  // ≈ 98.379
expectedBey = (100/price - 1) * (365/days)
```

Asserts `metrics.tbill` defined with `discountYield`, `daysToMaturity: 91`, `price`, `bondEquivalentYield`; clean=dirty; Mac ≈ 91/365; convexity > 0; YTM > discount yield.

#### G-spread

- With `benchmarkYield: 0.07`, y=0.08 → `gSpread ≈ 0.01`
- Without benchmark → `gSpread === null`

#### Corporate annual mid-period accrued

Settle 2024-07-01 mid annual period, c=9%: daysAccrued **182** (leap), AI = `100 × 0.09 × 182/365`.

#### `instrumentDefaults` — Indian conventions

```ts
// instrumentDefaults(type: InstrumentType): InstrumentDefaults
// fields used: couponFrequency, dayCount, priceType, discount, conventionLabel
```

| Type(s) | couponFrequency | dayCount | priceType | discount |
|---------|-----------------|----------|-----------|----------|
| GSEC | 2 | ACT_365 | dirty | false |
| SDL | 2 | (ACT_365 implied by suite focus) | dirty | — |
| TBILL | 0 | ACT_365 | — | true |
| CORP_IG, CORP_HY, NCD | 1 | ACT_365 | clean | false |
| CP | 0 | — | — | true |
| All 9 types | — | — | — | non-empty `conventionLabel` |

Types looped: `"GSEC" | "SDL" | "TBILL" | "SGB" | "CORP_IG" | "CORP_HY" | "NCD" | "CP" | "STRUCTURED"`.

#### Formatting helpers

| Helper | Signature (SUT) | Cases |
|--------|-----------------|-------|
| `pct` | `(x: number, digits?: number): string` | `pct(0.0825) === "8.2500%"`, `pct(0.0825, 2) === "8.25%"`, NaN/∞ → `"-"` |
| `inr` | `(x: number, digits?: number): string` | `inr(98.37945, 2) === "₹98.38"` |
| `bp` | `(x: number \| null, digits?: number): string` | `bp(0.01) === "100.0 bp"`, null/NaN → `"-"` |
| `years` | `(x: number, digits?: number): string` | `years(7.25) === "7.25 yr"`, NaN → `"-"` |

### Side effects

None. Pure pure-function evaluation. Metrics for shared describe blocks are computed once at suite load (module-level `const metrics = computeBondMetrics(...)`) — still pure.

### Security / RBAC

None. Modeling library has no auth. No injection surface (tests construct plain objects).

### Coupling

| Coupled to | Notes |
|------------|-------|
| `@/features/modeling/bondPricing` | Direct API surface |
| `FINANCIAL_MODELING_SPEC.md` §1 | Documented formulas for AI, T-Bill, duration |
| UTC ACT day counts | Leap-year 2024 fixtures critical (91, 182 days) |

### Risks / TODOs / gaps

1. **YTM-from-price path untested** — `marketPrice` / `priceType` inputs never exercised; only price-from-yield.
2. **Day counts other than ACT_365** (`ACT_360`, `thirty_360`, `ACT_ACT`) untested.
3. **SGB / STRUCTURED defaults** only checked for non-empty convention labels, not full field sets.
4. **No negative / edge cases:** settlement after maturity, zero face, negative yield, empty cashflow edge.
5. **DV01 magnitude** not calibrated to a known value (only sign).
6. **Convexity formula** not checked against closed-form for zero/par.
7. Module-level `const metrics = computeBondMetrics(...)` at describe scope means engine bugs fail many tests at once (good fan-out, noisy diagnosis).
8. No TODO/FIXME in file.

---

## 3. `src/__tests__/kyc.test.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/__tests__/kyc.test.ts` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/__tests__/kyc.test.ts` |
| **Lines** | 429 |
| **Kind** | Vitest unit test suite |
| **Runtime** | Node (vitest); hermetic pure helpers |

### Role

Exhaustive verification of **KYC lifecycle pure helpers** encoding PMLA 2002 + RBI Master Direction on KYC (research pointer: `COMPLIANCE_LEGAL_FEASIBILITY.md` §5). Source of truth: `src/features/compliance/kyc.ts`.

Coverage declared in file header:

- BO thresholds (company/SPV 10%, partnership/trust 15%, role-based natures null)
- `requiresEddForBo` including safe null/string coercion
- Re-KYC periodicity (10/8/2 yr) and lead times
- `computeValidUntil` / `computeRekycDueDate` / retention 5yr
- Status state machine
- Composite EDD escalation
- PEP/sanctions stubs (safe default clear)
- STR/CTR policy constants

### Exports

None. No local helpers beyond inline fixtures in `shouldEscalateToEdd` (`baseInput` object).

### Imports

```ts
import { describe, expect, it } from "vitest";

import {
  BO_THRESHOLD_PCT,
  PARTNERSHIP_BO_THRESHOLD_PCT,
  RISK_REFRESH_YEARS,
  RISK_LEAD_TIME_MONTHS,
  KYC_RETENTION_YEARS,
  STR_FILING_DEADLINE_WORKING_DAYS,
  CTR_MONTHLY_THRESHOLD_INR,
  boThresholdFor,
  requiresEddForBo,
  computeValidUntil,
  computeRekycDueDate,
  computeRetentionUntil,
  allowedTransitions,
  canTransition,
  shouldEscalateToEdd,
  screenSanctions,
  screenPep,
  type PartyNature,
  type LegalForm,
  type KycRisk,
  type KycStatus,
} from "@/features/compliance/kyc";
```

### Business purpose

Locks **regulatory arithmetic and workflow gates** so Binary CRM cannot:

- Apply a wrong BO % (especially the debunked 25% legacy or forgetting partnership = 15%)
- False-positive EDD on missing ownership data
- Skip re-KYC calendar math (RBI risk-based 10/8/2)
- Allow illegal KYC status jumps (e.g. pending → approved)
- Auto-match sanctions via stub (must stay clear until live provider)

These constants drive compliance UI, actions, and audit posture for Indian broker-dealer / bond-house onboarding.

### Key logic (by area)

#### Types (quoted from SUT)

```ts
export type KycStatus =
  | "pending" | "in_review" | "approved" | "rejected"
  | "expired" | "rekyc_due" | "under_eds_check";

export type KycRisk = "low" | "medium" | "high";

export type PartyNature =
  | "organization" | "natural_person" | "spv"
  | "trust" | "government" | "regulator";

export type LegalForm =
  | "company" | "llp" | "partnership" | "trust" | "huf" | "other";

export type ScreeningStatus = "clear" | "pending" | "match" | "error";

export interface ScreeningResult {
  status: ScreeningStatus;
  matchScore: number;
  detail: string;
  listsChecked: string[];
  screenedAt: string;
}
```

#### BO thresholds

| Constant / call | Expected |
|-----------------|----------|
| `BO_THRESHOLD_PCT.organization` / `.spv` | `10` |
| `BO_THRESHOLD_PCT.trust` | `15` |
| `BO_THRESHOLD_PCT.natural_person` / `.government` / `.regulator` | `null` |
| `PARTNERSHIP_BO_THRESHOLD_PCT` | `15` |
| `boThresholdFor("organization")` | `10` |
| `boThresholdFor("organization", "partnership")` | `15` (override) |
| `boThresholdFor("organization", "company" \| "llp")` | `10` |
| `boThresholdFor("trust", "partnership")` | `15` (unconditional legalForm override) |

#### `requiresEddForBo(nature, highestBoOwnershipPct, legalForm?)`

| Case | Result |
|------|--------|
| org @ 10 | true (≥) |
| org @ 9.9 | false |
| org @ 25 | true |
| trust @ 15 / 14.9 | true / false |
| org+partnership @ 15 / 10 | true / false |
| natural_person / government / regulator @ 100 | false |
| null / undefined ownership | false (no false positives) |
| string `"10"` / `"9"` | true / false (coercion) |
| string `"n/a"` | false |

#### Risk refresh / lead time / dates

| Constant | low | medium | high |
|----------|-----|--------|------|
| `RISK_REFRESH_YEARS` | 10 | 8 | 2 |
| `RISK_LEAD_TIME_MONTHS` | 3 | 3 | 1 |

| Function | Input | Output |
|----------|-------|--------|
| `computeValidUntil("low", UTC 2024-01-01)` | | `"2034-01-01"` |
| `computeValidUntil("medium", …)` | | `"2032-01-01"` |
| `computeValidUntil("high", …)` | | `"2026-01-01"` |
| `computeRekycDueDate("2034-01-01", "low")` | | `"2033-10-01"` |
| `computeRekycDueDate("2032-01-01", "medium")` | | `"2031-10-01"` |
| `computeRekycDueDate("2026-01-01", "high")` | | `"2025-12-01"` |
| `computeRekycDueDate("not-a-date", "low")` | | throws |
| `KYC_RETENTION_YEARS` | | `5` |
| `computeRetentionUntil(UTC 2024-01-01)` | | `"2029-01-01"` |
| `computeRetentionUntil(…, 10)` | | `"2034-01-01"` |

ISO format asserted: `/^\d{4}-\d{2}-\d{2}$/`.

#### Status state machine

```ts
// allowedTransitions (SUT) — fully exercised via canTransition:
pending:          ["in_review"]
in_review:        ["under_eds_check", "approved", "rejected"]
under_eds_check:  ["approved", "rejected", "in_review"]
approved:         ["expired", "rekyc_due"]
rejected:         ["in_review"]
expired:          ["rekyc_due"]
rekyc_due:        ["in_review"]
```

Negative cases: pending ↛ approved; approved ↛ in_review; rejected ↛ approved.

Every `KycStatus` has array entry in `allowedTransitions`.

#### `shouldEscalateToEdd`

```ts
// input shape:
{
  partyNature: PartyNature;
  highestBoOwnershipPct: number | string | null;
  pepStatus: string | null;
  sanctionsStatus: ScreeningStatus | null;
  riskRating: KycRisk;
  legalForm?: LegalForm | null;
}
```

| Condition | Escalates? |
|-----------|------------|
| Clean low-risk org, BO 5% | false |
| `riskRating: "high"` | true |
| BO 10% or 12% org | true |
| partnership BO 15% / 14% | true / false |
| `pepStatus: "domestic" \| "foreign"` | true |
| `pepStatus: "none"` alone | false |
| sanctions `"match"` / `"pending"` | true |
| sanctions `"clear"` alone | false |

#### Screening stubs

| Function | Asserted behavior |
|----------|-------------------|
| `screenSanctions(name)` | `status: "clear"`, `matchScore: 0`, lists include `UN_1267`, `UN_1373`, `RBI_UAPA`, `OFAC_SDN`, valid ISO `screenedAt` |
| `screenPep(name)` | `status: "clear"`, `matchScore: 0`, lists `PEP_domestic`, `PEP_foreign`, `PEP_associate` |

#### STR / CTR constants

| Constant | Value | Meaning |
|----------|-------|---------|
| `STR_FILING_DEADLINE_WORKING_DAYS` | `7` | FIU-IND filing window |
| `CTR_MONTHLY_THRESHOLD_INR` | `1_000_000` | INR 10 lakh monthly cash threshold |

### Side effects

- **None from business logic under test** (pure helpers).
- `screenSanctions` / `screenPep` read `new Date().toISOString()` for `screenedAt` — only side effect is wall-clock timestamp generation; no I/O.

### Security / RBAC

- **Compliance-critical, not RBAC.** Suite does not test who may approve KYC; that lives in `actions.ts` / `withRls`.
- **Safe-by-default screening** is a deliberate security property: stubs never auto-`match`, reducing false production blocks until provider wiring.
- **Risk if stub ships long-term:** real PEP/sanctions matches never fire → compliance gap (tests currently *require* clear — will need update when live screening lands).
- Ownership string coercion tested — resists type-noise from form/DB string columns.

### Coupling

| Coupled to | Notes |
|------------|-------|
| `@/features/compliance/kyc` | Entire pure API surface |
| PMLA Rules 2005 Rule 9(3) (2019) | 10%/15% thresholds |
| RBI MD KYC FAQ Id=3782 | 10/8/2 refresh years |
| PMLA s.12 | 5yr retention |
| Schema modeling choice | partnerships as `party_nature='organization'` + `legalForm` |

Indirect future coupling: `kyc_record`, `kyc_beneficial_owner`, `contact.pep_status` tables (not imported here).

### Risks / TODOs / gaps

1. **Screening stubs permanently green** — suite will fail if real matching is added without updating expectations; until then production under-screens.
2. **No integration with actions/queries** — state machine may be bypassed by direct DB writes if actions don’t call `canTransition`.
3. **`KycType` (`CDD`/`EDD`/`simplified`) never tested** (exported from SUT, unused here).
4. **Month-end calendar edges** for lead-time subtract (e.g. Mar 31 − 1 month) not covered.
5. **Timezone:** tests use UTC constructors — good; consumers passing local midnight could still off-by-one.
6. **`shouldEscalateToEdd` with `sanctionsStatus: "error"`** not specified (likely false — untested).
7. **Adverse media** mentioned in research comments but no helper/test.
8. No TODO/FIXME in file; SUT comments flag stub replacement as future work.

---

## 4. `src/__tests__/lboModel.test.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/__tests__/lboModel.test.ts` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/__tests__/lboModel.test.ts` |
| **Lines** | 193 |
| **Kind** | Vitest unit test suite |
| **Runtime** | Node (vitest); pure LBO engine |

### Role

Pins **real-IB LBO screening invariants** for `src/features/modeling/lboModel.ts` (FINANCIAL_MODELING_SPEC §6): sources & uses balance, debt amortization/sweep, sponsor IRR/MOIC monotonicity vs entry/exit multiples and growth, sensitivity grid shape.

### Exports

None. Local fixture:

| Symbol | Signature |
|--------|-----------|
| `base` | `(): LboInputs` — full capital structure scenario (₹ units absolute) |

### Imports

```ts
import { describe, expect, it } from "vitest";

import {
  computeLbo,
  lboDefaults,
  type LboInputs,
} from "@/features/modeling/lboModel";
```

### Business purpose

Ensures the in-app **LBO pre-screen / IC pre-read** model:

- Always balances sources & uses (sponsor equity is the plug)
- Never “grows” debt principal via amortization bugs
- Produces sensible sponsor returns (positive IRR, MOIC = exit/entry equity)
- Sensitivity table is usable (9×9, monotonic in entry/exit multiples)

Indian conventions appear in defaults (tax 25.17% Sec 115BAA) via fixture/defaults, not re-derived in assertions.

### Key logic

#### Fixture `base(): LboInputs` (full values)

```ts
{
  ltmEbitda: 250_000_000,
  entryEvEbitda: 8.0,
  exitEvEbitda: 9.0,
  holdPeriodYears: 5,
  ebitdaGrowth: 0.08,
  existingDebt: 300_000_000,
  existingCash: 50_000_000,
  transactionFeePct: 0.02,
  financingFeePct: 0.02,
  managementRollover: 100_000_000,
  taxRate: 0.2517,
  capexPctOfEbitda: 0.06,
  nwcPctOfEbitdaChange: 0.10,
  daPctOfEbitda: 0.04,
  cashSweepPct: 0.75,
  tranches: [
    { name: "Senior secured (Term Loan A)", amount: 600_000_000, rate: 0.095, amortizationPct: 0.10 },
    { name: "Senior secured (Term Loan B)", amount: 400_000_000, rate: 0.105, amortizationPct: 0.05 },
    { name: "Subordinated / mezzanine", amount: 250_000_000, rate: 0.135, amortizationPct: 0.0 },
  ],
}
```

#### SUT types (quoted)

```ts
export interface LboTrancheInput {
  name: string;
  amount: number;
  rate: number;
  amortizationPct: number; // fraction of ORIGINAL principal per year; 0 = bullet
}

export interface LboInputs { /* see fixture fields above */ }

export interface LboResult {
  entryEv: number;
  equityPurchasePrice: number;
  sourcesAndUses: LboSourcesAndUses; // totalSources, totalUses, sponsorEquity, totalNewDebt, totalEquity, ...
  trancheSchedules: LboTrancheSchedule[];
  periods: LboPeriodRow[];
  exitEv: number;
  exitEbitda: number;
  totalDebtAtExit: number;
  cashAtExit: number;
  netDebtAtExit: number;
  exitEquity: number;
  sponsorShare: number;
  sponsorExitProceeds: number;
  sponsorCashFlows: number[];
  irr: number | null;
  moic: number;
  sensitivity: LboSensitivityCell[][]; // entry × exit → { irr, moic }
  notes: string[];
}

// computeLbo(inputs: LboInputs): LboResult
// lboDefaults(): LboInputs
```

#### `computeLbo - sources & uses` (5 tests)

| Assertion | Formula / rule |
|-----------|----------------|
| S&U balance | `totalSources ≈ totalUses` |
| Entry EV | `entryEv ≈ 8.0 × 250_000_000` |
| Equity purchase price | `equityPurchasePrice ≈ entryEv − (300M − 50M)` net debt |
| Funding | `totalEquity + totalNewDebt ≈ totalUses` |
| Equity composition | `totalEquity > sponsorEquity` (rollover residual) |

Note: one test compares `totalEquity - sponsorEquity` to itself (tautology) while commenting “Rollover is residual” — weak assertion; only strict check is inequality vs sponsor equity.

#### `computeLbo - debt schedule` (5 tests)

- Every tranche: `closingBalance ≤ originalPrincipal` and ≥ 0
- TLA: each year’s `mandatoryAmort ≤ 60_000_000` (10% of 600M)
- Mezzanine bullet: all `mandatoryAmort === 0`
- Full sweep (`cashSweepPct: 1`) → lower `totalDebtAtExit` than zero sweep
- Period total debt last < first

#### `computeLbo - sponsor returns` (6 tests)

| Rule | Detail |
|------|--------|
| MOIC identity | `moic ≈ sponsorExitProceeds / sponsorEquity` |
| Clean hold CF | t0 = −sponsorEquity; tn = +proceeds; interim = 0 |
| Exit multiple ↑ | IRR & MOIC rise (7 → 11 exit) |
| Entry multiple ↑ | IRR falls (7 → 10 entry) |
| EBITDA growth ↑ | IRR rises (2% → 12%) |
| Base IRR | finite, `0 < irr < 1` |

#### `computeLbo - sensitivity grid` (3 tests)

- Shape **9 × 9**
- Mid-row: IRR non-decreasing as exit multiple increases
- Mid-col: IRR non-increasing as entry multiple increases
- Null-safe: only compares when both IRRs non-null

#### `computeLbo - defaults` (1 test)

`lboDefaults()` → balanced S&U, non-null IRR, finite MOIC, `notes.length > 0`.

### Side effects

None. Pure computation.

### Security / RBAC

None. Client-safe pure math library (same pattern as bond pricing). No authz on who may run LBO — UI/route layer concern.

### Coupling

| Coupled to | Notes |
|------------|-------|
| `@/features/modeling/lboModel` | Full compute API |
| Tranche **names as strings** | Tests find schedules by exact name `"Senior secured (Term Loan A)"` etc. |
| Default grid size 9×9 | Hard-coded expectation; engine resize breaks test |
| FINANCIAL_MODELING_SPEC §6 | Conceptual source |

### Risks / TODOs / gaps

1. **Tautological equity/rollover test** (lines 62–67 area): does not assert `managementRollover` amount equals residual.
2. **No absolute IRR/MOIC golden values** for base case — only inequalities and identities; engine could drift return levels.
3. **Covenant / PIK / monthly sculpting** intentionally out of scope (SUT header defers to Excel).
4. **No stress:** negative EBITDA growth, zero tranches, holdPeriod 0, cash sweep on underwater CF.
5. **Sensitivity axes values** not asserted (only shape/monotonicity).
6. **`cr` / `inrAbs` / `pctFmt` / `multipleFmt` formatters** exported by SUT but untested here.
7. Tranche name coupling is brittle if UI renames facilities.
8. No TODO/FIXME in file.

---

## Cross-file summary (batch 009)

| File | Lines | SUT module(s) | Domain | DB? | RBAC? |
|------|------:|---------------|--------|-----|-------|
| `aiSummary.test.ts` | 512 | `features/ai/{creditSummary,interactionSummary,clientInsights}` | Heuristic AI (no LLM) | No | No (loaders excluded) |
| `bondPricing.test.ts` | 481 | `features/modeling/bondPricing` | Indian FI pricing | No | No |
| `kyc.test.ts` | 429 | `features/compliance/kyc` | PMLA/RBI KYC pure rules | No | No (state machine only) |
| `lboModel.test.ts` | 193 | `features/modeling/lboModel` | LBO screening | No | No |
| **Total** | **1615** | | | | |

### Common patterns

- Framework: **Vitest** (`describe` / `it` / `expect`).
- Path alias: `@/features/...`.
- Philosophy: **pure-function pinning**; server/DB paths excluded by design.
- Assertion style: financial → `toBeCloseTo` + bounds; narrative AI → regex on strings; compliance → exact constants and booleans.
- No mocks, no MSW, no React Testing Library.

### Batch-level risks

1. **Server/DB adapters** for AI and KYC are a coverage hole relative to pure engines.
2. **Regulatory/financial specs** can change outside the repo; tests encode current research snapshot (esp. BO 10%/15%, re-KYC years).
3. **Copy-coupled AI tests** will fire on UX rewrites.
4. **Screening stubs** tested as permanently clear — production compliance depends on replacing stubs without forgetting test updates.

### Tables / DB

This batch touches **no database tables** and no Drizzle schema imports.

### Related production modules (for inventory cross-ref)

| Production path | Role relative to batch |
|-----------------|------------------------|
| `src/features/ai/creditSummary.ts` | `generateCreditSummary`, `CreditSummaryInput` |
| `src/features/ai/interactionSummary.ts` | `summarizeInteractions`, `summarizeOneInteraction` |
| `src/features/ai/clientInsights.ts` | scores + `recommendAction` |
| `src/features/ai/types.ts` | `AiPriority`, `InsightActionKind`, summary interfaces |
| `src/features/modeling/bondPricing.ts` | `computeBondMetrics`, `instrumentDefaults`, formatters |
| `src/features/modeling/lboModel.ts` | `computeLbo`, `lboDefaults` |
| `src/features/compliance/kyc.ts` | Full pure KYC API |

---

*End of agent-009 analysis. Paths relative to app root unless absolute.*
