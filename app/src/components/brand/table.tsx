"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/brand/empty-state";

/**
 * Premium data table - the heart of a CRM.
 *
 * - Hairline row separators only (no vertical borders) - the whisper-quiet
 *   --row-hairline (6% foreground) so row separators never compete with the
 *   card core's 12% --hairline enclosure edge.
 * - Sticky header: backdrop-blur-xl (sticky = allowed blur) + hairline bottom
 *   + --shadow-sticky depth so it reads as a raised bar projecting onto the
 *   scrolling rows, not a flat stripe. The header's top edge is flush with the
 *   card core's machined top, so the bezel's own inset highlight defines it.
 * - Eyebrow uppercase headers (11px), body cells 13.5px, primary cell
 *   foreground-medium, numeric cells Geist Mono tabular-nums right-aligned.
 * - Gold left-accent that grows on hover; selected row tinted gold.
 * - Zebra OFF by default; opt in via <Table zebra> for a 1.2% alternating tint.
 * - Density (Comfortable/Compact) flows via context and actually changes py.
 *
 * Wrap in <Card> for the double-bezel container treatment - the table sits IN
 * the raised inner core (bg-surface, overflow-hidden) so the sticky header's
 * blur reads against the core, not the page.
 */

type Density = "comfortable" | "compact";

interface TableContextValue {
  density: Density;
  zebra: boolean;
}

const TableContext = React.createContext<TableContextValue>({
  density: "comfortable",
  zebra: false,
});

function useTableContext(): TableContextValue {
  return React.useContext(TableContext);
}

/** Back-compat accessor - screens that only need the density axis. */
function useDensity(): Density {
  return React.useContext(TableContext).density;
}

function Table({
  className,
  density = "comfortable",
  zebra = false,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & {
  density?: Density;
  /** Optional 1.2% alternating row tint (off by default per the system). */
  zebra?: boolean;
}) {
  return (
    <TableContext.Provider value={{ density, zebra }}>
      <div
        data-slot="brand-table-container"
        className="relative w-full overflow-x-auto"
      >
        <table
          data-slot="brand-table"
          className={cn(
            "w-full caption-bottom border-collapse text-left text-sm",
            className,
          )}
          {...props}
        />
      </div>
    </TableContext.Provider>
  );
}

function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      data-slot="brand-table-header"
      className={cn(
        "sticky top-0 z-10 bg-surface-2/95 shadow-sticky",
        "[&>tr]:border-b [&>tr]:border-hairline",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      data-slot="brand-table-body"
      className={cn("[&>tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableRow({
  className,
  selected = false,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  const { zebra } = useTableContext();
  return (
    <tr
      data-slot="brand-table-row"
      className={cn(
        "group/row border-b border-row-hairline transition-colors duration-150 ease-soft",
        "hover:bg-row-hover",
        zebra && "[&:nth-child(even)]:bg-row-stripe",
        selected && "bg-gold/8",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({
  className,
  align = "left",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      data-slot="brand-table-head"
      className={cn(
        "px-4 py-2.5 align-middle text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        "[&:has([role=checkbox])]:pr-2",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({
  className,
  align = "left",
  primary = false,
  numeric = false,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right" | "center";
  /** Primary cell (e.g. party name) - foreground, medium weight. */
  primary?: boolean;
  /** Numeric cell - Geist Mono, tabular-nums, right-aligned. */
  numeric?: boolean;
}) {
  const { density } = useTableContext();
  return (
    <td
      data-slot="brand-table-cell"
      className={cn(
        // 13.5px body floor, py-4 in Comfortable (py-2.5 in Compact - the
        // density toggle actually changes py). The extra 2px of vertical
        // breathing room lets the gold hover state + left-accent read as a
        // crafted highlight on the densest ledgers (parties / KYC / audit)
        // without the row feeling cramped. whitespace-nowrap keeps the dense
        // columns from wrapping into a ragged stack; consumers opt out per-cell
        // with whitespace-normal where long-form text is wanted.
        density === "compact" ? "px-3 py-2" : "px-4 py-3",
        "align-middle text-[13px] text-foreground/85 whitespace-nowrap",
        primary && "text-foreground font-medium tracking-[-0.005em]",
        numeric && "nums text-right tabular-nums",
        align === "right" && "text-right",
        align === "center" && "text-center",
        "[&:has([role=checkbox])]:pr-2",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      data-slot="brand-table-caption"
      className={cn("mt-4 text-[13px] text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * Table-level empty region - delegates to the shared brand EmptyState so every
 * table missing data gets the designed Fraunces micro-line + Phosphor Light
 * glyph + muted hint treatment instead of a generic "No data." For inline
 * cell empties, use <CellEmpty/> from brand/empty-state.
 */
function TableEmpty({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      hint={hint}
      action={action}
      className={cn("py-16", className)}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  TableEmpty,
  useDensity,
  useTableContext,
  type Density,
};