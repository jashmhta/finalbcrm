"use client";

/**
 * MatchingWorkspace - the Investor Matching Engine's two-pane instrument.
 *
 *   lg+ ──────────────────────────────────────────────────────────────────
 *     LEFT  a searchable issuer selector - each matchable issuer is a
 *           compact row (name + rating badge + sector + primary deal). The
 *           URL (?id=) is the source of truth; selecting re-runs the server
 *           query and re-renders the matches.
 *     RIGHT the ranked investor matches as double-bezel cards: investor name +
 *           kind, a compact ScoreRing (0–100, tone by band), the seven
 *           criteria as emerald-check / muted-x indicators, ticket capacity,
 *           and the warm-intro path (who to call + last touch + strength).
 *           Filter toggles (demat-ready / KYC-current / relationship / warm)
 *           refine the ranked list client-side; sort is by score (server-ranked).
 *
 *   <lg ───────────────────────────────────────────────────────────────────
 *     Single column - issuer selector as a compact searchable list stacked
 *     above the matches. Touch-native (44px tap targets), works with the
 *     bottom liquid-glass nav.
 *
 * CRITICAL: primary content renders VISIBLE on mount - no whileInView opacity-0
 * gate on the selector / matches / summary. Motion is reserved for the
 * ScoreRing draw-in + hover micro-interactions + KPI count-ups.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Briefcase,
  Buildings,
  Check,
  Crosshair,
  Funnel,
  Handshake,
  MagnifyingGlass,
  Phone,
  Target,
  X,
} from "@/components/brand/icons";

import { cn } from "@/lib/utils";
import type {
  IssuerSummary,
  MatchResult,
  InvestorMatch,
  CriterionResult,
} from "@/features/matching/queries";
import {
  bandForScore,
  SCORE_BAND_LABEL,
  type MatchFilterKey,
  MATCH_FILTERS,
  type WarmIntroStrength,
} from "@/features/matching/engine";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ScoreRing,
  StatCard,
  compactINR,
} from "@/components/brand";
import { Eyebrow } from "@/components/brand/text";

export interface MatchingWorkspaceProps {
  issuers: IssuerSummary[];
  selectedId: string | null;
  result: MatchResult | null;
  initialQuery?: string;
}

/** Short tag for each criterion (mobile shows this; desktop shows the full label). */
const CRITERION_SHORT: Record<string, string> = {
  rating: "Rating",
  tenor: "Tenor",
  sector: "Sector",
  ticket: "Ticket",
  demat: "Demat",
  kyc: "KYC",
  relationship: "Intro",
};

const KIND_LABEL: Record<string, string> = {
  Bank: "Bank",
  Insurer: "Insurer",
  "Mutual Fund": "Mutual Fund",
  "Pension Fund": "Pension Fund",
  AIF: "AIF",
  "Family Office": "Family Office",
  HNI: "HNI",
  NBFC: "NBFC",
  Corporate: "Corporate",
  Unknown: "Investor",
};

