# MEGA-C Rollup — App routes (batches 041–060)

**Agent:** MEGA-AGENT C  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Coverage:** `agent-041.md` … `agent-060.md`  
**Batch lists:** `batch-041.list` … `batch-060.list`

Note: Modeling, notifications, and onboarding live in **agents 035–040** (prior MEGA scope). This rollup covers home, parties, portal, portfolio, reports, tasks, plus brand/UI chrome those routes depend on.

---

## 1. Scope map by batch

| Batch | Area | Files (summary) |
|-------|------|-----------------|
| 041 | Home + party detail shell | `/` page, `/parties/[id]`, assign form, parties loading |
| 042 | Parties explorer | new dialog, list page, PartiesExplorer, PartyAvatar |
| 043 | Party graph + client portal | signals, RelationshipGraph, client detail + directory |
| 044 | Client list + investor detail | client loading/page, investor charts + detail |
| 045 | Investor list + concentration UI | investor directory/loading/page, ConcentrationView |
| 046 | Portfolio nav/charts/risk page | portfolio-charts wrapper, sub-nav, RiskMetricsView, concentration page |
| 047 | Portfolio overview/limits UI | EditLimitDialog, LimitsView, OverviewView, charts-impl |
| 048 | Portfolio routes | layout, limits page, loading, overview page |
| 049 | Risk page + report charts | risk-metrics page, CreditReportView, report-charts* |
| 050 | Reports hub + export | hub view, compliance/credit pages, export route |
| 051 | Reports pipeline/revenue | loading, hub page, pipeline, revenue |
| 052 | Tasks core | detail, status form, new dialog, list page |
| 053 | Tasks list + brand core | TasksListView, Badge, Button, Card |
| 054–058 | Brand system + bell | chart-theme … table/text, NotificationBell |
| 059–060 | Chrome + ui kit | SiteNav, ThemeProvider, ui badge/button/card/dialog/dropdown/input |

---

## 2. Architecture patterns (cross-cutting)

### 2.1 Server / client split

```
RSC page (force-dynamic + requireUser + feature queries)
  └── Client view (URL filters, tables, dialogs, recharts)
        └── Server actions (create/update) / GET export route
```

- Almost all data routes set `export const dynamic = "force-dynamic"`.
- Charts never import recharts in RSC: `*-charts.tsx` wrappers use `next/dynamic({ ssr: false })` → `*-impl.tsx`.
- Formatter functions stay on client (`compactValue`, StatCard `format`) because functions cannot cross the RSC boundary.

### 2.2 Auth / RBAC layers

| Layer | Where | What |
|-------|-------|------|
| Proxy cookie | `src/proxy.ts` (out of batch) | Coarse session |
| `requireUser()` | Every page/layout here | Auth gate |
| Feature queries + `user` | list*/get* | Brand/desk/row visibility |
| `can(user, action, resource)` | e.g. limits edit | Fine-grained UI + action recheck |
| `canUseCsvExport` | `/reports/export` | Super-admin CSV |
| `canReadAllInScope` | Party assign card | Ownership UI |

**Gaps:** SiteNav shows full IA to every user; export `listParties` omits `user`/rich filters; portals are “read-only” by UI convention, not a separate portal role.

### 2.3 URL-as-state

Shared pattern: debounced search ~280ms, filters via `router.replace`, page via query string, selection via `?id=` (parties). Shareable desk views.

### 2.4 Design system dualism

| Preferred (product) | Underlying / legacy |
|---------------------|---------------------|
| `@/components/brand/*` | `@/components/ui/*` |
| Brand Button (gold primary) | ui/button base-ui |
| Brand Dialog composition | ui/dialog primitives |
| Brand Input | ui/input + local BezelInput copies |

Emerald naming often maps to **gold chrome** in Badge/Button — semantic confusion.

---

## 3. Domain area deep dives

### 3.1 Home (`/`) — agent 041

- Personalized greeting (IST), KPIs from `getDashboardData`, 8-stage open pipeline strip, recent deals/interactions, quick links.
- Stage enums hardcoded; no page-level permission beyond auth.

### 3.2 Parties (`/parties`) — agents 041–043, 042 explorer

**Explorer (not a table):** alphabetized rich list + sticky PreviewPane (mini graph, mandates, exposure, KYC). Desktop `?id=` select; mobile navigates to detail.

**Detail 360:** identifiers, assign ownership (scope-gated), full RelationshipGraph, contacts, hierarchy, deals, credit cache, KYC.

**Signals:** `deriveStrength` display-only (deals 40% / rel 30% / contacts 15% / KYC 15%).

**Mutations:** `createParty`, `assignParty`.

**Key risks:** deal links often `/deals` not `/deals/[id]`; create dialog lacks tax IDs; matchMedia hydration may navigate before desktop select mode; explorer ~1.2k LOC monolith.

### 3.3 Portal — agents 043–045

| Route | Book | Content |
|-------|------|---------|
| `/portal/client` | Issuers advised | Raised, deals, KYC, onboarding |
| `/portal/client/[id]` | Engagement | Deals placement %, docs (no download), contacts, KYC history |
| `/portal/investor` | Buy-side | Portfolio value, holdings |
| `/portal/investor/[id]` | Portfolio | Composition charts, demat, holdings, allocation trail, KYC |

Explicit **Read-only** chrome. Sensitive demat IDs + commercial allocations.

**Key risks:** Cr vs rupees unit inconsistency (investor KPI StatCards vs `Money` cells using `*1e7`); hub cards in reports mislabel portal destinations.

