"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Sparkline - the per-metric trend glyph that turns the credit workspace's
 * ratio matrix from a raw grid into an analytical canvas. A hairline inline-SVG
 * polyline + soft area wash, drawn in on mount via framer-motion `pathLength`
 * (GPU-friendly: only stroke-dashoffset + opacity). Geist Mono is not needed
 * here (no numerals) - the line IS the readout; the latest-period dot anchors
 * "where we are now".
 *
 * Client-only because it uses framer-motion + useInView. Props are fully
 * serializable (`data: (number | null)[]`, `tone`) so server pages can hand
 * period series in without crossing the RSC boundary with a function - the
 * same pattern StatCard / ScoreRing use.
 *
 * Null handling (a period with a missing ratio must NOT be silently skipped):
 *  - ≥ 2 valid points → polyline through them, x-positioned by period INDEX
 *    (so a gap reads as a gap, not a compressed line).
 *  - exactly 1 valid point → a single dot at the period's x.
 *  - 0 valid points → a faint dashed baseline (the designed "no series yet"
 *    mark, mirroring CellEmpty's editorial intent at sparkline scale).
 */

export type SparklineTone = "emerald" | "gold" | "down" | "neutral";

function toneColor(tone: SparklineTone): string {
  switch (tone) {
    case "emerald":
      return "var(--emerald)";
    case "gold":
      return "var(--gold)";
    case "down":
      return "var(--down)";
    case "neutral":
    default:
      return "var(--foreground)";
  }
}

export interface SparklineProps {
  /** Series across periods (oldest → newest). null/NaN = gap. */
  data: (number | null | undefined)[];
  tone?: SparklineTone;
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
}

export function Sparkline({
  data,
  tone = "emerald",
  width = 80,
  height = 28,
  strokeWidth = 1.6,
  className,
}: SparklineProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-5%" });
  const reactId = React.useId().replace(/[:]/g, "");
  const gradId = `spark-grad-${reactId}`;
  const color = toneColor(tone);

  const n = data.length;
  const pad = 2.5;
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);

  const valid: { i: number; v: number }[] = [];
  for (let i = 0; i < n; i++) {
    const v = data[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      valid.push({ i, v: v as number });
    }
  }

  const xFor = (i: number) =>
    n > 1 ? pad + (i / (n - 1)) * innerW : pad + innerW / 2;

  let pathD = "";
  let areaD = "";
  let lastPt: { x: number; y: number } | null = null;

  if (valid.length >= 2) {
    const vals = valid.map((p) => p.v);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const span = max - min;
    const yFor = (v: number) => pad + innerH - ((v - min) / span) * innerH;
    const pts = valid.map((p) => ({ x: xFor(p.i), y: yFor(p.v) }));
    pathD = pts
      .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");
    const baseY = pad + innerH;
    areaD =
      `M${pts[0].x.toFixed(2)} ${baseY.toFixed(2)} ` +
      pts.map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") +
      ` L${pts[pts.length - 1].x.toFixed(2)} ${baseY.toFixed(2)} Z`;
    lastPt = pts[pts.length - 1];
  }

  return (
    <span
      ref={ref}
      data-slot="workspace-sparkline"
      className={cn("inline-flex items-center", className)}
      aria-hidden="true"
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.24} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {valid.length >= 2 ? (
          <>
            <motion.path
              d={areaD}
              fill={`url(#${gradId})`}
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            />
            <motion.path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
              transition={{ duration: 1.1, ease: [0.32, 0.72, 0, 1] }}
            />
            {lastPt ? (
              <motion.circle
                cx={lastPt.x}
                cy={lastPt.y}
                r={1.9}
                fill={color}
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.3, delay: 1.0, ease: [0.32, 0.72, 0, 1] }}
              />
            ) : null}
          </>
        ) : valid.length === 1 ? (
          <circle
            cx={xFor(valid[0].i)}
            cy={pad + innerH / 2}
            r={1.9}
            fill={color}
            opacity={0.7}
          />
        ) : (
          <line
            x1={pad}
            y1={pad + innerH / 2}
            x2={pad + innerW}
            y2={pad + innerH / 2}
            stroke="color-mix(in oklch, var(--foreground) 20%, transparent)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        )}
      </svg>
    </span>
  );
}
