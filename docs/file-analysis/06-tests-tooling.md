# 06 — Tests & Tooling

Vitest pure-engine tests and operational scripts (deploy, verify, mobile QA, screenshots).

## File inventory

_27 files · 7,140 lines_

### Domain: `data`

PRD: **Cross-cutting / Supporting**

#### `app/src/scripts/import-parties.ts`

| Field | Value |
|---|---|
| Role | `script` — Operational / QA / import script |
| LOC | 810 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | CSV import tool for the party master (DATA_MODEL §1.1, §1.4, §2.1-2.3).  Run: npx tsx src/scripts/import-parties.ts --generate-sample 10000 [--out path] npx tsx src/scripts/import-parties.ts <csv-path> [--batch N] [--queued-out path]  Pipeline (matches the §1.4 dedup contract + a PartyService-style promote): 1. Parse CSV (papaparse, header row). 2. Validate each row (zod): required fields + PAN/GS |

### Domain: `qa-deploy`

PRD: **Cross-cutting / Supporting**

#### `app/scripts/_audit-set2.mjs`

| Field | Value |
|---|---|
| Role | `script` — Operational / QA / import script |
| LOC | 103 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Operational / QA / import script |

#### `app/scripts/deploy.sh`

| Field | Value |
|---|---|
| Role | `script` — Operational / QA / import script |
| LOC | 123 |
| Runtime | n/a |
| Uses DB | Y |
| Maturity | supporting |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose |  Deploy the Binary Capital CRM via the India-hosted Path 2 (containers on AWS ap-south-1 / Azure West India). ARCHITECTURE.md §2.3.  Flow:  build image  →  run Drizzle migrations (one-off)  →  start app container  Migrations are run from the *build* stage image (which carries drizzle-kit + the full devDependency tree), NOT the slim runtime image — this keeps the runtime image small while still let |

#### `app/scripts/diag-css-links.mjs`

| Field | Value |
|---|---|
| Role | `script` — Operational / QA / import script |
| LOC | 68 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Print the exact stylesheet <link> hrefs on /deals (authed, mobile) and their load status + the HTTP status when fetched directly. Then compare the same on /parties. Determines whether the "second CSS never loads" is a real broken/404 chunk or a puppeteer load race. |

#### `app/scripts/diag-css-timing.mjs`

| Field | Value |
|---|---|
| Role | `script` — Operational / QA / import script |
| LOC | 86 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Confirm whether the Tailwind stylesheet applies after enough wait time on /deals (the overflowing page). Polls nav.display + navLinksWrap.display + scrollWidth at 500/1500/3000/5000ms, and also waits for networkidle2 + the first <link rel=stylesheet> to load. If display flips to flex and scrollWidth drops to 390, the overflow was a pre-CSS measurement artifact. |

#### `app/scripts/diag-nav.mjs`

| Field | Value |
|---|---|
| Role | `script` — Operational / QA / import script |
| LOC | 96 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Focused diagnostic: on one overflowing page (/deals) and one clean page (/parties), report the desktop nav container's computed display, a sample desktop nav link's computed display + rect, and the single widest element (max right edge) with its ancestor chain. Tells us WHY scrollWidth=638 on deals but 390 on parties despite the same SiteNav component. |

#### `app/scripts/diag-theme-logo.mjs`

