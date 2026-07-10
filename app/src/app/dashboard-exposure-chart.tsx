"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

/**
 * HeroExposureChart - the dashboard's "wow" chart. Two stacked series (mandate
 * value vs. credit exposure) drawn over the last N months, with a hairline grid,
 * emerald/gold series, Geist Mono axis labels, soft gradient fills, an animated
 * draw-in on mount (recharts isAnimationActive), and a double-bezel tooltip.
 *
 * Data is computed server-side (per-month aggregates over the live DB) and
 * passed in - this component only owns the visual treatment + interaction.
 */

export interface ExposurePoint {
  /** "MMM" short month label, e.g. "Mar". */
  month: string;
  /** Mandated deal value in crore for the month (INR). */
  mandates: number;
  /** Credit analysis exposure in crore for the month (INR). */
  exposure: number;
}

export function HeroExposureChart({
  data,
  totalMandates,
  totalExposure,
}: {
  data: ExposurePoint[];
  totalMandates: number;
  totalExposure: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <div ref={ref} className="relative h-full w-full">
      {/* Legend / headline row */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-5 md:px-6 md:pt-6">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Mandate value · exposure
          </span>
          <div className="flex items-baseline gap-2">
            <span className="nums text-[26px] font-medium leading-none tabular-nums text-foreground" aria-live="polite">
              ₹{Number.isFinite(totalMandates) ? totalMandates.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "-"} Cr
            </span>
            <span className="text-[12px] text-muted-foreground">mandates, trailing 12m</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <LegendDot className="bg-emerald" label="Mandates" value={totalMandates} suffix=" Cr" />
          <LegendDot className="bg-gold" label="Credit exposure" value={totalExposure} suffix=" Cr" />
        </div>
      </div>

      {/* Chart */}
      <div className="h-[220px] w-full px-2 pb-3 pt-4 md:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 16, left: 4, bottom: 0 }}
          >
            <defs>
              <linearGradient id="dashMandates" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--emerald)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--emerald)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dashExposure" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="var(--hairline)"
              strokeDasharray="3 6"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v) => `${Math.round(Number(v))}`}
            />
            <Tooltip
              cursor={{ stroke: "var(--hairline)", strokeWidth: 1, strokeDasharray: "4 4" }}
              content={<ExposureTooltip />}
            />
            <Area
              type="monotone"
              dataKey="exposure"
              stroke="var(--gold)"
              strokeWidth={1.5}
              fill="url(#dashExposure)"
              isAnimationActive={inView}
              animationDuration={1100}
              animationEasing="ease"
              dot={false}
              activeDot={{ r: 3, fill: "var(--gold)", stroke: "var(--surface)", strokeWidth: 1.5 }}
            />
            <Area
              type="monotone"
              dataKey="mandates"
              stroke="var(--emerald)"
              strokeWidth={1.75}
              fill="url(#dashMandates)"
              isAnimationActive={inView}
              animationDuration={1300}
              animationEasing="ease"
              dot={false}
              activeDot={{ r: 3.5, fill: "var(--emerald)", stroke: "var(--surface)", strokeWidth: 1.5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LegendDot({
  className,
  label,
  value,
  suffix,
}: {
  className: string;
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className={cn("size-2 rounded-full", className)} />
      <span className="uppercase tracking-[0.12em]">{label}</span>
      <span className="nums font-medium tabular-nums text-foreground/80">
        ₹{Number.isFinite(value) ? value.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "-"}{suffix}
      </span>
    </span>
  );
}

/** Double-bezel tooltip pill with mono numbers. */
interface ExposureTooltipPayload {
  color?: string;
  dataKey?: string | number;
  value?: number | string;
}

function ExposureTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ExposureTooltipPayload[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl bg-white/[0.02] p-1.5 ring-1 ring-hairline shadow-floating">
      <div className="rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface px-3.5 py-2.5">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
        <div className="flex flex-col gap-1.5">
          {payload.map((p) => (
            <div key={p.dataKey} className="flex items-center justify-between gap-6">
              <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
                <span
                  className="size-2 rounded-full"
                  style={{ background: p.color }}
                />
                {p.dataKey === "mandates" ? "Mandates" : "Credit exposure"}
              </span>
              <span className="nums text-[13px] font-medium tabular-nums text-foreground">
                ₹{Number.isFinite(Number(p.value)) ? Number(p.value).toLocaleString("en-IN", { maximumFractionDigits: 1 }) : "-"} Cr
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * StageStrip - horizontal animated bars for deals-by-stage. Each stage draws its
 * bar in on mount (framer-motion width 0 → pct) with the shared --ease-soft.
 * Emerald for live stages, gold for the pricing/allocation (near-close) stages.
 */
export interface StageDatum {
  key: string;
  label: string;
  count: number;
  pct: number;
}

export function StageStrip({ stages, total }: { stages: StageDatum[]; total: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-8%" });

  return (
    <div ref={ref} className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {stages.map((s, i) => {
        const gold = s.key === "pricing" || s.key === "allocation";
        return (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-6%" }}
            transition={{ duration: 0.5, delay: i * 0.045, ease: [0.32, 0.72, 0, 1] }}
            className="group relative flex flex-col gap-2.5 rounded-xl bg-foreground/[0.02] p-3 ring-1 ring-hairline/60 transition-colors duration-300 ease-soft hover:bg-foreground/[0.04] hover:ring-hairline"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase leading-tight tracking-[0.12em] text-muted-foreground">
                {s.label}
              </span>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  gold ? "bg-gold" : "bg-emerald",
                )}
              />
            </div>
            <span
              className={cn(
                "nums text-[22px] font-medium leading-none tabular-nums",
                gold ? "text-gold" : "text-foreground",
              )}
            >
              {s.count}
            </span>
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
              <motion.span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  gold ? "bg-gold" : "bg-emerald",
                )}
                initial={{ width: 0 }}
                animate={inView ? { width: `${Math.max(s.pct, 0)}%` } : { width: 0 }}
                transition={{ duration: 1, delay: 0.15 + i * 0.045, ease: [0.32, 0.72, 0, 1] }}
              />
            </div>
          </motion.div>
        );
      })}
      {stages.length === 0 ? (
        <div className="col-span-full flex flex-col items-center gap-2 py-10 text-center">
          <span className="text-lg font-light text-foreground/80">
            The pipeline is quiet.
          </span>
          <span className="text-[12px] text-muted-foreground">
            No open mandates across the eight stages right now.
          </span>
        </div>
      ) : null}
      {total > 0 ? (
        <div className="col-span-full mt-1 flex items-center justify-between border-t border-hairline/60 pt-3 text-[11px] text-muted-foreground">
          <span className="uppercase tracking-[0.14em]">Open pipeline</span>
          <span className="nums font-medium tabular-nums text-foreground/80">{total} deals</span>
        </div>
      ) : null}
    </div>
  );
}

/** Small standalone bar chart variant for compact contexts (unused on desktop). */
export function MiniBars({ data }: { data: { month: string; mandates: number }[] }) {
  return (
    <div className="h-[120px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="month" hide />
          <YAxis hide />
          <Bar dataKey="mandates" fill="var(--emerald)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
