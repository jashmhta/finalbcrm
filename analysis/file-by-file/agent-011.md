# Agent 011 — File-by-file analysis

**Batch:** `batch-011.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (all Vitest unit / smoke tests under `src/__tests__/`)  
**Scope note:** Documentation-only ignore does not apply; these are test sources. No production runtime modules in this batch.

---

## 1. `src/__tests__/rbacSegmentation.test.ts`

| Field | Value |
| --- | --- |
| **Path** | `src/__tests__/rbacSegmentation.test.ts` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/__tests__/rbacSegmentation.test.ts` |
| **Lines** | 246 |
| **Role** | Vitest unit test suite for (1) org brand/credit policy helpers, (2) RBAC `can` matrix + CSV export gate, (3) party segmentation catalog constants |
| **Runtime** | Node (Vitest); pure imports only — no DB, no Next, no network |
| **Tables touched** | None (no SQL / ORM) |

### Exports

None (test module). Vitest discovers `describe` / `it` blocks.

Local helper (file-private):

```ts
function user(roles: string[], permissions: string[] = []): RbacSubject {
  return { roles, permissions: new Set(permissions) };
}
```

### Imports

| Symbol | From | Kind |
| --- | --- | --- |
| `describe`, `expect`, `it` | `vitest` | test harness |
| `can`, `type RbacSubject` | `@/lib/rbac-core` | RBAC core |
| `canUseCsvExport` | `@/features/reports/exportAccess` | CSV export gate |
| `brandFromDesk`, `canAccessCreditModule`, `partyBrandSqlValues` | `@/lib/org` | brand / credit policy |
| `INDUSTRY_SECTOR_LABELS`, `INDUSTRY_SECTORS`, `INVESTOR_TYPE_LABELS`, `INVESTOR_TYPES`, `PORTFOLIO_SIZE_BANDS`, `PORTFOLIO_SIZE_LABELS`, `RATING_AGENCIES`, `RATING_AGENCY_LABELS`, `RATING_VALUES`, `RISK_APPETITES`, `RISK_APPETITE_LABELS`, `TURNOVER_BAND_LABELS`, `TURNOVER_BANDS` | `@/features/parties/segmentation` | party filter catalogs |

### Downstream signatures exercised (quoted)

From `@/lib/rbac-core`:

```ts
export interface RbacSubject {
  roles?: string[];
  permissions: Set<string>;
}

export function can(
  user: RbacSubject | null | undefined,
  action: string,
  resource: string,
): boolean;
// Impl: admin | super_admin → true; else permissions.has(`${resource}:${action}`)
```

From `@/features/reports/exportAccess`:

```ts
export interface ExportAccessSubject {
  roles?: readonly string[];
  brandScope?: "binarycapital" | "binarybonds" | "shared";
}
export function canUseCsvExport(user: ExportAccessSubject | null | undefined): boolean;
// Impl: user?.roles?.includes("super_admin") ?? false
```

From `@/lib/org`:

```ts
export type BrandScope = "binarycapital" | "binarybonds" | "shared";
export function brandFromDesk(desk: string | null | undefined): BrandScope;
export function partyBrandSqlValues(brand: BrandScope): string[];
export function canAccessCreditModule(roles: readonly string[] | undefined): boolean;
```

### Business purpose

Locks CEO/product policy encoded in pure helpers:

1. **Brand books** — desks map to Binary Capital vs Binary Bonds vs firm-wide `shared`; brand-scoped supers still see `shared` parties.
2. **Credit module** — closed by default for coverage/bond employees; open for `super_admin` / credit roles.
3. **RBAC least privilege** — `read` ≠ `read_all`; resource-scoped permissions do not cross-contaminate; `super_admin` bypasses via `can`.
4. **CSV export** — stricter than general `can(..., "export", "reports")`: **super_admin only** even if user is `admin` or has `report:read_all`.
5. **Party segmentation catalogs** — turnover ladder (₹ Cr bands), industry sectors (incl. manufacturing sub-sectors), rating ladder/agencies, investor types, portfolio size, risk appetite labels used for party filters/matching UI.

