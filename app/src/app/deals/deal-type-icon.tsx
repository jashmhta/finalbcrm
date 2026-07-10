"use client";

/**
 * DealTypeGlyph + PartyRoleGlyph - the machined identity discs for the deals
 * pipeline. The bespoke brand-concept MARKS (bond coupon, G-Sec, rating
 * ladder, mandate, exposure gauge, KYC shield) cover the instrument/mandate
 * concepts; Phosphor Light glyphs cover the operational deal types + the
 * deal_party roles that don't have a brand-concept glyph. Both render inside
 * the same hairline-disc well as `IconTile`, so every deal + every linked
 * party reads as one machined iconographic system - the icon analogue of the
 * double-bezel Card.
 *
 * `creditBand(dealType)` is the view-layer derivation of a deal's credit
 * character from its deal_type (sovereign / investment-grade / high-yield).
 * The deal table carries no agency rating; the band is the honest, data-driven
 * "rating chip" signal the card surfaces - drawn from the existing deal_type
 * field, no query change.
 *
 * Client-only: imports Phosphor from the `@/components/brand/icons` client
 * boundary + the custom MARKS + IconTile from the icon-language, so the
 * phosphor module scope stays behind the client boundary (per icons.tsx).
 */
import * as React from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  ArrowsLeftRight,
  Briefcase,
  Buildings,
  ChartLineUp,
  CheckCircle,
  FileText,
  Handshake,
  PresentationChart,
  Scales,
  Sparkle,
  Target,
} from "@/components/brand/icons";
import {
  BondCouponMark,
  ExposureGaugeMark,
  GSecRupeeMark,
  IconTile,
  KycShieldMark,
  MandateMark,
  RatingLadderMark,
  type IconSize,
  type IconTone,
} from "@/components/brand";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
   Disc language - mirrors IconTile's DISC_TONE / DISC_SIZE exactly so custom
   marks and Phosphor glyphs share one container.
   ────────────────────────────────────────────────────────────────────────── */

const DISC_TONE: Record<IconTone, string> = {
  neutral: "ring-hairline bg-foreground/[0.03] text-muted-foreground",
  emerald: "ring-emerald/22 bg-emerald/[0.06] text-emerald/85",
  gold: "ring-gold/22 bg-gold/[0.06] text-gold/85",
  down: "ring-down/22 bg-down/[0.06] text-down/85",
};

const DISC_SIZE: Record<IconSize, string> = {
  16: "size-7",
  20: "size-9",
  24: "size-11",
};

const MARK_PX: Record<IconSize, number> = { 16: 16, 20: 20, 24: 24 };

interface Concept {
  /** A bespoke brand-concept MARK wins over `icon` when set. */
  mark?: (props: { size?: number; tone?: IconTone; className?: string }) => React.ReactElement;
  icon?: PhosphorIcon;
  tone: IconTone;
}

/* ──────────────────────────────────────────────────────────────────────────
   Deal type → concept. The fixed-income / mandate core types carry bespoke
   MARKS; the operational + ECM types fall back to Phosphor Light glyphs.
   Tones are restrained - gold is reserved for the sovereign (G-Sec, the
   "risk-free" premium) and rating advisory (the rating concept), emerald for
   the mandate's positive close concept, neutral for the rest.
   ────────────────────────────────────────────────────────────────────────── */

const DEAL_TYPE_CONCEPTS: Record<string, Concept> = {
  // Fixed-income core → bespoke MARKS.
  bond_underwriting: { mark: BondCouponMark, tone: "neutral" },
  high_yield_bond: { mark: BondCouponMark, tone: "neutral" },
  private_placement_debt: { mark: BondCouponMark, tone: "neutral" },
  gsec_auction: { mark: GSecRupeeMark, tone: "gold" },
  rating_advisory: { mark: RatingLadderMark, tone: "gold" },
  structured_finance: { mark: MandateMark, tone: "neutral" },

  // Operational / ECM / advisory → Phosphor Light glyphs in the same disc well.
  m_and_a: { icon: Handshake, tone: "neutral" },
  project_finance: { icon: Buildings, tone: "neutral" },
  supply_chain_finance: { icon: ArrowsLeftRight, tone: "neutral" },
  ecm_ipo: { icon: PresentationChart, tone: "neutral" },
  ecm_fpo: { icon: PresentationChart, tone: "neutral" },
  ecm_qip: { icon: PresentationChart, tone: "neutral" },
  ecm_rights: { icon: PresentationChart, tone: "neutral" },
  dcm_advisory: { icon: Briefcase, tone: "neutral" },
  valuation: { icon: Scales, tone: "neutral" },
  fairness_opinion: { icon: Scales, tone: "neutral" },
  portfolio_management_mandate: { icon: ChartLineUp, tone: "neutral" },
  secondary_trading_advisory: { icon: ArrowsLeftRight, tone: "neutral" },
};

const DEFAULT_DEAL_CONCEPT: Concept = { mark: MandateMark, tone: "neutral" };

export function dealTypeConcept(dealType: string | null | undefined): Concept {
  if (!dealType) return DEFAULT_DEAL_CONCEPT;
  return DEAL_TYPE_CONCEPTS[dealType] ?? DEFAULT_DEAL_CONCEPT;
}

