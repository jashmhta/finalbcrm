"use client";

// IntegrationsExplorer - the interactive CONTROL PANEL over the server-fetched
// adapter registry. Holds the lifted run lifecycle (so the header counts + every
// connection card share one source of truth) and renders:
//
//   1. a LIVE instrument cluster - four count-up StatCards (Connected / Available
//      / In mock / Total) that tick in real time as mocks are run. "Run all
//      mocks" lights up the whole board: Connected → 12, In mock → 0.
//   2. a floating glass filter + search + batch-action toolbar (sticky → blur ok).
//   3. the adapters grouped by category as a rack of reimagined CONNECTION CARDS
//      (each an <AdapterCard/>), with a labelled section header per group.
//
// The server page passes the serializable IntegrationSummary[] + the static
// registry counts straight through the RSC boundary; no functions cross
// server→client. The grid re-keys on the active filter so a change re-fires the
// per-card staggerred mount reveal (transform/opacity only - GPU-disciplined).
//
// CRITICAL: primary content renders VISIBLE on mount - the stat band, filter
// bar, and grid are NOT gated behind whileInView opacity-0. The cards use a
// mount tween (initial → animate) so a post-mount headless screenshot shows
// them at full opacity (the audit-log lesson).
import * as React from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button, EmptyState } from "@/components/brand";
import { Eyebrow } from "@/components/brand/text";
import {
  runAllIntegrationMocks,
  runIntegrationMock,
} from "@/features/integrations/actions";
import type { IntegrationSummary } from "@/features/integrations/registry";

import { AdapterCard, type AdapterRunState } from "./adapter-card";
import { LiveStatTile } from "./live-stat-tile";
import {
  CATEGORY_BLURB,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  deriveConnectionState,
  type IntegrationCategory,
} from "./adapter-meta";
import {
  LightningIcon,
  CircleNotchIcon,
  CheckCircleIcon,
  FunnelIcon,
} from "./integrations-icons";

interface Pill {
  id: string;
  label: string;
  count: number;
}

export interface IntegrationsExplorerProps {
  adapters: IntegrationSummary[];
}

