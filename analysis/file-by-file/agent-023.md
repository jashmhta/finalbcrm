# Agent 023 — File-by-file analysis

**Batch:** `batch-023.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  

---

## 1. `src/app/credit/[id]/workspace/source-data-panel.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/credit/[id]/workspace/source-data-panel.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/credit/[id]/workspace/source-data-panel.tsx` |
| **Lines** | 149 |
| **Directive** | `"use client"` |
| **Role** | Collapsible “Source data” accordion shell for the credit workspace’s raw line-item spreading grid. Demotes dense source tables behind a collapsed-by-default panel so the analytical canvas (signals, ratio matrix, anchor ladder) remains the primary view. |

### Exports

```ts
export interface SourceDataPanelProps {
  /** Number of spreading line items (SPREADING_ROWS.length). */
  lineCount: number;
  /** Number of linked periods (financialStatements.length). */
  periodCount: number;
  /** Server-rendered line-item table. Only rendered when periodCount > 0. */
  children: React.ReactNode;
}

export function SourceDataPanel({
  lineCount,
  periodCount,
  children,
}: SourceDataPanelProps): JSX.Element
```

**Internal constants:**

| Name | Signature / shape | Purpose |
|------|-------------------|---------|
| `EASE` | `[0.32, 0.72, 0, 1] as const` | Framer-motion cubic-bezier for caret rotation and panel fade/lift |

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React` |
| `framer-motion` | `motion`, `AnimatePresence` |
| `@/lib/utils` | `cn` *(imported but unused)* |
| `@/components/brand` | `Card`, `CardBody`, `CardHeader`, `CardTitle`, `CardDescription`, `Eyebrow`, `Badge`, `Button`, `EmptyState` |
| `@/app/credit/credit-icons` | `ChartLineUpIcon`, `ScalesIcon`, `CaretDownIcon` |

### Business purpose

Credit workspace UX enclosure for **line-item spreading** audit data:

1. Present a branded card titled “Line-item spreading” under the “Source data” eyebrow.
2. Show metadata badge: `{lineCount} lines · {periodCount} period(s)` when periods exist.
3. Keep the raw spreading table **collapsed by default** so first paint is not a dense wall of numbers; the ratio canvas above is primary.
4. When expanded, reveal server-rendered `children` (the line-item table reading from `line_items` jsonb).
5. When no statements are linked (`periodCount === 0`), show empty state directing users to the Financials tab.

Copy explicitly references DB surface: cells read from `line_items` (jsonb). Empty-state hint: “Add financial statements from the Financials tab to begin spreading.”

### Key logic

**Local open state:**

```ts
const [open, setOpen] = React.useState(false); // collapsed by default
const hasPeriods = periodCount > 0;
```

**Three render branches inside `CardBody`:**

| Condition | UI |
|-----------|-----|
| `hasPeriods && open` | `motion.div` (`id="source-data-table"`) with opacity/y enter/exit; renders `{children}` |
| `hasPeriods && !open` | Collapsed summary paragraph with mono `lineCount` / `periodCount` |
| `!hasPeriods` | `EmptyState` with `ScalesIcon`, title “No statements linked yet.” |

**A11y on toggle button:**

```ts
aria-expanded={open}
aria-controls="source-data-table"
```

Label text toggles: `"Show source data"` / `"Hide source data"`. Caret rotates 0→180° via `motion.span`.

**Motion discipline (documented in file header):**

- Only `transform` + `opacity` animated (caret rotate; body fade + lift `y: 8` / exit `y: -4`).
- No height / layout tweens.
- `AnimatePresence initial={false}` avoids mount flash of exit animation.
- Durations: caret 0.32s, expand body 0.34s, collapsed text 0.2s; ease `EASE`.

**Server→client boundary rule (commented):**

