"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowClockwise,
  Buildings,
  Clock,
  IdentificationCard,
  MagnifyingGlass,
  SealCheck,
  SealWarning,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  User,
  XCircle,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { KycListItem } from "@/features/compliance/queries";
import {
  Badge,
  Card,
  CommandBar,
  IconTile,
  StatCard,
  type BadgeProps,
  type Density,
} from "@/components/brand";
import { ExportCsvButton } from "@/features/reports/export-button";

/* ------------------------------------------------------------------ *
 * KycBoardView
 *
 * The KYC list REIMAGINED as a pipeline board - not a flat table.
 *
 * The server page runs `listKycRecords` (unchanged) for the whole queue and
 * hands the rows in; this client component owns:
 *   • a risk-overview band (high / medium / low / re-KYC-due as count-up
 *     StatCards),
 *   • a floating command bar (search + risk filter + density),
 *   • the board - six lifecycle columns (CDD → EDD → In review → Approved →
 *     Re-KYC due → Rejected), each a double-bezel column with a count, a risk
 *     tint, a mini risk-distribution read, and a risk-sorted stack of
 *     double-bezel entity cards,
 *   • the entity card - an IconTile avatar + risk dot + top-BO read +
 *     relative refresh-due + a mini lifecycle progress hint.
 *
 * All shaping is view-layer: bucketing (status × kycType → column), risk
 * sorting, relative dates, and risk counts are derived here. The
 * features/compliance query + actions + zod are untouched.
 *
 * MOTION: primary content renders VISIBLE on mount. Columns and cards use
 * mount-based `initial → animate` (framer-motion), NOT whileInView opacity-0
 * gating - so the board is present in headless screenshots and above-the-fold
 * on first paint. Only transform / opacity animate; the custom cubic-bezier
 * ease token is used throughout.
 * ------------------------------------------------------------------ */

export interface KycBoardViewProps {
  rows: KycListItem[];
  total: number;
  q?: string;
  risk?: string;
}

const EASE = [0.32, 0.72, 0, 1] as const;

/* ── Column taxonomy ────────────────────────────────────────────────────
 * The KYC lifecycle as a left-to-right pipeline. CDD / EDD are the two
 * intake queues (split by kyc_type on pending records; under_eds_check folds
 * into EDD - sanctions/EDS screening is part of enhanced diligence). In
 * review is the analyst desk. Approved is the win. Re-KYC due is the
 * periodic-refresh re-entry (expired records fold in - expired ≈ overdue
 * re-KYC). Rejected is the terminal decline. Every record lands in exactly
 * one column, so no row is ever hidden by the redesign.
 * ─────────────────────────────────────────────────────────────────────── */
type KycColumnId =
  | "cdd"
  | "edd"
  | "in_review"
  | "approved"
  | "rekyc_due"
  | "rejected";

type ColumnTone = "info" | "gold" | "neutral" | "emerald" | "down";

interface ColumnConfig {
  id: KycColumnId;
  label: string;
  tone: ColumnTone;
  glyph: PhosphorIcon;
  /** Lifecycle step for the per-card mini progress hint (-1 = outlier). */
  step: number;
  hint: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: "cdd",
    label: "CDD",
    tone: "info",
    glyph: IdentificationCard,
    step: 0,
    hint: "Standard due diligence",
  },
  {
    id: "edd",
    label: "EDD",
    tone: "gold",
    glyph: ShieldWarning,
    step: 1,
    hint: "Enhanced · EDS / sanctions",
  },
  {
    id: "in_review",
    label: "In review",
    tone: "neutral",
    glyph: MagnifyingGlass,
    step: 2,
    hint: "Analyst review",
  },
  {
    id: "approved",
    label: "Approved",
    tone: "emerald",
    glyph: SealCheck,
    step: 3,
    hint: "Cleared",
  },
  {
    id: "rekyc_due",
    label: "Re-KYC due",
    tone: "gold",
    glyph: ArrowClockwise,
    step: -1,
    hint: "Periodic refresh",
  },
  {
    id: "rejected",
    label: "Rejected",
    tone: "down",
    glyph: XCircle,
    step: -1,
    hint: "Declined",
  },
];

