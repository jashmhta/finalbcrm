// Indian rating-agency scale mapping (CREDIT_ANALYSIS_SPEC §5).
//
// Bridges the seven Indian CRAs (CRISIL, ICRA, CARE, India Ratings, Acuite,
// Infomerics, Brickwork) to a normalized internal scale BC-1 … BC-6 using the
// `rating_ladder` table (schema §2.23.7). The rating_ladder table is the
// system of record and is editable (agencies refine scales); this module
// loads it at request time and falls back to the static spec §5 mapping when
// a (agency, symbol) pair is not seeded in the DB yet.
//
// `external_rating.rating_rank` is the cross-agency ordinal (AAA=1 … D=19),
// snapshotted at rating time. `rankToBand` maps that ordinal to an internal
// band so any external rating - regardless of agency - can be compared on
// the BC scale. Ranks 1-15 are agency-agnostic (AAA … B/B-). Ranks 16-19 are
// the sub-investment-grade / default tier, whose taxonomy differs by agency
// (spec §5 note 4): India Ratings uses THREE distinct non-default sub-IG
// grades - IND CCC (16), IND CC (17), IND C (18) - before IND D (19); CRISIL,
// ICRA, CARE, Acuite and Infomerics use a single C (16) before D (19);
// Brickwork uses BWR C (16) before BWR D (19). See `agencySymbolToRank`.

import { eq, and, isNull, asc } from "drizzle-orm";

import { db } from "@/db";
import { ratingLadder } from "@/db/schema";
import type { Band } from "./scorecard";
// Pure band helpers (DB-free) - re-exported for backward compatibility.
// Defined in ./ratingBands so client components can import them without
// pulling `postgres` (and Node `tls`/`net`/`fs`) into the client bundle.
export { rankToBand, bandToAgencySymbol, type RatingAgency } from "./ratingBands";
import { rankToBand, type RatingAgency } from "./ratingBands";

export type RatingScale = "long_term" | "short_term" | "structured" | "sovereign" | "state_guaranteed";

export interface LadderRung {
  agency: RatingAgency;
  scale: RatingScale;
  symbol: string;
  rank: number; // 1 (AAA) .. 19 (D)
  band: Band;
  definition?: string | null;
}

// ---------------------------------------------------------------------------
// Static spec §5 mapping (RANK_TO_BAND / BAND_CANONICAL / AGENCY_PREFIX +
// rankToBand / bandToAgencySymbol) lives in ./ratingBands (DB-free) so client
// components can import the pure helpers. Re-exported above. The canonical-
// rank midpoint helper below is also pure and stays here.
// ---------------------------------------------------------------------------

/** Map an internal band to its canonical cross-agency rank (band midpoint). */
export function bandToCanonicalRank(band: Band): number {
  switch (band) {
    case "BC-1":
      return 1;
    case "BC-2":
      return 3;
    case "BC-3":
      return 6;
    case "BC-4":
      return 9;
    case "BC-5":
      return 12;
    case "BC-6":
      return 15;
  }
}

// ---------------------------------------------------------------------------
// Symbol normalization - strip the agency prefix (IND / BWR) and whitespace
// so "IND AA+", "BWR AA+", "AA+" all resolve to the same core symbol.
// NOTE: stripping the prefix is fine for the agency-agnostic AAA…B grades,
// but it collapses the sub-IG taxonomy: India Ratings' "IND C" and CRISIL's
// "C" both normalize to "C" yet are NOT the same grade (IND C is a distinct,
// lower grade than IND CCC - spec §5 note 4). Band resolution therefore goes
// through the agency-aware `agencySymbolToRank`, not the agency-agnostic
// `coreSymbolToRank`.
// ---------------------------------------------------------------------------

function normalizeSymbol(symbol: string): string {
  return symbol
    .toUpperCase()
    .replace(/^(IND|BWR)\s+/i, "")
    .replace(/\s+/g, "")
    .trim();
}

// Agency-agnostic core-symbol → rank. Ranks 1-15 (AAA … B/B-) are identical
// across all seven Indian CRAs. The sub-IG / default entries (CCC/CC/C/D)
// here are the CRISIL-style mapping kept for backward compatibility with
// `coreSymbolToRank` (which the test suite pins); the spec-correct, agency-
// aware path is `agencySymbolToRank` below, and that is what `symbolToBand`
// / `resolveRung` use for band resolution.
const CORE_SYMBOL_TO_RANK: Record<string, number> = {
  "AAA": 1,
  "AA+": 2,
  "AA": 3,
  "AA-": 4,
  "A+": 5,
  "A": 6,
  "A-": 7,
  "BBB+": 8,
  "BBB": 9,
  "BBB-": 10,
  "BB+": 11,
  "BB": 12,
  "BB-": 13,
  "B+": 14,
  "B": 15,
  "B-": 15,
  "CCC": 16,
  "CC": 17,
  "C": 16,
  "D": 18,
};

/** Convert a normalized core rating symbol to a cross-agency rank (agency-agnostic, legacy). */
export function coreSymbolToRank(core: string): number | null {
  return CORE_SYMBOL_TO_RANK[normalizeSymbol(core)] ?? null;
}

/**
 * Agency-aware symbol → cross-agency rank. This is the spec-correct path
 * (CREDIT_ANALYSIS_SPEC §5 note 4) and the one used for band resolution.
 * Ranks 1-15 (AAA … B/B-) are agency-agnostic. The sub-IG / default tier is
 * agency-specific:
 *   - India Ratings: IND CCC → 16, IND CC → 17, IND C → 18, IND D → 19
 *     (THREE distinct non-default sub-IG grades, not a single "C").
 *   - Brickwork: BWR C → 16, BWR D → 19.
 *   - CRISIL / ICRA / CARE / Acuite / Infomerics: C → 16, D → 19.
 */
