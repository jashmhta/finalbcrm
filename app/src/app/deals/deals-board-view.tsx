"use client";

import * as React from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowsOutCardinal,
  ArrowUpRight,
  Buildings,
  CalendarBlank,
  CaretRight,
  Clock,
  DotsThree,
  FolderOpen,
  Handshake,
  List as ListIcon,
  Pause,
  ProhibitInset,
  Sparkle,
  SquaresFour,
  Star,
  Tag,
  Target,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type {
  DealPipelineGroup,
  DealPipelineRow,
} from "@/features/deals/queries";
import {
  Badge,
  Card,
  CommandBar,
  EmptyState,
  Num,
  PreviewPane,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmpty,
  compactINR,
  formatMoney,
  type Density,
} from "@/components/brand";
import { Eyebrow } from "@/components/brand/text";
import { ExportCsvButton } from "@/features/reports/export-button";
import {
  DealTypeGlyph,
  PartyRoleGlyph,
  creditBand,
} from "./deal-type-icon";

/* ------------------------------------------------------------------ *
 * DealsBoardView - the Pipeline Explorer.
 *
 * NOT a table. The deal pipeline reimagined as a two-pane explorer:
 *
 *   xl+ ───────────────────────────────────────────────────────────────
 *     LEFT  a kanban of machined columns - stage OR deal-type swimlanes
 *           (the toggle in the command bar flips the grouping). Each deal
 *           is a reimagined OBJECT: a deal-type identity disc, a mini
 *           stage-progress gauge, exposure in Geist Mono, a credit-band
 *           rating chip, and linked-party avatar IconTiles. Selecting a
 *           card syncs the right pane.
 *     RIGHT a sticky PreviewPane (brand/preview-pane) framing the selected
 *           mandate - exposure readout, a full stage ladder with the
 *           current notch highlighted, and the linked-party roster with
 *           role discs. The inspector for the currently-selected deal
 *           (there is no /deals/[id] route - the pane IS the detail view).
 *
 *   <xl ────────────────────────────────────────────────────────────────
 *     Single-column kanban (columns stack) + the inspector pane in flow
 *     beneath the board. Selecting a card smooth-scrolls the pane into view.
 *
 * CRITICAL: primary content renders VISIBLE on mount - no whileInView
 * opacity-0 gate on the board / pane / KPIs. Card stagger is mount-based
 * (initial → animate), not whileInView, so headless captures render fully.
 * Motion is transform/opacity only; the progress-bar fill draws via scaleX.
 * ------------------------------------------------------------------ */

export interface DealsBoardViewProps {
  groups: DealPipelineGroup[];
  /** Full non-deleted deal count (the "Showing X of Y" denominator). The
   *  loaded `groups` are per-stage-capped server-side; `total` is the uncapped
   *  count so the board can tell the user how much of the book is represented
   *  on screen vs. reachable via search/filter. */
  total?: number;
  initialSearch?: string;
}

type ViewMode = "board" | "list";
type Swimlane = "stage" | "type";

const EASE = [0.32, 0.72, 0, 1] as const;

/** Initial number of deal cards rendered per board column / blotter group, and
 *  the step each "Load more" click reveals. The query caps each stage at 20
 *  (page.tsx passes perStage: 20); the view shows the first 8 and reveals the
 *  rest in steps of 8 (8 → 16 → 20) via a per-column "Load more" so the initial
 *  paint stays light even when every stage fills its cap. 11 stages × 8 = ~88
 *  cards on first paint instead of 220, which keeps the server HTML payload
 *  small and the first interaction snappy. */
const VISIBLE_INCREMENT = 8;

/* Stage taxonomy - the canonical IB/DCM pipeline order. Off-pipeline
 * terminal states (dropped / on_hold) trail the ladder. */
const PIPELINE_ORDER = [
  "lead",
  "mandated",
  "in_dd",
  "structuring",
  "rating_marketing",
  "pricing",
  "allocation",
  "settled",
  "closed",
] as const;

const OFF_PIPELINE = new Set(["dropped", "on_hold"]);
const OFF_PIPELINE_KEYS = ["dropped", "on_hold"] as const;

/* Deal-type display order - groups related instrument families (fixed-income
 * core, then ECM, then advisory/other) so the type-swimlane board reads as
 * organized desks, not an arbitrary enum order. */
const TYPE_ORDER = [
  "bond_underwriting",
  "high_yield_bond",
  "private_placement_debt",
  "gsec_auction",
  "structured_finance",
  "supply_chain_finance",
  "project_finance",
  "ecm_ipo",
  "ecm_fpo",
  "ecm_qip",
  "ecm_rights",
  "dcm_advisory",
  "rating_advisory",
  "m_and_a",
  "valuation",
  "fairness_opinion",
  "portfolio_management_mandate",
  "secondary_trading_advisory",
] as const;

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  mandated: "Mandated",
  in_dd: "Diligence",
  structuring: "Structuring",
  rating_marketing: "Rating & Mkt",
  pricing: "Pricing",
  allocation: "Allocation",
  settled: "Settled",
  closed: "Closed",
  dropped: "Dropped",
  on_hold: "On Hold",
};

const STATUS_SHORT: Record<string, string> = {
  lead: "Lead",
  mandated: "Mand",
  in_dd: "DD",
  structuring: "Strct",
  rating_marketing: "R&M",
  pricing: "Price",
  allocation: "Alloc",
  settled: "Setl",
  closed: "Clsd",
  dropped: "Drp",
  on_hold: "Hold",
};

const TYPE_LABELS: Record<string, string> = {
  bond_underwriting: "Bond Underwriting",
  gsec_auction: "G-Sec Auction",
  high_yield_bond: "High-Yield Bond",
  rating_advisory: "Rating Advisory",
  m_and_a: "M&A",
  project_finance: "Project Finance",
  structured_finance: "Structured Finance",
  supply_chain_finance: "Supply-Chain Finance",
  ecm_ipo: "Equity Capital Markets IPO",
  ecm_fpo: "Equity Capital Markets FPO",
  ecm_qip: "Equity Capital Markets QIP",
  ecm_rights: "Equity Capital Markets Rights",
  dcm_advisory: "Debt Capital Markets Advisory",
  private_placement_debt: "Private Placement",
  valuation: "Valuation",
  fairness_opinion: "Fairness Opinion",
  portfolio_management_mandate: "Portfolio Mandate",
  secondary_trading_advisory: "Secondary Advisory",
};

const TYPE_SHORT: Record<string, string> = {
  bond_underwriting: "Bond UW",
  gsec_auction: "G-Sec",
  high_yield_bond: "HY Bond",
  rating_advisory: "Rating Adv",
  m_and_a: "M&A",
  project_finance: "Proj Fin",
  structured_finance: "Struct Fin",
  supply_chain_finance: "SCF",
  ecm_ipo: "IPO",
  ecm_fpo: "FPO",
  ecm_qip: "QIP",
  ecm_rights: "Rights",
  dcm_advisory: "DCM Adv",
  private_placement_debt: "PP Debt",
  valuation: "Valuation",
  fairness_opinion: "Fairness",
  portfolio_management_mandate: "Portfolio",
  secondary_trading_advisory: "Secondary",
};

const BRAND_LABELS: Record<string, string> = {
  binarycapital: "Binary Capital",
  binarybonds: "Binary Bonds",
  shared: "Shared",
};

function stageLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

function stageShort(status: string): string {
  return STATUS_SHORT[status] ?? status.replace(/_/g, " ");
}

function typeLabel(t: string): string {
  return TYPE_LABELS[t] ?? t.replace(/_/g, " ");
}

function typeShort(t: string): string {
  return TYPE_SHORT[t] ?? typeLabel(t);
}

function brandLabel(b: string): string {
  return BRAND_LABELS[b] ?? b.replace(/_/g, " ");
}

function pipelineIndex(status: string): number {
  return PIPELINE_ORDER.indexOf(status as (typeof PIPELINE_ORDER)[number]);
}

type StageTone = "neutral" | "emerald" | "gold" | "down" | "info";

function stageTone(status: string): StageTone {
  if (status === "closed" || status === "settled") return "emerald";
  if (status === "on_hold") return "gold";
  if (status === "dropped") return "down";
  if (status === "lead") return "info";
  return "neutral";
}

