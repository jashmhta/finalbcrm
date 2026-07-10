"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
// Static import → the logo is bundled to /_next/static/media/<hash>.png, which
// the auth proxy excludes from its matcher (src/proxy.ts). A public-folder
// /logo.png URL would be redirected to /login by the proxy for unauthenticated
// viewers (e.g. on /login), so we static-import instead. The public/logo.png
// copy is retained for OG/social metadata.
import logoSrc from "./logo.png";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useMotionValueEvent,
  animate,
} from "framer-motion";
import {
  Gauge,
  Users,
  Handshake,
  ShieldCheck,
  Calculator,
  SealCheck,
  Chats,
  ListChecks,
  FileText,
  SignOut,
  CaretDown,
  CaretLeft,
  CaretRight,
  ArrowRight,
  DotsThree,
  Plugs,
  X,
  Crosshair,
  Lightning,
  UserPlus,
  Bell,
  MagnifyingGlass,
  ChartBar,
  Gear,
  ChartPie,
  Sparkle,
  Building,
  UserCircle,
  CalendarBlank,
  type IconProps,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { logout } from "@/app/actions/auth";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
// Self-contained alerts bell - fetches its own data via a server action, so it
// composes cleanly inside this client SiteNav without server→client prop
// threading. Wired into the desktop sidebar bottom cluster + the mobile More
// sheet.
import { NotificationBell } from "@/components/notification-bell";

type IconType = React.ForwardRefExoticComponent<
  IconProps & React.RefAttributes<SVGSVGElement>
>;

interface NavItem {
  href: string;
  label: string;
  /** Short label for the mobile bottom-nav tabs (defaults to `label`). The
      bottom nav is space-constrained, so the Dashboard route shows "Home" and
      the Credit Analysis route shows "Credit" here. The full `label` stays
      the accessible name via aria-label, so screen readers still announce
      "Dashboard" / "Credit Analysis". */
  shortLabel?: string;
  icon: IconType;
}

// Grouped product IA — Stripe/Linear density, not a flat 20-row dump.
// Primary mobile tabs stay CRM core; everything else lives in More.
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "CRM",
    items: [
      { href: "/", label: "Dashboard", shortLabel: "Home", icon: Gauge },
      { href: "/parties", label: "Parties", icon: Users },
      { href: "/deals", label: "Deals", icon: Handshake },
      {
        href: "/credit",
        label: "Credit",
        shortLabel: "Credit",
        icon: ShieldCheck,
      },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/leads", label: "Leads", icon: Lightning },
      { href: "/matching", label: "Matching", icon: Crosshair },
      { href: "/onboarding", label: "Onboarding", icon: UserPlus },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/modeling", label: "Modeling", icon: Calculator },
      { href: "/compliance/kyc", label: "Compliance", icon: SealCheck },
      { href: "/interactions", label: "Interactions", icon: Chats },
      { href: "/tasks", label: "Tasks", icon: ListChecks },
      { href: "/documents", label: "Documents", icon: FileText },
      { href: "/calendar", label: "Calendar", icon: CalendarBlank },
      { href: "/notifications", label: "Alerts", icon: Bell },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: ChartBar },
      { href: "/portfolio", label: "Portfolio", icon: ChartPie },
      { href: "/ai", label: "AI", icon: Sparkle },
      { href: "/integrations", label: "Integrations", icon: Plugs },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin", label: "Admin", icon: Gear },
      { href: "/portal/investor", label: "Investors", icon: Building },
      { href: "/portal/client", label: "Clients", icon: UserCircle },
    ],
  },
];

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

// Mobile bottom-nav: CRM core on the island; rest in More sheet.
const PRIMARY_ITEMS = NAV_GROUPS[0].items;
const MORE_ITEMS: NavItem[] = NAV_GROUPS.slice(1).flatMap((g) => g.items);

// ─── Sidebar collapse geometry ─────────────────────────────────────────────
// The sidebar width is driven by a `--sidebar-w` CSS variable (set on
// <html>) so the fixed <aside> and the body's `md:pl-[var(--sidebar-w)]` are
// literally the same value - they can never drift apart. A motion value
// animates 256↔64 px on toggle and writes the var each frame (in rem), so the
// collapse animation moves the sidebar and the main content in lockstep.
//
// An inline script in src/app/layout.tsx sets `--sidebar-w` pre-hydration from
// the same localStorage key the toggle persists to, so the very first paint is
// already at the user's last width - no flash, no layout shift on reload.
const SIDEBAR_EXPANDED_PX = 256; // w-64 = 16rem
const SIDEBAR_COLLAPSED_PX = 64; // w-16 = 4rem
const pxToRem = (px: number) => `${px / 16}rem`;

