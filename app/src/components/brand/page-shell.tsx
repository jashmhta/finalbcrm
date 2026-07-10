import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Uniform product chrome for every authenticated route.
 * Stripe/Linear density: max width, consistent gutters, no editorial flourishes.
 */
export function PageShell({
  children,
  className,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Prefer for explorers with side panes (parties). */
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 md:px-8 md:py-8",
        wide ? "max-w-[1600px]" : "max-w-[1280px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 border-b border-hairline pb-5 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground md:text-[24px]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </header>
  );
}

/** Back link + optional trailing actions for detail pages */
export function DetailTopBar({
  backHref,
  backLabel,
  crumb,
  action,
}: {
  backHref: string;
  backLabel: string;
  crumb?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <nav className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
        <a
          href={backHref}
          className="inline-flex items-center gap-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span aria-hidden className="text-[15px] leading-none">
            ←
          </span>
          {backLabel}
        </a>
        {crumb ? (
          <>
            <span className="text-muted-foreground/40">/</span>
            <span className="nums truncate text-foreground/70">{crumb}</span>
          </>
        ) : null}
      </nav>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

/** Simple KPI strip used across modules */
export function KpiStrip({
  items,
}: {
  items: { label: string; value: React.ReactNode; hint?: string }[];
}) {
  return (
    <div
      className={cn(
        "mb-6 grid gap-3",
        items.length <= 2 && "grid-cols-2",
        items.length === 3 && "grid-cols-1 sm:grid-cols-3",
        items.length === 4 && "grid-cols-2 lg:grid-cols-4",
        items.length >= 5 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg bg-surface p-4 ring-1 ring-hairline shadow-soft"
        >
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
            {item.label}
          </p>
          <p className="nums mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-foreground">
            {item.value}
          </p>
          {item.hint ? (
            <p className="mt-1 text-[12px] text-muted-foreground">{item.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
