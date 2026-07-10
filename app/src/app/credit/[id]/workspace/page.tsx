import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ArrowRightIcon,
  ChartLineUpIcon,
  ScalesIcon,
  CoinsIcon,
  ShieldStarIcon,
  SparkleIcon,
} from "@/app/credit/credit-icons";

import { requireUser } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { getCreditAnalysisDetail } from "@/features/credit/queries";
import {
  computeScorecard,
  BAND_GRADE,
  type Band,
  type SubFactor,
} from "@/features/credit/scorecard";
import {
  computeRatios,
  formatRatio,
  type RatioSet,
  type LineItemCode,
} from "@/features/credit/ratios";
import { bandToCanonicalRank, BAND_PD_RANGE } from "@/features/credit/ratingMap";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
  Eyebrow,
  ScoreRing,
  StatCard,
  CellEmpty,
  EmptyState,
  RatingLadderMark,
  ExposureGaugeMark,
  Reveal,
  SectionHeading,
} from "@/components/brand";
import type { BadgeProps, IconTone } from "@/components/brand";
import { Sparkline, type SparklineTone } from "./sparkline";
import { SourceDataPanel } from "./source-data-panel";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";
import { RunScoreButton } from "../run-score-button";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Line-item spreading rows (the demoted "source data" grid). Grouped for
// display; cells read out of financial_statement.line_items (jsonb). The
// analytical canvas above derives its ratios from the same statements via the
// ratio engine - this grid stays as the raw spreading audit trail.
// ---------------------------------------------------------------------------
const SPREADING_ROWS: { group: string; code: LineItemCode; label: string }[] = [
  { group: "P&L", code: "revenue", label: "Revenue" },
  { group: "P&L", code: "cogs", label: "COGS / purchases" },
  { group: "P&L", code: "ebit", label: "EBIT (PBT + Int.)" },
  { group: "P&L", code: "depreciation_amortization", label: "Depreciation & amortization" },
  { group: "P&L", code: "ebitda", label: "EBITDA (derived if blank)" },
  { group: "P&L", code: "interest_expense", label: "Interest expense" },
  { group: "P&L", code: "pbt", label: "PBT" },
  { group: "P&L", code: "pat", label: "PAT" },
  { group: "Balance sheet", code: "total_debt", label: "Total debt" },
  { group: "Balance sheet", code: "cash_and_equivalents", label: "Cash & equivalents" },
  { group: "Balance sheet", code: "marketable_securities", label: "Marketable securities" },
  { group: "Balance sheet", code: "current_assets", label: "Current assets" },
  { group: "Balance sheet", code: "current_liabilities", label: "Current liabilities" },
  { group: "Balance sheet", code: "inventory", label: "Inventory" },
  { group: "Balance sheet", code: "trade_receivables", label: "Trade receivables" },
  { group: "Balance sheet", code: "trade_payables", label: "Trade payables" },
  { group: "Balance sheet", code: "total_assets", label: "Total assets" },
  { group: "Balance sheet", code: "net_worth", label: "Net worth (book)" },
  { group: "Balance sheet", code: "tangible_net_worth", label: "Tangible net worth (adj.)" },
  { group: "Cash flow", code: "cfo", label: "CFO (before interest paid)" },
  { group: "Cash flow", code: "cfo_before_wc_changes", label: "FFO (CFO before WC changes)" },
  { group: "Cash flow", code: "capex", label: "CapEx" },
  { group: "Cash flow", code: "dividends_paid", label: "Dividends paid" },
  { group: "Project / Special Purpose Vehicle", code: "cfads", label: "CFADS" },
  { group: "Project / Special Purpose Vehicle", code: "debt_service", label: "Debt service (P+I)" },
];

// Full AAA→D rating ladder (18 cross-agency rungs, spec §5). The issuer's
// canonical notch (band midpoint) is highlighted in the anchor ladder.
const LADDER_RUNGS: { rank: number; symbol: string; band: Band }[] = [
  { rank: 1, symbol: "AAA", band: "BC-1" },
  { rank: 2, symbol: "AA+", band: "BC-1" },
  { rank: 3, symbol: "AA", band: "BC-2" },
  { rank: 4, symbol: "AA-", band: "BC-2" },
  { rank: 5, symbol: "A+", band: "BC-3" },
  { rank: 6, symbol: "A", band: "BC-3" },
  { rank: 7, symbol: "A-", band: "BC-3" },
  { rank: 8, symbol: "BBB+", band: "BC-4" },
  { rank: 9, symbol: "BBB", band: "BC-4" },
  { rank: 10, symbol: "BBB-", band: "BC-4" },
  { rank: 11, symbol: "BB+", band: "BC-5" },
  { rank: 12, symbol: "BB", band: "BC-5" },
  { rank: 13, symbol: "BB-", band: "BC-5" },
  { rank: 14, symbol: "B+", band: "BC-5" },
  { rank: 15, symbol: "B", band: "BC-6" },
  { rank: 16, symbol: "CCC", band: "BC-6" },
  { rank: 17, symbol: "CC", band: "BC-6" },
  { rank: 18, symbol: "D", band: "BC-6" },
];

const BAND_TONE: Record<Band, "emerald" | "gold" | "info" | "down"> = {
  "BC-1": "emerald",
  "BC-2": "emerald",
  "BC-3": "gold",
  "BC-4": "info",
  "BC-5": "down",
  "BC-6": "down",
};

// ---------------------------------------------------------------------------
// Analytical canvas - the four credit dimensions. Each section pairs a
// bespoke icon mark (RatingLadderMark for coverage, ExposureGaugeMark for
// leverage - the two brand-concept glyphs the design system names for credit
// row-group headers) with its ratio metrics, a sparkline tone, and the
// sub-factor codes whose 1-5 scores roll up into the section subtotal.
// Profitability + liquidity use the IconTile/Phosphor Light system where no
// bespoke mark is semantically exact - both are the brand icon language.
// ---------------------------------------------------------------------------
type SectionMark = "ratingLadder" | "exposure" | "chartLineUp" | "coins";

