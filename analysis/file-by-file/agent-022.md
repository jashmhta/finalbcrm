# Agent 022 — File-by-file analysis

**Batch:** `batch-022.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Domain:** Credit analysis detail UI — overview page, summary KPI header, run-score action button, and analytical workspace  

---

## 1. `src/app/credit/[id]/credit-summary-header.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/credit/[id]/credit-summary-header.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/credit/[id]/credit-summary-header.tsx` |
| **Lines** | 288 |
| **Directive** | `"use client"` |
| **Role** | Presentational client component — three-tile hero KPI strip for the credit detail **Overview** tab (internal score, internal band, indicative 1-yr PD). Pure UI; no data fetching, no server actions. |

### Exports

```ts
export function CreditSummaryHeader({
  score,
  band,
  bandGrade,
  pdPct,
  pdRange,
  scoreTone,
  hasScorecard,
}: CreditSummaryHeaderProps): JSX.Element
```

**Props interface (module-private, not exported):**

```ts
type HeaderTone = "up" | "gold" | "down" | "default";
type MarkTone = "emerald" | "gold" | "down" | "neutral";

interface CreditSummaryHeaderProps {
  score: number | null;
  band: string | null;
  bandGrade: string | null;
  /** Indicative 1-yr PD expressed as a percent (e.g. 0.012 for 0.012%). */
  pdPct: number | null;
  pdRange: string | null;
  scoreTone: HeaderTone;
  /** Whether a live scorecard exists - tunes the empty-state copy. */
  hasScorecard: boolean;
}
```

**Internal (non-exported) helpers / components:**

| Name | Signature / shape | Purpose |
|------|-------------------|---------|
| `EASE` | `readonly [0.32, 0.72, 0, 1]` | Shared cubic-bezier for framer-motion |
| `useCountUp` | `(value: number, duration?: number) => number` | Hook: animates 0 → `value` via framer-motion `animate` |
| `ScoreCountUp` | `({ value, className }: { value: number; className?: string })` | Renders animated score to 1 decimal; guards NaN/Infinity → `"-"` |
| `toneAmbient` | `(tone: HeaderTone) => "emerald" \| "gold" \| undefined` | Maps tone → Card ambient halo |
| `toneText` | `(tone: HeaderTone) => string` | Maps tone → Tailwind text class (`text-up` / `text-gold` / `text-down` / `text-foreground`) |
| `toneMark` | `(tone: HeaderTone) => MarkTone` | Maps tone → IconTile / mark tone |
| `VALUE_SIZE` | CSS clamp class string | Shared large-value typography |
| `TileBody` | `({ children })` | Flex column padding shell |
| `TileTop` | `({ children })` | Eyebrow + icon row |
| `TileValueArea` | `({ children })` | Value + caption stack |
| `EmptyTileValue` | `({ label, hint }: { label: string; hint: string })` | Designed empty state (Fraunces-scale editorial line + muted hint) |

### Imports

| Import | From | Usage |
|--------|------|--------|
| `* as React` | `react` | `useState`, `useEffect`, `ReactNode` |
| `motion`, `animate` | `framer-motion` | Mount y-rise on tiles; score count-up |
| `ChartLineUp` | `@phosphor-icons/react` | Score tile IconTile glyph |
| `cn` | `@/lib/utils` | Class merge |
| `Card`, `Eyebrow`, `IconTile`, `RatingLadderMark`, `ExposureGaugeMark` | `@/components/brand` | Brand shell + marks |

### Business purpose

Renders the Overview tab’s **three instrument tiles** for a credit analysis file:

1. **Internal score** (0–100 weighted) — lit hero with count-up animation and tone-aware coloring.
2. **Internal band** (BC-1…BC-6 style label + grade caption).
3. **Indicative 1-yr Probability of Default** — percent to 3 decimals + band PD range caption.

Parent server page (`page.tsx`) derives score/band/PD from the credit engine and passes **serializable props only** (no function props across the RSC boundary). When data is missing, each tile shows intentional “Awaiting …” copy rather than a bare em-dash in giant mono type.

### Key logic

1. **Score count-up** (`useCountUp` + `ScoreCountUp`):
   - On mount / when `value` changes, framer-motion `animate(0, value, { duration: 1.1, ease: EASE })` updates local state.
   - Cleanup stops the animation controls.
   - Display: `display.toFixed(1)` only if `Number.isFinite(display)`; else `"-"`.
   - `aria-live="polite"` on the score span.

2. **Tone derivation**:
   - Score ambient: if `score !== null` use `toneAmbient(scoreTone)`; else force `"gold"` (awaiting object still reads as intentional/lit).
   - PD tone tracks score tone: `down` if score is down, `up` if score is up, else `default`.

3. **Empty states**:
   - Score missing + `hasScorecard`: “A scorecard exists - re-run to refresh…”
   - Score missing + no scorecard: “Run the scorecard to weight this obligor 0-100.”
   - Band missing: “The internal BC band derives from the weighted scorecard.”
   - PD missing: “Indicative 1-yr Probability of Default derives from the internal band.”

4. **Motion**:
   - Three `motion.div` wrappers with staggered delays `0 / 0.06 / 0.12`, `initial={{ y: 10 }}` → `animate={{ y: 0 }}` — opacity stays fully visible on mount (no whileInView gate).

5. **PD display**: `pdPct.toFixed(3) + "%"` when present.

### Side effects

| Effect | Description |
|--------|-------------|
| Client animation subscription | `useCountUp` runs framer-motion `animate` in `useEffect`; stops on unmount |
| DOM re-renders | Local state for animated score digits only |

**No** network I/O, cookies, DB, router mutations, or server actions.

### Security / RBAC

- **None in-component.** Pure presentational.
- Auth / visibility enforced by parent server page (`requireUser` + `getCreditAnalysisDetail`).
- Props may contain sensitive credit metrics (score, band, PD) — already gated server-side before render.
- No XSS surface beyond standard React text interpolation of numbers/strings.

### Coupling

| Depends on | Direction | Notes |
|------------|-----------|--------|
| Parent `page.tsx` | parent → this | Sole consumer; passes precomputed KPI props |
| `@/components/brand` | UI system | Card, Eyebrow, IconTile, RatingLadderMark, ExposureGaugeMark |
| `framer-motion` | animation | Count-up + tile entrance |
| Score/band/PD engines | indirect | Values computed in parent via `computeScorecard`, `BAND_GRADE`, `BAND_PD_1Y`, `BAND_PD_RANGE` |

Does **not** import credit features, actions, or queries.

### Risks / TODOs

| Severity | Item |
|----------|------|
| Low | `band` is typed `string \| null` rather than `Band` — parent already validates BC bands, but this component would render any string. |
| Low | Count-up always restarts from 0 on every `value` change (including navigation soft-refresh after re-score); expected UX, not a bug. |
| Info | Comment at L159 has a Chinese character fragment (“语义”) in an English comment — cosmetic only. |
| Info | No unit tests colocated. |
| None | No TODO/FIXME markers in file. |

---

## 2. `src/app/credit/[id]/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/credit/[id]/page.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/credit/[id]/page.tsx` |
| **Lines** | 1150 |
| **Directive** | None (React Server Component) |
| **Role** | Next.js App Router **credit analysis detail page** — tabbed file view for a single credit analysis (`/credit/[id]`). Orchestrates data load, score/band resolution, and seven tabs: overview, financials, ratios, scorecard, ratings, exposure & limits, committee. |

### Exports

```ts
export const dynamic = "force-dynamic";

