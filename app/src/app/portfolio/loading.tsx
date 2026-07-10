import { SkeletonPage } from "@/components/brand";

// Portfolio route loading fallback - the double-bezel + gold-shimmer page
// skeleton so navigation into /portfolio and its sub-pages gets instant
// feedback instead of a blank screen while the force-dynamic aggregate
// queries run.
export default function PortfolioLoading() {
  return <SkeletonPage />;
}
