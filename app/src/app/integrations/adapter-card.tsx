"use client";

// AdapterCard - one CONNECTION CARD in the /integrations control panel.
//
// CONCEPTUAL REDESIGN (not polish). The adapter is no longer a flat card with a
// description + a single yellow CTA. It is a reimagined connection OBJECT - a
// control-panel module with five machined strata:
//
//   1. IDENTITY  - a brand IconTile (the new icon-language disc) framing the
//                  adapter's distinct Phosphor Light glyph, toned to the live
//                  connection state; name + vendor (Geist Mono) + category
//                  eyebrow + a muted phase chip.
//   2. LIVE STATUS - a StatusPill with a heartbeat pulse dot (animate-ping) on
//                  the connected/available states; solid on mock; rose on
//                  failed. The pill's hue tracks the derived connection state.
//   3. DATA FLOW - a mini data-flow DIAGRAM: IN chips → a center adapter node
//                  on a hairline rail → OUT chips, with a data packet that
                    // travels the rail (transform-only) on live states. This is
//                  the conceptual object that makes the card a "connection",
//                  not a tile. Broken (dashed rose) rail on failed.
//   4. HEALTH    - an "access readiness" meter: a hairline track + a transform-
//                  animated fill, mono %, and a one-word caption derived from
//                  the adapter's own access-requirement text.
//   5. ACTION    - a STATEFUL primary button (connected=emerald / available=
//                  gold / failed=rose retry / mock=neutral) + adapter id.
//
// The run lifecycle is LIFTED into the explorer so the header counts + this
// card share one source of truth: the card receives `runState` (result / error
// / loading) + an `onRun(id)` callback. No Server Action is called from the
// card; the registry / actions / zod are untouched. The result drawer (Sheet)
// is the per-card data PREVIEW - it opens on a single run (not on "Run all",
// which would open every drawer) and shows the sample payload + full meta.
//
// CRITICAL: the card renders VISIBLE on mount - entry motion uses
// `initial` → `animate` (a mount tween), NOT `whileInView` opacity-0, so a
// headless screenshot after mount shows the card at full opacity (the audit-log
// lesson). Transform/opacity only; the rail dot + meter fill are transform-
// only; blur is never used on scrolling content. Mobile (<768px) collapses the
// card to a single padded column; the data-flow rail + chips wrap gracefully.
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Icon as PhosphorIcon, IconProps } from "@phosphor-icons/react";
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Button } from "@/components/brand/button";
import { Card } from "@/components/brand/card";
import { Badge } from "@/components/brand/badge";
import { IconTile } from "@/components/brand";
import type { IntegrationSummary } from "@/features/integrations/registry";
import type { AdapterResult } from "@/features/integrations/types";

import {
  ADAPTER_ICONS,
  ADAPTER_VENDOR,
  PlayIcon,
  CircleNotchIcon,
  XIcon,
  CheckCircleIcon,
  WarningIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  ArrowLineRightIcon,
  LockIcon,
  PlugIcon,
  PlugsConnectedIcon,
  GaugeIcon,
} from "./integrations-icons";
import {
  ADAPTER_HEALTH,
  CATEGORY_LABEL,
  DATA_FLOW,
  deriveConnectionState,
  readinessTone,
  type ConnectionState,
} from "./adapter-meta";

const EASE = [0.32, 0.72, 0, 1] as const;

/** Cast a light-wrapped adapter glyph to the PhosphorIcon type IconTile expects.
 *  The wrapper is a plain function component; IconTile's `icon` prop is typed as
 *  the phosphor `Icon` (ForwardRefExoticComponent). The runtime behaviour is
 *  identical (the wrapper renders <Comp weight="light" {...props} />), so the
 *  cast is type-only. Mirrors the party-icon pattern. */
function asPhosphorIcon(
  C: (props: IconProps) => React.JSX.Element,
): PhosphorIcon {
  return C as unknown as PhosphorIcon;
}

type Phase = "Phase 1" | "Phase 2" | "Phase 3";

