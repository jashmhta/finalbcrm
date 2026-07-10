# 02 — Routes (`app/src/app`)

Next.js App Router pages, layouts, loading states, and route-local components. Most pages are RSC with force-dynamic DB reads.

## File inventory

_160 files · 55,607 lines_

### Domain: `_components`

PRD: **Cross-cutting / Supporting**

#### `app/src/app/_components/dashboard-charts-impl.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 586 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (10) | DealVelocityPoint, DealVelocityChart, SectorSlice, SectorDonut, CreditBandSlice, CreditScoreChart, KycStatusSlice, KycStatusChart |
| Has TODO | N |
| Purpose | Exports: DealVelocityPoint, DealVelocityChart, SectorSlice, SectorDonut, CreditBandSlice, CreditScoreChart, KycStatusSlice, KycStatusChart, InvestorTypeSlice, InvestorTypeChart |

#### `app/src/app/_components/dashboard-charts.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 96 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (5) | DealVelocityChart, SectorDonut, CreditScoreChart, KycStatusChart, InvestorTypeChart |
| Has TODO | N |
| Purpose | Exports: DealVelocityChart, SectorDonut, CreditScoreChart, KycStatusChart, InvestorTypeChart |

#### `app/src/app/_components/exposure-chart-impl.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 374 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | ExposurePoint, ExposureChart |
| Has TODO | N |
| Purpose | Exports: ExposurePoint, ExposureChart |

#### `app/src/app/_components/exposure-chart.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 86 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | ExposureChart |
| Has TODO | N |
| Purpose | Exports: ExposureChart |

#### `app/src/app/_components/kpi-hero.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 377 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | KpiHeroProps, KpiHero |
| Has TODO | N |
| Purpose | Exports: KpiHeroProps, KpiHero |

#### `app/src/app/_components/kpi-stat.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 143 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | KpiStatProps, KpiStat |
| Has TODO | N |
| Purpose | Exports: KpiStatProps, KpiStat |

#### `app/src/app/_components/recent-activity.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 273 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | RecentInteraction, RecentActivity |
| Has TODO | N |
| Purpose | Exports: RecentInteraction, RecentActivity |

#### `app/src/app/_components/stage-strip.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 161 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | StageCardData, StageStrip |
| Has TODO | N |
| Purpose | Exports: StageCardData, StageStrip |

### Domain: `actions`

PRD: **Cross-cutting / Supporting**

#### `app/src/app/actions/auth.ts`

| Field | Value |
|---|---|
| Role | `app-support` — App-level support file |
| LOC | 10 |
| Runtime | server |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | logout |
| Has TODO | N |
| Purpose | Exports: logout |

### Domain: `admin`

PRD: **Platform Admin/RBAC**

#### `app/src/app/admin/audit/audit-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 688 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | AdminAuditViewProps, AdminAuditView |
| Has TODO | N |
| Purpose | Exports: AdminAuditViewProps, AdminAuditView |

#### `app/src/app/admin/audit/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 105 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | dynamic, metadata |
| Has TODO | N |
| Purpose | Admin → Audit - the admin's forensic view of the immutable audit log. More detailed than the compliance audit page: advanced filters (entity type, operation, actor, date range, barrier) + a per-row diff inspector.  Gated to audit:read (admin / compliance / partner roles). The data layer reuses the compliance audit query (LEFT JOIN app_user for actor email) with the barrier filter exposed. |

#### `app/src/app/admin/dashboard-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 563 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | AdminDashboardViewProps, AdminDashboardView |
| Has TODO | N |
| Purpose | Exports: AdminDashboardViewProps, AdminDashboardView |

#### `app/src/app/admin/loading.tsx`

| Field | Value |
|---|---|
| Role | `loading-ui` — Suspense loading skeleton for route |
| LOC | 59 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Suspense loading skeleton for route |

#### `app/src/app/admin/master-data/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 369 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | dynamic, metadata |
| Has TODO | N |
| Purpose | Admin → Master data - read-only display of the firm's reference data: • sector_code - the hierarchical sector taxonomy (NIC / RBI sectoral deployment codes, segment class, level, active flag). • rating_ladder - the cross-agency rating rank reference (CRISIL long term scale in the seed; extensible to ICRA / CARE / etc.). • deal_type / instrument_type / rating_agency - the Postgres enum value lists  |