### Key logic (test cases)

#### `describe("Org brand + credit policy")` (3 tests)

| Case | Assertions |
| --- | --- |
| Desk → brand | `ib_advisory`/`operations` → `"binarycapital"`; `bond_underwriting`/`credit` → `"binarybonds"`; `management` → `"shared"` |
| Party brand SQL values | `partyBrandSqlValues("binarycapital")` = `["binarycapital","shared"]`; `"shared"` contains `"binarybonds"` (firm-wide sees all three) |
| Credit module access | `coverage_rm`/`bond_desk` → false; `super_admin`/`credit_analyst` → true |

#### `describe("RBAC bypass roles")` (11 tests)

Permission pattern under test: `can(user, action, resource)` checks `permissions.has(\`${resource}:${action}\`)` unless admin/super_admin.

| Theme | Positive | Negative / isolation |
| --- | --- | --- |
| Super bypass | `super_admin` can `export/reports`, `merge/party` without explicit perms | — |
| CSV export | only `super_admin` | `admin`, `management`+`report:read_all`, `coverage_head`+`party:read_all` denied |
| Scoped non-admin | `coverage_rm`+`party:read` → `read/party` | same user cannot `export/reports` |
| Task / notification `read_all` | `ops_lead`+`task:read_all` / `notification:read_all` | `task:read` alone insufficient; task grant ≠ notification |
| Portal `read_all` | `portal_admin`+`portal:read_all`; `coverage_head`+`party:read_all` for party | `party:read` alone no portal portfolio |
| Document `read_all` | `ops_admin`+`document:read_all` | not transferable to `task` |
| KYC / compliance / consent / credit | `compliance_admin` kyc/compliance; `privacy_admin` consent; `credit_head` credit | `kyc:read` ≠ `read_all`; kyc grant ≠ consent; `credit:read` ≠ `read_all` |
| Lead / onboarding | heads with `*_read_all` | lead grant ≠ onboarding |
| Matching | `placement_head`+`matching:read_all` | matching grant ≠ party; party `read_all` does not imply matching in this test (only party asserted positive) |
| Report / portfolio | `management` report; `risk_head` portfolio | portfolio ≠ report |
| AI insight / financial model | heads/admins with `*_read_all` | model ≠ ai_insight |
| Dashboard | `dashboard:read_all` | dashboard ≠ party |
| Deal / audit | `deal:read_all`; `audit:read` for compliance; super_admin `read_all/audit` | deal grant ≠ audit read; `audit:read` ≠ `audit:read_all` |

Roles named as fixtures (not a full org roster):  
`super_admin`, `admin`, `management`, `coverage_rm`, `coverage_head`, `ops_lead`, `ops_admin`, `portal_admin`, `compliance_admin`, `privacy_admin`, `credit_analyst`, `credit_head`, `operations`, `operations_head`, `placement_head`, `risk_analyst`, `risk_head`, `analyst`, `model_admin`, `bond_desk`.

#### `describe("party segmentation catalogs")` (4 tests)

**Turnover ladder (exact):**

```
TURNOVER_BANDS:
  lt_50, 50_75, 75_100, 100_150, 150_175, 175_200,
  200_300, 300_500, 500_750, 750_1000, gt_1000

TURNOVER_BAND_LABELS values:
  "<= 50 Cr" … "1,000 Cr+"
```

**Industry sectors (subset required via `arrayContaining`):**  
`infra`, `fintech`, `epc`, `roads`, `buildings`, `manufacturing`, `textiles`, `oem`, `plastics`, `recycled_plastics`  
Label: `INDUSTRY_SECTOR_LABELS.recycled_plastics === "Recycled plastics"`.

**Ratings / investor / portfolio / risk:**