export interface DealTypeGlyphProps {
  dealType: string | null | undefined;
  size?: IconSize;
  /** Override the concept tone (e.g. force neutral in a muted context). */
  tone?: IconTone;
  className?: string;
}

/** DealTypeGlyph - the machined deal-type identity disc. */
export function DealTypeGlyph({
  dealType,
  size = 20,
  tone,
  className,
}: DealTypeGlyphProps) {
  const concept = dealTypeConcept(dealType);
  const finalTone = tone ?? concept.tone;

  if (concept.mark) {
    return (
      <span
        data-slot="deal-type-glyph"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full ring-1 transition-colors duration-300 ease-soft",
          DISC_SIZE[size],
          DISC_TONE[finalTone],
          className,
        )}
      >
        {concept.mark({ size: MARK_PX[size], tone: finalTone })}
      </span>
    );
  }

  return (
    <IconTile
      icon={concept.icon as PhosphorIcon}
      size={size}
      tone={finalTone}
      className={className}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Deal-party role → concept. The roles that name a financial counterparty
   concept (issuer / investor / rating agency / guarantor) carry bespoke
   MARKS; the syndicate / ops / M&A-side roles fall back to Phosphor Light.
   Tones: emerald for the "holds exposure / backs" roles, gold for the rating
   agency (the premium-accent role), neutral for the rest.
   ────────────────────────────────────────────────────────────────────────── */

const ROLE_CONCEPTS: Record<string, Concept> = {
  // Financial-counterparty concepts → bespoke MARKS.
  issuer: { mark: MandateMark, tone: "neutral" },
  investor: { mark: ExposureGaugeMark, tone: "emerald" },
  rating_agency: { mark: RatingLadderMark, tone: "gold" },
  guarantor: { mark: KycShieldMark, tone: "emerald" },

  // Syndicate / arranger group → Handshake.
  arranger: { icon: Handshake, tone: "neutral" },
  co_arranger: { icon: Handshake, tone: "neutral" },
  underwriter: { icon: Handshake, tone: "neutral" },
  book_runner: { icon: Handshake, tone: "neutral" },
  lead_manager: { icon: Handshake, tone: "neutral" },
  syndicate_member: { icon: Handshake, tone: "neutral" },
  selling_broker: { icon: Handshake, tone: "neutral" },
  allocator: { icon: Handshake, tone: "neutral" },

  // Ops / fiduciary / advisory → Phosphor.
  trustee: { icon: Scales, tone: "neutral" },
  registrar: { icon: FileText, tone: "neutral" },
  escrow_agent: { icon: FileText, tone: "neutral" },
  legal_counsel: { icon: Briefcase, tone: "neutral" },
  auditor: { icon: CheckCircle, tone: "neutral" },

  // M&A sides → Briefcase / Target.
  target: { icon: Target, tone: "neutral" },
  acquirer: { icon: Briefcase, tone: "neutral" },
  buy_side_advisor: { icon: Briefcase, tone: "neutral" },
  sell_side_advisor: { icon: Briefcase, tone: "neutral" },
};

const DEFAULT_ROLE_CONCEPT: Concept = { icon: Buildings, tone: "neutral" };

export function partyRoleConcept(role: string | null | undefined): Concept {
  if (!role) return DEFAULT_ROLE_CONCEPT;
  return ROLE_CONCEPTS[role] ?? DEFAULT_ROLE_CONCEPT;
}

export interface PartyRoleGlyphProps {
  role: string | null | undefined;
  size?: IconSize;
  tone?: IconTone;
  /** Render the lead party in the gold accent (the premium "lead" cue). */
  lead?: boolean;
  className?: string;
}

/** PartyRoleGlyph - the machined linked-party avatar disc for a deal card. */
export function PartyRoleGlyph({
  role,
  size = 16,
  tone,
  lead = false,
  className,
}: PartyRoleGlyphProps) {
  const concept = partyRoleConcept(role);
  // Lead overrides to gold (the single premium accent per card) unless the
  // caller forced a tone.
  const finalTone = tone ?? (lead ? "gold" : concept.tone);

  if (concept.mark) {
    return (
      <span
        data-slot="party-role-glyph"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full ring-1 transition-colors duration-300 ease-soft",
          DISC_SIZE[size],
          DISC_TONE[finalTone],
          className,
        )}
      >
        {concept.mark({ size: MARK_PX[size], tone: finalTone })}
      </span>
    );
  }

  return (
    <IconTile
      icon={concept.icon as PhosphorIcon}
      size={size}
      tone={finalTone}
      className={className}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   creditBand - re-exported from the server-safe `deal-type-credit` module so
   both Server Components (/deals/[id]) and Client Components (this board view)
   share ONE source of truth. The canonical definition lives in
   `./deal-type-credit` (no "use client") because it is a pure function;
   re-exporting here keeps existing client-side importers
   (`deals-board-view.tsx`) working without touching their import sites.
   ────────────────────────────────────────────────────────────────────────── */

export { creditBand, type CreditBand } from "./deal-type-credit";
