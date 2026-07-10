"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowClockwise,
  Buildings,
  ChartLineUp,
  CheckCircle,
  Scales,
  Sparkle,
  Warning,
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
  Skeleton,
} from "@/components/brand";
import type { BadgeProps } from "@/components/brand";
// Import the pure display constant + type from the types module (no `@/db` in
// its runtime graph) and the server action from the actions module directly -
// NOT from the feature barrel, which re-exports the db-backed server loaders
// and would pull `postgres` into the client bundle (the same hazard
// features/credit/ratingBands.ts was split out to avoid).
import {
  AI_PRIORITY_LABEL,
  type CreditSummary as CreditSummaryType,
} from "@/features/ai/types";
import { fetchCreditSummary } from "@/features/ai/actions";

// ---------------------------------------------------------------------------
// AiCreditSummary - a self-contained client panel that fetches + renders the
// AI-generated credit memo for a single credit analysis.
//
// OWNERSHIP NOTE: this component lives in the AI module (src/app/ai/*) so it
// never touches the credit detail page's source. To surface it on /credit/[id],
// the credit detail page owner should import it and drop it into the Overview
// tab, directly below the "Key ratios" card:
//
//   import { AiCreditSummary } from "@/app/ai/credit-summary";
//   ...
//   <TabsContent value="overview" ...>
//     <CreditSummaryHeader ... />
//     <Card>...Key ratios...</Card>
//     <AiCreditSummary creditAnalysisId={a.creditAnalysisId} />
//     ...
//   </TabsContent>
//
// It takes a single serializable string prop (`creditAnalysisId`) and fetches
// its own data via the `fetchCreditSummary` server action - no function props
// cross the server→client boundary (the Next 16 RSC rule). The panel owns its
// loading / error / empty / regenerate states so it composes cleanly inside
// the credit page without the page having to thread any AI state.
// ---------------------------------------------------------------------------

const EASE = [0.32, 0.72, 0, 1] as const;

const PRIORITY_VARIANT: Record<string, BadgeProps["variant"]> = {
  critical: "down",
  warning: "gold",
  info: "info",
  positive: "up",
};

interface AiCreditSummaryProps {
  creditAnalysisId: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; summary: CreditSummaryType }
  | { status: "error" }
  | { status: "empty" };