- `RATING_VALUES` contains `BBB`, `AAA`; first 10 notches exact: AAA … BBB-
- `RATING_AGENCIES` exact list: CRISIL, ICRA, CARE, India_Ratings, Acuite, Infomerics, Brickwork
- Labels: India Ratings (underscore key → spaced display)
- Investor types include: `equity_pms`, `mutual_fund`, `bond_investor`; label Equity PMS
- Portfolio: `gt_1000` → `"1,000 Cr+"`
- Risk: `high_yield` → `"High yield"`

### Side effects

- None at runtime beyond Vitest assertions.
- Does not mutate DB, env, cookies, or filesystem.
- Instantiates in-memory `Set` permissions per test via `user()`.

### Security / RBAC

**This file is itself a security policy regression suite.**

Critical policies encoded:

1. **Admin / super_admin bypass on `can`** — any action/resource true for those roles.
2. **CSV is narrower than `can`** — documents intentional split: `can(super_admin, "export", "reports")` true AND `canUseCsvExport` super_admin-only; regular `admin` fails CSV even though `can` would grant export to admin.
3. **Least privilege on portfolio surfaces** — exhaustive isolation of `read` vs `read_all` across: task, notification, portal, document, kyc, compliance, consent, credit, lead, onboarding, matching, report, portfolio, ai_insight, financial_model, dashboard, deal, audit.
4. **Credit module gating** separate from permission strings (`canAccessCreditModule`).
5. **Brand SQL filter values** — prevents Capital-only supers from excluding `shared` parties incorrectly.

**Gap / nuance (test vs impl):**  
`can` treats both `admin` and `super_admin` as full bypass. CSV export deliberately does **not**. Tests assert that split. If production routes use only `can` for CSV, policy would be weaker than this suite documents.

### Coupling

| Dependency | Coupling strength | Notes |
| --- | --- | --- |
| `@/lib/rbac-core` | high | every RBAC assertion |
| `@/features/reports/exportAccess` | high | CEO CSV rule |
| `@/lib/org` | high | brand + credit |
| `@/features/parties/segmentation` | high | catalog contract for filters/UI |
| Vitest | harness only | |

Tightly coupled to string permission conventions `resource:action` (e.g. `party:read_all`, `audit:read`). Renaming resources breaks tests and app together.

### Risks / TODOs

- **Role names are fixtures**, not necessarily seeded `app_user` roles; drift between test role strings and real grant tables is possible without integration tests.
- **`can` admin bypass** not fully differentiated from super_admin except via `canUseCsvExport` tests.
- **`canAccessCreditModule`** also depends on env (`CREDIT_ANALYSIS_ACTIVE` / `NEXT_PUBLIC_CREDIT_ANALYSIS_ACTIVE`); tests only cover default closed posture for coverage/bond desks — env-true path untested here.
- Segmentation tests use `arrayContaining` for sectors/investors — **incomplete catalog** changes (missing unused sectors) would not fail.
- No TODO/FIXME comments in file.

---

## 2. `src/__tests__/reports.test.ts`

| Field | Value |
| --- | --- |
| **Path** | `src/__tests__/reports.test.ts` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/__tests__/reports.test.ts` |
| **Lines** | 252 |
| **Role** | Pure-utility unit tests for Reports & Export serialization layer: CSV builder, download headers/filenames, crore formatters, credit rating tier map |
| **Runtime** | Node (Vitest); no DB, no Next, no network |
| **Tables touched** | None (explicitly deferred to separate SQL smoke / seeded DB checks per file header comment) |

### Exports

None (test module).

### Imports

| Symbol | From | Kind |
| --- | --- | --- |
| `describe`, `expect`, `it` | `vitest` | harness |
| `rowsToCsv`, `exportFilename`, `csvDisposition`, `formatCr`, `compactCr`, `ratingTier`, `ratingTierColor`, `RATING_LADDER` | `@/features/reports/export` | pure export utils |
| `type ExportColumn` | `@/features/reports/queries` | column definition type only |

### Downstream signatures exercised (quoted)

```ts
// @/features/reports/queries
export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

