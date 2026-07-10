import { CSkeleton } from "@/console/primitives/skeleton";

/** Instant shell feedback while desk routes stream. */
export default function ConsoleDeskLoading() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200" aria-busy>
      <div className="space-y-2">
        <CSkeleton className="h-3 w-24" />
        <CSkeleton className="h-8 w-56" />
        <CSkeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CSkeleton key={i} className="h-24 rounded-[var(--c-radius-lg)]" />
        ))}
      </div>
      <CSkeleton className="h-64 w-full rounded-[var(--c-radius-lg)]" />
    </div>
  );
}
