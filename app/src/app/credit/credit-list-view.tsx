"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Sparkle,
  Plus,
  Warning,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { CreditAnalysisListItem } from "@/features/credit/queries";
import { BAND_GRADE } from "@/features/credit/scorecard";
import { ExportCsvButton } from "@/features/reports/export-button";
import {
  Card,
  Badge,
  Button,
  CommandBar,
  Reveal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmpty,
  type Density,
} from "@/components/brand";
import type { BadgeProps } from "@/components/brand";

/**
 * Client view layer for the credit analyses list. The server page runs
 * `listCreditAnalyses` and hands rows + pagination in as props; this
 * component owns the floating command bar (search + density), the
 * double-bezel table, and the pagination pills.
 *
 * Search stays URL-driven (shareable) - debounced and pushed to `?q=` via
 * the router so the server re-runs the query. Density is pure client state.
 */
export interface CreditListViewProps {
  rows: CreditAnalysisListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
}

const BAND_BADGE: Record<string, BadgeProps["variant"]> = {
  "BC-1": "emerald",
  "BC-2": "emerald",
  "BC-3": "gold",
  "BC-4": "info",
  "BC-5": "down",
  "BC-6": "down",
};

function bandVariant(band: string | null): BadgeProps["variant"] {
  return band ? (BAND_BADGE[band] ?? "neutral") : "neutral";
}