// @/features/reports/export
export function rowsToCsv<T>(
  rows: readonly T[],
  columns: readonly ExportColumn<T>[],
): string;

export function exportFilename(prefix: string): string;
// → `<safePrefix>-YYYYMMDD.csv` (UTC date)

export function csvDisposition(filename: string): string;
// → `attachment; filename="…"; filename*=UTF-8''…`

export function formatCr(
  v: number | null | undefined,
  opts: { decimals?: number } = {},
): string;

export function compactCr(v: number): string;

export type RatingTier = "emerald" | "gold" | "info" | "down" | "neutral";
export function ratingTier(r: string | null | undefined): RatingTier;
export function ratingTierColor(r: string | null | undefined): string;
export const RATING_LADDER = [ "AAA", "AA+", …, "D" ]; // length 22 asserted
```

### Business purpose

Protects the **serialization / presentation layer** of management reports:

- CSV downloads must open correctly in Excel (UTF-8 BOM, CRLF, RFC 4180 quoting).
- Filenames and `Content-Disposition` must be safe (path chars stripped) and dual-form (ASCII fallback + RFC 5987 UTF-8).
- Monetary display is **crore-denominated** (Indian IB convention) with en-IN grouping and ₹.
- Credit scorecard bands map long-term rating letters to UI color tiers for badges/charts.

Does **not** test report SQL, route auth, or export access control (those live elsewhere: export route, `exportAccess`, RBAC suite).

### Key logic (test cases)

#### `describe("rowsToCsv")` (9 tests)

| Case | Expected behavior |
| --- | --- |
| Header + rows | Comma-separated; BOM-prefixed; CRLF between lines including trailing CRLF |
| Empty rows | Header only: `"\uFEFFA\r\n"` |
| BOM | `charCodeAt(0) === 0xfeff` |
| Line endings | Contains `\r\n`; not `\n\r` |
| Comma field | Quoted: `"a,b"` |
| Double-quote field | Escaped by doubling: `"say ""hi"""` |
| Newline field | Quoted with embedded `\n` |
| null / undefined | Empty cells (not string `"null"`) |
| Numbers / booleans | Coerced via accessors (`42`, `"Yes"`) |

Exact golden string example:

```
"\uFEFFName,Count\r\nAcme,3\r\nBeta,11\r\n"
```

#### `describe("exportFilename")` (3 tests)

- Pattern: `/^pipeline-report-\d{8}\.csv$/`
- Sanitization: `"Revenue / Report!"` → `revenue-report-YYYYMMDD.csv` (no `/`, no `!`)
- Whitespace prefix → fallback `export-YYYYMMDD.csv`

#### `describe("csvDisposition")` (2 tests)

- Starts with `attachment; filename=`
- Contains `filename*=UTF-8''pipeline-report-20260628.csv`
- Non-ASCII (`résumé report.csv`): legacy `filename="[a-z0-9._-]+"`; still has `filename*=`

#### `describe("formatCr")` (3 tests)

- `1191.2197` → `"₹1,191.22 Cr"`; `1272.44` → `"₹1,272.44 Cr"`
- null / undefined / NaN → `"-"`
- `{ decimals: 1 }` / `{ decimals: 0 }` honored

#### `describe("compactCr")` (3 tests)

| Range | Example | Output |
| --- | --- | --- |
| &lt; 1,000 Cr | 150, 999 | `₹150 Cr`, `₹999 Cr` |
| ≥ 1,000 Cr | 1500, 92036 | `₹1.5K Cr`, `₹92K Cr` |
| ≥ 1,00,000 Cr | 100000, 150000 | `₹1T`, `₹1.5T` |

#### `describe("ratingTier")` (5 tests)

| Tier | Ratings |
| --- | --- |
| `emerald` | AAA, AA+, AA, AA-, A+, A |
| `gold` | A- |
| `info` | BBB+, BBB, BBB- |
| `down` | BB+, BB, BB-, B+, CCC, D |
| `neutral` | null, undefined, `"BC-1"` (internal band string) |

#### `describe("ratingTierColor")` (1 test)

Maps via CSS variables: `--emerald`, `--gold`, `--info`, `--down`, `--muted-foreground` (null).

#### `describe("RATING_LADDER")` (1 test)

- First: `"AAA"`; last: `"D"`; `length === 22`.

### Side effects

- None durable. `exportFilename` reads `new Date()` (UTC) — **time-dependent** assertion uses regex on date segment only.
- No network, filesystem, or env mutation.

### Security / RBAC

- **No auth tests** in this file.
- **Filename sanitization** is a mild security/UX control (strips path separators / unsafe chars from download names) — covered by `exportFilename` and partially by `csvDisposition` ASCII fallback.
- Does not assert who may call export routes; pair with `rbacSegmentation.test.ts` (`canUseCsvExport`) and the export route handler for full story.
- CSV injection (formula cells like `=cmd|...`) is **not** tested — potential residual risk if user-controlled party names land in exports without prefixing.

### Coupling

| Dependency | Coupling |
| --- | --- |
| `@/features/reports/export` | total — every symbol under test |
| `@/features/reports/queries` | type-only `ExportColumn` |
| Implicit production consumers | `src/app/reports/export/route.ts` (mentioned in source comments), credit report UI |

### Risks / TODOs

- Header comment admits **route handler query correctness is out of scope** — regressions in SQL filters/brand scope won’t be caught here.
- `exportFilename` date uses **UTC**; local-midnight exports near IST boundary may surprise operators (documented by implementation, not tested as timezone concern).
- `compactCr` non-finite path (`"-"`) not asserted.
- Rating tier regex edge cases (e.g. `AAA+`, lowercase) untested.
- No TODO/FIXME in file.

---

## 3. `src/__tests__/routeSmoke.test.ts`

| Field | Value |
| --- | --- |
| **Path** | `src/__tests__/routeSmoke.test.ts` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/__tests__/routeSmoke.test.ts` |
| **Lines** | 54 |
| **Role** | Opt-in live HTTP smoke test against a running Next.js server; verifies public login surface and that `/parties` is auth-gated |
| **Runtime** | Node fetch; **conditional** on `process.env.SMOKE_BASE_URL` |
| **Tables touched** | None directly (live server may hit DB if configured) |

