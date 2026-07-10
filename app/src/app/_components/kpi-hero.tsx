"use client";

import * as React from "react";
import Link from "next/link";
import { animate, useInView } from "framer-motion";

import { cn } from "@/lib/utils";
import { Button } from "@/components/brand/button";
import { Eyebrow } from "@/components/brand/text";
import {
  ArrowRight,
  Lightning,
  Plus,
  SealWarning,
  ShieldCheck,
} from "@/components/brand/icons";

/**
 * Dashboard hero KPI card - the col-span-8 row-span-2 bento anchor.
 *
 * One double-bezel shell (rendered by the parent Card) holds a Fraunces
 * greeting + a grid of KPI cells. Each cell renders the REAL value on first
 * paint (the count-up initializes to `value`, so the SSR HTML + the first
 * client render both show the actual number - never a "0" placeholder on
 * Vercel serverless), then tweens 0 → value on in-view as a progressive
 * enhancement - BUT only for cells that were BELOW the fold on mount. Cells
 * that are already in the viewport on mount skip the 0→value animation so the
 * desk never sees a value→0→value flash on the hero numbers above the fold.
 * tabular-nums keep digits from jittering. Investors/issuers render as a
 * paired split readout beside the headline total-parties figure.
 */

/**
 * Flash-free count-up. Initializes to `value` (SSR + first paint = the real
 * number), and animates 0 → value on in-view ONLY for elements that were
 * below the fold on mount. Above-fold elements keep the SSR value (no flash).
 * `onComplete` settles to exactly `value` so a low-framerate final frame can
 * never round-display one short of the real count.
 */
function useCountUp(
  value: number,
  ref: React.RefObject<HTMLElement | null>,
  duration = 1.1,
) {
  const inView = useInView(ref, { once: true, margin: "-8%" });
  // Initial state = the real value. This is the fix for the serverless "0":
  // the server-rendered HTML and the first client render both show `value`,
  // not 0. The count-up is a progressive enhancement on top.
  const [display, setDisplay] = React.useState(value);
  const didAnimateRef = React.useRef(false);
  // null = "not yet measured". true = above the fold on mount, false = below.
  const wasAboveFoldRef = React.useRef<boolean | null>(null);

  // Measure once on mount: was this element already in the viewport? Runs
  // before the in-view animation effect (effects run in declaration order) so
  // the flag is set before the first animation decision. `useInView` returns
  // false on the first client render (the IntersectionObserver has not fired
  // yet), so we cannot rely on it here - we read the bounding rect directly.
  React.useEffect(() => {
    const flag = wasAboveFoldRef.current;
    if (flag !== null) return;
    if (typeof window === "undefined" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    wasAboveFoldRef.current =
      rect.top < (window.innerHeight || 0) && rect.bottom > 0;
  }, [ref]);

  React.useEffect(() => {
    if (!inView || didAnimateRef.current) return;
    didAnimateRef.current = true;
    // Above the fold on mount (or unmeasured): the SSR paint already showed
    // the real value - skip the 0→value animation to avoid a value→0→value
    // flash. Just pin the display to `value`.
    if (wasAboveFoldRef.current !== false) {
      setDisplay(value);
      return;
    }
    // Below the fold: count up 0 → value when the cell scrolls into view.
    setDisplay(0);
    const controls = animate(0, value, {
      duration,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (v) => setDisplay(v),
      onComplete: () => setDisplay(value),
    });
    return () => controls.stop();
  }, [value, inView, duration, ref]);

  // If `value` changes after the first animation (e.g. the cached KPI payload
  // revalidates and the server component re-renders with a new count), keep
  // the displayed number in sync without re-running the 0→value tween.
  React.useEffect(() => {
    if (didAnimateRef.current) setDisplay(value);
  }, [value]);

  return display;
}

function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const display = useCountUp(value, ref);
  return (
    <span
      ref={ref}
      aria-live="polite"
      className={cn(
        "nums tabular-nums font-medium tracking-[-0.02em] text-foreground",
        className,
      )}
    >
      {typeof display === "number" && Number.isFinite(display)
        ? format(display)
        : "-"}
    </span>
  );
}

