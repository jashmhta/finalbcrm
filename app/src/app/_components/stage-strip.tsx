"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/brand/text";
import { compactINR } from "@/components/brand/money";

/**
 * Deals-by-stage strip - a wide horizontal rail of stage cards.
 *
 * The per-stage deal COUNT is rendered DIRECTLY from `stage.count` (no count-up
 * animation). These are critical pipeline numbers that must always read
 * correctly on Vercel serverless: the prior version gated a 0→value count-up on
 * `useInView`, and on serverless the SSR HTML shipped with `0` (the initial
 * state) for every stage while the IntersectionObserver-gated animation never
 * reliably settled - so the strip read "0 · 0 · 0 · …". Rendering the actual
 * value means the server-rendered HTML and the first client paint both show the
 * real count, and the staggered opacity/translate entry reveal (transform/opacity
 * only) still gives the strip its choreographed draw-in without ever touching the
 * number text. The exposure figure + share % + bar are likewise direct renders.
 */

const intFmt = (n: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
    : "-";

export interface StageCardData {
  status: string;
  label: string;
  count: number;
  exposure: number;
}

interface StageStripProps {
  stages: StageCardData[];
  totalOpen: number;
  totalExposure: number;
}

const EASE = [0.32, 0.72, 0, 1] as const;

export function StageStrip({ stages, totalOpen, totalExposure }: StageStripProps) {
  const maxCount = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1.5">
          <Eyebrow dot>Pipeline by stage</Eyebrow>
          <div className="flex items-baseline gap-3">
            <span className="nums text-[1.7rem] font-medium leading-none tabular-nums text-foreground">
              {intFmt(totalOpen)}
            </span>
            <span className="text-[12px] text-muted-foreground">
              open mandates ·{" "}
              <span className="nums tabular-nums text-foreground/80">
                {compactINR(totalExposure)}
              </span>{" "}
              target exposure
            </span>
          </div>
        </div>
        <span className="hidden text-[11px] uppercase tracking-[0.16em] text-muted-foreground md:inline">
          Lead → Allocation
        </span>
      </div>

      <motion.div
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
        }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15, margin: "-6%" }}
        // Mobile: a TOUCH-NATIVE horizontal-scroll stage strip - each stage is
        // a thumb-sized card that swipes left→right (the desk's pipeline reads
        // as a filmstrip, not a cramped 2-col grid that buckles under density).
        // md+ restores the grid of stage cards (4-up, 8-up on xl) so the
        // desktop board is unchanged. snap-x gives the strip a tactile stop on
        // each card; the rail hides its scrollbar for a clean strip read.
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4 xl:grid-cols-8 [&::-webkit-scrollbar]:hidden"
      >
        {stages.map((s) => (
          <StageCard
            key={s.status}
            stage={s}
            share={totalOpen > 0 ? s.count / totalOpen : 0}
            barShare={s.count / maxCount}
          />
        ))}
      </motion.div>

      {totalOpen === 0 ? (
        <p className="text-[15px] font-light text-muted-foreground">
          No open deals in the pipeline - the desk is quiet.
        </p>
      ) : null}
    </div>
  );
}

function StageCard({
  stage,
  share,
  barShare,
}: {
  stage: StageCardData;
  share: number;
  barShare: number;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.55, ease: EASE },
        },
      }}
      className={cn(
        // Mobile: a fixed-width snap card so the horizontal strip has a
        // tactile, thumb-sized target (~168px). md+ releases the fixed width
        // so the grid columns size fluidly again.
        "group relative flex snap-start flex-col gap-2.5 overflow-hidden rounded-xl px-4 py-4 md:py-3.5",
        "min-w-[168px] shrink-0 md:min-w-0 md:shrink",
        "bg-surface-2/40 ring-1 ring-hairline transition-all duration-300 ease-soft",
        "hover:bg-surface-2/70 hover:ring-emerald/30",
      )}
    >
      {/* Emerald hover accent */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-emerald transition-transform duration-300 ease-soft group-hover:scale-x-100"
      />
      <Eyebrow className="text-[10px] tracking-[0.12em]">{stage.label}</Eyebrow>
      <div className="flex items-baseline gap-2">
        {/* Direct render - the real count, always. No count-up, no 0 placeholder. */}
        <span className="nums text-[1.6rem] font-medium leading-none tabular-nums text-foreground">
          {intFmt(stage.count)}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {Math.round(share * 100)}%
        </span>
      </div>
      <span className="nums text-[11.5px] tabular-nums text-muted-foreground/80">
        {compactINR(stage.exposure)}
      </span>
      <div className="relative mt-0.5 h-1 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
        {/* Direct width - the real share of the max-count stage. No count-up so
            the bar paints at its true proportion in the SSR HTML. */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald to-gold"
          style={{ width: `${Math.round(barShare * 100)}%` }}
        />
      </div>
    </motion.div>
  );
}
