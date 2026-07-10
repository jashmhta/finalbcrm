# File-by-file analysis — agent-024

**Batch:** `batch-024.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (credit module shell: layout gate, list page, new-analysis page + form)

---

## 1. `src/app/credit/layout.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/credit/layout.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/credit/layout.tsx` |
| **Lines** | 21 |
| **Directive** | None (RSC App Router layout) |
| **Role** | Segment layout for entire `/credit/*` tree. Auth + credit-module role gate; pass-through children (no chrome). |

### Exports

```ts
export default async function CreditLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactNode>
```

No named exports. No metadata / loading / error boundaries.

### Imports

| Source | Symbols |
|--------|---------|
| `next/navigation` | `redirect` |
| `@/lib/rbac` | `requireUser` |
| `@/lib/org` | `canAccessCreditModule` |

### Business purpose

Credit analysis is CEO-gated: inactive for general employees; supers, admins, `credit_analyst`, and `director` retain access. Env `CREDIT_ANALYSIS_ACTIVE=true` or `NEXT_PUBLIC_CREDIT_ANALYSIS_ACTIVE=true` opens the module to any authenticated user with non-empty roles.

### Key logic

1. `await requireUser()` — redirect to `/login` if no session.
2. `canAccessCreditModule(user.roles)` — if false, `redirect("/")`.
3. Else return `children` unchanged.

### Side effects

- Auth cookie/session read via `requireUser` → `getCurrentUser` → Auth.js.
- Navigation redirects only; no DB writes.

### Security / RBAC

- Hard route gate (not nav-only). Soft nav visibility in `site-nav.tsx` is separate UX.
- Layout does **not** re-check `can(user, "read", "credit")` — module access is role/env only.
- Child pages still call `requireUser` again (defense in depth).

### Coupling

- `@/lib/org` CEO org model; `@/lib/rbac` session loader.
- Applies to all credit routes: list, new, `[id]/*`.

### Risks / TODOs

- Env public flag (`NEXT_PUBLIC_*`) can open credit UI client-side; server gate uses same condition — intentional for staff rollout.
- No audit log on denied access.
- Comment says “inactive for general employees”; default deny is correct when env unset.

---

## 2. `src/app/credit/new/new-credit-analysis-form.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/credit/new/new-credit-analysis-form.tsx` |
| **Lines** | 298 |
| **Directive** | `"use client"` |
| **Role** | Client form to open a draft credit analysis (issuer + obligor type + analysis type). |

### Exports

```ts
export function NewCreditAnalysisForm({
  parties,
}: {
  parties: { partyId: string; legalName: string }[];
}): JSX.Element
```

Internal: `FieldSelect` — native select with chevron chrome.

### Imports

- React / `useActionState`, `next/link`
- Phosphor: `ArrowRight`, `ArrowLeft`, `Buildings`, `SealCheck`, `Tag`, `Hash`
- `@/lib/utils` `cn`
- Brand: `Card*`, `Button`, `Eyebrow`, `Badge`
- `@/features/credit/actions` → `createCreditAnalysis`, `CreateCreditAnalysisState`

### Constants / domain enums

**OBLIGOR_TYPES:** `corporate | spv | project | sovereign | state_psu | nbfc | bank`  
**ANALYSIS_TYPES:** `origination | annual_surveillance | event_driven | watchlist_trigger | rating_presentation_support`  

Hints map each enum to analyst-facing copy (NBFC ALM, DSCR, agency review, etc.).

### Business purpose

Start a credit file without a free-text name column (schema frozen). Live **“Filed as”** preview assembles `issuerName · analysisLabel` as display-only identity before commit. Server action signature unchanged.

### Key logic

1. `useActionState(createCreditAnalysis, undefined)`.
2. Local state: `partyId`, `obligorType` (default corporate), `analysisType` (default origination).
3. `filedAs` preview; badges for obligor type + analysis type.
4. Form fields: required `partyId`, required `obligorType`, `analysisType`.
5. Submit disabled when pending, no parties, or no party selected.
6. Error from action: `state?.error` in `text-down`.

### Side effects

- Server action insert + redirect on success (in feature action, not this file).
- No local storage.

### Security / RBAC

- UI only; real auth/permission in `createCreditAnalysis`.
- Parties list already scoped by parent page’s `listParties({ user })`.

### Coupling

- Mutation boundary: client → server action only.
- Parties prop serializable across RSC boundary.

### Risks / TODOs

- Party dropdown capped at parent pageSize (200) — large books incomplete.
- No client-side enum validation beyond HTML select options (server must re-validate).
- Empty parties: soft message only.

---

## 3. `src/app/credit/new/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/credit/new/page.tsx` |
| **Lines** | 36 |
| **Directive** | RSC |
| **Role** | New credit analysis page shell: load parties, render form. |

### Exports

```ts
export const dynamic = "force-dynamic";
export default async function NewCreditAnalysisPage(): Promise<JSX.Element>
```

### Imports

`next/link` (unused import present), `requireUser`, `listParties`, brand `Reveal`/`PageShell`/`PageHeader`/`DetailTopBar` (DetailTopBar imported unused), `./new-credit-analysis-form`.

### Business purpose

Authenticated page to create draft credit file; loads first 200 parties for issuer picker.

### Key logic

1. `requireUser()`.
2. `listParties({ page: 1, pageSize: 200, user })`.
3. Map to `{ partyId, legalName }` for client form.

### Side effects

- DB read via parties queries; force-dynamic prevents build-time execution.

### Security / RBAC

- Auth + parent layout credit gate.
- Party list visibility follows party RBAC/segmentation in `listParties`.

### Coupling

- Parties feature queries; credit form client component.

### Risks / TODs

- Unused imports (`Link`, `DetailTopBar`) — lint noise.
- Hard cap 200 parties.

---

## 4. `src/app/credit/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/credit/page.tsx` |
| **Lines** | 47 |
| **Directive** | RSC |
| **Role** | Credit analyses list page (paginated, searchable). |

### Exports

```ts
export const dynamic = "force-dynamic";
export default async function CreditListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}): Promise<JSX.Element>
```

`PAGE_SIZE = 25` module constant (not exported).

### Imports

`PageHeader`, `PageShell`, `requireUser`, `listCreditAnalyses`, `Reveal` (imported unused), `CreditListView`.

### Business purpose

Ledger of credit analyses / scorecards / rating work. Search + pagination via URL params.

### Key logic

1. `requireUser()`.
2. Await `searchParams`: `q` trimmed optional; `page` ≥ 1.
3. `listCreditAnalyses({ q, user, page, pageSize: 25 })`.
4. Compute `totalPages`; pass rows/meta to `CreditListView`.

### Side effects

- DB list query only; force-dynamic.

### Security / RBAC

- User passed into query for scoping (credit visibility).
- Layout already gates module access.

### Coupling

- `@/features/credit/queries`, sibling `credit-list-view.tsx` (not in this batch).

### Risks / TODOs

- Unused `Reveal` import.
- No sort controls at page layer (view may add).

---

## Cross-file architecture (batch-024)

```
proxy (auth cookie) → /credit/*
  CreditLayout: requireUser + canAccessCreditModule
    page.tsx: listCreditAnalyses → CreditListView
    new/page.tsx: listParties → NewCreditAnalysisForm
      → createCreditAnalysis (server action)
```

**Mutation boundary:** form posts only through `createCreditAnalysis`; layout/pages are read + gate.  
**Party-centric:** every analysis is keyed by issuer party.  
**Production gaps:** party picker scale; unused imports; credit module env dual-flag complexity.

*End of agent-024 analysis.*
