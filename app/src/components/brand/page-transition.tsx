"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * PageTransition - a keyed fade (+ slight slide) wrapper around the route
 * `children` in the root layout.
 *
 * Why: every route is `force-dynamic`, so the real content streams in after
 * the Neon query resolves. The route `loading.tsx` Suspense fallback gives the
 * INSTANT skeleton feedback; once the server responds, this wrapper fades the
 * real content in so the handoff from skeleton → content reads as a deliberate
 * motion, not a hard pop.
 *
 * DELIBERATELY no exit animation: an exit phase (esp. with AnimatePresence
 * `mode="wait"`) would delay the incoming skeleton by the exit duration,
 * undermining the "skeleton within 100ms" goal. Instead the old route unmounts
 * immediately on pathname change and the new route mounts with
 * `initial={{opacity:0}}` → `animate={{opacity:1}}`, so the skeleton is
 * mounted and visibly fading in within the first frame.
 *
 * The `key` is the pathname so segment changes (e.g. /parties → /parties/[id])
 * re-trigger the fade while same-path searchParam changes (pagination,
 * filters) do NOT - searchParams don't change the pathname, so the key stays
 * stable and filtering doesn't re-animate the whole page.
 *
 * Honors prefers-reduced-motion via Framer Motion's `useReducedMotion` - when
 * reduced, the slide collapses to a pure fade and the duration shortens.
 */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  return (
    <motion.div
      key={pathname}
      className={cn("flex flex-1 flex-col", className)}
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }
      }
    >
      {children}
    </motion.div>
  );
}