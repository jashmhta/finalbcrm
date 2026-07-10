"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { and, eq, inArray, isNull, like, or } from "drizzle-orm";
import { z } from "zod/v4";

import { db } from "@/db";
import {
  address,
  appUser,
  contact,
  deal,
  dealParty,
  interaction,
  party,
  partyAssignmentRequest,
  partyContact,
  partyDuplicateCandidate,
  partyIdentifier,
  partyTypeAssignment,
  task,
} from "@/db/schema";
import { requireUser } from "@/lib/rbac";
import { isSuperAdmin } from "@/lib/org";
import { writeAudit } from "@/lib/audit-write";

export type SettingsActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  deleted?: number;
};

function requireSuper() {
  return requireUser().then((user) => {
    if (!isSuperAdmin(user.roles)) {
      throw new Error("SUPER_ONLY");
    }
    return user;
  });
}

async function verifyPassword(
  userId: string,
  password: string,
): Promise<boolean> {
  const [row] = await db
    .select({ passwordHash: appUser.passwordHash })
    .from(appUser)
    .where(and(eq(appUser.userId, userId), isNull(appUser.deletedAt)))
    .limit(1);
  if (!row?.passwordHash) return false;
  return bcrypt.compare(password, row.passwordHash);
}

/** Soft-delete a single party (super). */
export async function superDeleteParty(
  _prev: SettingsActionState | undefined,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    const user = await requireSuper();
    const partyId = String(formData.get("partyId") ?? "");
    const password = String(formData.get("password") ?? "");
    if (!partyId || !password) return { error: "Party and password required." };
    if (!(await verifyPassword(user.appUserId!, password))) {
      return { error: "Password incorrect. Data not changed." };
    }

    await db
      .update(party)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        updatedByUserId: user.appUserId,
      })
      .where(eq(party.partyId, partyId));

    await writeAudit({
      actor: user,
      entityType: "party",
      entityId: partyId,
      operation: "delete",
      fieldName: "deleted_at",
      newValue: "soft-deleted",
    });

    revalidatePath("/console/parties");
    revalidatePath("/console/settings");
    revalidatePath("/console/search");
    return { ok: true, message: "Client soft-deleted.", deleted: 1 };
  } catch (e) {
    if (e instanceof Error && e.message === "SUPER_ONLY") {
      return { error: "Super admin only." };
    }
    return { error: "Delete failed." };
  }
}

/** Update core party fields (super). */
export async function superUpdateParty(
  _prev: SettingsActionState | undefined,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    const user = await requireSuper();
    const parsed = z
      .object({
        partyId: z.uuid(),
        legalName: z.string().min(1).max(200),
        status: z.string().min(1).max(40),
        brandOrigin: z.enum(["binarycapital", "binarybonds", "shared"]),
        password: z.string().min(1),
      })
      .safeParse({
        partyId: formData.get("partyId"),
        legalName: formData.get("legalName"),
        status: formData.get("status"),
        brandOrigin: formData.get("brandOrigin"),
        password: formData.get("password"),
      });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    const input = parsed.data;
    if (!(await verifyPassword(user.appUserId!, input.password))) {
      return { error: "Password incorrect. Data not changed." };
    }

    await db
      .update(party)
      .set({
        legalName: input.legalName,
        status: input.status as "active",
        brandOrigin: input.brandOrigin,
        updatedAt: new Date(),
        updatedByUserId: user.appUserId,
      })
      .where(eq(party.partyId, input.partyId));

    await writeAudit({
      actor: user,
      entityType: "party",
      entityId: input.partyId,
      operation: "update",
      fieldName: "super_edit",
      newValue: {
        legalName: input.legalName,
        status: input.status,
        brandOrigin: input.brandOrigin,
      },
    });

    revalidatePath(`/console/parties/${input.partyId}`);
    revalidatePath("/console/settings");
    revalidatePath("/console/parties");
    return { ok: true, message: "Client updated." };
  } catch (e) {
    if (e instanceof Error && e.message === "SUPER_ONLY") {
      return { error: "Super admin only." };
    }
    return { error: "Update failed." };
  }
}

/**
 * Clear client data scopes with password confirmation.
 * scope: mock | scale | all_clients
 */
