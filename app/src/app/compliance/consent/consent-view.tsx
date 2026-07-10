"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { animate, useInView } from "framer-motion";
import {
  Sparkle,
  ShieldCheck,
  Scroll,
  Clock,
  CheckCircle,
  XCircle,
  UserCircle,
  CaretRight,
  Timer,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type {
  ConsentListResult,
  DsrListResult,
} from "@/features/compliance/queries";
import { computeDsrDueDate } from "@/features/compliance/consent";
import type { BadgeProps } from "@/components/brand";
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
import { Eyebrow } from "@/components/brand/text";
import {
  CaptureConsentDialog,
  WithdrawConsentButton,
  CreateDsrDialog,
  TransitionDsrControls,
} from "./consent-action-forms";
import type { DsrStatus } from "@/features/compliance/consent";

const EASE = [0.32, 0.72, 0, 1] as const;

/** Mono count-up - animates 0 → value on enter-view (tabular-nums, --ease-soft). */
function CountUp({
  value,
  format,
  duration = 1.0,
  className,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-8%" });
  const [display, setDisplay] = React.useState(0);
  React.useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, duration]);
  return (
    <span ref={ref} className={cn("nums tabular-nums font-medium", className)}>
      {format(display)}
    </span>
  );
}

/**
 * Client view layer for the DPDP consent workspace. The server page runs both
 * `listConsentRecords` and `listDataSubjectRequests` and hands the datasets +
 * active URL filters in; this component owns the tab switch (consent ledger /
 * DSR), the floating command bar (filters adapt to the active tab), the
 * consent ledger table, and the DSR card grid.
 *
 * The active tab + every filter stay URL-driven (shareable) and are pushed via
 * the router so the server re-runs the queries. Density is pure client state.
 */
export interface ConsentViewProps {
  consent: ConsentListResult;
  dsrs: DsrListResult;
  q?: string;
  purpose?: string;
  activeOnly: boolean;
  dsrStatus?: string;
  dsrType?: string;
  tab: string;
  purposes: string[];
  dsrTypes: string[];
  dsrStatuses: string[];
}

const DSR_STATUS_BADGE: Record<string, { variant: BadgeProps["variant"]; dot?: boolean }> = {
  received: { variant: "outline" },
  in_review: { variant: "info" },
  fulfilled: { variant: "emerald", dot: true },
  rejected: { variant: "down" },
  cancelled: { variant: "neutral" },
};

function pretty(s: string): string {
  return s.replace(/_/g, " ");
}

