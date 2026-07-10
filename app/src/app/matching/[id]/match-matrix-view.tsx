"use client";

/**
 * MatchMatrixView - the full issuer × investors grid for /matching/[id].
 *
 *   The ranked match matrix: every investor scored against the selected
 *   issuer across the seven criteria (rating / tenor / sector / ticket /
 *   demat / KYC / relationship), with the warm-intro path and a per-investor
 *   select + indicated commitment. The "Send to deal" panel turns the
 *   shortlist into a live placement mandate via the `sendToDeal` server action.
 *
 *   lg+ ─ a dense premium matrix table (hairline rows, mono numbers, the seven
 *         criteria as emerald-check / muted-x cells, a compact ScoreRing per
 *         row, the warm-intro badge, a select checkbox + ₹ Cr commitment input).
 *   <lg ─ single-column investor cards (criteria indicators + select +
 *         commitment) stacked above the send-to-deal panel - touch-native.
 *
 *   Primary content renders VISIBLE on mount - no whileInView opacity-0 gate
 *   on the matrix / summary / send panel. Motion is reserved for the ScoreRing
 *   draw-in + hover micro-interactions.
 */
import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Briefcase,
  Buildings,
  Check,
  CheckCircle,
  Crosshair,
  Handshake,
  Phone,
  Target,
  X,
} from "@/components/brand/icons";
import { cn } from "@/lib/utils";
import type {
  MatchMatrix,
  InvestorMatch,
  CriterionResult,
} from "@/features/matching/queries";
import {
  bandForScore,
  SCORE_BAND_LABEL,
  type WarmIntroStrength,
} from "@/features/matching/engine";
import { sendToDeal, type SendToDealResult } from "@/features/matching/actions";
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

const DEAL_TYPE_LABEL: Record<string, string> = {
  bond_underwriting: "Bond underwriting",
  private_placement_debt: "Private placement (debt)",
  dcm_advisory: "Debt Capital Markets advisory",
  high_yield_bond: "High-yield bond",
};

const CRITERION_SHORT: Record<string, string> = {
  rating: "Rating",
  tenor: "Tenor",
  sector: "Sector",
  ticket: "Ticket",
  demat: "Demat",
  kyc: "KYC",
  relationship: "Intro",
};

const STRENGTH_META: Record<
  WarmIntroStrength,
  { label: string; variant: "emerald" | "gold" | "neutral" | "outline"; icon: React.ReactNode }
> = {
  strong: { label: "Strong", variant: "emerald", icon: <Handshake weight="light" /> },
  warm: { label: "Warm", variant: "gold", icon: <Handshake weight="light" /> },
  cold: { label: "Cold", variant: "neutral", icon: <Phone weight="light" /> },
  none: { label: "No intro", variant: "outline", icon: <Phone weight="light" /> },
};

const MAX_ROWS = 100;

