"use server";

// Lead & Opportunity Management - server actions (mutations).
//
// All writes go through `withRls` so the party / deal RLS GUCs are set for the
// transaction. lead_meta is read + written as a JSONB blob via parameterised
// raw SQL (the column is not in the frozen Drizzle schema). The canonical
// load → mutate → write helper (`mutateLeadMeta`) keeps every transition
// consistent and stamps `updatedAt` on every change.
//
// Workflow enforced here:
//   new ──BANT──▶ qualified ──CTA──▶ opportunity ──win──▶ won (creates a deal)
//                                            └──lose──▶ lost (records a reason)
// `convertToOpportunity` requires a fully BANT-qualified lead (all four
// criteria met) - the CTA on the detail page is gated on the same check, so a
// manual POST can't skip qualification.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import { can, requireUser } from "@/lib/rbac";
import { withRls } from "@/db/context";
import { db } from "@/db";
import {
  deal,
  dealParty,
  interaction,
  party,
  partyTypeAssignment,
} from "@/db/schema";

import { normalizeLead } from "./queries";
import {
  BANT_CRITERIA,
  LEAD_DEAL_TYPE_LABELS,
  LEAD_STAGE_DEFAULT_PROBABILITY,
  isQualified,
  type BantCriterion,
  type LeadDealType,
  type LeadLossReason,
  type LeadMeta,
  type LeadSource,
  type LeadStage,
} from "./types";

// ---------------------------------------------------------------------------
// Enum value lists (kept in sync with types.ts)
// ---------------------------------------------------------------------------

const SOURCES = [
  "referral",
  "website",
  "event",
  "cold_call",
  "existing_client",
] as const;

const DEAL_TYPES = [
  "bond_underwriting",
  "gsec_auction",
  "high_yield_bond",
  "rating_advisory",
  "m_and_a",
  "project_finance",
  "structured_finance",
  "supply_chain_finance",
  "dcm_advisory",
  "private_placement_debt",
  "portfolio_management_mandate",
  "secondary_trading_advisory",
] as const;

const LOSS_REASONS = [
  "pricing_uncompetitive",
  "competitor_selected",
  "deal_deferred",
  "client_withdrew",
  "failed_kyc",
  "no_budget",
  "lost_to_in_house",
  "other",
] as const;

// ---------------------------------------------------------------------------
// createLead - capture a new lead.
//
// Two capture modes:
//   1. New company  → inserts a prospect party (type=prospect, status=
//      onboarding) + party_type_assignment + lead_meta.
//   2. Existing client → links lead_meta onto an existing party (source=
//      'existing_client'); no new party is created.
// ---------------------------------------------------------------------------

const createSchema = z.object({
  mode: z.enum(["new", "existing"]).default("new"),
  // new-company fields
  companyName: z.string().min(2, "Company name is required.").max(200),
  // existing-company field
  linkPartyId: z.uuidv4().optional(),
  source: z.enum(SOURCES),
  dealType: z.enum(DEAL_TYPES),
  estSizeCr: z.coerce.number().nonnegative().max(50000).optional(),
  assignedRm: z.uuidv4().optional(),
  expectedClose: z.iso.date().optional(),
  // contact
  contactName: z.string().max(160).optional(),
  contactTitle: z.string().max(160).optional(),
  contactEmail: z.email().optional(),
  contactPhone: z.string().max(32).optional(),
  notes: z.string().max(4000).optional(),
});

export type CreateLeadState = { error?: string } | undefined;