export default async function CreditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element>
```

**Internal (non-exported) constants / helpers / components:**

| Name | Signature / shape | Purpose |
|------|-------------------|---------|
| `BAND_BADGE` | `Record<string, BadgeProps["variant"]>` | BC-1…BC-6 → badge color |
| `bandVariant` | `(band: string \| null) => BadgeProps["variant"]` | Safe badge lookup |
| `fmt` | `(v: string \| null \| undefined, opts?: { pct?: boolean; cr?: boolean }) => string` | Number format: plain / % / ₹ Cr |
| `fmtDate` | `(d: Date \| string \| null \| undefined) => string` | `en-IN` short date |
| `KEY_RATIOS` | inline in page body: `{ label; code: keyof RatioSet; unit }[]` | 8 headline ratios for overview grid |
| `VALID_BANDS` | `ReadonlySet<Band>` | `BC-1`…`BC-6` validation set |
| `Readout` | `({ label, value, tone?, hint? })` | Compact mono KPI tile for scorecard header |
| `ScorePill` | `({ score: number })` | 1–5 sub-factor badge (`emerald` ≥4, `down` ≤2) |

**`BAND_BADGE` map (quoted):**

```ts
const BAND_BADGE: Record<string, BadgeProps["variant"]> = {
  "BC-1": "emerald",
  "BC-2": "emerald",
  "BC-3": "gold",
  "BC-4": "info",
  "BC-5": "down",
  "BC-6": "down",
};
```

**`KEY_RATIOS` codes (quoted):**

```ts
// net_debt_ebitda, debt_ebitda, interest_coverage, current_ratio,
// ebitda_margin, roce, dscr, ffo_debt
```

### Imports

| Import | From | Role |
|--------|------|------|
| `Link` | `next/link` | Workspace navigation |
| `notFound` | `next/navigation` | 404 when analysis missing / not visible |
| Icons (`ArrowRightIcon`, `WarningIcon`, `ChartLineUpIcon`, `ScalesIcon`, `CoinsIcon`, `SparkleIcon`) | `@/app/credit/credit-icons` | Tab/table empty-state glyphs |
| `ShieldCheck` | `@/components/brand/icons` | **Imported but unused** in current file |
| `requireUser` | `@/lib/rbac` | Auth gate |
| `getCreditAnalysisDetail` | `@/features/credit/queries` | Aggregated detail query |
| `computeScorecard`, `BAND_GRADE`, `BAND_PD_1Y`, `type Band` | `@/features/credit/scorecard` | Live scorecard + band grade/PD tables |
| `ALL_RATIO_CODES`, `formatRatio`, `ratioCategory`, `type RatioSet` | `@/features/credit/ratios` | Full ratio library + formatting |
| `bandToAgencySymbol`, `AGENCIES`, `BAND_PD_RANGE` | `@/features/credit/ratingMap` | Agency mapping table + PD ranges |
| Brand UI suite | `@/components/brand` | Card, Table, Tabs, Badge, ScoreRing, StatCard, EmptyState, etc. |
| `type BadgeProps` | `@/components/brand` | Badge variant typing |
| `AddFinancialStatementForm` | `./add-fs-form` | Financials tab form |
| `CommitteeForm` | `./committee-form` | Committee tab form |
| `RunScoreButton` | `./run-score-button` | Trigger ratio+score recompute |
| `CreditSummaryHeader` | `./credit-summary-header` | Overview KPI tiles |
| `PageShell`, `PageHeader`, `DetailTopBar` | `@/components/brand/page-shell` | Page chrome |

### Business purpose

Single-analysis **credit file** for analysts:

- Identify the obligor (party legal name, sector, obligor type, analysis type).
- View / recompute **internal score & BC band** and **indicative 1-yr PD**.
- Manage **financial statements** (list + JSON line-item add form).
- Inspect **ratio library** (all ratio codes for latest period).
- Inspect **weighted scorecard** sub-factors (1–5 scores, weights, benchmarks, justifications).
- Review **external agency ratings** and the full **internal band → agency symbol** advisory matrix.
- Review **exposures** and **credit limits** (firm economic exposure, headroom).
- Capture **credit committee** state via `CommitteeForm` (spec §9 quorum narrative in UI copy).

Deep-link into the richer analytical **workspace** at `/credit/${id}/workspace`.

### Key logic

#### Auth + data load

```ts
const user = await requireUser();
const { id } = await params;
const detail = await getCreditAnalysisDetail(id, user);
if (!detail) notFound();
```

Destructures:

```ts
{
  analysis: a,
  party: p,
  sector,
  financialStatements,
  ratiosByStatement,
  latestRatioSet,
  scorecard: sc,
  externalRatingsEnriched,
  exposures,
  limits,
}
```

#### Live scorecard + band resolution (critical correctness path)

```ts
const liveScorecard =
  latestRatioSet !== null
    ? computeScorecard({
        ratios: latestRatioSet as RatioSet,
        obligorType: a.obligorType,
      })
    : null;
