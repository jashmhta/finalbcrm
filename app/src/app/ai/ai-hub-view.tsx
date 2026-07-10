"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Buildings,
  Chats,
  Clock,
  Handshake,
  IdentificationCard,
  Lightning,
  ListChecks,
  Phone,
  ShieldCheck,
  Sparkle,
  type Icon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
  Eyebrow,
  EmptyState,
} from "@/components/brand";
import type { BadgeProps } from "@/components/brand";
// Import the pure display constants + types directly from the types module
// (no `@/db` in its runtime graph) - NOT from the feature barrel, which
// re-exports the db-backed server loaders and would pull `postgres` into the
// client bundle (the same hazard features/credit/ratingBands.ts was split out
// to avoid for the matching engine).
import {
  AI_PRIORITY_BADGE,
  AI_PRIORITY_LABEL,
  INSIGHT_ACTION_LABEL,
  NEXT_ACTION_KIND_LABEL,
  type ClientInsight,
  type InsightActionKind,
  type NextAction,
  type NextActionKind,
  type RecentInteractionSummary,
} from "@/features/ai/types";

// ---------------------------------------------------------------------------
// Per-kind + per-action iconography + badge variants (client-only - phosphor
// lives behind the "use client" boundary, so this map stays in this client
// module, never in the server page).
// ---------------------------------------------------------------------------

const EASE = [0.32, 0.72, 0, 1] as const;

const NEXT_ACTION_ICON: Record<NextActionKind, Icon> = {
  task_overdue: ListChecks,
  deal_stuck: Handshake,
  credit_committee_pending: ShieldCheck,
  kyc_expiring: IdentificationCard,
  no_recent_interaction: Phone,
};

const INSIGHT_ACTION_VARIANT: Record<InsightActionKind, BadgeProps["variant"]> = {
  re_engage: "gold",
  advance_mandate: "gold",
  committee_review: "info",
  refresh_kyc: "down",
  deepen_coverage: "emerald",
  maintain: "neutral",
};

// ---------------------------------------------------------------------------
// ScoreBar - a compact animated horizontal score bar (0..100). The gold fill
// draws in on mount via framer-motion width tween; tabular-nums score on the
// right. Dense enough to sit 8-deep in the client-insights grid without the
// visual weight of a full ScoreRing.
// ---------------------------------------------------------------------------

