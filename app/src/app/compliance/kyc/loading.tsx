import {
  Skeleton,
  SkeletonCard,
  SkeletonPage,
} from "@/components/brand/skeleton";
import { cn } from "@/lib/utils";

/**
 * KYC-route loading skeleton - mirrors the compliance board layout: a stat
 * row above a multi-column lifecycle board. Streamed instantly on navigation,
 * before the force-dynamic `listKycRecords()` query against Neon resolves.
 */
export default function KycLoading() {
  return (
    <SkeletonPage eyebrow="PMLA · RBI Master Direction on KYC" title="KYC / AML" cards={0}>
      {/* Stat-card row - risk-rating / status summary cards. */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>

      {/* The board - lifecycle columns of stacked skeleton rows. Mirrors the
          real KycBoardView: a horizontal-scroll column group with a header bar
          per column and ~5 skeleton rows each. */}
      <SkeletonCard header={false}>
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[960px] gap-4"
            style={{
              gridTemplateColumns: `repeat(5, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: 5 }).map((_, col) => (
              <div key={col} className="space-y-3">
                <Skeleton className="h-4 w-3/4 rounded-md" />
                {Array.from({ length: 5 }).map((_, row) => (
                  <div
                    key={row}
                    className={cn(
                      "rounded-xl p-3 ring-1 ring-hairline/60",
                    )}
                  >
                    <Skeleton className="mb-2 h-3.5 w-2/3 rounded-md" />
                    <Skeleton className="mb-1.5 h-3 w-1/2 rounded-md" />
                    <Skeleton className="h-3 w-full rounded-md" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </SkeletonCard>
    </SkeletonPage>
  );
}
