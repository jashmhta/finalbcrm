"use client";

// NotificationBell - the nav's self-contained alerts bell.
//
// The nav/seed agent drops <NotificationBell/> into the SiteNav right cluster
// (alongside the command trigger). It is fully self-contained:
// it fetches its own data via the `getBellData` server action (so it works
// inside the client SiteNav without server-component data props threaded
// through), renders an unread-count badge, and opens a floating glass dropdown
// of the most recent notifications.
//
// Read state is cookie-backed (features/workflow/queries.ts); `markAsRead` /
// `markAllAsRead` revalidate /notifications. The bell refetches after a mark
// so the badge + dropdown stay in sync.
//
// Import discipline: server actions from "@/features/workflow/actions", types
// from "@/features/workflow/types" - never the feature barrel (which re-
// exports ./queries → postgres → breaks the "use client" bundle).
//
// The bell is a client component mounted in the root layout's nav. Its mount
// effect runs once per full page load (the nav persists across client-side
// route changes), so `getBellData` is one POST per page load, not per route.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  XCircle,
  WarningCircle,
  Info,
  ArrowRight,
  Check,
  X,
  type IconProps,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/brand/text";
import {
  getBellData,
  markAsRead,
  markAllAsRead,
  type BellData,
} from "@/features/workflow/actions";
import {
  SEVERITY_LABELS,
  type NotificationView,
  type Severity,
} from "@/features/workflow/types";

type IconType = React.ForwardRefExoticComponent<
  IconProps & React.RefAttributes<SVGSVGElement>
>;

const SEVERITY_ICON: Record<Severity, IconType> = {
  critical: XCircle,
  warning: WarningCircle,
  info: Info,
};

const SEVERITY_ICON_CLASS: Record<Severity, string> = {
  critical: "text-down",
  warning: "text-gold",
  info: "text-info",
};

const EASE = [0.32, 0.72, 0, 1] as const;

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<BellData | null>(null);
  const [pending, startTransition] = useTransition();
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Fetch on mount + whenever the dropdown opens (refresh stale data). The
  // empty-dep effect runs once per page load (the nav persists across client
  // route changes), so this is one POST per page load, plus one per open.
  const fetchBell = React.useCallback(async () => {
    try {
      const d = await getBellData(6);
      setData(d);
    } catch {
      // Swallow - a failed fetch leaves the bell in its last-known state
      // rather than crashing the nav. The badge simply won't update.
    }
  }, []);

  React.useEffect(() => {
    void fetchBell();
  }, [fetchBell]);

  React.useEffect(() => {
    if (open) void fetchBell();
  }, [open, fetchBell]);

  // Close on route change (covers clicking a notification link + back/forward).
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Click-outside + Escape to close.
  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = data?.unreadCount ?? 0;
  const critical = data?.stats.critical ?? 0;
  const items = data?.items ?? [];
  // Badge tone: rose when there's a critical escalation, emerald otherwise -
  // so the user sees escalation at a glance without opening the dropdown.
  const badgeTone = critical > 0 ? "down" : "emerald";

  const handleDismiss = React.useCallback(
    (entityId: string) => {
      startTransition(async () => {
        await markAsRead(entityId);
        void fetchBell();
      });
    },
    [fetchBell],
  );

  const handleMarkAll = React.useCallback(() => {
    const ids = items.filter((n) => !n.read).map((n) => n.entityId);
    if (ids.length === 0) return;
    startTransition(async () => {
      await markAllAsRead(ids);
      void fetchBell();
    });
  }, [items, fetchBell]);

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close notifications" : "Open notifications"}
        aria-expanded={open}
        className="relative inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 ease-soft hover:bg-foreground/10 hover:text-foreground"
      >
        <Bell weight="light" className="size-4.5" />
        {unread > 0 ? (
          <span
            aria-label={`${unread} unread`}
            className={cn(
              "absolute -right-0.5 -top-0.5 inline-flex min-w-4 h-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums ring-2 ring-background",
              badgeTone === "down"
                ? "bg-down text-on-emerald"
                : "bg-emerald text-on-emerald",
            )}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="bell-panel"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[380px] max-w-[calc(100vw-1.5rem)]"
            role="dialog"
            aria-label="Recent notifications"
          >
            <div className="overflow-hidden rounded-2xl bg-surface/90 p-2 ring-1 ring-hairline shadow-floating backdrop-blur-xl supports-[backdrop-filter]:bg-surface/80">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <Eyebrow>Notifications</Eyebrow>
                  {unread > 0 ? (
                    <span className="nums text-[11px] tabular-nums text-muted-foreground">
                      {unread} unread
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleMarkAll}
                    disabled={pending || unread === 0}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors duration-200 ease-soft hover:bg-foreground/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Check weight="light" className="size-3.5" />
                    Mark all read
                  </button>
                </div>
              </div>

              {/* List */}
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <span
                    aria-hidden
                    className="inline-flex size-10 items-center justify-center rounded-full bg-emerald/[0.08] text-emerald ring-1 ring-emerald/20"
                  >
                    <Check weight="light" className="size-5" />
                  </span>
                  <p className="text-[15px] font-light tracking-[-0.01em] text-foreground/90">
                    You&apos;re all caught up.
                  </p>
                  <p className="max-w-[16rem] text-[12px] leading-[1.5] text-muted-foreground">
                    No KYC, deal, credit, task or consent alerts right now.
                  </p>
                </div>
              ) : (
                <div className="flex max-h-[60vh] flex-col overflow-y-auto">
                  {items.map((n) => (
                    <BellItem
                      key={n.id}
                      item={n}
                      onDismiss={handleDismiss}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="mt-1 border-t border-hairline/60 p-1">
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-[12.5px] font-medium text-foreground transition-colors duration-200 ease-soft hover:bg-foreground/5"
                >
                  View all notifications
                  <ArrowRight weight="light" className="size-3.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BellItem - a single notification row in the dropdown
// ---------------------------------------------------------------------------

function BellItem({
  item,
  onDismiss,
  onNavigate,
}: {
  item: NotificationView;
  onDismiss: (entityId: string) => void;
  onNavigate: () => void;
}) {
  const Icon = SEVERITY_ICON[item.severity];
  const unread = !item.read;

  return (
    <div
      className={cn(
        "group/bell-item relative flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors duration-200 ease-soft",
        unread ? "bg-emerald/[0.04]" : "hover:bg-foreground/[0.04]",
      )}
    >
      {unread ? (
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-emerald"
        />
      ) : null}
      <span
        aria-hidden
        className={cn(
          "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-hairline/70 [&_svg]:size-4 [&_svg]:shrink-0",
          SEVERITY_ICON_CLASS[item.severity],
        )}
      >
        <Icon weight="light" />
      </span>
      <Link
        href={item.href}
        onClick={() => {
          onNavigate();
          if (unread) onDismiss(item.entityId);
        }}
        className="flex min-w-0 flex-1 flex-col gap-0.5"
      >
        <span className="line-clamp-1 text-[13px] font-medium leading-snug text-foreground">
          {item.title}
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span className="truncate">{item.entityLabel}</span>
          <span aria-hidden>·</span>
          <span className="nums tabular-nums shrink-0">{item.relative}</span>
        </span>
      </Link>
      {unread ? (
        <button
          type="button"
          onClick={() => onDismiss(item.entityId)}
          aria-label="Mark as read"
          title="Mark as read"
          className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors duration-200 ease-soft hover:bg-foreground/10 hover:text-foreground"
        >
          <X weight="light" className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}