interface SectionDef {
  key: string;
  title: string;
  caption: string;
  mark: SectionMark;
  markTone: IconTone;
  sparkTone: SparklineTone;
  metrics: { code: keyof RatioSet; label: string }[];
  subFactorCodes: string[];
}

const SECTIONS: SectionDef[] = [
  {
    key: "profitability",
    title: "Profitability",
    caption: "Earnings & returns",
    mark: "chartLineUp",
    markTone: "gold",
    sparkTone: "emerald",
    metrics: [
      { code: "ebitda_margin", label: "EBITDA margin" },
      { code: "operating_margin", label: "Operating margin (EBIT)" },
      { code: "pat_margin", label: "Net margin (PAT)" },
      { code: "roce", label: "ROCE" },
      { code: "roe", label: "ROE" },
      { code: "roa", label: "ROA" },
    ],
    subFactorCodes: ["roce", "ebitda_margin_trend"],
  },
  {
    key: "leverage",
    title: "Leverage",
    caption: "Debt load & structure",
    mark: "exposure",
    markTone: "neutral",
    sparkTone: "gold",
    metrics: [
      { code: "net_debt_ebitda", label: "Net Debt / EBITDA" },
      { code: "debt_ebitda", label: "Debt / EBITDA" },
      { code: "debt_equity", label: "Debt / Equity (book)" },
      { code: "debt_to_tangible_nw", label: "Debt / Tangible NW (adj.)" },
      { code: "ffo_debt", label: "FFO / Debt" },
      { code: "fcf_debt", label: "FCF / Debt" },
    ],
    subFactorCodes: ["net_debt_ebitda", "debt_equity_adjusted", "ffo_debt", "fcf_debt"],
  },
  {
    key: "liquidity",
    title: "Liquidity",
    caption: "Short-term cover",
    mark: "coins",
    markTone: "neutral",
    sparkTone: "neutral",
    metrics: [
      { code: "current_ratio", label: "Current ratio" },
      { code: "quick_ratio", label: "Quick ratio" },
      { code: "cash_ratio", label: "Cash ratio" },
    ],
    subFactorCodes: ["current_ratio", "cash_ratio", "wc_utilization"],
  },
  {
    key: "coverage",
    title: "Coverage",
    caption: "Debt-service ability",
    mark: "ratingLadder",
    markTone: "emerald",
    sparkTone: "emerald",
    metrics: [
      { code: "interest_coverage", label: "Interest coverage (EBIT/Int)" },
      { code: "dscr", label: "Debt Service Coverage Ratio (CFADS / Debt service)" },
    ],
    subFactorCodes: ["interest_coverage", "dscr"],
  },
];

// ── helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", {
    year: "2-digit",
    month: "short",
    day: "2-digit",
  });
}

function fmtCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function fmtINRCr(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`;
}

/** Ratio value → a directional signal tone (emerald = sound, down = stress). */
function ratioTone(
  code: keyof RatioSet,
  v: number | null,
): "up" | "down" | "default" {
  if (v === null || !Number.isFinite(v)) return "default";
  switch (code) {
    case "net_debt_ebitda":
    case "debt_ebitda":
    case "debt_equity":
    case "debt_to_tangible_nw":
      return v <= 3 ? "up" : v > 4 ? "down" : "default";
    case "interest_coverage":
      return v >= 3 ? "up" : v < 1.5 ? "down" : "default";
    case "ebitda_margin":
      return v >= 0.12 ? "up" : v < 0.05 ? "down" : "default";
    case "current_ratio":
      return v >= 1.2 ? "up" : v < 0.8 ? "down" : "default";
    default:
      return "default";
  }
}

/** Average the 1-5 sub-factor scores for a section → the section subtotal. */
function sectionScore(
  sec: SectionDef,
  subFactors: SubFactor[] | null,
): number | null {
  if (!subFactors || !subFactors.length) return null;
  const scores = sec.subFactorCodes
    .map((c) => subFactors.find((sf) => sf.code === c)?.score)
    .filter((s): s is 1 | 2 | 3 | 4 | 5 => typeof s === "number");
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ── page ───────────────────────────────────────────────────────────────────

export default async function CreditWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await getCreditAnalysisDetail(id, user);
  if (!detail) notFound();

  const {
    analysis: a,
    party: p,
    financialStatements,
    latestRatioSet,
    scorecard: sc,
    exposures,
    limits,
  } = detail;

  // Per-period ratio sets (the canvas columns + every sparkline series).
  const periodRatioSets = financialStatements.map((fs, i) => {
    const prior = i > 0 ? financialStatements[i - 1] : null;
    return computeRatios(fs, prior);
  });

  // Per-period indicative scorecards - recomputed from each period's ratios
  // with default weights so the score + notch have a trend across periods
  // (the signals-header sparkline + the score-progression rail). No query
  // extension needed - the engine is pure, run server-side from the statements
  // already loaded by getCreditAnalysisDetail.
  const periodScorecards = periodRatioSets.map((rs) =>
    computeScorecard({ ratios: rs, obligorType: a.obligorType }),
  );

  const liveScorecard =
    latestRatioSet !== null
      ? computeScorecard({
          ratios: latestRatioSet as RatioSet,
          obligorType: a.obligorType,
        })
      : null;

  // `sc.band` + `a.internalRatingShort` hold AGENCY SYMBOLS, not the internal
  // BC-1..BC-6 enum - guard against NaN/undefined by validating against the BC
  // band set. Prefer the live engine band, then a persisted/rating value only
  // if it is a valid BC band.
  const VALID_BANDS: ReadonlySet<Band> = new Set([
    "BC-1",
    "BC-2",
    "BC-3",
    "BC-4",
    "BC-5",
    "BC-6",
  ]);
  const persistedBand =
    sc?.band && VALID_BANDS.has(sc.band as Band) ? (sc.band as Band) : null;
  const ratingBand =
    a.internalRatingShort && VALID_BANDS.has(a.internalRatingShort as Band)
      ? (a.internalRatingShort as Band)
      : null;
  const totalScore =
    liveScorecard?.totalScore ??
    (a.currentCreditScore ? Number(a.currentCreditScore) : null);
  const band: Band | null =
    (liveScorecard?.band as Band | undefined) ?? persistedBand ?? ratingBand;
  const grade = band ? BAND_GRADE[band] : null;
  const pdRange = band ? BAND_PD_RANGE[band] : null;
  const scoreTone: "emerald" | "gold" | "down" | "neutral" =
    totalScore === null
      ? "neutral"
      : totalScore >= 70
        ? "emerald"
        : totalScore >= 55
          ? "gold"
          : totalScore >= 40
            ? "neutral"
            : "down";

  const issuerName = p?.legalName ?? "-";
  const periodCount = financialStatements.length;
  const latestStatement =
    periodCount > 0 ? financialStatements[periodCount - 1] : null;

  // Pre-compute section subtotals from the live scorecard's sub-factor scores.
  const sectionScores: Record<string, number | null> = {};
  for (const sec of SECTIONS) {
    sectionScores[sec.key] = sectionScore(sec, liveScorecard?.subFactors ?? null);
  }

  const notchSymbol = band
    ? (LADDER_RUNGS.find((r) => r.rank === bandToCanonicalRank(band))?.symbol ??
      "-")
    : null;
  const notchTileTone: SignalTone =
    band === null
      ? "default"
      : BAND_TONE[band] === "emerald"
        ? "up"
        : BAND_TONE[band] === "gold"
          ? "gold"
          : BAND_TONE[band] === "info"
            ? "info"
            : "down";

  // Signal readouts (latest-period values).
  const sigLeverage = latestRatioSet?.net_debt_ebitda ?? null;
  const sigCoverage = latestRatioSet?.interest_coverage ?? null;
  const sigProfitability = latestRatioSet?.ebitda_margin ?? null;
  const sigLiquidity = latestRatioSet?.current_ratio ?? null;
  const scoreSeries = periodScorecards.map((s) => s.totalScore);

  // Spreading-grid group boundaries (first row of each group gets the eyebrow).
  const groupStarts = new Set<number>();
  let lastGroup: string | null = null;
  SPREADING_ROWS.forEach((r, i) => {
    if (r.group !== lastGroup) {
      groupStarts.add(i);
      lastGroup = r.group;
    }
  });

  return (
    <PageShell wide>
      <DetailTopBar
        backHref={`/credit/${id}`}
        backLabel={issuerName}
        crumb="Workspace"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              variant="secondary-hairline"
              size="md"
              leadingIcon={<ArrowRightIcon className="size-4 rotate-180" />}
            >
              <Link href={`/credit/${id}`}>Back to file</Link>
            </Button>
            <RunScoreButton analysisId={id} variant="primary-gold" size="md" />
          </div>
        }
      />
      <PageHeader
        title={issuerName}
        description={`${a.obligorType} · ${a.analysisType?.replace(/_/g, " ") ?? "analysis"}${band ? ` · internal notch ${band}` : ""}`}
      />

      {/* Signals header - the at-a-glance credit story ──────────────────────
          Six readouts as crafted instrument tiles: the internal score (hero,
          count-up + mini band bar), the rating notch (display symbol + mini
          ladder), and the four dimension signals (leverage / coverage /
          profitability / liquidity) each with a per-period sparkline. A 12-col
          bento - the hero score spans 4, the notch 2, the ratios 3/3 then 6/6
          - so it reads as an asymmetrical instrument bank, not a row of equal
          stat cards. */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-12 lg:gap-5">
        {/* Internal score - hero */}
        <div className="md:col-span-2 lg:col-span-4">
          {totalScore !== null && Number.isFinite(totalScore) ? (
            <StatCard
              label="Internal score"
              value={totalScore}
              preset="decimal1"
              tone="gold"
              icon={<SparkleIcon />}
              className="h-full"
            >
              <MiniBandBar band={band} />
            </StatCard>
          ) : (
            <SignalEmptyTile
              label="Internal score"
              icon={<SparkleIcon />}
              hint="Add a statement and run the scorecard to band the issuer."
              className="h-full"
            />
          )}
        </div>

        {/* Rating notch */}
        <div className="lg:col-span-2">
          {band && notchSymbol ? (
            <SignalTile
              label="Rating notch"
              display={notchSymbol}
              tone={notchTileTone}
              icon={<ShieldStarIcon />}
              meta={band}
              className="h-full"
            >
              <div className="min-w-0 flex-1">
                <MiniBandBar band={band} />
              </div>
            </SignalTile>
          ) : (
            <SignalEmptyTile
              label="Rating notch"
              icon={<ShieldStarIcon />}
              hint="No internal notch yet."
              className="h-full"
            />
          )}
        </div>

        {/* Leverage · Net Debt / EBITDA */}
        <div className="lg:col-span-3">
          {sigLeverage !== null ? (
            <SignalTile
              label="Leverage · Net Debt / EBITDA"
              display={formatRatio("net_debt_ebitda", sigLeverage)}
              tone={ratioTone("net_debt_ebitda", sigLeverage)}
              icon={<ScalesIcon />}
              meta={periodCount > 0 ? `${periodCount} pd` : undefined}
              className="h-full"
            >
              <Sparkline
                data={periodRatioSets.map((rs) => rs.net_debt_ebitda ?? null)}
                tone="gold"
              />
            </SignalTile>
          ) : (
            <SignalEmptyTile
              label="Leverage · Net Debt / EBITDA"
              icon={<ScalesIcon />}
              hint="Awaiting financial spreading."
              className="h-full"
            />
          )}
        </div>

        {/* Coverage · Interest coverage */}
        <div className="lg:col-span-3">
          {sigCoverage !== null ? (
            <SignalTile
              label="Coverage · Interest coverage"
              display={formatRatio("interest_coverage", sigCoverage)}
              tone={ratioTone("interest_coverage", sigCoverage)}
              icon={<ShieldStarIcon />}
              meta={periodCount > 0 ? `${periodCount} pd` : undefined}
              className="h-full"
            >
              <Sparkline
                data={periodRatioSets.map((rs) => rs.interest_coverage ?? null)}
                tone="emerald"
              />
            </SignalTile>
          ) : (
            <SignalEmptyTile
              label="Coverage · Interest coverage"
              icon={<ShieldStarIcon />}
              hint="Awaiting financial spreading."
              className="h-full"
            />
          )}
        </div>

        {/* Profitability · EBITDA margin */}
        <div className="lg:col-span-6">
          {sigProfitability !== null ? (
            <SignalTile
              label="Profitability · EBITDA margin"
              display={formatRatio("ebitda_margin", sigProfitability)}
              tone={ratioTone("ebitda_margin", sigProfitability)}
              icon={<ChartLineUpIcon />}
              meta={latestStatement ? fmtDate(latestStatement.periodEndDate) : undefined}
              className="h-full"
            >
              <Sparkline
                data={periodRatioSets.map((rs) => rs.ebitda_margin ?? null)}
                tone="emerald"
              />
            </SignalTile>
          ) : (
            <SignalEmptyTile
              label="Profitability · EBITDA margin"
              icon={<ChartLineUpIcon />}
              hint="Awaiting financial spreading."
              className="h-full"
            />
          )}
        </div>

        {/* Liquidity · Current ratio */}
        <div className="lg:col-span-6">
          {sigLiquidity !== null ? (
            <SignalTile
              label="Liquidity · Current ratio"
              display={formatRatio("current_ratio", sigLiquidity)}
              tone={ratioTone("current_ratio", sigLiquidity)}
              icon={<CoinsIcon />}
              meta={periodCount > 0 ? `${periodCount} pd` : undefined}
              className="h-full"
            >
              <Sparkline
                data={periodRatioSets.map((rs) => rs.current_ratio ?? null)}
                tone="neutral"
              />
            </SignalTile>
          ) : (
            <SignalEmptyTile
              label="Liquidity · Current ratio"
              icon={<CoinsIcon />}
              hint="Awaiting financial spreading."
              className="h-full"
            />
          )}
        </div>
      </div>

      {/* Main grid - analytical canvas (left) + sticky instrument anchor (right).
          MOBILE: the score-ring instrument anchor is reordered ABOVE the ratio
          canvas so it reads as a HERO (signals header → score ring → grouped
          financials), not buried beneath a long spreading table. xl restores
          the two-column canvas-left / anchor-right desktop layout. */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Analytical canvas ─────────────────────────────────────────────── */}
        <div className="order-2 min-w-0 xl:order-1">
          <Card className="h-full">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <Eyebrow dot>Ratio canvas</Eyebrow>
                  <CardTitle className="mt-1">Analytical ratio matrix</CardTitle>
                  <CardDescription>
                    Grouped by credit dimension · periods left → right · a
                    sparkline traces each metric across the linked statements.
                  </CardDescription>
                </div>
                {periodCount > 0 ? (
                  <Badge variant="neutral">
                    {periodCount} period{periodCount === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {periodCount === 0 ? (
                <EmptyState
                  icon={<ScalesIcon />}
                  title="The canvas is awaiting its first period."
                  hint="Add a financial statement from the Financials tab to begin spreading - the ratio engine populates this canvas on run."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="hidden md:table-header-group">
                      <tr className="border-b border-hairline">
                        <th className="py-3 pl-5 pr-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Metric
                        </th>
                        {financialStatements.map((fs, i) => {
                          const isLatest = i === periodCount - 1;
                          return (
                            <th
                              key={fs.financialStatementId}
                              className={cn(
                                "py-3 px-3 text-right text-[11px] font-medium uppercase tracking-[0.14em] whitespace-nowrap",
                                isLatest ? "text-foreground" : "text-muted-foreground",
                              )}
                            >
                              <span className="nums tabular-nums">
                                {fmtDate(fs.periodEndDate)}
                              </span>
                              <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-muted-foreground/60">
                                {fs.isConsolidated ? "Consol." : "Standalone"}
                              </span>
                            </th>
                          );
                        })}
                        <th className="py-3 pr-5 pl-3 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Trend
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {SECTIONS.map((sec) => (
                        <Fragment key={sec.key}>
                          {/* Section header band */}
                          <tr>
                            <td
                              colSpan={periodCount + 2}
                              className="border-b-0 bg-foreground/[0.018] px-5 pt-4 pb-2.5"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <SectionMarkIcon sec={sec} />
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                                      {sec.caption}
                                    </span>
                                    <span className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">
                                      {sec.title}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="hidden text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60 sm:inline">
                                    Section
                                  </span>
                                  <SectionScorePill
                                    score={sectionScores[sec.key] ?? null}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* Metric rows */}
                          {sec.metrics.map((m) => {
                            const series = periodRatioSets.map(
                              (rs) => (rs[m.code] as number | null) ?? null,
                            );
                            const latest =
                              latestRatioSet !== null
                                ? (latestRatioSet[m.code] as number | null) ?? null
                                : null;
                            return (
                              <tr
                                key={m.code}
                                className="group/row relative border-b border-row-hairline transition-colors duration-200 ease-soft hover:bg-row-hover before:absolute before:left-0 before:top-1/2 before:h-7 before:-translate-y-1/2 before:rounded-full before:bg-gold before:opacity-0 before:transition-all before:duration-200 before:ease-soft before:content-[''] hover:before:h-8 hover:before:opacity-100 before:w-[2px] hover:before:w-[3px]"
                              >
                                <td className="py-3.5 pl-5 pr-3 text-[13.5px] text-foreground/80">
                                  <div className="flex items-center justify-between gap-3 md:block">
                                    <span>{m.label}</span>
                                    <span className="nums tabular-nums text-foreground md:hidden">
                                      {latest !== null &&
                                      Number.isFinite(latest) ? (
                                        formatRatio(m.code as string, latest)
                                      ) : (
                                        <CellEmpty label="No value" />
                                      )}
                                    </span>
                                  </div>
                                </td>
                                {financialStatements.map((fs, i) => {
                                  const rs = periodRatioSets[i];
                                  const v = (rs[m.code] as number | null) ?? null;
                                  const isLatest = i === periodCount - 1;
                                  const hasValue =
                                    v !== null && Number.isFinite(v);
                                  return (
                                    <td
                                      key={fs.financialStatementId}
                                      className={cn(
                                        "hidden py-3.5 px-3 text-right nums tabular-nums text-[13.5px] md:table-cell",
                                        isLatest
                                          ? "bg-gold/[0.04] font-medium text-foreground"
                                          : "text-foreground/80",
                                      )}
                                    >
                                      {hasValue ? (
                                        formatRatio(m.code as string, v)
                                      ) : (
                                        <CellEmpty label="No value" />
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="py-2.5 pr-5 pl-3 text-right">
                                  <Sparkline data={series} tone={sec.sparkTone} />
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Instrument anchor (right rail, sticky on desktop) ─────────────── */}
        <div className="order-1 flex flex-col gap-6 xl:order-2 xl:sticky xl:top-24 xl:self-start">
          {/* Score ring + rating ladder */}
          <Card
            shellRadius="2xl"
            ambient={scoreTone === "emerald" ? "emerald" : "gold"}
            className="overflow-hidden"
          >
            <div className="relative">
              {/* Ambient halo behind the score ring - tone-aware, bleeds into
                  the shell tray so the ring reads as a lit, machined object. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-16 h-52 bg-[radial-gradient(58%_62%_at_50%_38%,color-mix(in_oklch,var(--gold)_30%,transparent),color-mix(in_oklch,var(--emerald)_16%,transparent)_42%,transparent_72%)]"
              />
              <CardBody className="relative flex flex-col items-center gap-5 pt-8">
                <Eyebrow dot>Internal scorecard</Eyebrow>
                {totalScore !== null && Number.isFinite(totalScore) ? (
                  <ScoreRing
                    value={totalScore}
                    min={0}
                    max={100}
                    size={184}
                    thickness={13}
                    tone={scoreTone}
                    preset="decimal1"
                    band={
                      band
                        ? {
                            label: band,
                            tone:
                              scoreTone === "down"
                                ? "down"
                                : scoreTone === "emerald"
                                  ? "emerald"
                                  : "gold",
                          }
                        : undefined
                    }
                    label="weighted score · 0-100"
                    sublabel={grade ?? "Run the scorecard to band the issuer"}
                  />
                ) : (
                  <div className="flex h-[184px] flex-col items-center justify-center gap-2 text-center">
                    <SparkleIcon className="size-7 text-muted-foreground/60" />
                    <p className="max-w-[14rem] text-[13px] text-muted-foreground">
                      No score yet - add a financial statement and run the
                      scorecard.
                    </p>
                  </div>
                )}

                <div className="grid w-full grid-cols-2 gap-3">
                  <ReadoutTile
                    label="Indic. 1-yr Probability of Default"
                    value={pdRange ?? "-"}
                    tone={scoreTone === "down" ? "down" : "neutral"}
                  />
                  <ReadoutTile
                    label="Model Probability of Default"
                    value={
                      a.pd1y && Number.isFinite(Number(a.pd1y))
                        ? `${(Number(a.pd1y) * 100).toFixed(3)}%`
                        : "-"
                    }
                    tone="neutral"
                    hint={a.pd1y ? null : "spec §15"}
                  />
                </div>

                <RunScoreButton
                  analysisId={id}
                  variant="secondary-hairline"
                  size="sm"
                  className="w-full justify-center [&_button]:w-full"
                />
              </CardBody>
            </div>

            {/* Rating-scale ladder - full AAA→D, issuer notch highlighted */}
            <div className="border-t border-hairline">
              <div className="flex items-center justify-between px-5 pt-4 md:px-6">
                <Eyebrow>
                  <RatingLadderMark size={14} tone="gold" /> Rating ladder
                </Eyebrow>
                <span className="text-[11px] text-muted-foreground/70">
                  AAA → D · CRISIL long-term
                </span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-hairline/40 p-3 md:p-4">
                {LADDER_RUNGS.map((rung) => {
                  const notchRank = band ? bandToCanonicalRank(band) : null;
                  const active = notchRank === rung.rank;
                  const inBand = band === rung.band;
                  const tone = BAND_TONE[rung.band];
                  const toneText =
                    tone === "emerald"
                      ? "text-emerald"
                      : tone === "gold"
                        ? "text-gold"
                        : tone === "info"
                          ? "text-info"
                          : "text-down";
                  return (
                    <div
                      key={rung.rank}
                      className={cn(
                        "relative flex items-center gap-2.5 bg-surface px-2.5 py-2 transition-all duration-200 ease-soft",
                        active
                          ? "bg-emerald/12 ring-1 ring-inset ring-emerald/40 shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--emerald)_22%,transparent),var(--shadow-inset-hi)]"
                          : inBand
                            ? "bg-foreground/[0.025] ring-1 ring-inset ring-hairline/40"
                            : "ring-1 ring-inset ring-transparent hover:bg-foreground/[0.02]",
                      )}
                    >
                      <span
                        className={cn(
                          "nums inline-flex w-11 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tracking-tight",
                          active
                            ? "bg-gold/18 text-gold ring-1 ring-gold/40 shadow-[0_0_10px] shadow-gold/35"
                            : "bg-foreground/[0.04] ring-1 ring-hairline/60 " +
                              toneText,
                        )}
                      >
                        {rung.symbol}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span
                          className={cn(
                            "text-[11px] font-medium",
                            active ? "text-foreground" : "text-foreground/75",
                          )}
                        >
                          {rung.band}
                        </span>
                        <span className="nums text-[10px] text-muted-foreground/70">
                          {BAND_PD_RANGE[rung.band]}
                        </span>
                      </div>
                      {active ? (
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full bg-emerald shadow-[0_0_10px] shadow-emerald/75"
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {band ? (
                <div className="flex items-center justify-between gap-2 border-t border-hairline px-5 py-3 md:px-6">
                  <span className="text-[11px] text-muted-foreground">
                    Issuer notch
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="nums inline-flex items-center justify-center rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold ring-1 ring-gold/30">
                      {notchSymbol ?? "-"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {band} · {BAND_GRADE[band]}
                    </span>
                  </span>
                </div>
              ) : null}
            </div>
          </Card>

          {/* Exposure & limits */}
          <Card>
            <CardHeader>
              <Eyebrow>
                <ExposureGaugeMark size={14} tone="emerald" /> Exposure &amp;
                limits
              </Eyebrow>
              <CardTitle className="mt-1">Utilization</CardTitle>
              <CardDescription>
                {limits.length} limit{limits.length === 1 ? "" : "s"} ·{" "}
                {exposures.length} exposure
                {exposures.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              {limits.length === 0 ? (
                <div className="flex flex-col items-center gap-2.5 rounded-xl bg-foreground/[0.02] px-4 py-7 text-center ring-1 ring-hairline/50">
                  <span className="text-muted-foreground/60 [&_svg]:size-6">
                    <ExposureGaugeMark size={24} tone="neutral" />
                  </span>
                  <p className="max-w-[16rem] text-[13px] text-muted-foreground">
                    No limits set for this issuer yet.
                  </p>
                </div>
              ) : (
                limits.map((l) => {
                  const limit = Number(l.limitAmount);
                  const utilized = Number(l.utilized);
                  const pct =
                    limit > 0 && Number.isFinite(limit)
                      ? Math.min(100, (utilized / limit) * 100)
                      : 0;
                  const over = utilized > limit && limit > 0;
                  return (
                    <div key={l.creditLimitId} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12.5px] font-medium text-foreground">
                          {l.limitType.replace(/_/g, " ")}
                        </span>
                        <span className="nums text-[11px] text-muted-foreground">
                          {pct.toFixed(0)}% · {l.currencyCode}
                        </span>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-foreground/[0.06] ring-1 ring-hairline/60">
                        <div
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-soft",
                            over
                              ? "bg-down"
                              : pct > 80
                                ? "bg-gold"
                                : "bg-emerald",
                          )}
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                      <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="nums">
                          utilized {fmtINRCr(l.utilized)}
                        </span>
                        <span className="nums">avail {fmtINRCr(l.available)}</span>
                      </div>
                    </div>
                  );
                })
              )}

              {exposures.length > 0 ? (
                <div className="mt-1 border-t border-hairline pt-4">
                  <Eyebrow className="mb-2">Economic exposure</Eyebrow>
                  <div className="flex flex-col gap-1.5">
                    {exposures.map((e) => (
                      <div
                        key={e.exposureId}
                        className="flex items-baseline justify-between gap-3 text-[12.5px]"
                      >
                        <span className="inline-flex items-center gap-1.5 text-foreground/80">
                          <Badge variant="outline">{e.exposureType}</Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {e.currencyCode}
                          </span>
                        </span>
                        <span className="nums tabular-nums text-foreground/85">
                          {fmtINRCr(e.netExposure)}
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            net
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Lower rail - scorecard sub-factors + score progression ─────────────
          Below-the-fold decorative reveals (allowed); the primary canvas +
          signals above render visible on mount. */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:mt-6 md:gap-6 lg:grid-cols-3">
        <Reveal y={16} duration={0.6} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <Eyebrow dot>Scorecard factors</Eyebrow>
              <CardTitle className="mt-1">Sub-factor scoring</CardTitle>
              <CardDescription>
                Weighted 0-100 (spec §4.1). Sub-factors scored 1-5 against
                sector-adjusted benchmarks; total = Σ weight × (score/5) × 100.
              </CardDescription>
            </CardHeader>
            <CardBody className="p-0">
              {liveScorecard ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-hairline">
                        <th className="py-3 pl-5 pr-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Factor
                        </th>
                        <th className="hidden py-3 px-3 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground md:table-cell">
                          Weight
                        </th>
                        <th className="py-3 px-3 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Score
                        </th>
                        <th className="py-3 pr-5 pl-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Input
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveScorecard.subFactors.map((sf) => (
                        <tr
                          key={sf.code}
                          className="group/row relative border-b border-row-hairline transition-colors duration-200 ease-soft hover:bg-row-hover before:absolute before:left-0 before:top-1/2 before:h-7 before:-translate-y-1/2 before:rounded-full before:bg-gold before:opacity-0 before:transition-all before:duration-200 before:ease-soft before:content-[''] hover:before:h-8 hover:before:opacity-100 before:w-[2px] hover:before:w-[3px]"
                        >
                          <td className="py-3.5 pl-5 pr-3 text-[13.5px] font-medium text-foreground">
                            {sf.label}
                          </td>
                          <td className="hidden py-3.5 px-3 text-right nums tabular-nums text-[13.5px] text-muted-foreground md:table-cell">
                            {(sf.weight * 100).toFixed(0)}%
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <ScorePill score={sf.score} />
                          </td>
                          <td className="py-3.5 pr-5 pl-3 text-[13.5px]">
                            {sf.inputValue !== null ? (
                              <span className="nums tabular-nums text-foreground">
                                {formatRatio(sf.code, sf.inputValue)}
                              </span>
                            ) : (
                              <CellEmpty label="No input value" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<ScalesIcon />}
                  title="No scorecard yet."
                  hint="Add a financial statement and run the scorecard to populate sub-factor scores."
                />
              )}
            </CardBody>
          </Card>
        </Reveal>

        {/* Score progression - indicative score across periods */}
        <Reveal y={16} duration={0.6} delay={0.05}>
          <Card className="h-full">
            <CardHeader>
              <Eyebrow dot>Score progression</Eyebrow>
              <CardTitle className="mt-1">Indicative score · periods</CardTitle>
              <CardDescription>
                Default-weight scorecard recomputed per linked period - the
                composite trend behind the notch.
              </CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              {periodScorecards.length > 0 ? (
                <>
                  <div className="flex flex-col items-center gap-2">
                    <Sparkline
                      data={scoreSeries}
                      tone="gold"
                      width={260}
                      height={64}
                      className="mx-auto"
                    />
                    <div className="flex items-baseline justify-between gap-3 self-stretch">
                      <span className="text-[11px] text-muted-foreground">
                        Earliest
                      </span>
                      <span className="nums tabular-nums text-[15px] font-medium text-foreground">
                        {(() => {
                          const first = scoreSeries[0];
                          return first != null ? first.toFixed(1) : "-";
                        })()}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-hairline pt-4">
                    <Eyebrow className="mb-2.5">Notch by period</Eyebrow>
                    <div className="flex flex-col gap-1.5">
                      {periodScorecards.map((psc, i) => {
                        const sym =
                          LADDER_RUNGS.find(
                            (r) => r.rank === bandToCanonicalRank(psc.band),
                          )?.symbol ?? "-";
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-3 text-[12.5px]"
                          >
                            <span className="nums text-[11px] text-muted-foreground">
                              {fmtDate(financialStatements[i].periodEndDate)}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <span className="nums tabular-nums text-foreground">
                                {psc.totalScore.toFixed(1)}
                              </span>
                              <span className="nums inline-flex items-center justify-center rounded-full bg-foreground/[0.04] px-1.5 py-0.5 text-[10px] font-semibold text-foreground/75 ring-1 ring-hairline/60">
                                {sym}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2.5 rounded-xl bg-foreground/[0.02] px-4 py-8 text-center ring-1 ring-hairline/50">
                  <span className="text-muted-foreground/60 [&_svg]:size-6">
                    <ChartLineUpIcon />
                  </span>
                  <p className="max-w-[16rem] text-[13px] text-muted-foreground">
                    No periods yet - link statements to trace the score across
                    time.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </Reveal>
      </div>

      {/* Line-item spreading - demoted to source-data audit trail ───────────
          The raw spreading grid stays (it reads financial_statement.line_items
          directly), but is COLLAPSED behind a "Source data" accordion by
          default so the analytical canvas above remains the dominant view.
          Expanding reveals the full line-item table with the same grouped /
          hairline / mono treatment the canvas uses. The panel is a client
          component (toggle state only); the table is rendered server-side and
          passed in as children - never a function prop. */}
      <Reveal y={16} duration={0.6} className="mt-4 md:mt-6">
        <SourceDataPanel
          lineCount={SPREADING_ROWS.length}
          periodCount={periodCount}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="sticky left-0 z-[2] bg-surface py-3 pl-5 pr-4 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground md:pl-6">
                    Line item
                  </th>
                  {financialStatements.map((fs, i) => {
                    const isLatest = i === periodCount - 1;
                    return (
                      <th
                        key={fs.financialStatementId}
                        className={cn(
                          "py-3 px-3 text-right text-[11px] font-medium uppercase tracking-[0.14em] whitespace-nowrap md:pr-6",
                          isLatest ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        <span className="nums tabular-nums">
                          {fmtDate(fs.periodEndDate)}
                        </span>
                        <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-muted-foreground/60">
                          {fs.isConsolidated ? "Consol." : "Standalone"} ·{" "}
                          {fs.units}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {SPREADING_ROWS.map((row, i) => {
                  const groupStart = groupStarts.has(i);
                  return (
                    <tr
                      key={row.code}
                      className={cn(
                        "border-b border-row-hairline transition-colors duration-200 ease-soft hover:bg-row-hover",
                        groupStart && "border-t border-hairline/70",
                      )}
                    >
                      <td
                        className={cn(
                          "sticky left-0 z-[2] bg-surface pl-5 pr-4 text-[13.5px] text-foreground/80 md:pl-6",
                          groupStart ? "pt-5" : "py-3.5",
                        )}
                      >
                        <div className="flex flex-col gap-1">
                          {groupStart ? (
                            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
                              {row.group}
                            </span>
                          ) : null}
                          <span>{row.label}</span>
                        </div>
                      </td>
                      {financialStatements.map((fs, i2) => {
                        const li = (fs.lineItems ?? {}) as Record<
                          string,
                          unknown
                        >;
                        const raw = li[row.code];
                        const isNum =
                          raw !== null &&
                          raw !== undefined &&
                          raw !== "" &&
                          Number.isFinite(Number(raw));
                        const isLatest = i2 === periodCount - 1;
                        return (
                          <td
                            key={fs.financialStatementId}
                            className={cn(
                              "py-3.5 px-3 text-right nums tabular-nums text-[13.5px] md:pr-6",
                              isLatest
                                ? "bg-gold/[0.04] font-medium text-foreground"
                                : "text-foreground/80",
                            )}
                          >
                            {isNum ? (
                              fmtCell(raw)
                            ) : (
                              <CellEmpty label="No value" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SourceDataPanel>
      </Reveal>
    </PageShell>
  );
}

// ── view-layer primitives (server-safe; no hooks) ──────────────────────────

type SignalTone = "default" | "up" | "down" | "gold" | "info";

function signalToneClass(tone: SignalTone): string {
  switch (tone) {
    case "gold":
      return "text-gold";
    case "up":
      return "text-up";
    case "down":
      return "text-down";
    case "info":
      return "text-info";
    default:
      return "text-foreground";
  }
}

/**
 * SignalTile - one readout in the signals header. A double-bezel Card with an
 * eyebrow label + leading glyph, a large mono tabular-nums value (tone-tinted
 * by the signal's direction), and a footer slot for the per-period sparkline
 * (or the mini band bar on the rating-notch tile). Server-safe; the sparkline
 * is handed in as a client-element child so no function crosses the RSC wire.
 */
function SignalTile({
  label,
  display,
  tone,
  icon,
  meta,
  children,
  className,
}: {
  label: string;
  display: string;
  tone: SignalTone;
  icon?: ReactNode;
  meta?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card
      ambient={tone === "gold" ? "gold" : tone === "up" ? "emerald" : undefined}
      className={cn("h-full", className)}
    >
      <div className="flex h-full flex-col gap-3 p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>{label}</Eyebrow>
          {icon ? (
            <span className="text-muted-foreground/70 [&_svg]:size-5">{icon}</span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col justify-end gap-3">
          <span
            className={cn(
              "nums tabular-nums font-medium leading-none tracking-[-0.01em] text-[clamp(1.55rem,1.1rem+1.3vw,2rem)]",
              signalToneClass(tone),
            )}
          >
            {display}
          </span>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {children}
            </div>
            {meta ? (
              <span className="nums shrink-0 text-[10px] text-muted-foreground/70">
                {meta}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** SignalEmptyTile - the designed "awaiting" state for a signal with no data
 *  yet. A Fraunces editorial one-liner + muted hint, matching the empty-state
 *  language, so an empty signal reads as intentional rather than a bare "-". */
function SignalEmptyTile({
  label,
  icon,
  hint,
  className,
}: {
  label: string;
  icon?: ReactNode;
  hint: string;
  className?: string;
}) {
  return (
    <Card className={cn("h-full", className)}>
      <div className="flex h-full flex-col gap-3 p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>{label}</Eyebrow>
          {icon ? (
            <span className="text-muted-foreground/50 [&_svg]:size-5">{icon}</span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col justify-end gap-2">
          <p className="font-display text-[1.25rem] font-light leading-none tracking-[-0.01em] text-foreground/55">
            Awaiting
          </p>
          <p className="text-[12px] leading-[1.5] text-muted-foreground">{hint}</p>
        </div>
      </div>
    </Card>
  );
}

/** MiniBandBar - the 6-rung internal-band ladder (BC-1 → BC-6) at a glance.
 *  Used under the score + rating-notch tiles so the notch's position on the
 *  internal scale reads without scanning the full AAA→D ladder. */
function MiniBandBar({ band }: { band: Band | null }) {
  const bands: Band[] = ["BC-1", "BC-2", "BC-3", "BC-4", "BC-5", "BC-6"];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        {bands.map((b) => {
          const active = band === b;
          const tone = BAND_TONE[b];
          const segClass = active
            ? tone === "emerald"
              ? "bg-emerald"
              : tone === "gold"
                ? "bg-gold"
                : tone === "info"
                  ? "bg-info"
                  : "bg-down"
            : "bg-foreground/[0.08]";
          return (
            <span
              key={b}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300 ease-soft",
                segClass,
                active &&
                  (tone === "emerald"
                    ? "shadow-[0_0_8px] shadow-emerald/55"
                    : tone === "gold"
                      ? "shadow-[0_0_8px] shadow-gold/55"
                      : tone === "info"
                        ? "shadow-[0_0_8px] shadow-info/45"
                        : "shadow-[0_0_8px] shadow-down/45"),
              )}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <span className="nums text-[9px] uppercase tracking-[0.12em] text-muted-foreground/55">
          BC-1
        </span>
        {band ? (
          <span className="text-[10px] text-muted-foreground">
            {band} · {BAND_GRADE[band]}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/60">internal scale</span>
        )}
        <span className="nums text-[9px] uppercase tracking-[0.12em] text-muted-foreground/55">
          BC-6
        </span>
      </div>
    </div>
  );
}

/** SectionMarkIcon - the bespoke mark / Phosphor glyph in a machined disc that
 *  leads each canvas section header. RatingLadderMark for coverage,
 *  ExposureGaugeMark for leverage (the two brand-concept marks the design
 *  system names for credit row-group headers); the Phosphor Light system in
 *  the same disc well for profitability + liquidity. */
function SectionMarkIcon({ sec }: { sec: SectionDef }) {
  const discTone =
    sec.markTone === "emerald"
      ? "ring-emerald/22 bg-emerald/[0.06]"
      : sec.markTone === "gold"
        ? "ring-gold/22 bg-gold/[0.06]"
        : sec.markTone === "down"
          ? "ring-down/22 bg-down/[0.06]"
          : "ring-hairline bg-foreground/[0.03]";
  const textTone =
    sec.markTone === "emerald"
      ? "text-emerald/85"
      : sec.markTone === "gold"
        ? "text-gold/85"
        : sec.markTone === "down"
          ? "text-down/85"
          : "text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full ring-1 [&_svg]:shrink-0",
        discTone,
        textTone,
      )}
    >
      {sec.mark === "ratingLadder" ? (
        <RatingLadderMark size={18} tone={sec.markTone} />
      ) : sec.mark === "exposure" ? (
        <ExposureGaugeMark size={18} tone={sec.markTone} />
      ) : sec.mark === "chartLineUp" ? (
        <ChartLineUpIcon className="size-5" />
      ) : (
        <CoinsIcon className="size-5" />
      )}
    </span>
  );
}

/** SectionScorePill - the section subtotal (avg 1-5 sub-factor score) rendered
 *  as a monochromatic pill so each canvas dimension carries a one-glance
 *  strength read alongside its metric rows. */
function SectionScorePill({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/55">
        <CellEmpty label="No section score" />
      </span>
    );
  }
  const variant: BadgeProps["variant"] =
    score >= 4 ? "emerald" : score <= 2 ? "down" : "neutral";
  return (
    <Badge variant={variant} className="gap-1.5">
      <span className="nums tabular-nums">{score.toFixed(1)}</span>
      <span className="opacity-50">/5</span>
    </Badge>
  );
}

/** ReadoutTile - small mono readout for the instrument panel (PD figures). */
function ReadoutTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: "neutral" | "down" | "emerald" | "gold";
}) {
  const toneClass =
    tone === "down"
      ? "text-down"
      : tone === "emerald"
        ? "text-emerald"
        : tone === "gold"
          ? "text-gold"
          : "text-foreground";
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-foreground/[0.03] px-3 py-2.5 ring-1 ring-hairline/60">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className={cn("nums tabular-nums text-[14px] font-medium", toneClass)}>
        {value}
      </span>
      {hint ? <span className="text-[10px] text-muted-foreground/70">{hint}</span> : null}
    </div>
  );
}

/** ScorePill - 1-5 sub-factor score pill (emerald strong / down weak). */
function ScorePill({ score }: { score: number }) {
  const variant: BadgeProps["variant"] =
    score >= 4 ? "emerald" : score <= 2 ? "down" : "neutral";
  return (
    <Badge variant={variant} className="ml-auto">
      <span className="nums tabular-nums">{score}</span>
      <span className="opacity-50">/5</span>
    </Badge>
  );
}