```

**Band resolution** intentionally does **not** trust persisted agency symbols as BC bands:

```ts
const VALID_BANDS: ReadonlySet<Band> = new Set([
  "BC-1", "BC-2", "BC-3", "BC-4", "BC-5", "BC-6",
]);
const persistedScore = a.currentCreditScore ? Number(a.currentCreditScore) : null;
const score = persistedScore ?? liveScorecard?.totalScore ?? null;
const persistedBand =
  sc?.band && VALID_BANDS.has(sc.band as Band) ? (sc.band as Band) : null;
const ratingBand =
  a.internalRatingShort && VALID_BANDS.has(a.internalRatingShort as Band)
    ? (a.internalRatingShort as Band)
    : null;
const band: Band | null =
  (liveScorecard?.band as Band | undefined) ?? persistedBand ?? ratingBand;
```

Comment documents a past bug: `scorecard.band` / `internal_rating_short` can hold **agency symbols** (e.g. `"AAA"`), which made `BAND_GRADE` / `BAND_PD_1Y` lookups return `undefined` and PD tile show `"NaN%"`.

#### Score tone thresholds

```ts
// score >= 70 → "up"
// score >= 55 → "gold"
// score >= 40 → "default"
// else → "down"
// null → "default"
```

#### Derived summary props

```ts
const bandGrade = band ? BAND_GRADE[band] : null;
const pdPct = band ? BAND_PD_1Y[band] * 100 : null;  // engine stores fraction; UI wants %
const pdRangeLabel = band ? BAND_PD_RANGE[band] : null;
```

#### Aggregates

```ts
const totalExposure = exposures.reduce(
  (acc, e) => acc + (Number(e.netExposure) || 0), 0,
);
const totalLimits = limits.reduce(
  (acc, l) => acc + (Number(l.limitAmount) || 0), 0,
);
```

#### Tab structure (7 tabs)

| Tab value | Content |
|-----------|---------|
| `overview` | `CreditSummaryHeader` + key ratio grid + `RunScoreButton` |
| `financials` | FS table (`credit_analysis_fs_link`) + `AddFinancialStatementForm` |
| `ratios` | Full `ALL_RATIO_CODES` table for latest period |
| `scorecard` | `ScoreRing` + Readouts + sub-factor table + `RunScoreButton` |
| `ratings` | External ratings table + band→agency matrix (`AGENCIES` × BC-1…BC-6) |
| `exposure` | StatCards totals + exposure table + limits table |
| `committee` | Current action/watchlist/recommendation + `CommitteeForm` |

#### Scorecard UI details

- `ScoreRing` value = `liveScorecard.totalScore`, band tone derived from BC-1/2 emerald, BC-3 gold, BC-4 neutral, else down.
- Sub-factor table columns: Sub-factor, Weight (%, hidden &lt; md), Score (`ScorePill`), Input (`formatRatio`), Benchmark (hidden &lt; md), Justification (hidden &lt; lg).
- Formula stated in UI: `total = Σ weight × (score/5) × 100` (spec §4.1).

#### Ratings advisory matrix

```ts
(["BC-1","BC-2","BC-3","BC-4","BC-5","BC-6"] as const).map((b) =>
  AGENCIES.map((ag) => bandToAgencySymbol(b, ag.code))
)
// active row when band === b; wound-down agencies flagged
```

#### Committee copy (spec §9)

Quorum rules rendered in description:

- chair + 1 (≤ ₹50 Cr)
- full quorum (₹50–250 Cr)
- full + board (&gt; ₹250 Cr)

Form receives:

```ts
<CommitteeForm
  analysisId={id}
  currentAction={a.internalRatingAction}
  currentRecommendation={a.recommendation}
  watchlist={a.watchlistFlag}
