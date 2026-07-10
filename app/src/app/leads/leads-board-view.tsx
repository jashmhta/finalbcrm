"use client";

import * as React from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarBlank,
  CaretRight,
  ChartBar,
  CoinVertical,
  Funnel,
  Plus,
  SealCheck,
  Target,
  TrendUp,
  XCircle,
} from "@phosphor-icons/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import {
  Badge,
  Card,
  CommandBar,
  EmptyState,
  StatCard,
  compactINR,
  buttonVariants,
} from "@/components/brand";
import {
  CHART_GRID_PROPS,
  CHART_SERIES,
  CHART_XAXIS_PROPS,
  CHART_YAXIS_PROPS,
  ChartCard,
} from "@/components/brand/chart-theme";
import { Eyebrow } from "@/components/brand/text";
import {
  LeadDealTypeIcon,
  LeadSourceIcon,
  leadDealTypeTone,
} from "@/features/leads/lead-icons";
// CRITICAL: import runtime constants + types from `./types` (NOT the feature
// barrel). The barrel re-exports ./queries + ./actions, which import the
// `postgres` driver - pulling a server-only module into a "use client" bundle
// breaks the client build (Can't resolve 'tls'). `RmOption` + the analytics
// type are type-only imports from queries, which are erased at compile and do
// not pull the module graph. (Mirrors the credit-list-view pattern.)
import {
  BANT_CRITERIA,
  LEAD_DEAL_TYPE_LABELS,
  LEAD_DEAL_TYPE_SHORT,
  LEAD_SOURCE_LABELS,
  LEAD_STAGE_DEFAULT_PROBABILITY,
  LEAD_STAGE_HINTS,
  LEAD_STAGE_LABELS,
  LEAD_STAGE_ORDER,
  LEAD_STAGE_TONE,
  bantScore,
  isQualified,
  type LeadDealType,
  type LeadSource,
  type LeadStage,
} from "@/features/leads/types";
import type {
  LeadPipelineGroup,
  LeadRow,
  RmOption,
  ConversionAnalytics,
} from "@/features/leads/queries";

/* ------------------------------------------------------------------ *
 * LeadsBoardView - the Lead & Opportunity pipeline.
 *
 * A kanban by stage (New → Qualified → Opportunity → Won/Lost) above a
 * conversion-analytics dashboard. Filters by source / deal type / RM in a
 * CommandBar; selecting a card opens the detail page (/leads/[id]).
 *
 * CRITICAL: primary content renders VISIBLE on mount - no whileInView
 * opacity-0 gate on the dashboard / board / KPIs. Card + KPI stagger is
 * mount-based (initial → animate), not whileInView, so headless captures
 * render fully. Motion is transform/opacity only.
 * ------------------------------------------------------------------ */

export interface LeadsBoardViewProps {
  groups: LeadPipelineGroup[];
  analytics: ConversionAnalytics;
  rms: RmOption[];
}

const EASE = [0.32, 0.72, 0, 1] as const;

/* Mount-based motion (initial → animate, NOT whileInView). */
const sectionFade: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};
const cardStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};
const cardItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};
const columnFade: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/* ── helpers ──────────────────────────────────────────────────────────── */

/** ₹-Cr formatter for StatCard (value already in Cr). Converts to absolute
 *  rupees then through compactINR so it renders as "₹X.XX Cr" / "₹X.XX L". */
const inrCr = (n: number) => compactINR(n * 1e7);

/** ISO date → "15 Aug 2026"; null-safe. */
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Relative "in N days" / "N days ago" from an ISO date. */
function relativeClose(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  if (days === 0) return "today";
  if (days > 0) return `in ${days}d`;
  return `${Math.abs(days)}d ago`;
}

/** Stage tone → badge variant (matches the brand Badge variants). */
function stageBadgeVariant(
  stage: LeadStage,
): "neutral" | "info" | "gold" | "emerald" | "down" {
  return LEAD_STAGE_TONE[stage];
}

