"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";

import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/brand/text";
import { Badge } from "@/components/brand/badge";
// Client component → Phosphor can be imported directly here. The
// brand/icons.tsx "use client" boundary exists only to protect SERVER
// components from phosphor's top-level createContext; client islands may
// import from @phosphor-icons/react directly (and access icons like
// ArrowDownLeft that the shared boundary doesn't re-export).
import {
  type Icon as PhosphorIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Chats,
  EnvelopeSimple,
  FileText,
  Handshake,
  LinkBreak,
  Phone,
  PresentationChart,
  Users,
  WhatsappLogo,
} from "@phosphor-icons/react";

/**
 * Recent-activity rail - the dashboard's right-hand "what just happened" list.
 *
 * Each row carries a Phosphor Light channel glyph + direction arrow, a linked
 * counterparty (or a graceful Fraunces-italic "Unlinked" fallback with a
 * LinkBreak glyph when the interaction has no party), the subject, and a
 * relative timestamp. Staggered entry via Framer Motion (transform/opacity).
 *
 * Server passes pre-formatted relative + absolute date strings so no Date.now()
 * runs on the client (avoids hydration mismatch). All props are serializable.
 */

export interface RecentInteraction {
  interactionId: string;
  subject: string | null;
  channel: string | null;
  direction: string | null;
  /** Pre-formatted on the server (e.g. "3d ago") - no client Date math. */
  occurredRelative: string;
  /** Pre-formatted absolute date (e.g. "12 Jun 2025") for the title attribute. */
  occurredAbsolute: string;
  partyId: string | null;
  partyName: string | null;
  dealId: string | null;
  dealName: string | null;
  containsMnpi: boolean;
}

interface RecentActivityProps {
  interactions: RecentInteraction[];
  /** Total interactions logged (for the header count-up). */
  totalLogged: number;
}

const CHANNEL_ICON: Record<string, PhosphorIcon> = {
  meeting: Handshake,
  call: Phone,
  email: EnvelopeSimple,
  whatsapp: WhatsappLogo,
  rfq: FileText,
  ndsom_chat: Chats,
  site_visit: Users,
  management_presentation: PresentationChart,
};

const CHANNEL_LABEL: Record<string, string> = {
  meeting: "Meeting",
  call: "Call",
  email: "Email",
  whatsapp: "WhatsApp",
  rfq: "RFQ",
  ndsom_chat: "NDSOM",
  site_visit: "Site visit",
  management_presentation: "Mgmt prep",
};

const EASE = [0.32, 0.72, 0, 1] as const;

export function RecentActivity({
  interactions,
  totalLogged,
}: RecentActivityProps) {
  const listRef = React.useRef<HTMLUListElement>(null);
  const inView = useInView(listRef, { once: true, margin: "-6%" });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end justify-between gap-3 px-4 pt-5 md:px-6 md:pt-6">
        <div className="flex flex-col gap-1.5">
          <Eyebrow dot>Recent activity</Eyebrow>
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            Latest interactions
          </h3>
        </div>
        <span className="nums text-[11px] tabular-nums text-muted-foreground">
          {totalLogged.toLocaleString("en-IN")} logged
        </span>
      </div>

      <div className="flex-1 pt-2">
        {interactions.length === 0 ? (
          // Graceful empty state - Fraunces one-liner + a quiet Phosphor glyph,
          // never a generic "No data."
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <span className="text-muted-foreground/60 [&_svg]:size-8">
              <Chats weight="light" />
            </span>
            <p className="text-lg font-light tracking-[-0.01em] text-foreground/90">
              The desk is quiet, for now.
            </p>
            <p className="max-w-xs text-[13px] text-muted-foreground">
              Once calls and meetings are logged, they will surface here in real
              time.
            </p>
          </div>
        ) : (
          <motion.ul
            ref={listRef}
            initial="hidden"
            animate={inView ? "show" : "hidden"}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
            }}
            className="flex flex-col"
          >
            {interactions.map((i, idx) => (
              <ActivityRow
                key={i.interactionId}
                item={i}
                // Mobile: keep the rail COMPACT - show only the first 4 items so
                // the dashboard's activity feed reads as a focused thumb-sum,
                // not a long vertical list that buckles under desktop density.
                // md+ restores the full 6-item rail. `hidden md:flex` plays
                // nicely with the framer variants (they tween opacity/transform,
                // not display) so the staggered reveal stays intact on desktop.
                mobileHidden={idx >= 4}
              />
            ))}
          </motion.ul>
        )}
      </div>
    </div>
  );
}

