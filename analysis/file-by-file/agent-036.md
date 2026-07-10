# File-by-file analysis — agent-036

**Batch:** `batch-036.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (LBO calculator page+lazy+full; MA calculator lazy)

---

## 1. `src/app/modeling/lbo-calculator/lbo-calculator-lazy.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/modeling/lbo-calculator/lbo-calculator-lazy.tsx` |
| **Lines** | 44 |
| **Directive** | `"use client"` |
| **Role** | Client-only dynamic import wrapper (`ssr:false`) for LBO calculator. |

### Exports

```ts
export function LboCalculator(): JSX.Element
```

### Key logic

`next/dynamic(() => import("./lbo-calculator").then(m => m.LboCalculator), { ssr: false, loading: LboCalculatorSkeleton })`.

Skeleton reserves ~560px dual column + 300px chart to prevent CLS. Server pages cannot call `dynamic(..., {ssr:false})` directly — this wrapper owns that.

### Side effects

Loads framer-motion + heavy calculator after first paint.

### Security / Coupling

None / page imports wrapper; real calc in lbo-calculator.tsx + lboModel.

### Risks

SSR false means SEO/first paint empty shell — acceptable for internal tool.

---

## 2. `src/app/modeling/lbo-calculator/lbo-calculator.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/modeling/lbo-calculator/lbo-calculator.tsx` |
| **Lines** | ~650+ (inputs + Results: sources/uses, debt schedule, grids) |
| **Directive** | `"use client"` |
| **Role** | Full interactive LBO returns model UI. |

### Exports

```ts
export function LboCalculator(): JSX.Element
```

Internals: FormState, TrancheForm, defaultsFromModel, toLboInputs, Field, FieldDivider, LiveNumber, MetricTile, Results, SuTable, etc.

### Imports

- `computeLbo`, `lboDefaults`, formatters, types from `@/features/modeling/lboModel`
- `createModel` server action
- brand Card/Button/Badge/Input/Table/Reveal; Dialog from shadcn

### Business purpose

Model sponsor IRR/MOIC for LBO: LTM EBITDA, growth, entry/exit EV/EBITDA, multi-tranche debt, fees, cash sweep, India tax default (115BAA). Save versioned `financial_model` (model_type=lbo, engineVersion `lboModel.v1`) with params/outputs JSON, optional deal/party UUID links.

### Key logic

1. Form in ₹ Cr / % UI units → convert to absolute rupees for model.
2. useMemo computeLbo; finite moic guard.
3. Tranche add/remove; leverage badge = totalDebt/EBITDA.
4. Save dialog: hidden modelType/params/outputs/currency/engineVersion; optional scenarioTag, dealId, partyId, assumptionsDoc.
5. Results: IRR/MOIC LiveNumber, metric tiles, sources & uses, debt schedule, entry×exit sensitivity (further below).

### Side effects

createModel insert + revalidate; client compute only until save.

### Security / RBAC

createModel must check modeling permissions; deal/party UUID free text — IDOR risk if server doesn’t scope.

### Coupling

lboModel pure engine (tested in `__tests__/lboModel.test.ts`); modeling actions; financial_model schema.

### Risks / TODOs

- Math.random tranche ids.
- No auto-save; page refresh loses work.
- createModel UUID fields not picker-backed — easy operator error.
- Large client bundle even with lazy split.

---

## 3. `src/app/modeling/lbo-calculator/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/modeling/lbo-calculator/page.tsx` |
| **Lines** | 38 |
| **Directive** | RSC |
| **Role** | LBO calculator route shell. |

### Exports

```ts
export const dynamic = "force-dynamic";
export default async function Page(): Promise<JSX.Element>
```

### Key logic

requireUser; PageShell wide; DetailTopBar back `/modeling`; badges Multi-tranche / Cash sweep / Hold-to-exit; render lazy LboCalculator.

### Security

Auth only — no modeling role gate in page.

### Risks

Any authenticated employee can open LBO tool and potentially save models if action allows.

---

## 4. `src/app/modeling/ma-calculator/ma-calculator-lazy.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/modeling/ma-calculator/ma-calculator-lazy.tsx` |
| **Lines** | 44 |
| **Directive** | `"use client"` |
| **Role** | Same lazy pattern for M&A calculator (`MaCalculator` from `./ma-calculator`). |

Skeleton heights ~520px + 280px chart. Pattern identical to LBO lazy entry — first-load JS hygiene.

### Coupling

Mirrors LBO; maModel engine behind ma-calculator.tsx (not in batch).

### Risks

Same as LBO lazy.

---

## Cross-file architecture (batch-036)

```
/modeling/lbo-calculator (RSC shell)
  → lbo-calculator-lazy (dynamic ssr:false)
    → LboCalculator client
      → computeLbo (pure)
      → createModel (mutation boundary)
ma-calculator-lazy: same pattern for M&A
```

**Mutation boundary:** save only via createModel.  
**Production gaps:** no desk RBAC on modeling routes; free-text UUID linking.

*End of agent-036 analysis.*
