"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Warning, Info, ArrowUpRight } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Badge, Reveal } from "@/components/brand";
import type { BadgeProps } from "@/components/brand";
import { ChartCard } from "@/components/brand/chart-theme";
import { compactCr } from "@/features/reports/export";
import type {
  PortfolioOverview,
  ExposureBySectorRow,
  ExposureByIssuerRow,
  ExposureByRatingBandRow,
  ExposureByTenorRow,
  LimitUtilizationSummary,
  ConcentrationAlertSummary,
  ConcentrationAlert,
} from "@/features/portfolio";
import {
  DonutChart,
  HBarChart,
  StackedBarChart,
  VBarChart,
  RadialGauge,
  EXPOSURE_TYPE_COLORS,
  EXPOSURE_TYPE_LABELS,
  type DonutPoint,
  type LabelValuePoint,
  type StackedPoint,
  type GaugePoint,
} from "./portfolio-charts";

/**
 * Portfolio overview client view - the bento of breakdown charts + the limit-
 * utilization gauge cluster + the concentration-alert rail. Server-fetched,
 * serializable data only crosses the RSC boundary (no function props). The
 * charts are lazy client-only dynamic imports (recharts ships in a lazy chunk
 * fetched after first paint); a calm skeleton reserves layout while the chunk
 * arrives.
 *
 * Mount-based motion; primary content renders VISIBLE on first paint (the
 * ChartCard shells + KPI eyebrows paint immediately; the chart canvases fill
 * in when the recharts chunk lands).
 */
export interface OverviewViewProps {
  overview: PortfolioOverview;
  bySector: ExposureBySectorRow[];
  byIssuer: ExposureByIssuerRow[];
  byRating: ExposureByRatingBandRow[];
  byTenor: ExposureByTenorRow[];
  limits: LimitUtilizationSummary;
  alerts: ConcentrationAlertSummary;
}

const EXPOSURE_TYPE_ORDER = [
  "underwriting_unsold",
  "secondary_inventory",
  "portfolio_holding",
  "advisory_fee_at_risk",
  "settlement_counterparty",
  "repo",
] as const;

