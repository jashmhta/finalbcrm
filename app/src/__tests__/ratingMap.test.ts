// Rating-agency scale mapping - verifies the static (no-DB) mapping functions
// in src/features/credit/ratingMap.ts (CREDIT_ANALYSIS_SPEC §5).
//
// We exercise only the pure mapping: coreSymbolToRank, symbolToBand,
// rankToBand, bandToCanonicalRank. These do not touch the database, so the
// test is hermetic. The DB-backed resolveBand/resolveRung loaders are covered
// by integration tracks, not here.

import { describe, expect, it } from "vitest";

import {
  coreSymbolToRank,
  symbolToBand,
  rankToBand,
  bandToCanonicalRank,
  bandToAgencySymbol,
  agencySymbolToRank,
  AGENCIES,
  BAND_PD_RANGE,
  type RatingAgency,
} from "@/features/credit/ratingMap";

describe("coreSymbolToRank - cross-agency ordinal", () => {
  it("maps AAA to rank 1 (top of the ladder)", () => {
    expect(coreSymbolToRank("AAA")).toBe(1);
  });

  it("maps D to rank 18 (default)", () => {
    expect(coreSymbolToRank("D")).toBe(18);
  });

  it("respects the AA+/AA/AA− gradient", () => {
    expect(coreSymbolToRank("AA+")).toBe(2);
    expect(coreSymbolToRank("AA")).toBe(3);
    expect(coreSymbolToRank("AA-")).toBe(4);
  });

  it("normalizes agency-prefixed symbols (IND / BWR)", () => {
    expect(coreSymbolToRank("IND AA+")).toBe(2);
    expect(coreSymbolToRank("BWR BBB")).toBe(9);
  });

  it("returns null for an unknown symbol", () => {
    expect(coreSymbolToRank("ZZZ")).toBeNull();
  });
});

describe("symbolToBand - agency symbol → internal band", () => {
  it("CRISIL AAA → BC-1 (top band)", () => {
    expect(symbolToBand("CRISIL" as RatingAgency, "AAA")).toBe("BC-1");
  });

  it("CRISIL AA → BC-2", () => {
    expect(symbolToBand("CRISIL" as RatingAgency, "AA")).toBe("BC-2");
  });

  it("CRISIL A → BC-3", () => {
    expect(symbolToBand("CRISIL" as RatingAgency, "A")).toBe("BC-3");
  });

  it("CRISIL BBB → BC-4 (investment-grade floor)", () => {
    expect(symbolToBand("CRISIL" as RatingAgency, "BBB")).toBe("BC-4");
  });

  it("CRISIL BB → BC-5 (sub-investment-grade)", () => {
    expect(symbolToBand("CRISIL" as RatingAgency, "BB")).toBe("BC-5");
  });

  it("CRISIL D → BC-6 (default)", () => {
    expect(symbolToBand("CRISIL" as RatingAgency, "D")).toBe("BC-6");
  });

  it("India Ratings IND AA+ resolves to BC-1 (prefix-stripped)", () => {
    expect(symbolToBand("India_Ratings" as RatingAgency, "IND AA+")).toBe("BC-1");
  });

  it("returns null for a null/empty symbol", () => {
    expect(symbolToBand("CRISIL" as RatingAgency, null)).toBeNull();
    expect(symbolToBand("CRISIL" as RatingAgency, "")).toBeNull();
  });
});

describe("rankToBand - ordinal → band", () => {
  it("rank 1 → BC-1 and rank 18 → BC-6", () => {
    expect(rankToBand(1)).toBe("BC-1");
    expect(rankToBand(18)).toBe("BC-6");
  });

  it("returns null for out-of-range ranks", () => {
    expect(rankToBand(0)).toBeNull();
    expect(rankToBand(99)).toBeNull();
    expect(rankToBand(null)).toBeNull();
  });
});

