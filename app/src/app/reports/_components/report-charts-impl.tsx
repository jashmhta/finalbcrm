"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  CHART_AXIS_TICK,
  CHART_GRID_PROPS,
  CHART_SERIES,
  ChartAreaGradient,
  ChartTooltip,
} from "@/components/brand/chart-theme";
import { compactCr } from "@/features/reports/export";

/**
 * Report chart implementations - the recharts surfaces for the four detail
 * report pages. Each renders ONLY the chart (no Card shell, no header) sized
 * to fill its parent `ChartCard` body, so the report pages compose the
 * double-bezel + title/description around them. Brand theme constants are
 * reused from chart-theme so the grid/axis/series styling matches the
 * dashboard exactly (DESIGN_SYSTEM §11).
 *
 * Re-exported as lazy client-only dynamic imports by `./report-charts.tsx` so
 * recharts ships in a lazy chunk fetched after first paint instead of
 * bloating each report route's first-load JS - the same pattern as the
 * dashboard's `dashboard-charts.tsx` wrapper.
 */

// ---------------------------------------------------------------------------
// Shared point types (re-exported type-only by the wrapper so the server
// report pages keep typed prop plumbing without pulling recharts).
// ---------------------------------------------------------------------------

export interface LabelCountPoint {
  label: string;
  count: number;
}
export interface LabelValuePoint {
  label: string;
  value: number;
}
export interface ConsentStackPoint {
  label: string;
  active: number;
  withdrawn: number;
}

// ---------------------------------------------------------------------------
// Vertical bar - deal count by stage / KYC count by status / credit band.
// ---------------------------------------------------------------------------

const BAR_FILL_ID = (id: string) => `report-bar-${id}`;

function BarFillGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.95} />
      <stop offset="100%" stopColor={color} stopOpacity={0.55} />
    </linearGradient>
  );
}

/** Vertical bar chart of a count per category - pipeline stages, KYC status,
 *  credit bands. Optional per-bar color via `cellColors`. */
