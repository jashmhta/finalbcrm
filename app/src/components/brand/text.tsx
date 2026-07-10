import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Eyebrow — quiet micro-label (Stripe/Linear style). No gold glow dots.
 */
export function Eyebrow({
  children,
  className,
  dot = false,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { dot?: boolean }) {
  return (
    <span
      data-slot="brand-eyebrow"
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground",
        className,
      )}
      {...props}
    >
      {dot ? (
        <span aria-hidden className="size-1.5 rounded-full bg-gold" />
      ) : null}
      {children}
    </span>
  );
}

/**
 * SectionHeading — product page header. `display` is kept for API compat but
 * no longer switches to a serif; always Geist sans, Stripe-scale.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  display: _display = false,
  align = "left",
  action,
  className,
  titleClassName,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  display?: boolean;
  align?: "left" | "center";
  action?: React.ReactNode;
  titleClassName?: string;
}) {
  return (
    <div
      data-slot="brand-section-heading"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "items-center text-center sm:flex-col sm:items-center",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1",
          align === "center" && "items-center",
        )}
      >
        {eyebrow ? (
          <Eyebrow className="mb-0.5">{eyebrow}</Eyebrow>
        ) : null}
        <h2
          className={cn(
            "text-[22px] font-semibold tracking-[-0.025em] text-foreground md:text-[24px]",
            titleClassName,
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

/** Shared page chrome used across modules. */
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
    <header className={cn("bc-page-header", className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="bc-page-title">{title}</h1>
          {description ? (
            <p className="bc-page-subtitle mt-1">{description}</p>
          ) : null}
        </div>
        {action ? (
          <div className="flex flex-wrap items-center gap-2">{action}</div>
        ) : null}
      </div>
    </header>
  );
}
