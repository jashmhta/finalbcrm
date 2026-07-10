"use client";

import { SectionHeading } from "@/components/brand/text";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Sparkle,
  Warning,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { CreditReportRow } from "@/features/reports/queries";
import {
  formatCr,
  ratingTier,
  RATING_LADDER,
} from "@/features/reports/export";
import {
  Badge,
  CommandBar,
  Reveal,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  type Density,
} from "@/components/brand";
import type { BadgeProps } from "@/components/brand";

/**
 * Credit report client view - the filterable table. Filters (issuer search,
 * band, lifecycle, watchlist) are URL-driven so a filtered view is shareable
 * and the server re-runs the query on change; the CSV export button (in the
 * page's SectionHeading) auto-forwards the same URL params so the export
 * always matches the on-screen view. Density + pagination are pure client
 * state.
 */
export interface CreditReportViewProps {
  rows: CreditReportRow[];
  total: number;
  issuerCount: number;
  watchlistCount: number;
  bandDistribution: { band: string; count: number }[];
  q?: string;
  band?: string;
  lifecycle?: "current" | "superseded";
  watchlist?: boolean;
}

/** Rating-letter → badge variant via the shared rating-tier map (AAA/AA =
 *  emerald, A- = gold, BBB = info, BB/B/CCC/D = down). */
function bandVariant(band: string | null): BadgeProps["variant"] {
  return ratingTier(band);
}

const PAGE_SIZE = 25;

/** Double-bezel-flavoured native select - accessible + keyboard-friendly.
 *  Mirrors the parties explorer's FilterSelect. */
