import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ArrowRightIcon,
  WarningIcon,
  ChartLineUpIcon,
  ScalesIcon,
  CoinsIcon,
  SparkleIcon,
} from "@/app/credit/credit-icons";
import { ShieldCheck } from "@/components/brand/icons";

import { requireUser } from "@/lib/rbac";
import { getCreditAnalysisDetail } from "@/features/credit/queries";
import {
  computeScorecard,
  BAND_GRADE,
  BAND_PD_1Y,
  type Band,
} from "@/features/credit/scorecard";
import {
  ALL_RATIO_CODES,
  formatRatio,
  ratioCategory,
  type RatioSet,
} from "@/features/credit/ratios";
import {
  bandToAgencySymbol,
  AGENCIES,
  BAND_PD_RANGE,
} from "@/features/credit/ratingMap";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmpty,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  CellEmpty,
  EmptyState,
  IconTile,
  RatingLadderMark,
  SectionHeading,
} from "@/components/brand";
import type { BadgeProps } from "@/components/brand";
import { AddFinancialStatementForm } from "./add-fs-form";
import { CommitteeForm } from "./committee-form";
import { RunScoreButton } from "./run-score-button";
import { CreditSummaryHeader } from "./credit-summary-header";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

export const dynamic = "force-dynamic";

const BAND_BADGE: Record<string, BadgeProps["variant"]> = {
  "BC-1": "emerald",
  "BC-2": "emerald",
  "BC-3": "gold",
  "BC-4": "info",
  "BC-5": "down",
  "BC-6": "down",
};

function bandVariant(band: string | null): BadgeProps["variant"] {
  return band ? (BAND_BADGE[band] ?? "neutral") : "neutral";
}