### Exports

None (test module).

### Imports

| Symbol | From |
| --- | --- |
| `describe`, `expect`, `it` | `vitest` |

No app-module imports.

### Local helpers / constants

```ts
const baseUrl = process.env.SMOKE_BASE_URL;
const skip = !baseUrl;
const base = baseUrl ?? "http://placeholder.invalid";

const smokeFetch = (path: string) =>
  fetch(`${base}${path}`, { redirect: "manual" });
```

### Business purpose

Lightweight **deployment / local-dev gate** without DOM testing libraries:

1. Confirm `/login` is publicly reachable (HTTP 200 + non-empty body).
2. Confirm `/parties` is **not** openly readable unauthenticated (must redirect to login or return 401/403).
3. When `SMOKE_BASE_URL` is unset, suite self-skips so default `vitest run` stays green in CI without Postgres/app process.

### Key logic

#### `describe.skipIf(skip)("route smoke (live server)")` — runs only when `SMOKE_BASE_URL` set

| Test | Expectation |
| --- | --- |
| `GET /login` | `status === 200`; body length &gt; 0 |
| `GET /parties` | `gated === true` where gated = 3xx **or** 401 **or** 403; if 3xx, `Location` header must contain `"login"` (case-insensitive) |

Uses `redirect: "manual"` so 302/307 is visible as status, not followed.