/>
```

#### Formatters

- `fmt(v, { pct: true })` → `(n * 100).toFixed(2)%`
- `fmt(v, { cr: true })` → `₹${n.toFixed(2)} Cr`
- `fmtDate` → `en-IN` numeric day + short month + year

### Side effects

| Effect | When | Description |
|--------|------|-------------|
| Auth redirect | `requireUser()` | Unauthenticated → `/login` (via rbac) |
| DB reads | `getCreditAnalysisDetail` | Analysis, party, sector, FS links, ratios, scorecard, ratings, exposures, limits |
| Pure compute | `computeScorecard` | In-process; no persistence |
| `notFound()` | Missing / invisible analysis | Next.js 404 |
| Client mutations (child) | User clicks Run / forms | Via `RunScoreButton`, `AddFinancialStatementForm`, `CommitteeForm` — not in this file |

`export const dynamic = "force-dynamic"` disables static rendering for this route.

### Security / RBAC

| Control | Detail |
|---------|--------|
| Authentication | `await requireUser()` — must be logged-in CRM user |
| Authorization / visibility | `getCreditAnalysisDetail(id, user)` applies `creditVisibilityClause(user)` (party scope / brand / permissions) |
| Write actions | Not performed here; delegated buttons/forms enforce `can(user, "write", "credit")` inside server actions (e.g. `runRatiosAndScore`) |
| IDOR | Mitigated by visibility clause + soft-delete filters in query; invalid/hidden id → `notFound()` |
| Secrets | No secrets rendered; financial figures are business-sensitive data behind auth |

### Coupling

| Peer | Coupling strength | Notes |
|------|-------------------|--------|
| `@/features/credit/queries` | High | Single source for detail aggregate |
| `@/features/credit/scorecard` | High | Live recompute + BAND_GRADE / BAND_PD_1Y |
| `@/features/credit/ratios` | High | Ratio library display |
| `@/features/credit/ratingMap` | Medium | Agency matrix |
| `./credit-summary-header` | High | Overview KPIs |
| `./run-score-button` | High | Recompute trigger (3 placements) |
| `./add-fs-form` | High | FS creation |
| `./committee-form` | High | Committee workflow writes |
| `./workspace/page.tsx` | Navigation | “Open workspace” link |
| `@/components/brand/*` | High | Full design-system surface |
| Spec docs (CREDIT_ANALYSIS_SPEC §§3,4.1,5,7,9) | Documentary | Referenced in UI copy only |

**Tables / entities touched (via query, not direct):**  
`credit_analysis`, `party`, sector lookup, `financial_statement` via `credit_analysis_fs_link`, `ratio_result`, scorecard tables, external ratings / `rating_ladder`, exposure, credit limits.

### Risks / TODOs

| Severity | Item |
|----------|------|
| Medium | **Score preference:** `score = persistedScore ?? liveScorecard?.totalScore` — if `currentCreditScore` is stale vs live ratios, Overview header may disagree with Scorecard tab (which always uses `liveScorecard`). Workspace prefers live first for totalScore (opposite order). Inconsistency across pages. |
| Medium | **Unused imports:** `ShieldCheck`, `SectionHeading` — dead imports (lint noise / tree-shaking only). |
| Low | `latestRatioSet as RatioSet` / `sc.band as Band` casts — runtime guarded for bands; ratio shape assumed correct from query. |
| Low | Exposure/limit sums use `Number(...) \|\| 0` — non-numeric strings become 0 silently. |
| Low | Currency formatting assumes ₹ Cr display for exposures/limits regardless of `currencyCode` column (display inconsistency for non-INR). |
| Low | No page-level role check beyond auth + visibility (read-all vs scoped is inside query). |
| Info | Large monorepo-style page (~1150 lines) — many local presentational helpers; hard to unit-test without extraction. |
| None | No TODO/FIXME markers in file. |

---

## 3. `src/app/credit/[id]/run-score-button.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/credit/[id]/run-score-button.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/credit/[id]/run-score-button.tsx` |
| **Lines** | 68 |
| **Directive** | `"use client"` |
| **Role** | Client control that invokes the **ratio + scorecard recompute** server action for a given analysis and surfaces success (score → band) or error inline. |

### Exports

```ts
export function RunScoreButton({
  analysisId,
  variant = "primary-gold",
  size = "md",
  className,
}: {
  analysisId: string;
  variant?: "primary-emerald" | "primary-gold" | "secondary-hairline";
  size?: "sm" | "md" | "lg";
  className?: string;
}): JSX.Element
```

No other exports. No internal subcomponents.

### Imports

| Import | From | Usage |
|--------|------|--------|
| `* as React` | `react` | `useState` |
| `useTransition` | `react` | Pending UI for server action |
| `Sparkle`, `CheckCircle`, `Warning` | `@phosphor-icons/react` | Button leading icon; success/error glyphs |
| `cn` | `@/lib/utils` | Wrapper class merge |
| `Button` | `@/components/brand` | Brand button |
| `runRatiosAndScore`, `type RunRatiosState` | `@/features/credit/actions` | Server action + result type |

**`RunRatiosState` (from actions, quoted for coupling):**

```ts
export type RunRatiosState =
  | { error?: string }
  | { ok?: boolean; score?: number; band?: string }
  | undefined;
```

### Business purpose

Analyst affordance to **recompute ratios and internal scorecard** for one credit analysis without leaving the page. Used on:

- Detail Overview (key ratios card)
- Detail Scorecard tab
- Workspace top bar and instrument panel

Label: **“Run ratios + score”** / pending **“Running…”**.

### Key logic

```ts
const [isPending, startTransition] = useTransition();
const [result, setResult] = React.useState<RunRatiosState>(undefined);

// onClick:
startTransition(async () => {
  const r = await runRatiosAndScore(analysisId);
  setResult(r);
});
```

- Action takes **single `analysisId` string** (not FormData) — invoked directly inside transition.
- Button `disabled={isPending}`.
- Error branch: `"error" in result && result.error` → red (`text-down`) warning + message.
- Success branch: `"ok" in result && result.ok` → gold status with score (1 decimal if finite) and band:
  - `Scored {score.toFixed(1)} → {band}`
  - `role="status"` + `aria-live="polite"`.

Does **not** call `router.refresh()` itself — any UI refresh of server-rendered scores depends on server-action revalidation inside `runRatiosAndScore` (or residual stale UI until navigation). Result strip is the immediate local feedback.

### Side effects

| Effect | Description |
|--------|-------------|
| Server action | `runRatiosAndScore(analysisId)` — DB write of ratios/scorecard (and related analysis fields) on server |
| Local state | Stores last `RunRatiosState` until next click / remount |
| Transition | React concurrent pending flag for disabled button |

No cookies/localStorage; no client-side computation of scores.

### Security / RBAC

| Control | Where |
|---------|--------|
| Auth | Inside `runRatiosAndScore` via `requireUser()` |
| Authorization | `can(user, "write", "credit")` — else `{ error: "You do not have permission to run the scorecard." }` |
| Existence | Analysis not found / no FS → error string returned |
| Client | Only passes `analysisId`; cannot escalate privileges from props alone |

**Note:** Button is still **visible** to users without write permission; failure is soft (inline error), not pre-hidden. Read-only users may click and receive permission error.

### Coupling

| Peer | Notes |
|------|--------|
| `@/features/credit/actions.runRatiosAndScore` | Sole business dependency |
| Consumers | `page.tsx` (multiple), `workspace/page.tsx` (multiple) |
| Brand `Button` | Variant/size contract must stay aligned |

### Risks / TODOs

| Severity | Item |
|----------|------|
| Medium | **No automatic page refresh in this component** — if the server action does not `revalidatePath` / `updateTag`, Overview tiles and tables remain stale after success until hard navigation. Success strip can show a new score while RSC siblings still show old values. |
| Low | Result state is never cleared on re-click until new result arrives (OK); remount clears it. |
| Low | Discriminated union checks use `"error" in result` / `"ok" in result` — both branches of the union can theoretically have optional fields; works with current action return shapes. |
| Low | Button shown without client-side permission check (UX only). |
| None | No TODO/FIXME markers. |

---

## 4. `src/app/credit/[id]/workspace/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/credit/[id]/workspace/page.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/credit/[id]/workspace/page.tsx` |
| **Lines** | 1555 |
| **Directive** | None (React Server Component) |
| **Role** | Next.js **credit analytical workspace** page (`/credit/[id]/workspace`) — multi-period ratio canvas, signals header, sticky scorecard instrument, rating ladder, exposure utilization, sub-factor table, score progression, and collapsed line-item spreading (“source data”). |

### Exports

```ts
export const dynamic = "force-dynamic";

export default async function CreditWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element>
```

### Module-level constants / types (quoted)

#### `SPREADING_ROWS`

```ts
const SPREADING_ROWS: { group: string; code: LineItemCode; label: string }[] = [
  // P&L: revenue, cogs, ebit, depreciation_amortization, ebitda, interest_expense, pbt, pat
  // Balance sheet: total_debt, cash_and_equivalents, marketable_securities, current_assets,
  //   current_liabilities, inventory, trade_receivables, trade_payables, total_assets,
  //   net_worth, tangible_net_worth
  // Cash flow: cfo, cfo_before_wc_changes, capex, dividends_paid
  // Project / SPV: cfads, debt_service
];
```

(25 line-item rows across 4 groups.)

#### `LADDER_RUNGS` (18-rung AAA→D)

```ts
const LADDER_RUNGS: { rank: number; symbol: string; band: Band }[] = [
  { rank: 1, symbol: "AAA", band: "BC-1" },
  { rank: 2, symbol: "AA+", band: "BC-1" },
  { rank: 3, symbol: "AA", band: "BC-2" },
  // ... through ...
  { rank: 18, symbol: "D", band: "BC-6" },
];
```

#### `BAND_TONE`

```ts
const BAND_TONE: Record<Band, "emerald" | "gold" | "info" | "down"> = {
  "BC-1": "emerald",
  "BC-2": "emerald",
  "BC-3": "gold",
  "BC-4": "info",
  "BC-5": "down",
  "BC-6": "down",
};
```

#### Analytical `SECTIONS` (`SectionDef`)

```ts
type SectionMark = "ratingLadder" | "exposure" | "chartLineUp" | "coins";

interface SectionDef {
  key: string;
  title: string;
  caption: string;
  mark: SectionMark;
  markTone: IconTone;
  sparkTone: SparklineTone;
  metrics: { code: keyof RatioSet; label: string }[];
  subFactorCodes: string[];
}
```

| Section key | Metrics (RatioSet keys) | Sub-factor codes rolled up |
|-------------|-------------------------|----------------------------|
| `profitability` | `ebitda_margin`, `operating_margin`, `pat_margin`, `roce`, `roe`, `roa` | `roce`, `ebitda_margin_trend` |
| `leverage` | `net_debt_ebitda`, `debt_ebitda`, `debt_equity`, `debt_to_tangible_nw`, `ffo_debt`, `fcf_debt` | `net_debt_ebitda`, `debt_equity_adjusted`, `ffo_debt`, `fcf_debt` |
| `liquidity` | `current_ratio`, `quick_ratio`, `cash_ratio` | `current_ratio`, `cash_ratio`, `wc_utilization` |
| `coverage` | `interest_coverage`, `dscr` | `interest_coverage`, `dscr` |

#### Internal helpers / view primitives

| Name | Signature | Purpose |
|------|-----------|---------|
| `fmtDate` | `(d) => string` | `en-IN` 2-digit year short date |
| `fmtCell` | `(v: unknown) => string` | Spreading cell numbers via `toLocaleString("en-IN")` |
| `fmtINRCr` | `(v: string \| null \| undefined) => string` | `₹… Cr` for exposure/limits |
| `ratioTone` | `(code: keyof RatioSet, v: number \| null) => "up" \| "down" \| "default"` | Heuristic signal coloring for key ratios |
| `sectionScore` | `(sec: SectionDef, subFactors: SubFactor[] \| null) => number \| null` | Average of matching 1–5 scores |
| `signalToneClass` | `(tone: SignalTone) => string` | Tailwind text class |
| `SignalTile` | props: label, display, tone, icon?, meta?, children?, className? | Signals header instrument |
| `SignalEmptyTile` | label, icon?, hint, className? | Designed empty signal |
| `MiniBandBar` | `{ band: Band \| null }` | 6-segment BC ladder mini-bar |
| `SectionMarkIcon` | `{ sec: SectionDef }` | Section header glyph disc |
| `SectionScorePill` | `{ score: number \| null }` | Section avg score badge |
| `ReadoutTile` | label, value, hint?, tone? | Instrument panel PD tiles |
| `ScorePill` | `{ score: number }` | Sub-factor 1–5 pill |
| `type SignalTone` | `"default" \| "up" \| "down" \| "gold" \| "info"` | Signal tile tone union |

### Imports

| Import | From | Role |
|--------|------|------|
| `Fragment`, `type ReactNode` | `react` | Section row fragments; children typing |
| `Link` | `next/link` | Back to file |
| `notFound` | `next/navigation` | Missing analysis |
| Credit icons | `@/app/credit/credit-icons` | Signals / empties |
| `requireUser` | `@/lib/rbac` | Auth |
| `cn` | `@/lib/utils` | Class merge |
| `getCreditAnalysisDetail` | `@/features/credit/queries` | Detail aggregate |
| `computeScorecard`, `BAND_GRADE`, `type Band`, `type SubFactor` | `@/features/credit/scorecard` | Per-period + live scorecards |
| `computeRatios`, `formatRatio`, `type RatioSet`, `type LineItemCode` | `@/features/credit/ratios` | Per-period ratio engine |
| `bandToCanonicalRank`, `BAND_PD_RANGE` | `@/features/credit/ratingMap` | Notch rank on ladder |
| Brand suite | `@/components/brand` | Cards, ScoreRing, Reveal, marks, etc. |
| `type BadgeProps`, `type IconTone` | `@/components/brand` | Typing |
| `Sparkline`, `type SparklineTone` | `./sparkline` | Per-metric / score series charts |
| `SourceDataPanel` | `./source-data-panel` | Collapsible client wrapper for spreading table |
| `PageShell`, `PageHeader`, `DetailTopBar` | `@/components/brand/page-shell` | Chrome |
| `RunScoreButton` | `../run-score-button` | Recompute |

**Possibly unused import:** `SectionHeading` is **not** in the import list of the current file (unlike detail page). Workspace imports do not include `SectionHeading`.

### Business purpose

Premium **analytical workspace** for multi-period credit diagnosis of one issuer:

1. **Signals header** — at-a-glance instruments: internal score, rating notch (canonical agency symbol), leverage, coverage, profitability, liquidity (each with sparklines when data exists).
2. **Ratio canvas** — periods as columns, metrics grouped into four credit dimensions with section subtotals and trend sparklines.
3. **Instrument anchor** (sticky on xl+) — large `ScoreRing`, PD range vs model PD (`a.pd1y`), AAA→D ladder with issuer notch highlight, limit utilization bars, economic exposure list.
4. **Sub-factor scoring** + **score progression** across periods (default-weight recomputes).
5. **Source data** accordion — raw `financial_statement.line_items` spreading grid (audit trail; demoted under canvas).

Complements (does not replace) the tabbed detail file page.

### Key logic

#### Auth + data

```ts
const user = await requireUser();
const { id } = await params;
const detail = await getCreditAnalysisDetail(id, user);
if (!detail) notFound();
```

Uses: `analysis`, `party`, `financialStatements`, `latestRatioSet`, `scorecard`, `exposures`, `limits`  
(Does **not** surface external ratings / committee on this page.)

#### Per-period pure engine runs

```ts
const periodRatioSets = financialStatements.map((fs, i) => {
  const prior = i > 0 ? financialStatements[i - 1] : null;
  return computeRatios(fs, prior);
});

const periodScorecards = periodRatioSets.map((rs) =>
  computeScorecard({ ratios: rs, obligorType: a.obligorType }),
);
```

- Prior statement enables trend-dependent ratios.
- Scorecards use **default weights** for indicative multi-period trend (no extra DB round-trip).

#### Live score + band (same VALID_BANDS guard as detail page)

```ts
const totalScore =
  liveScorecard?.totalScore ??
  (a.currentCreditScore ? Number(a.currentCreditScore) : null);
const band: Band | null =
  (liveScorecard?.band as Band | undefined) ?? persistedBand ?? ratingBand;
```

**Note:** Prefer **live** score first (opposite of detail page Overview score preference).

#### Notch symbol

```ts
const notchSymbol = band
  ? (LADDER_RUNGS.find((r) => r.rank === bandToCanonicalRank(band))?.symbol ?? "-")
  : null;
```

#### `ratioTone` heuristics (view-layer only — not scorecard engine)

| Codes | “up” | “down” |
|-------|------|--------|
| Leverage (`net_debt_ebitda`, `debt_ebitda`, `debt_equity`, `debt_to_tangible_nw`) | `v <= 3` | `v > 4` |
| `interest_coverage` | `v >= 3` | `v < 1.5` |
| `ebitda_margin` | `v >= 0.12` | `v < 0.05` |
| `current_ratio` | `v >= 1.2` | `v < 0.8` |
| default | — | `"default"` |

#### Section subtotal

```ts
// Average of subFactor.score where sf.code ∈ sec.subFactorCodes
// Scores filtered to typeof === "number" (typed as 1|2|3|4|5)
```

#### Layout structure

1. `DetailTopBar` — back to `/credit/${id}`, RunScoreButton.
2. Signals bento (`lg:grid-cols-12`): score 4 / notch 2 / leverage 3 / coverage 3 / profitability 6 / liquidity 6.
3. Main grid: canvas (order-2 mobile) + sticky instrument (order-1 mobile so ring is hero above long tables).
4. Lower rail: sub-factors (2/3) + score progression (1/3) inside `Reveal`.
5. `SourceDataPanel` wrapping spreading table; server-rendered table as **children** (no function props across RSC).

#### Limit utilization UI

```ts
const pct = limit > 0 && Number.isFinite(limit)
  ? Math.min(100, (utilized / limit) * 100) : 0;
const over = utilized > limit && limit > 0;
// bar color: over → down; pct > 80 → gold; else emerald
```

#### Model PD readout

```ts
a.pd1y && Number.isFinite(Number(a.pd1y))
  ? `${(Number(a.pd1y) * 100).toFixed(3)}%`
  : "-"
// hint "spec §15" when missing
```

#### Spreading cells

```ts
const li = (fs.lineItems ?? {}) as Record<string, unknown>;
const raw = li[row.code];
// numeric → fmtCell; else CellEmpty
```

### Side effects

| Effect | Description |
|--------|-------------|
| Auth | `requireUser()` |
| DB read | `getCreditAnalysisDetail` |
| Pure compute | Many `computeRatios` / `computeScorecard` calls proportional to period count |
| `notFound()` | Invisible / missing id |
| Client (children) | `Sparkline`, `SourceDataPanel` toggle, `RunScoreButton` action |
| `Reveal` | Client entrance animation below the fold |

`dynamic = "force-dynamic"`.

### Security / RBAC

| Control | Detail |
|---------|--------|
| Auth | `requireUser()` |
| Visibility | Same as detail page via `getCreditAnalysisDetail(id, user)` |
| Writes | Only via `RunScoreButton` → `runRatiosAndScore` (write:credit) |
| No committee / FS mutation forms on this page | Read-mostly surface + recompute |
| Sensitive data | Full multi-period financials + scores exposed to any user who can see the analysis |

### Coupling

| Peer | Strength | Notes |
|------|----------|--------|
| `@/features/credit/queries` | High | Same detail loader as file page |
| `@/features/credit/ratios.computeRatios` | High | Per-period canvas + sparklines |
| `@/features/credit/scorecard.computeScorecard` | High | Live + period scorecards |
| `@/features/credit/ratingMap.bandToCanonicalRank` | Medium | Ladder notch |
| `../run-score-button` | High | Recompute |
| `./sparkline` | High | Client charts |
| `./source-data-panel` | High | Accordion shell |
| Sibling `page.tsx` | Nav/UX pair | Shared band validation pattern (duplicated VALID_BANDS) |
| Spec §§4.1, 5, 15 | Documentary | PD model, scorecard, ladder |

**Not used here but available on detail page:** external ratings enrichment, committee forms, add-FS form.

### Risks / TODOs

| Severity | Item |
|----------|------|
| Medium | **Score precedence differs from detail Overview** (live-first here vs persisted-first on detail) — same analysis can show different “internal score” on the two routes when `currentCreditScore` diverges from live engine. |
| Medium | **CPU on large FS histories** — O(n) `computeRatios` + O(n) `computeScorecard` on every request; no caching. Acceptable for small n; risky if many periods linked. |
| Medium | **`ratioTone` thresholds are hard-coded heuristics**, independent of sector-adjusted scorecard benchmarks — UI color can disagree with sub-factor 1–5 scores. |
| Low | `issuerName` fallback is `"-"` here vs `"Unnamed obligor"` on detail page — inconsistent empty identity copy. |
| Low | Section sub-factor codes like `ebitda_margin_trend`, `debt_equity_adjusted`, `wc_utilization` must match engine `SubFactor.code` exactly or section score is null/partial silently. |
| Low | Spreading table casts `lineItems` to loose `Record<string, unknown>` — no schema validation at view layer. |
| Low | Limit utilization uses raw `Number(l.utilized)` without null-safe formatting beyond bar math; labels use `fmtINRCr` which may still show currency as ₹ regardless of `currencyCode`. |
| Low | `ScorePill` here does not guard non-finite scores (detail page version does). |
| Info | File is 1555 lines — high complexity; many local primitives could be shared with `page.tsx` (`Readout`/`ScorePill`/`VALID_BANDS`/band tone maps duplicated). |
| None | No TODO/FIXME markers. |

---

## Cross-file notes (batch 022)

### Relationship map

```
/credit/[id]                    (page.tsx — tabbed file)
    ├── CreditSummaryHeader     (credit-summary-header.tsx)
    ├── RunScoreButton          (run-score-button.tsx) × multiple
    ├── AddFinancialStatementForm / CommitteeForm (outside this batch)
    └── link → /credit/[id]/workspace
                    └── workspace/page.tsx
                            ├── RunScoreButton
                            ├── Sparkline / SourceDataPanel (outside this batch)
                            └── pure computeRatios + computeScorecard per period
```

### Shared patterns

1. **Band validation set** `VALID_BANDS = BC-1…BC-6` duplicated on both server pages — protects against agency-symbol pollution of band columns.
2. **Tone ladders** for scores: ≥70 strong, ≥55 gold, ≥40 neutral, else weak (detail uses `up/gold/default/down`; workspace maps to `emerald/gold/neutral/down`).
3. **Designed empties** language (“Awaiting …”) on KPI tiles and signals.
4. **RSC boundary hygiene**: serializable props only into client children; tables passed as children into `SourceDataPanel`.
5. **`force-dynamic`** on both routes.
6. **Auth**: `requireUser` + query-scoped visibility; writes via action permission checks.

### Divergences / consistency bugs worth tracking

| Topic | Detail page | Workspace |
|-------|-------------|-----------|
| Score source order | `persisted ?? live` | `live ?? persisted` |
| Unnamed party | `"Unnamed obligor"` | `"-"` |
| External ratings | Full tab | Not shown |
| Committee / Add FS | Present | Absent |
| Multi-period canvas | No | Yes (core) |

### Batch inventory

| # | Path | Lines | Kind |
|---|------|------:|------|
| 1 | `src/app/credit/[id]/credit-summary-header.tsx` | 288 | Client presentational KPIs |
| 2 | `src/app/credit/[id]/page.tsx` | 1150 | RSC detail (7 tabs) |
| 3 | `src/app/credit/[id]/run-score-button.tsx` | 68 | Client action control |
| 4 | `src/app/credit/[id]/workspace/page.tsx` | 1555 | RSC analytical workspace |
| | **Total** | **3061** | |

### Out-of-batch dependencies referenced heavily

- `@/features/credit/queries.getCreditAnalysisDetail`
- `@/features/credit/actions.runRatiosAndScore` / `RunRatiosState`
- `@/features/credit/scorecard` (`computeScorecard`, `BAND_GRADE`, `BAND_PD_1Y`, `Band`, `SubFactor`)
- `@/features/credit/ratios` (`computeRatios`, `formatRatio`, `ALL_RATIO_CODES`, `RatioSet`, `LineItemCode`)
- `@/features/credit/ratingMap` (`bandToAgencySymbol`, `bandToCanonicalRank`, `AGENCIES`, `BAND_PD_RANGE`)
- `@/lib/rbac.requireUser`
- Sibling UI: `./add-fs-form`, `./committee-form`, `./workspace/sparkline`, `./workspace/source-data-panel`
