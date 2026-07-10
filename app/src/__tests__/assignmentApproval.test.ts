import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("assignment approval workflow (shipped source)", () => {
  const actions = readFileSync(
    resolve(process.cwd(), "src/features/parties/actions.ts"),
    "utf8",
  );
  const schema = readFileSync(
    resolve(process.cwd(), "src/db/schema/party.ts"),
    "utf8",
  );
  const page = readFileSync(
    resolve(process.cwd(), "src/app/console/(desk)/assignments/page.tsx"),
    "utf8",
  );

  it("defines party_assignment_request and request/review actions", () => {
    expect(schema).toContain("partyAssignmentRequest");
    expect(schema).toContain("party_assignment_request");
    expect(actions).toContain("export async function requestPartyAssignment");
    expect(actions).toContain("export async function reviewPartyAssignment");
    expect(actions).toContain("duplicate assignment blocked");
  });

  it("keeps direct assign super-admin only", () => {
    const block = actions.slice(actions.indexOf("export async function assignParty"));
    expect(block.slice(0, 900)).toMatch(/Direct assign is super-admin only|isDirectAssignAdmin/);
  });

  it("console assignments page wires request + review UI", () => {
    expect(page).toContain("AssignmentRequestForm");
    expect(page).toContain("ReviewAssignmentForm");
    expect(page).toContain("Pending approval");
  });
});
