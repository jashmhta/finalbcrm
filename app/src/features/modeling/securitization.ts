// Quick securitization / structured-finance sizing calculator
// (FINANCIAL_MODELING_SPEC §3). Mandate-screening sketch: tranche sizing +
// credit enhancement (OC, subordination, cash reserve) + waterfall summary.
// The full monthly-vector waterfall with default curves stays in Excel (§3.5).

export interface TrancheInput {
  name: string;
  /** Target rating (Indian scale, e.g. "AAA(SO)"). Display only. */
  targetRating: string;
  /** Par as a fraction of the pool (e.g. 0.80 for 80%). Must Σ ≤ 1. */
  parPct: number;
  /** Annual coupon (decimal). */
  coupon: number;
  /** Seniority rank: 1 = most senior. */
  seniority: number;
}

export interface SecuritizationInputs {
  /** Aggregate pool principal. */
  poolPar: number;
  /** Weighted-average pool yield (annual, decimal). */
  poolYield: number;
  /** Weighted-average pool tenor (years). */
  poolTenorYears: number;
  /** Annualized default rate (decimal). */
  defaultRate: number;
  /** Recovery rate on defaults (decimal). */
  recoveryRate: number;
  /** Annual prepayment speed (CPR, decimal). */
  cpr: number;
  /** Cash reserve as fraction of senior tranche par (decimal). */
  cashReservePct: number;
  /** Annual servicing + trust + rating fees as fraction of pool (decimal). */
  feePct: number;
  /** Stress multiplier for sizing CE to the senior tranche (e.g. 2 = base × 2). */
  stressMultiplier: number;
  tranches: TrancheInput[];
}

export interface TrancheResult {
  name: string;
  targetRating: string;
  par: number;
  parPct: number;
  coupon: number;
  seniority: number;
  /** Credit enhancement available below this tranche = Σ junior par / pool. */
  ceSubordination: number;
  /** Loss coverage multiple = CE available / stress losses. */
  lossCoverageMultiple: number;
  /** Expected Loss = PD × LGD × EAD for this tranche (screening). */
  expectedLoss: number;
  /** Break-even default rate at which this tranche loses par (decimal). */
  breakEvenDefaultRate: number;
  /** Weighted-average life (years) - screening proxy. */
  wal: number;
  /** Indicative IRR at the pricing coupon (decimal). */
  irr: number;
}

export interface SecuritizationResult {
  poolPar: number;
  cumulativeDefaultRate: number;
  /** Cumulative loss rate = default × (1 - recovery), annualized × tenor. */
  cumulativeLossRate: number;
  baseCaseLosses: number;
  stressLosses: number;
  /** Overcollateralization: (pool - Σ tranches) / pool. */
  overcollateralization: number;
  cashReserve: number;
  /** Excess spread = pool yield - weighted tranche coupon - fees (decimal). */
  excessSpread: number;
  tranches: TrancheResult[];
  waterfall: { step: number; description: string }[];
  notes: string[];
}

/**
 * Compute tranche sizing, credit enhancement, and a waterfall summary.
 *
 * Loss model (screening, §3.3): annual default rate × tenor → cumulative
 * default; losses = cumulative default × (1 - recovery). Stress losses =
 * base × stressMultiplier. CE available to a tranche = par of all tranches
 * junior to it + OC + cash reserve (senior to the senior tranche). Loss
 * coverage multiple = CE / stress losses (target ≥ 1× for the senior tranche
 * to hit AAA(SO)).
 */
