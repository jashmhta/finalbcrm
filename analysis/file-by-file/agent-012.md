# File-by-file analysis — agent-012

Batch source: `analysis/file-by-file/batch-012.list`  
App root: `/home/Jashmhta/crm/bc-crm/app`  
Files analyzed: 4

---

## 1. `src/__tests__/scorecard.test.ts`

| Field | Value |
|---|---|
| **Path** | `src/__tests__/scorecard.test.ts` |
| **Lines** | 326 |
| **Role** | Vitest unit-test suite for credit scorecard domain logic |

### Exports
None. Pure test module (no production exports). Vitest `describe` / `it` blocks only.

### Imports

```ts
import { describe, expect, it } from "vitest";

import {
  computeScorecard,
  bandFromScore,
  defaultBaseWeights,
  resolveWeights,
  BAND_GRADE,
  BAND_PD_1Y,
  type SubFactor,
  type Band,
} from "@/features/credit/scorecard";
import { computeRatios } from "@/features/credit/ratios";
import type { FinancialStatement } from "@/db/schema";
```

**Imported types (quoted from production source):**

```ts
// from @/features/credit/scorecard
export type Band = "BC-1" | "BC-2" | "BC-3" | "BC-4" | "BC-5" | "BC-6";

export interface SubFactor {
  code: string;
  label: string;
  componentCode: string;
  weight: number;           // 0..1
  score: 1 | 2 | 3 | 4 | 5;
  inputValue: number | null;
  benchmark: string;
  justification: string;
}

export interface ComputeScorecardArgs {
  ratios: RatioSet;
  obligorType: ObligorType | string;
  overrides?: Record<string, { score: 1 | 2 | 3 | 4 | 5; justification?: string }>;
  templateWeights?: Record<string, number>;
}

export function computeScorecard(args: ComputeScorecardArgs): ScorecardResult;
export function resolveWeights(base: Record<string, number>, obligorType: ObligorType | string): Record<string, number>;
export function defaultBaseWeights(): Record<string, number>;
export function bandFromScore(score: number): Band;
export const BAND_GRADE: Record<Band, string>;
export const BAND_PD_1Y: Record<Band, number>;
```

### Business purpose
Locks invariants of Binary CRM’s internal credit scorecard (CREDIT_ANALYSIS_SPEC §4):

1. **Composite scoring** — weighted 0–100 score over sub-factors (weights sum to 1.0); formula `Σ weight × (score/5) × 100` with score ∈ {1..5}, so floor is **20**, ceiling **100**.
2. **Band mapping** — score → BC-1…BC-6 with inclusive lower bounds per spec §4.2.
3. **Weight reallocation** — for non-project (corporate) obligors, DSCR’s 7% is zeroed and split `+4% → interest_coverage`, `+3% → fcf_debt`; project/SPV retain DSCR.
4. **Quantitative auto-scoring** — ratios derived from a hand-built `FinancialStatement.lineItems` fixture drive sub-factor scores (e.g. `net_debt_ebitda ≤ 1.5 → 5`).
5. **Qualitative defaults** — non-ratio factors (e.g. `market_position`) default to neutral score **3** with a “qualitative” justification note.
6. **PD / notional grade tables** — `BAND_GRADE` labels and `BAND_PD_1Y` representative 1-year PDs are monotonic and in-range.

### Key logic

**Fixture statement** (`stmt`): `Pick<FinancialStatement, "lineItems">` with synthetic INR-ish line items:

| Line item | Value | Role in ratios |
|---|---|---|
| `revenue` | 1000 | Top-line |
| `cogs` | 600 | Cost base |
| `interest_expense` | 50 | Interest coverage |
| `pbt` | 200 | Profit before tax |
| `depreciation_amortization` | 40 | EBITDA |
| `pat` | 150 | Profit after tax |
| `total_debt` | 400 | Leverage denominators |
| `cash_and_equivalents` | 50 | Net debt |
| `net_worth` / `tangible_net_worth` | 500 / 450 | Leverage |
| `total_assets` | 1000 | ROCE capital |
| `current_assets` / `current_liabilities` | 300 / 150 | Current ratio |
| `inventory` | 100 | WC |
| `cfo` / `cfo_before_wc_changes` | 180 / 190 | FFO / FCF |
| `capex` | 60 | FCF |
| `cfads` / `debt_service` | 200 / 100 | DSCR = 2.0 |

