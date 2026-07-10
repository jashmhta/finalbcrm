/**
 * Guards against search-engine data leakage: every entity query in
 * globalSearch must include ownership/brand scope for non-super staff.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const search = readFileSync(
  join(process.cwd(), "src/features/search/queries.ts"),
  "utf8",
);

describe("globalSearch zero-leakage scopes", () => {
  it("defines ownership clauses for party, deal, task, interaction", () => {
    expect(search).toContain("function ownershipClauseSql");
    expect(search).toContain("function dealOwnershipClauseSql");
    expect(search).toContain("function taskOwnershipClauseSql");
    expect(search).toContain("function interactionOwnershipClauseSql");
    expect(search).toContain("function dealBrandClauseSql");
  });

  it("applies brand + ownership on party and lead searches", () => {
    expect(search).toContain("AND ${brand}");
    expect(search).toContain("AND ${ownership}");
  });

  it("scopes deals by brand and ownership (not firm-wide free-for-all)", () => {
    expect(search).toContain("AND ${dealBrand}");
    expect(search).toContain("AND ${dealOwn}");
  });

  it("scopes tasks and interactions by ownership", () => {
    expect(search).toContain("AND ${taskOwn}");
    expect(search).toContain("AND ${ixOwn}");
  });

  it("party list summary prefers scoped fetch for authenticated users", () => {
    const q = readFileSync(
      join(process.cwd(), "src/features/parties/queries.ts"),
      "utf8",
    );
    expect(q).toContain("fetchScopedPartyListSummary(user)");
    // Must not prefer unscoped global aggregate for canReadAll alone
    expect(q).not.toMatch(
      /canReadAllParties\(user\) \? getPartyListSummary\(\)/,
    );
  });
});