export function CreditListView({
  rows,
  total,
  page,
  pageSize,
  totalPages,
  q,
}: CreditListViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [density, setDensity] = React.useState<Density>("comfortable");
  const [search, setSearch] = React.useState(q ?? "");
  const [lastQ, setLastQ] = React.useState(q ?? "");

  // Keep the input in sync if the URL changes elsewhere (back/forward).
  // Adjusting state during render (the React docs pattern) avoids the
  // cascading-render effect lint while still reflecting external URL changes.
  if ((q ?? "") !== lastQ) {
    setLastQ(q ?? "");
    setSearch(q ?? "");
  }

  const pushSearch = React.useCallback(
    (value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, sp],
  );

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchChange = React.useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => pushSearch(value), 280);
    },
    [pushSearch],
  );
  React.useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-5">
      <CommandBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search issuer…"
        density={density}
        onDensityChange={setDensity}
        label={`${total} ${total === 1 ? "analysis" : "analyses"}`}
        actions={
          <>
            <ExportCsvButton type="credit" />
            <Button
              asChild
              variant="primary-gold"
              size="sm"
              // h-11 on mobile for a confident thumb tap on the primary CTA;
              // md:h-8 restores the compact sm desktop height inside the bar.
              className="h-11 md:h-8"
              trailingIcon={<Plus weight="light" className="size-3.5" />}
            >
              <Link href="/credit/new">New analysis</Link>
            </Button>
          </>
        }
      />

      <Reveal y={14}>
        <Card className="overflow-hidden">
          <Table density={density}>
            <TableHeader>
              <TableRow>
                <TableHead>Issuer</TableHead>
                {/* Type / Obligor / Rating / Created are secondary on phones -
                    hidden < md so the 8-col ledger collapses to Issuer + Score
                    + Band + Status (the four a mobile reader scans for). The
                    Issuer cell already carries the analysis type as a sub-label
                    so Type is redundant at this width. */}
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Obligor</TableHead>
                <TableHead className="hidden md:table-cell">Rating</TableHead>
                <TableHead align="right">Score</TableHead>
                <TableHead>Band</TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right" className="hidden md:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent before:hidden">
                  <TableCell colSpan={8} className="p-0">
                    <TableEmpty
                      icon={<Sparkle weight="light" />}
                      title={
                        total === 0
                          ? "The book is a blank page."
                          : "No analyses match this view."
                      }
                      hint={
                        total === 0
                          ? "Open a new credit file from an issuer to begin the spreading + scorecard workflow."
                          : "Try refining the issuer search."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const score =
                    r.currentCreditScore != null
                      ? Number(r.currentCreditScore)
                      : null;
                  return (
                    <TableRow key={r.creditAnalysisId} className="cursor-pointer">
                      <TableCell primary>
                        {/* Stretched link - the anchor's ::after pseudo is
                            absolutely positioned with inset-0 against the
                            nearest positioned ancestor (the <tr>, which is
                            `relative`), so it spans the whole row. Positioned
                            content paints above non-positioned siblings, so a
                            click anywhere on the row (issuer, rating, score,
                            band, status) hits the pseudo and navigates to the
                            credit detail - not just the issuer-name text.
                            Middle-click / right-click "open in new tab" stay
                            intact because this is a real <a>, not an onClick
                            shim. The Link itself stays non-positioned so the
                            pseudo resolves against the row, not the cell. */}
                        <Link
                          href={`/credit/${r.creditAnalysisId}`}
                          className="group/name inline-flex flex-col gap-0.5 after:absolute after:inset-0 after:content-['']"
                        >
                          <span className="relative z-10 transition-colors duration-200 ease-soft group-hover/name:text-gold">
                            {r.legalName}
                          </span>
                          {r.analysisType ? (
                            <span className="relative z-10 text-[11px] font-normal uppercase tracking-[0.1em] text-muted-foreground/70">
                              {r.analysisType.replace(/_/g, " ")}
                            </span>
                          ) : null}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {r.analysisType ? (
                          <Badge variant="neutral">
                            {r.analysisType.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          <span className="text-[12.5px] text-muted-foreground/60">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline">{r.obligorType}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {r.internalRatingShort ? (
                          <Badge variant="outline">
                            {r.internalRatingShort}
                          </Badge>
                        ) : (
                          <span className="text-[12.5px] text-muted-foreground/60">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell numeric>
                        {score !== null && Number.isFinite(score) ? (
                          <span
                            className={cn(
                              "nums tabular-nums font-medium",
                              score >= 70
                                ? "text-emerald"
                                : score >= 55
                                  ? "text-gold"
                                  : score >= 40
                                    ? "text-foreground"
                                    : "text-down",
                            )}
                          >
                            {score.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.band ? (
                          <Badge variant={bandVariant(r.band)}>
                            {r.band}
                            <span className="ml-1 opacity-70 normal-case tracking-normal">
                              {BAND_GRADE[
                                r.band as keyof typeof BAND_GRADE
                              ] ?? ""}
                            </span>
                          </Badge>
                        ) : (
                          <span className="text-[12.5px] text-muted-foreground/60">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.internalRatingAction ? (
                            <Badge variant="neutral">
                              {r.internalRatingAction.replace(/_/g, " ")}
                            </Badge>
                          ) : (
                            <Badge variant="outline">draft</Badge>
                          )}
                          {r.watchlistFlag ? (
                            <Badge
                              variant="down"
                              icon={
                                <Warning weight="light" className="size-3" />
                              }
                            >
                              watchlist
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell numeric className="hidden md:table-cell">
                        {r.createdAt
                          ? r.createdAt.toLocaleDateString("en-IN", {
                              year: "numeric",
                              month: "short",
                              day: "2-digit",
                            })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </Reveal>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] text-muted-foreground">
          {total === 0 ? (
            "Nothing to show."
          ) : (
            <>
              <span className="nums tabular-nums text-foreground/80">
                {rangeFrom.toLocaleString("en-IN")}-
                {rangeTo.toLocaleString("en-IN")}
              </span>{" "}
              of{" "}
              <span className="nums tabular-nums text-foreground/80">
                {total.toLocaleString("en-IN")}
              </span>{" "}
              analyses
            </>
          )}
        </p>
        {totalPages > 1 ? (
          <Pagination page={page} totalPages={totalPages} q={q} />
        ) : null}
      </div>
    </div>
  );
}

/** Pagination pills - mono page numbers, hairline chrome, magnetic hover. */
function Pagination({
  page,
  totalPages,
  q,
}: {
  page: number;
  totalPages: number;
  q?: string;
}) {
  const pageHref = (p: number) =>
    `/credit?${new URLSearchParams({
      ...(q ? { q } : {}),
      page: String(p),
    }).toString()}`;

  const pages: number[] = [];
  const win = 1;
  const start = Math.max(1, page - win);
  const end = Math.min(totalPages, page + win);
  for (let i = start; i <= end; i++) pages.push(i);

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        asChild
        variant="secondary-hairline"
        size="icon-sm"
        aria-disabled={prevDisabled}
        // size-11 (44px) on mobile for a confident thumb tap on the prev/next
        // arrows; md:size-8 restores the compact icon-sm desktop size.
        className={cn("size-11 md:size-8", prevDisabled && "pointer-events-none opacity-40")}
      >
        <Link href={pageHref(Math.max(1, page - 1))} aria-label="Previous page">
          <ArrowLeft weight="light" className="size-4" />
        </Link>
      </Button>

      {start > 1 ? (
        <>
          <PagePill href={pageHref(1)} active={page === 1}>
            1
          </PagePill>
          {start > 2 ? (
            <span className="px-1 text-muted-foreground/60">…</span>
          ) : null}
        </>
      ) : null}

      {pages.map((p) => (
        <PagePill key={p} href={pageHref(p)} active={p === page}>
          {p}
        </PagePill>
      ))}

      {end < totalPages ? (
        <>
          {end < totalPages - 1 ? (
            <span className="px-1 text-muted-foreground/60">…</span>
          ) : null}
          <PagePill href={pageHref(totalPages)} active={page === totalPages}>
            {totalPages}
          </PagePill>
        </>
      ) : null}

      <Button
        asChild
        variant="secondary-hairline"
        size="icon-sm"
        aria-disabled={nextDisabled}
        className={cn("size-11 md:size-8", nextDisabled && "pointer-events-none opacity-40")}
      >
        <Link
          href={pageHref(Math.min(totalPages, page + 1))}
          aria-label="Next page"
        >
          <ArrowRight weight="light" className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

function PagePill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // h-11/min-w-11 (44px) on mobile for thumb-friendly page pills;
        // md:h-8/md:min-w-8 restores the compact desktop size.
        "inline-flex h-11 min-w-11 items-center justify-center rounded-full px-2.5 text-[12.5px] transition-all duration-200 ease-soft md:h-8 md:min-w-8",
        active
          ? "bg-gold/15 text-gold ring-1 ring-gold/30"
          : "text-muted-foreground ring-1 ring-hairline hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      <span className="nums tabular-nums">{children}</span>
    </Link>
  );
}