"use client";

import * as React from "react";
import { animate, useInView } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/brand/card";
import { Eyebrow } from "@/components/brand/text";
import { FORMAT_PRESETS, type FormatPreset } from "@/components/brand/money";

/**
 * StatCard - KPI tile with a count-up on mount. Framer Motion `animate` drives
 * a 0 → value tween (duration 1.1s, --ease-soft); tabular-nums keeps digits
 * from jittering as they tick. Lives inside the double-bezel Card.
 *
 * `format` controls how the ticking number renders (compactINR for currency,
 * a percent formatter for ratios, etc.).
 */

function useCountUp(value: number, enabled: boolean, duration = 1.1) {
  const [animated, setAnimated] = React.useState(0);
  // No setState in the effect body - setAnimated only fires from the
  // animation's onUpdate callback (an external-system subscription), which the
  // react-hooks/set-state-in-effect rule permits.
  React.useEffect(() => {
    if (!enabled) return;
    const controls = animate(0, value, {
      duration,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (v) => setAnimated(v),
    });
    return () => controls.stop();
  }, [value, enabled, duration]);
  // Before the ring enters view, hold 0 so the count-up is the first thing the
  // user sees (standard whileInView count-up behaviour).
  return enabled ? animated : 0;
}

function CountUp({
  value,
  format,
  duration,
  className,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-8%" });
  const display = useCountUp(value, inView, duration);
  return (
    <span
      ref={ref}
      data-slot="brand-stat-value"
      className={cn("nums tabular-nums font-medium tracking-[-0.01em]", className)}
    >
      {format(display)}
    </span>
  );
}

export interface StatCardProps {
  label: string;
  value: number;
  /** Format the ticking value → string (e.g. compactINR, percent formatter).
   * Client components only - server components cannot pass functions across
   * the RSC boundary and should use `preset` or `display` instead. */
  format?: (n: number) => string;
  /** Serializable preset for server components (e.g. "decimal1", "currency"). */
  preset?: FormatPreset;
  /** Static text shown instead of the count-up (e.g. a categorical band label
   * like "BC-1"). When set, `format`/`preset` are ignored. */
  display?: string;
  /** Suffix appended after the formatted value (e.g. "%", "×"). */
  suffix?: string;
  /** Prefix prepended before the formatted value (e.g. "₹"). */
  prefix?: string;
  /** Delta as percentage points (e.g. 12 → +12%). Tone is derived from sign. */
  delta?: { value: number; label?: string };
  /** Leading Phosphor Light glyph. */
  icon?: React.ReactNode;
  /** Force a tone regardless of delta sign. */
  tone?: "default" | "up" | "down" | "gold";
  /** Override the count-up duration (s). */
  duration?: number;
  className?: string;
  /** Extra content rendered in the card footer (e.g. a sparkline). */
  children?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  format,
  preset,
  display,
  suffix,
  prefix,
  delta,
  icon,
  tone = "default",
  duration,
  className,
  children,
}: StatCardProps) {
  const fmt = React.useMemo<((n: number) => string)>(() => {
    if (display != null) return () => display;
    if (format) return format;
    if (preset) return FORMAT_PRESETS[preset];
    return (n: number) =>
      `${prefix ?? ""}${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}${suffix ?? ""}`;
  }, [display, format, preset, prefix, suffix]);

  const deltaTone =
    tone !== "default"
      ? tone
      : delta
        ? delta.value > 0
          ? "up"
          : delta.value < 0
            ? "down"
            : "default"
        : "default";

  const valueTone =
    tone === "gold"
      ? "text-gold"
      : tone === "up"
        ? "text-up"
        : tone === "down"
          ? "text-down"
          : "text-foreground";

  return (
    <Card className={cn("h-full", className)}>
      <div className="flex h-full flex-col gap-3 p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>{label}</Eyebrow>
          {icon ? (
            <span className="text-muted-foreground/70 [&_svg]:size-4">
              {icon}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col justify-end gap-1.5">
          <CountUp
            value={value}
            format={fmt}
            duration={duration}
            className={cn(
              "text-[22px] font-semibold leading-none tracking-[-0.02em] md:text-[26px]",
              valueTone,
            )}
          />
          {delta ? (
            <div className="flex items-center gap-1.5 text-[12px]">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  deltaTone === "up" && "text-up",
                  deltaTone === "down" && "text-down",
                  deltaTone === "default" && "text-muted-foreground",
                )}
              >
                {deltaTone === "down" ? (
                  <ArrowDownRight weight="light" className="size-3.5" />
                ) : (
                  <ArrowUpRight weight="light" className="size-3.5" />
                )}
                {delta.value > 0 ? "+" : delta.value < 0 ? "−" : ""}
                {Math.abs(delta.value).toLocaleString("en-IN", {
                  maximumFractionDigits: 1,
                })}
                %
              </span>
              {delta.label ? (
                <span className="text-muted-foreground">{delta.label}</span>
              ) : null}
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </Card>
  );
}