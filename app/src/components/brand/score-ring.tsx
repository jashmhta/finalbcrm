"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";

import { cn } from "@/lib/utils";
import { FORMAT_PRESETS, type FormatPreset } from "@/components/brand/money";

/**
 * ScoreRing - animated SVG arc used in the credit workspace + bond calculator.
 * Stroke is a gold→amber (gold→gold-deep) gradient - the gold brand accent is
 * dominant; the ring draws itself in on mount via stroke-dashoffset
 * (GPU-friendly: only transform/opacity + dashoffset on the single path). The
 * center readout is Geist Mono tabular-nums. The `emerald` tone is retained as
 * an alias that renders gold (the score ring is a gold-dominant brand object);
 * only the `down` tone stays rose for low scores.
 *
 * Pass `value` in the score's native units (e.g. 0–100, 0–10); `min`/`max`
 * define the arc's domain. `band` renders a notch label under the number.
 */
export interface ScoreRingProps {
  value: number;
  min?: number;
  max?: number;
  size?: number;
  thickness?: number;
  label?: string;
  sublabel?: string;
  /** Client components only - server components cannot pass functions across
   * the RSC boundary; use `preset` instead. */
  format?: (n: number) => string;
  /** Serializable preset for server components (e.g. "decimal1"). */
  preset?: FormatPreset;
  /** Optional notch label rendered under the value (e.g. "AA+"). */
  band?: { label: string; tone?: "emerald" | "gold" | "down" | "neutral" };
  /** Override the auto-derived tone for the center value. */
  tone?: "emerald" | "gold" | "down" | "neutral";
  duration?: number;
  className?: string;
}

export function ScoreRing({
  value,
  min = 0,
  max = 100,
  size = 168,
  thickness = 12,
  label,
  sublabel,
  format,
  preset,
  band,
  tone,
  duration = 1.3,
  className,
}: ScoreRingProps) {
  const id = React.useId().replace(/:/g, "");
  const gradId = `score-grad-${id}`;
  const trackGradId = `score-track-${id}`;
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(min, Math.min(max, value));
  const fraction = (clamped - min) / (max - min || 1);
  const offset = c * (1 - fraction);

  const autoTone =
    fraction >= 0.7 ? "emerald" : fraction >= 0.45 ? "gold" : "down";
  const activeTone = tone ?? autoTone;

  // `emerald` renders the GOLD brand accent (alias) so the score ring stays
  // gold-dominant; `down` stays rose for low scores.
  const toneColor =
    activeTone === "emerald" || activeTone === "gold"
      ? "var(--gold)"
      : activeTone === "down"
        ? "var(--down)"
        : "var(--foreground)";

  // Tone-aware arc glow - gold (and the emerald alias) gets the strongest
  // halo (the signature "Binary" accent reads as a lit, premium object);
  // down/neutral calmer. Bumped from the previous flat 40% so the ring reads
  // with the new material depth instead of a thin stroke.
  const glowStrength =
    activeTone === "gold" || activeTone === "emerald" ? 0.55 : 0.38;

  const bandToneClass =
    band?.tone === "emerald" || band?.tone === "gold"
      ? "text-gold"
      : band?.tone === "down"
        ? "text-down"
        : "text-muted-foreground";

  const display = format
    ? format(clamped)
    : preset
      ? FORMAT_PRESETS[preset](clamped)
      : clamped.toLocaleString("en-IN", { maximumFractionDigits: 1 });

  return (
    <div
      ref={ref}
      data-slot="brand-score-ring"
      className={cn("flex flex-col items-center gap-3", className)}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--gold)" />
              <stop offset="100%" stopColor="var(--gold-deep)" />
            </linearGradient>
            <linearGradient id={trackGradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="color-mix(in oklch, var(--foreground) 10%, transparent)" />
              <stop offset="100%" stopColor="color-mix(in oklch, var(--foreground) 6%, transparent)" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${trackGradId})`}
            strokeWidth={thickness}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={inView ? { strokeDashoffset: offset } : { strokeDashoffset: c }}
            transition={{ duration, ease: [0.32, 0.72, 0, 1] }}
            style={{ filter: `drop-shadow(0 0 8px color-mix(in oklch, ${toneColor} ${glowStrength * 100}%, transparent))` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span
            className="nums tabular-nums font-medium leading-none text-foreground"
            style={{ fontSize: size * 0.22, color: toneColor }}
          >
            {display}
          </span>
          {band ? (
            <span
              className={cn(
                "text-[11px] font-medium uppercase tracking-[0.14em]",
                bandToneClass,
              )}
            >
              {band.label}
            </span>
          ) : null}
        </div>
      </div>
      {(label || sublabel) && (
        <div className="flex flex-col items-center gap-0.5 text-center">
          {label ? (
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </span>
          ) : null}
          {sublabel ? (
            <span className="text-[12px] text-muted-foreground/80">
              {sublabel}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
