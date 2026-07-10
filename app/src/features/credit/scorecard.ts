// Scorecard scoring - weighted 0-100 scorecard with band mapping
// (CREDIT_ANALYSIS_SPEC §4).
//
// Formula (spec §4.1): total_score = Σᵢ [ weightᵢ × (sub_scoreᵢ / 5) ] × 100,
// sub_score ∈ {1..5}, Σ weights = 1.0. Equivalent: total_score =
// Σ(component_score × component_weight) × 20, which is what the
// credit_score.weighted_score generated column (component_score ×
// component_weight) rolls up to - so persisting one credit_score row per
// sub-factor with component_weight = fractional sub-factor weight and
// component_score = 1..5 reproduces the spec formula exactly.
//
// DSCR weight reallocation (spec §4.1 note): for non-project / non-SPV
// obligors, DSCR is meaningless and its 7% weight is reallocated +4% to
// Interest Coverage (→12%) and +3% to FCF/Debt (→8%). This split is
// template-configurable via ScorecardTemplate.factor_weights_json; the
// default reallocation lives here.
//
// Quantitative sub-factors are auto-scored against sector-adjusted
// benchmark thresholds (manufacturing template defaults from spec §3.1 /
// §4.1 example). Qualitative sub-factors default to 3 (neutral) pending
// analyst input and may be overridden with a rationale.

import type { RatioSet } from "./ratios";

/** Obligor type values (obligor_type enum). */
export type ObligorType =
  | "corporate"
  | "spv"
  | "project"
  | "sovereign"
  | "state_psu"
  | "nbfc"
  | "bank";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Band = "BC-1" | "BC-2" | "BC-3" | "BC-4" | "BC-5" | "BC-6";

/** A single sub-factor in the scorecard. */
export interface SubFactor {
  code: string;
  label: string;
  /** scoreComponentEnum value persisted to credit_score.component_code. */
  componentCode: string;
  /** Fractional weight (0..1); Σ across all sub-factors = 1.0. */
  weight: number;
  /** 1 (weakest) .. 5 (strongest). */
  score: 1 | 2 | 3 | 4 | 5;
  /** Computed input value that drove the score (for quantitative factors). */
  inputValue: number | null;
  /** Human-readable benchmark band used. */
  benchmark: string;
  /** Analyst override rationale (empty unless overridden). */
  justification: string;
}