const intFmt = (n: number) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export interface KpiHeroProps {
  greeting: string;
  subline: string;
  totalParties: number;
  investors: number;
  issuers: number;
  /** Parties that are neither investor nor issuer - intermediaries (IFA /
   *  broker / rating agency / arranger / …), internal staff, prospects. The
   *  three buckets sum to `totalParties` so the split bar + percentages add
   *  up exactly (the prior 2-way bar labelled the entire non-investor
   *  remainder as "issuers", which over-counted issuers). */
  otherParties: number;
  openDeals: number;
  creditInProgress: number;
  kycExpiring: number;
  kycSoonDays: number;
}

export function KpiHero({
  greeting,
  subline,
  totalParties,
  investors,
  issuers,
  otherParties,
  openDeals,
  creditInProgress,
  kycExpiring,
  kycSoonDays,
}: KpiHeroProps) {
  // Percentages are derived from the ACTUAL counts against totalParties, and
  // the third bucket is the remainder so the three displayed percentages sum
  // to exactly 100 (rounding drift is absorbed by `other`). This is what makes
  // 45% + 32% + 23% = 100 instead of the old 45% + 55% (which implied
  // 360 + 440 = 800 issuers - wrong, issuers are 260).
  const investorPct =
    totalParties > 0 ? Math.round((investors / totalParties) * 100) : 0;
  const issuerPct =
    totalParties > 0 ? Math.round((issuers / totalParties) * 100) : 0;
  const otherPct = Math.max(0, 100 - investorPct - issuerPct);

  const attentionLabel =
    kycExpiring > 0
      ? `${intFmt(kycExpiring)} KYC reviews due`
      : creditInProgress > 0
        ? `${intFmt(creditInProgress)} credit files active`
        : openDeals > 0
          ? `${intFmt(openDeals)} live mandates`
          : "Desk is clear";
  const attentionHref = kycExpiring > 0 ? "/compliance/kyc" : creditInProgress > 0 ? "/credit" : "/deals";

  return (
    <div className="relative flex h-full flex-col gap-5 overflow-hidden p-5 md:gap-6 md:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_oklch,var(--gold)_42%,transparent),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-44 w-64 bg-[linear-gradient(135deg,transparent,color-mix(in_oklch,var(--gold)_8%,transparent),transparent)] opacity-60"
      />
      {/* Greeting */}
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <Eyebrow dot>Overview</Eyebrow>
          <h2 className="text-balance text-[clamp(1.9rem,1.25rem+1.8vw,2.8rem)] font-light leading-[1.02] tracking-[-0.02em] text-foreground">
            {greeting}
          </h2>
          <p className="max-w-[58ch] text-[13.5px] leading-6 text-muted-foreground">
            {subline}
          </p>
        </div>
        <div className="hidden shrink-0 flex-wrap items-center gap-2 sm:flex">
          <Button
            asChild
            size="sm"
            variant="primary-gold"
            leadingIcon={<Plus weight="light" />}
            trailingIcon={<ArrowRight weight="light" className="size-3.5" />}
          >
            <Link href="/leads/new">New lead</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="secondary-hairline"
            leadingIcon={<Lightning weight="light" />}
          >
            <Link href="/matching">Match investors</Link>
          </Button>
        </div>
      </div>

      {/* Headline: total parties + investor/issuer split */}
      <div className="relative grid gap-5 border-t border-hairline pt-5 lg:grid-cols-[1fr_18rem] lg:items-end">
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Total parties</Eyebrow>
          <CountUp
            value={totalParties}
            format={intFmt}
            className="text-[clamp(3rem,1.9rem+3vw,4.35rem)] leading-none"
          />
          <span className="text-[12px] text-muted-foreground">
            Active counterparties on the platform
          </span>
        </div>

        {/* Investor / Issuer / Other split bar - three segments whose counts
            sum to totalParties and whose percentages sum to 100, so the math
            reads honestly (the prior 2-way bar mislabelled every non-investor
            party as an issuer). */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald" />
              Investors
              <span className="nums tabular-nums font-medium text-foreground">
                {intFmt(investors)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="size-1.5 rounded-full bg-gold" />
              Issuers
              <span className="nums tabular-nums font-medium text-foreground">
                {intFmt(issuers)}
              </span>
            </span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
            {/* Emerald investors segment - anchored left. */}
            <div
              className="absolute inset-y-0 left-0 bg-emerald/80"
              style={{ width: `${investorPct}%` }}
            />
            {/* Gold issuers segment - stacked after investors. The left offset
                is the investors width so the two coloured segments sit
                contiguously and the remainder reads as the muted "other" track
                (the bg-foreground/[0.08] base) instead of a third painted band
                - keeps the bar calm with two brand accents + one neutral. */}
            <div
              className="absolute inset-y-0 bg-gold/80"
              style={{ left: `${investorPct}%`, width: `${issuerPct}%` }}
            />
          </div>
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {investorPct}% investors · {issuerPct}% issuers · {otherPct}% other
            <span className="nums tabular-nums font-medium text-foreground/80">
              {" "}({intFmt(otherParties)})
            </span>
          </span>
        </div>
      </div>

      <Link
        href={attentionHref}
        className="group/attention relative overflow-hidden rounded-xl bg-foreground/[0.035] p-3 ring-1 ring-hairline transition-all duration-300 ease-soft hover:bg-foreground/[0.055] hover:ring-gold/28"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-lg ring-1",
              kycExpiring > 0
                ? "bg-gold/[0.10] text-gold ring-gold/24"
                : "bg-emerald/[0.09] text-emerald ring-emerald/22",
            )}>
              {kycExpiring > 0 ? (
                <SealWarning weight="light" className="size-5" />
              ) : (
                <ShieldCheck weight="light" className="size-5" />
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] font-medium text-foreground">
                {attentionLabel}
              </span>
              <span className="truncate text-[12px] text-muted-foreground">
                {kycExpiring > 0
                  ? `Resolve re-KYC due within ${kycSoonDays} days`
                  : "Open the queue and continue the desk workflow"}
              </span>
            </span>
          </div>
          <ArrowRight
            weight="light"
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-soft group-hover/attention:translate-x-0.5 group-hover/attention:text-gold"
          />
        </div>
      </Link>

      {/* Secondary KPI grid */}
      <div className="mt-auto hidden grid-cols-2 gap-px overflow-hidden rounded-xl bg-hairline ring-1 ring-hairline md:grid lg:grid-cols-3">
        <SecondaryKpi
          label="Open deals"
          value={openDeals}
          tone="emerald"
          hint="Live mandates"
        />
        <SecondaryKpi
          label="Credit in progress"
          value={creditInProgress}
          tone="default"
          hint="Active analyses"
        />
        <SecondaryKpi
          label={`KYC ≤ ${kycSoonDays}d`}
          value={kycExpiring}
          tone={kycExpiring > 0 ? "gold" : "default"}
          hint="Re-KYC due soon"
          // On phones the 3-up secondary grid is 2-wide, so the third cell
          // would sit alone in a half-width row leaving a hole. Span it full
          // width on mobile only (lg:col-span-1 restores the 3-up desktop read).
          className="col-span-2 lg:col-span-1"
        />
      </div>
    </div>
  );
}

function SecondaryKpi({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "default" | "emerald" | "gold";
  className?: string;
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald"
      : tone === "gold"
        ? "text-gold"
        : "text-foreground";
  return (
    <div className={cn("group/kpi relative flex flex-col gap-1 bg-surface-2/40 px-4 py-4 transition-colors duration-300 ease-soft hover:bg-surface-2/70", className)}>
      <Eyebrow>{label}</Eyebrow>
      <CountUp
        value={value}
        format={intFmt}
        className={cn("text-[1.6rem] leading-none", toneClass)}
      />
      <span className="text-[11px] text-muted-foreground/80">{hint}</span>
    </div>
  );
}