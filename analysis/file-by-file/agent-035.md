# Agent 035 — Modeling detail + bond calculator

**Batch:** `batch-035.list`  
**Scope:** 4 files under `src/app/modeling/`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`

---

## 1. `src/app/modeling/[id]/page.tsx`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/modeling/[id]/page.tsx` |
| **Lines** | 807 |
| **Route** | `/modeling/[id]` (App Router dynamic segment) |
| **Runtime** | Server Component (`async` default export); `export const dynamic = "force-dynamic"` |

### Role

Server-rendered **financial model detail** page. Loads a versioned `financial_model` row, enriches it with actor emails and a version-family table (same deal/party + modelType), and renders provenance, structured outputs (bond-specialized or generic JSON KV), inputs/assumptions, and version history.

### Exports

```ts
export const dynamic = "force-dynamic";

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element>
```

**Local (non-exported) helpers / UI fragments:**

| Symbol | Signature / shape |
|--------|-------------------|
| `TYPE_LABEL` | `const TYPE_LABEL: Record<string, string>` — maps model type keys → display labels |
| `fmtNum` | `(x: unknown, digits = 4): string` |
| `fmtDate` | `(d: Date \| null \| undefined): string` — `en-IN` short date |
| `fmtDateTime` | `(d: Date \| null \| undefined): string` — `en-IN` medium + short time |
| `modelFamilyVisibilityScope` | `(user: CrmUser): SQL` — app-layer WHERE fragment for version family |
| `ProvenanceTile` | `({ icon, label, value, mono?, tone? }: { icon: React.ReactNode; label: string; value: string; mono?: boolean; tone?: "neutral" \| "emerald" \| "gold" })` |
| `prettifyKey` | `(k: string): string` |
| `formatScalar` | `(v: unknown): { text: string; mono: boolean }` |
| `JsonKvGrid` | `({ data, emptyHint }: { data: Record<string, unknown>; emptyHint: string })` |
| `JsonKvValue` | `({ value }: { value: unknown })` |
| `BondOutputs` | `({ outputs }: { outputs: Record<string, unknown> })` |

### Imports

| Source | Symbols |
|--------|---------|
| `next/link` | `Link` |
| `next/navigation` | `notFound` |
| `drizzle-orm` | `and`, `desc`, `eq`, `inArray`, `isNull`, `sql`, `type SQL` |
| `@/lib/rbac` | `can`, `requireUser`, `type CrmUser` |
| `@/features/modeling/queries` | `getModelDetail` |
| `@/db` | `db` |
| `@/db/schema` | `appUser`, `deal`, `dealParty`, `financialModel`, `party` |
| `@/components/brand/icons` | `ArrowLeft`, `ArrowRight`, `Calculator`, `CheckCircle`, `Clock`, `Hash`, `Link as LinkIcon`, `SealCheck`, `Sparkle`, `User` |
| `@/components/brand/button` | `Button` |
| `@/components/brand/badge` | `Badge` |
| `@/components/brand/card` | `Card`, `CardBody`, `CardDescription`, `CardHeader`, `CardTitle` |
| `@/components/brand/text` | `Eyebrow` |
| `@/components/brand/reveal` | `Reveal` |
| `@/components/brand/page-shell` | `PageShell`, `PageHeader`, `DetailTopBar` |
| `@/components/brand/table` | `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` |

### Business purpose

- Surface a single stored financial model for audit / credit workflow: **who computed it, when, which engine, who approved it** (four-eyes narrative, §2.17).
- Show **immutable params + outputs** snapshot so any version is reproducible (§0.4).
- Show **append-only version family** for the same `(dealId|partyId, modelType)`, newest first.
- Special-case `modelType === "bond_pricing"` with headline bond metrics + cash-flow schedule (keys: `cleanPrice`, `dirtyPrice`, `accruedInterest`, `ytm`, `currentYield`, `macaulayDuration`, `modifiedDuration`, `dv01`, `convexity`, `gSpread`, `cashFlows[]`).

