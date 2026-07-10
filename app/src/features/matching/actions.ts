// Server actions for the Investor Matching Engine.
//
// sendToDeal - the workspace's primary CTA. Takes a selected issuer + a set of
// matched investors and either (a) creates a new bond-underwriting mandate with
// the issuer as the lead deal_party and each selected investor as an investor
// deal_party carrying their indicated commitment, or (b) links the investors to
// an existing deal (adding deal_party rows, skipping any already present). The
// result redirects to the deal so the coverage desk can pick up placement.
//
// Writes run inside withRls (src/db/context.ts) so the deal + deal_party rows
// inherit the acting user's RLS context (wall / mandate scope). Permission is
// gated by `can(user, "create", "deal")` - the same grant the deals feature
// uses. All amounts are in ₹ Cr (the seed + deals feature convention).

"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ilike, inArray, isNull } from "drizzle-orm";
import { z } from "zod/v4";

import { requireUser, can } from "@/lib/rbac";
import { runWithUserRls } from "@/lib/rls-user";
import { writeAudit } from "@/lib/audit-write";
import { db } from "@/db";
import { deal, dealParty, party, partyTypeAssignment } from "@/db/schema";

// ---------------------------------------------------------------------------
// Input / output shapes
// ---------------------------------------------------------------------------

const sendToDealSchema = z.object({
  issuerId: z.uuidv4(),
  /** Optional - link to an existing deal instead of creating a new mandate. */
  existingDealId: z.uuidv4().optional(),
  dealName: z.string().min(3, "Deal name is required").max(200),
  dealType: z.enum([
    "bond_underwriting",
    "private_placement_debt",
    "dcm_advisory",
    "high_yield_bond",
  ]).default("bond_underwriting"),
  targetSizeCrores: z.coerce.number().positive().max(100000),
  targetTenorYears: z.coerce.number().positive().max(40),
  /** Selected investors: partyId + an indicated commitment in ₹ Cr. */
  investors: z
    .array(
      z.object({
        partyId: z.uuidv4(),
        commitmentCrores: z.coerce.number().positive().max(100000).optional(),
      }),
    )
    .min(1, "Select at least one investor to send to the deal."),
});

export type SendToDealInput = z.infer<typeof sendToDealSchema>;

export type SendToDealResult =
  | { ok: true; dealId: string; dealCode: string | null; addedInvestors: number; created: boolean }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// sendToDeal
// ---------------------------------------------------------------------------

