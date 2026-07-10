import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Skeleton - the brand loading-state primitive.
 *
 * A double-bezel machined enclosure (matching `Card`) whose inner core carries
 * the gold-tinted shimmer sweep defined in globals.css (`.bc-shimmer`). The
 * sweep gives INSTANT navigation feedback: the moment a `<Link>` is clicked,
 * Next.js streams this skeleton from the nearest `loading.tsx` Suspense
 * boundary while the force-dynamic server route runs its Neon query - no blank
 * screen, no perceived lag.
 *
 * Three composable shapes:
 *   - `Skeleton`        - a single shimmering bar/block (the atom).
 *   - `SkeletonCard`    - a full double-bezel card shell with a header + body
 *                         of stacked skeleton lines, for stat cards / panels.
 *   - `SkeletonBoard`   - a multi-column board skeleton (deals / KYC pipeline).
 *
 * All are pure CSS + Tailwind (no Framer Motion) so they paint on first frame
 * and honor `prefers-reduced-motion` (the global rule collapses the animation
 * to a static gold-tinted block).
 */

/** A single shimmering block. Width/height/radius are className-driven. */
export const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden
    data-slot="brand-skeleton"
    className={cn(
      "bc-shimmer rounded-md text-transparent",
      className,
    )}
    {...props}
  />
));
Skeleton.displayName = "Skeleton";

/**
 * SkeletonCard - a double-bezel card shell with a header row (eyebrow + title
 * bar) and a body of stacked skeleton lines. Drop-in stand-in for a `Card` +
 * `StatCard` while the real content loads.
 */
export function SkeletonCard({
  className,
  lines = 3,
  shellRadius = "2xl",
  header = true,
  children,
}: {
  className?: string;
  /** Number of body lines to stack. Ignored when `children` is provided. */
  lines?: number;
  shellRadius?: "2xl" | "3xl" | "xl";
  /** Render the eyebrow + title-bar header. Defaults true; set false when
   *  composing a fully custom interior via `children`. */
  header?: boolean;
  /** Custom interior. When provided, replaces the stacked-lines body so a
   *  route loading state can mirror an arbitrary real layout (list rows,
   *  preview pane, table). */
  children?: React.ReactNode;
}) {
  const outer =
    shellRadius === "3xl"
      ? "rounded-3xl"
      : shellRadius === "xl"
        ? "rounded-md"
        : "rounded-lg";
  const inner =
    shellRadius === "3xl"
      ? "rounded-[calc(var(--radius-3xl)-0.375rem)]"
      : shellRadius === "xl"
        ? "rounded-[calc(var(--radius-xl)-0.375rem)]"
        : "rounded-[calc(var(--radius-2xl)-0.375rem)]";

  return (
    <div
      aria-hidden
      data-slot="brand-skeleton-card"
      className={cn(
        "relative isolate bg-foreground/[0.055] p-1.5 ring-1 ring-hairline shadow-shell",
        outer,
        className,
      )}
    >
      <div
        className={cn(
          "bg-surface p-5 shadow-inset-hi",
          inner,
        )}
      >
        {header && (
          <>
            {/* Header - a tiny eyebrow + a title bar. */}
            <Skeleton className="mb-2 h-2.5 w-16 rounded-full opacity-70" />
            <Skeleton className="mb-5 h-4 w-2/3 rounded-md" />
          </>
        )}
        {children ? (
          children
        ) : (
          /* Body - stacked lines of varying width so the skeleton reads as
             content, not a ruled form. */
          <div className="space-y-2.5">
            {Array.from({ length: lines }).map((_, i) => (
              <Skeleton
                key={i}
                className={cn(
                  "h-3 rounded-md",
                  i === lines - 1 ? "w-1/2" : i === 0 ? "w-full" : "w-4/5",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * SkeletonBoard - a multi-column pipeline board skeleton (deals / KYC). Renders
 * `columns` columns of stacked skeleton cards so the loading state mirrors the
 * real board layout instead of a generic spinner.
 */
export function SkeletonBoard({
  columns = 5,
  cardsPerColumn = 4,
  className,
}: {
  columns?: number;
  cardsPerColumn?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      data-slot="brand-skeleton-board"
      className={cn(
        "grid gap-4",
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: columns }).map((_, col) => (
        <div key={col} className="space-y-3">
          {/* Column header bar. */}
          <Skeleton className="h-4 w-3/4 rounded-md" />
          {Array.from({ length: cardsPerColumn }).map((_, row) => (
            <SkeletonCard
              key={row}
              lines={3}
              shellRadius="xl"
              className="bg-transparent shadow-soft"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * SkeletonPage - a full route skeleton: a heading block (eyebrow + title +
 * description) followed by a row of `cards` stat cards and a body slot. The
 * global `loading.tsx` and per-route `loading.tsx` files compose this into the
 * instant-feedback shell users see on navigation.
 */
export function SkeletonPage({
  eyebrow = "Loading",
  title = "Loading",
  cards = 4,
  children,
  className,
}: {
  eyebrow?: string;
  title?: string;
  cards?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1400px] px-4 py-6 md:px-10 md:py-10 lg:px-16",
        className,
      )}
    >
      {/* Heading - a real (non-shimmer) eyebrow + title so screen readers +
          headless captures announce the route, with a shimmering description
          bar to signal "content is arriving". */}
      <div className="mb-6 md:mb-8">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        <Skeleton className="mt-3 h-3 w-full max-w-2xl rounded-md" />
        <Skeleton className="mt-2 h-3 w-full max-w-xl rounded-md" />
      </div>

      {/* Stat-card row. */}
      {cards > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cards }).map((_, i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
      )}

      {children}
    </div>
  );
}