- Panel is client-only for toggle state.
- Table is server-rendered and passed as `children: React.ReactNode` — never a function prop.

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Client open/close toggle | `useState` + button `onClick` |
| Enter/exit animations | framer-motion `AnimatePresence` + `motion.div` / `motion.span` |
| No network / no server actions | Pure presentation |

### Security / RBAC

- **None in this file.** No auth checks, no data fetching, no mutations.
- Assumes parent workspace page already authorized access to the credit analysis and only passes safe, already-fetched `children` + counts.
- Does not surface PII beyond whatever the parent injects into `children`.

### Coupling

| Depends on | Why |
|------------|-----|
| `@/components/brand` Card/Badge/Button/EmptyState | Design-system shell |
| `@/app/credit/credit-icons` | Phosphor light wrappers (avoids server phosphor import) |
| Parent workspace page | Supplies `lineCount`, `periodCount`, server table as `children` |
| Conceptual: `SPREADING_ROWS`, `financialStatements`, `line_items` jsonb | Documented data sources for counts/table (not imported here) |

**Consumers:** credit analysis workspace route under `src/app/credit/[id]/workspace/` (parent that composes this panel).

### Risks / TODOs

| Item | Severity | Notes |
|------|----------|-------|
| Unused import `cn` | Low | Dead import; lint noise |
| Children always in tree only when open | Info | When closed, children unmounted (`open ? … : collapsed`); re-expand remounts table — fine for static SSR table, costly if children ever become heavy client subtrees |
| No keyboard section semantics | Low | Button has aria-expanded/controls; no `role="region"` / `aria-labelledby` on panel body |
| Empty state vs Financials tab | Info | Navigation to Financials is copy-only; no deep link |

---

## 2. `src/app/credit/[id]/workspace/sparkline.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/credit/[id]/workspace/sparkline.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/credit/[id]/workspace/sparkline.tsx` |
| **Lines** | 187 |
| **Directive** | `"use client"` |
| **Role** | Per-metric inline SVG sparkline for the credit workspace ratio matrix — hairline polyline + soft area wash with draw-on-scroll animation. Turns period series into an analytical glyph without numerals. |

### Exports

```ts
export type SparklineTone = "emerald" | "gold" | "down" | "neutral";

export interface SparklineProps {
  /** Series across periods (oldest → newest). null/NaN = gap. */
  data: (number | null | undefined)[];
  tone?: SparklineTone;       // default "emerald"
  width?: number;              // default 80
  height?: number;             // default 28
  strokeWidth?: number;        // default 1.6
  className?: string;
}

export function Sparkline({
  data,
  tone = "emerald",
  width = 80,
  height = 28,
  strokeWidth = 1.6,
  className,
}: SparklineProps): JSX.Element
```

**Internal helpers:**

| Name | Signature | Purpose |
|------|-----------|---------|
| `toneColor` | `(tone: SparklineTone) => string` | Maps tone → CSS var: `--emerald`, `--gold`, `--down`, `--foreground` |

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React` |
| `framer-motion` | `motion`, `useInView` |
| `@/lib/utils` | `cn` |

### Business purpose

Visual trend readout for credit **ratio matrix** cells:

- Plot oldest→newest period values for a single metric.
- Color-code by health tone (`emerald` / `gold` / `down` / `neutral`).
- Latest-period filled dot anchors “where we are now.”
- Missing periods must remain **visible as gaps** (x by period index), not compressed away — risk of false continuity if skipped.

Decorative only: root is `aria-hidden="true"`; parent cells own accessible numeric labels.

### Key logic

**Tone → color:**

```ts
function toneColor(tone: SparklineTone): string {
  switch (tone) {
    case "emerald": return "var(--emerald)";
    case "gold":    return "var(--gold)";
    case "down":    return "var(--down)";
    case "neutral":
    default:        return "var(--foreground)";
  }
}
```

**Valid-point extraction (null / undefined / non-finite rejected):**

```ts
const valid: { i: number; v: number }[] = [];
for (let i = 0; i < n; i++) {
  const v = data[i];
  if (v !== null && v !== undefined && Number.isFinite(v)) {
    valid.push({ i, v: v as number });
  }
}
```

**X positioning by period index (preserves gaps):**

```ts
const xFor = (i: number) =>
  n > 1 ? pad + (i / (n - 1)) * innerW : pad + innerW / 2;