export async function sendToDeal(
  input: SendToDealInput,
): Promise<SendToDealResult> {
  const user = await requireUser();
  if (!can(user, "create", "deal") && !can(user, "run", "matching")) {
    return {
      ok: false,
      error: "You do not have permission to create a deal from matching.",
    };
  }
  if (!user.appUserId) {
    return { ok: false, error: "Session is missing CRM user profile." };
  }

  const parsed = sendToDealSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const data = parsed.data;

  // Confirm the issuer exists + is typed as an issuer.
  const [issuer] = await db
    .select({ partyId: party.partyId, legalName: party.legalName })
    .from(party)
    .where(and(eq(party.partyId, data.issuerId), isNull(party.deletedAt)));
  if (!issuer) return { ok: false, error: "Issuer not found." };
  const issuerTyped = await db
    .select({ partyId: partyTypeAssignment.partyId })
    .from(partyTypeAssignment)
    .where(
      and(
        eq(partyTypeAssignment.partyId, data.issuerId),
        eq(partyTypeAssignment.partyType, "issuer"),
        isNull(partyTypeAssignment.deletedAt),
      ),
    )
    .limit(1);
  if (issuerTyped.length === 0)
    return { ok: false, error: "Party is not typed as an issuer." };

  // Confirm every selected investor exists.
  const invIds = data.investors.map((i) => i.partyId);
  const invRows = await db
    .select({ partyId: party.partyId })
    .from(party)
    .where(and(inArray(party.partyId, invIds), isNull(party.deletedAt)));
  if (invRows.length !== invIds.length)
    return { ok: false, error: "One or more selected investors could not be found." };

  // Best-effort: locate the firm's own arranger party (Binary Capital) so the
  // new mandate carries a lead manager. Skipped silently if not seeded.
  const [firm] = await db
    .select({ partyId: party.partyId })
    .from(party)
    .where(
      and(
        ilike(party.legalName, "Binary Capital%"),
        eq(party.brandOrigin, "binarycapital"),
        isNull(party.deletedAt),
      ),
    )
    .limit(1);

  const result = await runWithUserRls(user, async (tx, { appUserId }) => {
    let dealId: string;
    let dealCode: string | null;
    let created: boolean;

    if (data.existingDealId) {
      const [existing] = await tx
        .select({ dealId: deal.dealId, dealCode: deal.dealCode })
        .from(deal)
        .where(and(eq(deal.dealId, data.existingDealId), isNull(deal.deletedAt)));
      if (!existing) return { ok: false as const, error: "Existing deal not found." };
      dealId = existing.dealId;
      dealCode = existing.dealCode;
      created = false;
    } else {
      const suffix = crypto.randomUUID().slice(0, 4).toUpperCase();
      const code = `BC-M${suffix}`;
      const [createdDeal] = await tx
        .insert(deal)
        .values({
          dealCode: code,
          dealType: data.dealType,
          dealName: data.dealName,
          status: "lead",
          brand: "binarybonds",
          leadUserId: appUserId,
          targetSize: String(data.targetSizeCrores),
          targetTenorYears: String(data.targetTenorYears),
          currencyCode: "INR",
          createdByUserId: appUserId,
        })
        .returning({ dealId: deal.dealId, dealCode: deal.dealCode });
      if (!createdDeal) return { ok: false as const, error: "Failed to create the deal." };
      dealId = createdDeal.dealId;
      dealCode = createdDeal.dealCode;
      created = true;

      await tx.insert(dealParty).values({
        dealId,
        partyId: data.issuerId,
        role: "issuer",
        isLead: true,
        commitmentAmount: String(data.targetSizeCrores),
      });
      if (firm) {
        await tx.insert(dealParty).values({
          dealId,
          partyId: firm.partyId,
          role: "lead_manager",
          isLead: true,
          commitmentAmount: "0",
        });
      }
    }

    const already = await tx
      .select({ partyId: dealParty.partyId })
      .from(dealParty)
      .where(
        and(
          eq(dealParty.dealId, dealId),
          eq(dealParty.role, "investor"),
          inArray(dealParty.partyId, invIds),
          isNull(dealParty.deletedAt),
        ),
      );
    const present = new Set(already.map((r) => r.partyId));
    const toAdd = data.investors.filter((i) => !present.has(i.partyId));

    if (toAdd.length > 0) {
      await tx.insert(dealParty).values(
        toAdd.map((i) => ({
          dealId,
          partyId: i.partyId,
          role: "investor" as const,
          isLead: false,
          commitmentAmount:
            i.commitmentCrores != null ? String(i.commitmentCrores) : null,
        })),
      );
    }

    return {
      ok: true as const,
      dealId,
      dealCode,
      addedInvestors: toAdd.length,
      created,
    };
  });

  if (result.ok) {
    await writeAudit({
      actor: user,
      entityType: "deal",
      entityId: result.dealId,
      operation: result.created ? "insert" : "update",
      fieldName: "matching.sendToDeal",
      newValue: {
        issuerId: data.issuerId,
        investors: data.investors.length,
        addedInvestors: result.addedInvestors,
      },
    });
    revalidatePath("/matching");
    revalidatePath(`/matching/${data.issuerId}`);
    revalidatePath("/deals");
    revalidatePath(`/deals/${result.dealId}`);
    revalidatePath("/console/matching");
    revalidatePath(`/console/matching/${data.issuerId}`);
    revalidatePath("/console/deals");
    revalidatePath(`/console/deals/${result.dealId}`);
  }

  return result;
}
