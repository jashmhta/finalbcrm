"use client";

import dynamicImport from "next/dynamic";

/**
 * Report chart wrappers - the recharts surfaces exposed as CLIENT-ONLY
 * dynamic imports so recharts ships in a LAZY chunk fetched after first
 * paint instead of bloating each report route's first-load JS. Mirrors the
 * dashboard's `dashboard-charts.tsx` wrapper pattern.
 *
 * Why a wrapper module: `next/dynamic` with `ssr: false` is the only way to
 * force recharts into a separately-fetched lazy chunk, and `ssr: false` is
 * NOT allowed inside a Server Component (the report pages are server
 * components). So this `"use client"` module owns the `dynamic(..., { ssr:
 * false })` calls - the server pages import THESE wrappers (client component
 * references), and the recharts implementation in `report-charts-impl.tsx` is
 * only pulled in client-side, on demand, after hydration.
 *
 * The data-prop TYPES are re-exported here (type-only) so the server pages
 * keep typed prop plumbing without ever pulling recharts into the server
 * bundle - `import type` is erased at compile and evaluates no module scope.
 * All four chart wrappers share ONE recharts vendor chunk (every dynamic
 * import references the same impl module).
 */
export type {
  LabelCountPoint,
  LabelValuePoint,
  ConsentStackPoint,
} from "./report-charts-impl";

/** Placeholder painted inside each chart Card while the recharts chunk is
 *  fetched + parsed. Pure markup, no JS - reserves layout to prevent CLS. */
function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div
      aria-hidden
      className="animate-pulse rounded-xl bg-foreground/[0.04]"
      style={{ height }}
    />
  );
}

const CountBarChartLazy = dynamicImport(
  () => import("./report-charts-impl").then((m) => m.CountBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const HorizontalBarChartLazy = dynamicImport(
  () => import("./report-charts-impl").then((m) => m.HorizontalBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const AreaTrendChartLazy = dynamicImport(
  () => import("./report-charts-impl").then((m) => m.AreaTrendChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const StackedBarChartLazy = dynamicImport(
  () => import("./report-charts-impl").then((m) => m.StackedBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const CountBarChart = CountBarChartLazy;
export const HorizontalBarChart = HorizontalBarChartLazy;
export const AreaTrendChart = AreaTrendChartLazy;
export const StackedBarChart = StackedBarChartLazy;