### Key logic

1. **Auth gate:** `const user = await requireUser()` — unauthenticated users never reach content.
2. **Detail load:** `const detail = await getModelDetail(id, user)`; if null → `notFound()`.
   - `getModelDetail` returns:
     ```ts
     interface ModelDetail {
       model: typeof financialModel.$inferSelect;
       dealCode: string | null;
       dealName: string | null;
       partyName: string | null;
       parentVersion: number | null;
     }
     ```
   - Visibility for the primary row is enforced inside `getModelDetail` via `modelVisibilityClause(user)` (features layer).
3. **View-layer enrichment (not in features query):**
   - Resolve `computedByUserId` / `approvedByUserId` → `appUser.email` (CRM treats email as staff handle; no name column).
   - Build **version family** query on `financialModel` with base filter:
     - if `dealId`: soft-deleted null + same `modelType` + same `dealId`
     - else if `partyId`: soft-deleted null + same `modelType` + same `partyId`
     - else: only the current `financialModelId` (singleton “family”)
   - AND `modelFamilyVisibilityScope(user)`:
     - Full access if `can(user, "read_all", "financial_model")` \| `"read_all"/"model"` \| `"manage"/"user"` → `sql\`TRUE\``
     - No `appUserId` → `sql\`FALSE\``
     - Else: computed-by / approved-by user OR party ownership (assigned/data_owner/created_by) OR deal ownership (lead/credit_analyst/created_by) OR deal_party → party ownership EXISTS chain.
4. **UI branching:**
   - Bond → `BondOutputs` (cards + optional cash-flow table).
   - Other types → `JsonKvGrid` over `outputs`.
   - Always: provenance card, inputs/assumptions `JsonKvGrid`, version history table, back / “Recompute in calculator” links.
5. **`JsonKvGrid` / `formatScalar`:** display-only JSONB renderer; one-level nested objects; arrays of scalars joined; arrays of objects collapsed to “N items”; stringified JSON strings pretty-printed when parseable.
6. **Bond output cards** treat decimals as rates (`ytm` × 100 for %); G-spread displayed as bp: `(gSpread as number) * 10_000`.

### Side effects

- **None mutative.** Read-only page: `db.select` only.
- Triggers `notFound()` navigation for unauthorized/missing models.
- `force-dynamic` disables static caching of model detail.

### Security / RBAC

| Concern | Behavior |
|---------|----------|
| Authentication | `requireUser()` |
| Primary row ACL | `getModelDetail(id, user)` → `modelVisibilityClause` (computed/approved by user, party/deal ownership, or read-all roles) |
| Version family ACL | **Duplicated** app-layer SQL: `modelFamilyVisibilityScope` (same intent as `modelVisibilityClause`, but raw EXISTS against `party` / `deal` / `dealParty`) |
| Approval mutation | **Not present** — displays approved vs awaiting only |
| Soft delete | Family query requires `isNull(financialModel.deletedAt)`; detail path also filters deleted |
| XSS | React text rendering; no `dangerouslySetInnerHTML`; emails/params rendered as text |

**Permission keys used in this file:**

- `can(user, "read_all", "financial_model")`
- `can(user, "read_all", "model")`
- `can(user, "manage", "user")`

### Coupling

| Coupled to | How |
|------------|-----|
| `financial_model` table | Columns: `financialModelId`, `modelType`, `version`, `scenarioTag`, `currencyCode`, `params`, `outputs`, `assumptionsDoc`, `engineVersion`, `computedAt`, `computedByUserId`, `approvedByUserId`, `parentModelId`, `dealId`, `partyId`, `createdAt`, `deletedAt` |
| `app_user` | `userId`, `email` for actor display |
| `deal`, `party`, `deal_party` | Scope joins + display names/codes |
| `@/features/modeling/queries` | Detail fetch only; version family intentionally kept in page (comment: “features query returns bare model row”) |
| Brand UI kit | Heavy presentational dependency |
| Bond calculator route | Hard-coded CTA → `/modeling/bond-calculator` (even for non-bond model types) |

