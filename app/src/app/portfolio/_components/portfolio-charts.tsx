"use client";

import dynamicImport from "next/dynamic";

/**
 * Portfolio chart wrappers - the recharts surfaces exposed as CLIENT-ONLY
 * dynamic imports so recharts ships in a LAZY chunk fetched after first
 * paint instead of bloating each portfolio route's first-load JS. Mirrors
 * the reports' `report-charts.tsx` wrapper pattern.
 *
 * Why a wrapper module: `next/dynamic` with `ssr: false` is the only way to
 * force recharts into a separately-fetched lazy chunk, and `ssr: false` is
 * NOT allowed inside a Server Component (the portfolio pages are server
 * components). So this `"use client"` module owns the `dynamic(..., { ssr:
 * false })` calls - the server pages import THESE wrappers (client component
 * references), and the recharts implementation in `portfolio-charts-impl.tsx`
 * is only pulled in client-side, on demand, after hydration.
 *
 * The data-prop TYPES are re-exported here (type-only) so the server pages
 * keep typed prop plumbing without ever pulling recharts into the server
 * bundle - `import type` is erased at compile and evaluates no module scope.
 * All six chart wrappers share ONE recharts vendor chunk (every dynamic
 * import references the same impl module).
 */
export type {
  DonutPoint,
  LabelValuePoint,
  StackedPoint,
  GaugePoint,
} from "./portfolio-charts-impl";

export {
  SECTOR_PALETTE,
  EXPOSURE_TYPE_COLORS,
  EXPOSURE_TYPE_LABELS,
} from "./portfolio-charts-impl";

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

const DonutChartLazy = dynamicImport(
  () => import("./portfolio-charts-impl").then((m) => m.DonutChart),
  { ssr: false, loading: () => <ChartSkeleton height={260} /> },
);
const HBarChartLazy = dynamicImport(
  () => import("./portfolio-charts-impl").then((m) => m.HBarChart),
  { ssr: false, loading: () => <ChartSkeleton height={260} /> },
);
const StackedBarChartLazy = dynamicImport(
  () => import("./portfolio-charts-impl").then((m) => m.StackedBarChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);
const VBarChartLazy = dynamicImport(
  () => import("./portfolio-charts-impl").then((m) => m.VBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const RadialGaugeLazy = dynamicImport(
  () => import("./portfolio-charts-impl").then((m) => m.RadialGauge),
  { ssr: false, loading: () => <ChartSkeleton height={200} /> },
);

export const DonutChart = DonutChartLazy;
export const HBarChart = HBarChartLazy;
export const StackedBarChart = StackedBarChartLazy;
export const VBarChart = VBarChartLazy;
export const RadialGauge = RadialGaugeLazy;