// pad = 2.5; innerW/innerH = width/height minus pad*2
```

**Three series modes:**

| `valid.length` | Rendering |
|----------------|-----------|
| `≥ 2` | Min/max scale Y; flat series expanded `min±1`; `pathD` polyline `M/L`; `areaD` closed polygon to baseline for gradient fill; `lastPt` for terminal dot |
| `=== 1` | Single static circle at `xFor(valid[0].i)`, mid-height, opacity 0.7 |
| `0` | Faint dashed horizontal baseline (`strokeDasharray="2 3"`, 20% foreground mix) |

**Y scale (≥2 points):**

```ts
let min = Math.min(...vals);
let max = Math.max(...vals);
if (min === max) { min -= 1; max += 1; }
const yFor = (v: number) => pad + innerH - ((v - min) / span) * innerH;
```

**In-view draw animation (once):**

```ts
const inView = useInView(ref, { once: true, margin: "-5%" });
// area: opacity 0 → 1, 0.6s
// stroke: pathLength 0 → 1, 1.1s
// end circle: opacity delay 1.0s, 0.3s
// ease: [0.32, 0.72, 0, 1]
```

**Gradient id uniqueness:**

```ts
const reactId = React.useId().replace(/[:]/g, "");
const gradId = `spark-grad-${reactId}`;
// linearGradient vertical: color 0.24 → 0 opacity
```

**DOM contract:**

- Wrapper: `<span data-slot="workspace-sparkline" aria-hidden="true">`
- SVG `viewBox={`0 0 ${width} ${height}`}`

### Side effects

| Effect | Mechanism |
|--------|-----------|
| IntersectionObserver-style in-view | framer-motion `useInView` on span ref |
| Path draw / fade animations | `motion.path` / `motion.circle` |
| No data mutation / no fetch | Pure presentational |

### Security / RBAC

- **None.** Accepts plain numeric series; no secrets; decorative `aria-hidden`.
- No XSS surface beyond React’s normal prop rendering (SVG geometry built from numbers with `toFixed(2)`).

### Coupling

| Depends on | Why |
|------------|-----|
| Design tokens | CSS vars `--emerald`, `--gold`, `--down`, `--foreground` |
| framer-motion | `pathLength`, `useInView`, opacity |
| Parent ratio matrix / workspace | Supplies `data` series + `tone` |

**Pattern alignment (file comment):** same serializable-props RSC boundary pattern as `StatCard` / `ScoreRing` — no function props.

### Risks / TODOs

| Item | Severity | Notes |
|------|----------|-------|
| Large series | Low | O(n) build; default width 80 may clutter if many periods without downsampling |
| Null-gap polyline | Info | Points connect across gaps in path space (line jumps over missing index) — intentional x-gap, but stroke still continuous between non-adjacent valid points |
| Single-point Y not scaled | Info | Single valid point always at mid-height (not value-scaled) |
| `aria-hidden` always | Low | Screen readers get no trend summary; depends on parent cell text |
| GPU/animation cost | Low | Many matrix cells each with own sparkline + motion; `once: true` mitigates re-triggers |

---

## 3. `src/app/credit/credit-icons.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/credit/credit-icons.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/credit/credit-icons.tsx` |
| **Lines** | 54 |
| **Directive** | `"use client"` |
| **Role** | Client-only Phosphor Light icon wrappers for credit **server pages**. Isolates `@phosphor-icons/react` so Turbopack server bundles never evaluate phosphor’s top-level `React.createContext` (which breaks as `createContext is not a function` under RSC interop). |

### Exports

```ts
// All are Light-weight wrappers: (props: IconProps) => JSX.Element
export const ArrowRightIcon: (props: IconProps) => JSX.Element;
export const ArrowLeftIcon: (props: IconProps) => JSX.Element;
export const WarningIcon: (props: IconProps) => JSX.Element;
export const ChartLineUpIcon: (props: IconProps) => JSX.Element;
export const ScalesIcon: (props: IconProps) => JSX.Element;
export const CoinsIcon: (props: IconProps) => JSX.Element;
export const ShieldStarIcon: (props: IconProps) => JSX.Element;
export const SparkleIcon: (props: IconProps) => JSX.Element;
export const TrendUpIcon: (props: IconProps) => JSX.Element;
export const PlusIcon: (props: IconProps) => JSX.Element;
export const CheckCircleIcon: (props: IconProps) => JSX.Element;
export const MinusIcon: (props: IconProps) => JSX.Element;
export const CaretDownIcon: (props: IconProps) => JSX.Element;
```

**Internal factory:**

```ts
const light = (Comp: Icon) =>
  function LightIconWrapper(props: IconProps) {
    return <Comp weight="light" {...props} />;
  };
