"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Card, CardTitle, CardDescription } from "@/components/brand/card";

/**
 * Brand chart theme - the single source of truth for recharts styling across
 * the CRM. Ships:
 *   - reusable constants (grid stroke, axis tick, stroke width, easing, cursor)
 *   - `<ChartAreaGradient>` / `<ChartStrokeGradient>` defs (emerald/gold
 *     vertical area fills at fill-opacity 0.15 + a gold→amber stroke)
 *   - `<ChartTooltip>` - the double-bezel tooltip pill (machined shell + core,
 *     mono numbers, no default recharts chrome)
 *   - `<ChartCard>` - a Card wrapper with a header slot + ambient halo opt-in
 *
 * Discipline (DESIGN_SYSTEM §11): no default gridlines/colors, hairline dashed
 * grid (foreground 10%), thicker 2–2.5px series strokes, emerald (green data
 * series) + gold (primary accent) series, soft gradient area fills, mono axis
 * labels, animated draw-in on mount, tooltips = double-bezel pill with mono
 * numbers.
 */

/** Hairline grid color - foreground @ 10% (dashed, never solid gridlines). */
export const CHART_GRID_STROKE =
  "color-mix(in oklch, var(--foreground) 10%, transparent)";

/** Mono axis tick - Geist Mono, muted, 11px. */
export const CHART_AXIS_TICK = {
  fill: "var(--muted-foreground)",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
} as const;

/** Default series stroke width - thicker (2.25px) so lines read as drawn. */
export const CHART_STROKE_WIDTH = 2.25;

/** The one easing curve - never linear / ease-in-out. */
export const CHART_EASE = [0.32, 0.72, 0, 1] as const;

/** CartesianGrid preset - hairline dashed, horizontal only. */
export const CHART_GRID_PROPS = {
  stroke: CHART_GRID_STROKE,
  strokeDasharray: "3 6",
  vertical: false,
} as const;

/** XAxis preset - mono tick, no axis line / tick line. */
export const CHART_XAXIS_PROPS = {
  tick: CHART_AXIS_TICK,
  tickLine: false,
  axisLine: false,
  dy: 8,
} as const;

/** YAxis preset - mono tick, no axis line / tick line. */
export const CHART_YAXIS_PROPS = {
  tick: CHART_AXIS_TICK,
  tickLine: false,
  axisLine: false,
  width: 42,
} as const;

/** Tooltip cursor - hairline dashed vertical guide, no heavy chrome. */
export const CHART_CURSOR = {
  stroke: CHART_GRID_STROKE,
  strokeWidth: 1,
  strokeDasharray: "4 4",
} as const;

/** Series color presets - emerald (green data series), gold (signature /
 *  primary accent), info tertiary. The emerald series stays green so the
 *  dashboard exposure chart keeps its two-series distinction (mandates vs
 *  credit exposure); gold is the brand accent. */
export const CHART_SERIES = {
  emerald: "var(--emerald)",
  gold: "var(--gold)",
  info: "var(--info)",
  emeraldDeep: "var(--emerald-deep)",
  goldDeep: "var(--gold-deep)",
} as const;

/** Active-dot presets - a small filled disc with a surface-colored halo. */
export const CHART_ACTIVE_DOT = {
  emerald: { r: 3.5, fill: "var(--emerald)", stroke: "var(--surface)", strokeWidth: 1.5 },
  gold: { r: 3, fill: "var(--gold)", stroke: "var(--surface)", strokeWidth: 1.5 },
} as const;

type ChartColor = "emerald" | "gold" | "info";

function resolveColor(color: ChartColor | string): string {
  if (color === "emerald") return CHART_SERIES.emerald;
  if (color === "gold") return CHART_SERIES.gold;
  if (color === "info") return CHART_SERIES.info;
  return color;
}

