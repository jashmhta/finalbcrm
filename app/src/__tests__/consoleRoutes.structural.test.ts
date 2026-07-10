/**
 * Structural proof that primary console nav destinations are real pages
 * (not ModuleStub placeholders) and that nav RBAC differs by persona.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildConsoleNav,
  resolveConsoleBrand,
} from "@/console/rbac/nav";

const APP = join(process.cwd(), "src/app/console");

const PRIMARY_PAGES = [
  "(desk)/page.tsx",
  "(desk)/parties/page.tsx",
  "(desk)/parties/[id]/page.tsx",
  "(desk)/deals/page.tsx",
  "(desk)/deals/[id]/page.tsx",
  "(desk)/leads/page.tsx",
  "(desk)/leads/[id]/page.tsx",
  "(desk)/leads/new/page.tsx",
  "(desk)/matching/page.tsx",
  "(desk)/matching/[id]/page.tsx",
  "(desk)/onboarding/page.tsx",
  "(desk)/onboarding/[id]/page.tsx",
  "(desk)/tasks/page.tsx",
  "(desk)/tasks/[id]/page.tsx",
  "(desk)/interactions/page.tsx",
  "(desk)/interactions/[id]/page.tsx",
  "(desk)/documents/page.tsx",
  "(desk)/calendar/page.tsx",
  "(desk)/activity/page.tsx",
  "(desk)/duplicates/page.tsx",
  "(desk)/assignments/page.tsx",
  "(desk)/notifications/page.tsx",
  "(desk)/compliance/kyc/page.tsx",
  "(desk)/compliance/kyc/[id]/page.tsx",
  "(desk)/credit/page.tsx",
  "(desk)/credit/[id]/page.tsx",
  "(desk)/modeling/page.tsx",
  "(desk)/modeling/[id]/page.tsx",
  "(desk)/portfolio/page.tsx",
  "(desk)/reports/page.tsx",
  "(desk)/admin/page.tsx",
  "(desk)/integrations/page.tsx",
  "(desk)/ai/page.tsx",
  "(desk)/portal/client/page.tsx",
  "(desk)/portal/investor/page.tsx",
  "login/page.tsx",
];

describe("console primary routes are real", () => {
  for (const rel of PRIMARY_PAGES) {
    it(`exists and is not a stub: ${rel}`, () => {
      const full = join(APP, rel);
      expect(existsSync(full), full).toBe(true);
      const src = readFileSync(full, "utf8");
      expect(src).not.toMatch(/ModuleStub/);
      expect(src.toLowerCase()).not.toMatch(/production roadmap/);
      // Must load real feature data or login/auth
      const wired =
        src.includes("@/features/") ||
        src.includes("requireUser") ||
        src.includes("consoleLogin") ||
        src.includes("auth()");
      expect(wired, `expected feature/auth wiring in ${rel}`).toBe(true);
    });
  }
});

describe("console list open-detail targets", () => {
  it("credit list opens console credit detail", () => {
    const src = readFileSync(join(APP, "(desk)/credit/page.tsx"), "utf8");
    expect(src).toContain("`/console/credit/${r.creditAnalysisId}`");
    expect(src).toContain("listCreditAnalyses");
  });

  it("modeling list opens console model detail", () => {
    const src = readFileSync(join(APP, "(desk)/modeling/page.tsx"), "utf8");
    expect(src).toContain("`/console/modeling/${m.financialModelId}`");
    expect(src).toContain("listModels");
  });

  it("kyc list opens console kyc detail", () => {
    const src = readFileSync(join(APP, "(desk)/compliance/kyc/page.tsx"), "utf8");
    expect(src).toContain("`/console/compliance/kyc/${r.kycRecordId}`");
    expect(src).toContain("listKycRecords");
  });

  it("portal directories deep-link to console parties", () => {
    const client = readFileSync(join(APP, "(desk)/portal/client/page.tsx"), "utf8");
    const inv = readFileSync(join(APP, "(desk)/portal/investor/page.tsx"), "utf8");
    expect(client).toContain("`/console/parties/${r.partyId}`");
    expect(inv).toContain("`/console/parties/${r.partyId}`");
  });

  it("AI hub uses real next-actions + credit loaders", () => {
    const src = readFileSync(join(APP, "(desk)/ai/page.tsx"), "utf8");
    expect(src).toContain("getNextActions");
    expect(src).toContain("listCreditAnalyses");
    expect(src).toContain("@/features/ai");
    expect(src).not.toMatch(/ModuleStub/);
  });

  it("calendar and notifications map hrefs via toConsoleHref", () => {
    const cal = readFileSync(join(APP, "(desk)/calendar/page.tsx"), "utf8");
    const note = readFileSync(join(APP, "(desk)/notifications/page.tsx"), "utf8");
    expect(cal).toContain("toConsoleHref");
    expect(note).toContain("toConsoleHref");
  });

  it("task and interaction detail pages exist and load feature detail", () => {
    const task = readFileSync(join(APP, "(desk)/tasks/[id]/page.tsx"), "utf8");
    const ix = readFileSync(
      join(APP, "(desk)/interactions/[id]/page.tsx"),
      "utf8",
    );
    expect(task).toContain("getTaskDetail");
    expect(ix).toContain("getInteractionDetail");
    expect(task).not.toMatch(/ModuleStub/);
    expect(ix).not.toMatch(/ModuleStub/);
  });

  it("tasks list links into console task detail", () => {
    const src = readFileSync(join(APP, "(desk)/tasks/page.tsx"), "utf8");
    expect(src).toContain("`/console/tasks/${t.taskId}`");
  });

  it("interactions list links into console interaction detail", () => {
    const src = readFileSync(join(APP, "(desk)/interactions/page.tsx"), "utf8");
    expect(src).toContain("`/console/interactions/${r.interactionId}`");
    expect(src).toContain("listInteractions");
    expect(src).toMatch(/href=\{`\/console\/interactions\/\$\{r\.interactionId\}`\}/);
  });
});

describe("console nav personas", () => {
  it("Capital coverage_rm excludes admin", () => {
    const nav = buildConsoleNav({
      roles: ["coverage_rm"],
      brandScope: "binarycapital",
      permissions: new Set([
        "party:read",
        "deal:read",
        "lead:read",
        "task:read",
        "interaction:read",
      ]),
    });
    expect(resolveConsoleBrand({ brandScope: "binarycapital", roles: ["coverage_rm"] })).toBe(
      "binarycapital",
    );
    expect(nav.some((n) => n.href === "/console/admin")).toBe(false);
    expect(nav.some((n) => n.href === "/console/parties")).toBe(true);
    expect(nav[0]?.href).toBe("/console");
  });

  it("Bonds bond_desk prioritizes matching", () => {
    const nav = buildConsoleNav({
      roles: ["bond_desk"],
      brandScope: "binarybonds",
      permissions: new Set([
        "party:read",
        "deal:read",
        "matching:read",
        "task:read",
      ]),
    });
    expect(resolveConsoleBrand({ brandScope: "binarybonds", roles: ["bond_desk"] })).toBe(
      "binarybonds",
    );
    const idxMatch = nav.findIndex((n) => n.href === "/console/matching");
    const idxParties = nav.findIndex((n) => n.href === "/console/parties");
    expect(idxMatch).toBeGreaterThan(-1);
    expect(idxMatch).toBeLessThan(idxParties === -1 ? 99 : idxParties);
    expect(nav.some((n) => n.href === "/console/admin")).toBe(false);
  });

  it("shared super_admin includes admin", () => {
    const nav = buildConsoleNav({
      roles: ["super_admin", "admin"],
      brandScope: "shared",
      permissions: new Set(),
    });
    expect(resolveConsoleBrand({ brandScope: "shared", roles: ["super_admin"] })).toBe(
      "shared",
    );
    expect(nav.some((n) => n.href === "/console/admin")).toBe(true);
  });
});
