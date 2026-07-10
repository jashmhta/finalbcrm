"use client";

// Admin → Audit - client view layer (forensic).
//
// A dense, filterable table of the immutable audit log with an expandable
// per-row diff inspector (old → new JSON + hash-chain link + IP / UA /
// correlation). Filters are URL-driven (entity / operation / actor / date
// range / barrier) so a forensic view is shareable + bookmarkable. The actor
// + barrier filters use the admin query's joined actor_email + barrier_id
// (the compliance audit page derives actor client-side; the admin view has
// the full filter set server-side).
//
// Mount-based motion; primary content renders VISIBLE on first paint. Only
// transform/opacity animate.

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowClockwise,
  X,
  Faders,
  Hash,
  ShieldCheck,
  LinkBreak,
  CaretDown,
  CaretRight,
  Link as LinkIcon,
  House,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { AuditLogRow } from "@/features/admin/queries";
import {
  ActionBadge,
  actionFromVerb,
  Badge,
  Card,
  CardBody,
  CommandBar,
  EmptyState,
  Eyebrow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type Density,
} from "@/components/brand";

const EASE = [0.32, 0.72, 0, 1] as const;

export interface AdminAuditViewProps {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
  entityType?: string;
  operation?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  barrierId?: string;
  entityTypes: string[];
  operations: string[];
  barriers: { barrierId: string; n: number }[];
  users: { userId: string; email: string }[];
}

