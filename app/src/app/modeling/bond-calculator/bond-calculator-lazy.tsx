"use client";

import dynamicImport from "next/dynamic";
import * as React from "react";

/**
 * BondCalculator - lazy, client-only entry for the flagship bond pricing
 * calculator.
 *
 * The calculator's price-yield chart is rendered with recharts (~360KB), which
 * is otherwise bundled into the `/modeling/bond-calculator` route's first-load
 * JS. `next/dynamic` with `ssr: false` is the only way to force recharts into
 * a separately-fetched lazy chunk, and `ssr: false` is NOT allowed inside a
 * Server Component (the page is one). So this `"use client"` module owns the
 * `dynamic(..., { ssr: false })` call - the server page imports THIS wrapper
 * (a client component reference), and the full calculator + recharts ship in a
 * lazy chunk fetched after first paint.
 *
 * The page header + back button are server-rendered, so they paint immediately;
 * only the calculator itself defers until the chunk arrives, with a calm
 * skeleton reserving layout to prevent CLS.
 */
const BondCalculatorLazy = dynamicImport(
  () => import("./bond-calculator").then((m) => m.BondCalculator),
  {
    ssr: false,
    loading: () => <BondCalculatorSkeleton />,
  },
);

export function BondCalculator() {
  return <BondCalculatorLazy />;
}

/**
 * Placeholder painted while the calculator chunk is fetched + parsed. Reserves
 * the calculator's approximate footprint (inputs card + chart + schedule) so
 * the page never collapses/jumps when the real calculator hydrates. Pure
 * markup, no JS.
 */
function BondCalculatorSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {/* Inputs + results row placeholder. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="h-[420px] w-full animate-pulse rounded-2xl bg-foreground/[0.04] ring-1 ring-hairline" />
        </div>
        <div className="lg:col-span-7">
          <div className="h-[420px] w-full animate-pulse rounded-2xl bg-foreground/[0.04] ring-1 ring-hairline" />
        </div>
      </div>
      {/* Chart card placeholder. */}
      <div className="h-[380px] w-full animate-pulse rounded-2xl bg-foreground/[0.04] ring-1 ring-hairline" />
    </div>
  );
}