function fmtDate(v: string | Date | null): string {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function ConsentView({
  consent,
  dsrs,
  q,
  purpose,
  activeOnly,
  dsrStatus,
  dsrType,
  tab,
  purposes,
  dsrTypes,
  dsrStatuses,
}: ConsentViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [density, setDensity] = React.useState<Density>("comfortable");
  const [search, setSearch] = React.useState(q ?? "");

  React.useEffect(() => {
    setSearch(q ?? "");
  }, [q]);

  const isConsentTab = tab !== "dsr";

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

  const hasConsentFilters = Boolean(q || purpose || activeOnly);
  const hasDsrFilters = Boolean(q || dsrStatus || dsrType);

  return (
    <div className="flex flex-col gap-5">
      {/* Tab switch - pill segments, URL-driven */}
      <Reveal y={8} duration={0.5} noBlur>
        <div className="inline-flex w-full items-center gap-1 rounded-full bg-foreground/[0.04] p-1 ring-1 ring-hairline/60 sm:w-auto">
          <TabPill
            href={`/compliance/consent?${new URLSearchParams(
              Object.fromEntries(
                Object.entries({
                  ...(q ? { q } : {}),
                  ...(purpose ? { purpose } : {}),
                  ...(activeOnly ? { active: "1" } : {}),
                  tab: "consent",
                }).filter(([, v]) => v != null),
              ),
            ).toString()}`}
            active={isConsentTab}
          >
            Consent ledger
          </TabPill>
          <TabPill
            href={`/compliance/consent?${new URLSearchParams(
              Object.fromEntries(
                Object.entries({
                  ...(q ? { q } : {}),
                  ...(dsrStatus ? { dsrStatus } : {}),
                  ...(dsrType ? { dsrType } : {}),
                  tab: "dsr",
                }).filter(([, v]) => v != null),
              ),
            ).toString()}`}
            active={!isConsentTab}
          >
            Data-subject requests
          </TabPill>
        </div>
      </Reveal>

      {isConsentTab ? (
        <>
          <CommandBar
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder="Search party / contact / purpose…"
            density={density}
            onDensityChange={setDensity}
            label={`${consent.total} ${consent.total === 1 ? "record" : "records"}`}
            filters={
              <>
                <SelectPill
                  ariaLabel="Filter by purpose"
                  value={purpose ?? ""}
                  onChange={(v) => pushParam("purpose", v)}
                  placeholder="All purposes"
                  options={purposes.map((p) => ({
                    value: p,
                    label: pretty(p),
                  }))}
                />
                <TogglePill
                  label="active only"
                  active={activeOnly}
                  onClick={() => pushParam("active", activeOnly ? "" : "1")}
                />
                {hasConsentFilters ? (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Sparkle weight="light" className="size-3.5" />}
                  >
                    <Link href="/compliance/consent?tab=consent">Clear</Link>
                  </Button>
                ) : null}
              </>
            }
            actions={<CaptureConsentDialog />}
          />

          <Reveal y={14}>
            {/* ambient halo + the core's own overflow-hidden clips the table
                to the bezel - the amplified depth reads on the ledger. */}
            <Card>
              <Table density={density}>
                <TableHeader>
                  <TableRow className="[&>th]:px-5">
                    <TableHead>Party / contact</TableHead>
                    <TableHead>Purpose</TableHead>
                    {/* Mobile: key-columns-only - Method / Withdrawn / Retention
                        are secondary on a phone, dropped below md so the ledger
                        reads Party · Purpose · Given · State. md+ restores the
                        full 7-col compliance read. */}
                    <TableHead className="hidden md:table-cell">Method</TableHead>
                    <TableHead align="right">Given</TableHead>
                    <TableHead align="right" className="hidden md:table-cell">
                      Withdrawn
                    </TableHead>
                    <TableHead align="right" className="hidden md:table-cell">
                      Retention until
                    </TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consent.rows.length === 0 ? (
                    <TableRow className="hover:bg-transparent before:hidden">
                      <TableCell colSpan={7} className="p-0">
                        <TableEmpty
                          icon={<Scroll weight="light" />}
                          title={
                            consent.total === 0
                              ? "No consents on record."
                              : "No consent records match this view."
                          }
                          hint={
                            consent.total === 0
                              ? "Consent is captured per purpose during onboarding and engagement."
                              : "Try clearing the purpose filter or the active-only toggle."
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    consent.rows.map((r) => (
                      <TableRow
                        key={r.consentRecordId}
                        // [&>td] override beats TableCell's own px-4 py-3.5 via
                        // descendant-selector specificity - looser horizontal
                        // density (px-5) + vertical breathing room (py-4).
                        className="[&>td]:px-5 [&>td]:py-4"
                      >
                        <TableCell primary>
                          <span className="flex flex-col gap-0.5">
                            <span>
                              {r.partyLegalName ??
                                r.contactFullName ??
                                "-"}
                            </span>
                            {r.purposeDescription ? (
                              <span className="text-[11px] font-normal text-muted-foreground">
                                {r.purposeDescription}
                              </span>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="info">{pretty(r.purpose)}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-foreground/70">
                            {r.consentMethod ? pretty(r.consentMethod) : "-"}
                          </span>
                        </TableCell>
                        <TableCell numeric>
                          <span className="text-foreground/75">
                            {fmtDate(r.consentGivenAt ?? null)}
                          </span>
                        </TableCell>
                        <TableCell numeric className="hidden md:table-cell">
                          <span className="text-muted-foreground">
                            {fmtDate(r.consentWithdrawnAt ?? null)}
                          </span>
                        </TableCell>
                        <TableCell numeric className="hidden md:table-cell">
                          <RetentionCell
                            retentionUntil={r.retentionUntil}
                            active={r.active}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {r.active ? (
                              <Badge variant="emerald" dot>
                                active
                              </Badge>
                            ) : (
                              <Badge variant="neutral">withdrawn</Badge>
                            )}
                            {r.active ? (
                              <WithdrawConsentButton
                                consentRecordId={r.consentRecordId}
                              />
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </Reveal>

          <p className="text-[12.5px] text-muted-foreground">
            <CountUp
              value={consent.rows.length}
              format={(n) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              className="text-foreground/80"
            />{" "}
            shown · sorted by most recent first.
          </p>
        </>
      ) : (
        <>
          <CommandBar
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder="Search principal…"
            filters={
              <>
                <SelectPill
                  ariaLabel="Filter by request type"
                  value={dsrType ?? ""}
                  onChange={(v) => pushParam("dsrType", v)}
                  placeholder="All types"
                  options={dsrTypes.map((t) => ({
                    value: t,
                    label: pretty(t),
                  }))}
                />
                <SelectPill
                  ariaLabel="Filter by DSR status"
                  value={dsrStatus ?? ""}
                  onChange={(v) => pushParam("dsrStatus", v)}
                  placeholder="All statuses"
                  options={dsrStatuses.map((s) => ({
                    value: s,
                    label: pretty(s),
                  }))}
                />
                {hasDsrFilters ? (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Sparkle weight="light" className="size-3.5" />}
                  >
                    <Link href="/compliance/consent?tab=dsr">Clear</Link>
                  </Button>
                ) : null}
              </>
            }
            actions={<CreateDsrDialog />}
          />

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {dsrs.rows.length === 0 ? (
              <div className="sm:col-span-2 xl:col-span-3">
                <Card className="overflow-hidden">
                  <TableEmpty
                    icon={<ShieldCheck weight="light" />}
                    title={
                      dsrs.total === 0
                        ? "No principal-rights requests filed."
                        : "No requests match this view."
                    }
                    hint={
                      dsrs.total === 0
                        ? "DSRs are created when a principal exercises an access, erasure, rectification, restriction or portability right."
                        : "Try clearing the type or status filter."
                    }
                  />
                </Card>
              </div>
            ) : (
              dsrs.rows.map((d) => (
                <DsrCard key={d.dsrId} d={d} />
              ))
            )}
          </div>

          <p className="text-[12.5px] text-muted-foreground">
            <CountUp
              value={dsrs.rows.length}
              format={(n) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              className="text-foreground/80"
            />{" "}
            shown · sorted by most recent request first.
          </p>
        </>
      )}
    </div>
  );
}

/** DSR card - a double-bezel mini card with the request lifecycle at a glance. */
function DsrCard({
  d,
}: {
  d: import("@/features/compliance/queries").DsrListItem;
}) {
  const due = computeDsrDueDate(
    d.requestType as Parameters<typeof computeDsrDueDate>[0],
    d.requestedAt,
  );
  const overdue =
    due != null &&
    new Date(due).getTime() < Date.now() &&
    d.status !== "fulfilled" &&
    d.status !== "rejected" &&
    d.status !== "cancelled";
  const dueSoon =
    due != null &&
    !overdue &&
    new Date(due).getTime() <= Date.now() + 7 * 86_400_000 &&
    d.status !== "fulfilled" &&
    d.status !== "rejected" &&
    d.status !== "cancelled";

  const sb = DSR_STATUS_BADGE[d.status] ?? { variant: "outline" };
  const principal = d.partyLegalName ?? d.contactFullName ?? "-";

  const settled =
    d.status === "fulfilled" ||
    d.status === "rejected" ||
    d.status === "cancelled";

  // SLA progress fraction: 0 at request → 1 at due date. >1 means overdue.
  // Clamped to [0, 1.25] for the bar fill width; settled requests render a
  // completed emerald bar regardless of timing.
  const slaFraction =
    due != null
      ? Math.min(
          1.25,
          Math.max(
            0,
            (Date.now() - new Date(d.requestedAt).getTime()) /
              (new Date(due).getTime() - new Date(d.requestedAt).getTime()),
          ),
        )
      : null;
  const fillPct = settled ? 100 : Math.round(Math.min(1, slaFraction ?? 0) * 100);

  const StatusIcon =
    d.status === "fulfilled"
      ? CheckCircle
      : d.status === "rejected" || d.status === "cancelled"
        ? XCircle
        : overdue
          ? Timer
          : Clock;

  const barTone = settled
    ? "bg-emerald"
    : overdue
      ? "bg-down"
      : dueSoon
        ? "bg-gold"
        : "bg-emerald";

  return (
    <Reveal y={14} duration={0.55}>
      <Card interactive className="h-full overflow-hidden">
        <div className="flex h-full flex-col gap-4 p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Eyebrow>{pretty(d.requestType)}</Eyebrow>
              <span className="text-[14px] font-medium text-foreground">
                {principal}
              </span>
            </div>
            <Badge variant={sb.variant} dot={sb.dot} icon={<StatusIcon weight="light" />}>
              {pretty(d.status)}
            </Badge>
          </div>

          {d.notes ? (
            <p className="line-clamp-2 text-[12.5px] text-muted-foreground">
              {d.notes}
            </p>
          ) : null}

          {/* SLA progress - a hairline track with an animated fill that
              communicates how close the statutory deadline is. The fill
              animates width on mount (transform-only via scale would clip the
              rounded end, so width is the honest choice here). */}
          {due != null ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Timer weight="light" className="size-3" />
                  SLA window
                </span>
                <span
                  className={cn(
                    "nums tabular-nums",
                    overdue
                      ? "text-down"
                      : dueSoon
                        ? "text-gold"
                        : "text-muted-foreground",
                  )}
                >
                  {settled ? "settled" : overdue ? "overdue" : `${fillPct}%`}
                </span>
              </div>
              <div
                className="relative h-1.5 overflow-hidden rounded-full bg-foreground/[0.06] ring-1 ring-inset ring-foreground/[0.05]"
                role="progressbar"
                aria-valuenow={fillPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="SLA progress"
              >
                <span
                  className={cn(
                    "block h-full rounded-full transition-[width] duration-700 ease-soft",
                    barTone,
                  )}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-auto grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-hairline/60">
            <CardMeta label="Requested" value={fmtDate(d.requestedAt)} />
            <CardMeta
              label="SLA due"
              value={fmtDate(due ?? null)}
              tone={overdue ? "down" : dueSoon ? "gold" : undefined}
              warn={overdue || dueSoon}
            />
            <CardMeta label="Completed" value={fmtDate(d.completedAt ?? null)} />
            <CardMeta
              label="Handled by"
              value={d.handledByEmail ?? "-"}
              icon={<UserCircle weight="light" className="size-3" />}
            />
          </div>

          {/* Workflow controls - advance the DSR along its allowed transitions. */}
          <TransitionDsrControls
            dsrId={d.dsrId}
            current={d.status as DsrStatus}
          />
        </div>
      </Card>
    </Reveal>
  );
}

function CardMeta({
  label,
  value,
  tone,
  warn,
  icon,
}: {
  label: string;
  value: string;
  tone?: "down" | "gold" | "emerald";
  warn?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 bg-surface px-3.5 py-3">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {warn ? (
          <Clock weight="light" className="size-3 text-gold" />
        ) : null}
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "nums tabular-nums text-[12.5px] font-medium text-foreground",
          tone === "down" && "text-down",
          tone === "gold" && "text-gold",
          tone === "emerald" && "text-up",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Retention-until cell - surfaces the retention clock with a semantic tone
 * when the horizon is near (<90d gold, past down). Active consents only; a
 * withdrawn consent's retention is governed by the purge job, not the clock. */
function RetentionCell({
  retentionUntil,
  active,
}: {
  retentionUntil: string | null;
  active: boolean;
}) {
  if (!retentionUntil) {
    return <span className="text-muted-foreground/60">-</span>;
  }
  const d = new Date(retentionUntil);
  const valid = Number.isFinite(d.getTime());
  if (!valid) {
    return <span className="text-muted-foreground/60">-</span>;
  }
  const now = Date.now();
  const days = Math.round((d.getTime() - now) / 86_400_000);
  const past = active && days < 0;
  const near = active && days >= 0 && days <= 90;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 nums tabular-nums",
        past ? "text-down" : near ? "text-gold" : "text-foreground/75",
      )}
    >
      {(past || near) && active ? (
        <Clock
          weight="light"
          className={cn("size-3.5", past ? "text-down" : "text-gold")}
        />
      ) : null}
      {fmtDate(retentionUntil)}
    </span>
  );
}

/** URL-driven pill tab segment. */
function TabPill({
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
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-medium transition-all duration-200 ease-soft sm:flex-none",
        active
          ? "bg-surface text-foreground shadow-soft ring-1 ring-hairline"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      <CaretRight
        weight="light"
        className={cn(
          "size-3.5 transition-transform duration-200 ease-soft",
          active ? "text-gold" : "text-muted-foreground/50",
        )}
      />
    </Link>
  );
}

/** Double-bezel-flavoured native select pill. */
function SelectPill({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 appearance-none rounded-full bg-foreground/[0.04] pl-3.5 pr-8 text-[12.5px] text-foreground",
          "ring-1 ring-hairline/60 transition-all duration-200 ease-soft",
          "focus:bg-foreground/[0.06] focus:ring-hairline focus:outline-none",
        )}
      >
        <option value="">{placeholder}</option>
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

/** Inline toggle pill (for the active-only switch). */
function TogglePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-medium transition-all duration-200 ease-soft",
        active
          ? "bg-gold/15 text-gold-deep ring-1 ring-gold/30"
          : "bg-foreground/[0.04] text-muted-foreground ring-1 ring-hairline/60 hover:text-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex size-3.5 items-center justify-center rounded-full ring-1 transition-colors duration-200 ease-soft",
          active
            ? "bg-gold ring-gold"
            : "ring-hairline/70",
        )}
      >
        {active ? (
          <CheckCircle weight="light" className="size-3 text-on-gold" />
        ) : null}
      </span>
      {label}
    </button>
  );
}