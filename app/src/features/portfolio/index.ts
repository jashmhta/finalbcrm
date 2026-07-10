// Portfolio & Exposure Analytics - feature barrel.
//
// Re-exports the query types + the updateLimit server action so the app layer
// imports from one path. The risk math (./risk) is re-exported here too for
// tests, but the app pages import the aggregate types from ./queries.

export {
  // Reference tables + ordering
  RATING_BAND_ORDER,
  RBI_SECTORAL_LIMITS,
  RBI_SINGLE_BORROWER_CAP_PCT,
  RBI_GROUP_CAP_PCT,
  HOUSE_ELEVATED_NAME_PCT,
  HOUSE_HIGH_NAME_PCT,
  // Query functions
  getPortfolioOverview,
  getExposureBySector,
  getExposureByIssuer,
  getExposureByRatingBand,
  getExposureByTenor,
  getLimitUtilizationSummary,
  getConcentrationAlerts,
  getSectorConcentration,
  getIssuerConcentration,
  getRatingConcentration,
  getRiskMetrics,
  getLimits,
} from "./queries";

export type {
  PortfolioOverview,
  ExposureByTypeRow,
  ExposureBySectorRow,
  ExposureByIssuerRow,
  ExposureByRatingBandRow,
  ExposureByTenorRow,
  LimitUtilizationByType,
  LimitUtilizationSummary,
  ConcentrationAlert,
  ConcentrationAlertSummary,
  SectorConcentrationRow,
  IssuerConcentrationRow,
  RatingConcentrationRow,
  RiskPositionRow,
  RiskByTenorRow,
  RiskMetrics,
  LimitRow,
  LimitsFilter,
  LimitsResult,
  RbiSectoralLimit,
} from "./queries";

export { updateLimit } from "./actions";
export type { UpdateLimitState } from "./actions";

// Pure risk math - re-exported for unit tests + the risk-metrics view.
export {
  macaulayDuration,
  modifiedDuration,
  convexity,
  bondDv01Rupees,
  aggregatePortfolioRisk,
  herfindahlIndex,
  topNSharePct,
  tenorBucketKey,
  VAR_ASSUMPTIONS,
  TENOR_BUCKETS,
} from "./risk";
export type {
  RiskPosition,
  PortfolioRiskMetrics,
  TenorBucket,
} from "./risk";