export function OverviewView(props: OverviewViewProps) {
  const { overview, bySector, byIssuer, byRating, byTenor, limits, alerts } =
    props;

  // --- Sector donut data ---
  const sectorData: DonutPoint[] = bySector.map((s) => ({
    label: s.sector,
    value: Number(s.grossCr.toFixed(2)),
  }));

  // --- Top-10 issuer hbar data (truncate long names for the y-axis) ---
  const issuerData: LabelValuePoint[] = byIssuer.map((r) => ({
    label: truncate(r.name, 20),
    value: Number(r.grossCr.toFixed(2)),
    hint: `${r.sharePct.toFixed(2)}% of book`,
  }));

  // --- Rating-band stacked data ---
  const { points: ratingPoints, keys: ratingKeys } = buildRatingStacked(
    byRating,
  );

  // --- Tenor distribution data ---
  const tenorData: LabelValuePoint[] = byTenor.map((t) => ({
    label: t.label,
    value: Number(t.grossCr.toFixed(2)),
    hint: `${t.sharePct.toFixed(1)}%`,
  }));

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {/* Bento row 1: sector donut (4) + issuer hbar (5) + alerts (3). */}
      <div className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-12">
        <Reveal y={12} delay={0.04} className="lg:col-span-4">
          <ChartCard
            title="Exposure by sector"
            description="Top-level sector family, % of book."
          >
            <div className="px-3 pb-2 pt-3 md:px-4">
              <DonutChart
                data={sectorData}
                centerLabel="Gross"
                compactValue={(n) => compactCr(n)}
              />
            </div>
            <SectorLegend rows={bySector} />
          </ChartCard>
        </Reveal>

        <Reveal y={12} delay={0.08} className="lg:col-span-5">
          <ChartCard
            title="Top 10 obligors"
            description="Largest single-name exposures, ₹ Cr."
          >
            <div className="px-3 pb-4 pt-3 md:px-4">
              {issuerData.length > 0 ? (
                <HBarChart
                  data={issuerData}
                  height={300}
                  valueLabel="Exposure"
                  compactValue={(n) => compactCr(n)}
                />
              ) : null}
            </div>
          </ChartCard>
        </Reveal>

        <Reveal y={12} delay={0.12} className="lg:col-span-3">
          <AlertRail alerts={alerts} />
        </Reveal>
      </div>

      {/* Bento row 2: rating stacked (7) + tenor distribution (5). */}
      <div className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-12">
        <Reveal y={12} delay={0.04} className="lg:col-span-7">
          <ChartCard
            title="Exposure by rating band"
            description="Long-term external rating, stacked by exposure type."
          >
            <div className="px-3 pb-2 pt-3 md:px-4">
              {ratingPoints.length > 0 ? (
                <StackedBarChart
                  data={ratingPoints}
                  keys={ratingKeys}
                  height={300}
                  compactValue={(n) => compactCr(n)}
                />
              ) : null}
            </div>
            <StackedLegend keys={ratingKeys} />
          </ChartCard>
        </Reveal>

        <Reveal y={12} delay={0.08} className="lg:col-span-5">
          <ChartCard
            title="Exposure by tenor"
            description="Residual years-to-maturity distribution."
          >
            <div className="px-3 pb-4 pt-3 md:px-4">
              {tenorData.length > 0 ? (
                <VBarChart
                  data={tenorData}
                  height={300}
                  valueLabel="Exposure"
                  color="var(--emerald-deep)"
                  compactValue={(n) => compactCr(n)}
                />
              ) : null}
            </div>
          </ChartCard>
        </Reveal>
      </div>

      {/* Bento row 3: limit utilization gauges (full width). */}
      <Reveal y={12} delay={0.04}>
        <ChartCard
          title="Limit utilization"
          description="Approved credit limits by type, current utilization. Over 100% is a breach."
          action={
            <Link
              href="/portfolio/limits"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors duration-200 ease-soft hover:text-foreground"
            >
              Manage limits
              <ArrowRight weight="light" className="size-3.5" />
            </Link>
          }
        >
          <LimitGaugeCluster summary={limits} />
        </ChartCard>
      </Reveal>

      {/* Exposure-type breakdown strip (context for the dashboard). */}
      <Reveal y={12} delay={0.04}>
        <ChartCard
          title="Exposure by type"
          description="The current book split across the firm's exposure categories."
        >
          <ExposureTypeStrip overview={overview} />
        </ChartCard>
      </Reveal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Concentration alert rail.
// ---------------------------------------------------------------------------

function alertVariant(severity: ConcentrationAlert["severity"]): BadgeProps["variant"] {
  if (severity === "high") return "down";
  if (severity === "elevated") return "gold";
  return "info";
}

function AlertRail({ alerts }: { alerts: ConcentrationAlertSummary }) {
  const { alerts: list, top1IssuerSharePct, top3IssuerSharePct, hhi } = alerts;

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl bg-foreground/[0.02] p-1.5 ring-1 ring-hairline/70">
      <div className="bezel-hi flex h-full flex-col gap-4 rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface p-5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Concentration alerts
            </span>
            <span className="text-[13px] text-muted-foreground">
              {list.length} signal{list.length === 1 ? "" : "s"}
            </span>
          </div>
          <Link
            href="/portfolio/concentration"
            className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft hover:bg-foreground/5 hover:text-foreground active:scale-[0.96]"
            aria-label="Open concentration analysis"
          >
            <ArrowUpRight weight="light" className="size-4" />
          </Link>
        </div>

        {/* Concentration stat trio. */}
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-foreground/[0.025] p-3 ring-1 ring-hairline/50">
          <ConcStat label="Top-1" value={`${top1IssuerSharePct.toFixed(2)}%`} />
          <ConcStat label="CR3" value={`${top3IssuerSharePct.toFixed(2)}%`} />
          <ConcStat label="HHI" value={hhi.toFixed(0)} />
        </div>

        {/* Alert list. */}
        <div className="flex flex-col gap-2 overflow-y-auto">
          {list.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <span className="text-[15px] font-light text-foreground/80">
                The book reads clean.
              </span>
              <span className="text-[12px] text-muted-foreground">
                No concentration or limit signals.
              </span>
            </div>
          ) : (
            list.slice(0, 6).map((a) => {
              const IconCmp = a.severity === "info" ? Info : Warning;
              return (
                <div
                  key={a.id}
                  className="flex flex-col gap-1.5 rounded-xl bg-foreground/[0.02] p-3 ring-1 ring-hairline/50"
                >
                  <div className="flex items-center gap-2">
                    <IconCmp
                      weight="light"
                      className={cn(
                        "size-4 shrink-0",
                        a.severity === "high"
                          ? "text-down"
                          : a.severity === "elevated"
                            ? "text-gold"
                            : "text-info",
                      )}
                    />
                    <Badge variant={alertVariant(a.severity)} className="capitalize">
                      {a.severity}
                    </Badge>
                    <span className="nums ml-auto text-[12px] font-medium tabular-nums text-foreground/80">
                      {a.value}
                    </span>
                  </div>
                  <span className="text-[12.5px] font-medium leading-snug text-foreground">
                    {a.title}
                  </span>
                  <span className="text-[11.5px] leading-snug text-muted-foreground">
                    {a.detail}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function ConcStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="nums text-[15px] font-medium tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sector legend - the donut's color key + share table.
// ---------------------------------------------------------------------------

function SectorLegend({ rows }: { rows: ExposureBySectorRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 px-5 pb-4 pt-1 md:px-6">
      {rows.slice(0, 6).map((r, i) => (
        <div
          key={r.sector}
          className="flex items-center justify-between gap-3 text-[12.5px]"
        >
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{
                background: SECTOR_COLOR[i % SECTOR_COLOR.length],
              }}
            />
            {r.sector}
          </span>
          <span className="nums font-medium tabular-nums text-foreground/80">
            {r.sharePct.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

const SECTOR_COLOR = [
  "var(--emerald)",
  "var(--gold)",
  "var(--info)",
  "var(--emerald-deep)",
  "var(--gold-deep)",
  "var(--muted-foreground)",
];

// ---------------------------------------------------------------------------
// Stacked legend - the rating-band chart's exposure-type color key.
// ---------------------------------------------------------------------------

function StackedLegend({
  keys,
}: {
  keys: { key: string; label: string; color: string }[];
}) {
  if (keys.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 px-5 pb-4 pt-1 md:px-6">
      {keys.map((k) => (
        <span
          key={k.key}
          className="inline-flex items-center gap-2 text-[11.5px] text-muted-foreground"
        >
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ background: k.color }}
          />
          {k.label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Limit utilization gauge cluster - overall + per-type radial gauges.
// ---------------------------------------------------------------------------

function LimitGaugeCluster({ summary }: { summary: LimitUtilizationSummary }) {
  const types = summary.byType.filter((t) => t.count > 0);
  const overall: GaugePoint = {
    value: summary.overall.utilizationPct,
    label: "Overall",
  };

  return (
    <div className="flex flex-wrap items-stretch gap-4 px-3 pb-5 pt-3 md:px-5">
      {/* Overall gauge - the headline. */}
      <GaugeTile point={overall} tone="overall" limit={summary.overall.totalLimitCr} utilized={summary.overall.totalUtilizedCr} count={summary.overall.count} breach={summary.overall.breachCount} />

      {types.map((t) => {
        const point: GaugePoint = {
          value: t.utilizationPct,
          label: t.limitTypeLabel,
        };
        return (
          <GaugeTile
            key={t.limitType}
            point={point}
            limit={t.totalLimitCr}
            utilized={t.totalUtilizedCr}
            count={t.count}
            breach={t.breachCount}
          />
        );
      })}
    </div>
  );
}

function GaugeTile({
  point,
  tone = "type",
  limit,
  utilized,
  count,
  breach,
}: {
  point: GaugePoint;
  tone?: "overall" | "type";
  limit: number;
  utilized: number;
  count: number;
  breach: number;
}) {
  const breached = point.value > 100;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl p-4 ring-1",
        tone === "overall"
          ? "w-full max-w-[240px] bg-foreground/[0.03] ring-hairline/80 md:w-[240px]"
          : "w-[180px] bg-foreground/[0.02] ring-hairline/60",
      )}
    >
      <div className="h-[180px] w-full">
        <RadialGauge data={point} height={180} label={point.label} />
      </div>
      <div className="flex w-full flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11.5px]">
          <span className="text-muted-foreground">Limit</span>
          <span className="nums font-medium tabular-nums text-foreground/80">
            {compactCr(limit)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11.5px]">
          <span className="text-muted-foreground">Utilized</span>
          <span className="nums font-medium tabular-nums text-foreground/80">
            {compactCr(utilized)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11.5px]">
          <span className="text-muted-foreground">Lines</span>
          <span className="nums font-medium tabular-nums text-foreground/80">
            {count.toLocaleString("en-IN")}
          </span>
        </div>
        {breach > 0 ? (
          <div className="mt-0.5 flex items-center justify-between rounded-lg bg-down/[0.08] px-2 py-1 text-[11px] ring-1 ring-down/22">
            <span className="text-down">Breaches</span>
            <span className="nums font-medium tabular-nums text-down">
              {breach.toLocaleString("en-IN")}
            </span>
          </div>
        ) : (
          <div className="mt-0.5 flex items-center justify-between rounded-lg bg-up/[0.06] px-2 py-1 text-[11px] ring-1 ring-up/16">
            <span className="text-up">Breaches</span>
            <span className="nums font-medium tabular-nums text-up">0</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exposure-type strip - horizontal share bars for the dashboard footer.
// ---------------------------------------------------------------------------

function ExposureTypeStrip({ overview }: { overview: PortfolioOverview }) {
  const rows = overview.exposureByType;
  if (rows.length === 0) return <EmptyBlock />;
  const max = Math.max(...rows.map((r) => r.grossCr), 1);
  return (
    <div className="flex flex-col gap-2.5 px-5 pb-5 pt-3 md:px-6">
      {rows.map((r) => (
        <div key={r.exposureType} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-muted-foreground">{r.exposureTypeLabel}</span>
            <span className="inline-flex items-baseline gap-2">
              <span className="nums font-medium tabular-nums text-foreground">
                {compactCr(r.grossCr)}
              </span>
              <span className="nums text-[11px] tabular-nums text-muted-foreground">
                {r.sharePct.toFixed(1)}%
              </span>
            </span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
            <span
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                "bg-gold",
              )}
              style={{ width: `${Math.max((r.grossCr / max) * 100, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyBlock() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="text-[15px] font-light text-foreground/80">
        No exposure on the book.
      </span>
      <span className="text-[12px] text-muted-foreground">
        The current exposure snapshot is empty.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

/** Pivot the rating-band rows into the stacked-bar shape + ordered keys. */
function buildRatingStacked(rows: ExposureByRatingBandRow[]): {
  points: StackedPoint[];
  keys: { key: string; label: string; color: string }[];
} {
  const presentTypes = new Set<string>();
  for (const r of rows) {
    for (const s of r.segments) presentTypes.add(s.exposureType);
  }
  const keys = EXPOSURE_TYPE_ORDER.filter((k) => presentTypes.has(k)).map(
    (k) => ({
      key: k,
      label: EXPOSURE_TYPE_LABELS[k] ?? k,
      color: EXPOSURE_TYPE_COLORS[k] ?? "var(--muted-foreground)",
    }),
  );

  const points: StackedPoint[] = rows.map((r) => {
    const segByType = new Map(
      r.segments.map((s) => [s.exposureType, s.grossCr]),
    );
    const row: StackedPoint = { label: r.band };
    for (const k of keys) {
      row[k.key] = Number((segByType.get(k.key) ?? 0).toFixed(2));
    }
    return row;
  });

  return { points, keys };
}