/** Compact deal-size formatter. INR → Indian short form (Cr/L/K); other
 *  currencies → Intl compact notation. Falls back to the raw string. */
function dealSizeText(
  value: string | null,
  currency: string | null,
): { text: string; currency: string | null } {
  if (!value) return { text: "-", currency };
  const n = Number(value);
  if (!Number.isFinite(n)) return { text: value, currency };
  if (currency === "INR" || !currency) {
    return { text: compactINR(n), currency: currency ?? null };
  }
  return {
    text: formatMoney(n, { currency, notation: "compact" }),
    currency,
  };
}

/** ISO date (yyyy-mm-dd) → "15 Aug 2026"; null-safe. */
function formatCloseDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Numeric years string → "5y" / "5.5y"; null-safe. */
function formatTenor(years: string | null): string | null {
  if (!years) return null;
  const n = Number(years);
  if (!Number.isFinite(n)) return null;
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}y`;
}

/** Order groups by canonical pipeline position, off-pipeline last. */
function orderedGroups(groups: DealPipelineGroup[]): DealPipelineGroup[] {
  return [...groups].sort((a, b) => {
    const ai = pipelineIndex(a.status);
    const bi = pipelineIndex(b.status);
    const ax = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const bx = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    if (ax !== bx) return ax - bx;
    return stageLabel(a.status).localeCompare(stageLabel(b.status));
  });
}

function flattenDeals(groups: DealPipelineGroup[]): DealPipelineRow[] {
  const out: DealPipelineRow[] = [];
  for (const g of orderedGroups(groups)) {
    for (const d of g.deals) out.push(d);
  }
  return out;
}

/** Default selection - the first deal of the first non-empty pipeline stage,
 *  so the inspector opens on a real mandate rather than an empty state. */
function defaultDealId(groups: DealPipelineGroup[]): string | null {
  const ordered = orderedGroups(groups);
  for (const g of ordered) {
    if (g.deals.length > 0) return g.deals[0].dealId;
  }
  return null;
}

function countsByStatus(groups: DealPipelineGroup[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of groups) m.set(g.status, g.deals.length);
  return m;
}

/* ------------------------------------------------------------------ *
 * Mount-based card stagger (initial → animate, NOT whileInView, so the
 * board renders fully in headless captures). transform/opacity only.
 * ------------------------------------------------------------------ */
const cardListVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

const mountFade: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

/* ------------------------------------------------------------------ *
 * Board column - the unified shape for both swimlanes. `kind` tells the
 * header which treatment to render (stage pill vs deal-type disc).
 * ------------------------------------------------------------------ */
interface BoardColumn {
  key: string;
  kind: Swimlane;
  deals: DealPipelineRow[];
}

/** Build the column list for the active swimlane. In stage mode without a
 *  query/stage-filter, the full canonical pipeline renders (empty stages
 *  included) so the board reads as a balanced funnel; with a query or a
 *  stage filter it collapses to only the matching columns. Type mode always
 *  shows only types that have deals, in canonical desk order. */
function buildColumns(
  deals: DealPipelineRow[],
  swimlane: Swimlane,
  hasQuery: boolean,
): BoardColumn[] {
  if (swimlane === "type") {
    const byType = new Map<string, DealPipelineRow[]>();
    for (const d of deals) {
      const arr = byType.get(d.dealType) ?? [];
      arr.push(d);
      byType.set(d.dealType, arr);
    }
    return TYPE_ORDER.filter((t) => byType.has(t)).map((t) => ({
      key: t,
      kind: "type" as const,
      deals: byType.get(t) ?? [],
    }));
  }

  const byStatus = new Map<string, DealPipelineRow[]>();
  for (const d of deals) {
    const k = d.status ?? "unknown";
    const arr = byStatus.get(k) ?? [];
    arr.push(d);
    byStatus.set(k, arr);
  }

  if (hasQuery) {
    // Collapse to only stages that have deals, in pipeline order + off-pipeline.
    const present = [...PIPELINE_ORDER, ...OFF_PIPELINE_KEYS].filter((s) =>
      byStatus.has(s),
    );
    return present.map((s) => ({
      key: s,
      kind: "stage" as const,
      deals: byStatus.get(s) ?? [],
    }));
  }

  // Full funnel - empty stages included, off-pipeline only when populated.
  const pipeline = PIPELINE_ORDER.map((s) => ({
    key: s,
    kind: "stage" as const,
    deals: byStatus.get(s) ?? [],
  }));
  const off = OFF_PIPELINE_KEYS.filter((s) => byStatus.has(s)).map((s) => ({
    key: s,
    kind: "stage" as const,
    deals: byStatus.get(s) ?? [],
  }));
  return [...pipeline, ...off];
}

/* ------------------------------------------------------------------ */

export function DealsBoardView({
  groups,
  total,
  initialSearch,
}: DealsBoardViewProps) {
  const [density, setDensity] = React.useState<Density>("comfortable");
  const [view, setView] = React.useState<ViewMode>("board");
  const [swimlane, setSwimlane] = React.useState<Swimlane>("stage");
  const [stageFilter, setStageFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState(initialSearch ?? "");
  const [selectedDealId, setSelectedDealId] = React.useState<string | null>(
    () => defaultDealId(groups),
  );

  // Per-column "Load more" state. Keyed by column key (a stage or deal-type
  // slug). Missing keys default to VISIBLE_INCREMENT. Preserved across
  // search/stage-filter changes (the column set narrows but the counts for
  // still-present columns persist); reset implicitly when the swimlane flips
  // since stage slugs and type slugs don't collide.
  const [visiblePerColumn, setVisiblePerColumn] = React.useState<
    Record<string, number>
  >({});
  const visibleFor = React.useCallback(
    (key: string) => visiblePerColumn[key] ?? VISIBLE_INCREMENT,
    [visiblePerColumn],
  );
  const handleLoadMore = React.useCallback(
    (key: string, ceiling: number) => {
      setVisiblePerColumn((prev) => {
        const cur = prev[key] ?? VISIBLE_INCREMENT;
        // Never reveal more than the column actually holds - the button hides
        // at the ceiling so the user can't click into an empty append.
        const next = Math.min(cur + VISIBLE_INCREMENT, ceiling);
        if (next === cur) return prev;
        return { ...prev, [key]: next };
      });
    },
    [],
  );

  const ordered = React.useMemo(() => orderedGroups(groups), [groups]);
  const allDeals = React.useMemo(() => flattenDeals(groups), [groups]);

  const totalDeals = allDeals.length;
  // The uncapped grand total from the query (defaults to the loaded count when
  // the page didn't pass it - keeps the component robust in isolation).
  const grandTotal = total ?? allDeals.length;

  const presentPipelineStages = React.useMemo(
    () => ordered.filter((g) => !OFF_PIPELINE.has(g.status)).map((g) => g.status),
    [ordered],
  );

  const leadCount = React.useMemo(
    () => groups.find((x) => x.status === "lead")?.deals.length ?? 0,
    [groups],
  );

  // Furthest pipeline stage that actually has deals - drives the ladder fill.
  const furthestActiveIndex = React.useMemo(() => {
    let furthest = -1;
    for (const s of presentPipelineStages) {
      const i = pipelineIndex(s);
      if (i > furthest) furthest = i;
    }
    return furthest;
  }, [presentPipelineStages]);

  // Total target size across all deals (INR headline) - the "book" KPI.
  const bookSize = React.useMemo(() => {
    let sum = 0;
    for (const d of allDeals) {
      if (!d.targetSize) continue;
      const n = Number(d.targetSize);
      if (Number.isFinite(n) && (d.currencyCode ?? "INR") === "INR") sum += n;
    }
    return sum;
  }, [allDeals]);

  // Stage-filtered deals (the command-bar stage filter is cross-cutting - it
  // narrows the deal set in both swimlanes).
  const stageFilteredDeals = React.useMemo(() => {
    if (stageFilter === "all") return allDeals;
    return allDeals.filter((d) => (d.status ?? "unknown") === stageFilter);
  }, [allDeals, stageFilter]);

  // Search filters across the visible deal fields (code/name/type/brand/parties).
  const filteredDeals = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stageFilteredDeals;
    return stageFilteredDeals.filter((d) => {
      const hay = [
        d.dealCode,
        d.dealName,
        d.dealType,
        typeLabel(d.dealType),
        d.brand,
        brandLabel(d.brand),
        d.status,
        d.status ? stageLabel(d.status) : null,
        ...d.parties.map((p) => p.legalName),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [stageFilteredDeals, search]);

  const hasQuery =
    search.trim().length > 0 || stageFilter !== "all";

  const columns = React.useMemo(
    () => buildColumns(filteredDeals, swimlane, hasQuery),
    [filteredDeals, swimlane, hasQuery],
  );

  const activeStagesCount = React.useMemo(
    () =>
      new Set(
        filteredDeals
          .map((d) => d.status)
          .filter((s): s is string => !!s && !OFF_PIPELINE.has(s)),
      ).size,
    [filteredDeals],
  );

  // Resolve the selected deal from the FULL list (not filtered) so the
  // inspector persists when the board is narrowed by search/stage filter.
  const selectedDeal = React.useMemo(
    () => allDeals.find((d) => d.dealId === selectedDealId) ?? null,
    [allDeals, selectedDealId],
  );

  // Smooth-scroll the inspector into view on mobile when a new deal is chosen.
  const paneRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!selectedDealId || !paneRef.current) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (window.matchMedia("(min-width: 1280px)").matches) return; // xl: pane is sticky-rail
    paneRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedDealId]);

  const handleSelect = React.useCallback((dealId: string) => {
    setSelectedDealId(dealId);
  }, []);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* KPI strip - count-ups on mount (StatCard fires on view), visible
          immediately. Mount-fade wrapper (initial → animate), not whileInView. */}
      <motion.div
        variants={mountFade}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="Mandates"
          value={totalDeals}
          icon={<SquaresFour weight="light" />}
          tone={totalDeals > 0 ? "up" : "default"}
        />
        <StatCard
          label="Active stages"
          value={activeStagesCount}
          icon={<ArrowsOutCardinal weight="light" />}
        />
        <StatCard
          label="In lead stage"
          value={leadCount}
          icon={<Sparkle weight="light" />}
          tone={leadCount > 0 ? "gold" : "default"}
        />
        <StatCard
          label="Book (target)"
          value={bookSize}
          icon={<Target weight="light" />}
          preset="currency"
        />
      </motion.div>

      {/* Stage-progression ladder - tactile pills with counts. Visible on mount. */}
      <motion.div variants={mountFade} initial="hidden" animate="show">
        <PipelineLadder
          present={new Set(presentPipelineStages)}
          furthestActiveIndex={furthestActiveIndex}
          counts={countsByStatus(ordered)}
        />
      </motion.div>

      <CommandBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search deal, type, party…"
        density={density}
        onDensityChange={setDensity}
        label={`${totalDeals} ${totalDeals === 1 ? "mandate" : "mandates"}`}
        filters={
          <>
            {/* The dropdown stage filter is the desktop control (md+). On
                phones it's hidden in favor of the touch-native StageFilterPills
                row rendered below the command bar - a horizontal-scroll pill
                strip is a far better thumb target than a native <select>
                inside a wrapping toolbar. */}
            <StageFilterSelect
              value={stageFilter}
              onChange={setStageFilter}
              className="hidden md:inline-flex"
            />
            {view === "board" ? (
              <SwimlaneToggle value={swimlane} onChange={setSwimlane} />
            ) : null}
          </>
        }
        actions={
          <>
            <ExportCsvButton type="deals" />
            <ViewToggle view={view} onChange={setView} />
          </>
        }
        sticky
      />

      {/* Mobile-only touch-native stage filter pill row - a horizontal-scroll
          strip of stage pills (All + each pipeline stage + off-pipeline). Tapping
          a pill filters the board; the active pill takes the emerald inset. This
          is the mobile counterpart to the dropdown StageFilterSelect above and
          pairs with the single-column stacked board so a phone user can focus a
          stage without scrolling the whole ladder. md:hidden guards desktop. */}
      <StageFilterPills
        value={stageFilter}
        onChange={setStageFilter}
        counts={countsByStatus(ordered)}
      />

      {/* Page-level "Showing X of Y" indicator - the query caps each stage at
          40 deals (queries.ts DEFAULT_PER_STAGE), so when the book is large the
          loaded set is a representative slice, not the whole. This line tells
          the user how much of the pipeline is on screen and that search / the
          stage filter reach the rest. Hidden when the slice equals the book. */}
      {grandTotal > totalDeals ? (
        <p className="text-[12.5px] text-muted-foreground">
          Showing{" "}
          <span className="nums tabular-nums text-foreground/80">
            {totalDeals.toLocaleString("en-IN")}
          </span>{" "}
          of{" "}
          <span className="nums tabular-nums text-foreground/80">
            {grandTotal.toLocaleString("en-IN")}
          </span>{" "}
          mandates - refine with search or the stage filter to surface the rest.
        </p>
      ) : null}

      {totalDeals === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderOpen weight="light" />}
            title="The pipeline is quiet."
            hint="No mandates yet. Deals are created via the mandates flow and will appear here staged from lead to settlement."
          />
        </Card>
      ) : view === "board" ? (
        <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(336px,376px)] xl:items-start">
          <motion.div
            variants={mountFade}
            initial="hidden"
            animate="show"
            className="xl:min-w-0"
          >
            <Board
              columns={columns}
              density={density}
              swimlane={swimlane}
              hasQuery={hasQuery}
              selectedDealId={selectedDealId}
              onSelect={handleSelect}
              visibleFor={visibleFor}
              onLoadMore={handleLoadMore}
            />
          </motion.div>
          <div ref={paneRef} className="xl:sticky xl:top-[104px]">
            <DealPreviewPane
              deal={selectedDeal}
              onSelect={handleSelect}
            />
          </div>
        </div>
      ) : (
        <Blotter
          deals={filteredDeals}
          density={density}
          hasQuery={hasQuery}
          visibleFor={visibleFor}
          onLoadMore={handleLoadMore}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pipeline ladder - tactile stage pills with counts, linked by hairline
 * connectors that fill emerald up to the furthest active stage.
 * ------------------------------------------------------------------ */

function PipelineLadder({
  present,
  furthestActiveIndex,
  counts,
}: {
  present: Set<string>;
  furthestActiveIndex: number;
  counts: Map<string, number>;
}) {
  const stages = PIPELINE_ORDER;
  const total = stages.length;
  return (
    <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
      <div className="flex min-w-max items-center gap-1.5 py-0.5">
        {stages.map((s, i) => {
          const isPresent = present.has(s);
          const isFurthest = i === furthestActiveIndex;
          const reached = i <= furthestActiveIndex;
          const count = counts.get(s) ?? 0;
          const isLast = i === stages.length - 1;
          return (
            <React.Fragment key={s}>
              <div
                aria-current={isFurthest ? "step" : undefined}
                className={cn(
                  // py-2.5 on mobile for a touch-friendlier ladder pill (~40px
                  // tap height) inside the horizontal-scroll strip; md:py-1.5
                  // restores the compact desktop rail.
                  "group/ladder relative flex shrink-0 items-center gap-2 rounded-full py-2.5 pl-2.5 pr-3 ring-1 transition-all duration-300 ease-soft md:py-1.5",
                  reached
                    ? "bg-emerald/[0.08] ring-emerald/30"
                    : "bg-surface/90 ring-hairline",
                  isFurthest &&
                    "bg-emerald/[0.12] ring-emerald/55 shadow-[0_0_22px_-6px] shadow-emerald/60",
                  !isPresent && !reached && "opacity-55",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full transition-all duration-300 ease-soft",
                    reached
                      ? "bg-emerald shadow-[0_0_7px] shadow-emerald/70"
                      : "bg-foreground/25",
                    isFurthest && "size-2",
                  )}
                />
                <span
                  className={cn(
                    "text-[10.5px] font-medium uppercase tracking-[0.1em] transition-colors duration-200 ease-soft",
                    reached ? "text-foreground/90" : "text-muted-foreground/70",
                  )}
                >
                  {stageShort(s)}
                </span>
                <span
                  className={cn(
                    "nums tabular-nums text-[12px] font-medium leading-none",
                    isPresent ? "text-foreground/85" : "text-muted-foreground/50",
                  )}
                >
                  {count}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "absolute -bottom-1 left-1/2 h-[2px] -translate-x-1/2 rounded-full transition-all duration-300 ease-soft",
                    isFurthest ? "w-6 bg-emerald/70" : "w-0",
                  )}
                />
              </div>
              {!isLast ? (
                <div aria-hidden className="flex h-px w-5 shrink-0 items-center">
                  <span
                    className={cn(
                      "h-px w-full rounded-full transition-colors duration-300 ease-soft",
                      i < furthestActiveIndex ? "bg-emerald/55" : "bg-hairline",
                    )}
                  />
                </div>
              ) : null}
              {isLast && furthestActiveIndex >= 0 ? (
                <span className="nums ml-2 hidden shrink-0 items-center text-[11px] text-muted-foreground sm:inline-flex">
                  <span className="tabular-nums text-foreground/80">
                    {furthestActiveIndex + 1}
                  </span>
                  <span className="mx-1 text-muted-foreground/50">/</span>
                  <span className="tabular-nums">{total}</span>
                </span>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Board - horizontally-scrollable columns of reimagined deal cards.
 * ------------------------------------------------------------------ */

function Board({
  columns,
  density,
  swimlane,
  hasQuery,
  selectedDealId,
  onSelect,
  visibleFor,
  onLoadMore,
}: {
  columns: BoardColumn[];
  density: Density;
  swimlane: Swimlane;
  hasQuery: boolean;
  selectedDealId: string | null;
  onSelect: (dealId: string) => void;
  visibleFor: (key: string) => number;
  onLoadMore: (key: string, ceiling: number) => void;
}) {
  if (columns.length === 0 || columns.every((c) => c.deals.length === 0)) {
    return (
      <Card>
        <EmptyState
          icon={<DotsThree weight="light" />}
          title={hasQuery ? "Nothing matches that view." : "No deals to stage."}
          hint={
            hasQuery
              ? "Try a different deal, type, or party name, or clear the stage filter."
              : "Mandates will land here as they are created."
          }
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:overflow-x-auto md:pb-2 md:snap-x md:snap-mandatory [scrollbar-width:thin]">
      {columns.map((col, idx) => (
        <div
          key={`${col.kind}-${col.key}`}
          className="w-full md:h-full md:w-[316px] md:shrink-0 md:snap-start"
        >
          <Column
            column={col}
            density={density}
            swimlane={swimlane}
            selectedDealId={selectedDealId}
            onSelect={onSelect}
            visibleCount={visibleFor(col.key)}
            onLoadMore={() => onLoadMore(col.key, col.deals.length)}
            // Mount fade per column (initial → animate), staggered by index.
            fadeDelay={Math.min(idx * 0.04, 0.24)}
          />
        </div>
      ))}
    </div>
  );
}

function Column({
  column,
  density,
  swimlane,
  selectedDealId,
  onSelect,
  visibleCount,
  onLoadMore,
  fadeDelay,
}: {
  column: BoardColumn;
  density: Density;
  swimlane: Swimlane;
  selectedDealId: string | null;
  onSelect: (dealId: string) => void;
  visibleCount: number;
  onLoadMore: () => void;
  fadeDelay: number;
}) {
  const count = column.deals.length;
  const sums = sumSizesByCurrency(column.deals);
  const headline = sums.find((s) => s.currency === "INR") ?? sums[0];
  const otherCurrencies = sums.filter((s) => s !== headline);

  // Client-side reveal cap - the query already bounds the column at 40; this
  // bounds the RENDERED cards at `visibleCount` (20 initially) so the first
  // paint is light. "Load more" raises `visibleCount` in VISIBLE_INCREMENT
  // steps until the loaded ceiling is reached.
  const visibleDeals = column.deals.slice(0, visibleCount);
  const hiddenCount = count - visibleDeals.length;

  return (
    <motion.div
      variants={mountFade}
      initial="hidden"
      animate="show"
      transition={{ delay: fadeDelay }}
      className="h-full"
    >
      <Card className="h-full">
        <div className="flex h-full flex-col">
          <ColumnHeader
            column={column}
            count={count}
            headline={headline}
            otherCurrencies={otherCurrencies}
            swimlane={swimlane}
          />

          <div
            className={cn(
              "flex min-h-[6rem] flex-col gap-2.5 overflow-y-auto [scrollbar-width:thin] md:max-h-[34rem]",
              density === "compact" ? "p-2.5" : "p-3",
            )}
          >
            {count === 0 ? (
              <ColumnEmpty status={column.key} swimlane={swimlane} />
            ) : (
              <>
                <motion.ul
                  variants={cardListVariants}
                  initial="hidden"
                  animate="show"
                  role="list"
                  className="flex flex-col gap-2.5"
                >
                  {visibleDeals.map((d) => (
                    <motion.li key={d.dealId} variants={cardItemVariants}>
                      <DealCard
                        deal={d}
                        density={density}
                        selected={d.dealId === selectedDealId}
                        onSelect={onSelect}
                      />
                    </motion.li>
                  ))}
                </motion.ul>
                {hiddenCount > 0 ? (
                  <ColumnLoadMore
                    hiddenCount={hiddenCount}
                    onClick={onLoadMore}
                  />
                ) : null}
              </>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/** The per-column "Load more" reveal - a quiet hairline pill at the column
 *  foot that surfaces the next VISIBLE_INCREMENT cards. Mono count + a soft
 *  emerald hover; the pill is a real <button> (not a link) since the reveal is
 *  client-side state, not navigation. */
function ColumnLoadMore({
  hiddenCount,
  onClick,
}: {
  hiddenCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/loadmore mt-1 inline-flex items-center justify-center gap-1.5 rounded-full py-2 text-[11.5px] font-medium text-muted-foreground ring-1 ring-hairline/60 transition-all duration-200 ease-soft hover:bg-foreground/[0.04] hover:text-foreground hover:ring-hairline"
    >
      <CaretRight
        weight="light"
        className="size-3 rotate-90 text-muted-foreground/60 transition-transform duration-200 ease-soft group-hover/loadmore:translate-y-0.5 group-hover/loadmore:text-emerald"
      />
      Load more
      <span className="nums tabular-nums text-muted-foreground/70">
        +{Math.min(hiddenCount, VISIBLE_INCREMENT)}
      </span>
    </button>
  );
}

function ColumnHeader({
  column,
  count,
  headline,
  otherCurrencies,
  swimlane,
}: {
  column: BoardColumn;
  count: number;
  headline: { currency: string | null; text: string } | undefined;
  otherCurrencies: { currency: string | null; text: string }[];
  swimlane: Swimlane;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-hairline px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        {/* Identity - a stage pill (stage swimlane) or a deal-type disc +
            label (type swimlane). The disc is the machined identity cue. */}
        {swimlane === "stage" ? (
          <StagePill status={column.key} />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <DealTypeGlyph dealType={column.key} size={16} />
            <span className="truncate text-[12px] font-medium uppercase tracking-[0.1em] text-foreground/85">
              {typeShort(column.key)}
            </span>
          </div>
        )}
        <span className="nums inline-flex items-baseline gap-1 tabular-nums">
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            {count}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {count === 1 ? "deal" : "deals"}
          </span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        {swimlane === "stage" ? (
          pipelineIndex(column.key) === -1 ? (
            <OffPipelineGlyph status={column.key} />
          ) : (
            <StageMicroIndicator index={pipelineIndex(column.key)} />
          )
        ) : (
          // Type swimlane - show the stage mix as a quiet eyebrow instead of
          // the stage ladder (a type column spans many stages).
          <span className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground/70">
            <Tag weight="light" className="size-3" />
            By type
          </span>
        )}
        <div className="flex flex-col items-end gap-0.5">
          <Eyebrow>Exposure</Eyebrow>
          <span className="nums tabular-nums text-[13.5px] font-medium text-foreground/90">
            {headline ? headline.text : "-"}
          </span>
          {otherCurrencies.length > 0 ? (
            <span className="nums tabular-nums text-[10.5px] text-muted-foreground/70">
              +{otherCurrencies.length} other
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StagePill({ status }: { status: string }) {
  const tone = stageTone(status);
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 ring-1 transition-colors duration-200 ease-soft",
        tone === "emerald" && "bg-emerald/[0.1] ring-emerald/35 text-emerald",
        tone === "gold" && "bg-gold/[0.1] ring-gold/35 text-gold",
        tone === "down" && "bg-down/[0.1] ring-down/35 text-down",
        tone === "info" && "bg-info/[0.1] ring-info/35 text-info",
        tone === "neutral" && "bg-surface/90 ring-hairline text-foreground/85",
      )}
    >
      {tone === "emerald" ? (
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-emerald shadow-[0_0_6px] shadow-emerald/70"
        />
      ) : null}
      <span className="text-[11px] font-medium uppercase tracking-[0.12em]">
        {stageLabel(status)}
      </span>
    </span>
  );
}

/** Quiet in-column empty state for a column with no deals - a Fraunces
 *  one-liner + a thin Phosphor glyph, never a generic "No data." */
function ColumnEmpty({
  status,
  swimlane,
}: {
  status: string;
  swimlane: Swimlane;
}) {
  if (swimlane === "type") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-8 text-center">
        <span className="text-muted-foreground/50 [&_svg]:size-6">
          <FolderOpen weight="light" />
        </span>
        <p className="text-[13.5px] font-light tracking-[-0.01em] text-foreground/70">
          None in flight.
        </p>
        <p className="text-[11px] text-muted-foreground/60">
          {typeShort(status)} mandates land here.
        </p>
      </div>
    );
  }
  const tone = stageTone(status);
  const isClosed = status === "closed" || status === "settled";
  const line = isClosed
    ? "Nothing settled yet."
    : status === "lead"
      ? "No leads in flight."
      : stageLabel(status) + " is clear.";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-8 text-center">
      <span className="text-muted-foreground/50 [&_svg]:size-6">
        {tone === "emerald" ? (
          <Handshake weight="light" />
        ) : tone === "gold" ? (
          <Pause weight="light" />
        ) : tone === "down" ? (
          <ProhibitInset weight="light" />
        ) : (
          <FolderOpen weight="light" />
        )}
      </span>
      <p className="text-[13.5px] font-light tracking-[-0.01em] text-foreground/70">
        {line}
      </p>
      <p className="text-[11px] text-muted-foreground/60">
        Deals land here as they advance.
      </p>
    </div>
  );
}

/** Tiny segmented bar - the per-column stage-progression micro-indicator. */
function StageMicroIndicator({ index }: { index: number }) {
  const total = PIPELINE_ORDER.length;
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 w-2.5 rounded-full transition-colors duration-300 ease-soft",
            i <= index ? "bg-emerald/70" : "bg-foreground/15",
            i === index && "bg-emerald shadow-[0_0_6px] shadow-emerald/60",
          )}
        />
      ))}
    </div>
  );
}

function OffPipelineGlyph({ status }: { status: string }) {
  const icon =
    status === "on_hold" ? (
      <Pause weight="light" className="size-3.5" />
    ) : (
      <ProhibitInset weight="light" className="size-3.5" />
    );
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em]",
        status === "on_hold"
          ? "bg-gold/10 text-gold ring-1 ring-gold/30"
          : "bg-down/10 text-down ring-1 ring-down/30",
      )}
    >
      {icon}
      {status === "on_hold" ? "Paused" : "Off-pipeline"}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * DealCard - the reimagined deal object. A machined, nested enclosure
 * (outer shell + raised inset core) carrying: the deal-type identity disc,
 * the deal code/name, a credit-band rating chip, a mini stage-progress
 * gauge, exposure in Geist Mono, and linked-party avatar IconTiles.
 * Selectable (click → inspector); party avatars are nested links to the
 * party record. Magnetic hover (transform only).
 * ------------------------------------------------------------------ */

function DealCardImpl({
  deal,
  density,
  selected,
  onSelect,
}: {
  deal: DealPipelineRow;
  density: Density;
  selected: boolean;
  onSelect: (dealId: string) => void;
}) {
  const size = dealSizeText(deal.targetSize, deal.currencyCode);
  const parties = deal.parties;
  const lead = parties.find((p) => p.isLead);
  const others = parties.filter((p) => !p.isLead);
  const shownOthers = others.slice(0, 3);
  const extra = others.length - shownOthers.length;
  const band = creditBand(deal.dealType);
  const name =
    deal.dealName && deal.dealCode && deal.dealName !== deal.dealCode
      ? deal.dealName
      : null;
  const close = formatCloseDate(deal.targetCloseDate);

  // onKeyDown is per-card but cheap; onSelect is a stable useCallback from the
  // parent, so DealCard is safe to memoize on (deal, density, selected).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(deal.dealId);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(deal.dealId)}
      onKeyDown={onKeyDown}
      aria-pressed={selected}
      aria-label={`${deal.dealCode ?? deal.dealName ?? deal.dealId} - ${typeLabel(deal.dealType)}`}
      className={cn(
        // Editorial single-surface card: a hairline ring + soft shadow on a
        // solid bg-surface core (no machined double-bezel). The gold
        // left-accent grows on hover; the selected card takes the gold ring
        // (the brand accent) - emerald stays semantic-only (stage progress).
        "group/deal relative rounded-xl bg-surface ring-1 shadow-soft outline-none transition-all duration-300 ease-soft hover:shadow-lift focus-visible:ring-gold/60",
        selected ? "ring-gold/55 shadow-lift" : "ring-hairline hover:ring-hairline/70",
      )}
    >
      {/* Gold left-accent - grows on hover, full on the selected card. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-1 top-1/2 w-[2px] -translate-y-1/2 rounded-full bg-gold transition-all duration-200 ease-soft group-hover/deal:h-8 group-hover/deal:opacity-100",
          selected ? "h-9 opacity-100" : "h-6 opacity-0",
        )}
      />
      <div
        data-slot="deal-card-core"
        className={cn(
          "relative",
          density === "compact" ? "p-3" : "p-3.5",
        )}
      >
        {/* Headline: deal-type disc + code/name + rating chip */}
        <div className="flex items-start gap-2.5">
          <DealTypeGlyph
            dealType={deal.dealType}
            size={16}
            className="mt-0.5"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="nums truncate text-[13.5px] font-medium tracking-[-0.01em] text-foreground">
              {deal.dealCode ?? deal.dealName ?? deal.dealId}
            </span>
            {name ? (
              <span className="truncate text-[11.5px] text-muted-foreground">
                {name}
              </span>
            ) : null}
          </div>
          {band ? (
            <Badge
              title={band.label}
              variant={
                band.tone === "gold"
                  ? "gold"
                  : band.tone === "emerald"
                    ? "emerald"
                    : "down"
              }
              className="shrink-0"
            >
              {band.code}
            </Badge>
          ) : null}
        </div>

        {/* Mini stage-progress gauge */}
        <div className="mt-3">
          <DealStageBar status={deal.status} />
        </div>

        {/* Exposure in Geist Mono */}
        <div className="mt-3 flex items-end justify-between gap-2">
          <Eyebrow>Target</Eyebrow>
          <span className="nums tabular-nums text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            {size.text}
          </span>
        </div>
        {close ? (
          <div className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-muted-foreground/70">
            <CalendarBlank weight="light" className="size-3" />
            <span className="nums">close {close}</span>
          </div>
        ) : null}

        {/* Linked-party avatar IconTiles */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-hairline/60 pt-2.5">
          <div className="flex min-w-0 items-center">
            {parties.length === 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
                <Handshake weight="light" className="size-3.5" />
                Unassigned
              </span>
            ) : (
              <div className="flex items-center">
                {/* Lead first (gold), then others, as overlapping avatar discs. */}
                {lead ? (
                  <PartyAvatarLink
                    key={`lead-${lead.partyId}`}
                    party={lead}
                    lead
                  />
                ) : null}
                {shownOthers.map((p, i) => (
                  <PartyAvatarLink
                    key={p.partyId}
                    party={p}
                    offset={lead ? i + 1 : i}
                  />
                ))}
                {extra > 0 ? (
                  <span className="nums -ml-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/[0.05] text-[10.5px] text-muted-foreground ring-1 ring-hairline/60">
                    +{extra}
                  </span>
                ) : null}
              </div>
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[10.5px] text-muted-foreground/70">
            <Buildings weight="light" className="size-3" />
            {brandLabel(deal.brand)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * DealCard - memoized. With up to ~88 cards rendered across the board (and
 * up to 220 after "Load more" reveals), re-rendering every card on each
 * selection / search keystroke is the single biggest client-side cost. The
 * parent passes a stable `onSelect` (useCallback) and the `deal` object
 * identity is stable (allDeals is useMemo'd on `groups`), so shallow
 * prop-equality skips re-renders for the ~all cards except the previously-
 * selected and newly-selected ones on a selection change, and skips all cards
 * whose deal didn't match a search filter change. `density` changes re-render
 * all (rare, acceptable).
 */
const DealCard = React.memo(DealCardImpl);

/** A linked-party avatar IconTile that links to the party record. The avatar
 *  discs overlap (-ml-1.5) into a compact roster; clicking one navigates
 *  (stopPropagation so the card-body select doesn't also fire). */
function PartyAvatarLink({
  party,
  lead = false,
  offset = 0,
}: {
  party: DealPipelineRow["parties"][number];
  lead?: boolean;
  offset?: number;
}) {
  return (
    <Link
      href={`/parties/${party.partyId}`}
      onClick={(e) => e.stopPropagation()}
      title={`${party.legalName} · ${party.role.replace(/_/g, " ")}${lead ? " · lead" : ""}`}
      aria-label={`${party.legalName}, ${party.role.replace(/_/g, " ")}${lead ? ", lead" : ""}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full ring-1 ring-surface transition-transform duration-200 ease-soft hover:z-10 hover:scale-110",
        offset > 0 && "-ml-1.5",
      )}
    >
      <PartyRoleGlyph role={party.role} size={16} lead={lead} />
    </Link>
  );
}

