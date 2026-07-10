import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Input - double-bezel text field. The outer hairline ring is the shell edge;
 * `bezel-hi` adds the machined inset top highlight so a bare input matches the
 * Card enclosure instead of reading as a flat bordered box. Focus lifts to a
 * gold ring. Server-safe (no hooks) - drops in anywhere the shadcn Input is
 * used (same `React.ComponentProps<"input">` API).
 *
 * For icon-affixed fields, use <InputGroup> with a leading/trailing slot.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      data-slot="brand-input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md bg-surface px-3 text-[13.5px] text-foreground",
        "ring-1 ring-hairline shadow-soft transition-all duration-150 ease-soft",
        "placeholder:text-muted-foreground/60",
        "focus:ring-2 focus:ring-gold/35 focus:outline-none",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:ring-down/45 aria-invalid:ring-1",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

/**
 * InputGroup - relative wrapper for icon-affixed fields. Renders the field
 * surface + ring (the double-bezel shell) and absolutely positions leading /
 * trailing slots inside it. Pass an <Input> child with `border-0 ring-0 bg-
 * transparent` to sit flush inside the group, or use the convenience props.
 */
const InputGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
  }
>(({ className, children, leading, trailing, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="brand-input-group"
    className={cn(
      "bezel-hi relative flex h-10 w-full items-center rounded-xl bg-surface ring-1 ring-hairline transition-all duration-200 ease-soft focus-within:ring-gold/60",
      className,
    )}
    {...props}
  >
    {leading ? (
      <span className="pointer-events-none absolute left-3 inline-flex items-center justify-center text-muted-foreground [&_svg]:size-4">
        {leading}
      </span>
    ) : null}
    <div
      className={cn(
        "flex w-full items-center",
        leading ? "pl-9" : "pl-3.5",
        trailing ? "pr-9" : "pr-3.5",
      )}
    >
      {children}
    </div>
    {trailing ? (
      <span className="absolute right-3 inline-flex items-center justify-center text-muted-foreground [&_svg]:size-4">
        {trailing}
      </span>
    ) : null}
  </div>
));
InputGroup.displayName = "InputGroup";

export { Input, InputGroup };
