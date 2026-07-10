"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  MagnifyingGlass,
  PencilSimple,
  Warning,
  X,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Badge, Button, Reveal } from "@/components/brand";
import type { BadgeProps } from "@/components/brand";
import { ChartCard } from "@/components/brand/chart-theme";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  type Density,
} from "@/components/brand";
import { compactCr } from "@/features/reports/export";
import type { LimitRow, LimitUtilizationSummary } from "@/features/portfolio";
import { EditLimitDialog } from "./edit-limit-dialog";

/**
 * Limits management client view - the filterable, paginated counterparty-limit
 * table. Filters (limit type, status, issuer search) are URL-driven so a
 * filtered view is shareable and the server re-runs the query on change.
 * Density + pagination are pure client state.
 *
 * Each row carries an inline Edit action (a PencilSimple icon button) when the
 * current user holds credit_limit:approve (the server page computes canEdit
 * and passes it down). The EditLimitDialog submits to the updateLimit server
 * action via useActionState; on success the dialog closes + the page
 * revalidates.
 */
export interface LimitsViewProps {
  rows: LimitRow[];
  summary: LimitUtilizationSummary;
  canEdit: boolean;
  limitType?: string;
  status?: "breach" | "stale" | "ok";
  q?: string;
}

const LIMIT_TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "issuer_underwriting", label: "Issuer underwriting" },
  { value: "single_name", label: "Single name" },
  { value: "group", label: "Group" },
  { value: "sector", label: "Sector" },
  { value: "secondary_inventory", label: "Secondary inventory" },
  { value: "tenor", label: "Tenor" },
  { value: "country", label: "Country" },
  { value: "counterparty_concentration", label: "Counterparty concentration" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "breach", label: "Breached" },
  { value: "stale", label: "Stale" },
  { value: "ok", label: "Within limit" },
] as const;

const PAGE_SIZE = 25;