**Helper** `allScore(score: 1|2|3|4|5)` builds full override map over every key in `defaultBaseWeights()`.

**Test groups:**

| `describe` block | Assertions |
|---|---|
| `computeScorecard - invariants` | `totalScore ∈ [0,100]`; `band === bandFromScore(totalScore)`; grade non-empty; PD ∈ [0,1]; each `SubFactor` weight ≥0, score ∈ [1,5] |
| `computeScorecard - weight reallocation (corporate)` | `eff["dscr"] === 0`; `interest_coverage ≈ 0.08+0.04`; `fcf_debt ≈ 0.05+0.03`; project retains `dscr ≈ 0.07`; sum ≈ 1.0 |
| `computeScorecard - boundary scores` | all-5 → 100 / BC-1; all-1 → 20 / BC-6 |
| `bandFromScore - thresholds` | 100/85→BC-1, 70→BC-2, 55→BC-3, 40→BC-4, 25→BC-5, 0→BC-6 |
| `bandFromScore - boundary inclusivity` | Each lower bound inclusive: 85,70,55,40,25; just-below maps down |
| `BAND_GRADE` | All bands non-empty; BC-1=`"Excellent"`; BC-6=`"Distressed / near-default"` |
| `BAND_PD_1Y` | Monotonic BC-1…BC-6; ∈[0,1]; BC-1 < 0.0005; BC-6 === 0.15 |
| `defaultBaseWeights` | Sum 1.0; each ∈[0,1]; `dscr ≈ 0.07` |
| `resolveWeights - reallocation invariants` | corporate/project/spv sum 1.0; custom `dscr:0` unchanged |
| `computeScorecard - quantitative auto-scoring` | `net_debt_ebitda` ≈1.207 score 5; interest_coverage 5; fcf_debt 5; market_position score 3 + qualitative note; dscr weight 0 for corporate |
| `computeScorecard - partial-credit mix` | all-3 → 60 / BC-3; all-4 → 80 / BC-2 |

### Side effects
- None at runtime (tests only). No I/O, no DB, no network.
- Calls pure domain functions; constructs in-memory fixture only.

### Security / RBAC
- N/A. No auth, no role checks, no PII. Tests do not exercise API boundaries.
- Scorecard itself is credit risk logic; these tests do not cover who may override scores in production.

### Coupling
- **Tight** to `@/features/credit/scorecard` (API surface, weight constants, band tables, formula).
- **Medium** to `@/features/credit/ratios` (`computeRatios`) and statement line-item keys.
- **Light** to `@/db/schema` (`FinancialStatement` type only — cast fixture).
- Breaks if: DSCR reallocation fractions change; band thresholds change; qualitative default changes from 3; sub-factor codes rename; formula floor/ceiling changes.

### Risks / TODOs
- Fixture comments hard-code expected ratio intermediates (`net_debt_ebitda ≈ 1.207`); ratio formula changes silently fail auto-scoring tests.
- Does **not** test sovereign / NBFC / bank obligor types, template weights override path, or partial (not all-subfactor) overrides.
- `BAND_PD_1Y` values are noted in source as “placeholder - spec §15 #4, to confirm” — tests lock placeholders as truth.
- No property-based / fuzz coverage of `bandFromScore` for non-integer scores.
- No test that `ScorecardResult.effectiveWeights` is returned/audited.

---

## 2. `src/__tests__/stages.test.ts`

| Field | Value |
|---|---|
| **Path** | `src/__tests__/stages.test.ts` |
| **Lines** | 519 |
| **Role** | Vitest unit-test suite for deal-type stage ladders, transition rules, and deal-type catalog flags |

### Exports
None. Pure test module.

### Imports

```ts
import { describe, expect, it } from "vitest";

import {
  DEAL_STAGE_FLOWS,
  OFF_PIPELINE_STATUSES,
  stageLadderFor,
  stageSemanticsFor,
  stageIndexInFlow,
  isOffPipelineStatus,
  canTransitionStage,
  nextStageFor,
} from "@/features/deals/stages";
import {
  DEAL_TYPE_CATALOG,
  DEAL_TYPE_DISPLAY_ORDER,
  dealTypeSpec,
  isAllocationDealType,
  isIssuerInstrumentDealType,
  defaultBrandForDealType,
  type DealType,
} from "@/features/deals/catalog";
import { dealTypeEnum, dealStatusEnum } from "@/db/schema";
```

