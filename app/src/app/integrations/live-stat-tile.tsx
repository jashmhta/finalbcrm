"use client";

// LiveStatTile - the control-panel KPI tile for the /integrations header band.
//
// The integrations header is a LIVE instrument cluster: as the user runs mocks,
// adapters flip from "In mock" to "Connected" and the header counts tick in
// real time. A plain mount count-up (0 → value, once) is right for the static
// tiles (Available, Total) but wrong for the live ones - re-counting from 0 on
// every change would replay the whole 0 → 11 sweep each time a single adapter
// connects. So this tile animates from the PREVIOUS displayed value to the new
// one on change (a smooth ~0.55s tick), and from 0 on the first in-view mount
// (the canonical 1.1s count-up). tabular-nums keeps digits from jittering.
//
// Each tile is its OWN double-bezel Card with an optional ambient halo
// (emerald / gold) so the row reads as a rack of crafted, lit objects on the
// mesh - matching the dashboard hero row + the prior registry tiles, not three
// cells in a shared tray. `aria-live="polite"` on the live tiles so a screen
// reader announces the count as it changes.
//
// Client-only (count-up hooks). Props are serializable so it renders cleanly
// from the client explorer; no functions cross an RSC boundary.
import * as React from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Card } from "@/components/brand/card";
import { Eyebrow } from "@/components/brand/text";

const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * useLiveCount - mount count-up + live tick. Animates 0 → value on the first
 * in-view mount, then prev → value on every change. `currentRef` tracks the live
 * displayed figure so a change mid-tween animates from the current position, not
 * a stale target. Reduced-motion snaps via a 0-duration tween.
 *
 * setDisplay only ever fires from the animation's onUpdate / onComplete
 * callbacks (an external-system subscription), never synchronously in the effect
 * body, so this stays clear of the react-hooks/set-state-in-effect rule -
 * mirroring the brand StatCard pattern.
 */
function useLiveCount(value: number, inView: boolean, duration = 1.1) {
  const [display, setDisplay] = React.useState(0);
  const currentRef = React.useRef(0);
  const startedRef = React.useRef(false);
  const reduce = useReducedMotion();
  React.useEffect(() => {
    if (!inView) return;
    const from = currentRef.current;
    const isMount = !startedRef.current;
    startedRef.current = true;
    const controls = animate(from, value, {
      duration: reduce ? 0 : isMount ? duration : 0.55,
      ease: EASE,
      onUpdate: (v) => {
        setDisplay(v);
        currentRef.current = v;
      },
      // Safety net - guarantees the final value lands even if a 0-duration
      // tween does not fire onUpdate (reduced-motion snap).
      onComplete: () => {
        setDisplay(value);
        currentRef.current = value;
      },
    });
    return () => controls.stop();
  }, [value, inView, duration, reduce]);
  return inView ? display : 0;
}

export interface LiveStatTileProps {
  label: string;
  value: number;
  /** Ambient halo - the lit-object bleed behind the bezel. Reserved for the
   *  connected (emerald) + available (gold) tiles; pass undefined for calm. */
  ambient?: "emerald" | "gold";
  /** Value color accent (restrained brand palette - never neon). */
  tone?: "default" | "emerald" | "gold";
  /** Quiet caption line beneath the value. */
  caption?: string;
  /** Marks the tile as a live counter - adds aria-live="polite" + a tiny pulse
   *  dot so the live tiles read as actively-updating instruments. */
  live?: boolean;
  className?: string;
}

export function LiveStatTile({
  label,
  value,
  ambient,
  tone = "default",
  caption,
  live = false,
  className,
}: LiveStatTileProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-8%" });
  const display = useLiveCount(value, inView);

  const valueColor =
    tone === "gold"
      ? "text-gold"
      : tone === "emerald"
        ? "text-emerald"
        : "text-foreground";

  return (
    <Card interactive className={cn("h-full", className)}>
      <div className="flex h-full flex-col gap-4 p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>{label}</Eyebrow>
          <span
            aria-hidden
            className={cn(
              "inline-flex items-center gap-1.5",
              live && "text-emerald/80",
            )}
          >
            {/* Live pulse - a soft heartbeat dot on the live tiles so the
                count reads as actively updating. Transform/opacity only. */}
            {live ? (
              <span aria-hidden className="relative inline-flex size-1.5">
                <span
                  className={cn(
                    "absolute inset-0 rounded-full bg-emerald/45",
                    "motion-safe:animate-ping",
                  )}
                />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald shadow-[0_0_6px] shadow-emerald/60" />
              </span>
            ) : (
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  tone === "gold"
                    ? "bg-gold shadow-[0_0_8px] shadow-gold/55"
                    : tone === "emerald"
                      ? "bg-emerald shadow-[0_0_8px] shadow-emerald/55"
                      : "bg-foreground/25",
                )}
              />
            )}
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-1.5">
          <span
            ref={ref}
            data-slot="live-stat-value"
            aria-live={live ? "polite" : undefined}
            className={cn(
              "nums tabular-nums font-medium tracking-[-0.01em] leading-none",
              "text-[clamp(1.6rem,1.2rem+1.4vw,2.1rem)]",
              valueColor,
            )}
          >
            {Math.round(display).toLocaleString("en-IN")}
          </span>
          {caption ? (
            <span className="text-[12px] leading-snug text-muted-foreground">
              {caption}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}