```

### Imports

| Source | Symbols |
|--------|---------|
| `@phosphor-icons/react` | `ArrowRight`, `ArrowLeft`, `Warning`, `ChartLineUp`, `Scales`, `Coins`, `ShieldStar`, `Sparkle`, `TrendUp`, `Plus`, `CheckCircle`, `Minus`, `CaretDown`, type `Icon`, type `IconProps` |

### Business purpose

Infrastructure / design-system adapter for the credit module:

1. Force `weight="light"` on every icon (design system default).
2. Provide named `*Icon` exports for server components under `src/app/credit/**` without importing phosphor directly.
3. Pass through `className`, `size`, and other `IconProps`; brand primitives size via `[&_svg]:size-*`.

Used by server pages and by client panels that need the same icon set (e.g. `SourceDataPanel` imports `ChartLineUpIcon`, `ScalesIcon`, `CaretDownIcon`).

### Key logic

- Higher-order wrapper `light(Comp)` returns a function component that spreads props after forcing `weight="light"`.
- Callers can still override `weight` if they pass it after spread order… actually order is `weight="light"` then `{...props}`, so **caller `weight` overrides light** if provided.
- No state, no side effects, no data.

### Side effects

None (pure presentational re-exports).

### Security / RBAC

None. No user data, no auth.

### Coupling

| Depends on | Why |
|------------|-----|
| `@phosphor-icons/react` | Icon components + `Icon` / `IconProps` types |
| React client boundary | `"use client"` required for phosphor context |

**Consumers (examples in this batch):**

- `source-data-panel.tsx` → `ChartLineUpIcon`, `ScalesIcon`, `CaretDownIcon`
- Broader credit server pages / workspace (not in this batch)

**Note:** `credit-list-view.tsx` does **not** use this module — it imports phosphor icons directly (`ArrowLeft`, `ArrowRight`, `Sparkle`, `Plus`, `Warning`) because it is already `"use client"`.

### Risks / TODOs

| Item | Severity | Notes |
|------|----------|-------|
| Incomplete icon surface | Low | Only 13 icons; new credit UI may need more wrappers |
| Weight override via props | Info | `{...props}` after `weight="light"` allows accidental non-light weights |
| Duplication with list view | Low | Client list imports phosphor raw; server path must use this file — dual import style is intentional |
| Turbopack-specific rationale | Info | If Next/Turbopack interop for phosphor is fixed, this module may become optional but remains a good light-weight convention |

---

## 4. `src/app/credit/credit-list-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/credit/credit-list-view.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/credit/credit-list-view.tsx` |
| **Lines** | 460 |
| **Directive** | `"use client"` |
| **Role** | Client view layer for the credit analyses list (`/credit`). Owns floating command bar (search + density), double-bezel table, score/band/status presentation, CSV export trigger, “New analysis” CTA, and pagination. Server page runs `listCreditAnalyses` and passes rows + pagination as props. |

### Exports

```ts
export interface CreditListViewProps {
  rows: CreditAnalysisListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
}

export function CreditListView({
  rows,
  total,
  page,
  pageSize,
  totalPages,
  q,
}: CreditListViewProps): JSX.Element
```

**Internal (non-exported) components / helpers:**

| Name | Signature / shape | Purpose |
|------|-------------------|---------|
| `BAND_BADGE` | `Record<string, BadgeProps["variant"]>` | Maps BC band → badge color variant |
| `bandVariant` | `(band: string \| null) => BadgeProps["variant"]` | Lookup with `"neutral"` fallback |
| `Pagination` | `({ page, totalPages, q }: { page: number; totalPages: number; q?: string })` | Prev/next + windowed page pills |
| `PagePill` | `({ href, active, children }: { href: string; active: boolean; children: React.ReactNode })` | Single page number link |

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React` |
| `next/link` | `Link` |
| `next/navigation` | `useRouter`, `usePathname`, `useSearchParams` |
| `@phosphor-icons/react` | `ArrowLeft`, `ArrowRight`, `Sparkle`, `Plus`, `Warning` |
| `@/lib/utils` | `cn` |
| `@/features/credit/queries` | type `CreditAnalysisListItem` |
| `@/features/credit/scorecard` | `BAND_GRADE` |
| `@/features/reports/export-button` | `ExportCsvButton` |
| `@/components/brand` | `Card`, `Badge`, `Button`, `CommandBar`, `Reveal`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `TableEmpty`, type `Density` |
| `@/components/brand` | type `BadgeProps` |

### Referenced external types

**`CreditAnalysisListItem` (`@/features/credit/queries`):**

```ts
export interface CreditAnalysisListItem {
  creditAnalysisId: string;
  partyId: string;
  legalName: string;
  analysisType: string | null;
  obligorType: string;
  internalRatingShort: string | null;
  currentCreditScore: string | null;  // string from DB; coerced with Number() in UI
  band: string | null;
  watchlistFlag: boolean | null;
  internalRatingAction: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  /** Derived PIT lifecycle - "current" (valid_to IS NULL) | "superseded". */
  lifecycleStatus: CreditLifecycleStatus;
  createdAt: Date | null;
}
```

**`BAND_GRADE` (`@/features/credit/scorecard`):**

```ts
export const BAND_GRADE: Record<Band, string> = {
  "BC-1": "Excellent",
  "BC-2": "Strong",
  "BC-3": "Adequate",
  "BC-4": "Below average",
  "BC-5": "Weak / sub-IG",
  "BC-6": "Distressed / near-default",
};
```

**`BAND_BADGE` (local):**

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

**Score color thresholds (local inline):**

| Score `s` | Class |
|-----------|--------|
| `s >= 70` | `text-emerald` |
| `s >= 55` | `text-gold` |
| `s >= 40` | `text-foreground` |
| else | `text-down` |

### Business purpose

Primary **credit book** list UX for relationship managers / credit analysts:

1. **Browse** paginated credit analyses with issuer name, analysis type, obligor type, internal rating short form, composite score, BC band + grade label, rating action / draft status, watchlist flag, created date.
2. **Search** by issuer (URL-driven `?q=` so shares/bookmarks work; server re-queries).
3. **Adjust density** (comfortable vs denser table) client-side only.
4. **Export** credit list CSV via `ExportCsvButton type="credit"`.
5. **Create** path: primary gold CTA → `/credit/new`.
6. **Navigate** to detail: entire row is a stretched `<Link>` to `/credit/{creditAnalysisId}`.

Empty states distinguish book-empty (`total === 0`) vs filter-miss (`rows.length === 0` but total may be non-zero for other pages — actually empty body uses `total === 0` for copy vs “No analyses match this view”).

### Key logic

**URL-synced search with debounce (280ms):**

```ts
const [search, setSearch] = React.useState(q ?? "");
const [lastQ, setLastQ] = React.useState(q ?? "");