describe("bandToCanonicalRank & bandToAgencySymbol", () => {
  it("BC-1 canonical rank is 1 (AAA midpoint)", () => {
    expect(bandToCanonicalRank("BC-1")).toBe(1);
  });

  it("BC-4 canonical rank is 9 (BBB midpoint)", () => {
    expect(bandToCanonicalRank("BC-4")).toBe(9);
  });

  it("renders a CRISIL canonical symbol with no prefix", () => {
    expect(bandToAgencySymbol("BC-1", "CRISIL" as RatingAgency)).toBe("AAA");
    expect(bandToAgencySymbol("BC-2", "CRISIL" as RatingAgency)).toBe("AA");
  });

  it("renders an India Ratings symbol with the IND prefix", () => {
    expect(bandToAgencySymbol("BC-1", "India_Ratings" as RatingAgency)).toBe("IND AAA");
  });

  it("renders a Brickwork symbol with the BWR prefix", () => {
    expect(bandToAgencySymbol("BC-1", "Brickwork" as RatingAgency)).toBe("BWR AAA");
  });

  it("every band has a canonical rank", () => {
    expect(bandToCanonicalRank("BC-2")).toBe(3);
    expect(bandToCanonicalRank("BC-3")).toBe(6);
    expect(bandToCanonicalRank("BC-5")).toBe(12);
    expect(bandToCanonicalRank("BC-6")).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// agencySymbolToRank - the spec-correct, agency-aware path (§5 note 4).
// ---------------------------------------------------------------------------

describe("agencySymbolToRank - agency-agnostic ladder (ranks 1–15)", () => {
  const agencies: RatingAgency[] = [
    "CRISIL",
    "ICRA",
    "CARE",
    "India_Ratings",
    "Acuite",
    "Infomerics",
    "Brickwork",
  ];

  it("AAA maps to rank 1 for ALL seven agencies (cross-agency equivalence)", () => {
    for (const a of agencies) {
      expect(agencySymbolToRank(a, "AAA")).toBe(1);
    }
  });

  it("AA maps to rank 3 for all seven agencies", () => {
    for (const a of agencies) {
      expect(agencySymbolToRank(a, "AA")).toBe(3);
    }
  });

  it("BBB maps to rank 9 (investment-grade floor) for all seven agencies", () => {
    for (const a of agencies) {
      expect(agencySymbolToRank(a, "BBB")).toBe(9);
    }
  });

  it("BB maps to rank 12 (sub-IG) for all seven agencies", () => {
    for (const a of agencies) {
      expect(agencySymbolToRank(a, "BB")).toBe(12);
    }
  });

  it("B maps to rank 15 for all seven agencies", () => {
    for (const a of agencies) {
      expect(agencySymbolToRank(a, "B")).toBe(15);
    }
  });

  it("agency-prefixed symbols (IND / BWR) resolve to the same ranks as the core", () => {
    expect(agencySymbolToRank("India_Ratings", "IND AAA")).toBe(1);
    expect(agencySymbolToRank("India_Ratings", "IND AA")).toBe(3);
    expect(agencySymbolToRank("Brickwork", "BWR AAA")).toBe(1);
    expect(agencySymbolToRank("Brickwork", "BWR BBB")).toBe(9);
  });
});

describe("agencySymbolToRank - sub-IG taxonomy differs by agency (§5 note 4)", () => {
  it("India Ratings uses THREE distinct non-default sub-IG grades (IND CCC/CC/C) + IND D", () => {
    expect(agencySymbolToRank("India_Ratings", "IND CCC")).toBe(16);
    expect(agencySymbolToRank("India_Ratings", "IND CC")).toBe(17);
    expect(agencySymbolToRank("India_Ratings", "IND C")).toBe(18);
    expect(agencySymbolToRank("India_Ratings", "IND D")).toBe(19);
  });

  it("India Ratings IND C (rank 18) is distinct from IND CCC (rank 16)", () => {
    // The whole point of the agency-aware path: collapsing both to "C" would
    // wrongly merge two distinct grades. The spec §5 note 4 calls this out.
    expect(agencySymbolToRank("India_Ratings", "IND C")).not.toBe(
      agencySymbolToRank("India_Ratings", "IND CCC"),
    );
  });

  it("CRISIL / ICRA / CARE / Acuite / Infomerics use a single C (rank 16) before D (rank 19)", () => {
    for (const a of ["CRISIL", "ICRA", "CARE", "Acuite", "Infomerics"] as RatingAgency[]) {
      expect(agencySymbolToRank(a, "C")).toBe(16);
      expect(agencySymbolToRank(a, "D")).toBe(19);
      // These agencies do NOT use CC / CCC - the agency-aware path returns null.
      expect(agencySymbolToRank(a, "CC")).toBeNull();
      expect(agencySymbolToRank(a, "CCC")).toBeNull();
    }
  });

  it("Brickwork uses BWR C (rank 16) before BWR D (rank 19)", () => {
    expect(agencySymbolToRank("Brickwork", "BWR C")).toBe(16);
    expect(agencySymbolToRank("Brickwork", "BWR D")).toBe(19);
  });

  it("returns null for an unknown / null / empty symbol", () => {
    expect(agencySymbolToRank("CRISIL", null)).toBeNull();
    expect(agencySymbolToRank("CRISIL", "")).toBeNull();
    expect(agencySymbolToRank("CRISIL", "ZZZ")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// symbolToBand - cross-agency equivalence on the internal BC scale.
// ---------------------------------------------------------------------------

describe("symbolToBand - cross-agency equivalence", () => {
  const agencies: RatingAgency[] = [
    "CRISIL",
    "ICRA",
    "CARE",
    "India_Ratings",
    "Acuite",
    "Infomerics",
    "Brickwork",
  ];

  it("AAA resolves to BC-1 for every agency (with and without prefix)", () => {
    for (const a of agencies) {
      const sym = a === "India_Ratings" ? "IND AAA" : a === "Brickwork" ? "BWR AAA" : "AAA";
      expect(symbolToBand(a, sym)).toBe("BC-1");
    }
  });

  it("BBB resolves to BC-4 (investment-grade floor) for every agency", () => {
    for (const a of agencies) {
      const sym = a === "India_Ratings" ? "IND BBB" : a === "Brickwork" ? "BWR BBB" : "BBB";
      expect(symbolToBand(a, sym)).toBe("BC-4");
    }
  });

  it("D resolves to BC-6 (default) for every agency", () => {
    for (const a of agencies) {
      const sym = a === "India_Ratings" ? "IND D" : a === "Brickwork" ? "BWR D" : "D";
      expect(symbolToBand(a, sym)).toBe("BC-6");
    }
  });
});

// ---------------------------------------------------------------------------
// AGENCIES - the seven Indian CRAs BC maps.
// ---------------------------------------------------------------------------

describe("AGENCIES - seven Indian rating agencies", () => {
  it("contains exactly seven agencies", () => {
    expect(AGENCIES.length).toBe(7);
  });

  it("includes CRISIL, ICRA, CARE, India Ratings, Acuite, Infomerics, Brickwork", () => {
    const codes = AGENCIES.map((a) => a.code);
    expect(codes).toContain("CRISIL");
    expect(codes).toContain("ICRA");
    expect(codes).toContain("CARE");
    expect(codes).toContain("India_Ratings");
    expect(codes).toContain("Acuite");
    expect(codes).toContain("Infomerics");
    expect(codes).toContain("Brickwork");
  });

  it("every agency has a non-empty label", () => {
    for (const a of AGENCIES) {
      expect(a.label.length).toBeGreaterThan(0);
    }
  });

  it("Brickwork is flagged as wound down (SEBI Nov 2022 order)", () => {
    const bwr = AGENCIES.find((a) => a.code === "Brickwork");
    expect(bwr?.woundDown).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BAND_PD_RANGE - indicative 1-yr PD ranges per band (spec §4.2 / §5).
// ---------------------------------------------------------------------------

describe("BAND_PD_RANGE - PD range string per band", () => {
  it("every band has a non-empty PD range string", () => {
    const bands = ["BC-1", "BC-2", "BC-3", "BC-4", "BC-5", "BC-6"] as const;
    for (const b of bands) {
      expect(BAND_PD_RANGE[b].length).toBeGreaterThan(0);
    }
  });

  it("BC-1 PD range is the lowest (< 0.05%) and BC-6 the highest (> 10%)", () => {
    expect(BAND_PD_RANGE["BC-1"]).toContain("0.05%");
    expect(BAND_PD_RANGE["BC-6"]).toContain("10");
  });
});

// ---------------------------------------------------------------------------
// Short-term scale - gap documentation.
// ---------------------------------------------------------------------------
// The spec (§5) tracks agency short-term scales (A1+/A1/A2/A3/A4/D) for CP /
// short-tenor instruments. The PURE static helpers here implement the long-term
// ladder only (CORE_SYMBOL_TO_RANK + agencySymbolToRank cover AAA..D); short-
// term symbols are not mapped by the pure path and resolve to null. The DB
// ladder (rating_ladder table, scale='short_term') is the system of record for
// short-term mapping and is out of scope for this hermetic unit suite.

describe("agencySymbolToRank - short-term symbols are NOT mapped by the pure helpers", () => {
  it("A1+ / A1 / A2 / A3 / A4 resolve to null (long-term-only static path)", () => {
    // Documenting the current behavior: short-term mapping is a DB-ladder
    // concern, not a pure-helper concern.
    expect(agencySymbolToRank("CRISIL", "A1+")).toBeNull();
    expect(agencySymbolToRank("CRISIL", "A1")).toBeNull();
    expect(agencySymbolToRank("CRISIL", "A2")).toBeNull();
    expect(agencySymbolToRank("CRISIL", "A3")).toBeNull();
    expect(agencySymbolToRank("CRISIL", "A4")).toBeNull();
  });
});
