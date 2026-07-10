"use client";

/**
 * PartiesExplorer - the Relationship Explorer.
 *
 * NOT a table. The parties master ledger reimagined as a two-pane explorer:
 *
 *   lg+ ──────────────────────────────────────────────────────────────────
 *     LEFT  a rich list of machined rows - each party is an object with an
 *           identity disc (PartyAvatar, the bespoke mark for its primary role),
 *           its legal name, a primary-type chip, a KYC status dot, a
 *           relationship-STRENGTH meter (5-segment, derived from relationship /
 *           mandate / contact counts + KYC), and a relative last-touch time.
 *           Selecting a row syncs `?id=` so the URL is the source of truth.
 *     RIGHT a sticky PreviewPane (brand/preview-pane) framing the selected
 *           party: a mini RelationshipGraph (parents / beneficial owners /
 *           subsidiaries as a node-link), recent mandates, exposure, and a KYC
 *           snapshot - the inspector for the currently-selected entity.
 *
 *   <lg ───────────────────────────────────────────────────────────────────
 *     Single-column rich list. Tapping a row navigates to the detail page
 *     (no preview pane on phones - the detail page carries the graph).
 *
 * Search stays URL-driven (shareable ?q=); type + risk filters are client-side
 * refinements over the current page (the underlying query exposes free-text q).
 * Strength + last-touch are display-only derivations from the signals the query
 * now returns (relationshipCount / dealCount / contactCount / lastTouchAt).
 *
 * CRITICAL: primary content renders VISIBLE on mount - no whileInView opacity-0
 * gate on the list / preview / summary. Motion is reserved for hover
 * micro-interactions + the KPI count-ups (which fire on mount, element visible).
 */
import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CaretRight,
  Clock,
  Graph,
  MapPin,
  SealCheck,
  ShieldCheck,
  Sparkle,
  Star,
} from "@/components/brand/icons";
// SquaresFour + UserCirclePlus aren't re-exported by the client boundary; this
// is a client component, so importing them directly from phosphor is safe (the
// boundary only matters for server components - see brand/icons.tsx).
import { SquaresFour, UserCirclePlus } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type {
  PartyListItem,
  PartyListFilters,
  PartyListSummary,
  PartyPreview,
} from "@/features/parties/queries";
import {
  INDUSTRY_SECTOR_LABELS,
  INDUSTRY_SECTORS,
  INVESTOR_TYPE_LABELS,
  INVESTOR_TYPES,
  PORTFOLIO_SIZE_BANDS,
  PORTFOLIO_SIZE_LABELS,
  RATING_AGENCIES,
  RATING_AGENCY_LABELS,
  RATING_VALUES,
  RISK_APPETITES,
  RISK_APPETITE_LABELS,
  TURNOVER_BAND_LABELS,
  TURNOVER_BANDS,
} from "@/features/parties/segmentation";
import {
  Badge,
  Button,
  Card,
  CommandBar,
  EmptyState,
  Num,
  PreviewPane,
  StatCard,
  compactINR,
} from "@/components/brand";
import { Eyebrow } from "@/components/brand/text";
import { ExportCsvButton } from "@/features/reports/export-button";
import { NewPartyDialog } from "./new-party-dialog";
import { PartyAvatar } from "./party-icon";
import { RelationshipGraph } from "./relationship-graph";
import { StrengthBar, deriveStrength, formatRelative } from "./party-signals";

export interface PartiesExplorerProps {
  rows: PartyListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
  filters: PartyListFilters;
  summary: PartyListSummary;
  /** Currently-selected party id (from ?id=, defaulted to the first row by the
   *  server page). Drives the selected row highlight + the preview content. */
  selectedId: string | null;
  /** Preview data for the selected party, or null when the selection couldn't
   *  be resolved (deleted mid-session / empty ledger). */
  preview: PartyPreview | null;
}

