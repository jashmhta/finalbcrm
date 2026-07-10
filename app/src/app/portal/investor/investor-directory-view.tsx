"use client";

/**
 * InvestorDirectoryView - the investor-portal landing client view.
 *
 * A ranked, searchable directory of investor parties (the buy-side book).
 * Each row is a Link to /portal/investor/[id] (the read-only portfolio view).
 * Search is URL-driven (shareable ?q=); pagination syncs to ?page=. KPI tiles
 * summarise the whole matching set (total investors, total portfolio value,
 * investors with holdings, avg portfolio).
 *
 * Read-only - no edit / new buttons. The CommandBar carries only the search
 * field + a result-count eyebrow. Primary content renders VISIBLE on mount
 * (no whileInView opacity-0 gate on the table).
 */
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CaretRight,
  ChartLineUp,
  Coins,
  TrendUp,
  Users,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  Badge,
  CommandBar,
  Money,
  StatCard,
} from "@/components/brand";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/brand";
import type { InvestorListItem, InvestorListSummary } from "@/features/portal";

export interface InvestorDirectoryViewProps {
  rows: InvestorListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
  summary: InvestorListSummary;
}

const NATURE_LABEL: Record<string, string> = {
  organization: "Organization",
  natural_person: "Natural person",
  spv: "SPV",
  trust: "Trust",
  government: "Government",
  regulator: "Regulator",
};

function kycVariant(status: string | null): "emerald" | "down" | "info" | "outline" {
  if (!status) return "outline";
  if (status === "approved") return "emerald";
  if (status === "rejected" || status === "expired") return "down";
  return "info";
}

export function InvestorDirectoryView({
  rows,
  total,
  page,
  pageSize,
  totalPages,
  q,
  summary,
}: InvestorDirectoryViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(q ?? "");

  // Sync the search field to ?q= with a 280ms debounce (same cadence as the
  // parties explorer) so each keystroke doesn't trigger a server round-trip.
  // Reset to the server-provided q when the URL changes (back/forward nav).
  React.useEffect(() => {
    setSearch(q ?? "");
  }, [q]);

  const pushSearch = React.useCallback(
    (value: string) => {
      const sp = new URLSearchParams(searchParams?.toString() ?? "");
      if (value.trim()) sp.set("q", value.trim());
      else sp.delete("q");
      sp.delete("page");
      router.replace(`/portal/investor?${sp.toString()}`);
    },
    [router, searchParams],
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
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const goPage = (p: number) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    sp.set("page", String(p));
    router.push(`/portal/investor?${sp.toString()}`);
  };

  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* KPI row - the whole matching set at a glance. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Investors"
          value={summary.totalInvestors}
          preset="int"
          icon={<Users weight="light" />}
        />
        <StatCard
          label="Portfolio value"
          value={summary.totalPortfolioValueCr}
          preset="currency"
          icon={<Coins weight="light" />}
          tone="gold"
        />
        <StatCard
          label="With holdings"
          value={summary.investorsWithHoldings}
          preset="int"
          icon={<TrendUp weight="light" />}
        />
        <StatCard
          label="Avg portfolio"
          value={summary.avgPortfolioValueCr}
          preset="currency"
          icon={<ChartLineUp weight="light" />}
        />
      </div>

      <CommandBar
        label="Investor directory"
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search investors by name…"
        actions={
          <span className="nums hidden text-[11.5px] tabular-nums text-muted-foreground sm:inline">
            {total.toLocaleString("en-IN")}{" "}
            {total === 1 ? "investor" : "investors"}
          </span>
        }
      />

      <div className="overflow-hidden rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline shadow-shell">
        <div className="overflow-hidden rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface ring-1 ring-inset ring-foreground/[0.08]">
          <Table density="comfortable">
            <TableHeader>
              <TableRow>
                <TableHead>Investor</TableHead>
                <TableHead className="hidden md:table-cell">Nature</TableHead>
                <TableHead className="hidden lg:table-cell">KYC</TableHead>
                <TableHead align="right">Holdings</TableHead>
                <TableHead align="right">Portfolio value</TableHead>
                <TableHead className="hidden xl:table-cell" align="right">
                  Last allocation
                </TableHead>
                <TableHead align="right" className="pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableEmpty
                  icon={<Users weight="light" />}
                  title="No investors found."
                  hint={
                    q
                      ? `No investor parties match “${q}”. Clear the search to see the full directory.`
                      : "No investor parties have been typed yet. Investors appear here once a party is assigned the investor type."
                  }
                />
              ) : (
                rows.map((r) => (
                  <TableRow key={r.partyId} className="group">
                    <TableCell primary>
                      <Link
                        href={`/portal/investor/${r.partyId}`}
                        className="flex flex-col gap-0.5"
                      >
                        <span className="text-foreground font-medium">
                          {r.legalName}
                        </span>
                        {r.displayName && r.displayName !== r.legalName ? (
                          <span className="text-[11.5px] text-muted-foreground">
                            {r.displayName}
                          </span>
                        ) : null}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {NATURE_LABEL[r.partyNature] ?? r.partyNature}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant={kycVariant(r.kycStatus)}>
                        {r.kycStatus ?? "No KYC"}
                      </Badge>
                    </TableCell>
                    <TableCell numeric>
                      {r.holdingCount.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell numeric>
                      <Money value={r.portfolioValueCr * 1e7} compact />
                    </TableCell>
                    <TableCell className="hidden xl:table-cell nums text-muted-foreground">
                      {r.lastAllocationAt
                        ? r.lastAllocationAt.toLocaleDateString("en-IN", {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell align="right" className="pr-5">
                      <Link
                        href={`/portal/investor/${r.partyId}`}
                        aria-label={`Open ${r.legalName} portfolio`}
                        className={cn(
                          "inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 ease-soft",
                          "group-hover:bg-gold/[0.10] group-hover:text-gold",
                        )}
                      >
                        <CaretRight weight="light" className="size-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination - pill buttons + mono page numbers + the showing-X-of-Y. */}
      {total > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="nums text-[11.5px] tabular-nums text-muted-foreground">
            Showing {showingFrom.toLocaleString("en-IN")}–
            {showingTo.toLocaleString("en-IN")} of{" "}
            {total.toLocaleString("en-IN")}
          </span>
          <div className="flex items-center gap-1.5">
            <PaginationPill
              disabled={page <= 1}
              onClick={() => goPage(page - 1)}
              label="Prev"
            />
            <span className="nums px-2 text-[12px] tabular-nums text-muted-foreground">
              {page} / {totalPages}
            </span>
            <PaginationPill
              disabled={page >= totalPages}
              onClick={() => goPage(page + 1)}
              label="Next"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PaginationPill({
  disabled,
  onClick,
  label,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full px-3.5 text-[12px] font-medium transition-all duration-300 ease-soft",
        "ring-1 ring-hairline text-foreground/70",
        "hover:bg-foreground/[0.05] hover:text-foreground",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      {label}
      <ArrowRight weight="light" className="size-3.5" />
    </button>
  );
}