#### `describe.skipIf(!skip)("route smoke (no server)")` — runs when env **unset**

| Test | Expectation |
| --- | --- |
| skip placeholder | `expect(skip).toBe(true)` |

### Side effects

- **Network I/O** when enabled: real HTTP to `SMOKE_BASE_URL`.
- No local DB writes from the test itself.
- Does not set cookies or authenticate.

### Security / RBAC

**Auth-wall smoke only:**

- Proves unauthenticated callers cannot receive an open 200 on `/parties`.
- Does **not** prove correct RBAC for authenticated roles, brand scope, or permission matrices.
- Does not test API routes, export routes, or portal.
- A misconfigured server that returns 500 might fail the gate assertion (500 is not accepted as gated) — good for noticing broken deploys, but ambiguous vs auth.

Acceptable gated statuses: **302/307 (and any 3xx)**, **401**, **403**.  
Rejected: **200** (security failure), and implicitly other codes fail the boolean.

### Coupling

- Environment: `SMOKE_BASE_URL` (e.g. `http://localhost:3000`).
- Live app stack: Next proxy/middleware auth, `/login` page, `/parties` page.
- Zero compile-time coupling to `@/` modules.

### Risks / TODOs

- **Thin coverage** — only two paths; many authenticated surfaces untested.
- 3xx without `login` in Location fails; SSO redirect to external IdP might break assertion if Location omits substring `login`.
- Does not assert Set-Cookie or CSRF.
- Placeholder host `http://placeholder.invalid` never hit when skip=true.
- No TODO/FIXME in file.

---

## 4. `src/__tests__/scenarioAnalysis.test.ts`

| Field | Value |
| --- | --- |
| **Path** | `src/__tests__/scenarioAnalysis.test.ts` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/__tests__/scenarioAnalysis.test.ts` |
| **Lines** | 189 |
| **Role** | Invariant verification for the financial **scenario analysis engine** (bond, project finance, DCF, M&A, LBO): registry completeness, driver direction classification, best/base/worst ordering, sensitivity grid shape/monotonicity, formatters |
| **Runtime** | Node (Vitest); pure math engine — no DB, no Next |
| **Tables touched** | None |

### Exports

None (test module).

### Imports

| Symbol | From |
| --- | --- |
| `describe`, `expect`, `it` | `vitest` |
| `SCENARIO_MODELS`, `SCENARIO_MODEL_LIST`, `getScenarioModel`, `classifyDrivers`, `computeScenarios`, `computeSensitivity`, `formatOutcome`, `formatDriver`, `type ScenarioModelType` | `@/features/modeling/scenarioAnalysis` |

### Local constants

```ts
const TYPES: ScenarioModelType[] = [
  "bond",
  "project_finance",
  "dcf",
  "ma",
  "lbo",
];
```

### Downstream types / signatures (quoted)

```ts
export type ScenarioModelType =
  | "bond"
  | "project_finance"
  | "dcf"
  | "ma"
  | "lbo";

export type DriverUnit = "inr_cr" | "pct" | "multiple" | "years" | "ratio" | "number";
export type OutcomeFormat = "pct" | "multiple" | "inr_cr" | "price" | "ratio" | "decimal";

export interface DriverSpec {
  key: string;
  label: string;
  unit: DriverUnit;
  base: number;
  min: number;
  max: number;
  step: number;
  hint?: string;
}

export interface ScenarioOutcome {
  primary: number | null;
  primaryLabel: string;
  primaryFormat: OutcomeFormat;
  secondary?: number | null;
  secondaryLabel?: string;
  secondaryFormat?: OutcomeFormat;
}

export interface ScenarioModelDef {
  type: ScenarioModelType;
  label: string;
  description: string;
  drivers: DriverSpec[];
  defaultSensitivityX: string;
  defaultSensitivityY: string;
  run: (overrides: Record<string, number>) => ScenarioOutcome;
}