const PHASE_DOT: Record<Phase, string> = {
  "Phase 1": "bg-emerald/70",
  "Phase 2": "bg-info/70",
  "Phase 3": "bg-gold/70",
};

function phaseShort(phase: string): { label: string; dot: string } {
  const map: Record<Phase, string> = {
    "Phase 1": "P1",
    "Phase 2": "P2",
    "Phase 3": "P3",
  };
  return {
    label: map[phase as Phase] ?? phase,
    dot: PHASE_DOT[phase as Phase] ?? PHASE_DOT["Phase 2"],
  };
}

/* ── Stateful action + status config ───────────────────────────────────────
   One hue family per connection state, drawn from the restrained brand palette.
   The button variant + leading glyph + the StatusPill hue + the card ambient
   all read from these so the card's affordance + signal stay in sync. */

interface StateButtonConfig {
  variant: "primary-emerald" | "primary-gold" | "secondary-hairline";
  label: string;
  /** Rose-hairline override for the failed (retry) treatment - applied on top
   *  of secondary-hairline (the brand Button has no dedicated rose variant). */
  className?: string;
  icon: React.ReactNode;
  /** true → clicking the primary button re-opens the result drawer (the data is
   *  already in hand, e.g. connected); false → open the drawer + re-run. */
  opensDrawer: boolean;
}

const STATE_BUTTON: Record<ConnectionState, StateButtonConfig> = {
  connected: {
    variant: "primary-emerald",
    label: "Connected",
    icon: <PlugsConnectedIcon className="size-4" />,
    opensDrawer: true,
  },
  available: {
    variant: "primary-gold",
    label: "Connect",
    icon: <PlugIcon className="size-4" />,
    opensDrawer: false,
  },
  failed: {
    variant: "secondary-hairline",
    label: "Retry",
    className:
      "ring-down/40 text-down hover:bg-down/[0.06] hover:ring-down/55 hover:text-down",
    icon: <WarningIcon className="size-4" />,
    opensDrawer: false,
  },
  mock: {
    variant: "secondary-hairline",
    label: "Run mock",
    icon: <PlayIcon className="size-4" />,
    opensDrawer: false,
  },
};

/** StatusPill hue per state - hairline pill + tinted bg + tone text, mirroring
 *  the brand Badge desaturated treatment (never a saturated fill). `live`
 *  drives the heartbeat ping on the dot. */
const STATE_PILL: Record<
  ConnectionState,
  { label: string; pill: string; dot: string; ring: string; live: boolean }
> = {
  connected: {
    label: "Connected",
    pill: "bg-emerald/[0.07] text-emerald-deep",
    dot: "bg-emerald",
    ring: "ring-emerald/22",
    live: true,
  },
  available: {
    label: "Available",
    pill: "bg-gold/[0.07] text-gold-deep",
    dot: "bg-gold",
    ring: "ring-gold/22",
    live: true,
  },
  failed: {
    label: "Failed",
    pill: "bg-down/[0.07] text-down",
    dot: "bg-down",
    ring: "ring-down/22",
    live: false,
  },
  mock: {
    label: "Mock",
    pill: "bg-surface/40 text-muted-foreground",
    dot: "bg-gold/80",
    ring: "ring-hairline",
    live: false,
  },
};

/** Card ambient halo per state - reserved, not sprayed. Only connected/
 *  available get a lit halo; failed + mock stay calm so the rose failure signal
 *  lives on the button + pill, not the bezel. */
const STATE_AMBIENT: Record<ConnectionState, "emerald" | "gold" | undefined> = {
  connected: "emerald",
  available: "gold",
  failed: undefined,
  mock: undefined,
};

/** IconTile tone per state - the identity disc glows with the connection. */
const STATE_ICON_TONE: Record<
  ConnectionState,
  "neutral" | "emerald" | "gold" | "down"
> = {
  connected: "emerald",
  available: "gold",
  failed: "down",
  mock: "neutral",
};

export interface AdapterRunState {
  result: AdapterResult | null;
  error: string | null;
  loading: boolean;
}

