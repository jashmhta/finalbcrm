import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Card — Stripe-level single surface.
 * White panel, 1px hairline border, soft shadow. No double-bezel / ambient glow.
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    shellRadius?: "2xl" | "3xl" | "xl";
    interactive?: boolean;
    ambient?: "emerald" | "gold";
  }
>(
  (
    { className, children, shellRadius = "2xl", interactive = false, ambient: _ambient, ...props },
    ref,
  ) => {
    const radius =
      shellRadius === "3xl"
        ? "rounded-xl"
        : shellRadius === "xl"
          ? "rounded-lg"
          : "rounded-xl";

    return (
      <div
        ref={ref}
        data-slot="brand-card"
        className={cn(
          "relative bg-surface text-card-foreground ring-1 ring-hairline shadow-soft transition-[box-shadow,transform,border-color] duration-200 ease-soft",
          radius,
          interactive &&
            "hover:shadow-lift hover:ring-foreground/12 cursor-pointer",
          className,
        )}
        {...props}
      >
        <div data-slot="brand-card-core" className="relative overflow-hidden rounded-[inherit]">
          {children}
        </div>
      </div>
    );
  },
);
Card.displayName = "Card";

const CardBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="brand-card-body"
    className={cn("p-4 md:p-5", className)}
    {...props}
  />
));
CardBody.displayName = "CardBody";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="brand-card-header"
    className={cn("flex flex-col gap-0.5 px-4 pt-4 md:px-5 md:pt-5", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    data-slot="brand-card-title"
    className={cn(
      "text-[14px] font-semibold tracking-[-0.01em] text-foreground",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="brand-card-description"
    className={cn("text-[13px] text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="brand-card-footer"
    className={cn(
      "flex items-center gap-2 border-t border-hairline px-4 py-3 md:px-5",
      className,
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
};
