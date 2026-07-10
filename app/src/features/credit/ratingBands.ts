// Pure rating-band helpers - the DB-free subset of ratingMap.ts.
//
// `ratingMap.ts` historically bundled the pure cross-agency ordinal→band
// mapping with the DB-backed ladder loader (`loadLadder`/`resolveRung`, which
// import `@/db`). Anything that imported even the pure helpers - notably the
// Investor Matching Engine (`features/matching/engine.ts`), which is consumed
// by a client component - transitively pulled `postgres` (and its Node `tls`/
// `net`/`fs` deps) into the client bundle, breaking `next build`.
//
// This module is the single source of truth for the pure band mapping: no
// `@/db` import, safe to import from client components. `ratingMap.ts` re-
// exports these so its existing consumers (and the ratingMap test suite) are
// unaffected.

import type { Band } from "./scorecard";

export type RatingAgency =
  | "CRISIL"
  | "ICRA"
  | "CARE"
  | "India_Ratings"
  | "Acuite"
  | "Infomerics"
  | "Brickwork";

// ---------------------------------------------------------------------------
// Static spec §5 mapping (fallback / canonical). rank is the cross-agency
// ordinal; band is the internal band that rank maps to.
// ---------------------------------------------------------------------------

const RANK_TO_BAND: Record<number, Band> = {
  1: "BC-1", // AAA
  2: "BC-1", // AA+
  3: "BC-2", // AA
  4: "BC-2", // AA-
  5: "BC-3", // A+
  6: "BC-3", // A
  7: "BC-3", // A-
  8: "BC-4", // BBB+
  9: "BC-4", // BBB
  10: "BC-4", // BBB-
  11: "BC-5", // BB+
  12: "BC-5", // BB
  13: "BC-5", // BB-
  14: "BC-5", // B+
  15: "BC-6", // B / B-
  16: "BC-6", // C / IND CCC / BWR C
  17: "BC-6", // IND CC (India Ratings only)
  18: "BC-6", // IND C (India Ratings only - distinct from IND CCC)
  19: "BC-6", // D / IND D / BWR D
};

/** Canonical (mid-band) symbol per agency, used by bandToAgencySymbol. */
const BAND_CANONICAL: Record<Band, string> = {
  "BC-1": "AAA",
  "BC-2": "AA",
  "BC-3": "A",
  "BC-4": "BBB",
  "BC-5": "BB",
  "BC-6": "B",
};

const AGENCY_PREFIX: Partial<Record<RatingAgency, string>> = {
  India_Ratings: "IND ",
  Brickwork: "BWR ",
};

/** Map a cross-agency rank (1..19) to an internal band. */
export function rankToBand(rank: number | null | undefined): Band | null {
  if (rank === null || rank === undefined) return null;
  return RANK_TO_BAND[Math.round(rank)] ?? null;
}

/** Format a canonical agency symbol for a band (e.g. CRISIL BC-2 → "AA"). */
export function bandToAgencySymbol(band: Band, agency: RatingAgency): string {
  const core = BAND_CANONICAL[band];
  const prefix = AGENCY_PREFIX[agency];
  return prefix ? `${prefix}${core}` : core;
}
