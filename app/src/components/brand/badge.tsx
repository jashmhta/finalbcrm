import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badge - hairline pill with muted semantic colors. Mono tone by default;
 * emerald (approved/positive) and gold (EDD / highlight / premium) reserved
 * for active or high-signal states. Rose (down) and emerald (up) draw from
 * the muted --up/----down tokens so finance colors never read as neon.
 * Uppercase tracking, ring-1 hairline + tinted bg, dot + icon variants.
 *
 * ActionBadge - a monochromatic audit/log action coding (see below). A SINGLE
 * hue family per action type with INTENSITY by verb, drawn only from the
 * brand palette (emerald / neutral / gold / rose) - never the rainbow of
 * saturated status colors the critic flagged on the audit log.
 */
const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium tracking-wide whitespace-nowrap transition-colors duration-150 ease-soft [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-muted-foreground ring-1 ring-hairline",
        emerald: "bg-gold/10 text-gold-deep ring-1 ring-gold/20",
        gold: "bg-gold/10 text-gold-deep ring-1 ring-gold/20",
        highlight: "bg-gold/10 text-gold-deep ring-1 ring-gold/20",
        up: "bg-up/10 text-up ring-1 ring-up/20",
        down: "bg-down/10 text-down ring-1 ring-down/20",
        info: "bg-info/10 text-info ring-1 ring-info/20",
        outline: "bg-transparent text-foreground/70 ring-1 ring-hairline",
        "action-create": "bg-emerald/10 text-emerald ring-1 ring-emerald/25",
        "action-update": "bg-surface-2 text-foreground/70 ring-1 ring-hairline",
        "action-delete": "bg-down/10 text-down ring-1 ring-down/25",
        "action-read": "bg-surface-2 text-muted-foreground ring-1 ring-hairline",
        "action-export": "bg-gold/10 text-gold ring-1 ring-gold/25",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Leading glyph (a Phosphor Light icon). */
  icon?: React.ReactNode;
  /** Leading gold dot - for active/positive signals (the brand active accent). */
  dot?: boolean;
}

function Badge({
  className,
  variant,
  icon,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="brand-badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-gold shadow-[0_0_5px] shadow-gold/45"
        />
      ) : null}
      {icon}
      {children}
    </span>
  );
}

/**
 * ActionBadge - monochromatic action coding for audit/log tables. Maps an
 * action verb to one hue family from the brand palette at a controlled
 * intensity, so a log column reads as a calm sequence of restrained signals
 * instead of a saturated rainbow. Hairline + soft-tint, tiny uppercase.
 *
 *   create  → emerald (solid)   - the "thing was added" signal
 *   update  → neutral  (soft)   - the ambient, most-frequent verb
 *   delete  → rose    (solid)   - the loss signal
 *   read    → neutral  (dim)    - the quietest, lowest-intensity verb
 *   export  → gold    (solid)   - the "data left the system" signal
 *
 * Use <ActionBadge action="create" /> (label defaults to the verb) or pass
 * children for a custom label. To map arbitrary audit verbs (insert / merge /
 * patch / view / download …) to the five canonical actions, use
 * `actionFromVerb` + the `action` prop, or ACTION_VARIANT directly with Badge.
 */
export type ActionType = "create" | "update" | "delete" | "read" | "export";

const ACTION_VARIANT: Record<ActionType, NonNullable<BadgeProps["variant"]>> = {
  create: "action-create",
  update: "action-update",
  delete: "action-delete",
  read: "action-read",
  export: "action-export",
};

export interface ActionBadgeProps extends Omit<BadgeProps, "variant" | "children"> {
  action: ActionType;
  /** Label override; defaults to the action verb. */
  children?: React.ReactNode;
}

function ActionBadge({ action, children, ...props }: ActionBadgeProps) {
  return (
    <Badge variant={ACTION_VARIANT[action]} {...props}>
      {children ?? action}
    </Badge>
  );
}

/**
 * Map arbitrary audit/log verbs to the five canonical actions. Falls back to
 * `update` (the ambient neutral) so unknown verbs never produce a rainbow
 * badge. View-layer helper - does not touch the data layer.
 *
 *   actionFromVerb("insert")   → "create"
 *   actionFromVerb("merge")    → "update"
 *   actionFromVerb("download") → "export"
 */
function actionFromVerb(verb: string | null | undefined): ActionType {
  if (!verb) return "update";
  const v = verb.toLowerCase();
  if (
    v.startsWith("create") ||
    v.startsWith("insert") ||
    v.startsWith("add") ||
    v.startsWith("post") ||
    v.startsWith("approve") ||
    v.startsWith("grant")
  ) {
    return "create";
  }
  if (
    v.startsWith("delete") ||
    v.startsWith("remove") ||
    v.startsWith("drop") ||
    v.startsWith("revoke") ||
    v.startsWith("reject") ||
    v.startsWith("purge")
  ) {
    return "delete";
  }
  if (
    v.startsWith("read") ||
    v.startsWith("view") ||
    v.startsWith("select") ||
    v.startsWith("get") ||
    v.startsWith("list") ||
    v.startsWith("fetch") ||
    v.startsWith("query")
  ) {
    return "read";
  }
  if (
    v.startsWith("export") ||
    v.startsWith("download") ||
    v.startsWith("extract") ||
    v.startsWith("print") ||
    v.startsWith("share")
  ) {
    return "export";
  }
  return "update";
}

export { ActionBadge, ACTION_VARIANT, actionFromVerb };

export { Badge, badgeVariants };
