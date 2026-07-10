import { SkeletonPage } from "@/components/brand";

// Reports route loading fallback - the double-bezel + gold-shimmer page
// skeleton so navigation into /reports and its detail pages gets instant
// feedback instead of a blank screen while the force-dynamic queries run.
export default function ReportsLoading() {
  return <SkeletonPage />;
}
