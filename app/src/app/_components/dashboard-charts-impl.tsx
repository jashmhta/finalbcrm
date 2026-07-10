"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { compactINR } from "@/components/brand/money";
import { Eyebrow } from "@/components/brand/text";
// The amplified brand chart theme - single source of truth for recharts
// styling. Composed here the same way the hero exposure chart composes it
// (hairline grid, mono ticks, gradient fills, double-bezel tooltip) so the
// five new dashboard visualizations read as one family with the centerpiece.
import {
  CHART_AXIS_TICK,
  CHART_GRID_PROPS,
  CHART_SERIES,
  ChartTooltip,
} from "@/components/brand/chart-theme";

/**
 * Dashboard visualization suite - five brand-themed recharts surfaces added to
 * the command center alongside the hero exposure chart:
 *   1. DealVelocityChart - bars of deals closed per month (last 12 months)
 *   2. SectorDonut       - exposure by top-level sector
 *   3. CreditScoreChart  - internal credit-score distribution (BC-1 … BC-6)
 *   4. KycStatusChart    - KYC status breakdown (donut)
 *   5. InvestorTypeChart - investor type breakdown (donut)
 *
 * All props are serializable (data arrays + scalars) - no function props - so
 * the server page can pass them straight through the dynamic-import wrapper
 * (ssr:false) into these client-only impls. recharts ships in the SAME lazy
 * chunk as the hero exposure chart's module family (all dashboard charts
 * dynamic-import recharts, so the bundler splits it into one shared vendor
 * chunk fetched after first paint), keeping the `/` route's first-load JS lean.
 *
 * Do NOT import this module from a server component or shared layout - it
 * pulls recharts. Use the dynamic-import wrappers in `dashboard-charts.tsx`.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const intFmt = (n: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
    : "-";

/** On-brand donut slice palette - gold, emerald, info, up, then deep tints,
 *  with a muted neutral reserved for the trailing "Other" slice. Stays within
 *  the brand token family (no off-palette colors) per DESIGN_SYSTEM §11. */
const DONUT_COLORS = [
  "var(--gold)",
  "var(--emerald)",
  "var(--info)",
  "var(--up)",
  "var(--gold-deep)",
  "var(--emerald-deep)",
  "var(--down)",
  "color-mix(in oklch, var(--foreground) 32%, transparent)",
] as const;

/** Credit-band → quality color. BC-1 (best) reads emerald, transitioning
 *  through gold (mid-grade) to down/red (BC-6, distressed) - so the bar
 *  colors themselves encode credit quality, not just magnitude. */
const BAND_COLORS: Record<string, string> = {
  "BC-1": "var(--emerald)",
  "BC-2": "color-mix(in oklch, var(--emerald) 78%, var(--gold))",
  "BC-3": "var(--gold)",
  "BC-4": "var(--gold-deep)",
  "BC-5": "color-mix(in oklch, var(--down) 58%, var(--gold-deep))",
  "BC-6": "var(--down)",
};

/** A vertical bar-fill gradient - top stop at full color fading to a deeper
 *  base so bars read as lit columns, not flat blocks (DESIGN_SYSTEM §11). */
function BarFillGradient({
  id,
  color,
}: {
  id: string;
  color: string;
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.95} />
      <stop offset="100%" stopColor={color} stopOpacity={0.55} />
    </linearGradient>
  );
}

/** Chart header band - Eyebrow + title + optional right-aligned scalar read.
 *  Matches the hero exposure chart's header rhythm so every dashboard card
 *  reads as one family. */
function ChartHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 pt-5 md:flex-row md:items-start md:justify-between md:px-6 md:pt-6">
      <div className="flex flex-col gap-1.5">
        <Eyebrow dot>{eyebrow}</Eyebrow>
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </h3>
      </div>
      {right ? (
        <div className="md:mt-1.5 flex items-baseline gap-1.5">
          {right}
        </div>
      ) : null}
    </div>
  );
}

/** Donut center label - absolutely positioned over the Pie so the total reads
 *  inside the ring (the "instrument" readout). Mono tabular-nums. */
