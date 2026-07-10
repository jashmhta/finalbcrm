# Binary CRM — Exhaustive File-by-File Structural Analysis

Coverage: 380 files, ~116299 LOC.

Auto-extracted symbols, imports, DB ops, security signals, domain terms. Subagent narrative reports merge in separately.


# Batch 001

## `drizzle.config.ts`

- **Lines:** 12 | **Bytes:** 255
- **Kind:** Application module
- **Default export:** yes
- **External deps:** drizzle-kit

## `drizzle/0000_minor_kitty_pryde.sql`

- **Lines:** 995 | **Bytes:** 75318
- **Kind:** SQL migration
- **Security signals:** rbac/rls, credentials, india-compliance
- **Domain terms:** allocation, binarybonds, binarycapital, credit_analysis, deal_status, gsec, investor, issuer, onboarding, party, scorecard
- **CREATE TABLE:** app_user, permission, role, role_permission, user_role, information_barrier, address, party, party_identifier, party_type_assignment, contact, party_contact, relationship, demat_account, allocation_event, deal, deal_party, instrument, trade_event, credit_analysis, credit_analysis_fs_link, credit_limit, credit_score, exposure, external_rating, financial_statement, kyc_beneficial_owner, kyc_record, rating_ladder, ratio_result, scorecard, scorecard_template, sector_code, financial_model, consent_record, data_subject_request, interaction, interaction_attendee, task, task_dependency, document, audit_log
- **ALTER TABLE:** address, allocation_event, app_user, audit_log, consent_record, contact, credit_analysis, credit_analysis_fs_link, credit_limit, credit_score, data_subject_request, deal, deal_party, demat_account, document, exposure, external_rating, financial_model, financial_statement, information_barrier, instrument, interaction, interaction_attendee, kyc_beneficial_owner, kyc_record, party, party_contact, party_identifier, party_type_assignment, ratio_result, relationship, role_permission, scorecard, scorecard_template, sector_code, task, task_dependency, trade_event, user_role

## `drizzle/0001_easy_scarlet_spider.sql`

- **Lines:** 64 | **Bytes:** 2686
- **Kind:** SQL migration
- **Security signals:** rbac/rls
- **CREATE TABLE:** accounts, authenticators, sessions, users, verification_tokens
- **ALTER TABLE:** accounts, app_user, authenticators, information_barrier, sector_code, sessions

## `drizzle/0002_auth.sql`

- **Lines:** 22 | **Bytes:** 1166
- **Kind:** SQL migration
- **Security signals:** credentials
- **ALTER TABLE:** app_user


# Batch 002

## `drizzle/0003_rls.sql`

- **Lines:** 382 | **Bytes:** 16435
- **Kind:** SQL migration
- **Security signals:** rbac/rls, india-compliance
- **Domain terms:** barrier, credit_analysis, party
- **ALTER TABLE:** allocation_event, audit_log, consent_record, credit_analysis, credit_limit, deal, deal_party, document, exposure, external_rating, financial_model, interaction, interaction_attendee, kyc_record, party, trade_event
- **CREATE POLICY:** IF, party_rls, deal_rls, deal_party_rls, interaction_rls, interaction_attendee_rls, document_rls, credit_analysis_rls, financial_model_rls, allocation_event_rls, trade_event_rls, kyc_record_rls, consent_record_rls, external_rating_rls, exposure_rls, credit_limit_rls, audit_log_insert_rls
- **RLS mentions:** 35

## `drizzle/0004_rls_fix.sql`

- **Lines:** 111 | **Bytes:** 5784
- **Kind:** SQL migration
- **Security signals:** rbac/rls, india-compliance
- **Domain terms:** barrier, credit_analysis, mandate, party
- **CREATE POLICY:** audit_log_select_rls, audit_log_select_rls

## `drizzle/0005_indexes.sql`

- **Lines:** 146 | **Bytes:** 8098
- **Kind:** SQL migration
- **Security signals:** rbac/rls, india-compliance
- **Domain terms:** KYC, credit_analysis, party

## `drizzle/0006_leads.sql`

- **Lines:** 62 | **Bytes:** 3576
- **Kind:** SQL migration
- **Security signals:** rbac/rls
- **Domain terms:** investor, issuer, mandate, party
- **ALTER TABLE:** party


# Batch 003

## `drizzle/0007_onboarding.sql`

- **Lines:** 80 | **Bytes:** 4952
- **Kind:** SQL migration
- **Security signals:** rbac/rls, india-compliance
- **Domain terms:** KYC, Onboarding, bond, investor, issuer, onboarding, party
- **ALTER TABLE:** party

## `drizzle/0008_users_app_user_id.sql`

- **Lines:** 60 | **Bytes:** 3102
- **Kind:** SQL migration
- **Security signals:** rbac/rls
- **Domain terms:** matching, onboarding
- **ALTER TABLE:** users

## `drizzle/0009_rls_guc_safe.sql`

- **Lines:** 87 | **Bytes:** 3493
- **Kind:** SQL migration
- **Security signals:** rbac/rls
- **Domain terms:** barrier

## `drizzle/0010_party_segmentation_rbac_filters.sql`

- **Lines:** 64 | **Bytes:** 2555
- **Kind:** SQL migration
- **Domain terms:** investor, party
- **ALTER TABLE:** party


# Batch 004

## `drizzle/0011_party_duplicate_candidates.sql`

- **Lines:** 34 | **Bytes:** 1499
- **Kind:** SQL migration
- **Domain terms:** party
- **CREATE TABLE:** party_duplicate_candidate

## `eslint.config.mjs`

- **Lines:** 36 | **Bytes:** 1147
- **Kind:** Application module
- **Default export:** yes
- **External deps:** eslint-config-next/core-web-vitals, eslint-config-next/typescript, eslint/config

## `login/actions.ts`

- **Lines:** 36 | **Bytes:** 1161
- **Kind:** Server Actions module
- **Directive:** `use server`
- **Exported functions:** login
- **Exported types:** LoginState
- **External deps:** next-auth, next/navigation
- **Internal imports (1):** @/lib/auth

## `login/login-form.tsx`

- **Lines:** 54 | **Bytes:** 1582
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** LoginForm
- **Security signals:** credentials
- **External deps:** react
- **Internal imports (4):** @/components/ui/button, @/components/ui/input, @/components/ui/label, ./actions
- **Domain terms:** binarycapital


# Batch 005

## `login/page.tsx`

- **Lines:** 26 | **Bytes:** 711
- **Kind:** Next.js page route
- **Exported const:** metadata
- **Default export:** yes
- **External deps:** next
- **Internal imports (2):** @/components/ui/card, ./login-form

## `next.config.ts`

- **Lines:** 28 | **Bytes:** 1244
- **Kind:** Application module
- **Default export:** yes
- **External deps:** next

## `package.json`

- **Lines:** 56 | **Bytes:** 1472
- **Kind:** Application module
- **Security signals:** credentials

## `page.tsx`

- **Lines:** 87 | **Bytes:** 2896
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **DB ops patterns:** from, select, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm, next/link
- **Internal imports (4):** @/lib/rbac, @/db, @/db/schema, @/components/ui/card
- **Domain terms:** barrier, party


# Batch 006

## `postcss.config.mjs`

- **Lines:** 7 | **Bytes:** 94
- **Kind:** Application module
- **Default export:** yes

## `scripts/_audit-set2.mjs`

- **Lines:** 103 | **Bytes:** 4297
- **Kind:** Ops/verification script
- **Security signals:** india-compliance
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** KYC, binarycapital, kyc

## `scripts/diag-css-links.mjs`

- **Lines:** 68 | **Bytes:** 3490
- **Kind:** Ops/verification script
- **Header intent:** Print the exact stylesheet <link> hrefs on /deals (authed, mobile) and their load status + the HTTP status when fetched directly. Then compare the same on /parties. Determines whether the "second CSS never loads" is a real broken/404 chunk or a puppeteer load race.
- **DB ops patterns:** from
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital

## `scripts/diag-css-timing.mjs`

- **Lines:** 86 | **Bytes:** 4445
- **Kind:** Ops/verification script
- **Header intent:** Confirm whether the Tailwind stylesheet applies after enough wait time on /deals (the overflowing page). Polls nav.display + navLinksWrap.display + scrollWidth at 500/1500/3000/5000ms, and also waits for networkidle2 + the first <link rel=stylesheet> to load. If display flips to flex and scrollWidth drops to 390, the overflow was a pre-CSS measurement artifact.
- **DB ops patterns:** from
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital


# Batch 007

## `scripts/diag-nav.mjs`

- **Lines:** 96 | **Bytes:** 5141
- **Kind:** Ops/verification script
- **Header intent:** Focused diagnostic: on one overflowing page (/deals) and one clean page (/parties), report the desktop nav container's computed display, a sample desktop nav link's computed display + rect, and the single widest element (max right edge) with its ancestor chain. Tells us WHY scrollWidth=638 on deals but 390 on parties despite the same SiteNav component.
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital

## `scripts/diag-theme-logo.mjs`