export function computeSecuritization(
  inputs: SecuritizationInputs,
): SecuritizationResult {
  const notes: string[] = [];
  const sorted = [...inputs.tranches].sort((a, b) => a.seniority - b.seniority);
  const totalTrancheParPct = sorted.reduce((s, t) => s + t.parPct, 0);
  if (totalTrancheParPct > 1 + 1e-9) {
    notes.push("Tranche par exceeds pool - clamping to 100%.");
  }
  const oc = Math.max(0, 1 - totalTrancheParPct);
  const ocAmount = oc * inputs.poolPar;

  // Cumulative default & losses (screening proxy: linear over tenor).
  const cumDefault = Math.min(1, inputs.defaultRate * inputs.poolTenorYears);
  const cumLossRate = cumDefault * (1 - inputs.recoveryRate);
  const baseLosses = cumLossRate * inputs.poolPar;
  const stressLosses = baseLosses * inputs.stressMultiplier;

  // Weighted tranche coupon for excess spread.
  const wtdCoupon = sorted.reduce(
    (s, t) => s + t.parPct * t.coupon,
    0,
  ) / Math.max(1e-9, totalTrancheParPct);
  const excessSpread = inputs.poolYield - wtdCoupon - inputs.feePct;

  const cashReserve =
    (sorted.find((t) => t.seniority === 1)?.parPct ?? 0) *
    inputs.poolPar *
    inputs.cashReservePct;

  const tranches: TrancheResult[] = sorted.map((t, i) => {
    // CE available = par of all tranches junior to this one + OC + cash reserve
    // (cash reserve credited only to senior-most for screening).
    const juniorParPct = sorted
      .slice(i + 1)
      .reduce((s, j) => s + j.parPct, 0);
    const ceSubordinationPct = juniorParPct + oc;
    const ceAmount =
      ceSubordinationPct * inputs.poolPar +
      (t.seniority === 1 ? cashReserve : 0);
    const lossCoverageMultiple = ceAmount / Math.max(1, stressLosses);

    // Break-even default rate: cumulative default at which losses = CE available.
    const breakEvenDefaultRate =
      ceAmount / Math.max(1, inputs.poolPar * (1 - inputs.recoveryRate) * inputs.poolTenorYears);

    // Expected Loss = PD × LGD × EAD (spec §3.4). Screening proxy: PD ≈ the
    // probability that stress losses exceed the CE available to this tranche;
    // LGD ≈ 100% once CE is breached (conservative); EAD = tranche par.
    const tranchePar = t.parPct * inputs.poolPar;
    const pdTranche = Math.max(0, Math.min(1, stressLosses / Math.max(1, ceAmount)));
    const lgdTranche = 1; // once CE is breached, loss given default on the tranche ~ 100% of breach
    const expectedLoss = pdTranche * lgdTranche * tranchePar;

    // WAL proxy: pool tenor adjusted for prepayment (CPR).
    const wal = inputs.poolTenorYears * (1 - inputs.cpr / 2);
    const irr = t.coupon; // indicative: IRR ≈ coupon if no losses break the tranche

    return {
      name: t.name,
      targetRating: t.targetRating,
      par: tranchePar,
      parPct: t.parPct,
      coupon: t.coupon,
      seniority: t.seniority,
      ceSubordination: ceSubordinationPct,
      lossCoverageMultiple,
      expectedLoss,
      breakEvenDefaultRate,
      wal,
      irr,
    };
  });

  // Priority of payments (spec §3.2 / §3.3): fees → senior interest → senior
  // principal → mezzanine interest → mezzanine principal → reserve top-up
  // (replenished from excess spread, AFTER subordinated debt service) →
  // excess spread → equity residual. The reserve top-up sits between mezz
  // debt service and the equity residual, not before mezz.
  const waterfall: { step: number; description: string }[] = [
    { step: 1, description: "Fees & taxes (servicing, trust, rating, swap)" },
    { step: 2, description: "Senior interest (coupon on senior tranche)" },
    { step: 3, description: "Senior principal (until senior par repaid)" },
    { step: 4, description: "Mezzanine interest" },
    { step: 5, description: "Mezzanine principal" },
    { step: 6, description: "Cash reserve top-up to target (from excess spread)" },
    { step: 7, description: "Excess spread → Equity / residual" },
  ];

  const senior = tranches[0];
  if (senior && senior.lossCoverageMultiple < 1) {
    notes.push(
      `Senior tranche loss coverage ${senior.lossCoverageMultiple.toFixed(2)}× < 1× at stress multiplier ${inputs.stressMultiplier} - increase CE (subordination/OC/reserve) to hit AAA(SO).`,
    );
  } else if (senior) {
    notes.push(
      `Senior tranche loss coverage ${senior.lossCoverageMultiple.toFixed(2)}× ≥ 1× - CE sufficient at chosen stress.`,
    );
  }
  if (excessSpread < 0) {
    notes.push(
      `Negative excess spread (${(excessSpread * 100).toFixed(2)}%) - pool yield below weighted tranche coupon + fees; structure uneconomic without subsidy.`,
    );
  }

  return {
    poolPar: inputs.poolPar,
    cumulativeDefaultRate: cumDefault,
    cumulativeLossRate: cumLossRate,
    baseCaseLosses: baseLosses,
    stressLosses,
    overcollateralization: oc,
    cashReserve,
    excessSpread,
    tranches,
    waterfall,
    notes,
  };
}
