"use client";

import dynamicImport from "next/dynamic";
import * as React from "react";

/**
 * Dashboard visualization wrappers - five brand-themed recharts surfaces
 * (deal velocity, sector exposure donut, credit-score distribution, KYC
 * status donut, investor-type donut) exposed as CLIENT-ONLY dynamic imports so
 * recharts ships in a LAZY chunk fetched after first paint instead of bloating
 * the `/` route's first-load JS.
 *
 * Why a wrapper module: `next/dynamic` with `ssr: false` is the only way to
 * force recharts into a separately-fetched lazy chunk, and `ssr: false` is NOT
 * allowed inside a Server Component (the dashboard page is one). So this
 * `"use client"` module owns the `dynamic(..., { ssr: false })` calls - the
 * server page imports THESE wrappers (client component references), and the
 * recharts implementation in `dashboard-charts-impl.tsx` is only pulled in
 * client-side, on demand, after hydration.
 *
 * The data-prop TYPES are re-exported here (type-only) so the server page can
 * keep its typed prop plumbing without ever pulling recharts into the server
 * bundle - `import type` is erased at compile and evaluates no module scope.
 *
 * The `loading` skeleton reserves each chart's full height (header band + the
 * chart body) so the bento layout never collapses/jumps when the real charts
 * hydrate. All five share ONE recharts vendor chunk (every dynamic import
 * references the same impl module), so loading any one of them caches the
 * chunk for the rest.
 */
export type {
  DealVelocityPoint,
  SectorSlice,
  CreditBandSlice,
  KycStatusSlice,
  InvestorTypeSlice,
} from "./dashboard-charts-impl";

/**
 * Placeholder painted inside each chart Card while the recharts chunk is
 * fetched + parsed. Pure markup, no JS - reserves layout to prevent CLS.
 * `bodyClass` sizes the shimmer to the chart's reserved height.
 */
function ChartSkeleton({ bodyClass = "h-[220px] md:h-[250px]" }: { bodyClass?: string }) {
  return (
    <div className="flex h-full flex-col" aria-hidden>
      {/* Header band - eyebrow + title placeholder. */}
      <div className="flex flex-col gap-3 px-5 pt-5 md:flex-row md:items-start md:justify-between md:px-6 md:pt-6">
        <div className="flex flex-col gap-2">
          <span className="h-[11px] w-[7rem] rounded-full bg-foreground/[0.07]" />
          <span className="h-[15px] w-[9rem] rounded-full bg-foreground/[0.07]" />
        </div>
        <span className="hidden h-[15px] w-[3.5rem] rounded-full bg-foreground/[0.07] md:block" />
      </div>
      {/* Chart body - reserves height so the bento row never collapses. */}
      <div className="flex flex-1 items-center justify-center px-3 pb-4 pt-3">
        <div className={`animate-pulse rounded-xl bg-foreground/[0.04] ${bodyClass} w-full`} />
      </div>
    </div>
  );
}

// Each dynamic import pulls the shared impl module (one recharts chunk). The
// `.then(m => m.X)` selects the named export; the whole module loads once and
// is cached for the other four.
const DealVelocityChartLazy = dynamicImport(
  () => import("./dashboard-charts-impl").then((m) => m.DealVelocityChart),
  { ssr: false, loading: () => <ChartSkeleton bodyClass="h-[220px] md:h-[260px]" /> },
);
const SectorDonutLazy = dynamicImport(
  () => import("./dashboard-charts-impl").then((m) => m.SectorDonut),
  { ssr: false, loading: () => <ChartSkeleton bodyClass="h-[180px] md:h-[200px]" /> },
);
const CreditScoreChartLazy = dynamicImport(
  () => import("./dashboard-charts-impl").then((m) => m.CreditScoreChart),
  { ssr: false, loading: () => <ChartSkeleton bodyClass="h-[220px] md:h-[250px]" /> },
);
const KycStatusChartLazy = dynamicImport(
  () => import("./dashboard-charts-impl").then((m) => m.KycStatusChart),
  { ssr: false, loading: () => <ChartSkeleton bodyClass="h-[180px] md:h-[200px]" /> },
);
const InvestorTypeChartLazy = dynamicImport(
  () => import("./dashboard-charts-impl").then((m) => m.InvestorTypeChart),
  { ssr: false, loading: () => <ChartSkeleton bodyClass="h-[180px] md:h-[200px]" /> },
);

/**
 * Drop-in exports the dashboard page consumes. Props are identical to the
 * recharts implementations - serializable data + scalars, no function props
 * cross the RSC boundary.
 */
export const DealVelocityChart = DealVelocityChartLazy;
export const SectorDonut = SectorDonutLazy;
export const CreditScoreChart = CreditScoreChartLazy;
export const KycStatusChart = KycStatusChartLazy;
export const InvestorTypeChart = InvestorTypeChartLazy;
