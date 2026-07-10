"use client";

import * as React from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Buildings,
  CaretRight,
  CheckCircle,
  Clock,
  Funnel,
  Plus,
  SealCheck,
  ShieldCheck,
  ShieldWarning,
  Target,
  TrendUp,
  XCircle,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  Badge,
  Card,
  CommandBar,
  EmptyState,
  StatCard,
  buttonVariants,
} from "@/components/brand";
import { Eyebrow } from "@/components/brand/text";
import {
  OnboardingStageIcon,
  onboardingStageTone,
} from "@/features/onboarding/onboarding-icons";
import {
  ONBOARDING_CLIENT_TYPE_LABELS,
  ONBOARDING_CLIENT_TYPE_ORDER,
  ONBOARDING_STAGE_HINTS,
  ONBOARDING_STAGE_LABELS,
  ONBOARDING_STAGE_ORDER,
  ONBOARDING_STAGE_SLA_LABEL,
  ONBOARDING_STAGE_TONE,
  allDocsVerified,
  docsUploaded,
  docsVerified,
  type OnboardingSlaState,
  type OnboardingStage,
} from "@/features/onboarding/types";
import type {
  OnboardingAnalytics,
  OnboardingPipelineGroup,
  OnboardingRow,
  RmOption,
} from "@/features/onboarding/queries";

/* ------------------------------------------------------------------ *
 * OnboardingBoardView - the Client Onboarding pipeline.
 *
 * A kanban by stage (Initiated → Profile → Documents → KYC → Compliance →
 * Active) above an onboarding-analytics dashboard. Filters by client type /
 * SLA status / RM in a CommandBar; selecting a card opens the detail page
 * (/onboarding/[id]).
 *
 * CRITICAL: primary content renders VISIBLE on mount - no whileInView
 * opacity-0 gate on the dashboard / board / KPIs. Card + KPI stagger is
 * mount-based (initial → animate), not whileInView, so headless captures
 * render fully. Motion is transform/opacity only.
 * ------------------------------------------------------------------ */

export interface OnboardingBoardViewProps {
  groups: OnboardingPipelineGroup[];
  analytics: OnboardingAnalytics;
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

/** Stage tone → badge variant. */
function stageBadgeVariant(
  stage: OnboardingStage,
): "neutral" | "info" | "gold" | "emerald" {
  return ONBOARDING_STAGE_TONE[stage];
}

/** SLA status → badge variant + label. */
function slaMeta(
  sla: OnboardingSlaState,
): { variant: "emerald" | "gold" | "down" | "outline"; label: string } {
  switch (sla.status) {
    case "overdue":
      return {
        variant: "down",
        label: `${Math.abs(sla.daysRemaining)}d overdue`,
      };
    case "due_soon":
      return {
        variant: "gold",
        label: sla.daysRemaining === 0 ? "due today" : `${sla.daysRemaining}d left`,
      };
    case "on_track":
      return { variant: "emerald", label: `${sla.daysRemaining}d left` };
    case "none":
      return { variant: "outline", label: "Active" };
  }
}

/** KYC status → badge variant + label. */
function kycMeta(
  kyc: OnboardingRow["kyc"],
): { variant: "outline" | "info" | "gold" | "emerald" | "down"; label: string } | null {
  if (!kyc) return null;
  switch (kyc.status) {
    case "approved":
      return { variant: "emerald", label: "KYC approved" };
    case "in_review":
      return { variant: "info", label: "KYC in review" };
    case "under_eds_check":
      return { variant: "gold", label: "KYC EDD" };
    case "rejected":
      return { variant: "down", label: "KYC rejected" };
    case "pending":
      return { variant: "outline", label: "KYC pending" };
    default:
      return { variant: "outline", label: `KYC ${kyc.status ?? "-"}` };
  }
}

/** Initials from a name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/* ------------------------------------------------------------------ *
 * RmAvatar - initials in a hairline disc.
 * ------------------------------------------------------------------ */
function RmAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
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
 * DocProgressBar - verified / total with an emerald fill (gold when
 * partially verified, down when any rejected). scaleX draw-in on mount.
 * ------------------------------------------------------------------ */
function DocProgressBar({ row }: { row: OnboardingRow }) {
  const docs = row.onboarding.documents;
  const verified = docsVerified(docs);
  const uploaded = docsUploaded(docs);
  const total = docs.length;
  const rejected = docs.filter((d) => d.verification === "rejected").length;
  const pct = total > 0 ? (verified / total) * 100 : 0;
  const tone =
    rejected > 0
      ? "bg-down"
      : verified === total && total > 0
        ? "bg-emerald"
        : verified > 0
          ? "bg-gold"
          : "bg-foreground/40";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
        <motion.div
          className={cn("h-full rounded-full", tone)}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: pct / 100 }}
          style={{ transformOrigin: "left" }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
        />
      </div>
      <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
        {verified}/{total}
      </span>
      <span className="sr-only">{uploaded} uploaded</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * StageDisc - the identity-disc well for an onboarding card's stage
 *  concept. Replicates the IconTile disc treatment (hairline ring + faint
 *  tint + tone text) but renders the OnboardingStageIcon resolver, which is
 *  a wrapper component rather than a bare Phosphor glyph - so it can't be
 *  passed to IconTile's `icon` slot.
 * ------------------------------------------------------------------ */
const DISC_TONE_CLASS: Record<"neutral" | "emerald" | "gold" | "down", string> = {
  neutral: "ring-hairline bg-foreground/[0.03] text-muted-foreground",
  emerald: "ring-emerald/22 bg-emerald/[0.06] text-emerald/85",
  gold: "ring-gold/22 bg-gold/[0.06] text-gold/85",
  down: "ring-down/22 bg-down/[0.06] text-down/85",
};

function StageDisc({ stage, size = "md" }: { stage: OnboardingStage; size?: "md" | "lg" }) {
  const tone = onboardingStageTone(stage);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[0.6rem] ring-1 [&_svg]:shrink-0",
        size === "lg" ? "size-11 rounded-full [&_svg]:size-6" : "size-9 [&_svg]:size-5",
        DISC_TONE_CLASS[tone],
      )}
    >
      <OnboardingStageIcon stage={stage} />
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * OnboardingCard - the kanban card.
 * ------------------------------------------------------------------ */