| Field | Value |
|---|---|
| Role | `script` — Operational / QA / import script |
| LOC | 60 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Directly verify the theme toggle flips html.dark and the nav logo <img> renders on an authed page — with a post-click wait (next-themes updates the class via an effect, so the verifier's instant check can false-negative). |

#### `app/scripts/mobile-overflow-all.mjs`

| Field | Value |
|---|---|
| Role | `script` — Operational / QA / import script |
| LOC | 131 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | All-routes mobile overflow audit: every user-facing route at 390px, confirm 200 + no document-level horizontal overflow (scrollWidth <= viewport), and for any element whose right edge exceeds the viewport, report whether it is INSIDE an overflow-clipped (overflow-x:auto/hidden/scroll) ancestor — i.e. a contained scrollable region (fine) vs a true page overflow (bug). |

#### `app/scripts/mobile-pass.mjs`

| Field | Value |
|---|---|
| Role | `script` — Operational / QA / import script |
| LOC | 223 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Mobile excellence pass: capture 390x844 screenshots for the required route set AND measure horizontal overflow (document.scrollWidth vs viewport) + flag elements wider than 390px. Logs in first via the form, driving the AUTH_URL host so the next-auth session cookie domain matches the proxy redirects (see scripts/screenshot.mjs for the rationale). |

#### `app/scripts/screenshot.mjs`

| Field | Value |
|---|---|
| Role | `script` — Operational / QA / import script |
| LOC | 209 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Operational / QA / import script |

#### `app/scripts/verify-logo-theme.mjs`

| Field | Value |
|---|---|
| Role | `script` — Operational / QA / import script |
| LOC | 101 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Focused check: (a) the real BC logo renders in the nav AND login (detect via the bundled static-media logo filename in the page HTML, regardless of the /_next/image wrapper), (b) the theme toggle actually flips html.dark after allowing React's re-render tick. Login uses the AUTH_URL host. |

#### `app/scripts/verify-routes.mjs`

| Field | Value |
|---|---|
| Role | `script` — Operational / QA / import script |
| LOC | 194 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Step 5 verification: log in, extract the session cookie, then fetch every user-facing route (authed) and confirm 200 + real content (not redirected to /login, not a thin/empty/404). Also confirms the real BC logo renders in nav + login + favicon, and the theme toggle is present. Uses the AUTH_URL host so the session cookie domain matches (see scripts/screenshot.mjs for why). |

#### `app/scripts/verify.mjs`

| Field | Value |
|---|---|
| Role | `script` — Operational / QA / import script |
| LOC | 134 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Verify the previously-broken screens render real data by logging in and dumping key text content from each page. More reliable than screenshots for confirming no NaN/undefined and real rows. |

### Domain: `unit`

PRD: **Quality Assurance**

#### `app/src/__tests__/aiSummary.test.ts`

| Field | Value |
|---|---|
| Role | `unit-test` — Vitest unit tests |
| LOC | 511 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | tested |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | AI engines - heuristic generator invariants. Source of truth: src/features/ai/{creditSummary,interactionSummary,clientInsights}.ts.  Pins the deterministic behaviour of the "no external LLM" generators: - creditSummary: recommendation posture by band, NBFC framing, trend line, strengths/concerns thresholds, rating line. - interactionSummary: topic extraction, action-item extraction, empty scope, p |

#### `app/src/__tests__/bondPricing.test.ts`

| Field | Value |
|---|---|
| Role | `unit-test` — Vitest unit tests |
| LOC | 480 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | tested |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Bond pricing engine - canonical-case verification. Source of truth for expected behaviour: src/features/modeling/bondPricing.ts and docs/FINANCIAL_MODELING_SPEC.md §1.  These tests pin the financially-meaningful invariants, not floating-point exactness: a par bond prices cleanly at 100 with YTM == coupon, a discount bond prices below par, Macaulay duration is bounded by (0, maturity), convexity is |

#### `app/src/__tests__/kyc.test.ts`

| Field | Value |
|---|---|
| Role | `unit-test` — Vitest unit tests |
| LOC | 428 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | tested |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | KYC lifecycle helpers - exhaustive verification (PMLA 2002 + RBI Master Direction on KYC).  Source of truth: src/features/compliance/kyc.ts and the COMPLIANCE_LEGAL_FEASIBILITY.md §5 research.  Coverage: - Beneficial-ownership thresholds: company/SPV >10%, partnership >15%, trust >15%, natural_person / government / regulator → role-based (null). - requiresEddForBo: EDD triggers at >= threshold; nu |

#### `app/src/__tests__/lboModel.test.ts`

| Field | Value |
|---|---|
| Role | `unit-test` — Vitest unit tests |
| LOC | 192 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | tested |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | LBO engine - financial invariants verification. Source of truth: src/features/modeling/lboModel.ts. Pins the real-IB invariants: S&U balance, debt schedule amortizes to ≤ origin, sponsor IRR rises with exit multiple / falls with entry multiple, MOIC = exit / entry equity, sensitivity grid shape & monotonicity. |

#### `app/src/__tests__/maModel.test.ts`

| Field | Value |
|---|---|
| Role | `unit-test` — Vitest unit tests |
| LOC | 200 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | tested |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | M&A engine - financial invariants verification. Source of truth: src/features/modeling/maModel.ts. Pins the real-IB invariants (S&U balance, goodwill = consideration − net assets, accretive iff combined EPS > standalone, deal IRR sign) rather than float exactness. |

#### `app/src/__tests__/matching.test.ts`

| Field | Value |
|---|---|
| Role | `unit-test` — Vitest unit tests |
| LOC | 675 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | tested |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Investor Matching Engine - exhaustive verification of the scoring + ranking business logic (Binary Capital CRM USP - scrape/BUSINESS_CONTEXT.md §3).  Source of truth: src/features/matching/engine.ts.  Coverage: - Weight distribution: the six SCORED criteria sum to 1.0; relationship is weight 0 (indicator only, not in the base score). - scoreInvestor: 0–100 weighted score, exact values for canonica |

#### `app/src/__tests__/ratingMap.test.ts`

| Field | Value |
|---|---|
| Role | `unit-test` — Vitest unit tests |
| LOC | 324 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | tested |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Rating-agency scale mapping - verifies the static (no-DB) mapping functions in src/features/credit/ratingMap.ts (CREDIT_ANALYSIS_SPEC §5).  We exercise only the pure mapping: coreSymbolToRank, symbolToBand, rankToBand, bandToCanonicalRank. These do not touch the database, so the test is hermetic. The DB-backed resolveBand/resolveRung loaders are covered by integration tracks, not here. |

#### `app/src/__tests__/ratios.test.ts`

| Field | Value |
|---|---|
| Role | `unit-test` — Vitest unit tests |
| LOC | 442 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | tested |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Ratio engine - verifies computeRatios on a known financial_statement set. Source: src/features/credit/ratios.ts (CREDIT_ANALYSIS_SPEC §3).  The line-item map below is hand-constructed so every ratio has a clean, checkable expected value. All assertions use closeTo with generous tolerance because the engine does plain float arithmetic. |

#### `app/src/__tests__/rbacSegmentation.test.ts`

| Field | Value |
|---|---|
| Role | `unit-test` — Vitest unit tests |
| LOC | 215 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | tested |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Vitest unit tests |

#### `app/src/__tests__/reports.test.ts`

| Field | Value |
|---|---|
| Role | `unit-test` — Vitest unit tests |
| LOC | 251 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | tested |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Reports & Export - pure-utility unit tests.  Covers the CSV builder (rowsToCsv: RFC 4180 escaping, BOM, CRLF), the filename + Content-Disposition helpers, and the crore formatters + rating- tier map. These are pure functions (no DB, no Next), so they run in the node environment alongside the other engine tests. The route handler's query correctness is verified separately against the seeded DB (see |

#### `app/src/__tests__/routeSmoke.test.ts`

| Field | Value |
|---|---|
| Role | `unit-test` — Vitest unit tests |
| LOC | 53 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | tested |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Route smoke test - opt-in HTTP check against a running Next server.  This is intentionally NOT a next/test render (which would pull in a DOM testing library the deps agent hasn't installed). Instead it fetches the real routes and asserts the HTTP shape: /login is public (200), and /parties is gated by the proxy/auth layer (redirects to /login or returns 401/403 - never 200 with a parties payload t |

#### `app/src/__tests__/scenarioAnalysis.test.ts`

| Field | Value |
|---|---|
| Role | `unit-test` — Vitest unit tests |
| LOC | 188 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | tested |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Scenario analysis engine - invariants verification. Source of truth: src/features/modeling/scenarioAnalysis.ts. Pins: - the registry exposes all five model types with coherent drivers - best ≥ base ≥ worst on the primary metric (corner-case ordering) - driver direction classification matches financial intuition - sensitivity grid shape + monotonicity per model |

#### `app/src/__tests__/scorecard.test.ts`

| Field | Value |
|---|---|
| Role | `unit-test` — Vitest unit tests |
| LOC | 325 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | tested |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Scorecard scoring - verifies computeScorecard invariants and band mapping. Source: src/features/credit/scorecard.ts (CREDIT_ANALYSIS_SPEC §4).  The scorecard is a weighted 0–100 composite over sub-factors (weights sum to 1.0). We assert: total score is bounded in [0, 100], the reported band is consistent with bandFromScore, an all-5 override yields exactly 100 / BC-1, and an all-1 override yields  |

#### `app/src/__tests__/stages.test.ts`

| Field | Value |
|---|---|
| Role | `unit-test` — Vitest unit tests |
| LOC | 518 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | tested |
| Criticality | supporting |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Deal-stage flow - exhaustive verification of the per-deal-type pipeline ladder + transition validation.  Source of truth: src/features/deals/stages.ts + catalog.ts (and scrape/BUSINESS_CONTEXT.md §2-3 service processes).  Coverage: - Per-deal-type ladder presence + ordering for the canonical deal types: bond underwriting, M&A, G-Sec auction, ECM IPO, structured finance, project finance, DCM adviso |