### Risks / TODOs

1. **Duplicated visibility logic:** `modelFamilyVisibilityScope` in the page vs `modelVisibilityClause` in `queries.ts` can drift; family visibility also requires `party.deleted_at IS NULL` in EXISTS while list clause differs slightly in join style.
2. **`DetailTopBar` imported but unused** — dead import.
3. **Deal link is incomplete:** `href="/deals"` not `/deals/${model.dealId}` — loses deep link.
4. **No approval / recompute-from-this-version actions** on detail; “Recompute” always opens blank calculator defaults, does not hydrate from stored params.
5. **`TYPE_LABEL` incomplete vs engine types:** includes labels for types that calculators may not all implement; unknown types fall back to raw `model.modelType` string.
6. **JSON depth:** nested objects beyond one level collapse via `formatScalar` stringification; large cash-flow arrays on non-bond types may only show “N items”.
7. **Parent version lookup** (in features) is not re-scoped by visibility for parent row itself — page only shows parent version number from detail DTO.
8. **No explicit `can(user, "read", "financial_model")` check** beyond requireUser + visibility OR — consistent with library list pattern, but any authenticated user with no matching scope gets 404 (good) rather than 403 (opaque).

---

## 2. `src/app/modeling/bond-calculator/bond-calculator-lazy.tsx`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/modeling/bond-calculator/bond-calculator-lazy.tsx` |
| **Lines** | 58 |
| **Module type** | Client component (`"use client"`) |
| **Route role** | Lazy boundary between Server page and heavy calculator |

### Role

**Code-split wrapper** so `recharts` (~360KB) and the full calculator stay out of the first-load JS for `/modeling/bond-calculator`. Server pages cannot use `next/dynamic` with `ssr: false`; this client module owns that call.

### Exports

```ts
export function BondCalculator(): JSX.Element
```

**Local:**

```ts
function BondCalculatorSkeleton(): JSX.Element
```

### Imports

| Source | Symbols |
|--------|---------|
| `next/dynamic` | `dynamicImport` (default) |
| `react` | `* as React` (imported; only used implicitly via JSX) |

### Business purpose

Performance / UX: paint page chrome immediately; defer calculator + chart chunk; reserve layout height via skeleton to avoid CLS.

### Key logic

```ts
const BondCalculatorLazy = dynamicImport(
  () => import("./bond-calculator").then((m) => m.BondCalculator),
  {
    ssr: false,
    loading: () => <BondCalculatorSkeleton />,
  },
);

export function BondCalculator() {
  return <BondCalculatorLazy />;
}
```

Skeleton footprint:

- 12-col grid: 5 + 7 span placeholders at `h-[420px]`
- Chart placeholder `h-[380px]`
- `aria-hidden` on skeleton container

### Side effects

- Client-side network fetch of the lazy chunk after hydration.
- No server data fetch, no mutations.

### Security / RBAC

- None at this layer. Auth is enforced by parent Server page (`requireUser`).
- Does not expose secrets; only loads UI module.

### Coupling

- Hard dependency on `./bond-calculator` export name `BondCalculator`.
- Naming collision: exported `BondCalculator` re-exports lazy version of the same name from the heavy module (page imports this file, not the heavy one).

### Risks / TODOs

1. **No error boundary** for chunk load failure (network offline → perpetual skeleton or Next error).
2. **`ssr: false`** means calculator never SEO/server-renders (acceptable for authenticated tool).
3. Skeleton dimensions may drift if calculator layout changes → residual CLS.

---

## 3. `src/app/modeling/bond-calculator/bond-calculator.tsx`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/modeling/bond-calculator/bond-calculator.tsx` |
| **Lines** | 1332 |
| **Module type** | Client component (`"use client"`) |
| **Route role** | Interactive bond pricing instrument UI |