const TYPE_FILTERS = [
  "issuer",
  "investor",
  "intermediary",
  "arranger",
  "underwriter",
  "broker",
  "ifa",
  "rating_agency",
  "trustee",
  "registrar",
  "legal_counsel",
  "auditor",
  "guarantor",
  "credit_enhancement_provider",
  "spv",
  "prospect",
] as const;

const RISK_FILTERS = ["low", "medium", "high"] as const;

const NATURE_LABEL: Record<string, string> = {
  organization: "Organization",
  natural_person: "Natural person",
  spv: "Special Purpose Vehicle",
  trust: "Trust",
  government: "Government",
  regulator: "Regulator",
};

export function PartiesExplorer({
  rows,
  total,
  page,
  pageSize,
  totalPages,
  q,
  filters,
  summary,
  selectedId,
  preview,
}: PartiesExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [search, setSearch] = React.useState(q ?? "");
  // Keep the input in sync if the URL changes elsewhere (back/forward).
  React.useEffect(() => {
    setSearch(q ?? "");
  }, [q]);

  // Debounced search → URL (?q=). Preserves the shareable GET semantics while
  // giving the command bar a live-feel input. Drops ?id= on a new search so a
  // stale selection doesn't persist off-page.
  const pushSearch = React.useCallback(
    (value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      params.delete("page");
      params.delete("id");
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
      debounceRef.current = setTimeout(() => pushSearch(value), 280);
    },
    [pushSearch],
  );
  React.useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const setFilter = React.useCallback(
    (key: keyof PartyListFilters, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
      params.delete("page");
      params.delete("id");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, sp],
  );

  const rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, total);

  // Selection → ?id= (URL is the source of truth; the server re-runs the
  // preview query and re-renders both panes together).
  const selectParty = React.useCallback(
    (id: string) => {
      const params = new URLSearchParams(sp.toString());
      params.set("id", id);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, sp],
  );

  const advancedActive = Boolean(
    filters.agency ||
      filters.investorType ||
      filters.portfolioSize ||
      filters.riskAppetite ||
      filters.highYield !== undefined,
  );
  const [showAdvanced, setShowAdvanced] = React.useState(advancedActive);

  return (
    <div className="flex flex-col gap-5">
      <SummaryStrip summary={summary} />

      <CommandBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search by name…"
        label={`${total} ${total === 1 ? "party" : "parties"}`}
        filters={
          <>
            <TypeFilterSelect value={filters.type ?? "all"} onChange={(v) => setFilter("type", v)} />
            <RiskFilterSelect value={filters.risk ?? "all"} onChange={(v) => setFilter("risk", v)} />
            <TurnoverFilterSelect value={filters.turnover ?? "all"} onChange={(v) => setFilter("turnover", v)} />
            <SectorFilterSelect value={filters.sector ?? "all"} onChange={(v) => setFilter("sector", v)} />
            <RatingFilterSelect value={filters.rating ?? "all"} onChange={(v) => setFilter("rating", v)} />
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex h-8 items-center rounded-md px-2.5 text-[12px] font-medium text-muted-foreground ring-1 ring-hairline hover:bg-surface-2 hover:text-foreground"
              aria-expanded={showAdvanced}
            >
              {showAdvanced ? "Fewer filters" : "More filters"}
              {advancedActive && !showAdvanced ? (
                <span className="ml-1.5 size-1.5 rounded-full bg-gold" />
              ) : null}
            </button>
            {showAdvanced ? (
              <>
                <AgencyFilterSelect value={filters.agency ?? "all"} onChange={(v) => setFilter("agency", v)} />
                <InvestorTypeFilterSelect value={filters.investorType ?? "all"} onChange={(v) => setFilter("investorType", v)} />
                <PortfolioSizeFilterSelect value={filters.portfolioSize ?? "all"} onChange={(v) => setFilter("portfolioSize", v)} />
                <RiskAppetiteFilterSelect value={filters.riskAppetite ?? "all"} onChange={(v) => setFilter("riskAppetite", v)} />
                <HighYieldFilterSelect value={filters.highYield === undefined ? "all" : String(filters.highYield)} onChange={(v) => setFilter("highYield", v)} />
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <ExportCsvButton type="parties" />
            <NewPartyDialog />
          </>
        }
        sticky
      />

      {total === 0 ? (
        <Card>
          <EmptyState
            icon={<Sparkle weight="light" />}
            title="A clean ledger awaits."
            hint="Create your first party master record to begin building the relationship graph."
            action={<NewPartyDialog />}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:items-start">
          {/* LEFT - rich list */}
          <div className="flex flex-col gap-4">
            <PartyList
              rows={rows}
              total={total}
              selectedId={selectedId}
              onSelect={selectParty}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12.5px] text-muted-foreground">
                {rows.length === 0 ? (
                  "No parties match this view."
                ) : (
                  <>
                    <span className="nums tabular-nums text-foreground/80">
                      {rangeFrom.toLocaleString("en-IN")}–
                      {rangeTo.toLocaleString("en-IN")}
                    </span>{" "}
                    of{" "}
                    <span className="nums tabular-nums text-foreground/80">
                      {total.toLocaleString("en-IN")}
                    </span>{" "}
                    parties
                  </>
                )}
              </p>
              {totalPages > 1 ? (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  q={q}
                  filters={filters}
                />
              ) : null}
            </div>
          </div>

          {/* RIGHT - sticky preview (lg+ only; mobile uses the detail page) */}
          <PartyPreviewPane
            preview={preview}
            className="hidden lg:block"
          />
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Summary strip - unfiltered ledger KPIs with count-ups (visible on mount).
   ────────────────────────────────────────────────────────────────────────── */

function SummaryStrip({ summary }: { summary: PartyListSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        label="Parties"
        value={summary.total}
        icon={<SquaresFour weight="light" />}
      />
      <StatCard
        label="Active"
        value={summary.active}
        icon={<SealCheck weight="light" />}
        tone={summary.active > 0 ? "up" : "default"}
      />
      <StatCard
        label="KYC complete"
        value={summary.kycComplete}
        icon={<ShieldCheck weight="light" />}
        tone={summary.kycComplete > 0 ? "up" : "default"}
      />
      <StatCard
        label="Onboarding"
        value={summary.onboarding}
        icon={<UserCirclePlus weight="light" />}
        tone={summary.onboarding > 0 ? "gold" : "default"}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Party list - machined rich rows inside a double-bezel Card. Each row is an
   object (identity disc + FULL legal name + strength meter + last-touch), not
   a table cell. RHYTHM: rows are grouped under first-letter band headers (the
   list is alphabetized server-side, so the letter groups form naturally) -
   each band gives the eye a beat to rest on and breaks the flat wall of equal
   rows. Names are NEVER truncated mid-word: the legal name wraps onto a second
   line if needed (the row breathes), and only a true 2-line overflow trips a
   line-clamp with the native `title` tooltip carrying the full name.

   Selected row → gold ambient halo + stronger gold tint + a full gold
   left-accent. Desktop click selects (?id=); mobile tap navigates to detail.
   ────────────────────────────────────────────────────────────────────────── */

/** Bucket `rows` into first-letter groups (the list is ordered by legalName
 *  asc, so groups emerge in alphabetical order). Non-letter leads fall under
 *  "#". Used to render the band headers that give the rich list its rhythm. */
function groupByLetter(rows: PartyListItem[]): { letter: string; rows: PartyListItem[] }[] {
  const groups: { letter: string; rows: PartyListItem[] }[] = [];
  const index = new Map<string, number>();
  for (const r of rows) {
    const ch = (r.legalName.trim()[0] ?? "?").toUpperCase();
    const letter = /[A-Z]/.test(ch) ? ch : "#";
    const i = index.get(letter);
    if (i === undefined) {
      index.set(letter, groups.length);
      groups.push({ letter, rows: [r] });
    } else {
      groups[i].rows.push(r);
    }
  }
  return groups;
}

function PartyList({
  rows,
  total,
  selectedId,
  onSelect,
}: {
  rows: PartyListItem[];
  total: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const isDesktop = useMinWidth(1024);

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Graph weight="light" />}
          title={total === 0 ? "A clean ledger awaits." : "No parties match this view."}
          hint={
            total === 0
              ? "Create your first party master record to begin building the relationship graph."
              : "Try clearing the type or risk filter, or refining the search."
          }
        />
      </Card>
    );
  }

  const groups = groupByLetter(rows);

  return (
    <Card>
      <ul role="list" className="flex flex-col">
        {groups.map((g, gi) => (
          <li key={g.letter} role="listitem" className="flex flex-col">
            <LetterBand letter={g.letter} count={g.rows.length} first={gi === 0} />
            <ul role="list" className="flex flex-col">
              {g.rows.map((r) => (
                <PartyRow
                  key={r.partyId}
                  r={r}
                  selected={r.partyId === selectedId}
                  isDesktop={isDesktop}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** First-letter band header - the rhythm beat. A Fraunces capital + a mono
 *  count, sitting on a hairline divider, with a quiet neutral dot so the band
 *  reads as a machined tab rather than a plain label. `first` drops the top
 *  divider so the first band doesn't double up against the Card's inner edge. */
function LetterBand({
  letter,
  count,
  first,
}: {
  letter: string;
  count: number;
  first: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-4 md:px-5",
        first ? "pt-3.5 pb-2" : "border-t border-row-hairline pt-4 pb-2",
      )}
    >
      <span aria-hidden className="size-1 rounded-full bg-foreground/30" />
      <span className="text-[13px] font-light leading-none tracking-[0.04em] text-foreground/75">
        {letter}
      </span>
      <span className="nums tabular-nums text-[10.5px] text-muted-foreground/60">
        {count}
      </span>
      <span aria-hidden className="ml-1 h-px flex-1 bg-hairline/70" />
    </div>
  );
}

function PartyRow({
  r,
  selected,
  isDesktop,
  onSelect,
}: {
  r: PartyListItem;
  selected: boolean;
  isDesktop: boolean;
  onSelect: (id: string) => void;
}) {
  const detailHref = `/parties/${r.partyId}`;
  const strength = deriveStrength(r);
  return (
    <li className="relative isolate border-b border-row-hairline last:border-0">
      {/* Gold left-accent - grows on hover, full + lit on the selected row.
          Matches the brand Table's gold selection language so the rich list and
          the data table share one accent system; emerald stays semantic-only. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-gold transition-all duration-200 ease-soft",
          selected
            ? "h-12 w-[3px] opacity-100 shadow-[0_0_10px] shadow-gold/60"
            : "h-8 w-[2px] opacity-0 hover:opacity-100",
        )}
      />
      {/* Gold ambient halo - only on the selected row. A soft radial tint that
          reads as a lit, machined selection (not a flat fill). Sits behind
          content (-z-10) so text + badges keep their contrast. */}
      {selected ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(120% 100% at 12% 50%, color-mix(in oklch, var(--gold) 14%, transparent), transparent 70%)",
          }}
        />
      ) : null}
      <Link
        href={detailHref}
        onClick={(e) => {
          // On desktop, selecting a row syncs the preview pane via ?id=
          // instead of navigating. On mobile, fall through to the Link
          // (tap → detail page, where the graph lives).
          if (isDesktop) {
            e.preventDefault();
            onSelect(r.partyId);
          }
        }}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "group/row flex items-center gap-3 px-4 py-4 transition-colors duration-200 ease-soft md:px-5 md:py-[18px]",
          selected
            ? "bg-gold/[0.10]"
            : "hover:bg-row-hover",
        )}
      >
        <PartyAvatar primaryType={r.types[0]} size={24} />

        <div className="min-w-0 flex-1">
          {/* Full legal name - wraps to a second line rather than truncating
              mid-word. line-clamp-2 only fires past two lines, and the native
              `title` carries the full name for the rare overflow. */}
          <h3
            title={r.legalName}
            className={cn(
              "line-clamp-2 break-words text-[14.5px] font-medium leading-[1.25] tracking-[-0.01em] transition-colors duration-200 ease-soft",
              selected
                ? "text-foreground"
                : "text-foreground/90 group-hover/row:text-foreground",
            )}
          >
            {r.legalName}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground/80">
            {r.types[0] ? (
              <Badge variant="outline" className="shrink-0">
                {r.types[0].replace(/_/g, " ")}
              </Badge>
            ) : null}
            {r.types.length > 1 ? (
              <span className="nums shrink-0 text-[10.5px] text-muted-foreground/60">
                +{r.types.length - 1}
              </span>
            ) : null}
            <span className="min-w-0 truncate">
              {r.displayName ? (
                r.displayName
              ) : (
                <span className="nums uppercase tracking-[0.1em]">
                  {r.partyId.slice(0, 8)}
                </span>
              )}
            </span>
            {r.city ? (
              <span className="inline-flex shrink-0 items-center gap-1">
                <MapPin weight="light" className="size-3 text-muted-foreground/60" />
                {r.city}
              </span>
            ) : null}
          </div>
        </div>

        {/* Right zone - strength meter, KYC dot, last-touch, chevron. */}
        <div className="flex items-center gap-3 shrink-0">
          <StrengthBar strength={strength} className="hidden md:flex" />
          <KycDot complete={!!r.isKycComplete} />
          <span className="nums hidden w-[58px] shrink-0 text-right text-[11px] text-muted-foreground/70 md:inline">
            {formatRelative(r.lastTouchAt)}
          </span>
          <CaretRight
            weight="light"
            aria-hidden
          className={cn(
            "size-4 shrink-0 transition-all duration-200 ease-soft",
            selected
              ? "text-gold"
              : "text-muted-foreground/40 group-hover/row:text-muted-foreground",
          )}
          />
        </div>
      </Link>
    </li>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Preview pane - the inspector for the selected party. A brand/PreviewPane
   framing the identity (mark + Fraunces name + status/KYC badges) with a body
   that holds the mini RelationshipGraph, recent mandates, exposure, and a KYC
   snapshot. Renders visible on mount.
   ────────────────────────────────────────────────────────────────────────── */

function PartyPreviewPane({
  preview,
  className,
}: {
  preview: PartyPreview | null;
  className?: string;
}) {
  if (!preview) {
    return (
      <PreviewPane
        type="Relationship explorer"
        name="Select a party"
        className={className}
        mark={<PartyAvatar size={24} />}
      >
        <EmptyState
          icon={<Graph weight="light" />}
          title="Party not available."
          hint="This party may have been removed. Choose another from the list to inspect its ownership graph, mandates and exposure."
          className="py-10"
        />
      </PreviewPane>
    );
  }

  const primaryType = preview.types[0];
  const groupExposure = preview.groupExposureInr
    ? Number(preview.groupExposureInr)
    : null;
  const recentDeals = preview.deals.slice(0, 4);
  const kycComplete = preview.isKycComplete === true;
  const kycStale = preview.isKycStale === true;

  return (
    <PreviewPane
      type={
        primaryType
          ? primaryType.replace(/_/g, " ")
          : (NATURE_LABEL[preview.partyNature] ?? preview.partyNature.replace(/_/g, " "))
      }
      name={preview.legalName}
      mark={<PartyAvatar primaryType={primaryType} size={24} />}
      badges={
        <>
          <Badge
            variant={preview.status.toLowerCase() === "active" ? "emerald" : "neutral"}
            dot={preview.status.toLowerCase() === "active"}
          >
            {preview.status.replace(/_/g, " ")}
          </Badge>
          {kycComplete ? (
            <Badge variant="emerald" icon={<ShieldCheck weight="light" />}>
              KYC
            </Badge>
          ) : (
            <Badge variant="outline" icon={<Clock weight="light" />}>
              KYC pending
            </Badge>
          )}
        </>
      }
      actions={
        <Button
          asChild
          variant="ghost"
          size="sm"
          trailingIcon={<ArrowUpRight weight="light" className="size-4" />}
        >
          <Link href={`/parties/${preview.partyId}`}>Open full record</Link>
        </Button>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Graph weight="light" className="size-3.5 text-muted-foreground/70" />
            <Num value={preview.counts.relationships} /> relationships
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Briefcase weight="light" className="size-3.5 text-muted-foreground/70" />
            <Num value={preview.counts.deals} /> mandates
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <Clock weight="light" className="size-3.5 text-muted-foreground/70" />
            touched {formatRelative(preview.lastTouchAt)}
          </span>
        </div>
      }
      className={className}
    >
      <div className="flex flex-col gap-5">
        {/* Mini relationship graph - the conceptual centerpiece. */}
        <RelationshipGraph
          partyId={preview.partyId}
          legalName={preview.legalName}
          centerSub={
            primaryType
              ? primaryType.replace(/_/g, " ")
              : (NATURE_LABEL[preview.partyNature] ?? preview.partyNature.replace(/_/g, " "))
          }
          centerMark={<PartyAvatar primaryType={primaryType} size={16} />}
          relationships={preview.relationships}
          variant="mini"
        />

        {/* Recent mandates - one clean line each: code (truncates safely) +
            role badge + lead star. `min-w-0 flex-1` on the code lets it yield to
            the badge + star in the narrow pane instead of pushing them out. */}
        <section className="flex flex-col gap-2.5 border-t border-hairline pt-4">
          <Eyebrow>
            <Briefcase weight="light" className="size-3.5 text-muted-foreground/70" />
            Recent mandates
          </Eyebrow>
          {recentDeals.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/70">
              Not named on any deals yet.
            </p>
          ) : (
            <ul role="list" className="flex flex-col gap-2">
              {recentDeals.map((d) => (
                <li key={d.dealId} className="flex items-center gap-2 text-[12.5px]">
                  <span className="nums min-w-0 flex-1 truncate text-foreground/85" title={d.dealCode ?? d.dealName ?? undefined}>
                    {d.dealCode ?? d.dealName ?? d.dealId.slice(0, 8)}
                  </span>
                  <Badge variant="neutral" className="shrink-0">
                    {d.role.replace(/_/g, " ")}
                  </Badge>
                  {d.isLead ? (
                    <Star weight="fill" className="size-3.5 shrink-0 text-gold" />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Exposure + KYC snapshot - two-up. On the lg desktop the pane column
            is narrow (340–400px) but the viewport is ≥1024, so `sm:grid-cols-2`
            applies; the cells are compact by design (a number + a status), so
            two-up reads cleaner than two stacked slabs. Generous py gives the
            numbers room to breathe inside the hairline well. */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl ring-1 ring-hairline">
          <div className="flex flex-col gap-1.5 bg-surface/40 px-4 py-3.5">
            <Eyebrow>
              <Sparkle weight="light" className="size-3.5 text-muted-foreground/70" />
              Group exposure
            </Eyebrow>
            {groupExposure !== null ? (
              <span className="nums tabular-nums text-[15px] font-medium tracking-[-0.01em] text-foreground/90">
                {compactINR(groupExposure)}
              </span>
            ) : (
              <span className="text-[12px] text-muted-foreground/70">
                No exposure recorded
              </span>
            )}
            {preview.isListed ? (
              <span className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] text-muted-foreground/70">
                Listed · <span className="nums uppercase">{preview.listingExchange ?? "-"}</span>
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5 bg-surface/40 px-4 py-3.5">
            <Eyebrow>
              <ShieldCheck weight="light" className="size-3.5 text-muted-foreground/70" />
              KYC snapshot
            </Eyebrow>
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground/85">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  kycComplete ? "bg-emerald shadow-[0_0_6px] shadow-emerald/60" : "bg-info/70",
                )}
              />
              {kycComplete ? "Complete" : "Pending"}
              {kycStale ? " · re-KYC due" : ""}
            </span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] text-muted-foreground/70">
              Risk ·{" "}
              <span className="capitalize">{preview.kycRiskRating ?? "not assessed"}</span>
            </span>
          </div>
        </section>
      </div>
    </PreviewPane>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Strength meter + KYC dot + relative time - the row's relationship signals.
   `deriveStrength`, `formatRelative`, `StrengthBar` + `BAND_LABEL` live in the
   shared `party-signals` module so the server detail page renders the exact
   same strength meter + last-touch as the client explorer.
   ────────────────────────────────────────────────────────────────────────── */

function KycDot({ complete }: { complete: boolean }) {
  return (
    <span
      role="img"
      aria-label={complete ? "KYC complete" : "KYC pending"}
      title={complete ? "KYC complete" : "KYC pending"}
      className="inline-flex shrink-0 items-center"
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full transition-colors duration-300 ease-soft",
          complete
            ? "bg-emerald shadow-[0_0_6px] shadow-emerald/60"
            : "bg-info/70",
        )}
      />
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Filters + pagination
   ────────────────────────────────────────────────────────────────────────── */

function TypeFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FilterSelect
      ariaLabel="Filter by party type"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: "All types" },
        ...TYPE_FILTERS.map((t) => ({ value: t, label: t.replace(/_/g, " ") })),
      ]}
    />
  );
}

function RiskFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FilterSelect
      ariaLabel="Filter by KYC risk"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: "All risk" },
        ...RISK_FILTERS.map((r) => ({ value: r, label: `${r[0].toUpperCase()}${r.slice(1)} risk` })),
      ]}
    />
  );
}

function TurnoverFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FilterSelect
      ariaLabel="Filter by turnover"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: "All turnover" },
        ...TURNOVER_BANDS.map((b) => ({ value: b, label: TURNOVER_BAND_LABELS[b] })),
      ]}
    />
  );
}

function SectorFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FilterSelect
      ariaLabel="Filter by industry sector"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: "All sectors" },
        ...INDUSTRY_SECTORS.map((s) => ({ value: s, label: INDUSTRY_SECTOR_LABELS[s] })),
      ]}
    />
  );
}

function RatingFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FilterSelect
      ariaLabel="Filter by credit rating"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: "All ratings" },
        ...RATING_VALUES.map((r) => ({ value: r, label: r })),
      ]}
    />
  );
}

function AgencyFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FilterSelect
      ariaLabel="Filter by rating agency"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: "All agencies" },
        ...RATING_AGENCIES.map((a) => ({ value: a, label: RATING_AGENCY_LABELS[a] ?? a })),
      ]}
    />
  );
}

function InvestorTypeFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FilterSelect
      ariaLabel="Filter by investor type"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: "All investors" },
        ...INVESTOR_TYPES.map((t) => ({ value: t, label: INVESTOR_TYPE_LABELS[t] ?? t })),
      ]}
    />
  );
}

function PortfolioSizeFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FilterSelect
      ariaLabel="Filter by portfolio size"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: "All portfolio sizes" },
        ...PORTFOLIO_SIZE_BANDS.map((b) => ({ value: b, label: PORTFOLIO_SIZE_LABELS[b] })),
      ]}
    />
  );
}

function RiskAppetiteFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FilterSelect
      ariaLabel="Filter by risk appetite"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: "All appetite" },
        ...RISK_APPETITES.map((r) => ({ value: r, label: RISK_APPETITE_LABELS[r] })),
      ]}
    />
  );
}

function HighYieldFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FilterSelect
      ariaLabel="Filter by high-yield appetite"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: "HY any" },
        { value: "true", label: "HY appetite" },
        { value: "false", label: "No HY" },
      ]}
    />
  );
}

/** Double-bezel-flavoured native select - accessible + keyboard-friendly. */
function FilterSelect({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          // h-11 (44px) on mobile for a confident thumb tap; md:h-9 restores
          // the compact toolbar height on desktop where mouse precision rules.
          "h-11 md:h-9 appearance-none rounded-full bg-foreground/[0.04] pl-3.5 pr-8 text-[12.5px] text-foreground",
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

function Pagination({
  page,
  totalPages,
  q,
  filters,
}: {
  page: number;
  totalPages: number;
  q?: string;
  filters: PartyListFilters;
}) {
  const pageHref = (p: number) =>
    `/parties?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.risk ? { risk: filters.risk } : {}),
      ...(filters.turnover ? { turnover: filters.turnover } : {}),
      ...(filters.sector ? { sector: filters.sector } : {}),
      ...(filters.rating ? { rating: filters.rating } : {}),
      ...(filters.agency ? { agency: filters.agency } : {}),
      ...(filters.ratingYear ? { ratingYear: String(filters.ratingYear) } : {}),
      ...(filters.investorType ? { investorType: filters.investorType } : {}),
      ...(filters.portfolioSize ? { portfolioSize: filters.portfolioSize } : {}),
      ...(filters.riskAppetite ? { riskAppetite: filters.riskAppetite } : {}),
      ...(filters.highYield !== undefined ? { highYield: String(filters.highYield) } : {}),
      ...(filters.assignedUserId ? { assignedUserId: filters.assignedUserId } : {}),
      page: String(p),
    }).toString()}`;

  const pages: number[] = [];
  const win = 1;
  const start = Math.max(1, page - win);
  const end = Math.min(totalPages, page + win);
  for (let i = start; i <= end; i++) pages.push(i);

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        asChild
        variant="secondary-hairline"
        size="icon-sm"
        aria-disabled={prevDisabled}
        // size-11 (44px) on mobile for a confident thumb tap on the prev/next
        // arrows; md:size-8 restores the compact icon-sm desktop size.
        className={cn("size-11 md:size-8", prevDisabled && "pointer-events-none opacity-40")}
      >
        <Link href={pageHref(Math.max(1, page - 1))} aria-label="Previous page">
          <ArrowLeft weight="light" className="size-4" />
        </Link>
      </Button>

      {start > 1 ? (
        <>
          <PagePill href={pageHref(1)} active={page === 1}>
            1
          </PagePill>
          {start > 2 ? <span className="px-1 text-muted-foreground/60">…</span> : null}
        </>
      ) : null}

      {pages.map((p) => (
        <PagePill key={p} href={pageHref(p)} active={p === page}>
          {p}
        </PagePill>
      ))}

      {end < totalPages ? (
        <>
          {end < totalPages - 1 ? (
            <span className="px-1 text-muted-foreground/60">…</span>
          ) : null}
          <PagePill href={pageHref(totalPages)} active={page === totalPages}>
            {totalPages}
          </PagePill>
        </>
      ) : null}

      <Button
        asChild
        variant="secondary-hairline"
        size="icon-sm"
        aria-disabled={nextDisabled}
        className={cn("size-11 md:size-8", nextDisabled && "pointer-events-none opacity-40")}
      >
        <Link
          href={pageHref(Math.min(totalPages, page + 1))}
          aria-label="Next page"
        >
          <ArrowRight weight="light" className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

function PagePill({
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
        // h-11/min-w-11 (44px) on mobile for thumb-friendly page pills;
        // md:h-8/md:min-w-8 restores the compact desktop size.
        "inline-flex h-11 min-w-11 items-center justify-center rounded-full px-2.5 text-[12.5px] transition-all duration-200 ease-soft md:h-8 md:min-w-8",
        active
          ? "bg-gold/15 text-gold-deep ring-1 ring-gold/30"
          : "text-muted-foreground ring-1 ring-hairline hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      <span className="nums tabular-nums">{children}</span>
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   useMinWidth - SSR-safe matchMedia hook. Used to decide select-vs-navigate
   on a party row (desktop selects ?id=, mobile navigates to the detail page).
   ────────────────────────────────────────────────────────────────────────── */

function useMinWidth(px: number): boolean {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [px]);
  return matches;
}