**Imported production signatures (quoted):**

```ts
// stages.ts
export const OFF_PIPELINE_STATUSES = ["dropped", "on_hold"] as const;
export type OffPipelineStatus = (typeof OFF_PIPELINE_STATUSES)[number];

export interface DealStageFlow {
  ladder: DealStatus[];
  semantics: Partial<Record<DealStatus, string>>;
}

export const DEAL_STAGE_FLOWS: Record<DealType, DealStageFlow>;

export function stageLadderFor(dealType: DealType): DealStatus[];
export function stageSemanticsFor(dealType: DealType, status: DealStatus): string | null;
export function stageIndexInFlow(dealType: DealType, status: DealStatus | string | null | undefined): number;
export function isOffPipelineStatus(status: DealStatus | string | null | undefined): boolean;
export function canTransitionStage(
  dealType: DealType,
  from: DealStatus | string | null | undefined,
  to: DealStatus | string | null | undefined,
): boolean;
export function nextStageFor(
  dealType: DealType,
  status: DealStatus | string | null | undefined,
): DealStatus | null;

// catalog.ts
export type DealType = (typeof dealTypeEnum.enumValues)[number];
export type DealStatus = (typeof dealStatusEnum.enumValues)[number];
export const DEAL_TYPE_CATALOG: Record<DealType, DealTypeSpec>;
export const DEAL_TYPE_DISPLAY_ORDER: readonly DealType[];
export function dealTypeSpec(type: DealType): DealTypeSpec;
export function isAllocationDealType(type: DealType): boolean;
export function isIssuerInstrumentDealType(type: DealType): boolean;
export function defaultBrandForDealType(type: DealType): BrandAffinity;
// BrandAffinity = "binarycapital" | "binarybonds" | "shared"
```

### Business purpose
Exhaustive verification of Binary’s **per-deal-type pipeline ladder** and **stage-transition business rules** (aligned with `scrape/BUSINESS_CONTEXT.md` §2–3 and schema enums). Ensures:

1. Every schema `deal_type` has a catalog entry, display-order slot, and stage-flow ladder.
2. Canonical ladders for major product families (bond underwriting, HY/private placement, M&A, G-Sec auction, DCM advisory, ECM book-built, structured finance, project finance, valuation/fairness, rating advisory, portfolio management).
3. Off-pipeline statuses `dropped` + `on_hold` apply universally.
4. **Transition policy**: no forward skips; backward rework allowed; `dropped` terminal sink; `on_hold` pause/resume; same-status no-op.
5. Catalog flags: allocation-book vs advisory; issuer-instrument placement; default brand affinity (`binarybonds` vs `binarycapital`).

### Key logic

**Canonical ladders asserted:**

| Deal type(s) | Expected ladder |
|---|---|
| `bond_underwriting`, `high_yield_bond`, `private_placement_debt`, `ecm_ipo`, `ecm_fpo`, `ecm_qip`, `ecm_rights` | `lead → mandated → in_dd → structuring → rating_marketing → pricing → allocation → settled → closed` (9) |
| `m_and_a` | `lead → mandated → in_dd → structuring → pricing → closed` (no allocation/rating_marketing/settled) |
| `gsec_auction` | `lead → mandated → pricing → allocation → settled → closed` (no DD/structuring/rating) |
| `dcm_advisory` | `lead → mandated → in_dd → structuring → rating_marketing → pricing → closed` (no book) |
| `valuation`, `fairness_opinion`, `portfolio_management_mandate` | `lead → mandated → in_dd → structuring → closed` |
| `structured_finance` | has structuring + rating_marketing; **no** allocation |
| `supply_chain_finance` | shortest structured: no rating_marketing, no allocation |
| `project_finance` | rating_marketing; no allocation |
| `rating_advisory` | includes rating_marketing; no pricing/allocation |

**`canTransitionStage` rules under test:**