export function LimitsView({
  rows,
  summary,
  canEdit,
  limitType,
  status,
  q,
}: LimitsViewProps) {
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
  }, [limitType, status, q, rows.length]);

  const pushParam = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value && value !== "all") params.set(key, value);
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

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showingFrom = rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, rows.length);

  return (
    <div className="flex flex-col gap-5">
      {/* Filter bar. */}
      <Reveal y={8} duration={0.45} noBlur>
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-foreground/[0.03] p-2 ring-1 ring-hairline/70 backdrop-blur-sm">
          <FilterSelect
            ariaLabel="Filter by limit type"
            value={limitType ?? "all"}
            onChange={(v) => pushParam("limitType", v)}
            options={LIMIT_TYPE_OPTIONS as unknown as { value: string; label: string }[]}
          />
          <FilterSelect
            ariaLabel="Filter by status"
            value={status ?? "all"}
            onChange={(v) => pushParam("status", v)}
            options={STATUS_OPTIONS as unknown as { value: string; label: string }[]}
          />
          <div className="relative flex h-9 min-w-[180px] flex-1 items-center">
            <MagnifyingGlass
              weight="light"
              className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
            />
            <input
              type="search"
              aria-label="Search issuers"
              placeholder="Search issuer…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className={cn(
                "h-9 w-full appearance-none rounded-full bg-foreground/[0.04] pl-9 pr-9 text-[12.5px] text-foreground",
                "placeholder:text-muted-foreground/60 ring-1 ring-hairline/60 transition-all duration-200 ease-soft",
                "focus:bg-foreground/[0.06] focus:ring-hairline focus:outline-none",
              )}
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                <X weight="light" className="size-3.5" />
              </button>
            ) : null}
          </div>
          <DensityToggle density={density} onChange={setDensity} />
        </div>
      </Reveal>

      {/* Table. */}
      <Reveal y={10} delay={0.04}>
        <ChartCard
          title="Counterparty limits"
          description={`${rows.length.toLocaleString("en-IN")} line${rows.length === 1 ? "" : "s"} · ${summary.overall.breachCount.toLocaleString("en-IN")} breached`}
        >
          <div className="overflow-hidden rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline">
            <div className="overflow-hidden rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface ring-1 ring-inset ring-foreground/[0.08]">
              <Table density={density}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Obligor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead align="right">Limit</TableHead>
                    <TableHead align="right">Utilized</TableHead>
                    <TableHead align="right" className="hidden sm:table-cell">
                      Available
                    </TableHead>
                    <TableHead align="right">Util.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead align="right" className="hidden lg:table-cell">
                      Review
                    </TableHead>
                    {canEdit ? <TableHead align="right" className="w-[3rem]" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.length === 0 ? (
                    <TableRow className="hover:bg-transparent before:hidden">
                      <TableCell colSpan={canEdit ? 9 : 8} className="p-0">
                        <TableEmpty
                          icon={<Warning weight="light" />}
                          title={
                            rows.length === 0
                              ? "No limits on the blotter."
                              : "No limits match this filter."
                          }
                          hint={
                            rows.length === 0
                              ? "Approved counterparty limits will appear here once the credit desk sets them."
                              : "Try widening the type / status / search filter."
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((r) => (
                      <TableRow key={r.creditLimitId}>
                        <TableCell primary>
                          <span className="inline-flex flex-col gap-0.5">
                            <Link
                              href={`/parties/${r.partyId}`}
                              className="relative z-10 transition-colors duration-200 ease-soft hover:text-gold"
                            >
                              {r.partyName}
                            </Link>
                            <span className="text-[10.5px] font-normal uppercase tracking-[0.1em] text-muted-foreground/70">
                              {r.currency}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[12.5px] text-foreground/80">
                            {r.limitTypeLabel}
                          </span>
                        </TableCell>
                        <TableCell align="right" numeric>
                          {compactCr(r.limitAmountCr)}
                        </TableCell>
                        <TableCell align="right" numeric>
                          {compactCr(r.utilizedCr)}
                        </TableCell>
                        <TableCell
                          align="right"
                          numeric
                          className={cn(
                            "hidden sm:table-cell",
                            r.availableCr < 0 ? "text-down" : "text-foreground/80",
                          )}
                        >
                          {compactCr(r.availableCr)}
                        </TableCell>
                        <TableCell align="right" numeric>
                          <UtilizationPct row={r} />
                        </TableCell>
                        <TableCell>
                          <LimitStatusBadges row={r} />
                        </TableCell>
                        <TableCell
                          align="right"
                          numeric
                          className="hidden text-[12px] lg:table-cell"
                        >
                          <ReviewDue row={r} />
                        </TableCell>
                        {canEdit ? (
                          <TableCell align="right">
                            <EditLimitDialog row={r} />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination + count. */}
          {rows.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5 pt-4 md:px-6">
              <span className="text-[11.5px] text-muted-foreground">
                Showing{" "}
                <span className="nums font-medium tabular-nums text-foreground/80">
                  {showingFrom.toLocaleString("en-IN")}
                </span>
                –
                <span className="nums font-medium tabular-nums text-foreground/80">
                  {showingTo.toLocaleString("en-IN")}
                </span>{" "}
                of{" "}
                <span className="nums font-medium tabular-nums text-foreground/80">
                  {rows.length.toLocaleString("en-IN")}
                </span>{" "}
                lines
              </span>
              {totalPages > 1 ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary-hairline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <span className="nums px-2 text-[12px] tabular-nums text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="secondary-hairline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ArrowRight weight="light" className="size-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </ChartCard>
      </Reveal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cell renderers.
// ---------------------------------------------------------------------------

function UtilizationPct({ row }: { row: LimitRow }) {
  const breached = row.breached;
  return (
    <span
      className={cn(
        "nums font-medium tabular-nums",
        breached ? "text-down" : row.utilizationPct > 80 ? "text-gold" : "text-foreground/80",
      )}
    >
      {row.limitAmountCr > 0 ? `${row.utilizationPct.toFixed(1)}%` : "-"}
    </span>
  );
}

function LimitStatusBadges({ row }: { row: LimitRow }) {
  const badges: { variant: BadgeProps["variant"]; label: string }[] = [];
  if (row.breached) badges.push({ variant: "down", label: "Breached" });
  if (row.isStale) badges.push({ variant: "gold", label: "Stale" });
  if (badges.length === 0)
    badges.push({ variant: "up", label: "Within" });
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <Badge key={b.label} variant={b.variant}>
          {b.label}
        </Badge>
      ))}
    </div>
  );
}

function ReviewDue({ row }: { row: LimitRow }) {
  if (row.reviewInDays == null) return <span className="text-muted-foreground">-</span>;
  const overdue = row.reviewInDays < 0;
  const soon = row.reviewInDays <= 30 && row.reviewInDays >= 0;
  return (
    <span
      className={cn(
        "nums tabular-nums",
        overdue ? "text-down" : soon ? "text-gold" : "text-muted-foreground",
      )}
    >
      {row.reviewDueDate ? formatDate(row.reviewDueDate) : "-"}
      <span className="ml-1 text-[10.5px]">
        {overdue
          ? `(${Math.abs(row.reviewInDays)}d over)`
          : `(${row.reviewInDays}d)`}
      </span>
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Filter controls.
// ---------------------------------------------------------------------------

function FilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "inline-flex h-9 appearance-none rounded-full bg-foreground/[0.04] pl-3.5 pr-8 text-[12px] font-medium text-foreground",
          "ring-1 ring-hairline/60 transition-all duration-200 ease-soft focus:bg-foreground/[0.06] focus:ring-hairline focus:outline-none",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-2 -translate-y-1/2 border-x-4 border-x-transparent border-t-[5px] border-t-muted-foreground"
      />
    </div>
  );
}

function DensityToggle({
  density,
  onChange,
}: {
  density: Density;
  onChange: (d: Density) => void;
}) {
  return (
    <div className="ml-auto inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] p-0.5 ring-1 ring-hairline/60">
      {(["comfortable", "compact"] as const).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          aria-pressed={density === d}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-all duration-200 ease-soft",
            density === d
              ? "bg-foreground/10 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {d}
        </button>
      ))}
    </div>
  );
}