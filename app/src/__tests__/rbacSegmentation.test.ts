import { describe, expect, it } from "vitest";

import { can, type RbacSubject } from "@/lib/rbac-core";
import { canUseCsvExport } from "@/features/reports/exportAccess";
import {
  brandFromDesk,
  canAccessCreditModule,
  partyBrandSqlValues,
} from "@/lib/org";
import {
  INDUSTRY_SECTOR_LABELS,
  INDUSTRY_SECTORS,
  INVESTOR_TYPE_LABELS,
  INVESTOR_TYPES,
  PORTFOLIO_SIZE_BANDS,
  PORTFOLIO_SIZE_LABELS,
  RATING_AGENCIES,
  RATING_AGENCY_LABELS,
  RATING_VALUES,
  RISK_APPETITES,
  RISK_APPETITE_LABELS,
  TURNOVER_BAND_LABELS,
  TURNOVER_BANDS,
} from "@/features/parties/segmentation";

function user(roles: string[], permissions: string[] = []): RbacSubject {
  return { roles, permissions: new Set(permissions) };
}

describe("Org brand + credit policy", () => {
  it("maps desks to Capital / Bonds / shared", () => {
    expect(brandFromDesk("ib_advisory")).toBe("binarycapital");
    expect(brandFromDesk("operations")).toBe("binarycapital");
    expect(brandFromDesk("bond_underwriting")).toBe("binarybonds");
    expect(brandFromDesk("credit")).toBe("binarybonds");
    expect(brandFromDesk("management")).toBe("shared");
  });

  it("includes shared parties for brand-scoped supers", () => {
    expect(partyBrandSqlValues("binarycapital")).toEqual([
      "binarycapital",
      "shared",
    ]);
    expect(partyBrandSqlValues("shared")).toContain("binarybonds");
  });

  it("keeps credit module closed for coverage employees by default", () => {
    expect(canAccessCreditModule(["coverage_rm"])).toBe(false);
    expect(canAccessCreditModule(["bond_desk"])).toBe(false);
    expect(canAccessCreditModule(["super_admin"])).toBe(true);
    expect(canAccessCreditModule(["credit_analyst"])).toBe(true);
  });
});

describe("assignParty authorization source (no party:update shortcut)", () => {
  it("direct assign is super-admin only; employees request approval", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(
      resolve(process.cwd(), "src/features/parties/actions.ts"),
      "utf8",
    );
    const block = src.slice(src.indexOf("export async function assignParty"));
    const head = block.slice(0, 900);
    // Approval-queue model: super-only direct assign; no party:update shortcut
    expect(head).toMatch(/isDirectAssignAdmin|Direct assign is super-admin only/);
    expect(head).not.toMatch(/can\(user,\s*"update",\s*"party"\)/);
    expect(src).toContain("export async function requestPartyAssignment");
    expect(src).toContain("export async function reviewPartyAssignment");
  });
});

describe("console credit desk gate (no implicit credit:read bypass)", () => {
  it("console credit pages gate only on canAccessCreditModule", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    for (const rel of [
      "src/app/console/(desk)/credit/page.tsx",
      "src/app/console/(desk)/credit/[id]/page.tsx",
    ]) {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(src).toContain("canAccessCreditModule");
      expect(src).not.toMatch(/can\(user,\s*"read",\s*"credit"\)/);
    }
  });
});

