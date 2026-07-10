import {
  SkeletonBoard,
  SkeletonCard,
  SkeletonPage,
} from "@/components/brand/skeleton";

/**
 * Deals-route loading skeleton - mirrors the real pipeline board layout
 * (grouped columns of deal cards) so the loading state reads as "the board is
 * arriving", not a generic spinner. Streamed instantly from the route Suspense
 * boundary on navigation, before the force-dynamic `getDealPipeline()` query
 * against Neon resolves.
 */
export default function DealsLoading() {
  return (
    <SkeletonPage eyebrow="Deals" title="Deal pipeline" cards={0}>
      {/* Stat-card row - the pipeline summary cards above the board. */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
      {/* The board - 5 stage columns of stacked deal-card skeletons. On
          mobile the board scrolls horizontally, so we cap the columns at 5
          and let the grid overflow. */}
      <div className="overflow-x-auto pb-4">
        <SkeletonBoard
          columns={5}
          cardsPerColumn={4}
          className="min-w-[900px]"
        />
      </div>
    </SkeletonPage>
  );
}