// Sync from URL (back/forward) — setState during render pattern
if ((q ?? "") !== lastQ) {
  setLastQ(q ?? "");
  setSearch(q ?? "");
}

const pushSearch = (value: string) => {
  const params = new URLSearchParams(sp.toString());
  if (value.trim()) params.set("q", value.trim());
  else params.delete("q");
  params.delete("page"); // reset to page 1 on new search
  router.replace(qs ? `${pathname}?${qs}` : pathname);
};
// onSearchChange: setSearch immediately; debounce pushSearch 280ms
// cleanup: clearTimeout on unmount
```

**Density:**

```ts
const [density, setDensity] = React.useState<Density>("comfortable");
// passed to <Table density={density}>
```

**Range label (en-IN numerals):**

```ts
const rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
const rangeTo = Math.min(page * pageSize, total);
// Display: "{rangeFrom}-{rangeTo} of {total} analyses"
```

**Row mapping highlights:**

- `score = r.currentCreditScore != null ? Number(r.currentCreditScore) : null`; render `score.toFixed(1)` if finite.
- `analysisType` displayed as badge and as sub-label under issuer (`replace(/_/g, " ")`).
- Band badge: `{band}` + grade from `BAND_GRADE[r.band as keyof typeof BAND_GRADE]`.
- Status: `internalRatingAction` prettified, else `Badge outline` “draft”; optional watchlist `Badge variant="down"` with Warning icon.
- `createdAt.toLocaleDateString("en-IN", { year, month: "short", day: "2-digit" })`.

**Stretched-link row pattern:**

```tsx
// <tr> is relative (table row styling); Link uses after:absolute after:inset-0
// so whole row is clickable while remaining a real <a> (middle-click works).
// Issuer text uses relative z-10 so it paints above the pseudo.
<Link
  href={`/credit/${r.creditAnalysisId}`}
  className="… after:absolute after:inset-0 after:content-['']"
