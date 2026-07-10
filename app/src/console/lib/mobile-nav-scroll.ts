/**
 * Pure helpers for mobile bottom-nav hide/show while the desk main scrolls.
 *
 * Behavior (shipped):
 *  - Near top of scroll: always visible
 *  - While user is scrolling the desk: hidden
 *  - After idle (no scroll events for IDLE_MS): visible again
 *  - Scroll-down/up deltas also drive hide immediately for responsiveness
 */

export const MOBILE_NAV_IDLE_MS = 220;
export const MOBILE_NAV_TOP_REVEAL_PX = 16;
export const MOBILE_NAV_SCROLL_THRESHOLD_PX = 4;

export interface MobileNavScrollInput {
  scrollTop: number;
  lastScrollTop: number;
  currentlyVisible: boolean;
  /** true when this call is a scroll event (not idle timer) */
  isScrolling: boolean;
  topRevealPx?: number;
  thresholdPx?: number;
}

export interface MobileNavScrollResult {
  visible: boolean;
  lastScrollTop: number;
  /** schedule a show-after-idle when true */
  armIdleShow: boolean;
}

/**
 * Compute next visibility from a desk-main scroll event or idle tick.
 * Pure — unit-tested without DOM.
 */
export function nextMobileNavVisible(
  input: MobileNavScrollInput,
): MobileNavScrollResult {
  const topReveal = input.topRevealPx ?? MOBILE_NAV_TOP_REVEAL_PX;
  const threshold = input.thresholdPx ?? MOBILE_NAV_SCROLL_THRESHOLD_PX;
  const top = Math.max(0, input.scrollTop);

  if (top <= topReveal) {
    return {
      visible: true,
      lastScrollTop: top,
      armIdleShow: false,
    };
  }

  if (input.isScrolling) {
    const delta = top - input.lastScrollTop;
    // Any meaningful movement while not at top → hide during scroll
    if (Math.abs(delta) >= threshold || input.currentlyVisible) {
      return {
        visible: false,
        lastScrollTop: top,
        armIdleShow: true,
      };
    }
    return {
      visible: false,
      lastScrollTop: top,
      armIdleShow: true,
    };
  }

  // Idle tick: restore
  return {
    visible: true,
    lastScrollTop: top,
    armIdleShow: false,
  };
}

/** Class names applied when nav is hidden (must match shell + CSS). */
export const MOBILE_NAV_HIDDEN_CLASS = "c-mobile-nav--hidden";
export const MOBILE_NAV_ROOT_CLASS = "c-mobile-nav";
export const MOBILE_NAV_ITEM_CLASS = "c-mobile-nav__item";
export const MOBILE_NAV_ITEM_ACTIVE_CLASS = "c-mobile-nav__item--active";
export const MOBILE_NAV_DOCK_CLASS = "c-mobile-nav__dock";