#### `app/src/app/admin/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 73 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | dynamic, metadata |
| Has TODO | N |
| Purpose | Admin dashboard - system stats, recent audit, system health.  The admin's at-a-glance posture: counts (users / roles / deals / parties / DB size), a security health rail (active / inactive / locked / MFA / never- logged-in + audit hash-chain integrity), and the recent audit event rail + breakdowns (entity / operation / top actors). All reads are server-side; the client view owns the motion + count |

#### `app/src/app/admin/roles/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 48 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | dynamic, metadata |
| Has TODO | N |
| Purpose | Admin → Roles - list roles + their permissions, assign/revoke permissions. Gated to user:manage (admin role). The admin role itself is protected - its permissions cannot be edited through this surface (an admin locking themselves out of user:manage would brick the panel). |

#### `app/src/app/admin/roles/roles-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 320 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | RolesManagerViewProps, RolesManagerView |
| Has TODO | N |
| Purpose | Exports: RolesManagerViewProps, RolesManagerView |

#### `app/src/app/admin/users/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 49 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | dynamic, metadata |
| Has TODO | N |
| Purpose | Admin → Users - list all app_user records with email, roles, desk, active status, last login. Create / edit / deactivate actions live in the client view (useActionState forms). Gated to user:manage (admin role). |

#### `app/src/app/admin/users/users-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 1000 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | UsersManagerViewProps, UsersManagerView |
| Has TODO | N |
| Purpose | Exports: UsersManagerViewProps, UsersManagerView |

### Domain: `ai`

PRD: **P3 Intelligence (deterministic)**

#### `app/src/app/ai/ai-hub-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 485 |
| Runtime | client |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | AiHubView |
| Has TODO | N |
| Purpose | Exports: AiHubView |

#### `app/src/app/ai/credit-summary.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 315 |
| Runtime | client |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | AiCreditSummary |
| Has TODO | N |
| Purpose | Exports: AiCreditSummary |

#### `app/src/app/ai/loading.tsx`

| Field | Value |
|---|---|
| Role | `loading-ui` — Suspense loading skeleton for route |
| LOC | 35 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Suspense loading skeleton for route |

#### `app/src/app/ai/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 45 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

### Domain: `api`

PRD: **Cross-cutting / Supporting**

#### `app/src/app/api/auth/[...nextauth]/route.ts`

| Field | Value |
|---|---|
| Role | `api-route` — Route Handler (HTTP API) |
| LOC | 10 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | runtime |
| Has TODO | N |
| Purpose | Auth.js v5 route handler - App Router convention. `handlers` is exported by NextAuth() in @/lib/auth. The catch-all `[...nextauth]` segment serves all Auth.js endpoints (/api/auth/signin, /callback, /session, /signout, …). Route Handlers are dynamic by default (they touch cookies/headers), so no `force-dynamic` is needed and `next build` won't prerender this route. |

### Domain: `compliance`

PRD: **M7 KYC/AML/Consent**

#### `app/src/app/compliance/audit/audit-list-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 3298 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | AuditListViewProps, AuditListView |
| Has TODO | N |
| Purpose | Exports: AuditListViewProps, AuditListView |

#### `app/src/app/compliance/audit/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 95 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/compliance/consent/consent-action-forms.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 603 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (4) | CaptureConsentDialog, WithdrawConsentButton, CreateDsrDialog, TransitionDsrControls |
| Has TODO | N |
| Purpose | Exports: CaptureConsentDialog, WithdrawConsentButton, CreateDsrDialog, TransitionDsrControls |

#### `app/src/app/compliance/consent/consent-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 833 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | ConsentViewProps, ConsentView |
| Has TODO | N |
| Purpose | Exports: ConsentViewProps, ConsentView |

#### `app/src/app/compliance/consent/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 112 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/compliance/kyc/[id]/kyc-action-forms.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 477 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | KycActionsProps, KycActions |
| Has TODO | N |
| Purpose | Exports: KycActionsProps, KycActions |

#### `app/src/app/compliance/kyc/[id]/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 836 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/compliance/kyc/[id]/status-timeline.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 246 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | TimelineEntry, StatusTimeline |
| Has TODO | N |
| Purpose | Exports: TimelineEntry, StatusTimeline |

