"use client";

import * as React from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/brand/text";
import type { Density } from "@/components/brand/table";

/**
 * CommandBar - floating glass toolbar that sits above list pages. Backdrop
 * blur + hairline ring + floating shadow (it behaves as a sticky toolbar, so
 * blur is permitted under the GPU-discipline rule). Holds a search field,
 * arbitrary filter slots, an optional density toggle, and trailing actions.
 */
export interface CommandBarProps {
  /** Controlled search value. */
  search?: string;
  /** Search change handler. Omit to hide the search field. */
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Active density (Comfortable/Compact) - renders a segmented toggle. */
  density?: Density;
  onDensityChange?: (d: Density) => void;
  /** Filter slot - badges, selects, date pills. */
  filters?: React.ReactNode;
  /** Trailing actions (e.g. "New" button). */
  actions?: React.ReactNode;
  /** Eyebrow label rendered left of the search field. */
  label?: string;
  className?: string;
  /** Sticky position (defaults to floating). */
  sticky?: boolean;
  /**
   * Force the bar to stay visible (skip the scroll auto-hide) when the user is
   * actively filtering. The bar also stays visible automatically while the
   * search field has a non-empty query, so this is only needed for filter-only
   * states with no search text. Defaults to false.
   */
  keepVisible?: boolean;
  /**
   * Disable the mobile scroll auto-hide entirely. Useful when a page mounts
   * the CommandBar inside its own scroll container instead of the window.
   * Defaults to false.
   */
  disableScrollHide?: boolean;
}

/**
 * useCommandBarScrollHide - mobile-only scroll-direction auto-hide for the
 * floating CommandBar, mirroring the bottom nav in site-nav.tsx: passive
 * scroll listener, rAF throttling, 8px threshold, always visible near the top
 * (scrollY < 10). Only armed below the `md` breakpoint (768px) so the desktop
 * toolbar - which has more screen space - stays put. Returns true while the
 * bar should be hidden. Active search / `keepVisible` suppress hiding.
 */
function useCommandBarScrollHide(active: boolean): boolean {
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    // Don't arm the listener when the caller says the bar must stay visible
    // (active search / filter). Re-evaluate on every `active` change so
    // starting a query mid-scroll immediately pins the bar back.
    if (active) {
      setHidden(false);
      return;
    }
    const mql = window.matchMedia("(max-width: 767px)");
    let lastScrollY = window.scrollY;
    let ticking = false;
    const threshold = 8;
    function update() {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 10) {
        setHidden(false);
      } else if (currentScrollY > lastScrollY + threshold) {
        setHidden(true);
      } else if (currentScrollY < lastScrollY - threshold) {
        setHidden(false);
      }
      lastScrollY = currentScrollY;
      ticking = false;
    }
    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }
    // Only auto-hide on mobile. On desktop the toolbar has room and stays put.
    if (mql.matches) {
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    // Re-evaluate on viewport changes crossing the md breakpoint so a rotate
    // to desktop clears any hidden state and stops the listener, and a rotate
    // back to mobile arms it.
    function onBreakpoint(e: MediaQueryListEvent) {
      setHidden(false);
      if (e.matches) {
        window.addEventListener("scroll", onScroll, { passive: true });
      } else {
        window.removeEventListener("scroll", onScroll);
      }
    }
    mql.addEventListener("change", onBreakpoint);
    return () => {
      window.removeEventListener("scroll", onScroll);
      mql.removeEventListener("change", onBreakpoint);
    };
  }, [active]);
  return hidden && !active;
}

export function CommandBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  density,
  onDensityChange,
  filters,
  actions,
  label,
  className,
  sticky = false,
  keepVisible = false,
  disableScrollHide = false,
}: CommandBarProps) {
  // Active search query or explicit keepVisible pins the bar so the user can
  // keep interacting with results while scrolling. Skipped entirely when the
  // page opts out of the auto-hide behavior.
  const active = disableScrollHide || keepVisible || Boolean(search && search.trim().length > 0);
  const hidden = useCommandBarScrollHide(active);
  return (
    <div
      data-slot="brand-command-bar"
      className={cn(
        "z-20 flex flex-wrap items-center gap-2 rounded-lg bg-surface p-2 ring-1 ring-hairline shadow-soft",
        "transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        sticky && "sticky top-4",
        hidden
          ? "-translate-y-full opacity-0 pointer-events-none"
          : "translate-y-0 opacity-100",
        className,
      )}
    >
      {label ? (
        <span className="hidden pl-2 md:inline-flex">
          <Eyebrow>{label}</Eyebrow>
        </span>
      ) : null}

      {onSearchChange ? (
        <div className="relative flex h-9 min-w-[180px] flex-1 items-center">
          <MagnifyingGlass
            weight="light"
            className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={cn(
              "h-9 w-full rounded-full bg-foreground/[0.04] pl-9 pr-9 text-[13.5px] text-foreground",
              "ring-1 ring-transparent transition-all duration-200 ease-soft placeholder:text-muted-foreground/70",
              "focus:bg-foreground/[0.06] focus:ring-hairline focus:outline-none",
            )}
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute right-2 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <X weight="light" className="size-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {filters ? (
        <div className="flex flex-wrap items-center gap-2">{filters}</div>
      ) : null}

      {onDensityChange && density ? (
        <DensityToggle value={density} onChange={onDensityChange} />
      ) : null}

      {actions ? (
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

function DensityToggle({
  value,
  onChange,
}: {
  value: Density;
  onChange: (d: Density) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Row density"
      className="inline-flex items-center rounded-full bg-foreground/[0.05] p-0.5 ring-1 ring-hairline/60"
    >
      {(["comfortable", "compact"] as const).map((d) => {
        const active = value === d;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            aria-pressed={active}
            className={cn(
              "h-7 rounded-full px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] transition-all duration-200 ease-soft",
              active
                ? "bg-surface text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {d === "comfortable" ? "Std" : "Cmpct"}
          </button>
        );
      })}
    </div>
  );
}