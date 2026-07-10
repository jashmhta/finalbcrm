"use client";

/**
 * Icon Language - the bespoke iconography layer.
 *
 * Two concerns live here:
 *
 *  1. `IconTile` - a hairline-disc "well" that frames a Phosphor Light glyph
 *     at one of three canonical sizes (16 / 20 / 24) with four tone variants
 *     (neutral / emerald / gold / down). This is the consistent container the
 *     whole app uses so iconography reads as a single machined system rather
 *     than free-floating glyphs of varying weight/size. It is the icon
 *     analogue of the double-bezel Card: a crafted object, not a bare icon.
 *
 *  2. The custom inline SVG MARKS - seven brand-concept glyphs (the Binary B,
 *     a bond/coupon, a rating ladder, an exposure gauge, a mandate seal, a
 *     KYC shield, a G-Sec / sovereign building) drawn as hairline strokes in
 *     emerald/gold. These are NOT stock icons - they are the CRM's own visual
 *     vocabulary for its core concepts, distinct from Phosphor's generic set.
 *     Pure SVG (no phosphor, no hooks) so they render via the client SSR path
 *     at 20px by default and inherit tone from the `tone` prop.
 *
 * Both are `"use client"` so the phosphor import in IconTile stays behind the
 * client boundary (per icons.tsx / credit-icons.tsx). The marks themselves are
 * plain SVG and would render server-side, but co-locating keeps the icon
 * language in one owned module. Callers in server pages import the icon they
 * pass to `IconTile` from the client boundary (`@/components/brand/icons`) so
 * the `icon` prop crosses the RSC wire as a serializable client reference,
 * never as a closure (per the never-pass-function-props rule).
 */
import * as React from "react";
import type { Icon as PhosphorIcon, IconProps } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
   Tone + size tokens - shared by IconTile and the custom marks.
   ────────────────────────────────────────────────────────────────────────── */

export type IconTone = "neutral" | "emerald" | "gold" | "down";
export type IconSize = 16 | 20 | 24;

/** Resolve a tone to a CSS color value for stroke/fill. `neutral` defers to
 *  `currentColor` so the mark inherits text color from its container (the
 *  default text-white/55 etc. treatment the design system prescribes).
 *  `emerald` renders the GOLD brand accent (alias) - the primary accent is
 *  gold; emerald is reserved for semantic financial up/down elsewhere
 *  (Money / Badge `up` / StatCard `up`, which draw from --up). */
