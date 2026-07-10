# Agent 045 — File-by-file analysis

**Batch:** `batch-045.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Investor portal directory + portfolio concentration client view.

---

## 1. `src/app/portal/investor/investor-directory-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/portal/investor/investor-directory-view.tsx` |
| **Lines** | 314 |
| **Directive** | `"use client"` |
| **Role** | Buy-side directory UI |

### Exports + signatures

```ts
export interface InvestorDirectoryViewProps {
  rows: InvestorListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
  summary: InvestorListSummary;
}

export function InvestorDirectoryView(props: InvestorDirectoryViewProps)
```

### Business purpose

Searchable ranked list of investors with portfolio value, holdings count, last allocation, KYC; KPIs for total investors / portfolio / with holdings / avg portfolio.

### Key logic

- Debounced search → `/portal/investor?q=&page=`.
- StatCards for summary (note: `totalPortfolioValueCr` / `avgPortfolioValueCr` use `preset="currency"` **without** `* 1e7` — **inconsistent** with client directory which multiplies Cr×1e7).
- Row links to `/portal/investor/[id]`.
- Pagination pills.

### Side effects

URL nav only.

### Security / RBAC

Server-filtered rows; read-only.

### Risks

1. **Possible unit bug** on portfolio StatCards vs Money cells (`portfolioValueCr * 1e7`).
2. Prev pill still uses ArrowRight icon.
3. No advanced filters (type, AUM band).

---

## 2. `src/app/portal/investor/loading.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 44 |
| **Exports** | `InvestorPortalLoading` |
| **Role** | Skeleton matching directory KPI + table |

Same pattern as client portal loading. Pure presentational.

---

## 3. `src/app/portal/investor/page.tsx`

| Field | Value |
|--------|--------|
| **Lines** | 43 |
| **Route** | `/portal/investor` |
| **Exports** | `dynamic = "force-dynamic"`, `InvestorPortalPage` |

### Key logic

`requireUser` + `listInvestors({ q, page, pageSize: 25, user })` → `InvestorDirectoryView`.

### Risks

Unused `DetailTopBar` import; page float/clamp issues same as client list.

---

## 4. `src/app/portfolio/_components/concentration-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/portfolio/_components/concentration-view.tsx` |
| **Lines** | ~250+ |
| **Directive** | `"use client"` |
| **Role** | Concentration analysis charts + RBI/issuer/rating tables |

### Exports + signatures

```ts
export interface ConcentrationViewProps {
  sectors: SectorConcentrationRow[];
  issuers: IssuerConcentrationRow[];
  ratings: RatingConcentrationRow[];
}

export function ConcentrationView(props: ConcentrationViewProps)
```

**Internals:** `SectorRbiTable`, `IssuerTable`, `RatingTable` (+ cell helpers).

### Imports

Brand Badge/Reveal/Table/ChartCard; `compactCr`; portfolio concentration types; lazy `VBarChart` from `./portfolio-charts`.

### Business purpose

Three concentration lenses:

1. **Sector** VBar + RBI sectoral cap comparison table (share vs cap, breach).
2. **Issuer** top-N with cumulative share, single-name limit, utilization, concentration class.
3. **Rating** band table with party count / share (sub-IG watchlist narrative in copy).

### Key logic

Maps sectors to `LabelValuePoint` for VBar; tables render breach badges; uses `compactCr` for ₹ Cr display.

### Side effects

Chart lazy load only.

### Security / RBAC

Data pre-scoped on concentration page via `user`; view is display.

### Coupling

Portfolio feature row types; RBI thresholds come from server rows (caps in table columns).

### Risks

1. **Function compactValue** passed into client charts OK (same client tree).
2. Large tables without virtualization if issuer N grows.
3. Relies on page-level StatCards for HHI/CR3 (not recomputed in view).

---

## Cross-file summary (batch 045)

Investor portal list completes buy-side IA; concentration-view is the heavy client surface for `/portfolio/concentration`.

### Highest-priority risks

1. Investor KPI currency unit inconsistency.
2. Portal vs portfolio product boundary — portals are party-centric read models; portfolio is firm book risk.

---

*End of agent-045 analysis.*