function FilterSelect({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 md:h-9 appearance-none rounded-full bg-foreground/[0.04] pl-3.5 pr-8 text-[12.5px] text-foreground",
          "ring-1 ring-hairline/60 transition-all duration-200 ease-soft",
          "focus:bg-foreground/[0.06] focus:ring-hairline focus:outline-none",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-3 size-3 text-muted-foreground"
      >
        <path
          d="M2 4l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function CreditReportView({
  rows,
  total,
  issuerCount,
  watchlistCount,
  bandDistribution,
  q,
  band,
  lifecycle,
  watchlist,
}: CreditReportViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [density, setDensity] = React.useState<Density>("comfortable");
  const [search, setSearch] = React.useState(q ?? "");
  const [lastQ, setLastQ] = React.useState(q ?? "");
  const [page, setPage] = React.useState(1);

  // Sync the search input if the URL changes elsewhere (back/forward).
  if ((q ?? "") !== lastQ) {
    setLastQ(q ?? "");
    setSearch(q ?? "");
  }

  // Reset to page 1 whenever the filtered row set changes.
  React.useEffect(() => {
    setPage(1);
  }, [q, band, lifecycle, watchlist, total]);

  const pushParam = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set(key, value);
      else params.delete(key);
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
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams(sp.toString());
        if (value.trim()) params.set("q", value.trim());
        else params.delete("q");
        params.delete("page");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      }, 280);
    },
    [router, pathname, sp],
  );
  React.useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  // Client-side pagination over the (server-filtered) rows.
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageRows = rows.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const rangeFrom = rows.length === 0 ? 0 : (curPage - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(curPage * PAGE_SIZE, rows.length);

  return (
    <div className="flex flex-col gap-5">
      <CommandBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search issuer…"
        density={density}
        onDensityChange={setDensity}
        label={`${rows.length} ${rows.length === 1 ? "analysis" : "analyses"}`}
        filters={
          <>
            <FilterSelect
              ariaLabel="Filter by scorecard band"
              value={band ?? "all"}
              onChange={(v) => pushParam("band", v === "all" ? "" : v)}
              options={[
                { value: "all", label: "All bands" },
                ...RATING_LADDER.map((b) => ({ value: b, label: b })),
              ]}
            />
            <FilterSelect
              ariaLabel="Filter by lifecycle"
              value={lifecycle ?? "all"}
              onChange={(v) =>
                pushParam(
                  "lifecycle",
                  v === "all" ? "" : v,
                )
              }
              options={[
                { value: "all", label: "All lifecycle" },
                { value: "current", label: "Current" },
                { value: "superseded", label: "Superseded" },
              ]}
            />
            <button
              type="button"
              aria-pressed={watchlist ?? false}
              onClick={() => pushParam("watchlist", watchlist ? "" : "1")}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] ring-1 transition-all duration-200 ease-soft md:h-9",
                watchlist
                  ? "bg-down/15 text-down ring-down/30"
                  : "bg-foreground/[0.04] text-muted-foreground ring-hairline/60 hover:text-foreground",
              )}
            >
              <Warning weight="light" className="size-3.5" />
              Watchlist
            </button>
          </>
        }
      />

      {/* Band distribution strip - quick visual of the filtered book. */}
      {bandDistribution.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Bands
          </span>
          {bandDistribution.map((b) => (
            <span
              key={b.band}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2.5 py-1 text-[11.5px] ring-1 ring-hairline/60"
            >
              <span className="font-medium text-foreground">{b.band}</span>
              <span className="nums tabular-nums text-muted-foreground">
                {b.count}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      <Reveal y={14}>
        <div className="overflow-hidden rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline">
          <div className="overflow-hidden rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface ring-1 ring-inset ring-foreground/[0.08]">
            <Table density={density}>
              <TableHeader>
                <TableRow>
                  <TableHead>Issuer</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Obligor</TableHead>
                  <TableHead className="hidden md:table-cell">Rating</TableHead>
                  <TableHead align="right">Score</TableHead>
                  <TableHead>Band</TableHead>
                  <TableHead>Lifecycle</TableHead>
                  <TableHead align="right">Exposure</TableHead>
                  <TableHead align="right" className="hidden lg:table-cell">
                    As of
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow className="hover:bg-transparent before:hidden">
                    <TableCell colSpan={9} className="p-0">
                      <TableEmpty
                        icon={<Sparkle weight="light" />}
                        title={
                          total === 0
                            ? "The credit book is a blank page."
                            : "No analyses match this filter."
                        }
                        hint={
                          total === 0
                            ? "Open a new credit file from an issuer to begin the spreading + scorecard workflow."
                            : "Try widening the band / lifecycle / search filter."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((r) => {
                    const score =
                      r.currentCreditScore != null
                        ? Number(r.currentCreditScore)
                        : null;
                    return (
                      <TableRow key={r.creditAnalysisId} className="cursor-pointer">
                        <TableCell primary>
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
                            <Badge variant={bandVariant(r.band)}>{r.band}</Badge>
                          ) : (
                            <span className="text-[12.5px] text-muted-foreground/60">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={r.lifecycleStatus === "current" ? "emerald" : "neutral"}
                          >
                            {r.lifecycleStatus}
                          </Badge>
                          {r.watchlistFlag ? (
                            <Badge
                              variant="down"
                              icon={<Warning weight="light" className="size-3" />}
                            >
                              watchlist
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell numeric>
                          {r.grossExposure != null ? (
                            <span className="nums tabular-nums font-medium">
                              {formatCr(r.grossExposure)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">-</span>
                          )}
                        </TableCell>
                        <TableCell
                          numeric
                          className="hidden lg:table-cell text-muted-foreground"
                        >
                          {r.exposureAsOf
                            ? new Date(`${r.exposureAsOf}T00:00:00`).toLocaleDateString(
                                "en-IN",
                                { year: "numeric", month: "short", day: "2-digit" },
                              )
                            : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Reveal>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] text-muted-foreground">
          {rows.length === 0 ? (
            "Nothing to show."
          ) : (
            <>
              <span className="nums tabular-nums text-foreground/80">
                {rangeFrom.toLocaleString("en-IN")}-
                {rangeTo.toLocaleString("en-IN")}
              </span>{" "}
              of{" "}
              <span className="nums tabular-nums text-foreground/80">
                {rows.length.toLocaleString("en-IN")}
              </span>{" "}
              · {issuerCount.toLocaleString("en-IN")} issuers ·{" "}
              {watchlistCount.toLocaleString("en-IN")} watchlist
            </>
          )}
        </p>
        {totalPages > 1 ? (
          <Pagination
            page={curPage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Pagination pills - mono page numbers, hairline chrome. Pure client state. */
function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const pages: number[] = [];
  const win = 1;
  const start = Math.max(1, page - win);
  const end = Math.min(totalPages, page + win);
  for (let i = start; i <= end; i++) pages.push(i);

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  const pill = (p: number, active: boolean, children: React.ReactNode) => (
    <button
      key={p}
      type="button"
      onClick={() => onPageChange(p)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center rounded-full px-2.5 text-[12.5px] transition-all duration-200 ease-soft md:h-8 md:min-w-8",
        active
          ? "bg-gold/15 text-gold-deep ring-1 ring-gold/30"
          : "text-muted-foreground ring-1 ring-hairline hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      <span className="nums tabular-nums">{children}</span>
    </button>
  );

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        aria-label="Previous page"
        aria-disabled={prevDisabled}
        className={cn(
          "inline-flex size-11 items-center justify-center rounded-full text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft hover:bg-foreground/[0.04] hover:text-foreground md:size-8",
          prevDisabled && "pointer-events-none opacity-40",
        )}
      >
        <ArrowLeft weight="light" className="size-4" />
      </button>
      {start > 1 ? pill(1, page === 1, "1") : null}
      {start > 2 ? <span className="px-1 text-muted-foreground/60">…</span> : null}
      {pages.map((p) => pill(p, p === page, p))}
      {end < totalPages - 1 ? (
        <span className="px-1 text-muted-foreground/60">…</span>
      ) : null}
      {end < totalPages ? pill(totalPages, page === totalPages, totalPages) : null}
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        aria-label="Next page"
        aria-disabled={nextDisabled}
        className={cn(
          "inline-flex size-11 items-center justify-center rounded-full text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft hover:bg-foreground/[0.04] hover:text-foreground md:size-8",
          nextDisabled && "pointer-events-none opacity-40",
        )}
      >
        <ArrowRight weight="light" className="size-4" />
      </button>
    </div>
  );
}