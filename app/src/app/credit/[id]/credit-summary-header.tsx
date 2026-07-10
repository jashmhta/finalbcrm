"use client";

import * as React from "react";
import { motion, animate } from "framer-motion";
import { ChartLineUp } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  Card,
  Eyebrow,
  IconTile,
  RatingLadderMark,
  ExposureGaugeMark,
} from "@/components/brand";

/**
 * CreditSummaryHeader - the overview tab's three hero KPI instrument tiles:
 * internal score, internal band, and indicative 1-yr PD. Replaces the bare
 * StatCard trio with crafted "instrument" tiles that match the workspace's
 * premium depth:
 *
 *  - The score tile is the lit hero. A tone-aware ambient halo (emerald / gold)
 *    bleeds out of the double-bezel shell so the score reads as a machined,
 *    lit object - the same depth cue as the workspace's scorecard instrument.
 *    When no score exists yet, a calm gold halo keeps the hero reading as an
 *    intentional "awaiting" object instead of a dead panel.
 *  - Each tile frames its concept with the icon language: an IconTile
 *    (ChartLineUp, Phosphor Light in a machined disc) for the score, the custom
 *    RatingLadderMark for the band, and the custom ExposureGaugeMark for PD -
 *    the CRM's own brand-concept glyphs, not stock icons.
 *  - Designed empties: when no scorecard exists, each tile renders a Fraunces
 *    "Awaiting …" editorial line + a muted hint, so the empty reads as an
 *    intentional "awaiting input" object - NOT a bare "-" in a giant mono
 *    number (the unfinished tell the critic flagged on the header cards).
 *  - The score counts up on mount (framer-motion `animate`, tabular-nums so
 *    digits don't jitter); the band + PD render static (categorical / derived).
 *    Mount-based motion only (no whileInView opacity gate) so the primary
 *    content renders visible on mount - the y-rise keeps opacity at 1
 *    throughout, only translating the tiles into place.
 *
 * Server-component-safe props (all serializable): the parent server page
 * derives score / band / PD from the credit engine and hands them in - no
 * function props cross the RSC boundary.
 */

const EASE = [0.32, 0.72, 0, 1] as const;

type HeaderTone = "up" | "gold" | "down" | "default";
type MarkTone = "emerald" | "gold" | "down" | "neutral";

interface CreditSummaryHeaderProps {
  score: number | null;
  band: string | null;
  bandGrade: string | null;
  /** Indicative 1-yr PD expressed as a percent (e.g. 0.012 for 0.012%). */
  pdPct: number | null;
  pdRange: string | null;
  scoreTone: HeaderTone;
  /** Whether a live scorecard exists - tunes the empty-state copy. */
  hasScorecard: boolean;
}

function useCountUp(value: number, duration = 1.1) {
  const [animated, setAnimated] = React.useState(0);
  // setAnimated fires only from the animation's onUpdate callback (an external
  // subscription), which the react-hooks/set-state-in-effect rule permits.
  React.useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setAnimated(v),
    });
    return () => controls.stop();
  }, [value, duration]);
  return animated;
}

function ScoreCountUp({ value, className }: { value: number; className?: string }) {
  const display = useCountUp(value);
  // Guard NaN/Infinity (a non-finite `value` would tick the count-up to NaN and
  // render "NaN" in the headline score) - fall back to an em-dash instead.
  const text =
    typeof display === "number" && Number.isFinite(display)
      ? display.toFixed(1)
      : "-";
  return (
    <span
      data-slot="credit-score-countup"
      className={cn("nums tabular-nums font-medium tracking-[-0.01em]", className)}
      aria-live="polite"
    >
      {text}
    </span>
  );
}

function toneAmbient(tone: HeaderTone): "emerald" | "gold" | undefined {
  if (tone === "up") return "emerald";
  if (tone === "gold") return "gold";
  return undefined;
}

function toneText(tone: HeaderTone): string {
  if (tone === "up") return "text-up";
  if (tone === "gold") return "text-gold";
  if (tone === "down") return "text-down";
  return "text-foreground";
}

function toneMark(tone: HeaderTone): MarkTone {
  if (tone === "up") return "emerald";
  if (tone === "gold") return "gold";
  if (tone === "down") return "down";
  return "neutral";
}

const VALUE_SIZE =
  "text-[clamp(1.6rem,1.2rem+1.4vw,2.1rem)] leading-none tracking-[-0.01em]";

