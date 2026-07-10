"use client";

import * as React from "react";
import { animate } from "framer-motion";

import { cn } from "@/lib/utils";
import { Card } from "@/components/brand/card";
import { Eyebrow } from "@/components/brand/text";

/**
 * KpiStat - dashboard-only KPI tile with a flash-free, deterministic count-up.
 *
 * Identical visual treatment to the shared brand StatCard (double-bezel Card
 * shell via `Card`, Eyebrow label, large tabular-nums headline, optional gold
 * ambient halo). The count-up initializes to the REAL `value` so the
 * server-rendered HTML + first client paint both show the actual number -
 * never a "0" placeholder on Vercel serverless (the prior version started at
 * 0 and relied on a mount-time 0→value tween that shipped "0" in the SSR
 * HTML). The 0→value tween now runs ONLY for tiles that were below the fold
 * on mount; above-fold tiles keep the SSR value (no value→0→value flash).
 * `onComplete` settles to exactly `value` so a low-framerate final frame can
 * never round-display one short of the real count (mobile/desktop parity).
 *
 * Lives under src/app/_components (a dashboard client island) rather than
 * src/components/brand so the shared StatCard - used by other screens - stays
 * untouched.
 */

function useCountUp(
  value: number,
  ref: React.RefObject<HTMLElement | null>,
  duration = 1.1,
) {
  // Initial state = the real value. SSR + first client render show `value`,
  // not 0 - the fix for the serverless "0" placeholder.
  const [display, setDisplay] = React.useState(value);
  const didAnimateRef = React.useRef(false);
  const wasAboveFoldRef = React.useRef<boolean | null>(null);

  // Measure once on mount: was this tile already in the viewport?
  React.useEffect(() => {
    if (wasAboveFoldRef.current !== null) return;
    if (typeof window === "undefined" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    wasAboveFoldRef.current =
      rect.top < (window.innerHeight || 0) && rect.bottom > 0;
  }, [ref]);

  React.useEffect(() => {
    if (didAnimateRef.current) return;
    didAnimateRef.current = true;
    // Above the fold on mount (or unmeasured): the SSR paint already showed
    // the real value - skip the 0→value tween to avoid a value→0→value flash.
    if (wasAboveFoldRef.current !== false) {
      setDisplay(value);
      return;
    }
    // Below the fold: count up 0 → value.
    setDisplay(0);
    const controls = animate(0, value, {
      duration,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (v) => setDisplay(v),
      onComplete: () => setDisplay(value),
    });
    return () => controls.stop();
  }, [value, duration, ref]);

  // Keep the displayed number in sync if `value` changes after the first tween
  // (e.g. the cached KPI payload revalidates) without re-running 0→value.
  React.useEffect(() => {
    if (didAnimateRef.current) setDisplay(value);
  }, [value]);

  return display;
}

const intFmt = (n: number) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export interface KpiStatProps {
  label: string;
  value: number;
  tone?: "default" | "gold";
  className?: string;
}

export function KpiStat({
  label,
  value,
  tone = "default",
  className,
}: KpiStatProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const display = useCountUp(value, ref);
  const valueTone = tone === "gold" ? "text-gold" : "text-foreground";

  return (
    <Card
      // Gold-toned KPIs get a faint gold ambient halo (the "Binary" brand cue)
      // - matches the shared StatCard treatment so the two tiles read as one
      // family with the rest of the dashboard.
      className={cn("h-full", className)}
    >
      <div className="relative flex h-full min-h-40 flex-col overflow-hidden p-5 md:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-5 bottom-5 h-16 rounded-xl bg-[linear-gradient(135deg,color-mix(in_oklch,var(--foreground)_4%,transparent),transparent)]"
        />
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>{label}</Eyebrow>
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              tone === "gold" ? "bg-gold shadow-[0_0_8px] shadow-gold/45" : "bg-foreground/25",
            )}
          />
        </div>
        <div className="relative flex flex-1 flex-col justify-center gap-3 py-5">
          <span
            ref={ref}
            aria-live="polite"
            className={cn(
              "nums tabular-nums font-medium tracking-[-0.015em] text-[clamp(2rem,1.35rem+1.9vw,2.75rem)] leading-none",
              valueTone,
            )}
          >
            {typeof display === "number" && Number.isFinite(display)
              ? intFmt(display)
              : "-"}
          </span>
          <div className="h-px w-16 bg-[linear-gradient(90deg,color-mix(in_oklch,var(--gold)_42%,transparent),transparent)]" />
        </div>
        <div className="relative flex items-center justify-between border-t border-hairline pt-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>All time</span>
          <span className="nums">CRM ledger</span>
        </div>
      </div>
    </Card>
  );
}