#### `app/src/app/compliance/kyc/kyc-board-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 879 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | KycBoardViewProps, KycBoardView |
| Has TODO | N |
| Purpose | Exports: KycBoardViewProps, KycBoardView |

#### `app/src/app/compliance/kyc/loading.tsx`

| Field | Value |
|---|---|
| Role | `loading-ui` — Suspense loading skeleton for route |
| LOC | 56 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Suspense loading skeleton for route |

#### `app/src/app/compliance/kyc/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 58 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

### Domain: `credit`

PRD: **M3 Credit Analysis**

#### `app/src/app/credit/[id]/add-fs-form.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 273 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | AddFinancialStatementForm |
| Has TODO | N |
| Purpose | Exports: AddFinancialStatementForm |

#### `app/src/app/credit/[id]/committee-form.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 157 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | CommitteeForm |
| Has TODO | N |
| Purpose | Exports: CommitteeForm |

#### `app/src/app/credit/[id]/credit-summary-header.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 287 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | CreditSummaryHeader |
| Has TODO | N |
| Purpose | Exports: CreditSummaryHeader |

#### `app/src/app/credit/[id]/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 1168 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/credit/[id]/run-score-button.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 67 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | RunScoreButton |
| Has TODO | N |
| Purpose | Exports: RunScoreButton |

#### `app/src/app/credit/[id]/workspace/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 1568 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/credit/[id]/workspace/source-data-panel.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 149 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | SourceDataPanelProps, SourceDataPanel |
| Has TODO | N |
| Purpose | Exports: SourceDataPanelProps, SourceDataPanel |

#### `app/src/app/credit/[id]/workspace/sparkline.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 186 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (3) | SparklineTone, SparklineProps, Sparkline |
| Has TODO | N |
| Purpose | Exports: SparklineTone, SparklineProps, Sparkline |

#### `app/src/app/credit/credit-icons.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 53 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (13) | ArrowRightIcon, ArrowLeftIcon, WarningIcon, ChartLineUpIcon, ScalesIcon, CoinsIcon, ShieldStarIcon, SparkleIcon |
| Has TODO | N |
| Purpose | Exports: ArrowRightIcon, ArrowLeftIcon, WarningIcon, ChartLineUpIcon, ScalesIcon, CoinsIcon, ShieldStarIcon, SparkleIcon, TrendUpIcon, PlusIcon, CheckCircleIcon, MinusIcon… |

#### `app/src/app/credit/credit-list-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 460 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | CreditListViewProps, CreditListView |
| Has TODO | N |
| Purpose | Exports: CreditListViewProps, CreditListView |

#### `app/src/app/credit/new/new-credit-analysis-form.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 297 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | NewCreditAnalysisForm |
| Has TODO | N |
| Purpose | Exports: NewCreditAnalysisForm |

#### `app/src/app/credit/new/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 42 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/credit/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 54 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

### Domain: `dashboard-exposure-chart.tsx`

PRD: **Cross-cutting / Supporting**

#### `app/src/app/dashboard-exposure-chart.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 303 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (5) | ExposurePoint, HeroExposureChart, StageDatum, StageStrip, MiniBars |
| Has TODO | N |
| Purpose | Exports: ExposurePoint, HeroExposureChart, StageDatum, StageStrip, MiniBars |

### Domain: `deals`

PRD: **M2 Mandate Pipeline**

#### `app/src/app/deals/[id]/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 610 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/deals/deal-type-credit.ts`

| Field | Value |
|---|---|
| Role | `app-support` — App-level support file |
| LOC | 42 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | CreditBand, creditBand |
| Has TODO | N |
| Purpose | Server-safe home for `creditBand` - the view-derived credit-character "rating chip" for a deal. This is a PURE function (no React, no Phosphor, no hooks) so it is safe to call from Server Components. It was previously co-located in `deal-type-icon.tsx`, which is `"use client"` (it imports Phosphor + IconTile), so calling it from the /deals/[id] Server Component threw "Attempted to call creditBand( |

#### `app/src/app/deals/deal-type-icon.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 264 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (6) | dealTypeConcept, DealTypeGlyphProps, DealTypeGlyph, partyRoleConcept, PartyRoleGlyphProps, PartyRoleGlyph |
| Has TODO | N |
| Purpose | Exports: dealTypeConcept, DealTypeGlyphProps, DealTypeGlyph, partyRoleConcept, PartyRoleGlyphProps, PartyRoleGlyph |