interface SiteNavProps {
  user?: {
    email?: string | null;
    name?: string | null;
    roles?: string[] | null;
  } | null;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initialsOf(name?: string | null, email?: string | null): string {
  const src = (name ?? email ?? "").trim();
  if (!src) return "·";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function LogoMark() {
  // Real Binary CRM logo (gold mark on transparent) in a hairline-ringed
  // glass square - the same machined-bezel container as the rest of the shell,
  // so the brand mark reads as part of the sidebar, not a flat bitmap.
  return (
    <span
      aria-hidden
      className="relative inline-flex size-7 items-center justify-center overflow-hidden rounded-lg ring-1 ring-hairline bg-surface/40 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--foreground)_12%,transparent)]"
    >
      <Image
        src={logoSrc}
        alt=""
        width={28}
        height={28}
        priority
        className="h-full w-full object-contain p-[3px]"
      />
    </span>
  );
}

// Sidebar search / ⌘K trigger. Dispatches the same `open-command-palette`
// CustomEvent the command palette listens for, and keeps the ⌘K / Ctrl+K
// keydown listener so the keyboard shortcut works regardless of where focus
// lives. In the collapsed sidebar it renders as a lone magnifier icon; in the
// expanded sidebar it reads as a "Search … ⌘K" pill - the Linear/Notion
// affordance.
function SidebarSearchTrigger({ collapsed }: { collapsed: boolean }) {
  const open = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-command-palette"));
    }
  }, []);
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search and command palette"
      title={collapsed ? "Search (⌘K)" : undefined}
      className={cn(
        "group/search flex h-9 items-center gap-2.5 rounded-md text-[13px] text-muted-foreground transition-colors duration-200 ease-soft hover:bg-foreground/5 hover:text-foreground",
        collapsed ? "justify-center px-0" : "px-3",
      )}
    >
      <MagnifyingGlass
        weight="light"
        className="size-[18px] shrink-0"
      />
      {!collapsed ? (
        <>
          <span>Search…</span>
          <kbd className="nums ml-auto rounded-md bg-foreground/5 px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-muted-foreground ring-1 ring-hairline">
            ⌘K
          </kbd>
        </>
      ) : null}
    </button>
  );
}

// A single sidebar nav row. Active: gold tint + hairline gold ring + a left
// gold accent bar (the Linear/Notion "you are here" cue). Inactive: muted
// text with a quiet hover wash. Collapsed: icon-only, centered, with a native
// tooltip + aria-label so the full name is still discoverable.
function SidebarNavItem({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group/item relative flex h-9 items-center rounded-md text-[13px] font-medium transition-colors duration-200 ease-soft",
        collapsed ? "justify-center px-0" : "gap-3 px-3",
        active
          ? "bg-gold/10 text-gold"
          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-gold"
        />
      ) : null}
      <Icon
        weight={active ? "fill" : "regular"}
        className={cn(
          "size-[18px] shrink-0",
          active
            ? "text-gold"
            : "text-muted-foreground group-hover/item:text-foreground",
        )}
      />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}

function canSeeCredit(roles: string[] | null | undefined): boolean {
  if (!roles?.length) return false;
  if (roles.includes("super_admin") || roles.includes("admin")) return true;
  if (roles.includes("credit_analyst") || roles.includes("director")) return true;
  // CEO: credit analysis inactive for general employees unless explicitly enabled
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_CREDIT_ANALYSIS_ACTIVE === "true") {
    return true;
  }
  return false;
}