function DonutCenter({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
    >
      <span className="nums text-[1.35rem] font-medium leading-none tabular-nums tracking-[-0.01em] text-foreground">
        {value}
      </span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

/** Custom donut legend - a calm two-column list of color dot + label + value.
 *  Replaces recharts' default <Legend> (which renders a flat centered row that
 *  breaks on long labels and ignores the brand type system). */
function DonutLegend({
  data,
  formatValue,
}: {
  data: { label: string; value: number }[];
  formatValue: (n: number) => string;
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-5 pb-5 pt-3 md:px-6">
      {data.map((d, i) => (
        <li
          key={d.label}
          className="flex items-center justify-between gap-2 text-[11.5px]"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="truncate">{d.label}</span>
          </span>
          <span className="nums shrink-0 tabular-nums font-medium text-foreground/85">
            {formatValue(d.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// 1. Deal velocity - bars of deals closed per month (last 12 months)
// ---------------------------------------------------------------------------

export interface DealVelocityPoint {
  /** Short month label, e.g. "Jan". */
  label: string;
  /** ISO month, e.g. "2025-01". */
  key: string;
  /** Deals closed (settled/closed) that month by actual_close_date. */
  closed: number;
}

export function DealVelocityChart({ data }: { data: DealVelocityPoint[] }) {
  const id = React.useId().replace(/[:]/g, "");
  const fillId = `velocity-fill-${id}`;
  const total = data.reduce((acc, p) => acc + p.closed, 0);

  return (
    <div className="flex h-full flex-col">
      <ChartHeader
        eyebrow="Deal velocity · last 12 months"
        title="Mandates closed"
        right={
          <>
            <span className="nums text-[1.15rem] font-medium leading-none tabular-nums text-gold">
              {intFmt(total)}
            </span>
            <span className="text-[12px] text-muted-foreground">closed</span>
          </>
        }
      />
      <div className="relative flex-1 px-2.5 pb-3 pt-2 md:px-1.5">
        <div className="h-[220px] w-full md:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 12, bottom: 4, left: -12 }}
            >
              <defs>
                <BarFillGradient id={fillId} color={CHART_SERIES.emerald} />
              </defs>
              {/* Hairline grid - horizontal only, dashed (brand preset). */}
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis
                dataKey="label"
                tickMargin={10}
                minTickGap={16}
                tick={CHART_AXIS_TICK}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                width={28}
                tickMargin={6}
                allowDecimals={false}
                tick={CHART_AXIS_TICK}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "color-mix(in oklch, var(--foreground) 6%, transparent)" }}
                content={
                  <ChartTooltip
                    labelMap={{ closed: "Closed" }}
                    formatValue={(v) => intFmt(v)}
                  />
                }
              />
              <Bar
                dataKey="closed"
                fill={`url(#${fillId})`}
                stroke={CHART_SERIES.emerald}
                strokeWidth={0}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Sector exposure donut
// ---------------------------------------------------------------------------

export interface SectorSlice {
  label: string;
  /** Sum of deal target_size for issuers in this sector family (INR). */
  value: number;
}

export function SectorDonut({ data }: { data: SectorSlice[] }) {
  const total = data.reduce((acc, s) => acc + s.value, 0);
  const hasData = data.length > 0 && total > 0;

  return (
    <div className="flex h-full flex-col">
      <ChartHeader
        eyebrow="Sector exposure"
        title="By issuer sector"
      />
      <div className="relative flex-1 px-2 pb-1">
        <div className="relative h-[180px] w-full md:h-[200px]">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={
                    <ChartTooltip
                      labelMap={{ value: "Exposure" }}
                      formatValue={(v) => compactINR(v)}
                    />
                  }
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={1.5}
                  stroke="var(--surface)"
                  strokeWidth={1.5}
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                >
                  {data.map((_, i) => (
                    <Cell
                      key={i}
                      fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : null}
          {hasData ? <DonutCenter label="Exposure" value={compactINR(total)} /> : null}
        </div>
      </div>
      {hasData ? (
        <DonutLegend data={data} formatValue={(v) => compactINR(v)} />
      ) : (
        <EmptyChartHint hint="No sector exposure booked yet." />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Credit score distribution (BC-1 … BC-6)
// ---------------------------------------------------------------------------

export interface CreditBandSlice {
  band: string;
  count: number;
}

const ALL_BANDS = ["BC-1", "BC-2", "BC-3", "BC-4", "BC-5", "BC-6"] as const;

export function CreditScoreChart({ data }: { data: CreditBandSlice[] }) {
  // Fill a stable BC-1 … BC-6 order, zero for bands with no analyses, so the
  // chart always reads as the full rating ladder (not a sparse set of bars).
  const byBand = new Map(data.map((d) => [d.band, d.count] as const));
  const ordered = ALL_BANDS.map((b) => ({
    band: b,
    count: byBand.get(b) ?? 0,
  }));
  const total = ordered.reduce((acc, d) => acc + d.count, 0);
  const hasData = total > 0;

  return (
    <div className="flex h-full flex-col">
      <ChartHeader
        eyebrow="Credit scores"
        title="Internal rating distribution"
        right={
          <>
            <span className="nums text-[1.15rem] font-medium leading-none tabular-nums text-foreground">
              {intFmt(total)}
            </span>
            <span className="text-[12px] text-muted-foreground">analyses</span>
          </>
        }
      />
      <div className="relative flex-1 px-2.5 pb-3 pt-2 md:px-1.5">
        <div className="h-[220px] w-full md:h-[250px]">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ordered}
                margin={{ top: 10, right: 12, bottom: 4, left: -14 }}
              >
                <CartesianGrid {...CHART_GRID_PROPS} />
                <XAxis
                  dataKey="band"
                  tickMargin={10}
                  tick={CHART_AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  width={26}
                  tickMargin={6}
                  allowDecimals={false}
                  tick={CHART_AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "color-mix(in oklch, var(--foreground) 6%, transparent)" }}
                  content={
                    <ChartTooltip
                      labelMap={{ count: "Analyses" }}
                      formatValue={(v) => intFmt(v)}
                    />
                  }
                />
                <Bar
                  dataKey="count"
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                  radius={[3, 3, 0, 0]}
                >
                  {ordered.map((d) => (
                    <Cell
                      key={d.band}
                      fill={BAND_COLORS[d.band] ?? "var(--emerald)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </div>
      {hasData ? null : <EmptyChartHint hint="No credit analyses scored yet." />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. KYC status breakdown (donut)
// ---------------------------------------------------------------------------

export interface KycStatusSlice {
  /** Enum status, e.g. "approved". */
  status: string;
  /** Human label, e.g. "Approved". */
  label: string;
  count: number;
}

export function KycStatusChart({ data }: { data: KycStatusSlice[] }) {
  const total = data.reduce((acc, s) => acc + s.count, 0);
  const hasData = data.length > 0 && total > 0;
  // Donut expects { label, value }; map count → value.
  const donutData = data.map((s) => ({ label: s.label, value: s.count }));

  return (
    <div className="flex h-full flex-col">
      <ChartHeader eyebrow="KYC status" title="Verification breakdown" />
      <div className="relative flex-1 px-2 pb-1">
        <div className="relative h-[180px] w-full md:h-[200px]">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={
                    <ChartTooltip
                      labelMap={{ value: "Parties" }}
                      formatValue={(v) => intFmt(v)}
                    />
                  }
                />
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={1.5}
                  stroke="var(--surface)"
                  strokeWidth={1.5}
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                >
                  {donutData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : null}
          {hasData ? <DonutCenter label="KYC records" value={intFmt(total)} /> : null}
        </div>
      </div>
      {hasData ? (
        <DonutLegend data={donutData} formatValue={(v) => intFmt(v)} />
      ) : (
        <EmptyChartHint hint="No KYC records yet." />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Investor type breakdown (donut)
// ---------------------------------------------------------------------------

export interface InvestorTypeSlice {
  label: string;
  count: number;
}

export function InvestorTypeChart({ data }: { data: InvestorTypeSlice[] }) {
  const total = data.reduce((acc, s) => acc + s.count, 0);
  const hasData = data.length > 0 && total > 0;
  // Map { label, count } → { label, value } so the Pie + legend share one
  // dataKey ("value") and the DonutLegend's { label, value } shape is satisfied.
  const donutData = data.map((s) => ({ label: s.label, value: s.count }));

  return (
    <div className="flex h-full flex-col">
      <ChartHeader eyebrow="Investor types" title="By mandate type" />
      <div className="relative flex-1 px-2 pb-1">
        <div className="relative h-[180px] w-full md:h-[200px]">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={
                    <ChartTooltip
                      labelMap={{ value: "Investors" }}
                      formatValue={(v) => intFmt(v)}
                    />
                  }
                />
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={1.5}
                  stroke="var(--surface)"
                  strokeWidth={1.5}
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                >
                  {donutData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : null}
          {hasData ? <DonutCenter label="Investors" value={intFmt(total)} /> : null}
        </div>
      </div>
      {hasData ? (
        <DonutLegend data={donutData} formatValue={(v) => intFmt(v)} />
      ) : (
        <EmptyChartHint hint="No investors typed yet." />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared empty hint - Fraunces one-liner (DESIGN_SYSTEM §6 empty states),
// never a generic "No data."
// ---------------------------------------------------------------------------

function EmptyChartHint({ hint }: { hint: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 pb-6">
      <p className="text-[14px] font-light italic text-muted-foreground/80">
        {hint}
      </p>
    </div>
  );
}
