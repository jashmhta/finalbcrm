"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  CHART_AXIS_TICK,
  CHART_GRID_PROPS,
  CHART_SERIES,
  ChartTooltip,
} from "@/components/brand/chart-theme";

/**
 * Portfolio chart implementations - the recharts surfaces for the four
 * portfolio pages (donut, horizontal bar, stacked bar, tenor distribution,
 * radial utilization gauge, DV01-by-tenor bar). Each renders ONLY the chart
 * (no Card shell / header) sized to fill its parent `ChartCard` body, so the
 * pages compose the double-bezel + title/description around them. Brand theme
 * constants are reused from chart-theme so grid/axis/series styling matches
 * the dashboard + reports exactly (DESIGN_SYSTEM §11).
 *
 * Re-exported as lazy client-only dynamic imports by `./portfolio-charts.tsx`
 * so recharts ships in a lazy chunk fetched after first paint (the same
 * pattern as reports' report-charts.tsx wrapper). The data-prop TYPES are
 * re-exported type-only by the wrapper so the server pages keep typed prop
 * plumbing without ever pulling recharts into the server bundle.
 */

// ---------------------------------------------------------------------------
// Shared point types (re-exported type-only by the wrapper).
// ---------------------------------------------------------------------------

export interface DonutPoint {
  label: string;
  value: number;
}
export interface LabelValuePoint {
  label: string;
  value: number;
  /** Optional secondary line for tooltip / annotation. */
  hint?: string;
}
export interface StackedPoint {
  label: string;
  [seriesKey: string]: number | string;
}
export interface GaugePoint {
  /** Utilization % (0–150+; >100 = breach). */
  value: number;
  /** Display label for the gauge center. */
  label: string;
}

// ---------------------------------------------------------------------------
// Color palette - sector / rating-tier / exposure-type series. Brand CSS vars
// so the palette flips with dark/light mode.
// ---------------------------------------------------------------------------

export const SECTOR_PALETTE = [
  "var(--emerald)",
  "var(--gold)",
  "var(--info)",
  "var(--emerald-deep)",
  "var(--gold-deep)",
  "var(--muted-foreground)",
] as const;

export const EXPOSURE_TYPE_COLORS: Record<string, string> = {
  underwriting_unsold: "var(--gold)",
  secondary_inventory: "var(--emerald)",
  portfolio_holding: "var(--emerald-deep)",
  advisory_fee_at_risk: "var(--info)",
  settlement_counterparty: "var(--gold-deep)",
  repo: "var(--muted-foreground)",
};

export const EXPOSURE_TYPE_LABELS: Record<string, string> = {
  underwriting_unsold: "Underwriting unsold",
  secondary_inventory: "Secondary inventory",
  portfolio_holding: "Portfolio holding",
  advisory_fee_at_risk: "Advisory fee at risk",
  settlement_counterparty: "Settlement counterparty",
  repo: "Repo",
};

function BarFillGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.95} />
      <stop offset="100%" stopColor={color} stopOpacity={0.5} />
    </linearGradient>
  );
}

function HBarFillGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor={color} stopOpacity={0.5} />
      <stop offset="100%" stopColor={color} stopOpacity={0.95} />
    </linearGradient>
  );
}

// ---------------------------------------------------------------------------
// Donut - exposure by sector.
// ---------------------------------------------------------------------------

