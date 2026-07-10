"use client";

import dynamicImport from "next/dynamic";
import * as React from "react";

/**
 * ExposureChart - the dashboard's hero chart, exposed as a CLIENT-ONLY dynamic
 * import so recharts (~360KB) ships in a LAZY chunk fetched after first paint
 * instead of bloating the `/` route's first-load JS.
 *
 * Why a wrapper: `next/dynamic` with `ssr: false` is the only way to force
 * recharts into a separately-fetched lazy chunk, and `ssr: false` is NOT
 * allowed inside a Server Component (the dashboard page is one). So this
 * `"use client"` module owns the `dynamic(..., { ssr: false })` call - the
 * server page imports THIS wrapper (a client component reference), and the
 * recharts implementation in `exposure-chart-impl.tsx` is only pulled in
 * client-side, on demand, after hydration.
 *
 * The `ExposurePoint` TYPE is re-exported here (type-only) so the server page
 * can keep its typed prop plumbing without ever pulling recharts into the
 * server bundle - `import type` is erased at compile and evaluates no module
 * scope.
 *
 * The `loading` skeleton reserves the chart's full height (header band +
 * 300px mobile / 380px md+ area) so the bento layout never collapses/jumps
 * when the real chart hydrates. The desk sees the bezel + ambient halo (the
 * parent Card is server-rendered) + a calm shimmer field immediately; the
 * recharts area + count-up header draw in once the lazy chunk arrives.
 */
export type { ExposurePoint } from "./exposure-chart-impl";

/**
 * Placeholder painted inside the hero chart Card while the recharts chunk is
 * fetched + parsed. Pure markup, no JS - reserves layout to prevent CLS.
 */
function ExposureChartSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-hidden>
      {/* Header band - eyebrow + totals placeholder (matches the impl). */}
      <div className="flex flex-col gap-4 px-5 pt-5 md:px-6 md:pt-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
              Exposure · last 12 months
            </span>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <div className="flex items-baseline gap-2">
                <span className="nums h-[1.9rem] w-[5.5rem] rounded-md bg-foreground/[0.06]" />
                <span className="text-[12px] text-muted-foreground/60">
                  booked exposure
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="nums h-[1.15rem] w-[2.5rem] rounded-md bg-foreground/[0.06]" />
                <span className="text-[12px] text-muted-foreground/60">
                  new mandates
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Chart body - reserves 300px / 380px so the bento row never collapses. */}
      <div className="relative flex-1 px-2.5 pb-3 pt-3 md:px-1.5 md:pb-2">
        <div className="relative h-[300px] w-full md:h-[380px]">
          <div className="absolute inset-0 animate-pulse rounded-xl bg-foreground/[0.04]" />
        </div>
      </div>
    </div>
  );
}

const ExposureChartLazy = dynamicImport(
  () => import("./exposure-chart-impl").then((m) => m.ExposureChart),
  {
    ssr: false,
    loading: () => <ExposureChartSkeleton />,
  },
);

/**
 * Drop-in export the dashboard page consumes. Props are identical to the
 * recharts implementation - serializable data + scalars, no function props
 * cross the RSC boundary.
 */
export const ExposureChart = ExposureChartLazy;