| Rule | Expected |
|---|---|
| `from === to` | always `true` |
| Active forward adjacent | allowed (e.g. lead→mandated) |
| Active forward skip | forbidden (lead→in_dd, lead→pricing) |
| Backward rework | allowed (pricing→in_dd, allocation→lead) |
| Any → `dropped` | allowed |
| `dropped` → anything | forbidden (except same-status) |
| Active → `on_hold` | allowed |
| `on_hold` → any active ladder stage | allowed (resume) |
| null/undefined either side | `false` |

**Catalog flag matrices:**

- **Allocation book (`isAllocationDealType`)**: true for bond_underwriting, high_yield_bond, private_placement_debt, gsec_auction, ecm_*; false for m_and_a, valuation, fairness_opinion, dcm_advisory, rating_advisory, portfolio_management_mandate, secondary_trading_advisory, project_finance, supply_chain_finance.
- **Issuer instrument (`isIssuerInstrumentDealType`)**: true for bond family + gsec + ecm + structured_finance; false for pure advisory and project/SCF.
- **Default brand**: bond products → `"binarybonds"`; ECM/M&A/structured/valuation → `"binarycapital"`.

**Semantics overrides:**
- `stageSemanticsFor("m_and_a", "structuring")` → `"Valuation & negotiation"`
- `stageSemanticsFor("gsec_auction", "pricing")` contains `"Auction bidding"`
- Generic statuses return `null`

**Schema coverage:**
- Iterates `dealTypeEnum.enumValues` and `dealStatusEnum.enumValues` so new enum values without catalog/flow entries fail CI.

### Side effects
- None. Pure in-memory assertions against domain tables and pure functions.

### Security / RBAC
- N/A at this layer. Transition validity is **business-logic only**; tests do not assert who may call transitions (role-based stage changes live in server actions / API).
- Risk if production trusts UI alone: these tests document the intended gate that server code **should** call via `canTransitionStage`.

### Coupling
- **Tight** to `@/features/deals/stages` (`DEAL_STAGE_FLOWS` structure and every ladder).
- **Tight** to `@/features/deals/catalog` (flags, brands, display order).
- **Tight** to `@/db/schema` enums (`dealTypeEnum`, `dealStatusEnum`) — adding a schema enum without domain entry fails tests (by design).
- Any product-ops change to pipelines requires coordinated edits: schema enum → catalog → stage flow → this test file.

### Risks / TODOs
- Hard-coded full ladder arrays: product changes require test + source dual updates (good for safety, noisy for refactors).
- Does **not** assert `on_hold` from off-pipeline edge cases beyond dropped terminal (e.g. closed → on_hold depends on implementation: only allowed if `stageIndexInFlow(from) >= 0`, so closed is on-ladder and **is** allowed — not explicitly tested for every terminal active stage).
- Does **not** test `canTransitionStage` with statuses that exist on other deal types but not this ladder (e.g. `allocation` on `m_and_a`) — partially covered by index checks but no dedicated case.
- No integration test that server actions actually invoke `canTransitionStage` before DB writes.
- `secondary_trading_advisory` appears only in allocation-flag false list; ladder not explicitly described beyond “every type has lead…closed”.

---

## 3. `src/app/_components/dashboard-charts-impl.tsx`

| Field | Value |
|---|---|
| **Path** | `src/app/_components/dashboard-charts-impl.tsx` |
| **Lines** | 587 |
| **Role** | Client-only recharts implementation of five dashboard visualization surfaces for the command-center home page |

### Module directive
```ts
"use client";
```

### Exports

**Types:**

```ts
export interface DealVelocityPoint {
  /** Short month label, e.g. "Jan". */
  label: string;
  /** ISO month, e.g. "2025-01". */
  key: string;
  /** Deals closed (settled/closed) that month by actual_close_date. */
  closed: number;
}

export interface SectorSlice {
  label: string;
  /** Sum of deal target_size for issuers in this sector family (INR). */
  value: number;
}

export interface CreditBandSlice {
  band: string;
  count: number;
}

export interface KycStatusSlice {
  /** Enum status, e.g. "approved". */
  status: string;
  /** Human label, e.g. "Approved". */
  label: string;
  count: number;
}

export interface InvestorTypeSlice {
  label: string;
  count: number;
}
```