#### `app/src/app/deals/deals-board-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 2266 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | DealsBoardViewProps, DealsBoardView |
| Has TODO | N |
| Purpose | Exports: DealsBoardViewProps, DealsBoardView |

#### `app/src/app/deals/loading.tsx`

| Field | Value |
|---|---|
| Role | `loading-ui` — Suspense loading skeleton for route |
| LOC | 35 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Suspense loading skeleton for route |

#### `app/src/app/deals/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 81 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

### Domain: `documents`

PRD: **M9 Documents**

#### `app/src/app/documents/[id]/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 297 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/documents/documents-list-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 490 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | DocumentsListViewProps, DocumentsListView |
| Has TODO | N |
| Purpose | Exports: DocumentsListViewProps, DocumentsListView |

#### `app/src/app/documents/new-document-dialog.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 450 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | NewDocumentDialog |
| Has TODO | N |
| Purpose | Exports: NewDocumentDialog |

#### `app/src/app/documents/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 86 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | dynamic, TYPE_FILTERS |
| Has TODO | N |
| Purpose | Exports: dynamic, TYPE_FILTERS |

### Domain: `error.tsx`

PRD: **Cross-cutting / Supporting**

#### `app/src/app/error.tsx`

| Field | Value |
|---|---|
| Role | `error-boundary` — Error / not-found UI |
| LOC | 65 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Error / not-found UI |

### Domain: `global-error.tsx`

PRD: **Cross-cutting / Supporting**

#### `app/src/app/global-error.tsx`

| Field | Value |
|---|---|
| Role | `error-boundary` — Error / not-found UI |
| LOC | 75 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Error / not-found UI |

### Domain: `globals.css`

PRD: **Cross-cutting / Supporting**

#### `app/src/app/globals.css`

| Field | Value |
|---|---|
| Role | `app-support` — App-level support file |
| LOC | 455 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | App-level support file |

### Domain: `integrations`

PRD: **P3/P4 Integrations**

#### `app/src/app/integrations/adapter-card.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 934 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (3) | AdapterRunState, AdapterCardProps, AdapterCard |
| Has TODO | N |
| Purpose | Exports: AdapterRunState, AdapterCardProps, AdapterCard |

#### `app/src/app/integrations/adapter-meta.ts`

| Field | Value |
|---|---|
| Role | `app-support` — App-level support file |
| LOC | 188 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (11) | IntegrationCategory, CATEGORY_ORDER, CATEGORY_LABEL, CATEGORY_BLURB, DataFlow, DATA_FLOW, AdapterHealth, ADAPTER_HEALTH |
| Has TODO | N |
| Purpose | View-layer metadata for the /integrations CONNECTION CARDS.  This module is DISPLAY-ONLY derivation. DATA_FLOW + ADAPTER_HEALTH + the category labels are read off each adapter's own access-requirement / cost-risk text (in @/features/integrations/*) and surfaced as the control-panel's "what data flows" + "how ready is Binary to actually connect" gauges. They do NOT touch the data registry, the Serv |

#### `app/src/app/integrations/integrations-explorer.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 422 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | IntegrationsExplorerProps, IntegrationsExplorer |
| Has TODO | N |
| Purpose | Exports: IntegrationsExplorerProps, IntegrationsExplorer |

#### `app/src/app/integrations/integrations-icons.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 136 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (31) | BankIcon, IdentificationCardIcon, CertificateIcon, BarcodeIcon, BuildingsIcon, MedalIcon, ShieldStarIcon, EnvelopeIcon |
| Has TODO | N |
| Purpose | Exports: BankIcon, IdentificationCardIcon, CertificateIcon, BarcodeIcon, BuildingsIcon, MedalIcon, ShieldStarIcon, EnvelopeIcon, WhatsappLogoIcon, ChartLineIcon, CurrencyInrIcon, VaultIcon… |

#### `app/src/app/integrations/live-stat-tile.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 168 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | LiveStatTileProps, LiveStatTile |
| Has TODO | N |
| Purpose | Exports: LiveStatTileProps, LiveStatTile |

#### `app/src/app/integrations/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 88 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Integrations registry - the India regulatory & financial-data adapter catalog, reimagined as a CONNECTION control panel.  Server component, force-dynamic (the registry is in-process but we keep dynamic rendering explicit so the build never tries to prerender the status page), gated on the authenticated user.  VIEW-ONLY conceptual redesign: data wiring (listIntegrations from @/features/integrations |