/* ------------------------------------------------------------------ *
 * DealStageBar - the mini stage-progress gauge on each card. A filled
 * emerald track (scaleX draw-in, transform-only) to the current stage +
 * a glowing "you-are-here" dot at the notch. Off-pipeline deals render a
 * quiet dashed track + the off-pipeline glyph.
 * ------------------------------------------------------------------ */

function DealStageBar({ status }: { status: string | null }) {
  const idx = pipelineIndex(status ?? "");
  const total = PIPELINE_ORDER.length;

  if (idx === -1) {
    return (
      <div className="flex items-center gap-2">
        <div
          aria-hidden
          className="h-1.5 flex-1 rounded-full border border-dashed border-hairline/70"
        />
        <OffPipelineGlyph status={status ?? ""} />
      </div>
    );
  }

  const pct = ((idx + 1) / total) * 100;
  return (
    <div className="flex items-center gap-2.5">
      <span className="hidden shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80 sm:inline">
        {stageShort(status ?? "unknown")}
      </span>
      <div className="relative h-1.5 flex-1 rounded-full bg-foreground/10">
        <motion.div
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald/55 to-emerald"
          style={{ width: `${pct}%`, transformOrigin: "left" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
        />
        {/* You-are-here dot at the current notch. */}
        <motion.span
          aria-hidden
          className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-emerald shadow-[0_0_8px] shadow-emerald/70"
          style={{ left: `calc(${pct}% - 4px)` }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: EASE, delay: 0.45 }}
        />
      </div>
      <span className="nums tabular-nums shrink-0 text-[10.5px] text-muted-foreground/80">
        {idx + 1}/{total}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * DealPreviewPane - the inspector for the selected mandate. A brand
 * PreviewPane framing the identity (deal-type disc + Fraunces name +
 * status/credit/brand badges) with a body that holds the exposure readout,
 * the full stage ladder with the current notch highlighted, and the
 * linked-party roster. Renders visible on mount.
 * ------------------------------------------------------------------ */

function DealPreviewPane({
  deal,
  onSelect,
}: {
  deal: DealPipelineRow | null;
  onSelect: (dealId: string) => void;
}) {
  if (!deal) {
    return (
      <PreviewPane
        type="Pipeline inspector"
        name="Select a mandate"
        mark={<DealTypeGlyph dealType={null} size={24} />}
      >
        <EmptyState
          icon={<Handshake weight="light" />}
          title="No mandate selected."
          hint="Choose a deal card to inspect its exposure, stage and linked parties."
          className="py-10"
        />
      </PreviewPane>
    );
  }

  const size = dealSizeText(deal.targetSize, deal.currencyCode);
  const band = creditBand(deal.dealType);
  const tone = stageTone(deal.status ?? "");
  const close = formatCloseDate(deal.targetCloseDate);
  const tenor = formatTenor(deal.targetTenorYears);
  const lead = deal.parties.find((p) => p.isLead);
  const parties = [...deal.parties].sort((a, b) => {
    if (a.isLead && !b.isLead) return -1;
    if (!a.isLead && b.isLead) return 1;
    return a.legalName.localeCompare(b.legalName);
  });

  return (
    <PreviewPane
      type="Mandate"
      name={deal.dealName || deal.dealCode || deal.dealId}
      mark={<DealTypeGlyph dealType={deal.dealType} size={24} />}
      badges={
        <>
          <Badge
            variant={tone === "neutral" ? "neutral" : tone}
            dot={tone === "emerald"}
          >
            {stageLabel(deal.status ?? "unknown")}
          </Badge>
          {band ? (
            <Badge variant={band.tone === "down" ? "down" : band.tone === "gold" ? "gold" : "emerald"}>
              {band.code}
            </Badge>
          ) : null}
          <Badge variant="outline" icon={<Buildings weight="light" />}>
            {brandLabel(deal.brand)}
          </Badge>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="nums uppercase tracking-[0.1em] text-foreground/80">
              {deal.dealCode ?? deal.dealId.slice(0, 8)}
            </span>
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <Handshake weight="light" className="size-3.5 text-muted-foreground/70" />
            <Num value={deal.parties.length} /> {deal.parties.length === 1 ? "party" : "parties"}
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Exposure readout - the headline figure in Geist Mono. */}
        <section className="flex flex-col gap-2">
          <Eyebrow>
            <Target weight="light" className="size-3.5 text-muted-foreground/70" />
            Target size
          </Eyebrow>
          <div className="flex items-end justify-between gap-3">
            <span className="nums tabular-nums text-[clamp(1.5rem,1.1rem+1.2vw,1.9rem)] font-semibold leading-none tracking-[-0.01em] text-foreground">
              {size.text}
            </span>
            {deal.currencyCode ? (
              <span className="nums text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
                {deal.currencyCode}
              </span>
            ) : null}
          </div>
          {close || tenor ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
              {close ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarBlank weight="light" className="size-3.5 text-muted-foreground/70" />
                  <span className="nums">close {close}</span>
                </span>
              ) : null}
              {tenor ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock weight="light" className="size-3.5 text-muted-foreground/70" />
                  <span className="nums">tenor {tenor}</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Stage ladder - the full pipeline with the current notch highlighted. */}
        <section className="flex flex-col gap-2.5 border-t border-hairline pt-4">
          <Eyebrow>
            <SquaresFour weight="light" className="size-3.5 text-muted-foreground/70" />
            Stage ladder
          </Eyebrow>
          <StageLadder status={deal.status ?? "unknown"} />
        </section>

        {/* Linked parties - the roster with role discs. */}
        <section className="flex flex-col gap-2.5 border-t border-hairline pt-4">
          <Eyebrow>
            <Handshake weight="light" className="size-3.5 text-muted-foreground/70" />
            Linked parties
          </Eyebrow>
          {parties.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/70">
              No parties assigned to this mandate yet.
            </p>
          ) : (
            <ul role="list" className="flex flex-col gap-1.5">
              {parties.map((p) => (
                <li key={p.partyId} className="group/pp flex items-center gap-2.5">
                  <PartyRoleGlyph role={p.role} size={16} lead={!!p.isLead} />
                  <Link
                    href={`/parties/${p.partyId}`}
                    className="min-w-0 flex-1 line-clamp-2 break-words text-[12.5px] leading-[1.2] text-foreground/85 transition-colors duration-200 ease-soft hover:text-foreground"
                    title={p.legalName}
                  >
                    {p.legalName}
                  </Link>
                  <Badge variant="neutral" className="shrink-0">
                    {p.role.replace(/_/g, " ")}
                  </Badge>
                  {p.isLead ? (
                    <Star
                      weight="fill"
                      aria-label="Lead"
                      className="size-3.5 shrink-0 text-gold"
                    />
                  ) : null}
                  <CaretRight
                    weight="light"
                    aria-hidden
                    className="size-3.5 shrink-0 text-muted-foreground/40 transition-all duration-200 ease-soft group-hover/pp:text-muted-foreground"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Deal-type + credit-band readout - the instrument character. */}
        <section className="grid grid-cols-1 gap-px overflow-hidden rounded-xl ring-1 ring-hairline sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 bg-surface/90 px-3.5 py-3">
            <Eyebrow>
              <Tag weight="light" className="size-3.5 text-muted-foreground/70" />
              Deal type
            </Eyebrow>
            <span className="text-[12.5px] text-foreground/85">
              {typeLabel(deal.dealType)}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 bg-surface/90 px-3.5 py-3">
            <Eyebrow>
              {band ? (
                <span className="size-1.5 rounded-full bg-gold shadow-[0_0_6px] shadow-gold/70" />
              ) : (
                <span className="size-1.5 rounded-full bg-muted-foreground/40" />
              )}
              Credit band
            </Eyebrow>
            <span className="text-[12.5px] text-foreground/85">
              {band ? band.label : "Not applicable"}
            </span>
          </div>
        </section>

        {/* Quiet re-select hint - the pane is the detail view (no /deals/[id]). */}
        {lead ? (
          <p className="text-[11px] text-muted-foreground/60">
            Lead:{" "}
            <Link
              href={`/parties/${lead.partyId}`}
              className="text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              {lead.legalName}
            </Link>
          </p>
        ) : null}
      </div>
    </PreviewPane>
  );
}

/** Vertical stage ladder for the inspector - every pipeline stage with the
 *  completed run lit emerald, the current notch highlighted (glowing dot +
 *  emerald tint), and future stages muted. Off-pipeline deals render a
 *  distinct paused/dropped state. */
function StageLadder({ status }: { status: string }) {
  const idx = pipelineIndex(status);

  if (idx === -1) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-surface/90 px-3 py-2.5 ring-1 ring-hairline">
        <OffPipelineGlyph status={status} />
        <span className="text-[11.5px] text-muted-foreground">
          {status === "on_hold"
            ? "Paused - not on the active pipeline."
            : "Off-pipeline - no longer in flight."}
        </span>
      </div>
    );
  }

  return (
    <ol role="list" className="flex flex-col gap-1">
      {PIPELINE_ORDER.map((s, i) => {
        const reached = i < idx;
        const current = i === idx;
        const future = i > idx;
        return (
          <li
            key={s}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors duration-200 ease-soft",
              current && "bg-emerald/[0.1] ring-1 ring-emerald/25",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full transition-all duration-300 ease-soft",
                reached && "bg-emerald/70",
                current && "bg-emerald shadow-[0_0_7px] shadow-emerald/70 size-2",
                future && "bg-foreground/15",
              )}
            />
            <span
              className={cn(
                "flex-1 text-[12px] font-medium tracking-[-0.005em]",
                current
                  ? "text-foreground"
                  : reached
                    ? "text-foreground/80"
                    : "text-muted-foreground/60",
              )}
            >
              {stageLabel(s)}
            </span>
            {current ? (
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-emerald">
                Now
              </span>
            ) : future ? (
              <span className="nums tabular-nums text-[10px] text-muted-foreground/50">
                {i + 1}/{PIPELINE_ORDER.length}
              </span>
            ) : (
              <span className="nums tabular-nums text-[10px] text-muted-foreground/60">
                ✓
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ *
 * Blotter - the dense read. Grouped by stage (the swimlane toggle is a
 * board affordance), rendered visible on mount (mount-fade, not whileInView).
 * ------------------------------------------------------------------ */

function Blotter({
  deals,
  density,
  hasQuery,
  visibleFor,
  onLoadMore,
}: {
  deals: DealPipelineRow[];
  density: Density;
  hasQuery: boolean;
  visibleFor: (key: string) => number;
  onLoadMore: (key: string, ceiling: number) => void;
}) {
  // Group by stage in pipeline order + off-pipeline.
  const byStatus = new Map<string, DealPipelineRow[]>();
  for (const d of deals) {
    const k = d.status ?? "unknown";
    const arr = byStatus.get(k) ?? [];
    arr.push(d);
    byStatus.set(k, arr);
  }
  const orderedKeys = [...PIPELINE_ORDER, ...OFF_PIPELINE_KEYS].filter((s) =>
    byStatus.has(s),
  );
  const groups = orderedKeys.map((k) => ({
    status: k,
    deals: byStatus.get(k) ?? [],
  }));

  if (deals.length === 0) {
    return (
      <Card>
        <Table density={density}>
          <TableHeader>
            <TableRow>
              <TableHead>Deal</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden md:table-cell">Brand</TableHead>
              <TableHead align="right">Target</TableHead>
              <TableHead className="hidden md:table-cell">Parties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="hover:bg-transparent before:hidden">
              <TableCell colSpan={5} className="p-0">
                <TableEmpty
                  icon={<DotsThree weight="light" />}
                  title={hasQuery ? "Nothing matches that view." : "No deals yet."}
                  hint={
                    hasQuery
                      ? "Try a different deal, type, or party name, or clear the stage filter."
                      : "Mandates will appear here as they are created."
                  }
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g, idx) => (
        <motion.div
          key={g.status}
          variants={mountFade}
          initial="hidden"
          animate="show"
          transition={{ delay: Math.min(idx * 0.04, 0.2) }}
        >
          <StageBlotterGroup
            group={g}
            density={density}
            visibleCount={visibleFor(g.status)}
            onLoadMore={() => onLoadMore(g.status, g.deals.length)}
          />
        </motion.div>
      ))}
    </div>
  );
}

function StageBlotterGroup({
  group,
  density,
  visibleCount,
  onLoadMore,
}: {
  group: { status: string; deals: DealPipelineRow[] };
  density: Density;
  visibleCount: number;
  onLoadMore: () => void;
}) {
  const tone = stageTone(group.status);
  const idx = pipelineIndex(group.status);
  const sums = sumSizesByCurrency(group.deals);
  const headline = sums.find((s) => s.currency === "INR") ?? sums[0];

  // Client-side reveal cap - same VISIBLE_INCREMENT cadence as the board. The
  // query bounds the group at 40; this bounds the rendered rows so a full
  // blotter of 11 stages × 40 doesn't paint 440 rows at once.
  const visibleDeals = group.deals.slice(0, visibleCount);
  const hiddenCount = group.deals.length - visibleDeals.length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div className="flex items-center gap-3">
          <Badge variant={tone === "neutral" ? "neutral" : tone} dot={tone === "emerald"}>
            {stageLabel(group.status)}
          </Badge>
          <span className="text-[12.5px] text-muted-foreground">
            <Num value={group.deals.length} /> {group.deals.length === 1 ? "deal" : "deals"}
          </span>
          {idx !== -1 ? (
            <StageMicroIndicator index={idx} />
          ) : (
            <OffPipelineGlyph status={group.status} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Eyebrow>Stage exposure</Eyebrow>
          <span className="nums tabular-nums text-[13px] font-medium text-foreground/85">
            {headline ? headline.text : "-"}
          </span>
        </div>
      </div>

      <Table density={density}>
        <TableHeader>
          <TableRow>
            <TableHead>Deal</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead align="right">Target</TableHead>
            <TableHead>Parties</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleDeals.map((d) => (
            <BlotterRow key={d.dealId} deal={d} />
          ))}
        </TableBody>
      </Table>
      {hiddenCount > 0 ? (
        <div className="border-t border-hairline px-4 py-3">
          <button
            type="button"
            onClick={onLoadMore}
            className="group/loadmore inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors duration-200 ease-soft hover:text-emerald"
          >
            <CaretRight
              weight="light"
              className="size-3 rotate-90 text-muted-foreground/60 transition-transform duration-200 ease-soft group-hover/loadmore:translate-y-0.5"
            />
            Load more
            <span className="nums tabular-nums text-muted-foreground/70">
              +{Math.min(hiddenCount, VISIBLE_INCREMENT)}
            </span>
          </button>
        </div>
      ) : null}
    </Card>
  );
}

/**
 * BlotterRow - a single deal row in the blotter (list) view, memoized. The
 * blotter renders up to 20 rows per stage group × 11 stages; without memo each
 * row re-renders on every search keystroke / stage-filter change. The `deal`
 * identity is stable (allDeals is useMemo'd on `groups`), so shallow equality
 * skips unchanged rows.
 */
function BlotterRowImpl({ deal: d }: { deal: DealPipelineRow }) {
  const size = dealSizeText(d.targetSize, d.currencyCode);
  const band = creditBand(d.dealType);
  return (
    <TableRow>
      <TableCell primary>
        <span className="nums">{d.dealCode ?? d.dealName ?? d.dealId}</span>
        {d.dealName && d.dealCode ? (
          <span className="block text-[11.5px] font-normal text-muted-foreground">
            {d.dealName}
          </span>
        ) : null}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <DealTypeGlyph dealType={d.dealType} size={16} />
          <span className="text-[12.5px] text-foreground/80">
            {typeLabel(d.dealType)}
          </span>
          {band ? (
            <Badge
              title={band.label}
              variant={
                band.tone === "gold"
                  ? "gold"
                  : band.tone === "emerald"
                    ? "emerald"
                    : "down"
              }
            >
              {band.code}
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge variant="outline">{brandLabel(d.brand)}</Badge>
      </TableCell>
      <TableCell numeric>{size.text}</TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="flex items-center gap-1.5">
          {d.parties.length === 0 ? (
            <span className="text-[12px] text-muted-foreground/60">-</span>
          ) : (
            <>
              <div className="flex items-center">
                {d.parties.slice(0, 4).map((p, i) => (
                  <Link
                    key={p.partyId}
                    href={`/parties/${p.partyId}`}
                    title={`${p.legalName} · ${p.role.replace(/_/g, " ")}`}
                    className={cn(
                      "inline-flex items-center justify-center rounded-full ring-1 ring-surface",
                      i > 0 && "-ml-1.5",
                    )}
                  >
                    <PartyRoleGlyph role={p.role} size={16} lead={!!p.isLead} />
                  </Link>
                ))}
              </div>
              {d.parties.length > 4 ? (
                <span className="nums text-[11px] text-muted-foreground">
                  +{d.parties.length - 4}
                </span>
              ) : null}
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
const BlotterRow = React.memo(BlotterRowImpl);

/* ------------------------------------------------------------------ *
 * View toggle - board / blotter segmented control.
 * ------------------------------------------------------------------ */

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Pipeline view"
      className="inline-flex items-center rounded-full bg-foreground/[0.05] p-0.5 ring-1 ring-hairline/60"
    >
      {(
        [
          { id: "board", label: "Board", icon: SquaresFour },
          { id: "list", label: "Blotter", icon: ListIcon },
        ] as const
      ).map((opt) => {
        const active = view === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={cn(
              // h-9 on mobile for a touch-friendlier segmented toggle; md:h-7
              // restores the compact desktop control inside the command bar.
              "inline-flex h-9 md:h-7 items-center gap-1.5 rounded-full px-3 text-[11px] font-medium uppercase tracking-[0.08em] transition-all duration-200 ease-soft",
              active
                ? "bg-surface text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon weight="light" className="size-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Swimlane toggle - group the board by stage or by deal type.
 * ------------------------------------------------------------------ */

function SwimlaneToggle({
  value,
  onChange,
}: {
  value: Swimlane;
  onChange: (s: Swimlane) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Board grouping"
      className="inline-flex items-center rounded-full bg-foreground/[0.05] p-0.5 ring-1 ring-hairline/60"
    >
      {(
        [
          { id: "stage", label: "Stage", icon: SquaresFour },
          { id: "type", label: "Type", icon: Tag },
        ] as const
      ).map((opt) => {
        const active = value === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={cn(
              // h-9 on mobile for a touch-friendlier segmented toggle; md:h-7
              // restores the compact desktop control inside the command bar.
              "inline-flex h-9 md:h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] transition-all duration-200 ease-soft",
              active
                ? "bg-surface text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon weight="light" className="size-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Stage filter select - the command-bar stage focus. "All stages" shows the
 * full funnel; a specific stage narrows the board to that stage's deals.
 * ------------------------------------------------------------------ */

function StageFilterSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const options: { value: string; label: string }[] = [
    { value: "all", label: "All stages" },
    ...PIPELINE_ORDER.map((s) => ({ value: s, label: stageLabel(s) })),
    ...OFF_PIPELINE_KEYS.map((s) => ({ value: s, label: stageLabel(s) })),
  ];
  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <select
        aria-label="Filter by stage"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 appearance-none rounded-full bg-foreground/[0.04] pl-8 pr-8 text-[12.5px] text-foreground",
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
      <SquaresFour
        weight="light"
        aria-hidden
        className="pointer-events-none absolute left-3 size-3.5 text-muted-foreground"
      />
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

/* ------------------------------------------------------------------ *
 * StageFilterPills - the MOBILE touch-native stage filter.
 *
 * A horizontal-scroll strip of pills (All stages + each pipeline stage in
 * ladder order + off-pipeline tails), each carrying its live deal count in
 * Geist Mono. The active pill takes the emerald inset + dot so the focused
 * stage reads at a glance. snap-x gives a tactile stop per pill; the rail
 * hides its scrollbar for a clean filmstrip. md:hidden - desktop keeps the
 * dropdown StageFilterSelect inside the command bar. This is the conceptual
 * counterpart to the cramped board: on a phone the board is a single column
 * of stacked stage sections, and this pill row is how you focus one.
 * ------------------------------------------------------------------ */
function StageFilterPills({
  value,
  onChange,
  counts,
}: {
  value: string;
  onChange: (v: string) => void;
  counts: Map<string, number>;
}) {
  const options: { value: string; label: string }[] = [
    { value: "all", label: "All" },
    ...PIPELINE_ORDER.map((s) => ({ value: s, label: stageShort(s) })),
    ...OFF_PIPELINE_KEYS.map((s) => ({ value: s, label: stageLabel(s) })),
  ];
  return (
    <div className="-mx-4 md:hidden">
      <div className="flex snap-x snap-mandatory items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map((o) => {
          const active = value === o.value;
          const count = o.value === "all" ? null : counts.get(o.value) ?? 0;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={active}
              className={cn(
                // py-2.5 gives ~40px tap height on mobile - a touch-friendlier
                // thumb target for the stage-filter filmstrip while staying
                // single-line so the horizontal snap-x scroll still feels
                // tactile.
                "inline-flex snap-start shrink-0 items-center gap-1.5 rounded-full py-2.5 pl-3.5 pr-3 text-[12.5px] font-medium transition-all duration-300 ease-soft",
                active
                  ? "bg-emerald/[0.12] text-foreground ring-1 ring-emerald/55 shadow-[0_0_22px_-6px] shadow-emerald/60"
                  : "bg-surface/90 text-muted-foreground ring-1 ring-hairline hover:text-foreground hover:ring-hairline/70",
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-emerald shadow-[0_0_7px] shadow-emerald/70"
                />
              ) : null}
              <span className="whitespace-nowrap">{o.label}</span>
              {count !== null ? (
                <span
                  className={cn(
                    "nums tabular-nums text-[11px] leading-none",
                    active ? "text-foreground/80" : "text-muted-foreground/60",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function sumSizesByCurrency(
  deals: DealPipelineRow[],
): { currency: string | null; text: string }[] {
  const totals = new Map<string, number>();
  for (const d of deals) {
    if (!d.targetSize) continue;
    const n = Number(d.targetSize);
    if (!Number.isFinite(n)) continue;
    const key = d.currencyCode ?? "INR";
    totals.set(key, (totals.get(key) ?? 0) + n);
  }
  const out = Array.from(totals.entries()).map(([currency, n]) => ({
    currency: currency as string | null,
    text: dealSizeText(String(n as number), currency as string).text,
  }));
  out.sort((a, b) => {
    if (a.currency === "INR") return -1;
    if (b.currency === "INR") return 1;
    return (a.currency ?? "").localeCompare(b.currency ?? "");
  });
  return out;
}