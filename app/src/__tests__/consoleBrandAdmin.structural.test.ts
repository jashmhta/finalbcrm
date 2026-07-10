/**
 * Structural proof for brand onboarding, Capital gold tokens, admin console
 * firm ops, and dashboard chart wiring.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  parseBrandPref,
  CONSOLE_BRAND_COOKIE,
} from "@/console/lib/brand-pref";

const root = process.cwd();
function src(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("brand preference helpers", () => {
  it("parses only Capital/Bonds prefs", () => {
    expect(parseBrandPref("binarycapital")).toBe("binarycapital");
    expect(parseBrandPref("binarybonds")).toBe("binarybonds");
    expect(parseBrandPref("shared")).toBeNull();
    expect(parseBrandPref(null)).toBeNull();
    expect(CONSOLE_BRAND_COOKIE).toBe("bc_console_brand");
  });
});

describe("console brand onboarding UI", () => {
  it("login page presents Capital vs Bonds choice then sign-in", () => {
    const page = src("src/app/console/login/page.tsx");
    const choice = src("src/app/console/login/brand-choice.tsx");
    expect(page).toContain("BrandChoiceLogin");
    expect(page).toContain("Binary Capital");
    expect(page).toContain("Binary Bonds");
    expect(choice).toContain('data-brand-option="binarycapital"');
    expect(choice).toContain('data-brand-option="binarybonds"');
    expect(choice).toContain("ConsoleLoginForm");
    expect(choice).toContain("CONSOLE_BRAND_COOKIE");
    expect(choice).toMatch(/binarycapital|binarybonds/);
  });

  it("desk layout reads brand cookie into resolveConsoleBrand", () => {
    const layout = src("src/app/console/(desk)/layout.tsx");
    expect(layout).toContain("CONSOLE_BRAND_COOKIE");
    expect(layout).toContain("brandPref");
    expect(layout).toContain("resolveConsoleBrand");
  });
});

describe("Capital gold theme tokens", () => {
  it("capital accent is gold family and surfaces are warm cream", () => {
    const capital = src("src/console/tokens/capital.css");
    // Slight yellow-gold (warmer than pure bronze) — product lock
    expect(capital).toMatch(/--c-accent:\s*#c9a227/i);
    expect(capital).toMatch(/--c-bg:\s*#faf7ef/i);
    expect(capital).toMatch(/--c-surface:\s*#fffcf5/i);
    // Not pure white-only sterile surfaces
    expect(capital).not.toMatch(/--c-surface:\s*#ffffff\s*;/);
  });

  it("desk scroll region is intentional", () => {
    const shell = src("src/console/shells/console-shell.tsx");
    const shared = src("src/console/tokens/shared.css");
    expect(shell).toContain("c-desk-scroll");
    expect(shell).toContain("overflow-y-auto");
    expect(shared).toContain(".c-desk-scroll");
  });
});

describe("console admin firm control", () => {
  it("admin page mounts createUser, assignParty, password reset, edit roles", () => {
    const page = src("src/app/console/(desk)/admin/page.tsx");
    const forms = src("src/app/console/(desk)/admin/admin-forms.tsx");
    expect(page).toContain("CreateUserForm");
    expect(page).toContain("AssignPartyForm");
    expect(page).toContain("ResetPasswordForm");
    expect(page).toContain("EditRolesForm");
    expect(forms).toContain("createUser");
    expect(forms).toContain("updateUser");
    expect(forms).toContain("assignParty");
    expect(forms).toContain("EditRolesForm");
    expect(forms).toContain('name="rolesSync"');
    expect(forms).toContain('name="password"');
    expect(forms).toContain('name="roleNames"');
    expect(forms).toContain('name="assigneeUserId"');
  });

  it("updateUser uses omit-if-absent parse for roles (password-safe)", () => {
    const admin = src("src/features/admin/actions.ts");
    const parser = src("src/features/admin/update-user-form.ts");
    expect(admin).toContain("parseUpdateUserFormFields");
    expect(parser).toContain('formData.has("rolesSync")');
    expect(parser).toContain('formData.has("barriersSync")');
    expect(parser).toContain('formData.has("roleNames")');
  });

  it("legacy /admin/users EditUserDialog sends rolesSync and barriersSync", () => {
    const view = src("src/app/admin/users/users-view.tsx");
    expect(view).toContain("updateUser");
    expect(view).toContain('name="rolesSync"');
    expect(view).toContain('name="barriersSync"');
    expect(view).toContain('name="roleNames"');
    expect(view).toContain('name="barrierClearance"');
  });

  it("home dashboard resolves brandPref cookie like desk layout", () => {
    const home = src("src/app/console/(desk)/page.tsx");
    expect(home).toContain("CONSOLE_BRAND_COOKIE");
    expect(home).toContain("brandPref");
    expect(home).toContain("parseBrandPref");
  });

  it("admin + assign actions revalidate console paths", () => {
    const admin = src("src/features/admin/actions.ts");
    const parties = src("src/features/parties/actions.ts");
    expect(admin).toContain('revalidatePath("/console/admin")');
    expect(parties).toContain('revalidatePath("/console/admin")');
    expect(parties).toContain('revalidatePath("/console/parties")');
  });
});

describe("console dashboard finance charts", () => {
  it("home uses getDashboardData and renders SVG series", () => {
    const home = src("src/app/console/(desk)/page.tsx");
    expect(home).toContain("getDashboardData");
    expect(home).toContain("PipelineStageChart");
    expect(home).toContain("<svg");
    expect(home).toContain("openDealByStage");
    expect(existsSync(join(root, "src/features/dashboard/queries.ts"))).toBe(
      true,
    );
  });
});
