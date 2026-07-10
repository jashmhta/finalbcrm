import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button — Stripe-like: 6px radius, solid primary, quiet secondary.
 * Primary uses brand accent token (--gold = indigo). Rounded-md not full pill.
 */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap outline-none select-none transition-all duration-150 ease-soft focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        "primary-emerald":
          "bg-gold text-on-gold shadow-pill hover:bg-gold-deep",
        "primary-gold":
          "bg-gold text-on-gold shadow-pill hover:bg-gold-deep",
        "secondary-hairline":
          "ring-1 ring-hairline bg-surface text-foreground hover:bg-surface-2 hover:ring-foreground/15",
        ghost:
          "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
      },
      size: {
        sm: "h-8 gap-1.5 px-3 text-[12.5px]",
        md: "h-9 gap-2 px-3.5 text-[13px]",
        lg: "h-10 gap-2 px-4 text-[14px]",
        icon: "size-9",
        "icon-sm": "size-8",
      },
      hasTrailing: {
        true: "pr-2",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary-emerald",
      size: "md",
      hasTrailing: false,
    },
  },
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  trailingIcon?: React.ReactNode;
  leadingIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      trailingIcon,
      leadingIcon,
      children,
      type,
      ...props
    },
    ref,
  ) => {
    const composed = buttonVariants({
      variant,
      size,
      hasTrailing: Boolean(trailingIcon),
    });

    const leading = leadingIcon ? (
      <span className="inline-flex size-4 items-center justify-center text-current/90">
        {leadingIcon}
      </span>
    ) : null;
    const trailing = trailingIcon ? (
      <span
        aria-hidden
        className="inline-flex size-5 items-center justify-center rounded bg-black/10 text-current transition-transform duration-150 group-hover/button:translate-x-0.5"
      >
        {trailingIcon}
      </span>
    ) : null;

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{
        className?: string;
        children?: React.ReactNode;
      }>;
      return React.cloneElement(child, {
        className: cn(composed, child.props.className, className),
        children: (
          <>
            {leading}
            {child.props.children}
            {trailing}
          </>
        ),
      });
    }

    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(composed, className)}
        {...props}
      >
        {leading}
        {children}
        {trailing}
      </button>
    );
  },
);
Button.displayName = "Button";

/** Compact trailing icon slot used by older call sites. */
function ButtonIcon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-5 items-center justify-center rounded bg-black/10 text-current",
        className,
      )}
    >
      {children}
    </span>
  );
}

export { Button, ButtonIcon, buttonVariants };