function ActivityRow({
  item,
  mobileHidden = false,
}: {
  item: RecentInteraction;
  mobileHidden?: boolean;
}) {
  const Icon = item.channel ? CHANNEL_ICON[item.channel] ?? Chats : Chats;
  const channelLabel = item.channel ? CHANNEL_LABEL[item.channel] ?? item.channel.replace(/_/g, " ") : null;
  const outbound = item.direction === "outbound";

  // Graceful "No party" handling: prefer the linked counterparty; fall back to
  // the deal name; only when neither is present show a Fraunces-italic
  // "Unlinked" label with a LinkBreak glyph - never bare "No party" text.
  const hasParty = Boolean(item.partyId && item.partyName);
  const hasDeal = Boolean(item.dealId && item.dealName);

  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: EASE },
        },
      }}
      className={cn(
        "group relative flex flex-col gap-1.5 border-b border-hairline/60 px-4 py-3.5 transition-colors duration-200 ease-soft last:border-0 hover:bg-foreground/[0.03] md:px-6",
        // Compact mobile rail - items beyond the 4th are hidden on phones
        // (see the map in RecentActivity). md:flex restores them on desktop.
        mobileHidden && "hidden md:flex",
      )}
    >
      {/* Emerald left-accent that grows on hover (matches the table treatment). */}
      <span
        aria-hidden
        className="absolute left-0 top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-full bg-emerald opacity-0 transition-all duration-200 ease-soft group-hover:h-8 group-hover:opacity-100"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-foreground/90">
          {/* Channel glyph - Phosphor Light, muted, emerald on hover. */}
          <span className="text-muted-foreground/70 transition-colors duration-200 ease-soft group-hover:text-emerald [&_svg]:size-4">
            <Icon weight="light" />
          </span>
          {hasParty ? (
            <Link
              href={`/parties/${item.partyId}`}
              className="truncate hover:text-emerald hover:underline"
              title={item.partyName ?? undefined}
            >
              {item.partyName}
            </Link>
          ) : hasDeal ? (
            <Link
              href={`/deals/${item.dealId}`}
              className="truncate hover:text-emerald hover:underline"
              title={item.dealName ?? undefined}
            >
              {item.dealName}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-light italic text-muted-foreground/80">
              <LinkBreak weight="light" className="size-3.5" />
              Unlinked
            </span>
          )}
        </span>
        <span
          className="nums shrink-0 text-[11px] tabular-nums text-muted-foreground"
          title={item.occurredAbsolute}
        >
          {item.occurredRelative}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        {channelLabel ? (
          <Badge variant="neutral">{channelLabel}</Badge>
        ) : null}
        {item.direction ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] text-muted-foreground/70 [&_svg]:size-3",
              outbound && "text-emerald/80",
            )}
            title={outbound ? "Outbound" : "Inbound"}
          >
            {outbound ? (
              <ArrowUpRight weight="light" />
            ) : (
              <ArrowDownLeft weight="light" />
            )}
            {outbound ? "Out" : "In"}
          </span>
        ) : null}
        <span className="truncate">{item.subject ?? "No subject"}</span>
        {item.containsMnpi ? (
          <Badge variant="down" className="ml-auto shrink-0">
            MNPI
          </Badge>
        ) : null}
      </div>
      {/* Deal context - only when a party is linked AND a deal is present
          (avoids duplicating the fallback deal name shown as the primary). */}
      {hasParty && hasDeal ? (
        <div className="text-[11px] text-muted-foreground/80">
          on{" "}
          <Link
            href={`/deals/${item.dealId}`}
            className="hover:text-emerald hover:underline"
          >
            {item.dealName}
          </Link>
        </div>
      ) : null}
    </motion.li>
  );
}
