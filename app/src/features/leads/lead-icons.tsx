"use client";

/**
 * Lead iconography resolver - maps a lead's deal type + source to the right
 * Phosphor Light glyph (or bespoke brand MARK for the bond / G-Sec concepts).
 *
 * Client-only: imports Phosphor directly from @phosphor-icons/react (allowed
 * inside a "use client" module - the phosphor server-bundle hazard only bites
 * server components). The bespoke MARKS come from the brand icon-language.
 *
 * Server pages render `<LeadDealTypeIcon dealType="bond_underwriting" />` -
 * the prop is a plain serializable string, so it crosses the RSC wire cleanly
 * (never a closure), and the icon resolves on the client SSR path.
 */
import * as React from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  ArrowsLeftRight,
  Buildings,
  ChartLineUp,
  ChartPie,
  Globe,
  Handshake,
  HardHat,
  CalendarHeart,
  Phone,
  Scales,
  Truck,
  TreeStructure,
  TrendUp,
} from "@phosphor-icons/react";

import { BondCouponMark, GSecRupeeMark } from "@/components/brand";
import type { IconTone } from "@/components/brand";
import { cn } from "@/lib/utils";
import type { LeadDealType, LeadSource } from "./types";

type IconWeight = "thin" | "light" | "regular";

interface IconProps {
  className?: string;
  weight?: IconWeight;
}

/** A bespoke mark is a component taking { size, tone, className }. */
type MarkComponent = (props: {
  size?: number;
  tone?: IconTone;
  className?: string;
}) => React.ReactElement;

/** Deal-type → concept. `mark` wins over `icon` (the bespoke MARKS are the
 *  CRM's own vocabulary for the bond / G-Sec concepts). */
interface DealTypeConcept {
  mark?: MarkComponent;
  icon?: PhosphorIcon;
  tone: IconTone;
}

const DEAL_TYPE_CONCEPTS: Record<LeadDealType, DealTypeConcept> = {
  bond_underwriting: { mark: BondCouponMark, tone: "gold" },
  high_yield_bond: { mark: BondCouponMark, tone: "gold" },
  private_placement_debt: { mark: BondCouponMark, tone: "gold" },
  gsec_auction: { mark: GSecRupeeMark, tone: "emerald" },
  structured_finance: { icon: TreeStructure, tone: "neutral" },
  supply_chain_finance: { icon: Truck, tone: "neutral" },
  project_finance: { icon: HardHat, tone: "neutral" },
  dcm_advisory: { icon: ChartLineUp, tone: "neutral" },
  rating_advisory: { icon: Scales, tone: "neutral" },
  m_and_a: { icon: ArrowsLeftRight, tone: "neutral" },
  portfolio_management_mandate: { icon: ChartPie, tone: "neutral" },
  secondary_trading_advisory: { icon: TrendUp, tone: "emerald" },
};

const SOURCE_ICONS: Record<LeadSource, PhosphorIcon> = {
  referral: Handshake,
  website: Globe,
  event: CalendarHeart,
  cold_call: Phone,
  existing_client: Buildings,
};

/** Render a deal-type concept at a glyph size (default 20). When the concept
 *  is a bespoke MARK, render the MARK (stroke-based, tone-aware); otherwise
 *  render the Phosphor Light glyph inheriting currentColor. */
export function LeadDealTypeIcon({
  dealType,
  className,
  weight = "light",
  size = 20,
}: IconProps & { dealType: LeadDealType; size?: number }) {
  const concept = DEAL_TYPE_CONCEPTS[dealType];
  if (concept.mark) {
    const Mark = concept.mark;
    return <Mark size={size} tone={concept.tone} className={className} />;
  }
  const Icon = concept.icon!;
  return (
    <Icon
      weight={weight}
      className={cn("[&>svg]:size-5", className)}
      aria-hidden
    />
  );
}

/** The tone for a deal type - used by callers that frame the glyph in an
 *  IconTile so the well matches the concept's hue. */
export function leadDealTypeTone(dealType: LeadDealType): IconTone {
  return DEAL_TYPE_CONCEPTS[dealType].tone;
}

/** Render a source glyph (Phosphor Light, inherits currentColor). */
export function LeadSourceIcon({
  source,
  className,
  weight = "light",
}: IconProps & { source: LeadSource }) {
  const Icon = SOURCE_ICONS[source];
  return <Icon weight={weight} className={className} aria-hidden />;
}