export function MatchMatrixView({ matrix }: { matrix: MatchMatrix }) {
  const { issuer, matches, criteria, investorPool } = matrix;

  // Selection state - strong fits (score ≥ 65) are pre-selected on mount.
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(matches.filter((m) => m.score >= 65).map((m) => m.investor.partyId)),
  );
  const [commitments, setCommitments] = React.useState<Record<string, string>>({});

  // Deal config - pre-filled from the issuer's primary deal.
  const [dealName, setDealName] = React.useState(
    issuer.dealName ?? `${issuer.legalName} - bond placement`,
  );
  const [dealType, setDealType] = React.useState<string>(
    (issuer.dealType ?? "bond_underwriting") as string,
  );
  const [targetSize, setTargetSize] = React.useState<string>(
    issuer.targetSizeCrores != null ? String(Math.round(issuer.targetSizeCrores)) : "500",
  );
  const [tenor, setTenor] = React.useState<string>(
    issuer.tenorYears != null ? String(issuer.tenorYears) : "5",
  );

  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<SendToDealResult | null>(null);

  const toggleSelect = React.useCallback((partyId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(partyId)) next.delete(partyId);
      else next.add(partyId);
      return next;
    });
  }, []);

  const selectAll = React.useCallback(() => {
    setSelected(new Set(matches.slice(0, MAX_ROWS).map((m) => m.investor.partyId)));
  }, [matches]);

  const clearAll = React.useCallback(() => setSelected(new Set()), []);

  const commitmentFor = React.useCallback(
    (partyId: string): number | undefined => {
      const v = commitments[partyId];
      if (v == null || v.trim() === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    },
    [commitments],
  );

  const summary = React.useMemo(() => {
    const ms = matches;
    const avg =
      ms.length === 0 ? 0 : Math.round(ms.reduce((a, m) => a + m.score, 0) / ms.length);
    const strong = ms.filter((m) => m.score >= 65).length;
    const warm = ms.filter((m) => (m.warmIntro?.strength ?? "none") !== "none").length;
    return { pool: investorPool, avg, strong, warm, total: ms.length };
  }, [matches, investorPool]);

  const selectedMatches = React.useMemo(
    () => matches.filter((m) => selected.has(m.investor.partyId)),
    [matches, selected],
  );

  const totalCommitment = React.useMemo(() => {
    return selectedMatches.reduce((sum, m) => {
      const c = commitmentFor(m.investor.partyId);
      return sum + (c ?? 0);
    }, 0);
  }, [selectedMatches, commitmentFor]);

  const visibleMatches = matches.slice(0, MAX_ROWS);

  function handleSubmit() {
    if (selectedMatches.length === 0) return;
    const size = Number(targetSize);
    const ten = Number(tenor);
    setResult(null);
    startTransition(async () => {
      const res = await sendToDeal({
        issuerId: issuer.partyId,
        dealName: dealName.trim(),
        dealType: dealType as "bond_underwriting" | "private_placement_debt" | "dcm_advisory" | "high_yield_bond",
        targetSizeCrores: size,
        targetTenorYears: ten,
        investors: selectedMatches.map((m) => ({
          partyId: m.investor.partyId,
          commitmentCrores: commitmentFor(m.investor.partyId),
        })),
      });
      setResult(res);
    });
  }

  if (matches.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Crosshair weight="light" />}
          title="No investors to match yet."
          hint="Once investors are typed and carry demat / KYC / deal history, the engine will rank them here against this issuer."
        />
      </Card>
    );
  }

  const success = result?.ok === true;

  return (
    <div className="flex flex-col gap-5">
      <SummaryStrip summary={summary} />

      <CriteriaLegend criteria={criteria} />

      {success && result?.ok ? (
        <SuccessBanner
          dealCode={result.dealCode}
          addedInvestors={result.addedInvestors}
          created={result.created}
        />
      ) : null}

      {/* Desktop matrix table - lg+ */}
      <Card className="hidden lg:block">
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
            <Eyebrow dot>Match matrix · {visibleMatches.length} investors</Eyebrow>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-hairline/60 transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-hairline/60 transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
              >
                Clear
              </button>
              <span className="nums tabular-nums text-[11px] text-muted-foreground/70">
                <span className="text-foreground/80">{selected.size}</span> selected
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="sticky left-0 z-10 bg-[--surface] px-3 py-3 text-left text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
                    #
                  </th>
                  <th className="sticky left-9 z-10 bg-[--surface] px-3 py-3 text-left text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
                    Investor
                  </th>
                  {criteria.map((c) => (
                    <th
                      key={c.key}
                      className="px-3 py-3 text-center text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55"
                      title={c.label}
                    >
                      {c.tag}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
                    Score
                  </th>
                  <th className="px-3 py-3 text-left text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
                    Intro
                  </th>
                  <th className="px-3 py-3 text-center text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
                    Pick
                  </th>
                  <th className="px-3 py-3 text-right text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
                    ₹ Cr
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleMatches.map((m, i) => (
                  <MatrixRow
                    key={m.investor.partyId}
                    match={m}
                    rank={i + 1}
                    criteriaKeys={criteria.map((c) => c.key)}
                    selected={selected.has(m.investor.partyId)}
                    onToggle={toggleSelect}
                    commitment={commitments[m.investor.partyId] ?? ""}
                    onCommitmentChange={(v) =>
                      setCommitments((prev) => ({ ...prev, [m.investor.partyId]: v }))
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
          {matches.length > MAX_ROWS ? (
            <div className="border-t border-hairline px-4 py-2.5 text-center text-[11px] text-muted-foreground/70">
              Showing top {MAX_ROWS} of {matches.length} ranked investors.
            </div>
          ) : null}
        </div>
      </Card>

      {/* Mobile / tablet cards - below lg */}
      <div className="flex flex-col gap-3.5 lg:hidden">
        <div className="flex items-center justify-between gap-2 px-1">
          <Eyebrow dot>{visibleMatches.length} investors</Eyebrow>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-hairline/60"
            >
              All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-hairline/60"
            >
              Clear
            </button>
            <span className="nums tabular-nums text-[11px] text-muted-foreground/70">
              {selected.size}
            </span>
          </div>
        </div>
        {visibleMatches.map((m, i) => (
          <MatrixCard
            key={m.investor.partyId}
            match={m}
            rank={i + 1}
            criteria={criteria}
            selected={selected.has(m.investor.partyId)}
            onToggle={toggleSelect}
            commitment={commitments[m.investor.partyId] ?? ""}
            onCommitmentChange={(v) =>
              setCommitments((prev) => ({ ...prev, [m.investor.partyId]: v }))
            }
          />
        ))}
        {matches.length > MAX_ROWS ? (
          <p className="px-1 text-center text-[11px] text-muted-foreground/70">
            Showing top {MAX_ROWS} of {matches.length}.
          </p>
        ) : null}
      </div>

      <SendToDealPanel
        issuerName={issuer.legalName}
        dealName={dealName}
        setDealName={setDealName}
        dealType={dealType}
        setDealType={setDealType}
        targetSize={targetSize}
        setTargetSize={setTargetSize}
        tenor={tenor}
        setTenor={setTenor}
        selectedCount={selected.size}
        totalCommitment={totalCommitment}
        pending={pending}
        onSubmit={handleSubmit}
        error={result?.ok === false ? result.error : null}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Summary strip
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
   Criteria legend
   ────────────────────────────────────────────────────────────────────────── */

function CriteriaLegend({
  criteria,
}: {
  criteria: { key: string; label: string; tag: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-foreground/[0.025] p-3 ring-1 ring-hairline/60">
      <span className="mr-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
        Criteria
      </span>
      {criteria.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] px-2.5 py-1 text-[11px] text-muted-foreground/80 ring-1 ring-hairline/50"
        >
          <span className="font-medium text-foreground/85">{c.tag}</span>
          <span className="hidden text-muted-foreground/60 sm:inline">· {c.label}</span>
        </span>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Matrix row (desktop)
   ────────────────────────────────────────────────────────────────────────── */

function MatrixRow({
  match,
  rank,
  criteriaKeys,
  selected,
  onToggle,
  commitment,
  onCommitmentChange,
}: {
  match: InvestorMatch;
  rank: number;
  criteriaKeys: string[];
  selected: boolean;
  onToggle: (id: string) => void;
  commitment: string;
  onCommitmentChange: (v: string) => void;
}) {
  const { investor, criteria, score, warmIntro } = match;
  const band = bandForScore(score);
  const warmStrength: WarmIntroStrength = warmIntro?.strength ?? "none";

  return (
    <tr
      className={cn(
        "border-b border-row-hairline transition-colors duration-200 ease-soft last:border-0",
        selected ? "bg-emerald/[0.07]" : "hover:bg-row-hover",
      )}
    >
      <td className="sticky left-0 z-[1] bg-inherit px-3 py-3.5 align-middle">
        <span className="nums tabular-nums text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
          #{rank}
        </span>
      </td>
      <td className="sticky left-9 z-[1] min-w-[200px] bg-inherit px-3 py-3.5 align-middle">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span
              title={investor.legalName}
              className="line-clamp-1 max-w-[260px] text-[13.5px] font-medium text-foreground"
            >
              {investor.legalName}
            </span>
            <Badge variant="neutral" className="shrink-0">
              {KIND_LABEL[investor.kind] ?? "Investor"}
            </Badge>
          </div>
          <span className="text-[11px] text-muted-foreground/70">
            Floor ≥ {investor.minRatingValue} · {investor.tenorMin.toFixed(0)}–
            {investor.tenorMax.toFixed(0)}y · ~{compactINR(investor.typicalTicketCrores * 1e7)}
          </span>
        </div>
      </td>
      {criteriaKeys.map((key) => {
        const c = criteria.find((cr) => cr.key === key);
        return <CriterionCell key={key} criterion={c} />;
      })}
      <td className="px-3 py-3.5 text-right align-middle">
        <div className="flex items-center justify-end gap-2">
          <span
            className={cn(
              "nums tabular-nums text-[13.5px] font-semibold",
              score >= 65 ? "text-emerald" : score >= 40 ? "text-gold" : "text-muted-foreground",
            )}
          >
            {score}
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {SCORE_BAND_LABEL[band].split(" ")[0]}
          </span>
        </div>
      </td>
      <td className="px-3 py-3.5 align-middle">
        <WarmIntroBadge strength={warmStrength} warmIntro={warmIntro} compact />
      </td>
      <td className="px-3 py-3.5 text-center align-middle">
        <SelectToggle
          selected={selected}
          onToggle={() => onToggle(investor.partyId)}
          label={`Select ${investor.legalName}`}
        />
      </td>
      <td className="px-2 py-2.5 text-right align-middle">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={5}
          value={commitment}
          onChange={(e) => onCommitmentChange(e.target.value)}
          placeholder="-"
          aria-label={`Commitment (₹ Cr) for ${investor.legalName}`}
          className="h-9 w-[78px] rounded-lg bg-foreground/[0.04] px-2 text-right text-[12.5px] nums tabular-nums text-foreground ring-1 ring-hairline/60 transition-colors focus:bg-foreground/[0.06] focus:ring-hairline focus:outline-none"
        />
      </td>
    </tr>
  );
}

function CriterionCell({ criterion }: { criterion?: CriterionResult }) {
  if (!criterion) {
    return <td className="px-3 py-3.5 text-center align-middle text-muted-foreground/40">-</td>;
  }
  const { matched, label, detail, issuerValue, investorValue } = criterion;
  const title = `${label}: ${detail} (issuer ${issuerValue} · investor ${investorValue})`;
  return (
    <td className="px-3 py-3.5 text-center align-middle">
      <span
        role="img"
        aria-label={`${label}: ${matched ? "match" : "no match"}`}
        title={title}
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full",
          matched
            ? "bg-emerald/15 text-emerald"
            : "bg-foreground/[0.05] text-muted-foreground/55",
        )}
      >
        {matched ? <Check weight="bold" className="size-3" /> : <X weight="bold" className="size-3" />}
      </span>
    </td>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Matrix card (mobile / tablet)
   ────────────────────────────────────────────────────────────────────────── */

function MatrixCard({
  match,
  rank,
  criteria,
  selected,
  onToggle,
  commitment,
  onCommitmentChange,
}: {
  match: InvestorMatch;
  rank: number;
  criteria: { key: string; label: string; tag: string }[];
  selected: boolean;
  onToggle: (id: string) => void;
  commitment: string;
  onCommitmentChange: (v: string) => void;
}) {
  const { investor, score, warmIntro } = match;
  const band = bandForScore(score);
  const warmStrength: WarmIntroStrength = warmIntro?.strength ?? "none";

  return (
    <Card interactive className={cn(selected ? "ring-emerald/40" : undefined)}>
      <div className="flex flex-col gap-3.5 p-4">
        <div className="flex items-start gap-3">
          <SelectToggle
            selected={selected}
            onToggle={() => onToggle(investor.partyId)}
            label={`Select ${investor.legalName}`}
          />
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="nums tabular-nums text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
                  #{rank}
                </span>
                <h3
                  title={investor.legalName}
                  className="line-clamp-2 break-words text-[14px] font-semibold leading-[1.2] tracking-[-0.01em] text-foreground"
                >
                  {investor.legalName}
                </h3>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="neutral">{KIND_LABEL[investor.kind] ?? "Investor"}</Badge>
                <span className="text-[11px] text-muted-foreground/75">
                  Floor ≥ {investor.minRatingValue} · {investor.tenorMin.toFixed(0)}–
                  {investor.tenorMax.toFixed(0)}y
                </span>
              </div>
            </div>
            <ScoreRing
              value={score}
              min={0}
              max={100}
              size={54}
              thickness={5}
              band={{
                label: SCORE_BAND_LABEL[band].split(" ")[0]!,
                tone: score >= 65 ? "emerald" : score >= 40 ? "gold" : "down",
              }}
              label="Match"
            />
          </div>
        </div>

        {/* Criteria indicators - 4 + 3 grid */}
        <div className="grid grid-cols-4 gap-1.5">
          {criteria.map((cMeta) => {
            const c = match.criteria.find((cr) => cr.key === cMeta.key);
            const matched = c?.matched ?? false;
            const short = CRITERION_SHORT[cMeta.key] ?? cMeta.tag;
            return (
              <div
                key={cMeta.key}
                title={c ? `${c.label}: ${c.detail}` : cMeta.label}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-1.5 py-1 ring-1",
                  matched
                    ? "bg-emerald/[0.07] ring-emerald/22 text-emerald-deep"
                    : "bg-foreground/[0.02] ring-hairline/50 text-muted-foreground/70",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full",
                    matched ? "bg-emerald/20 text-emerald" : "bg-foreground/[0.05] text-muted-foreground/60",
                  )}
                >
                  {matched ? <Check weight="bold" className="size-2.5" /> : <X weight="bold" className="size-2.5" />}
                </span>
                <span className="truncate text-[10px] font-medium uppercase tracking-[0.06em]">
                  {short}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3">
          <WarmIntroBadge strength={warmStrength} warmIntro={warmIntro} />
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground/60">
              ₹ Cr
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={5}
              value={commitment}
              onChange={(e) => onCommitmentChange(e.target.value)}
              placeholder="-"
              aria-label={`Commitment (₹ Cr) for ${investor.legalName}`}
              className="h-9 w-[84px] rounded-lg bg-foreground/[0.04] px-2 text-right text-[12.5px] nums tabular-nums text-foreground ring-1 ring-hairline/60 transition-colors focus:bg-foreground/[0.06] focus:ring-hairline focus:outline-none"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Select toggle (44px-friendly checkbox disc)
   ────────────────────────────────────────────────────────────────────────── */

function SelectToggle({
  selected,
  onToggle,
  label,
}: {
  selected: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="checkbox"
      aria-checked={selected}
      aria-label={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full transition-all duration-200 ease-soft",
        selected
          ? "bg-emerald text-on-emerald ring-1 ring-emerald/50"
          : "bg-foreground/[0.04] text-transparent ring-1 ring-hairline/60 hover:bg-foreground/[0.08]",
      )}
    >
      <Check weight="bold" className="size-3.5" />
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Warm intro badge
   ────────────────────────────────────────────────────────────────────────── */

function WarmIntroBadge({
  strength,
  warmIntro,
  compact = false,
}: {
  strength: WarmIntroStrength;
  warmIntro: InvestorMatch["warmIntro"];
  compact?: boolean;
}) {
  const meta = STRENGTH_META[strength];
  if (strength === "none" || !warmIntro) {
    return <Badge variant={meta.variant} icon={meta.icon}>{meta.label}</Badge>;
  }
  if (compact) {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant={meta.variant} icon={meta.icon}>{meta.label}</Badge>
        <span className="text-[10.5px] text-muted-foreground/70">
          {warmIntro.bankerName} · {warmIntro.interactionCount} touch{warmIntro.interactionCount === 1 ? "" : "es"}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={meta.variant} icon={meta.icon}>{meta.label}</Badge>
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
   Send-to-deal panel
   ────────────────────────────────────────────────────────────────────────── */

function SendToDealPanel({
  issuerName,
  dealName,
  setDealName,
  dealType,
  setDealType,
  targetSize,
  setTargetSize,
  tenor,
  setTenor,
  selectedCount,
  totalCommitment,
  pending,
  onSubmit,
  error,
}: {
  issuerName: string;
  dealName: string;
  setDealName: (v: string) => void;
  dealType: string;
  setDealType: (v: string) => void;
  targetSize: string;
  setTargetSize: (v: string) => void;
  tenor: string;
  setTenor: (v: string) => void;
  selectedCount: number;
  totalCommitment: number;
  pending: boolean;
  onSubmit: () => void;
  error: string | null;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-5 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-9 items-center justify-center rounded-xl bg-emerald/12 text-emerald ring-1 ring-emerald/25">
              <Briefcase weight="light" className="size-5" />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                Send to deal
              </h3>
              <p className="mt-0.5 text-[12px] text-muted-foreground/80">
                Open a placement mandate for{" "}
                <span className="font-medium text-foreground/85">{issuerName}</span> with the
                selected investors as indicated buyers.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Deal name">
            <input
              type="text"
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Deal type">
            <select
              value={dealType}
              onChange={(e) => setDealType(e.target.value)}
              className={inputClass}
            >
              {Object.entries(DEAL_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Target size (₹ Cr)">
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={targetSize}
              onChange={(e) => setTargetSize(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Tenor (years)">
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step={0.5}
              value={tenor}
              onChange={(e) => setTenor(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex flex-col">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
                Selected
              </span>
              <span
                className="nums tabular-nums text-[18px] font-semibold text-foreground"
                aria-live="polite"
                aria-label={`${selectedCount} investor${selectedCount === 1 ? "" : "s"} selected`}
              >
                {selectedCount}
                <span className="ml-1 text-[12px] font-normal text-muted-foreground/70">
                  investor{selectedCount === 1 ? "" : "s"}
                </span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
                Indicated
              </span>
              <span
                className="nums tabular-nums text-[18px] font-semibold text-gold"
                aria-live="polite"
                aria-label={`Indicated commitment ${compactINR(totalCommitment * 1e7)}`}
              >
                {compactINR(totalCommitment * 1e7)}
              </span>
            </div>
          </div>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={pending || selectedCount === 0}
            variant="primary-emerald"
            size="md"
            trailingIcon={
              <ArrowUpRight weight="light" className="size-4" />
            }
          >
            {pending ? "Sending…" : "Send to deal"}
          </Button>
        </div>

        {error ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl bg-down/[0.07] px-3.5 py-2.5 text-[12.5px] text-down ring-1 ring-down/25"
          >
            {error}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-xl bg-foreground/[0.04] px-3 text-[13px] text-foreground ring-1 ring-hairline/60 transition-colors duration-200 ease-soft placeholder:text-muted-foreground/50 focus:bg-foreground/[0.06] focus:ring-hairline focus:outline-none nums tabular-nums";

/* ──────────────────────────────────────────────────────────────────────────
   Success banner
   ────────────────────────────────────────────────────────────────────────── */

function SuccessBanner({
  dealCode,
  addedInvestors,
  created,
}: {
  dealCode: string | null;
  addedInvestors: number;
  created: boolean;
}) {
  return (
    <Card className="ring-emerald/30">
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 items-center justify-center rounded-xl bg-emerald/15 text-emerald ring-1 ring-emerald/30">
            <CheckCircle weight="light" className="size-5" />
          </span>
          <div>
            <h3 className="text-[14.5px] font-semibold text-foreground">
              {created ? "Mandate created." : "Investors added."}{" "}
              {dealCode ? (
                <span className="nums text-muted-foreground/80">· {dealCode}</span>
              ) : null}
            </h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground/80">
              {addedInvestors} investor{addedInvestors === 1 ? "" : "s"} attached to the deal as
              indicated buyers. Open the deal board to track allocations.
            </p>
          </div>
        </div>
        <Button
          asChild
          variant="secondary-hairline"
          size="sm"
          trailingIcon={<ArrowUpRight weight="light" className="size-4" />}
        >
          <Link href="/deals">Open deal board</Link>
        </Button>
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   formatRelative - display-only "3d ago" / "2w ago" / "12 Mar"
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
  if (days < 365) return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}