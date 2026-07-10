import {
  Skeleton,
  SkeletonCard,
  SkeletonPage,
} from "@/components/brand/skeleton";
import { cn } from "@/lib/utils";

/**
 * Parties-route loading skeleton - mirrors the list + preview-pane explorer
 * layout. A two-column shell: a list of skeleton rows on the left, a
 * double-bezel preview pane on the right. Streamed instantly on navigation,
 * before the force-dynamic `listParties()` + `getPartyPreview()` queries
 * against Neon resolve.
 */
export default function PartiesLoading() {
  return (
    <SkeletonPage
      eyebrow="Relationship master"
      title="Parties"
      cards={0}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        {/* List column - a double-bezel card wrapping stacked skeleton rows
            (avatar + name + meta + relationship tag). */}
        <SkeletonCard header={false}>
          <div className="space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl p-3"
              >
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2 rounded-md" />
                  <Skeleton className="h-3 w-2/3 rounded-md" />
                </div>
                <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </SkeletonCard>

        {/* Preview pane - a double-bezel card with an avatar header, a name
            bar, and stacked meta rows. */}
        <div className="hidden lg:block">
          <SkeletonCard header={false}>
            <div className="mb-5 flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
              </div>
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className={cn(
                    "h-3 rounded-md",
                    i === 4 ? "w-1/2" : "w-full",
                  )}
                />
              ))}
            </div>
          </SkeletonCard>
        </div>
      </div>
    </SkeletonPage>
  );
}
