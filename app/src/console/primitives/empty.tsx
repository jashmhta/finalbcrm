import Link from "next/link";
import { cn } from "@/console/lib/cn";

export function CEmpty({
  title,
  body,
  actionLabel,
  actionHref,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[var(--c-radius-lg)] bg-[var(--c-surface)] p-6 ring-1 ring-[var(--c-line)] md:p-8">
      <h2 className="text-[16px] font-semibold text-[var(--c-ink)]">{title}</h2>
      <p className="max-w-md text-[14px] leading-relaxed text-[var(--c-ink-2)]">
        {body}
      </p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className={cn(
            "mt-1 inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-accent)] px-4 text-[13px] font-medium text-[var(--c-on-accent)]",
            "transition-transform duration-[var(--c-dur)] active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-accent)]/40",
          )}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
