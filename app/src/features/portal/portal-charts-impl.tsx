"use client";

// Portal chart implementations - the recharts surfaces for the read-only
// investor portal (donut by sector/rating/tenor, horizontal bar by issuer).
// Each renders ONLY the chart (no Card shell / header) sized to fill its
// parent ChartCard body. Brand theme constants are reused from
// @/components/brand/chart-theme so grid/axis/series styling matches the
// dashboard + portfolio + reports exactly (DESIGN_SYSTEM §11).
//
// Lazy-loaded via ./portal-charts.tsx (next/dynamic, ssr:false) so recharts
// ships in a lazy chunk fetched after first paint - the same pattern as the
// portfolio + reports chart wrappers. The data-prop TYPES are re-exported
// type-only by the wrapper so the server pages keep typed prop plumbing
// without ever pulling recharts into the server bundle.

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
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
  /** Optional secondary line for tooltip annotation. */
  hint?: string;
}

// ---------------------------------------------------------------------------
// Color palette - sector / rating-tier / tenor series. Brand CSS vars so the
// palette flips with dark/light mode (mirrors portfolio-charts-impl).
// ---------------------------------------------------------------------------

export const PORTAL_PALETTE = [
  "var(--gold)",
  "var(--emerald)",
  "var(--info)",
  "var(--gold-deep)",
  "var(--emerald-deep)",
  "var(--muted-foreground)",
] as const;

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
// Donut - portfolio by sector / rating / tenor. Center label reads the total.
// ---------------------------------------------------------------------------

export function PortalDonutChart({
  data,
  height = 280,
  compactValue,
  centerLabel = "Total",
}: {
  data: DonutPoint[];
  height?: number;
  compactValue?: (n: number) => string;
  centerLabel?: string;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const fmt =
    compactValue ?? ((n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 }));
  const centerValue = compactValue
    ? compactValue(total)
    : total.toLocaleString("en-IN", { maximumFractionDigits: 0 });

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
                fill={PORTAL_PALETTE[i % PORTAL_PALETTE.length]}
              />
            ))}
            <Label
              position="center"
              content={
                <DonutCenter
                  label={centerLabel}
                  value={centerValue}
                />
              }
            />
          </Pie>
          <Tooltip
            content={
              <ChartTooltip
                labelMap={{ value: centerLabel }}
                formatValue={(v) => fmt(Number(v))}
              />
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function DonutCenter({
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
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        className="fill-foreground"
        style={{
          fontSize: 18,
          fontWeight: 500,
          fontFamily: "var(--font-mono)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bar - top issuers (the investor's concentration by name).
// ---------------------------------------------------------------------------

export function PortalHBarChart({
  data,
  height = 280,
  color = CHART_SERIES.gold,
  valueLabel = "Holding",
  compactValue,
}: {
  data: LabelValuePoint[];
  height?: number;
  color?: string;
  valueLabel?: string;
  compactValue?: (n: number) => string;
}) {
  const id = React.useId().replace(/[:]/g, "");
  const fillId = `portal-hbar-${id}`;
  const fmt =
    compactValue ?? ((n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 }));
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
          <CartesianGrid {...CHART_GRID_PROPS} horizontal={false} vertical />
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
            width={140}
            tickMargin={8}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11.5 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{
              fill: "color-mix(in oklch, var(--foreground) 6%, transparent)",
            }}
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

// ---------------------------------------------------------------------------
// Vertical bar - portfolio by rating band / tenor bucket.
// ---------------------------------------------------------------------------

export function PortalVBarChart({
  data,
  height = 260,
  color = CHART_SERIES.emerald,
  valueLabel = "Holding",
  compactValue,
}: {
  data: LabelValuePoint[];
  height?: number;
  color?: string;
  valueLabel?: string;
  compactValue?: (n: number) => string;
}) {
  const id = React.useId().replace(/[:]/g, "");
  const fillId = `portal-vbar-${id}`;
  const fmt =
    compactValue ?? ((n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 }));
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: -8 }}>
          <defs>
            <BarFillGradient id={fillId} color={color} />
          </defs>
          <CartesianGrid {...CHART_GRID_PROPS} />
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
            cursor={{
              fill: "color-mix(in oklch, var(--foreground) 6%, transparent)",
            }}
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
