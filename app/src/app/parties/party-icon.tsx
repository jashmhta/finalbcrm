"use client";

/**
 * PartyAvatar - the machined identity disc for a party row / preview / detail
 * header. Maps a party's PRIMARY type to one of the CRM's bespoke brand-concept
 * MARKS (issuer → mandate, investor → exposure gauge, rating agency → rating
 * ladder, guarantor / credit-enhancement → KYC shield) or, for the operational
 * roles (arranger, broker, legal counsel, auditor …), a Phosphor Light glyph -
 * both framed in the same hairline disc well as `IconTile`, so every party reads
 * as one machined iconographic system regardless of role.
 *
 * Tone is restrained per the design system: emerald for the "holds exposure /
 * backs" roles (investor, guarantor), gold for the premium-accent roles (rating
 * agency, credit-enhancement provider, prospect), neutral for the rest. The disc
 * never screams - it is the row's identity cue, not a status flag.
 *
 * Client-only: imports Phosphor icons from the `@/components/brand/icons`
 * client boundary + the custom MARKS + IconTile from the icon-language, so the
 * phosphor module scope stays behind the client boundary (per icons.tsx). Server
 * pages render `<PartyAvatar primaryType="issuer" />` - the props are plain
 * strings, never a closure, so it crosses the RSC wire cleanly.
 */
import * as React from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  ArrowsLeftRight,
  Briefcase,
  Buildings,
  Chats,
  CheckCircle,
  FileText,
  Handshake,
  IdentificationCard,
  Scales,
  Sparkle,
} from "@/components/brand/icons";
import {
  ExposureGaugeMark,
  IconTile,
  KycShieldMark,
  MandateMark,
  RatingLadderMark,
  type IconSize,
  type IconTone,
} from "@/components/brand";
import { cn } from "@/lib/utils";

/** The canonical type → concept mapping. `mark` wins over `icon` when both are
 *  set (the bespoke MARKS are the CRM's own vocabulary; Phosphor covers the
 *  operational roles that don't have a brand-concept glyph). */
interface Concept {
  mark?: (props: { size?: number; tone?: IconTone; className?: string }) => React.ReactElement;
  icon?: PhosphorIcon;
  tone: IconTone;
}

const CONCEPTS: Record<string, Concept> = {
  // Core financial-counterparty concepts → bespoke MARKS.
  issuer: { mark: MandateMark, tone: "neutral" },
  investor: { mark: ExposureGaugeMark, tone: "emerald" },
  rating_agency: { mark: RatingLadderMark, tone: "gold" },
  guarantor: { mark: KycShieldMark, tone: "emerald" },
  credit_enhancement_provider: { mark: KycShieldMark, tone: "gold" },

  // Operational roles → Phosphor Light glyphs in the same disc well.
  arranger: { icon: Handshake, tone: "neutral" },
  underwriter: { icon: Handshake, tone: "neutral" },
  broker: { icon: ArrowsLeftRight, tone: "neutral" },
  intermediary: { icon: ArrowsLeftRight, tone: "neutral" },
  ifa: { icon: Chats, tone: "neutral" },
  trustee: { icon: Scales, tone: "neutral" },
  registrar: { icon: FileText, tone: "neutral" },
  legal_counsel: { icon: Briefcase, tone: "neutral" },
  auditor: { icon: CheckCircle, tone: "neutral" },
  spv: { icon: Buildings, tone: "neutral" },
  prospect: { icon: Sparkle, tone: "gold" },
};

const DEFAULT_CONCEPT: Concept = { icon: Buildings, tone: "neutral" };

export function partyConcept(primaryType: string | null | undefined): Concept {
  if (!primaryType) return DEFAULT_CONCEPT;
  return CONCEPTS[primaryType] ?? DEFAULT_CONCEPT;
}

export interface PartyAvatarProps {
  /** The party's primary type (first `types[]` entry). Falls back to a building
   *  glyph when unknown / unset. */
  primaryType?: string | null;
  /** Canonical glyph size - 16 (inline), 20 (list rows, default), 24 (hero). */
  size?: IconSize;
  /** Override the concept tone (e.g. force neutral in a muted context). */
  tone?: IconTone;
  className?: string;
}

export function PartyAvatar({
  primaryType,
  size = 20,
  tone,
  className,
}: PartyAvatarProps) {
  const concept = partyConcept(primaryType);
  const finalTone = tone ?? concept.tone;

  if (concept.mark) {
    // Custom MARK - render it inside the same hairline disc well as IconTile so
    // the bespoke glyphs and the Phosphor glyphs share one container language.
    // The disc classes mirror IconTile's DISC_TONE treatment exactly.
    const discTone: Record<IconTone, string> = {
      neutral: "ring-hairline bg-foreground/[0.03] text-muted-foreground",
      emerald: "ring-emerald/22 bg-emerald/[0.06] text-emerald/85",
      gold: "ring-gold/22 bg-gold/[0.06] text-gold/85",
      down: "ring-down/22 bg-down/[0.06] text-down/85",
    };
    const discSize: Record<IconSize, string> = {
      16: "size-7",
      20: "size-9",
      24: "size-11",
    };
    const markPx: Record<IconSize, number> = { 16: 16, 20: 20, 24: 24 };
    return (
      <span
        data-slot="party-avatar"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full ring-1 transition-colors duration-300 ease-soft",
          discSize[size],
          discTone[finalTone],
          className,
        )}
      >
        {concept.mark({ size: markPx[size], tone: finalTone })}
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
