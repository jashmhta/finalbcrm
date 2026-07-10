"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { DownloadSimple } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/brand/button";
import type { ExportKind } from "@/app/reports/export/route";

/**
 * ExportCsvButton - a plain anchor to the CSV export Route Handler
 * (`/reports/export?type=…&<filters>`). The browser handles the download
 * natively via the route's `Content-Disposition: attachment` header, so there
 * is no client-side blob code and no function prop crosses the RSC boundary.
 *
 * The current URL filter params (q / status / risk / mnpi / type / assignee)
 * are forwarded so the CSV matches the on-screen filtered list. `page` and
 * `id` (the parties-explorer selection) are dropped - an export ships the
 * whole filtered set, not just the visible page, and the selected row is a
 * UI concern, not a filter.
 *
 * Used in two places: (1) the CommandBar `actions` slot on each list page
 * (parties / deals / credit / KYC / interactions / tasks / documents), where
 * it sits beside the "New" CTA; and (2) the four detail report pages'
 * SectionHeading action slot. On mobile it grows to a 44px thumb target
 * (h-11) and shrinks back to the compact sm desktop height (md:h-8).
 */
export interface ExportCsvButtonProps {
  /** The export kind - dispatches the route to the right query + columns. */
  type: ExportKind;
  /** Button label. Defaults to "Export CSV". */
  label?: string;
  /** Extra className - used to match the surrounding CTA's mobile height. */
  className?: string;
  /** Visual variant. Defaults to the hairline secondary so it never competes
   *  with the gold primary CTA on the same bar. */
  variant?: "secondary-hairline" | "primary-gold" | "ghost";
}

/** Params that are pure UI state (not filters) and must NOT be forwarded. */
const DROP_PARAMS = new Set(["page", "id"]);

export function ExportCsvButton({
  type,
  label = "Export CSV",
  className,
  variant = "secondary-hairline",
}: ExportCsvButtonProps) {
  const sp = useSearchParams();

  // Build the export URL from the current filter params, dropping UI-only
  // state. The export KIND rides on the `kind` param (NOT `type`) so it never
  // collides with a module's own `type` filter - e.g. /documents uses `?type=`
  // for its document-type filter, and the export button forwards that filter
  // through while setting `kind=documents` to dispatch the route. useMemo
  // keeps the href stable across re-renders that don't change the filters.
  const href = React.useMemo(() => {
    const next = new URLSearchParams();
    next.set("kind", type);
    for (const key of sp.keys()) {
      if (DROP_PARAMS.has(key) || key === "kind") continue;
      const val = sp.get(key);
      if (val) next.set(key, val);
    }
    return `/reports/export?${next.toString()}`;
  }, [sp, type]);

  return (
    <Button
      asChild
      variant={variant}
      size="sm"
      // h-11 on mobile for a confident thumb tap; md:h-8 restores the compact
      // sm desktop height inside the command bar / heading action slot.
      className={cn("h-11 md:h-8", className)}
      leadingIcon={<DownloadSimple weight="light" className="size-4" />}
    >
      <a href={href} aria-label={`${label} (downloads a CSV file)`}>
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">CSV</span>
      </a>
    </Button>
  );
}