### Domain: `interactions`

PRD: **M1 Relationship 360**

#### `app/src/app/interactions/[id]/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 350 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/interactions/interactions-list-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 462 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | InteractionsListViewProps, InteractionsListView |
| Has TODO | N |
| Purpose | Exports: InteractionsListViewProps, InteractionsListView |

#### `app/src/app/interactions/new-interaction-dialog.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 488 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | NewInteractionDialog |
| Has TODO | N |
| Purpose | Exports: NewInteractionDialog |

#### `app/src/app/interactions/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 57 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

### Domain: `layout.tsx`

PRD: **Cross-cutting / Supporting**

#### `app/src/app/layout.tsx`

| Field | Value |
|---|---|
| Role | `layout` — Shared layout wrapper for route segment |
| LOC | 199 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | metadata, viewport |
| Has TODO | N |
| Purpose | Exports: metadata, viewport |

### Domain: `leads`

PRD: **M2 Pipeline (pre-mandate)**

#### `app/src/app/leads/[id]/bant-checklist.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 296 |
| Runtime | client |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | BantChecklist |
| Has TODO | N |
| Purpose | Exports: BantChecklist |

#### `app/src/app/leads/[id]/lead-workflow-actions.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 416 |
| Runtime | client |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | medium |
| Exports (6) | ConvertToOpportunity, WinLeadButton, LoseLeadButton, DeleteLeadButton, AddNoteForm, LossReasonBadge |
| Has TODO | N |
| Purpose | Exports: ConvertToOpportunity, WinLeadButton, LoseLeadButton, DeleteLeadButton, AddNoteForm, LossReasonBadge |

#### `app/src/app/leads/[id]/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 820 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/leads/leads-board-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 897 |
| Runtime | client |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | LeadsBoardViewProps, LeadsBoardView |
| Has TODO | N |
| Purpose | Exports: LeadsBoardViewProps, LeadsBoardView |

#### `app/src/app/leads/new/new-lead-form.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 565 |
| Runtime | server |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | NewLeadForm |
| Has TODO | N |
| Purpose | Exports: NewLeadForm |

#### `app/src/app/leads/new/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 55 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | dynamic, metadata |
| Has TODO | N |
| Purpose | Exports: dynamic, metadata |

#### `app/src/app/leads/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 47 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | dynamic, metadata |
| Has TODO | N |
| Purpose | Exports: dynamic, metadata |

### Domain: `loading.tsx`

PRD: **Cross-cutting / Supporting**

#### `app/src/app/loading.tsx`

| Field | Value |
|---|---|
| Role | `loading-ui` — Suspense loading skeleton for route |
| LOC | 23 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Suspense loading skeleton for route |

### Domain: `login`

PRD: **Cross-cutting / Supporting**

#### `app/src/app/login/actions.ts`

| Field | Value |
|---|---|
| Role | `app-support` — App-level support file |
| LOC | 58 |
| Runtime | server |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | LoginState, login |
| Has TODO | N |
| Purpose | Exports: LoginState, login |

#### `app/src/app/login/login-form.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 127 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | LoginForm |
| Has TODO | N |
| Purpose | Exports: LoginForm |

#### `app/src/app/login/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 182 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | metadata, dynamic |
| Has TODO | N |
| Purpose | Login — the one public surface the proxy lets through unauthenticated. "Atelier" editorial split: a large Fraunces statement on a calm paper field, a quiet gold rule, and a clean hairline auth card. Server component: reads `callbackUrl` from the search params (set by the proxy when it bounces an unauthenticated request) and hands it to the client LoginForm, which posts it back through the `login`  |

### Domain: `matching`

PRD: **M5 Investor Match**

#### `app/src/app/matching/[id]/match-matrix-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 1005 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | MatchMatrixView |
| Has TODO | N |
| Purpose | Exports: MatchMatrixView |

#### `app/src/app/matching/[id]/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 47 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/matching/matching-workspace.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 669 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | MatchingWorkspaceProps, MatchingWorkspace |
| Has TODO | N |
| Purpose | Exports: MatchingWorkspaceProps, MatchingWorkspace |

#### `app/src/app/matching/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 62 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

### Domain: `modeling`