- **Lines:** 60 | **Bytes:** 3038
- **Kind:** Ops/verification script
- **Header intent:** Directly verify the theme toggle flips html.dark and the nav logo <img> renders on an authed page — with a post-click wait (next-themes updates the class via an effect, so the verifier's instant check can false-negative).
- **DB ops patterns:** from
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital

## `scripts/mobile-overflow-all.mjs`

- **Lines:** 131 | **Bytes:** 7532
- **Kind:** Ops/verification script
- **Header intent:** All-routes mobile overflow audit: every user-facing route at 390px, confirm 200 + no document-level horizontal overflow (scrollWidth <= viewport), and for any element whose right edge exceeds the viewport, report whether it is INSIDE an overflow-clipped (overflow-x:auto/hidden/scroll) ancestor — i.e. a contained scrollable region (fine) vs a true page overflow (bug).
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital, bond, kyc, party

## `scripts/mobile-pass.mjs`

- **Lines:** 223 | **Bytes:** 9989
- **Kind:** Ops/verification script
- **Header intent:** Mobile excellence pass: capture 390x844 screenshots for the required route set AND measure horizontal overflow (document.scrollWidth vs viewport) + flag elements wider than 390px. Logs in first via the form, driving the AUTH_URL host so the next-auth session cookie domain matches the proxy redirects (see scripts/screenshot.mjs for the rationale).
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital, bond, kyc


# Batch 008

## `scripts/screenshot.mjs`

- **Lines:** 209 | **Bytes:** 9889
- **Kind:** Ops/verification script
- **Security signals:** rbac/rls, india-compliance
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital, bond, credit_analysis, kyc, party, scorecard

## `scripts/verify-logo-theme.mjs`

- **Lines:** 101 | **Bytes:** 4963
- **Kind:** Ops/verification script
- **Header intent:** Focused check: (a) the real BC logo renders in the nav AND login (detect via the bundled static-media logo filename in the page HTML, regardless of the /_next/image wrapper), (b) the theme toggle actually flips html.dark after allowing React's re-render tick. Login uses the AUTH_URL host.
- **DB ops patterns:** from
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital

## `scripts/verify-routes.mjs`

- **Lines:** 194 | **Bytes:** 9201
- **Kind:** Ops/verification script
- **Header intent:** Step 5 verification: log in, extract the session cookie, then fetch every user-facing route (authed) and confirm 200 + real content (not redirected to /login, not a thin/empty/404). Also confirms the real BC logo renders in nav + login + favicon, and the theme toggle is present. Uses the AUTH_URL host so the session cookie domain matches (see scripts/screenshot.mjs for why).
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital, bond, kyc, party

## `scripts/verify.mjs`

- **Lines:** 134 | **Bytes:** 6313
- **Kind:** Ops/verification script
- **Header intent:** Verify the previously-broken screens render real data by logging in and dumping key text content from each page. More reliable than screenshots for confirming no NaN/undefined and real rows.
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** binarycapital, party


# Batch 009

## `src/__tests__/aiSummary.test.ts`

- **Lines:** 511 | **Bytes:** 18222
- **Kind:** Vitest unit test
- **Header intent:** AI engines - heuristic generator invariants. Source of truth: src/features/ai/{creditSummary,interactionSummary,clientInsights}.ts.  Pins the deterministic behaviour of the "no external LLM" generators: - creditSummary: recommendation posture by band, NBFC framing, trend line, strengths/concerns thresholds, rating line. - interactionSummary: topic extraction, action-item extraction, empty scope, per-note mini-summary. - clientInsights: score bounding + the recommended-action taxonomy.  Only the 
- **Security signals:** india-compliance
- **External deps:** vitest
- **Internal imports (3):** @/features/ai/creditSummary, @/features/ai/interactionSummary, @/features/ai/clientInsights
- **Domain terms:** Allocation, BC-1, BC-2, BC-4, BC-5, BC-6, KYC, allocation, bond, investor, mandate, onboarding

## `src/__tests__/bondPricing.test.ts`

- **Lines:** 480 | **Bytes:** 17020
- **Kind:** Vitest unit test
- **Header intent:** Bond pricing engine - canonical-case verification. Source of truth for expected behaviour: src/features/modeling/bondPricing.ts and docs/FINANCIAL_MODELING_SPEC.md §1.  These tests pin the financially-meaningful invariants, not floating-point exactness: a par bond prices cleanly at 100 with YTM == coupon, a discount bond prices below par, Macaulay duration is bounded by (0, maturity), convexity is strictly positive, and accrued interest follows the strict ACT/365 form (Face × c × days/DaysInYear
- **External deps:** vitest
- **Internal imports (1):** @/features/modeling/bondPricing
- **Domain terms:** Bond, GSEC, bond, gsec

## `src/__tests__/kyc.test.ts`

- **Lines:** 428 | **Bytes:** 15653
- **Kind:** Vitest unit test
- **Header intent:** KYC lifecycle helpers - exhaustive verification (PMLA 2002 + RBI Master Direction on KYC).  Source of truth: src/features/compliance/kyc.ts and the COMPLIANCE_LEGAL_FEASIBILITY.md §5 research.  Coverage: - Beneficial-ownership thresholds: company/SPV >10%, partnership >15%, trust >15%, natural_person / government / regulator → role-based (null). - requiresEddForBo: EDD triggers at >= threshold; null/missing inputs are safe (no false positives); partnership legal-form override. - Periodic re-KYC 
- **Security signals:** india-compliance
- **External deps:** vitest
- **Internal imports (1):** @/features/compliance/kyc
- **Domain terms:** KYC, kyc

## `src/__tests__/lboModel.test.ts`

- **Lines:** 192 | **Bytes:** 7209
- **Kind:** Vitest unit test
- **Header intent:** LBO engine - financial invariants verification. Source of truth: src/features/modeling/lboModel.ts. Pins the real-IB invariants: S&U balance, debt schedule amortizes to ≤ origin, sponsor IRR rises with exit multiple / falls with entry multiple, MOIC = exit / entry equity, sensitivity grid shape & monotonicity.
- **External deps:** vitest
- **Internal imports (1):** @/features/modeling/lboModel


# Batch 010

## `src/__tests__/maModel.test.ts`

- **Lines:** 200 | **Bytes:** 7055
- **Kind:** Vitest unit test
- **Header intent:** M&A engine - financial invariants verification. Source of truth: src/features/modeling/maModel.ts. Pins the real-IB invariants (S&U balance, goodwill = consideration − net assets, accretive iff combined EPS > standalone, deal IRR sign) rather than float exactness.
- **External deps:** vitest
- **Internal imports (1):** @/features/modeling/maModel

## `src/__tests__/matching.test.ts`

- **Lines:** 675 | **Bytes:** 25792
- **Kind:** Vitest unit test
- **Header intent:** Investor Matching Engine - exhaustive verification of the scoring + ranking business logic (Binary Capital CRM USP - scrape/BUSINESS_CONTEXT.md §3).  Source of truth: src/features/matching/engine.ts.  Coverage: - Weight distribution: the six SCORED criteria sum to 1.0; relationship is weight 0 (indicator only, not in the base score). - scoreInvestor: 0–100 weighted score, exact values for canonical perfect-fit / all-fail / partial-credit investors. - Per-criterion scorers (rating gate, tenor ban
- **Security signals:** india-compliance
- **External deps:** vitest
- **Internal imports (1):** @/features/matching/engine
- **Domain terms:** BC-1, BC-5, Bond, Investor, Issuer, KYC, Matching, binarycapital, demat, investor, issuer, kyc, mandate, matching

## `src/__tests__/ratingMap.test.ts`

- **Lines:** 324 | **Bytes:** 11828
- **Kind:** Vitest unit test
- **Header intent:** Rating-agency scale mapping - verifies the static (no-DB) mapping functions in src/features/credit/ratingMap.ts (CREDIT_ANALYSIS_SPEC §5).  We exercise only the pure mapping: coreSymbolToRank, symbolToBand, rankToBand, bandToCanonicalRank. These do not touch the database, so the test is hermetic. The DB-backed resolveBand/resolveRung loaders are covered by integration tracks, not here.
- **Security signals:** india-compliance
- **External deps:** vitest
- **Internal imports (1):** @/features/credit/ratingMap
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6

## `src/__tests__/ratios.test.ts`

- **Lines:** 442 | **Bytes:** 15015
- **Kind:** Vitest unit test
- **Header intent:** Ratio engine - verifies computeRatios on a known financial_statement set. Source: src/features/credit/ratios.ts (CREDIT_ANALYSIS_SPEC §3).  The line-item map below is hand-constructed so every ratio has a clean, checkable expected value. All assertions use closeTo with generous tolerance because the engine does plain float arithmetic.
- **External deps:** vitest
- **Internal imports (2):** @/features/credit/ratios, @/db/schema
- **Domain terms:** Bond, bond


# Batch 011

## `src/__tests__/rbacSegmentation.test.ts`

- **Lines:** 245 | **Bytes:** 10523
- **Kind:** Vitest unit test
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** vitest
- **Internal imports (4):** @/lib/rbac-core, @/features/reports/exportAccess, @/lib/org, @/features/parties/segmentation
- **Domain terms:** KYC, binarybonds, binarycapital, investor, kyc, matching, onboarding, party

## `src/__tests__/reports.test.ts`

- **Lines:** 251 | **Bytes:** 8250
- **Kind:** Vitest unit test
- **Header intent:** Reports & Export - pure-utility unit tests.  Covers the CSV builder (rowsToCsv: RFC 4180 escaping, BOM, CRLF), the filename + Content-Disposition helpers, and the crore formatters + rating- tier map. These are pure functions (no DB, no Next), so they run in the node environment alongside the other engine tests. The route handler's query correctness is verified separately against the seeded DB (see the build + SQL smoke checks); this suite locks the serialization layer.
- **External deps:** vitest
- **Internal imports (2):** @/features/reports/export, @/features/reports/queries
- **TODOs/FIXMEs:** Cr below 1,000 cr", () => {
- **Domain terms:** BC-1

## `src/__tests__/routeSmoke.test.ts`

- **Lines:** 53 | **Bytes:** 2038
- **Kind:** Vitest unit test
- **Header intent:** Route smoke test - opt-in HTTP check against a running Next server.  This is intentionally NOT a next/test render (which would pull in a DOM testing library the deps agent hasn't installed). Instead it fetches the real routes and asserts the HTTP shape: /login is public (200), and /parties is gated by the proxy/auth layer (redirects to /login or returns 401/403 - never 200 with a parties payload to an unauthenticated caller).  Set SMOKE_BASE_URL (e.g. http://localhost:3000) to enable. Without it
- **Security signals:** rbac/rls
- **External deps:** vitest
- **Domain terms:** party

## `src/__tests__/scenarioAnalysis.test.ts`

- **Lines:** 188 | **Bytes:** 7030
- **Kind:** Vitest unit test
- **Header intent:** Scenario analysis engine - invariants verification. Source of truth: src/features/modeling/scenarioAnalysis.ts. Pins: - the registry exposes all five model types with coherent drivers - best ≥ base ≥ worst on the primary metric (corner-case ordering) - driver direction classification matches financial intuition - sensitivity grid shape + monotonicity per model
- **External deps:** vitest
- **Internal imports (1):** @/features/modeling/scenarioAnalysis
- **Domain terms:** bond


# Batch 012

## `src/__tests__/scorecard.test.ts`

- **Lines:** 325 | **Bytes:** 11672
- **Kind:** Vitest unit test
- **Header intent:** Scorecard scoring - verifies computeScorecard invariants and band mapping. Source: src/features/credit/scorecard.ts (CREDIT_ANALYSIS_SPEC §4).  The scorecard is a weighted 0–100 composite over sub-factors (weights sum to 1.0). We assert: total score is bounded in [0, 100], the reported band is consistent with bandFromScore, an all-5 override yields exactly 100 / BC-1, and an all-1 override yields a low score / BC-6. We also confirm the DSCR weight is reallocated to zero for a corporate (non-proj
- **External deps:** vitest
- **Internal imports (3):** @/features/credit/scorecard, @/features/credit/ratios, @/db/schema
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6, Scorecard, scorecard

## `src/__tests__/stages.test.ts`

- **Lines:** 518 | **Bytes:** 21222
- **Kind:** Vitest unit test
- **Header intent:** Deal-stage flow - exhaustive verification of the per-deal-type pipeline ladder + transition validation.  Source of truth: src/features/deals/stages.ts + catalog.ts (and scrape/BUSINESS_CONTEXT.md §2-3 service processes).  Coverage: - Per-deal-type ladder presence + ordering for the canonical deal types: bond underwriting, M&A, G-Sec auction, ECM IPO, structured finance, project finance, DCM advisory, valuation, etc. - Off-pipeline statuses (dropped, on_hold) apply to every deal type. - canTransi
- **External deps:** vitest
- **Internal imports (3):** @/features/deals/stages, @/features/deals/catalog, @/db/schema
- **Domain terms:** allocation, binarybonds, binarycapital, bond, issuer, mandate, underwriting

## `src/app/_components/dashboard-charts-impl.tsx`

- **Lines:** 586 | **Bytes:** 19829
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** DealVelocityChart, SectorDonut, CreditScoreChart, KycStatusChart, InvestorTypeChart
- **Exported types:** DealVelocityPoint, SectorSlice, CreditBandSlice, KycStatusSlice, InvestorTypeSlice
- **Security signals:** india-compliance
- **External deps:** react, recharts
- **Internal imports (3):** @/components/brand/money, @/components/brand/text, @/components/brand/chart-theme
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6, Investor, KYC, investor, issuer, mandate

## `src/app/_components/dashboard-charts.tsx`

- **Lines:** 96 | **Bytes:** 4508
- **Kind:** Client component
- **Directive:** `use client`
- **Exported const:** DealVelocityChart, SectorDonut, CreditScoreChart, KycStatusChart, InvestorTypeChart
- **Security signals:** india-compliance
- **External deps:** next/dynamic, react
- **Internal imports (1):** ./dashboard-charts-impl
- **Domain terms:** KYC, investor


# Batch 013

## `src/app/_components/exposure-chart-impl.tsx`

- **Lines:** 374 | **Bytes:** 14287
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ExposureChart
- **Exported types:** ExposurePoint
- **Security signals:** india-compliance
- **External deps:** framer-motion, react, recharts
- **Internal imports (3):** @/components/brand/money, @/components/brand/text, @/components/brand/chart-theme

## `src/app/_components/exposure-chart.tsx`

- **Lines:** 86 | **Bytes:** 3739
- **Kind:** Client component
- **Directive:** `use client`
- **Exported const:** ExposureChart
- **Security signals:** india-compliance
- **External deps:** next/dynamic, react
- **Internal imports (1):** ./exposure-chart-impl

## `src/app/_components/kpi-hero.tsx`

- **Lines:** 377 | **Bytes:** 14512
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** KpiHero
- **Exported types:** KpiHeroProps
- **Security signals:** india-compliance
- **External deps:** framer-motion, next/link, react
- **Internal imports (4):** @/lib/utils, @/components/brand/button, @/components/brand/text, @/components/brand/icons
- **Domain terms:** Investor, Issuer, KYC, investor, issuer, kyc, matching, party

## `src/app/_components/kpi-stat.tsx`

- **Lines:** 142 | **Bytes:** 5284
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** KpiStat
- **Exported types:** KpiStatProps
- **Security signals:** india-compliance
- **External deps:** framer-motion, react
- **Internal imports (3):** @/lib/utils, @/components/brand/card, @/components/brand/text


# Batch 014

## `src/app/_components/recent-activity.tsx`

- **Lines:** 273 | **Bytes:** 9742
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** RecentActivity
- **Exported types:** RecentInteraction
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, react
- **Internal imports (3):** @/lib/utils, @/components/brand/text, @/components/brand/badge
- **Domain terms:** party

## `src/app/_components/stage-strip.tsx`

- **Lines:** 161 | **Bytes:** 6222
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** StageStrip
- **Exported types:** StageCardData
- **Security signals:** india-compliance
- **External deps:** framer-motion
- **Internal imports (3):** @/lib/utils, @/components/brand/text, @/components/brand/money
- **Domain terms:** Allocation

## `src/app/actions/auth.ts`

- **Lines:** 10 | **Bytes:** 370
- **Kind:** Server Actions module
- **Directive:** `use server`
- **Exported functions:** logout
- **Internal imports (1):** @/lib/auth

## `src/app/admin/audit/audit-view.tsx`

- **Lines:** 688 | **Bytes:** 24034
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** AdminAuditView
- **Exported types:** AdminAuditViewProps
- **DB ops patterns:** delete, from
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/navigation, react
- **Internal imports (3):** @/lib/utils, @/features/admin/queries, @/components/brand
- **Domain terms:** Barrier, barrier


# Batch 015

## `src/app/admin/audit/page.tsx`

- **Lines:** 102 | **Bytes:** 3186
- **Kind:** Next.js page route
- **Header intent:** Admin → Audit - the admin's forensic view of the immutable audit log. More detailed than the compliance audit page: advanced filters (entity type, operation, actor, date range, barrier) + a per-row diff inspector.  Gated to audit:read (admin / compliance / partner roles). The data layer reuses the compliance audit query (LEFT JOIN app_user for actor email) with the barrier filter exposed.
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth, rbac/rls
- **External deps:** next/navigation
- **Internal imports (5):** @/lib/rbac, @/features/admin/queries, @/components/brand, ./audit-view, @/components/brand/page-shell
- **Domain terms:** barrier

## `src/app/admin/dashboard-view.tsx`

- **Lines:** 563 | **Bytes:** 19807
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** AdminDashboardView
- **Exported types:** AdminDashboardViewProps
- **Security signals:** rbac/rls, credentials, india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, react
- **Internal imports (3):** @/lib/utils, @/features/admin/queries, @/components/brand

## `src/app/admin/loading.tsx`

- **Lines:** 59 | **Bytes:** 2138
- **Kind:** Application module
- **Default export:** yes
- **DB ops patterns:** from
- **Security signals:** rbac/rls, india-compliance
- **Internal imports (1):** @/components/brand/skeleton

## `src/app/admin/master-data/page.tsx`

- **Lines:** 366 | **Bytes:** 14691
- **Kind:** Client component; Next.js page route
- **Directive:** `use client`
- **Header intent:** Admin → Master data - read-only display of the firm's reference data: • sector_code - the hierarchical sector taxonomy (NIC / RBI sectoral deployment codes, segment class, level, active flag). • rating_ladder - the cross-agency rating rank reference (CRISIL long term scale in the seed; extensible to ICRA / CARE / etc.). • deal_type / instrument_type / rating_agency - the Postgres enum value lists that drive the deal/instrument/rating dropdowns across the CRM.  Read-only for now (display the mast
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** next/navigation
- **Internal imports (5):** @/lib/rbac, @/features/admin/queries, @/components/brand, @/components/brand/icons, @/components/brand/page-shell
- **Domain terms:** bond, mandate, scorecard, underwriting


# Batch 016

## `src/app/admin/page.tsx`

- **Lines:** 65 | **Bytes:** 2157
- **Kind:** Next.js page route
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth, rbac/rls, credentials, india-compliance
- **External deps:** next/navigation
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/admin/queries, @/components/brand, ./dashboard-view

## `src/app/admin/roles/page.tsx`

- **Lines:** 45 | **Bytes:** 1527
- **Kind:** Next.js page route
- **Header intent:** Admin → Roles - list roles + their permissions, assign/revoke permissions. Gated to user:manage (admin role). The admin role itself is protected - its permissions cannot be edited through this surface (an admin locking themselves out of user:manage would brick the panel).
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** next/navigation
- **Internal imports (5):** @/lib/rbac, @/features/admin/queries, @/components/brand, ./roles-view, @/components/brand/page-shell

## `src/app/admin/roles/roles-view.tsx`

- **Lines:** 320 | **Bytes:** 10715
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** RolesManagerView
- **Exported types:** RolesManagerViewProps
- **DB ops patterns:** delete, from
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (4):** @/lib/utils, @/features/admin/queries, @/components/brand, @/features/admin/actions
- **Domain terms:** kyc, party

## `src/app/admin/users/page.tsx`

- **Lines:** 46 | **Bytes:** 1541
- **Kind:** Next.js page route
- **Header intent:** Admin → Users - list all app_user records with email, roles, desk, active status, last login. Create / edit / deactivate actions live in the client view (useActionState forms). Gated to user:manage (admin role).
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth, rbac/rls, credentials
- **External deps:** next/navigation
- **Internal imports (5):** @/lib/rbac, @/features/admin/queries, @/components/brand, ./users-view, @/components/brand/page-shell
- **Domain terms:** barrier


# Batch 017

## `src/app/admin/users/users-view.tsx`

- **Lines:** 1000 | **Bytes:** 34819
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** UsersManagerView
- **Exported types:** UsersManagerViewProps
- **DB ops patterns:** delete, from
- **Security signals:** rbac/rls, credentials, india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (5):** @/components/ui/dialog, @/lib/utils, @/features/admin/queries, @/components/brand, @/features/admin/actions
- **Domain terms:** Barrier, barrier, binarycapital

## `src/app/ai/ai-hub-view.tsx`

- **Lines:** 485 | **Bytes:** 18029
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** AiHubView
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, react
- **Internal imports (4):** @/lib/utils, @/components/brand, @/components/brand, @/features/ai/types
- **Domain terms:** matching

## `src/app/ai/credit-summary.tsx`

- **Lines:** 315 | **Bytes:** 10619
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** AiCreditSummary
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react
- **Internal imports (6):** @/lib/utils, @/components/brand, @/components/brand, @/features/ai/types, @/features/ai/actions, @/app/ai/credit-summary
- **Domain terms:** Issuer, issuer, scorecard

## `src/app/ai/loading.tsx`

- **Lines:** 35 | **Bytes:** 1310
- **Kind:** Application module
- **Default export:** yes
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **Internal imports (1):** @/components/brand


# Batch 018

## `src/app/ai/page.tsx`

- **Lines:** 38 | **Bytes:** 1598
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (7):** @/components/brand/page-shell, @/lib/rbac, @/features/ai/nextAction, @/features/ai/interactionSummary, @/features/ai/clientInsights, @/components/brand, ./ai-hub-view

## `src/app/api/auth/[...nextauth]/route.ts`

- **Lines:** 10 | **Bytes:** 498
- **Kind:** API route handler
- **Header intent:** Auth.js v5 route handler - App Router convention. `handlers` is exported by NextAuth() in @/lib/auth. The catch-all `[...nextauth]` segment serves all Auth.js endpoints (/api/auth/signin, /callback, /session, /signout, …). Route Handlers are dynamic by default (they touch cookies/headers), so no `force-dynamic` is needed and `next build` won't prerender this route.
- **Exported const:** runtime
- **Security signals:** auth
- **Internal imports (1):** @/lib/auth

## `src/app/calendar/page.tsx`

- **Lines:** 261 | **Bytes:** 9276
- **Kind:** Next.js page route
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next/link
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/calendar/queries, @/components/brand, @/lib/utils
- **Domain terms:** KYC, kyc

## `src/app/compliance/audit/audit-list-view.tsx`

- **Lines:** 3298 | **Bytes:** 119653
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** AuditListView
- **Exported types:** AuditListViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, next/navigation, react
- **Internal imports (4):** @/lib/utils, @/features/compliance/audit, @/components/brand, @/components/brand
- **Domain terms:** Mandate, credit_analysis, kyc, party


# Batch 019

## `src/app/compliance/audit/page.tsx`

- **Lines:** 89 | **Bytes:** 2372
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next/navigation
- **Internal imports (4):** @/components/brand/page-shell, @/lib/rbac, @/features/compliance/audit, ./audit-list-view
- **Domain terms:** credit_analysis, party

## `src/app/compliance/consent/consent-action-forms.tsx`

- **Lines:** 603 | **Bytes:** 21303
- **Kind:** Server Actions module; Client component
- **Directive:** `use server`
- **Directive:** `use client`
- **Exported functions:** CaptureConsentDialog, WithdrawConsentButton, CreateDsrDialog, TransitionDsrControls
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (6):** @/components/ui/dialog, @/lib/utils, @/components/brand/button, @/components/brand/text, @/features/compliance/actions, @/features/compliance/consent
- **Domain terms:** Party, credit_analysis, matching, party

## `src/app/compliance/consent/consent-view.tsx`

- **Lines:** 833 | **Bytes:** 27309
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ConsentView
- **Exported types:** ConsentViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, next/navigation, react
- **Internal imports (8):** @/lib/utils, @/features/compliance/queries, @/features/compliance/consent, @/components/brand, @/components/brand, @/components/brand/text, ./consent-action-forms, @/features/compliance/consent
- **Domain terms:** Party, onboarding, party

## `src/app/compliance/consent/page.tsx`

- **Lines:** 104 | **Bytes:** 2332
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/compliance/queries, @/components/brand, ./consent-view
- **Domain terms:** credit_analysis


# Batch 020

## `src/app/compliance/kyc/[id]/kyc-action-forms.tsx`

- **Lines:** 477 | **Bytes:** 16088
- **Kind:** Server Actions module; Client component
- **Directive:** `use server`
- **Directive:** `use client`
- **Exported functions:** KycActions
- **Exported types:** KycActionsProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (6):** @/lib/utils, @/components/brand/button, @/components/brand/text, @/components/brand/badge, @/features/compliance/actions, @/features/compliance/kyc
- **Domain terms:** KYC, kyc, party

## `src/app/compliance/kyc/[id]/page.tsx`

- **Lines:** 816 | **Bytes:** 30509
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** auth, india-compliance
- **External deps:** drizzle-orm, next/link, next/navigation
- **Internal imports (12):** @/components/brand/icons, @/lib/rbac, @/features/compliance/queries, @/db, @/db/schema, @/lib/utils, @/features/compliance/kyc, ./kyc-action-forms, @/components/brand, @/components/brand, ./status-timeline, @/components/brand/page-shell
- **Domain terms:** KYC, kyc, party

## `src/app/compliance/kyc/[id]/status-timeline.tsx`

- **Lines:** 246 | **Bytes:** 8898
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** StatusTimeline
- **Exported types:** TimelineEntry
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react
- **Internal imports (2):** @/lib/utils, @/components/brand
- **Domain terms:** KYC

## `src/app/compliance/kyc/kyc-board-view.tsx`

- **Lines:** 879 | **Bytes:** 31545
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** KycBoardView
- **Exported types:** KycBoardViewProps
- **DB ops patterns:** delete, from
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, next/navigation, react
- **Internal imports (4):** @/lib/utils, @/features/compliance/queries, @/components/brand, @/features/reports/export-button
- **Domain terms:** KYC, kyc, party


# Batch 021

## `src/app/compliance/kyc/loading.tsx`

- **Lines:** 56 | **Bytes:** 2033
- **Kind:** Application module
- **Default export:** yes
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **Internal imports (2):** @/components/brand/skeleton, @/lib/utils
- **Domain terms:** KYC

## `src/app/compliance/kyc/page.tsx`

- **Lines:** 52 | **Bytes:** 1718
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (4):** @/components/brand/page-shell, @/lib/rbac, @/features/compliance/queries, ./kyc-board-view
- **Domain terms:** KYC, kyc

## `src/app/credit/[id]/add-fs-form.tsx`

- **Lines:** 273 | **Bytes:** 8677
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** AddFinancialStatementForm
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (3):** @/lib/utils, @/components/brand, @/features/credit/actions

## `src/app/credit/[id]/committee-form.tsx`

- **Lines:** 157 | **Bytes:** 5143
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** CommitteeForm
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (3):** @/lib/utils, @/components/brand, @/features/credit/actions
- **Domain terms:** credit_analysis


# Batch 022

## `src/app/credit/[id]/credit-summary-header.tsx`

- **Lines:** 287 | **Bytes:** 9997
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** CreditSummaryHeader
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react
- **Internal imports (2):** @/lib/utils, @/components/brand
- **Domain terms:** scorecard

## `src/app/credit/[id]/page.tsx`

- **Lines:** 1149 | **Bytes:** 47813
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (14):** @/app/credit/credit-icons, @/components/brand/icons, @/lib/rbac, @/features/credit/queries, @/features/credit/scorecard, @/features/credit/ratios, @/features/credit/ratingMap, @/components/brand, @/components/brand, ./add-fs-form, ./committee-form, ./run-score-button, ./credit-summary-header, @/components/brand/page-shell
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6, Issuer, Scorecard, credit_analysis, issuer, party, scorecard

## `src/app/credit/[id]/run-score-button.tsx`

- **Lines:** 67 | **Bytes:** 2263
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** RunScoreButton
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (3):** @/lib/utils, @/components/brand, @/features/credit/actions
- **Domain terms:** scorecard

## `src/app/credit/[id]/workspace/page.tsx`

- **Lines:** 1554 | **Bytes:** 65142
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next/link, next/navigation, react
- **Internal imports (13):** @/app/credit/credit-icons, @/lib/rbac, @/lib/utils, @/features/credit/queries, @/features/credit/scorecard, @/features/credit/ratios, @/features/credit/ratingMap, @/components/brand, @/components/brand, ./sparkline, ./source-data-panel, @/components/brand/page-shell, ../run-score-button
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6, Issuer, Scorecard, issuer, matching, party, scorecard


# Batch 023

## `src/app/credit/[id]/workspace/source-data-panel.tsx`

- **Lines:** 149 | **Bytes:** 5327
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** SourceDataPanel
- **Exported types:** SourceDataPanelProps
- **Security signals:** rbac/rls, india-compliance
- **External deps:** framer-motion, react
- **Internal imports (3):** @/lib/utils, @/components/brand, @/app/credit/credit-icons

## `src/app/credit/[id]/workspace/sparkline.tsx`

- **Lines:** 186 | **Bytes:** 5862
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** Sparkline
- **Exported types:** SparklineTone, SparklineProps
- **Security signals:** india-compliance
- **External deps:** framer-motion, react
- **Internal imports (1):** @/lib/utils

## `src/app/credit/credit-icons.tsx`

- **Lines:** 53 | **Bytes:** 1773
- **Kind:** Client component
- **Directive:** `use client`
- **Exported const:** ArrowRightIcon, ArrowLeftIcon, WarningIcon, ChartLineUpIcon, ScalesIcon, CoinsIcon, ShieldStarIcon, SparkleIcon, TrendUpIcon, PlusIcon, CheckCircleIcon, MinusIcon, CaretDownIcon
- **External deps:** @phosphor-icons/react

## `src/app/credit/credit-list-view.tsx`

- **Lines:** 460 | **Bytes:** 16561
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** CreditListView
- **Exported types:** CreditListViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (6):** @/lib/utils, @/features/credit/queries, @/features/credit/scorecard, @/features/reports/export-button, @/components/brand, @/components/brand
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6, Issuer, issuer, scorecard


# Batch 024

## `src/app/credit/layout.tsx`

- **Lines:** 21 | **Bytes:** 558
- **Kind:** Next.js layout
- **Default export:** yes
- **Security signals:** auth, rbac/rls
- **External deps:** next/navigation
- **Internal imports (2):** @/lib/rbac, @/lib/org

## `src/app/credit/new/new-credit-analysis-form.tsx`

- **Lines:** 297 | **Bytes:** 10425
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** NewCreditAnalysisForm
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, next/link, react
- **Internal imports (3):** @/lib/utils, @/components/brand, @/features/credit/actions
- **Domain terms:** Issuer, credit_analysis, issuer, party, scorecard

## `src/app/credit/new/page.tsx`

- **Lines:** 35 | **Bytes:** 1148
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **External deps:** next/link
- **Internal imports (5):** @/lib/rbac, @/features/parties/queries, @/components/brand, ./new-credit-analysis-form, @/components/brand/page-shell
- **Domain terms:** issuer, scorecard

## `src/app/credit/page.tsx`

- **Lines:** 46 | **Bytes:** 1321
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/credit/queries, @/components/brand, ./credit-list-view


# Batch 025

## `src/app/dashboard-exposure-chart.tsx`

- **Lines:** 303 | **Bytes:** 11168
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** HeroExposureChart, StageStrip, MiniBars
- **Exported types:** ExposurePoint, StageDatum
- **Security signals:** india-compliance
- **External deps:** framer-motion, react, recharts
- **Internal imports (1):** @/lib/utils
- **Domain terms:** Mandate, allocation, mandate

## `src/app/deals/[id]/page.tsx`

- **Lines:** 589 | **Bytes:** 21839
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** auth, india-compliance
- **External deps:** drizzle-orm, next/link, next/navigation
- **Internal imports (12):** @/components/brand/page-shell, @/components/brand/icons, @/lib/rbac, @/lib/utils, @/db, @/db/schema, @/features/deals/catalog, @/features/deals/stages, @/components/brand, @/components/brand, ../deal-type-icon, ../deal-type-credit
- **Domain terms:** KYC, Mandate, Party, allocation, mandate, matching, party

## `src/app/deals/deal-type-credit.ts`

- **Lines:** 42 | **Bytes:** 1823
- **Kind:** Client component
- **Directive:** `use client`
- **Header intent:** Server-safe home for `creditBand` - the view-derived credit-character "rating chip" for a deal. This is a PURE function (no React, no Phosphor, no hooks) so it is safe to call from Server Components. It was previously co-located in `deal-type-icon.tsx`, which is `"use client"` (it imports Phosphor + IconTile), so calling it from the /deals/[id] Server Component threw "Attempted to call creditBand() from the server but creditBand is on the client." Moving it here lets both the server detail page 
- **Exported functions:** creditBand
- **Exported types:** CreditBand
- **Security signals:** india-compliance
- **Internal imports (1):** @/components/brand/icon-language
- **Domain terms:** bond, mandate

## `src/app/deals/deal-type-icon.tsx`

- **Lines:** 264 | **Bytes:** 10915
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** dealTypeConcept, DealTypeGlyph, partyRoleConcept, PartyRoleGlyph
- **Exported types:** DealTypeGlyphProps, PartyRoleGlyphProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (4):** @/components/brand/icons, @/components/brand, @/lib/utils, ./deal-type-credit
- **Domain terms:** KYC, bond, investor, issuer, mandate, party


# Batch 026

## `src/app/deals/deals-board-view.tsx`

- **Lines:** 2266 | **Bytes:** 80129
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** DealsBoardView
- **Exported types:** DealsBoardViewProps
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, react
- **Internal imports (6):** @/lib/utils, @/features/deals/queries, @/components/brand, @/components/brand/text, @/features/reports/export-button, ./deal-type-icon
- **Domain terms:** Allocation, Bond, Mandate, Underwriting, allocation, binarybonds, binarycapital, mandate, matching, party

## `src/app/deals/loading.tsx`

- **Lines:** 35 | **Bytes:** 1221
- **Kind:** Application module
- **Default export:** yes
- **DB ops patterns:** from
- **Internal imports (1):** @/components/brand/skeleton

## `src/app/deals/page.tsx`

- **Lines:** 75 | **Bytes:** 2823
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (4):** @/components/brand/page-shell, @/lib/rbac, @/features/deals/queries, ./deals-board-view
- **Domain terms:** Mandate, party

## `src/app/documents/[id]/page.tsx`

- **Lines:** 298 | **Bytes:** 10620
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (6):** @/components/brand/icons, @/lib/rbac, @/features/documents/queries, @/components/brand, @/components/brand/text, @/components/brand/page-shell
- **Domain terms:** Barrier, Party


# Batch 027

## `src/app/documents/documents-list-view.tsx`

- **Lines:** 490 | **Bytes:** 16531
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** DocumentsListView
- **Exported types:** DocumentsListViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (5):** @/lib/utils, @/features/documents/queries, @/components/brand, @/features/reports/export-button, ./new-document-dialog

## `src/app/documents/new-document-dialog.tsx`

- **Lines:** 450 | **Bytes:** 15161
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** NewDocumentDialog
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (5):** @/components/ui/dialog, @/lib/utils, @/components/brand/button, @/components/brand/text, @/features/documents/actions
- **Domain terms:** KYC, Party

## `src/app/documents/page.tsx`

- **Lines:** 78 | **Bytes:** 1860
- **Kind:** Next.js page route
- **Exported const:** dynamic, TYPE_FILTERS
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/documents/queries, @/components/brand, ./documents-list-view
- **Domain terms:** KYC

## `src/app/error.tsx`

- **Lines:** 65 | **Bytes:** 2398
- **Kind:** Client component
- **Directive:** `use client`
- **Default export:** yes
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (2):** @/components/brand, @/components/brand/text


# Batch 028

## `src/app/global-error.tsx`

- **Lines:** 75 | **Bytes:** 3061
- **Kind:** Client component
- **Directive:** `use client`
- **Default export:** yes
- **Security signals:** india-compliance
- **External deps:** react

## `src/app/globals.css`

- **Lines:** 366 | **Bytes:** 10269
- **Kind:** Application module

## `src/app/integrations/adapter-card.tsx`

- **Lines:** 934 | **Bytes:** 37526
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** AdapterCard
- **Exported types:** AdapterRunState, AdapterCardProps
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react
- **Internal imports (10):** @/components/ui/sheet, @/lib/utils, @/components/brand/button, @/components/brand/card, @/components/brand/badge, @/components/brand, @/features/integrations/registry, @/features/integrations/types, ./integrations-icons, ./adapter-meta
- **Domain terms:** onboarding, party

## `src/app/integrations/adapter-meta.ts`

- **Lines:** 188 | **Bytes:** 8789
- **Kind:** Application module
- **Header intent:** View-layer metadata for the /integrations CONNECTION CARDS.  This module is DISPLAY-ONLY derivation. DATA_FLOW + ADAPTER_HEALTH + the category labels are read off each adapter's own access-requirement / cost-risk text (in @/features/integrations/*) and surfaced as the control-panel's "what data flows" + "how ready is Binary to actually connect" gauges. They do NOT touch the data registry, the Server Actions, zod, or force-dynamic - the data layer is preserved exactly. If a field is missing from 
- **Exported functions:** readinessTone, deriveConnectionState
- **Exported const:** CATEGORY_ORDER, CATEGORY_LABEL, CATEGORY_BLURB, DATA_FLOW, ADAPTER_HEALTH
- **Exported types:** IntegrationCategory, DataFlow, AdapterHealth, ConnectionState
- **Security signals:** india-compliance
- **Internal imports (2):** @/features/integrations/types, @/features/integrations/registry
- **Domain terms:** Demat, KYC, demat, issuer, kyc, onboarding


# Batch 029

## `src/app/integrations/integrations-explorer.tsx`

- **Lines:** 420 | **Bytes:** 16105
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** IntegrationsExplorer
- **Exported types:** IntegrationsExplorerProps
- **Security signals:** india-compliance
- **External deps:** react, sonner
- **Internal imports (9):** @/lib/utils, @/components/brand, @/components/brand/text, @/features/integrations/actions, @/features/integrations/registry, ./adapter-card, ./live-stat-tile, ./adapter-meta, ./integrations-icons
- **Domain terms:** KYC

## `src/app/integrations/integrations-icons.tsx`

- **Lines:** 136 | **Bytes:** 4507
- **Kind:** Client component
- **Directive:** `use client`
- **Exported const:** BankIcon, IdentificationCardIcon, CertificateIcon, BarcodeIcon, BuildingsIcon, MedalIcon, ShieldStarIcon, EnvelopeIcon, WhatsappLogoIcon, ChartLineIcon, CurrencyInrIcon, VaultIcon, PlayIcon, PlayCircleIcon, CircleNotchIcon, XIcon, CheckCircleIcon, WarningIcon, ArrowRightIcon, ArrowUpRightIcon, LightningIcon, SparkleIcon, FunnelIcon, LockIcon, PlugIcon, PlugsConnectedIcon, GaugeIcon, ArrowLineRightIcon, ArrowCounterClockwiseIcon, ADAPTER_ICONS…
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react
- **Domain terms:** demat

## `src/app/integrations/live-stat-tile.tsx`

- **Lines:** 168 | **Bytes:** 6354
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** LiveStatTile
- **Exported types:** LiveStatTileProps
- **Security signals:** india-compliance
- **External deps:** In mock, framer-motion, react
- **Internal imports (3):** @/lib/utils, @/components/brand/card, @/components/brand/text
- **Domain terms:** matching

## `src/app/integrations/page.tsx`

- **Lines:** 82 | **Bytes:** 4161
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (6):** @/components/brand/page-shell, @/lib/rbac, @/features/integrations/queries, @/components/brand/card, @/components/brand/badge, ./integrations-explorer
- **Domain terms:** demat


# Batch 030

## `src/app/interactions/[id]/page.tsx`

- **Lines:** 351 | **Bytes:** 11846
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (7):** @/components/brand/icons, @/lib/rbac, @/features/interactions/queries, @/components/brand, @/components/brand/text, @/components/brand/money, @/components/brand/page-shell
- **Domain terms:** Barrier, Party

## `src/app/interactions/interactions-list-view.tsx`

- **Lines:** 462 | **Bytes:** 15484
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** InteractionsListView
- **Exported types:** InteractionsListViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (6):** @/lib/utils, @/features/interactions/queries, @/components/brand, @/components/brand/money, @/features/reports/export-button, ./new-interaction-dialog

## `src/app/interactions/new-interaction-dialog.tsx`

- **Lines:** 488 | **Bytes:** 17710
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** NewInteractionDialog
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (5):** @/components/ui/dialog, @/lib/utils, @/components/brand/button, @/components/brand/text, @/features/interactions/actions
- **Domain terms:** Party, party

## `src/app/interactions/page.tsx`

- **Lines:** 49 | **Bytes:** 1409
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/interactions/queries, @/components/brand, ./interactions-list-view


# Batch 031

## `src/app/layout.tsx`

- **Lines:** 146 | **Bytes:** 5189
- **Kind:** Next.js layout
- **Exported const:** metadata, viewport
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next, next/font/google
- **Internal imports (5):** @/components/theme-provider, @/components/site-nav, @/components/ui/sonner, @/components/brand/page-transition, @/lib/auth
- **Domain terms:** binarycapital

## `src/app/leads/[id]/bant-checklist.tsx`

- **Lines:** 296 | **Bytes:** 9692
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** BantChecklist
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react
- **Internal imports (3):** @/lib/utils, @/features/leads/actions, @/features/leads/types

## `src/app/leads/[id]/lead-workflow-actions.tsx`

- **Lines:** 416 | **Bytes:** 13483
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ConvertToOpportunity, WinLeadButton, LoseLeadButton, DeleteLeadButton, AddNoteForm, LossReasonBadge
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, next/link, react
- **Internal imports (4):** @/lib/utils, @/components/brand, @/features/leads/actions, @/features/leads/types
- **Domain terms:** Mandate, mandate, party

## `src/app/leads/[id]/page.tsx`

- **Lines:** 821 | **Bytes:** 31352
- **Kind:** Client component; Next.js page route
- **Directive:** `use client`
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (12):** @/lib/rbac, @/features/leads/queries, @/features/documents/queries, @/features/leads, @/features/leads/lead-icons, @/components/brand, @/components/brand, @/components/brand/text, @/components/brand/icons, ./bant-checklist, ./lead-workflow-actions, @/components/brand/page-shell
- **Domain terms:** bond, mandate, party


# Batch 032

## `src/app/leads/leads-board-view.tsx`

- **Lines:** 896 | **Bytes:** 32680
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** LeadsBoardView
- **Exported types:** LeadsBoardViewProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, react, recharts
- **Internal imports (7):** @/lib/utils, @/components/brand, @/components/brand/chart-theme, @/components/brand/text, @/features/leads/lead-icons, @/features/leads/types, @/features/leads/queries
- **Domain terms:** bond, mandate

## `src/app/leads/new/new-lead-form.tsx`

- **Lines:** 565 | **Bytes:** 20831
- **Kind:** Server Actions module; Client component
- **Directive:** `use server`
- **Directive:** `use client`
- **Exported functions:** NewLeadForm
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, next/link, react
- **Internal imports (5):** @/lib/utils, @/components/brand, @/features/leads/lead-icons, @/features/leads/types, @/features/leads/actions
- **Domain terms:** bond, mandate, onboarding, party

## `src/app/leads/new/page.tsx`

- **Lines:** 48 | **Bytes:** 1753
- **Kind:** Next.js page route
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth
- **External deps:** next/link
- **Internal imports (6):** @/lib/rbac, @/features/leads/queries, @/features/parties/queries, @/components/brand, ./new-lead-form, @/components/brand/page-shell
- **Domain terms:** onboarding

## `src/app/leads/page.tsx`

- **Lines:** 39 | **Bytes:** 1316
- **Kind:** Next.js page route
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/leads/queries, @/components/brand, ./leads-board-view


# Batch 033

## `src/app/loading.tsx`

- **Lines:** 23 | **Bytes:** 1055
- **Kind:** Application module
- **Default export:** yes
- **Security signals:** india-compliance
- **Internal imports (1):** @/components/brand/skeleton
- **Domain terms:** kyc

## `src/app/login/actions.ts`

- **Lines:** 58 | **Bytes:** 1889
- **Kind:** Server Actions module
- **Directive:** `use server`
- **Exported functions:** login
- **Exported types:** LoginState
- **Zod schemas:** loginSchema
- **External deps:** next-auth, zod/v4
- **Internal imports (1):** @/lib/auth

## `src/app/login/login-form.tsx`

- **Lines:** 127 | **Bytes:** 3229
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** LoginForm
- **External deps:** @phosphor-icons/react, react, react-dom
- **Internal imports (3):** ./actions, @/components/brand/button, @/lib/utils
- **Domain terms:** binarycapital

## `src/app/login/page.tsx`

- **Lines:** 106 | **Bytes:** 3756
- **Kind:** Next.js page route
- **Header intent:** Login — public surface. Stripe-level split: brand panel + clean form card.
- **Exported const:** metadata, dynamic
- **Default export:** yes
- **Security signals:** rbac/rls, india-compliance
- **External deps:** next, next/image, next/link
- **Internal imports (3):** @/components/logo.png, ./login-form, @/components/brand/card
- **Domain terms:** binarycapital


# Batch 034

## `src/app/matching/[id]/match-matrix-view.tsx`

- **Lines:** 1005 | **Bytes:** 38867
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** MatchMatrixView
- **DB ops patterns:** delete
- **Security signals:** india-compliance
- **External deps:** next/link, react
- **Internal imports (7):** @/components/brand/icons, @/lib/utils, @/features/matching/queries, @/features/matching/engine, @/features/matching/actions, @/components/brand, @/components/brand/text
- **Domain terms:** Bond, Demat, Investor, KYC, Mandate, bond, demat, investor, issuer, kyc, mandate, matching, underwriting

## `src/app/matching/[id]/page.tsx`

- **Lines:** 48 | **Bytes:** 1914
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **External deps:** next/link, next/navigation
- **Internal imports (7):** @/components/brand/icons, @/lib/rbac, @/features/matching/queries, @/components/brand, @/components/brand/text, ./match-matrix-view, @/components/brand/page-shell
- **Domain terms:** issuer, mandate, matching

## `src/app/matching/matching-workspace.tsx`

- **Lines:** 669 | **Bytes:** 26790
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** MatchingWorkspace
- **Exported types:** MatchingWorkspaceProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** next/link, next/navigation, react
- **Internal imports (6):** @/components/brand/icons, @/lib/utils, @/features/matching/queries, @/features/matching/engine, @/components/brand, @/components/brand/text
- **Domain terms:** Demat, Investor, Issuer, KYC, Matching, bond, demat, investor, issuer, kyc, mandate, matching

## `src/app/matching/page.tsx`

- **Lines:** 56 | **Bytes:** 2066
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (4):** @/components/brand/page-shell, @/lib/rbac, @/features/matching/queries, ./matching-workspace
- **Domain terms:** Investor, Issuer, Matching, investor, issuer, matching


# Batch 035

## `src/app/modeling/[id]/page.tsx`

- **Lines:** 806 | **Bytes:** 30423
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **DB ops patterns:** from, leftJoin, select, where
- **Security signals:** auth, india-compliance
- **External deps:** drizzle-orm, next/link, next/navigation
- **Internal imports (12):** @/lib/rbac, @/features/modeling/queries, @/db, @/db/schema, @/components/brand/icons, @/components/brand/button, @/components/brand/badge, @/components/brand/card, @/components/brand/text, @/components/brand/reveal, @/components/brand/page-shell, @/components/brand/table
- **Domain terms:** Bond, Party, bond, party

## `src/app/modeling/bond-calculator/bond-calculator-lazy.tsx`

- **Lines:** 57 | **Bytes:** 2232
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** BondCalculator
- **Security signals:** india-compliance
- **External deps:** next/dynamic, react
- **Domain terms:** bond

## `src/app/modeling/bond-calculator/bond-calculator.tsx`

- **Lines:** 1332 | **Bytes:** 49306
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** BondCalculator
- **DB ops patterns:** update
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react, recharts
- **Internal imports (15):** @/features/modeling/bondPricing, @/features/modeling/actions, @/components/brand/button, @/components/brand/card, @/components/brand/badge, @/components/brand/text, @/components/brand/reveal, @/components/brand/input, @/components/brand/select, @/components/brand/tabs, @/components/brand/table, @/components/brand/empty-state, @/components/ui/dialog, @/components/ui/label, @/lib/utils
- **Domain terms:** Bond, GSEC, Party, bond, party

## `src/app/modeling/bond-calculator/page.tsx`

- **Lines:** 38 | **Bytes:** 1221
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **External deps:** next/link
- **Internal imports (5):** @/lib/rbac, @/components/brand/badge, @/components/brand/button, @/components/brand/page-shell, ./bond-calculator-lazy
- **Domain terms:** Bond, bond


# Batch 036

## `src/app/modeling/lbo-calculator/lbo-calculator-lazy.tsx`

- **Lines:** 43 | **Bytes:** 1590
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** LboCalculator
- **Security signals:** india-compliance
- **External deps:** next/dynamic, react

## `src/app/modeling/lbo-calculator/lbo-calculator.tsx`

- **Lines:** 868 | **Bytes:** 38543
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** LboCalculator
- **DB ops patterns:** update
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react
- **Internal imports (12):** @/features/modeling/lboModel, @/features/modeling/actions, @/components/brand/button, @/components/brand/card, @/components/brand/badge, @/components/brand/text, @/components/brand/reveal, @/components/brand/input, @/components/brand/table, @/components/ui/dialog, @/components/ui/label, @/lib/utils
- **Domain terms:** Party, party

## `src/app/modeling/lbo-calculator/page.tsx`

- **Lines:** 37 | **Bytes:** 1161
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **External deps:** next/link
- **Internal imports (5):** @/lib/rbac, @/components/brand/badge, @/components/brand/button, @/components/brand/page-shell, ./lbo-calculator-lazy

## `src/app/modeling/ma-calculator/ma-calculator-lazy.tsx`

- **Lines:** 43 | **Bytes:** 1582
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** MaCalculator
- **Security signals:** india-compliance
- **External deps:** next/dynamic, react


# Batch 037

## `src/app/modeling/ma-calculator/ma-calculator.tsx`

- **Lines:** 978 | **Bytes:** 42878
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** MaCalculator
- **DB ops patterns:** update
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react, recharts
- **Internal imports (13):** @/features/modeling/maModel, @/features/modeling/actions, @/components/brand/button, @/components/brand/card, @/components/brand/badge, @/components/brand/text, @/components/brand/reveal, @/components/brand/input, @/components/brand/select, @/components/brand/table, @/components/ui/dialog, @/components/ui/label, @/lib/utils
- **Domain terms:** Party, allocation, bond, party

## `src/app/modeling/ma-calculator/page.tsx`

- **Lines:** 37 | **Bytes:** 1157
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **External deps:** next/link
- **Internal imports (5):** @/lib/rbac, @/components/brand/badge, @/components/brand/button, @/components/brand/page-shell, ./ma-calculator-lazy

## `src/app/modeling/model-library.tsx`

- **Lines:** 301 | **Bytes:** 10685
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ModelLibrary
- **Exported types:** ModelLibraryRow
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, next/link, react
- **Internal imports (9):** @/components/brand/table, @/components/brand/button, @/components/brand/badge, @/components/brand/card, @/components/brand/text, @/components/brand/reveal, @/components/brand/command-bar, @/components/brand/page-shell, @/components/brand/table
- **Domain terms:** Bond, Party, bond, party

## `src/app/modeling/page.tsx`

- **Lines:** 26 | **Bytes:** 906
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (3):** @/lib/rbac, @/features/modeling/queries, ./model-library


# Batch 038

## `src/app/modeling/scenario/page.tsx`

- **Lines:** 37 | **Bytes:** 1151
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **External deps:** next/link
- **Internal imports (5):** @/lib/rbac, @/components/brand/badge, @/components/brand/button, @/components/brand/page-shell, ./scenario-lazy

## `src/app/modeling/scenario/scenario-lazy.tsx`

- **Lines:** 43 | **Bytes:** 1570
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ScenarioDesk
- **Security signals:** india-compliance
- **External deps:** next/dynamic, react

## `src/app/modeling/scenario/scenario.tsx`

- **Lines:** 563 | **Bytes:** 23296
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ScenarioDesk
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react
- **Internal imports (12):** @/features/modeling/scenarioAnalysis, @/features/modeling/actions, @/components/brand/button, @/components/brand/card, @/components/brand/badge, @/components/brand/text, @/components/brand/reveal, @/components/brand/input, @/components/brand/select, @/components/ui/dialog, @/components/ui/label, @/lib/utils
- **Domain terms:** Party

## `src/app/not-found.tsx`

- **Lines:** 39 | **Bytes:** 1716
- **Kind:** Application module
- **Default export:** yes
- **Security signals:** india-compliance
- **External deps:** next/link
- **Internal imports (3):** @/components/brand, @/components/brand/text, @/components/brand/icons


# Batch 039

## `src/app/notifications/notifications-center.tsx`

- **Lines:** 656 | **Bytes:** 22219
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** NotificationsCenter
- **Exported types:** NotificationsCenterProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, next/link, react
- **Internal imports (8):** @/features/workflow/actions, @/features/workflow/types, @/lib/utils, @/components/brand, @/components/brand/text, @/components/brand/reveal, @/features/workflow/actions, @/features/workflow/types
- **Domain terms:** KYC, mandate

## `src/app/notifications/page.tsx`

- **Lines:** 56 | **Bytes:** 2230
- **Kind:** Next.js page route
- **Exported const:** dynamic, metadata
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/workflow/queries, @/components/brand, ./notifications-center
- **Domain terms:** KYC, party

## `src/app/onboarding/[id]/onboarding-detail-view.tsx`

- **Lines:** 1328 | **Bytes:** 47263
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** OnboardingDetailView
- **Exported types:** OnboardingDetailViewProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, next/link, react
- **Internal imports (7):** @/lib/utils, @/components/brand, @/components/brand/text, @/features/onboarding/onboarding-icons, @/features/onboarding/types, @/features/onboarding/queries, @/features/onboarding/actions
- **Domain terms:** KYC, Onboarding, kyc, onboarding, party

## `src/app/onboarding/[id]/page.tsx`

- **Lines:** 188 | **Bytes:** 7056
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (10):** @/components/brand/icons, @/lib/utils, @/lib/rbac, @/features/onboarding, @/components/brand, @/components/brand, @/features/onboarding, @/features/onboarding/onboarding-icons, ./onboarding-detail-view, @/components/brand/page-shell
- **Domain terms:** KYC, Onboarding, kyc, onboarding, party


# Batch 040

## `src/app/onboarding/new/onboarding-wizard.tsx`

- **Lines:** 772 | **Bytes:** 28992
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** OnboardingWizard
- **Exported types:** OnboardingWizardProps
- **DB ops patterns:** delete
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, react
- **Internal imports (5):** @/lib/utils, @/components/brand, @/features/onboarding/types, @/features/onboarding/queries, @/features/onboarding/actions
- **Domain terms:** KYC, Onboarding, issuer, onboarding

## `src/app/onboarding/new/page.tsx`

- **Lines:** 22 | **Bytes:** 829
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (4):** @/lib/rbac, @/features/onboarding, ./onboarding-wizard, @/components/brand/page-shell
- **Domain terms:** onboarding

## `src/app/onboarding/onboarding-board-view.tsx`

- **Lines:** 881 | **Bytes:** 31350
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** OnboardingBoardView
- **Exported types:** OnboardingBoardViewProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, react
- **Internal imports (6):** @/lib/utils, @/components/brand, @/components/brand/text, @/features/onboarding/onboarding-icons, @/features/onboarding/types, @/features/onboarding/queries
- **Domain terms:** KYC, Onboarding, kyc, onboarding

## `src/app/onboarding/page.tsx`

- **Lines:** 30 | **Bytes:** 1035
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (4):** @/components/brand/page-shell, @/lib/rbac, @/features/onboarding, ./onboarding-board-view
- **Domain terms:** Onboarding, investor, onboarding


# Batch 041

## `src/app/page.tsx`

- **Lines:** 350 | **Bytes:** 11840
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** next/link
- **Internal imports (7):** @/components/brand/page-shell, @/features/dashboard/queries, @/lib/rbac, @/components/brand, @/components/brand/icons, @/components/brand/money, @/lib/utils
- **Domain terms:** Allocation, KYC, allocation, binarycapital, kyc, matching

## `src/app/parties/[id]/page.tsx`

- **Lines:** 857 | **Bytes:** 32900
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (12):** @/components/brand/icons, @/lib/rbac, @/features/parties/queries, @/lib/utils, ../assign-party-form, @/components/brand, @/components/brand/text, @/components/brand/page-shell, @/components/brand/money, ../party-icon, ../relationship-graph, ../party-signals
- **Domain terms:** Bond, KYC, Party, binarybonds, binarycapital, mandate, party

## `src/app/parties/assign-party-form.tsx`

- **Lines:** 66 | **Bytes:** 1883
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** AssignPartyForm
- **Exported types:** StaffOption
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (2):** @/features/parties/actions, @/components/brand

## `src/app/parties/loading.tsx`

- **Lines:** 70 | **Bytes:** 2478
- **Kind:** Application module
- **Default export:** yes
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **Internal imports (2):** @/components/brand/skeleton, @/lib/utils


# Batch 042

## `src/app/parties/new-party-dialog.tsx`

- **Lines:** 336 | **Bytes:** 11354
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** NewPartyDialog
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (5):** @/components/ui/dialog, @/lib/utils, @/components/brand/button, @/components/brand/text, @/features/parties/actions
- **Domain terms:** Party, investor, issuer, party

## `src/app/parties/page.tsx`

- **Lines:** 97 | **Bytes:** 3227
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/parties/queries, @/components/brand, ./parties-list-view

## `src/app/parties/parties-list-view.tsx`

- **Lines:** 1238 | **Bytes:** 43075
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** PartiesExplorer
- **Exported types:** PartiesExplorerProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (11):** @/components/brand/icons, @/lib/utils, @/features/parties/queries, @/features/parties/segmentation, @/components/brand, @/components/brand/text, @/features/reports/export-button, ./new-party-dialog, ./party-icon, ./relationship-graph, ./party-signals
- **Domain terms:** KYC, Onboarding, Party, investor, issuer, mandate, onboarding, party

## `src/app/parties/party-icon.tsx`

- **Lines:** 145 | **Bytes:** 5288
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** partyConcept, PartyAvatar
- **Exported types:** PartyAvatarProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (3):** @/components/brand/icons, @/components/brand, @/lib/utils
- **Domain terms:** KYC, investor, issuer, mandate, party


# Batch 043

## `src/app/parties/party-signals.tsx`

- **Lines:** 139 | **Bytes:** 5083
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** deriveStrength, formatRelative, StrengthBar
- **Exported const:** BAND_LABEL
- **Exported types:** StrengthBand, Strength, PartySignalInput
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (1):** @/lib/utils
- **Domain terms:** KYC, Party, kyc, mandate, party

## `src/app/parties/relationship-graph.tsx`

- **Lines:** 333 | **Bytes:** 11095
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** RelationshipGraph
- **Exported types:** RelationshipGraphProps
- **Security signals:** india-compliance
- **External deps:** next/link, react
- **Internal imports (4):** @/components/brand/icons, @/features/parties/queries, @/lib/utils, @/components/brand
- **Domain terms:** party

## `src/app/portal/client/[id]/page.tsx`

- **Lines:** 713 | **Bytes:** 26006
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (10):** @/components/brand/icons, @/lib/rbac, @/features/portal, @/features/portal, @/components/brand, @/components/brand, @/components/brand/text, @/components/brand/chart-theme, @/components/brand, @/components/brand/page-shell
- **Domain terms:** KYC, Mandate, Onboarding, allocation, investor, issuer, mandate, party

## `src/app/portal/client/client-directory-view.tsx`

- **Lines:** 323 | **Bytes:** 10884
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ClientDirectoryView
- **Exported types:** ClientDirectoryViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (4):** @/lib/utils, @/components/brand, @/components/brand, @/features/portal
- **Domain terms:** KYC, Onboarding, investor, issuer, matching, party


# Batch 044

## `src/app/portal/client/loading.tsx`

- **Lines:** 43 | **Bytes:** 1570
- **Kind:** Application module
- **Default export:** yes
- **DB ops patterns:** from
- **Internal imports (1):** @/components/brand/skeleton

## `src/app/portal/client/page.tsx`

- **Lines:** 42 | **Bytes:** 1288
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (4):** @/lib/rbac, @/features/portal, ./client-directory-view, @/components/brand/page-shell
- **Domain terms:** KYC, issuer, onboarding

## `src/app/portal/investor/[id]/investor-charts.tsx`

- **Lines:** 142 | **Bytes:** 4469
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** InvestorComposition, InvestorTopIssuers
- **External deps:** @phosphor-icons/react, react
- **Internal imports (4):** @/features/portal/portal-charts, @/features/portal/queries, @/components/brand/chart-theme, @/components/brand
- **Domain terms:** Issuer, investor, issuer

## `src/app/portal/investor/[id]/page.tsx`

- **Lines:** 702 | **Bytes:** 25417
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (11):** @/components/brand/icons, @/lib/rbac, @/features/portal, @/features/portal, ./investor-charts, @/components/brand, @/components/brand, @/components/brand/text, @/components/brand/chart-theme, @/components/brand, @/components/brand/page-shell
- **Domain terms:** Allocation, Bond, Demat, Investor, Issuer, KYC, allocation, bond, demat, investor, issuer, kyc, party


# Batch 045

## `src/app/portal/investor/investor-directory-view.tsx`

- **Lines:** 313 | **Bytes:** 10802
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** InvestorDirectoryView
- **Exported types:** InvestorDirectoryViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (4):** @/lib/utils, @/components/brand, @/components/brand, @/features/portal
- **Domain terms:** Investor, KYC, allocation, investor, matching, party

## `src/app/portal/investor/loading.tsx`

- **Lines:** 43 | **Bytes:** 1580
- **Kind:** Application module
- **Default export:** yes
- **DB ops patterns:** from
- **Internal imports (1):** @/components/brand/skeleton
- **Domain terms:** Investor

## `src/app/portal/investor/page.tsx`

- **Lines:** 42 | **Bytes:** 1318
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (4):** @/lib/rbac, @/features/portal, ./investor-directory-view, @/components/brand/page-shell
- **Domain terms:** KYC, allocation, bond, demat, investor, party

## `src/app/portfolio/_components/concentration-view.tsx`

- **Lines:** 377 | **Bytes:** 14090
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ConcentrationView
- **Exported types:** ConcentrationViewProps
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (8):** @/lib/utils, @/components/brand, @/components/brand, @/components/brand/chart-theme, @/components/brand, @/features/reports/export, @/features/portfolio, ./portfolio-charts
- **Domain terms:** Issuer, issuer, party


# Batch 046

## `src/app/portfolio/_components/edit-limit-dialog.tsx`

- **Lines:** 321 | **Bytes:** 11231
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** EditLimitDialog
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (6):** @/lib/utils, @/components/brand, @/components/ui/dialog, @/features/reports/export, @/features/portfolio, @/features/portfolio/actions

## `src/app/portfolio/_components/limits-view.tsx`

- **Lines:** 482 | **Bytes:** 17790
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** LimitsView
- **Exported types:** LimitsViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (8):** @/lib/utils, @/components/brand, @/components/brand, @/components/brand/chart-theme, @/components/brand, @/features/reports/export, @/features/portfolio, ./edit-limit-dialog
- **Domain terms:** Issuer, issuer, underwriting

## `src/app/portfolio/_components/overview-view.tsx`

- **Lines:** 580 | **Bytes:** 20113
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** OverviewView
- **Exported types:** OverviewViewProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, next/link, react
- **Internal imports (7):** @/lib/utils, @/components/brand, @/components/brand, @/components/brand/chart-theme, @/features/reports/export, @/features/portfolio, ./portfolio-charts
- **Domain terms:** issuer

## `src/app/portfolio/_components/portfolio-charts-impl.tsx`

- **Lines:** 543 | **Bytes:** 15789
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** DonutChart, HBarChart, StackedBarChart, VBarChart, RadialGauge
- **Exported const:** SECTOR_PALETTE, EXPOSURE_TYPE_COLORS, EXPOSURE_TYPE_LABELS
- **Exported types:** DonutPoint, LabelValuePoint, StackedPoint, GaugePoint
- **External deps:** react, recharts
- **Internal imports (1):** @/components/brand/chart-theme
- **Domain terms:** Underwriting


# Batch 047

## `src/app/portfolio/_components/portfolio-charts.tsx`

- **Lines:** 75 | **Bytes:** 2884
- **Kind:** Client component
- **Directive:** `use client`
- **Exported const:** DonutChart, HBarChart, StackedBarChart, VBarChart, RadialGauge
- **External deps:** next/dynamic
- **Internal imports (2):** ./portfolio-charts-impl, ./portfolio-charts-impl

## `src/app/portfolio/_components/portfolio-sub-nav.tsx`

- **Lines:** 94 | **Bytes:** 3273
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** PortfolioSubNav
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation
- **Internal imports (1):** @/lib/utils

## `src/app/portfolio/_components/risk-metrics-view.tsx`

- **Lines:** 263 | **Bytes:** 10294
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** RiskMetricsView
- **Exported types:** RiskMetricsViewProps
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (8):** @/components/brand, @/components/brand/chart-theme, @/components/brand, @/features/reports/export, @/components/brand/money, @/features/portfolio, @/features/portfolio/risk, ./portfolio-charts
- **Domain terms:** bond

## `src/app/portfolio/concentration/page.tsx`

- **Lines:** 71 | **Bytes:** 2354
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (4):** @/lib/rbac, @/components/brand, @/features/portfolio, ../_components/concentration-view


# Batch 048

## `src/app/portfolio/layout.tsx`

- **Lines:** 30 | **Bytes:** 779
- **Kind:** Next.js layout
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **External deps:** react
- **Internal imports (3):** @/lib/rbac, ./_components/portfolio-sub-nav, @/components/brand/page-shell
- **Domain terms:** issuer

## `src/app/portfolio/limits/page.tsx`

- **Lines:** 83 | **Bytes:** 2769
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, rbac/rls
- **Internal imports (5):** @/lib/rbac, @/features/reports/export, @/components/brand, @/features/portfolio, ../_components/limits-view
- **Domain terms:** issuer, underwriting

## `src/app/portfolio/loading.tsx`

- **Lines:** 9 | **Bytes:** 362
- **Kind:** Application module
- **Default export:** yes
- **Internal imports (1):** @/components/brand

## `src/app/portfolio/page.tsx`

- **Lines:** 98 | **Bytes:** 2686
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (7):** @/components/brand/page-shell, @/lib/rbac, @/features/reports/export, @/components/brand, @/components/brand/chart-theme, @/features/portfolio, ./_components/overview-view


# Batch 049

## `src/app/portfolio/risk-metrics/page.tsx`

- **Lines:** 28 | **Bytes:** 1098
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (4):** @/lib/rbac, @/components/brand, @/features/portfolio, ../_components/risk-metrics-view

## `src/app/reports/_components/credit-report-view.tsx`

- **Lines:** 522 | **Bytes:** 19454
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** CreditReportView
- **Exported types:** CreditReportViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (6):** @/components/brand/text, @/lib/utils, @/features/reports/queries, @/features/reports/export, @/components/brand, @/components/brand
- **Domain terms:** Issuer, issuer, scorecard

## `src/app/reports/_components/report-charts-impl.tsx`

- **Lines:** 401 | **Bytes:** 12995
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** CountBarChart, HorizontalBarChart, AreaTrendChart, StackedBarChart
- **Exported types:** LabelCountPoint, LabelValuePoint, ConsentStackPoint
- **Security signals:** india-compliance
- **External deps:** react, recharts
- **Internal imports (2):** @/components/brand/chart-theme, @/features/reports/export
- **Domain terms:** KYC

## `src/app/reports/_components/report-charts.tsx`

- **Lines:** 63 | **Bytes:** 2558
- **Kind:** Client component
- **Directive:** `use client`
- **Exported const:** CountBarChart, HorizontalBarChart, AreaTrendChart, StackedBarChart
- **External deps:** next/dynamic
- **Internal imports (1):** ./report-charts-impl


# Batch 050

## `src/app/reports/_components/reports-hub-view.tsx`

- **Lines:** 193 | **Bytes:** 6657
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ReportsHubView
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, react
- **Internal imports (5):** @/components/brand/text, @/lib/utils, @/components/brand/card, @/features/reports/export, @/features/reports/queries
- **Domain terms:** Investor, KYC, investor, issuer, kyc, mandate, matching, scorecard

## `src/app/reports/compliance/page.tsx`

- **Lines:** 320 | **Bytes:** 12354
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (8):** @/lib/rbac, @/features/reports/queries, @/features/reports, @/components/brand, @/components/brand/chart-theme, @/components/brand/money, ../_components/report-charts, @/components/brand/page-shell
- **Domain terms:** KYC, kyc

## `src/app/reports/credit/page.tsx`

- **Lines:** 126 | **Bytes:** 4082
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (9):** @/lib/rbac, @/features/reports/queries, @/features/reports, @/components/brand, @/components/brand/chart-theme, @/features/reports/export, ../_components/report-charts, ../_components/credit-report-view, @/components/brand/page-shell
- **Domain terms:** BC-1, BC-6, Scorecard, issuer, scorecard

## `src/app/reports/export/route.ts`

- **Lines:** 391 | **Bytes:** 15263
- **Kind:** API route handler
- **Header intent:** Reports & Export - CSV export Route Handler.  GET /reports/export?type=<kind>[&<filter params...>] runs the matching query (reusing the feature `list*` queries for per-module exports so the CSV always matches the on-screen filtered list) and returns an RFC 4180 CSV attachment. The browser handles the download natively via the `Content-Disposition: attachment` header - no client-side blob code, no function props crossing the RSC boundary. The on-page "Export CSV" buttons are plain anchors to this
- **Exported functions:** GET
- **Exported const:** dynamic
- **Exported types:** ExportKind
- **Security signals:** auth, rbac/rls, india-compliance
- **Internal imports (11):** @/lib/rbac, @/features/parties/queries, @/features/deals/queries, @/features/credit/queries, @/features/compliance/queries, @/features/interactions/queries, @/features/tasks/queries, @/features/documents/queries, @/features/reports/queries, @/features/reports/export, @/features/reports/exportAccess
- **Domain terms:** Issuer, KYC, Party, kyc, matching, party


# Batch 051

## `src/app/reports/loading.tsx`

- **Lines:** 8 | **Bytes:** 346
- **Kind:** Application module
- **Default export:** yes
- **Internal imports (1):** @/components/brand

## `src/app/reports/page.tsx`

- **Lines:** 24 | **Bytes:** 964
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/reports/queries, @/components/brand, ./_components/reports-hub-view

## `src/app/reports/pipeline/page.tsx`

- **Lines:** 285 | **Bytes:** 10476
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (9):** @/lib/rbac, @/features/reports/queries, @/features/reports, @/components/brand, @/components/brand/chart-theme, @/components/brand/money, @/features/reports/export, ../_components/report-charts, @/components/brand/page-shell
- **Domain terms:** mandate

## `src/app/reports/revenue/page.tsx`

- **Lines:** 278 | **Bytes:** 10506
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (9):** @/lib/rbac, @/features/reports/queries, @/features/reports, @/components/brand, @/components/brand/chart-theme, @/components/brand/money, @/features/reports/export, ../_components/report-charts, @/components/brand/page-shell
- **Domain terms:** mandate


# Batch 052

## `src/app/tasks/[id]/page.tsx`

- **Lines:** 416 | **Bytes:** 14683
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **External deps:** next/link, next/navigation
- **Internal imports (7):** @/components/brand/icons, @/lib/rbac, @/features/tasks/queries, @/components/brand, @/components/brand/text, ./task-status-form, @/components/brand/page-shell
- **Domain terms:** Party

## `src/app/tasks/[id]/task-status-form.tsx`

- **Lines:** 81 | **Bytes:** 2696
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** TaskStatusForm
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (3):** @/lib/utils, @/components/brand/button, @/features/tasks/actions

## `src/app/tasks/new-task-dialog.tsx`

- **Lines:** 376 | **Bytes:** 13331
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** NewTaskDialog
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (5):** @/components/ui/dialog, @/lib/utils, @/components/brand/button, @/components/brand/text, @/features/tasks/actions
- **Domain terms:** Party

## `src/app/tasks/page.tsx`

- **Lines:** 77 | **Bytes:** 2135
- **Kind:** Next.js page route
- **Exported const:** dynamic, STATUS_FILTERS
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (5):** @/components/brand/page-shell, @/lib/rbac, @/features/tasks/queries, @/components/brand, ./tasks-list-view


# Batch 053

## `src/app/tasks/tasks-list-view.tsx`

- **Lines:** 538 | **Bytes:** 17274
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** TasksListView
- **Exported types:** TasksListViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (6):** @/lib/utils, @/features/tasks/queries, @/components/brand, @/components/brand/money, @/features/reports/export-button, ./new-task-dialog

## `src/components/brand/badge.tsx`

- **Lines:** 175 | **Bytes:** 5876
- **Kind:** Brand design-system component
- **Exported types:** BadgeProps, ActionType, ActionBadgeProps
- **Security signals:** india-compliance
- **External deps:** class-variance-authority, react
- **Internal imports (1):** @/lib/utils

## `src/components/brand/button.tsx`

- **Lines:** 140 | **Bytes:** 3759
- **Kind:** Brand design-system component
- **Exported types:** ButtonProps
- **Security signals:** india-compliance
- **External deps:** class-variance-authority, react
- **Internal imports (1):** @/lib/utils

## `src/components/brand/card.tsx`

- **Lines:** 128 | **Bytes:** 3087
- **Kind:** Brand design-system component
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (1):** @/lib/utils


# Batch 054

## `src/components/brand/chart-theme.tsx`

- **Lines:** 258 | **Bytes:** 8813
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ChartAreaGradient, ChartStrokeGradient, ChartTooltip, ChartCard
- **Exported const:** CHART_GRID_STROKE, CHART_AXIS_TICK, CHART_STROKE_WIDTH, CHART_EASE, CHART_GRID_PROPS, CHART_XAXIS_PROPS, CHART_YAXIS_PROPS, CHART_CURSOR, CHART_SERIES, CHART_ACTIVE_DOT
- **Exported types:** ChartTooltipProps
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (2):** @/lib/utils, @/components/brand/card

## `src/components/brand/command-bar.tsx`

- **Lines:** 231 | **Bytes:** 8055
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** CommandBar
- **Exported types:** CommandBarProps
- **DB ops patterns:** update
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (3):** @/lib/utils, @/components/brand/text, @/components/brand/table

## `src/components/brand/empty-state.tsx`

- **Lines:** 81 | **Bytes:** 1913
- **Kind:** Brand design-system component
- **Exported types:** EmptyStateProps
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (1):** @/lib/utils

## `src/components/brand/icon-language.tsx`

- **Lines:** 452 | **Bytes:** 16971
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** BinaryBMark, BondCouponMark, RatingLadderMark, ExposureGaugeMark, MandateMark, KycShieldMark, GSecRupeeMark
- **Exported const:** IconTile, ICON
- **Exported types:** IconTone, IconSize, IconTileProps, MarkProps, IconKey, IconMarkComponentProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (1):** @/lib/utils
- **Domain terms:** KYC, bond, gsec, issuer, kyc, mandate, matching, party


# Batch 055

## `src/components/brand/icons.tsx`

- **Lines:** 184 | **Bytes:** 3072
- **Kind:** Client component
- **Directive:** `use client`
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react
- **Domain terms:** kyc

## `src/components/brand/index.ts`

- **Lines:** 136 | **Bytes:** 4616
- **Kind:** Brand design-system component
- **Header intent:** Brand primitives - Stripe-level day theme building blocks.
- **Security signals:** india-compliance
- **Internal imports (30):** @/components/brand/card, @/components/brand/button, @/components/brand/button, @/components/brand/table, @/components/brand/table, @/components/brand/badge, @/components/brand/badge, @/components/brand/empty-state, @/components/brand/empty-state, @/components/brand/text, @/components/brand/page-shell, @/components/brand/skeleton, @/components/brand/stat-card, @/components/brand/stat-card, @/components/brand/score-ring, @/components/brand/score-ring, @/components/brand/money, @/components/brand/money, @/components/brand/command-bar, @/components/brand/command-bar, @/components/brand/reveal, @/components/brand/input, @/components/brand/select, @/components/brand/tabs, @/components/brand/chart-theme…
- **Domain terms:** KYC, bond, mandate

## `src/components/brand/input.tsx`

- **Lines:** 81 | **Bytes:** 2858
- **Kind:** Brand design-system component
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (1):** @/lib/utils

## `src/components/brand/money.tsx`

- **Lines:** 176 | **Bytes:** 5326
- **Kind:** Brand design-system component
- **Exported functions:** formatMoney, compactINR, Money, Num
- **Exported const:** FORMAT_PRESETS
- **Exported types:** MoneyOptions, FormatPreset, MoneyProps
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (1):** @/lib/utils


# Batch 056

## `src/components/brand/page-shell.tsx`

- **Lines:** 138 | **Bytes:** 3679
- **Kind:** Brand design-system component
- **Exported functions:** PageShell, PageHeader, DetailTopBar, KpiStrip
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (1):** @/lib/utils

## `src/components/brand/page-transition.tsx`

- **Lines:** 58 | **Bytes:** 2096
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** PageTransition
- **External deps:** framer-motion, next/navigation, react
- **Internal imports (1):** @/lib/utils

## `src/components/brand/preview-pane.tsx`

- **Lines:** 138 | **Bytes:** 5909
- **Kind:** Brand design-system component
- **Exported functions:** PreviewPane
- **Exported types:** PreviewPaneProps
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (3):** @/components/brand/text, @/lib/utils, @/components/brand/card
- **Domain terms:** Issuer, KYC

## `src/components/brand/reveal.tsx`

- **Lines:** 119 | **Bytes:** 2834
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** Reveal, Stagger, StaggerItem
- **Exported const:** staggerContainer, staggerItem
- **Exported types:** RevealProps
- **External deps:** framer-motion, react
- **Internal imports (1):** @/lib/utils


# Batch 057

## `src/components/brand/score-ring.tsx`

- **Lines:** 183 | **Bytes:** 6309
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ScoreRing
- **Exported types:** ScoreRingProps
- **Security signals:** india-compliance
- **External deps:** framer-motion, react
- **Internal imports (2):** @/lib/utils, @/components/brand/money
- **Domain terms:** bond

## `src/components/brand/select.tsx`

- **Lines:** 238 | **Bytes:** 7585
- **Kind:** Client component
- **Directive:** `use client`
- **Security signals:** india-compliance
- **External deps:** @base-ui/react/select, @phosphor-icons/react, react
- **Internal imports (1):** @/lib/utils

## `src/components/brand/skeleton.tsx`

- **Lines:** 222 | **Bytes:** 6685
- **Kind:** Brand design-system component
- **Exported functions:** SkeletonCard, SkeletonBoard, SkeletonPage
- **Exported const:** Skeleton
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (1):** @/lib/utils
- **Domain terms:** KYC, matching

## `src/components/brand/stat-card.tsx`

- **Lines:** 189 | **Bytes:** 6081
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** StatCard
- **Exported types:** StatCardProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, react
- **Internal imports (4):** @/lib/utils, @/components/brand/card, @/components/brand/text, @/components/brand/money
- **Domain terms:** BC-1


# Batch 058

## `src/components/brand/table.tsx`

- **Lines:** 246 | **Bytes:** 6669
- **Kind:** Client component
- **Directive:** `use client`
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (2):** @/lib/utils, @/components/brand/empty-state
- **Domain terms:** KYC, party

## `src/components/brand/tabs.tsx`

- **Lines:** 83 | **Bytes:** 2713
- **Kind:** Client component
- **Directive:** `use client`
- **Security signals:** india-compliance
- **External deps:** @base-ui/react/tabs, react
- **Internal imports (1):** @/lib/utils

## `src/components/brand/text.tsx`

- **Lines:** 121 | **Bytes:** 3034
- **Kind:** Brand design-system component
- **Exported functions:** Eyebrow, SectionHeading, PageHeader
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (1):** @/lib/utils

## `src/components/notification-bell.tsx`

- **Lines:** 326 | **Bytes:** 11821
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** NotificationBell
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, next/navigation, react
- **Internal imports (6):** @/features/workflow/actions, @/features/workflow/types, @/lib/utils, @/components/brand/text, @/features/workflow/actions, @/features/workflow/types
- **Domain terms:** KYC


# Batch 059

## `src/components/site-nav.tsx`

- **Lines:** 920 | **Bytes:** 38915
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** SiteNav
- **DB ops patterns:** update
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/image, next/link, next/navigation, react
- **Internal imports (5):** ./logo.png, @/lib/utils, @/app/actions/auth, @/components/ui/dropdown-menu, @/components/notification-bell
- **Domain terms:** Matching, Onboarding, investor, kyc, matching, onboarding

## `src/components/theme-provider.tsx`

- **Lines:** 11 | **Bytes:** 299
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ThemeProvider
- **External deps:** next-themes, react

## `src/components/ui/badge.tsx`

- **Lines:** 52 | **Bytes:** 1925
- **Kind:** shadcn/ui primitive
- **Security signals:** india-compliance
- **External deps:** @base-ui/react/merge-props, @base-ui/react/use-render, class-variance-authority
- **Internal imports (1):** @/lib/utils

## `src/components/ui/button.tsx`

- **Lines:** 58 | **Bytes:** 3240
- **Kind:** shadcn/ui primitive
- **Security signals:** india-compliance
- **External deps:** @base-ui/react/button, class-variance-authority
- **Internal imports (1):** @/lib/utils


# Batch 060

## `src/components/ui/card.tsx`

- **Lines:** 103 | **Bytes:** 2630
- **Kind:** shadcn/ui primitive
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (1):** @/lib/utils

## `src/components/ui/dialog.tsx`

- **Lines:** 160 | **Bytes:** 4075
- **Kind:** Client component
- **Directive:** `use client`
- **Security signals:** india-compliance
- **External deps:** @base-ui/react/dialog, lucide-react, react
- **Internal imports (2):** @/lib/utils, @/components/ui/button

## `src/components/ui/dropdown-menu.tsx`

- **Lines:** 268 | **Bytes:** 8736
- **Kind:** Client component
- **Directive:** `use client`
- **Security signals:** india-compliance
- **External deps:** @base-ui/react/menu, lucide-react, react
- **Internal imports (1):** @/lib/utils

## `src/components/ui/input.tsx`

- **Lines:** 20 | **Bytes:** 1040
- **Kind:** shadcn/ui primitive
- **External deps:** @base-ui/react/input, react
- **Internal imports (1):** @/lib/utils


# Batch 061

## `src/components/ui/label.tsx`

- **Lines:** 20 | **Bytes:** 518
- **Kind:** Client component
- **Directive:** `use client`
- **External deps:** react
- **Internal imports (1):** @/lib/utils

## `src/components/ui/select.tsx`

- **Lines:** 201 | **Bytes:** 6655
- **Kind:** Client component
- **Directive:** `use client`
- **Security signals:** india-compliance
- **External deps:** @base-ui/react/select, lucide-react, react
- **Internal imports (1):** @/lib/utils

## `src/components/ui/separator.tsx`

- **Lines:** 25 | **Bytes:** 545
- **Kind:** Client component
- **Directive:** `use client`
- **External deps:** @base-ui/react/separator
- **Internal imports (1):** @/lib/utils

## `src/components/ui/sheet.tsx`

- **Lines:** 138 | **Bytes:** 4433
- **Kind:** Client component
- **Directive:** `use client`
- **Security signals:** india-compliance
- **External deps:** @base-ui/react/dialog, lucide-react, react
- **Internal imports (2):** @/lib/utils, @/components/ui/button


# Batch 062

## `src/components/ui/sonner.tsx`

- **Lines:** 49 | **Bytes:** 1226
- **Kind:** Client component
- **Directive:** `use client`
- **External deps:** lucide-react, next-themes, sonner

## `src/components/ui/table.tsx`

- **Lines:** 116 | **Bytes:** 2402
- **Kind:** Client component
- **Directive:** `use client`
- **Security signals:** india-compliance
- **External deps:** react
- **Internal imports (1):** @/lib/utils

## `src/components/ui/tabs.tsx`

- **Lines:** 82 | **Bytes:** 3497
- **Kind:** Client component
- **Directive:** `use client`
- **Security signals:** india-compliance
- **External deps:** @base-ui/react/tabs, class-variance-authority
- **Internal imports (1):** @/lib/utils

## `src/db/context.ts`

- **Lines:** 159 | **Bytes:** 7893
- **Kind:** DB infrastructure
- **Header intent:** RLS context helper - sets Postgres session GUCs per-transaction so Row Level Security policies on `deal`, `deal_party`, `allocation_event`, `credit_*`, `interaction`, `document`, `party` can consult them (ARCHITECTURE §4.4).  GUCs: app.user_id      text         - the acting app_user.user_id (uuid as text) app.wall         text[]       - barrier clearance tags (ABAC compartments) app.mandate_ids  uuid[]       - deals the user is staffed on (mandate scope)  Per §4.4, arrays are set directly as Pos
- **Exported functions:** withContext, withRls, withRlsRead
- **Security signals:** rbac/rls
- **External deps:** drizzle-orm
- **Internal imports (1):** @/db
- **Domain terms:** barrier, mandate, party


# Batch 063

## `src/db/domain-check.ts`

- **Lines:** 165 | **Bytes:** 7145
- **Kind:** DB infrastructure
- **Header intent:** Domain-logic smoke check - exercises the real modeling/credit/scorecard code paths against a sample instrument and seeded DB rows, then prints results so a human can eyeball whether the values are sane.  Run:  npx tsx src/db/domain-check.ts
- **DB ops patterns:** from, select, where
- **External deps:** drizzle-orm, node:fs, node:path
- **Internal imports (3):** @/features/modeling/bondPricing, @/features/credit/ratios, @/features/credit/scorecard
- **Domain terms:** BOND, GSEC, SCORECARD, credit_analysis, scorecard

## `src/db/index.ts`

- **Lines:** 68 | **Bytes:** 2986
- **Kind:** DB infrastructure
- **Exported const:** db
- **Exported types:** DB
- **Security signals:** india-compliance
- **External deps:** drizzle-orm/postgres-js, postgres
- **Internal imports (1):** ./schema

## `src/db/rls.ts`

- **Lines:** 363 | **Bytes:** 11644
- **Kind:** DB infrastructure
- **Header intent:** RLS apply + verify helper (Track B / RLS).  Pairs with drizzle/0003_rls.sql. The migration provisions: - a non-superuser, non-BYPASSRLS app role `crm_app`; - ENABLE + FORCE ROW LEVEL SECURITY on the 16 walled tables; - GUC-driven policies (app.user_id, app.wall text[], app.mandate_ids uuid[]); - an immutable, tamper-evident audit_log (INSERT-only + sha256 hash chain); - GRANTs: SELECT/INSERT/UPDATE on operational tables, INSERT-only on audit_log.  `applyRlsMigration()` reads the SQL file and exe
- **Exported functions:** applyRlsMigration, verifyRls
- **Exported const:** WALLED_TABLES
- **Exported types:** RlsTableStatus, RlsVerifyReport
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm, node:fs/promises, node:path, node:url
- **Internal imports (1):** @/db
- **Domain terms:** barrier, credit_analysis, party

## `src/db/schema/audit.ts`

- **Lines:** 129 | **Bytes:** 5519
- **Kind:** Drizzle DB schema; Schema tables: audit_log
- **Header intent:** audit_log - IMMUTABLE, INSERT-only (§1.3, §2.22, ARCHITECTURE §5.1). Append-only: enforced by RLS (no UPDATE/DELETE policy for any role) plus a Postgres trigger that rejects any non-INSERT on the table. The `audit_purge` role is the only role with DELETE, used by a documented, signed-off retention purge job (§5.6).  RANGE PARTITIONING by occurred_at (monthly partitions: audit_log_y2026m01, …) - Drizzle cannot declare partitioning in the table definition, so the table is created as a normal table
- **Exported const:** auditLog, auditLogRelations
- **Exported types:** AuditLog, AuditLogInsert
- **pgTable:** audit_log
- **Security signals:** rbac/rls
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (3):** ./enums, ./rbac, ./information_barrier
- **Domain terms:** barrier


# Batch 064

## `src/db/schema/auth.ts`

- **Lines:** 159 | **Bytes:** 7058
- **Kind:** Drizzle DB schema; Schema tables: users, accounts, sessions, verification_tokens, authenticators
- **Header intent:** Auth.js v5 identity tables (users / accounts / sessions / verificationTokens / authenticators) - the standard @auth/drizzle-adapter shape.  LINKAGE DESIGN (app_user ↔ users): the 1:1 link is `users.app_user_id` → `app_user.user_id`. The column is declared here as a plain `uuid` (NOT via Drizzle `references()`) and the FK constraint is added via raw SQL in a migration - see the MIGRATION NOTE below. Reason: `app_user` participates in a mutual FK cycle with `contact` (contact.created_by_user_id → 
- **Exported const:** users, accounts, sessions, verificationTokens, authenticators
- **Exported types:** AuthUser, AuthUserInsert, AuthAccount, AuthAccountInsert, AuthSession, AuthSessionInsert, AuthVerificationToken, AuthVerificationTokenInsert, Authenticator, AuthenticatorInsert
- **pgTable:** users, accounts, sessions, verification_tokens, authenticators
- **Security signals:** rbac/rls, credentials
- **External deps:** drizzle-orm/pg-core

## `src/db/schema/compliance.ts`

- **Lines:** 175 | **Bytes:** 6299
- **Kind:** Drizzle DB schema; Schema tables: consent_record, data_subject_request
- **Header intent:** Compliance: consent_record (DPDP Act 2023) + data_subject_request. DATA_MODEL §2.21, §2.23.8. Consent is purpose-bound - a marketing consent does not authorize sharing data with a rating agency; that requires its own consent_record. Withdrawal triggers a data_subject_request workflow.
- **Exported const:** consentRecord, dataSubjectRequest, consentRecordRelations, dataSubjectRequestRelations
- **Exported types:** ConsentRecord, ConsentRecordInsert, DataSubjectRequest, DataSubjectRequestInsert
- **pgTable:** consent_record, data_subject_request
- **DB ops patterns:** where
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (4):** ./enums, ./rbac, ./party, ./contact
- **Domain terms:** party

## `src/db/schema/contact.ts`

- **Lines:** 179 | **Bytes:** 6641
- **Kind:** Drizzle DB schema; Schema tables: contact, party_contact
- **Header intent:** Contact (natural person) + party_contact (role link with interval). DATA_MODEL §2.4-2.5. Contacts are decoupled from parties; roles are the link. We never delete a contact when they leave a firm - we close the PartyContact interval (§1.2).
- **Exported const:** contact, partyContact, contactRelations, partyContactRelations
- **Exported types:** Contact, ContactInsert, PartyContact, PartyContactInsert
- **pgTable:** contact, party_contact
- **DB ops patterns:** where
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (3):** ./enums, ./rbac, ./party
- **Domain terms:** party

## `src/db/schema/credit.ts`

- **Lines:** 989 | **Bytes:** 38016
- **Kind:** Drizzle DB schema; Schema tables: sector_code, credit_analysis, financial_statement, credit_analysis_fs_link, ratio_result, scorecard_template, scorecard, credit_score, external_rating, rating_ladder, exposure, credit_limit, kyc_record, kyc_beneficial_owner
- **Header intent:** Credit analysis subsystem. DATA_MODEL §2.12-2.16, §2.20, §2.23.6-2.23.7. CREDIT_ANALYSIS_SPEC §13.  Tables: sector_code, credit_analysis, financial_statement, credit_analysis_fs_link (junction), ratio_result, credit_score, scorecard, scorecard_template, external_rating, rating_ladder, exposure, credit_limit, kyc_record, kyc_beneficial_owner (junction).  Interpretation note: DATA_MODEL §2.23.6 `scorecard` carries factor_weights (a template), while CREDIT_ANALYSIS_SPEC §13 distinguishes `Scorecard
- **Exported const:** sectorCode, creditAnalysis, financialStatement, creditAnalysisFsLink, ratioResult, scorecardTemplate, scorecard, creditScore, externalRating, ratingLadder, exposure, creditLimit, kycRecord, kycBeneficialOwner, sectorCodeRelations, creditAnalysisRelations, financialStatementRelations, creditAnalysisFsLinkRelations, ratioResultRelations, scorecardTemplateRelations, scorecardRelations, creditScoreRelations, externalRatingRelations, ratingLadderRelations, exposureRelations, creditLimitRelations, kycRecordRelations, kycBeneficialOwnerRelations
- **Exported types:** SectorCode, SectorCodeInsert, CreditAnalysis, CreditAnalysisInsert, FinancialStatement, FinancialStatementInsert, CreditAnalysisFsLink, CreditAnalysisFsLinkInsert, RatioResult, RatioResultInsert, ScorecardTemplate, ScorecardTemplateInsert, Scorecard, ScorecardInsert, CreditScore, CreditScoreInsert, ExternalRating, ExternalRatingInsert, RatingLadder, RatingLadderInsert, Exposure, ExposureInsert, CreditLimit, CreditLimitInsert, KycRecord, KycRecordInsert, KycBeneficialOwner, KycBeneficialOwnerInsert
- **pgTable:** sector_code, credit_analysis, financial_statement, credit_analysis_fs_link, ratio_result, scorecard_template, scorecard, credit_score, external_rating, rating_ladder, exposure, credit_limit, kyc_record, kyc_beneficial_owner
- **DB ops patterns:** where
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (8):** ./enums, ./rbac, ./party, ./deals, ./deals, ./information_barrier, ./contact, ./documents
- **Domain terms:** KYC, Scorecard, barrier, credit_analysis, issuer, mandate, party, scorecard


# Batch 065

## `src/db/schema/deals.ts`

- **Lines:** 464 | **Bytes:** 17216
- **Kind:** Drizzle DB schema; Schema tables: instrument, deal, deal_party, allocation_event, trade_event
- **Header intent:** Deals: instrument, deal, deal_party, allocation_event, trade_event. DATA_MODEL §2.9-2.11, §2.16, §2.23.3. Allocation and trade events are IMMUTABLE append-only (§1.3, §2.11, §2.23.3) - post-pricing rows are frozen; corrections append a new compensating event. This is the regulator-grade trade-record pattern for CCIL/NDS-OM reportable trades (§2.11).
- **Exported const:** instrument, deal, dealParty, allocationEvent, tradeEvent, instrumentRelations, dealRelations, dealPartyRelations, allocationEventRelations, tradeEventRelations
- **Exported types:** Instrument, InstrumentInsert, Deal, DealInsert, DealParty, DealPartyInsert, AllocationEvent, AllocationEventInsert, TradeEvent, TradeEventInsert
- **pgTable:** instrument, deal, deal_party, allocation_event, trade_event
- **DB ops patterns:** where
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (6):** ./enums, ./rbac, ./party, ./information_barrier, ./demat, ./documents
- **Domain terms:** Allocation, Underwriting, barrier, demat, investor, issuer, mandate, party

## `src/db/schema/demat.ts`

- **Lines:** 64 | **Bytes:** 2108
- **Kind:** Drizzle DB schema; Schema tables: demat_account
- **Header intent:** Demat account - investor depository account (§2.23.1, §3). NSDL `IN...` 8-char alphanumeric DP IDs vs CDSL 8-digit numeric. The dedup key is (dp_id, client_id, depository) WHERE deleted_at IS NULL. Referenced by allocation_event.demat_account_id and by party_identifier(identifier_type='demat_dp_client').
- **Exported const:** dematAccount, dematAccountRelations
- **Exported types:** DematAccount, DematAccountInsert
- **pgTable:** demat_account
- **DB ops patterns:** where
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (2):** ./enums, ./party
- **Domain terms:** Demat, demat, investor, party

## `src/db/schema/documents.ts`

- **Lines:** 113 | **Bytes:** 3798
- **Kind:** Drizzle DB schema; Schema tables: document
- **Header intent:** document - metadata only (§2.20). The file blob lives in S3-compatible object storage with a reference; KYC documents are encryption-at-rest + access-logged separately (ARCHITECTURE §4.3). barrier_id is the information-wall tag for RLS (§1.7).
- **Exported const:** document, documentRelations
- **Exported types:** Document, DocumentInsert
- **pgTable:** document
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (6):** ./enums, ./rbac, ./party, ./contact, ./deals, ./information_barrier
- **Domain terms:** KYC, barrier, party

## `src/db/schema/enums.ts`

- **Lines:** 768 | **Bytes:** 17146
- **Kind:** Drizzle DB schema; Enums: party_type, party_status, party_nature, brand, data_source, identifier_type, regn_category, relationship_type, depository, demat_status, deal_type, deal_status
- **Header intent:** Enums and shared column primitives for the Binary Capital / Binary Bonds CRM schema. Source of truth: /home/Jashmhta/crm/docs/DATA_MODEL.md §6 (enumerations) + inline enum mentions throughout §2 and §3, plus /home/Jashmhta/crm/docs/CREDIT_ANALYSIS_SPEC.md §13.  NOTE on `citext`: PostgreSQL's case-insensitive text type. Requires `CREATE EXTENSION IF NOT EXISTS citext;` in a baseline migration before tables using it are created. The customType below emits the literal SQL type `citext` so drizzle-k
- **Exported const:** citext, partyTypeEnum, partyStatusEnum, partyNatureEnum, brandEnum, dataSourceEnum, identifierTypeEnum, regnCategoryEnum, relationshipTypeEnum, depositoryEnum, dematStatusEnum, dealTypeEnum, dealStatusEnum, dealPartyRoleEnum, allocEventTypeEnum, priceTypeEnum, auctionBidTypeEnum, allocSourceChannelEnum, instrumentTypeEnum, exchangeEnum, couponTypeEnum, frequencyEnum, dayCountEnum, settlementEnum, tradeSideEnum, kycStatusEnum, kycTypeEnum, kycRiskEnum, kycCategoryEnum, pepEnum…
- **pgEnum:** party_type, party_status, party_nature, brand, data_source, identifier_type, regn_category, relationship_type, depository, demat_status, deal_type, deal_status, deal_party_role, alloc_event_type, price_type, auction_bid_type, alloc_source_channel, instrument_type, exchange, coupon_type, frequency, day_count, settlement, trade_side, kyc_status, kyc_type, kyc_risk, kyc_category, pep, consent_purpose, consent_method, dsr_type, dsr_status, model_type, financial_ratio, score_component, obligor_type, credit_analysis_type, internal_rating_action, outlook, rating_action, rating_agency, rating_scale, exposure_type, limit_type, scorecard_status, period_type, statement_type, units, fs_source, fs_link_role, interaction_channel, interaction_direction, attendee_role, document_type, task_status, task_priority, salutation, contact_role, address_type, tag_category, tag_target, segment_class, desk, audit_op, dedup_status, fema_residential_status
- **Security signals:** india-compliance
- **External deps:** drizzle-orm/pg-core
- **Domain terms:** Allocation, Demat, KYC, Party, allocation, binarybonds, binarycapital, bond, credit_analysis, deal_status, gsec, investor, issuer, onboarding, party


# Batch 066

## `src/db/schema/index.ts`

- **Lines:** 41 | **Bytes:** 1964
- **Kind:** Drizzle DB schema
- **Header intent:** Drizzle schema entry point - re-exports all modules. Source of truth: /home/Jashmhta/crm/docs/DATA_MODEL.md (full domain model), /home/Jashmhta/crm/docs/CREDIT_ANALYSIS_SPEC.md §13 (ScorecardTemplate & SectorCode), and /home/Jashmhta/crm/docs/ARCHITECTURE.md §4-5 (RLS / information-barrier + immutable audit intent).  Order matters for foreign-key resolution - Drizzle resolves `references()` lambdas lazily, so cross-module FKs compile as long as every referenced table is exported through this ind
- **Security signals:** rbac/rls, india-compliance
- **Internal imports (16):** ./enums, ./rbac, ./information_barrier, ./party, ./contact, ./relationship, ./demat, ./deals, ./credit, ./modeling, ./compliance, ./interactions, ./tasks, ./documents, ./audit, ./auth
- **Domain terms:** barrier, credit_analysis, demat, party, scorecard

## `src/db/schema/information_barrier.ts`

- **Lines:** 128 | **Bytes:** 5343
- **Kind:** Drizzle DB schema; Schema tables: information_barrier
- **Header intent:** Information barrier (Chinese wall) - DATA_MODEL §1.7, §2.23.2. ARCHITECTURE §4.4-4.5: RLS policies tag rows by barrier_id on deal, party, interaction, document, credit_analysis, allocation_event. This table is the wall registry; lifting is audited and `lifted_at` null = active.
- **Exported const:** informationBarrier, informationBarrierRelations
- **Exported types:** InformationBarrier, InformationBarrierInsert
- **pgTable:** information_barrier
- **DB ops patterns:** where
- **Security signals:** rbac/rls
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (4):** ./enums, ./deals, ./party, ./rbac
- **Domain terms:** Party, barrier, credit_analysis, issuer, mandate, party

## `src/db/schema/interactions.ts`

- **Lines:** 183 | **Bytes:** 6310
- **Kind:** Drizzle DB schema; Schema tables: interaction, interaction_attendee
- **Header intent:** interactions: interaction + interaction_attendee (junction). DATA_MODEL §2.18. An interaction must anchor to at least one of a party, a deal, or a contact (CHECK num_nonnulls >= 1). MNPI interactions are walled via barrier_id (§1.7). Attendees are a junction (replacing the former attendee_contact_ids uuid[] array - §2.18).
- **Exported const:** interaction, interactionAttendee, interactionRelations, interactionAttendeeRelations
- **Exported types:** Interaction, InteractionInsert, InteractionAttendee, InteractionAttendeeInsert
- **pgTable:** interaction, interaction_attendee
- **DB ops patterns:** where
- **Security signals:** rbac/rls
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (6):** ./enums, ./rbac, ./party, ./contact, ./deals, ./information_barrier
- **Domain terms:** barrier, party

## `src/db/schema/modeling.ts`

- **Lines:** 116 | **Bytes:** 4291
- **Kind:** Drizzle DB schema; Schema tables: financial_model
- **Header intent:** financial_model - versioned, type-specific financial models (§2.17). Inputs and outputs are JSONB; the engine is pluggable but the *shape* is constrained by model_type. Per-type output schemas (bond_pricing, project_finance, securitization, dcf, m_and_a, lbo) are enforced by CHECK constraints / JSON schema at the app layer (§2.17).
- **Exported const:** financialModel, financialModelRelations
- **Exported types:** FinancialModel, FinancialModelInsert
- **pgTable:** financial_model
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (5):** ./enums, ./rbac, ./party, ./deals, ./credit
- **Domain terms:** party


# Batch 067

## `src/db/schema/party.ts`

- **Lines:** 460 | **Bytes:** 17649
- **Kind:** Drizzle DB schema; Schema tables: party, party_type_assignment, party_identifier, address, party_duplicate_candidate
- **Header intent:** Party master + typing + canonical identifiers + address. DATA_MODEL §2.1-2.3, §2.23.9, §3 (Indian-specific fields), §1.4 (dedup). The party master is the single source of truth - no deal/contact/exposure/ credit record references free-text names; all reference party_id (§1.1).
- **Exported const:** party, partyTypeAssignment, partyIdentifier, address, partyDuplicateCandidate, partyRelations, partyTypeAssignmentRelations, partyIdentifierRelations, addressRelations, partyDuplicateCandidateRelations
- **Exported types:** Party, PartyInsert, PartyTypeAssignment, PartyTypeAssignmentInsert, PartyIdentifier, PartyIdentifierInsert, Address, AddressInsert, PartyDuplicateCandidate, PartyDuplicateCandidateInsert
- **pgTable:** party, party_type_assignment, party_identifier, address, party_duplicate_candidate
- **DB ops patterns:** where
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (4):** ./enums, ./rbac, ./information_barrier, ./credit
- **Domain terms:** Party, barrier, party

## `src/db/schema/rbac.ts`

- **Lines:** 319 | **Bytes:** 11897
- **Kind:** Drizzle DB schema; Schema tables: app_user, role, permission, role_permission, user_role
- **Header intent:** RBAC - app_user, role, permission, role_permission, user_role. DATA_MODEL §2.8, §2.23.12. ARCHITECTURE §4.2: RBAC baseline + ABAC attributes (wall/compartment, mandate_id, client_id). Time-bounded roles matter because secondees and temps rotate through the credit desk.
- **Exported const:** appUser, role, permission, rolePermission, userRole, appUserRelations, roleRelations, permissionRelations, rolePermissionRelations, userRoleRelations
- **Exported types:** AppUser, AppUserInsert, Role, RoleInsert, Permission, PermissionInsert, UserRole, UserRoleInsert
- **pgTable:** app_user, role, permission, role_permission, user_role
- **DB ops patterns:** where
- **Security signals:** rbac/rls, credentials, india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (3):** ./enums, ./party, ./contact
- **Domain terms:** barrier, kyc, party

## `src/db/schema/relationship.ts`

- **Lines:** 98 | **Bytes:** 3631
- **Kind:** Drizzle DB schema; Schema tables: relationship
- **Header intent:** Relationship - org hierarchy / beneficial-ownership edges (§1.5, §2.6). parent_party_id / child_party_id directed edge. relationship_type ∈ {wholly_owned, subsidiary, associate, jv, promoter, beneficial_owner, guarantor, sister_concern, management_control}. Ultimate parent is computed via a recursive CTE; party.ultimate_parent_party_id is a denormalized cache refreshed on edge change (§1.5). A beneficial_owner edge with ownership_pct >= 10 triggers EDD review (PMLA).
- **Exported const:** relationship, relationshipRelations
- **Exported types:** Relationship, RelationshipInsert
- **pgTable:** relationship
- **DB ops patterns:** where
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (3):** ./enums, ./party, ./documents
- **Domain terms:** party

## `src/db/schema/tasks.ts`

- **Lines:** 145 | **Bytes:** 4686
- **Kind:** Drizzle DB schema; Schema tables: task, task_dependency
- **Header intent:** task - standard task model (§2.19). Tasks auto-generate from deal-stage transitions (e.g., entering `rating_marketing` creates "Coordinate agency management meeting" tasks per agency). depends_on is modeled as a separate junction table (task_dependency) to preserve FK integrity - an array could not.
- **Exported const:** task, taskDependency, taskRelations, taskDependencyRelations
- **Exported types:** Task, TaskInsert, TaskDependency, TaskDependencyInsert
- **pgTable:** task, task_dependency
- **DB ops patterns:** where
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (4):** ./enums, ./rbac, ./party, ./deals
- **Domain terms:** party


# Batch 068

## `src/db/seed-admin.ts`

- **Lines:** 133 | **Bytes:** 4685
- **Kind:** DB infrastructure
- **Header intent:** Track B / AUTH - provision the seeded admin user with a REAL bcrypt-hashed password and MFA disabled.  Run:  npx tsx src/db/seed-admin.ts  Idempotent: looks up `app_user` by email (citext, case-insensitive) and - if found: sets password_hash, resets failed_login_count/locked_until, keeps MFA disabled, and ensures a current 'admin' role grant exists; - if not found: inserts a minimal active admin app_user row + the admin role grant, so this script is safe to run before src/db/seed.ts.  SECURITY: 
- **DB ops patterns:** from, insert, returning, select, update, where
- **Security signals:** rbac/rls, credentials
- **External deps:** node:fs, node:path
- **Domain terms:** BinaryCapital, binarycapital

## `src/db/seed-org-users.ts`

- **Lines:** 235 | **Bytes:** 6576
- **Kind:** DB infrastructure
- **Header intent:** Provision Binary Capital org roster from CEO meeting notes.  Super admins: Shray (both Capital + Bonds), Shahrukh (Capital), Rati (Bonds), Niraj (Bonds) Employees: Yash (Capital), Pranjali (Capital), Tashmit (Bonds)  Run:  npx tsx src/db/seed-org-users.ts Default password (rotate in prod): BinaryCrm!2026  Safe to re-run: upserts by email, refreshes role grants.
- **DB ops patterns:** from, insert, returning, select, update, where
- **Security signals:** rbac/rls, credentials
- **External deps:** bcryptjs, drizzle-orm, node:fs, node:path
- **Domain terms:** barrier, binarybonds, binarycapital, matching

## `src/db/seed-scale.ts`

- **Lines:** 716 | **Bytes:** 23285
- **Kind:** DB infrastructure
- **Header intent:** 10k-party scale seed + performance proof (IMPORT-PERF track).  Run:  npx tsx src/db/seed-scale.ts  This is a SEPARATE, additive seed - it does NOT replace the demo seed (src/db/seed.ts, 801 rows). It seeds ~10,000 scale parties + identifiers + types + addresses + contacts + party_contact + a modest set of deals / deal_party into the LIVE local Postgres (binary_crm), then runs a performance check that mirrors the production `listParties` query path (src/features/parties/queries.ts) - fuzzy name s
- **DB ops patterns:** delete, from, insert, returning, select, where
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, node:fs, node:path, node:perf_hooks
- **TODOs/FIXMEs:** s (the | s. We create
- **Domain terms:** binarybonds, binarycapital, investor, issuer, onboarding, party

## `src/db/seed.ts`

- **Lines:** 3750 | **Bytes:** 174947
- **Kind:** Server Actions module
- **Directive:** `use server`
- **Header intent:** Deterministic mock-data seed for the Binary Capital CRM.  Run:  npx tsx src/db/seed.ts  Connects via the shared `db` client (src/db/index.ts) and inserts a realistic Indian capital-markets dev dataset into the LIVE local Postgres (binary_crm). Re-runnable: TRUNCATEs every table (CASCADE) before inserting.  Determinism: a seeded mulberry32 PRNG drives every "random" choice so two runs produce identical rows (stable UUIDs come from the DB's gen_random_uuid() default - those differ per run, but the
- **DB ops patterns:** from, insert, returning, update, where
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm, node:fs, node:path
- **Internal imports (4):** ./schema, ../features/modeling/bondPricing, ../features/leads/types, ../features/onboarding/types
- **Domain terms:** Allocation, Bond, Investor, KYC, ONBOARDING, Onboarding, Party, allocation, barrier, binarybonds, binarycapital, bond, credit_analysis, demat, gsec, investor, issuer, kyc, mandate, matching, onboarding, party, scorecard, underwriting


# Batch 069

## `src/features/admin/actions.ts`

- **Lines:** 578 | **Bytes:** 19845
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createUser, updateUser, deactivateUser, updateRolePermissions
- **Exported types:** CreateUserState, UpdateUserState, DeactivateUserState, UpdateRolePermissionsState
- **Zod schemas:** createUserSchema, updateUserSchema, deactivateUserSchema, updateRolePermissionsSchema
- **DB ops patterns:** delete, from, innerJoin, insert, returning, select, update, where
- **Security signals:** auth, rbac/rls, credentials, india-compliance
- **External deps:** bcryptjs, drizzle-orm, next/cache, zod/v4
- **Internal imports (3):** @/lib/rbac, @/db, @/db/schema
- **Domain terms:** barrier

## `src/features/admin/index.ts`

- **Lines:** 51 | **Bytes:** 1172
- **Kind:** Application module
- **Header intent:** Admin Panel - feature barrel.  Re-exports the server data access + server actions so app routes import from one path. The admin views are server components that call the queries directly; the client views (users/roles/audit) import the actions + the row types they need.
- **Security signals:** rbac/rls, india-compliance
- **Internal imports (2):** ./queries, ./actions

## `src/features/admin/queries.ts`

- **Lines:** 593 | **Bytes:** 19947
- **Kind:** Feature data-access (queries)
- **Header intent:** Admin Panel - server-side data access.  READ-ONLY surface for the admin's forensic + management views: • users  - app_user joined to active user_role → role (email, desk, active, last_login, roles, barrier clearance). • roles  - role + its permission codes (role_permission → permission). • permissions - the full permission code catalogue. • master data - sector_code + rating_ladder reference rows, plus the enum value lists for deal_type / instrument_type / rating_agency (the enum values are the 
- **Exported functions:** listUsers, getUser, listRoles, listPermissions, listSectorCodes, listRatingLadder, countDealsByType, getSystemStats, getSystemHealth, listRecentAuditEntries, getAuditEntityBreakdown, getAuditOperationBreakdown, getTopAuditActors, listAuditEntityTypes, listAuditBarriers
- **Exported const:** DEAL_TYPES, INSTRUMENT_TYPES, RATING_AGENCIES, RATING_SCALES, DESKS
- **Exported types:** AdminUserRow, AdminRoleRow, AdminPermissionRow, SectorCodeRow, RatingLadderRow, EnumCountRow, SystemStats, SystemHealth
- **DB ops patterns:** from, leftJoin, select, where
- **Security signals:** rbac/rls, credentials, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (4):** @/db, @/db/schema, @/features/compliance/audit, @/features/compliance/audit
- **Domain terms:** barrier, gsec, party

## `src/features/ai/actions.ts`

- **Lines:** 44 | **Bytes:** 1752
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** fetchCreditSummary, fetchInteractionSummary
- **Security signals:** auth, india-compliance
- **Internal imports (4):** ./creditSummary, ./interactionSummary, @/lib/rbac, ./types
- **Domain terms:** party


# Batch 070

## `src/features/ai/clientInsights.ts`

- **Lines:** 455 | **Bytes:** 16472
- **Kind:** Application module
- **Header intent:** AI Features - Client insights engine.  For each party (counterparty / client), derive: - Relationship strength score (0..100): interaction volume (recency- weighted) + deal footprint + contact breadth. - Deal potential score (0..100): active mandate count + target size + interaction recency (a warmed-up relationship converts better). - Recommended next action (re-engage / advance mandate / committee / refresh KYC / deepen coverage / maintain), with a one-line rationale.  Deterministic heuristic 
- **Exported functions:** relationshipStrengthScore, dealPotentialScore, recommendAction, getClientInsights
- **Exported types:** ActionInput
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (4):** @/db, @/db/schema, @/lib/rbac-core, ./types
- **Domain terms:** KYC, bond, issuer, mandate, party

## `src/features/ai/creditSummary.ts`

- **Lines:** 748 | **Bytes:** 29278
- **Kind:** Application module
- **Header intent:** AI Features - Credit summary generator.  Given a credit_analysis + the latest period's ratios + the scorecard (band / score / PD), generate a three-paragraph credit memo summary: 1. Issuer description       - who the obligor is, sector, listing, domicile. 2. Financial highlights     - leverage / coverage / liquidity / profitability (or asset quality / capital for NBFCs & banks), with a trend line when a prior period exists. 3. Credit assessment        - internal band, score, indicative 1-yr PD, 
- **Exported functions:** generateCreditSummary, getCreditSummary
- **Exported types:** CreditSummaryRatios, CreditSummaryExternalRating, CreditSummaryInput
- **DB ops patterns:** from, select, where
- **External deps:** drizzle-orm
- **Internal imports (6):** @/db, @/db/schema, @/features/credit/queries, @/features/credit/scorecard, @/features/credit/ratios, ./types
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6, Issuer, bond, credit_analysis, issuer, mandate, party, scorecard

## `src/features/ai/index.ts`

- **Lines:** 58 | **Bytes:** 1774
- **Kind:** Application module
- **Header intent:** AI Features barrel - the "no external LLM" intelligence layer.  Four deterministic engines generate text + scores from structured CRM data: - creditSummary    : credit_analysis + ratios + scorecard → 3-paragraph memo. - interactionSummary: interaction notes → overview + key topics + action items. - clientInsights   : per-party relationship strength / deal potential / next action. - nextAction       : user-scoped 3-5 prioritised next-best-actions.  Server actions live in ./actions and should be i
- **Security signals:** india-compliance
- **Internal imports (5):** ./creditSummary, ./interactionSummary, ./clientInsights, ./nextAction, ./types
- **Domain terms:** credit_analysis, party, scorecard

## `src/features/ai/interactionSummary.ts`

- **Lines:** 493 | **Bytes:** 18009
- **Kind:** Application module
- **Header intent:** AI Features - Interaction summary generator.  Given a set of interaction notes (subject + body + channel + next_action), generate a summary with: - a 1-2 sentence overview, - 3-6 key topics (ranked by mention frequency across a domain vocabulary), - action items (extracted from next_action fields + imperative sentences in the body), - supporting counts (interaction count, channels, last interaction date).  Deterministic heuristic - no external LLM. The topic vocabulary is the Indian bond house /
- **Exported functions:** summarizeInteractions, summarizeOneInteraction, getInteractionSummary, getRecentInteractionSummaries
- **Exported types:** InteractionNote, InteractionSummaryInput
- **DB ops patterns:** from, leftJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (4):** @/db, @/db/schema, @/lib/rbac-core, ./types
- **Domain terms:** Allocation, Investor, KYC, Mandate, Underwriting, allocation, bond, demat, investor, kyc, mandate, onboarding, party, underwriting


# Batch 071

## `src/features/ai/nextAction.ts`

- **Lines:** 450 | **Bytes:** 16913
- **Kind:** Application module
- **Header intent:** AI Features - Next-best-action engine (user-scoped).  For the LOGGED-IN user, surface 3-5 prioritized next actions drawn from the five coverage-desk attention surfaces: 1. Task overdue            - a task assigned to the user past its due date. 2. Deal stuck              - a deal the user leads, idle past its stage SLA. 3. Credit committee pending - a credit analysis the user owns as analyst, awaiting a committee ruling. 4. KYC expiring            - a KYC re-KYC approaching due on a party that i
- **Exported functions:** getNextActions
- **Exported types:** NextActionsResult
- **DB ops patterns:** from, select, where
- **Security signals:** india-compliance
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/db/schema, ./types
- **Domain terms:** KYC, Mandate, issuer, mandate, party

## `src/features/ai/types.ts`

- **Lines:** 200 | **Bytes:** 7689
- **Kind:** Application module
- **Header intent:** AI Features - shared types.  This module is the "no external LLM" intelligence layer of the CRM. The four engines (creditSummary, interactionSummary, clientInsights, nextAction) are deterministic heuristic / templating generators: they read STRUCTURED CRM data (credit analyses, interactions, deals, parties, KYC, tasks) and emit human-readable text + scores. Nothing here calls an external model - the "AI" is a curated rules layer that turns rows into prose a desk officer can paste into a committe
- **Exported const:** AI_PRIORITY_BADGE, AI_PRIORITY_LABEL, AI_PRIORITY_RANK, NEXT_ACTION_KIND_LABEL, INSIGHT_ACTION_LABEL
- **Exported types:** AiPriority, NextActionKind, NextAction, InsightActionKind, ClientInsight, RecentInteractionSummary, InteractionSummary, CreditSummary
- **Security signals:** india-compliance
- **Domain terms:** BC-2, KYC, credit_analysis, issuer, mandate, party, scorecard

## `src/features/calendar/queries.ts`

- **Lines:** 243 | **Bytes:** 6281
- **Kind:** Feature data-access (queries)
- **Header intent:** Calendar — unifies tasks, interactions, KYC re-KYC, and deal target dates into a single month view for desk planning. Server-only; serializable rows.
- **Exported functions:** getCalendarEvents
- **Exported types:** CalendarEventKind, CalendarEvent
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/lib/rbac, @/db/schema
- **Domain terms:** KYC, kyc, party

## `src/features/compliance/actions.ts`

- **Lines:** 872 | **Bytes:** 28624
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createKyc, transitionKycStatus, setKycRiskRating, addBeneficialOwner, captureConsent, withdrawConsent, createDsr, transitionDsrStatus
- **Exported types:** CreateKycState, TransitionKycState, SetKycRiskState, AddBoState, CaptureConsentState, WithdrawConsentState, CreateDsrState, TransitionDsrState
- **Zod schemas:** createKycSchema, transitionKycSchema, setKycRiskSchema, addBoSchema, captureConsentSchema, withdrawConsentSchema, transitionDsrSchema
- **DB ops patterns:** from, insert, returning, select, update, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm, next/cache, zod/v4
- **Internal imports (6):** @/lib/rbac, @/db/context, @/db, @/db/schema, ./kyc, ./consent
- **TODOs/FIXMEs:** .
- **Domain terms:** KYC, credit_analysis, kyc, party


# Batch 072

## `src/features/compliance/audit.ts`

- **Lines:** 185 | **Bytes:** 5407
- **Kind:** Application module
- **Header intent:** audit_log query helpers (immutable viewer).  Schema: audit.ts `audit_log` - INSERT-only (RLS + trigger), monthly RANGE partitioned by occurred_at, hash-chained for tamper-evidence. This module is READ-ONLY by design: there is no update/delete surface, and writes are performed only by the mutation layer via the `auditLog` insert (the hash chain is populated by a BEFORE INSERT trigger). See schema audit.ts for the migration notes that install immutability + the chain.  Filters mirror the indexes: 
- **Exported functions:** listAuditLog, getAuditLogEntry, listAuditLogForEntity
- **Exported types:** AuditLogFilter, AuditLogRow, AuditLogResult
- **DB ops patterns:** from, insert, leftJoin, select, where
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (2):** @/db, @/db/schema
- **Domain terms:** KYC, barrier

## `src/features/compliance/consent.ts`

- **Lines:** 185 | **Bytes:** 6538
- **Kind:** Application module
- **Header intent:** DPDP Act 2023 consent + Data Subject Request (DSR) helpers.  Research: COMPLIANCE_LEGAL_FEASIBILITY.md §6-7. Schema: compliance.ts `consent_record` (purpose-bound, granular per data category, retention clock) and `data_subject_request` (principal-rights workflow). Consent is purpose-bound - a marketing consent does NOT authorize sharing data with a rating agency; that needs its own consent_record. Withdrawal triggers a DSR (type=`withdraw_consent` or `erasure`).  These are PURE helpers (no DB). 
- **Exported functions:** computeConsentRetentionUntil, computeDsrDueDate, isConsentActive, dsrTypeForWithdrawal, canTransitionDsr
- **Exported const:** DEFAULT_RETENTION_YEARS_BY_PURPOSE, DSR_TIMELINE_DAYS, DSR_TRANSITIONS
- **Exported types:** ConsentPurpose, ConsentMethod, DsrType, DsrStatus
- **Security signals:** rbac/rls, india-compliance
- **TODOs/FIXMEs:** .
- **Domain terms:** credit_analysis, kyc

## `src/features/compliance/kyc.ts`

- **Lines:** 371 | **Bytes:** 14803
- **Kind:** Application module
- **Header intent:** KYC lifecycle helpers (PMLA 2002 + RBI Master Direction on KYC).  Research: COMPLIANCE_LEGAL_FEASIBILITY.md §5 (PMLA KYC/CDD/EDD, BO thresholds, PEP/sanctions, STR/CTR, retention). Schema: credit.ts `kyc_record` + `kyc_beneficial_owner`; contact.pep_status for PEP. These are PURE helpers - no DB access - so they can be unit-tested and reused by both Server Components (queries.ts) and Server Actions (actions.ts). DB-mutating orchestration lives in actions.ts and runs inside withRls.  Key rules en
- **Exported functions:** boThresholdFor, requiresEddForBo, computeValidUntil, computeRekycDueDate, computeRetentionUntil, canTransition, shouldEscalateToEdd, screenSanctions, screenPep
- **Exported const:** BO_THRESHOLD_PCT, PARTNERSHIP_BO_THRESHOLD_PCT, RISK_REFRESH_YEARS, RISK_LEAD_TIME_MONTHS, KYC_RETENTION_YEARS, allowedTransitions, STR_FILING_DEADLINE_WORKING_DAYS, CTR_MONTHLY_THRESHOLD_INR
- **Exported types:** KycStatus, KycType, KycRisk, PartyNature, LegalForm, ScreeningStatus, ScreeningResult
- **DB ops patterns:** update
- **Security signals:** rbac/rls, india-compliance
- **Domain terms:** KYC, party

## `src/features/compliance/pit.ts`

- **Lines:** 321 | **Bytes:** 12028
- **Kind:** Application module
- **Header intent:** SEBI (Prohibition of Insider Trading) Regulations 2015 - Reg 9 + Schedule B.  Research: COMPLIANCE_LEGAL_FEASIBILITY.md §3.7 (PIT / Chinese walls), §7 item 8 (designated-person & pre-clearance workflow), and §15 risk register (PIT / Chinese-wall failure is a HIGH-severity risk for BC given dual advisory/corporate-finance + potential secondary-trading activity).  This module encodes the PIT business rules the CRM must enforce: - a designated-person register (BC staff who handle UPSI + their immed
- **Exported functions:** isActiveDesignatedPerson, isInsiderCategory, canTransitionPreClearance, computeWindowReopen, isTradingWindowClosed, quarterlyClosureFor, eventClosureFor, requiresPreClearance, canExecutePreClearance, computePreClearanceExpiry
- **Exported const:** PRE_CLEARANCE_TRANSITIONS, PRE_CLEARANCE_VALIDITY_DAYS, POST_DISCLOSURE_WINDOW_HOURS
- **Exported types:** DesignatedPersonCategory, DesignatedPersonEntry, PitUpsiEvent, PreClearanceStatus, TradingWindowState, TradingWindowClosure
- **Security signals:** rbac/rls, india-compliance
- **Domain terms:** allocation, barrier, bond, issuer, mandate, party, underwriting


# Batch 073

## `src/features/compliance/queries.ts`

- **Lines:** 587 | **Bytes:** 17389
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side compliance data access (KYC + DPDP consent + DSR).  All functions are safe to call from Server Components. They run plain SELECTs (the GUCs set by withRls are no-ops on tables without RLS enabled yet). The KYC detail query joins party, contact, beneficial owners, PEP flags, KYC documents, and the audit history for the record.
- **Exported functions:** listKycRecords, getKycDetail, listConsentRecords, listDataSubjectRequests
- **Exported types:** KycListItem, KycListResult, KycBeneficialOwnerRow, KycDocumentRow, KycHistoryRow, KycDetail, ConsentListItem, ConsentListResult, DsrListItem, DsrListResult
- **DB ops patterns:** from, innerJoin, leftJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/lib/rbac, @/db/schema
- **Domain terms:** KYC, kyc, party

## `src/features/credit/actions.ts`

- **Lines:** 468 | **Bytes:** 15941
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createCreditAnalysis, addFinancialStatement, runRatiosAndScore, advanceCommitteeState
- **Exported types:** CreateCreditAnalysisState, AddFsState, RunRatiosState, AdvanceCommitteeState
- **Zod schemas:** createSchema, addFsSchema, advanceSchema
- **DB ops patterns:** delete, from, insert, returning, select, update, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm, next/cache, next/navigation, zod/v4
- **Internal imports (6):** @/lib/rbac, @/db/context, @/db, @/db/schema, ./ratios, ./scorecard
- **Domain terms:** Party, credit_analysis, issuer, party, scorecard

## `src/features/credit/queries.ts`

- **Lines:** 385 | **Bytes:** 12454
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side credit-analysis data access. RLS-aware via withRls on writes (see actions.ts); reads are plain queries (the GUCs set by withRls are no-ops on tables without RLS enabled). All functions are safe to call from Server Components.
- **Exported functions:** deriveLifecycleStatus, listCreditAnalyses, getCreditAnalysisDetail
- **Exported types:** CreditLifecycleStatus, CreditAnalysisListItem, CreditAnalysisListResult, CreditAnalysisDetail
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (5):** @/db, @/lib/rbac-core, @/db/schema, ./ratios, ./ratingMap
- **Domain terms:** credit_analysis, issuer, party, scorecard

## `src/features/credit/ratingBands.ts`

- **Lines:** 79 | **Bytes:** 2638
- **Kind:** Application module
- **Header intent:** Pure rating-band helpers - the DB-free subset of ratingMap.ts.  `ratingMap.ts` historically bundled the pure cross-agency ordinal→band mapping with the DB-backed ladder loader (`loadLadder`/`resolveRung`, which import `@/db`). Anything that imported even the pure helpers - notably the Investor Matching Engine (`features/matching/engine.ts`), which is consumed by a client component - transitively pulled `postgres` (and its Node `tls`/ `net`/`fs` deps) into the client bundle, breaking `next build`
- **Exported functions:** rankToBand, bandToAgencySymbol
- **Exported types:** RatingAgency
- **Internal imports (1):** ./scorecard
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6, Investor, Matching, matching, scorecard


# Batch 074

## `src/features/credit/ratingMap.ts`

- **Lines:** 264 | **Bytes:** 9932
- **Kind:** Application module
- **Header intent:** Indian rating-agency scale mapping (CREDIT_ANALYSIS_SPEC §5).  Bridges the seven Indian CRAs (CRISIL, ICRA, CARE, India Ratings, Acuite, Infomerics, Brickwork) to a normalized internal scale BC-1 … BC-6 using the `rating_ladder` table (schema §2.23.7). The rating_ladder table is the system of record and is editable (agencies refine scales); this module loads it at request time and falls back to the static spec §5 mapping when a (agency, symbol) pair is not seeded in the DB yet.  `external_rating
- **Exported functions:** bandToCanonicalRank, coreSymbolToRank, agencySymbolToRank, symbolToBand, loadLadder, resetLadderCache, resolveBand, resolveRung
- **Exported const:** AGENCIES, BAND_PD_RANGE
- **Exported types:** RatingScale, LadderRung
- **DB ops patterns:** from, select, where
- **External deps:** drizzle-orm
- **Internal imports (5):** @/db, @/db/schema, ./scorecard, ./ratingBands, ./ratingBands
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6, scorecard

## `src/features/credit/ratios.ts`

- **Lines:** 478 | **Bytes:** 17949
- **Kind:** Application module
- **Header intent:** Ratio engine - computes the Binary Capital ratio library (CREDIT_ANALYSIS_SPEC §3) from a single financial_statement period, with optional prior-period statement for averaging (ROE / ROA / ROCE / debtor / creditor / inventory days).  Line items are read from financial_statement.line_items (jsonb) keyed by a canonical `crisil_lineitem_code`-style code set defined below. Values may be stored as numbers or numeric strings; `li()` coerces to a finite number or returns null.  Formula conventions (spe
- **Exported functions:** readLineItems, computeRatios, ratioSetToResultRows, ratioCategory, formatRatio
- **Exported const:** PERSISTABLE_RATIO_CODES, FORMULA_SNAPSHOTS, ALL_RATIO_CODES
- **Exported types:** LineItemCode, RatioSet
- **Internal imports (1):** @/db/schema
- **Domain terms:** Bond, scorecard

## `src/features/credit/scorecard.ts`

- **Lines:** 462 | **Bytes:** 15302
- **Kind:** Application module
- **Header intent:** Scorecard scoring - weighted 0-100 scorecard with band mapping (CREDIT_ANALYSIS_SPEC §4).  Formula (spec §4.1): total_score = Σᵢ [ weightᵢ × (sub_scoreᵢ / 5) ] × 100, sub_score ∈ {1..5}, Σ weights = 1.0. Equivalent: total_score = Σ(component_score × component_weight) × 20, which is what the credit_score.weighted_score generated column (component_score × component_weight) rolls up to - so persisting one credit_score row per sub-factor with component_weight = fractional sub-factor weight and compo
- **Exported functions:** resolveWeights, defaultBaseWeights, bandFromScore, computeScorecard
- **Exported const:** BAND_GRADE, BAND_PD_1Y, SCORECARD_GROUPS
- **Exported types:** ObligorType, Band, SubFactor, ScorecardResult, ComputeScorecardArgs
- **Security signals:** india-compliance
- **Internal imports (1):** ./ratios
- **Domain terms:** BC-1, BC-2, BC-3, BC-4, BC-5, BC-6, KYC, Scorecard, scorecard

## `src/features/dashboard/queries.ts`

- **Lines:** 530 | **Bytes:** 16864
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side dashboard data access.  The command-center dashboard mixes headline KPIs, recent rows, and chart aggregates. Every loader accepts the current user and applies the same party/deal/interaction visibility model as the underlying feature pages.
- **Exported functions:** getDashboardKpis, getDashboardData
- **Exported types:** DashboardKpis, DashboardRecentDeal, DashboardRecentInteraction, DashboardChartData, DashboardData
- **DB ops patterns:** from, innerJoin, leftJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm, next/cache
- **Internal imports (3):** @/db, @/db/schema, @/lib/rbac-core
- **Domain terms:** allocation, investor, issuer, party, scorecard


# Batch 075

## `src/features/deals/allocations.ts`

- **Lines:** 150 | **Bytes:** 5665
- **Kind:** Application module
- **Header intent:** Allocation-event semantics for book-built / auction mandates.  `allocation_event` is an IMMUTABLE append-only event-sourced table (src/db/schema/deals.ts §2.11). The current allocation state per (deal_id, party_id) is derived by replaying these events. This module encodes the business-logic rules the mutation layer must enforce BEFORE appending an event: - which deal types run an allocation book at all (bond underwriting, HY, private placement, G-Sec auction, ECM book-built offers) vs which do n
- **Exported functions:** allocEventIndex, isAllocEventTerminal, canTransitionAllocEvent, isAllocationDeal, isValidAllocEventForDealType
- **Exported const:** ALLOC_EVENT_FLOW, ALLOC_EVENT_TERMINAL, ALLOC_EVENT_WITHDRAWABLE
- **Internal imports (2):** ./catalog, ./catalog
- **Domain terms:** Allocation, Bond, allocation, bond, investor, mandate, underwriting

## `src/features/deals/catalog.ts`

- **Lines:** 341 | **Bytes:** 12193
- **Kind:** Application module
- **Header intent:** Deal-type catalog - the verified Binary Capital / Binary Bonds service map.  Source of truth for "which deal types does this CRM model, and is each one business-logic appropriate for BC?": scrape/BUSINESS_CONTEXT.md §2-3 and docs/CREDIT_ANALYSIS_SPEC.md / FINANCIAL_MODELING_SPEC.md. The schema enum (src/db/schema/enums.ts `dealTypeEnum`) is the DB-level constraint; this module is the domain-level catalog that classifies every enum value into a product family, brand affinity, credit character, an
- **Exported functions:** dealTypeSpec, isAllocationDealType, isIssuerInstrumentDealType, defaultBrandForDealType
- **Exported const:** DEAL_TYPE_CATALOG, DEAL_TYPE_DISPLAY_ORDER
- **Exported types:** DealType, DealStatus, DealPartyRole, AllocEventType, DealFamily, BrandAffinity, CreditCharacter, DealTypeSpec
- **Internal imports (1):** @/db/schema
- **Domain terms:** Bond, Mandate, Underwriting, allocation, binarybonds, binarycapital, bond, credit_analysis, deal_status, gsec, investor, issuer, mandate, party, underwriting

## `src/features/deals/index.ts`

- **Lines:** 15 | **Bytes:** 688
- **Kind:** Application module
- **Header intent:** Deals feature barrel - re-exports the query layer + the per-deal-type domain-logic modules (catalog, stages, roles, allocations).  The query layer (queries.ts) loads the pipeline; the domain modules encode the verified Binary Capital / Binary Bonds business logic (which deal types are appropriate, the per-type stage ladder, the per-type party roles + lead role, and the allocation-event semantics). Together they let deal mutation / validation logic enforce per-type correctness instead of the gene
- **Internal imports (5):** ./catalog, ./stages, ./roles, ./allocations, ./queries
- **Domain terms:** allocation, party

## `src/features/deals/queries.ts`

- **Lines:** 315 | **Bytes:** 10698
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side deal data access. Pipeline view: deals grouped by status with their deal_party parties inlined.  PAGINATION: the pipeline is capped at `perStage` deals per status via a ROW_NUMBER() window (default 40 - see DEFAULT_PER_STAGE). A total LIMIT would pile the first N deals into the earliest stage and leave later stages empty, which breaks the kanban's balanced funnel; partitioning by status keeps every column populated up to the cap. `total` is the full non-deleted deal count so the boar
- **Exported functions:** getDealPipeline
- **Exported const:** DEFAULT_PER_STAGE
- **Exported types:** DealPipelineRow, DealPipelineGroup, DealPipelineResult, DealPipelineFilters
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/db/schema, @/lib/rbac
- **Domain terms:** deal_status, mandate, party


# Batch 076

## `src/features/deals/roles.ts`

- **Lines:** 319 | **Bytes:** 8307
- **Kind:** Application module
- **Header intent:** Per-deal-type deal_party roles + the lead role for each deal type.  The schema's `deal_party_role` enum is a flat superset of every role across every deal type (issuer, arranger, underwriter, investor, book_runner, lead_manager, syndicate_member, allocator, guarantor, trustee, registrar, rating_agency, legal_counsel, auditor, escrow_agent, selling_broker, buy_side_advisor, sell_side_advisor, target, acquirer, co_arranger). A flat superset is fine at the DB level but is NOT business-logic appropr
- **Exported functions:** validRolesForDealType, leadRoleForDealType, isValidRoleForDealType
- **Exported const:** DEAL_TYPE_ROLES
- **Exported types:** DealRoleSpec
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **Internal imports (1):** ./catalog
- **Domain terms:** bond, investor, issuer, mandate, party, underwriting

## `src/features/deals/stages.ts`

- **Lines:** 450 | **Bytes:** 13531
- **Kind:** Application module
- **Header intent:** Per-deal-type stage flows (the deal pipeline ladder per mandate type).  The schema's `deal_status` enum is a single flat set of pipeline stages (lead, mandated, in_dd, structuring, rating_marketing, pricing, allocation, settled, closed + off-pipeline dropped/on_hold). A flat enum is necessary at the DB level but is NOT business-logic appropriate on its own: a G-Sec auction does not go through "structuring"/"rating_marketing", and an M&A mandate does not have an "allocation" stage. This module en
- **Exported functions:** stageLadderFor, stageSemanticsFor, stageIndexInFlow, isOffPipelineStatus, canTransitionStage, nextStageFor
- **Exported const:** OFF_PIPELINE_STATUSES, DEAL_STAGE_FLOWS
- **Exported types:** OffPipelineStatus, DealStageFlow
- **Internal imports (1):** ./catalog
- **Domain terms:** Allocation, Bond, Investor, Mandate, allocation, deal_status, investor, mandate, onboarding, underwriting

## `src/features/documents/actions.ts`

- **Lines:** 148 | **Bytes:** 4963
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createDocument
- **Exported types:** CreateDocumentState
- **Zod schemas:** createDocumentSchema
- **DB ops patterns:** insert, returning
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** next/cache, next/navigation, zod/v4
- **Internal imports (3):** @/lib/rbac, @/db/context, @/db/schema

## `src/features/documents/queries.ts`

- **Lines:** 377 | **Bytes:** 10922
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side document data access (DATA_MODEL §2.20). The document table is metadata only - the file blob lives in S3-compatible object storage with file_store_ref as the key. KYC documents are encryption-at-rest + access- logged separately (ARCHITECTURE §4.3). barrier_id is the information-wall tag for RLS; is_mnpi disables download/copy/email-forward in the UI. RLS- aware once policies are migrated; until then plain queries. All functions are safe to call from Server Components.
- **Exported functions:** listDocuments, getDocumentDetail, listDealOptions, listPartyOptions, listContactOptions
- **Exported types:** DocumentListItem, DocumentListResult, DocumentDetail, DealOption, PartyOption, ContactOption
- **DB ops patterns:** from, leftJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/lib/rbac, @/db/schema
- **Domain terms:** KYC, party


# Batch 077

## `src/features/integrations/accountAggregator.ts`

- **Lines:** 297 | **Bytes:** 10195
- **Kind:** Application module
- **Header intent:** Account Aggregator (AA) adapter.  §11: open architecture; Binary onboards as a Financial Information User (FIU) via Sahamati. ~17 AAs, ~179 FIPs, ~955 FIUs as of 2026. ReBIT + Sahamati Central Registry govern API standards. Highest-value, most feasible credit-analysis feed - Phase-1 priority.  Real flow: Binary (FIU) requests a consent handle from an AA; the customer approves via the AA app; the FIU fetches Financial Information (FI) from one or more Financial Information Providers (FIPs) - bank
- **Exported functions:** buildAccountAggregatorSample
- **Exported const:** accountAggregator
- **Exported types:** AccountAggregatorConsentRequest, FipFi, AccountAggregatorData
- **Exported classes:** AccountAggregatorClient
- **Security signals:** auth, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **TODOs/FIXMEs:** XXX4421", | XXX0091", | XXX7741",
- **Domain terms:** Bond, INVESTOR, binarycapital, demat, investor

## `src/features/integrations/actions.ts`

- **Lines:** 99 | **Bytes:** 3361
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** runIntegrationMock, runAllIntegrationMocks, runIntegration, runAllIntegrations
- **Zod schemas:** runOneSchema
- **Security signals:** auth
- **External deps:** zod/v4
- **Internal imports (3):** @/lib/rbac, ./registry, ./types

## `src/features/integrations/bseNse.ts`

- **Lines:** 246 | **Bytes:** 8681
- **Kind:** Application module
- **Header intent:** BSE / NSE debt-segment trade reporting adapter.  §11: MEMBER-ONLY; NO public open API. Member-access terminals + member- portal files (NSE Member/CM Download, Bhavcopy) rather than generic REST. Binary's membership UNVERIFIED - likely acts as arranger/advisory, not member. If NOT a member (likely), rely on licensed delayed feeds or manual entry - scope OUT.  Access to swap for real: Binary must be a SEBI-registered broker/dealer with BSE/NSE debt-segment membership. ADVERSARIAL CHECK: membership
- **Exported functions:** buildBseNseSample
- **Exported const:** bseNse
- **Exported types:** DebtTrade, DebtTradeReport
- **Exported classes:** BseNseClient
- **Security signals:** auth, india-compliance
- **Internal imports (3):** ./env, ./env, ./types

## `src/features/integrations/ccil.ts`

- **Lines:** 215 | **Bytes:** 7591
- **Kind:** Application module
- **Header intent:** CCIL F-TRAC trade reporting adapter.  §11: MEMBER WORKFLOW, not public API. CCIL acts as Trade Repository via F-TRAC (ftrac.co.in); reporting members access via login. Binary is NOT a direct CCIL member (membership for banks/PDs/FIs with RBI approval); any CCIL-settled trades clear through a sponsoring bank/PD member.  Access to swap for real: Binary must be a CCIL member/reporting entity. ADVERSARIAL CHECK: NOT a direct CCIL member. Likely OUT of scope for an arranger/advisory. Rely on member-u
- **Exported functions:** buildCcilSample
- **Exported const:** ccil
- **Exported types:** FtracRecord, FtracReport
- **Exported classes:** CcilClient
- **Security signals:** auth
- **Internal imports (3):** ./env, ./env, ./types


# Batch 078

## `src/features/integrations/ckyc.ts`

- **Lines:** 240 | **Bytes:** 8062
- **Kind:** Application module
- **Header intent:** CKYC Registry (CERSAI) adapter.  §11: CKYCRR 2.0 launched with REAL-TIME API (CERSAI notification 5 Jun 2026; prior CKYCRR 1.0 used batch-file/SFTP). Protean and other vendors offer CKYCR API integration.  Access to swap for real: Binary onboarded as Reporting Entity with CERSAI; API credentials + onboarding. Exact API spec/endpoint TO CONFIRM directly with CERSAI. Real-time API is recent (Jun 2026) - confirm production stability and onboarding timeline.  Env (see .env.example): KRA_API_USER, KR
- **Exported functions:** buildCkycSample
- **Exported const:** ckyc
- **Exported types:** CkycLookupRequest, CkycRecord, CkycData
- **Exported classes:** CkycClient
- **Security signals:** auth, rbac/rls, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **TODOs/FIXMEs:** X-XXXX-7821",
- **Domain terms:** KYC, kyc, onboarding

## `src/features/integrations/demat.ts`

- **Lines:** 194 | **Bytes:** 7011
- **Kind:** Application module
- **Header intent:** CDSL / NSDL depository (demat) adapter.  §11: DP-system access ONLY for SEBI-registered Depository Participants + empaneled software vendors (NSDL SPEED-e, CDSL easi/easiest, STP segments). NO open demat API for non-DP. Binary's DP registration UNVERIFIED - likely NOT a DP.  Access to swap for real: Binary must be a SEBI-registered DP (or work through one). ADVERSARIAL CHECK: DP registration UNVERIFIED - likely NOT a DP. If not a DP (likely), store demat details as REFERENCE DATA only - scope OU
- **Exported functions:** buildDematSample
- **Exported const:** demat
- **Exported types:** DematHolding, DematAccount
- **Exported classes:** DematClient
- **Security signals:** auth, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **Domain terms:** Demat, demat

## `src/features/integrations/emailCalendar.ts`

- **Lines:** 236 | **Bytes:** 9236
- **Kind:** Application module
- **Header intent:** Email / Calendar adapter (Microsoft Graph / Google Workspace).  §11: SELF-SERVE for the customer's tenant via OAuth2. Well-documented APIs (Google Workspace Gmail+Calendar API, Microsoft Graph). Binary consents via OAuth2 (vendor acts as processor); restricted-scope verification for Gmail API. Customer-tenant admin consent. Communication retention/archive needed for SEBI/RBI record-keeping.  Access to swap for real: OAuth2 tenant admin consent (Microsoft Graph or Google Workspace). Vendor acts a
- **Exported functions:** buildEmailCalendarSample
- **Exported const:** emailCalendar
- **Exported types:** EmailMessage, CalendarEvent, EmailCalendarData
- **Exported classes:** EmailCalendarClient
- **Security signals:** rbac/rls, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **Domain terms:** KYC, allocation, binarycapital, investor, kyc, onboarding

## `src/features/integrations/env.ts`

- **Lines:** 460 | **Bytes:** 16827
- **Kind:** Client component
- **Directive:** `use client`
- **Header intent:** Shared environment + HTTP plumbing for integration adapters.  This module is the single source of truth for: • the USE_MOCK_INTEGRATIONS toggle (default: true in dev, false in prod when credentials are present), • per-adapter credential discovery against the keys already declared in `.env.example` (plus a small set of additional keys documented in the adapter headers below - they are read via `process.env` so wiring is a credential-away), • a typed HTTP client with timeout + exponential-backoff 
- **Exported functions:** envKeysPresent, requireEnv, optionalEnv, isMockMode, credentialsPresent, adapterEnvKeys, resolveAdapterStatus, bearerAuth, basicAuth
- **Exported const:** ADAPTER_CREDENTIALS
- **Exported types:** AdapterId, IntegrationErrorCode, AdapterCredentialSpec, HttpClientOptions, HttpRequestConfig
- **Exported classes:** IntegrationError, HttpClient
- **DB ops patterns:** from
- **Security signals:** auth, rbac/rls, india-compliance
- **Domain terms:** demat


# Batch 079

## `src/features/integrations/fiuInd.ts`

- **Lines:** 332 | **Bytes:** 13260
- **Kind:** Application module
- **Header intent:** FIU-IND FINnet 2.0 adapter (STR/CTR XML generation + filing).  §11: CONFIRMED. Filing via FINGate 2.0 portal (https://fingate.gov.in) in batch XML format (NOT CSV). FIU-IND provides Excel templates + Report Generation/Validation Utilities that produce XML. CTR threshold INR 10 lakh (Rule 3 PML Rules 2005); STR within 7 working days.  Access to swap for real: Binary's reporting-entity registration with FIU-IND; Principal Officer + Designated Director designation. Vendor generates the XML payload;
- **Exported functions:** escapeXml, buildStrXml, buildCtrXml, generateFiuIndXml
- **Exported const:** fiuInd
- **Exported types:** FiuIndData, FiuIndGenerateRequest, FiuIndSubmitRequest
- **Exported classes:** FiuIndClient
- **Security signals:** auth, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **Domain terms:** Bond, KYC, bond

## `src/features/integrations/gstinPan.ts`

- **Lines:** 257 | **Bytes:** 8573
- **Kind:** Application module
- **Header intent:** GSTIN + PAN verification adapter.  §11: GSTIN - free public "Search Taxpayer" page (services.gst.gov.in, CAPTCHA-gated); programmatic via GST Suvidita Providers (GSPs) + ASPs on per-API-call fee. PAN - via NSDL/UTIITSL/Protean PAN verification service (regulated, per-call fee) or via CKYC.  Access to swap for real: GSP/ASP license for programmatic GSTIN; NSDL/ Protean PAN verification API credentials.  Env (see .env.example): GSTIN_API_KEY (GSP/ASP), PAN_API_KEY (NSDL/Protean). Mode is selected 
- **Exported functions:** buildGstinPanSample
- **Exported const:** gstinPan
- **Exported types:** GstinVerification, PanVerification, GstinPanData
- **Exported classes:** GstinPanClient
- **Security signals:** auth, india-compliance
- **Internal imports (3):** ./env, ./env, ./types

## `src/features/integrations/kra.ts`

- **Lines:** 205 | **Bytes:** 7100
- **Kind:** Application module
- **Header intent:** SEBI KRA adapter (CVL / CAMS / Kfintech / NDML).  §11: KRAs provide APIs for upload/download/modify of KYC records to SEBI-registered intermediaries. SEBI Circular SEBI/HO/MIRSD/SECFATF/P/CIR/ 2024/79 (6 Jun 2024) governs KRA uploads to CKYCRR. CDSL APIs page confirms CVL KRA APIs.  Access to swap for real: Binary's SEBI registration + KRA onboarding/API credentials. Vendor integrates as processor under Binary's credentials. Vendor should NOT independently become KRA-integrated. eKYC is consumed
- **Exported functions:** buildKraSample
- **Exported const:** kra
- **Exported types:** KraLookupRequest, KraRecord, KraData
- **Exported classes:** KraClient
- **Security signals:** auth, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **TODOs/FIXMEs:** X-XXXX-7821",
- **Domain terms:** KYC, kyc, onboarding

## `src/features/integrations/mca.ts`

- **Lines:** 191 | **Bytes:** 7129
- **Kind:** Application module
- **Header intent:** MCA21 company master + financials adapter.  §11: NO official open API. Access via MCA portal paid downloads (per-company fee) or third-party aggregators (Tofler, Zauba, Perfins). MCA API URLs returned 403 in research. Portal-scraping is legally risky - avoid.  Access to swap for real: licensed third-party aggregator API subscription (per-call or bulk). Vendor integrates against the aggregator's REST API.  Env (see .env.example): MCA_API_KEY (aggregator API key). When mock mode is off AND the key
- **Exported functions:** buildMcaSample
- **Exported const:** mca
- **Exported types:** McaLookupRequest, McaData
- **Exported classes:** McaClient
- **Security signals:** auth, rbac/rls, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **Domain terms:** party


# Batch 080

## `src/features/integrations/queries.ts`

- **Lines:** 43 | **Bytes:** 1832
- **Kind:** Feature data-access (queries)
- **Header intent:** Cached integration-status data access for the /integrations page.  The adapter registry itself is in-process (src/features/integrations/registry.ts) and its summaries are derived from env + the static adapter list, so they are stable for the lifetime of a deploy and cheap to recompute. We still wrap them in Next's unstable_cache (revalidate 300s / 5 minutes) so a cache hit on the status page skips the per-adapter env reads + object mapping on every request and the page renders straight from the 
- **Exported const:** listIntegrationsCached, getIntegrationStatusCounts
- **External deps:** next/cache
- **Internal imports (1):** ./registry

## `src/features/integrations/ratingFeed.ts`

- **Lines:** 220 | **Bytes:** 7423
- **Kind:** Application module
- **Header intent:** Rating-agency feed adapter (CRISIL / ICRA / CARE Edge / India Ratings / Brickwork).  §11: LICENSED COMMERCIAL DATA, not open. Sold via rating agencies' subscription products or redistributors (Bloomberg/Refinitiv). Low technical risk; cost is the dominant constraint.  Access to swap for real: commercial license agreement with one or more agencies (typical for a bond house). Significant annual license cost (TO CONFIRM per agency).  Env (see .env.example): RATING_FEED_API_KEY. Agency selected via 
- **Exported functions:** buildRatingFeedSample
- **Exported const:** ratingFeed
- **Exported types:** RatingAction, RatingFeedData
- **Exported classes:** RatingFeedClient
- **Security signals:** auth
- **Internal imports (3):** ./env, ./env, ./types
- **Domain terms:** bond, issuer

## `src/features/integrations/registry.ts`

- **Lines:** 154 | **Bytes:** 5260
- **Kind:** Application module
- **Header intent:** Integration adapter registry.  Single source of truth for the set of India-regulatory / financial-data integrations the CRM must support (per §11 of COMPLIANCE_LEGAL_FEASIBILITY.md). Each adapter ships BOTH a real API client class (typed request/response, env-credential loading, fetch with timeout + retry + structured errors) AND a mock implementation that returns the realistic sample data the UI screens use.  Mock vs real is resolved from env per adapter (see env.ts): • `USE_MOCK_INTEGRATIONS` 
- **Exported functions:** listIntegrations, getAdapter, runAdapterMock, runAdapter, runMock, runAll, integrationStatusCounts
- **Exported const:** integrationRegistry, integrationsById
- **Exported types:** IntegrationSummary
- **Security signals:** india-compliance
- **Internal imports (13):** ./types, ./accountAggregator, ./kra, ./ckyc, ./mca, ./gstinPan, ./bseNse, ./ccil, ./demat, ./ratingFeed, ./fiuInd, ./emailCalendar, ./whatsapp
- **Domain terms:** demat

## `src/features/integrations/types.ts`

- **Lines:** 123 | **Bytes:** 4774
- **Kind:** Application module
- **Header intent:** Shared types for integration adapters.  Every adapter in this directory implements `IntegrationAdapter`. Each adapter ships BOTH a real API client class (typed request/response, env-credential loading, fetch with timeout + retry + structured errors) AND a mock implementation that returns the realistic sample data the UI screens use.  Which one the registry/Server Actions invoke is driven by env (see env.ts): • `USE_MOCK_INTEGRATIONS` (default: true in dev, false in prod when credentials are pres
- **Exported functions:** errorResult
- **Exported types:** AdapterStatus, AdapterResult, AdapterInput, IntegrationAdapter
- **Security signals:** india-compliance
- **Internal imports (1):** ./env
- **Domain terms:** kyc, party


# Batch 081

## `src/features/integrations/whatsapp.ts`

- **Lines:** 253 | **Bytes:** 8637
- **Kind:** Application module
- **Header intent:** WhatsApp Business API adapter.  §11: OPEN via Meta Cloud API or BSPs (solution partners). Self-serve. Meta Business account + template approval; BSP if using a solution partner. Opt-in/opt-out registry required. Per-24h-conversation pricing by category (marketing/utility/authentication), India-specific rates set by Meta (TO CONFIRM). Template approval + RBI/SEBI communication-record retention rules apply.  Access to swap for real: Meta Business account + template approval; BSP optional. Opt-in/o
- **Exported functions:** buildWhatsappSample
- **Exported const:** whatsapp
- **Exported types:** WhatsappMessage, WhatsappData, WhatsappSendRequest
- **Exported classes:** WhatsappClient
- **Security signals:** auth, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **Domain terms:** Investor, allocation

## `src/features/interactions/actions.ts`

- **Lines:** 223 | **Bytes:** 7056
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createInteraction, updateInteraction
- **Exported types:** CreateInteractionState, UpdateInteractionState
- **Zod schemas:** attendeeSchema, createInteractionSchema, updateInteractionSchema
- **DB ops patterns:** insert, returning, update, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm, next/cache, next/navigation, zod/v4
- **Internal imports (3):** @/lib/rbac, @/db/context, @/db/schema
- **Domain terms:** party

## `src/features/interactions/queries.ts`

- **Lines:** 364 | **Bytes:** 10530
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side interaction data access (DATA_MODEL §2.18). An interaction anchors to ≥1 of party/deal/contact (CHECK num_nonnulls >= 1), links attendees via the interaction_attendee junction, and is walled by barrier_id when it contains MNPI. RLS-aware once policies are migrated; until then these are plain queries (the GUCs set by withRls are no-ops on tables without RLS enabled). All functions are safe to call from Server Components.
- **Exported functions:** listInteractions, getInteractionDetail, listPartyOptions, listDealOptions, listContactOptions
- **Exported types:** InteractionListItem, InteractionListFilters, InteractionListResult, InteractionAttendeeRow, InteractionDetail, PartyOption, DealOption, ContactOption
- **DB ops patterns:** from, innerJoin, leftJoin, select, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/lib/rbac, @/db/schema
- **Domain terms:** party

## `src/features/leads/actions.ts`

- **Lines:** 701 | **Bytes:** 25095
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createLead, updateBant, convertToOpportunity, updateProbability, updateExpectedClose, updateAssignedRm, winLead, loseLead, addLeadNote, deleteLead
- **Exported types:** CreateLeadState, UpdateBantState, ConvertState, FieldState, WinState, LoseState, NoteState, DeleteState
- **Zod schemas:** createSchema, bantSchema, convertSchema, probSchema, closeSchema, rmSchema, winSchema, loseSchema, noteSchema, deleteSchema
- **DB ops patterns:** from, insert, returning, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm, next/cache, next/navigation, zod/v4
- **Internal imports (7):** @/lib/rbac, @/db/context, @/db, @/db/schema, ./queries, ./types, ./types
- **Domain terms:** binarybonds, issuer, mandate, onboarding, party


# Batch 082

## `src/features/leads/index.ts`

- **Lines:** 46 | **Bytes:** 1038
- **Kind:** Application module
- **Header intent:** Lead & Opportunity Management - feature barrel.  Re-exports the domain types/constants, the icon resolver, the server data access, and the server actions so app routes import from one path.
- **Internal imports (4):** ./types, ./lead-icons, ./queries, ./actions

## `src/features/leads/lead-icons.tsx`

- **Lines:** 121 | **Bytes:** 3917
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** LeadDealTypeIcon, leadDealTypeTone, LeadSourceIcon
- **External deps:** @phosphor-icons/react, react
- **Internal imports (4):** @/components/brand, @/components/brand, @/lib/utils, ./types
- **Domain terms:** bond

## `src/features/leads/queries.ts`

- **Lines:** 668 | **Bytes:** 20210
- **Kind:** Feature data-access (queries)
- **Header intent:** Lead & Opportunity Management - server-side data access.  Storage: a JSONB `lead_meta` column on party (migration 0006). A party is a lead iff lead_meta IS NOT NULL. Because lead_meta is not in the frozen Drizzle schema (the schema layer owns src/db/schema/*), the lead read paths use parameterised raw SQL via `db.execute(sql\`...\`)` - postgres-js parses the jsonb column into a JS object and timestamptz into a Date automatically. Writes (actions.ts) set lead_meta via raw SQL inside an RLS transa
- **Exported functions:** normalizeLead, listRms, fetchAllLeads, getLeadsPipeline, getLeadDetail, getConversionAnalytics
- **Exported types:** RmOption, LeadRow, LeadPipelineGroup, LeadContact, LeadTask, LeadDetail, SourceBreakdown, DealTypeBreakdown, RmBreakdown, MonthBucket, ConversionAnalytics
- **DB ops patterns:** from, innerJoin, leftJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (7):** @/db, @/db/schema, @/lib/rbac-core, @/lib/rbac, @/features/interactions/queries, @/features/interactions/queries, ./types
- **Domain terms:** Party, party

## `src/features/leads/seed.ts`

- **Lines:** 359 | **Bytes:** 12386
- **Kind:** Application module
- **Header intent:** Lead & Opportunity Management - seed.  Run AFTER the main seed (src/db/seed.ts):  npx tsx src/features/leads/seed.ts  Populates party.lead_meta (migration 0006) with a realistic Indian bond-house lead pipeline: ~30 prospect parties promoted into leads across the full funnel (new → qualified → opportunity → won/lost), plus a handful of existing-client leads attached to active issuer/investor parties. Won leads get a real deal row (dealCode prefix LD-) linked via deal_party so the lead→deal conver
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, node:fs, node:path
- **Internal imports (2):** @/db, ./types
- **Domain terms:** binarybonds, binarycapital, bond, investor, issuer, mandate, party


# Batch 083

## `src/features/leads/types.ts`

- **Lines:** 265 | **Bytes:** 8517
- **Kind:** Application module
- **Header intent:** Lead & Opportunity Management - shared types + domain constants.  A lead is a prospect relationship the firm is qualifying toward a mandate. Storage: a JSONB `lead_meta` column on party (migration 0006_leads.sql). A party is a lead iff party.lead_meta IS NOT NULL. See the migration header for the full design rationale (single source of truth = party master; the JSONB blob carries the lead-specific state the frozen party schema lacks).  Domain (Indian bond house / IB): Lead        → a new contact
- **Exported functions:** isQualified, bantScore
- **Exported const:** LEAD_STAGE_ORDER, LEAD_STAGE_LABELS, LEAD_STAGE_HINTS, LEAD_STAGE_DEFAULT_PROBABILITY, LEAD_STAGE_TONE, LEAD_SOURCE_ORDER, LEAD_SOURCE_LABELS, LEAD_DEAL_TYPE_ORDER, LEAD_DEAL_TYPE_LABELS, LEAD_DEAL_TYPE_SHORT, BANT_CRITERIA, BANT_LABELS, BANT_HINTS, LEAD_LOSS_REASONS, LEAD_LOSS_REASON_LABELS
- **Exported types:** LeadStage, LeadSource, LeadDealType, BantQualification, LeadMeta, BantCriterion, LeadLossReason
- **Security signals:** india-compliance
- **Domain terms:** Bond, KYC, Mandate, Underwriting, bond, deal_status, mandate, party

## `src/features/matching/actions.ts`

- **Lines:** 230 | **Bytes:** 8224
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Header intent:** Server actions for the Investor Matching Engine.  sendToDeal - the workspace's primary CTA. Takes a selected issuer + a set of matched investors and either (a) creates a new bond-underwriting mandate with the issuer as the lead deal_party and each selected investor as an investor deal_party carrying their indicated commitment, or (b) links the investors to an existing deal (adding deal_party rows, skipping any already present). The result redirects to the deal so the coverage desk can pick up pl
- **Exported functions:** sendToDeal
- **Exported types:** SendToDealInput, SendToDealResult
- **Zod schemas:** sendToDealSchema
- **DB ops patterns:** from, insert, returning, select, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm, next/cache, zod/v4
- **Internal imports (4):** @/lib/rbac, @/db/context, @/db, @/db/schema
- **Domain terms:** Investor, Issuer, Matching, Party, binarybonds, binarycapital, bond, investor, issuer, mandate, matching, party, underwriting

## `src/features/matching/engine.ts`

- **Lines:** 712 | **Bytes:** 25683
- **Kind:** Application module
- **Header intent:** Investor Matching Engine - the USP of the Binary Capital CRM.  Given an issuer (a party with type=issuer + their latest external_rating + sector + a deal carrying tenor + target_size), score every investor (party with type=investor) against seven criteria and rank them. This is the feature that makes the CRM worth building custom vs buying Salesforce: it turns the firm's 150+ institutional-investor network + 10k+ relationship graph into a ranked, actionable placement shortlist for any bond manda
- **Exported functions:** inferInvestorKind, rankToSymbol, ratingFloorSymbol, scoreInvestor, rankInvestors, classifyWarmIntro, defaultMinRatingRank, defaultTenorRange, bandForScore
- **Exported const:** CRITERIA_ORDER, CRITERION_LABEL, CRITERION_TAG, SCORE_WEIGHTS, MATCH_FILTERS, DEFAULT_TICKET_CRORES, SCORE_BAND_LABEL
- **Exported types:** CriterionKey, InvestorKind, IssuerProfile, InvestorProfile, WarmIntroPath, WarmIntroStrength, CriterionResult, InvestorMatch, MatchFilterKey, ScoreBand
- **Security signals:** india-compliance
- **Internal imports (2):** @/features/credit/scorecard, @/features/credit/ratingBands
- **Domain terms:** Demat, Investor, Issuer, KYC, Matching, allocation, bond, demat, investor, issuer, kyc, mandate, matching, party, scorecard

## `src/features/matching/queries.ts`

- **Lines:** 875 | **Bytes:** 31024
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side data access for the Investor Matching Engine.  Builds the IssuerProfile + InvestorProfile shapes the pure engine (engine.ts) scores, by deriving investor preferences from the LIVE schema:  - rating floor  → the worst (max rank) external_rating among issuers the investor has bought via deal_party(role=investor); falls back to the kind-based default when there is no history. - tenor range   → min/max deal.target_tenor_years across the investor's deal history; kind default otherwise. - 
- **Exported functions:** getMatchableIssuers, getIssuerMatchProfile, loadInvestorProfiles, getWarmIntroPath, getWarmIntroByInvestor, getInvestorMatches, getMatchMatrix
- **Exported types:** IssuerSummary, MatchResult, MatchMatrix
- **DB ops patterns:** from, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (5):** @/db, @/db/schema, @/lib/rbac, @/features/credit/ratingMap, ./engine
- **Domain terms:** Demat, Investor, Issuer, KYC, Mandate, Matching, allocation, demat, investor, issuer, kyc, mandate, matching, party


# Batch 084

## `src/features/modeling/actions.ts`

- **Lines:** 194 | **Bytes:** 5820
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createModel
- **Exported types:** CreateModelState
- **Zod schemas:** createModelSchema
- **DB ops patterns:** from, insert, returning, select, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm, next/cache, next/navigation, zod/v4
- **Internal imports (4):** @/lib/rbac, @/db/context, @/db, @/db/schema
- **Domain terms:** party

## `src/features/modeling/bondPricing.ts`

- **Lines:** 743 | **Bytes:** 24237
- **Kind:** Server Actions module
- **Directive:** `use server`
- **Header intent:** Bond pricing & fixed-income analytics - Indian conventions. Source of truth: /home/Jashmhta/crm/docs/FINANCIAL_MODELING_SPEC.md §1.  This is a PURE TypeScript library (no "use server", no DB, no React) so it can run identically in a Server Component, a Server Action, and a Client Component for the interactive calculator. The math is deterministic and side-effect free.  Conventions implemented (FINANCIAL_MODELING_SPEC §1.1-1.2): - ACT/365 default (Indian G-Secs & most corporate bonds); 30/360; AC
- **Exported functions:** computeBondMetrics, instrumentDefaults, pct, inr, bp, years
- **Exported types:** DayCount, InstrumentType, BondInputs, CashFlow, BondMetrics, InstrumentDefaults
- **Domain terms:** Bond, GSEC, bond

## `src/features/modeling/dcf.ts`

- **Lines:** 199 | **Bytes:** 6846
- **Kind:** Application module
- **Header intent:** Quick DCF / WACC calculator (FINANCIAL_MODELING_SPEC §4). Screening-stage valuation range before the banker builds the full model. The full DCF with peer set stays in Excel alongside (§4.5, §7.2).
- **Exported functions:** costOfEquity, computeWacc, equityBridge, computeDcf
- **Exported types:** WaccInputs, FcffInputs, TerminalInputs, DcfResult, EquityBridgeInputs, FullDcfInputs

## `src/features/modeling/lboModel.ts`

- **Lines:** 526 | **Bytes:** 18708
- **Kind:** Application module
- **Header intent:** LBO screening model - sources & uses, multi-tranche debt schedule with cash sweep, sponsor IRR + MOIC, and an entry×exit multiple sensitivity grid (FINANCIAL_MODELING_SPEC §6). A sponsor's first-pass LBO: capitalization, annual debt service with mandatory amortization + excess-cash sweep, exit at a hold-period multiple, and the returns to the sponsor's equity cheque. The full LBO with covenant models, PIK toggles, and monthly sculpting stays in Excel alongside (§6.4, §7.2); this gives a decision
- **Exported functions:** computeLbo, lboDefaults, cr, inrAbs, pctFmt, multipleFmt
- **Exported types:** LboTrancheInput, LboInputs, LboTrancheSchedule, LboSourcesAndUses, LboPeriodRow, LboSensitivityCell, LboResult
- **Domain terms:** mandate


# Batch 085

## `src/features/modeling/maModel.ts`

- **Lines:** 542 | **Bytes:** 21299
- **Kind:** Application module
- **Header intent:** M&A screening model - accretion/dilution + goodwill + acquirer deal IRR (FINANCIAL_MODELING_SPEC §5). A banker's first-pass M&A model: Sources & Uses, purchase-price allocation to goodwill (IFRS 3 / Ind AS 103 acquisition method), pro-forma EPS accretion/dilution, and the acquirer's IRR on the total capital deployed. The full merger model with purchase accounting schedules, stepping synergies, and standalone vs. pro-forma balance-sheet stays in Excel alongside (§5.4, §7.2); this gives a decision
- **Exported functions:** computeSourcesAndUses, computeGoodwill, computeAccretionDilution, computeDealIrr, computeMaModel, maDefaults, cr, inrAbs, pctFmt, epsFmt
- **Exported types:** MaAcquirerInputs, MaTargetInputs, MaConsideration, MaDealInputs, MaInputs, MaSourceItem, MaUseItem, MaSourcesAndUses, MaGoodwill, MaAccretionDilution, MaDealIrr, MaResult
- **Security signals:** india-compliance
- **Domain terms:** allocation, mandate

## `src/features/modeling/projectFinance.ts`

- **Lines:** 358 | **Bytes:** 13533
- **Kind:** Application module
- **Header intent:** Quick project-finance calculator - single-tranche, single-tenor sketch for mandate screening (FINANCIAL_MODELING_SPEC §2). Full multi-tranche sculpting stays in Excel alongside (§2.7, §7.2); this gives a decision-speed answer.  Implements: CFADS build, periodic DSCR, min/avg DSCR, LLCR (discounted at the cost of debt Kd - NOT WACC, per §2.3), PLCR, and debt sizing/sculpting for a target DSCR with capped tenor. Indian conventions: 25.17% tax default (Sec 115BAA), DSRA = 6 months debt service defa
- **Exported functions:** computeProjectFinance
- **Exported types:** ProjectFinanceInputs, PeriodResult, ProjectFinanceResult
- **Domain terms:** mandate

## `src/features/modeling/queries.ts`

- **Lines:** 241 | **Bytes:** 7321
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side financial-model data access (FINANCIAL_MODELING_SPEC §6, §7.1). Reads the `financial_model` table (§2.17) and joins deal/party for the library list and detail views. RLS-aware once policies are migrated; until then these are plain queries (withRls GUCs are no-ops on tables without RLS).
- **Exported functions:** listModels, getModelDetail
- **Exported types:** ModelListItem, ModelListResult, ModelDetail
- **DB ops patterns:** from, leftJoin, select, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/db/schema, @/lib/rbac
- **Domain terms:** party

## `src/features/modeling/scenarioAnalysis.ts`

- **Lines:** 651 | **Bytes:** 23235
- **Kind:** Application module
- **Header intent:** Scenario analysis - best / base / worst case views + two-variable sensitivity grids for every pure-function model in the modelling desk (FINANCIAL_MODELING_SPEC §9). A registry wraps each engine's compute function behind a uniform driver abstraction: the banker flexes a small set of key drivers across their [min, max] range, and the module returns the corner-case outcomes (all drivers at their improving extreme = best, all at their worsening extreme = worst) plus a 2-D sensitivity grid over any 
- **Exported functions:** driverBaseOverrides, defaultDriverState, formatDriver, formatOutcome, getScenarioModel, classifyDrivers, computeScenarios, computeSensitivity
- **Exported const:** SCENARIO_MODELS, SCENARIO_MODEL_LIST
- **Exported types:** ScenarioModelType, DriverUnit, OutcomeFormat, DriverSpec, ScenarioOutcome, ScenarioModelDef, ScenarioCases, DriverState, DriverStateMap, SensitivityGrid
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **Internal imports (5):** @/features/modeling/bondPricing, @/features/modeling/projectFinance, @/features/modeling/dcf, @/features/modeling/maModel, @/features/modeling/lboModel
- **Domain terms:** Bond, bond


# Batch 086

## `src/features/modeling/securitization.ts`

- **Lines:** 206 | **Bytes:** 8083
- **Kind:** Application module
- **Header intent:** Quick securitization / structured-finance sizing calculator (FINANCIAL_MODELING_SPEC §3). Mandate-screening sketch: tranche sizing + credit enhancement (OC, subordination, cash reserve) + waterfall summary. The full monthly-vector waterfall with default curves stays in Excel (§3.5).
- **Exported functions:** computeSecuritization
- **Exported types:** TrancheInput, SecuritizationInputs, TrancheResult, SecuritizationResult
- **Domain terms:** Mandate

## `src/features/onboarding/actions.ts`

- **Lines:** 855 | **Bytes:** 31661
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createOnboarding, advanceStage, startKyc, markDocumentUploaded, verifyDocument, rejectDocument, approveCompliance, rejectCompliance, activateClient, updateAssignedRm, deleteOnboarding
- **Exported types:** CreateOnboardingState, AdvanceStageState, StartKycState, DocUploadState, DocVerifyState, ComplianceState, ActivateState, FieldState, DeleteState
- **Zod schemas:** createSchema, advanceSchema, startKycSchema, docUploadSchema, docVerifySchema, rejectSchema, approveComplianceSchema, rejectComplianceSchema, activateSchema, rmSchema, deleteSchema
- **DB ops patterns:** insert, returning, update
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm, next/cache, next/navigation, zod/v4
- **Internal imports (6):** @/lib/rbac, @/db/context, @/db, @/db/schema, ./queries, ./types
- **Domain terms:** KYC, Onboarding, binarybonds, investor, issuer, kyc, onboarding, party

## `src/features/onboarding/index.ts`

- **Lines:** 55 | **Bytes:** 1300
- **Kind:** Application module
- **Header intent:** Client Onboarding - feature barrel.  Re-exports the domain types/constants, the icon resolver, the server data access, and the server actions so app routes import from one path.
- **Security signals:** india-compliance
- **Internal imports (4):** ./types, ./onboarding-icons, ./queries, ./actions
- **Domain terms:** Onboarding, onboarding

## `src/features/onboarding/onboarding-icons.tsx`

- **Lines:** 100 | **Bytes:** 3190
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** OnboardingDocIcon, OnboardingStageIcon, onboardingStageTone
- **Exported const:** ONBOARDING_STAGE_ICON_TONE
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (3):** @/lib/utils, @/components/brand, ./types
- **Domain terms:** Onboarding, onboarding


# Batch 087

## `src/features/onboarding/queries.ts`

- **Lines:** 695 | **Bytes:** 22398
- **Kind:** Feature data-access (queries)
- **Header intent:** Client Onboarding - server-side data access.  Storage: a JSONB `onboarding_meta` column on party (migration 0007). A party is an onboarding case iff onboarding_meta IS NOT NULL. Because onboarding_meta is not in the frozen Drizzle schema (the schema layer owns src/db/schema/*), the onboarding read paths use parameterised raw SQL via `db.execute(sql\`...\`)` - postgres-js parses the jsonb column into a JS object and timestamptz into a Date automatically. Writes (actions.ts) set onboarding_meta vi
- **Exported functions:** normalizeOnboarding, listRms, fetchAllOnboarding, getOnboardingPipeline, getOnboardingDetail, getLinkedKycStatus, getOnboardingAnalytics
- **Exported types:** RmOption, OnboardingKycState, OnboardingRow, OnboardingPipelineGroup, OnboardingContact, OnboardingTask, OnboardingDetail, OnboardingStageBreakdown, OnboardingClientTypeBreakdown, OnboardingRmBreakdown, OnboardingAnalytics
- **DB ops patterns:** from, innerJoin, leftJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (7):** @/db, @/db/schema, @/features/interactions/queries, @/features/interactions/queries, @/lib/rbac-core, @/lib/rbac, ./types
- **Domain terms:** KYC, Onboarding, Party, issuer, kyc, onboarding, party

## `src/features/onboarding/seed.ts`

- **Lines:** 458 | **Bytes:** 19416
- **Kind:** Application module
- **Header intent:** Client Onboarding - seed.  Run AFTER the main seed (src/db/seed.ts):  npx tsx src/features/onboarding/seed.ts  Populates party.onboarding_meta (migration 0007) with a realistic Indian bond-house onboarding pipeline: ~28 prospect parties created fresh and promoted across the full funnel (initiated → profile_created → documents_collected → kyc_verified → compliance_approved → active), each with a 7-document checklist at a stage-appropriate completion state, a linked kyc_record (approved for kyc_ve
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, node:fs, node:path
- **Internal imports (1):** ./types
- **Domain terms:** KYC, Onboarding, binarybonds, binarycapital, bond, issuer, onboarding, party

## `src/features/onboarding/types.ts`

- **Lines:** 515 | **Bytes:** 18349
- **Kind:** Application module
- **Header intent:** Client Onboarding - shared types + domain constants.  Onboarding is the workflow that turns a prospect into an active, KYC-cleared, compliance-approved client of the Indian bond house / IB (Binary Capital / Binary Bonds). Storage: a JSONB `onboarding_meta` column on party (migration 0007_onboarding.sql). A party is an onboarding case iff party.onboarding_meta IS NOT NULL. See the migration header for the full design rationale (single source of truth = party master; the JSONB blob carries the onb
- **Exported functions:** canTransitionOnboarding, nextStageOf, computeOnboardingSla, freshChecklist, docsUploaded, docsVerified, docsRejected, allDocsVerified, docsUploadProgress, docsVerifyProgress, onboardingProgress
- **Exported const:** ONBOARDING_STAGE_ORDER, ONBOARDING_STAGE_LABELS, ONBOARDING_STAGE_FULL_LABELS, ONBOARDING_STAGE_HINTS, ONBOARDING_STAGE_TONE, ONBOARDING_STAGE_SLA_DAYS, ONBOARDING_STAGE_SLA_LABEL, ONBOARDING_ALLOWED_TRANSITIONS, ONBOARDING_CLIENT_TYPE_ORDER, ONBOARDING_CLIENT_TYPE_LABELS, ONBOARDING_DOC_ORDER, ONBOARDING_DOC_LABELS, ONBOARDING_DOC_SHORT, ONBOARDING_DOC_HINTS, ONBOARDING_DOC_TO_DOCUMENT_TYPE, ONBOARDING_SLA_DUE_SOON_DAYS
- **Exported types:** OnboardingStage, OnboardingClientType, OnboardingDocKey, OnboardingDocStatus, OnboardingDocVerification, OnboardingDocItem, OnboardingStageEntry, OnboardingMeta, OnboardingSlaStatus, OnboardingSlaState
- **Security signals:** india-compliance
- **Domain terms:** Investor, Issuer, KYC, Onboarding, bond, deal_status, investor, issuer, onboarding, party

## `src/features/parties/actions.ts`

- **Lines:** 357 | **Bytes:** 11957
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createParty, assignParty, updatePartySegmentation
- **Exported types:** CreatePartyState, PartyActionState
- **Zod schemas:** createPartySchema, assignPartySchema, updateSegmentationSchema
- **DB ops patterns:** insert, returning, update, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm, next/cache, next/navigation, zod/v4
- **Internal imports (4):** @/lib/rbac, @/db/context, @/db/schema, ./segmentation
- **Domain terms:** Party, investor, issuer, onboarding, party


# Batch 088

## `src/features/parties/queries.ts`

- **Lines:** 762 | **Bytes:** 25452
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side party data access. RLS-aware once policies are migrated; until then these are plain queries (the GUCs set by withRls are no-ops on tables without RLS enabled). All functions are safe to call from Server Components.
- **Exported functions:** listAssignableStaff, listParties, getPartyDetail, getPartyPreview
- **Exported const:** getPartyListSummary
- **Exported types:** PartyListItem, PartyListSummary, PartyListResult, PartyListFilters, PartyDetail, PartyPreviewRelationship, PartyPreviewDeal, PartyPreview
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm, next/cache
- **Internal imports (4):** @/db, @/lib/rbac, @/lib/org, @/db/schema
- **Domain terms:** KYC, Party, binarybonds, binarycapital, mandate, onboarding, party

## `src/features/parties/segmentation.ts`

- **Lines:** 163 | **Bytes:** 3173
- **Kind:** Application module
- **Exported const:** TURNOVER_BANDS, TURNOVER_BAND_LABELS, INDUSTRY_SECTORS, INDUSTRY_SECTOR_LABELS, RATING_VALUES, RATING_AGENCIES, RATING_AGENCY_LABELS, INVESTOR_TYPES, INVESTOR_TYPE_LABELS, PORTFOLIO_SIZE_BANDS, PORTFOLIO_SIZE_LABELS, RISK_APPETITES, RISK_APPETITE_LABELS
- **Exported types:** TurnoverBand, IndustrySector
- **Domain terms:** Bond, investor

## `src/features/portal/index.ts`

- **Lines:** 45 | **Bytes:** 1013
- **Kind:** Application module
- **Header intent:** Investor & Client Portals - feature barrel.  Re-exports the read-only server queries (data access) + the lazy client chart wrappers (recharts) + the shared types so the portal pages import from a single path. No server actions live here - both portals are strictly read-only.
- **Security signals:** india-compliance
- **Internal imports (4):** ./queries, ./queries, ./portal-charts, ./portal-charts
- **Domain terms:** Investor

## `src/features/portal/portal-charts-impl.tsx`

- **Lines:** 350 | **Bytes:** 10049
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** PortalDonutChart, PortalHBarChart, PortalVBarChart
- **Exported const:** PORTAL_PALETTE
- **Exported types:** DonutPoint, LabelValuePoint
- **External deps:** react, recharts
- **Internal imports (1):** @/components/brand/chart-theme
- **Domain terms:** investor, issuer


# Batch 089

## `src/features/portal/portal-charts.tsx`

- **Lines:** 55 | **Bytes:** 2311
- **Kind:** Client component
- **Directive:** `use client`
- **Exported const:** PortalDonutChart, PortalHBarChart, PortalVBarChart
- **External deps:** next/dynamic
- **Internal imports (2):** ./portal-charts-impl, ./portal-charts-impl

## `src/features/portal/queries.ts`

- **Lines:** 1452 | **Bytes:** 47330
- **Kind:** Feature data-access (queries)
- **Header intent:** Investor & Client Portals - read-only server-side data access.  Two external-facing portals over the same party master + deals + KYC + documents tables the internal CRM uses:  INVESTOR PORTAL (src/app/portal/investor/*) An investor party sees the bond book Binary placed for it: holdings derived from allocation_event (event_type allocated/settled) joined to the deal, the issuer (deal_party role='issuer'), the instrument (ISIN, coupon, maturity) and the instrument's latest long-term external ratin
- **Exported functions:** listInvestors, getInvestorDetail, listClients, getClientDetail
- **Exported const:** PORTAL_ENUM_LABELS
- **Exported types:** InvestorListItem, InvestorListSummary, InvestorHolding, InvestorAllocationHistoryRow, InvestorDematAccount, InvestorKyc, InvestorPartyInfo, BreakdownPoint, InvestorDetail, ClientListItem, ClientListSummary, ClientDealRow, ClientDocumentRow, ClientKycRow, ClientContactRow, ClientDetail
- **DB ops patterns:** from
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (2):** @/db, @/lib/rbac
- **Domain terms:** Allocation, Demat, INVESTOR, Investor, KYC, Party, allocation, bond, deal_status, demat, investor, issuer, kyc, mandate, matching, onboarding, party

## `src/features/portfolio/actions.ts`

- **Lines:** 161 | **Bytes:** 6011
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** updateLimit
- **Exported types:** UpdateLimitState
- **Zod schemas:** updateLimitSchema
- **DB ops patterns:** from, insert, select, update, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm, next/cache, zod/v4
- **Internal imports (3):** @/lib/rbac, @/db/context, @/db/schema
- **Domain terms:** barrier

## `src/features/portfolio/index.ts`

- **Lines:** 73 | **Bytes:** 1730
- **Kind:** Application module
- **Header intent:** Portfolio & Exposure Analytics - feature barrel.  Re-exports the query types + the updateLimit server action so the app layer imports from one path. The risk math (./risk) is re-exported here too for tests, but the app pages import the aggregate types from ./queries.
- **Internal imports (6):** ./queries, ./queries, ./actions, ./actions, ./risk, ./risk


# Batch 090

## `src/features/portfolio/queries.ts`

- **Lines:** 1444 | **Bytes:** 49545
- **Kind:** Feature data-access (queries)
- **Header intent:** Portfolio & Exposure Analytics - server-side data access.  READ-ONLY aggregate queries powering the four portfolio pages (overview, concentration, risk-metrics, limits). They reuse the existing `exposure` + `credit_limit` tables (DATA_MODEL §2.16) plus `party`, `sector_code`, `external_rating`, and `instrument`. The aggregates are raw SQL (GROUP BY + CTE + window + jsonb/Pivot via `filter (where ...)`) executed via `db.execute(sql\`...\`)` - the same pattern as `src/features/reports/queries` - b
- **Exported functions:** getPortfolioOverview, getExposureBySector, getExposureByIssuer, getExposureByRatingBand, getExposureByTenor, getLimitUtilizationSummary, getConcentrationAlerts, getSectorConcentration, getIssuerConcentration, getRatingConcentration, getRiskMetrics, getLimits
- **Exported const:** RATING_BAND_ORDER, RBI_SECTORAL_LIMITS, RBI_SINGLE_BORROWER_CAP_PCT, RBI_GROUP_CAP_PCT, HOUSE_ELEVATED_NAME_PCT, HOUSE_HIGH_NAME_PCT
- **Exported types:** RbiSectoralLimit, ExposureByTypeRow, PortfolioOverview, ExposureBySectorRow, ExposureByIssuerRow, ExposureByRatingBandRow, ExposureByTenorRow, LimitUtilizationByType, LimitUtilizationSummary, ConcentrationAlert, ConcentrationAlertSummary, SectorConcentrationRow, IssuerConcentrationRow, RatingConcentrationRow, RiskPositionRow, RiskByTenorRow, RiskMetrics, LimitRow, LimitsFilter, LimitsResult
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm
- **Internal imports (5):** @/db, @/db/schema, @/lib/rbac, ./risk, ./risk
- **Domain terms:** ISSUER, Issuer, issuer, matching, party

## `src/features/portfolio/risk.ts`

- **Lines:** 341 | **Bytes:** 12682
- **Kind:** Application module
- **Header intent:** Portfolio risk math - simplified, decision-speed analytics for the desk. (FINANCIAL_MODELING_SPEC spirit: a screening-grade answer, not a full OAS / key-rate model. The full duration/KRD/OAS work stays in Excel / Bloomberg alongside.)  Per-bond Macaulay + modified duration + convexity from tenor + coupon + yield (par-bond assumption: when no market yield is stored we take yield ≈ coupon, which is the standard first-pass for a freshly-placed par bond). Then portfolio-level DV01 (₹ per 1bp), value
- **Exported functions:** couponDecimal, macaulayDuration, modifiedDuration, convexity, bondDv01Rupees, aggregatePortfolioRisk, tenorBucketKey, herfindahlIndex, topNSharePct
- **Exported const:** VAR_ASSUMPTIONS, TENOR_BUCKETS
- **Exported types:** RiskPosition, PortfolioRiskMetrics, TenorBucket
- **Domain terms:** bond

## `src/features/reports/export-button.tsx`

- **Lines:** 85 | **Bytes:** 3479
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ExportCsvButton
- **Exported types:** ExportCsvButtonProps
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/navigation, react
- **Internal imports (3):** @/lib/utils, @/components/brand/button, @/app/reports/export/route
- **Domain terms:** KYC

## `src/features/reports/export.ts`

- **Lines:** 184 | **Bytes:** 7327
- **Kind:** Application module
- **Header intent:** CSV export utility for the Reports & Export module.  `rowsToCsv` is a PURE function - given an array of rows and an ordered list of column definitions (header + value accessor), it produces an RFC 4180- compliant CSV string with a UTF-8 BOM (so Excel on Windows opens the Indic + rupee figures correctly) and proper field escaping (fields containing a comma, double-quote, CR, or LF are wrapped in double quotes with internal quotes doubled). It is safe to call from a Route Handler and from Server C
- **Exported functions:** rowsToCsv, exportFilename, csvDisposition, formatCr, compactCr, ratingTier, ratingTierColor
- **Exported const:** RATING_LADDER
- **Exported types:** RatingTier
- **Internal imports (1):** ./queries
- **TODOs/FIXMEs:** Cr" */
- **Domain terms:** BC-1, BC-6, matching, scorecard


# Batch 091

## `src/features/reports/exportAccess.ts`

- **Lines:** 13 | **Bytes:** 426
- **Kind:** Application module
- **Exported functions:** canUseCsvExport
- **Exported types:** ExportAccessSubject
- **Security signals:** rbac/rls
- **Domain terms:** binarybonds, binarycapital

## `src/features/reports/index.ts`

- **Lines:** 42 | **Bytes:** 1086
- **Kind:** Application module
- **Header intent:** Reports & Export feature barrel.
- **Security signals:** india-compliance
- **Internal imports (3):** ./queries, ./export, ./export-button

## `src/features/reports/queries.ts`

- **Lines:** 1217 | **Bytes:** 42072
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side report data access for the Reports & Export module.  These are READ-ONLY aggregate queries that power the four detail report pages (pipeline, revenue, credit, compliance) and the CSV export route. Where possible they reuse the existing feature query shapes; the aggregates themselves are raw SQL (group-by + jsonb extraction) executed via `db.execute` - the same pattern as `getDealPipeline` - because Drizzle's query builder is clumsier than SQL for GROUP BY + window + jsonb arrow extra
- **Exported functions:** getPipelineReport, getRevenueReport, getCreditReport, getComplianceReport, getReportsHubKpis, getPipelineExportRows, getRevenueExportRows, getCreditExportRows, getComplianceKycExportRows
- **Exported const:** PIPELINE_STAGE_ORDER, PIPELINE_EXPORT_COLUMNS, REVENUE_EXPORT_COLUMNS, CREDIT_EXPORT_COLUMNS, COMPLIANCE_KYC_EXPORT_COLUMNS
- **Exported types:** PipelineByStageRow, PipelineByTypeRow, PipelineByRmRow, PipelineReport, RevenueByDealRow, RevenueByMonthRow, RevenueByRmRow, RevenueReport, CreditReportRow, CreditReport, CreditReportFilter, KycStatusBreakdownRow, AuditSummaryRow, AuditEntityTypeRow, ConsentStatusRow, ComplianceReport, ReportsHubKpis, ExportColumn
- **DB ops patterns:** from
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/db/schema, @/lib/rbac
- **Domain terms:** BC-1, BC-6, Issuer, KYC, Scorecard, allocation, issuer, kyc, mandate, party, scorecard

## `src/features/tasks/actions.ts`

- **Lines:** 180 | **Bytes:** 5347
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** createTask, updateTaskStatus
- **Exported types:** CreateTaskState, UpdateTaskStatusState
- **Zod schemas:** createTaskSchema, updateTaskStatusSchema
- **DB ops patterns:** from, insert, returning, update, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm, next/cache, next/navigation, zod/v4
- **Internal imports (3):** @/lib/rbac, @/db/context, @/db/schema


# Batch 092

## `src/features/tasks/queries.ts`

- **Lines:** 406 | **Bytes:** 11096
- **Kind:** Feature data-access (queries)
- **Header intent:** Server-side task data access (DATA_MODEL §2.19). Tasks have due dates, priority, status, an assignee (app_user), optional deal/party context, and a dependency graph via the task_dependency junction (PK (task_id, depends_on_task_id)). RLS-aware once policies are migrated; until then these are plain queries. All functions are safe to call from Server Components.
- **Exported functions:** listTasks, getTaskDetail, listAssigneeOptions, listDealOptions, listPartyOptions, listTaskDependencyOptions
- **Exported types:** TaskListItem, TaskListResult, TaskDependencyRow, TaskDetail, AssigneeOption, DealOption, PartyOption, TaskOption
- **DB ops patterns:** from, innerJoin, leftJoin, select, where
- **Security signals:** auth, rbac/rls
- **External deps:** drizzle-orm
- **Internal imports (3):** @/db, @/lib/rbac, @/db/schema
- **Domain terms:** party

## `src/features/workflow/actions.ts`

- **Lines:** 198 | **Bytes:** 7781
- **Kind:** Server Actions module; Client component; Feature mutations (actions)
- **Directive:** `use server`
- **Directive:** `use client`
- **Exported functions:** markAsRead, markAllAsRead, getBellData, loadMoreNotifications
- **Exported types:** MarkReadResult, MarkAllReadResult, BellData, LoadMoreResult
- **DB ops patterns:** from
- **External deps:** next/cache, next/headers
- **Internal imports (5):** @/lib/rbac, ./engine, ./queries, ./types, ./types

## `src/features/workflow/engine.ts`

- **Lines:** 773 | **Bytes:** 27303
- **Kind:** Application module
- **Header intent:** Workflow Automation - the notification trigger engine.  `generateNotifications(db)` scans live tables for workflow trigger conditions and returns a typed, serializable Notification[]. Nothing is persisted: the set is recomputed fresh on every load (the MVP stores only read/dismissed state in a cookie - see queries.ts / actions.ts). A notification naturally disappears when its trigger condition clears (the overdue task is completed, the stuck deal advances, the expired KYC is re-run), so the cent
- **Exported functions:** generateNotifications
- **Exported types:** NotificationEngineOptions
- **DB ops patterns:** from, innerJoin, leftJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (4):** @/db, @/lib/rbac, @/db/schema, ./types
- **Domain terms:** KYC, Mandate, Party, bond, credit_analysis, issuer, kyc, mandate, matching, party

## `src/features/workflow/index.ts`

- **Lines:** 40 | **Bytes:** 1270
- **Kind:** Client component
- **Directive:** `use client`
- **Header intent:** Workflow Automation - feature barrel.  Re-exports the domain types/constants, the trigger engine, the server-side reads, and the server actions so server routes import from one path.  IMPORTANT (client-component import discipline - see the leads barrel): `@/features/workflow` re-exports ./queries, which imports the `db` (postgres) client. A "use client" component that imports from THIS barrel would pull the postgres driver into the client bundle and break compilation. Client components (the noti
- **Internal imports (6):** @/features/workflow/actions, @/features/workflow/types, ./types, ./engine, ./queries, ./actions


# Batch 093

## `src/features/workflow/queries.ts`

- **Lines:** 176 | **Bytes:** 7201
- **Kind:** Feature data-access (queries)
- **Header intent:** Workflow Automation - server-side reads + read-state cookie helpers.  The notification set is COMPUTED (engine.ts) - nothing is persisted. Read state (which notifications the user has dismissed) lives in a cookie so the MVP needs no schema change. The cookie stores the set of dismissed ENTITY IDS (uuids), not the full `${type}:${entityId}` notification id: each trigger type references a distinct entity row (kyc_record / deal / credit_analysis / task / consent_record), so the entityId alone is a 
- **Exported functions:** readReadIds, listNotifications, computeStats, getUnreadCount, getNotificationsAndStats
- **Exported const:** READ_COOKIE, READ_COOKIE_CAP
- **Security signals:** india-compliance
- **External deps:** next/headers
- **Internal imports (4):** @/lib/rbac, ./engine, ./types, ./types
- **Domain terms:** credit_analysis

## `src/features/workflow/types.ts`

- **Lines:** 186 | **Bytes:** 7372
- **Kind:** Application module
- **Header intent:** Workflow Automation - notifications, reminders, escalations.  A notification here is a COMPUTED signal: the engine scans the live data (kyc_record, deal, credit_analysis, task, consent_record) for trigger conditions and returns a typed Notification[] - nothing is persisted. Read state (which notifications the user has dismissed) is stored in a cookie (see queries.ts / actions.ts), so the MVP needs no schema change. The set is recomputed fresh on every load; a notification disappears when its tri
- **Exported functions:** notificationId, relativeTime
- **Exported const:** SEVERITY_ORDER, SEVERITY_LABELS, SEVERITY_BADGE_VARIANT, NOTIFICATION_TYPE_ORDER, NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPE_GROUP
- **Exported types:** Severity, NotificationType, NotificationView, Notification, NotificationStats
- **Security signals:** india-compliance
- **Domain terms:** KYC, bond, credit_analysis, mandate, party

## `src/lib/auth.ts`

- **Lines:** 287 | **Bytes:** 11423
- **Kind:** Shared library
- **Header intent:** Auth.js v5 configuration (next-auth@5.0.0-beta.31) with the Drizzle adapter.  SESSION STRATEGY: JWT (this initial build). PRODUCTION TARGET: DB-stored sessions mirrored to in-region Redis (ElastiCache ap-south-1) so sessions are revocable at the edge (ARCHITECTURE §4.7). The adapter + `sessions` table are wired here so the cutover is `session: { strategy: "database" }` plus a Redis cache, not a re-architecture.  TODO(PRODUCTION): switch `session: { strategy: "database" }` and mirror session rows
- **DB ops patterns:** from, innerJoin, select, update, where
- **Security signals:** auth, rbac/rls, credentials
- **External deps:** @auth/drizzle-adapter, bcryptjs, drizzle-orm, next-auth, next-auth/jwt, next-auth/providers/credentials, otpauth
- **Internal imports (3):** @/db, @/db/schema, @/lib/org
- **TODOs/FIXMEs:** switch `session: { strategy: "database" }` and mirror
- **Domain terms:** binarybonds, binarycapital

## `src/lib/org.ts`

- **Lines:** 117 | **Bytes:** 3454
- **Kind:** Shared library
- **Header intent:** Binary Capital org model (CEO meeting). Brand scope is derived from desk so we need no schema migration.
- **Exported functions:** brandFromDesk, isSuperAdmin, isAdminish, isFirmWide, partyBrandSqlValues, isCreditModuleActive, canAccessCreditModule
- **Exported const:** ORG_ROSTER
- **Exported types:** BrandScope
- **Security signals:** rbac/rls
- **Domain terms:** Party, binarybonds, binarycapital, bond


# Batch 094

## `src/lib/rbac-core.ts`

- **Lines:** 17 | **Bytes:** 379
- **Kind:** Shared library
- **Exported functions:** can
- **Exported types:** RbacSubject
- **Security signals:** auth, rbac/rls

## `src/lib/rbac.ts`

- **Lines:** 154 | **Bytes:** 4161
- **Kind:** Shared library
- **Header intent:** RBAC helper + server-side current-user loader. Brand scope + super-admin export rules from CEO org model (lib/org.ts).
- **Exported functions:** requireUser, canReadAllInScope, isFirmWideUser
- **Exported const:** getCurrentUser
- **Exported types:** CrmUser
- **DB ops patterns:** from, innerJoin, select, where
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** drizzle-orm, next/navigation, react
- **Internal imports (5):** @/lib/auth, @/db, @/db/schema, @/lib/org, ./rbac-core
- **Domain terms:** binarybonds, binarycapital, kyc, party

## `src/lib/utils.ts`

- **Lines:** 6 | **Bytes:** 166
- **Kind:** Shared library
- **Exported functions:** cn
- **External deps:** clsx, tailwind-merge

## `src/proxy.ts`

- **Lines:** 56 | **Bytes:** 2214
- **Kind:** Application module
- **Header intent:** Next.js 16 Proxy - the renamed, Node.js-runtime successor to `middleware.ts`. See node_modules/next/dist/docs/01-app/.../proxy.md: "Starting with Next.js 16, Middleware is now called Proxy." The file convention is `proxy.ts` at the same level as `app/` (i.e. in `src/` for this project), and the exported function is `proxy` (named) or a default export.  RESPONSIBILITY: COARSE auth only - redirect unauthenticated users to /login and bounce already-authenticated users off /login. RBAC enforcement (
- **Exported const:** config
- **Default export:** yes
- **Security signals:** auth, rbac/rls
- **External deps:** next/server
- **Internal imports (1):** @/lib/auth


# Batch 095

## `src/scripts/import-parties.ts`

- **Lines:** 810 | **Bytes:** 26098
- **Kind:** Application module
- **Header intent:** CSV import tool for the party master (DATA_MODEL §1.1, §1.4, §2.1-2.3).  Run: npx tsx src/scripts/import-parties.ts --generate-sample 10000 [--out path] npx tsx src/scripts/import-parties.ts <csv-path> [--batch N] [--queued-out path]  Pipeline (matches the §1.4 dedup contract + a PartyService-style promote): 1. Parse CSV (papaparse, header row). 2. Validate each row (zod): required fields + PAN/GSTIN/CIN/LEI format. 3. Normalize identifiers (uppercase, trim). 4. Dedup: - existing-match  -> "dedu
- **Zod schemas:** RowSchema
- **DB ops patterns:** from, insert, returning, select, where
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, node:fs, node:path, papaparse, zod
- **Domain terms:** binarybonds, binarycapital, investor, issuer, onboarding, party

## `tsconfig.json`

- **Lines:** 34 | **Bytes:** 670
- **Kind:** Application module

## `vercel.ts`

- **Lines:** 55 | **Bytes:** 2729
- **Kind:** Application module
- **Exported const:** config
- **Security signals:** india-compliance

## `vitest.config.ts`

- **Lines:** 36 | **Bytes:** 1285
- **Kind:** Application module
- **Header intent:** Vitest configuration — Track B (TESTS).  Scope: pure library units under src/__tests__/. The financial engines (bondPricing, ratios, scorecard, ratingMap static mapping) are deterministic and side-effect free, so they run in the node environment without a database or a running Next server. The route smoke test is opt-in via SMOKE_BASE_URL (it fetches a live server) and self-skips otherwise, so `vitest run` stays green in CI / without a Postgres.  Path alias `@/*` → `src/*` mirrors tsconfig.json 
- **Default export:** yes
- **External deps:** node:path, node:url, vitest/config
- **Domain terms:** scorecard
