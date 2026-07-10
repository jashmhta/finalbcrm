import { describe, expect, it } from "vitest";

import {
  assertBrandAssignmentAllowed,
  defaultPartyBrandForUser,
  staffCanOwnPartyBrand,
} from "@/lib/org";

describe("brand Chinese wall", () => {
  it("blocks Capital client → Bonds staff", () => {
    expect(staffCanOwnPartyBrand("binarycapital", "binarybonds")).toBe(false);
    expect(staffCanOwnPartyBrand("binarybonds", "binarycapital")).toBe(false);
    expect(staffCanOwnPartyBrand("shared", "binarycapital")).toBe(true);
    expect(staffCanOwnPartyBrand("binarycapital", "shared")).toBe(true);
  });

  it("lets firm-wide super mix freely", () => {
    const r = assertBrandAssignmentAllowed({
      actorBrand: "shared",
      actorRoles: ["super_admin"],
      partyBrand: "binarycapital",
      assigneeBrand: "binarybonds",
    });
    expect(r.ok).toBe(true);
  });

  it("blocks brand-scoped actor from other-desk assignee", () => {
    const r = assertBrandAssignmentAllowed({
      actorBrand: "binarycapital",
      actorRoles: ["coverage_rm"],
      partyBrand: "binarycapital",
      assigneeBrand: "binarybonds",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/mixed|Bonds|Capital/i);
  });

  it("allows same-brand assignment", () => {
    const r = assertBrandAssignmentAllowed({
      actorBrand: "binarybonds",
      actorRoles: ["bond_desk"],
      partyBrand: "binarybonds",
      assigneeBrand: "binarybonds",
    });
    expect(r.ok).toBe(true);
  });

  it("defaults new party brand to creator desk", () => {
    expect(defaultPartyBrandForUser("binarycapital")).toBe("binarycapital");
    expect(defaultPartyBrandForUser("binarybonds")).toBe("binarybonds");
    expect(defaultPartyBrandForUser("shared")).toBe("shared");
  });
});
