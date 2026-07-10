# Agent 038 — File-by-file analysis

**Batch:** `batch-038.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope note:** Paths are relative to app root. Docs ignored per instructions. Related modules consulted only for coupling/context (not listed in batch).

---

## 1. `src/app/modeling/scenario/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/modeling/scenario/page.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/modeling/scenario/page.tsx` |
| **Lines** | 37 |
| **Directive** | None (Server Component by default) |
| **Role** | Next.js App Router **route page** for `/modeling/scenario` — auth gate + chrome shell around the lazy Scenario desk client tree |

### Exports

```ts
export const dynamic = "force-dynamic";

export default async function Page(): Promise<JSX.Element>
```

No named component exports. No metadata export.

### Imports

| Source | Symbols |
|--------|---------|
| `next/link` | `Link` |
| `@/lib/rbac` | `requireUser` |
| `@/components/brand/badge` | `Badge` |
| `@/components/brand/button` | `Button` |
| `@/components/brand/page-shell` | `PageShell`, `PageHeader`, `DetailTopBar` |
| `./scenario-lazy` | `ScenarioDesk` |

**Referenced external signature (`requireUser` from `@/lib/rbac`):**

```ts
export async function requireUser(): Promise<CrmUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
```

### Business purpose

Landing surface for the **Scenario & sensitivity desk** under Modeling. Authenticated bankers choose a pure-function model type (bond / PF / DCF / M&A / LBO), flex key drivers (base + downside/upside %), and see best/base/worst corner cases plus a two-variable sensitivity heatmap. This page owns only:

1. Session enforcement (`requireUser`).
2. Route-level rendering policy (`force-dynamic` — no static cache of an auth-gated page).
3. Server-rendered layout chrome: back bar to Modeling library, title, capability badges.
4. Mount point for the client desk via the lazy wrapper.

### Key logic

```ts
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser();
  return (
    <PageShell wide>
      <DetailTopBar
        backHref="/modeling"
        backLabel="Modeling"
        crumb="Scenario"
        action={
          <Button asChild variant="secondary-hairline" size="sm">
            <Link href="/modeling">Library</Link>
          </Button>
        }
      />
      <PageHeader
        title="Scenario desk"
        description="Best / base / worst drivers with a two-variable sensitivity grid."
      />
      <div className="mb-6 flex flex-wrap gap-1.5">
        <Badge variant="neutral">5 model types</Badge>
        <Badge variant="neutral">Best / Base / Worst</Badge>
        <Badge variant="neutral">Sensitivity</Badge>
      </div>
      <ScenarioDesk />
    </PageShell>
  );
}
```

- **`await requireUser()`** — return value discarded; used purely as auth gate (redirect to `/login` if unauthenticated).
- **`PageShell wide`** — full-width modeling layout.
- **Static marketing badges** — “5 model types”, “Best / Base / Worst”, “Sensitivity” (UI copy only; not driven by registry length at runtime).
- **No data fetch** for models, deals, or parties on this page.

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Auth redirect | `requireUser()` → `redirect("/login")` if no session |
| Dynamic rendering | `export const dynamic = "force-dynamic"` disables static generation/caching for this route |
| UI render | Server HTML for chrome; client chunk for desk |

No DB writes, no cookies set, no revalidation in this file.

### Security / RBAC

- **Authenticated users only** via `requireUser()`.
- **No resource-level permission check** in this page (e.g. no `can(user, "read"|"create", "financial_model")`). Any logged-in CRM user who can hit the route sees the desk UI and can run client-side pure computations.
- **Save / persist** is gated later in server action `createModel` (`can(user, "create", "financial_model")`) — not here.
- No sensitive server data is serialized into the page props (desk loads defaults client-side).

### Coupling

| Direction | Target |
|-----------|--------|
| **Depends on** | `./scenario-lazy` → `./scenario` (client desk) |
| **Depends on** | Brand shell: `PageShell`, `PageHeader`, `DetailTopBar`, `Badge`, `Button` |
| **Depends on** | `@/lib/rbac.requireUser` |
| **Route peers** | `/modeling` library (`backHref`, Library link); other modeling desks under `src/app/modeling/*` |
| **Does not import** | `@/features/modeling/scenarioAnalysis`, actions, or DB |

### Risks / TODOs

1. **Auth ≠ authorization:** any authenticated user can open the desk; only save is permission-gated. If modeling is restricted by role, this page needs a `can(...)` check.
2. **Badge “5 model types”** hard-coded — drifts if `SCENARIO_MODEL_LIST` grows/shrinks.
3. **No `metadata` export** — title/description for browser tab may fall through to root layout defaults.
4. **`requireUser` result unused** — cannot pass user context to desk (desk does not need it today).

---

## 2. `src/app/modeling/scenario/scenario-lazy.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/modeling/scenario/scenario-lazy.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/modeling/scenario/scenario-lazy.tsx` |
| **Lines** | 43 |
| **Directive** | `"use client"` |
| **Role** | Client-only **code-split boundary** wrapping `ScenarioDesk` with `next/dynamic` (`ssr: false`) + loading skeleton |

### Exports

```ts
export function ScenarioDesk(): JSX.Element
```

**Internal (non-exported):**

| Name | Purpose |
|------|---------|
| `ScenarioDeskLazy` | Result of `dynamicImport(() => import("./scenario").then(m => m.ScenarioDesk), { ssr: false, loading })` |
| `ScenarioSkeleton` | Pulse layout placeholder matching desk grid (4+8 col + bottom panel) |

### Imports

| Source | Symbols |
|--------|---------|
| `next/dynamic` | `dynamicImport` (default import renamed) |
| `react` | `* as React` |

Dynamic import target: `./scenario` → named export `ScenarioDesk`.

### Business purpose

Keeps heavy client deps (framer-motion; comment also mentions recharts — see risks) out of the route’s first-load / server bundle. Server `page.tsx` cannot call `dynamic(..., { ssr: false })` itself, so this `"use client"` module owns that call. Header/back chrome on the page SSR immediately; desk body shows a CLS-safe skeleton until the chunk arrives.

### Key logic

```ts
const ScenarioDeskLazy = dynamicImport(
  () => import("./scenario").then((m) => m.ScenarioDesk),
  {
    ssr: false,
    loading: () => <ScenarioSkeleton />,
  },
);

export function ScenarioDesk() {
  return <ScenarioDeskLazy />;
}

function ScenarioSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="h-[480px] w-full animate-pulse rounded-2xl bg-foreground/[0.04] ring-1 ring-hairline" />
        </div>
        <div className="lg:col-span-8">
          <div className="h-[480px] w-full animate-pulse rounded-2xl bg-foreground/[0.04] ring-1 ring-hairline" />
        </div>
      </div>
      <div className="h-[320px] w-full animate-pulse rounded-2xl bg-foreground/[0.04] ring-1 ring-hairline" />
    </div>
  );
}
```

- **`ssr: false`** — desk never renders on server; avoids framer-motion/browser-only paths during RSC render.
- **Named re-export shape** — page imports `{ ScenarioDesk }` from this file; actual implementation is in `./scenario`.
- **Skeleton** — decorative only (`aria-hidden`); three pulse blocks approximating left drivers + right outcomes + lower sensitivity.

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Network | Lazy-fetches `./scenario` JS chunk after client hydration |
| No SSR of desk | `ssr: false` — empty/skeleton on first paint server HTML for desk slot |

No data fetching, cookies, or mutations.

### Security / RBAC

- None. Pure presentation/loading boundary.
- Does not weaken or strengthen page auth; inherits parent page gate.

### Coupling

| Direction | Target |
|-----------|--------|
| **Imported by** | `./page.tsx` |
| **Loads** | `./scenario` (`ScenarioDesk`) |
| **Framework** | `next/dynamic` |

### Risks / TODOs

1. **Comment vs code:** header comment says “framer-motion + recharts”; current `scenario.tsx` uses **framer-motion** and a **native HTML table** heatmap — no recharts import. Comment is stale.
2. **`React` import** is unused at runtime (only JSX); may trip unused-import lint depending on config.
3. **Skeleton layout** (`lg:grid-cols-12` 4+8) does not perfectly match desk’s actual layout (`lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]` + stacked right column) — minor CLS risk on large screens.
4. **No error boundary** around dynamic import — chunk load failure surfaces as Next dynamic error, not a branded fallback.
5. **Double name `ScenarioDesk`** (wrapper + real) can confuse stack traces / React DevTools.

---

## 3. `src/app/modeling/scenario/scenario.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/modeling/scenario/scenario.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/modeling/scenario/scenario.tsx` |
| **Lines** | 564 |
| **Directive** | `"use client"` |
| **Role** | Full **Scenario desk UI** — model picker, driver editors, best/base/worst cards, two-variable sensitivity heatmap, save-to-`financial_model` dialog |

### Exports

```ts
export function ScenarioDesk(): JSX.Element
```

All other symbols are file-private.

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React`, `useActionState` |
| `framer-motion` | `animate`, `useInView` |
| `@phosphor-icons/react` | `ArrowRight`, `Crosshair`, `FloppyDisk`, `Sparkle`, `TrendDown`, `TrendUp` |
| `@/features/modeling/scenarioAnalysis` | `SCENARIO_MODEL_LIST`, `getScenarioModel`, `computeScenarios`, `computeSensitivity`, `defaultDriverState`, `formatDriver`, `formatOutcome`, types `ScenarioModelType`, `DriverStateMap`, `ScenarioCases`, `ScenarioOutcome`, `SensitivityGrid` |
| `@/features/modeling/actions` | `createModel`, type `CreateModelState` |
| `@/components/brand/button` | `Button` |
| `@/components/brand/card` | `Card`, `CardBody`, `CardDescription`, `CardHeader`, `CardTitle` |
| `@/components/brand/badge` | `Badge` |
| `@/components/brand/text` | `Eyebrow` |
| `@/components/brand/reveal` | `Reveal` |
| `@/components/brand/input` | `Input` |
| `@/components/brand/select` | `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` |
| `@/components/ui/dialog` | `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`, `DialogTrigger` |
| `@/components/ui/label` | `Label` |
| `@/lib/utils` | `cn` |

### Local types / helpers (quoted)

```ts
interface DriverForm {
  base: string;
  downPct: string;
  upPct: string;
}
type DriverFormMap = Record<string, DriverForm>;

function initDriverForm(type: ScenarioModelType): DriverFormMap
function toDriverState(form: DriverFormMap, type: ScenarioModelType): DriverStateMap
```

**CSS class constants:**

```ts
const fieldClass = cn(
  "bezel-hi h-11 w-full rounded-xl bg-surface px-3.5 text-[14px] text-foreground nums",
  "ring-1 ring-hairline transition-all duration-200 ease-soft",
  "placeholder:text-muted-foreground/55",
  "focus:ring-gold/60 focus:outline-none",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
);

const smallFieldClass = cn(
  "bezel-hi h-9.5 w-full rounded-lg bg-surface px-2.5 text-[13px] text-foreground nums",
  "ring-1 ring-hairline transition-all duration-200 ease-soft",
  "placeholder:text-muted-foreground/55",
  "focus:ring-gold/60 focus:outline-none",
);
```

**Internal components:**

| Name | Signature | Purpose |
|------|-----------|---------|
| `LiveNumber` | `({ value, format, className?, duration? }: { value: number; format: (n: number) => string; className?: string; duration?: number })` | Count-up animation via framer-motion `animate` when in view |
| `ScenarioDesk` | `()` | Main desk state + layout |
| `CaseCard` | `({ label, icon, tone, cases }: { label: string; icon: React.ReactNode; tone: "up" \| "down" \| "gold"; cases: ScenarioOutcome })` | Worst / Base / Best outcome card |
| `SensitivityHeatmap` | `({ grid, basePrimary }: { grid: SensitivityGrid; basePrimary: number \| null })` | Colored sensitivity table |

### Referenced external types (from `@/features/modeling/scenarioAnalysis`)

```ts
export type ScenarioModelType =
  | "bond"
  | "project_finance"
  | "dcf"
  | "ma"
  | "lbo";

export interface ScenarioOutcome {
  primary: number | null;
  primaryLabel: string;
  primaryFormat: OutcomeFormat;
  secondary?: number | null;
  secondaryLabel?: string;
  secondaryFormat?: OutcomeFormat;
}

export interface ScenarioCases {
  best: ScenarioOutcome;
  base: ScenarioOutcome;
  worst: ScenarioOutcome;
  direction: Record<string, boolean>;
  bounds: Record<string, { base: number; min: number; max: number }>;
}

export interface DriverState {
  base: number;
  min: number;
  max: number;
}
export type DriverStateMap = Record<string, DriverState>;

export interface SensitivityGrid {
  xDriver: string;
  yDriver: string;
  xLabel: string;
  yLabel: string;
  xUnit: DriverUnit;
  yUnit: DriverUnit;
  xSteps: number[];
  ySteps: number[];
  cells: (number | null)[][];
  format: OutcomeFormat;
}

export function getScenarioModel(type: ScenarioModelType): ScenarioModelDef;
export function defaultDriverState(def: ScenarioModelDef): DriverStateMap;
export function computeScenarios(def: ScenarioModelDef, state?: DriverStateMap): ScenarioCases;
export function computeSensitivity(
  // signature in engine: def, xKey, yKey, steps, state?
): SensitivityGrid;
export function formatDriver(v: number, unit: DriverUnit, digits = 2): string;
export function formatOutcome(v: number | null, format: OutcomeFormat, digits = 2): string;
export const SCENARIO_MODEL_LIST: ScenarioModelDef[];
```

**Referenced action types (`@/features/modeling/actions`):**

```ts
export type CreateModelState = { error?: string } | undefined;

export async function createModel(
  _prev: CreateModelState,
  formData: FormData,
): Promise<CreateModelState>;
```

**Allowed `modelType` including this desk’s save path (server enum):**

```ts
const MODEL_TYPES = [
  "bond_pricing",
  "project_finance",
  "securitization",
  "dcf",
  "m_and_a",
  "lbo",
  "valuation",
  "portfolio_construction",
  "scenario_stress",
] as const;
```

### Business purpose

Interactive **scenario / stress modeling** for investment bankers (FINANCIAL_MODELING_SPEC §9 pattern):

1. Pick one of five pure engines via `SCENARIO_MODEL_LIST` (LBO default).
2. Edit each driver as **base value + downside % + upside %** (UI strings → min/max derived).
3. Recompute **corner cases**: all drivers at improving extreme = Best; all at worsening = Worst; base at base (direction classification lives in engine).
4. Build a **2-D sensitivity grid** over two selected drivers (others held at base); heatmap colors relative to base primary.
5. Optionally **persist** a versioned `financial_model` row with `model_type = scenario_stress`, packing driver state + sensitivity axes into `params` and best/base/worst into `outputs`.

All heavy math runs **client-side** via pure functions in `scenarioAnalysis` (which wrap bond/PF/DCF/M&A/LBO engines). Server is only hit on save.

### Key logic

#### Form init / conversion

```ts
function initDriverForm(type: ScenarioModelType): DriverFormMap {
  const def = getScenarioModel(type);
  const state = defaultDriverState(def);
  // For each driver:
  //   downPct = round(((base - min) / |base|) * 100)  when base !== 0 else 0
  //   upPct   = round(((max - base) / |base|) * 100)  when base !== 0 else 0
  //   base string = Number(base.toFixed(4))
}

function toDriverState(form: DriverFormMap, type: ScenarioModelType): DriverStateMap {
  // base = Number(f.base) || 0
  // min  = base * (1 - down/100)
  // max  = base * (1 + up/100)
  // if min > max, swap
}
```

Fallback if form missing key: `{ base: String(d.base), downPct: "20", upPct: "20" }`.

#### Main desk state

```ts
const [type, setType] = React.useState<ScenarioModelType>("lbo");
const [form, setForm] = React.useState<DriverFormMap>(() => initDriverForm("lbo"));
const [xKey, setXKey] = React.useState<string>(() => getScenarioModel("lbo").defaultSensitivityX);
const [yKey, setYKey] = React.useState<string>(() => getScenarioModel("lbo").defaultSensitivityY);
const [steps, setSteps] = React.useState<number>(7); // fixed; no UI control

const [saveState, saveAction, savePending] = useActionState<CreateModelState, FormData>(
  createModel,
  undefined,
);
const [saveOpen, setSaveOpen] = React.useState(false);
```

**Memos:**

```ts
const state = useMemo(() => toDriverState(form, type), [form, type]);
const cases = useMemo(() => computeScenarios(def, state), [def, state]);
const grid = useMemo(
  () => computeSensitivity(def, xKey, yKey, steps, state),
  [def, xKey, yKey, steps, state],
);

const paramsJson = JSON.stringify({
  scenarioModelType: type,
  driverState: state,
  sensitivity: { xKey, yKey, steps },
});
const outputsJson = JSON.stringify({
  best: cases.best,
  base: cases.base,
  worst: cases.worst,
  direction: cases.direction,
});
```

**Model change** resets form + default X/Y sensitivity keys for the new model.

#### Save form (hidden fields + optional links)

| Form field | Value / source |
|------------|----------------|
| `modelType` | hidden `"scenario_stress"` |
| `currencyCode` | hidden `"INR"` |
| `params` | `paramsJson` (driver state + sensitivity axes) |
| `outputs` | `outputsJson` (best/base/worst + direction) |
| `engineVersion` | hidden `"scenarioAnalysis.v1"` |
| `scenarioTag` | optional text |
| `dealId` | optional UUID string |
| `partyId` | optional UUID string |

Submit via `action={saveAction}` → server `createModel`.

#### `LiveNumber`

- First in-view: animate 0 → `value` (ease `[0.32, 0.72, 0, 1]`, default duration 0.8s), `playedRef` locks one-shot intro.
- Subsequent `value` changes: snap `setDisplay(value)` without re-animating from 0.
- Formats via caller `format` (uses `formatOutcome` with null → `"n/a"` for primary null).

#### `CaseCard`

- Tone → accent classes: `up` → emerald/up, `down` → down, `gold` → gold.
- Primary via `LiveNumber`; secondary row if `secondary != null && secondaryLabel`.

#### `SensitivityHeatmap`

```ts
// finite cells only → min, max, span = max(max-min, 1e-9)
// base = basePrimary if finite else (min+max)/2
// cellStyle(v):
//   adv = v - base; t = clamp(adv/span, -1, 1)
//   adv >= 0 → color-mix emerald (10 + |t|*42)% into surface
//   else      → color-mix down/rose similarly
```

- Sticky corner header: `{yLabel} \ {xLabel}`.
- Cell `title` tooltip: Y · X → formatted outcome.
- Legend: worse / better than base + “Base {formatOutcome(basePrimary, …)}”.
- Empty grid: copy “No finite outcomes across the grid.”

#### Layout structure

1. Model selector card — pill buttons from `SCENARIO_MODEL_LIST`.
2. Two-column grid: sticky Drivers (left) + Outcomes/Sensitivity (right).
3. Drivers: per-driver Base / Down % / Up % inputs; range display via `formatDriver(min–max)`.
4. Save dialog trigger at bottom of drivers card.
5. Corner cases card (Worst / Base / Best).
6. Sensitivity card with X/Y selects (driver keys).

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Persist model | Form → `createModel` server action (`useActionState`) — inserts `financial_model`, revalidates paths (in action, not this file) |
| Client recompute | Every form/type/axis change re-runs pure compute in `useMemo` (CPU-bound on main thread) |
| Animation | framer-motion `animate` on LiveNumber; `useInView` observer |
| Dialog open state | local `saveOpen` |

No direct `fetch`, cookies, or router navigation in this file. Success save does **not** auto-close dialog or navigate (no `useEffect` on `saveState`).

### Security / RBAC

- **Client-only computation** for scenarios — no server trust boundary for math results shown in UI.
- **Save authorization** enforced in `createModel`:
  - `requireUser()`
  - `can(user, "create", "financial_model")`
  - Optional deal/party link scoped via ownership / admin-read-all (`canLinkModelTarget`)
  - Zod: `modelType` enum, optional UUIDs for deal/party, params/outputs required JSON strings
- **UI does not pre-check** create permission — unauthorized users still see “Save scenario set”; they get `saveState.error` after submit.
- **`dealId` / `partyId` free-text UUID** — no client UUID format validation; invalid UUID fails server Zod.
- **Hidden fields** (`params`, `outputs`, `modelType`, `engineVersion`) are client-controlled; server must treat them as untrusted JSON blobs (schema validation per model_type is app-layer responsibility per actions comment — this desk does not re-validate engine outputs server-side in this file).
- **Currency hard-coded INR** — intentional for desk defaults; not user-editable here.
- No XSS sinks beyond React text interpolation; `style={{ background, color }}` uses computed CSS variables / color-mix strings from numbers only.

### Coupling

| Coupling | Detail |
|----------|--------|
| **Strong** | `@/features/modeling/scenarioAnalysis` — registry, compute, format, type union of 5 models |
| **Strong** | `@/features/modeling/actions.createModel` — FormData contract (`modelType`, `currencyCode`, `params`, `outputs`, `engineVersion`, `scenarioTag`, `dealId`, `partyId`) |
| **Strong** | Loaded only via `scenario-lazy.tsx` (`dynamic` + `ssr:false`) |
| **UI** | Brand Card/Button/Badge/Input/Select/Reveal + shadcn Dialog/Label |
| **Downstream consumers of saved rows** | `src/app/modeling/[id]/page.tsx` label map `scenario_stress: "Scenario / stress"`; `model-library.tsx` same |
| **DB enum** | `scenario_stress` in `src/db/schema/enums.ts` and `MODEL_TYPES` in actions |
| **Tests** | `src/__tests__/scenarioAnalysis.test.ts` covers engine, not this UI |

Does **not** import `@/db` directly.

### Risks / TODOs

1. **`steps` state is dead UI control** — always `7`; `setSteps` never called. No way for user to change grid resolution; dead code smell.
2. **No success UX on save** — dialog stays open; no redirect to `/modeling/[id]`; no toast; only error path renders `saveState?.error`.
3. **`CreateModelState` has no success id** — UI cannot deep-link to created model without action API change.
4. **Permission-blind save button** — users without `financial_model:create` waste a round-trip.
5. **`Number(f.base) \|\| 0`** treats empty/`0`/NaN as 0; scientific strings parse; no min/max clamp against driver `step` or registry bounds.
6. **Base = 0** makes `initDriverForm` down/up % both 0 (division by zero avoided); users then get min=max=0 until they set non-zero base — corner-case UX.
7. **Same driver for X and Y** allowed — grid still computes but is redundant; no validation.
8. **Client CPU** — large `steps` (if ever exposed) × engine cost per cell can freeze UI; currently fixed at 7.
9. **`params`/`outputs` are opaque JSON** — library detail page may not render scenario-specific structure richly (depends on `[id]` view; not this file).
10. **DialogTrigger `render` prop** — relies on custom Dialog API (`render={<Button …/>}`); non-standard vs classic `asChild`; fragile if Dialog primitive changes.
11. **`direction` saved in outputs but never displayed** in this UI (engine computes; UI omits per-driver direction badges).
12. **Accessibility:** skeleton in lazy wrapper is `aria-hidden`; heatmap is a dense table without caption/`aria-describedby`; model pills are plain `<button>`s without `aria-pressed`.
13. **No unsaved-changes guard** when switching model type (form reset loses edits).
14. **Currency / engine version** fixed — multi-currency desks would need form fields.
15. **Stale comment in lazy file** recharts; this file has no chart library dependency.

---

## 4. `src/app/not-found.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/not-found.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/not-found.tsx` |
| **Lines** | 40 |
| **Directive** | None (Server Component) |
| **Role** | Root App Router **`not-found` UI** — branded 404 for unmatched routes under the root layout |

### Exports

```ts
export default function NotFound(): JSX.Element
```

### Imports

| Source | Symbols |
|--------|---------|
| `next/link` | `Link` |
| `@/components/brand` | `Button`, `Card` |
| `@/components/brand/text` | `Eyebrow` |
| `@/components/brand/icons` | `Question` |

### Business purpose

Replace Next.js’s default stark 404 with an **on-brand “not found” surface** for Binary CRM. Communicates calmly that the URL is invalid or the record was removed, and offers a primary path back to the dashboard (`/`). Renders inside the root layout so brand fonts, CSS variables, and shell chrome apply. Explicitly **not** an error boundary — no stack traces or exception text (404 is a routing outcome).

### Key logic

```ts
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 py-16 md:px-10 md:py-24 lg:px-16">
      <Card>
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <span aria-hidden className="…">
            <Question weight="light" />
          </span>
          <Eyebrow dot>Not found</Eyebrow>
          <p className="…">This page isn’t here.</p>
          <p className="…">
            The link may be old, or the record may have been removed. Head back
            to the command center to pick up where you left off.
          </p>
          <div className="mt-1.5">
            <Button asChild variant="primary-gold" size="md">
              <Link href="/">Back to dashboard</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
```

- Pure presentational server component; no hooks, no data loading.
- Icon decorative (`aria-hidden`).
- Single CTA → `/`.

### Side effects

- None beyond rendering HTML.
- HTTP status `404` is set by Next.js framework when this UI is invoked via `notFound()` or unmatched segment — not set inside this file.

### Security / RBAC

- **No auth check** — intentional: 404s can occur for anonymous and authenticated users; root layout may still wrap with shared chrome/session.
- **No information disclosure** — does not echo the missing path, resource IDs, or errors.
- Does not distinguish “does not exist” vs “exists but unauthorized” (authorization failures should use separate forbidden flows elsewhere).

### Coupling

| Direction | Target |
|-----------|--------|
| **Framework** | Next.js App Router convention `src/app/not-found.tsx` |
| **UI** | Brand `Card`, `Button`, `Eyebrow`, `Question` icon |
| **Navigation** | `Link` to `/` (dashboard / command center) |
| **Parent** | Root layout (fonts, globals) |

May be nested under authenticated layout depending on app structure; file itself is layout-agnostic.

### Risks / TODOs

1. **No `notFound()` call sites analyzed here** — segment-level `not-found.tsx` files (if any) would override for nested trees; this is the **root** fallback only.
2. **CTA always `/`** — deep-link users who lost a party/deal URL get no contextual recovery (search, recent records).
3. **Unauthenticated users** hitting 404 may still see root layout chrome (nav/shell) depending on layout auth — possible flash of app chrome before login if layout does not gate.
4. **Copy is English-only** — no i18n.
5. **No logging/metrics** of 404 paths (product analytics would live in middleware or layout, not here).

---

## Batch 038 cross-cutting summary

| File | Kind | Auth | Mutations | Notes |
|------|------|------|-----------|-------|
| `modeling/scenario/page.tsx` | RSC route page | `requireUser` | none | Shell + force-dynamic |
| `modeling/scenario/scenario-lazy.tsx` | Client dynamic boundary | none | none | `ssr:false` + skeleton |
| `modeling/scenario/scenario.tsx` | Client desk UI | save via `createModel` RBAC | `createModel` → `financial_model` | Pure client math; `scenario_stress` |
| `not-found.tsx` | Root 404 | none | none | Branded empty state |

**Primary product feature in batch:** Scenario & sensitivity modeling desk at `/modeling/scenario`, three-layer split (auth page → lazy client → full desk).

**Primary security pattern:** page-level authentication only; create permission and deal/party link scope enforced in shared modeling server action, not in the page UI.