export interface AdapterCardProps {
  adapter: IntegrationSummary;
  index?: number;
  /** Lifted run state - owned by the explorer so the header counts + this card
   *  share one source of truth. */
  runState: AdapterRunState;
  /** Single-adapter run callback (delegates to the runIntegrationMock Server
   *  Action in the explorer). */
  onRun: (id: string) => void;
}

export function AdapterCard({
  adapter,
  index = 0,
  runState,
  onRun,
}: AdapterCardProps) {
  const IconComp = ADAPTER_ICONS[adapter.id] ?? ArrowUpRightIcon;
  const vendor = ADAPTER_VENDOR[adapter.id];
  const [open, setOpen] = React.useState(false);
  const reduce = useReducedMotion();

  const connectionState = deriveConnectionState(
    adapter,
    runState.result,
    runState.error,
  );
  const stateButton = STATE_BUTTON[connectionState];
  const stateAmbient = STATE_AMBIENT[connectionState];
  const iconTone = STATE_ICON_TONE[connectionState];

  const phase = phaseShort(adapter.phase);
  const firstReq = adapter.accessRequirements[0];
  const moreReqs = Math.max(0, adapter.accessRequirements.length - 1);

  function handlePrimaryAction() {
    if (stateButton.opensDrawer) {
      // Connected - the data is already in hand; just re-open the preview.
      setOpen(true);
    } else {
      // mock / available / failed - open the preview + kick off a single run.
      // Opening immediately (not on completion) means "Run all mocks" never
      // opens a drawer (it doesn't go through this path), while a single card
      // run shows the preview with a loading state that fills on completion.
      setOpen(true);
      onRun(adapter.id);
    }
  }

  return (
    <>
      <motion.div
        // Mount tween (NOT whileInView) - visible in a post-mount screenshot.
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.5,
          delay: Math.min(index * 0.04, 0.32),
          ease: EASE,
        }}
        className="h-full"
      >
        <Card interactive className="h-full">
          <div className="flex h-full flex-col gap-4 p-5">
            {/* 1 · Identity + 2 · Live status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {/* Brand IconTile - the new icon-language disc, toned to the
                    live connection state. The machined well frames the adapter's
                    distinct glyph so the wall reads as a catalog of named
                    institutions, not a row of identical plugs. */}
                <IconTile
                  icon={asPhosphorIcon(IconComp)}
                  size={24}
                  tone={iconTone}
                  className="mt-0.5 shrink-0 transition-colors duration-300 ease-soft"
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
                    {adapter.name}
                  </h3>
                  {vendor ? (
                    <span className="nums truncate text-[11px] tracking-[0.04em] text-muted-foreground/80">
                      {vendor}
                    </span>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                      {CATEGORY_LABEL[adapter.category]}
                    </span>
                    <span
                      aria-hidden
                      className="size-0.5 rounded-full bg-muted-foreground/30"
                    />
                    <span
                      className={cn(
                        "nums inline-flex h-4.5 items-center gap-1 rounded-full px-1.5 text-[10px] font-medium tabular-nums",
                        "ring-1 ring-hairline bg-surface/40 text-muted-foreground",
                      )}
                      title={adapter.phase}
                    >
                      <span
                        aria-hidden
                        className={cn("size-1 rounded-full", phase.dot)}
                      />
                      {phase.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Live status pill - heartbeat ping on connected/available. */}
              <StatusPill state={connectionState} />
            </div>

            {/* Description - clamped to two lines so the strata stay compact. */}
            <p className="line-clamp-2 text-[13px] leading-[1.55] text-muted-foreground">
              {adapter.description}
            </p>

            {/* 3 · Data-flow diagram - the conceptual heart of the card. */}
            <DataFlow
              adapterId={adapter.id}
              state={connectionState}
              icon={IconComp}
            />

            {/* 4 · Health meter - access readiness gauge. */}
            <HealthMeter adapterId={adapter.id} phase={adapter.phase} />

            {/* 5 · Action footer - stateful primary button + adapter id + error. */}
            <div className="mt-auto flex flex-col gap-2 border-t border-hairline pt-4">
              <div className="flex items-center justify-between gap-3">
                <Button
                  onClick={handlePrimaryAction}
                  disabled={runState.loading}
                  variant={stateButton.variant}
                  size="md"
                  className={stateButton.className}
                  leadingIcon={
                    runState.loading ? (
                      <CircleNotchIcon className="size-4 animate-spin" />
                    ) : (
                      stateButton.icon
                    )
                  }
                  trailingIcon={
                    runState.loading ? undefined : (
                      <ArrowRightIcon className="size-4" />
                    )
                  }
                >
                  {runState.loading ? "Running…" : stateButton.label}
                </Button>
                <span className="nums truncate text-[10.5px] tabular-nums text-muted-foreground/60">
                  {adapter.id}
                </span>
              </div>
              {runState.error ? (
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-down">
                  <WarningIcon className="size-3.5" />
                  {runState.error}
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Result drawer - the per-card data PREVIEW. Double-bezel Sheet with the
          sample payload + the full adapter meta (api availability, cost/risk,
          access requirements) removed from the card surface. Opens on a single
          run (loading state fills on completion); "Run all" never opens it. */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          showCloseButton={false}
          className={cn(
            "flex w-full flex-col gap-0 rounded-none border-0 bg-transparent p-0 ring-0",
            "max-w-[560px] data-[side=right]:max-w-[560px] data-[side=right]:sm:max-w-[560px]",
          )}
        >
          <div className="flex h-full flex-col rounded-l-[1.5rem] bg-white/[0.02] p-1.5 ring-1 ring-hairline shadow-floating">
            <div className="bezel-hi flex h-full flex-col overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-surface">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
                <div className="flex flex-col gap-1.5">
                  <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-gold shadow-[0_0_8px] shadow-gold/60"
                    />
                    Mock output
                  </span>
                  <SheetTitle className="text-[1.25rem] font-light tracking-[-0.02em] leading-tight text-foreground">
                    {adapter.name}
                  </SheetTitle>
                  {vendor ? (
                    <span className="nums text-[11.5px] tracking-[0.04em] text-muted-foreground/80">
                      {vendor}
                    </span>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="neutral">{CATEGORY_LABEL[adapter.category]}</Badge>
                    <span
                      className={cn(
                        "nums inline-flex h-4.5 items-center gap-1 rounded-full px-1.5 text-[10px] font-medium tabular-nums",
                        "ring-1 ring-hairline bg-surface/40 text-muted-foreground",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn("size-1 rounded-full", phase.dot)}
                      />
                      {adapter.phase}
                    </span>
                  </div>
                  <SheetDescription className="text-[12.5px] text-muted-foreground">
                    Realistic sample payload - no real upstream call was made.
                  </SheetDescription>
                </div>
                <SheetClose
                  render={
                    <button
                      type="button"
                      aria-label="Close"
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-full",
                        "text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft",
                        "hover:bg-foreground/5 hover:text-foreground active:scale-[0.96]",
                      )}
                    />
                  }
                >
                  <XIcon className="size-4" />
                </SheetClose>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
                {runState.loading ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <CircleNotchIcon className="size-6 animate-spin text-muted-foreground/70" />
                    <p className="text-[13px] text-muted-foreground">
                      Running mock…
                    </p>
                    <p className="nums text-[11px] tabular-nums text-muted-foreground/60">
                      {adapter.id}
                    </p>
                  </div>
                ) : runState.error ? (
                  <div className="flex items-start gap-2.5 rounded-xl bg-down/10 px-4 py-3 text-[13px] font-medium text-down ring-1 ring-down/25">
                    <WarningIcon className="mt-0.5 size-4" />
                    <span>{runState.error}</span>
                  </div>
                ) : runState.result ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Badge
                        variant={runState.result.ok ? "emerald" : "down"}
                        icon={
                          runState.result.ok ? (
                            <CheckCircleIcon />
                          ) : (
                            <WarningIcon />
                          )
                        }
                      >
                        {runState.result.ok ? "OK" : "Fail"}
                      </Badge>
                      <Badge variant="neutral">{runState.result.status}</Badge>
                      <span className="nums text-[11.5px] text-muted-foreground/80">
                        {formatFetchedAt(runState.result.fetchedAt)}
                      </span>
                    </div>

                    <p className="text-[13.5px] font-medium leading-snug text-foreground">
                      {runState.result.summary}
                    </p>

                    {/* Adapter meta - the full context kept off the card surface. */}
                    <div className="flex flex-col gap-2.5 rounded-xl bg-foreground/[0.02] p-3.5 ring-1 ring-hairline/60">
                      <MetaRow label="API availability" value={adapter.apiAvailability} />
                      <div className="h-px bg-hairline/60" aria-hidden />
                      <MetaRow label="Cost / risk" value={adapter.costRisk} />
                      {adapter.accessRequirements.length > 0 ? (
                        <>
                          <div className="h-px bg-hairline/60" aria-hidden />
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                              Access requirements ·{" "}
                              <span className="nums tabular-nums">
                                {adapter.accessRequirements.length}
                              </span>
                            </span>
                            <ul className="flex flex-col gap-1">
                              {adapter.accessRequirements.map((req) => (
                                <li
                                  key={req}
                                  className="flex items-start gap-1.5 text-[12px] leading-snug text-foreground/80"
                                >
                                  <span
                                    aria-hidden
                                    className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground/25"
                                  />
                                  <span>{req}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                        {runState.result.raw ? "Raw payload" : "Payload"}
                      </span>
                      <pre className="nums max-h-[44vh] overflow-auto whitespace-pre-wrap break-all rounded-xl bg-foreground/[0.03] p-3.5 text-[11px] leading-[1.55] text-foreground/85 ring-1 ring-hairline/60">
                        {runState.result.raw
                          ? runState.result.raw
                          : JSON.stringify(runState.result.data, null, 2)}
                      </pre>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <span
                      aria-hidden
                      className="inline-flex size-10 items-center justify-center rounded-full bg-foreground/[0.04] text-muted-foreground/60 ring-1 ring-hairline [&_svg]:size-5"
                    >
                      <PlayIcon />
                    </span>
                    <p className="text-[13px] text-muted-foreground">
                      Run the mock to inspect the sample payload.
                    </p>
                    {firstReq ? (
                      <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground/70">
                        <LockIcon className="size-3.5" />
                        {firstReq}
                        {moreReqs > 0 ? (
                          <span className="nums tabular-nums">
                            +{moreReqs} more
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-2.5 border-t border-hairline px-5 py-4">
                <span className="text-[11px] text-muted-foreground/70">
                  Adapter id{" "}
                  <span className="nums text-foreground/70">{adapter.id}</span>
                </span>
                <div className="flex items-center gap-2.5">
                  <Button
                    onClick={() => onRun(adapter.id)}
                    disabled={runState.loading}
                    variant="secondary-hairline"
                    size="md"
                    leadingIcon={
                      runState.loading ? (
                        <CircleNotchIcon className="size-4 animate-spin" />
                      ) : (
                        <PlayIcon className="size-4" />
                      )
                    }
                  >
                    {runState.loading ? "Running…" : "Re-run"}
                  </Button>
                  <SheetClose
                    render={
                      <Button
                        variant="primary-gold"
                        size="md"
                        trailingIcon={<ArrowRightIcon className="size-4" />}
                      >
                        Done
                      </Button>
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   StatusPill - the live status indicator. A hairline pill whose dot pings
   (animate-ping, transform/opacity only) on the live states (connected /
   available) and sits solid on mock / failed. The hue tracks the connection
   state via the muted brand tokens - never a saturated fill.
   ────────────────────────────────────────────────────────────────────────── */

function StatusPill({ state }: { state: ConnectionState }) {
  const cfg = STATE_PILL[state];
  return (
    <span
      role="status"
      aria-label={`Status: ${cfg.label}`}
      className={cn(
        "inline-flex h-5.5 shrink-0 items-center gap-1.5 rounded-full px-2.5",
        "text-[11px] font-medium uppercase tracking-[0.1em] whitespace-nowrap ring-1",
        cfg.pill,
        cfg.ring,
      )}
    >
      <span aria-hidden className="relative inline-flex size-1.5">
        {cfg.live ? (
          // Heartbeat ping - a scaling-fading ring behind the solid dot.
          // motion-safe so reduced-motion users see a calm solid dot.
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full",
              cfg.dot,
              "opacity-60 motion-safe:animate-ping",
            )}
          />
        ) : null}
        <span
          aria-hidden
          className={cn(
            "relative inline-flex size-1.5 rounded-full",
            cfg.dot,
            cfg.live && "shadow-[0_0_5px]",
            cfg.live && (state === "connected" ? "shadow-emerald/45" : "shadow-gold/45"),
          )}
        />
      </span>
      {cfg.label}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   DataFlow - the mini data-flow DIAGRAM. IN chips on the left → a center
   adapter node on a hairline rail → OUT chips on the right. A data packet
   (transform-only translateX) travels the rail on the live states
   (connected / available), reads as "data flowing". The rail breaks to a dashed
   rose on failed. The rail width is measured (ResizeObserver) so the packet
   traverses the full track with a transform, never a layout `left` animation.
   ────────────────────────────────────────────────────────────────────────── */

function DataFlow({
  adapterId,
  state,
  icon: Icon,
}: {
  adapterId: string;
  state: ConnectionState;
  icon: (props: IconProps) => React.JSX.Element;
}) {
  const flow = DATA_FLOW[adapterId] ?? { in: [], out: [] };
  const live = state === "connected" || state === "available";
  const broken = state === "failed";
  const reduce = useReducedMotion();

  const inChips = flow.in.slice(0, 2);
  const inMore = Math.max(0, flow.in.length - 2);
  const outChips = flow.out.slice(0, 2);
  const outMore = Math.max(0, flow.out.length - 2);

  const railRef = React.useRef<HTMLDivElement>(null);
  const [railW, setRailW] = React.useState(0);
  React.useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const measure = () => setRailW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const DOT = 6;
  const travel = Math.max(0, railW - DOT - 2);
  const packetColor =
    state === "connected"
      ? "bg-emerald"
      : state === "available"
        ? "bg-gold"
        : "bg-foreground/40";

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-foreground/[0.02] p-3 ring-1 ring-hairline/60">
      <div className="flex items-center justify-between">
        <FlowLabel side="in" />
        <FlowLabel side="out" />
      </div>

      <div className="flex items-center">
        <div
          ref={railRef}
          aria-hidden
          className={cn(
            "relative h-1.5 flex-1 rounded-full",
            broken ? "bg-down/[0.06]" : "bg-foreground/[0.06]",
          )}
        >
          {/* Broken rail - dashed rose seam for the failed state. */}
          {broken ? (
            <span
              className="absolute inset-0 rounded-full opacity-50"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, var(--down) 0 4px, transparent 4px 9px)",
              }}
            />
          ) : null}

          {/* Center adapter node - the glyph on the rail ties the flow to the
              adapter's identity. */}
          <span
            className={cn(
              "absolute left-1/2 top-1/2 z-10 inline-flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
              "bg-surface text-muted-foreground ring-1 ring-hairline [&_svg]:size-3 [&_svg]:shrink-0",
              live &&
                (state === "connected"
                  ? "ring-emerald/30 text-emerald"
                  : "ring-gold/30 text-gold"),
            )}
          >
            <Icon />
          </span>

          {/* Data packet - transform-only translateX across the measured rail.
              Fades in, travels, fades out, repeats. Calm (2.6s). top-0 + left-0
              (no Tailwind translate classes) so framer owns the transform and
              the 6px dot sits flush in the 6px rail. */}
          {live && !reduce && travel > 0 ? (
            <motion.span
              className={cn(
                "absolute left-0 top-0 z-0 size-1.5 rounded-full",
                packetColor,
              )}
              initial={{ x: 0, opacity: 0 }}
              animate={{ x: [0, travel], opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 2.6,
                ease: EASE,
                repeat: Infinity,
                repeatDelay: 0.5,
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 flex-wrap gap-1">
          {inChips.map((c) => (
            <FlowChip key={c}>{c}</FlowChip>
          ))}
          {inMore > 0 ? <FlowChipMore>+{inMore}</FlowChipMore> : null}
        </div>
        <div className="flex flex-1 flex-wrap justify-end gap-1">
          {outChips.map((c) => (
            <FlowChip key={c} out>
              {c}
            </FlowChip>
          ))}
          {outMore > 0 ? <FlowChipMore>+{outMore}</FlowChipMore> : null}
        </div>
      </div>
    </div>
  );
}

function FlowLabel({ side }: { side: "in" | "out" }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
      {side === "in" ? "In" : "Out"}
      <ArrowLineRightIcon className="size-3 text-muted-foreground/50" />
    </span>
  );
}

function FlowChip({
  children,
  out = false,
}: {
  children: React.ReactNode;
  out?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] leading-none ring-1 ring-hairline/60",
        out
          ? "bg-emerald/[0.05] text-foreground/80"
          : "bg-foreground/[0.04] text-foreground/75",
      )}
    >
      {children}
    </span>
  );
}

function FlowChipMore({ children }: { children: React.ReactNode }) {
  return (
    <span className="nums inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] leading-none tabular-nums text-muted-foreground/70 ring-1 ring-hairline/40">
      {children}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   HealthMeter - the "access readiness" gauge. A hairline track + a transform-
   animated fill (scaleX, origin left - transform-only), mono %, and a one-word
   caption + phase. The fill tone is banded: emerald (≥70, green-light), gold
   (50–69, onboarding-gated), down (<50, membership-blocked). Honest, derived
   from the adapter's own access-requirement text - not aspirational.
   ────────────────────────────────────────────────────────────────────────── */

function HealthMeter({
  adapterId,
  phase,
}: {
  adapterId: string;
  phase: string;
}) {
  const health = ADAPTER_HEALTH[adapterId] ?? { readiness: 50, label: "TBD" };
  const tone = readinessTone(health.readiness);
  const reduce = useReducedMotion();

  const fillBg =
    tone === "emerald"
      ? "bg-emerald"
      : tone === "gold"
        ? "bg-gold"
        : "bg-down";
  const fillGlow =
    tone === "emerald"
      ? "shadow-[0_0_8px] shadow-emerald/45"
      : tone === "gold"
        ? "shadow-[0_0_8px] shadow-gold/45"
        : "";
  const valueColor =
    tone === "emerald"
      ? "text-emerald"
      : tone === "gold"
        ? "text-gold"
        : "text-down";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
          <GaugeIcon className="size-3 text-muted-foreground/55" />
          Access readiness
        </span>
        <span
          className={cn(
            "nums text-[11.5px] font-medium tabular-nums",
            valueColor,
          )}
        >
          {health.readiness}
          <span className="text-[0.85em] text-muted-foreground/60">%</span>
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-foreground/[0.06] ring-1 ring-inset ring-hairline/40">
        <motion.span
          aria-hidden
          className={cn("absolute inset-y-0 left-0 w-full rounded-full", fillBg, fillGlow)}
          style={{ transformOrigin: "left" }}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: health.readiness / 100 }}
          transition={{ duration: 1, ease: EASE, delay: 0.15 }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] leading-snug text-muted-foreground">
          {health.label}
        </span>
        <span className="nums text-[10px] tabular-nums text-muted-foreground/60">
          {phase}
        </span>
      </div>
    </div>
  );
}

/* ── Drawer helpers ─────────────────────────────────────────────────────── */

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
        {label}
      </dt>
      <dd className="text-[12px] leading-snug text-foreground/85">{value}</dd>
    </div>
  );
}

function formatFetchedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}