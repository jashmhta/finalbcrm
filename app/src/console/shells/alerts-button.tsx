"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check } from "@phosphor-icons/react";

import { NavIcon } from "./icons";
import { cn } from "@/console/lib/cn";
import {
  getBellData,
  markAllAsRead,
} from "@/features/workflow/actions";

/**
 * Header alerts control: unread count badge + small "Read all" when open/unread.
 */
export function AlertsButton({
  initialUnread = 0,
}: {
  initialUnread?: number;
}) {
  const router = useRouter();
  const [unread, setUnread] = React.useState(initialUnread);
  const [pending, start] = useTransition();

  React.useEffect(() => {
    setUnread(initialUnread);
  }, [initialUnread]);

  // Refresh badge on focus / interval (lightweight)
  React.useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const d = await getBellData(1);
        if (!cancelled) setUnread(d.unreadCount);
      } catch {
        /* keep last */
      }
    };
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const id = window.setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(id);
    };
  }, []);

  const label =
    unread > 0
      ? `Alerts, ${unread > 99 ? "99+" : unread} unread`
      : "Alerts";

  function onMarkAll(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      const res = await markAllAsRead();
      if (res.ok) {
        setUnread(0);
        router.refresh();
      }
    });
  }

  return (
    <div className="relative flex items-center gap-1">
      <Link
        href="/console/notifications"
        className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]"
        aria-label={label}
      >
        <NavIcon name="alerts" className="size-5" />
        {unread > 0 ? (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full",
              "bg-[var(--c-bad)] px-1 text-[10px] font-bold leading-none text-white",
            )}
            data-testid="alerts-unread-badge"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>
      {unread > 0 ? (
        <button
          type="button"
          onClick={onMarkAll}
          disabled={pending}
          className={cn(
            "hidden h-7 items-center gap-0.5 rounded-full px-2 text-[10px] font-medium sm:inline-flex",
            "bg-[var(--c-surface)] text-[var(--c-ink-2)] ring-1 ring-[var(--c-line)]",
            "hover:bg-[var(--c-accent-soft)] hover:text-[var(--c-accent)]",
            "disabled:opacity-50",
          )}
          title="Mark all alerts as read"
          aria-label="Mark all unread as read"
          data-testid="alerts-mark-all-header"
        >
          <Check size={12} weight="bold" />
          {pending ? "…" : "Read all"}
        </button>
      ) : null}
    </div>
  );
}