export async function superClearClientData(
  _prev: SettingsActionState | undefined,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    const user = await requireSuper();
    const scope = String(formData.get("scope") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (!password) return { error: "Enter your password to confirm." };
    if (!(await verifyPassword(user.appUserId!, password))) {
      return { error: "Password incorrect. Nothing was deleted." };
    }

    if (scope === "all_clients" && confirm !== "DELETE ALL CLIENTS") {
      return {
        error:
          'Type DELETE ALL CLIENTS exactly in the confirmation field for full wipe.',
      };
    }
    if (scope === "scale" && confirm !== "CLEAR SCALE") {
      return { error: "Type CLEAR SCALE to confirm scale seed wipe." };
    }
    if (scope === "mock" && confirm !== "CLEAR MOCK") {
      return { error: "Type CLEAR MOCK to confirm mock wipe." };
    }
    if (!["mock", "scale", "all_clients"].includes(scope)) {
      return { error: "Unknown clear scope." };
    }

    // Resolve party ids in scope
    let partyIds: string[] = [];
    if (scope === "mock") {
      const rows = await db
        .select({ partyId: party.partyId })
        .from(party)
        .where(
          and(
            isNull(party.deletedAt),
            or(
              like(party.sourceRef, "MOCK-%"),
              like(party.legalName, "MOCK %"),
            ),
          ),
        );
      partyIds = rows.map((r) => r.partyId);
    } else if (scope === "scale") {
      const rows = await db
        .select({ partyId: party.partyId })
        .from(party)
        .where(
          and(isNull(party.deletedAt), eq(party.sourceRef, "seed-scale")),
        );
      partyIds = rows.map((r) => r.partyId);
    } else {
      const rows = await db
        .select({ partyId: party.partyId })
        .from(party)
        .where(isNull(party.deletedAt));
      partyIds = rows.map((r) => r.partyId);
    }

    if (partyIds.length === 0) {
      return { ok: true, message: "No matching clients to clear.", deleted: 0 };
    }

    // Chunk hard-cleanup of dependents then soft-delete parties
    const CHUNK = 400;
    let deleted = 0;
    for (let i = 0; i < partyIds.length; i += CHUNK) {
      const slice = partyIds.slice(i, i + CHUNK);

      await db
        .delete(partyAssignmentRequest)
        .where(inArray(partyAssignmentRequest.partyId, slice));
      await db.delete(interaction).where(inArray(interaction.partyId, slice));
      await db.delete(task).where(inArray(task.partyId, slice));
      await db
        .delete(partyDuplicateCandidate)
        .where(
          or(
            inArray(partyDuplicateCandidate.sourcePartyId, slice),
            inArray(partyDuplicateCandidate.candidatePartyId, slice),
          ),
        );

      await db.delete(dealParty).where(inArray(dealParty.partyId, slice));

      if (scope === "scale") {
        await db.delete(deal).where(like(deal.dealCode, "SCALE-%"));
      }

      const pc = await db
        .select({ contactId: partyContact.contactId })
        .from(partyContact)
        .where(inArray(partyContact.partyId, slice));
      const contactIds = [
        ...new Set(pc.map((r) => r.contactId).filter(Boolean)),
      ] as string[];

      await db.delete(partyContact).where(inArray(partyContact.partyId, slice));
      if (contactIds.length) {
        await db.delete(contact).where(inArray(contact.contactId, contactIds));
      }

      await db.delete(address).where(inArray(address.partyId, slice));
      await db
        .delete(partyIdentifier)
        .where(inArray(partyIdentifier.partyId, slice));
      await db
        .delete(partyTypeAssignment)
        .where(inArray(partyTypeAssignment.partyId, slice));

      await db
        .update(party)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
          updatedByUserId: user.appUserId,
        })
        .where(inArray(party.partyId, slice));

      deleted += slice.length;
    }

    await writeAudit({
      actor: user,
      entityType: "party",
      entityId: "bulk",
      operation: "delete",
      fieldName: "clear_client_data",
      newValue: { scope, deleted },
    });

    revalidatePath("/console/parties");
    revalidatePath("/console/leads");
    revalidatePath("/console/deals");
    revalidatePath("/console/settings");
    revalidatePath("/console/search");
    revalidatePath("/console");

    return {
      ok: true,
      message: `Cleared ${deleted} clients (${scope}).`,
      deleted,
    };
  } catch (e) {
    if (e instanceof Error && e.message === "SUPER_ONLY") {
      return { error: "Super admin only." };
    }
    console.error("superClearClientData", e);
    return {
      error:
        e instanceof Error
          ? `Clear failed: ${e.message}`
          : "Clear failed unexpectedly.",
    };
  }
}
