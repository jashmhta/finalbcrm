import {
  Skeleton,
  SkeletonCard,
  SkeletonPage,
} from "@/components/brand/skeleton";

/**
 * Investor-portal-route loading skeleton - mirrors the directory layout: a
 * header band, a KPI row, and a double-bezel table of skeleton rows. Streamed
 * instantly on navigation, before the force-dynamic `listInvestors()` query
 * against Neon resolves.
 */
export default function InvestorPortalLoading() {
  return (
    <SkeletonPage eyebrow="Investor portal" title="Investors" cards={0}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} header={false}>
            <div className="space-y-3 p-5">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-7 w-28 rounded-md" />
            </div>
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard>
        <div className="space-y-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl p-4">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/5 rounded-md" />
                <Skeleton className="h-3 w-1/3 rounded-md" />
              </div>
              <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-24 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </SkeletonPage>
  );
}
