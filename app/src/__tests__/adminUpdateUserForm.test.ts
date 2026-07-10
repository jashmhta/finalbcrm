/**
 * Unit tests for parseUpdateUserFormFields — real shipped helper.
 * Proves password-only FormData does not request role/barrier sync (RBAC safe).
 */
import { describe, expect, it } from "vitest";

import { parseUpdateUserFormFields } from "@/features/admin/update-user-form";

function fd(entries: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("parseUpdateUserFormFields", () => {
  it("password-only FormData omits roleNames and barrierClearance", () => {
    const fields = parseUpdateUserFormFields(
      fd([
        ["userId", "11111111-2222-4333-8444-555555555555"],
        ["password", "NewSecurePass1"],
      ]),
    );
    expect(fields.password).toBe("NewSecurePass1");
    expect(fields.roleNames).toBeUndefined();
    expect(fields.barrierClearance).toBeUndefined();
    expect(fields.userId).toBe("11111111-2222-4333-8444-555555555555");
  });

  it("rolesSync present with checkboxes replaces role set", () => {
    const fields = parseUpdateUserFormFields(
      fd([
        ["userId", "11111111-2222-4333-8444-555555555555"],
        ["rolesSync", "1"],
        ["roleNames", "coverage_rm"],
        ["roleNames", "credit_analyst"],
      ]),
    );
    expect(fields.roleNames).toEqual(["coverage_rm", "credit_analyst"]);
    expect(fields.barrierClearance).toBeUndefined();
  });

  it("rolesSync with no checkboxes is empty array (revoke all)", () => {
    const fields = parseUpdateUserFormFields(
      fd([
        ["userId", "11111111-2222-4333-8444-555555555555"],
        ["rolesSync", "1"],
      ]),
    );
    expect(fields.roleNames).toEqual([]);
  });

  it("barriersSync only when sentinel present", () => {
    const no = parseUpdateUserFormFields(
      fd([["userId", "11111111-2222-4333-8444-555555555555"]]),
    );
    expect(no.barrierClearance).toBeUndefined();
    const yes = parseUpdateUserFormFields(
      fd([
        ["userId", "11111111-2222-4333-8444-555555555555"],
        ["barriersSync", "1"],
        ["barrierClearance", "wall-ib"],
      ]),
    );
    expect(yes.barrierClearance).toEqual(["wall-ib"]);
  });

  it("legacy EditUserDialog FormData (roleNames + barrierClearance, no sentinels) still syncs", () => {
    // Shape mirrors /admin/users EditUserDialog after rolesSync/barriersSync fix,
    // and also dual-accepts pre-fix payloads that already emit roleNames fields.
    const fields = parseUpdateUserFormFields(
      fd([
        ["userId", "11111111-2222-4333-8444-555555555555"],
        ["desk", "ib_advisory"],
        ["isActive", "true"],
        ["password", ""],
        ["roleNames", "coverage_rm"],
        ["roleNames", "admin"],
        ["barrierClearance", "wall-ib"],
        ["barrierClearance", "wall-credit"],
      ]),
    );
    expect(fields.roleNames).toEqual(["coverage_rm", "admin"]);
    expect(fields.roleNames).toBeDefined();
    expect(fields.barrierClearance).toEqual(["wall-ib", "wall-credit"]);
    expect(fields.desk).toBe("ib_advisory");
  });

  it("legacy full-edit with rolesSync/barriersSync and empty roles revokes all", () => {
    const fields = parseUpdateUserFormFields(
      fd([
        ["userId", "11111111-2222-4333-8444-555555555555"],
        ["rolesSync", "1"],
        ["barriersSync", "1"],
        ["desk", "management"],
        ["isActive", "true"],
        ["password", ""],
      ]),
    );
    expect(fields.roleNames).toEqual([]);
    expect(fields.barrierClearance).toEqual([]);
  });
});
