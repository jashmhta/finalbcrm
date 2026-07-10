"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Users,
  Clock,
  ArrowRight,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/brand";

/**
 * Client view layer for the KYC lifecycle timeline. The server detail page
 * hands the audit history (entity_type = kyc_record, oldest → newest) in as a
 * plain serializable array; this component renders the vertical rail with a
 * draw-in animation, semantic per-operation nodes, and a "current state"
 * header on the most recent event.
 *
 * GPU-disciplined: only transform / opacity animated; the rail draw uses
 * scaleY on a hairline element. --ease-soft throughout.
 */

export interface TimelineEntry {
  auditLogId: string;
  operation: string;
  fieldName: string | null;
  occurredAt: Date;
  actorEmail: string | null;
  actorRoleAtTime: string | null;
}

const EASE = [0.32, 0.72, 0, 1] as const;

const OP_TONE: Record<
  string,
  "emerald" | "info" | "down" | "gold" | "neutral"
> = {
  insert: "emerald",
  update: "info",
  delete: "down",
  merge: "gold",
  approve: "emerald",
  reject: "down",
};

function fmtDateTime(v: string | Date | null): string {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NodeIcon({ operation }: { operation: string }) {
  if (operation === "approve") return <CheckCircle weight="light" className="size-3.5" />;
  if (operation === "reject" || operation === "delete")
    return <XCircle weight="light" className="size-3.5" />;
  if (operation === "insert") return <ShieldCheck weight="light" className="size-3.5" />;
  if (operation === "merge") return <Users weight="light" className="size-3.5" />;
  return <Clock weight="light" className="size-3.5" />;
}

export function StatusTimeline({ history }: { history: TimelineEntry[] }) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <span className="text-muted-foreground/70 [&_svg]:size-7">
          <ShieldCheck weight="light" />
        </span>
        <p className="text-[15px] font-light text-foreground/80">
          The record has yet to move.
        </p>
        <p className="text-[12px] text-muted-foreground">
          Lifecycle events will appear here as the file progresses.
        </p>
      </div>
    );
  }

  // Newest first for the top-of-rail "current state" read.
  const ordered = history.slice().reverse();
  const head = ordered[0]!;

  return (
    <div className="flex flex-col gap-4">
      {/* Current-state header - the most recent lifecycle event as a readout. */}
      <div className="flex items-center gap-2.5 rounded-xl bg-foreground/[0.03] p-3 ring-1 ring-hairline/60">
        <span
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-full ring-1",
            OP_TONE[head.operation] === "emerald" &&
              "bg-emerald/10 text-emerald ring-emerald/25",
            OP_TONE[head.operation] === "gold" &&
              "bg-gold/10 text-gold ring-gold/25",
            OP_TONE[head.operation] === "down" &&
              "bg-down/10 text-down ring-down/25",
            OP_TONE[head.operation] === "info" &&
              "bg-info/10 text-info ring-info/25",
            OP_TONE[head.operation] === "neutral" &&
              "bg-foreground/[0.04] text-muted-foreground ring-hairline/60",
          )}
        >
          <NodeIcon operation={head.operation} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Current state
          </span>
          <span className="text-[13px] font-medium text-foreground">
            {head.operation}
            {head.fieldName ? (
              <span className="text-muted-foreground"> · {head.fieldName}</span>
            ) : null}
          </span>
        </div>
        <Badge variant="emerald" className="ml-auto">
          latest
        </Badge>
      </div>

      <ol className="relative flex flex-col gap-0">
        {/* Animated rail - a hairline that draws in from the top on enter-view. */}
        <motion.span
          aria-hidden
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, margin: "-6%" }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{ transformOrigin: "top center" }}
          className="pointer-events-none absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald/40 via-hairline to-hairline"
        />
        {ordered.map((h, i) => {
          const tone = OP_TONE[h.operation] ?? "neutral";
          const isHead = i === 0;
          const dotColor =
            tone === "emerald"
              ? "bg-emerald shadow-[0_0_10px] shadow-emerald/60"
              : tone === "gold"
                ? "bg-gold shadow-[0_0_10px] shadow-gold/50"
                : tone === "down"
                  ? "bg-down"
                  : tone === "info"
                    ? "bg-info"
                    : "bg-foreground/40";
          return (
            <motion.li
              key={h.auditLogId}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-4%" }}
              transition={{
                duration: 0.45,
                delay: 0.05 + i * 0.05,
                ease: EASE,
              }}
              className="group/tl relative flex gap-3.5 pb-5 last:pb-0"
            >
              <span
                aria-hidden
                className={cn(
                  "relative z-10 mt-1 inline-flex size-3.5 shrink-0 items-center justify-center rounded-full ring-4 ring-surface transition-transform duration-300 ease-soft",
                  dotColor,
                  isHead && "size-4 mt-0.5",
                )}
              >
                {isHead ? (
                  <motion.span
                    aria-hidden
                    initial={{ opacity: 0.5, scale: 1 }}
                    animate={{ opacity: 0, scale: 2.2 }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                    className={cn(
                      "absolute inset-0 rounded-full",
                      tone === "emerald" && "bg-emerald",
                      tone === "gold" && "bg-gold",
                      tone === "down" && "bg-down",
                      tone === "info" && "bg-info",
                    )}
                  />
                ) : null}
              </span>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-muted-foreground/70",
                      isHead && "text-gold",
                    )}
                  >
                    <NodeIcon operation={h.operation} />
                  </span>
                  <span
                    className={cn(
                      "text-[12px] font-medium uppercase tracking-[0.1em]",
                      isHead ? "text-foreground" : "text-foreground/80",
                    )}
                  >
                    {h.operation}
                  </span>
                </div>
                {h.fieldName ? (
                  <span className="text-[12.5px] text-muted-foreground">
                    field ·{" "}
                    <span className="nums text-foreground/70">{h.fieldName}</span>
                  </span>
                ) : null}
                <span className="nums tabular-nums text-[11.5px] text-muted-foreground">
                  {fmtDateTime(h.occurredAt)}
                </span>
                <span className="text-[11.5px] text-muted-foreground/80">
                  {h.actorEmail ?? "system"}
                  {h.actorRoleAtTime ? ` · ${h.actorRoleAtTime}` : ""}
                </span>
              </div>
            </motion.li>
          );
        })}
      </ol>

      <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground/70">
        <span className="text-muted-foreground/50">
          <ArrowRight weight="light" className="size-3 rotate-90" />
        </span>
        <span>
          oldest of{" "}
          <span className="nums text-foreground/70">{history.length}</span>{" "}
          lifecycle events
        </span>
      </div>
    </div>
  );
}