### Role

Flagship **Indian fixed-income bond pricing calculator**: instrument form, live recompute via pure client engine, price–yield curve with ±300 bp scrubber, duration/DV01/convexity/G-spread tiles, cash-flow + grid tables, and **“Save as model”** → server action `createModel`.

### Exports

```ts
export function BondCalculator(): JSX.Element
```

**All other symbols are module-private.**

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React` |
| `react` | `useActionState` |
| `framer-motion` | `animate`, `useInView` |
| `recharts` | `Area`, `AreaChart`, `CartesianGrid`, `ReferenceDot`, `ReferenceLine`, `ResponsiveContainer`, `Tooltip`, `XAxis`, `YAxis` |
| `@phosphor-icons/react` | `ArrowRight`, `Calculator`, `ChartLine`, `FloppyDisk`, `Sparkle`, `Target`, `TrendUp` |
| `@/features/modeling/bondPricing` | `computeBondMetrics`, `instrumentDefaults`, `pct`, `inr`, `bp as fmtBp`, `years as fmtYears`, `type BondInputs`, `type BondMetrics`, `type InstrumentType`, `type DayCount` |
| `@/features/modeling/actions` | `createModel`, `type CreateModelState` |
| Brand UI | `Button`, `Card*`, `Badge`, `Eyebrow`, `Reveal`, `Input`, `Select*`, `Tabs*`, `Table*`, `CellEmpty` |
| `@/components/ui/dialog` | `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`, `DialogTrigger` |
| `@/components/ui/label` | `Label` |
| `@/lib/utils` | `cn` |

### Types quoted (local + feature)

**Local `FormState`:**

```ts
interface FormState {
  instrumentType: InstrumentType;
  faceValue: string;
  couponRate: string; // percent, e.g. "8.25"
  couponFrequency: 0 | 1 | 2;
  dayCount: DayCount;
  issueDate: string;
  maturityDate: string;
  lastCouponDate: string;
  nextCouponDate: string;
  settlementDate: string;
  solve: "priceFromYtm" | "ytmFromPrice";
  yieldPct: string; // percent
  marketPrice: string;
  priceType: "clean" | "dirty";
  benchmarkYieldPct: string; // percent
}
```

**From `@/features/modeling/bondPricing`:**

```ts
export type DayCount = "ACT_365" | "ACT_360" | "thirty_360" | "ACT_ACT";

export type InstrumentType =
  | "GSEC" | "SDL" | "TBILL" | "SGB"
  | "CORP_IG" | "CORP_HY" | "NCD" | "CP" | "STRUCTURED";

