/**
 * Pure helpers for horizontal swipe → adjacent mobile console nav route.
 *
 * Gesture:
 *  - Swipe left  (dx negative, finger moves left) → next tab
 *  - Swipe right (dx positive) → previous tab
 *  - Ignore mostly-vertical pans (scroll)
 */

export const SWIPE_MIN_DX_PX = 56;
export const SWIPE_MAX_DY_RATIO = 0.75; // |dy| must be < |dx| * ratio

export type SwipeDirection = "left" | "right" | null;

export function swipeDirectionFromDelta(
  dx: number,
  dy: number,
  minDx = SWIPE_MIN_DX_PX,
  maxDyRatio = SWIPE_MAX_DY_RATIO,
): SwipeDirection {
  if (Math.abs(dx) < minDx) return null;
  if (Math.abs(dy) > Math.abs(dx) * maxDyRatio) return null;
  return dx < 0 ? "left" : "right";
}

/**
 * Normalize path for matching nav hrefs (/console, /console/parties/xyz → parties).
 */
export function navIndexForPath(
  pathname: string,
  hrefs: readonly string[],
): number {
  const path = pathname.replace(/\/$/, "") || "/console";
  // Prefer longest matching href prefix (detail routes still map to parent)
  let best = -1;
  let bestLen = -1;
  for (let i = 0; i < hrefs.length; i++) {
    const h = hrefs[i]!.replace(/\/$/, "") || "/console";
    if (path === h || (h !== "/console" && path.startsWith(`${h}/`))) {
      if (h.length > bestLen) {
        best = i;
        bestLen = h.length;
      }
    } else if (path === h) {
      best = i;
      bestLen = h.length;
    }
  }
  // Exact home
  if (best < 0 && (path === "/console" || path === "/console/")) {
    const home = hrefs.findIndex((h) => h === "/console" || h === "/console/");
    return home;
  }
  return best;
}

/**
 * Next href for swipe direction. Wraps at ends.
 */
export function adjacentSwipeHref(
  pathname: string,
  hrefs: readonly string[],
  direction: Exclude<SwipeDirection, null>,
): string | null {
  if (hrefs.length < 2) return null;
  const idx = navIndexForPath(pathname, hrefs);
  if (idx < 0) {
    // Not on a swipeable route — go to first or last
    return direction === "left" ? hrefs[0]! : hrefs[hrefs.length - 1]!;
  }
  const next =
    direction === "left"
      ? (idx + 1) % hrefs.length
      : (idx - 1 + hrefs.length) % hrefs.length;
  const href = hrefs[next]!;
  // Don't navigate to same path
  const path = pathname.replace(/\/$/, "") || "/console";
  const target = href.replace(/\/$/, "") || "/console";
  if (path === target) return null;
  return href;
}

/** Build ordered swipe chain from full nav (primary first, then rest, unique). */
export function buildSwipeHrefs(
  mobilePrimary: { href: string }[],
  fullNav: { href: string }[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...mobilePrimary, ...fullNav]) {
    const h = item.href.replace(/\/$/, "") || "/console";
    if (seen.has(h)) continue;
    // Skip pure utility that shouldn't be in swipe loop? Keep search optional
    seen.add(h);
    out.push(item.href.startsWith("/console") ? item.href : h);
  }
  // Always include More hub at end for discoverability
  if (!seen.has("/console/more")) {
    out.push("/console/more");
  }
  return out;
}
