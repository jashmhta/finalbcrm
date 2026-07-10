import { SkeletonCard, SkeletonPage, Skeleton } from "@/components/brand";

// AI insights route loading fallback - the double-bezel + gold-shimmer page
// skeleton that mirrors the hub layout (a hero next-actions card + a split of
// client-insight cards and a recent-summaries rail) so navigation into /ai
// gets instant feedback instead of a blank screen while the force-dynamic
// aggregate queries run.
export default function AiLoading() {
  return (
    <SkeletonPage
      eyebrow="AI · Insights"
      title="AI insights"
      cards={0}
    >
      {/* Hero next-actions card skeleton. */}
      <SkeletonCard className="mb-5 md:mb-6" lines={4} />

      {/* Split: client insights (left) + recent summaries (right). */}
      <div className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SkeletonCard className="h-full">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          </SkeletonCard>
        </div>
        <div className="lg:col-span-5">
          <SkeletonCard className="h-full" lines={6} />
        </div>
      </div>
    </SkeletonPage>
  );
}