>
```

**Responsive columns:** Type / Obligor / Rating / Created hidden below `md`; mobile shows Issuer (+ type sub-label) + Score + Band + Status.

**Pagination:**

```ts
const pageHref = (p: number) =>
  `/credit?${new URLSearchParams({
    ...(q ? { q } : {}),
    page: String(p),
  }).toString()}`;

// Window: page ± 1, plus first/last with ellipsis when needed
const win = 1;
const start = Math.max(1, page - win);
const end = Math.min(totalPages, page + win);
```

- Prev/next: `Button asChild` + `Link`; disabled via `pointer-events-none opacity-40` + `aria-disabled` (href still points to clamped page).
- `PagePill`: active → gold ring/bg; `aria-current="page"`.
- Mobile touch targets: `h-11` / `size-11` (44px), desktop `md:h-8` / `md:size-8`.

**CommandBar actions:**

```tsx
<ExportCsvButton type="credit" />
<Button asChild variant="primary-gold" …>
  <Link href="/credit/new">New analysis</Link>
</Button>
```

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Search URL update | `router.replace` with `?q=` after 280ms debounce; clears `page` |
| Density state | Client-only `useState`; not persisted |
| Navigation | Next `Link` to `/credit/{id}`, `/credit/new`, paginated `/credit?…` |
| CSV export | Delegated to `ExportCsvButton` (feature module; own fetch/action) |
| Debounce timer cleanup | `useEffect` return clears timeout on unmount |
| No direct server actions in this file | List data is prop-driven from server page |

### Security / RBAC

- **No client-side RBAC** in this component. Access control must live in the server page / `listCreditAnalyses` query (RLS / session checks).
- Search is free-text `q` pushed to URL; server must sanitize/parameterize.
- `ExportCsvButton type="credit"` may re-check auth server-side; not enforced here.
- Detail and new-analysis links are unguarded in UI; unauthorized users would hit server denial on those routes.
- Renders issuer legal names, ratings, scores — sensitive credit data; assumes authenticated session already filtered the prop payload.
- `lifecycleStatus` is on the type but **not displayed** in this view (possible product gap).

### Coupling

| Depends on | Why |
|------------|-----|
| `@/features/credit/queries` | `CreditAnalysisListItem` shape |
| `@/features/credit/scorecard` | `BAND_GRADE` labels |
| `@/features/reports/export-button` | CSV export entry |
| `@/components/brand` | Table, CommandBar, Badge, Reveal, etc. |
| Next App Router | `useRouter`, `usePathname`, `useSearchParams`, `Link` |
| Server page `/credit` | Must supply paginated `listCreditAnalyses` props |
| Routes | `/credit`, `/credit/new`, `/credit/[id]` |

**Does not import** `credit-icons.tsx` (already client; uses phosphor directly).

### Risks / TODOs

| Item | Severity | Notes |
|------|----------|-------|
| `lifecycleStatus` unused | Medium | Type includes current/superseded PIT lifecycle but list never shows it — superseded rows may look identical to current |
| `validFrom` / `validTo` unused | Low | Validity window not shown |
| `partyId` unused | Info | Available for party deep-links but only credit analysis id is linked |
| Score as string from DB | Low | Coerced with `Number()`; non-numeric strings become non-finite → “-” |
| Debounced search + rapid typing | Low | Multiple `replace` navigations; soft but can thrash RSC refetch |
| Prev/next disabled still have href | Low | `pointer-events-none` blocks click; keyboard/AT may still activate Link depending on browser |
| Pagination drops other query params | Low | `pageHref` only preserves `q` + `page`, not other future filters |
| Empty match vs empty book | Info | Empty body when `rows.length === 0` uses `total === 0` for copy — correct for “no results on this page after filter” only if server returns total matching filter |
| Hard-coded band keys | Info | Unknown future bands fall back to `neutral` badge and empty grade string |
| Touch target CSS vs density | Info | Mobile h-11 on CTA/pagination independent of table density |

---

## Cross-file summary (batch 023)

| File | Lines | Kind | Primary concern |
|------|------:|------|-----------------|
| `source-data-panel.tsx` | 149 | Client UI shell | Collapse raw spreading table behind analytical canvas |
| `sparkline.tsx` | 187 | Client SVG chart | Period series glyph for ratio matrix |
| `credit-icons.tsx` | 54 | Client icon adapter | Phosphor Light wrappers safe for server-page imports |
| `credit-list-view.tsx` | 460 | Client list view | Searchable, paginated credit analyses ledger |

### Dependency graph (within batch)

```
credit-icons.tsx
  └── (used by) source-data-panel.tsx

sparkline.tsx          (standalone; consumed by workspace ratio matrix outside batch)
credit-list-view.tsx   (standalone list; no deps on the three workspace files)
source-data-panel.tsx  → credit-icons + brand + framer-motion
```

### Shared themes

1. **Credit module presentation** — workspace canvas vs list ledger.
2. **`"use client"` boundaries** — motion, phosphor, URL search all client-side; data fetched on server and passed as props/`children`.
3. **Design system** — brand `Card`/`Table`/`Badge`/`CommandBar`, CSS vars for tones, mono/nums for financial readout.
4. **Motion** — shared ease `[0.32, 0.72, 0, 1]`; GPU-friendly opacity/transform/`pathLength` only.
5. **Mobile thumb targets** — `h-11` / `size-11` with `md:` compact restore on list controls and source-data toggle.

### No issues requiring docs

Analysis complete for all four paths in `batch-023.list`.