### 3.4 Portfolio (`/portfolio`) — agents 045–049, 046–048

**Layout:** PageShell + sub-nav (Overview / Concentration / Risk metrics / Limits).

| Subroute | Purpose |
|----------|---------|
| Overview | Sector/issuer/rating/tenor charts, alert rail, limit gauges |
| Concentration | RBI caps, HHI/CR3, issuer/sector/rating tables |
| Risk metrics | Mod duration, convexity, DV01, parametric VaR |
| Limits | Counterparty limits blotter + edit (`credit_limit:approve`) |

Charts: lazy recharts via portfolio-charts → impl.

**Critical UX bug:** `portfolio/page.tsx` re-wraps `PageShell`/`PageHeader` while `layout.tsx` already does → **double chrome**.

**Risk model:** simplified (par-bond, coupon≈yield, 1d 99% parametric) — UI disclaimer present.

**Mutations:** `updateLimit` with audit log; manual utilized can drift from exposure jobs.

### 3.5 Reports (`/reports`) — agents 049–051, 050 export

| Route | Content |
|-------|---------|
| `/reports` | 8-card hub + hub KPIs |
| `/reports/pipeline` | Stage/type/RM league |
| `/reports/revenue` | Fee model by month/RM/deal (UI cap 50 deals) |
| `/reports/credit` | Analyses + band chart + filter table |
| `/reports/compliance` | KYC, audit, DPDP consent |
| `GET /reports/export?kind=` | CSV attachment |

**Export kinds:** pipeline, revenue, credit-report, compliance-kyc, parties, deals, credit, kyc, interactions, tasks, documents. Cap 5000 rows. Super-admin only.

**Key risks:** export filters incomplete vs UI; parties export without `user`; hub “Portfolio” card → `/deals`; revenue is fee_structure math not GL.

### 3.6 Tasks (`/tasks`) — agents 052–053

List with open-only default filter rail, assignee filter, CSV, create dialog. Detail shows deps/blocks + status form.

**Mutations:** `createTask`, `updateTaskStatus`.

**Key risks:** raw UUIDs for assignee/deal/party/deps; deal deep-links incomplete; overdue styling may apply to completed rows; assignee options may be unscoped.

### 3.7 Brand + chrome — agents 053–060

- **Money:** `compactINR` assumes rupees; reports use `compactCr` for crore inputs.
- **NotificationBell:** mount + open fetch; mark-all only for loaded items; silent errors.
- **SiteNav:** full product IA; collapse CSS var; logo static import for proxy; no role filtering.

---

## 4. Coupling graph (high level)

```
SiteNav ──► NotificationBell ──► workflow actions
       └──► logout / palette event

/ ──► dashboard/queries
/parties* ──► parties/queries|actions|segmentation + party-* UI
/portal/* ──► features/portal (+ portal-charts client)
/portfolio/* ──► features/portfolio|risk + portfolio-charts
/reports/* ──► features/reports + report-charts
             └── export/route ──► many feature list* + report export rows
/tasks* ──► features/tasks

All brand consumers ──► @/components/brand/*
Dialogs ──► @/components/ui/dialog
```

---

## 5. Security & compliance summary

| Finding | Severity | Where |
|---------|----------|--------|
| CSV export super-admin gated | Control | export route |
| Export may omit user/filters (parties) | High | export `listParties` |
| Portal demat/PII/MNPI badges without download | Medium | client/investor detail |
| Limits edit permission double-checked | Good | page can + action |
| Nav not RBAC-filtered | Medium | SiteNav |
| Risk VaR simplified | Medium (model) | risk-metrics |
| Strength score display-only | Info | party-signals |
| No polling on bell | Low | NotificationBell |

---

## 6. Highest-priority engineering TODOs

1. **Remove nested PageShell** on `/portfolio` overview (`page.tsx` vs `layout.tsx`).
2. **Pass `user` + full filter set** into all export list branches; clamp 5000 with user-visible warning.
3. **Normalize money units** (rupees vs Cr) across portal/portfolio/reports StatCards.
4. **Deep-link deals** from parties/tasks/portal to `/deals/[id]` when IDs available.
5. **Task create UX:** staff/party/deal pickers instead of raw UUIDs.
6. **Role-aware SiteNav** (hide Admin/portal/export for limited roles).
7. **Fix Badge/Button emerald naming** vs gold styling.
8. **Bell markAll** should mark all unread server-side, not just 6 loaded.
9. **Reports hub cards** should point Portfolio → `/portfolio`, Investor analytics → `/portal/investor`, Client analytics → `/portal/client`.
10. Split **parties-list-view** and large detail pages for maintainability.

---

## 7. Entity / table touchpoints (via features)

| Entity | Surfaces in this rollup |
|--------|-------------------------|
| party / types / contacts / relationships | parties, portal |
| deal / deal_party / fee_structure | home, parties, portal client, reports |
| credit analysis / limits / exposure | portfolio, credit report |
| kyc_record / consent / audit_log | parties detail, portal, compliance report |
| allocation / demat / holdings | investor portal |
| task / task_dependency | tasks |
| notifications (workflow) | NotificationBell |
| app_user | assign, assignees |

---

## 8. File inventory checklist

All 20 agent files overwritten under:

`/home/Jashmhta/crm/bc-crm/analysis/file-by-file/agent-041.md` … `agent-060.md`

Each follows structure: path, lines/role, exports+signatures, imports, business purpose, key logic, side effects, security/RBAC, coupling, risks/TODOs, batch cross-file summary.

---

*End of MEGA-C rollup.*
