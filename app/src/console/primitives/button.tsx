import * as React from "react";
import { cn } from "@/console/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface CButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClass: Record<Variant, string> = {
  primary:
    "bg-[var(--c-accent)] text-[var(--c-on-accent)] hover:brightness-110 shadow-[var(--c-shadow)]",
  secondary:
    "bg-[var(--c-surface)] text-[var(--c-ink)] ring-1 ring-[var(--c-line-strong)] hover:bg-[var(--c-surface-2)]",
  ghost:
    "bg-transparent text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]",
  danger:
    "bg-[var(--c-bad)] text-white hover:brightness-110",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-[12px] gap-1.5",
  md: "h-10 px-4 text-[13px] gap-2",
  lg: "h-11 px-5 text-[14px] gap-2",
};

export const CButton = React.forwardRef<HTMLButtonElement, CButtonProps>(
  function CButton(
    { className, variant = "primary", size = "md", type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-[var(--c-radius-pill)] font-medium transition-all duration-[var(--c-dur)] ease-[var(--c-ease)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg)]",
          "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
          variantClass[variant],
          sizeClass[size],
          className,
        )}
        {...props}
      />
    );
  },
);