export function MatchingWorkspace({
  issuers,
  selectedId,
  result,
  initialQuery,
}: MatchingWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [issuerQuery, setIssuerQuery] = React.useState(initialQuery ?? "");
  React.useEffect(() => {
    setIssuerQuery(initialQuery ?? "");
  }, [initialQuery]);

  const [filters, setFilters] = React.useState<Set<MatchFilterKey>>(new Set());
  const toggleFilter = React.useCallback((key: MatchFilterKey) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Selecting an issuer syncs ?id= (server re-renders the matches).
  const selectIssuer = React.useCallback(
    (id: string) => {
      const params = new URLSearchParams(sp.toString());
      params.set("id", id);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, sp],
  );

  // Client-side issuer search over the loaded list.
  const filteredIssuers = React.useMemo(() => {
    const q = issuerQuery.trim().toLowerCase();
    if (!q) return issuers;
    return issuers.filter(
      (i) =>
        i.legalName.toLowerCase().includes(q) ||
        (i.displayName ?? "").toLowerCase().includes(q) ||
        (i.sectorLabel ?? "").toLowerCase().includes(q) ||
        (i.dealCode ?? "").toLowerCase().includes(q),
    );
  }, [issuers, issuerQuery]);

  // Filtered + ranked matches (ranked server-side; filters applied client-side).
  const visibleMatches = React.useMemo(() => {
    if (!result) return [];
    if (filters.size === 0) return result.matches;
    return result.matches.filter((m) => {
      for (const key of filters) {
        if (!MATCH_FILTERS[key].test(m)) return false;
      }
      return true;
    });
  }, [result, filters]);

  const summary = React.useMemo(() => {
    if (!result) return null;
    const ms = result.matches;
    const avg =
      ms.length === 0 ? 0 : Math.round(ms.reduce((a, m) => a + m.score, 0) / ms.length);
    const strong = ms.filter((m) => m.score >= 65).length;
    const warm = ms.filter(
      (m) => (m.warmIntro?.strength ?? "none") !== "none",
    ).length;
    return { pool: result.investorPool, avg, strong, warm, total: ms.length };
  }, [result]);

  if (issuers.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Crosshair weight="light" />}
          title="No matchable issuers yet."
          hint="An issuer becomes matchable once it carries an external rating and is the issuer on at least one deal. Rate an issuer or add a bond mandate to begin matching."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {summary ? <SummaryStrip summary={summary} /> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        {/* LEFT - issuer selector */}
        <div className="lg:sticky lg:top-[88px]">
          <IssuerSelector
            issuers={filteredIssuers}
            totalIssuers={issuers.length}
            selectedId={selectedId}
            query={issuerQuery}
            onQueryChange={setIssuerQuery}
            onSelect={selectIssuer}
          />
        </div>

        {/* RIGHT - ranked matches */}
        <div className="flex min-w-0 flex-col gap-4">
          <FilterBar
            filters={filters}
            onToggle={toggleFilter}
            count={visibleMatches.length}
            total={result?.matches.length ?? 0}
            issuerName={result?.issuer.legalName ?? null}
          />
          {visibleMatches.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Funnel weight="light" />}
                title="No investors match these filters."
                hint="Try clearing a filter, or open the full match matrix for this issuer to see every investor ranked by fit."
                action={
                  result ? (
                    <Button asChild variant="secondary-hairline" size="sm" trailingIcon={<ArrowUpRight weight="light" className="size-4" />}>
                      <Link href={`/matching/${result.issuer.partyId}`}>Open full matrix</Link>
                    </Button>
                  ) : null
                }
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-3.5">
              {visibleMatches.slice(0, 24).map((m, i) => (
                <MatchCard key={m.investor.partyId} match={m} rank={i + 1} issuerId={result?.issuer.partyId ?? null} />
              ))}
              {visibleMatches.length > 24 ? (
                <div className="flex justify-center py-2">
                  <Button asChild variant="secondary-hairline" size="sm" trailingIcon={<ArrowUpRight weight="light" className="size-4" />}>
                    <Link href={`/matching/${result?.issuer.partyId ?? ""}`}>
                      View all {visibleMatches.length} in the matrix
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Summary strip - KPIs with count-ups (visible on mount).
   ────────────────────────────────────────────────────────────────────────── */

function SummaryStrip({
  summary,
}: {
  summary: { pool: number; avg: number; strong: number; warm: number; total: number };
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard label="Investor pool" value={summary.pool} icon={<Buildings weight="light" />} />
      <StatCard
        label="Avg match score"
        value={summary.avg}
        suffix="/100"
        tone={summary.avg >= 65 ? "up" : summary.avg >= 40 ? "gold" : "default"}
        icon={<Crosshair weight="light" />}
      />
      <StatCard
        label="Strong fits"
        value={summary.strong}
        icon={<Target weight="light" />}
        tone={summary.strong > 0 ? "up" : "default"}
      />
      <StatCard
        label="Warm intros"
        value={summary.warm}
        icon={<Handshake weight="light" />}
        tone={summary.warm > 0 ? "gold" : "default"}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Issuer selector - searchable list of matchable issuers.
   ────────────────────────────────────────────────────────────────────────── */

function IssuerSelector({
  issuers,
  totalIssuers,
  selectedId,
  query,
  onQueryChange,
  onSelect,
}: {
  issuers: IssuerSummary[];
  totalIssuers: number;
  selectedId: string | null;
  query: string;
  onQueryChange: (v: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow dot>Select an issuer</Eyebrow>
          <span className="nums tabular-nums text-[10.5px] text-muted-foreground/60">
            {issuers.length}/{totalIssuers}
          </span>
        </div>
        <div className="relative">
          <MagnifyingGlass
            weight="light"
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search issuer, sector, deal…"
            aria-label="Search issuers"
            className={cn(
              "h-11 w-full rounded-xl bg-foreground/[0.04] pl-9 pr-3 text-[13px] text-foreground",
              "ring-1 ring-hairline/60 transition-all duration-200 ease-soft",
              "placeholder:text-muted-foreground/50 focus:bg-foreground/[0.06] focus:ring-hairline focus:outline-none",
            )}
          />
        </div>
      </div>
      <div className="max-h-[min(62vh,640px)] overflow-y-auto border-t border-hairline">
        {issuers.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12.5px] text-muted-foreground/70">
            No issuers match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <ul role="list" className="flex flex-col">
            {issuers.map((iss) => (
              <IssuerRow
                key={iss.partyId}
                issuer={iss}
                selected={iss.partyId === selectedId}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function IssuerRow({
  issuer,
  selected,
  onSelect,
}: {
  issuer: IssuerSummary;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <li className="relative isolate border-b border-row-hairline last:border-0">
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-emerald transition-all duration-200 ease-soft",
          selected ? "h-10 w-[3px] opacity-100 shadow-[0_0_10px] shadow-emerald/60" : "w-[2px] opacity-0 hover:opacity-100",
        )}
      />
      {selected ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(120% 100% at 12% 50%, color-mix(in oklch, var(--emerald) 12%, transparent), transparent 70%)",
          }}
        />
      ) : null}
      <button
        type="button"
        onClick={() => onSelect(issuer.partyId)}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "group/row flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors duration-200 ease-soft",
          selected ? "bg-emerald/[0.10]" : "hover:bg-row-hover",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3
            title={issuer.legalName}
            className="line-clamp-2 break-words text-[13.5px] font-medium leading-[1.25] tracking-[-0.01em] text-foreground/90 group-hover/row:text-foreground"
          >
            {issuer.legalName}
          </h3>
          {issuer.ratingValue ? (
            <Badge variant="gold" className="shrink-0">
              {issuer.ratingValue}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground/80">
          <span className="inline-flex items-center gap-1 shrink-0">
            <Buildings weight="light" className="size-3 text-muted-foreground/60" />
            {issuer.sectorLabel ?? issuer.sectorCode ?? "-"}
          </span>
          {issuer.tenorYears != null ? (
            <span className="nums shrink-0">{issuer.tenorYears.toFixed(1)}y</span>
          ) : null}
          {issuer.targetSizeCrores != null ? (
            <span className="nums shrink-0">{compactINR(issuer.targetSizeCrores * 1e7)}</span>
          ) : null}
        </div>
        {issuer.dealCode ? (
          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground/60">
            <Briefcase weight="light" className="size-3" />
            <span className="nums truncate">{issuer.dealCode}</span>
            <span className="truncate">· {issuer.dealType?.replace(/_/g, " ")}</span>
          </div>
        ) : null}
      </button>
    </li>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Filter bar - toggle filters + the active-issuer context.
   ────────────────────────────────────────────────────────────────────────── */

function FilterBar({
  filters,
  onToggle,
  count,
  total,
  issuerName,
}: {
  filters: Set<MatchFilterKey>;
  onToggle: (k: MatchFilterKey) => void;
  count: number;
  total: number;
  issuerName: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-foreground/[0.025] p-3 ring-1 ring-hairline/60 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        {(Object.keys(MATCH_FILTERS) as MatchFilterKey[]).map((key) => {
          const active = filters.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              aria-pressed={active}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-all duration-200 ease-soft",
                active
                  ? "bg-gold/15 text-gold-deep ring-1 ring-gold/30"
                  : "text-muted-foreground ring-1 ring-hairline/60 hover:bg-foreground/[0.04] hover:text-foreground",
              )}
            >
              {MATCH_FILTERS[key].label}
              {active ? <Check weight="light" className="size-3.5" /> : null}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground sm:shrink-0">
        <span className="nums tabular-nums">
          <span className="text-foreground/80">{count}</span>/{total}
        </span>
        <span className="hidden sm:inline">matched</span>
        {issuerName ? (
          <span className="hidden max-w-[180px] truncate text-muted-foreground/70 lg:inline" title={issuerName}>
            · {issuerName}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Match card - the ranked investor.
   ────────────────────────────────────────────────────────────────────────── */

function MatchCard({
  match,
  rank,
  issuerId,
}: {
  match: InvestorMatch;
  rank: number;
  issuerId: string | null;
}) {
  const { investor, criteria, score, warmIntro } = match;
  const band = bandForScore(score);
  const warmStrength: WarmIntroStrength = warmIntro?.strength ?? "none";

  return (
    <Card interactive>
      <div className="flex flex-col gap-4 p-4 md:p-5">
        {/* Header: rank + identity + score ring */}
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="nums tabular-nums text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
              #{rank}
            </span>
            <ScoreRing
              value={score}
              min={0}
              max={100}
              size={68}
              thickness={6}
              band={{ label: SCORE_BAND_LABEL[band].split(" ")[0]!, tone: score >= 65 ? "emerald" : score >= 40 ? "gold" : "down" }}
              label="Match"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                title={investor.legalName}
                className="line-clamp-2 break-words text-[15px] font-semibold leading-[1.2] tracking-[-0.01em] text-foreground"
              >
                {investor.legalName}
              </h3>
              <Badge variant="neutral" className="shrink-0">
                {KIND_LABEL[investor.kind] ?? "Investor"}
              </Badge>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground/80">
              {investor.preferenceSource === "history"
                ? `Floor ≥ ${investor.minRatingValue} · ${investor.tenorMin.toFixed(0)}–${investor.tenorMax.toFixed(0)}y · ${investor.mandateSectors.length} sector${investor.mandateSectors.length === 1 ? "" : "s"} · ~${compactINR(investor.typicalTicketCrores * 1e7)} ticket`
                : `Floor ≥ ${investor.minRatingValue} · ${investor.tenorMin.toFixed(0)}–${investor.tenorMax.toFixed(0)}y · open mandate · ~${compactINR(investor.typicalTicketCrores * 1e7)} ticket`}
            </p>
          </div>
        </div>

        {/* Criteria indicators - 7 chips */}
        <CriteriaIndicators criteria={criteria} />

        {/* Footer: warm intro + open matrix */}
        <div className="flex flex-col gap-3 border-t border-hairline pt-3.5 sm:flex-row sm:items-center sm:justify-between">
          <WarmIntroBadge strength={warmStrength} warmIntro={warmIntro} />
          {issuerId ? (
            <Button asChild variant="secondary-hairline" size="sm" trailingIcon={<ArrowUpRight weight="light" className="size-4" />}>
              <Link href={`/matching/${issuerId}`}>Open matrix</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Criteria indicators - 7 emerald-check / muted-x chips with detail tooltips.
   ────────────────────────────────────────────────────────────────────────── */

function CriteriaIndicators({ criteria }: { criteria: CriterionResult[] }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
      {criteria.map((c) => (
        <CriterionChip key={c.key} criterion={c} />
      ))}
    </div>
  );
}

function CriterionChip({ criterion }: { criterion: CriterionResult }) {
  const { matched, label, detail, key, issuerValue, investorValue } = criterion;
  const title = `${label}: ${detail} (issuer ${issuerValue} · investor ${investorValue})`;
  const short = CRITERION_SHORT[key] ?? label.split(" ")[0] ?? label;
  return (
    <div
      role="img"
      aria-label={`${label}: ${matched ? "match" : "no match"}`}
      title={title}
      className={cn(
        "group/crit flex items-center gap-1.5 rounded-lg px-2 py-1.5 ring-1 transition-colors duration-200 ease-soft",
        matched
          ? "bg-emerald/[0.07] ring-emerald/22 text-emerald-deep"
          : "bg-foreground/[0.02] ring-hairline/50 text-muted-foreground/70",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-full",
          matched ? "bg-emerald/20 text-emerald" : "bg-foreground/[0.05] text-muted-foreground/60",
        )}
      >
        {matched ? <Check weight="bold" className="size-2.5" /> : <X weight="bold" className="size-2.5" />}
      </span>
      <span className="truncate text-[10.5px] font-medium uppercase tracking-[0.08em]">
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{short}</span>
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Warm intro badge - who to call + last touch + strength.
   ────────────────────────────────────────────────────────────────────────── */

const STRENGTH_META: Record<
  WarmIntroStrength,
  { label: string; variant: "emerald" | "gold" | "neutral" | "outline"; icon: React.ReactNode }
> = {
  strong: { label: "Strong intro", variant: "emerald", icon: <Handshake weight="light" /> },
  warm: { label: "Warm intro", variant: "gold", icon: <Handshake weight="light" /> },
  cold: { label: "Cold intro", variant: "neutral", icon: <Phone weight="light" /> },
  none: { label: "No intro", variant: "outline", icon: <Phone weight="light" /> },
};

function WarmIntroBadge({
  strength,
  warmIntro,
}: {
  strength: WarmIntroStrength;
  warmIntro: InvestorMatch["warmIntro"];
}) {
  const meta = STRENGTH_META[strength];
  if (strength === "none" || !warmIntro) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={meta.variant} icon={meta.icon}>
          {meta.label}
        </Badge>
        <span className="text-[11.5px] text-muted-foreground/70">No prior interaction on file</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={meta.variant} icon={meta.icon}>
        {meta.label}
      </Badge>
      <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground/85">
        <span className="font-medium">{warmIntro.bankerName}</span>
        {warmIntro.bankerDesk ? (
          <span className="text-muted-foreground/60">· {warmIntro.bankerDesk.replace(/_/g, " ")}</span>
        ) : null}
      </span>
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70">
        <span className="nums">{warmIntro.interactionCount} touch{warmIntro.interactionCount === 1 ? "" : "es"}</span>
        {warmIntro.lastTouchAt ? <span>· {formatRelative(warmIntro.lastTouchAt)}</span> : null}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   formatRelative - "3d ago" / "2w ago" / "12 Mar" (display-only).
   ────────────────────────────────────────────────────────────────────────── */

function formatRelative(iso: string | Date | null): string {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "-";
  const diff = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return "today";
  const days = Math.floor(diff / day);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}