export function DonutChart({
  data,
  height = 260,
  compactValue,
  centerLabel = "Total",
}: {
  data: DonutPoint[];
  height?: number;
  compactValue?: (n: number) => string;
  centerLabel?: string;
}) {
  const id = React.useId().replace(/[:]/g, "");
  const total = data.reduce((a, d) => a + d.value, 0);
  const fmt = compactValue ?? ((n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 }));
  const centerValue = compactValue ? compactValue(total) : total.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={1.5}
            stroke="var(--surface)"
            strokeWidth={2}
            isAnimationActive
            animationDuration={950}
            animationEasing="ease-out"
          >
            {data.map((d, i) => (
              <Cell
                key={d.label}
                fill={SECTOR_PALETTE[i % SECTOR_PALETTE.length]}
              />
            ))}
            <Label
              position="center"
              content={
                <CenterLabel
                  label={centerLabel}
                  value={centerValue}
                />
              }
            />
          </Pie>
          <Tooltip
            content={
              <ChartTooltip
                labelMap={{ value: "Exposure" }}
                formatValue={(v) => fmt(Number(v))}
              />
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function CenterLabel({
  label,
  value,
  viewBox,
}: {
  label: string;
  value: string;
  viewBox?: { cx?: number; cy?: number };
}) {
  const cx = viewBox?.cx ?? 0;
  const cy = viewBox?.cy ?? 0;
  return (
    <g>
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        className="fill-muted-foreground"
        style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}
      >
        {label}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontSize: 18, fontWeight: 500, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bar - top issuers.
// ---------------------------------------------------------------------------

export function HBarChart({
  data,
  height = 260,
  color = CHART_SERIES.gold,
  valueLabel = "Exposure",
  compactValue,
}: {
  data: LabelValuePoint[];
  height?: number;
  color?: string;
  valueLabel?: string;
  compactValue?: (n: number) => string;
}) {
  const id = React.useId().replace(/[:]/g, "");
  const fillId = `pf-hbar-${id}`;
  const fmt = compactValue ?? ((n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 }));
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
        >
          <defs>
            <HBarFillGradient id={fillId} color={color} />
          </defs>
          <CartesianGridHairline />
          <XAxis
            type="number"
            tickMargin={8}
            tick={CHART_AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmt(v)}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tickMargin={8}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11.5 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "color-mix(in oklch, var(--foreground) 6%, transparent)" }}
            content={
              <ChartTooltip
                labelMap={{ value: valueLabel }}
                formatValue={(v) => fmt(Number(v))}
              />
            }
          />
          <Bar
            dataKey="value"
            fill={`url(#${fillId})`}
            stroke={color}
            strokeWidth={0}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
            radius={[0, 3, 3, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Hairline grid for horizontal layouts (vertical gridlines, no horizontal). */
function CartesianGridHairline() {
  return (
    <CartesianGrid
      {...CHART_GRID_PROPS}
      horizontal={false}
      vertical
    />
  );
}

// ---------------------------------------------------------------------------
// Stacked bar - exposure by rating band, segments = exposure types.
// ---------------------------------------------------------------------------

export function StackedBarChart({
  data,
  keys,
  height = 280,
  compactValue,
}: {
  data: StackedPoint[];
  /** Ordered series keys to stack. */
  keys: { key: string; label: string; color: string }[];
  height?: number;
  compactValue?: (n: number) => string;
}) {
  const fmt = compactValue ?? ((n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 }));
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: -8 }}>
          <GridH />
          <XAxis
            dataKey="label"
            tickMargin={10}
            minTickGap={8}
            tick={CHART_AXIS_TICK}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={data.length > 7 ? -20 : 0}
            textAnchor={data.length > 7 ? "end" : "middle"}
            height={data.length > 7 ? 48 : 30}
          />
          <YAxis
            width={44}
            tickMargin={6}
            tick={CHART_AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmt(v)}
          />
          <Tooltip
            cursor={{ fill: "color-mix(in oklch, var(--foreground) 6%, transparent)" }}
            content={
              <ChartTooltip
                labelMap={Object.fromEntries(keys.map((k) => [k.key, k.label]))}
                formatValue={(v) => fmt(Number(v))}
              />
            }
          />
          {keys.map((k) => (
            <Bar
              key={k.key}
              dataKey={k.key}
              stackId="exposure"
              fill={k.color}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal-only hairline grid for vertical bar charts. */
function GridH() {
  return <CartesianGrid {...CHART_GRID_PROPS} />;
}

// ---------------------------------------------------------------------------
// Vertical bar - tenor distribution + DV01 by tenor.
// ---------------------------------------------------------------------------

export function VBarChart({
  data,
  height = 240,
  color = CHART_SERIES.emerald,
  valueLabel = "Exposure",
  compactValue,
}: {
  data: LabelValuePoint[];
  height?: number;
  color?: string;
  valueLabel?: string;
  compactValue?: (n: number) => string;
}) {
  const id = React.useId().replace(/[:]/g, "");
  const fillId = `pf-vbar-${id}`;
  const fmt = compactValue ?? ((n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 }));
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: -8 }}>
          <defs>
            <BarFillGradient id={fillId} color={color} />
          </defs>
          <GridH />
          <XAxis
            dataKey="label"
            tickMargin={10}
            minTickGap={8}
            tick={CHART_AXIS_TICK}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            width={44}
            tickMargin={6}
            tick={CHART_AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmt(v)}
          />
          <Tooltip
            cursor={{ fill: "color-mix(in oklch, var(--foreground) 6%, transparent)" }}
            content={
              <ChartTooltip
                labelMap={{ value: valueLabel }}
                formatValue={(v) => fmt(Number(v))}
              />
            }
          />
          <Bar
            dataKey="value"
            fill={`url(#${fillId})`}
            stroke={color}
            strokeWidth={0}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radial gauge - limit utilization %.
// ---------------------------------------------------------------------------

export function RadialGauge({
  data,
  height = 200,
  label,
}: {
  data: GaugePoint;
  height?: number;
  label?: string;
}) {
  const value = Math.max(0, Math.min(150, data.value));
  const breached = data.value > 100;
  const trackColor = breached ? "var(--down)" : data.value > 80 ? "var(--gold)" : "var(--emerald)";
  // RadialBarChart uses a 0–100 domain by default; cap the arc at 100 so a
  // breached (>100%) gauge still draws a full ring, with the numeric value
  // (which can exceed 100) shown in the center.
  const arcValue = Math.min(100, value);
  const ring = [
    { name: data.label, value: arcValue, fill: trackColor },
  ];
  return (
    <div className="relative w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="68%"
          outerRadius="100%"
          data={ring}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            background={{ fill: "color-mix(in oklch, var(--foreground) 6%, transparent)" }}
            dataKey="value"
            cornerRadius={10}
            isAnimationActive
            animationDuration={950}
            animationEasing="ease-out"
          />
          <Label
            position="center"
            content={
              <GaugeCenter
                value={data.value}
                label={label ?? data.label}
                breached={breached}
              />
            }
          />
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GaugeCenter({
  value,
  label,
  breached,
  viewBox,
}: {
  value: number;
  label: string;
  breached: boolean;
  viewBox?: { cx?: number; cy?: number };
}) {
  const cx = viewBox?.cx ?? 0;
  const cy = viewBox?.cy ?? 0;
  return (
    <g>
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        className={breached ? "fill-down" : "fill-foreground"}
        style={{ fontSize: 22, fontWeight: 500, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}
      >
        {value.toFixed(1)}%
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        className="fill-muted-foreground"
        style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 500 }}
      >
        {label}
      </text>
    </g>
  );
}