export function SiteNav({ user }: SiteNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const showCredit = canSeeCredit(user?.roles ?? null);
  const navGroups = React.useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter(
          (item) => showCredit || item.href !== "/credit",
        ),
      })).filter((g) => g.items.length > 0),
    [showCredit],
  );
  const navItems = React.useMemo(
    () => navGroups.flatMap((g) => g.items),
    [navGroups],
  );
  const primaryItems = navGroups[0]?.items ?? PRIMARY_ITEMS;
  const moreItems = React.useMemo(
    () => navGroups.slice(1).flatMap((g) => g.items),
    [navGroups],
  );

  // ─── Sidebar collapse state ──────────────────────────────────────────────
  // `collapsed` drives the icon-only vs. full-word rendering of every sidebar
  // row. The width itself is a motion value that animates on toggle and
  // publishes to `--sidebar-w` each frame; layout.tsx seeds that var
  // pre-hydration from the same localStorage key, so first paint is correct.
  const [collapsed, setCollapsed] = React.useState(false);
  const sidebarWidth = useMotionValue(SIDEBAR_EXPANDED_PX);

  // Publish the animated width to the `--sidebar-w` CSS var. Both the fixed
  // <aside> (width: var(--sidebar-w)) and the body (md:pl-[var(--sidebar-w)])
  // consume it, so they animate as one.
  useMotionValueEvent(sidebarWidth, "change", (v) => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--sidebar-w", pxToRem(v));
  });

  // Animate the width on every collapse toggle (256 ↔ 64 px, 300ms ease-soft).
  React.useEffect(() => {
    const controls = animate(
      sidebarWidth,
      collapsed ? SIDEBAR_COLLAPSED_PX : SIDEBAR_EXPANDED_PX,
      { duration: 0.3, ease: [0.32, 0.72, 0, 1] },
    );
    return () => controls.stop();
  }, [collapsed, sidebarWidth]);

  // Restore the saved collapse state once on mount. The width is snapped (not
  // animated) so a reload never replays the collapse animation - the inline
  // script in layout.tsx has already painted the right width, and we just sync
  // the motion value + state to match.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let saved = false;
    try {
      saved = window.localStorage.getItem("sidebar-collapsed") === "1";
    } catch {
      saved = false;
    }
    if (saved) {
      setCollapsed(true);
      sidebarWidth.set(SIDEBAR_COLLAPSED_PX);
    }
  }, [sidebarWidth]);

  // Persist the collapse preference so it survives reloads (the inline script
  // reads it pre-hydration for a flash-free restore).
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "sidebar-collapsed",
        collapsed ? "1" : "0",
      );
    } catch {
      /* ignore quota / privacy-mode failures */
    }
  }, [collapsed]);

  // Mobile scroll-direction auto-hide. Scrolling down hides the bottom nav
  // (maximizes content space); scrolling up reveals it. Always visible near
  // the top (scrollY < 10). The More bottom sheet pins the nav visible while
  // open so the X stays tappable to close. The scroll listener is passive
  // (read-only) so it never blocks the main thread.
  const [navHidden, setNavHidden] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const threshold = 8;
    let lastScrollY = window.scrollY;
    let ticking = false;
    function update() {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 10) {
        setNavHidden(false);
      } else if (currentScrollY > lastScrollY + threshold) {
        setNavHidden(true);
      } else if (currentScrollY < lastScrollY - threshold) {
        setNavHidden(false);
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
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Effective hidden state: the scroll detector can hide, but the open More
  // sheet forces visible.
  const hidden = navHidden && !moreOpen;

  // Lock body scroll while the mobile "More" bottom sheet is open. (Syncs to
  // an external system - document.body - so this is a legitimate effect; no
  // setState.)
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = moreOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  // Close the More sheet on any route change so navigation (including back /
  // forward) never leaves the sheet dangling over a new page.
  React.useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Escape closes the More sheet - mirrors the keyboard affordance the
  // desktop dropdown menus get from base-ui.
  React.useEffect(() => {
    if (!moreOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  // Don't render the app chrome on the login page. Hooks above run
  // unconditionally so hook order is stable across renders.
  // Console is a parallel frontend with its own shell - hide legacy chrome.
  if (pathname === "/login" || pathname.startsWith("/console")) return null;

  const closeMore = () => setMoreOpen(false);
  const moreActive = moreItems.some((i) => isActive(pathname, i.href));

  return (
    <>
      {/* ──────────────────────────────────────────────────────────────────
          DESKTOP - fixed left sidebar (Ethereal Glass). Replaces the old
          floating top pill with a professional Linear/Stripe/Notion-style
          sidebar: logo + search at the top, the full nav as a vertical list,
          and the alerts bell + account menu at the bottom.
          Collapsible to icon-only via the edge button; the width is driven by
          the `--sidebar-w` CSS var so the body content offset animates in
          lockstep. Hidden on mobile (<md), where the bottom island + More
          sheet take over.
         ────────────────────────────────────────────────────────────────── */}
      <aside
        aria-label="Primary"
        style={{ width: "var(--sidebar-w)" }}
        className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-hairline bg-sidebar md:flex"
      >
        {/* Collapse toggle - straddles the sidebar's right edge so it never
            eats internal width (the 64px collapsed rail stays clean). Icon
            flips CaretLeft ↔ CaretRight to signal the direction. */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-7 z-50 inline-flex size-6 items-center justify-center rounded-full bg-surface/80 text-muted-foreground shadow-nav ring-1 ring-hairline backdrop-blur-xl transition-colors duration-200 ease-soft hover:bg-foreground/10 hover:text-foreground"
        >
          {collapsed ? (
            <CaretRight weight="light" className="size-3.5" />
          ) : (
            <CaretLeft weight="light" className="size-3.5" />
          )}
        </button>

        {/* Header - logo + wordmark. Links to the dashboard at "/" (there is
            no /dashboard route; the root page.tsx is the dashboard). */}
        <div className="shrink-0 p-3">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2.5 rounded-md transition-colors duration-200 ease-soft hover:bg-foreground/5",
              collapsed ? "justify-center px-0 py-1" : "px-2 py-1",
            )}
          >
            <LogoMark />
            {!collapsed ? (
              <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground">
                Binary CRM
              </span>
            ) : null}
          </Link>
        </div>

        {/* Search / ⌘K trigger (Linear-style). */}
        <div className="shrink-0 px-2">
          <SidebarSearchTrigger collapsed={collapsed} />
        </div>

        {/* Grouped workspace nav — section labels when expanded; dividers when collapsed. */}
        <nav
          aria-label="Workspace"
          className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-hairline [&::-webkit-scrollbar-track]:bg-transparent"
        >
          {navGroups.map((group, gi) => (
            <div key={group.label} className={cn(gi > 0 && "mt-2")}>
              {collapsed ? (
                gi > 0 ? (
                  <div aria-hidden className="mx-2 mb-1.5 h-px bg-hairline/60" />
                ) : null
              ) : (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                  {group.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <SidebarNavItem
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom cluster - alerts bell + account menu (with
            sign-out). Collapses to a centered icon column when the sidebar is
            rail-width. The account menu keeps its dropdown so the full name /
            email / sign-out affordance is preserved. */}
        <div className="shrink-0 border-t border-hairline/60 p-2">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <NotificationBell />
            </div>
          ) : (
            <div className="flex items-center gap-1 px-1 pb-1">
              <NotificationBell />
            </div>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label="Account menu"
                    className={cn(
                      "flex items-center gap-2.5 rounded-md transition-colors duration-200 ease-soft hover:bg-foreground/5",
                      collapsed ? "justify-center px-0 py-1.5" : "px-2 py-1.5",
                    )}
                  />
                }
              >
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-gold text-[11px] font-semibold text-on-gold ring-1 ring-hairline">
                  {initialsOf(user.name, user.email)}
                </span>
                {!collapsed ? (
                  <span className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="truncate text-[12.5px] font-medium text-foreground">
                      {user.name && user.name !== user.email
                        ? user.name
                        : (user.email ?? "Member").split("@")[0]}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {user.email}
                    </span>
                  </span>
                ) : null}
                {!collapsed ? (
                  <CaretDown
                    weight="light"
                    className="size-3 shrink-0 text-muted-foreground"
                  />
                ) : null}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="min-w-56 rounded-md bg-popover/90 p-1.5 ring-1 ring-hairline backdrop-blur-xl"
              >
                {/* base-ui 1.6.0 requires Menu.Item / Menu.GroupLabel to be
                    nested inside a Menu.Group (MenuGroupContext), otherwise it
                    throws Base UI error #31 on open. The plain <div> user-info
                    block and the separator stay outside the group - only the
                    label + the Sign out item need the group wrapper. */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Account
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <div className="flex flex-col gap-0.5 px-3 pb-2 pt-1">
                  <span className="text-[13.5px] font-medium text-foreground">
                    {user.name ?? "Member"}
                  </span>
                  <span className="nums truncate text-[12px] text-muted-foreground">
                    {user.email}
                  </span>
                </div>
                <DropdownMenuSeparator className="bg-hairline" />
                <form id="nav-logout-form" action={logout} />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => {
                      const form = document.getElementById(
                        "nav-logout-form",
                      ) as HTMLFormElement | null;
                      form?.requestSubmit();
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-foreground outline-none transition-colors duration-150 focus:bg-foreground/5"
                  >
                    <SignOut
                      weight="light"
                      className="size-4 text-muted-foreground"
                    />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className={cn(
                "flex items-center gap-1.5 rounded-md bg-gold text-[12.5px] font-medium text-on-gold transition-all duration-300 ease-soft hover:shadow-lift active:scale-[0.98]",
                collapsed ? "justify-center px-0 py-1.5" : "px-3 py-1.5",
              )}
            >
              <ArrowRight weight="light" className="size-3.5" />
              {!collapsed ? "Sign in" : null}
            </Link>
          )}
        </div>
      </aside>

      {/* ──────────────────────────────────────────────────────────────────
          MOBILE - bottom liquid-glass nav island. Five rounded tabs, each an
          icon with a tiny text label below it (Home / Parties / Deals /
          Credit / More): four primary routes + a "More" trigger that opens
          the bottom sheet below. Fixed to the bottom edge, centered, hidden
          on ≥ md where the left sidebar takes over. z-40 keeps it above the
          More sheet backdrop (z-30) so the More button stays tappable to
          close. The row is horizontally scrollable (scrollbar hidden) as a
          defensive measure if a future tab count outgrows the viewport, and
          capped to viewport width so it never clips off-screen.
         ────────────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed bottom-4 left-1/2 z-40 -translate-x-1/2 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:hidden",
          hidden
            ? "pointer-events-none translate-y-[calc(100%+1rem)] opacity-0"
            : "translate-y-0 opacity-100",
        )}
      >
        <nav
          aria-label="Mobile primary"
          className="flex max-w-[calc(100vw-2rem)] items-center gap-0.5 overflow-x-auto rounded-full bg-surface/82 p-1.5 ring-1 ring-hairline shadow-nav backdrop-blur-xl supports-[backdrop-filter]:bg-surface/72 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {primaryItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            // Short text label under the icon (e.g. "Home", "Credit"). The
            // full label stays the accessible name via aria-label above so
            // screen readers announce "Dashboard" / "Credit Analysis".
            const mobileLabel = item.shortLabel ?? item.label;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMore}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "relative flex w-14 shrink-0 flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors duration-200 ease-soft",
                  active
                    ? "bg-gold/15 text-gold ring-1 ring-gold/30 shadow-[0_0_18px] shadow-gold/30"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                )}
              >
                <Icon weight="light" className="size-5" />
                <span className="text-[9px] font-medium leading-none">
                  {mobileLabel}
                </span>
              </Link>
            );
          })}

          {/* More → opens the bottom sheet. Morphs dots → X while open.
              Carries a gold active state when the current route lives in
              the More sheet (so the user always sees "you are here"). While
              open, the button switches to a neutral-elevated press state so
              the X reads as a close affordance, not a "selected" route. The
              "More" text label sits under the icon, matching the primary
              tabs so the row reads as a single tab bar. */}
          <button
            type="button"
            aria-label={moreOpen ? "Close menu" : "Open more navigation"}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "relative flex w-14 shrink-0 flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors duration-200 ease-soft",
              moreOpen
                ? "bg-foreground/10 text-foreground ring-1 ring-hairline"
                : moreActive
                  ? "bg-gold/10 text-gold ring-1 ring-gold/20"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {moreOpen ? (
                <motion.span
                  key="more-x"
                  initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                  transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                  className="flex size-5 items-center justify-center"
                >
                  <X weight="light" className="size-5" />
                </motion.span>
              ) : (
                <motion.span
                  key="more-dots"
                  initial={{ opacity: 0, rotate: 90, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: -90, scale: 0.6 }}
                  transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                  className="flex size-5 items-center justify-center"
                >
                  <DotsThree weight="light" className="size-5" />
                </motion.span>
              )}
            </AnimatePresence>
            <span className="text-[9px] font-medium leading-none">More</span>
          </button>
        </nav>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          MOBILE - "More" bottom sheet. Slides up from the bottom edge with
          the remaining routes + the account cluster (avatar, name, email,
          sign-out). Two AnimatePresence roots so the backdrop fade and the
          panel slide animate independently. Both md:hidden.

          The panel is a flex column capped at calc(100dvh - 7rem) so it never
          overflows the viewport; the route list is the flex-1 scroll region
          (overflow-y-auto) so a long More list scrolls inside the sheet
          instead of pushing the account cluster off-screen.

          z-stack: backdrop z-30 (above page chrome, which tops out at z-20
          so sticky toolbars / FABs don't bleed through), bottom nav z-40
          (above the backdrop so the More button stays tappable to close),
          sheet panel z-50 (above everything).
         ────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {moreOpen ? (
          <motion.div
            key="more-backdrop"
            onClick={closeMore}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-sm md:hidden"
            aria-hidden
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {moreOpen ? (
          <motion.div
            key="more-sheet"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-24 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 md:hidden"
            role="dialog"
            aria-label="More navigation"
          >
            <div className="flex max-h-[calc(100dvh-7rem)] flex-col rounded-3xl bg-surface/88 p-2 ring-1 ring-hairline shadow-floating backdrop-blur-xl supports-[backdrop-filter]:bg-surface/82">
              {/* Grabber - the machined cue that this is a draggable sheet. */}
              <div
                aria-hidden
                className="mx-auto mb-1 h-1 w-9 shrink-0 rounded-full bg-foreground/15"
              />
              {/* Alerts bell - self-contained, shows the unread count badge so
                  the user sees escalations without leaving the More sheet. The
                  full Notifications route also appears in the nav list below. */}
              <div className="flex shrink-0 items-center justify-between gap-2 rounded-2xl px-3 py-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Alerts
                </span>
                <NotificationBell />
              </div>
              <div className="shrink-0 px-3 py-1.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  More
                </span>
              </div>
              {/* Route list - scrolls inside the sheet when it overflows. */}
              <nav
                aria-label="Mobile secondary"
                className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-hairline [&::-webkit-scrollbar-track]:bg-transparent"
              >
                {moreItems.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMore}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] transition-colors duration-200 ease-soft",
                        active
                          ? "bg-gold/15 text-gold ring-1 ring-gold/30"
                          : "text-foreground hover:bg-foreground/5",
                      )}
                    >
                      <Icon
                        weight="light"
                        className={cn(
                          "size-5",
                          active ? "text-gold" : "text-muted-foreground",
                        )}
                      />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Account cluster + sign-out. The seed/admin authorize callback
                  stamps `name = email`, so only render the name line when it
                  actually differs from the email - otherwise the cluster would
                  show the same address twice. */}
              {user ? (
                <div className="mt-1 shrink-0 border-t border-hairline/60 p-1">
                  <div className="flex items-center gap-3 rounded-2xl px-3 py-2">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold/80 to-gold-deep/80 text-[11px] font-semibold text-ink ring-1 ring-hairline">
                      {initialsOf(user.name, user.email)}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      {user.name && user.name !== user.email ? (
                        <>
                          <span className="truncate text-[13px] font-medium text-foreground">
                            {user.name}
                          </span>
                          <span className="nums truncate text-[12px] text-muted-foreground">
                            {user.email}
                          </span>
                        </>
                      ) : (
                        <span className="nums truncate text-[13px] font-medium text-foreground">
                          {user.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <form action={logout}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-[13px] font-medium text-foreground transition-colors duration-200 ease-soft hover:bg-foreground/5"
                    >
                      <SignOut
                        weight="light"
                        className="size-4 text-muted-foreground"
                      />
                      Sign out
                    </button>
                  </form>
                </div>
              ) : (
                <div className="mt-1 shrink-0 border-t border-hairline/60 p-1">
                  <Link
                    href="/login"
                    onClick={closeMore}
                    className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-gold px-3 py-2.5 text-[13px] font-medium text-on-gold transition-all duration-300 ease-soft hover:shadow-lift active:scale-[0.98]"
                  >
                    Sign in
                    <ArrowRight weight="light" className="size-4" />
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}