export function IntegrationsExplorer({
  adapters,
}: IntegrationsExplorerProps) {
  const [active, setActive] = React.useState<string>("all");
  const [query, setQuery] = React.useState("");
  const [runningAll, setRunningAll] = React.useState(false);
  // Lifted run lifecycle - one entry per adapter id. Shared with every card so
  // the header counts + each card's button / pulse / ambient read from one
  // source of truth.
  const [runStates, setRunStates] = React.useState<
    Record<string, AdapterRunState>
  >({});

  /* ── Run handlers ──────────────────────────────────────────────────────
     handleRun drives a SINGLE adapter (the card opens its own preview). The
     explorer owns the Server Action call so the card stays a pure view. */
  async function handleRun(id: string) {
    setRunStates((s) => ({
      ...s,
      [id]: { ...s[id], loading: true, error: null },
    }));
    try {
      const res = await runIntegrationMock({ id });
      setRunStates((s) => ({
        ...s,
        [id]: { result: res, error: null, loading: false },
      }));
    } catch {
      // Don't leak raw exception text (or "[object Object]" from String(e))
      // into the card - show a calm, actionable message. The server action's
      // own validation errors come back on `result` (ok:false), not via throw.
      setRunStates((s) => ({
        ...s,
        [id]: {
          result: null,
          error: "This adapter couldn't be reached right now. Try again, or open the card to inspect the last sample payload.",
          loading: false,
        },
      }));
    }
  }

  /* handleRunAll runs every adapter and folds the results into runStates so the
     whole board lights up at once (Connected → total, In mock → 0). It never
     opens a drawer - only single card runs do. */
  async function handleRunAll() {
    setRunningAll(true);
    try {
      const results = await runAllIntegrationMocks();
      const next: Record<string, AdapterRunState> = {};
      for (const r of results) {
        next[r.adapter] = { result: r, error: null, loading: false };
      }
      setRunStates((s) => ({ ...s, ...next }));
      const ok = results.filter((r) => r.ok).length;
      const fail = results.length - ok;
      if (fail === 0) {
        toast.success(`Ran ${ok} mock adapters`, {
          description: "Every adapter returned a realistic sample payload.",
        });
      } else {
        toast.warning(
          `Ran ${results.length} mocks · ${ok} ok, ${fail} failed`,
          {
            description: "Open an adapter card to inspect its sample payload.",
          },
        );
      }
    } catch {
      // Friendly toast - never leak raw exception text into the UI.
      toast.error("Batch run failed", {
        description: "One or more adapters couldn't be reached. Open a card to inspect its sample payload, then try again.",
      });
    } finally {
      setRunningAll(false);
    }
  }

  /* ── Live counts - derived from the shared run state over the adapter
     registry. Connected / Available / In mock / Total all read from
     deriveConnectionState so the header + every card stay in sync. */
  const liveCounts = React.useMemo(() => {
    let connected = 0;
    let available = 0;
    let failed = 0;
    let inMock = 0;
    for (const a of adapters) {
      const rs = runStates[a.id];
      const state = deriveConnectionState(a, rs?.result ?? null, rs?.error ?? null);
      if (state === "connected") connected += 1;
      else if (state === "available") available += 1;
      else if (state === "failed") failed += 1;
      else inMock += 1;
    }
    return { connected, available, failed, inMock, total: adapters.length };
  }, [adapters, runStates]);

  /* ── Category pills + filtered set. */
  const categoryCounts = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const a of adapters) m.set(a.category, (m.get(a.category) ?? 0) + 1);
    return m;
  }, [adapters]);

  const pills = React.useMemo<Pill[]>(
    () => [
      { id: "all", label: "All", count: adapters.length },
      ...CATEGORY_ORDER.map((c) => ({
        id: c,
        label: CATEGORY_LABEL[c],
        count: categoryCounts.get(c) ?? 0,
      })),
    ],
    [adapters.length, categoryCounts],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return adapters.filter((a) => {
      if (active !== "all" && a.category !== active) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
      );
    });
  }, [adapters, active, query]);

  return (
    <div className="flex flex-col gap-5">
      {/* 1 · Live instrument cluster - count-up StatCards that tick in real
          time. Connected + In mock are live (aria-live + a heartbeat dot);
          Available + Total are the static baseline. Each is its own ambient
          double-bezel Card so the row reads as a rack of lit objects.
          MOBILE: a compact 2×2 verdict grid (touch-native summary) instead of
          a tall 4-tile stack that pushes the filter bar + adapter rack below
          the fold; xl+ goes 4-up. Mirrors the KYC board / dashboard stat bands. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <LiveStatTile
          label="Connected"
          value={liveCounts.connected}
          tone="emerald"
          live
          caption="Mocks returned OK"
        />
        <LiveStatTile
          label="Available"
          value={liveCounts.available}
          tone="gold"
          caption="Wired for real upstream"
        />
        <LiveStatTile
          label="In mock"
          value={liveCounts.inMock}
          live
          caption="Awaiting credentials"
        />
        <LiveStatTile
          label="Total"
          value={liveCounts.total}
          caption="Open-architecture adapters"
        />
      </div>

      {/* 2 · Filter + batch-action bar - floating glass toolbar (sticky = blur
          ok). top-24 clears the sticky site-nav header. */}
      <div
        className={cn(
          "sticky top-24 z-20 flex flex-col gap-3 rounded-2xl p-2 ring-1 ring-hairline shadow-floating",
          "bg-surface/70 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/55",
          "transition-all duration-300 ease-soft",
        )}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {/* Category pills */}
          <div
            role="tablist"
            aria-label="Filter adapters by category"
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="inline-flex items-center gap-1.5 pl-2 pr-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
              <FunnelIcon className="size-3.5" />
              <span className="hidden sm:inline">Filter</span>
            </span>
            {pills.map((p) => {
              const isActive = active === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActive(p.id)}
                  className={cn(
                    "group/pill inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium",
                    "transition-all duration-200 ease-soft active:scale-[0.97]",
                    isActive
                      ? "bg-foreground/[0.06] text-foreground ring-1 ring-hairline shadow-soft"
                      : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                  )}
                >
                  <span>{p.label}</span>
                  <span
                    className={cn(
                      "nums inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10.5px] tabular-nums",
                      isActive
                        ? "bg-gold/15 text-gold-deep"
                        : "bg-foreground/[0.06] text-muted-foreground/80",
                    )}
                  >
                    {p.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search + run-all */}
          <div className="flex flex-1 items-center gap-2 md:justify-end">
            <div className="relative flex h-9 min-w-0 flex-1 items-center md:max-w-[220px]">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search adapters…"
                aria-label="Search adapters"
                className={cn(
                  "h-9 w-full rounded-full bg-foreground/[0.04] px-3.5 text-[13px] text-foreground",
                  "ring-1 ring-transparent transition-all duration-200 ease-soft placeholder:text-muted-foreground/70",
                  "focus:bg-foreground/[0.06] focus:ring-hairline focus:outline-none",
                )}
              />
            </div>
            <Button
              onClick={handleRunAll}
              disabled={runningAll}
              variant="primary-emerald"
              size="md"
              leadingIcon={
                runningAll ? (
                  <CircleNotchIcon className="size-4 animate-spin" />
                ) : (
                  <LightningIcon className="size-4" />
                )
              }
            >
              {runningAll ? "Running…" : "Run all mocks"}
            </Button>
          </div>
        </div>
      </div>

      {/* Result count line - mono number, eyebrow style. */}
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
          <CheckCircleIcon className="size-3.5 text-emerald/70" />
          Showing{" "}
          <span className="nums text-foreground/80 tabular-nums">
            {filtered.length}
          </span>
          <span aria-hidden className="text-muted-foreground/40">
            /
          </span>
          <span className="nums text-muted-foreground/70 tabular-nums">
            {adapters.length}
          </span>
          adapters
        </span>
        {active !== "all" ? (
          <span className="text-[11.5px] text-muted-foreground/70">
            Filtered by{" "}
            <span className="font-medium text-foreground/80">
              {CATEGORY_LABEL[active as IntegrationCategory]}
            </span>
          </span>
        ) : null}
      </div>

      {/* 3 · Adapter grid - re-keyed on the active filter so a change re-fires
          the per-card mount stagger. "All" groups by category with a labelled
          section header per group; a specific category renders a flat grid. */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FunnelIcon />}
          title="No adapters match this filter."
          hint={
            query
              ? `Nothing matched “${query}” in the current category. Try a broader search or a different filter.`
              : "Try a different category or clear the search to see every adapter."
          }
        />
      ) : active === "all" ? (
        <div className="flex flex-col gap-8">
          {CATEGORY_ORDER.map((category) => {
            const group = filtered.filter((a) => a.category === category);
            if (group.length === 0) return null;
            return (
              <section key={category} className="flex flex-col gap-3">
                <div className="flex items-center gap-3 px-1">
                  <div className="flex flex-col gap-0.5">
                    <Eyebrow dot>{CATEGORY_LABEL[category]}</Eyebrow>
                    <span className="text-[11.5px] leading-snug text-muted-foreground/70">
                      {CATEGORY_BLURB[category]}
                    </span>
                  </div>
                  <span
                    aria-hidden
                    className="hidden h-px flex-1 bg-hairline/60 sm:block"
                  />
                  <span className="nums text-[11px] tabular-nums text-muted-foreground/60">
                    {group.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.map((adapter, i) => (
                    <AdapterCard
                      key={adapter.id}
                      adapter={adapter}
                      index={i}
                      runState={
                        runStates[adapter.id] ?? {
                          result: null,
                          error: null,
                          loading: false,
                        }
                      }
                      onRun={handleRun}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div
          key={active}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {filtered.map((adapter, i) => (
            <AdapterCard
              key={adapter.id}
              adapter={adapter}
              index={i}
              runState={
                runStates[adapter.id] ?? {
                  result: null,
                  error: null,
                  loading: false,
                }
              }
              onRun={handleRun}
            />
          ))}
        </div>
      )}
    </div>
  );
}