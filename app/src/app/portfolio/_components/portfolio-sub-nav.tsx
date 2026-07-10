"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartBar,
  Scales,
  Crosshair,
  Vault,
  type Icon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

/**
 * Portfolio sub-nav - the four sibling pages under /portfolio, rendered as a
 * floating glass pill of tab segments. A client component because the active
 * tab is derived from `usePathname` (the layout is a server component and
 * cannot read the pathname). The nav items are declared here (icon + label +
 * href) so phosphor icons - a client-only concern per the project's "use
 * client" boundary for phosphor - never touch the server bundle. No props
 * cross the RSC boundary.
 *
 * Active match: `/portfolio` exact for Overview; prefix match for the three
 * sub-routes. The active segment gets an inset gold pill + a gold dot; the
 * others are hairline-quiet.
 */
interface PortfolioNavDef {
  href: string;
  icon: Icon;
  label: string;
  /** Exact match (Overview) vs prefix match (the sub-routes). */
  exact?: boolean;
}

const NAV_ITEMS: readonly PortfolioNavDef[] = [
  { href: "/portfolio", icon: ChartBar, label: "Overview", exact: true },
  { href: "/portfolio/concentration", icon: Scales, label: "Concentration" },
  { href: "/portfolio/risk-metrics", icon: Crosshair, label: "Risk metrics" },
  { href: "/portfolio/limits", icon: Vault, label: "Limits" },
];

export function PortfolioSubNav() {
  const pathname = usePathname();

  const isActive = (item: PortfolioNavDef): boolean => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <nav
      aria-label="Portfolio sections"
      className={cn(
        // Floating detached pill - the design system's nav archetype, scaled
        // down to a sub-nav. backdrop-blur is allowed (this is a sticky-ish
        // top element, not scrolling content).
        "mx-auto flex w-fit max-w-full flex-wrap items-center gap-1",
        "rounded-full bg-foreground/[0.03] p-1 ring-1 ring-hairline/70 backdrop-blur-xl",
      )
    }
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item);
        const IconCmp = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12.5px] font-medium transition-all duration-300 ease-soft md:px-4",
              active
                ? "bg-gold/15 text-gold-deep ring-1 ring-gold/30"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            <IconCmp
              weight={active ? "fill" : "light"}
              className={cn("size-4 shrink-0", active ? "text-gold" : "text-muted-foreground")}
            />
            <span className="whitespace-nowrap">{item.label}</span>
            {active ? (
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-gold shadow-[0_0_8px] shadow-gold/60"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}