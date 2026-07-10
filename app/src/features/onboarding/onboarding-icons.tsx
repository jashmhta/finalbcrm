"use client";

/**
 * Onboarding iconography resolver - maps an onboarding stage + a checklist
 * document key to the right Phosphor Light glyph.
 *
 * Client-only: imports Phosphor directly from @phosphor-icons/react (allowed
 * inside a "use client" module - the phosphor server-bundle hazard only bites
 * server components). Server pages render `<OnboardingDocIcon docKey="pan_card" />`
 * - the prop is a plain serializable string, so it crosses the RSC wire cleanly
 * (never a closure), and the icon resolves on the client SSR path.
 */
import * as React from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  Buildings,
  Certificate,
  ChartBar,
  CheckCircle,
  Fingerprint,
  FileText,
  IdentificationCard,
  Scales,
  SealCheck,
  ShieldCheck,
  Stamp,
  Users,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { IconTone } from "@/components/brand";
import type { OnboardingDocKey, OnboardingStage } from "./types";

type IconWeight = "thin" | "light" | "regular";

interface IconProps {
  className?: string;
  weight?: IconWeight;
}

/** Document key → concept glyph. Each of the 7 checklist docs gets its own
 *  visual cue so the checklist reads at a glance. */
const DOC_ICONS: Record<OnboardingDocKey, PhosphorIcon> = {
  incorporation_certificate: Certificate,
  pan_card: IdentificationCard,
  board_resolution: Stamp,
  authorised_signatory_kyc: Fingerprint,
  financial_statements: ChartBar,
  beneficial_ownership_declaration: Users,
  consent_form: CheckCircle,
};

/** Stage → concept glyph (used by the stepper + the board column headers). */
const STAGE_ICONS: Record<OnboardingStage, PhosphorIcon> = {
  initiated: Buildings,
  profile_created: IdentificationCard,
  documents_collected: FileText,
  kyc_verified: ShieldCheck,
  compliance_approved: SealCheck,
  active: CheckCircle,
};

/** Stage → tone (the IconTile well hue + the badge hue). */
export const ONBOARDING_STAGE_ICON_TONE: Record<OnboardingStage, IconTone> = {
  initiated: "neutral",
  profile_created: "neutral",
  documents_collected: "gold",
  kyc_verified: "gold",
  compliance_approved: "emerald",
  active: "emerald",
};

/** Render a document-key glyph (Phosphor Light, inherits currentColor). */
export function OnboardingDocIcon({
  docKey,
  className,
  weight = "light",
}: IconProps & { docKey: OnboardingDocKey }) {
  const Icon = DOC_ICONS[docKey];
  return <Icon weight={weight} className={cn(className)} aria-hidden />;
}

/** Render a stage glyph (Phosphor Light, inherits currentColor). */
export function OnboardingStageIcon({
  stage,
  className,
  weight = "light",
}: IconProps & { stage: OnboardingStage }) {
  const Icon = STAGE_ICONS[stage];
  return <Icon weight={weight} className={cn(className)} aria-hidden />;
}

/** The tone for a stage - used by callers that frame the glyph in an IconTile. */
export function onboardingStageTone(stage: OnboardingStage): IconTone {
  return ONBOARDING_STAGE_ICON_TONE[stage];
}

// Re-export the Scales icon (used by the compliance CTA) so the view layer has a
// single import path for the compliance glyph.
export { Scales as ComplianceScaleIcon };
