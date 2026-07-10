
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