export function agencySymbolToRank(
  agency: RatingAgency,
  symbol: string | null | undefined,
): number | null {
  if (!symbol) return null;
  const norm = normalizeSymbol(symbol);
  const agnostic = CORE_SYMBOL_TO_RANK[norm];
  if (agnostic !== undefined && agnostic <= 15) return agnostic;
  switch (agency) {
    case "India_Ratings":
      if (norm === "CCC") return 16; // IND CCC
      if (norm === "CC") return 17; // IND CC
      if (norm === "C") return 18; // IND C - distinct from IND CCC (spec §5)
      if (norm === "D") return 19; // IND D
      return null;
    case "Brickwork":
      if (norm === "C") return 16; // BWR C
      if (norm === "D") return 19; // BWR D
      return null;
    default: // CRISIL, ICRA, CARE, Acuite, Infomerics - C then D only
      if (norm === "C") return 16;
      if (norm === "D") return 19;
      return null;
  }
}

/** Map an agency rating symbol to an internal band (no DB hit, agency-aware). */
export function symbolToBand(agency: RatingAgency, symbol: string | null | undefined): Band | null {
  const rank = agencySymbolToRank(agency, symbol);
  return rank ? rankToBand(rank) : null;
}

// `bandToAgencySymbol` is re-exported from ./ratingBands (see top of file).

// ---------------------------------------------------------------------------
// DB ladder loader. Loads the long_term ladder once per request; callers
// merge DB rows over the static fallback so missing seed data doesn't break
// mapping. Cached per-request via React `cache()` would be ideal but the
// loader is also called from server actions; a plain function is fine.
// ---------------------------------------------------------------------------

let cachedLadder: LadderRung[] | null = null;

export async function loadLadder(): Promise<LadderRung[]> {
  if (cachedLadder) return cachedLadder;
  const rows = await db
    .select({
      agency: ratingLadder.agency,
      scale: ratingLadder.scale,
      symbol: ratingLadder.symbol,
      rank: ratingLadder.rank,
      definition: ratingLadder.definition,
    })
    .from(ratingLadder)
    .where(and(eq(ratingLadder.scale, "long_term"), isNull(ratingLadder.deletedAt)))
    .orderBy(asc(ratingLadder.rank));
  cachedLadder = rows.map((r) => ({
    agency: r.agency as RatingAgency,
    scale: r.scale as RatingScale,
    symbol: r.symbol,
    rank: r.rank,
    band: rankToBand(r.rank) ?? "BC-6",
    definition: r.definition,
  }));
  return cachedLadder;
}

/** Test-only: reset the in-memory ladder cache. */
export function resetLadderCache(): void {
  cachedLadder = null;
}

/**
 * Resolve an agency rating symbol to a band, preferring the DB ladder
 * (exact agency + symbol match) and falling back to the static spec §5 map.
 */
export async function resolveBand(
  agency: RatingAgency,
  symbol: string | null | undefined,
): Promise<Band | null> {
  if (!symbol) return null;
  const ladder = await loadLadder();
  const norm = normalizeSymbol(symbol);
  const hit = ladder.find(
    (r) => r.agency === agency && normalizeSymbol(r.symbol) === norm,
  );
  if (hit) return hit.band;
  return symbolToBand(agency, symbol);
}

/**
 * Resolve a full rung (rank + band + definition) for an agency symbol,
 * preferring the DB ladder and falling back to the static map.
 */
export async function resolveRung(
  agency: RatingAgency,
  symbol: string | null | undefined,
): Promise<{ rank: number | null; band: Band | null } | null> {
  if (!symbol) return null;
  const ladder = await loadLadder();
  const norm = normalizeSymbol(symbol);
  const hit = ladder.find(
    (r) => r.agency === agency && normalizeSymbol(r.symbol) === norm,
  );
  if (hit) return { rank: hit.rank, band: hit.band };
  // Agency-aware fallback so India Ratings' IND CCC/IND CC/IND C resolve to
  // three distinct ranks (16/17/18) and D resolves to 19 (spec §5 note 4).
  const rank = agencySymbolToRank(agency, symbol);
  return { rank, band: rank ? rankToBand(rank) : null };
}

/** Agencies BC maps, with display labels and the BWR wind-down flag. */
export const AGENCIES: {
  code: RatingAgency;
  label: string;
  woundDown?: boolean;
}[] = [
  { code: "CRISIL", label: "CRISIL" },
  { code: "ICRA", label: "ICRA" },
  { code: "CARE", label: "CARE" },
  { code: "India_Ratings", label: "India Ratings & Research" },
  { code: "Acuite", label: "Acuite (SMERA)" },
  { code: "Infomerics", label: "Infomerics" },
  { code: "Brickwork", label: "Brickwork (BWR)", woundDown: true },
];

/** Indicative 1-yr PD per band (spec §4.2 / §5; placeholder - §15 #4). */
export const BAND_PD_RANGE: Record<Band, string> = {
  "BC-1": "< 0.05%",
  "BC-2": "0.05 - 0.15%",
  "BC-3": "0.15 - 0.50%",
  "BC-4": "0.50 - 1.50%",
  "BC-5": "1.50 - 10.00%",
  "BC-6": "> 10.00%",
};