const PIPELINE_STEPS = 4; // CDD → EDD → In review → Approved

/** Map a record's (status, kycType) to exactly one board column. View-layer
 *  derivation - the query is unchanged. */
function bucketColumn(r: KycListItem): KycColumnId {
  const s = (r.status ?? "").toLowerCase();
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  if (s === "rekyc_due" || s === "expired") return "rekyc_due";
  if (s === "in_review") return "in_review";
  if (s === "under_eds_check") return "edd"; // EDS/sanctions = EDD track
  if (s === "pending") return (r.kycType ?? "").toUpperCase() === "EDD" ? "edd" : "cdd";
  // Unknown / null status - fall back on the diligence type, else CDD.
  return (r.kycType ?? "").toUpperCase() === "EDD" ? "edd" : "cdd";
}

/* ── Risk coding ──────────────────────────────────────────────────────── */
type Risk = "high" | "medium" | "low" | "unknown";

function normalizeRisk(r: string | null | undefined): Risk {
  const v = (r ?? "").toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "unknown";
}

/** Sort rank - high first (most attention), unknown last. */
const RISK_RANK: Record<Risk, number> = { high: 0, medium: 1, low: 2, unknown: 3 };

const RISK_DOT: Record<Risk, string> = {
  high: "bg-down shadow-[0_0_6px] shadow-down/55",
  medium: "bg-gold shadow-[0_0_6px] shadow-gold/55",
  low: "bg-emerald shadow-[0_0_6px] shadow-emerald/55",
  unknown: "bg-foreground/30",
};

const RISK_LABEL: Record<Risk, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  unknown: "Unrated",
};

/* ── KYC type badge ───────────────────────────────────────────────────── */
const KYC_TYPE_BADGE: Record<string, BadgeProps["variant"]> = {
  CDD: "outline",
  EDD: "gold",
  simplified: "neutral",
};

/* ── Date helpers ─────────────────────────────────────────────────────── */
function relativeDue(
  due: string | Date | null,
): { text: string; tone: "down" | "gold" | "muted" } {
  if (!due) return { text: "no schedule", tone: "muted" };
  const d = typeof due === "string" ? new Date(due) : due;
  if (!Number.isFinite(d.getTime())) return { text: "-", tone: "muted" };
  const diff = d.getTime() - Date.now();
  const absDays = Math.round(Math.abs(diff) / 86_400_000);
  const past = diff < 0;

  const unitText = (n: number, unit: string) =>
    past ? `${n}${unit} overdue` : `in ${n}${unit}`;

  if (absDays < 1) return { text: past ? "overdue today" : "due today", tone: "gold" };
  if (absDays < 31) return { text: unitText(absDays, "d"), tone: past ? "down" : "gold" };
  const months = Math.round(absDays / 30);
  if (months < 12)
    return { text: unitText(months, "mo"), tone: past ? "down" : "gold" };
  const years = Math.round(absDays / 365);
  return { text: unitText(years, "y"), tone: "muted" };
}

/* ── Column tone → classes ────────────────────────────────────────────── */
const TONE_PILL: Record<ColumnTone, string> = {
  info: "bg-info/[0.1] ring-info/35 text-info",
  gold: "bg-gold/[0.1] ring-gold/35 text-gold",
  neutral: "bg-foreground/[0.05] ring-hairline text-foreground/85",
  emerald: "bg-emerald/[0.1] ring-emerald/35 text-emerald",
  down: "bg-down/[0.1] ring-down/35 text-down",
};

const TONE_TEXT: Record<ColumnTone, string> = {
  info: "text-info",
  gold: "text-gold",
  neutral: "text-foreground/80",
  emerald: "text-emerald",
  down: "text-down",
};

