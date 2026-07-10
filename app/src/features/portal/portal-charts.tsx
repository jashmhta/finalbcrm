"use client";

// Portal chart wrappers - the recharts surfaces exposed as CLIENT-ONLY dynamic
// imports so recharts ships in a LAZY chunk fetched after first paint instead
// of bloating each portal route's first-load JS. Mirrors the portfolio +
// reports chart-wrapper pattern.
//
// Why a wrapper module: `next/dynamic` with `ssr: false` is the only way to
// force recharts into a separately-fetched lazy chunk, and `ssr: false` is NOT
// allowed inside a Server Component (the portal pages are server components).
// So this `"use client"` module owns the `dynamic(..., { ssr: false })` calls -
// the server pages import THESE wrappers (client component references), and the
// recharts implementation in `portal-charts-impl.tsx` is only pulled in
// client-side, on demand, after hydration.
//
// The data-prop TYPES are re-exported here (type-only) so the server pages keep
// typed prop plumbing without ever pulling recharts into the server bundle -
// `import type` is erased at compile and evaluates no module scope. All three
// chart wrappers share ONE recharts vendor chunk (every dynamic import
// references the same impl module).

import dynamicImport from "next/dynamic";

export type { DonutPoint, LabelValuePoint } from "./portal-charts-impl";

export { PORTAL_PALETTE } from "./portal-charts-impl";

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

const DonutLazy = dynamicImport(
  () => import("./portal-charts-impl").then((m) => m.PortalDonutChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);
const HBarLazy = dynamicImport(
  () => import("./portal-charts-impl").then((m) => m.PortalHBarChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);
const VBarLazy = dynamicImport(
  () => import("./portal-charts-impl").then((m) => m.PortalVBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const PortalDonutChart = DonutLazy;
export const PortalHBarChart = HBarLazy;
export const PortalVBarChart = VBarLazy;
