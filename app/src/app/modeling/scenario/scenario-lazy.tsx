"use client";

import dynamicImport from "next/dynamic";
import * as React from "react";

/**
 * ScenarioDesk - lazy, client-only entry for the scenario & sensitivity desk.
 *
 * The desk uses framer-motion + recharts, which ship in a lazy chunk fetched
 * after first paint (ssr:false keeps them out of the route's first-load JS).
 * `ssr:false` is not allowed inside a Server Component, so this `"use
 * client"` module owns the `dynamic(..., { ssr:false })` call - the server
 * page imports THIS wrapper, and the full desk defers until the chunk
 * arrives. The page header + back button are server-rendered, so they paint
 * immediately; a calm skeleton reserves layout to prevent CLS.
 */
const ScenarioDeskLazy = dynamicImport(
  () => import("./scenario").then((m) => m.ScenarioDesk),
  {
    ssr: false,
    loading: () => <ScenarioSkeleton />,
  },
);

export function ScenarioDesk() {
  return <ScenarioDeskLazy />;
}

function ScenarioSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="h-[480px] w-full animate-pulse rounded-2xl bg-foreground/[0.04] ring-1 ring-hairline" />
        </div>
        <div className="lg:col-span-8">
          <div className="h-[480px] w-full animate-pulse rounded-2xl bg-foreground/[0.04] ring-1 ring-hairline" />
        </div>
      </div>
      <div className="h-[320px] w-full animate-pulse rounded-2xl bg-foreground/[0.04] ring-1 ring-hairline" />
    </div>
  );
}
