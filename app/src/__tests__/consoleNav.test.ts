import { describe, expect, it } from "vitest";

import {
  brandLabel,
  buildConsoleNav,
  homeQuestion,
  resolveConsoleBrand,
  shellCatalog,
} from "@/console/rbac/nav";

function subject(
  roles: string[],
  brandScope: "binarycapital" | "binarybonds" | "shared",
  perms: string[] = [],
) {
  return {
    roles,
    brandScope,
    permissions: new Set(perms),
  };
}

describe("console nav RBAC", () => {
  it("resolves brand shells", () => {
    expect(
      resolveConsoleBrand({ brandScope: "binarybonds", roles: ["bond_desk"] }),
    ).toBe("binarybonds");
    expect(
      resolveConsoleBrand({ brandScope: "shared", roles: ["super_admin"] }),
    ).toBe("shared");
    expect(
      resolveConsoleBrand({
        brandScope: "shared",
        roles: ["super_admin"],
        brandPref: "binarycapital",
      }),
    ).toBe("binarycapital");
    expect(
      resolveConsoleBrand({
        brandScope: "shared",
        roles: ["super_admin"],
        brandPref: "binarybonds",
      }),
    ).toBe("binarybonds");
    expect(brandLabel("binarycapital")).toContain("Capital");
    expect(homeQuestion("binarybonds").toLowerCase()).toContain("place");
  });

  it("bonds catalog prioritizes matching early", () => {
    const cat = shellCatalog("binarybonds");
    const labels = cat.map((c) => c.label);
    expect(labels.indexOf("Investor match")).toBeLessThan(
      labels.indexOf("Counterparties"),
    );
  });

  it("employee without admin loses admin item", () => {
    const nav = buildConsoleNav(
      subject(["coverage_rm"], "binarycapital", [
        "party:read",
        "deal:read",
        "lead:read",
        "task:read",
        "interaction:read",
      ]),
    );
    expect(nav.some((n) => n.href === "/console/admin")).toBe(false);
    expect(nav.some((n) => n.href === "/console/parties")).toBe(true);
  });

  it("super admin keeps admin", () => {
    const nav = buildConsoleNav(
      subject(["super_admin", "admin"], "shared", []),
    );
    expect(nav.some((n) => n.href === "/console/admin")).toBe(true);
  });
});