export function AdminAuditView(props: AdminAuditViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [density, setDensity] = React.useState<Density>("comfortable");
  const [search, setSearch] = React.useState(props.q ?? "");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  // Sync the local search box when the URL `q` changes (e.g. on pagination).
  React.useEffect(() => {
    setSearch(props.q ?? "");
  }, [props.q]);

  function pushParams(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    // Any filter change resets to page 1.
    if (!("page" in updates)) next.delete("page");
    router.push(`/admin/audit?${next.toString()}`, { scroll: false });
  }

  // Debounced search → URL push (280ms, matches the compliance audit view).
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchChange = React.useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ q: value.trim() || undefined });
    }, 280);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  React.useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeFilterCount =
    [props.entityType, props.operation, props.actorUserId, props.from, props.to, props.barrierId].filter(
      Boolean,
    ).length + (props.q ? 1 : 0);

  // Stat strip reads.
  const chainBroken = props.rows.some(
    (r) => r.rowHash && (!r.prevHash || r.prevHash === "") && r.entityType !== "",
  );
  // Top actor on the current page (by count).
  const actorCounts = new Map<string, number>();
  for (const r of props.rows) {
    const key = r.actorEmail ?? "system";
    actorCounts.set(key, (actorCounts.get(key) ?? 0) + 1);
  }
  const topActor = Array.from(actorCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const hasFilters = activeFilterCount > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Stat strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          icon={<Hash weight="light" className="size-3.5" />}
          label="On page"
          value={props.rows.length.toLocaleString("en-IN")}
        />
        <StatTile
          icon={<Faders weight="light" className="size-3.5" />}
          label="Total matches"
          value={props.total.toLocaleString("en-IN")}
        />
        <StatTile
          icon={chainBroken ? <LinkBreak weight="light" className="size-3.5 text-rose-500" /> : <ShieldCheck weight="light" className="size-3.5 text-emerald-500" />}
          label="Chain on page"
          value={chainBroken ? "broken" : "intact"}
          tone={chainBroken ? "bad" : "good"}
        />
        <StatTile
          icon={<House weight="light" className="size-3.5" />}
          label="Top actor"
          value={topActor ?? "-"}
          mono={false}
          truncate
        />
      </div>

      {/* ── Command bar (search + density + reset) ────────────────────── */}
      <CommandBar
        label="Audit log"
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search entity / role…"
        density={density}
        onDensityChange={setDensity}
        keepVisible={hasFilters}
        actions={
          <>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => router.push("/admin/audit", { scroll: false })}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-muted-foreground ring-1 ring-hairline transition-colors hover:text-foreground"
              >
                <X weight="light" className="size-3.5" />
                Clear ({activeFilterCount})
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground ring-1 ring-hairline transition-all hover:text-foreground active:scale-[0.96]"
              aria-label="Refresh"
              title="Refresh"
            >
              <ArrowClockwise weight="light" className="size-4" />
            </button>
          </>
        }
      />

      {/* ── Advanced filters ──────────────────────────────────────────── */}
      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Eyebrow dot>Advanced filters</Eyebrow>
            <span className="text-[11px] text-muted-foreground">
              URL-driven · shareable
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <FilterField label="Entity type">
              <FilterSelect
                value={props.entityType ?? ""}
                onChange={(v) => pushParams({ entityType: v || undefined })}
                options={[
                  { value: "", label: "All entities" },
                  ...props.entityTypes.map((t) => ({ value: t, label: prettify(t) })),
                ]}
              />
            </FilterField>
            <FilterField label="Operation">
              <FilterSelect
                value={props.operation ?? ""}
                onChange={(v) => pushParams({ operation: v || undefined })}
                options={[
                  { value: "", label: "All operations" },
                  ...props.operations.map((o) => ({ value: o, label: o })),
                ]}
              />
            </FilterField>
            <FilterField label="Actor">
              <FilterSelect
                value={props.actorUserId ?? ""}
                onChange={(v) => pushParams({ actorUserId: v || undefined })}
                options={[
                  { value: "", label: "All actors" },
                  ...props.users.map((u) => ({ value: u.userId, label: u.email })),
                ]}
              />
            </FilterField>
            <FilterField label="From date">
              <FilterDate
                value={props.from ?? ""}
                onChange={(v) => pushParams({ from: v || undefined })}
              />
            </FilterField>
            <FilterField label="To date">
              <FilterDate
                value={props.to ?? ""}
                onChange={(v) => pushParams({ to: v || undefined })}
              />
            </FilterField>
            <FilterField label="Barrier">
              <FilterSelect
                value={props.barrierId ?? ""}
                onChange={(v) => pushParams({ barrierId: v || undefined })}
                options={[
                  { value: "", label: "All barriers" },
                  ...props.barriers.map((b) => ({
                    value: b.barrierId,
                    label: `${b.barrierId.slice(0, 8)}… (${b.n})`,
                  })),
                ]}
              />
            </FilterField>
          </div>
        </CardBody>
      </Card>

      {/* ── Audit table ───────────────────────────────────────────────── */}
      <Card>
        <CardBody className="p-0">
          <Table density={density}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Operation</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="hidden md:table-cell">Actor</TableHead>
                <TableHead className="hidden lg:table-cell">Barrier</TableHead>
                <TableHead className="hidden md:table-cell">When</TableHead>
                <TableHead className="hidden xl:table-cell">Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.rows.length === 0 ? (
                <TableRow className="hover:bg-transparent before:hidden">
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      icon={<ShieldCheck weight="light" />}
                      title="No events match."
                      hint={hasFilters ? "Adjust the filters or clear them." : "The audit log is empty."}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                props.rows.map((row) => {
                  const isOpen = expanded.has(row.auditLogId);
                  const brokenLink = !row.prevHash || row.prevHash === "";
                  return (
                    <AuditRow
                      key={row.auditLogId}
                      row={row}
                      isOpen={isOpen}
                      onToggle={() => toggleExpanded(row.auditLogId)}
                      brokenLink={brokenLink}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      <Pagination
        page={props.page}
        totalPages={props.totalPages}
        total={props.total}
        pageSize={props.pageSize}
        onPrev={() => pushParams({ page: String(Math.max(1, props.page - 1)) })}
        onNext={() => pushParams({ page: String(Math.min(props.totalPages, props.page + 1)) })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit row - expandable diff inspector
// ---------------------------------------------------------------------------

function AuditRow({
  row,
  isOpen,
  onToggle,
  brokenLink,
}: {
  row: AuditLogRow;
  isOpen: boolean;
  onToggle: () => void;
  brokenLink: boolean;
}) {
  return (
    <>
      <TableRow onClick={onToggle} className="cursor-pointer">
        <TableCell className="w-8 px-2">
          {isOpen ? (
            <CaretDown weight="light" className="size-3.5 text-muted-foreground" />
          ) : (
            <CaretRight weight="light" className="size-3.5 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell>
          <ActionBadge action={actionFromVerb(row.operation)}>
            {row.operation}
          </ActionBadge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="text-foreground">{prettify(row.entityType)}</span>
            {row.fieldName ? (
              <span className="text-[11px] text-muted-foreground">· {row.fieldName}</span>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          {row.actorEmail ? (
            <span className="text-muted-foreground">{row.actorEmail}</span>
          ) : (
            <span className="italic text-muted-foreground">system</span>
          )}
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          {row.barrierId ? (
            <span className="nums inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <LinkIcon weight="light" className="size-3" />
              {row.barrierId.slice(0, 8)}…
            </span>
          ) : (
            <span className="text-muted-foreground/50">-</span>
          )}
        </TableCell>
        <TableCell className="hidden md:table-cell nums tabular-nums text-muted-foreground">
          {fmtDateTime(row.occurredAt)}
        </TableCell>
        <TableCell className="hidden xl:table-cell">
          {row.rowHash ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  brokenLink ? "bg-rose-500" : "bg-emerald-500",
                )}
                title={brokenLink ? "Chain link broken (no prev_hash)" : "Chain link intact"}
              />
              <span className="nums text-[11px] tabular-nums text-muted-foreground">
                {row.rowHash.slice(0, 10)}…
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground/50">-</span>
          )}
        </TableCell>
      </TableRow>
      {isOpen ? (
        <TableRow className="cursor-default hover:bg-transparent">
          <TableCell colSpan={7} className="bg-foreground/[0.02] p-0">
            <AnimatePresence initial={false}>
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-2">
                  <DiffPane label="Old value" value={row.oldValue} />
                  <DiffPane label="New value" value={row.newValue} />
                  <div className="lg:col-span-2 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Meta label="Entity ID" value={row.entityId ?? "-"} mono />
                    <Meta label="Actor role" value={row.actorRoleAtTime ?? "-"} />
                    <Meta label="IP address" value={row.ipAddress ?? "-"} mono />
                    <Meta label="Correlation" value={row.correlationId ?? "-"} mono />
                    <Meta
                      label="prev_hash"
                      value={row.prevHash ? `${row.prevHash.slice(0, 16)}…` : "- (genesis)"}
                      mono
                    />
                    <Meta
                      label="row_hash"
                      value={row.rowHash ? `${row.rowHash.slice(0, 16)}…` : "-"}
                      mono
                    />
                    <Meta
                      label="User agent"
                      value={row.userAgent ?? "-"}
                      mono
                      className="col-span-2 md:col-span-2"
                    />
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function DiffPane({ label, value }: { label: string; value: unknown }) {
  const text = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <pre
        className={cn(
          "max-h-64 overflow-auto rounded-xl bg-surface p-3 text-[11.5px] leading-[1.5] ring-1 ring-inset ring-foreground/[0.07]",
          "nums font-mono tabular-nums",
          text ? "text-foreground/80" : "text-muted-foreground/50 italic",
        )}
      >
        {text || "-"}
      </pre>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
        {label}
      </span>
      <span
        className={cn(
          "truncate text-[12px] text-foreground/80",
          mono && "nums font-mono tabular-nums",
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

function StatTile({
  icon,
  label,
  value,
  tone = "neutral",
  mono = true,
  truncate = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "neutral" | "good" | "bad";
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface px-3.5 py-3 ring-1 ring-inset ring-foreground/[0.07]">
      <span
        className={cn(
          "grid size-8 place-items-center rounded-full bg-foreground/[0.06]",
          tone === "good" ? "text-emerald-500" : tone === "bad" ? "text-rose-500" : "text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "text-[14px] font-medium text-foreground",
            mono && "nums tabular-nums",
            truncate && "truncate",
          )}
          title={truncate ? value : undefined}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-muted-foreground">
        Showing{" "}
        <span className="nums tabular-nums text-foreground">{from}</span>–
        <span className="nums tabular-nums text-foreground">{to}</span> of{" "}
        <span className="nums tabular-nums text-foreground">
          {total.toLocaleString("en-IN")}
        </span>
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground ring-1 ring-hairline transition-all hover:text-foreground active:scale-[0.96] disabled:opacity-40 disabled:hover:text-muted-foreground"
          aria-label="Previous page"
        >
          <ArrowLeft weight="light" className="size-4" />
        </button>
        <span className="nums px-2 text-[12px] tabular-nums text-foreground">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground ring-1 ring-hairline transition-all hover:text-foreground active:scale-[0.96] disabled:opacity-40 disabled:hover:text-muted-foreground"
          aria-label="Next page"
        >
          <ArrowRight weight="light" className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter primitives
// ---------------------------------------------------------------------------

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none rounded-xl bg-surface px-3.5 pr-9 text-[13px] text-foreground ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus:outline-none focus:ring-hairline"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <CaretDown
        aria-hidden
        weight="light"
        className="pointer-events-none absolute right-3 size-3.5 text-muted-foreground"
      />
    </div>
  );
}

function FilterDate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full appearance-none rounded-xl bg-surface px-3.5 text-[13px] text-foreground ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus:outline-none focus:ring-hairline"
    />
  );
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function prettify(s: string): string {
  return s.replace(/_/g, " ");
}

function fmtDateTime(v: string | Date | null): string {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}