function TileBody({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col gap-4 p-5 md:p-6">{children}</div>;
}
function TileTop({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3">{children}</div>;
}
function TileValueArea({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col justify-end gap-1.5">{children}</div>;
}

/**
 * The designed "awaiting" tile - a Fraunces editorial line + a muted hint.
 * Mirrors the EmptyState design language (Fraunces title + muted hint) scaled
 * to a KPI tile, so a missing score/band/PD reads as intentional rather than
 * a bare em-dash in a giant mono number.
 */
function EmptyTileValue({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[clamp(1.25rem,1rem+0.9vw,1.55rem)] font-light leading-[1.1] tracking-[-0.01em] text-muted-foreground/75">
        {label}
      </p>
      <p className="text-[12px] leading-[1.45] text-muted-foreground/80">{hint}</p>
    </div>
  );
}

export function CreditSummaryHeader({
  score,
  band,
  bandGrade,
  pdPct,
  pdRange,
  scoreTone,
  hasScorecard,
}: CreditSummaryHeaderProps) {
  const scoreAmbient = score !== null ? toneAmbient(scoreTone) : "gold";
  // PD tone tracks the score: a strong obligor has a low (good) PD, a weak one
  // a high (bad) PD - so the gauge + value read with the same语义 tone.
  const pdTone: HeaderTone =
    scoreTone === "down" ? "down" : scoreTone === "up" ? "up" : "default";

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Score - the lit hero */}
      <motion.div
        initial={{ y: 10 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <Card className="h-full">
          <TileBody>
            <TileTop>
              <Eyebrow>Internal score</Eyebrow>
              <IconTile
                icon={ChartLineUp}
                size={20}
                tone={score !== null ? toneMark(scoreTone) : "neutral"}
              />
            </TileTop>
            <TileValueArea>
              {score !== null ? (
                <>
                  <ScoreCountUp
                    value={score}
                    className={cn(VALUE_SIZE, toneText(scoreTone))}
                  />
                  <span className="text-[11.5px] text-muted-foreground/75">
                    weighted · 0-100
                  </span>
                </>
              ) : (
                <EmptyTileValue
                  label="Awaiting score"
                  hint={
                    hasScorecard
                      ? "A scorecard exists - re-run to refresh the weighted score."
                      : "Run the scorecard to weight this obligor 0-100."
                  }
                />
              )}
            </TileValueArea>
          </TileBody>
        </Card>
      </motion.div>

      {/* Band - rating-ladder mark, gold accent */}
      <motion.div
        initial={{ y: 10 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.06 }}
      >
        <Card className="h-full">
          <TileBody>
            <TileTop>
              <Eyebrow>Internal band</Eyebrow>
              <RatingLadderMark size={22} tone={band ? "gold" : "neutral"} />
            </TileTop>
            <TileValueArea>
              {band ? (
                <>
                  <span
                    className={cn(
                      "nums tabular-nums font-medium text-foreground",
                      VALUE_SIZE,
                    )}
                  >
                    {band}
                  </span>
                  <span className="text-[11.5px] text-muted-foreground/75">
                    {bandGrade ?? "internal grade"}
                  </span>
                </>
              ) : (
                <EmptyTileValue
                  label="Awaiting band"
                  hint="The internal BC band derives from the weighted scorecard."
                />
              )}
            </TileValueArea>
          </TileBody>
        </Card>
      </motion.div>

      {/* PD - exposure-gauge mark, tone-aware */}
      <motion.div
        initial={{ y: 10 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.12 }}
      >
        <Card className="h-full">
          <TileBody>
            <TileTop>
              <Eyebrow>Indicative 1-yr Probability of Default</Eyebrow>
              <ExposureGaugeMark
                size={22}
                tone={pdPct !== null ? toneMark(pdTone) : "neutral"}
              />
            </TileTop>
            <TileValueArea>
              {pdPct !== null ? (
                <>
                  <span
                    className={cn(
                      "nums tabular-nums font-medium",
                      VALUE_SIZE,
                      toneText(pdTone),
                    )}
                  >
                    {pdPct.toFixed(3)}%
                  </span>
                  <span className="text-[11.5px] text-muted-foreground/75">
                    {pdRange ?? "band PD range"}
                  </span>
                </>
              ) : (
                <EmptyTileValue
                  label="Awaiting Probability of Default"
                  hint="Indicative 1-yr Probability of Default derives from the internal band."
                />
              )}
            </TileValueArea>
          </TileBody>
        </Card>
      </motion.div>
    </div>
  );
}