export interface ScenarioCases {
  best: ScenarioOutcome;
  base: ScenarioOutcome;
  worst: ScenarioOutcome;
  direction: Record<string, boolean>; // true = moving driver UP improves primary
  bounds: Record<string, { base: number; min: number; max: number }>;
}

export interface SensitivityGrid {
  xDriver: string;
  yDriver: string;
  xLabel: string;
  yLabel: string;
  xUnit: DriverUnit;
  yUnit: DriverUnit;
  xSteps: number[];
  ySteps: number[];
  cells: (number | null)[][]; // rows = ySteps, cols = xSteps
  format: OutcomeFormat;
}

export const SCENARIO_MODELS: Record<ScenarioModelType, ScenarioModelDef>;
export const SCENARIO_MODEL_LIST: ScenarioModelDef[];
export function getScenarioModel(type: ScenarioModelType): ScenarioModelDef;
export function classifyDrivers(...): Record<string, boolean>;
export function computeScenarios(...): ScenarioCases;
export function computeSensitivity(
  m, xDriver, yDriver, steps,
): SensitivityGrid;
export function formatDriver(v: number, unit: DriverUnit, digits?: number): string;
export function formatOutcome(v: number | null, format: OutcomeFormat, digits?: number): string;
```

(Exact parameter lists of `classifyDrivers` / `computeScenarios` / `computeSensitivity` live in `scenarioAnalysis.ts` lines ~536–612; tests call them as above.)

### Business purpose

Pins financial modeling UI correctness for deal/credit/IB tooling:

- Five model types always registered with coherent drivers and sensitivity axes.
- **Best ≥ base ≥ worst** on the primary metric (corner-case scenario construction).
- Driver **direction** matches market intuition (e.g. higher YTM lowers bond price).
- Sensitivity grids are well-formed and **monotonic** where theory requires.
- Display helpers format % / multiples / crores / years consistently for the modeling UI.

Source of truth called out in header: `src/features/modeling/scenarioAnalysis.ts`.

### Key logic (test cases)

#### `describe("registry - completeness")` (3 tests)

1. Every `TYPES` entry exists in `SCENARIO_MODELS` with matching `.type`; list length 5.
2. Per model: ≥ 2 drivers; `defaultSensitivityX/Y` ∈ driver keys; each driver satisfies `min ≤ base ≤ max` and `step > 0`.
3. `m.run({})` yields finite non-null `primary` for all five models.

#### `describe("classifyDrivers - direction intuition")` (5 tests)

| Model | Driver | Direction (`true` = up improves primary) |
| --- | --- | --- |
| bond | `yield` | `false` (higher YTM worsens price) |
| dcf | `waccOverride` | `false` |
| dcf | `ebitdaMargin` | `true` |
| lbo | `entryEvEbitda` | `false` |
| lbo | `exitEvEbitda` | `true` |
| ma | `runRateSynergies` | `true` |
| ma | `equityPurchasePrice` | `false` |
| project_finance | `ebitdaMargin` | `true` |
| project_finance | `debtPct` | `false` |
| project_finance | `costOfDebt` | `false` |

#### `describe("computeScenarios - best/base/worst ordering")` (5 + 1)

- For each of 5 types: `best.primary ≥ base.primary ≥ worst.primary` with `1e-9` epsilon tolerance; all primaries non-null.
- Bond-specific: `bounds.yield.min < bounds.yield.base`; best primary &gt; base primary (low-yield maximizes price).

#### `describe("computeSensitivity - grid shape & monotonicity")` (5 + 3)

- For each type: `computeSensitivity(m, defaultX, defaultY, 5)` → 5×5 cells; center `[2][2]` finite.
- Bond: axes `yield` × `coupon`; along mid-row, price **falls** as yield rises (columns).
- LBO: `entryEvEbitda` × `exitEvEbitda`; mid-row IRR non-increasing in entry; mid-col IRR non-decreasing in exit.
- DCF: `waccOverride` × `ebitdaMargin`; mid-row EV non-increasing as WACC rises.

#### `describe("formatting helpers")` (2 tests)

`formatOutcome`:

| Input | Format | Output |
| --- | --- | --- |
| 0.125 | `pct` | `12.50%` |
| 2.5 | `multiple` | `2.50×` |
| 1_200_000_000 | `inr_cr` | `₹120.00 Cr` |
| 99.5 | `price` | `₹99.50` |
| 1.25 | `ratio` | `1.25×` |
| null | `pct` | `-` |

Note: `inr_cr` path treats raw number as **rupees** and divides to crores in the engine formatter (1.2e9 → ₹120 Cr) — **different convention** from reports `formatCr` which already receives crores. Tests lock the modeling convention.

`formatDriver`:

| Value | Unit | Output |
| --- | --- | --- |
| 8.4 | `pct` | `8.40%` |
| 8.0 | `multiple` | `8.00×` |
| 150 | `inr_cr` | `₹150.00 Cr` |
| 5 | `years` | `5.00 yr` |

### Side effects

- Pure computation; no I/O.
- Heavy floating-point math; uses epsilon tolerances (`1e-9`) for comparisons.

### Security / RBAC

- **None** — pure modeling math. Access control for the modeling UI/routes is outside this file.
- No secret handling; no user input validation beyond numeric model bounds encoded in `DriverSpec`.

### Coupling

| Dependency | Strength |
| --- | --- |
| `@/features/modeling/scenarioAnalysis` | total |
| Implicit UI consumers of SCENARIO_MODELS / grids | high behavioral contract |
| Vitest | harness |

Driver **key strings** (`yield`, `waccOverride`, `entryEvEbitda`, etc.) are hard-coded in tests — renames in the registry break the suite intentionally.

### Risks / TODOs

- Monotonicity checked for **bond / lbo / dcf** only; project_finance and ma grids only check shape/finiteness.
- Ordering uses soft inequality with epsilon; pathological floating-point plateaus could mask bugs.
- Does not assert secondary metrics, labels, or absolute numeric goldens for model outputs (regression in formula magnitude might pass if order preserved).
- `formatOutcome(..., "decimal")` and `formatDriver(..., "ratio"|"number")` untested.
- No TODO/FIXME in file.

---

## Cross-file summary (batch 011)

| File | Lines | Category | DB | Auth tested | Pure? |
| --- | --- | --- | --- | --- | --- |
| `rbacSegmentation.test.ts` | 246 | Policy / catalog unit tests | No | Yes (matrix) | Yes |
| `reports.test.ts` | 252 | Export serialization unit tests | No | No (sanitization only) | Yes |
| `routeSmoke.test.ts` | 54 | Opt-in HTTP smoke | Indirect | Auth wall only | Network when enabled |
| `scenarioAnalysis.test.ts` | 189 | Financial engine invariants | No | No | Yes |

### Shared themes

1. **Vitest** is the universal harness (`describe` / `it` / `expect`; smoke uses `describe.skipIf`).
2. **Path aliases** `@/lib/*`, `@/features/*` mirror production layout.
3. **Security-critical** batch content is concentrated in `rbacSegmentation.test.ts` + gated route smoke; reports tests protect export **format** integrity, not authorization.
4. **No production exports** from any file in this batch.
5. **No direct table schemas**; brand SQL *values* are only asserted as string arrays in RBAC tests.

### Suggested companion modules (for human navigators, not in batch)

- `@/lib/rbac-core`, `@/lib/org`
- `@/features/reports/export`, `exportAccess`, `queries`
- `@/features/parties/segmentation`
- `@/features/modeling/scenarioAnalysis`
- Live routes: `/login`, `/parties`, reports export route

---

*End of agent-011 analysis.*
