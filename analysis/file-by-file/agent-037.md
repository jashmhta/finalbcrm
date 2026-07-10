# Agent 037 — File-by-file analysis

**Batch:** `batch-037.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope note:** Paths are relative to app root. Docs ignored per instructions. Related modules consulted only for coupling/context (not listed in batch): `ma-calculator-lazy.tsx`, `@/features/modeling/maModel`, `@/features/modeling/actions`, `@/features/modeling/queries`, `@/lib/rbac`.

---

## 1. `src/app/modeling/ma-calculator/ma-calculator.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/modeling/ma-calculator/ma-calculator.tsx` |
| **Lines** | 978 |
| **Role** | Client-side M&A screening calculator UI — form inputs, live recompute, results dashboard (accretion, IRR, S&U, goodwill), save-as-model dialog |
| **Exports** | `export function MaCalculator()` — sole public export; all other components/helpers are file-private |
| **Imports** | See table below |

### Imports (quoted)

| Source | Symbols |
|--------|---------|
| `"use client"` | Client Component directive |
| `react` | `* as React`, `useActionState` |
| `framer-motion` | `animate`, `useInView` |
| `recharts` | `Bar`, `BarChart`, `Cell`, `CartesianGrid`, `ReferenceLine`, `ResponsiveContainer`, `Tooltip`, `XAxis`, `YAxis` |
| `@phosphor-icons/react` | `ArrowRight`, `Calculator`, `FloppyDisk`, `Handshake`, `Sparkle`, `Target`, `TrendUp` |
| `@/features/modeling/maModel` | `computeMaModel`, `maDefaults`, `cr as crFmt`, `inrAbs`, `pctFmt`, `epsFmt`, `type MaInputs`, `type MaResult` |
| `@/features/modeling/actions` | `createModel`, `type CreateModelState` |
| `@/components/brand/*` | `Button`, `Card`/`CardBody`/`CardDescription`/`CardHeader`/`CardTitle`, `Badge`, `Eyebrow`, `Reveal`, `Input`, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue`, `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow` |
| `@/components/ui/dialog` | `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`, `DialogTrigger` |
| `@/components/ui/label` | `Label` |
| `@/lib/utils` | `cn` |

**Note:** `Calculator` and `inrAbs` are imported but **unused** in this file (dead imports).

### Business purpose

Interactive **M&A deal screening** instrument for Binary CRM bankers: enter acquirer/target financials and deal structure (consideration, fees, financing, synergies, hold/exit), then view:

1. **Run-rate EPS accretion/dilution** (pro-forma vs standalone)
2. **Acquirer deal IRR** (deployed capital → FCF + synergies → exit equity)
3. **Sources & Uses** with cash plug / funding shortfall flag
4. **IFRS 3 / Ind AS 103 goodwill** (purchase price allocation)
5. Optional **persist** of the run as a versioned `financial_model` (`model_type = m_and_a`) via server action

Currency UX is **₹ Crore** for most amounts (×1e7 on convert), shares in **millions** (×1e6), percentages entered as whole numbers then ÷100.

### Types / signatures (quoted)

```ts
interface FormState {
  // Acquirer
  acqRevenueCr: string;
  acqEbitdaMarginPct: string;
  acqNetIncomeCr: string;
  acqSharesMn: string;
  acqSharePrice: string;
  acqExistingDebtCr: string;
  acqCashCr: string;
  acqTaxRatePct: string;
  // Target
  tgtRevenueCr: string;
  tgtEbitdaCr: string;
  tgtNetIncomeCr: string;
  tgtFreeCashFlowCr: string;
  tgtExistingDebtCr: string;
  tgtCashCr: string;
  tgtNetAssetsCr: string;
  // Deal - consideration & fees
  equityPurchasePriceCr: string;
  refinanceTargetDebt: "yes" | "no";
  targetCashAcquired: "yes" | "no";
  advisoryFeePct: string;
  financingFeePct: string;
  integrationCostCr: string;
  // Deal - financing
  newDebtCr: string;
  newDebtCostPct: string;
  stockConsiderationCr: string;
  // Deal - synergies
  runRateSynergiesCr: string;
  synergyPhaseInYears: string;
  synergyRealizationPct: string;
  // Deal - returns
  holdPeriodYears: string;
  exitEvEbitda: string;
}

function defaultsFromModel(): FormState
function toMaInputs(f: FormState): MaInputs

// UI primitives
function Field({ label, htmlFor?, hint?, children }: { ... }): JSX
function FieldDivider({ label? }: { label?: string }): JSX
function LiveNumber({ value, format, className?, duration? }: {
  value: number;
  format: (n: number) => string;
  className?: string;
  duration?: number; // default 0.9
}): JSX
function MetricTile({ label, value, hint?, tone? }: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "up" | "down" | "gold" | "emerald";
}): JSX

export function MaCalculator(): JSX

function Results({ result: r, inputs }: { result: MaResult; inputs: MaInputs }): JSX
function SuTable({ title, rows, total, tone }: {
  title: string;
  rows: { label: string; amount: number; note?: string }[];
  total: number;
  tone: "up" | "down";
}): JSX
function BridgeRow({ label, value, muted?, bold?, tone? }: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  tone?: "default" | "up" | "down" | "gold";
}): JSX
function DealIrrChart({ r }: { r: MaResult }): JSX
function IrrTooltip({ active?, payload? }: {
  active?: boolean;
  payload?: Array<{ payload: { year: string; total: number; kind: string } }>;
}): JSX
```

**Engine types consumed (from `maModel`, not defined here):**

```ts
// MaInputs = { acquirer, target, deal }
// MaResult = {
//   sourcesAndUses: MaSourcesAndUses,
//   goodwill: MaGoodwill,
//   accretionDilution: MaAccretionDilution,
//   dealIrr: MaDealIrr,
//   combinedMarketCap: number,
//   impliedEv: number,
//   notes: string[],
// }
```

**Save action types:**

```ts
// CreateModelState = { error?: string } | undefined
// useActionState<CreateModelState, FormData>(createModel, undefined)
```

### Key logic

#### Unit conversion (`toMaInputs` / `defaultsFromModel`)

- **Crore fields:** UI string × `1e7` → absolute INR for engine; reverse ÷ `1e7` for defaults.
- **Percent fields:** UI ×100 display; engine stores decimal (`pct = Number/100`).
- **Shares:** UI millions × `1e6` → share count.
- **Booleans:** `"yes" | "no"` selects for `refinanceTargetDebt`, `targetCashAcquired`.
- Non-numeric / empty coerced via `Number(s) || 0` (no Zod on the client path).

#### Live compute

```ts
const inputs = useMemo(() => toMaInputs(form), [form]);
const { result, error } = useMemo(() => {
  try {
    const r = computeMaModel(inputs);
    if (!Number.isFinite(r.accretionDilution.accretionPct)) {
      return { result: null, error: "Check inputs - accretion did not compute." };
    }
    return { result: r, error: undefined };
  } catch {
    return {
      result: null,
      error: "Check the inputs - share count, price and purchase price are required.",
    };
  }
}, [inputs]);
```

- Pure client recompute on every form change (no debounce).
- Invalid / non-finite accretion → empty results panel with message.
- Engine exceptions caught generically (no error surface from engine message).

#### Consideration badge

```ts
const consideration =
  Number(form.stockConsiderationCr) <= 0
    ? "Cash deal"
    : Number(form.stockConsiderationCr) >= Number(form.equityPurchasePriceCr)
      ? "Stock deal"
      : "Mixed (cash + stock)";
```

#### Save-as-model dialog

Hidden fields posted to `createModel` server action:

| Hidden name | Value |
|-------------|--------|
| `modelType` | `"m_and_a"` |
| `currencyCode` | `"INR"` |
| `params` | `JSON.stringify(inputs)` (`MaInputs`) |
| `outputs` | `JSON.stringify(result)` or `"{}"` |
| `engineVersion` | `"maModel.v1"` |

Optional visible fields: `scenarioTag`, `dealId` (UUID), `partyId` (UUID), `assumptionsDoc`.

`DialogTrigger` uses `render={<Button ... />}` pattern (custom dialog API). Save disabled when `!result`. Pending state disables submit and shows “Saving…”.

#### Results layout (when `result` present)

1. **Headline dual readout:** EPS accretion % (`LiveNumber` + gold/down tone) + deal IRR; badges Accretive/Dilutive, Implied EV, IRR.
2. **Metric tiles (8):** Goodwill, Pro-forma EPS, New shares, After-tax interest, After-tax synergies, Exit EBITDA, Combined m-cap, Funding balanced/shortfall.
3. **Sources & Uses:** two `SuTable`s from `su.sources` / `su.uses`; shortfall warning if `su.fundingShortfall`.
4. **Goodwill & accretion bridge:** PPA rows + pro-forma EPS build using `inputs` + `acc.*`.
5. **Deal IRR chart + table:** `DealIrrChart` bar chart (Y0 outflow, interim inflows emerald, exit gold); year-by-year FCF / synergy / exit / net CF table.
6. **Modelling notes:** `r.notes[]` if non-empty.

#### `LiveNumber` animation

- Framer `animate(0 → value)` once when `useInView` fires (`once: true`, `margin: "-5%"`).
- Subsequent value changes after play: direct `setDisplay(value)` (no re-animate).
- Custom ease `[0.32, 0.72, 0, 1]`.

#### `DealIrrChart` data shape

```ts
{ year: "Y0" | `Y${n}`, total: number, kind: "out" | "in" | "exit" }
```

Colors: `--down` / `--emerald` / `--gold` via CSS vars on `Cell`.

### Side effects

| Effect | Where |
|--------|--------|
| **Client state** | `form`, `saveOpen`; `useActionState` for save |
| **Server mutation** | `createModel` via form `action={saveAction}` — inserts `financial_model` row (engine outside this file) |
| **No fetch/DB** | All compute is in-browser via `computeMaModel` |
| **No navigation** | Stay on page after save; error only if `saveState?.error` |
| **Animation timers** | Framer `animate` controls stopped on unmount |
| **JSON serialization** | `paramsJson` / `outputsJson` re-stringified when inputs/result change (hidden inputs) |

### Security / RBAC

- **No auth in this file** — page wrapper (`page.tsx`) calls `requireUser()`.
- **Save path RBAC is server-side** in `createModel`:
  - `requireUser()`
  - `can(user, "create", "financial_model")`
  - Optional deal/party link scoped via `canLinkModelTarget` (assignment/ownership checks for non-admin)
- Client can craft any `params`/`outputs` JSON in the form (hidden fields are editable in DevTools) — server should treat them as untrusted blobs (validate schema/type/size in `createModel` / Zod).
- Free-text `assumptionsDoc`, UUID fields for deal/party — UUID link authorization is on server; spoofed IDs rejected if user lacks link rights.
- No XSS sinks beyond React text rendering of engine notes/labels; JSON in attributes is React-escaped.
- Financial sensitivity: deal assumptions live in browser memory and may be persisted to DB on save — relies on model read RBAC (`listModels` visibility) for confidentiality after save.

### Coupling

| Direction | Target |
|-----------|--------|
| **Engine** | `@/features/modeling/maModel` — pure math + formatters; engineVersion `"maModel.v1"` must stay aligned with engine API |
| **Persistence** | `@/features/modeling/actions` → `createModel` → table `financial_model` |
| **Route host** | Imported dynamically by `ma-calculator-lazy.tsx` (`ssr: false`) which page.tsx uses as `MaCalculator` |
| **UI system** | Brand design system (`Card`, `Button`, `Table`, `Input`, `Select`, `Reveal`) + shadcn-style `Dialog`/`Label` |
| **Charts/motion** | `recharts`, `framer-motion` (heavy client deps — reason for lazy + `ssr:false`) |
| **Sibling pattern** | Mirrors bond/LBO calculators’ “machined-instrument” field styling (`fieldClass`, sticky left inputs / right results) |

### Risks / TODOs

1. **Unused imports:** `Calculator`, `inrAbs` — lint noise / dead code.
2. **No client validation beyond Number coercion** — invalid UUIDs for deal/party only fail on server; silent 0-fill can hide user typos (empty → 0).
3. **Save success UX** — no toast/redirect/close dialog on success; `saveState` only surfaces `error`. User may re-submit duplicates.
4. **Dialog not closed on success** — `setSaveOpen` only via `onOpenChange`; success does not auto-close.
5. **`outputs` when result null** is `"{}"` but Save button disabled when `!result` — OK, but race if result becomes invalid while dialog open.
6. **No M&A entry in library QUICK_CARDS** (see model-library) — users reach this via URL/back nav from modeling; discoverability gap.
7. **Performance:** full `computeMaModel` + dual `JSON.stringify` on every keystroke; fine for screening model but not memoized by field.
8. **IRR tooltip LiveNumber quirk:** when `irr.irr == null`, `LiveNumber` still animates value `0` but format returns `"n/a"` — OK visually.
9. **Stock vs cash classification** uses string Number comparison of Cr fields, not engine’s internal consideration type — can diverge if engine clamps stock consideration.
10. **Accessibility:** many numeric inputs lack `min`/`aria` for invalid ranges; Select+Field labeling present via `htmlFor` on trigger id.
11. **No link to LBO/scenario tools** from this screen.
12. **Engine notes** are free-form strings from pure function — trust model is internal only.

---

## 2. `src/app/modeling/ma-calculator/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/modeling/ma-calculator/page.tsx` |
| **Lines** | 38 |
| **Role** | Next.js App Router **server page** for route `/modeling/ma-calculator` — auth gate + shell chrome around lazy M&A calculator |
| **Exports** | `export const dynamic = "force-dynamic"`; `export default async function Page()` |
| **Imports** | `Link` from `next/link`; `requireUser` from `@/lib/rbac`; brand `Badge`, `Button`, `PageShell`, `PageHeader`, `DetailTopBar`; `MaCalculator` from `./ma-calculator-lazy` |

### Business purpose

Authenticated entry point for the M&A accretion calculator. Renders static chrome (back bar, title, methodology badges) on the server so first paint is fast; calculator body loads client-only via lazy wrapper.

### Signatures (quoted)

```ts
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser();
  return (
    <PageShell wide>
      <DetailTopBar
        backHref="/modeling"
        backLabel="Modeling"
        crumb="M&A calculator"
        action={/* Link → /modeling Library */}
      />
      <PageHeader
        title="M&A accretion"
        description="Sources & uses, goodwill bridge, pro-forma EPS, deal IRR."
      />
      {/* Badges: IFRS 3 / Ind AS 103, Run-rate accretion, Screening */}
      <MaCalculator />
    </PageShell>
  );
}
```

### Key logic

1. **`dynamic = "force-dynamic"`** — disables static generation/caching for the route (auth + always-fresh shell).
2. **`await requireUser()`** — if unauthenticated, `redirect("/login")` (from `@/lib/rbac`); return value unused (auth-only, no user-scoped data load).
3. **`PageShell wide`** — full-width layout for two-column calculator.
4. **`DetailTopBar`** — breadcrumb back to library; secondary action “Library”.
5. **`MaCalculator`** is **not** the heavy component file; it is the **lazy client wrapper** (`ma-calculator-lazy.tsx`) that dynamic-imports `./ma-calculator` with `{ ssr: false }` and a skeleton.

### Side effects

- **Auth redirect** if no session.
- **No DB reads** on this page.
- Marks route dynamic → no static HTML cache of authenticated shell.

### Security / RBAC

- **Gate:** any authenticated CRM user (`requireUser`) may open the calculator UI.
- **Create permission** is **not** checked on page load — users without `create:financial_model` can still run the client model; only **Save** fails via server action.
- No role-based feature flag for M&A tooling.
- Does not pass user identity into calculator (calculator is anonymous client compute).

### Coupling

| Direction | Target |
|-----------|--------|
| **Auth** | `@/lib/rbac.requireUser` |
| **UI shell** | `@/components/brand/page-shell`, badge, button |
| **Calculator** | `./ma-calculator-lazy` → dynamic `./ma-calculator` |
| **Nav** | Links to `/modeling` (library) |
| **Route** | App Router file convention under `src/app/modeling/ma-calculator/` |

### Risks / TODOs

1. **Permission asymmetry:** view/run free for all logged-in users; only persist is gated — intentional for screening tools but may surprise compliance if models are considered restricted IP.
2. **No metadata export** (`generateMetadata`) — default title may be generic.
3. **Lazy dependency** — if `ma-calculator-lazy.tsx` is missing or mis-exported, page breaks; batch list omits the lazy file but it is required runtime coupling.
4. **No server-side default injection** from deal/party context (unlike a deal-scoped modeler) — always starts from `maDefaults()`.

---

## 3. `src/app/modeling/model-library.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/modeling/model-library.tsx` |
| **Lines** | 301 |
| **Role** | Client presentational **model library** — quick-access instrument cards + searchable/density-aware table of saved `financial_model` rows |
| **Exports** | `export interface ModelLibraryRow`; `export function ModelLibrary({ rows, total })` |
| **Imports** | See table below |

### Imports (quoted)

| Source | Symbols |
|--------|---------|
| `"use client"` | Client Component |
| `react` | `* as React` |
| `next/link` | `Link` |
| `@phosphor-icons/react` | `ArrowRight`, `Calculator`, `ChartBar`, `Cube`, `MagnifyingGlass`, `Sparkle`, `X` |
| `@/components/brand/table` | `type Density`, table primitives + `TableEmpty` |
| `@/components/brand/*` | `Button`, `Badge`, `Card`, `Eyebrow`, `Reveal`/`Stagger`/`StaggerItem`, `CommandBar`, `PageShell`, `PageHeader` |

### Types / signatures (quoted)

```ts
export interface ModelLibraryRow {
  financialModelId: string;
  modelType: string;
  version: number;
  scenarioTag: string | null;
  currencyCode: string | null;
  dealCode: string | null;
  dealName: string | null;
  partyName: string | null;
  computedAt: string | null;  // ISO string (serialized Date from server page)
  headline: string;
}

export function ModelLibrary({
  rows,
  total,
}: {
  rows: ModelLibraryRow[];
  total: number;
}): JSX
```

**Local constants:**

```ts
const TYPE_LABEL: Record<string, string> = {
  bond_pricing: "Bond pricing",
  project_finance: "Project finance",
  securitization: "Securitization",
  dcf: "DCF / valuation",
  m_and_a: "M&A",
  lbo: "LBO",
  valuation: "Valuation",
  portfolio_construction: "Portfolio",
  scenario_stress: "Scenario / stress",
};

const TYPE_TONE: Record<string, "emerald" | "gold" | "neutral" | "info"> = {
  bond_pricing: "gold",
  project_finance: "emerald",
  securitization: "info",
  dcf: "neutral",
  m_and_a: "neutral",
  lbo: "neutral",
  valuation: "neutral",
  portfolio_construction: "emerald",
  scenario_stress: "neutral",
};

const QUICK_CARDS: {
  label: string;
  title: string;
  hint: string;
  href: string;
  icon: React.ReactNode;
  tone: "gold" | "emerald" | "neutral";
}[] = [
  { label: "Bond pricing", href: "/modeling/bond-calculator", ... },
  { label: "Project finance", href: "/modeling", hint: "Coming soon", ... },
  { label: "DCF / valuation", href: "/modeling", hint: "Coming soon", ... },
  { label: "Securitization", href: "/modeling", hint: "Coming soon", ... },
];
```

### Business purpose

Primary **Modeling hub UI** for bankers: browse versioned financial models linked to deals/parties, scan headline outputs, jump into calculators. Supports client-side search across identity fields and table density toggle for dense vs comfortable reading. Mobile collapses columns to Model + Type + Headline (full provenance on detail page).

### Key logic

#### Client filter

```ts
const filtered = useMemo(() => {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) =>
    [r.financialModelId, r.modelType, r.scenarioTag, r.dealCode, r.dealName, r.partyName, r.headline]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(q)),
  );
}, [rows, search]);
```

- **Client-only** filter over the already-fetched page of rows (not a server search).
- `total` prop is **server total** (or count for that query); badge shows `{filtered.length} of {total}`.

#### Table columns

| Column | Visibility | Content |
|--------|------------|---------|
| Model | always | Link to `/modeling/${financialModelId}` — first 8 chars of UUID + ellipsis |
| Type | always | `Badge` with `TYPE_LABEL` / `TYPE_TONE` fallbacks to raw `modelType` |
| Version | `hidden md:table-cell` | `v{version}` outline badge |
| Scenario | md+ | `scenarioTag ?? "-"` |
| Linked deal | md+ | `dealCode ?? dealName ?? "-"` |
| Party | md+ | `partyName ?? "-"` |
| Headline | always | `r.headline` medium weight |
| Computed | md+ | `en-IN` short date from `computedAt` ISO, or `"-"` |

#### Empty states

- Search miss: “No models match that search.”
- Empty library: “The library is quiet.” + hint to run bond calculator and save.

#### Header CTA

Primary gold button → `/modeling/bond-calculator` only (not M&A/LBO).

#### Quick cards

Only **Bond pricing** is live; PF / DCF / Securitization cards link back to `/modeling` with “Coming soon” chip. **No cards for M&A or LBO** despite those routes existing under `/modeling/ma-calculator` and `/modeling/lbo-calculator`.

### Side effects

- **Local UI state only:** `search`, `density`.
- **No network** from this component (data is props).
- **Navigation** via `Link` only.
- Animation via `Stagger` / `Reveal` (presentation only).

### Security / RBAC

- **None in-file** — pure presentation of props.
- **Data scoping** is responsibility of parent `page.tsx` + `listModels({ user })` visibility (`computedBy` / `approvedBy` / read-all roles).
- Truncated UUID links do not leak extra IDs beyond what was already in the row set.
- `currencyCode` is on the row type but **never rendered** — unused display field.
- No XSS beyond React text of headlines/names (trust DB content).

### Coupling

| Direction | Target |
|-----------|--------|
| **Parent** | `src/app/modeling/page.tsx` maps `listModels` → `ModelLibraryRow[]` |
| **Detail route** | `/modeling/[id]` via `financialModelId` |
| **Calculators** | Hardcoded `/modeling/bond-calculator`; other QUICK_CARDS stub to self |
| **Label maps** | Must stay aligned with DB enum / `modelType` values (`m_and_a`, `bond_pricing`, `lbo`, …) |
| **CommandBar** | Shared brand search + density control |

### Risks / TODOs

1. **Discoverability gap:** M&A calculator (`/modeling/ma-calculator`) and LBO calculator exist but are **absent** from `QUICK_CARDS` and primary CTA — only bond is promoted.
2. **“Coming soon” cards** still navigate to `/modeling` (same page) — dead UX.
3. **Client search ≠ full corpus:** if `listModels` is capped at 100 (see page), filter only searches that page; total badge can mislead (“3 of 100” after filter when more exist server-side).
4. **`currencyCode` unused** in UI.
5. **No sort controls** — order is server `createdAt desc` only.
6. **No type filter chips** — type only visible as badge; search must type raw modelType strings or labels partially.
7. **TYPE_LABEL incompleteness** — unknown types fall back to raw string (OK) but tone falls back to `"neutral"`.
8. **Headline content** depends on server `listModels` extraction from JSONB `outputs` — empty/wrong headlines are a query-layer concern.
9. **Accessibility:** table row is not fully clickable; only ID link navigates.

---

## 4. `src/app/modeling/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/modeling/page.tsx` |
| **Lines** | 27 |
| **Role** | Next.js App Router **server page** for `/modeling` — auth, load model list, serialize dates, render `ModelLibrary` |
| **Exports** | `export const dynamic = "force-dynamic"`; `export default async function ModelingLibraryPage()` |
| **Imports** | `requireUser` from `@/lib/rbac`; `listModels` from `@/features/modeling/queries`; `ModelLibrary`, `type ModelLibraryRow` from `./model-library` |

### Business purpose

Server orchestration for the modeling library: ensure session, fetch up to 100 non-deleted models visible to the user, convert `Date` fields to ISO strings for the client component boundary, and hand off to the presentational library.

### Signatures (quoted)

```ts
export const dynamic = "force-dynamic";

export default async function ModelingLibraryPage() {
  const user = await requireUser();
  const { rows, total } = await listModels({ limit: 100, user });

  const libraryRows: ModelLibraryRow[] = rows.map((r) => ({
    financialModelId: r.financialModelId,
    modelType: r.modelType,
    version: r.version,
    scenarioTag: r.scenarioTag,
    currencyCode: r.currencyCode,
    dealCode: r.dealCode,
    dealName: r.dealName,
    partyName: r.partyName,
    computedAt: r.computedAt ? r.computedAt.toISOString() : null,
    headline: r.headline,
  }));

  return <ModelLibrary rows={libraryRows} total={total} />;
}
```

### Key logic

1. **Auth:** `requireUser()` → `CrmUser` (redirect login if missing).
2. **Query:** `listModels({ limit: 100, user })` — soft-delete filtered (`deletedAt IS NULL`), ordered by `createdAt desc`, visibility via `modelVisibilityClause(user)` (admin/read-all or computedBy/approvedBy).
3. **Serialization:** only `computedAt` needs Date→ISO; IDs/strings pass through. Drops server-only fields (`dealId`, `partyId`, `createdAt`, raw `outputs`) from client props.
4. **No modelType filter** — all types in one library list.

### Side effects

- **DB read** via Drizzle/`listModels` (joins `financial_model` ← `deal`, `party`).
- **Auth redirect** possible.
- **Force-dynamic** — always re-fetch on navigation; no static cache of model list.

### Security / RBAC

| Check | Mechanism |
|-------|-----------|
| Must be logged in | `requireUser()` |
| Row visibility | `listModels` + `modelVisibilityClause` / `canReadAllModels` (roles `admin`/`super_admin` or perms `read_all:financial_model` / `read_all:model` / `manage:user`) |
| Non-privileged users | Only models where `computedByUserId` or `approvedByUserId` = self (per queries.ts) |
| RLS | Comment in queries: “RLS-aware once policies are migrated; until then plain queries” — **app-layer RBAC is the current control** |

Does **not** check a dedicated “list models” permission beyond visibility clause; any authenticated user can hit the page and see their scoped set (possibly empty).

### Coupling

| Direction | Target |
|-----------|--------|
| **Auth** | `@/lib/rbac` |
| **Data** | `@/features/modeling/queries.listModels` → `financial_model`, `deal`, `party` tables |
| **UI** | `./model-library` client component |
| **Related routes** | Detail `/modeling/[id]`; calculators under `/modeling/*-calculator` |

**Mapping completeness:** maps all `ModelLibraryRow` fields; leaves `dealId`/`partyId` server-side only (client cannot deep-link party/deal from library without code/name).

### Risks / TODOs

1. **Hard cap `limit: 100`** — no pagination UI; large firms lose older models from the library list (total may still count more depending on query implementation of count vs limited select).
2. **No cursor/offset** — cannot page.
3. **Force-dynamic always** — acceptable for auth lists but no revalidate/tag strategy documented.
4. **Error handling** — no try/catch; DB failure → error boundary / 500.
5. **Serialization drift** — if `ModelLibraryRow` gains fields, this map must be updated manually (no shared mapper).
6. **partyId/dealId omitted** — intentional lean DTO but prevents client features that need IDs without another fetch.
7. **Comments reference FINANCIAL_MODELING_SPEC** in queries (not this file) — page assumes headline extraction already done.

---

## Batch 037 cross-file summary

| Path | Lines | Layer | Primary export |
|------|------:|-------|----------------|
| `src/app/modeling/ma-calculator/ma-calculator.tsx` | 978 | Client UI + client compute + save form | `MaCalculator` |
| `src/app/modeling/ma-calculator/page.tsx` | 38 | Server route `/modeling/ma-calculator` | `Page` |
| `src/app/modeling/model-library.tsx` | 301 | Client library UI | `ModelLibrary`, `ModelLibraryRow` |
| `src/app/modeling/page.tsx` | 27 | Server route `/modeling` | `ModelingLibraryPage` |

**Data / control flow:**

```
/modeling  →  requireUser → listModels(user, 100) → ModelLibrary (search/table/quick cards)
/modeling/ma-calculator  →  requireUser → shell + lazy MaCalculator
MaCalculator  →  computeMaModel(client)  ─┬→ Results UI
                                         └→ createModel (save) → financial_model (m_and_a)
```

**Notable product gap:** M&A calculator is production-ready in this batch but **not linked** from the modeling library quick cards or primary CTA (bond-only promotion). LBO similarly missing from QUICK_CARDS (outside batch but adjacent).

**Shared patterns:** `force-dynamic` + `requireUser` on both pages; brand PageShell; engine version stamps on save; Cr/pct string form state pattern consistent with other calculators.
