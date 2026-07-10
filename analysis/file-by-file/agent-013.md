# Agent 013 — File-by-file analysis

**Batch:** `batch-013.list`  
**Scope root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files:** 4 (dashboard client islands under `src/app/_components/`)  
**Note:** Docs ignored per instructions. No `AGENTS.md`/`Claude.md` under `_components`; parent `app/AGENTS.md` only flags Next.js API drift.

---

## 1. `src/app/_components/exposure-chart-impl.tsx`

| Field | Value |
|---|---|
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/_components/exposure-chart-impl.tsx` |
| **Lines** | 374 |
| **Runtime** | Client (`"use client"`) |
| **Role** | Dashboard hero chart **implementation** (recharts + Framer Motion count-up). Intentionally **not** imported by Server Components directly; loaded only via dynamic wrapper `exposure-chart.tsx` (`ssr: false`). |
| **Uses DB** | No (presentational; data is props) |
| **Maturity** | Implemented, polished (flash-free count-up, brand chart-theme composition) |
| **Criticality** | Medium (dashboard visual centerpiece; large recharts dependency) |

### Exports

| Symbol | Kind | Visibility | Signature / shape |
|---|---|---|---|
| `ExposurePoint` | `export interface` | Public | See below |
| `ExposureChart` | `export function` | Public | `({ data, totalExposure, totalDeals, windowMonths }: ExposureChartProps) => JSX.Element` |
| `ExposureChartProps` | `interface` | **Module-private** (not exported) | See below |
| `useCountUp` | `function` | Module-private | `(value: number, ref: React.RefObject<HTMLElement \| null>, duration?: number) => number` |
| `HeaderTotal` | `function` | Module-private | See below |
| `intFmt` | `const` | Module-private | `(n: number) => string` |

#### `ExposurePoint` (quoted)

```ts
export interface ExposurePoint {
  /** Short month label, e.g. "Jan". */
  label: string;
  /** ISO month, e.g. "2025-01" - used for tooltip sorting. */
  key: string;
  /** Sum of deal target_size created that month (INR). */
  exposure: number;
  /** Number of deals created that month. */
  deals: number;
}
```

#### `ExposureChartProps` (quoted, not exported)

```ts
interface ExposureChartProps {
  data: ExposurePoint[];
  /** Total exposure across the window - count-ups in the header + tooltip. */
  totalExposure: number;
  /** Total deals across the window - count-ups in the header. */
  totalDeals: number;
  /** Window length in months - used in the eyebrow. */
  windowMonths: number;
}
```

#### `HeaderTotal` props (inline type)

```ts
{
  totalExposure: number;
  totalDeals: number;
  headerRef: React.RefObject<HTMLDivElement | null>;
}
```

### Imports

| Source | Symbols | Purpose |
|---|---|---|
| `react` | `* as React` | State, refs, effects, `useId` |
| `framer-motion` | `animate`, `useInView` | Count-up tween + in-view gate |
| `recharts` | `Area`, `AreaChart`, `CartesianGrid`, `ReferenceLine`, `ResponsiveContainer`, `Tooltip`, `XAxis`, `YAxis` | Dual-axis area chart |
| `@/components/brand/money` | `compactINR` | Compact INR axis ticks + exposure header/tooltip |
| `@/components/brand/text` | `Eyebrow` | Header eyebrow label |
| `@/components/brand/chart-theme` | `CHART_ACTIVE_DOT`, `CHART_AXIS_TICK`, `CHART_CURSOR`, `CHART_EASE`, `CHART_GRID_PROPS`, `CHART_SERIES`, `CHART_STROKE_WIDTH`, `ChartAreaGradient`, `ChartTooltip` | Single source of truth for recharts styling |

### Business purpose

Visualizes **booked exposure (INR)** and **new deal/mandate counts** over a trailing window (typically 12 months) for the CRM dashboard desk. The chart is the large full-width hero instrument: emerald exposure series (primary left Y-axis), gold deal-count series (secondary right Y-axis), and a dashed emerald **“Avg”** benchmark = mean monthly exposure so each month reads above/below desk run-rate.

Domain semantics encoded in types/comments:
- `exposure` ≈ sum of deal `target_size` created that month (INR).
- `deals` ≈ count of deals created that month (“new mandates” in UI copy).

### Key logic

1. **Flash-free `useCountUp`**
   - `useState(value)` — SSR/first paint shows real total, never `0`.
   - Mount effect measures `getBoundingClientRect()` once → `wasAboveFoldRef`.
   - When `useInView(ref, { once: true, margin: "-10%" })` fires:
     - If above fold / unmeasured: pin `display = value` (skip tween; avoids value→0→value flash).
     - If below fold: `animate(0, value, { duration, ease: CHART_EASE, onUpdate, onComplete: () => setDisplay(value) })`.
   - Later `value` changes (revalidation) sync display without re-running 0→value.
   - Cleanup: `controls.stop()`.

2. **`HeaderTotal`**
   - Dual count-ups: exposure @ 1.2s (`compactINR`), deals @ 1.1s (`en-IN` integer, or `"-"` if non-finite).

3. **`meanExposure`**
   ```ts
   const meanExposure = data.length > 0 ? totalExposure / data.length : 0;
   ```
   Derived from padded series length so empty months pull the average down honestly.

4. **SVG / recharts composition**
   - Unique gradient/filter IDs via `React.useId().replace(/[:]/g, "")` (colon-safe for SVG `url(#…)`).
   - Defs: emerald + gold `ChartAreaGradient`, horizontal gold→emerald stroke gradient, `feGaussianBlur` glow on exposure stroke.
   - Left Y: exposure, `tickFormatter` → `compactINR(v).replace("₹", "₹ ")`.
   - Right Y: deals, gold-tinted ticks, `allowDecimals={false}`.
   - Tooltip: `ChartTooltip` with `labelMap` + `formatValue` branching exposure vs deals.
   - `ReferenceLine` at `meanExposure` with mono “Avg” label.
   - Areas: exposure animation 1200ms stroke 2.5 + glow filter; deals 1400ms gold stroke.

5. **Layout heights**
   - Chart body: `h-[300px]` mobile / `md:h-[380px]` desktop (must match skeleton in wrapper).

### Side effects

| Effect | When | Notes |
|---|---|---|
| `setDisplay` / Framer `animate` | Client mount / in-view / value change | Local React state only |
| DOM measure (`getBoundingClientRect`) | Mount | Viewport fold detection |
| IntersectionObserver (via `useInView`) | Mount | Framer Motion |
| Lazy load of recharts | When parent dynamic import resolves | Heavy (~360KB) chunk |
| No network, no cookies, no storage, no mutations | — | Pure presentational island |

### Security / RBAC

- **No auth, no RBAC checks** inside this file.
- Trusts parent page to gate data (dashboard page uses `requireUser()` elsewhere).
- Props are serializable scalars/arrays — safe across RSC → client boundary.
- No `dangerouslySetInnerHTML`; SVG ids derived from React `useId`.
- Display-only: no user input, no forms, no links.
- Financial figures shown client-side once props arrive; confidentiality is page-level, not component-level.

### Coupling

| Direction | Target | Strength |
|---|---|---|
| **Inbound** | `./exposure-chart.tsx` via `dynamic(() => import("./exposure-chart-impl").then(m => m.ExposureChart), { ssr: false })` | **Required** load path |
| **Inbound type** | `export type { ExposurePoint } from "./exposure-chart-impl"` re-exported by wrapper | Type-only for server page typing |
| **Outbound** | Brand chart-theme, money, text | High visual coupling to brand system |
| **Outbound** | `recharts`, `framer-motion` | Heavy third-party |
| **Consumer pages** | No current imports of `ExposureChart` / `_components/exposure-chart` found under `src/` (as of analysis) | **Orphan / pending wiring** vs legacy `src/app/dashboard-exposure-chart.tsx` (`HeroExposureChart` + different `ExposurePoint` shape: `month`/`mandates`/`exposure`) |

**Naming collision risk:** `ExposurePoint` also exists in `src/app/dashboard-exposure-chart.tsx` with a **different shape** (`month`, `mandates`, `exposure` vs `label`, `key`, `exposure`, `deals`). Do not conflate.

### Risks / TODOs

- **No explicit TODO/FIXME** in file.
- **Duplicate chart implementations:** legacy `HeroExposureChart` vs this brand-theme `ExposureChart`; risk of divergent metrics definitions.
- **Mean vs total consistency:** `meanExposure = totalExposure / data.length` assumes `totalExposure` equals sum of series points; if server passes mismatched totals, Avg line and header disagree.
- **`wasAboveFoldRef` race:** fold measure and animate effects both depend on declaration order; unmeasured (`null`) treated as “above fold” (`!== false`) → may skip intentional below-fold animation on first paint edge cases.
- **`useCountUp` uses same `headerRef` for both totals** — both animations gate on the same element/inView; fine, but shared fold flag per hook instance (each call has own refs).
- **Do not import this module from Server Components** — would reintroduce recharts into the server/first-load graph (comment is explicit).
- **Accessibility:** chart itself is visual; header totals lack `aria-live` (unlike `HeaderTotal` child spans which also lack live region — only `kpi-stat`/`kpi-hero` CountUp use `aria-live="polite"`). Screen readers get static numbers only after settle, no live updates during tween.
- **i18n hard-coded** English strings: “booked exposure”, “new mandates”, “Exposure”, “New deals”, “Avg”.

---

## 2. `src/app/_components/exposure-chart.tsx`

| Field | Value |
|---|---|
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/_components/exposure-chart.tsx` |
| **Lines** | 87 |
| **Runtime** | Client (`"use client"`) |
| **Role** | **Lazy-load shell** for the hero chart: owns `next/dynamic` with `ssr: false`, CLS-safe skeleton, and type re-export so a Server Component dashboard page can import a client component reference without bundling recharts on first paint. |
| **Uses DB** | No |
| **Maturity** | Implemented |
| **Criticality** | Medium (bundle-size architecture for `/`) |

### Exports

| Symbol | Kind | Notes |
|---|---|---|
| `ExposurePoint` | `export type { … } from "./exposure-chart-impl"` | Type-only re-export; erased at compile; does not execute impl module scope |
| `ExposureChart` | `export const` | Alias of `ExposureChartLazy` (dynamic component) |
| `ExposureChartSkeleton` | `function` | Module-private loading UI |
| `ExposureChartLazy` | `const` | Module-private `dynamicImport(...)` result |

### Imports

| Source | Symbols | Purpose |
|---|---|---|
| `next/dynamic` | `dynamicImport` (default) | Client-only code-split of recharts impl |
| `react` | `* as React` | JSX for skeleton (React in scope for classic transform / types) |

Dynamic import target:

```ts
const ExposureChartLazy = dynamicImport(
  () => import("./exposure-chart-impl").then((m) => m.ExposureChart),
  {
    ssr: false,
    loading: () => <ExposureChartSkeleton />,
  },
);
export const ExposureChart = ExposureChartLazy;
```

### Business purpose

Architectural wrapper so the desk still gets the exposure/mandates hero chart **without** paying ~360KB recharts on the dashboard route’s first-load JS. Server page imports this module (client boundary); recharts loads after hydration when the lazy chunk fetches.

### Key logic

1. **Why a separate `"use client"` file:** `ssr: false` is illegal inside Server Components; the dynamic call must live in a client module.
2. **`ExposureChartSkeleton`:** pure markup (`aria-hidden`), mirrors impl header band + chart body heights (`300px` / `md:380px`) to prevent CLS when chunk arrives. Placeholder blocks for booked exposure + new mandates widths approximate count-up typography.
3. **Props contract:** identical to impl (serializable `data` + scalars; no function props across RSC boundary). The wrapper does not declare TypeScript props itself — inference flows from dynamic-loaded component (consumers rely on usage + re-exported `ExposurePoint`).

### Side effects

| Effect | When | Notes |
|---|---|---|
| Network fetch of lazy chunk `./exposure-chart-impl` | After client hydration / when component mounts | `ssr: false` ⇒ no server render of chart |
| Renders skeleton then swaps to real chart | Loading → ready | Layout height reserved |

No data fetching of KPI numbers here — only code-splitting.

### Security / RBAC

- None local. Same trust model as impl: parent must authorize dashboard data.
- `ssr: false` means chart HTML is **not** in initial HTML document — only skeleton. Numbers appear after JS; not an XSS vector by itself, but also means no SSR of financial figures inside the chart (header/totals live inside the lazy island).

### Coupling

| Direction | Target | Strength |
|---|---|---|
| **Outbound** | `./exposure-chart-impl` | Hard dependency (type + runtime dynamic) |
| **Outbound** | `next/dynamic` | Framework |
| **Inbound** | Intended: dashboard Server Component page | **Not currently imported** anywhere under `src/` (orphan pending integration) |
| **Paired file** | Must keep skeleton heights/copy aligned with impl | Maintenance coupling |

### Risks / TODOs

- **No TODO comments.**
- **Type ergonomics:** `export const ExposureChart = ExposureChartLazy` may yield looser prop types than a direct `export function` depending on Next `dynamic` typing; worth verifying at call sites when wired.
- **Skeleton copy drift:** hard-coded “Exposure · last 12 months” while impl uses `windowMonths` prop — if window ≠ 12, skeleton label lies until load completes.
- **Double client boundary:** both wrapper and impl are `"use client"`; fine, but any accidental direct import of impl bypasses the optimization.
- **Orphan risk:** if never wired into `page.tsx`, dead code + unused dependency path; legacy `dashboard-exposure-chart.tsx` may still be the live chart.

---

## 3. `src/app/_components/kpi-hero.tsx`

| Field | Value |
|---|---|
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/_components/kpi-hero.tsx` |
| **Lines** | 377 |
| **Runtime** | Client (`"use client"`) |
| **Role** | Dashboard **hero KPI card** content for a col-span-8 row-span-2 bento cell: greeting, total parties + investor/issuer/other split, attention CTA, secondary KPI grid. Outer double-bezel shell is expected from parent `Card`. |
| **Uses DB** | No (props only) |
| **Maturity** | Implemented (3-way party split fix documented) |
| **Criticality** | Medium-high (desk overview + deep links into compliance/credit/deals/leads/matching) |

### Exports

| Symbol | Kind | Signature / shape |
|---|---|---|
| `KpiHeroProps` | `export interface` | See below |
| `KpiHero` | `export function` | `(props: KpiHeroProps) => JSX.Element` |
| `useCountUp` | private function | Same flash-free pattern as chart (margin `"-8%"`) |
| `CountUp` | private function | Presentational span + `aria-live="polite"` |
| `SecondaryKpi` | private function | Secondary grid cell |
| `intFmt` | private const | `en-IN` integer `toLocaleString` |

#### `KpiHeroProps` (quoted)

```ts
export interface KpiHeroProps {
  greeting: string;
  subline: string;
  totalParties: number;
  investors: number;
  issuers: number;
  /** Parties that are neither investor nor issuer - intermediaries (IFA /
   *  broker / rating agency / arranger / …), internal staff, prospects. The
   *  three buckets sum to `totalParties` so the split bar + percentages add
   *  up exactly (the prior 2-way bar labelled the entire non-investor
   *  remainder as "issuers", which over-counted issuers). */
  otherParties: number;
  openDeals: number;
  creditInProgress: number;
  kycExpiring: number;
  kycSoonDays: number;
}
```

#### `CountUp` props

```ts
{
  value: number;
  format: (n: number) => string;
  className?: string;
}
```

#### `SecondaryKpi` props

```ts
{
  label: string;
  value: number;
  hint: string;
  tone: "default" | "emerald" | "gold";
  className?: string;
}
```

### Imports

| Source | Symbols | Purpose |
|---|---|---|
| `react` | `* as React` | Hooks, refs |
| `next/link` | `Link` | In-app navigation CTAs |
| `framer-motion` | `animate`, `useInView` | Count-up |
| `@/lib/utils` | `cn` | className merge |
| `@/components/brand/button` | `Button` | Primary/secondary CTA buttons |
| `@/components/brand/text` | `Eyebrow` | Section labels |
| `@/components/brand/icons` | `ArrowRight`, `Lightning`, `Plus`, `SealWarning`, `ShieldCheck` | Iconography |

### Business purpose

Primary **desk overview** surface for Binary CRM:
- Personalized greeting + subline (server-computed strings).
- **Total counterparties** with honest **Investors / Issuers / Other** composition (fixes prior bug where non-investors were all labelled issuers).
- **Attention strip** prioritizes operational queues: KYC re-reviews → credit files → open deals → clear desk.
- Quick actions: **New lead** (`/leads/new`), **Match investors** (`/matching`).
- Secondary tiles: open deals, credit in progress, KYC due within `kycSoonDays`.

### Key logic

1. **Percentage split (honest remainder)**
   ```ts
   const investorPct = totalParties > 0 ? Math.round((investors / totalParties) * 100) : 0;
   const issuerPct   = totalParties > 0 ? Math.round((issuers / totalParties) * 100) : 0;
   const otherPct    = Math.max(0, 100 - investorPct - issuerPct);
   ```
   Rounding drift absorbed by `other` so displayed % always sum to 100.

2. **Attention prioritization**
   ```ts
   const attentionLabel =
     kycExpiring > 0
       ? `${intFmt(kycExpiring)} KYC reviews due`
       : creditInProgress > 0
         ? `${intFmt(creditInProgress)} credit files active`
         : openDeals > 0
           ? `${intFmt(openDeals)} live mandates`
           : "Desk is clear";
   const attentionHref =
     kycExpiring > 0 ? "/compliance/kyc"
     : creditInProgress > 0 ? "/credit"
     : "/deals";
   ```
   Note: when desk is clear, href still defaults to `/deals` (not a dedicated “clear” page).

3. **Split bar rendering**
   - Emerald band width = `investorPct%` from left.
   - Gold band left offset = `investorPct%`, width = `issuerPct%`.
   - Unpainted remainder of track = “other” (muted base `bg-foreground/[0.08]`).

4. **Flash-free `useCountUp` / `CountUp`**
   - Same pattern as chart: init to real value; tween only if below fold on mount; `onComplete` snaps exact value; post-animation value sync.
   - `useInView(..., { once: true, margin: "-8%" })`.
   - Ease: `[0.32, 0.72, 0, 1]` (same cubic as `CHART_EASE` but inlined, not imported).

5. **Secondary grid visibility**
   - `hidden … md:grid` — secondary KPIs hidden on small screens; attention strip + headline remain.
   - Third cell `className="col-span-2 lg:col-span-1"` avoids half-width orphan on 2-col md layout.

6. **Tone for KYC secondary tile**
   - `tone={kycExpiring > 0 ? "gold" : "default"}` — gold alert when re-KYC pressure exists.

### Side effects

| Effect | When | Notes |
|---|---|---|
| Client animations | Mount / scroll into view | Local state |
| Client navigation | User click on Links/Buttons | Next.js client transitions to `/leads/new`, `/matching`, `/compliance/kyc`, `/credit`, `/deals` |
| No API calls, no mutations | — | Read-only UI |

### Security / RBAC

- **No role checks in component.** Links are always rendered for whoever can see the dashboard island.
- Destination routes (`/compliance/kyc`, `/credit`, `/matching`, `/leads/new`, `/deals`) must enforce their own `requireUser` / permission gates; otherwise UI could advertise queues the role cannot access (soft information leak of counts is still present via props).
- Props trust: if parent passes inflated KYC counts, UI will emphasize compliance urgency — data integrity is server-query responsibility.
- `greeting` / `subline` are interpolated into text nodes (React escapes) — safe if strings are server-built; avoid raw HTML.

### Coupling

| Direction | Target | Strength |
|---|---|---|
| **Outbound brand** | Button, Eyebrow, icons, `cn` | Visual system |
| **Outbound routes** | Hard-coded paths listed above | Navigation graph |
| **Outbound motion** | framer-motion | Animation |
| **Parent shell** | Expects parent `Card` double-bezel | Layout contract (comment) |
| **Data parent** | Must supply `KpiHeroProps` from dashboard queries | Strong data contract |
| **Inbound consumers** | **No current imports** found under `src/` | Orphan / pending wire-up vs inline dashboard UI in `page.tsx` |

**Duplication:** `useCountUp` is copy-pasted (with small margin/ease differences) across `kpi-hero.tsx`, `kpi-stat.tsx`, and `exposure-chart-impl.tsx` — three near-identical hooks.

### Risks / TODOs

- **No TODO comments.**
- **Invariant not enforced:** component does not assert `investors + issuers + otherParties === totalParties`; bad server data yields bar/percentage mismatch.
- **Clear-desk href:** still points at `/deals` even when “Desk is clear”.
- **Secondary KPIs hidden on mobile** — phone users lose open deals / credit / KYC counts except via attention strip (only one priority).
- **CTAs always visible** (`sm:flex`) regardless of permission to create leads or use matching — may 403 on destination.
- **Accessibility:** attention `Link` is good; split bar is decorative without ARIA description of percentages beyond text line; count-ups use `aria-live="polite"`.
- **Orphan:** not imported by current `src/app/page.tsx` (which builds its own dashboard layout). Integration debt.

---

## 4. `src/app/_components/kpi-stat.tsx`

| Field | Value |
|---|---|
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/_components/kpi-stat.tsx` |
| **Lines** | 143 |
| **Runtime** | Client (`"use client"`) |
| **Role** | Dashboard-only **KPI tile** with flash-free count-up; visual twin of shared brand `StatCard` but **not** in `src/components/brand` so StatCard used elsewhere stays untouched. Owns its own `Card` shell (unlike KpiHero content which assumes parent Card). |
| **Uses DB** | No |
| **Maturity** | Implemented (explicit serverless “0” flash fix) |
| **Criticality** | Low-medium (presentational tile) |

### Exports

| Symbol | Kind | Signature / shape |
|---|---|---|
| `KpiStatProps` | `export interface` | See below |
| `KpiStat` | `export function` | `({ label, value, tone?, className? }: KpiStatProps) => JSX.Element` |
| `useCountUp` | private | `(value, ref, duration?) => number` — **no `useInView`**; animates once on mount if below fold |
| `intFmt` | private | `en-IN` integer format |

#### `KpiStatProps` (quoted)

```ts
export interface KpiStatProps {
  label: string;
  value: number;
  tone?: "default" | "gold";
  className?: string;
}
```

### Imports

| Source | Symbols | Purpose |
|---|---|---|
| `react` | `* as React` | Hooks |
| `framer-motion` | `animate` only | Count-up (no `useInView`) |
| `@/lib/utils` | `cn` | Classes |
| `@/components/brand/card` | `Card` | Double-bezel shell |
| `@/components/brand/text` | `Eyebrow` | Label |

### Business purpose

Reusable small KPI tile for dashboard ledger-style metrics: eyebrow label, large tabular number, gold optional tone (Binary brand halo cue via accent dot), footer copy fixed to **“All time” / “CRM ledger”**.

### Key logic

1. **`useCountUp` variant differences vs hero/chart**
   - **No `useInView`:** on first effect after fold measure, either pins value or runs 0→value immediately if below fold.
   - `didAnimateRef` set on first effect run regardless.
   - Ease inlined `[0.32, 0.72, 0, 1]`, duration default `1.1`.
   - Same serverless flash fix: initial state = real `value`.

2. **Presentation**
   - `tone === "gold"` → `text-gold` value + gold glowing status dot; else `text-foreground` + muted dot.
   - Footer is static marketing/ledger chrome, not data-driven.
   - Non-finite display → `"-"`.

3. **Layout**
   - `Card` + `min-h-40` column: eyebrow row, centered number + gold hairline accent, footer border-t.

### Side effects

| Effect | When | Notes |
|---|---|---|
| Framer `animate` | Mount (below-fold only) | Local state |
| DOM rect measure | Mount | Fold detection |
| No navigation, no fetch | — | Pure tile |

### Security / RBAC

- None. Display-only props.
- No links; cannot escalate privileges.
- Confidentiality of `value` is entirely parent-controlled.

### Coupling

| Direction | Target | Strength |
|---|---|---|
| **Outbound** | brand `Card`, `Eyebrow`, `cn`, framer-motion | Moderate |
| **Conceptual twin** | `src/components/brand/stat-card.tsx` (shared StatCard with different count-up that starts at 0) | Parallel implementations — intentional isolation |
| **Inbound consumers** | **No current imports** under `src/` | Orphan / pending |

### Risks / TODOs

- **No TODO comments.**
- **Footer hard-coded** “All time” / “CRM ledger” — wrong if used for windowed metrics (e.g. trailing 12m).
- **No `useInView`:** if the tile mounts while off-screen (e.g. in a tall scrollable region that still reports “below fold”), animation runs immediately and may complete before user scrolls to it — opposite problem from hero (hero waits for in-view). If rect says above fold, no animation ever.
- **Tone limited to default|gold** — no emerald (unlike `SecondaryKpi` in hero).
- **Triplicated `useCountUp`** — maintenance drift risk across three files (this variant lacks `useInView` and has different fold semantics).
- **Shared StatCard still has old “starts at 0” behavior** per its own source — product inconsistency if both tiles appear on different screens.

---

## Cross-file summary (batch 013)

| File | Lines | Primary export(s) | Pattern |
|---|---:|---|---|
| `exposure-chart-impl.tsx` | 374 | `ExposureChart`, `ExposurePoint` | Heavy recharts impl |
| `exposure-chart.tsx` | 87 | `ExposureChart` (lazy), type re-export | `next/dynamic` + `ssr:false` shell |
| `kpi-hero.tsx` | 377 | `KpiHero`, `KpiHeroProps` | Hero overview + attention routing |
| `kpi-stat.tsx` | 143 | `KpiStat`, `KpiStatProps` | Standalone KPI tile |

### Shared themes

1. **Client islands under `src/app/_components/`** for dashboard progressive enhancement without polluting shared brand primitives.
2. **Flash-free count-up** against Vercel serverless SSR shipping `"0"` placeholders.
3. **Brand tokens:** emerald / gold, hairline, tabular-nums (`nums`), Fraunces-scale clamp typography, double-bezel cards.
4. **No DB / no RBAC in any of these four files** — pure presentation over trusted props.
5. **Integration status (important):** none of these four modules are currently imported by other application files under `src/` (grep). Live dashboard appears to use `src/app/page.tsx` inline layout and/or legacy `dashboard-exposure-chart.tsx`. Treat as **ready-but-unwired** client islands, not dead dead-code without product confirmation.

### Recommended follow-ups (analysis only; not implemented)

- Wire `_components` into `page.tsx` **or** delete/archive if superseded.
- Extract single shared `useFlashFreeCountUp` hook to eliminate three-way drift.
- Unify or namespace `ExposurePoint` vs `HeroExposureChart`’s `ExposurePoint`.
- Align skeleton eyebrow with `windowMonths`.
- Add permission-aware CTA visibility if roles cannot access `/matching` or `/leads/new`.

---

*End of agent-013 analysis.*