describe("RBAC bypass roles", () => {
  it("lets super_admin bypass resource permissions", () => {
    expect(can(user(["super_admin"]), "export", "reports")).toBe(true);
    expect(can(user(["super_admin"]), "merge", "party")).toBe(true);
  });

  it("restricts CSV export to super_admin even when a user has broad admin access", () => {
    expect(canUseCsvExport(user(["super_admin"]))).toBe(true);
    expect(canUseCsvExport(user(["admin"]))).toBe(false);
    expect(canUseCsvExport(user(["management"], ["report:read_all"]))).toBe(false);
    expect(canUseCsvExport(user(["coverage_head"], ["party:read_all"]))).toBe(false);
  });

  it("keeps non-admin users permission-scoped", () => {
    expect(can(user(["coverage_rm"], ["party:read"]), "read", "party")).toBe(true);
    expect(can(user(["coverage_rm"], ["party:read"]), "export", "reports")).toBe(false);
  });

  it("requires explicit read-all grants for cross-desk task and notification access", () => {
    expect(can(user(["coverage_rm"], ["task:read"]), "read_all", "task")).toBe(false);
    expect(can(user(["ops_lead"], ["task:read_all"]), "read_all", "task")).toBe(true);
    expect(can(user(["ops_lead"], ["notification:read_all"]), "read_all", "notification")).toBe(true);
    expect(can(user(["ops_lead"], ["task:read_all"]), "read_all", "notification")).toBe(false);
  });

  it("keeps portal-wide visibility behind an explicit portal or party read-all grant", () => {
    expect(can(user(["coverage_rm"], ["party:read"]), "read_all", "portal")).toBe(false);
    expect(can(user(["portal_admin"], ["portal:read_all"]), "read_all", "portal")).toBe(true);
    expect(can(user(["coverage_head"], ["party:read_all"]), "read_all", "party")).toBe(true);
  });

  it("keeps document-wide visibility behind an explicit document read-all grant", () => {
    expect(can(user(["coverage_rm"], ["document:read"]), "read_all", "document")).toBe(false);
    expect(can(user(["ops_admin"], ["document:read_all"]), "read_all", "document")).toBe(true);
    expect(can(user(["ops_admin"], ["document:read_all"]), "read_all", "task")).toBe(false);
  });

  it("keeps KYC and credit-wide visibility behind explicit read-all grants", () => {
    expect(can(user(["coverage_rm"], ["kyc:read"]), "read_all", "kyc")).toBe(false);
    expect(can(user(["compliance_admin"], ["kyc:read_all"]), "read_all", "kyc")).toBe(true);
    expect(can(user(["compliance_admin"], ["compliance:read_all"]), "read_all", "compliance")).toBe(true);
    expect(can(user(["compliance_admin"], ["kyc:read_all"]), "read_all", "consent")).toBe(false);
    expect(can(user(["privacy_admin"], ["consent:read_all"]), "read_all", "consent")).toBe(true);
    expect(can(user(["credit_analyst"], ["credit:read"]), "read_all", "credit")).toBe(false);
    expect(can(user(["credit_head"], ["credit:read_all"]), "read_all", "credit")).toBe(true);
  });

  it("keeps lead and onboarding portfolio views behind explicit read-all grants", () => {
    expect(can(user(["coverage_rm"], ["lead:read"]), "read_all", "lead")).toBe(false);
    expect(can(user(["coverage_head"], ["lead:read_all"]), "read_all", "lead")).toBe(true);
    expect(can(user(["operations"], ["onboarding:read"]), "read_all", "onboarding")).toBe(false);
    expect(can(user(["operations_head"], ["onboarding:read_all"]), "read_all", "onboarding")).toBe(true);
    expect(can(user(["coverage_head"], ["lead:read_all"]), "read_all", "onboarding")).toBe(false);
  });

  it("keeps investor matching portfolio views behind matching or party read-all grants", () => {
    expect(can(user(["coverage_rm"], ["matching:read"]), "read_all", "matching")).toBe(false);
    expect(can(user(["placement_head"], ["matching:read_all"]), "read_all", "matching")).toBe(true);
    expect(can(user(["coverage_head"], ["party:read_all"]), "read_all", "party")).toBe(true);
    expect(can(user(["placement_head"], ["matching:read_all"]), "read_all", "party")).toBe(false);
  });

  it("keeps report and portfolio-wide views behind explicit read-all grants", () => {
    expect(can(user(["coverage_rm"], ["report:read"]), "read_all", "report")).toBe(false);
    expect(can(user(["management"], ["report:read_all"]), "read_all", "report")).toBe(true);
    expect(can(user(["risk_analyst"], ["portfolio:read"]), "read_all", "portfolio")).toBe(false);
    expect(can(user(["risk_head"], ["portfolio:read_all"]), "read_all", "portfolio")).toBe(true);
    expect(can(user(["risk_head"], ["portfolio:read_all"]), "read_all", "report")).toBe(false);
  });

  it("keeps AI insight and financial model portfolio views behind explicit read-all grants", () => {
    expect(can(user(["coverage_rm"], ["ai_insight:read"]), "read_all", "ai_insight")).toBe(false);
    expect(can(user(["coverage_head"], ["ai_insight:read_all"]), "read_all", "ai_insight")).toBe(true);
    expect(can(user(["analyst"], ["financial_model:read"]), "read_all", "financial_model")).toBe(false);
    expect(can(user(["model_admin"], ["financial_model:read_all"]), "read_all", "financial_model")).toBe(true);
    expect(can(user(["model_admin"], ["financial_model:read_all"]), "read_all", "ai_insight")).toBe(false);
  });

  it("keeps dashboard-wide aggregates behind dashboard or party read-all grants", () => {
    expect(can(user(["coverage_rm"], ["dashboard:read"]), "read_all", "dashboard")).toBe(false);
    expect(can(user(["coverage_head"], ["dashboard:read_all"]), "read_all", "dashboard")).toBe(true);
    expect(can(user(["coverage_head"], ["party:read_all"]), "read_all", "party")).toBe(true);
    expect(can(user(["coverage_head"], ["dashboard:read_all"]), "read_all", "party")).toBe(false);
  });

  it("keeps deal portfolio and audit log surfaces behind explicit grants", () => {
    expect(can(user(["coverage_rm"], ["deal:read"]), "read_all", "deal")).toBe(false);
    expect(can(user(["coverage_head"], ["deal:read_all"]), "read_all", "deal")).toBe(true);
    expect(can(user(["coverage_head"], ["deal:read_all"]), "read", "audit")).toBe(false);
    expect(can(user(["compliance_admin"], ["audit:read"]), "read", "audit")).toBe(true);
    expect(can(user(["compliance_admin"], ["audit:read"]), "read_all", "audit")).toBe(false);
    expect(can(user(["super_admin"]), "read_all", "audit")).toBe(true);
  });
});

