"use server";

// Portfolio → Limits - server action for editing a counterparty credit limit.
//
// ARCHITECTURE §3 mutation boundary per action: authenticate (requireUser),
// authorize (can → credit_limit:approve; admin role bypasses), validate
// (zod), mutate (withRls - credit_limit is a business table under RLS), write
// an audit_log row, revalidate. The audit row rides the same transaction so
// the audit commit is atomic with the limit change (the hash-chain trigger
// populates prev_hash / row_hash).
//
// RBAC: only holders of the `credit_limit:approve` permission (the credit /
// risk desk) or the `admin` role may edit limits. The Limits page server
// component computes the same `canEdit` flag to gate the Edit buttons in the
// client view; the action re-checks on submit so a forged request from a
// user without the permission is rejected server-side.

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import { can, requireUser } from "@/lib/rbac";
import { withRls } from "@/db/context";
import { creditLimit, auditLog } from "@/db/schema";

// ---------------------------------------------------------------------------
// Permission guard - limit edits all require credit_limit:approve.
// ---------------------------------------------------------------------------

function requireApprove(
  user: Awaited<ReturnType<typeof requireUser>>,
): { ok: true } | { ok: false; error: string } {
  if (!can(user, "approve", "credit_limit")) {
    return {
      ok: false,
      error:
        "You do not have permission to approve credit limits. The credit_limit:approve grant is required.",
    };
  }
  return { ok: true };
}

const updateLimitSchema = z.object({
  creditLimitId: z.uuid("A valid limit id is required."),
  limitAmount: z
    .number()
    .finite()
    .positive("Limit amount must be greater than zero.")
    .max(1_000_000, "Limit amount is unreasonably large."),
  utilized: z
    .number()
    .finite()
    .min(0, "Utilized cannot be negative.")
    .max(1_000_000, "Utilized is unreasonably large."),
  reviewDueDate: z.iso.date().optional().or(z.literal("")),
});

export type UpdateLimitState = { error?: string; ok?: boolean } | undefined;

/**
 * Update a counterparty credit limit's `limit_amount`, `utilized`, and
 * `review_due_date`. The `available` generated column recomputes itself
 * (limit_amount - utilized) so the headroom is always correct after the write.
 *
 * The action is keyed by `creditLimitId` from the FormData, so the client edit
 * form is a plain `<form action={updateLimit}>` with hidden id + visible
 * amount / utilized / review fields. On success the action revalidates
 * `/portfolio/limits` (and the dashboard + overview, which read the same
 * limit rows) and returns `{ ok: true }` so the dialog can close.
 */
export async function updateLimit(
  _prev: UpdateLimitState,
  formData: FormData,
): Promise<UpdateLimitState> {
  const user = await requireUser();
  const guard = requireApprove(user);
  if (!guard.ok) return { error: guard.error };

  const parsed = updateLimitSchema.safeParse({
    creditLimitId: formData.get("creditLimitId"),
    limitAmount: Number(formData.get("limitAmount")),
    utilized: Number(formData.get("utilized")),
    reviewDueDate: (formData.get("reviewDueDate") as string | null) ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  try {
    await withRls(user.appUserId ?? crypto.randomUUID(), user.wall, [], async (tx) => {
      // Fetch the existing row (for the audit old-value snapshot + to confirm
      // the limit exists and is current). Read inside the RLS txn so walled
      // rows respect the user's barrier clearance.
      const [existing] = await tx
        .select({
          creditLimitId: creditLimit.creditLimitId,
          partyId: creditLimit.partyId,
          limitType: creditLimit.limitType,
          limitAmount: creditLimit.limitAmount,
          utilized: creditLimit.utilized,
          reviewDueDate: creditLimit.reviewDueDate,
        })
        .from(creditLimit)
        .where(
          eq(creditLimit.creditLimitId, input.creditLimitId!),
        );
      if (!existing) throw new Error("Credit limit not found.");

      const oldValue = {
        limitAmount: existing.limitAmount,
        utilized: existing.utilized,
        reviewDueDate: existing.reviewDueDate,
      };
      const newValue = {
        limitAmount: input.limitAmount,
        utilized: input.utilized,
        reviewDueDate: input.reviewDueDate || null,
      };

      await tx
        .update(creditLimit)
        .set({
          // numeric columns accept string values (drizzle typings).
          limitAmount: String(input.limitAmount),
          utilized: String(input.utilized),
          reviewDueDate: input.reviewDueDate || null,
          // date column - ISO YYYY-MM-DD string.
          utilizedAsOf: new Date().toISOString().slice(0, 10),
          isStale: false,
          approvedByUserId: user.appUserId,
          updatedAt: new Date(),
        })
        .where(eq(creditLimit.creditLimitId, input.creditLimitId!));

      await tx.insert(auditLog).values({
        entityType: "credit_limit",
        entityId: existing.creditLimitId,
        operation: "approve",
        fieldName: "limit_amount",
        oldValue,
        newValue,
        actorUserId: user.appUserId,
        actorRoleAtTime: user.roles?.[0] ?? null,
        correlationId: crypto.randomUUID(),
      });
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update the limit.";
    return { error: message };
  }

  // Revalidate the limits page + the dashboard + the portfolio overview, all
  // of which read the credit_limit / exposure aggregates.
  revalidatePath("/portfolio/limits");
  revalidatePath("/portfolio");
  revalidatePath("/");

  return { ok: true };
}