function toneColor(tone: IconTone): string {
  switch (tone) {
    case "emerald":
      return "var(--gold)";
    case "gold":
      return "var(--gold)";
    case "down":
      return "var(--down)";
    case "neutral":
    default:
      return "currentColor";
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   IconTile - the hairline-disc well + Phosphor Light glyph.
   ────────────────────────────────────────────────────────────────────────── */

/** Disc + glyph sizing per canonical size. The disc is ~1.8x the glyph so the
 *  machined well reads as a frame, not a tight capsule. */
const DISC_SIZE: Record<IconSize, string> = {
  16: "size-7 [&_svg]:size-4",
  20: "size-9 [&_svg]:size-5",
  24: "size-11 [&_svg]:size-6",
};

/** Tone treatment - hairline ring + faint tint + tinted text. Mirrors the
 *  EmptyState glyph disc so the two systems read as one. `emerald` aliases the
 *  gold brand accent disc (the primary accent is gold). */
const DISC_TONE: Record<IconTone, string> = {
  neutral: "ring-hairline bg-foreground/[0.03] text-muted-foreground",
  emerald: "ring-gold/22 bg-gold/[0.06] text-gold/85",
  gold: "ring-gold/22 bg-gold/[0.06] text-gold/85",
  down: "ring-down/22 bg-down/[0.06] text-down/85",
};

export interface IconTileProps
  extends Omit<IconProps, "size" | "weight" | "color"> {
  /** A Phosphor icon component (imported from the client boundary). */
  icon: PhosphorIcon;
  /** Canonical glyph size - 16 (inline), 20 (lists, default), 24 (hero). */
  size?: IconSize;
  /** Tone variant - neutral default; emerald (gold alias)/gold reserved for
   *  active or high-signal states per the design system's restrained accent
   *  rule. */
  tone?: IconTone;
  /** Phosphor weight - defaults to "light" (the banned-thick-Lucide antidote). */
  weight?: IconProps["weight"];
  /** Skip the disc well and render the bare glyph (sized + toned only). */
  bare?: boolean;
  className?: string;
}

/**
 * IconTile - the consistent icon container.
 *
 *   <IconTile icon={ShieldCheck} tone="emerald" />            // 20px default
 *   <IconTile icon={Calculator} size={24} tone="gold" />      // hero
 *   <IconTile icon={ArrowRight} size={16} bare />             // inline
 *
 * The disc well is a hairline ring + faint tint - the same machined treatment
 * as the EmptyState glyph disc, so empty states and populated rows share one
 * iconographic language. `bare` opts out of the well for inline table cells
 * and nav items where the frame would add noise.
 */
export const IconTile = React.forwardRef<HTMLSpanElement, IconTileProps>(
  function IconTile(
    { icon: Icon, size = 20, tone = "neutral", weight = "light", bare = false, className, ...rest },
    ref,
  ) {
    if (bare) {
      return (
        <span
          ref={ref}
          data-slot="brand-icon-tile"
          className={cn(
            "inline-flex shrink-0 items-center justify-center transition-colors duration-300 ease-soft [&_svg]:shrink-0",
            DISC_SIZE[size],
            tone === "emerald" && "text-gold/85",
            tone === "gold" && "text-gold/85",
            tone === "down" && "text-down/85",
            tone === "neutral" && "text-muted-foreground",
            className,
          )}
        >
          <Icon weight={weight} {...rest} />
        </span>
      );
    }
    return (
      <span
        ref={ref}
        data-slot="brand-icon-tile"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full ring-1 transition-colors duration-300 ease-soft [&_svg]:shrink-0",
          DISC_SIZE[size],
          DISC_TONE[tone],
          className,
        )}
      >
        <Icon weight={weight} {...rest} />
      </span>
    );
  },
);
IconTile.displayName = "IconTile";

/* ──────────────────────────────────────────────────────────────────────────
   Custom MARKS - bespoke brand-concept glyphs.
   Pure hairline SVG, 24x24 viewBox, drawn at 20px by default. Strokes use
   `toneColor(tone)` so gold reads as the brand accent (emerald is a gold
   alias) and neutral defers to currentColor. Distinct from stock Phosphor -
   these are the CRM's own visual vocabulary.
   ────────────────────────────────────────────────────────────────────────── */

export interface MarkProps {
  /** Rendered pixel size (square). Defaults to 20 - the list/row canonical. */
  size?: number;
  /** Tone - neutral defers to currentColor; emerald (gold alias)/gold/down use brand tokens. */
  tone?: IconTone;
  /** Stroke width override (defaults to 1.25 - hairline). */
  strokeWidth?: number;
  className?: string;
  /** Accessible label; when omitted the mark is aria-hidden (decorative). */
  title?: string;
}

const MARK_BASE = (
  size: number,
  className?: string,
  title?: string,
): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  className: cn("shrink-0", className),
  "aria-hidden": title ? undefined : true,
  role: title ? "img" : undefined,
  ...(title ? { "aria-label": title } : null),
});

