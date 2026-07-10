"use client";

import { Eyebrow } from "@/components/brand/text";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Briefcase,
  Buildings,
  ChartBar,
  CurrencyInr,
  Handshake,
  IdentificationCard,
  SealCheck,
  ShieldCheck,
  type Icon,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Card } from "@/components/brand/card";
import { compactCr } from "@/features/reports/export";
import type { ReportsHubKpis } from "@/features/reports/queries";

/**
 * Reports hub client view - renders the eight report / module cards. The
 * server page fetches the hub KPIs and passes them in; the card metadata
 * (icon, title, description, href, stat) is declared INSIDE this client
 * component so phosphor icons (a client-only concern per the project's "use
 * client" boundary for phosphor) never touch the server bundle. The only
 * thing crossing the RSC boundary is the serializable `kpis` object - no
 * function props.
 *
 * The four built report pages (Pipeline / Revenue / Credit / Compliance) are
 * the primary set - gold icon tiles, linking to /reports/*. The four module
 * cards (KYC Status / Client Analytics / Investor Analytics / Portfolio)
 * link to the most relevant existing CRM surface so every card is a live,
 * actionable link rather than a dead "coming soon" tile.
 */

interface ReportCardDef {
  href: string;
  icon: Icon;
  title: string;
  description: string;
  /** Eyebrow stat or hint rendered in the card footer. */
  stat: string;
  /** Primary report cards get the gold icon tile; module cards get neutral. */
  primary: boolean;
}

/** Tiny rounded icon well - a hairline-disc frame for a phosphor light glyph.
 *  Local to the hub so the shared IconTile (a client module with its own
 *  semantics) stays untouched. */
function CardIcon({
  icon: IconCmp,
  primary,
}: {
  icon: Icon;
  primary: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-xl ring-1 ring-hairline",
        primary
          ? "bg-gold/12 text-gold"
          : "bg-foreground/[0.04] text-muted-foreground",
      )}
    >
      <IconCmp weight="light" className="size-5" />
    </span>
  );
}

const ease = [0.32, 0.72, 0, 1] as const;

export function ReportsHubView({ kpis }: { kpis: ReportsHubKpis }) {
  const cards: ReportCardDef[] = [
    {
      href: "/reports/pipeline",
      icon: ChartBar,
      title: "Pipeline",
      description:
        "Deal pipeline by stage, type, and relationship manager - mandate footprint, weighted exposure, and RM hit-rate.",
      stat: `${kpis.pipelineOpenCount.toLocaleString("en-IN")} open · ${compactCr(kpis.pipelineTargetExposure)}`,
      primary: true,
    },
    {
      href: "/reports/revenue",
      icon: CurrencyInr,
      title: "Revenue",
      description:
        "Fee revenue by deal, close month, and RM - recognized fees on closed mandates plus pipeline upfront retainers.",
      stat: `${compactCr(kpis.recognizedRevenue)} recognized`,
      primary: true,
    },
    {
      href: "/reports/credit",
      icon: ShieldCheck,
      title: "Credit",
      description:
        "Every credit analysis with issuer, internal rating, current score, scorecard band, and obligor exposure.",
      stat: `${kpis.creditAnalysisCount.toLocaleString("en-IN")} current · ${kpis.creditWatchlist} watchlist`,
      primary: true,
    },
    {
      href: "/reports/compliance",
      icon: SealCheck,
      title: "Compliance",
      description:
        "KYC status breakdown, audit-log summary by operation and entity, and DPDP consent status by purpose.",
      stat: `${kpis.kycDueSoon.toLocaleString("en-IN")} KYC due ≤30d · ${kpis.auditEvents.toLocaleString("en-IN")} audit events`,
      primary: true,
    },
    {
      href: "/compliance/kyc",
      icon: IdentificationCard,
      title: "KYC status",
      description:
        "The KYC / AML board - CDD / EDD queue, risk rating, beneficial-ownership thresholds, and periodic re-KYC.",
      stat: `${kpis.kycDueSoon.toLocaleString("en-IN")} re-KYC due ≤30d`,
      primary: false,
    },
    {
      href: "/parties",
      icon: Buildings,
      title: "Client analytics",
      description:
        "The counterparty master ledger - issuers, investors, intermediaries, and prospects as a relationship graph.",
      stat: "Open the parties explorer",
      primary: false,
    },
    {
      href: "/matching",
      icon: Handshake,
      title: "Investor analytics",
      description:
        "The investor–issuer matching workspace - the distribution desk's investor analytics and send-to-deal surface.",
      stat: "Open the matching engine",
      primary: false,
    },
    {
      href: "/deals",
      icon: Briefcase,
      title: "Portfolio",
      description:
        "The deal portfolio - mandates across Investment Banking and Debt Capital Markets as a pipeline board.",
      stat: "Open the deal pipeline",
      primary: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.href}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: Math.min(i * 0.04, 0.32) }}
        >
          <Card interactive className="h-full">
            <Link
              href={c.href}
              className="group/hubcard flex h-full flex-col gap-4 p-5 md:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <CardIcon icon={c.icon} primary={c.primary} />
                <ArrowUpRight
                  weight="light"
                  className="size-4 text-muted-foreground/60 transition-all duration-300 ease-soft group-hover/hubcard:-translate-y-0.5 group-hover/hubcard:translate-x-0.5 group-hover/hubcard:text-foreground"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                  {c.title}
                </h3>
                <p className="text-[13px] leading-[1.5] text-muted-foreground">
                  {c.description}
                </p>
              </div>
              <p className="nums mt-auto border-t border-hairline pt-3 text-[12px] tabular-nums text-muted-foreground">
                {c.stat}
              </p>
            </Link>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}