PRD: **M4 Financial Modeling**

#### `app/src/app/modeling/[id]/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 809 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/modeling/bond-calculator/bond-calculator-lazy.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 57 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | BondCalculator |
| Has TODO | N |
| Purpose | Exports: BondCalculator |

#### `app/src/app/modeling/bond-calculator/bond-calculator.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 1332 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | BondCalculator |
| Has TODO | N |
| Purpose | Exports: BondCalculator |

#### `app/src/app/modeling/bond-calculator/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 68 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/modeling/lbo-calculator/lbo-calculator-lazy.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 43 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | LboCalculator |
| Has TODO | N |
| Purpose | Exports: LboCalculator |

#### `app/src/app/modeling/lbo-calculator/lbo-calculator.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 868 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | LboCalculator |
| Has TODO | N |
| Purpose | Exports: LboCalculator |

#### `app/src/app/modeling/lbo-calculator/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 59 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/modeling/ma-calculator/ma-calculator-lazy.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 43 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | MaCalculator |
| Has TODO | N |
| Purpose | Exports: MaCalculator |

#### `app/src/app/modeling/ma-calculator/ma-calculator.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 978 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | MaCalculator |
| Has TODO | N |
| Purpose | Exports: MaCalculator |

#### `app/src/app/modeling/ma-calculator/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 63 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/modeling/model-library.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 304 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | ModelLibraryRow, ModelLibrary |
| Has TODO | N |
| Purpose | Exports: ModelLibraryRow, ModelLibrary |

#### `app/src/app/modeling/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 26 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/modeling/scenario/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 59 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/modeling/scenario/scenario-lazy.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 43 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | ScenarioDesk |
| Has TODO | N |
| Purpose | Exports: ScenarioDesk |

#### `app/src/app/modeling/scenario/scenario.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 563 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | ScenarioDesk |
| Has TODO | N |
| Purpose | Exports: ScenarioDesk |

### Domain: `not-found.tsx`

PRD: **Cross-cutting / Supporting**

#### `app/src/app/not-found.tsx`

| Field | Value |
|---|---|
| Role | `error-boundary` — Error / not-found UI |
| LOC | 39 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Error / not-found UI |

### Domain: `notifications`

PRD: **Cross-cutting / Supporting**

#### `app/src/app/notifications/notifications-center.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 656 |
| Runtime | client |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | NotificationsCenterProps, NotificationsCenter |
| Has TODO | N |
| Purpose | Exports: NotificationsCenterProps, NotificationsCenter |

#### `app/src/app/notifications/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 54 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | dynamic, metadata |
| Has TODO | N |
| Purpose | Exports: dynamic, metadata |

### Domain: `onboarding`

PRD: **M1/M7 Onboarding**

#### `app/src/app/onboarding/[id]/onboarding-detail-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 1328 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | OnboardingDetailViewProps, OnboardingDetailView |
| Has TODO | N |
| Purpose | Exports: OnboardingDetailViewProps, OnboardingDetailView |

#### `app/src/app/onboarding/[id]/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 187 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/onboarding/new/onboarding-wizard.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 772 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | OnboardingWizardProps, OnboardingWizard |
| Has TODO | N |
| Purpose | Exports: OnboardingWizardProps, OnboardingWizard |

#### `app/src/app/onboarding/new/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 25 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/onboarding/onboarding-board-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 881 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | OnboardingBoardViewProps, OnboardingBoardView |
| Has TODO | N |
| Purpose | Exports: OnboardingBoardViewProps, OnboardingBoardView |

#### `app/src/app/onboarding/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 36 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

### Domain: `page.tsx`

PRD: **Cross-cutting / Supporting**

#### `app/src/app/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 708 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

### Domain: `parties`

PRD: **M1 Relationship 360**

#### `app/src/app/parties/[id]/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 894 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/parties/loading.tsx`

| Field | Value |
|---|---|
| Role | `loading-ui` — Suspense loading skeleton for route |
| LOC | 70 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Suspense loading skeleton for route |

#### `app/src/app/parties/new-party-dialog.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 336 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | NewPartyDialog |
| Has TODO | N |
| Purpose | Exports: NewPartyDialog |

#### `app/src/app/parties/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 106 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/parties/parties-list-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 1214 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | PartiesExplorerProps, PartiesExplorer |
| Has TODO | N |
| Purpose | Exports: PartiesExplorerProps, PartiesExplorer |

