"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { SignOut, MagnifyingGlass, CaretLeft, CaretRight } from "@phosphor-icons/react";

import logoSrc from "@/components/logo.png";
import { cn } from "@/console/lib/cn";
import {
  brandLabel,
  mobilePrimaryNav,
  type ConsoleBrand,
  type NavItemDef,
} from "@/console/rbac/nav";
import {
  MOBILE_NAV_DOCK_CLASS,
  MOBILE_NAV_HIDDEN_CLASS,
  MOBILE_NAV_IDLE_MS,
  MOBILE_NAV_ITEM_ACTIVE_CLASS,
  MOBILE_NAV_ITEM_CLASS,
  MOBILE_NAV_ROOT_CLASS,
  nextMobileNavVisible,
} from "@/console/lib/mobile-nav-scroll";
import {
  adjacentSwipeHref,
  buildSwipeHrefs,
  swipeDirectionFromDelta,
} from "@/console/lib/mobile-nav-swipe";
import { NavIcon } from "./icons";
import { AlertsButton } from "./alerts-button";
import { CBadge } from "@/console/primitives/badge";
import { CommandPalette } from "@/console/patterns/command-palette";

export interface ConsoleShellUser {
  name?: string | null;
  email?: string | null;
  roles: string[];
  desk?: string | null;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/console") return pathname === "/console";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name?: string | null, email?: string | null): string {
  const src = (name ?? email ?? "").trim();
  if (!src) return "·";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function ConsoleShell({
  brand,
  nav,
  user,
  unreadCount = 0,
  children,
}: {
  brand: ConsoleBrand;
  nav: NavItemDef[];
  user: ConsoleShellUser;
  /** Unread alerts for header / sidebar badge */
  unreadCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [mobileNavVisible, setMobileNavVisible] = React.useState(true);
  const mobile = mobilePrimaryNav(nav);
  const lastScrollTopRef = React.useRef(0);
  const idleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mainRef = React.useRef<HTMLElement | null>(null);
  const touchStartRef = React.useRef<{ x: number; y: number; t: number } | null>(
    null,
  );
  const swipeHrefs = React.useMemo(
    () => buildSwipeHrefs(mobile, nav),
    [mobile, nav],
  );

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Zero legacy root body pad/sidebar offset while console is mounted.
  React.useEffect(() => {
    document.body.classList.add("console-active");
    document.documentElement.style.setProperty("--sidebar-w", "0px");
    return () => {
      document.body.classList.remove("console-active");
      document.documentElement.style.removeProperty("--sidebar-w");
    };
  }, []);

  // Horizontal swipe on mobile desk → previous / next nav module
  React.useEffect(() => {
    const el =
      mainRef.current ??
      (document.querySelector(".c-desk-scroll") as HTMLElement | null);
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0]!;
      touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    };

    const onEnd = (e: TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start || e.changedTouches.length !== 1) return;
      // Ignore multi-second holds / form interactions
      if (Date.now() - start.t > 800) return;
      const t = e.changedTouches[0]!;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dir = swipeDirectionFromDelta(dx, dy);
      if (!dir) return;
      // Don't steal swipes starting on interactive controls
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, button, a, [role='dialog'], [data-no-swipe]",
        )
      ) {
        return;
      }
      const href = adjacentSwipeHref(pathname, swipeHrefs, dir);
      if (href) router.push(href);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [pathname, router, swipeHrefs]);

  // Hide liquid-glass dock while desk main is scrolling; restore after idle.
  React.useEffect(() => {
    let cancelled = false;
    let el: HTMLElement | null = null;

    const clearIdle = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const applyVisible = (visible: boolean) => {
      if (cancelled) return;
      setMobileNavVisible(visible);
      // Durable DOM signal for tests / CSS hooks (not only React class timing)
      document.documentElement.dataset.consoleMobileNav = visible
        ? "visible"
        : "hidden";
      const nav = document.querySelector(".c-mobile-nav");
      if (nav) {
        nav.classList.toggle(MOBILE_NAV_HIDDEN_CLASS, !visible);
        nav.setAttribute("data-visible", visible ? "true" : "false");
      }
    };

    const onScroll = () => {
      if (!el) return;
      const scrollTop = el.scrollTop;
      const next = nextMobileNavVisible({
        scrollTop,
        lastScrollTop: lastScrollTopRef.current,
        currentlyVisible: true,
        isScrolling: true,
      });
      lastScrollTopRef.current = next.lastScrollTop;
      applyVisible(next.visible);
      clearIdle();
      if (next.armIdleShow) {
        idleTimerRef.current = setTimeout(() => {
          if (!el || cancelled) return;
          const idle = nextMobileNavVisible({
            scrollTop: el.scrollTop,
            lastScrollTop: lastScrollTopRef.current,
            currentlyVisible: false,
            isScrolling: false,
          });
          lastScrollTopRef.current = idle.lastScrollTop;
          applyVisible(idle.visible);
        }, MOBILE_NAV_IDLE_MS);
      }
    };

    // Retry attach — main ref may lag one frame after route change
    const attach = () => {
      el =
        mainRef.current ??
        (document.querySelector(".c-desk-scroll") as HTMLElement | null);
      if (!el) return false;
      el.addEventListener("scroll", onScroll, { passive: true });
      // touch/wheel on the desk also count as "scrolling" for mobile UX
      el.addEventListener("wheel", onScroll, { passive: true });
      el.addEventListener("touchmove", onScroll, { passive: true });
      return true;
    };

    if (!attach()) {
      const t = window.setTimeout(() => {
        attach();
      }, 50);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
        clearIdle();
      };
    }

    return () => {
      cancelled = true;
      clearIdle();
      if (el) {
        el.removeEventListener("scroll", onScroll);
        el.removeEventListener("wheel", onScroll);
        el.removeEventListener("touchmove", onScroll);
      }
      delete document.documentElement.dataset.consoleMobileNav;
    };
  }, [pathname]);

  const brandName = brandLabel(brand);

  return (
    <div
      className="console-root flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden"
      data-brand={brand}
      style={
        {
          ["--sidebar-current" as string]: collapsed
            ? "var(--c-sidebar-collapsed)"
            : "var(--c-sidebar)",
        } as React.CSSProperties
      }
    >
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[var(--c-line)] bg-[var(--c-surface)] md:flex",
          "transition-[width] duration-[var(--c-dur)] ease-[var(--c-ease)]",
        )}
        style={{ width: "var(--sidebar-current)" }}
        aria-label="Primary"
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-[var(--c-line)] px-3">
          <span className="flex size-8 items-center justify-center overflow-hidden rounded-[10px] ring-1 ring-[var(--c-line)]">
            <Image src={logoSrc} alt="" width={28} height={28} className="object-contain p-0.5" />
          </span>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold tracking-tight text-[var(--c-ink)]">
                {brandName}
              </p>
              <p className="truncate text-[11px] text-[var(--c-ink-3)]">Console</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto flex size-8 items-center justify-center rounded-lg text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <CaretRight size={16} /> : <CaretLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="flex flex-col gap-0.5">
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={item.label}
                    prefetch
                    className={cn(
                      "group relative flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-[var(--c-accent-soft)] text-[var(--c-accent)]"
                        : "text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]",
                    )}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1.5 h-6 w-[3px] rounded-r bg-[var(--c-accent)]" />
                    ) : null}
                    <span className="relative shrink-0">
                      <NavIcon
                        name={item.icon}
                        className="size-[18px]"
                        weight={active ? "fill" : "regular"}
                      />
                      {item.icon === "alerts" && unreadCount > 0 ? (
                        <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--c-bad)] px-0.5 text-[8px] font-bold text-white">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      ) : null}
                    </span>
                    {!collapsed ? (
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                        <span className="truncate">{item.label}</span>
                        {item.icon === "alerts" && unreadCount > 0 ? (
                          <span className="ml-auto shrink-0 rounded-full bg-[var(--c-bad)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-[var(--c-line)] p-2">
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className={cn(
              "mb-2 flex h-9 w-full items-center gap-2 rounded-[10px] px-2.5 text-[12px] text-[var(--c-ink-3)]",
              "ring-1 ring-[var(--c-line)] hover:bg-[var(--c-surface-2)]",
            )}
          >
            <MagnifyingGlass size={16} />
            {!collapsed ? (
              <>
                <span className="flex-1 text-left">Search</span>
                <kbd className="rounded bg-[var(--c-surface-2)] px-1.5 py-0.5 font-mono text-[10px]">
                  ⌘K
                </kbd>
              </>
            ) : null}
          </button>
          <div className="flex items-center gap-2 rounded-[10px] px-2 py-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-[var(--c-accent-soft)] text-[11px] font-semibold text-[var(--c-accent)]">
              {initials(user.name, user.email)}
            </span>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-[var(--c-ink)]">
                  {user.name ?? user.email}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {user.roles.slice(0, 2).map((r) => (
                    <CBadge key={r} tone="neutral">
                      {r}
                    </CBadge>
                  ))}
                </div>
              </div>
            ) : null}
            <form action="/console/logout" method="post">
              <button
                type="submit"
                className="flex size-8 items-center justify-center rounded-lg text-[var(--c-ink-3)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]"
                aria-label="Sign out"
                formAction={undefined}
                onClick={async (e) => {
                  e.preventDefault();
                  const { logout } = await import("@/app/actions/auth");
                  await logout();
                }}
              >
                <SignOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main column: fixed height chain so only #main-content scrolls */}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden md:pl-[var(--sidebar-current)]"
        style={{ transition: "padding-left var(--c-dur) var(--c-ease)" }}
      >
        <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--c-line)] bg-[var(--c-bg)]/90 px-3 backdrop-blur-md sm:gap-3 sm:px-4 md:px-6">
          <div className="shrink-0 md:hidden">
            <Image src={logoSrc} alt={brandName} width={28} height={28} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-[var(--c-ink)] md:hidden">
              {brandName}
            </p>
            <p className="hidden text-[12px] text-[var(--c-ink-3)] md:block">
              {user.desk ? `Desk · ${user.desk.replace(/_/g, " ")}` : "Desk"}
              {" · "}
              <span className="text-[var(--c-ink-2)]">{brandName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--c-surface)] text-[var(--c-ink-3)] ring-1 ring-[var(--c-line)] md:hidden"
            aria-label="Search"
          >
            <MagnifyingGlass size={16} />
          </button>
          <AlertsButton initialUnread={unreadCount} />
        </header>

        <main
          ref={mainRef}
          id="main-content"
          className="c-desk-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pb-[calc(var(--c-bottom-nav-h)+1.75rem)] pt-4 md:px-8 md:pb-10 md:pt-6"
          data-swipe-nav="1"
        >
          {/* Mobile swipe hint once per session */}
          <p className="mb-2 text-center text-[10px] text-[var(--c-ink-3)] md:hidden">
            Swipe ← → to switch modules
          </p>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav — equal circular liquid-glass CTAs; hides while scrolling */}
      <nav
        className={cn(
          MOBILE_NAV_ROOT_CLASS,
          "md:hidden",
          !mobileNavVisible && MOBILE_NAV_HIDDEN_CLASS,
        )}
        data-testid="console-mobile-nav"
        data-visible={mobileNavVisible ? "true" : "false"}
        aria-label="Mobile"
        aria-hidden={!mobileNavVisible}
      >
        <ul className={MOBILE_NAV_DOCK_CLASS} role="list">
          {mobile.map((item) => {
            const active = isActive(pathname, item.href);
            const label = item.shortLabel ?? item.label;
            return (
              <li key={item.href} className="contents">
                <Link
                  href={item.href}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    MOBILE_NAV_ITEM_CLASS,
                    active && MOBILE_NAV_ITEM_ACTIVE_CLASS,
                  )}
                  data-testid={`mobile-nav-${item.icon}`}
                >
                  <NavIcon
                    name={item.icon}
                    className="size-5"
                    weight={active ? "fill" : "regular"}
                  />
                  <span className="c-mobile-nav__label">{label}</span>
                </Link>
              </li>
            );
          })}
          <li className="contents">
            <Link
              href="/console/more"
              aria-label="More modules"
              aria-current={
                pathname.startsWith("/console/more") ? "page" : undefined
              }
              className={cn(
                MOBILE_NAV_ITEM_CLASS,
                pathname.startsWith("/console/more") &&
                  MOBILE_NAV_ITEM_ACTIVE_CLASS,
              )}
              data-testid="mobile-nav-more"
            >
              <NavIcon
                name="admin"
                className="size-5"
                weight={
                  pathname.startsWith("/console/more") ? "fill" : "regular"
                }
              />
              <span className="c-mobile-nav__label">More</span>
            </Link>
          </li>
        </ul>
      </nav>

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        items={nav}
      />
    </div>
  );
}