**Components:**

```ts
export function DealVelocityChart({ data }: { data: DealVelocityPoint[] }): JSX
export function SectorDonut({ data }: { data: SectorSlice[] }): JSX
export function CreditScoreChart({ data }: { data: CreditBandSlice[] }): JSX
export function KycStatusChart({ data }: { data: KycStatusSlice[] }): JSX
export function InvestorTypeChart({ data }: { data: InvestorTypeSlice[] }): JSX
```

**Internal (non-exported):**
- `intFmt(n: number): string` — `en-IN` locale integer format or `"-"`
- `DONUT_COLORS` — readonly 8 CSS brand token colors
- `BAND_COLORS: Record<string, string>` — BC-1…BC-6 quality colors
- `BarFillGradient({ id, color })`
- `ChartHeader({ eyebrow, title, right? })`
- `DonutCenter({ label, value })`
- `DonutLegend({ data: { label, value }[], formatValue })`
- `EmptyChartHint({ hint })`
- `ALL_BANDS = ["BC-1", "BC-2", "BC-3", "BC-4", "BC-5", "BC-6"] as const`

### Imports

```ts
import * as React from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { compactINR } from "@/components/brand/money";
import { Eyebrow } from "@/components/brand/text";
import {
  CHART_AXIS_TICK,
  CHART_GRID_PROPS,
  CHART_SERIES,
  ChartTooltip,
} from "@/components/brand/chart-theme";
```

### Business purpose
Renders the **five secondary dashboard charts** beside the hero exposure chart:

1. **DealVelocityChart** — monthly closed-mandate count (last 12 months), emerald gradient bars, total in header.
2. **SectorDonut** — portfolio exposure by issuer sector (INR `target_size` sum), center total via `compactINR`.
3. **CreditScoreChart** — distribution of internal credit analyses across BC-1…BC-6; always fills full ladder (zeros for missing bands); bar colors encode quality (emerald → red).
4. **KycStatusChart** — KYC verification status counts (donut + legend).
5. **InvestorTypeChart** — investor mandate-type breakdown (donut + legend).

All props are **serializable** (data arrays + scalars, no function props) so a Server Component page can pass them through the dynamic-import wrapper.

### Key logic

**Shared presentation patterns:**
- Header: `Eyebrow` + title + optional right scalar.
- Brand chart theme: hairline grid (`CHART_GRID_PROPS`), mono ticks (`CHART_AXIS_TICK`), `ChartTooltip` double-bezel.
- Animation: `animationDuration={900}`, `animationEasing="ease-out"`.
- Empty states: Fraunces-style italic hint via `EmptyChartHint` (DESIGN_SYSTEM §6), never generic “No data.”

**DealVelocityChart:**
- `React.useId()` sanitized for SVG gradient id (`velocity-fill-${id}`).
- Total closed = `sum(data.closed)`.
- Bar fill = vertical linearGradient over `CHART_SERIES.emerald`.
- Tooltip formats integers with `intFmt`.

**SectorDonut / KycStatusChart / InvestorTypeChart:**
- Donut: `innerRadius="62%"`, `outerRadius="92%"`, `paddingAngle={1.5}`, stroke `var(--surface)`.
- Slice colors cycle `DONUT_COLORS[i % length]`.
- `hasData = data.length > 0 && total > 0`; empty → hint only.
- KYC/Investor map `{count}` → `{value}` for shared Pie + legend shape.

**CreditScoreChart:**
```ts
const byBand = new Map(data.map((d) => [d.band, d.count] as const));
const ordered = ALL_BANDS.map((b) => ({
  band: b,
  count: byBand.get(b) ?? 0,
}));
```
- Stable BC-1…BC-6 order regardless of sparse server data.
- Per-bar `Cell` fill from `BAND_COLORS` (fallback emerald).

**Palette constants:**

```ts
const DONUT_COLORS = [
  "var(--gold)", "var(--emerald)", "var(--info)", "var(--up)",
  "var(--gold-deep)", "var(--emerald-deep)", "var(--down)",
  "color-mix(in oklch, var(--foreground) 32%, transparent)", // "Other"
] as const;

const BAND_COLORS: Record<string, string> = {
  "BC-1": "var(--emerald)",
  "BC-2": "color-mix(in oklch, var(--emerald) 78%, var(--gold))",
  "BC-3": "var(--gold)",
  "BC-4": "var(--gold-deep)",
  "BC-5": "color-mix(in oklch, var(--down) 58%, var(--gold-deep))",
  "BC-6": "var(--down)",
};
```