describe("party segmentation catalogs", () => {
  it("covers the requested turnover ladder", () => {
    expect(TURNOVER_BANDS).toEqual([
      "lt_50",
      "50_75",
      "75_100",
      "100_150",
      "150_175",
      "175_200",
      "200_300",
      "300_500",
      "500_750",
      "750_1000",
      "gt_1000",
    ]);
    expect(Object.values(TURNOVER_BAND_LABELS)).toEqual([
      "<= 50 Cr",
      "50-75 Cr",
      "75-100 Cr",
      "100-150 Cr",
      "150-175 Cr",
      "175-200 Cr",
      "200-300 Cr",
      "300-500 Cr",
      "500-750 Cr",
      "750-1,000 Cr",
      "1,000 Cr+",
    ]);
    expect(TURNOVER_BAND_LABELS.gt_1000).toBe("1,000 Cr+");
  });

  it("includes company sectors and manufacturing sub-sectors from the brief", () => {
    expect(INDUSTRY_SECTORS).toEqual(
      expect.arrayContaining([
        "infra",
        "fintech",
        "epc",
        "roads",
        "buildings",
        "manufacturing",
        "textiles",
        "oem",
        "plastics",
        "recycled_plastics",
      ]),
    );
    expect(INDUSTRY_SECTOR_LABELS.recycled_plastics).toBe("Recycled plastics");
  });

  it("covers rating filters, agencies, investor fit, portfolio size and risk appetite", () => {
    expect(RATING_VALUES).toEqual(expect.arrayContaining(["BBB", "AAA"]));
    expect(RATING_AGENCIES).toEqual(expect.arrayContaining(["CRISIL", "ICRA", "CARE"]));
    expect(RATING_AGENCY_LABELS.India_Ratings).toBe("India Ratings");
    expect(INVESTOR_TYPES).toEqual(
      expect.arrayContaining(["equity_pms", "mutual_fund", "bond_investor"]),
    );
    expect(INVESTOR_TYPE_LABELS.equity_pms).toBe("Equity PMS");
    expect(PORTFOLIO_SIZE_BANDS).toContain("gt_1000");
    expect(PORTFOLIO_SIZE_LABELS.gt_1000).toBe("1,000 Cr+");
    expect(RISK_APPETITES).toContain("high_yield");
    expect(RISK_APPETITE_LABELS.high_yield).toBe("High yield");
  });

  it("keeps BBB-through-AAA rating filters and all explicit agency labels selectable", () => {
    expect(RATING_VALUES.slice(0, 10)).toEqual([
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
    ]);
    expect(RATING_AGENCIES).toEqual([
      "CRISIL",
      "ICRA",
      "CARE",
      "India_Ratings",
      "Acuite",
      "Infomerics",
      "Brickwork",
    ]);
    expect(Object.values(RATING_AGENCY_LABELS)).toEqual([
      "CRISIL",
      "ICRA",
      "CARE",
      "India Ratings",
      "Acuite",
      "Infomerics",
      "Brickwork",
    ]);
  });
});
