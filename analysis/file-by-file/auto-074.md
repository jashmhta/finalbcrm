
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
