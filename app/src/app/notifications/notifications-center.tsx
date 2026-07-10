"use client";

// Notifications center - the interactive view for /notifications.
//
// Renders the four StatCards (unread / critical / warning / info), a floating
// glass CommandBar with severity + type filters + search + "Mark all read",
// and a staggered list of double-bezel notification cards. Read state is
// cookie-backed (queries.ts); mutations call the server actions in
// ./actions.ts (markAsRead / markAllAsRead), which revalidate /notifications
// so the page re-renders with fresh read flags. The active filter tab + search
// query persist across that re-render (React preserves client state when the
// server component re-passes props to the same client instance).
//
// Import discipline: server actions come from "@/features/workflow/actions"
// and types from "@/features/workflow/types" - NEVER from the feature barrel
// (which re-exports ./queries → postgres → breaks the "use client" bundle).

import * as React from "react";
import Link from "next/link";
import { useTransition } from "react";
import {
  Bell,
  XCircle,
  WarningCircle,
  Info,
  ArrowRight,
  CaretDown,
  Check,
  X,
  type IconProps,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  Card,
  Badge,
  Button,
  StatCard,
  EmptyState,
  CommandBar,
} from "@/components/brand";
import { Eyebrow } from "@/components/brand/text";
import { Stagger, StaggerItem } from "@/components/brand/reveal";
import {
  markAsRead,
  markAllAsRead,
  loadMoreNotifications,
} from "@/features/workflow/actions";
import {
  SEVERITY_ORDER,
  SEVERITY_LABELS,
  SEVERITY_BADGE_VARIANT,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_GROUP,
  type NotificationView,
  type NotificationStats,
  type Severity,
  type NotificationType,
} from "@/features/workflow/types";

type IconType = React.ForwardRefExoticComponent<
  IconProps & React.RefAttributes<SVGSVGElement>
>;

const SEVERITY_ICON: Record<Severity, IconType> = {
  critical: XCircle,
  warning: WarningCircle,
  info: Info,
};

/** Disc tint per severity - the machined well behind the glyph. */
const SEVERITY_DISC_CLASS: Record<Severity, string> = {
  critical: "bg-down/[0.08] ring-down/25 text-down",
  warning: "bg-gold/[0.08] ring-gold/25 text-gold",
  info: "bg-info/[0.08] ring-info/25 text-info",
};

/** StatCard value tone per severity (StatCard supports gold/down/default). */
const STAT_TONE: Record<"unread" | Severity, "default" | "gold" | "down"> = {
  unread: "default",
  critical: "down",
  warning: "gold",
  info: "default",
};

const TYPE_OPTIONS: { group: string; types: NotificationType[] }[] = [
  { group: "Compliance", types: ["kyc_expired", "kyc_expiring", "consent_withdrawn"] },
  { group: "Tasks", types: ["task_overdue", "task_due_soon"] },
  { group: "Deals", types: ["deal_stuck"] },
  { group: "Credit", types: ["credit_committee_pending"] },
];

type SeverityFilter = "all" | Severity;

/** The per-page window the server renders. Matches PAGE_LIMIT in page.tsx -
 *  the "Load more" action fetches the next window of this size. Kept here (not
 *  in page.tsx) so the center can compute the next offset from its loaded
 *  count. */
const PAGE_SIZE = 50;

export interface NotificationsCenterProps {
  items: NotificationView[];
  stats: NotificationStats;
  /** Full notification count (the engine's full sorted set length) - the
   *  "Showing X of Y" denominator + the "Load more" gate. The page passes
   *  `stats.total` here (stats are computed over the full set, items are the
   *  bounded window). */
  total?: number;
}

