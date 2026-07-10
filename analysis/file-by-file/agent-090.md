# Agent 090 — File-by-file analysis (batch-090)

Files: portfolio/queries.ts, risk.ts, reports/export-button.tsx, reports/export.ts | Fully read (queries structure + risk full + export full)

---

## src/features/portfolio/queries.ts

- **Lines:** ~1450+  
- **Role:** READ-ONLY aggregate SQL for portfolio overview, concentration, risk metrics, limits. Pattern: latest exposure per party (DISTINCT ON as_of_date DESC) + credit_limit current rows + app-layer scope.

- **Exports (functions):**
  - `getPortfolioOverview`, `getExposureBySector`, `getExposureByIssuer`
  - `getExposureByRatingBand`, `getExposureByTenor`
  - `getLimitUtilizationSummary`
  - `getConcentrationAlerts`, `getSectorConcentration`, `getIssuerConcentration`, `getRatingConcentration`
  - `getRiskMetrics` (loads positions → pure aggregatePortfolioRisk + by-tenor)
  - `getLimits` (filterable limit rows)

- **Constants:** RATING_BAND_ORDER; RBI_SECTORAL_LIMITS (infra 40%, RE 15%, NBFC 25%); RBI single-borrower 25% / group 50%; house elevated 5% / high 10% name thresholds.

- **SQL CASE helpers:** SECTOR_FAMILY_CASE, RATING_BAND_CASE, TENOR_BUCKET_CASE.

- **Scope:** exposureScopeSql EXISTS party owner chain; creditLimitScopeSql party ownership.

- **Units:** gross_exposure in **CRORES** (IB convention) — consistent with reports export, matching engine.

- **Security:** can read_all portfolio/party/admin; unscoped full.

- **Risks:** Latest snapshot only (no historical book); rating band from latest external_rating join quality depends on seed; concentration alerts compare % of book not % of owned funds (RBI norms are of capital — documented as reference).

---

## src/features/portfolio/risk.ts

- **Lines:** 342  
- **Role:** Pure portfolio risk math — screening-grade duration/DV01/VaR/HHI (not full OAS/KRD).

- **Exports:**
  - `couponDecimal`, `macaulayDuration`, `modifiedDuration`, `convexity`, `bondDv01Rupees`
  - `RiskPosition`, `PortfolioRiskMetrics`, `aggregatePortfolioRisk`
  - `VAR_ASSUMPTIONS` — 6bp daily yield shock, z99=2.33, 1-day 99%
  - TENOR_BUCKETS, tenorBucketKey
  - `herfindahlIndex`, `topNSharePct`

- **Key formulas:**
  - Mac duration numeric sum annual CF (par-bond yield≈coupon default; coupon fallback 8%).
  - Mod = Mac/(1+y); DV01 = face₹ × modDur × 1e-4.
  - Portfolio value-weighted mod/mac/convexity; Σ DV01.
  - VaR1d99 = total₹ × portModDur × 0.0006 × 2.33.
  - HHI on percent shares (0–10000 scale); CR-n top share.

- **Business purpose:** Desk decision-speed analytics; assumptions surfaced in UI for mental stress.

- **Risks:** Annual-pay assumption; par-bond when yield null; parametric normal VaR only.

---

## src/features/reports/export-button.tsx

- **Lines:** 86  
- **Role:** `"use client"` Export CSV button — plain `<a href="/reports/export?kind=…&filters">` so browser download uses Content-Disposition; no blob code; no function props across RSC.

- **Exports:** `ExportCsvButtonProps`, `ExportCsvButton`.

- **Key logic:**
  - useSearchParams → forward filters; DROP page/id; kind param avoids collision with module `type` filter (documents).
  - Button asChild → anchor; responsive label Export CSV / CSV; h-11 mobile / md:h-8 desktop.
  - Import type `ExportKind` from route module.

- **Security:** Relies on export route auth (not in this file). Forwards whatever filters are in URL (user-controlled).

- **Coupling:** Brand Button, Phosphor DownloadSimple, reports export route.

---

## src/features/reports/export.ts

- **Lines:** 184  
- **Role:** Pure CSV + formatting utilities for Reports module. Safe from Route Handlers and Server Components.

- **Exports:**
  - `rowsToCsv(rows, columns)` — RFC 4180, UTF-8 BOM, CRLF, quote escape
  - `exportFilename(prefix)`, `csvDisposition(filename)` RFC 5987
  - `formatCr`, `compactCr` — crore formatters (no ₹→Cr division; values already Cr)
  - `ratingTier`, `ratingTierColor`, `RATING_LADDER` for credit report UI

- **Business purpose:** Excel-friendly Indic exports; unit consistency for crore-denominated CRM numbers.

- **Risks:** None pure; consumers must pass serializable column value accessors.

---

## Batch 090 synthesis

Portfolio analytics + risk pure math power desk risk views; reports export utilities enable filter-matched CSV downloads without client blob gymnastics. Closes MEGA-B features remainder through reports start.
