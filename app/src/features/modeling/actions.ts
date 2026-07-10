"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";

import { requireUser, can } from "@/lib/rbac";
import { withRls } from "@/db/context";
import { db } from "@/db";
import { deal, dealParty, financialModel, party } from "@/db/schema";
import { and, eq, isNull, or, sql } from "drizzle-orm";

// zod v4 is exported under `zod/v4` (see package.json: zod ^4.4.3).

const MODEL_TYPES = [
  "bond_pricing",
  "project_finance",
  "securitization",
  "dcf",
  "m_and_a",
  "lbo",
  "valuation",
  "portfolio_construction",
  "scenario_stress",
] as const;

/**
 * Create a versioned financial_model record. params + outputs are JSONB and
 * schema-validated per model_type at the app layer (§2.17). version starts at
 * 1 for a new model; fork-from-parent is a later step (§6.2).
 */
const createModelSchema = z.object({
  modelType: z.enum(MODEL_TYPES),
  currencyCode: z.string().length(3).default("INR"),
  dealId: z.string().uuid().optional(),
  partyId: z.string().uuid().optional(),
  scenarioTag: z.string().max(120).optional(),
  assumptionsDoc: z.string().max(50_000).optional(),
  params: z.string().min(2, "params JSON is required"), // JSON string from the form
  outputs: z.string().min(2, "outputs JSON is required"),
  engineVersion: z.string().max(60).optional(),
});

export type CreateModelState = { error?: string } | undefined;

async function canLinkModelTarget({
  userId,
  dealId,
  partyId,
  canReadAll,
}: {
  userId: string | null;
  dealId?: string;
  partyId?: string;
  canReadAll: boolean;
}) {
  if (canReadAll || !userId) return true;

  if (partyId) {
    const [p] = await db
      .select({ partyId: party.partyId })
      .from(party)
      .where(
        and(
          eq(party.partyId, partyId),
          isNull(party.deletedAt),
          or(
            eq(party.assignedUserId, userId),
            eq(party.dataOwnerUserId, userId),
            eq(party.createdByUserId, userId),
          ),
        ),
      );
    if (!p) return false;
  }

  if (dealId) {
    const rows = await db
      .select({ dealId: deal.dealId })
      .from(deal)
      .where(
        and(
          eq(deal.dealId, dealId),
          isNull(deal.deletedAt),
          or(
            eq(deal.leadUserId, userId),
            eq(deal.creditAnalystUserId, userId),
            eq(deal.createdByUserId, userId),
            sql`EXISTS (
              SELECT 1
              FROM ${dealParty} dp_scope
              JOIN ${party} p_scope ON p_scope.party_id = dp_scope.party_id
              WHERE dp_scope.deal_id = ${deal.dealId}
                AND dp_scope.deleted_at IS NULL
                AND p_scope.deleted_at IS NULL
                AND (
                  p_scope.assigned_user_id = ${userId}
                  OR p_scope.data_owner_user_id = ${userId}
                  OR p_scope.created_by_user_id = ${userId}
                )
            )`,
          ),
        ),
      )
      .limit(1);
    if (!rows[0]) return false;
  }

  return true;
}

export async function createModel(
  _prev: CreateModelState,
  formData: FormData,
): Promise<CreateModelState> {
  const user = await requireUser();
  if (!can(user, "create", "financial_model")) {
    return { error: "You do not have permission to create models." };
  }

  const parsed = createModelSchema.safeParse({
    modelType: formData.get("modelType"),
    currencyCode: formData.get("currencyCode") || "INR",
    dealId: formData.get("dealId") || undefined,
    partyId: formData.get("partyId") || undefined,
    scenarioTag: formData.get("scenarioTag") || undefined,
    assumptionsDoc: formData.get("assumptionsDoc") || undefined,
    params: formData.get("params"),
    outputs: formData.get("outputs"),
    engineVersion: formData.get("engineVersion") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const canReadAllTargets =
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "financial_model") ||
    can(user, "read_all", "model") ||
    can(user, "read_all", "party") ||
    can(user, "read_all", "deal") ||
    can(user, "manage", "user");
  const targetAllowed = await canLinkModelTarget({
    userId: user.appUserId,
    dealId: input.dealId,
    partyId: input.partyId,
    canReadAll: canReadAllTargets,
  });
  if (!targetAllowed) {
    return { error: "You do not have access to the linked party or deal." };
  }

  // Validate the JSONB payloads parse cleanly.
  let paramsJson: unknown;
  let outputsJson: unknown;
  try {
    paramsJson = JSON.parse(input.params);
    outputsJson = JSON.parse(input.outputs);
  } catch {
    return { error: "params/outputs must be valid JSON." };
  }

  const modelId = await withRls(
    user.appUserId ?? crypto.randomUUID(),
    user.wall,
    input.dealId ? [input.dealId] : [],
    async (tx) => {
      const [created] = await tx
        .insert(financialModel)
        .values({
          modelType: input.modelType,
          version: 1,
          currencyCode: input.currencyCode,
          dealId: input.dealId ?? null,
          partyId: input.partyId ?? null,
          scenarioTag: input.scenarioTag ?? null,
          assumptionsDoc: input.assumptionsDoc ?? null,
          params: paramsJson,
          outputs: outputsJson,
          engineVersion: input.engineVersion ?? null,
          computedAt: new Date(),
          computedByUserId: user.appUserId,
        })
        .returning({ id: financialModel.financialModelId });
      if (!created) throw new Error("financial_model insert returned no row");
      return created.id;
    },
  );

  revalidatePath("/modeling");
  revalidatePath("/console/modeling");
  redirect(`/modeling/${modelId}`);
}
