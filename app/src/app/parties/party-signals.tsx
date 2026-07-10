/**
 * Party signals - the shared, server-component-safe derivations used by both
 * the Relationship Explorer (client) and the party detail page (server).
 *
 * `deriveStrength` + `formatRelative` are pure functions; `StrengthBar` is a
 * presentational component with no hooks. No `"use client"` so the module can
 * be imported into a server component without dragging a client boundary into
 * the server bundle, and into a client component without issue.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export type StrengthBand =
  | "latent"
  | "emerging"
  | "active"
  | "established"
  | "strategic";

export interface Strength {
  score: number;
  filled: number; // 1..5 segments
  band: StrengthBand;
}

export const BAND_LABEL: Record<StrengthBand, string> = {
  latent: "Latent",
  emerging: "Emerging",
  active: "Active",
  established: "Established",
  strategic: "Strategic",
};

/** The signals a party row exposes - the list item and the preview both carry
 *  these, so the derivation stays identical across the explorer + detail page. */
export interface PartySignalInput {
  relationshipCount: number;
  dealCount: number;
  contactCount: number;
  isKycComplete: boolean | null;
}

/**
 * Derive a 0–100 relationship-strength score from the party's signals, purely
 * for display. Weighting: mandates 40% (the strongest relationship signal for a
 * capital-markets CRM), relationships 30%, people 15%, KYC completion 15%.
 * Maps to a 5-segment meter + a band label. Display-only - never written back.
 */
export function deriveStrength(r: PartySignalInput): Strength {
  const rel = Math.min(r.relationshipCount, 4) / 4;
  const deal = Math.min(r.dealCount, 6) / 6;
  const contact = Math.min(r.contactCount, 3) / 3;
  const kyc = r.isKycComplete ? 1 : 0;
  const score = Math.round(rel * 30 + deal * 40 + contact * 15 + kyc * 15);
  const filled = Math.max(1, Math.min(5, Math.ceil(score / 20)));
  const bands: StrengthBand[] = [
    "latent",
    "emerging",
    "active",
    "established",
    "strategic",
  ];
  const band = bands[filled - 1];
  return { score, filled, band };
}

/** Relative last-touch - "just now" / "5m ago" / "3h ago" / "2d ago" / short
 *  date for anything older than a week. Falls back to an em-dash for null.
 *  Accepts Date | string | number: postgres-js returns real Dates for mapped
 *  `timestamp` columns, but raw `sql<Date>max(...)` aggregates arrive as ISO
 *  strings, so coerce before touching the Date API. */
export function formatRelative(d: Date | string | number | null | undefined): string {
  if (!d) return "-";
  const date = d instanceof Date ? d : new Date(d);
  const then = date.getTime();
  if (!Number.isFinite(then)) return "-";
  const diff = Math.max(0, Date.now() - then);
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return date.toLocaleDateString("en-IN", { month: "short", day: "2-digit" });
}

/** The 5-segment strength meter - an ascending signal-strength read, not five
 *  identical dots. Segments grow in width left→right so the meter reads as a
 *  machined instrument (low → high), and the top band ("strategic") tips its
 *  filled cap segment in gold - the brand's reserved premium accent - so a
 *  strategic party's meter is visually distinct from an established one. This
 *  is the variation the explorer relies on: the meter actually changes shape +
 *  tone with the seed's varied relationship / mandate / contact data.
 *
 *  Pure presentational - renders visible (no motion), safe in both server and
 *  client contexts. */
const SEGMENT_W = ["w-[3px]", "w-[5px]", "w-[7px]", "w-[9px]", "w-[11px]"];

export function StrengthBar({
  strength,
  className,
}: {
  strength: Strength;
  className?: string;
}) {
  const title = `${BAND_LABEL[strength.band]} relationship · score ${strength.score}`;
  const isStrategic = strength.band === "strategic";
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn("inline-flex items-center gap-[3px]", className)}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < strength.filled;
        // The strategic band's cap segment is gold; every other filled segment
        // is emerald. Unfilled segments are a faint foreground hairline.
        const isGoldCap = isStrategic && i === strength.filled - 1 && i === 4;
        return (
          <span
            key={i}
            aria-hidden
            className={cn(
              "h-[10px] rounded-full transition-colors duration-300 ease-soft",
              SEGMENT_W[i],
              filled
                ? isGoldCap
                  ? "bg-gold shadow-[0_0_6px] shadow-gold/50"
                  : "bg-emerald/85"
                : "bg-foreground/12",
            )}
          />
        );
      })}
    </span>
  );
}