export interface BondInputs {
  instrumentType: InstrumentType;
  faceValue: number;
  couponRate: number; // decimal
  couponFrequency: 0 | 1 | 2 | 4 | 12;
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

export interface BondMetrics {
  instrumentType: InstrumentType;
  dayCount: DayCount;
  couponFrequency: number;
  settlementDate: string;
  faceValue: number;
  couponRate: number;
  ytm: number;
  periodicYield: number;
  cleanPrice: number;
  dirtyPrice: number;
  accruedInterest: number;
  currentYield: number;
  macaulayDuration: number;
  modifiedDuration: number;
  dv01: number;
  convexity: number;
  gSpread: number | null;
  priceYieldCurve: { yield: number; cleanPrice: number; dirtyPrice: number }[];
  cashFlows: CashFlow[];
  w: number;
  remainingCoupons: number;
  daysAccrued: number;
  daysInCouponPeriod: number;
  tbill?: {
    discountYield: number;
    daysToMaturity: number;
    price: number;
    bondEquivalentYield: number;
  };
}
```

**Save action types:**

```ts
export type CreateModelState = { error?: string } | undefined;

// createModel server action FormData fields (via createModelSchema):
// modelType, currencyCode, dealId?, partyId?, scenarioTag?, assumptionsDoc?,
// params (JSON string), outputs (JSON string), engineVersion?
```

### Local symbols (exhaustive inventory)

| Symbol | Kind | Notes |
|--------|------|-------|
| `INSTRUMENTS` | `InstrumentType[]` | CORP_IG, CORP_HY, NCD, GSEC, SDL, TBILL, CP, SGB, STRUCTURED |
| `INSTRUMENT_LABEL` | `Record<InstrumentType, string>` | UI labels |
| `DAY_COUNTS` | `DayCount[]` | ACT_365, ACT_360, thirty_360, ACT_ACT |
| `FREQUENCIES` | `{ value: 0\|1\|2; label: string }[]` | Zero / Annual / Semi |
| `tPlus1` | `(): string` | Settlement default YYYY-MM-DD, T+1 Indian cycle |
| `defaultsFor` | `(type: InstrumentType): FormState` | TBILL/CP 91-day; coupon bonds ~5y residual |
| `toBondInputs` | `(f: FormState): BondInputs` | % → decimal; solve direction sets yield vs marketPrice |
| `fieldClass` | string (cn) | Shared input styling |
| `Field` | form field shell | Label + children + optional hint |
| `FieldDivider` | section divider | Optional center label |
| `LiveNumber` | animated readout | One-shot 0→value via framer-motion; then live snap |
| `MetricTile` | analytics cell | tone: default \| up \| down \| gold |
| `priceAtYield` | linear interp on curve | For scrubber |
| `PriceYieldCurve` | recharts AreaChart | ±300 bp ref slider, ReferenceLine/Dot |
| `Readout` | mini label/value | Clean / Dirty / ΔP |
| `CurveTooltip` | recharts tooltip | Yield, clean, dirty |
| `BondCalculator` | main export | Form + results + save dialog |
| `Results` | right pane | Headlines, curve, tiles, detail tabs |

### Business purpose

- Price Indian instruments under FIMMDA-ish conventions (ACT/365 default, annual/semi, T+1).
- Support **price from YTM** and **YTM from clean/dirty market price**.
- Surface risk analytics: Macaulay / modified duration, DV01 (₹/bp per ₹100 face), convexity, optional G-spread vs G-Sec benchmark.
- Persist a snapshot as `financial_model` with `model_type = bond_pricing`, `engineVersion = bondPricing.v1`, currency `INR`.

### Key logic

1. **State:** `useState<FormState>(defaultsFor("CORP_IG"))`.
2. **Live recompute** in `useMemo` on every `form` change:
   ```ts
   const inputs = toBondInputs(form);
   const m = computeBondMetrics(inputs);
   // Non-finite cleanPrice or throw → error card, no raw exception text
   ```
3. **Instrument change** resets entire form via `defaultsFor(type)` (including coupon dates, yields).
4. **Discount instruments** (`TBILL`, `CP`): coupon rate / last / next coupon disabled; zero coupon frequency defaults.
5. **Price–yield UI:** uses `m.priceYieldCurve`; scrubber `refBp ∈ [-300, 300]` step 25; interpolates clean/dirty; ΔP vs solved clean.
6. **Save dialog** (`useActionState(createModel, undefined)`):
   - Hidden fields:
     - `modelType=bond_pricing`
     - `currencyCode=INR`
     - `params` = `JSON.stringify(toBondInputs(form))`
     - `outputs` = `JSON.stringify(metrics)` or `"{}"`
     - `engineVersion=bondPricing.v1`
   - Optional: `scenarioTag`, `dealId` (UUID), `partyId` (UUID), `assumptionsDoc`
   - On success, server action `redirect(\`/modeling/${modelId}\`)`.
7. **Results tabs:** cash-flow schedule (date, k, t, coupon, principal, CF, DF, PV + dirty total row) and price-yield grid (yield, Δbp, clean, dirty; current row selected).

### Side effects

| Effect | Where |
|--------|-------|
| Client-only pure compute | `computeBondMetrics` — no network |
| Server mutation | `createModel` via form `action={saveAction}` |
| Redirect | After successful save → `/modeling/{id}` |
| Revalidate | `revalidatePath("/modeling")` inside action (server) |
| Animation timers | framer-motion `animate` on LiveNumber; stopped on unmount |
| Local React state | form, save dialog open, curve scrubber bp |

### Security / RBAC

| Layer | Behavior |
|-------|----------|
| Page auth | Parent `page.tsx` calls `requireUser()` before rendering |
| Create permission | Server: `can(user, "create", "financial_model")` |
| Link targets | Server: `canLinkModelTarget` — user must own/access party and/or deal unless read-all roles |
| Zod validation | UUIDs for deal/party; max lengths on strings; JSON parse of params/outputs |
| RLS insert | `withRls(user.appUserId, user.wall, dealIds, …)` |
| Client trust | **Client-computed outputs are stored as-is** — no server recompute of bond engine; user with create permission can submit arbitrary JSON via forged FormData (schema only checks “valid JSON string”) |
| Error leakage | Catch block intentionally suppresses raw JS exceptions in UI |

### Coupling

| Dependency | Role |
|------------|------|
| `@/features/modeling/bondPricing` | Engine + formatters + defaults |
| `@/features/modeling/actions.createModel` | Persistence to `financial_model` |
| `recharts` + `framer-motion` | Visualization / motion |
| Brand + shadcn dialog/label | UI |
| Phosphor icons (package) vs brand icons | Calculator uses `@phosphor-icons/react` directly, not `@/components/brand/icons` |

### Risks / TODOs

1. **Trust boundary:** outputs/params accepted as client JSON — auditor assumption of engine integrity depends on client honesty; server does not re-run `computeBondMetrics`.
2. **Hardcoded demo dates** in `defaultsFor` (e.g. `2021-06-25`, coupon dates in 2025/2026) will go stale relative to “today” and can produce odd residual schedules without user edits.
3. **`couponFrequency` form only allows 0\|1\|2** while `BondInputs` type allows `4 | 12` — quarterly/monthly not exposed.
4. **No hydrate-from-URL / model id** — cannot open calculator pre-filled from an existing model version.
5. **Save disabled when `!metrics`** but empty outputs `"{}`" could still be submitted if metrics become null between open and submit (edge race unlikely).
6. **Deal/party ID as free-text UUID** is poor UX and error-prone; no picker.
7. **DialogTrigger `render` prop** depends on custom dialog API shape (project-specific, not stock Radix `asChild` only).
8. **Gradient ids** `pyFill` / `pyStroke` are fixed DOM ids — multiple charts on one page would clash (currently one chart).
9. **Large client bundle** even after lazy split; all of recharts is still paid when calculator opens.
10. **No four-eyes approval path** in calculator — only create v1 computed-by current user.

---

## 4. `src/app/modeling/bond-calculator/page.tsx`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/modeling/bond-calculator/page.tsx` |
| **Lines** | 39 |
| **Route** | `/modeling/bond-calculator` |
| **Runtime** | Server Component; `export const dynamic = "force-dynamic"` |

### Role

Authenticated shell page for the bond pricing tool: chrome (back bar, title, convention badges) + lazy client calculator.

### Exports

```ts
export const dynamic = "force-dynamic";

export default async function Page(): Promise<JSX.Element>
```

### Imports

| Source | Symbols |
|--------|---------|
| `next/link` | `Link` |
| `@/lib/rbac` | `requireUser` |
| `@/components/brand/badge` | `Badge` |
| `@/components/brand/button` | `Button` |
| `@/components/brand/page-shell` | `PageShell`, `PageHeader`, `DetailTopBar` |
| `./bond-calculator-lazy` | `BondCalculator` |

### Business purpose

Entry point for interactive Indian bond pricing with default convention messaging (ACT/365, annual/semi, T+1, FIMMDA).

### Key logic

```ts
export default async function Page() {
  await requireUser();
  return (
    <PageShell wide>
      <DetailTopBar
        backHref="/modeling"
        backLabel="Modeling"
        crumb="Bond calculator"
        action={
          <Button asChild variant="secondary-hairline" size="sm">
            <Link href="/modeling">Library</Link>
          </Button>
        }
      />
      <PageHeader
        title="Bond pricing"
        description="Indian conventions by default — ACT/365, price↔YTM, duration, DV01, G-spread."
      />
      <div className="mb-6 flex flex-wrap gap-1.5">
        <Badge variant="neutral">ACT/365</Badge>
        <Badge variant="neutral">Annual / Semi-annual</Badge>
        <Badge variant="neutral">T+1</Badge>
        <Badge variant="neutral">FIMMDA</Badge>
      </div>
      <BondCalculator />
    </PageShell>
  );
}
```

### Side effects

- Auth session read via `requireUser()` (redirect/throw if unauthenticated — per rbac helper).
- No DB access on this page itself.
- Forces dynamic rendering (no static shell cache of auth-gated UI).

### Security / RBAC

| Check | Level |
|-------|--------|
| `requireUser()` | Any authenticated CRM user may open calculator |
| Create models | Enforced later on submit in `createModel` (`create` on `financial_model`) |
| No resource-level read of existing models | N/A (tool starts blank) |

**Note:** Viewing the calculator does **not** require `create` permission; only saving does. Pricing is pure client-side.

### Coupling

- Lazy calculator module.
- Modeling library route `/modeling`.
- Brand page shell (`wide` layout for instrument + results).

### Risks / TODOs

1. **No capability gate** for who may use pricing tools (any logged-in user) — may be intentional for internal CRM.
2. Convention badges are static marketing copy; actual day-count can differ per instrument after user changes select.
3. No breadcrumb beyond DetailTopBar; no link to modeling docs/spec.

---

## Cross-file architecture (batch summary)

```
/modeling/[id]  (Server)
  requireUser → getModelDetail(id, user)  [ACL]
  db: actors + version family [ACL modelFamilyVisibilityScope]
  UI: provenance | bond/generic outputs | params | version table
  CTA → /modeling/bond-calculator   (does not pass id/params)

/modeling/bond-calculator  (Server shell)
  requireUser
  → bond-calculator-lazy (client, dynamic ssr:false)
     → bond-calculator (client)
        computeBondMetrics(local)
        createModel(FormData) → financial_model insert → redirect /modeling/{id}
```

### Shared domain table: `financial_model`

Key columns touched by this batch (detail display + save):

| Column | Detail page | Save from calculator |
|--------|-------------|----------------------|
| `financial_model_id` | PK route param | returned on insert |
| `model_type` | display + family key | hard-coded `bond_pricing` |
| `version` | badge + table | insert `1` |
| `params` / `outputs` | JSONB display | client JSON |
| `currency_code` | badge | `INR` |
| `scenario_tag` | badge + table | optional form |
| `assumptions_doc` | PageHeader description | optional form |
| `engine_version` | provenance tile | `bondPricing.v1` |
| `computed_at` / `computed_by_user_id` | provenance | set on insert |
| `approved_by_user_id` | badge + table | null on create |
| `deal_id` / `party_id` | links + family | optional UUID form |
| `parent_model_id` | “fork of vN” | null on create |
| `deleted_at` | filtered | — |

### Batch-level risks

1. **Visibility SQL duplicated** between page and `queries.ts`.
2. **No round-trip** from stored model → calculator rehydrate.
3. **Client-authored model outputs** accepted by `createModel` without server recompute.
4. **Dead import** `DetailTopBar` on detail page.
5. **Deal deep-link** missing on detail (`/deals` only).

---

*End of agent-035 analysis.*
