import * as React from "react";
import { cn } from "@/console/lib/cn";

export interface CInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const CInput = React.forwardRef<HTMLInputElement, CInputProps>(
  function CInput({ className, label, hint, error, id, ...props }, ref) {
    const inputId = id ?? props.name;
    return (
      <label className="flex w-full flex-col gap-1.5">
        {label ? (
          <span className="text-[12px] font-medium text-[var(--c-ink-2)]">
            {label}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 w-full rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3.5 text-[14px] text-[var(--c-ink)]",
            "ring-1 ring-[var(--c-line-strong)] placeholder:text-[var(--c-ink-3)]",
            "transition-[box-shadow,ring-color] duration-[var(--c-dur)] ease-[var(--c-ease)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]/35",
            error && "ring-[var(--c-bad)]/50 focus:ring-[var(--c-bad)]/40",
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined
          }
          {...props}
        />
        {error ? (
          <span
            id={`${inputId}-err`}
            className="text-[12px] text-[var(--c-bad)]"
            role="alert"
          >
            {error}
          </span>
        ) : hint ? (
          <span id={`${inputId}-hint`} className="text-[12px] text-[var(--c-ink-3)]">
            {hint}
          </span>
        ) : null}
      </label>
    );
  },
);
