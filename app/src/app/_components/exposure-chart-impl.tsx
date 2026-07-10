"use client";

import * as React from "react";
import { animate, useInView } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { compactINR } from "@/components/brand/money";
import { Eyebrow } from "@/components/brand/text";
// The amplified brand chart theme - single source of truth for recharts
// styling. We compose the hero chart from its presets (hairline grid, mono
// ticks, thicker strokes, gradient area fills, double-bezel tooltip) instead
// of re-deriving styles here. See src/components/brand/chart-theme.tsx.
import {
  CHART_ACTIVE_DOT,
  CHART_AXIS_TICK,
  CHART_CURSOR,
  CHART_EASE,
  CHART_GRID_PROPS,
  CHART_SERIES,
  CHART_STROKE_WIDTH,
  ChartAreaGradient,
  ChartTooltip,
} from "@/components/brand/chart-theme";

/**
 * Hero exposure/league chart - the dashboard's LARGE full-width centerpiece.
 *
 * Composed from the brand chart-theme presets:
 *  - hairline dashed grid (foreground @ 10%)
 *  - emerald exposure area with a soft vertical gradient fill (amplified so
 *    the wash reads as a lit field, not a flat tint) + a 2.5px stroke
 *  - gold deal-count area on a secondary right axis (the secondary series)
 *  - a dashed emerald "Avg" benchmark line (mean monthly exposure across the
 *    window) so months read above/below the desk's run-rate
 *  - Geist Mono axis labels (tabular-nums)
 *  - animated draw-in on mount (recharts isAnimationActive, --ease-soft)
 *  - double-bezel tooltip (ChartTooltip) with mono numbers + window total
 *
 * The header (eyebrow + title + count-up window total + legend) lives inside
 * this client island so the headline figure can count up from 0 → value on
 * in-view (Framer Motion `animate`, --ease-soft, 1.1s, tabular-nums).
 *
 * GPU/UX discipline: recharts animates only on mount (transform/opacity + path
 * length); no scroll listeners. Colors come from CSS vars so light/dark adapt.
 *
 * This module is the recharts IMPLEMENTATION. It is intentionally loaded ONLY
 * through the dynamic-import wrapper in `exposure-chart.tsx` (ssr:false) so
 * recharts ships in a lazy chunk fetched after first paint instead of bloating
 * the dashboard route's first-load JS. Do not import this module directly from
 * a server component or shared layout.
 */

export interface ExposurePoint {
  /** Short month label, e.g. "Jan". */
  label: string;
  /** ISO month, e.g. "2025-01" - used for tooltip sorting. */
  key: string;
  /** Sum of deal target_size created that month (INR). */
  exposure: number;
  /** Number of deals created that month. */
  deals: number;
}

interface ExposureChartProps {
  data: ExposurePoint[];
  /** Total exposure across the window - count-ups in the header + tooltip. */
  totalExposure: number;
  /** Total deals across the window - count-ups in the header. */
  totalDeals: number;
  /** Window length in months - used in the eyebrow. */
  windowMonths: number;
}

function useCountUp(
  value: number,
  ref: React.RefObject<HTMLElement | null>,
  duration = 1.1,
) {
  const inView = useInView(ref, { once: true, margin: "-10%" });
  // Initialize to the real value so the headline shows the actual total the
  // moment the lazy chart chunk hydrates - never a "0" placeholder. The 0→value
  // tween runs only for headers that were below the fold when the chart mounted.
  const [display, setDisplay] = React.useState(value);
  const didAnimateRef = React.useRef(false);
  const wasAboveFoldRef = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    if (wasAboveFoldRef.current !== null) return;
    if (typeof window === "undefined" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    wasAboveFoldRef.current =
      rect.top < (window.innerHeight || 0) && rect.bottom > 0;
  }, [ref]);

  React.useEffect(() => {
    if (!inView || didAnimateRef.current) return;
    didAnimateRef.current = true;
    if (wasAboveFoldRef.current !== false) {
      setDisplay(value);
      return;
    }
    setDisplay(0);
    // onComplete settles to exactly `value` so the headline can never
    // round-display one short of the real count on a low-framerate device.
    const controls = animate(0, value, {
      duration,
      ease: CHART_EASE,
      onUpdate: (v) => setDisplay(v),
      onComplete: () => setDisplay(value),
    });
    return () => controls.stop();
  }, [value, inView, duration, ref]);

  React.useEffect(() => {
    if (didAnimateRef.current) setDisplay(value);
  }, [value]);

  return display;
}

function HeaderTotal({
  totalExposure,
  totalDeals,
  headerRef,
}: {
  totalExposure: number;
  totalDeals: number;
  headerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const exp = useCountUp(totalExposure, headerRef, 1.2);
  const deals = useCountUp(totalDeals, headerRef, 1.1);
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
      <div className="flex items-baseline gap-2">
        <span className="nums text-[clamp(1.9rem,1.3rem+1.6vw,2.6rem)] font-medium leading-none tabular-nums tracking-[-0.02em] text-foreground">
          {compactINR(exp)}
        </span>
        <span className="text-[12px] text-muted-foreground">booked exposure</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="nums text-[1.15rem] font-medium leading-none tabular-nums text-gold">
          {typeof deals === "number" && Number.isFinite(deals)
            ? deals.toLocaleString("en-IN", { maximumFractionDigits: 0 })
            : "-"}
        </span>
        <span className="text-[12px] text-muted-foreground">new mandates</span>
      </div>
    </div>
  );
}

