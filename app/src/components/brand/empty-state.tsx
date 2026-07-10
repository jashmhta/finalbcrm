import * as React from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  align?: "center" | "start";
  tone?: "default" | "emerald" | "gold";
}

function EmptyState({
  icon,
  title,
  hint,
  action,
  align = "center",
  tone = "default",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="brand-empty-state"
      className={cn(
        "flex flex-col gap-2.5 px-6 py-12",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          aria-hidden
          className={cn(
            "mb-1 inline-flex size-10 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground ring-1 ring-hairline",
            "[&_svg]:size-5",
            (tone === "emerald" || tone === "gold") &&
              "bg-gold/10 text-gold ring-gold/20",
          )}
        >
          {icon}
        </span>
      ) : null}
      <p className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
        {title}
      </p>
      {hint ? (
        <p
          className={cn(
            "max-w-sm text-[13px] leading-relaxed text-muted-foreground",
            align === "center" && "mx-auto",
          )}
        >
          {hint}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

function CellEmpty({
  label = "—",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { label?: string; tooltip?: string }) {
  return (
    <span
      className={cn("text-[13px] text-muted-foreground/70", className)}
      {...props}
    >
      {label}
    </span>
  );
}

export { EmptyState, CellEmpty };
