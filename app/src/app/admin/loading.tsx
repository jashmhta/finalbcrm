import { SkeletonPage, SkeletonCard, Skeleton } from "@/components/brand/skeleton";

/**
 * Admin loading state - the instant-feedback shell mirrored on the admin
 * dashboard / users / roles / master-data / audit routes. The global
 * loading.tsx is the catch-all; this gives the admin routes a skeleton that
 * echoes the dashboard's KPI bento + table layout so navigation feels native.
 */
export default function AdminLoading() {
  return (
    <SkeletonPage
      title="Admin"
      eyebrow="System · Users · Roles · Audit"
      cards={0}
    >
      {/* KPI bento skeleton */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i}>
            <Skeleton className="mb-3 h-3 w-1/3 rounded-md" />
            <Skeleton className="mb-2 h-7 w-2/3 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
          </SkeletonCard>
        ))}
      </div>

      {/* Health + table skeleton */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SkeletonCard className="lg:col-span-2">
          <Skeleton className="mb-4 h-4 w-1/4 rounded-md" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="mb-4 h-4 w-1/3 rounded-md" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-xl" />
            ))}
          </div>
        </SkeletonCard>
      </div>

      <div className="mt-4">
        <SkeletonCard>
          <Skeleton className="mb-3 h-4 w-1/4 rounded-md" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        </SkeletonCard>
      </div>
    </SkeletonPage>
  );
}