/** Initials from a name ("Rati Sharma" → "RS"). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/* ------------------------------------------------------------------ *
 * DealTypeDisc - the identity-disc well for a lead card's deal-type concept.
 *  Replicates the IconTile disc treatment (hairline ring + faint tint + tone
 *  text) but renders the LeadDealTypeIcon resolver, which may yield a bespoke
 *  brand MARK (bond coupon / G-Sec rupee) rather than a bare Phosphor glyph -
 *  so it can't be passed to IconTile's `icon` slot.
 * ------------------------------------------------------------------ */
const DISC_TONE_CLASS: Record<"neutral" | "emerald" | "gold" | "down", string> = {
  neutral: "ring-hairline bg-foreground/[0.03] text-muted-foreground",
  emerald: "ring-emerald/22 bg-emerald/[0.06] text-emerald/85",
  gold: "ring-gold/22 bg-gold/[0.06] text-gold/85",
  down: "ring-down/22 bg-down/[0.06] text-down/85",
};

function DealTypeDisc({
  dealType,
  tone,
}: {
  dealType: LeadDealType;
  tone: "neutral" | "emerald" | "gold" | "down";
}) {
  return (
    <span
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-[0.6rem] ring-1 [&_svg]:size-5",
        DISC_TONE_CLASS[tone],
      )}
    >
      <LeadDealTypeIcon dealType={dealType} />
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * RmAvatar - initials in a hairline disc (the RM identity cue on cards).
 * ------------------------------------------------------------------ */
function RmAvatar({
  name,
  size = "sm",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-mono font-medium tracking-tight text-muted-foreground ring-1 ring-hairline bg-foreground/[0.04]",
        size === "sm" ? "size-6 text-[10px]" : "size-8 text-[11px]",
      )}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * ProbabilityBar - a thin horizontal gauge (0–100), emerald by default,
 * gold when ≥ 50. scaleX draw-in on mount (transform only).
 * ------------------------------------------------------------------ */
function ProbabilityBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const tone = pct >= 50 ? "bg-gold" : pct >= 25 ? "bg-info" : "bg-foreground/40";
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
      <motion.div
        className={cn("h-full rounded-full", tone)}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: pct / 100 }}
        style={{ transformOrigin: "left" }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * BantDots - four dots, one per BANT criterion, filled when met. The
 * qualification progress cue on a card (0–4).
 * ------------------------------------------------------------------ */
function BantDots({ lead }: { lead: LeadRow["lead"] }) {
  return (
    <div className="flex items-center gap-1" title={`BANT ${bantScore(lead.bant)}/4`}>
      {BANT_CRITERIA.map((c) => {
        const met = lead.bant[c];
        return (
          <span
            key={c}
            className={cn(
              "size-1.5 rounded-full transition-colors",
              met ? "bg-emerald" : "bg-foreground/15",
            )}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * LeadCard - the kanban card. A double-bezel object linking to the detail
 * page. Identity disc = the deal-type concept; size in Geist Mono; source
 * badge; probability bar; RM avatar; BANT dots.
 * ------------------------------------------------------------------ */
function LeadCard({ lead, rmName }: { lead: LeadRow; rmName: string | null }) {
  const m = lead.lead;
  const sizeText = m.estSizeCr != null ? `₹${m.estSizeCr.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr` : "-";
  const close = relativeClose(m.expectedClose);
  const dealTone = leadDealTypeTone(m.dealType);
  const href = `/leads/${lead.partyId}`;

  return (
    <motion.div variants={cardItem}>
      <Link
        href={href}
        className={cn(
          "group/lead-card relative block rounded-2xl bg-surface ring-1 ring-hairline shadow-soft outline-none transition-all duration-300 ease-soft",
          "hover:shadow-lift hover:ring-hairline/70 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-gold/60",
        )}
      >
        {/* Gold left-accent - grows on hover (the single brand accent). */}
        <span
          aria-hidden
          className="absolute left-1 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-full bg-gold opacity-0 transition-all duration-200 ease-soft group-hover/lead-card:h-8 group-hover/lead-card:opacity-100"
        />
        <div className="relative p-4">
          {/* Row 1 - identity disc + company + stage arrow */}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">
              <DealTypeDisc dealType={m.dealType} tone={dealTone} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[13.5px] font-medium text-foreground">
                {lead.displayName || lead.legalName}
              </h3>
              <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                {LEAD_DEAL_TYPE_SHORT[m.dealType]}
              </p>
            </div>
            <ArrowUpRight
              weight="light"
              className="size-4 shrink-0 text-muted-foreground/60 transition-all duration-300 ease-soft group-hover/lead-card:translate-x-0.5 group-hover/lead-card:-translate-y-0.5 group-hover/lead-card:text-gold"
            />
          </div>

          {/* Row 2 - source badge + size */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <Badge variant="neutral" className="gap-1">
              <span className="text-muted-foreground/80 [&_svg]:size-3">
                <LeadSourceIcon source={m.source} />
              </span>
              {LEAD_SOURCE_LABELS[m.source]}
            </Badge>
            <span className="font-mono text-[12.5px] tabular-nums text-foreground/90">
              {sizeText}
            </span>
          </div>

          {/* Row 3 - probability */}
          <div className="mt-3.5 flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <ProbabilityBar value={m.probability} />
            </div>
            <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
              {m.probability}%
            </span>
          </div>

          {/* Row 4 - RM + BANT + close */}
          <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-hairline/60 pt-3">
            <div className="flex items-center gap-2">
              {rmName ? (
                <RmAvatar name={rmName} />
              ) : (
                <span className="inline-flex size-6 items-center justify-center rounded-full ring-1 ring-dashed ring-hairline text-[9px] text-muted-foreground/60">
                  -
                </span>
              )}
              <BantDots lead={m} />
            </div>
            {close ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10.5px] tabular-nums",
                  m.expectedClose && new Date(m.expectedClose) < new Date()
                    ? "text-down"
                    : "text-muted-foreground",
                )}
              >
                <CalendarBlank weight="light" className="size-3" />
                {close}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * AnalyticsDashboard - KPIs + conversion breakdowns.
 * ------------------------------------------------------------------ */
function AnalyticsDashboard({ analytics }: { analytics: ConversionAnalytics }) {
  return (
    <motion.div
      variants={sectionFade}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-4"
    >
      {/* KPI row */}
      <motion.div
        variants={cardStagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
      >
        <motion.div variants={cardItem}>
          <StatCard
            label="Open leads"
            value={analytics.open}
            preset="int"
            icon={<Funnel weight="light" />}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            label="Pipeline value"
            value={analytics.pipelineValueCr}
            format={inrCr}
            tone="gold"
            icon={<CoinVertical weight="light" />}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            label="Conversion rate"
            value={analytics.conversionRate}
            preset="percent1"
            tone={analytics.conversionRate >= 50 ? "up" : "default"}
            icon={<Target weight="light" />}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            label="Won value"
            value={analytics.wonValueCr}
            format={inrCr}
            tone="up"
            icon={<SealCheck weight="light" />}
          />
        </motion.div>
      </motion.div>

      {/* Chart + by-source */}
      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div variants={cardItem} className="lg:col-span-2">
          <ChartCard
            title="Conversions over time"
            description="Won vs lost mandates by month."
            bodyClassName="h-[220px] p-4 md:p-5"
          >
            {analytics.overTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.overTime}
                  margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
                  barCategoryGap="22%"
                >
                  <CartesianGrid {...CHART_GRID_PROPS} />
                  <XAxis {...CHART_XAXIS_PROPS} dataKey="month" />
                  <YAxis {...CHART_YAXIS_PROPS} allowDecimals={false} width={32} />
                  <Bar dataKey="won" name="Won" fill={CHART_SERIES.emerald} radius={[3, 3, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="lost" name="Lost" fill={CHART_SERIES.info} radius={[3, 3, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <EmptyState
                  align="center"
                  icon={<ChartBar weight="light" />}
                  title="No closed leads yet."
                  hint="Win or lose a lead to populate the conversion trend."
                />
              </div>
            )}
          </ChartCard>
        </motion.div>

        <motion.div variants={cardItem}>
          <BreakdownCard
            title="By source"
            rows={analytics.bySource.map((s) => ({
              key: s.source,
              label: LEAD_SOURCE_LABELS[s.source],
              total: s.total,
              won: s.won,
              rate: s.rate,
              valueCr: s.pipelineValueCr,
            }))}
          />
        </motion.div>
      </div>

      {/* By deal type + by RM */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div variants={cardItem}>
          <BreakdownCard
            title="By deal type"
            rows={analytics.byDealType.map((d) => ({
              key: d.dealType,
              label: LEAD_DEAL_TYPE_LABELS[d.dealType],
              total: d.total,
              won: d.won,
              rate: d.rate,
              valueCr: d.pipelineValueCr,
            }))}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <BreakdownCard
            title="By relationship manager"
            rows={analytics.byRm.map((r) => ({
              key: r.rmUserId ?? "__unassigned__",
              label: r.rmName,
              total: r.total,
              won: r.won,
              rate: r.rate,
              valueCr: r.pipelineValueCr,
            }))}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * BreakdownCard - a list of rows with a proportional bar + rate pill.
 *  (source / deal type / RM share this shape.)
 * ------------------------------------------------------------------ */
interface BreakdownRow {
  key: string;
  label: string;
  total: number;
  won: number;
  rate: number;
  valueCr: number;
}

function BreakdownCard({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  return (
    <Card className="h-full">
      <div className="flex items-center justify-between px-5 pt-5 md:px-6 md:pt-6">
        <Eyebrow>{title}</Eyebrow>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {rows.length} {rows.length === 1 ? "bucket" : "buckets"}
        </span>
      </div>
      <div className="flex flex-col gap-3.5 p-5 md:p-6">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            No leads in this view yet.
          </p>
        ) : (
          rows.map((r) => (
            <div key={r.key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] text-foreground/90">
                  {r.label}
                </span>
                <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                  <span>{r.total}</span>
                  <span className="text-foreground/30">·</span>
                  <span className={r.rate >= 50 ? "text-gold" : r.rate > 0 ? "text-foreground/70" : ""}>
                    {typeof r.rate === "number" && Number.isFinite(r.rate)
                      ? `${r.rate.toFixed(0)}%`
                      : "-"}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                <div
                  className="h-full rounded-full bg-gold/70"
                  style={{ width: `${(r.total / maxTotal) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * FilterSelect - a compact native <select> styled to match the command bar.
 *  Native selects keep the markup accessible + mobile-friendly (44px tap).
 * ------------------------------------------------------------------ */
function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="relative inline-flex h-9 items-center">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 appearance-none rounded-full bg-foreground/[0.04] pl-3.5 pr-8 text-[12.5px] text-foreground",
          "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
          "focus:bg-foreground/[0.06] focus:ring-hairline focus:outline-none",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 text-muted-foreground [&_svg]:size-3">
        <CaretRight weight="light" className="rotate-90" />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * KanbanColumn - one funnel stage.
 * ------------------------------------------------------------------ */
// Per-column initial cap + Load-more increment. Mirrors the deals board: the
// server streams the full stage, but the first paint only renders
// LEAD_VISIBLE_INCREMENT cards per column so a fat stage (193 in "new")
// doesn't ship a multi-MB SSR payload. "Load more" reveals the next increment.
const LEAD_VISIBLE_INCREMENT = 20;

function KanbanColumn({
  stage,
  leads,
  rmsById,
  visibleCount,
  onLoadMore,
}: {
  stage: LeadStage;
  leads: LeadRow[];
  rmsById: Map<string, string>;
  visibleCount: number;
  onLoadMore: () => void;
}) {
  const tone = stageBadgeVariant(stage);
  // Bounds the RENDERED cards at `visibleCount` so the first paint is light.
  const visibleLeads = leads.slice(0, visibleCount);
  const hiddenCount = leads.length - visibleLeads.length;
  return (
    <motion.div
      variants={columnFade}
      initial="hidden"
      animate="show"
      className="flex w-[85vw] shrink-0 snap-start flex-col gap-3 sm:w-[320px] md:w-[300px]"
    >
      {/* Column header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Badge variant={tone} dot={tone === "emerald"}>
            {LEAD_STAGE_LABELS[stage]}
          </Badge>
          <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
            {leads.length}
          </span>
        </div>
        <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground/70">
          {LEAD_STAGE_DEFAULT_PROBABILITY[stage]}%
        </span>
      </div>
      <p className="px-1 text-[11px] text-muted-foreground/70">
        {LEAD_STAGE_HINTS[stage]}
      </p>

      {/* Cards */}
      <motion.div
        variants={cardStagger}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-2.5"
      >
        {leads.length === 0 ? (
          <div className="rounded-2xl bg-foreground/[0.02] p-4 ring-1 ring-dashed ring-hairline/50">
            <p className="text-center text-[11.5px] text-muted-foreground/60">
              No leads
            </p>
          </div>
        ) : (
          visibleLeads.map((lead) => (
            <LeadCard
              key={lead.partyId}
              lead={lead}
              rmName={
                lead.lead.assignedRm
                  ? (rmsById.get(lead.lead.assignedRm) ??
                    lead.assignedRmName ??
                    lead.assignedRmEmail ??
                    "Relationship Manager")
                  : null
              }
            />
          ))
        )}
      </motion.div>

      {/* Per-column Load more - a quiet hairline pill at the column foot. */}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={onLoadMore}
          className="group/loadmore mt-1 inline-flex items-center justify-center gap-1.5 self-start rounded-full py-2 text-[11.5px] font-medium text-muted-foreground ring-1 ring-hairline/60 transition-all duration-200 ease-soft hover:bg-foreground/[0.04] hover:text-foreground hover:ring-hairline"
        >
          <CaretRight
            weight="light"
            className="size-3 rotate-90 text-muted-foreground/60 transition-transform duration-200 ease-soft group-hover/loadmore:translate-y-0.5 group-hover/loadmore:text-gold"
          />
          Load more
          <span className="nums tabular-nums text-muted-foreground/70">
            +{Math.min(hiddenCount, LEAD_VISIBLE_INCREMENT)}
          </span>
        </button>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * LeadsBoardView
 * ------------------------------------------------------------------ */
export function LeadsBoardView({ groups, analytics, rms }: LeadsBoardViewProps) {
  const [search, setSearch] = React.useState("");
  const [sourceFilter, setSourceFilter] = React.useState<string>("all");
  const [dealTypeFilter, setDealTypeFilter] = React.useState<string>("all");
  const [rmFilter, setRmFilter] = React.useState<string>("all");

  // Per-column "Load more" state, keyed by stage. Missing keys default to
  // LEAD_VISIBLE_INCREMENT. Preserved across filter changes (a stage that's
  // still present keeps its count); resets implicitly when the board remounts.
  const [visiblePerColumn, setVisiblePerColumn] = React.useState<
    Record<string, number>
  >({});
  const visibleFor = React.useCallback(
    (stage: string) => visiblePerColumn[stage] ?? LEAD_VISIBLE_INCREMENT,
    [visiblePerColumn],
  );
  const handleLoadMore = React.useCallback((stage: string, ceiling: number) => {
    setVisiblePerColumn((prev) => {
      const cur = prev[stage] ?? LEAD_VISIBLE_INCREMENT;
      const next = Math.min(cur + LEAD_VISIBLE_INCREMENT, ceiling);
      if (next === cur) return prev;
      return { ...prev, [stage]: next };
    });
  }, []);

  const rmsById = React.useMemo(
    () => new Map(rms.map((r) => [r.userId, r.name])),
    [rms],
  );

  // Flatten + filter, then re-group by stage.
  const allLeads = React.useMemo(
    () => groups.flatMap((g) => g.leads),
    [groups],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return allLeads.filter((l) => {
      if (sourceFilter !== "all" && l.lead.source !== sourceFilter) return false;
      if (dealTypeFilter !== "all" && l.lead.dealType !== dealTypeFilter) return false;
      if (rmFilter !== "all") {
        if (rmFilter === "__unassigned__") {
          if (l.lead.assignedRm) return false;
        } else if (l.lead.assignedRm !== rmFilter) return false;
      }
      if (q) {
        const hay = `${l.legalName} ${l.displayName ?? ""} ${l.lead.contactName ?? ""} ${l.lead.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allLeads, search, sourceFilter, dealTypeFilter, rmFilter]);

  const grouped = React.useMemo(() => {
    const map = new Map<LeadStage, LeadRow[]>();
    for (const s of LEAD_STAGE_ORDER) map.set(s, []);
    for (const l of filtered) {
      const arr = map.get(l.lead.stage) ?? [];
      arr.push(l);
      map.set(l.lead.stage, arr);
    }
    return LEAD_STAGE_ORDER.map((s) => ({ stage: s, leads: map.get(s) ?? [] }));
  }, [filtered]);

  const hasAny = allLeads.length > 0;
  const hasFilters = search || sourceFilter !== "all" || dealTypeFilter !== "all" || rmFilter !== "all";

  return (
    <div className="flex flex-col gap-8">
      <AnalyticsDashboard analytics={analytics} />

      {/* Command bar */}
      <CommandBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search leads by company, contact, notes…"
        label="Pipeline"
        filters={
          <>
            <FilterSelect
              label="Source"
              value={sourceFilter}
              onChange={setSourceFilter}
              options={[
                { value: "all", label: "All sources" },
                ...(["referral", "website", "event", "cold_call", "existing_client"] as LeadSource[]).map((s) => ({
                  value: s,
                  label: LEAD_SOURCE_LABELS[s],
                })),
              ]}
            />
            <FilterSelect
              label="Deal type"
              value={dealTypeFilter}
              onChange={setDealTypeFilter}
              options={[
                { value: "all", label: "All deal types" },
                ...(["bond_underwriting", "high_yield_bond", "private_placement_debt", "gsec_auction", "structured_finance", "supply_chain_finance", "project_finance", "dcm_advisory", "rating_advisory", "m_and_a", "portfolio_management_mandate", "secondary_trading_advisory"] as LeadDealType[]).map((d) => ({
                  value: d,
                  label: LEAD_DEAL_TYPE_LABELS[d],
                })),
              ]}
            />
            <FilterSelect
              label="Relationship Manager"
              value={rmFilter}
              onChange={setRmFilter}
              options={[
                { value: "all", label: "All Relationship Managers" },
                { value: "__unassigned__", label: "Unassigned" },
                ...rms.map((r) => ({ value: r.userId, label: r.name })),
              ]}
            />
          </>
        }
        actions={
          <Link
            href="/leads/new"
            className={buttonVariants({ variant: "primary-gold", size: "md", hasTrailing: true })}
          >
            <Plus weight="light" className="size-4" />
            New lead
            <span className="ml-0.5 inline-flex size-6 items-center justify-center rounded-full bg-black/10 text-on-gold transition-transform duration-300 ease-soft group-hover/button:translate-x-0.5 dark:bg-white/15">
              <ArrowRight weight="light" className="size-3.5" />
            </span>
          </Link>
        }
      />

      {/* Board */}
      {!hasAny ? (
        <EmptyState
          icon={<Funnel weight="light" />}
          title="The pipeline is empty."
          hint="Capture your first lead to start qualifying opportunities toward a mandate."
          action={
            <Link href="/leads/new" className={buttonVariants({ variant: "primary-gold", size: "md", hasTrailing: true })}>
              <Plus weight="light" className="size-4" />
              New lead
              <span className="ml-0.5 inline-flex size-6 items-center justify-center rounded-full bg-black/10 text-on-gold dark:bg-white/15">
                <ArrowRight weight="light" className="size-3.5" />
              </span>
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<TrendUp weight="light" />}
          title="No leads match these filters."
          hint="Clear the search or filters to see the full pipeline."
        />
      ) : (
        <div className="flex w-full snap-x snap-proximity gap-4 overflow-x-auto pb-2 scroll-px-1">
          {grouped.map((col) => (
            <KanbanColumn
              key={col.stage}
              stage={col.stage}
              leads={col.leads}
              rmsById={rmsById}
              visibleCount={visibleFor(col.stage)}
              onLoadMore={() => handleLoadMore(col.stage, col.leads.length)}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      {hasAny && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[11px] text-muted-foreground/80">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald" /> BANT met
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarBlank weight="light" className="size-3" /> expected close
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CoinVertical weight="light" className="size-3" /> ₹ Cr estimated size
          </span>
          {hasFilters && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
              <XCircle weight="light" className="size-3" />
              {filtered.length} of {allLeads.length} leads
            </span>
          )}
        </div>
      )}
    </div>
  );
}