#### `app/src/app/parties/party-icon.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 145 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (3) | partyConcept, PartyAvatarProps, PartyAvatar |
| Has TODO | N |
| Purpose | Exports: partyConcept, PartyAvatarProps, PartyAvatar |

#### `app/src/app/parties/party-signals.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 139 |
| Runtime | client |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | medium |
| Exports (7) | StrengthBand, Strength, BAND_LABEL, PartySignalInput, deriveStrength, formatRelative, StrengthBar |
| Has TODO | N |
| Purpose | Party signals - the shared, server-component-safe derivations used by both the Relationship Explorer (client) and the party detail page (server). `deriveStrength` + `formatRelative` are pure functions; `StrengthBar` is a presentational component with no hooks. No `"use client"` so the module can be imported into a server component without dragging a client boundary into the server bundle, and into |

#### `app/src/app/parties/relationship-graph.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 333 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | RelationshipGraphProps, RelationshipGraph |
| Has TODO | N |
| Purpose | Exports: RelationshipGraphProps, RelationshipGraph |

### Domain: `portal`

PRD: **P3 Retail/Investor portal**

#### `app/src/app/portal/client/[id]/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 712 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/portal/client/client-directory-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 323 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | ClientDirectoryViewProps, ClientDirectoryView |
| Has TODO | N |
| Purpose | Exports: ClientDirectoryViewProps, ClientDirectoryView |

#### `app/src/app/portal/client/loading.tsx`

| Field | Value |
|---|---|
| Role | `loading-ui` — Suspense loading skeleton for route |
| LOC | 43 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Suspense loading skeleton for route |

#### `app/src/app/portal/client/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 45 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/portal/investor/[id]/investor-charts.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 143 |
| Runtime | client |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | InvestorComposition, InvestorTopIssuers |
| Has TODO | N |
| Purpose | Exports: InvestorComposition, InvestorTopIssuers |

#### `app/src/app/portal/investor/[id]/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 701 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/portal/investor/investor-directory-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 313 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | InvestorDirectoryViewProps, InvestorDirectoryView |
| Has TODO | N |
| Purpose | Exports: InvestorDirectoryViewProps, InvestorDirectoryView |

#### `app/src/app/portal/investor/loading.tsx`

| Field | Value |
|---|---|
| Role | `loading-ui` — Suspense loading skeleton for route |
| LOC | 43 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Suspense loading skeleton for route |

#### `app/src/app/portal/investor/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 45 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

### Domain: `portfolio`

PRD: **M6/Portfolio (secondary+limits)**

#### `app/src/app/portfolio/_components/concentration-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 378 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | ConcentrationViewProps, ConcentrationView |
| Has TODO | N |
| Purpose | Exports: ConcentrationViewProps, ConcentrationView |

#### `app/src/app/portfolio/_components/edit-limit-dialog.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 321 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | EditLimitDialog |
| Has TODO | N |
| Purpose | Exports: EditLimitDialog |

#### `app/src/app/portfolio/_components/limits-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 482 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | LimitsViewProps, LimitsView |
| Has TODO | N |
| Purpose | Exports: LimitsViewProps, LimitsView |

#### `app/src/app/portfolio/_components/overview-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 582 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | OverviewViewProps, OverviewView |
| Has TODO | N |
| Purpose | Exports: OverviewViewProps, OverviewView |

#### `app/src/app/portfolio/_components/portfolio-charts-impl.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 543 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (12) | DonutPoint, LabelValuePoint, StackedPoint, GaugePoint, SECTOR_PALETTE, EXPOSURE_TYPE_COLORS, EXPOSURE_TYPE_LABELS, DonutChart |
| Has TODO | N |
| Purpose | Exports: DonutPoint, LabelValuePoint, StackedPoint, GaugePoint, SECTOR_PALETTE, EXPOSURE_TYPE_COLORS, EXPOSURE_TYPE_LABELS, DonutChart, HBarChart, StackedBarChart, VBarChart, RadialGauge |

#### `app/src/app/portfolio/_components/portfolio-charts.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 75 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (5) | DonutChart, HBarChart, StackedBarChart, VBarChart, RadialGauge |
| Has TODO | N |
| Purpose | Exports: DonutChart, HBarChart, StackedBarChart, VBarChart, RadialGauge |

