# Agent 074 — Extreme detail analysis

Batch files: `src/features/credit/ratingMap.ts`, `src/features/credit/ratios.ts`, `src/features/credit/scorecard.ts`, `src/features/dashboard/queries.ts`

Agency mapping, ratio engine, scorecard engine, command-center dashboard.

---

## `src/features/credit/ratingMap.ts`

- **Lines:** ~270+ | **Role:** CRA symbol ↔ cross-agency rank ↔ BC band; loads `rating_ladder`
- **Exports:**
  - Re-exports `rankToBand`, `bandToAgencySymbol`, `RatingAgency` from ratingBands
  - `RatingScale`, `LadderRung`, `bandToCanonicalRank` (BC-1→1, BC-2→3, BC-3→6, BC-4→9, BC-5→12, BC-6→15)
  - `coreSymbolToRank` (legacy agency-agnostic; C→16, D→18 note: differs from agency-aware D→19)
  - `agencySymbolToRank(agency, symbol)` — **spec-correct** path:
    - Ranks 1–15 shared AAA…B/B-
    - India_Ratings: CCC→16, CC→17, C→18, D→19
    - Brickwork: C→16, D→19
    - CRISIL/ICRA/CARE/Acuite/Infomerics: C→16, D→19
  - `symbolToBand`, `loadLadder()` (DB + cache), `resetLadderCache`, `resolveBand`, `resolveRung`
  - `AGENCIES` metadata, `BAND_PD_RANGE` display strings
- **Business:** rating_ladder SoR editable; external_rating.rating_rank snapshot at rating time
- **Side effects:** loadLadder queries DB once (module cache)
- **Security:** Server-only for loadLadder; pure paths client-safe via ratingBands
- **Risks:** coreSymbolToRank D→18 vs agency path D→19 inconsistency for legacy callers; cache invalidation only via resetLadderCache

---

## `src/features/credit/ratios.ts`

- **Lines:** ~490+ | **Role:** CREDIT_ANALYSIS_SPEC §3 ratio library from line_items jsonb
- **Exports:**
  - `LineItemCode` union (revenue, cogs, ebit, ebitda, debt, WC, capital, cfo, capex, cfads, NBFC passthroughs, prev_* averages…)
  - `readLineItems(stmt)`, `computeRatios(stmt, prior?) → RatioSet`
  - `RatioSet` — leverage (debt_equity, debt_to_tangible_nw, debt_ebitda, net_debt_ebitda), coverage (interest_coverage, dscr), liquidity (current, quick, cash_ratio), profitability (margins, roe/roa/roce), activity days, FFO/FCF leverage, NBFC metrics, `_ebit`/`_ebitda` derived
  - `PERSISTABLE_RATIO_CODES` — only financialRatioEnum members
  - `ratioSetToResultRows`, `FORMULA_SNAPSHOTS`, `ratioCategory`, `ALL_RATIO_CODES`, `formatRatio`

### Formula conventions
- EBIT = PBT + Interest unless provided
- EBITDA = EBIT + D&A unless provided
- FFO ≈ cfo_before_wc_changes; FCF = CFO − CapEx
- ROE/ROA/ROCE use avg(opening, closing) from prior period when available
- safeDiv returns null on missing/zero divisor
- **null = missing inputs** (never NaN)

- **Side effects:** Pure
- **Coupling:** scorecard, AI summary, domain-check, seed
- **Risks:** Extra ratios (net_debt_ebitda, ffo_debt, fcf_debt, cash_ratio, asset_turnover, cost_to_income) not in enum — cannot persist; line item code discipline required in FS entry UI

---

## `src/features/credit/scorecard.ts`

- **Lines:** ~463 | **Role:** Weighted 0–100 scorecard → BC-1…BC-6
- **Exports:** ObligorType, Band, SubFactor, ScorecardResult, resolveWeights, defaultBaseWeights, bandFromScore, BAND_GRADE, BAND_PD_1Y, computeScorecard, SCORECARD_GROUPS

### Formula (spec §4.1)
```
total_score = Σ_i weight_i × (sub_score_i / 5) × 100
sub_score ∈ {1..5}, Σ weights = 1.0
```
Equivalent to rolling up credit_score.weighted_score × 20 if components stored as score×weight.

### DSCR weight reallocation (`resolveWeights`)
- For non-project/non-SPV obligors: DSCR weight (default 7%) → +4% Interest Coverage, +3% FCF/Debt (scaled if DSCR weight differs)

### Band from score
| Score | Band | Grade | Indicative 1y PD |
|-------|------|-------|------------------|
| ≥85 | BC-1 | Excellent | 0.04% |
| ≥70 | BC-2 | Strong | 0.10% |
| ≥55 | BC-3 | Adequate | 0.30% |
| ≥40 | BC-4 | Below average | 1.0% |
| ≥25 | BC-5 | Weak / sub-IG | 5.0% |
| <25 | BC-6 | Distressed | 15% |

### Default sub-factors (weights sum 1.0)
- Business risk 25%: market_position 10%, industry_risk 8%, revenue_stability 7% (qualitative default 3)
- Leverage 20%: net_debt_ebitda 10%, debt_equity_adj 5%, ffo_debt 5% (quantitative auto-score)
- Coverage/CF 20%: interest_coverage 8%, dscr 7%, fcf_debt 5%
- Liquidity 10%: current 4%, cash 3%, wc_util 3%
- Profitability 10%: roce 4%, ebitda_margin_trend 3%, WC days trend 3%
- Management 10%: promoter 5%, board 3%, kyc_aml 2%
- External 5%: agency_alignment 3%, + remaining structural

### Auto-scorers
- `scoreLowerBetter` / `scoreHigherBetter` against threshold arrays (e.g. net_debt_ebitda ≤1.5→5 … >4→1)

- **Side effects:** Pure
- **Coupling:** actions persist components; AI summary; domain-check
- **Risks:** Qualitative defaults of 3 pull scores mid-band; PD placeholders per spec §15; templateWeights optional rarely loaded from DB template

---

## `src/features/dashboard/queries.ts`

- **Lines:** ~400+ | **Role:** Command-center KPIs + charts + recent rails
- **Exports:**
  - Types: DashboardKpis, DashboardRecentDeal, DashboardRecentInteraction, DashboardChartData, DashboardData
  - `getDashboardKpis(user?)`, `getDashboardData({ user })`
- **OPEN_DEAL_STATUSES:** lead…allocation + on_hold; **CLOSED:** settled, closed; KYC_SOON_DAYS=30
- **Sector family CASE:** infra.% → Infrastructure, real_estate, mfg, nbfc, services, else Other
- **Investor kind CASE:** natural_person→HNI; name heuristics Bank/Insurer/MF/Pension/AIF/Family Office/NBFC

### Visibility
- canReadAll dashboard|party|admin|super_admin|manage user
- partyScope: assigned/data_owner/created_by
- dealScope: lead/credit_analyst/created_by or EXISTS deal_party on scoped parties
- interaction scope similar

### KPIs
- total/issuer/investor party counts; open deals by stage with exposure sum; credit in progress; kyc expiring ≤30d; total deals/interactions; monthly deal/exposure series

### Charts
- deal velocity closed by month; sector exposure; latest scorecards; kyc status mix; investor type mix

### Caching
- Uses `unstable_cache` for some aggregates (check file for keys/tags)

- **Side effects:** Read + Next cache
- **Security:** Scoped loaders; MNPI flag on recent interactions still returned if visible
- **Coupling:** Home dashboard page
- **Risks:** Name-based investor classification is brittle; exposure units consistency with Cr vs absolute
