import { cn } from "@/console/lib/cn";

export function CSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--c-radius)] bg-[var(--c-surface-2)]",
        className,
      )}
      aria-hidden
    />
  );
}

export function CHomeSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <CSkeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CSkeleton key={i} className="h-[104px]" />
        ))}
      </div>
      <CSkeleton className="h-48 w-full" />
    </div>
  );
}