/* ====================================================================== */
export function KycBoardView({ rows, total, q, risk }: KycBoardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [density, setDensity] = React.useState<Density>("comfortable");
  const [search, setSearch] = React.useState(q ?? "");

  React.useEffect(() => {
    setSearch(q ?? "");
  }, [q]);

  /* URL-driven search (shareable) - debounced. The server re-runs the query. */
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

  /* ── Risk-overview counts (view-layer derivation from the fetched rows). */
  const riskCounts = React.useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    let rekycDue = 0;
    for (const r of rows) {
      const riskNorm = normalizeRisk(r.riskRating);
      if (riskNorm === "high") high += 1;
      else if (riskNorm === "medium") medium += 1;
      else if (riskNorm === "low") low += 1;
      // Re-KYC due = status says so, OR the due date is already past.
      if (
        (r.status ?? "").toLowerCase() === "rekyc_due" ||
        (r.status ?? "").toLowerCase() === "expired" ||
        (r.rekycDueDate && new Date(r.rekycDueDate).getTime() <= Date.now())
      ) {
        rekycDue += 1;
      }
    }
    return { high, medium, low, rekycDue };
  }, [rows]);

  /* ── Bucket + risk-sort rows into columns. */
  const columns = React.useMemo(() => {
    const byCol = new Map<KycColumnId, KycListItem[]>();
    for (const c of COLUMNS) byCol.set(c.id, []);
    for (const r of rows) {
      const col = bucketColumn(r);
      byCol.get(col)!.push(r);
    }
    for (const c of COLUMNS) {
      byCol.get(c.id)!.sort((a, b) => {
        const ra = RISK_RANK[normalizeRisk(a.riskRating)];
        const rb = RISK_RANK[normalizeRisk(b.riskRating)];
        if (ra !== rb) return ra - rb;
        // Most urgent refresh-due next (NULLS LAST).
        const da = a.rekycDueDate ? new Date(a.rekycDueDate).getTime() : Infinity;
        const db = b.rekycDueDate ? new Date(b.rekycDueDate).getTime() : Infinity;
        if (da !== db) return da - db;
        return (a.partyLegalName ?? "").localeCompare(b.partyLegalName ?? "");
      });
    }
    return COLUMNS.map((c) => ({ config: c, cards: byCol.get(c.id)! }));
  }, [rows]);

  const hasFilters = Boolean(q || risk);
  const shown = rows.length;
  const truncated = total > shown;

  return (
    <div className="flex flex-col gap-5">
      {/* Risk-overview band - count-up StatCards. Mount-based fade so it is
          visible on first paint (no whileInView opacity-0 gate). */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="High risk"
          value={riskCounts.high}
          tone="down"
          icon={<ShieldWarning weight="light" />}
        />
        <StatCard
          label="Medium risk"
          value={riskCounts.medium}
          tone="gold"
          icon={<SealWarning weight="light" />}
        />
        <StatCard
          label="Low risk"
          value={riskCounts.low}
          tone="up"
          icon={<ShieldCheck weight="light" />}
        />
        <StatCard
          label="Re-KYC due"
          value={riskCounts.rekycDue}
          tone="gold"
          icon={<ArrowClockwise weight="light" />}
        />
      </motion.div>

      <CommandBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search party / contact…"
        density={density}
        onDensityChange={setDensity}
        label={`${total} ${total === 1 ? "record" : "records"}`}
        filters={
          <>
            <RiskSelectPill value={risk ?? ""} onChange={(v) => pushParam("risk", v)} />
            {hasFilters ? (
              <Link
                href="/compliance/kyc"
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-muted-foreground ring-1 ring-hairline/60 transition-all duration-200 ease-soft hover:bg-foreground/[0.04] hover:text-foreground"
              >
                <Sparkle weight="light" className="size-3.5" />
                Clear
              </Link>
            ) : null}
          </>
        }
        actions={<ExportCsvButton type="kyc" />}
      />

      {/* Board - or a full-board empty state when there is nothing to stage. */}
      {total === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <span className="text-muted-foreground/70 [&_svg]:size-8">
              <ShieldCheck weight="light" />
            </span>
            <p className="text-lg font-light tracking-[-0.01em] text-foreground/90">
              The due-diligence ledger is empty.
            </p>
            <p className="max-w-sm text-[13px] text-muted-foreground">
              KYC records are created from a party&apos;s compliance drawer, or
              seeded for demo. Files will land here staged from CDD to approval.
            </p>
          </div>
        </Card>
      ) : shown === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <span className="text-muted-foreground/70 [&_svg]:size-8">
              <MagnifyingGlass weight="light" />
            </span>
            <p className="text-lg font-light tracking-[-0.01em] text-foreground/90">
              No records match this view.
            </p>
            <p className="max-w-sm text-[13px] text-muted-foreground">
              Try clearing the risk filter or refining the search.
            </p>
          </div>
        </Card>
      ) : (
        <Board columns={columns} density={density} />
      )}

      {/* Honest ledger footer - range + truncation note when the board cap
          clips a long queue. */}
      <div className="flex flex-col gap-1 text-[12px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="nums tabular-nums text-foreground/80">
            {total === 0 ? 0 : shown}
          </span>{" "}
          of{" "}
          <span className="nums tabular-nums text-foreground/80">{total}</span>{" "}
          {total === 1 ? "record" : "records"} on the board
        </p>
        {truncated ? (
          <p className="text-muted-foreground/70">
            Showing the first{" "}
            <span className="nums tabular-nums text-foreground/70">{shown}</span>{" "}
            · refine the search to narrow the queue.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ====================================================================== *
 * Board - double-bezel columns, one per lifecycle stage.
 * ====================================================================== */
function Board({
  columns,
  density,
}: {
  columns: { config: ColumnConfig; cards: KycListItem[] }[];
  density: Density;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:overflow-x-auto md:pb-2">
      {columns.map(({ config, cards }, idx) => (
        <motion.div
          key={config.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: Math.min(idx * 0.06, 0.3),
            ease: EASE,
          }}
          className="w-full md:h-full md:w-[288px] md:shrink-0"
        >
          <StageColumn config={config} cards={cards} density={density} />
        </motion.div>
      ))}
    </div>
  );
}

function StageColumn({
  config,
  cards,
  density,
}: {
  config: ColumnConfig;
  cards: KycListItem[];
  density: Density;
}) {
  const count = cards.length;

  // Per-column risk distribution (high / medium / low) - the column's risk tint
  // made legible as a 3-segment proportional read.
  const dist = React.useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const r of cards) {
      const rn = normalizeRisk(r.riskRating);
      if (rn === "high") high += 1;
      else if (rn === "medium") medium += 1;
      else if (rn === "low") low += 1;
    }
    return { high, medium, low };
  }, [cards]);

  return (
    <Card className="h-full">
      <div className="flex h-full flex-col">
        {/* Column header - tone pill + count, risk-distribution read. */}
        <div className="flex flex-col gap-3 border-b border-hairline px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 ring-1 transition-colors duration-200 ease-soft",
                TONE_PILL[config.tone],
              )}
            >
              <Glyph icon={config.glyph} className="size-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-[0.12em]">
                {config.label}
              </span>
            </span>
            <span className="nums inline-flex items-baseline gap-1 tabular-nums">
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                {count}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {count === 1 ? "file" : "files"}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <RiskDistribution dist={dist} total={count} />
            <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
              {config.hint}
            </span>
          </div>
        </div>

        {/* Cards - capped height with an internal scroll so a tall column
         * never stretches the whole board. Empty columns get a quiet in-column
         * empty state instead of a void. */}
        <div
          className={cn(
            "flex min-h-[7rem] flex-col gap-2.5 overflow-y-auto [scrollbar-width:thin] md:max-h-[34rem]",
            density === "compact" ? "p-2.5" : "p-3",
          )}
        >
          {count === 0 ? (
            <ColumnEmpty config={config} />
          ) : (
            <div className="flex flex-col gap-2.5">
              {cards.map((r, i) => (
                <motion.div
                  key={r.kycRecordId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(i * 0.03, 0.18),
                    ease: EASE,
                  }}
                >
                  <KycCard record={r} step={config.step} density={density} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* Three-segment risk distribution - proportional to the column's makeup. The
 *  dominant risk's segment glows; empty columns show a calm hairline track. */
function RiskDistribution({
  dist,
  total,
}: {
  dist: { high: number; medium: number; low: number };
  total: number;
}) {
  if (total === 0) {
    return (
      <div className="flex h-1.5 w-24 items-center gap-1" aria-hidden>
        <span className="h-full flex-1 rounded-full bg-foreground/12" />
        <span className="h-full flex-1 rounded-full bg-foreground/12" />
        <span className="h-full flex-1 rounded-full bg-foreground/12" />
      </div>
    );
  }
  const seg = (n: number, cls: string) => {
    const flex = n === 0 ? "0 0 4px" : `${n} 1 0`;
    return (
      <span
        className={cn("h-full rounded-full transition-all duration-300 ease-soft", cls)}
        style={{ flex }}
      />
    );
  };
  return (
    <div
      className="flex h-1.5 w-24 items-center gap-1"
      aria-label={`Risk mix: ${dist.high} high, ${dist.medium} medium, ${dist.low} low`}
      role="img"
    >
      {seg(dist.high, "bg-down shadow-[0_0_6px] shadow-down/45")}
      {seg(dist.medium, "bg-gold shadow-[0_0_6px] shadow-gold/45")}
      {seg(dist.low, "bg-emerald")}
    </div>
  );
}

/** Quiet in-column empty state - a Fraunces one-liner + a thin glyph. */
function ColumnEmpty({ config }: { config: ColumnConfig }) {
  const line =
    config.id === "approved"
      ? "Nothing cleared yet."
      : config.id === "rejected"
        ? "No declines on file."
        : config.id === "rekyc_due"
          ? "No refresh due."
          : config.id === "in_review"
            ? "Review desk is clear."
            : `${config.label} intake is clear.`;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-8 text-center">
      <span className={cn("[&_svg]:size-6", TONE_TEXT[config.tone])}>
        <Glyph icon={config.glyph} />
      </span>
      <p className="text-[13.5px] font-light tracking-[-0.01em] text-foreground/70">
        {line}
      </p>
      <p className="text-[11px] text-muted-foreground/60">
        Files land here as they advance.
      </p>
    </div>
  );
}

/** Bare Phosphor Light glyph that inherits its container's text color - used
 *  inside the toned column pill + the in-column empty state, where an IconTile
 *  disc would add noise. The entity avatar on cards uses IconTile instead. */
function Glyph({
  icon: Icon,
  className,
}: {
  icon: PhosphorIcon;
  className?: string;
}) {
  return <Icon weight="light" className={cn("shrink-0", className)} />;
}

/* ====================================================================== *
 * KycCard - the double-bezel entity card. A machined, nested enclosure at
 * card scale: outer hairline shell + raised inset core. Carries the entity
 * IconTile avatar, a risk dot, the top-BO read, a relative refresh-due, and a
 * mini lifecycle progress hint. Magnetic hover (transform only); the whole
 * card links to the [id] detail.
 * ====================================================================== */
function KycCard({
  record,
  step,
  density,
}: {
  record: KycListItem;
  step: number;
  density: Density;
}) {
  const risk = normalizeRisk(record.riskRating);
  const entityIcon: PhosphorIcon = record.contactFullName ? User : Buildings;
  const due = relativeDue(record.rekycDueDate);
  const topBo = record.highestBoOwnershipPct
    ? `${Number(record.highestBoOwnershipPct).toLocaleString("en-IN", {
        maximumFractionDigits: 2,
      })}%`
    : null;

  const dueToneClass =
    due.tone === "down"
      ? "text-down"
      : due.tone === "gold"
        ? "text-gold"
        : "text-muted-foreground";

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.25, ease: EASE }}>
      <Link
        href={`/compliance/kyc/${record.kycRecordId}`}
        className={cn(
          "group/kyc relative block rounded-xl bg-foreground/[0.05] p-1 ring-1 ring-hairline/70 shadow-shell",
          "transition-[box-shadow,ring-color] duration-300 ease-soft hover:shadow-lift hover:ring-hairline",
        )}
      >
        {/* Gold left-accent that grows on hover - the row-accent cue. */}
        <span
          aria-hidden
          className="absolute left-1 top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-full bg-gold opacity-0 transition-all duration-200 ease-soft group-hover/kyc:opacity-100 group-hover/kyc:h-9 group-hover/kyc:w-[3px]"
        />
        <div
          data-slot="kyc-card-core"
          className={cn(
            "relative rounded-[calc(var(--radius-xl)-0.25rem)] bg-surface ring-1 ring-inset ring-foreground/[0.06] shadow-[var(--shadow-inset-hi)]",
            density === "compact" ? "p-3" : "p-3.5",
          )}
        >
          {/* Headline - entity IconTile + name + risk dot. */}
          <div className="flex items-start gap-2.5">
            <IconTile icon={entityIcon} size={20} tone="neutral" className="mt-0.5 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {/* Full legal name - wraps to a second line rather than clipping
                  mid-word ("Garuda Finance 113 Li…"). line-clamp-2 only fires
                  past two lines; the native `title` carries the full name for
                  the rare overflow. break-words keeps a long unbroken token
                  inside the double-bezel core. */}
              <span
                title={record.partyLegalName ?? undefined}
                className="line-clamp-2 break-words text-[13.5px] font-medium leading-[1.2] tracking-[-0.01em] text-foreground transition-colors duration-200 ease-soft group-hover/kyc:text-gold"
              >
                {record.partyLegalName}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {record.contactFullName ? (
                  record.contactFullName
                ) : (
                  <span className="nums uppercase tracking-[0.1em] text-muted-foreground/70">
                    {record.kycRecordId.slice(0, 8)}
                  </span>
                )}
              </span>
            </div>
            <span
              aria-label={`Risk: ${RISK_LABEL[risk]}`}
              title={`Risk: ${RISK_LABEL[risk]}`}
              className={cn(
                "mt-1 size-2 shrink-0 rounded-full",
                RISK_DOT[risk],
              )}
            />
          </div>

          {/* Hairline divider */}
          <div className="my-3 h-px bg-hairline/70" />

          {/* Metrics - top BO + relative refresh-due. */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                Top BO
              </span>
              {topBo ? (
                <span className="nums tabular-nums text-[13px] font-medium text-foreground/90">
                  {topBo}
                </span>
              ) : (
                <span className="text-[11.5px] text-muted-foreground/55">no BO</span>
              )}
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                <Clock weight="light" className="size-3" />
                Re-KYC
              </span>
              <span className={cn("nums tabular-nums text-[12px] font-medium", dueToneClass)}>
                {due.text}
              </span>
            </div>
          </div>

          {/* Footer - mini lifecycle progress hint + kyc type badge. */}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-hairline/60 pt-2.5">
            <MiniProgress step={step} />
            {record.kycType ? (
              <Badge
                variant={KYC_TYPE_BADGE[record.kycType] ?? "outline"}
                className="shrink-0"
              >
                {record.kycType}
              </Badge>
            ) : null}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* Mini lifecycle progress hint - a 4-step segmented bar (CDD → EDD → Review →
 *  Approved) with the current step glowing emerald. Outlier columns
 *  (rekyc_due / rejected) render a small glyph + label instead. */
function MiniProgress({ step }: { step: number }) {
  if (step === -1) {
    // Outlier - show a quiet cycle/decline mark. The column context already
    // says which; this just confirms the card is off the main pipeline.
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
        <span className="size-1.5 rounded-full bg-foreground/30" />
        off-pipeline
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: PIPELINE_STEPS }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 w-2.5 rounded-full transition-colors duration-300 ease-soft",
            i < step ? "bg-emerald/55" : "bg-foreground/15",
            i === step && "bg-emerald shadow-[0_0_6px] shadow-emerald/60",
          )}
        />
      ))}
    </div>
  );
}

/* ====================================================================== *
 * Risk filter - double-bezel-flavoured native select pill.
 * ====================================================================== */
function RiskSelectPill({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ];
  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label="Filter by risk rating"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 appearance-none rounded-full bg-foreground/[0.04] pl-3.5 pr-8 text-[12.5px] capitalize text-foreground",
          "ring-1 ring-hairline/60 transition-all duration-200 ease-soft",
          "focus:bg-foreground/[0.06] focus:ring-hairline focus:outline-none",
        )}
      >
        <option value="">All risks</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="capitalize">
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