/**
 * Vertical area-fill gradient - the soft emerald/gold wash under a series.
 * Top stop at `opacity` (0.15 by default per spec), fading through a mid
 * stop to fully transparent at the baseline so the fill reads as a lit
 * wash, not a flat block. Drop inside recharts `<defs>`.
 */
export function ChartAreaGradient({
  id,
  color = "emerald",
  opacity = 0.15,
}: {
  id: string;
  color?: ChartColor | string;
  opacity?: number;
}) {
  const c = resolveColor(color);
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={c} stopOpacity={opacity} />
      <stop offset="55%" stopColor={c} stopOpacity={opacity * 0.45} />
      <stop offset="100%" stopColor={c} stopOpacity={0} />
    </linearGradient>
  );
}

/**
 * Horizontal stroke gradient - gold → amber (gold-deep), for the single hero
 * series that bridges the brand (gold is the primary accent). Drop inside
 * recharts `<defs>` and reference via `stroke="url(#id)"`.
 */
export function ChartStrokeGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor={CHART_SERIES.gold} />
      <stop offset="100%" stopColor={CHART_SERIES.goldDeep} />
    </linearGradient>
  );
}

export interface ChartTooltipProps {
  /** Injected by recharts. */
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string;
    dataKey?: string | number;
    value?: number | string | Array<number | string>;
    color?: string;
  }>;
  label?: string | number;
  /** Override the eyebrow title (defaults to the recharts `label`). */
  title?: React.ReactNode;
  /** Map a dataKey → display label for the row. */
  labelMap?: Record<string, React.ReactNode>;
  /** Format the row value (e.g. ₹ Cr, %, basis points). */
  formatValue?: (value: number, dataKey: string) => React.ReactNode;
  className?: string;
}

/**
 * ChartTooltip - the double-bezel tooltip pill. Machined shell
 * (bg-foreground/[0.055] + ring-hairline + shadow-floating) wrapping a raised
 * core (bg-surface + ring-foreground/[0.08] + inset-hi), with mono tabular
 * numbers and a colored disc per series. No default recharts chrome.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  title,
  labelMap,
  formatValue,
  className,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className={cn(
        "rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline shadow-floating",
        className,
      )}
    >
      <div className="rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface px-3.5 py-2.5 ring-1 ring-inset ring-foreground/[0.08] shadow-[var(--shadow-inset-hi)]">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {title ?? label}
        </div>
        <div className="flex flex-col gap-1.5">
          {payload.map((p, i) => {
            const key = String(p.dataKey ?? p.name ?? i);
            const rowLabel = labelMap?.[key] ?? p.name ?? key;
            const raw = Array.isArray(p.value) ? p.value[0] : p.value;
            const numeric = Number(raw ?? 0);
            const value = formatValue
              ? formatValue(numeric, key)
              : numeric.toLocaleString("en-IN", { maximumFractionDigits: 2 });
            return (
              <div
                key={key + i}
                className="flex items-center justify-between gap-6"
              >
                <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: p.color }}
                  />
                  {rowLabel}
                </span>
                <span className="nums text-[13px] font-medium tabular-nums text-foreground">
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * ChartCard - a double-bezel Card with a header (title + description + action
 * slot) and a chart body. `ambient` adds the faint emerald/gold halo behind
 * hero charts so they read as lit objects. The body is a relative container
 * so absolutely-positioned legends / overlays compose cleanly.
 */
export function ChartCard({
  title,
  description,
  action,
  ambient,
  bodyClassName,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  ambient?: "emerald" | "gold";
  bodyClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("h-full", className)}>
      {title || action ? (
        <div className="flex flex-col gap-1 px-5 pt-5 md:flex-row md:items-end md:justify-between md:gap-4 md:px-6 md:pt-6">
          <div className="flex flex-col gap-1">
            {title ? (
              <CardTitle className="text-[13px] font-semibold tracking-wide text-muted-foreground">
                {title}
              </CardTitle>
            ) : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn("relative h-full w-full", bodyClassName)}>{children}</div>
    </Card>
  );
}