const STROKE_PROPS = (stroke: string, strokeWidth = 1.25) => ({
  stroke,
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

/**
 * BinaryBMark - the "Binary Capital" B motif. A vertical stem + two stacked
 * rounded lobes; the bottom lobe is wider (the typographic B). Default gold -
 * the signature brand accent for the logo mark.
 */
export function BinaryBMark({
  size = 20,
  tone = "gold",
  strokeWidth = 1.25,
  className,
  title,
}: MarkProps) {
  const stroke = toneColor(tone);
  return (
    <svg {...MARK_BASE(size, className, title)}>
      {/* Stem */}
      <path d="M8 4.5V19.5" {...STROKE_PROPS(stroke, strokeWidth)} />
      {/* Top lobe - closed against the stem */}
      <path
        d="M8 5H14.2C16.6 5 18.4 6.6 18.4 8.6C18.4 10.6 16.6 12.2 14.2 12.2H8"
        {...STROKE_PROPS(stroke, strokeWidth)}
      />
      {/* Bottom lobe - wider, the typographic B's fuller lower bowl */}
      <path
        d="M8 11.8H15C17.4 11.8 19.2 13.5 19.2 15.6C19.2 17.7 17.4 19.5 15 19.5H8"
        {...STROKE_PROPS(stroke, strokeWidth)}
      />
    </svg>
  );
}

/**
 * BondCouponMark - a bond / coupon ticket. A rounded ticket with a perforated
 * edge (dashed) splitting face value from the coupon, plus a small punch dot.
 * Reads as a fixed-income instrument, not a generic "document."
 */
export function BondCouponMark({
  size = 20,
  tone = "neutral",
  strokeWidth = 1.25,
  className,
  title,
}: MarkProps) {
  const stroke = toneColor(tone);
  return (
    <svg {...MARK_BASE(size, className, title)}>
      {/* Ticket body */}
      <rect
        x="3.5"
        y="7"
        width="17"
        height="10"
        rx="2"
        {...STROKE_PROPS(stroke, strokeWidth)}
      />
      {/* Perforation - dashed vertical seam */}
      <path
        d="M12 7.5V16.5"
        {...STROKE_PROPS(stroke, strokeWidth)}
        strokeDasharray="1.6 1.8"
      />
      {/* Coupon punch dot (left = face, right = coupon) */}
      <circle cx="7.6" cy="12" r="1.1" {...STROKE_PROPS(stroke, strokeWidth)} />
    </svg>
  );
}

/**
 * RatingLadderMark - a rating scale ladder. Four ascending steps of
 * increasing length, left-anchored - reads as a notch ladder (AAA → sub-IG),
 * the credit-rating visual the credit workspace highlights an issuer's notch on.
 */
export function RatingLadderMark({
  size = 20,
  tone = "gold",
  strokeWidth = 1.25,
  className,
  title,
}: MarkProps) {
  const stroke = toneColor(tone);
  return (
    <svg {...MARK_BASE(size, className, title)}>
      <path d="M5 7H10" {...STROKE_PROPS(stroke, strokeWidth)} />
      <path d="M5 11.3H13" {...STROKE_PROPS(stroke, strokeWidth)} />
      <path d="M5 15.6H16" {...STROKE_PROPS(stroke, strokeWidth)} />
      <path d="M5 19.9H19" {...STROKE_PROPS(stroke, strokeWidth)} />
      {/* Vertical spine tying the steps into a ladder */}
      <path d="M5 6V20.5" {...STROKE_PROPS(stroke, strokeWidth)} />
    </svg>
  );
}

/**
 * ExposureGaugeMark - an exposure / utilization gauge. A semicircular arc with
 * a needle indicating current exposure against a limit. Reads as "how full is
 * the bucket" - the exposure concept the dashboard + party explorer surface.
 */
export function ExposureGaugeMark({
  size = 20,
  tone = "gold",
  strokeWidth = 1.25,
  className,
  title,
}: MarkProps) {
  const stroke = toneColor(tone);
  const needle = tone === "neutral" ? "var(--foreground)" : stroke;
  return (
    <svg {...MARK_BASE(size, className, title)}>
      {/* Gauge arc - semicircle, open at the bottom */}
      <path
        d="M4.2 16.2A8 8 0 0 1 19.8 16.2"
        {...STROKE_PROPS(stroke, strokeWidth)}
      />
      {/* Limit ticks at the endpoints */}
      <path d="M4.2 16.2L3.4 15.4" {...STROKE_PROPS(stroke, strokeWidth)} />
      <path d="M19.8 16.2L20.6 15.4" {...STROKE_PROPS(stroke, strokeWidth)} />
      {/* Needle - pivots from the base center, pointing up-right at ~70% */}
      <path
        d="M12 16.4L17.1 9.6"
        {...STROKE_PROPS(needle, strokeWidth)}
      />
      {/* Pivot dot */}
      <circle cx="12" cy="16.4" r="1" {...STROKE_PROPS(needle, strokeWidth)} />
    </svg>
  );
}

/**
 * MandateMark - a mandate / engagement letter. A document with a folded
 * corner and a small seal at the foot. Reads as a signed engagement (the
 * CRM's "mandate" concept for a deal/issuer relationship), not a generic file.
 */
export function MandateMark({
  size = 20,
  tone = "neutral",
  strokeWidth = 1.25,
  className,
  title,
}: MarkProps) {
  const stroke = toneColor(tone);
  const seal = tone === "neutral" ? "var(--gold)" : stroke;
  return (
    <svg {...MARK_BASE(size, className, title)}>
      {/* Document body with folded top-right corner */}
      <path
        d="M6.5 4.5H14.3L18 8.2V19.5H6.5Z"
        {...STROKE_PROPS(stroke, strokeWidth)}
      />
      {/* Folded corner */}
      <path
        d="M14.3 4.5V8.2H18"
        {...STROKE_PROPS(stroke, strokeWidth)}
      />
      {/* Text lines */}
      <path d="M9 12.2H15.5" {...STROKE_PROPS(stroke, strokeWidth)} />
      <path d="M9 15H13" {...STROKE_PROPS(stroke, strokeWidth)} />
      {/* Seal - a small ring at the foot, gold by default (the "engagement" accent) */}
      <circle
        cx="16.4"
        cy="17.2"
        r="1.6"
        {...STROKE_PROPS(seal, strokeWidth)}
      />
    </svg>
  );
}

/**
 * KycShieldMark - a KYC / compliance shield with a check. Distinct from
 * Phosphor's ShieldCheck: the shield has a flatter base + crisper point and
 * the check is drawn as a single hairline path, matching the mark family.
 */
export function KycShieldMark({
  size = 20,
  tone = "gold",
  strokeWidth = 1.25,
  className,
  title,
}: MarkProps) {
  const stroke = toneColor(tone);
  return (
    <svg {...MARK_BASE(size, className, title)}>
      <path
        d="M12 3.2L19 5.8V11.4C19 15.4 16.1 18.7 12 20.2C7.9 18.7 5 15.4 5 11.4V5.8Z"
        {...STROKE_PROPS(stroke, strokeWidth)}
      />
      <path
        d="M8.8 11.8L11 14L15.4 9.4"
        {...STROKE_PROPS(stroke, strokeWidth)}
      />
    </svg>
  );
}

/**
 * GSecRupeeMark - a G-Sec / sovereign security: a classical government
 * building (pediment + entablature + three columns + base). Reads as a
 * sovereign / government-issued instrument, distinct from a generic bank.
 * Default gold - the "risk-free" premium accent.
 */
export function GSecRupeeMark({
  size = 20,
  tone = "gold",
  strokeWidth = 1.25,
  className,
  title,
}: MarkProps) {
  const stroke = toneColor(tone);
  return (
    <svg {...MARK_BASE(size, className, title)}>
      {/* Pediment (roof) */}
      <path d="M3.5 9.2L12 4.4L20.5 9.2Z" {...STROKE_PROPS(stroke, strokeWidth)} />
      {/* Entablature */}
      <path d="M4.5 9.2H19.5" {...STROKE_PROPS(stroke, strokeWidth)} />
      {/* Base */}
      <path d="M5 19.5H19" {...STROKE_PROPS(stroke, strokeWidth)} />
      {/* Three columns */}
      <path d="M8 10.2V18.6" {...STROKE_PROPS(stroke, strokeWidth)} />
      <path d="M12 10.2V18.6" {...STROKE_PROPS(stroke, strokeWidth)} />
      <path d="M16 10.2V18.6" {...STROKE_PROPS(stroke, strokeWidth)} />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   ICON map - a single registry of the custom marks keyed by concept.
   Screen agents render < ICON.binary /> etc., or look up by key for
   polymorphic type-coded rows (party type → concept mark).
   ────────────────────────────────────────────────────────────────────────── */

export type IconKey =
  | "binary"
  | "bond"
  | "ratingLadder"
  | "exposure"
  | "mandate"
  | "kyc"
  | "gsec";

export interface IconMarkComponentProps extends MarkProps {
  /** Optional key echo for self-documenting usage in maps; ignored on render. */
  k?: IconKey;
}

/** The custom-mark registry. Each value is the render function. */
export const ICON: Record<IconKey, (props: MarkProps) => React.ReactElement> = {
  binary: BinaryBMark,
  bond: BondCouponMark,
  ratingLadder: RatingLadderMark,
  exposure: ExposureGaugeMark,
  mandate: MandateMark,
  kyc: KycShieldMark,
  gsec: GSecRupeeMark,
} as const;