export function CountBarChart({
  data,
  height = 240,
  color = CHART_SERIES.gold,
  cellColors,
  valueLabel = "Count",
  compactValue,
}: {
  data: LabelCountPoint[];
  height?: number;
  color?: string;
  cellColors?: Record<string, string>;
  valueLabel?: string;
  compactValue?: (n: number) => string;
}) {
  const id = React.useId().replace(/[:]/g, "");
  const fillId = BAR_FILL_ID(id);
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: -16 }}>
          <defs>
            <BarFillGradient id={fillId} color={color} />
          </defs>
          <CartesianGrid {...CHART_GRID_PROPS} />
          <XAxis
            dataKey="label"
            tickMargin={10}
            minTickGap={12}
            tick={CHART_AXIS_TICK}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={data.length > 6 ? -25 : 0}
            textAnchor={data.length > 6 ? "end" : "middle"}
            height={data.length > 6 ? 50 : 30}
          />
          <YAxis
            width={40}
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
                labelMap={{ count: valueLabel }}
                formatValue={(v) => (compactValue ? compactValue(v) : v.toLocaleString("en-IN"))}
              />
            }
          />
          <Bar
            dataKey="count"
            fill={`url(#${fillId})`}
            stroke={color}
            strokeWidth={0}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
            radius={[3, 3, 0, 0]}
          >
            {cellColors
              ? data.map((d) => (
                  <Cell key={d.label} fill={cellColors[d.label] ?? color} />
                ))
              : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bar - deal count by type / revenue by RM / audit by operation.
// Long category labels read better on a horizontal axis.
// ---------------------------------------------------------------------------

export function HorizontalBarChart({
  data,
  height = 260,
  color = CHART_SERIES.gold,
  valueLabel = "Value",
  compactValue,
  compactMode = "count",
}: {
  data: LabelValuePoint[];
  height?: number;
  color?: string;
  valueLabel?: string;
  /** Function formatter - CLIENT callers only (server components cannot pass
   *  functions across the RSC boundary; use `compactMode` instead). */
  compactValue?: (n: number) => string;
  /** Serializable formatter selector for SERVER callers: "cr" = compact crore
   *  (₹XK Cr / ₹X.XX T), "count" = plain integer. Ignored when `compactValue`
   *  is provided. */
  compactMode?: "cr" | "count";
}) {
  const id = React.useId().replace(/[:]/g, "");
  const fillId = `report-hbar-${id}`;
  const fmt = compactValue ?? (compactMode === "cr" ? compactCr : (n: number) => n.toLocaleString("en-IN"));
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
        >
          <defs>
            <BarFillGradient id={fillId} color={color} />
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
            tick={CHART_AXIS_TICK}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "color-mix(in oklch, var(--foreground) 6%, transparent)" }}
            content={
              <ChartTooltip
                labelMap={{ value: valueLabel }}
                formatValue={(v) => fmt(v)}
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
// Area - exposure by stage / revenue by month. Soft gradient wash under the
// line, gold or emerald per the brand accent system.
// ---------------------------------------------------------------------------

export function AreaTrendChart({
  data,
  height = 240,
  color = "emerald",
  valueLabel = "Value",
  compactValue,
  compactMode = "cr",
}: {
  data: LabelValuePoint[];
  height?: number;
  color?: "emerald" | "gold";
  valueLabel?: string;
  /** Function formatter - CLIENT callers only (server components cannot pass
   *  functions across the RSC boundary; use `compactMode` instead). */
  compactValue?: (n: number) => string;
  /** Serializable formatter selector for SERVER callers: "cr" = compact crore
   *  (₹XK Cr / ₹X.XX T), "count" = plain integer. Ignored when `compactValue`
   *  is provided. Defaults to "cr" (the area chart surfaces exposure/revenue). */
  compactMode?: "cr" | "count";
}) {
  const id = React.useId().replace(/[:]/g, "");
  const areaId = `report-area-${id}`;
  const fmt = compactValue ?? (compactMode === "count" ? (n: number) => n.toLocaleString("en-IN") : compactCr);
  const stroke = color === "gold" ? CHART_SERIES.gold : CHART_SERIES.emerald;
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: -8 }}>
          <defs>
            <ChartAreaGradient id={areaId} color={color} opacity={0.18} />
          </defs>
          <CartesianGrid {...CHART_GRID_PROPS} />
          <XAxis
            dataKey="label"
            tickMargin={10}
            minTickGap={12}
            tick={CHART_AXIS_TICK}
            tickLine={false}
            axisLine={false}
            angle={data.length > 6 ? -25 : 0}
            textAnchor={data.length > 6 ? "end" : "middle"}
            height={data.length > 6 ? 50 : 30}
          />
          <YAxis
            width={52}
            tickMargin={6}
            tick={CHART_AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmt(v)}
          />
          <Tooltip
            cursor={{
              stroke: "color-mix(in oklch, var(--foreground) 12%, transparent)",
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
            content={
              <ChartTooltip
                labelMap={{ value: valueLabel }}
                formatValue={(v) => fmt(v)}
              />
            }
          />
          <Area
            dataKey="value"
            stroke={stroke}
            strokeWidth={2.25}
            fill={`url(#${areaId})`}
            isAnimationActive
            animationDuration={1000}
            animationEasing="ease-out"
            dot={false}
            activeDot={{ r: 3.5, fill: stroke, stroke: "var(--surface)", strokeWidth: 1.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stacked bar - consent active vs withdrawn by purpose.
// ---------------------------------------------------------------------------

export function StackedBarChart({
  data,
  height = 240,
  activeLabel = "Active",
  withdrawnLabel = "Withdrawn",
}: {
  data: ConsentStackPoint[];
  height?: number;
  activeLabel?: string;
  withdrawnLabel?: string;
}) {
  const id = React.useId().replace(/[:]/g, "");
  const activeId = `report-stack-active-${id}`;
  const withdrawnId = `report-stack-withdrawn-${id}`;
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: -16 }}>
          <defs>
            <BarFillGradient id={activeId} color={CHART_SERIES.emerald} />
            <BarFillGradient id={withdrawnId} color={CHART_SERIES.gold} />
          </defs>
          <CartesianGrid {...CHART_GRID_PROPS} />
          <XAxis
            dataKey="label"
            tickMargin={10}
            minTickGap={12}
            tick={CHART_AXIS_TICK}
            tickLine={false}
            axisLine={false}
            angle={data.length > 5 ? -25 : 0}
            textAnchor={data.length > 5 ? "end" : "middle"}
            height={data.length > 5 ? 54 : 30}
          />
          <YAxis
            width={40}
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
                labelMap={{ active: activeLabel, withdrawn: withdrawnLabel }}
                formatValue={(v) => v.toLocaleString("en-IN")}
              />
            }
          />
          <Bar
            dataKey="active"
            stackId="consent"
            fill={`url(#${activeId})`}
            stroke={CHART_SERIES.emerald}
            strokeWidth={0}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="withdrawn"
            stackId="consent"
            fill={`url(#${withdrawnId})`}
            stroke={CHART_SERIES.gold}
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