export function NotificationsCenter({
  items,
  stats,
  total,
}: NotificationsCenterProps) {
  const [query, setQuery] = React.useState("");
  const [severity, setSeverity] = React.useState<SeverityFilter>("all");
  const [type, setType] = React.useState<NotificationType | "all">("all");
  const [pending, startTransition] = useTransition();

  // "Load more" state. The server hands the first PAGE_SIZE items as `items`;
  // `extra` holds the windows appended by clicking "Load more". The effective
  // list is `items` + `extra`. When the server re-renders (e.g. after
  // markAsRead revalidates /notifications), `items` is a fresh first-window
  // with updated read flags - `extra` resets so the user never sees stale
  // read flags on items 51+ (they can re-load-more if they want them back).
  const [extra, setExtra] = React.useState<NotificationView[]>([]);
  const [loadingMore, startLoadMore] = useTransition();
  const itemsKey = items.map((n) => n.id).join("|");
  const prevItemsKeyRef = React.useRef(itemsKey);
  if (prevItemsKeyRef.current !== itemsKey) {
    prevItemsKeyRef.current = itemsKey;
    // Reset the appended windows whenever the server's first-window changes
    // (revalidation, navigation, filter server-roundtrip). Adjusting state
    // during render (the React docs pattern) keeps `extra` in sync without a
    // cascading-render effect lint.
    if (extra.length > 0) setExtra([]);
  }

  // The full loaded list (first window + appended windows). Dedup by id in
  // case a revalidation slides an item that was in `extra` into the first
  // window - the Set keeps the first occurrence (the `items` copy, which has
  // the freshest read flag).
  const loaded = React.useMemo(() => {
    const seen = new Set<string>();
    const out: NotificationView[] = [];
    for (const n of [...items, ...extra]) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      out.push(n);
    }
    return out;
  }, [items, extra]);

  const grandTotal = total ?? loaded.length;

  // Counts per severity for the filter pills (over the full set, pre-filter,
  // so the user always sees the true distribution).
  const counts = React.useMemo(() => {
    const c: Record<SeverityFilter, number> = {
      all: loaded.length,
      critical: 0,
      warning: 0,
      info: 0,
    };
    for (const n of loaded) c[n.severity]++;
    return c;
  }, [loaded]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return loaded.filter((n) => {
      if (severity !== "all" && n.severity !== severity) return false;
      if (type !== "all" && n.type !== type) return false;
      if (q) {
        const hay = `${n.title} ${n.description} ${n.entityLabel} ${NOTIFICATION_TYPE_LABELS[n.type]}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [loaded, query, severity, type]);

  const filteredUnread = filtered.filter((n) => !n.read);

  const handleMarkAll = React.useCallback(() => {
    if (filteredUnread.length === 0) return;
    const ids = filteredUnread.map((n) => n.entityId);
    startTransition(async () => {
      await markAllAsRead(ids);
    });
  }, [filteredUnread]);

  const handleDismiss = React.useCallback((entityId: string) => {
    startTransition(async () => {
      await markAsRead(entityId);
    });
  }, []);

  // "Load more" - fetch the next PAGE_SIZE window from the engine's sorted set
  // and append. No revalidation (the action is a pure read), so the user's
  // scroll position + filter state persist across the click. The button hides
  // once the loaded list reaches the grand total.
  const canLoadMore = loaded.length < grandTotal;
  const handleLoadMore = React.useCallback(() => {
    if (!canLoadMore || loadingMore) return;
    const offset = loaded.length;
    startLoadMore(async () => {
      const res = await loadMoreNotifications(offset, PAGE_SIZE);
      if (res.ok) {
        setExtra((prev) => {
          const seen = new Set(prev.map((n) => n.id));
          const merged = [...prev];
          for (const n of res.items) {
            if (!seen.has(n.id)) {
              seen.add(n.id);
              merged.push(n);
            }
          }
          return merged;
        });
      }
    });
  }, [canLoadMore, loadingMore, loaded.length]);

  const hasAny = loaded.length > 0;
  const hasMatch = filtered.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── StatCards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Unread"
          value={stats.unread}
          tone={STAT_TONE.unread}
          icon={<Bell weight="light" className="text-emerald" />}
        />
        <StatCard
          label="Critical"
          value={stats.critical}
          tone={STAT_TONE.critical}
          icon={<XCircle weight="light" className="text-down" />}
        />
        <StatCard
          label="Warning"
          value={stats.warning}
          tone={STAT_TONE.warning}
          icon={<WarningCircle weight="light" className="text-gold" />}
        />
        <StatCard
          label="Info"
          value={stats.info}
          tone={STAT_TONE.info}
          icon={<Info weight="light" className="text-info" />}
        />
      </div>

      {/* ── Command bar: search + severity + type + mark all ───────────── */}
      <CommandBar
        label="Inbox"
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search notifications…"
        filters={
          <>
            <SeverityPills
              value={severity}
              onChange={setSeverity}
              counts={counts}
            />
            <TypeSelect value={type} onChange={setType} />
          </>
        }
        actions={
          <Button
            variant="secondary-hairline"
            size="sm"
            onClick={handleMarkAll}
            disabled={pending || filteredUnread.length === 0}
            leadingIcon={
              pending ? (
                <Check weight="light" className="size-4 animate-pulse" />
              ) : (
                <Check weight="light" className="size-4" />
              )
            }
          >
            Mark all read
            {filteredUnread.length > 0 ? (
              <span
                className="nums tabular-nums text-muted-foreground"
                aria-label={`${filteredUnread.length} unread`}
              >
                {filteredUnread.length}
              </span>
            ) : null}
          </Button>
        }
      />

      {/* ── List ──────────────────────────────────────────────────────── */}
      {!hasAny ? (
        // No notifications at all - the calm, editorial empty state.
        <Card>
          <EmptyState
            icon={<Bell weight="light" />}
            title="The desk is clear."
            hint="No KYC, deal, credit, task or consent alerts right now. New triggers - a re-KYC coming due, a stalled mandate, an overdue task - will surface here the moment they fire."
            tone="emerald"
          />
        </Card>
      ) : !hasMatch ? (
        // Notifications exist but the filter excludes them all.
        <Card>
          <EmptyState
            icon={<FunnelGlyph />}
            title="Nothing matches this filter."
            hint="Try a different severity or type, or clear the search to see every alert."
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setSeverity("all");
                  setType("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <Stagger className="flex flex-col gap-3" amount={0.1}>
            <span className="sr-only" role="status" aria-live="polite">
              Showing {loaded.length} of {grandTotal} notifications
            </span>
            {filtered.map((n) => (
              <StaggerItem key={n.id}>
                <NotificationCard item={n} onDismiss={handleDismiss} />
              </StaggerItem>
            ))}
          </Stagger>
          {canLoadMore ? (
            <LoadMoreBar
              loadedCount={loaded.length}
              grandTotal={grandTotal}
              loading={loadingMore}
              onClick={handleLoadMore}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

/** The "Load more" footer - a quiet hairline pill that fetches the next
 *  PAGE_SIZE window from the engine. Mono "Showing X of Y" + the next increment
 *  so the user knows how many more are one click away. Disabled during the
 *  pending server-action round-trip. */
function LoadMoreBar({
  loadedCount,
  grandTotal,
  loading,
  onClick,
}: {
  loadedCount: number;
  grandTotal: number;
  loading: boolean;
  onClick: () => void;
}) {
  const next = Math.min(PAGE_SIZE, grandTotal - loadedCount);
  return (
    <div className="flex flex-col items-center gap-2 pt-1">
      <span className="text-[12.5px] text-muted-foreground">
        Showing{" "}
        <span className="nums tabular-nums text-foreground/80">
          {loadedCount.toLocaleString("en-IN")}
        </span>{" "}
        of{" "}
        <span className="nums tabular-nums text-foreground/80">
          {grandTotal.toLocaleString("en-IN")}
        </span>{" "}
        notifications
      </span>
      <Button
        variant="secondary-hairline"
        size="sm"
        onClick={onClick}
        disabled={loading}
        leadingIcon={
          <CaretDown
            weight="light"
            className={cn("size-4", loading && "animate-pulse")}
          />
        }
      >
        {loading ? "Loading…" : `Load more`}
        <span className="nums tabular-nums text-muted-foreground">
          +{next}
        </span>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NotificationCard - the double-bezel alert row
// ---------------------------------------------------------------------------

function NotificationCard({
  item,
  onDismiss,
}: {
  item: NotificationView;
  onDismiss: (entityId: string) => void;
}) {
  const Icon = SEVERITY_ICON[item.severity];
  const typeLabel = NOTIFICATION_TYPE_LABELS[item.type];
  const unread = !item.read;

  return (
    <Card
      // Unread cards read as brighter (no dimming) + carry a 2px emerald left
      // accent; read cards dim to 65% so the unread ones pop without a neon
      // treatment. The double-bezel shell stays constant - only the inner
      // content's opacity + accent shift.
      className={cn("transition-opacity duration-300 ease-soft", !unread && "opacity-65")}
    >
      <div className="relative flex items-stretch gap-3 p-4 md:gap-4 md:p-5">
        {/* Unread emerald left accent - the "new" cue, hairline-thin. */}
        {unread ? (
          <span
            aria-hidden
            className="absolute inset-y-3 left-0 w-[2px] rounded-full bg-emerald shadow-[0_0_8px] shadow-emerald/50"
          />
        ) : null}

        {/* Clickable content → navigates to the entity + marks read. */}
        <Link
          href={item.href}
          onClick={() => {
            if (unread) onDismiss(item.entityId);
          }}
          className="flex min-w-0 flex-1 items-start gap-3 md:gap-4"
        >
          <SeverityDisc severity={item.severity} Icon={Icon} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Eyebrow>{typeLabel}</Eyebrow>
              <span className="nums text-[11px] tracking-wider text-muted-foreground/70">
                · {item.relative}
              </span>
              {unread ? (
                <span
                  aria-label="Unread"
                  className="size-1.5 rounded-full bg-emerald shadow-[0_0_6px] shadow-emerald/60"
                />
              ) : null}
            </div>
            <h4 className="text-[14.5px] font-medium leading-snug tracking-[-0.005em] text-foreground">
              {item.title}
            </h4>
            <p className="text-[13px] leading-[1.5] text-muted-foreground">
              {item.description}
            </p>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-emerald transition-colors duration-200 ease-soft group-hover/card:gap-1.5">
              <span className="truncate">{item.entityLabel}</span>
              <ArrowRight weight="light" className="size-3.5 shrink-0" />
            </span>
          </div>
        </Link>

        {/* Right rail - severity badge + dismiss/read indicator. Sibling to
            the Link (not nested) so it's valid HTML + independently tappable. */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant={SEVERITY_BADGE_VARIANT[item.severity]}>
            {SEVERITY_LABELS[item.severity]}
          </Badge>
          {unread ? (
            <button
              type="button"
              onClick={() => onDismiss(item.entityId)}
              aria-label="Mark as read"
              title="Mark as read"
              className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 ease-soft hover:bg-foreground/10 hover:text-foreground"
            >
              <X weight="light" className="size-4" />
            </button>
          ) : (
            <span
              aria-label="Read"
              title="Read"
              className="inline-flex size-7 items-center justify-center text-muted-foreground/50"
            >
              <Check weight="light" className="size-4" />
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Severity icon in a hairline-ringed tinted disc - the machined well. */
function SeverityDisc({
  severity,
  Icon,
}: {
  severity: Severity;
  Icon: IconType;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-colors duration-300 ease-soft",
        SEVERITY_DISC_CLASS[severity],
        "[&_svg]:size-5 [&_svg]:shrink-0",
      )}
    >
      <Icon weight="light" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// SeverityPills - segmented All / Critical / Warning / Info with counts
// ---------------------------------------------------------------------------

function SeverityPills({
  value,
  onChange,
  counts,
}: {
  value: SeverityFilter;
  onChange: (v: SeverityFilter) => void;
  counts: Record<SeverityFilter, number>;
}) {
  const options: { key: SeverityFilter; label: string }[] = [
    { key: "all", label: "All" },
    ...SEVERITY_ORDER.map((s) => ({ key: s, label: SEVERITY_LABELS[s] })),
  ];
  return (
    <div
      role="group"
      aria-label="Filter by severity"
      className="inline-flex items-center rounded-full bg-foreground/[0.05] p-0.5 ring-1 ring-hairline/60"
    >
      {options.map((opt) => {
        const active = value === opt.key;
        const count = counts[opt.key] ?? 0;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] transition-all duration-200 ease-soft",
              active
                ? "bg-surface text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
            <span
              className={cn(
                "nums tabular-nums text-[10px]",
                active ? "text-muted-foreground" : "text-muted-foreground/60",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TypeSelect - native <select> grouped by domain, double-bezel styled
// ---------------------------------------------------------------------------

const selectClass = cn(
  "h-9 appearance-none rounded-full bg-foreground/[0.05] px-3 pr-8 text-[12.5px] font-medium text-foreground",
  "ring-1 ring-hairline/60 transition-all duration-200 ease-soft",
  "focus:bg-foreground/[0.08] focus:ring-hairline focus:outline-none",
);

function TypeSelect({
  value,
  onChange,
}: {
  value: NotificationType | "all";
  onChange: (v: NotificationType | "all") => void;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label="Filter by type"
        value={value}
        onChange={(e) => onChange(e.target.value as NotificationType | "all")}
        className={selectClass}
      >
        <option value="all">All types</option>
        {TYPE_OPTIONS.map((grp) => (
          <optgroup key={grp.group} label={grp.group}>
            {grp.types.map((t) => (
              <option key={t} value={t}>
                {NOTIFICATION_TYPE_LABELS[t]}
              </option>
            ))}
          </optgroup>
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

/** A tiny funnel glyph for the no-match empty state (kept inline so the empty
 *  state stays server-renderable if this view is ever lifted server-side). */
function FunnelGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5h18l-7 8v6l-4-2v-4z" />
    </svg>
  );
}