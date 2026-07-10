export const TURNOVER_BANDS = [
  "lt_50",
  "50_75",
  "75_100",
  "100_150",
  "150_175",
  "175_200",
  "200_300",
  "300_500",
  "500_750",
  "750_1000",
  "gt_1000",
] as const;

export type TurnoverBand = (typeof TURNOVER_BANDS)[number];

export const TURNOVER_BAND_LABELS: Record<TurnoverBand, string> = {
  lt_50: "<= 50 Cr",
  "50_75": "50-75 Cr",
  "75_100": "75-100 Cr",
  "100_150": "100-150 Cr",
  "150_175": "150-175 Cr",
  "175_200": "175-200 Cr",
  "200_300": "200-300 Cr",
  "300_500": "300-500 Cr",
  "500_750": "500-750 Cr",
  "750_1000": "750-1,000 Cr",
  gt_1000: "1,000 Cr+",
};

export const INDUSTRY_SECTORS = [
  "infra",
  "fintech",
  "epc",
  "roads",
  "buildings",
  "manufacturing",
  "textiles",
  "oem",
  "plastics",
  "recycled_plastics",
  "nbfc",
  "real_estate",
  "renewables",
  "logistics",
  "healthcare",
  "education",
  "consumer",
  "other",
] as const;

export type IndustrySector = (typeof INDUSTRY_SECTORS)[number];

export const INDUSTRY_SECTOR_LABELS: Record<IndustrySector, string> = {
  infra: "Infrastructure",
  fintech: "Fintech",
  epc: "EPC",
  roads: "Roads",
  buildings: "Buildings",
  manufacturing: "Manufacturing",
  textiles: "Textiles",
  oem: "OEM / Auto Ancillary",
  plastics: "Plastics",
  recycled_plastics: "Recycled plastics",
  nbfc: "NBFC",
  real_estate: "Real estate",
  renewables: "Renewables",
  logistics: "Logistics",
  healthcare: "Healthcare",
  education: "Education",
  consumer: "Consumer",
  other: "Other",
};

export const RATING_VALUES = [
  "AAA",
  "AA+",
  "AA",
  "AA-",
  "A+",
  "A",
  "A-",
  "BBB+",
  "BBB",
  "BBB-",
  "BB+",
  "BB",
  "BB-",
] as const;

export const RATING_AGENCIES = [
  "CRISIL",
  "ICRA",
  "CARE",
  "India_Ratings",
  "Acuite",
  "Infomerics",
  "Brickwork",
] as const;

export const RATING_AGENCY_LABELS: Record<string, string> = {
  CRISIL: "CRISIL",
  ICRA: "ICRA",
  CARE: "CARE",
  India_Ratings: "India Ratings",
  Acuite: "Acuite",
  Infomerics: "Infomerics",
  Brickwork: "Brickwork",
};

export const INVESTOR_TYPES = [
  "equity_pms",
  "mutual_fund",
  "bond_investor",
  "aif",
  "family_office",
  "hni",
  "insurance",
  "bank_treasury",
  "corporate_treasury",
  "pension_fund",
] as const;

export const INVESTOR_TYPE_LABELS: Record<string, string> = {
  equity_pms: "Equity PMS",
  mutual_fund: "Mutual fund",
  bond_investor: "Bond investor",
  aif: "AIF",
  family_office: "Family office",
  hni: "HNI",
  insurance: "Insurance",
  bank_treasury: "Bank treasury",
  corporate_treasury: "Corporate treasury",
  pension_fund: "Pension fund",
};

export const PORTFOLIO_SIZE_BANDS = [
  "lt_50",
  "50_100",
  "100_250",
  "250_500",
  "500_1000",
  "gt_1000",
] as const;

export const PORTFOLIO_SIZE_LABELS: Record<string, string> = {
  lt_50: "<= 50 Cr",
  "50_100": "50-100 Cr",
  "100_250": "100-250 Cr",
  "250_500": "250-500 Cr",
  "500_1000": "500-1,000 Cr",
  gt_1000: "1,000 Cr+",
};

export const RISK_APPETITES = ["low", "moderate", "high", "high_yield"] as const;

export const RISK_APPETITE_LABELS: Record<string, string> = {
  low: "Low risk",
  moderate: "Moderate",
  high: "High",
  high_yield: "High yield",
};