export async function createLead(
  _prev: CreateLeadState,
  formData: FormData,
): Promise<CreateLeadState> {
  const user = await requireUser();
  if (!can(user, "create", "party")) {
    return { error: "You do not have permission to capture a lead." };
  }

  const parsed = createSchema.safeParse({
    mode: formData.get("mode") || "new",
    companyName: formData.get("companyName"),
    linkPartyId: formData.get("linkPartyId") || undefined,
    source: formData.get("source"),
    dealType: formData.get("dealType"),
    estSizeCr: formData.get("estSizeCr") || undefined,
    assignedRm: formData.get("assignedRm") || undefined,
    expectedClose: formData.get("expectedClose") || undefined,
    contactName: formData.get("contactName") || undefined,
    contactTitle: formData.get("contactTitle") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;
  const mode: "new" | "existing" = input.mode === "existing" ? "existing" : "new";

  // Existing-client mode: the linked party must exist and not already be a lead.
  if (mode === "existing") {
    if (!input.linkPartyId) {
      return { error: "Select an existing relationship to link the lead to." };
    }
    const [existing] = await db
      .select({ partyId: party.partyId, leadMeta: sql<unknown>`lead_meta` })
      .from(party)
      .where(eq(party.partyId, input.linkPartyId));
    if (!existing) return { error: "Selected relationship not found." };
    if (existing.leadMeta) {
      return { error: "That relationship is already being tracked as a lead." };
    }
  }

  const now = new Date().toISOString();
  const leadMeta: LeadMeta = {
    stage: "new",
    source: input.source as LeadSource,
    dealType: input.dealType as LeadDealType,
    estSizeCr: input.estSizeCr ?? null,
    probability: LEAD_STAGE_DEFAULT_PROBABILITY.new,
    expectedClose: input.expectedClose ?? null,
    assignedRm: input.assignedRm ?? null,
    contactName: input.contactName ?? null,
    contactTitle: input.contactTitle ?? null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
    bant: { budget: false, authority: false, need: false, timeline: false },
    notes: input.notes ?? null,
    lossReason: null,
    convertedDealId: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  // party.source (dataSourceEnum) - map the granular lead source onto the
  // closest enum value. The granular source is preserved in lead_meta.source.
  const partySource =
    input.source === "website" ? "website_lead" : "manual";

  const partyId = await withRls(
    user.appUserId ?? crypto.randomUUID(),
    user.wall,
    [],
    async (tx) => {
      let pid: string;
      if (mode === "existing" && input.linkPartyId) {
        pid = input.linkPartyId;
      } else {
        const [created] = await tx
          .insert(party)
          .values({
            legalName: input.companyName,
            displayName: input.companyName,
            partyNature: "organization",
            countryOfIncorporation: "IN",
            status: "onboarding",
            brandOrigin: "binarybonds",
            source: partySource,
            createdByUserId: user.appUserId,
          })
          .returning({ partyId: party.partyId });
        if (!created) throw new Error("party insert returned no row");
        pid = created.partyId;
        // Tag the new prospect party with party_type='prospect'.
        await tx.insert(partyTypeAssignment).values({
          partyId: pid,
          partyType: "prospect",
          assignedByUserId: user.appUserId,
        });
      }
      // Stamp lead_meta (raw SQL - column not in the typed schema).
      await tx.execute(
        sql`UPDATE party SET lead_meta = ${JSON.stringify(leadMeta)}::jsonb, updated_at = now() WHERE party_id = ${pid}`,
      );
      return pid;
    },
  );

  revalidatePath("/leads");
  revalidatePath("/console/leads");
  revalidatePath(`/console/leads/${partyId}`);
  const redirectTo = formData.get("redirectTo");
  if (typeof redirectTo === "string" && redirectTo.startsWith("/console")) {
    redirect(redirectTo.includes(partyId) ? redirectTo : `/console/leads/${partyId}`);
  }
  redirect(`/leads/${partyId}`);
}

// ---------------------------------------------------------------------------
// mutateLeadMeta - load → mutate → write inside an RLS transaction.
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function mutateLeadMeta(
  tx: Tx,
  partyId: string,
  fn: (m: LeadMeta) => LeadMeta,
): Promise<LeadMeta> {
  const rows = await tx.execute<{ lead_meta: unknown }>(sql`
    SELECT lead_meta FROM party WHERE party_id = ${partyId} AND deleted_at IS NULL
  `);
  if (rows.length === 0) throw new Error("Lead not found.");
  const current = normalizeLead(rows[0]!.lead_meta);
  const next = fn({
    ...current,
    bant: { ...current.bant },
  });
  const stamped: LeadMeta = { ...next, updatedAt: new Date().toISOString() };
  await tx.execute(
    sql`UPDATE party SET lead_meta = ${JSON.stringify(stamped)}::jsonb, updated_at = now() WHERE party_id = ${partyId}`,
  );
  return stamped;
}

/** Run a lead mutation under RLS and revalidate the leads pages. Returns
 *  { ok } on success or { error } on failure (thrown errors bubble to the
 *  server-action boundary as 500s - same as the credit/interaction actions). */
async function runLeadMutation(
  partyId: string,
  fn: (m: LeadMeta) => LeadMeta,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  if (!can(user, "update", "party")) {
    return { error: "You do not have permission to update this lead." };
  }
  try {
    await withRls(user.appUserId ?? crypto.randomUUID(), user.wall, [], (tx) =>
      mutateLeadMeta(tx, partyId, fn),
    );
    revalidatePath("/leads");
    revalidatePath(`/leads/${partyId}`);
    revalidatePath("/console/leads");
    revalidatePath(`/console/leads/${partyId}`);
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not update the lead.",
    };
  }
}

// ---------------------------------------------------------------------------
// updateBant - toggle one BANT criterion.
// ---------------------------------------------------------------------------

export type UpdateBantState = { ok?: boolean; error?: string; bantScore?: number; qualified?: boolean } | undefined;

const bantSchema = z.object({
  partyId: z.uuidv4(),
  criterion: z.enum(BANT_CRITERIA),
  value: z.coerce.boolean(),
});

export async function updateBant(
  _prev: UpdateBantState,
  formData: FormData,
): Promise<UpdateBantState> {
  const parsed = bantSchema.safeParse({
    partyId: formData.get("partyId"),
    criterion: formData.get("criterion"),
    value: formData.get("value") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { partyId, criterion } = parsed.data;
  const crit = criterion as BantCriterion;

  // TOGGLE from the CURRENT DB value rather than trusting the form's `value`
  // field. The BANT checklist renders four submit buttons in one form, each
  // carrying a hidden `value` input; `formData.get("value")` returns the FIRST
  // in tree order (Budget's) regardless of which button was clicked, so the
  // passed `value` was unreliable. Toggling from the authoritative DB state
  // inside the RLS transaction is unambiguous and immune to client/server
  // state drift (the canonical source of truth is the row, not the cookie).
  const res = await runLeadMutation(partyId, (m) => {
    const bant = { ...m.bant, [crit]: !m.bant[crit] } as LeadMeta["bant"];
    // Auto-promote: when all four criteria are met and the lead is still in
    // 'new', flip it to 'qualified' so the funnel reflects the qualification
    // without a separate action. Never demote a later stage from here.
    const qualified = isQualified(bant);
    const stage: LeadStage =
      qualified && m.stage === "new" ? "qualified" : m.stage;
    const probability =
      qualified && m.stage === "new"
        ? LEAD_STAGE_DEFAULT_PROBABILITY.qualified
        : m.probability;
    return { ...m, bant, stage, probability };
  });
  if ("ok" in res) {
    // Recompute the post-mutation score for the client to reflect immediately.
    const rows = await db.execute<{ lead_meta: unknown }>(sql`
      SELECT lead_meta FROM party WHERE party_id = ${partyId}
    `);
    const m = normalizeLead(rows[0]?.lead_meta);
    const score =
      Number(m.bant.budget) +
      Number(m.bant.authority) +
      Number(m.bant.need) +
      Number(m.bant.timeline);
    return { ok: true, bantScore: score, qualified: isQualified(m.bant) };
  }
  return { error: res.error };
}

// ---------------------------------------------------------------------------
// convertToOpportunity - promote a qualified lead into an opportunity.
// Requires the full BANT qualification (the CTA is gated on the same check).
// ---------------------------------------------------------------------------

export type ConvertState = { ok?: boolean; error?: string } | undefined;

const convertSchema = z.object({
  partyId: z.uuidv4(),
  probability: z.coerce.number().min(0).max(100).optional(),
  expectedClose: z.iso.date().optional(),
  assignedRm: z.uuidv4().optional(),
});

export async function convertToOpportunity(
  _prev: ConvertState,
  formData: FormData,
): Promise<ConvertState> {
  const parsed = convertSchema.safeParse({
    partyId: formData.get("partyId"),
    probability: formData.get("probability") || undefined,
    expectedClose: formData.get("expectedClose") || undefined,
    assignedRm: formData.get("assignedRm") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { partyId } = parsed.data;

  // Pre-check qualification (read path) for a friendly error before the txn.
  const rows = await db.execute<{ lead_meta: unknown }>(sql`
    SELECT lead_meta FROM party WHERE party_id = ${partyId} AND deleted_at IS NULL
  `);
  if (rows.length === 0) return { error: "Lead not found." };
  const current = normalizeLead(rows[0]!.lead_meta);
  if (!isQualified(current.bant)) {
    return {
      error:
        "Complete all four BANT criteria before converting to an opportunity.",
    };
  }
  if (current.stage === "won" || current.stage === "lost") {
    return { error: "This lead is already closed." };
  }

  const res = await runLeadMutation(partyId, (m) => {
    const probability = parsed.data.probability ?? (
      m.probability >= LEAD_STAGE_DEFAULT_PROBABILITY.opportunity
        ? m.probability
        : LEAD_STAGE_DEFAULT_PROBABILITY.opportunity
    );
    return {
      ...m,
      stage: "opportunity",
      probability,
      expectedClose: parsed.data.expectedClose ?? m.expectedClose,
      assignedRm: parsed.data.assignedRm ?? m.assignedRm,
    };
  });
  return "ok" in res ? { ok: true } : { error: res.error };
}

// ---------------------------------------------------------------------------
// updateProbability / updateExpectedClose / updateAssignedRm - inline edits
// on the opportunity detail panel.
// ---------------------------------------------------------------------------

export type FieldState = { ok?: boolean; error?: string } | undefined;

const probSchema = z.object({
  partyId: z.uuidv4(),
  probability: z.coerce.number().min(0).max(100),
});
export async function updateProbability(
  _prev: FieldState,
  formData: FormData,
): Promise<FieldState> {
  const parsed = probSchema.safeParse({
    partyId: formData.get("partyId"),
    probability: formData.get("probability"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const res = await runLeadMutation(parsed.data.partyId, (m) => ({
    ...m,
    probability: parsed.data.probability,
  }));
  return "ok" in res ? { ok: true } : { error: res.error };
}

const closeSchema = z.object({
  partyId: z.uuidv4(),
  expectedClose: z.iso.date().optional(),
});
export async function updateExpectedClose(
  _prev: FieldState,
  formData: FormData,
): Promise<FieldState> {
  const parsed = closeSchema.safeParse({
    partyId: formData.get("partyId"),
    expectedClose: formData.get("expectedClose") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const res = await runLeadMutation(parsed.data.partyId, (m) => ({
    ...m,
    expectedClose: parsed.data.expectedClose ?? null,
  }));
  return "ok" in res ? { ok: true } : { error: res.error };
}

const rmSchema = z.object({
  partyId: z.uuidv4(),
  assignedRm: z.uuidv4().optional(),
});
export async function updateAssignedRm(
  _prev: FieldState,
  formData: FormData,
): Promise<FieldState> {
  const parsed = rmSchema.safeParse({
    partyId: formData.get("partyId"),
    assignedRm: formData.get("assignedRm") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const res = await runLeadMutation(parsed.data.partyId, (m) => ({
    ...m,
    assignedRm: parsed.data.assignedRm ?? null,
  }));
  return "ok" in res ? { ok: true } : { error: res.error };
}

// ---------------------------------------------------------------------------
// winLead - convert a won lead into a real deal row.
//
// Creates a `deal` (status='mandated' - the mandate is won) linked to the
// prospect party via deal_party (issuer for debt deals, target for M&A), then
// stamps lead_meta.stage='won', convertedDealId, closedAt, probability=100.
// ---------------------------------------------------------------------------

export type WinState = { ok?: boolean; error?: string; dealId?: string } | undefined;

const winSchema = z.object({ partyId: z.uuidv4() });

export async function winLead(
  _prev: WinState,
  formData: FormData,
): Promise<WinState> {
  const user = await requireUser();
  if (!can(user, "update", "party") || !can(user, "create", "deal")) {
    return { error: "You do not have permission to convert this lead to a deal." };
  }
  const parsed = winSchema.safeParse({ partyId: formData.get("partyId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const { partyId } = parsed.data;

  // Load the lead (read path) for the deal row fields.
  const rows = await db.execute<{ lead_meta: unknown; legal_name: string }>(sql`
    SELECT lead_meta, legal_name FROM party WHERE party_id = ${partyId} AND deleted_at IS NULL
  `);
  if (rows.length === 0) return { error: "Lead not found." };
  const meta = normalizeLead(rows[0]!.lead_meta);
  if (meta.stage === "won") return { error: "This lead is already won." };
  if (meta.stage === "lost") return { error: "A lost lead cannot be won." };
  const legalName = rows[0]!.legal_name;

  const dealRole = meta.dealType === "m_and_a" ? "target" : "issuer";
  const dealName = `${legalName} - ${LEAD_DEAL_TYPE_LABELS[meta.dealType]}`;
  // estSizeCr → absolute INR (deal.target_size is in deal currency units; the
  // deals board renders INR via compactINR which divides by 1e7 for Cr).
  const targetSize = meta.estSizeCr ? String(meta.estSizeCr * 1e7) : null;
  const dealCode = `BC-${new Date().getFullYear()}-${partyId.slice(0, 4).toUpperCase()}`;

  let createdDealId: string | null = null;
  try {
    createdDealId = await withRls(
      user.appUserId ?? crypto.randomUUID(),
      user.wall,
      [],
      async (tx) => {
        const [d] = await tx
          .insert(deal)
          .values({
            dealCode,
            dealType: meta.dealType,
            dealName,
            status: "mandated",
            brand: "binarybonds",
            leadUserId: meta.assignedRm ?? user.appUserId ?? null,
            targetCloseDate: meta.expectedClose ?? null,
            targetSize,
            currencyCode: "INR",
            createdByUserId: user.appUserId,
          })
          .returning({ dealId: deal.dealId });
        if (!d) throw new Error("deal insert returned no row");
        await tx.insert(dealParty).values({
          dealId: d.dealId,
          partyId,
          role: dealRole,
          isLead: true,
        });
        // Stamp the lead as won.
        await mutateLeadMeta(tx, partyId, (m) => ({
          ...m,
          stage: "won",
          probability: 100,
          convertedDealId: d.dealId,
          closedAt: new Date().toISOString(),
        }));
        return d.dealId;
      },
    );
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not convert the lead to a deal.",
    };
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${partyId}`);
  revalidatePath("/deals");
  revalidatePath(`/deals/${createdDealId}`);
  revalidatePath("/console/leads");
  revalidatePath(`/console/leads/${partyId}`);
  revalidatePath("/console/deals");
  revalidatePath(`/console/deals/${createdDealId}`);
  return { ok: true, dealId: createdDealId };
}

// ---------------------------------------------------------------------------
// loseLead - close a lead as lost with a reason.
// ---------------------------------------------------------------------------

export type LoseState = { ok?: boolean; error?: string } | undefined;

const loseSchema = z.object({
  partyId: z.uuidv4(),
  lossReason: z.enum(LOSS_REASONS),
});

export async function loseLead(
  _prev: LoseState,
  formData: FormData,
): Promise<LoseState> {
  const parsed = loseSchema.safeParse({
    partyId: formData.get("partyId"),
    lossReason: formData.get("lossReason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const { partyId, lossReason } = parsed.data;

  const rows = await db.execute<{ lead_meta: unknown }>(sql`
    SELECT lead_meta FROM party WHERE party_id = ${partyId} AND deleted_at IS NULL
  `);
  if (rows.length === 0) return { error: "Lead not found." };
  const current = normalizeLead(rows[0]!.lead_meta);
  if (current.stage === "won") return { error: "A won lead cannot be lost." };

  const res = await runLeadMutation(partyId, (m) => ({
    ...m,
    stage: "lost",
    probability: 0,
    lossReason: lossReason as LeadLossReason,
    closedAt: new Date().toISOString(),
  }));
  return "ok" in res ? { ok: true } : { error: res.error };
}

// ---------------------------------------------------------------------------
// addLeadNote - log an interaction anchored to the lead's party.
// ---------------------------------------------------------------------------

export type NoteState = { ok?: boolean; error?: string } | undefined;

const noteSchema = z.object({
  partyId: z.uuidv4(),
  body: z.string().min(1, "Note cannot be empty.").max(20_000),
});

export async function addLeadNote(
  _prev: NoteState,
  formData: FormData,
): Promise<NoteState> {
  const user = await requireUser();
  if (!can(user, "update", "party")) {
    return { error: "You do not have permission to add a note." };
  }
  const parsed = noteSchema.safeParse({
    partyId: formData.get("partyId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const { partyId, body } = parsed.data;

  try {
    await withRls(user.appUserId ?? crypto.randomUUID(), user.wall, [], async (tx) => {
      // Bump lead_meta.updatedAt so the lead surfaces as recently active.
      await mutateLeadMeta(tx, partyId, (m) => ({ ...m }));
      // Log the note as an outbound interaction anchored to the lead's party.
      await tx.insert(interaction).values({
        partyId,
        subject: "Lead note",
        body,
        channel: "call",
        direction: "outbound",
        occurredAt: new Date(),
        userId: user.appUserId,
      });
    });
    revalidatePath("/leads");
    revalidatePath(`/leads/${partyId}`);
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not add the note.",
    };
  }
}

// ---------------------------------------------------------------------------
// deleteLead - stop tracking a lead (clears lead_meta; the party row remains).
// ---------------------------------------------------------------------------

export type DeleteState = { ok?: boolean; error?: string } | undefined;

const deleteSchema = z.object({ partyId: z.uuidv4() });

export async function deleteLead(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const user = await requireUser();
  if (!can(user, "update", "party")) {
    return { error: "You do not have permission to remove this lead." };
  }
  const parsed = deleteSchema.safeParse({ partyId: formData.get("partyId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const { partyId } = parsed.data;

  try {
    await withRls(user.appUserId ?? crypto.randomUUID(), user.wall, [], (tx) => {
      return tx.execute(
        sql`UPDATE party SET lead_meta = NULL, updated_at = now() WHERE party_id = ${partyId} AND deleted_at IS NULL`,
      );
    });
    revalidatePath("/leads");
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not remove the lead.",
    };
  }
}

// NOTE: a "use server" module may export ONLY async functions. The previous
// `export { LEAD_STAGE_LABELS } from "./types"` re-export (a non-function
// constant) is illegal here and broke compilation of any client component
// that imported a server action from this file. The barrel
// (`@/features/leads`) already re-exports LEAD_STAGE_LABELS from ./types, so
// the convenience re-export was redundant and has been removed.
