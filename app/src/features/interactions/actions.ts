"use server";

// Interaction mutations (DATA_MODEL §2.18). Create inserts the interaction
// (anchored to ≥1 of party/deal/contact - enforced by the
// `interaction_anchor_check` CHECK) plus its interaction_attendee junction
// rows in a single RLS transaction. Update is limited to the mutable
// descriptive fields; the anchor and attendees are not edited here (a later
// phase owns attendee management).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";

import { can, requireUser } from "@/lib/rbac";
import { withRls } from "@/db/context";
import { interaction, interactionAttendee } from "@/db/schema";

const CHANNELS = [
  "meeting",
  "call",
  "email",
  "whatsapp",
  "rfq",
  "ndsom_chat",
  "site_visit",
  "management_presentation",
] as const;

const DIRECTIONS = ["inbound", "outbound"] as const;

const ATTENDEE_ROLES = [
  "host",
  "chair",
  "presenter",
  "issuer_side",
  "investor_side",
  "advisor",
  "observer",
  "other",
] as const;

const attendeeSchema = z.object({
  contactId: z.uuid(),
  roleAtMeeting: z.enum(ATTENDEE_ROLES).optional(),
});

const createInteractionSchema = z.object({
  subject: z.string().max(300).optional(),
  body: z.string().max(20_000).optional(),
  channel: z.enum(CHANNELS).optional(),
  direction: z.enum(DIRECTIONS).optional(),
  occurredAt: z.iso.datetime().optional(),
  durationMin: z.number().int().nonnegative().max(10_000).optional(),
  partyId: z.uuid().optional(),
  dealId: z.uuid().optional(),
  contactId: z.uuid().optional(),
  primaryContactId: z.uuid().optional(),
  containsMnpi: z.boolean().default(false),
  barrierId: z.uuid().optional(),
  nextAction: z.string().max(500).optional(),
  attendees: z.array(attendeeSchema).max(50).default([]),
});

export type CreateInteractionState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  const attendeesRaw = formData.get("attendees");
  let attendees: unknown = [];
  if (typeof attendeesRaw === "string" && attendeesRaw.trim()) {
    try {
      attendees = JSON.parse(attendeesRaw);
    } catch {
      attendees = [];
    }
  }
  const occurredAt = formData.get("occurredAt");
  const durationMin = formData.get("durationMin");
  return {
    subject: formData.get("subject") || undefined,
    body: formData.get("body") || undefined,
    channel: formData.get("channel") || undefined,
    direction: formData.get("direction") || undefined,
    occurredAt: typeof occurredAt === "string" && occurredAt ? occurredAt : undefined,
    durationMin:
      typeof durationMin === "string" && durationMin
        ? Number(durationMin)
        : undefined,
    partyId: formData.get("partyId") || undefined,
    dealId: formData.get("dealId") || undefined,
    contactId: formData.get("contactId") || undefined,
    primaryContactId: formData.get("primaryContactId") || undefined,
    containsMnpi: formData.get("containsMnpi") === "on",
    barrierId: formData.get("barrierId") || undefined,
    nextAction: formData.get("nextAction") || undefined,
    attendees,
  };
}

/**
 * Create an interaction + its attendees. Validates that at least one anchor
 * (party/deal/contact) is set - the DB CHECK is a backstop, but failing here
 * gives a friendlier message than a Postgres error.
 */
export async function createInteraction(
  _prev: CreateInteractionState,
  formData: FormData,
): Promise<CreateInteractionState> {
  const user = await requireUser();
  if (!can(user, "create", "interaction")) {
    return { error: "You do not have permission to log interactions." };
  }

  const parsed = createInteractionSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  if (!input.partyId && !input.dealId && !input.contactId) {
    return {
      error: "An interaction must anchor to a party, deal, or contact.",
    };
  }

  const interactionId = await withRls(
    user.appUserId ?? crypto.randomUUID(),
    user.wall,
    [],
    async (tx) => {
      const [created] = await tx
        .insert(interaction)
        .values({
          partyId: input.partyId ?? null,
          dealId: input.dealId ?? null,
          contactId: input.contactId ?? null,
          channel: input.channel ?? null,
          direction: input.direction ?? null,
          subject: input.subject ?? null,
          body: input.body ?? null,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
          durationMin: input.durationMin ?? null,
          primaryContactId: input.primaryContactId ?? null,
          userId: user.appUserId,
          barrierId: input.barrierId ?? null,
          containsMnpi: input.containsMnpi,
          nextAction: input.nextAction ?? null,
        })
        .returning({ interactionId: interaction.interactionId });

      if (!created) throw new Error("Interaction insert returned no row");

      if (input.attendees.length > 0) {
        await tx.insert(interactionAttendee).values(
          input.attendees.map((a) => ({
            interactionId: created.interactionId,
            contactId: a.contactId,
            roleAtMeeting: a.roleAtMeeting ?? null,
          })),
        );
      }
      return created.interactionId;
    },
  );

  revalidatePath("/interactions");
  revalidatePath("/console/interactions");
  const redirectTo = formData.get("redirectTo");
  if (typeof redirectTo === "string" && redirectTo.startsWith("/console")) {
    redirect(redirectTo);
  }
  redirect(`/interactions/${interactionId}`);
}

const updateInteractionSchema = z.object({
  interactionId: z.uuid(),
  subject: z.string().max(300).optional(),
  body: z.string().max(20_000).optional(),
  nextAction: z.string().max(500).optional(),
});

export type UpdateInteractionState = { error?: string } | undefined;

/**
 * Light-touch update of an interaction's descriptive fields. The anchor and
// attendees are not editable here.
 */
export async function updateInteraction(
  _prev: UpdateInteractionState,
  formData: FormData,
): Promise<UpdateInteractionState> {
  const user = await requireUser();
  if (!can(user, "update", "interaction")) {
    return { error: "You do not have permission to edit interactions." };
  }

  const parsed = updateInteractionSchema.safeParse({
    interactionId: formData.get("interactionId"),
    subject: formData.get("subject") || undefined,
    body: formData.get("body") || undefined,
    nextAction: formData.get("nextAction") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  await withRls(
    user.appUserId ?? crypto.randomUUID(),
    user.wall,
    [],
    async (tx) => {
      await tx
        .update(interaction)
        .set({
          subject: input.subject ?? null,
          body: input.body ?? null,
          nextAction: input.nextAction ?? null,
          updatedAt: new Date(),
        })
        .where(eq(interaction.interactionId, input.interactionId));
    },
  );

  revalidatePath("/interactions");
  revalidatePath(`/interactions/${input.interactionId}`);
  return;
}
