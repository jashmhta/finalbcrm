// Server-safe home for `creditBand` - the view-derived credit-character
// "rating chip" for a deal. This is a PURE function (no React, no Phosphor,
// no hooks) so it is safe to call from Server Components. It was previously
// co-located in `deal-type-icon.tsx`, which is `"use client"` (it imports
// Phosphor + IconTile), so calling it from the /deals/[id] Server Component
// threw "Attempted to call creditBand() from the server but creditBand is on
// the client." Moving it here lets both the server detail page and the client
// board view share one source of truth.
//
// `IconTone` is imported type-only (erased at compile) so this module does NOT
// pull the client icon-language graph into a server bundle.

import type { IconTone } from "@/components/brand/icon-language";

export interface CreditBand {
  /** Short notch code - SOV / IG / HY. */
  code: string;
  /** Full label for the tooltip / preview pane. */
  label: string;
  tone: IconTone;
}

/**
 * creditBand - the view-derived credit-character "rating chip" for a deal.
 * The deal row carries no agency rating; the deal_type encodes the credit
 * character of the mandate (sovereign = risk-free, vanilla bond = IG, HY
 * bond = sub-investment-grade). Returns null for non-credit deal types so the
 * chip only appears where it means something.
 */
export function creditBand(dealType: string | null | undefined): CreditBand | null {
  if (!dealType) return null;
  switch (dealType) {
    case "gsec_auction":
      return { code: "SOV", label: "Sovereign · risk-free", tone: "gold" };
    case "high_yield_bond":
      return { code: "HY", label: "High-yield · sub-investment-grade", tone: "down" };
    case "bond_underwriting":
      return { code: "IG", label: "Investment-grade", tone: "emerald" };
    default:
      return null;
  }
}
