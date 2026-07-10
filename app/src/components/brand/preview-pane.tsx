import { Eyebrow } from "@/components/brand/text";
import * as React from "react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/brand/card";

/**
 * PreviewPane - the right-hand "explorer" pane for list+detail layouts.
 *
 * The parties explorer (and the other reimagined dense screens) pairs a
 * selectable list on the left with a sticky detail pane on the right that
 * shows the currently-selected entity's identity + a slot for a mini
 * relationship graph / recent deals / exposure readout. This primitive is that
 * pane: a double-bezel `Card` (so it nests into the screen's enclosure system
 * instead of floating as a flat panel), sticky on lg+, with a framed header
 * (eyebrow type + Fraunces name + optional badges) and a single compositional
 * body slot the screen fills.
 *
 * Server-component-safe by design - no hooks, no phosphor, no motion. Slots
 * (`badges`, `children`, `footer`, `actions`) are ReactNodes the caller owns,
 * so a server page can hand in a client-graph child without crossing a
 * function-prop boundary. The sticky behavior is pure CSS (lg:sticky), which
 * respects the "no scroll listeners" rule and degrades to in-flow on mobile.
 *
 *   <PreviewPane
 *     type="Issuer"
 *     name="Acme Steel Ltd."
 *     badges={<Badge variant="gold">EDD</Badge>}
 *   >
 *     <RelationshipGraph … />   // caller-owned slot
 *   </PreviewPane>
 */
export interface PreviewPaneProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Eyebrow label - the entity's TYPE (e.g. "Issuer", "Counterparty", "Client"). */
  type: React.ReactNode;
  /** The selected entity's name - set in Fraunces (display) so the pane's
   *  identity reads as editorial, not a table cell. */
  name: React.ReactNode;
  /** Optional mark/glyph rendered in a hairline disc to the left of the name -
   *  pass a custom IconTile or a brand MARK. */
  mark?: React.ReactNode;
  /** Optional badge row rendered at the right of the header (status, KYC, EDD). */
  badges?: React.ReactNode;
  /** Optional actions row rendered under the name (a quiet ghost button group). */
  actions?: React.ReactNode;
  /** The compositional body - a mini relationship graph, recent deals, or an
   *  exposure readout. The caller owns this slot's contents + spacing. */
  children?: React.ReactNode;
  /** Optional footer band (border-t hairline) - e.g. "Last synced 2m ago". */
  footer?: React.ReactNode;
  /** Disable lg:sticky (e.g. when the pane is taller than the viewport). */
  sticky?: boolean;
  /** Top offset for the sticky position; defaults to a value that clears the
   *  floating nav island + page gutter. */
  stickyTop?: number | string;
}

export function PreviewPane({
  type,
  name,
  mark,
  badges,
  actions,
  children,
  footer,
  sticky = true,
  stickyTop = 96,
  className,
  ...props
}: PreviewPaneProps) {
  return (
    <div
      data-slot="brand-preview-pane"
      className={cn(
        // In-flow on mobile; sticky on lg so the pane tracks the list scroll.
        // Pure CSS - no scroll listeners, no JS, respects the motion rules.
        sticky && "lg:sticky",
        className,
      )}
      style={sticky ? { top: typeof stickyTop === "number" ? `${stickyTop}px` : stickyTop } : undefined}
      {...props}
    >
      <Card shellRadius="2xl" className="overflow-hidden">
        {/* Header band - eyebrow type + Fraunces name + mark + badges.
         *  Border-b hairline separates identity from the body slot, mirroring
         *  the CardFooter's hairline so the pane reads as three machined strata
         *  (header / body / footer). */}
        <div className="flex flex-col gap-3 border-b border-hairline px-5 py-5 md:px-6 md:py-6">
          {/* Identity row - mark + (eyebrow type + Fraunces name). The name
              gets the FULL pane width: badges sit on their own row below
              instead of competing for the header's horizontal space. The prior
              `justify-between` row squeezed the name column to ~72px when the
              badge ladder was wide, so even a short name like "Aditya Khan
              782" wrapped to 3 lines and line-clamp-2 cut it to "Aditya…".
              Stacking the badges gives the name the whole bezel width; a long
              name still wraps + clamps at 2 lines, and the native `title`
              carries the full string so the inspector never lies about the
              entity's identity. `break-words` keeps a long unbroken token
              (e.g. "Garuda Finance 113 Ltd.") inside the bezel. */}
          <div className="flex items-start gap-3">
            {mark ? (
              <span className="mt-0.5 shrink-0">{mark}</span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
                {type}
              </p>
              <h2
                title={typeof name === "string" ? name : undefined}
                className="mt-1 line-clamp-2 break-words text-[16px] font-semibold leading-snug tracking-[-0.02em] text-foreground"
              >
                {name}
              </h2>
            </div>
          </div>
          {badges ? (
            <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
          ) : null}
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>

        {/* Body slot - the caller owns spacing. Default to a calm min-height so
         *  an empty selection still reads as a framed well rather than a
         *  collapsed sliver. */}
        <div className="px-5 py-5 md:px-6 md:py-6">{children}</div>

        {footer ? (
          <div className="border-t border-hairline px-5 py-3.5 md:px-6">
            {footer}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