function OnboardingCard({
  row,
  rmName,
}: {
  row: OnboardingRow;
  rmName: string | null;
}) {
  const m = row.onboarding;
  const sla = slaMeta(row.sla);
  const kyc = kycMeta(row.kyc);
  const rejectedCompliance = !!m.complianceRejectedAt;
  const href = `/onboarding/${row.partyId}`;

  return (
    <motion.div variants={cardItem}>
      <Link
        href={href}
        className={cn(
          "group/onb-card relative block overflow-hidden rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline shadow-shell transition-all duration-300 ease-soft",
          "hover:ring-hairline/70 hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/60",
        )}
      >
        <div className="relative overflow-hidden rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface p-4 ring-1 ring-inset ring-foreground/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          {/* Row 1 - identity disc + company + stage arrow */}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">
              <StageDisc stage={m.stage} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[13.5px] font-medium text-foreground">
                {row.displayName || row.legalName}
              </h3>
              <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                {ONBOARDING_CLIENT_TYPE_LABELS[m.clientType]}
              </p>
            </div>
            <ArrowUpRight
              weight="light"
              className="size-4 shrink-0 text-muted-foreground/60 transition-all duration-300 ease-soft group-hover/onb-card:translate-x-0.5 group-hover/onb-card:-translate-y-0.5 group-hover/onb-card:text-emerald"
            />
          </div>

          {/* Row 2 - SLA badge + KYC badge */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge variant={sla.variant} icon={<Clock weight="light" />}>
              {sla.label}
            </Badge>
            {kyc ? (
              <Badge variant={kyc.variant} icon={<ShieldCheck weight="light" />}>
                {kyc.label}
              </Badge>
            ) : m.stage !== "active" ? (
              <Badge variant="outline" icon={<ShieldWarning weight="light" />}>
                No KYC
              </Badge>
            ) : null}
            {rejectedCompliance ? (
              <Badge variant="down" icon={<XCircle weight="light" />}>
                Compliance rejected
              </Badge>
            ) : null}
          </div>

          {/* Row 3 - document progress */}
          <div className="mt-3.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground/80">
                <CheckCircle weight="light" className="size-3" />
                Documents
              </span>
              {allDocsVerified(m.documents) && m.documents.length > 0 ? (
                <span className="text-[10px] font-medium text-emerald">all verified</span>
              ) : null}
            </div>
            <DocProgressBar row={row} />
          </div>

          {/* Row 4 - RM + city */}
          <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-hairline/60 pt-3">
            <div className="flex items-center gap-2">
              {rmName ? (
                <RmAvatar name={rmName} />
              ) : (
                <span className="inline-flex size-6 items-center justify-center rounded-full ring-1 ring-dashed ring-hairline text-[9px] text-muted-foreground/60">
                  -
                </span>
              )}
              {m.city ? (
                <span className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
                  <Buildings weight="light" className="size-3" />
                  {m.city}
                </span>
              ) : null}
            </div>
            {m.pan ? (
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                {m.pan}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * AnalyticsDashboard - KPIs + breakdowns.
 * ------------------------------------------------------------------ */
function AnalyticsDashboard({ analytics }: { analytics: OnboardingAnalytics }) {
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
            label="Open cases"
            value={analytics.open}
            preset="int"
            icon={<Funnel weight="light" />}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            label="Overdue SLA"
            value={analytics.overdue}
            tone={analytics.overdue > 0 ? "down" : "default"}
            icon={<Clock weight="light" />}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            label="Awaiting compliance"
            value={analytics.awaitingCompliance}
            icon={<SealCheck weight="light" />}
            tone={analytics.awaitingCompliance > 0 ? "gold" : "default"}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            label="Activated clients"
            value={analytics.active}
            tone="up"
            icon={<CheckCircle weight="light" />}
          />
        </motion.div>
      </motion.div>

      {/* By-stage + by-client-type */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div variants={cardItem}>
          <BreakdownCard
            title="By stage"
            icon={<TrendUp weight="light" />}
            rows={analytics.byStage.map((s) => ({
              key: s.stage,
              label: ONBOARDING_STAGE_LABELS[s.stage],
              total: s.count,
              overdue: s.overdue,
              hint: ONBOARDING_STAGE_SLA_LABEL[s.stage],
            }))}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <BreakdownCard
            title="By client type"
            icon={<Buildings weight="light" />}
            rows={analytics.byClientType.map((c) => ({
              key: c.clientType,
              label: ONBOARDING_CLIENT_TYPE_LABELS[c.clientType],
              total: c.total,
              active: c.active,
              open: c.open,
            }))}
          />
        </motion.div>
      </div>

      {/* By RM */}
      <motion.div variants={cardItem}>
        <BreakdownCard
          title="By relationship manager"
          icon={<Target weight="light" />}
          rows={analytics.byRm.map((r) => ({
            key: r.rmUserId ?? "__unassigned__",
            label: r.rmName,
            total: r.total,
            active: r.active,
            open: r.open,
            overdue: r.overdue,
          }))}
        />
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * BreakdownCard - a list of rows with a proportional bar + counts.
 * ------------------------------------------------------------------ */
interface BreakdownRow {
  key: string;
  label: string;
  total: number;
  active?: number;
  open?: number;
  overdue?: number;
  hint?: string;
}

function BreakdownCard({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: BreakdownRow[];
}) {
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  return (
    <Card className="h-full">
      <div className="flex items-center justify-between px-5 pt-5 md:px-6 md:pt-6">
        <Eyebrow>
          <span className="mr-1 text-muted-foreground/70 [&_svg]:size-3.5">{icon}</span>
          {title}
        </Eyebrow>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {rows.length} {rows.length === 1 ? "bucket" : "buckets"}
        </span>
      </div>
      <div className="flex flex-col gap-3.5 p-5 md:p-6">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            No onboarding cases in this view yet.
          </p>
        ) : (
          rows.map((r) => (
            <div key={r.key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] text-foreground/90">{r.label}</span>
                <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                  <span>{r.total}</span>
                  {typeof r.active === "number" && r.active > 0 ? (
                    <span className="text-emerald">{r.active} active</span>
                  ) : null}
                  {typeof r.overdue === "number" && r.overdue > 0 ? (
                    <span className="text-down">{r.overdue} overdue</span>
                  ) : null}
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                <div
                  className="h-full rounded-full bg-emerald/70"
                  style={{ width: `${(r.total / maxTotal) * 100}%` }}
                />
              </div>
              {r.hint ? (
                <span className="text-[10.5px] text-muted-foreground/70">{r.hint}</span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * FilterSelect - a compact native <select> styled to match the command bar.
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
// Per-column initial cap + Load-more increment. Mirrors the deals + leads
// boards: the server streams the full stage, but the first paint only renders
// ONBOARDING_VISIBLE_INCREMENT cards per column so a fat stage (90 in
// "documents_collected") doesn't ship a multi-MB SSR payload.
const ONBOARDING_VISIBLE_INCREMENT = 20;

function KanbanColumn({
  stage,
  cases,
  rmsById,
  visibleCount,
  onLoadMore,
}: {
  stage: OnboardingStage;
  cases: OnboardingRow[];
  rmsById: Map<string, string>;
  visibleCount: number;
  onLoadMore: () => void;
}) {
  const tone = stageBadgeVariant(stage);
  // Bounds the RENDERED cards at `visibleCount` so the first paint is light.
  const visibleCases = cases.slice(0, visibleCount);
  const hiddenCount = cases.length - visibleCases.length;
  return (
    <motion.div
      variants={columnFade}
      initial="hidden"
      animate="show"
      className="flex w-full shrink-0 flex-col gap-3 md:w-[300px]"
    >
      {/* Column header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Badge variant={tone} dot={tone === "emerald"}>
            {ONBOARDING_STAGE_LABELS[stage]}
          </Badge>
          <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
            {cases.length}
          </span>
        </div>
        <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground/70">
          {ONBOARDING_STAGE_SLA_LABEL[stage]}
        </span>
      </div>
      <p className="px-1 text-[11px] text-muted-foreground/70">
        {ONBOARDING_STAGE_HINTS[stage]}
      </p>

      {/* Cards */}
      <motion.div
        variants={cardStagger}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-2.5"
      >
        {cases.length === 0 ? (
          <div className="rounded-2xl bg-foreground/[0.02] p-4 ring-1 ring-dashed ring-hairline/50">
            <p className="text-center text-[11.5px] text-muted-foreground/60">No cases</p>
          </div>
        ) : (
          visibleCases.map((row) => (
            <OnboardingCard
              key={row.partyId}
              row={row}
              rmName={
                row.onboarding.assignedRm
                  ? (rmsById.get(row.onboarding.assignedRm) ??
                    row.assignedRmName ??
                    row.assignedRmEmail ??
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
            className="size-3 rotate-90 text-muted-foreground/60 transition-transform duration-200 ease-soft group-hover/loadmore:translate-y-0.5 group-hover/loadmore:text-emerald"
          />
          Load more
          <span className="nums tabular-nums text-muted-foreground/70">
            +{Math.min(hiddenCount, ONBOARDING_VISIBLE_INCREMENT)}
          </span>
        </button>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * OnboardingBoardView
 * ------------------------------------------------------------------ */
export function OnboardingBoardView({
  groups,
  analytics,
  rms,
}: OnboardingBoardViewProps) {
  const [search, setSearch] = React.useState("");
  const [clientTypeFilter, setClientTypeFilter] = React.useState<string>("all");
  const [slaFilter, setSlaFilter] = React.useState<string>("all");
  const [rmFilter, setRmFilter] = React.useState<string>("all");

  // Per-column "Load more" state, keyed by stage. Missing keys default to
  // ONBOARDING_VISIBLE_INCREMENT.
  const [visiblePerColumn, setVisiblePerColumn] = React.useState<
    Record<string, number>
  >({});
  const visibleFor = React.useCallback(
    (stage: string) => visiblePerColumn[stage] ?? ONBOARDING_VISIBLE_INCREMENT,
    [visiblePerColumn],
  );
  const handleLoadMore = React.useCallback((stage: string, ceiling: number) => {
    setVisiblePerColumn((prev) => {
      const cur = prev[stage] ?? ONBOARDING_VISIBLE_INCREMENT;
      const next = Math.min(cur + ONBOARDING_VISIBLE_INCREMENT, ceiling);
      if (next === cur) return prev;
      return { ...prev, [stage]: next };
    });
  }, []);

  const rmsById = React.useMemo(
    () => new Map(rms.map((r) => [r.userId, r.name])),
    [rms],
  );

  // Flatten + filter, then re-group by stage.
  const allCases = React.useMemo(
    () => groups.flatMap((g) => g.cases),
    [groups],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return allCases.filter((c) => {
      if (clientTypeFilter !== "all" && c.onboarding.clientType !== clientTypeFilter)
        return false;
      if (slaFilter !== "all") {
        if (slaFilter === "overdue" && c.sla.status !== "overdue") return false;
        if (slaFilter === "due_soon" && c.sla.status !== "due_soon") return false;
        if (slaFilter === "on_track" && c.sla.status !== "on_track") return false;
      }
      if (rmFilter !== "all") {
        if (rmFilter === "__unassigned__") {
          if (c.onboarding.assignedRm) return false;
        } else if (c.onboarding.assignedRm !== rmFilter) return false;
      }
      if (q) {
        const hay =
          `${c.legalName} ${c.displayName ?? ""} ${c.onboarding.contactName ?? ""} ${c.onboarding.city ?? ""} ${c.onboarding.pan ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allCases, search, clientTypeFilter, slaFilter, rmFilter]);

  const grouped = React.useMemo(() => {
    const map = new Map<OnboardingStage, OnboardingRow[]>();
    for (const s of ONBOARDING_STAGE_ORDER) map.set(s, []);
    for (const c of filtered) {
      const arr = map.get(c.onboarding.stage) ?? [];
      arr.push(c);
      map.set(c.onboarding.stage, arr);
    }
    return ONBOARDING_STAGE_ORDER.map((s) => ({ stage: s, cases: map.get(s) ?? [] }));
  }, [filtered]);

  const hasAny = allCases.length > 0;
  const hasFilters =
    search ||
    clientTypeFilter !== "all" ||
    slaFilter !== "all" ||
    rmFilter !== "all";

  return (
    <div className="flex flex-col gap-8">
      <AnalyticsDashboard analytics={analytics} />

      {/* Command bar */}
      <CommandBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by company, contact, city, PAN…"
        label="Pipeline"
        filters={
          <>
            <FilterSelect
              label="Client type"
              value={clientTypeFilter}
              onChange={setClientTypeFilter}
              options={[
                { value: "all", label: "All client types" },
                ...ONBOARDING_CLIENT_TYPE_ORDER.map((t) => ({
                  value: t,
                  label: ONBOARDING_CLIENT_TYPE_LABELS[t],
                })),
              ]}
            />
            <FilterSelect
              label="SLA status"
              value={slaFilter}
              onChange={setSlaFilter}
              options={[
                { value: "all", label: "All SLA" },
                { value: "overdue", label: "Overdue" },
                { value: "due_soon", label: "Due soon" },
                { value: "on_track", label: "On track" },
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
            href="/onboarding/new"
            className={buttonVariants({
              variant: "primary-emerald",
              size: "md",
              hasTrailing: true,
            })}
          >
            <Plus weight="light" className="size-4" />
            New onboarding
            <span className="ml-0.5 inline-flex size-6 items-center justify-center rounded-full bg-black/10 text-on-emerald transition-transform duration-300 ease-soft group-hover/button:translate-x-0.5 dark:bg-white/15">
              <ArrowRight weight="light" className="size-3.5" />
            </span>
          </Link>
        }
      />

      {/* Board */}
      {!hasAny ? (
        <EmptyState
          icon={<Funnel weight="light" />}
          title="The onboarding pipeline is empty."
          hint="Start onboarding a prospect to walk them through profile, documents, KYC and compliance to activation."
          action={
            <Link
              href="/onboarding/new"
              className={buttonVariants({
                variant: "primary-emerald",
                size: "md",
                hasTrailing: true,
              })}
            >
              <Plus weight="light" className="size-4" />
              New onboarding
              <span className="ml-0.5 inline-flex size-6 items-center justify-center rounded-full bg-black/10 text-on-emerald dark:bg-white/15">
                <ArrowRight weight="light" className="size-3.5" />
              </span>
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<TrendUp weight="light" />}
          title="No cases match these filters."
          hint="Clear the search or filters to see the full pipeline."
        />
      ) : (
        <div className="flex w-full flex-col gap-5 overflow-x-auto pb-2 md:flex-row md:gap-4">
          {grouped.map((col) => (
            <KanbanColumn
              key={col.stage}
              stage={col.stage}
              cases={col.cases}
              rmsById={rmsById}
              visibleCount={visibleFor(col.stage)}
              onLoadMore={() => handleLoadMore(col.stage, col.cases.length)}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      {hasAny && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[11px] text-muted-foreground/80">
          <span className="inline-flex items-center gap-1.5">
            <Clock weight="light" className="size-3" /> SLA status
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck weight="light" className="size-3" /> KYC status
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle weight="light" className="size-3" /> documents verified / total
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Buildings weight="light" className="size-3" /> registered city
          </span>
          {hasFilters && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
              <XCircle weight="light" className="size-3" />
              {filtered.length} of {allCases.length} cases
            </span>
          )}
        </div>
      )}
    </div>
  );
}