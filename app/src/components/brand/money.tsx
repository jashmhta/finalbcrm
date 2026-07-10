import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Money - Geist Mono, tabular-nums financial formatter. The single biggest
 * "expensive fintech" tell: every figure in the CRM renders through this so
 * digits align in columns and never jitter.
 *
 * Server-safe (no hooks) - use freely inside server components and table cells.
 */

export interface MoneyOptions {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  notation?: "standard" | "compact";
}

/** Format a number as a currency string (no symbol styling). */
export function formatMoney(
  value: number | null | undefined,
  {
    currency = "INR",
    locale = currency === "INR" ? "en-IN" : "en-US",
    minimumFractionDigits,
    maximumFractionDigits,
    notation = "standard",
  }: MoneyOptions = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

/** Compact Indian short form - ₹4.25 Cr / ₹85.00 L / ₹12,500. */
export function compactINR(
  value: number | null | undefined,
  opts: { signed?: boolean } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const sign = opts.signed ? (value > 0 ? "+" : value < 0 ? "−" : "") : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const fmt = (n: number, d: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
  if (abs >= 1e7) return `${sign}₹${fmt(abs / 1e7, 2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${fmt(abs / 1e5, 2)} L`;
  if (abs >= 1e3) return `${sign}₹${fmt(abs / 1e3, 1)}K`;
  return `${sign}₹${fmt(abs, 0)}`;
}

/**
 * Serializable format presets - the RSC-safe way for SERVER components to ask
 * StatCard / ScoreRing for a particular number rendering. Server components
 * cannot pass a `format` function across the server→client boundary ("Functions
 * cannot be passed directly to Client Components"), so they pass one of these
 * preset strings instead; the client component maps it to the formatter below.
 * Client components may still pass a `format` function directly.
 */
export type FormatPreset =
  | "int"
  | "decimal1"
  | "decimal3"
  | "percent1"
  | "percent3"
  | "currency"
  | "raw";

export const FORMAT_PRESETS: Record<FormatPreset, (n: number) => string> = {
  int: (n) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 }),
  decimal1: (n) => n.toFixed(1),
  decimal3: (n) => n.toFixed(3),
  percent1: (n) => `${n.toFixed(1)}%`,
  percent3: (n) => `${n.toFixed(3)}%`,
  currency: (n) => compactINR(n),
  raw: (n) => String(n),
};

export interface MoneyProps extends MoneyOptions {
  value: number | null | undefined;
  /** Prefix + on positive values (for deltas). */
  signed?: boolean;
  /** Color the value by sign (green up / rose down - draws from --up / --down,
   *  the semantic financial tokens, not --emerald). */
  toneOnSign?: boolean;
  /** Use compact Indian short form (Cr/L/K) instead of full currency. */
  compact?: boolean;
  className?: string;
}

export function Money({
  value,
  currency = "INR",
  locale,
  minimumFractionDigits,
  maximumFractionDigits,
  notation = "standard",
  signed = false,
  toneOnSign = false,
  compact = false,
  className,
}: MoneyProps) {
  const missing =
    value === null || value === undefined || Number.isNaN(value);
  const text = missing
    ? "-"
    : compact
      ? compactINR(value, { signed })
      : formatMoney(value, {
          currency,
          locale,
          minimumFractionDigits,
          maximumFractionDigits,
          notation,
        });

  // When signed but not compact, prepend + to positive values.
  let display = text;
  if (!missing && signed && !compact && value! > 0 && !text.startsWith("+")) {
    display = `+${text}`;
  }

  const tone = !missing && toneOnSign ? (value! > 0 ? "text-up" : value! < 0 ? "text-down" : "text-foreground") : undefined;

  return (
    <span
      data-slot="brand-money"
      className={cn("nums tabular-nums font-medium", tone, className)}
    >
      {display}
    </span>
  );
}

/** Plain number (no currency) in mono tabular-nums - ratings, counts, ratios. */
export function Num({
  value,
  format,
  signed = false,
  toneOnSign = false,
  className,
}: {
  value: number | null | undefined;
  /** Suffix like "%", "×", "bps". */
  format?: (n: number) => string;
  signed?: boolean;
  toneOnSign?: boolean;
  className?: string;
}) {
  const missing = value === null || value === undefined || Number.isNaN(value);
  if (missing)
    return (
      <span className={cn("nums tabular-nums", className)} data-slot="brand-num">
        -
      </span>
    );
  const n = value as number;
  const sign = signed ? (n > 0 ? "+" : n < 0 ? "−" : "") : n < 0 ? "−" : "";
  const text = format ? format(Math.abs(n)) : String(Math.abs(n));
  const tone = toneOnSign ? (n > 0 ? "text-up" : n < 0 ? "text-down" : "text-foreground") : undefined;
  return (
    <span
      data-slot="brand-num"
      className={cn("nums tabular-nums font-medium", tone, className)}
    >
      {sign}
      {text}
    </span>
  );
}