const intFmt = (n: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
    : "-";

export function ExposureChart({
  data,
  totalExposure,
  totalDeals,
  windowMonths,
}: ExposureChartProps) {
  const id = React.useId().replace(/[:]/g, "");
  const emeraldFill = `exposure-fill-${id}`;
  const goldFill = `deals-fill-${id}`;
  const strokeGradientId = `exposure-stroke-${id}`;
  const glowId = `exposure-glow-${id}`;
  const headerRef = React.useRef<HTMLDivElement>(null);

  // Benchmark: mean monthly exposure across the window. Gives the desk a
  // run-rate to read each month against (above/below the line). Derived from
  // the padded series so empty months pull the average down honestly.
  const meanExposure =
    data.length > 0 ? totalExposure / data.length : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header - eyebrow + title + count-up totals + legend. */}
      <div
        ref={headerRef}
        className="flex flex-col gap-4 px-5 pt-5 md:px-6 md:pt-6"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <Eyebrow dot>Exposure · last {windowMonths} months</Eyebrow>
            <HeaderTotal
              totalExposure={totalExposure}
              totalDeals={totalDeals}
              headerRef={headerRef}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground md:mt-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald" />
              Exposure
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-gold" />
              New deals
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-px w-4 bg-emerald/50" />
              Avg
            </span>
          </div>
        </div>
      </div>

      {/* Chart body - amplified emerald glow behind the area, hairline dashed
          grid, dashed mean benchmark line. The decorative glow sits inside the
          card core (overflow-hidden) so it can't bleed; the card-level ambient
          halo (added on the parent Card) carries the lit-object depth out past
          the bezel. Mobile gets wider side padding + a touch more bottom room
          so the recharts area breathes on a narrow viewport instead of reading
          as a cramped sliver between the two axes. */}
      <div className="relative flex-1 px-2.5 pb-3 pt-3 md:px-1.5 md:pb-2">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 bottom-4 top-0 rounded-full opacity-90"
          style={{
            background:
              "radial-gradient(58% 80% at 28% 100%, color-mix(in oklch, var(--emerald) 22%, transparent) 0%, transparent 72%)",
          }}
        />
        {/* Responsive height: the chart BREATHES on phones at 300px (within
            the 280–320px touch-native band) so the area's gradient wash +
            benchmark line + dual axes read as a real instrument instead of a
            compressed sliver, rising to the full 380px read on md+. */}
        <div className="relative h-[300px] w-full md:h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 12, right: 12, bottom: 4, left: -4 }}
            >
              <defs>
                {/* Amplified vertical area wash - top stop at 0.30 so the fill
                    reads as a lit field (the vision critic's "near-invisible"
                    note), fading to transparent at the baseline. */}
                <ChartAreaGradient
                  id={emeraldFill}
                  color="emerald"
                  opacity={0.3}
                />
                <ChartAreaGradient id={goldFill} color="gold" opacity={0.16} />
                {/* Horizontal gold→emerald stroke gradient for the hero series -
                    the brand-bridging accent on the single most prominent line. */}
                <linearGradient
                  id={strokeGradientId}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop offset="0%" stopColor={CHART_SERIES.gold} />
                  <stop offset="100%" stopColor={CHART_SERIES.emerald} />
                </linearGradient>
                {/* Soft emerald glow filter for the exposure stroke - machined
                    specular catch that makes the line read as drawn, not flat. */}
                <filter
                  id={glowId}
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis
                dataKey="label"
                tickMargin={12}
                minTickGap={20}
                tick={CHART_AXIS_TICK}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="exposure"
                width={58}
                tickMargin={8}
                tickFormatter={(v: number) => compactINR(v).replace("₹", "₹ ")}
                tick={CHART_AXIS_TICK}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="deals"
                orientation="right"
                width={22}
                tickMargin={6}
                allowDecimals={false}
                tick={{
                  ...CHART_AXIS_TICK,
                  fill: "color-mix(in oklch, var(--gold) 75%, transparent)",
                }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={CHART_CURSOR}
                content={
                  <ChartTooltip
                    labelMap={{ exposure: "Exposure", deals: "New deals" }}
                    formatValue={(v, k) =>
                      k === "exposure" ? compactINR(v) : intFmt(v)
                    }
                  />
                }
              />
              {/* Benchmark: mean monthly exposure across the window. Dashed
                  emerald hairline + a tiny mono "Avg" label, so each month
                  reads against the desk's run-rate. Rendered behind the areas. */}
              <ReferenceLine
                yAxisId="exposure"
                y={meanExposure}
                stroke="color-mix(in oklch, var(--emerald) 42%, transparent)"
                strokeWidth={1}
                strokeDasharray="4 5"
                label={{
                  value: "Avg",
                  position: "insideTopRight",
                  fill: "color-mix(in oklch, var(--emerald) 70%, transparent)",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                }}
              />
              <Area
                yAxisId="exposure"
                type="monotone"
                dataKey="exposure"
                stroke={`url(#${strokeGradientId})`}
                strokeWidth={2.5}
                fill={`url(#${emeraldFill})`}
                filter={`url(#${glowId})`}
                isAnimationActive
                animationDuration={1200}
                animationEasing="ease-out"
                dot={false}
                activeDot={CHART_ACTIVE_DOT.emerald}
              />
              <Area
                yAxisId="deals"
                type="monotone"
                dataKey="deals"
                stroke={CHART_SERIES.gold}
                strokeWidth={CHART_STROKE_WIDTH}
                fill={`url(#${goldFill})`}
                isAnimationActive
                animationDuration={1400}
                animationEasing="ease-out"
                dot={false}
                activeDot={CHART_ACTIVE_DOT.gold}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}