export function AiCreditSummary({ creditAnalysisId }: AiCreditSummaryProps) {
  const [state, setState] = React.useState<LoadState>({ status: "loading" });

  const load = React.useCallback(async () => {
    setState({ status: "loading" });
    try {
      const summary = await fetchCreditSummary(creditAnalysisId);
      if (!summary) {
        setState({ status: "empty" });
      } else {
        setState({ status: "ready", summary });
      }
    } catch {
      setState({ status: "error" });
    }
  }, [creditAnalysisId]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Eyebrow dot>
            <Sparkle weight="light" className="size-3.5" />
            AI credit memo
          </Eyebrow>
          <CardTitle className="mt-0">Auto-generated summary</CardTitle>
          <CardDescription className="mt-0">
            A heuristic draft from the analysis, ratios, and scorecard - review
            and edit before circulating to the credit committee.
          </CardDescription>
        </div>
        <div className="shrink-0">
          <Button
            variant="secondary-hairline"
            size="sm"
            onClick={load}
            disabled={state.status === "loading"}
            leadingIcon={<ArrowClockwise weight="light" className="size-4" />}
          >
            Regenerate
          </Button>
        </div>
      </CardHeader>

      <CardBody className="pt-3">
        {state.status === "loading" ? (
          <SummarySkeleton />
        ) : state.status === "empty" ? (
          <EmptyState
            align="start"
            icon={<Sparkle weight="light" />}
            title="Awaiting analysis."
            hint="Link a financial statement and run the scorecard, then regenerate to produce the credit memo."
            tone="gold"
          />
        ) : state.status === "error" ? (
          <EmptyState
            align="start"
            icon={<Warning weight="light" />}
            title="Couldn't generate the summary."
            hint="Something went wrong reading the analysis. Try regenerating - if it persists, the underlying credit file may be incomplete."
          />
        ) : (
          <SummaryBody summary={state.summary} />
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Summary body - the three paragraphs + strengths/concerns + recommendation
// ---------------------------------------------------------------------------

function SummaryBody({ summary }: { summary: CreditSummaryType }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="flex flex-col gap-5"
    >
      {/* Rating line - the compact header readout. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gold/[0.06] px-3.5 py-2.5 ring-1 ring-inset ring-gold/20">
        <ChartLineUp weight="light" className="size-4 text-gold" />
        <span className="nums text-[13px] font-medium tabular-nums text-foreground">
          {summary.ratingLine}
        </span>
      </div>

      {/* Three paragraphs. */}
      <Paragraph icon={<BuildingsIcon />} label="Issuer" text={summary.issuer} />
      <Paragraph icon={<CoinsIcon />} label="Financial highlights" text={summary.financials} />
      <Paragraph icon={<ScalesIcon />} label="Credit assessment" text={summary.assessment} />

      {/* Strengths + concerns - two columns on sm+. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BulletList
          tone="up"
          icon={<CheckCircle weight="light" className="size-4" />}
          label="Strengths"
          items={summary.strengths}
        />
        <BulletList
          tone="down"
          icon={<Warning weight="light" className="size-4" />}
          label="Concerns"
          items={summary.concerns}
        />
      </div>

      {/* Recommendation footer. */}
      <div className="flex flex-col gap-2 rounded-xl bg-surface/60 p-4 ring-1 ring-inset ring-hairline">
        <div className="flex items-center gap-2">
          <Badge variant={PRIORITY_VARIANT[summary.recommendationPriority] ?? "neutral"}>
            {AI_PRIORITY_LABEL[summary.recommendationPriority as keyof typeof AI_PRIORITY_LABEL] ?? "Recommendation"}
          </Badge>
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
            Recommendation
          </span>
        </div>
        <p className="text-[13px] leading-[1.55] text-foreground">
          {summary.recommendation}
        </p>
      </div>
    </motion.div>
  );
}

function Paragraph({
  icon,
  label,
  text,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="[&_svg]:size-4 [&_svg]:text-muted-foreground/80">{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <p className="text-[13.5px] leading-[1.6] text-foreground/90">{text}</p>
    </div>
  );
}

function BulletList({
  tone,
  icon,
  label,
  items,
}: {
  tone: "up" | "down";
  icon: React.ReactNode;
  label: string;
  items: string[];
}) {
  const dot = tone === "up" ? "bg-up/70" : "bg-down/70";
  const iconTone = tone === "up" ? "text-up" : "text-down";
  return (
    <div className="flex flex-col gap-2">
      <div className={cn("flex items-center gap-1.5", iconTone)}>
        <span className="[&_svg]:size-4">{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span aria-hidden className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", dot)} />
            <span className="text-[12.5px] leading-[1.5] text-muted-foreground">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton - mirrors the summary body's shape so the regenerate
// tween reads as content refreshing, not a blank swap.
// ---------------------------------------------------------------------------

function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <Skeleton className="h-9 w-2/3 rounded-xl" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="h-3 w-full rounded-md" />
          <Skeleton className="h-3 w-11/12 rounded-md" />
        </div>
      ))}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="h-3 w-full rounded-md" />
            <Skeleton className="h-3 w-5/6 rounded-md" />
            <Skeleton className="h-3 w-4/5 rounded-md" />
          </div>
        ))}
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}

// Tiny inline icon wrappers (kept local so the Paragraph API stays uniform and
// the phosphor client boundary stays in this one file).
function BuildingsIcon() {
  return <Buildings weight="light" />;
}
function CoinsIcon() {
  return <ChartLineUp weight="light" />;
}
function ScalesIcon() {
  return <Scales weight="light" />;
}