### Side effects
- Client-side React render only; pulls **recharts** into the client bundle if this module is imported.
- SVG gradient defs in bar charts; DOM layout for donut centers (`absolute inset-0`).
- No fetch, no mutations, no localStorage.
- Accessibility: donut center marked `aria-hidden`; legend uses semantic `<ul>/<li>`; skeleton in wrapper is `aria-hidden`.

### Security / RBAC
- Presentation-only; assumes parent page already scoped data to the authenticated user’s permitted universe.
- No client-side filtering by role — if over-privileged aggregates are passed, they render as-is.
- No XSS sinks beyond React’s normal text interpolation of `label`/`band`/`status` strings (treat server labels as trusted).

### Coupling
- **Hard** dependency on recharts (must not be imported from Server Components / shared layouts).
- Brand system: `@/components/brand/{money,text,chart-theme}` and CSS variables (`--gold`, `--emerald`, `--surface`, etc.).
- Paired with `dashboard-charts.tsx` (lazy wrapper); type contracts re-exported from wrapper for RSC consumers.
- Implicit contract with dashboard page aggregations: shape of velocity series, sector INR sums, credit band counts, KYC enum statuses, investor types.
- Credit bands align with scorecard domain (`BC-1`…`BC-6`) but file does not import scorecard module.

### Risks / TODOs
- Comment warns: **Do NOT import this module from a server component** — accidental direct import inflates first-load JS.
- `CreditBandSlice.band` is `string`, not typed as `"BC-1"|…|"BC-6"` — unknown bands fall off the ordered chart (only counted if they match ALL_BANDS keys; extras are dropped from display).
- Donut legend two-column layout may overflow with many slices / long labels (truncate only).
- No unit tests for these presentational components in this batch.
- Animation always on (`isAnimationActive`) — may annoy reduced-motion users (no `prefers-reduced-motion` handling).
- Sector “Other” relies on server already collapsing tails into last slice for the muted 8th color semantics.

---

## 4. `src/app/_components/dashboard-charts.tsx`

| Field | Value |
|---|---|
| **Path** | `src/app/_components/dashboard-charts.tsx` |
| **Lines** | 97 |
| **Role** | Client wrapper: `next/dynamic` with `ssr: false` for each dashboard chart so recharts loads in a lazy post-paint chunk |

### Module directive
```ts
"use client";
```

### Exports

**Type re-exports (erased at compile; safe for RSC type plumbing):**

```ts
export type {
  DealVelocityPoint,
  SectorSlice,
  CreditBandSlice,
  KycStatusSlice,
  InvestorTypeSlice,
} from "./dashboard-charts-impl";
```

**Component re-exports (lazy):**

```ts
export const DealVelocityChart = DealVelocityChartLazy;   // dynamic → DealVelocityChart
export const SectorDonut = SectorDonutLazy;               // dynamic → SectorDonut
export const CreditScoreChart = CreditScoreChartLazy;     // dynamic → CreditScoreChart
export const KycStatusChart = KycStatusChartLazy;         // dynamic → KycStatusChart
export const InvestorTypeChart = InvestorTypeChartLazy;   // dynamic → InvestorTypeChart
```

Each is:

```ts
dynamicImport(
  () => import("./dashboard-charts-impl").then((m) => m.<NamedExport>),
  { ssr: false, loading: () => <ChartSkeleton bodyClass="..." /> },
);
```

### Imports

```ts
import dynamicImport from "next/dynamic";
import * as React from "react";
// type-only re-export from ./dashboard-charts-impl (no runtime import of recharts via types)
```

### Business purpose
Architectural boundary for the `/` dashboard:

- Dashboard page is a **Server Component** and cannot use `next/dynamic` with `ssr: false` directly.
- This `"use client"` module owns the dynamic imports so the server page imports **wrapper client references** only.
- recharts implementation in `dashboard-charts-impl.tsx` is fetched **after hydration**, keeping first-load JS for `/` lean.
- All five dynamics reference the **same impl module**, so the bundler produces **one shared recharts vendor chunk**; loading any chart caches it for the others.
- Loading skeletons reserve header + body height to prevent CLS in the bento layout.

### Key logic

**`ChartSkeleton` (internal):**

```ts
function ChartSkeleton({ bodyClass = "h-[220px] md:h-[250px]" }: { bodyClass?: string })
```

- Pure markup placeholders (eyebrow bar, title bar, optional right scalar bar, pulsing chart body).
- `aria-hidden` — decorative while content loads.
- Per-chart `bodyClass` heights match impl reserved heights:

| Chart | Skeleton bodyClass |
|---|---|
| DealVelocityChart | `h-[220px] md:h-[260px]` |
| SectorDonut | `h-[180px] md:h-[200px]` |
| CreditScoreChart | `h-[220px] md:h-[250px]` |
| KycStatusChart | `h-[180px] md:h-[200px]` |
| InvestorTypeChart | `h-[180px] md:h-[200px]` |

**Dynamic import pattern:**
```ts
const XLazy = dynamicImport(
  () => import("./dashboard-charts-impl").then((m) => m.X),
  { ssr: false, loading: () => <ChartSkeleton bodyClass="..." /> },
);
```

### Side effects
- On client mount/use: network fetch of lazy chunk containing recharts + impl.
- Skeleton flash until chunk loads.
- No data fetching; props still flow from parent.

### Security / RBAC
- None inherent. Same as impl: trusts parent-passed aggregates.
- Does not introduce new attack surface beyond dynamic code loading of first-party module.

### Coupling
- **1:1** with `./dashboard-charts-impl` (named exports must stay aligned).
- Consumers: dashboard home page (and any RSC that needs typed chart props without importing recharts).
- Depends on Next.js `next/dynamic` API and client-boundary rules for this Next version (see project `AGENTS.md` / `node_modules/next/dist/docs/`).
- If a new chart is added to impl, this file must add a matching dynamic export + skeleton height.

### Risks / TODOs
- Five nearly identical dynamic blocks — repetitive; a factory would DRY but may confuse tree-shaking/chunk naming (current explicit form is intentional).
- `ssr: false` means charts never server-render (SEO/empty for bots on home charts — acceptable for authenticated CRM).
- Skeleton heights must stay in sync with impl chart container heights or CLS returns.
- Failure to load chunk: no explicit error UI (Next dynamic default); only loading skeleton.
- Type re-export path is correct for compile-time only; accidental value import of impl from a server file would still pull recharts if someone bypasses this wrapper.

---

## Cross-file relationships (batch-012)

```
scorecard.test.ts  ──tests──►  @/features/credit/scorecard (+ ratios, schema types)
stages.test.ts     ──tests──►  @/features/deals/stages + catalog (+ schema enums)

dashboard-charts.tsx  ──dynamic import (ssr:false)──►  dashboard-charts-impl.tsx
       ▲                                                      │
       │ type re-export                                       │ recharts + brand theme
       │                                                      ▼
  dashboard Server Component page                    five chart UIs (velocity,
  (not in this batch)                                sector, credit, kyc, investor)
```

**Domain alignment note:** Credit scorecard tests define BC-1…BC-6 semantics; `CreditScoreChart` visualizes the same band ladder. No direct import between credit domain and dashboard charts — coupling is by string convention (`"BC-1"` … `"BC-6"`).

**No TODOs/FIXME comments** found inside any of the four batch files themselves.

---

## Summary table

| Path | Lines | Kind | Primary domain | Side effects | RBAC |
|---|---:|---|---|---|---|
| `src/__tests__/scorecard.test.ts` | 326 | Vitest | Credit scorecard §4 | None | N/A |
| `src/__tests__/stages.test.ts` | 519 | Vitest | Deal pipelines / catalog | None | N/A (documents intended gate) |
| `src/app/_components/dashboard-charts-impl.tsx` | 587 | Client UI | Dashboard charts | recharts render | Data trust parent |
| `src/app/_components/dashboard-charts.tsx` | 97 | Client wrapper | Lazy-load boundary | Lazy chunk fetch | Data trust parent |
