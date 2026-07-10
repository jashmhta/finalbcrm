/**
 * Proves shipped actions revalidate/redirect console paths for desk loops.
 * Reads real source of actions.ts (not reimplemented).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function src(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("console mutation path wiring", () => {
  it("createParty revalidates and redirects under /console to new party 360", () => {
    const t = src("src/features/parties/actions.ts");
    expect(t).toContain('revalidatePath("/console/parties")');
    expect(t).toContain('revalidatePath(`/console/parties/${partyId}`)');
    expect(t).toContain('redirect(`/console/parties/${partyId}`)');
  });

  it("sendToDeal revalidates console matching and deals", () => {
    const t = src("src/features/matching/actions.ts");
    expect(t).toContain('revalidatePath("/console/matching")');
    expect(t).toContain('revalidatePath(`/console/matching/${data.issuerId}`)');
    expect(t).toContain('revalidatePath("/console/deals")');
    expect(t).toContain('revalidatePath(`/console/deals/${result.dealId}`)');
  });

  it("parties page mounts NewPartyForm when ?new=1", () => {
    const page = src("src/app/console/(desk)/parties/page.tsx");
    const form = src("src/app/console/(desk)/parties/new-form.tsx");
    expect(page).toContain("searchParams");
    expect(page).toContain('sp.new === "1"');
    expect(page).toContain("NewPartyForm");
    expect(form).toContain("createParty");
    expect(form).toContain('name="legalName"');
    expect(form).toContain("Add client");
  });

  it("winLead revalidates console deals and leads", () => {
    const t = src("src/features/leads/actions.ts");
    expect(t).toContain('revalidatePath("/console/deals")');
    expect(t).toContain('revalidatePath(`/console/deals/${createdDealId}`)');
    expect(t).toContain('revalidatePath("/console/leads")');
    expect(t).toContain('revalidatePath(`/console/leads/${partyId}`)');
  });

  it("runLeadMutation revalidates console leads (convert/lose path)", () => {
    const t = src("src/features/leads/actions.ts");
    // Shared helper used by convertToOpportunity, loseLead, BANT, etc.
    const fnStart = t.indexOf("async function runLeadMutation");
    expect(fnStart).toBeGreaterThan(-1);
    const slice = t.slice(fnStart, fnStart + 900);
    expect(slice).toContain('revalidatePath("/console/leads")');
    expect(slice).toContain('revalidatePath(`/console/leads/${partyId}`)');
    // convertToOpportunity must call the shared helper (not skip revalidate).
    expect(t).toContain("export async function convertToOpportunity");
    const convertStart = t.indexOf("export async function convertToOpportunity");
    const convertEnd = t.indexOf("export async function updateProbability");
    const convertSlice = t.slice(
      convertStart,
      convertEnd > convertStart ? convertEnd : convertStart + 2500,
    );
    expect(convertSlice).toContain("runLeadMutation");
  });

  it("console Mark lost sends a valid LOSS_REASONS enum value", () => {
    const actions = src("src/features/leads/actions.ts");
    const ui = src("src/app/console/(desk)/leads/[id]/lead-actions.tsx");
    // Extract LOSS_REASONS array literals from actions (shipped source of truth).
    const m = actions.match(
      /const LOSS_REASONS = \[([\s\S]*?)\] as const/,
    );
    expect(m).toBeTruthy();
    const reasons = [...(m![1].matchAll(/"([a-z_]+)"/g))].map((x) => x[1]);
    expect(reasons.length).toBeGreaterThan(0);
    const reasonMatch = ui.match(/fd\.set\("lossReason",\s*"([^"]+)"\)/);
    expect(reasonMatch, "lead-actions must set lossReason").toBeTruthy();
    expect(reasons).toContain(reasonMatch![1]);
    expect(ui).toContain("loseLead");
  });

  it("onboarding mutations revalidate console paths", () => {
    const t = src("src/features/onboarding/actions.ts");
    expect(t).toContain('revalidatePath("/console/onboarding")');
    expect(t).toContain('revalidatePath(`/console/onboarding/${partyId}`)');
  });

  it("deal board and matching send stay under /console/deals/[id]", () => {
    const board = src("src/app/console/(desk)/deals/page.tsx");
    const send = src("src/app/console/(desk)/matching/[id]/send-form.tsx");
    const detail = src("src/app/console/(desk)/deals/[id]/page.tsx");
    expect(board).toContain("`/console/deals/${d.dealId}`");
    expect(send).toContain("`/console/deals/${res.dealId}`");
    expect(detail).toContain("getDealDetail");
    expect(detail).not.toMatch(/ModuleStub/);
    expect(detail).toContain("/console/tasks");
    expect(detail).toContain("/console/interactions");
  });

  it("secondary module actions revalidate console paths", () => {
    const credit = src("src/features/credit/actions.ts");
    const kyc = src("src/features/compliance/actions.ts");
    const model = src("src/features/modeling/actions.ts");
    expect(credit).toContain('revalidatePath("/console/credit")');
    expect(credit).toContain('revalidatePath(`/console/credit/${analysisId}`)');
    expect(kyc).toContain('revalidatePath("/console/compliance/kyc")');
    expect(kyc).toContain(
      'revalidatePath(`/console/compliance/kyc/${input.kycRecordId}`)',
    );
    expect(model).toContain('revalidatePath("/console/modeling")');
  });
});
