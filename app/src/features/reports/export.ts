// CSV export utility for the Reports & Export module.
//
// `rowsToCsv` is a PURE function - given an array of rows and an ordered list
// of column definitions (header + value accessor), it produces an RFC 4180-
// compliant CSV string with a UTF-8 BOM (so Excel on Windows opens the Indic
// + rupee figures correctly) and proper field escaping (fields containing a
// comma, double-quote, CR, or LF are wrapped in double quotes with internal
// quotes doubled). It is safe to call from a Route Handler and from Server
// Components.
//
// The Route Handler (src/app/reports/export/route.ts) calls `rowsToCsv` and
// returns the string with `Content-Type: text/csv` + a
// `Content-Disposition: attachment; filename="..."` header, so the browser
// handles the download natively - no client-side blob gymnastics, no function
// props crossing the RSC boundary. The on-page "Export CSV" buttons are plain
// anchors to the export route with the current filter params forwarded.

import type { ExportColumn } from "./queries";

/** Prefix every CSV with a UTF-8 BOM so Excel on Windows interprets the
 *  encoding correctly (rupee figures, en-IN digit grouping). */
const UTF8_BOM = "﻿";

/** RFC 4180 field escape - wrap in double quotes if the value contains a
 *  comma, double-quote, CR, or LF; double any internal double-quotes. */
function escapeField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build an RFC 4180 CSV string from `rows` + `columns`. The first row is the
 * header (each column's `header` label, escaped); each subsequent row is the
 * column values in order. Lines are CRLF-terminated (the RFC line separator,
 * which Excel/Numbers/Google Sheets all read correctly).
 */
export function rowsToCsv<T>(
  rows: readonly T[],
  columns: readonly ExportColumn<T>[],
): string {
  const header = columns.map((c) => escapeField(c.header)).join(",");
  const lines = [header];
  for (const row of rows) {
    const line = columns.map((c) => escapeField(c.value(row))).join(",");
    lines.push(line);
  }
  // Trailing CRLF - the RFC 4180 end-of-file convention; Excel/Numbers/Sheets
  // all read a final blank line cleanly.
  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}

/**
 * Build a safe, human-readable download filename: `<prefix>-<yyyymmdd>.csv`.
 * The date stamp lets a desk officer keep multiple exports without collision
 * and matches the convention of a daily blotter snapshot.
 */
export function exportFilename(prefix: string): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const safePrefix = prefix.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "export";
  return `${safePrefix}-${yyyy}${mm}${dd}.csv`;
}

/** The canonical Content-Disposition header value for a CSV attachment. */
export function csvDisposition(filename: string): string {
  // `filename*=UTF-8''…` is the RFC 5987 encoded form that preserves unicode
  // in the filename across browsers; `filename=…` is the legacy ASCII fallback.
  const ascii = filename.replace(/[^a-z0-9.-]+/gi, "_");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

// ---------------------------------------------------------------------------
// Crore formatters - the CRM stores deal.target_size, deal.fee_structure-
// derived fees, and exposure.gross_exposure in CRORES (the Indian IB
// convention; the deals seed `25 * 48^rnd()` and the matching feature's
// `targetSizeCrores` both write crores directly). These format a crore value
// for on-screen tables / KPIs / chart axes WITHOUT a rupee→crore division.
// Pure + server/client safe (no db imports) so both the server report pages
// and the client views import them from here.
// ---------------------------------------------------------------------------

/** Format a crore-denominated value as "₹{value} Cr" with en-IN grouping.
 *  `decimals` controls dp (default 2). Returns "-" for null/NaN. */
export function formatCr(
  v: number | null | undefined,
  opts: { decimals?: number } = {},
): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "-";
  const d = opts.decimals ?? 2;
  return `₹${v.toLocaleString("en-IN", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })} Cr`;
}

/** Compact crore formatter for chart axes + KPI eyebrows:
 *   ≥ 1,00,000 cr → "₹X.XX T"  (lakh-crore = trillion)
 *   ≥ 1,000 cr    → "₹X.XK Cr"
 *   else          → "₹XXX Cr" */
export function compactCr(v: number): string {
  if (!Number.isFinite(v)) return "-";
  const abs = Math.abs(v);
  if (abs >= 100000)
    return `₹${(v / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })}T`;
  if (abs >= 1000)
    return `₹${(v / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 })}K Cr`;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
}

// ---------------------------------------------------------------------------
// Rating-tier helpers - the scorecard `band` column holds long-term rating
// letters (AAA, AA+, AA, AA-, A+, A, A-, BBB+, BBB, BBB-, BB+, … D), NOT the
// BC-1..BC-6 internal bands. These map a rating letter to a semantic tier
// (emerald = prime IG, gold = lower IG, info = crossover/sub-IG, down = high
// yield/distressed) for badge variants + chart cell colors. Pure + shared by
// the credit report page (server) and the credit report view (client).
// ---------------------------------------------------------------------------

export type RatingTier = "emerald" | "gold" | "info" | "down" | "neutral";

/** Map a long-term rating letter to a semantic tier. */
export function ratingTier(r: string | null | undefined): RatingTier {
  if (!r) return "neutral";
  if (r === "AAA" || /^AA[+-]?$/.test(r)) return "emerald"; // AAA, AA+, AA, AA-
  if (r === "A+" || r === "A") return "emerald"; // strong IG
  if (r === "A-") return "gold"; // lower IG
  if (/^BBB[+-]?$/.test(r)) return "info"; // BBB+, BBB, BBB-
  if (/^BB[+-]?$/.test(r) || /^B[+-]?$/.test(r)) return "down"; // BB/B
  if (/^C/.test(r) || r === "D") return "down"; // CCC/CC/C/D
  return "neutral";
}

/** Rating letter → CSS var color (for recharts Cell fills). */
export function ratingTierColor(r: string | null | undefined): string {
  switch (ratingTier(r)) {
    case "emerald":
      return "var(--emerald)";
    case "gold":
      return "var(--gold)";
    case "info":
      return "var(--info)";
    case "down":
      return "var(--down)";
    default:
      return "var(--muted-foreground)";
  }
}

/** The standard long-term rating ladder (AAA → D) - used by the credit
 *  report's band-filter dropdown so every notch is selectable even when the
 *  current filter narrows the on-screen band distribution. */
export const RATING_LADDER = [
  "AAA",
  "AA+",
  "AA",
  "AA-",
  "A+",
  "A",
  "A-",
  "BBB+",
  "BBB",
  "BBB-",
  "BB+",
  "BB",
  "BB-",
  "B+",
  "B",
  "B-",
  "CCC+",
  "CCC",
  "CCC-",
  "CC",
  "C",
  "D",
] as const;


