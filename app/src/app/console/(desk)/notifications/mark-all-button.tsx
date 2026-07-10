"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check } from "@phosphor-icons/react";

import { markAllAsRead } from "@/features/workflow/actions";
import { cn } from "@/console/lib/cn";

export function MarkAllReadButton({
  unread,
  entityIds,
}: {
  unread: number;
  entityIds?: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (unread <= 0) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        start(async () => {
          await markAllAsRead(entityIds);
          router.refresh();
        });
      }}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-medium",
        "bg-[var(--c-surface)] text-[var(--c-ink)] ring-1 ring-[var(--c-line-strong)]",
        "hover:bg-[var(--c-accent-soft)] hover:text-[var(--c-accent)]",
        "disabled:opacity-50",
      )}
      data-testid="alerts-mark-all"
      aria-label={`Mark ${unread} unread as read`}
    >
      <Check size={14} weight="bold" />
      {pending ? "Marking…" : `Read all (${unread})`}
    </button>
  );
}