export interface ScorecardResult {
  subFactors: SubFactor[];
  totalScore: number; // 0..100
  band: Band;
  notionalGrade: string;
  indicativePd1y: number; // representative 1-yr PD (placeholder, spec §15)
  /** Effective weights used (post-reallocation), for audit storage on Scorecard. */
  effectiveWeights: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Sub-factor definitions (default non-financial-corporate template,
// spec §4.1). Weights sum to 1.0 with DSCR included at 7%.
// ---------------------------------------------------------------------------

interface SubFactorDef {
  code: string;
  label: string;
  componentCode: string;
  weight: number;
  quantitative: boolean;
  /** Auto-scorer for quantitative factors: returns 1..5 or null (no input). */
  score?: (r: RatioSet) => 1 | 2 | 3 | 4 | 5 | null;
  benchmark: string;
}

const DEFAULT_SUBFACTORS: SubFactorDef[] = [
  // Business risk (25%)
  {
    code: "market_position",
    label: "Market position",
    componentCode: "business_risk",
    weight: 0.1,
    quantitative: false,
    benchmark: "Qualitative 1-5 (5 = sector leader)",
  },
  {
    code: "industry_risk",
    label: "Industry risk",
    componentCode: "industry_risk",
    weight: 0.08,
    quantitative: false,
    benchmark: "Qualitative 1-5 (5 = low cyclicality / strong outlook)",
  },
  {
    code: "revenue_stability",
    label: "Revenue stability / diversification",
    componentCode: "business_risk",
    weight: 0.07,
    quantitative: false,
    benchmark: "Qualitative 1-5 (5 = diversified, stable)",
  },
  // Financial risk - Leverage (20%)
  {
    code: "net_debt_ebitda",
    label: "Net Debt / EBITDA",
    componentCode: "financial_risk",
    weight: 0.1,
    quantitative: true,
    score: (r) => scoreLowerBetter(r.net_debt_ebitda, [1.5, 2.0, 3.0, 4.0]),
    benchmark: "≤1.5x=5, ≤2.0=4, ≤3.0=3, ≤4.0=2, >4.0=1",
  },
  {
    code: "debt_equity_adjusted",
    label: "Debt / Equity (adjusted)",
    componentCode: "financial_risk",
    weight: 0.05,
    quantitative: true,
    score: (r) => scoreLowerBetter(r.debt_to_tangible_nw, [1.0, 1.5, 2.0, 3.0]),
    benchmark: "≤1.0x=5, ≤1.5=4, ≤2.0=3, ≤3.0=2, >3.0=1",
  },
  {
    code: "ffo_debt",
    label: "FFO / Debt",
    componentCode: "financial_risk",
    weight: 0.05,
    quantitative: true,
    score: (r) => scoreHigherBetter(r.ffo_debt, [0.3, 0.2, 0.15, 0.1]),
    benchmark: "≥0.30=5, ≥0.20=4, ≥0.15=3, ≥0.10=2, <0.10=1",
  },
  // Financial risk - Coverage & cash flow (20%)
  {
    code: "interest_coverage",
    label: "Interest Coverage (EBIT/Int)",
    componentCode: "financial_risk",
    weight: 0.08,
    quantitative: true,
    score: (r) => scoreHigherBetter(r.interest_coverage, [4.0, 3.0, 2.0, 1.5]),
    benchmark: "≥4.0x=5, ≥3.0=4, ≥2.0=3, ≥1.5=2, <1.5=1",
  },
  {
    code: "dscr",
    label: "DSCR (project / SPV only)",
    componentCode: "financial_risk",
    weight: 0.07,
    quantitative: true,
    score: (r) => scoreHigherBetter(r.dscr, [1.75, 1.5, 1.25, 1.0]),
    benchmark: "≥1.75x=5, ≥1.5=4, ≥1.25=3, ≥1.0=2, <1.0=1",
  },
  {
    code: "fcf_debt",
    label: "FCF / Debt",
    componentCode: "financial_risk",
    weight: 0.05,
    quantitative: true,
    score: (r) => scoreHigherBetter(r.fcf_debt, [0.2, 0.12, 0.05, 0.0]),
    benchmark: "≥0.20=5, ≥0.12=4, ≥0.05=3, ≥0.00=2, <0.00=1",
  },
  // Liquidity (10%)
  {
    code: "current_ratio",
    label: "Current Ratio",
    componentCode: "financial_risk",
    weight: 0.04,
    quantitative: true,
    score: (r) => scoreHigherBetter(r.current_ratio, [1.33, 1.2, 1.0, 0.8]),
    benchmark: "≥1.33=5, ≥1.2=4, ≥1.0=3, ≥0.8=2, <0.8=1",
  },
  {
    code: "cash_ratio",
    label: "Cash Ratio",
    componentCode: "financial_risk",
    weight: 0.03,
    quantitative: true,
    score: (r) => scoreHigherBetter(r.cash_ratio, [0.3, 0.2, 0.1, 0.05]),
    benchmark: "≥0.30=5, ≥0.20=4, ≥0.10=3, ≥0.05=2, <0.05=1",
  },
  {
    code: "wc_utilization",
    label: "WC limit utilization",
    componentCode: "financial_risk",
    weight: 0.03,
    quantitative: false, // read off line items; surfaced via RatioSet? not present - treat qualitative w/ input
    benchmark: "≤50%=5, ≤70%=4, ≤85%=3, ≤90%=2, >90%=1 (analyst-entered)",
  },
  // Profitability & Efficiency (10%)
  {
    code: "roce",
    label: "ROCE",
    componentCode: "financial_risk",
    weight: 0.04,
    quantitative: true,
    score: (r) => scoreHigherBetter(r.roce, [0.14, 0.12, 0.1, 0.07]),
    benchmark: "≥14%=5, ≥12%=4, ≥10%=3, ≥7%=2, <7%=1",
  },
  {
    code: "ebitda_margin_trend",
    label: "EBITDA margin trend",
    componentCode: "financial_risk",
    weight: 0.03,
    quantitative: false,
    benchmark: "Qualitative 1-5 (5 = expanding / stable strong)",
  },
  {
    code: "working_capital_days_trend",
    label: "Receivable / Inventory days trend",
    componentCode: "financial_risk",
    weight: 0.03,
    quantitative: false,
    benchmark: "Qualitative 1-5 (5 = improving / stable)",
  },
  // Management & Governance (10%)
  {
    code: "promoter_track_record",
    label: "Promoter track record",
    componentCode: "management_risk",
    weight: 0.05,
    quantitative: false,
    benchmark: "Qualitative 1-5 (5 = strong, clean, succession planned)",
  },
  {
    code: "board_governance",
    label: "Board / governance quality",
    componentCode: "management_risk",
    weight: 0.03,
    quantitative: false,
    benchmark: "Qualitative 1-5 (5 = independent directors, active audit committee)",
  },
  {
    code: "kyc_aml_clean",
    label: "KYC / AML clean",
    componentCode: "management_risk",
    weight: 0.02,
    quantitative: false,
    benchmark: "Qualitative 1-5 (5 = KYC approved, no adverse media)",
  },
  // External corroboration (5%) - mapped to structural_risk (no 'external' enum).
  {
    code: "agency_alignment",
    label: "Existing agency ratings alignment",
    componentCode: "structural_risk",
    weight: 0.03,
    quantitative: false,
    benchmark: "Qualitative 1-5 (5 = external ratings align with internal band)",
  },
  {
    code: "bureau_alignment",
    label: "Bureau / CCR alignment",
    componentCode: "structural_risk",
    weight: 0.02,
    quantitative: false,
    benchmark: "Qualitative 1-5 (5 = no undisclosed borrowing / clean CCR)",
  },
];

// ---------------------------------------------------------------------------
// Threshold scorers. `bounds` are the 5/4/3/2 cut-points (the 1-band is the
// residual). For lower-is-better, a value ≤ bounds[0] scores 5; ≤ bounds[1]
// scores 4; etc. For higher-is-better, ≥ bounds[0] scores 5.
// ---------------------------------------------------------------------------

function scoreLowerBetter(
  v: number | null,
  bounds: [number, number, number, number],
): 1 | 2 | 3 | 4 | 5 | null {
  if (v === null || !Number.isFinite(v)) return null;
  if (v <= bounds[0]) return 5;
  if (v <= bounds[1]) return 4;
  if (v <= bounds[2]) return 3;
  if (v <= bounds[3]) return 2;
  return 1;
}

function scoreHigherBetter(
  v: number | null,
  bounds: [number, number, number, number],
): 1 | 2 | 3 | 4 | 5 | null {
  if (v === null || !Number.isFinite(v)) return null;
  if (v >= bounds[0]) return 5;
  if (v >= bounds[1]) return 4;
  if (v >= bounds[2]) return 3;
  if (v >= bounds[3]) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// DSCR weight reallocation (spec §4.1 note). For non-project / non-SPV
// obligors, DSCR's 7% is reallocated +4% → interest_coverage, +3% → fcf_debt.
// ---------------------------------------------------------------------------

const PROJECT_LIKE: ReadonlySet<string> = new Set(["spv", "project"]);

export function resolveWeights(
  base: Record<string, number>,
  obligorType: ObligorType | string,
): Record<string, number> {
  if (PROJECT_LIKE.has(obligorType)) return { ...base };
  const dscrW = base["dscr"] ?? 0;
  if (!dscrW) return { ...base };
  const out = { ...base };
  out["dscr"] = 0;
  out["interest_coverage"] = (out["interest_coverage"] ?? 0) + 0.04 * (dscrW / 0.07);
  out["fcf_debt"] = (out["fcf_debt"] ?? 0) + 0.03 * (dscrW / 0.07);
  return out;
}

/** Build the default base-weight map from DEFAULT_SUBFACTORS. */
export function defaultBaseWeights(): Record<string, number> {
  const w: Record<string, number> = {};
  for (const sf of DEFAULT_SUBFACTORS) w[sf.code] = sf.weight;
  return w;
}

// ---------------------------------------------------------------------------
// Band mapping (spec §4.2 / §5).
// ---------------------------------------------------------------------------

export function bandFromScore(score: number): Band {
  if (score >= 85) return "BC-1";
  if (score >= 70) return "BC-2";
  if (score >= 55) return "BC-3";
  if (score >= 40) return "BC-4";
  if (score >= 25) return "BC-5";
  return "BC-6";
}

export const BAND_GRADE: Record<Band, string> = {
  "BC-1": "Excellent",
  "BC-2": "Strong",
  "BC-3": "Adequate",
  "BC-4": "Below average",
  "BC-5": "Weak / sub-IG",
  "BC-6": "Distressed / near-default",
};

/** Representative 1-yr PD per band (placeholder - spec §15 #4, to confirm). */
export const BAND_PD_1Y: Record<Band, number> = {
  "BC-1": 0.0004,
  "BC-2": 0.001,
  "BC-3": 0.003,
  "BC-4": 0.01,
  "BC-5": 0.05,
  "BC-6": 0.15,
};

// ---------------------------------------------------------------------------
// Scorecard computation.
// ---------------------------------------------------------------------------

export interface ComputeScorecardArgs {
  ratios: RatioSet;
  obligorType: ObligorType | string;
  /** Per-sub-factor analyst overrides: code → { score, justification }. */
  overrides?: Record<string, { score: 1 | 2 | 3 | 4 | 5; justification?: string }>;
  /**
   * Template weights (ScorecardTemplate.factor_weights_json). When omitted,
   * the default non-financial-corporate base weights are used. The shape is
   * `{ subFactorCode: weight }`.
   */
  templateWeights?: Record<string, number>;
}

export function computeScorecard(args: ComputeScorecardArgs): ScorecardResult {
  const base = args.templateWeights ?? defaultBaseWeights();
  const effectiveWeights = resolveWeights(base, args.obligorType);

  const subFactors: SubFactor[] = DEFAULT_SUBFACTORS.map((def) => {
    const w = effectiveWeights[def.code] ?? def.weight;
    let score: 1 | 2 | 3 | 4 | 5 = 3;
    let inputValue: number | null = null;
    let justification = "";

    const override = args.overrides?.[def.code];
    if (override) {
      score = override.score;
      justification = override.justification ?? "Analyst override";
    } else if (def.quantitative && def.score) {
      const auto = def.score(args.ratios);
      if (auto !== null) {
        score = auto;
        inputValue = autoInputValue(def.code, args.ratios);
        justification = "Auto-scored from latest period ratio";
      } else {
        score = 3;
        justification = "No input value - defaulted to neutral (3)";
      }
    } else {
      justification = "Qualitative - pending analyst input (defaulted to 3)";
    }

    return {
      code: def.code,
      label: def.label,
      componentCode: def.componentCode,
      weight: w,
      score,
      inputValue,
      benchmark: def.benchmark,
      justification,
    };
  });

  // total_score = Σ weight × (score/5) × 100
  const totalScore = subFactors.reduce(
    (acc, sf) => acc + sf.weight * (sf.score / 5) * 100,
    0,
  );
  const rounded = Math.round(totalScore * 100) / 100;
  const band = bandFromScore(rounded);

  return {
    subFactors,
    totalScore: rounded,
    band,
    notionalGrade: BAND_GRADE[band],
    indicativePd1y: BAND_PD_1Y[band],
    effectiveWeights,
  };
}

/** Pull the input value for a quantitative sub-factor from the ratio set. */
function autoInputValue(code: string, r: RatioSet): number | null {
  switch (code) {
    case "net_debt_ebitda":
      return r.net_debt_ebitda;
    case "debt_equity_adjusted":
      return r.debt_to_tangible_nw;
    case "ffo_debt":
      return r.ffo_debt;
    case "interest_coverage":
      return r.interest_coverage;
    case "dscr":
      return r.dscr;
    case "fcf_debt":
      return r.fcf_debt;
    case "current_ratio":
      return r.current_ratio;
    case "cash_ratio":
      return r.cash_ratio;
    case "roce":
      return r.roce;
    default:
      return null;
  }
}

/** Group sub-factors by scoreComponentEnum value (for credit_score persistence). */
export const SCORECARD_GROUPS: { code: string; label: string }[] = [
  { code: "business_risk", label: "Business risk" },
  { code: "industry_risk", label: "Industry risk" },
  { code: "financial_risk", label: "Financial risk: leverage / coverage / liquidity / profitability" },
  { code: "management_risk", label: "Management & governance" },
  { code: "structural_risk", label: "External corroboration" },
];