function fmt(v: string | null | undefined, opts?: { pct?: boolean; cr?: boolean }): string {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  if (opts?.pct) return `${(n * 100).toFixed(2)}%`;
  if (opts?.cr) return `₹${n.toFixed(2)} Cr`;
  return n.toFixed(2);
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function CreditDetailPage({
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
    sector,
    financialStatements,
    ratiosByStatement,
    latestRatioSet,
    scorecard: sc,
    externalRatingsEnriched,
    exposures,
    limits,
  } = detail;

  const liveScorecard =
    latestRatioSet !== null
      ? computeScorecard({
          ratios: latestRatioSet as RatioSet,
          obligorType: a.obligorType,
        })
      : null;

  // The persisted `scorecard.band` + `credit_analysis.internal_rating_short`
  // columns hold AGENCY SYMBOLS (e.g. "AAA", "A3"), NOT the internal BC-1..BC-6
  // enum - blindly casting them as `Band` makes BAND_GRADE / BAND_PD_1Y lookups
  // return undefined, rendering "AAA · undefined" badges and a "NaN%" PD tile.
  // Resolve the band authoritatively: prefer the live engine-computed band,
  // then a persisted/rating value ONLY if it is actually a valid BC band.
  const VALID_BANDS: ReadonlySet<Band> = new Set([
    "BC-1",
    "BC-2",
    "BC-3",
    "BC-4",
    "BC-5",
    "BC-6",
  ]);
  const persistedScore = a.currentCreditScore ? Number(a.currentCreditScore) : null;
  const score = persistedScore ?? liveScorecard?.totalScore ?? null;
  const persistedBand =
    sc?.band && VALID_BANDS.has(sc.band as Band) ? (sc.band as Band) : null;
  const ratingBand =
    a.internalRatingShort && VALID_BANDS.has(a.internalRatingShort as Band)
      ? (a.internalRatingShort as Band)
      : null;
  const band: Band | null =
    (liveScorecard?.band as Band | undefined) ?? persistedBand ?? ratingBand;

  // Designed fallback - a credit file always has an obligor, but if the name is
  // somehow missing render an editorial "Unnamed obligor" rather than a bare
  // em-dash in the H1 (the unfinished tell).
  const issuerName = p?.legalName ?? "Unnamed obligor";
  const scoreTone: "default" | "up" | "down" | "gold" =
    score === null
      ? "default"
      : score >= 70
        ? "up"
        : score >= 55
          ? "gold"
          : score >= 40
            ? "default"
            : "down";

  // Derived values for the summary hero - all serializable, handed to the
  // client CreditSummaryHeader. No function props cross the RSC boundary.
  const bandGrade = band ? BAND_GRADE[band] : null;
  const pdPct = band ? BAND_PD_1Y[band] * 100 : null;
  const pdRangeLabel = band ? BAND_PD_RANGE[band] : null;

  const totalExposure = exposures.reduce(
    (acc, e) => acc + (Number(e.netExposure) || 0),
    0,
  );
  const totalLimits = limits.reduce(
    (acc, l) => acc + (Number(l.limitAmount) || 0),
    0,
  );

  // The eight headline ratios for the overview grid, with their canonical
  // category resolved view-side from the ratio engine's ratioCategory().
  const KEY_RATIOS: { label: string; code: keyof RatioSet; unit: string }[] = [
    { label: "Net Debt / EBITDA", code: "net_debt_ebitda", unit: "x" },
    { label: "Debt / EBITDA", code: "debt_ebitda", unit: "x" },
    { label: "Interest Coverage", code: "interest_coverage", unit: "x" },
    { label: "Current Ratio", code: "current_ratio", unit: "x" },
    { label: "EBITDA Margin", code: "ebitda_margin", unit: "%" },
    { label: "ROCE", code: "roce", unit: "%" },
    { label: "Debt Service Coverage Ratio", code: "dscr", unit: "x" },
    { label: "FFO / Debt", code: "ffo_debt", unit: "x" },
  ];

  return (
    <PageShell wide>
      <DetailTopBar
        backHref="/credit"
        backLabel="Credit"
        crumb={a.analysisType?.replace(/_/g, " ") ?? "Analysis"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {band ? (
              <Badge variant={bandVariant(band)} dot>
                {band} · {BAND_GRADE[band]}
              </Badge>
            ) : null}
            {a.watchlistFlag ? (
              <Badge variant="down" icon={<WarningIcon className="size-3" />}>
                watchlist
              </Badge>
            ) : null}
            <Button
              asChild
              variant="primary-gold"
              size="md"
              trailingIcon={<ArrowRightIcon className="size-4" />}
            >
              <Link href={`/credit/${id}/workspace`}>Open workspace</Link>
            </Button>
          </div>
        }
      />
      <PageHeader
        title={issuerName}
        description={`${sector ? `${sector.label} · ` : ""}${a.obligorType} · ${a.analysisType?.replace(/_/g, " ") ?? "analysis"}`}
      />

      <Tabs defaultValue="overview" className="gap-6">
        {/* Tab rail - horizontal-scroll on narrow viewports with a thin
            scrollbar + scroll-snap so the seven sections feel touch-native on
            mobile instead of a cramped, clipped strip. */}
        <div className="-mx-1 w-[calc(100%+0.5rem)] snap-x snap-mandatory overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          <TabsList className="w-fit snap-start">
            {[
              "overview",
              "financials",
              "ratios",
              "scorecard",
              "ratings",
              "exposure",
              "committee",
            ].map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">
                {t === "exposure" ? "exposure & limits" : t}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview --------------------------------------------------------- */}
        <TabsContent value="overview" className="flex flex-col gap-6">
          <CreditSummaryHeader
            score={score}
            band={band}
            bandGrade={bandGrade}
            pdPct={pdPct}
            pdRange={pdRangeLabel}
            scoreTone={scoreTone}
            hasScorecard={liveScorecard !== null}
          />

          <Card>
            <CardHeader>
              <Eyebrow dot>Latest period</Eyebrow>
              <CardTitle className="mt-1">Key ratios</CardTitle>
              <CardDescription>
                {financialStatements.length > 0
                  ? `As of ${fmtDate(financialStatements[financialStatements.length - 1].periodEndDate)}`
                  : "No financial statements linked yet."}
              </CardDescription>
            </CardHeader>
            <CardBody>
              {latestRatioSet ? (
                <>
                  {/* Ratio grid - each ratio is a machined inset cell (raised
                      core + inset highlight + hairline ring), the same nested-
                      bezel depth as the card enclosure one level up. Empties
                      render the brand CellEmpty (Fraunces em-dash + tooltip)
                      sized to the value so an awaiting cell reads as
                      intentional, not unfinished. */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {KEY_RATIOS.map(({ label, code, unit }) => {
                      const raw = (latestRatioSet as RatioSet)[code];
                      const display = formatRatio(code, raw);
                      const hasValue = display !== "-";
                      const category = ratioCategory(code);
                      return (
                        <div
                          key={code}
                          className="group/ratio-cell relative flex flex-col gap-2 rounded-xl bg-surface p-3.5 ring-1 ring-inset ring-foreground/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors duration-300 ease-soft hover:ring-foreground/[0.12]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11.5px] font-medium text-foreground/85">
                              {label}
                            </span>
                            <span className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
                              {category}
                            </span>
                          </div>
                          {hasValue ? (
                            <span className="nums text-[18px] font-medium tabular-nums tracking-[-0.01em] text-foreground">
                              {display}
                            </span>
                          ) : (
                            <CellEmpty
                              label="Awaiting input"
                              tooltip="No value for this ratio in the latest period"
                            >
                              <span
                                aria-hidden
                                className="text-[18px] leading-none tracking-[-0.02em] text-muted-foreground/45"
                              >
                                -
                              </span>
                            </CellEmpty>
                          )}
                          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                            {hasValue ? unit : "awaiting input"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-5">
                    <RunScoreButton analysisId={id} variant="primary-gold" size="md" />
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={<ChartLineUpIcon />}
                  title="Ratios await a statement."
                  hint="Add a financial statement and run the scorecard to populate the key-ratio grid."
                  action={
                    <RunScoreButton analysisId={id} variant="primary-gold" size="md" />
                  }
                />
              )}
            </CardBody>
          </Card>
        </TabsContent>

        {/* Financials ------------------------------------------------------- */}
        <TabsContent value="financials" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <Eyebrow>
                <ScalesIcon className="size-3.5" /> Linked statements
              </Eyebrow>
              <CardTitle className="mt-1">Financial statements</CardTitle>
              <CardDescription>
                {financialStatements.length} statement
                {financialStatements.length === 1 ? "" : "s"} · many-to-many via
                credit_analysis_fs_link
              </CardDescription>
            </CardHeader>
            <CardBody className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period end</TableHead>
                    {/* Type / Basis / Units / Role are secondary on phones -
                        hidden < md so the 7-col statement table collapses to
                        Period end + Source + Ratios (when, provenance, count). */}
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden md:table-cell">Basis</TableHead>
                    <TableHead className="hidden md:table-cell">Units</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="hidden md:table-cell">Role</TableHead>
                    <TableHead align="right">Ratios</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financialStatements.length === 0 ? (
                    <TableRow className="hover:bg-transparent before:hidden">
                      <TableCell colSpan={7} className="p-0">
                        <TableEmpty
                          icon={<SparkleIcon />}
                          title="No statements linked."
                          hint="Add one below to begin spreading."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    financialStatements.map((fs) => (
                      <TableRow key={fs.financialStatementId}>
                        <TableCell primary className="nums">
                          {fs.periodEndDate ? (
                            fmtDate(fs.periodEndDate)
                          ) : (
                            <CellEmpty
                              label="No period end"
                              tooltip="Statement period end not recorded"
                            />
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="neutral">{fs.statementType}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {fs.isConsolidated ? "Consolidated" : "Standalone"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{fs.units}</TableCell>
                        <TableCell>
                          {fs.source ? (
                            fs.source
                          ) : (
                            <CellEmpty
                              label="No source"
                              tooltip="Statement source not recorded"
                            />
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {fs.linkRole ? (
                            <Badge variant="outline">
                              {fs.linkRole.replace(/_/g, " ")}
                            </Badge>
                          ) : (
                            <CellEmpty
                              label="No link role"
                              tooltip="Statement is linked without a role"
                            />
                          )}
                        </TableCell>
                        <TableCell numeric>
                          {ratiosByStatement[fs.financialStatementId]?.length ?? 0}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Eyebrow dot>Add a period</Eyebrow>
              <CardTitle className="mt-1">Add a financial statement</CardTitle>
              <CardDescription>
                Enter line items as JSON keyed by canonical codes (revenue,
                ebit, total_debt, …).
              </CardDescription>
            </CardHeader>
            <CardBody>
              <AddFinancialStatementForm analysisId={id} />
            </CardBody>
          </Card>
        </TabsContent>

        {/* Ratios ----------------------------------------------------------- */}
        <TabsContent value="ratios" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <Eyebrow>
                <ChartLineUpIcon className="size-3.5" /> Ratio library
              </Eyebrow>
              <CardTitle className="mt-1">Ratios - latest period</CardTitle>
              <CardDescription>
                Computed by the ratio engine (CREDIT_ANALYSIS_SPEC §3).
                Persisted to ratio_result on run.
              </CardDescription>
            </CardHeader>
            <CardBody className="p-0">
              {latestRatioSet ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Ratio</TableHead>
                      <TableHead align="right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ALL_RATIO_CODES.map((r) => {
                      const val = (latestRatioSet as RatioSet)[r.code];
                      const display = formatRatio(r.code, val);
                      const hasValue = display !== "-";
                      return (
                        <TableRow key={r.code}>
                          <TableCell>
                            <span className="text-muted-foreground">
                              {ratioCategory(r.code)}
                            </span>
                          </TableCell>
                          <TableCell primary>{r.label}</TableCell>
                          <TableCell numeric>
                            {hasValue ? (
                              <span className="nums tabular-nums text-foreground">
                                {display}
                              </span>
                            ) : (
                              <CellEmpty
                                label="Awaiting input"
                                tooltip="No value for this ratio in the latest period"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <TableEmpty
                  icon={<ScalesIcon />}
                  title="No ratios yet."
                  hint="Add a financial statement and run the scorecard to populate the ratio library."
                />
              )}
            </CardBody>
          </Card>
        </TabsContent>

        {/* Scorecard -------------------------------------------------------- */}
        <TabsContent value="scorecard" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <Eyebrow dot>Scorecard</Eyebrow>
              <CardTitle className="mt-1">Weighted 0-100 scorecard</CardTitle>
              <CardDescription>
                Sub-factors scored 1-5 against sector-adjusted benchmarks; total
                = Σ weight × (score/5) × 100 (spec §4.1).
              </CardDescription>
            </CardHeader>
            <CardBody>
              {liveScorecard ? (
                <>
                  <div className="relative mb-6 flex flex-col items-center gap-5 md:flex-row md:items-center md:gap-8">
                    {/* Ambient halo behind the scorecard ring - tone-aware so
                        the dial reads as a lit object inside the bezel. */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -top-8 left-1/2 h-40 w-72 -translate-x-1/2 bg-[radial-gradient(58%_62%_at_50%_42%,color-mix(in_oklch,var(--gold)_26%,transparent),color-mix(in_oklch,var(--emerald)_14%,transparent)_42%,transparent_72%)] md:left-10 md:translate-x-0"
                    />
                    <ScoreRing
                      value={liveScorecard.totalScore}
                      min={0}
                      max={100}
                      size={150}
                      thickness={11}
                      preset="decimal1"
                      band={{
                        label: liveScorecard.band,
                        tone:
                          liveScorecard.band === "BC-1" ||
                          liveScorecard.band === "BC-2"
                            ? "emerald"
                            : liveScorecard.band === "BC-3"
                              ? "gold"
                              : liveScorecard.band === "BC-4"
                                ? "neutral"
                                : "down",
                      }}
                      sublabel={liveScorecard.notionalGrade}
                    />
                    <div className="grid flex-1 grid-cols-2 gap-3 self-stretch">
                      <Readout
                        label="Band"
                        value={`${liveScorecard.band} · ${liveScorecard.notionalGrade}`}
                        tone="gold"
                      />
                      <Readout
                        label="Indic. 1-yr Probability of Default"
                        value={
                          typeof liveScorecard.indicativePd1y === "number" &&
                          Number.isFinite(liveScorecard.indicativePd1y)
                            ? `${(liveScorecard.indicativePd1y * 100).toFixed(3)}%`
                            : "-"
                        }
                        tone={scoreTone === "down" ? "down" : "neutral"}
                      />
                      <Readout
                        label="Total score"
                        value={
                          typeof liveScorecard.totalScore === "number" &&
                          Number.isFinite(liveScorecard.totalScore)
                            ? liveScorecard.totalScore.toFixed(1)
                            : "-"
                        }
                        tone={
                          scoreTone === "up"
                            ? "emerald"
                            : scoreTone === "gold"
                              ? "gold"
                              : scoreTone === "down"
                                ? "down"
                                : "neutral"
                        }
                      />
                      <Readout
                        label="Probability of Default range"
                        value={BAND_PD_RANGE[liveScorecard.band]}
                      />
                    </div>
                  </div>
                  <Table density="compact">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sub-factor</TableHead>
                        {/* Weight / Benchmark / Justification are secondary on
                            phones - hidden < md so the 6-col scorecard table
                            collapses to Sub-factor + Score + Input (what an
                            analyst scans on a phone). */}
                        <TableHead align="right" className="hidden md:table-cell">Weight</TableHead>
                        <TableHead align="right">Score</TableHead>
                        <TableHead>Input</TableHead>
                        <TableHead className="hidden md:table-cell">Benchmark</TableHead>
                        <TableHead className="hidden lg:table-cell">Justification</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {liveScorecard.subFactors.map((sf) => (
                        <TableRow key={sf.code}>
                          <TableCell primary>{sf.label}</TableCell>
                          <TableCell numeric className="hidden md:table-cell">
                            <span className="nums tabular-nums text-muted-foreground">
                              {typeof sf.weight === "number" && Number.isFinite(sf.weight)
                                ? `${(sf.weight * 100).toFixed(0)}%`
                                : "-"}
                            </span>
                          </TableCell>
                          <TableCell numeric>
                            <ScorePill score={sf.score} />
                          </TableCell>
                          <TableCell>
                            {sf.inputValue !== null ? (
                              <span className="nums tabular-nums text-foreground">
                                {formatRatio(sf.code, sf.inputValue)}
                              </span>
                            ) : (
                              <CellEmpty
                                label="Awaiting input"
                                tooltip="No input value drove this sub-factor"
                              />
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {sf.benchmark ? (
                              <span className="text-[11.5px] text-muted-foreground">
                                {sf.benchmark}
                              </span>
                            ) : (
                              <CellEmpty
                                label="No benchmark"
                                tooltip="No benchmark band recorded for this sub-factor"
                              />
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {sf.justification ? (
                              <span className="text-[11.5px] text-muted-foreground">
                                {sf.justification}
                              </span>
                            ) : (
                              <CellEmpty
                                label="No override"
                                tooltip="No analyst override recorded for this sub-factor"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <TableEmpty
                  icon={<ScalesIcon />}
                  title="No scorecard yet."
                  hint="Add a financial statement and run the scorecard to populate sub-factor scores."
                />
              )}
              <div className="mt-5">
                <RunScoreButton analysisId={id} variant="primary-gold" size="md" />
              </div>
            </CardBody>
          </Card>
        </TabsContent>

        {/* Ratings ---------------------------------------------------------- */}
        <TabsContent value="ratings" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <Eyebrow>
                <RatingLadderMark size={14} tone="gold" /> External ratings
              </Eyebrow>
              <CardTitle className="mt-1">Agency ratings</CardTitle>
              <CardDescription>
                Existing agency ratings on the issuer, resolved to the internal
                BC band via rating_ladder.
              </CardDescription>
            </CardHeader>
            <CardBody className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agency</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>BC band</TableHead>
                    {/* Outlook / Action / Effective are secondary on phones -
                        hidden < md so the 6-col ratings table collapses to
                        Agency + Rating + BC band (the resolution that matters
                        on a phone). */}
                    <TableHead className="hidden md:table-cell">Outlook</TableHead>
                    <TableHead className="hidden md:table-cell">Action</TableHead>
                    <TableHead align="right" className="hidden md:table-cell">Effective</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {externalRatingsEnriched.length === 0 ? (
                    <TableRow className="hover:bg-transparent before:hidden">
                      <TableCell colSpan={6} className="p-0">
                        <TableEmpty
                          icon={<SparkleIcon />}
                          title="No external ratings recorded."
                          hint="Agency ratings will resolve to an internal BC band once added."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    externalRatingsEnriched.map((e) => (
                      <TableRow key={e.row.externalRatingId}>
                        <TableCell>
                          <Badge variant="neutral">{e.row.agency}</Badge>
                        </TableCell>
                        <TableCell primary className="nums">
                          {e.row.ratingValue ? (
                            e.row.ratingValue
                          ) : (
                            <CellEmpty
                              label="Not rated"
                              tooltip="No external rating on file for this agency"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {e.band ? (
                            <Badge variant={bandVariant(e.band)}>{e.band}</Badge>
                          ) : (
                            <CellEmpty
                              label="No band mapping"
                              tooltip="Rating did not resolve to an internal BC band"
                            />
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {e.row.outlook ? (
                            e.row.outlook
                          ) : (
                            <CellEmpty
                              label="No outlook"
                              tooltip="No outlook assigned to this rating"
                            />
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {e.row.ratingAction ? (
                            e.row.ratingAction
                          ) : (
                            <CellEmpty
                              label="No action"
                              tooltip="No rating action recorded"
                            />
                          )}
                        </TableCell>
                        <TableCell numeric className="hidden md:table-cell">
                          {e.row.effectiveDate ? (
                            fmtDate(e.row.effectiveDate)
                          ) : (
                            <CellEmpty
                              label="No effective date"
                              tooltip="Rating effective date not recorded"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Eyebrow dot>Target rating by band</Eyebrow>
              <CardTitle className="mt-1">Internal band → agency symbol</CardTitle>
              <CardDescription>
                Internal band → canonical agency symbol (spec §5). Used by the
                rating-advisory team to pre-position the issuer.
              </CardDescription>
            </CardHeader>
            <CardBody className="p-0">
              <Table density="compact">
                <TableHeader>
                  <TableRow>
                    <TableHead>Band</TableHead>
                    {AGENCIES.map((ag) => (
                      <TableHead key={ag.code}>{ag.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(["BC-1", "BC-2", "BC-3", "BC-4", "BC-5", "BC-6"] as const).map(
                    (b) => {
                      const active = band === b;
                      return (
                        <TableRow key={b} selected={active}>
                          <TableCell>
                            <Badge variant={bandVariant(b)}>{b}</Badge>
                          </TableCell>
                          {AGENCIES.map((ag) => (
                            <TableCell key={ag.code}>
                              <span
                                className={
                                  "nums text-[12.5px] " +
                                  (active
                                    ? "font-medium text-foreground"
                                    : "text-foreground/75")
                                }
                              >
                                {bandToAgencySymbol(b, ag.code)}
                              </span>
                              {ag.woundDown ? (
                                <span className="ml-1.5 text-[10px] text-gold">
                                  wound-down
                                </span>
                              ) : null}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    },
                  )}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </TabsContent>

        {/* Exposure --------------------------------------------------------- */}
        <TabsContent value="exposure" className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Total net exposure"
              value={totalExposure}
              tone="default"
              preset="currency"
              icon={<CoinsIcon />}
            />
            <StatCard
              label="Total limits"
              value={totalLimits}
              tone="gold"
              preset="currency"
              icon={<ScalesIcon />}
            />
          </div>

          <Card>
            <CardHeader>
              <Eyebrow>
                <CoinsIcon className="size-3.5" /> Firm exposure
              </Eyebrow>
              <CardTitle className="mt-1">Exposure</CardTitle>
              <CardDescription>
                Firm economic exposure to this issuer (spec §7.1).
              </CardDescription>
            </CardHeader>
            <CardBody className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    {/* Currency / Gross / Maturity are secondary on phones -
                        hidden < md so the 6-col exposure table collapses to
                        Type + Net + As of (the position snapshot that matters
                        on a phone). */}
                    <TableHead className="hidden md:table-cell">Currency</TableHead>
                    <TableHead align="right" className="hidden md:table-cell">Gross</TableHead>
                    <TableHead align="right">Net</TableHead>
                    <TableHead align="right">As of</TableHead>
                    <TableHead align="right" className="hidden md:table-cell">Maturity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exposures.length === 0 ? (
                    <TableRow className="hover:bg-transparent before:hidden">
                      <TableCell colSpan={6} className="p-0">
                        <TableEmpty
                          icon={<SparkleIcon />}
                          title="No exposure recorded."
                          hint="Firm economic exposure will appear here once booked."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    exposures.map((e) => (
                      <TableRow key={e.exposureId}>
                        <TableCell>
                          <Badge variant="outline">{e.exposureType}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{e.currencyCode}</TableCell>
                        <TableCell numeric className="hidden md:table-cell">
                          {e.grossExposure ? (
                            fmt(e.grossExposure, { cr: true })
                          ) : (
                            <CellEmpty
                              label="Not reported"
                              tooltip="Gross exposure not yet recorded for this position"
                            />
                          )}
                        </TableCell>
                        <TableCell numeric>
                          {e.netExposure ? (
                            fmt(e.netExposure, { cr: true })
                          ) : (
                            <CellEmpty
                              label="Not reported"
                              tooltip="Net exposure not yet recorded for this position"
                            />
                          )}
                        </TableCell>
                        <TableCell numeric>
                          {e.asOfDate ? (
                            fmtDate(e.asOfDate)
                          ) : (
                            <CellEmpty
                              label="No date"
                              tooltip="Exposure as-of date not recorded"
                            />
                          )}
                        </TableCell>
                        <TableCell numeric className="hidden md:table-cell">
                          {e.maturityDate ? (
                            fmtDate(e.maturityDate)
                          ) : (
                            <CellEmpty
                              label="No maturity"
                              tooltip="Position has no maturity date on file"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Eyebrow dot>Credit limits</Eyebrow>
              <CardTitle className="mt-1">Limits</CardTitle>
              <CardDescription>
                Issuer / group / sector / band / tenor limits (spec §7.2).
              </CardDescription>
            </CardHeader>
            <CardBody className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scope</TableHead>
                    {/* Currency / Utilized / Review due are secondary on phones -
                        hidden < md so the 6-col limits table collapses to
                        Scope + Limit + Available (the headroom read that
                        matters on a phone). */}
                    <TableHead className="hidden md:table-cell">Currency</TableHead>
                    <TableHead align="right">Limit</TableHead>
                    <TableHead align="right" className="hidden md:table-cell">Utilized</TableHead>
                    <TableHead align="right">Available</TableHead>
                    <TableHead align="right" className="hidden md:table-cell">Review due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {limits.length === 0 ? (
                    <TableRow className="hover:bg-transparent before:hidden">
                      <TableCell colSpan={6} className="p-0">
                        <TableEmpty
                          icon={<SparkleIcon />}
                          title="No limits set."
                          hint="Issuer / group / sector limits will appear here once configured."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    limits.map((l) => (
                      <TableRow key={l.creditLimitId}>
                        <TableCell>
                          <Badge variant="neutral">
                            {l.limitType.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{l.currencyCode}</TableCell>
                        <TableCell numeric>
                          {l.limitAmount ? (
                            fmt(l.limitAmount, { cr: true })
                          ) : (
                            <CellEmpty
                              label="Not set"
                              tooltip="Limit amount not configured for this scope"
                            />
                          )}
                        </TableCell>
                        <TableCell numeric className="hidden md:table-cell">
                          {l.utilized ? (
                            fmt(l.utilized, { cr: true })
                          ) : (
                            <CellEmpty
                              label="Not utilized"
                              tooltip="No utilization recorded against this limit"
                            />
                          )}
                        </TableCell>
                        <TableCell numeric>
                          {l.available ? (
                            fmt(l.available, { cr: true })
                          ) : (
                            <CellEmpty
                              label="Not available"
                              tooltip="Available headroom not computed for this limit"
                            />
                          )}
                        </TableCell>
                        <TableCell numeric className="hidden md:table-cell">
                          {l.reviewDueDate ? (
                            fmtDate(l.reviewDueDate)
                          ) : (
                            <CellEmpty
                              label="No review date"
                              tooltip="Limit review date not scheduled"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </TabsContent>

        {/* Committee -------------------------------------------------------- */}
        <TabsContent value="committee" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <Eyebrow dot>Committee workflow</Eyebrow>
              <CardTitle className="mt-1">Credit committee</CardTitle>
              <CardDescription>
                Capture the credit-committee state (spec §9). Quorum: chair + 1
                (≤ ₹50 Cr), full quorum (₹50-250 Cr), full + board (&gt; ₹250
                Cr).
              </CardDescription>
            </CardHeader>
            <CardBody>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] text-muted-foreground">
                  Current state:
                </span>
                <Badge variant="neutral">
                  {a.internalRatingAction?.replace(/_/g, " ") ?? "draft"}
                </Badge>
                {a.watchlistFlag ? (
                  <Badge variant="down" icon={<WarningIcon className="size-3" />}>
                    watchlist
                  </Badge>
                ) : null}
                {a.recommendation ? (
                  <span className="text-[12.5px] text-muted-foreground">
                    · {a.recommendation}
                  </span>
                ) : null}
              </div>
              <CommitteeForm
                analysisId={id}
                currentAction={a.internalRatingAction}
                currentRecommendation={a.recommendation}
                watchlist={a.watchlistFlag}
              />
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

/** Small mono readout tile for the scorecard tab - tone-aware value + optional
 *  hint, aligned with the workspace's instrument-panel ReadoutTile. */
function Readout({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "down" | "emerald" | "gold";
  hint?: string | null;
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
    <div className="flex flex-col gap-1 justify-self-stretch rounded-xl bg-foreground/[0.03] px-3.5 py-3 ring-1 ring-hairline/60">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className={"nums text-[14px] font-medium tabular-nums " + toneClass}>
        {value}
      </span>
      {hint ? (
        <span className="text-[10px] text-muted-foreground/70">{hint}</span>
      ) : null}
    </div>
  );
}

/** 1-5 sub-factor score pill - emerald for strong, down for weak. */
function ScorePill({ score }: { score: number }) {
  const valid = typeof score === "number" && Number.isFinite(score);
  const variant: BadgeProps["variant"] = !valid
    ? "neutral"
    : score >= 4
      ? "emerald"
      : score <= 2
        ? "down"
        : "neutral";
  return (
    <Badge variant={variant} className="ml-auto">
      <span className="nums tabular-nums">{valid ? score : "-"}</span>
      <span className="opacity-50">/5</span>
    </Badge>
  );
}