#### `app/src/app/portfolio/_components/portfolio-sub-nav.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 94 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | PortfolioSubNav |
| Has TODO | N |
| Purpose | Exports: PortfolioSubNav |

#### `app/src/app/portfolio/_components/risk-metrics-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 264 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | RiskMetricsViewProps, RiskMetricsView |
| Has TODO | N |
| Purpose | Exports: RiskMetricsViewProps, RiskMetricsView |

#### `app/src/app/portfolio/concentration/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 71 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/portfolio/layout.tsx`

| Field | Value |
|---|---|
| Role | `layout` — Shared layout wrapper for route segment |
| LOC | 43 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/portfolio/limits/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 83 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/portfolio/loading.tsx`

| Field | Value |
|---|---|
| Role | `loading-ui` — Suspense loading skeleton for route |
| LOC | 9 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Suspense loading skeleton for route |

#### `app/src/app/portfolio/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 99 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/portfolio/risk-metrics/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 28 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

### Domain: `reports`

PRD: **M10 Dashboard & Reporting**

#### `app/src/app/reports/_components/credit-report-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 520 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | CreditReportViewProps, CreditReportView |
| Has TODO | N |
| Purpose | Exports: CreditReportViewProps, CreditReportView |

#### `app/src/app/reports/_components/report-charts-impl.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 401 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (7) | LabelCountPoint, LabelValuePoint, ConsentStackPoint, CountBarChart, HorizontalBarChart, AreaTrendChart, StackedBarChart |
| Has TODO | N |
| Purpose | Exports: LabelCountPoint, LabelValuePoint, ConsentStackPoint, CountBarChart, HorizontalBarChart, AreaTrendChart, StackedBarChart |

#### `app/src/app/reports/_components/report-charts.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 63 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (4) | CountBarChart, HorizontalBarChart, AreaTrendChart, StackedBarChart |
| Has TODO | N |
| Purpose | Exports: CountBarChart, HorizontalBarChart, AreaTrendChart, StackedBarChart |

#### `app/src/app/reports/_components/reports-hub-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 191 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | ReportsHubView |
| Has TODO | N |
| Purpose | Exports: ReportsHubView |

#### `app/src/app/reports/compliance/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 319 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/reports/credit/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 125 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/reports/export/route.ts`

| Field | Value |
|---|---|
| Role | `api-route` — Route Handler (HTTP API) |
| LOC | 391 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (3) | dynamic, ExportKind, GET |
| Has TODO | N |
| Purpose | Reports & Export - CSV export Route Handler.  GET /reports/export?type=<kind>[&<filter params...>] runs the matching query (reusing the feature `list*` queries for per-module exports so the CSV always matches the on-screen filtered list) and returns an RFC 4180 CSV attachment. The browser handles the download natively via the `Content-Disposition: attachment` header - no client-side blob code, no  |

#### `app/src/app/reports/loading.tsx`

| Field | Value |
|---|---|
| Role | `loading-ui` — Suspense loading skeleton for route |
| LOC | 8 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Suspense loading skeleton for route |

#### `app/src/app/reports/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 31 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/reports/pipeline/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 284 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/reports/revenue/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 277 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

### Domain: `tasks`

PRD: **M11 Notifications & Tasks**

#### `app/src/app/tasks/[id]/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 435 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |

#### `app/src/app/tasks/[id]/task-status-form.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 81 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | TaskStatusForm |
| Has TODO | N |
| Purpose | Exports: TaskStatusForm |

#### `app/src/app/tasks/new-task-dialog.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 376 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | NewTaskDialog |
| Has TODO | N |
| Purpose | Exports: NewTaskDialog |

#### `app/src/app/tasks/page.tsx`

| Field | Value |
|---|---|
| Role | `route-page` — Next.js App Router page (RSC by default unless client) |
| LOC | 85 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | high |
| Exports (2) | dynamic, STATUS_FILTERS |
| Has TODO | N |
| Purpose | Exports: dynamic, STATUS_FILTERS |

#### `app/src/app/tasks/tasks-list-view.tsx`

| Field | Value |
|---|---|
| Role | `page-component` — Route-local React component |
| LOC | 538 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | TasksListViewProps, TasksListView |
| Has TODO | N |
| Purpose | Exports: TasksListViewProps, TasksListView |