function ScoreBar({
  label,
  score,
  band,
  tone = "gold",
  delay = 0,
}: {
  label: string;
  score: number;
  band: string;
  tone?: "gold" | "emerald" | "down";
  delay?: number;
}) {
  const toneFill =
    tone === "emerald"
      ? "from-emerald/80 to-emerald-deep/80"
      : tone === "down"
        ? "from-down/80 to-down-deep/80"
        : "from-gold to-gold-deep";
  const toneText =
    tone === "emerald" ? "text-emerald" : tone === "down" ? "text-down" : "text-gold";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
          {label}
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className={cn("nums text-[13px] font-semibold tabular-nums", toneText)}>
            {score}
          </span>
          <span className="text-[10.5px] text-muted-foreground/70">{band}</span>
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.07] ring-1 ring-inset ring-foreground/[0.04]">
        <motion.span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r",
            toneFill,
          )}
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.max(0, Math.min(100, score))}%` }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 1, ease: EASE, delay }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Next-best-action row
// ---------------------------------------------------------------------------

function ActionRow({ action, index }: { action: NextAction; index: number }) {
  const Icon = NEXT_ACTION_ICON[action.kind];
  const badgeVariant = AI_PRIORITY_BADGE[action.priority];
  const tileTone =
    action.priority === "critical"
      ? "bg-down/[0.08] ring-down/25 text-down"
      : action.priority === "warning"
        ? "bg-gold/[0.08] ring-gold/25 text-gold"
        : action.priority === "positive"
          ? "bg-up/[0.08] ring-up/25 text-up"
          : "bg-info/[0.08] ring-info/25 text-info";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay: Math.min(index * 0.05, 0.3) }}
    >
      <Link
        href={action.href}
        className="group/action flex items-start gap-3.5 rounded-xl px-3.5 py-3.5 transition-colors duration-200 ease-soft hover:bg-foreground/[0.04]"
      >
        <span
          aria-hidden
          className={cn(
            "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl ring-1",
            tileTone,
          )}
        >
          <Icon weight="light" className="size-[18px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariant}>{AI_PRIORITY_LABEL[action.priority]}</Badge>
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70">
              {NEXT_ACTION_KIND_LABEL[action.kind]}
            </span>
            <span className="nums ml-auto text-[11px] tabular-nums text-muted-foreground/70">
              {action.relative}
            </span>
          </div>
          <p className="text-[13.5px] font-medium leading-[1.4] text-foreground">
            {action.title}
          </p>
          <p className="text-[12.5px] leading-[1.5] text-muted-foreground">
            {action.description}
          </p>
        </div>
        <ArrowUpRight
          weight="light"
          className="mt-1 size-4 shrink-0 text-muted-foreground/50 transition-all duration-300 ease-soft group-hover/action:-translate-y-0.5 group-hover/action:translate-x-0.5 group-hover/action:text-foreground"
        />
      </Link>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Client insight card
// ---------------------------------------------------------------------------

function ClientInsightCard({ insight, index }: { insight: ClientInsight; index: number }) {
  const lastTouch =
    insight.daysSinceLastInteraction === null
      ? "never"
      : insight.daysSinceLastInteraction === 0
        ? "today"
        : `${insight.daysSinceLastInteraction}d ago`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{ duration: 0.5, ease: EASE, delay: Math.min(index * 0.04, 0.3) }}
    >
      <Card interactive className="h-full">
        <div className="flex h-full flex-col gap-4 p-4.5 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={insight.href}
              className="group/ci min-w-0 flex-1"
            >
              <h3 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground transition-colors duration-200 ease-soft group-hover/ci:text-gold">
                {insight.legalName}
              </h3>
            </Link>
            <Badge variant={INSIGHT_ACTION_VARIANT[insight.recommendedAction]}>
              {INSIGHT_ACTION_LABEL[insight.recommendedAction]}
            </Badge>
          </div>

          <div className="flex flex-col gap-3">
            <ScoreBar
              label="Relationship"
              score={insight.relationshipStrength}
              band={insight.relationshipBand}
              tone={insight.relationshipStrength >= 70 ? "emerald" : insight.relationshipStrength < 20 ? "down" : "gold"}
            />
            <ScoreBar
              label="Deal potential"
              score={insight.dealPotential}
              band={insight.dealPotentialBand}
              tone={insight.dealPotential >= 60 ? "emerald" : insight.dealPotential < 15 ? "down" : "gold"}
              delay={0.08}
            />
          </div>

          <p className="text-[12.5px] leading-[1.5] text-muted-foreground">
            {insight.actionRationale}
          </p>

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-hairline pt-3">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80">
              <span className="nums tabular-nums">
                {insight.interactionCount} touch{insight.interactionCount === 1 ? "" : "es"}
              </span>
              <span aria-hidden className="text-muted-foreground/30">·</span>
              <span className="nums tabular-nums">
                {insight.activeDealCount} live deal{insight.activeDealCount === 1 ? "" : "s"}
              </span>
              {insight.totalTargetSizeCr > 0 ? (
                <>
                  <span aria-hidden className="text-muted-foreground/30">·</span>
                  <span className="nums tabular-nums">
                    ₹{insight.totalTargetSizeCr.toFixed(0)} Cr
                  </span>
                </>
              ) : null}
            </div>
            <span className="nums text-[11px] tabular-nums text-muted-foreground/70">
              last {lastTouch}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Recent interaction mini-summary row
// ---------------------------------------------------------------------------

function RecentSummaryRow({ item, index }: { item: RecentInteractionSummary; index: number }) {
  const channel = item.channel
    ? item.channel.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Note";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{ duration: 0.45, ease: EASE, delay: Math.min(index * 0.04, 0.24) }}
    >
      <Link
        href={item.href}
        className="group/rs flex flex-col gap-1.5 rounded-xl px-3.5 py-3 transition-colors duration-200 ease-soft hover:bg-foreground/[0.04]"
      >
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
          <span className="font-medium uppercase tracking-[0.12em]">{channel}</span>
          <span aria-hidden className="text-muted-foreground/30">·</span>
          <span className="nums tabular-nums">{item.relative}</span>
        </div>
        <p className="text-[13px] font-medium leading-[1.4] text-foreground">
          {item.topic}
        </p>
        {item.actionItem ? (
          <p className="flex items-start gap-1.5 text-[12px] leading-[1.5] text-muted-foreground">
            <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-gold/70" />
            <span>{item.actionItem}</span>
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="truncate text-[11.5px] text-muted-foreground/70">
            {item.partyName ?? item.dealCode ?? "-"}
          </span>
          <ArrowUpRight
            weight="light"
            className="size-3.5 shrink-0 text-muted-foreground/45 transition-all duration-300 ease-soft group-hover/rs:-translate-y-0.5 group-hover/rs:translate-x-0.5 group-hover/rs:text-foreground"
          />
        </div>
      </Link>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Section shell - double-bezel card with an eyebrow + title header + body
// ---------------------------------------------------------------------------

function SectionCard({
  eyebrow,
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: {
  eyebrow: string;
  icon: Icon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Eyebrow dot>
            <Icon weight="light" className="size-3.5" />
            {eyebrow}
          </Eyebrow>
          <CardTitle className="mt-0">{title}</CardTitle>
          {description ? (
            <CardDescription className="mt-0">{description}</CardDescription>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardBody className="pt-3">{children}</CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AiHubView - the hub surface
// ---------------------------------------------------------------------------

interface AiHubViewProps {
  actions: NextAction[];
  recentSummaries: RecentInteractionSummary[];
  clientInsights: ClientInsight[];
  userName?: string;
}

export function AiHubView({
  actions,
  recentSummaries,
  clientInsights,
  userName,
}: AiHubViewProps) {
  const greeting = userName
    ? `Coverage desk for ${userName}`
    : "Your coverage desk";

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {/* ── Next best actions (hero) ─────────────────────────────────────── */}
      <SectionCard
        eyebrow="Next best actions"
        icon={Lightning}
        title={`${greeting} - the next 3-5 moves`}
        description="Prioritised from your owned tasks, mandates, credit files, and coverage parties. Critical first, then warnings, then nudges."
        action={
          actions.length > 0 ? (
            <Badge variant="gold">{actions.length} action{actions.length === 1 ? "" : "s"}</Badge>
          ) : null
        }
      >
        {actions.length > 0 ? (
          <div className="flex flex-col divide-y divide-hairline/70">
            {actions.map((a, i) => (
              <ActionRow key={`${a.kind}-${a.entityLabel}-${i}`} action={a} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState
            align="start"
            icon={<Sparkle weight="light" />}
            title="You're all caught up."
            hint="No overdue tasks, stuck mandates, pending committee rulings, or cold coverage parties on your book. The desk is clear."
            tone="gold"
          />
        )}
      </SectionCard>

      {/* ── Client insights + Recent auto-summaries (split) ──────────────── */}
      <div className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-12">
        {/* Client insights - wider. */}
        <div className="lg:col-span-7">
          <SectionCard
            eyebrow="Client insights"
            icon={Buildings}
            title="Relationship strength & deal potential"
            description="Per-counterparty scores blended from interaction recency, deal footprint, and contact breadth - with a recommended next move."
            action={
              clientInsights.length > 0 ? (
                <Badge variant="neutral">{clientInsights.length} scored</Badge>
              ) : null
            }
          >
            {clientInsights.length > 0 ? (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {clientInsights.map((c, i) => (
                  <ClientInsightCard key={c.partyId} insight={c} index={i} />
                ))}
              </div>
            ) : (
              <EmptyState
                align="start"
                icon={<Buildings weight="light" />}
                title="No scored clients yet."
                hint="Log interactions or attach parties to mandates and the engine will rank your coverage book by relationship strength and deal potential."
              />
            )}
          </SectionCard>
        </div>

        {/* Recent auto-summaries - rail. */}
        <div className="lg:col-span-5">
          <SectionCard
            eyebrow="Recent auto-summaries"
            icon={Chats}
            title="Latest interactions, distilled"
            description="The most recent meetings, calls, and notes - each with a one-line topic and the pressing action item extracted from the record."
            action={
              recentSummaries.length > 0 ? (
                <Button asChild variant="secondary-hairline" size="sm">
                  <Link href="/interactions">
                    All interactions
                    <ArrowUpRight weight="light" className="size-3.5" />
                  </Link>
                </Button>
              ) : null
            }
          >
            {recentSummaries.length > 0 ? (
              <div className="flex flex-col divide-y divide-hairline/70">
                {recentSummaries.map((s, i) => (
                  <RecentSummaryRow key={s.interactionId} item={s} index={i} />
                ))}
              </div>
            ) : (
              <EmptyState
                align="start"
                icon={<Chats weight="light" />}
                title="No interactions logged yet."
                hint="Capture a meeting, call, or email and it will appear here as an auto-summary with its dominant topic and action item."
              />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
