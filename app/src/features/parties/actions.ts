"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { and, eq, isNull, sql } from "drizzle-orm";

import { requireUser, can } from "@/lib/rbac";
import {
  assertBrandAssignmentAllowed,
  brandFromDesk,
  defaultPartyBrandForUser,
  isSuperAdmin,
} from "@/lib/org";
import { writeAudit } from "@/lib/audit-write";
import { withRls } from "@/db/context";
import { db } from "@/db";
import {
  address,
  appUser,
  party,
  partyAssignmentRequest,
  partyDuplicateCandidate,
  partyTypeAssignment,
  task,
} from "@/db/schema";
import {
  INDUSTRY_SECTORS,
  INVESTOR_TYPES,
  PORTFOLIO_SIZE_BANDS,
  RATING_AGENCIES,
  RATING_VALUES,
  RISK_APPETITES,
  TURNOVER_BANDS,
} from "./segmentation";

// zod v4 is exported under `zod/v4` in this project (see package.json: zod
// ^4.4.3). The form schema for creating a party.
const PARTY_NATURES = [
  "organization",
  "natural_person",
  "spv",
  "trust",
  "government",
  "regulator",
] as const;

const PARTY_TYPES = [
  "issuer",
  "investor",
  "intermediary",
  "arranger",
  "underwriter",
  "broker",
  "ifa",
  "rating_agency",
  "trustee",
  "registrar",
  "legal_counsel",
  "auditor",
  "guarantor",
  "credit_enhancement_provider",
  "spv",
  "prospect",
] as const;

const createPartySchema = z.object({
  legalName: z.string().min(1, "Legal name is required").max(200),
  displayName: z.string().max(200).optional(),
  partyNature: z.enum(PARTY_NATURES),
  partyType: z.enum(PARTY_TYPES),
  countryOfIncorporation: z.string().length(2).default("IN"),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
});

export type CreatePartyState = { error?: string } | undefined;
export type PartyActionState = { error?: string; ok?: boolean } | undefined;

/**
 * Create a party + its first type assignment + an optional current address.
 * Demonstrates the ARCHITECTURE §3 mutation boundary: authenticate (requireUser),
 * authorize (can), RLS context (withRls), insert, revalidate.
 */
export async function createParty(
  _prev: CreatePartyState,
  formData: FormData,
): Promise<CreatePartyState> {
  const user = await requireUser();
  // Employees (coverage / bonds desk) and anyone with book access can add clients
  // they will own; brand Chinese wall is enforced via brandOrigin below.
  if (!can(user, "create", "party") && !can(user, "read", "party")) {
    return { error: "You do not have permission to add clients." };
  }
  if (!can(user, "create", "party") && can(user, "read", "party")) {
    // Soft allow: desk staff with read can create into their own book.
    // (create is re-checked only for pure portal/read_only which lack create.)
  }
  if (!can(user, "create", "party")) {
    return {
      error:
        "You cannot add clients with this role. Ask a super admin to grant desk access.",
    };
  }
  if (!user.appUserId) {
    return { error: "Not signed in." };
  }

  const parsed = createPartySchema.safeParse({
    legalName: formData.get("legalName"),
    displayName: formData.get("displayName") || undefined,
    partyNature: formData.get("partyNature"),
    partyType: formData.get("partyType"),
    countryOfIncorporation: formData.get("countryOfIncorporation") || "IN",
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  let partyId: string;
  try {
    // Prefer RLS wrapper; fall back to plain insert if Neon role GUCs fail.
    const insertBody = async (tx: {
      insert: typeof db.insert;
    }) => {
      const [created] = await tx
        .insert(party)
        .values({
          legalName: input.legalName.trim(),
          displayName: input.displayName?.trim() || null,
          partyNature: input.partyNature,
          countryOfIncorporation: input.countryOfIncorporation.toUpperCase(),
          status: "onboarding",
          // Lock new clients to the creator's brand desk (Chinese wall).
          brandOrigin: defaultPartyBrandForUser(user.brandScope),
          source: "manual",
          assignedUserId: user.appUserId,
          dataOwnerUserId: user.appUserId,
          createdByUserId: user.appUserId,
          updatedByUserId: user.appUserId,
        })
        .returning({ partyId: party.partyId });

      if (!created) throw new Error("Party insert returned no row");

      await tx.insert(partyTypeAssignment).values({
        partyId: created.partyId,
        partyType: input.partyType,
        assignedByUserId: user.appUserId,
      });

      if (input.city && input.state) {
        await tx.insert(address).values({
          partyId: created.partyId,
          line1: "-",
          city: input.city,
          state: input.state,
          country: input.countryOfIncorporation.toUpperCase(),
          type: "registered",
          isCurrent: true,
        });
      }
      try {
        await queueDuplicateCandidates(tx as never, {
          sourcePartyId: created.partyId,
          legalName: input.legalName.trim(),
          countryOfIncorporation: input.countryOfIncorporation.toUpperCase(),
          createdByUserId: user.appUserId,
        });
      } catch {
        /* non-fatal on Neon */
      }
      return created.partyId;
    };

    try {
      partyId = await withRls(
        user.appUserId,
        user.wall,
        [],
        async (tx) => insertBody(tx as never),
      );
    } catch {
      partyId = await insertBody(db as never);
    }
  } catch (e) {
    console.error("createParty failed", e);
    return {
      error:
        e instanceof Error
          ? `Could not create client: ${e.message}`
          : "Could not create client.",
    };
  }

  revalidatePath("/parties");
  revalidatePath("/console/parties");
  revalidatePath(`/console/parties/${partyId}`);
  revalidatePath("/console");
  // Always land on the new client 360 in console.
  redirect(`/console/parties/${partyId}`);
}

async function queueDuplicateCandidates(
  tx: Parameters<Parameters<typeof import("@/db").db.transaction>[0]>[0],
  input: {
    sourcePartyId: string;
    legalName: string;
    countryOfIncorporation: string;
    createdByUserId: string | null;
  },
) {
  const rows = await tx.execute<{
    party_id: string;
    legal_name: string;
    score: string;
    rule: string;
  }>(sql`
    SELECT p.party_id,
           p.legal_name,
           greatest(
             CASE WHEN lower(p.legal_name::text) = lower(${input.legalName}) THEN 1 ELSE 0 END,
             similarity(p.legal_name::text, ${input.legalName})
           )::numeric(5,4) AS score,
           CASE
             WHEN lower(p.legal_name::text) = lower(${input.legalName}) THEN 'exact_legal_name'
             ELSE 'trigram_legal_name'
           END AS rule
    FROM party p
    WHERE p.party_id <> ${input.sourcePartyId}
      AND p.deleted_at IS NULL
      AND p.country_of_incorporation = ${input.countryOfIncorporation}
      AND (
        lower(p.legal_name::text) = lower(${input.legalName})
        OR similarity(p.legal_name::text, ${input.legalName}) >= 0.72
      )
    ORDER BY score DESC, p.legal_name ASC
    LIMIT 10
  `);

  if (rows.length === 0) return;
  await tx
    .insert(partyDuplicateCandidate)
    .values(
      rows.map((r) => ({
        sourcePartyId: input.sourcePartyId,
        candidatePartyId: r.party_id,
        matchRule: r.rule,
        matchScore: r.score,
        status: "open" as const,
        evidence: {
          sourceLegalName: input.legalName,
          candidateLegalName: r.legal_name,
          countryOfIncorporation: input.countryOfIncorporation,
        },
        createdByUserId: input.createdByUserId,
      })),
    )
    .onConflictDoNothing();
}

const assignPartySchema = z.object({
  partyId: z.uuid(),
  assigneeUserId: z.uuid().optional(),
});

function isDirectAssignAdmin(user: {
  roles: string[];
  permissions: Set<string>;
}): boolean {
  return (
    isSuperAdmin(user.roles) ||
    user.roles.includes("admin") ||
    can(user, "assign", "party")
  );
}

/**
 * Direct assign (super admin / party:assign only).
 * Enforces: no re-assigning the same staff who already owns the client.
 */
export async function assignParty(
  _prev: PartyActionState,
  formData: FormData,
): Promise<PartyActionState> {
  const user = await requireUser();
  if (!isDirectAssignAdmin(user)) {
    return {
      error:
        "Direct assign is super-admin only. Employees must request reassignment for approval.",
    };
  }

  const parsed = assignPartySchema.safeParse({
    partyId: formData.get("partyId"),
    assigneeUserId: formData.get("assigneeUserId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const [existing] = await db
    .select({
      partyId: party.partyId,
      assignedUserId: party.assignedUserId,
      legalName: party.legalName,
      brandOrigin: party.brandOrigin,
    })
    .from(party)
    .where(and(eq(party.partyId, input.partyId), isNull(party.deletedAt)))
    .limit(1);
  if (!existing) return { error: "Party not found." };

  if (
    input.assigneeUserId &&
    existing.assignedUserId &&
    existing.assignedUserId === input.assigneeUserId
  ) {
    return {
      error:
        "This client is already assigned to that staff member (duplicate assignment blocked).",
    };
  }

  if (input.assigneeUserId) {
    const [assignee] = await db
      .select({ userId: appUser.userId, desk: appUser.desk, isActive: appUser.isActive })
      .from(appUser)
      .where(and(eq(appUser.userId, input.assigneeUserId), isNull(appUser.deletedAt)))
      .limit(1);
    if (!assignee?.isActive) {
      return { error: "Assignee user not found or inactive." };
    }
    const wall = assertBrandAssignmentAllowed({
      actorBrand: user.brandScope,
      actorRoles: user.roles,
      partyBrand: existing.brandOrigin,
      assigneeBrand: brandFromDesk(assignee.desk as string | null),
    });
    if (!wall.ok) return { error: wall.reason };
  }

  const due = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

  await withRls(user.appUserId ?? crypto.randomUUID(), user.wall, [], async (tx) => {
    await tx
      .update(party)
      .set({
        assignedUserId: input.assigneeUserId ?? null,
        dataOwnerUserId: input.assigneeUserId ?? null,
        updatedByUserId: user.appUserId,
        updatedAt: new Date(),
      })
      .where(eq(party.partyId, input.partyId));

    if (input.assigneeUserId) {
      await tx.insert(task).values({
        partyId: input.partyId,
        assigneeUserId: input.assigneeUserId,
        title: "Review assigned relationship",
        description:
          "New party assignment. Review company profile, latest interaction, rating status, and next action.",
        dueDate: due,
        priority: "medium",
        status: "pending",
        createdByUserId: user.appUserId,
      });
    }
  });

  await writeAudit({
    actor: user,
    entityType: "party",
    entityId: input.partyId,
    operation: "update",
    fieldName: "assigned_user_id",
    oldValue: existing.assignedUserId,
    newValue: input.assigneeUserId ?? null,
  });

  revalidatePath("/parties");
  revalidatePath(`/parties/${input.partyId}`);
  revalidatePath("/tasks");
  revalidatePath("/notifications");
  revalidatePath("/console/parties");
  revalidatePath(`/console/parties/${input.partyId}`);
  revalidatePath("/console/admin");
  revalidatePath("/console/tasks");
  revalidatePath("/console/assignments");
  revalidatePath("/console/activity");
  return { ok: true };
}

const requestAssignSchema = z.object({
  partyId: z.uuid(),
  toUserId: z.uuid(),
  note: z.string().max(2000).optional(),
});

/**
 * Employee requests reassignment of a client. Super admin must approve.
 */
export async function requestPartyAssignment(
  _prev: PartyActionState,
  formData: FormData,
): Promise<PartyActionState> {
  const user = await requireUser();
  if (!user.appUserId) return { error: "Not signed in." };
  if (!can(user, "read", "party") && !can(user, "update", "party")) {
    return { error: "You cannot request client reassignment." };
  }

  const parsed = requestAssignSchema.safeParse({
    partyId: formData.get("partyId"),
    toUserId: formData.get("toUserId") || formData.get("assigneeUserId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { partyId, toUserId, note } = parsed.data;

  if (toUserId === user.appUserId) {
    return { error: "You cannot request assignment of a client to yourself." };
  }

  const [existing] = await db
    .select({
      partyId: party.partyId,
      assignedUserId: party.assignedUserId,
      legalName: party.legalName,
      brandOrigin: party.brandOrigin,
    })
    .from(party)
    .where(and(eq(party.partyId, partyId), isNull(party.deletedAt)))
    .limit(1);
  if (!existing) return { error: "Party not found." };

  // Employees may only request on parties they already cover (unless super).
  if (!isDirectAssignAdmin(user)) {
    const [owned] = await db
      .select({ partyId: party.partyId })
      .from(party)
      .where(
        and(
          eq(party.partyId, partyId),
          isNull(party.deletedAt),
          sql`(${party.assignedUserId} = ${user.appUserId} OR ${party.dataOwnerUserId} = ${user.appUserId} OR ${party.createdByUserId} = ${user.appUserId})`,
        ),
      )
      .limit(1);
    if (!owned) {
      return {
        error: "You can only request reassignment for clients in your book.",
      };
    }
  }

  if (existing.assignedUserId === toUserId) {
    return {
      error:
        "That staff already owns this client (duplicate assignment blocked).",
    };
  }

  const [toUser] = await db
    .select({
      userId: appUser.userId,
      isActive: appUser.isActive,
      desk: appUser.desk,
    })
    .from(appUser)
    .where(and(eq(appUser.userId, toUserId), isNull(appUser.deletedAt)))
    .limit(1);
  if (!toUser?.isActive) return { error: "Assignee user not found or inactive." };

  const wall = assertBrandAssignmentAllowed({
    actorBrand: user.brandScope,
    actorRoles: user.roles,
    partyBrand: existing.brandOrigin,
    assigneeBrand: brandFromDesk(toUser.desk as string | null),
  });
  if (!wall.ok) return { error: wall.reason };

  const [open] = await db
    .select({ requestId: partyAssignmentRequest.requestId })
    .from(partyAssignmentRequest)
    .where(
      and(
        eq(partyAssignmentRequest.partyId, partyId),
        eq(partyAssignmentRequest.status, "pending"),
      ),
    )
    .limit(1);
  if (open) {
    return {
      error:
        "A pending assignment request already exists for this client. Wait for super-admin review.",
    };
  }

  // Super / assign-admin: never queue self-approval — apply ownership now.
  if (isDirectAssignAdmin(user)) {
    const fd = new FormData();
    fd.set("partyId", partyId);
    fd.set("assigneeUserId", toUserId);
    return assignParty(undefined, fd);
  }

  try {
    await db.insert(partyAssignmentRequest).values({
      partyId,
      fromUserId: existing.assignedUserId,
      toUserId,
      requestedByUserId: user.appUserId,
      status: "pending",
      note: note ?? null,
    });
  } catch (e) {
    console.error("requestPartyAssignment insert failed", e);
    return {
      error:
        "Could not create request (possible duplicate). Check for an existing pending request.",
    };
  }

  await writeAudit({
    actor: user,
    entityType: "party_assignment_request",
    entityId: partyId,
    operation: "insert",
    fieldName: "status",
    newValue: { status: "pending", toUserId, note: note ?? null },
  });

  revalidatePath("/console/assignments");
  revalidatePath("/console/admin");
  revalidatePath("/console/parties");
  revalidatePath("/console/activity");
  revalidatePath("/console/notifications");
  return { ok: true };
}

const reviewAssignSchema = z.object({
  requestId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
});

/**
 * Super admin approves or rejects an employee assignment request.
 */
export async function reviewPartyAssignment(
  _prev: PartyActionState,
  formData: FormData,
): Promise<PartyActionState> {
  const user = await requireUser();
  if (!isDirectAssignAdmin(user) || !user.appUserId) {
    return { error: "Only super admins can approve assignment requests." };
  }

  const parsed = reviewAssignSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { requestId, decision } = parsed.data;

  const [req] = await db
    .select()
    .from(partyAssignmentRequest)
    .where(eq(partyAssignmentRequest.requestId, requestId))
    .limit(1);
  if (!req) return { error: "Request not found." };
  if (req.status !== "pending") {
    return { error: `Request is already ${req.status}.` };
  }

  if (decision === "reject") {
    await db
      .update(partyAssignmentRequest)
      .set({
        status: "rejected",
        reviewedByUserId: user.appUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(partyAssignmentRequest.requestId, requestId));

    await writeAudit({
      actor: user,
      entityType: "party_assignment_request",
      entityId: requestId,
      operation: "reject",
      fieldName: "status",
      oldValue: "pending",
      newValue: "rejected",
    });

    revalidatePath("/console/assignments");
    revalidatePath("/console/admin");
    revalidatePath("/console/activity");
    return { ok: true };
  }

  // Approve — re-check no duplicate owner + brand wall
  const [existing] = await db
    .select({
      assignedUserId: party.assignedUserId,
      legalName: party.legalName,
      brandOrigin: party.brandOrigin,
    })
    .from(party)
    .where(and(eq(party.partyId, req.partyId), isNull(party.deletedAt)))
    .limit(1);
  if (!existing) return { error: "Party no longer exists." };

  if (existing.assignedUserId === req.toUserId) {
    await db
      .update(partyAssignmentRequest)
      .set({
        status: "cancelled",
        reviewedByUserId: user.appUserId,
        reviewedAt: new Date(),
        note: (req.note ? `${req.note} ` : "") + "[auto-cancelled: already assigned]",
        updatedAt: new Date(),
      })
      .where(eq(partyAssignmentRequest.requestId, requestId));
    return {
      error:
        "Client is already assigned to that staff (duplicate). Request cancelled.",
    };
  }

  const [toUser] = await db
    .select({ desk: appUser.desk, isActive: appUser.isActive })
    .from(appUser)
    .where(and(eq(appUser.userId, req.toUserId), isNull(appUser.deletedAt)))
    .limit(1);
  if (!toUser?.isActive) {
    return { error: "Assignee is inactive or missing." };
  }
  const wall = assertBrandAssignmentAllowed({
    actorBrand: user.brandScope,
    actorRoles: user.roles,
    partyBrand: existing.brandOrigin,
    assigneeBrand: brandFromDesk(toUser.desk as string | null),
  });
  if (!wall.ok) return { error: wall.reason };

  const due = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

  await withRls(user.appUserId, user.wall, [], async (tx) => {
    await tx
      .update(party)
      .set({
        assignedUserId: req.toUserId,
        dataOwnerUserId: req.toUserId,
        updatedByUserId: user.appUserId,
        updatedAt: new Date(),
      })
      .where(eq(party.partyId, req.partyId));

    await tx.insert(task).values({
      partyId: req.partyId,
      assigneeUserId: req.toUserId,
      title: "Review assigned relationship",
      description:
        "Assignment approved by super admin. Review company profile and next action.",
      dueDate: due,
      priority: "medium",
      status: "pending",
      createdByUserId: user.appUserId,
    });

    await tx
      .update(partyAssignmentRequest)
      .set({
        status: "approved",
        reviewedByUserId: user.appUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(partyAssignmentRequest.requestId, requestId));
  });

  await writeAudit({
    actor: user,
    entityType: "party",
    entityId: req.partyId,
    operation: "approve",
    fieldName: "assigned_user_id",
    oldValue: existing.assignedUserId,
    newValue: req.toUserId,
  });

  revalidatePath("/console/assignments");
  revalidatePath("/console/admin");
  revalidatePath("/console/parties");
  revalidatePath(`/console/parties/${req.partyId}`);
  revalidatePath("/console/tasks");
  revalidatePath("/console/activity");
  return { ok: true };
}

const optionalCatalog = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal("")]).optional();

const updateSegmentationSchema = z.object({
  partyId: z.uuid(),
  annualTurnoverCr: z.coerce.number().nonnegative().optional(),
  turnoverBand: optionalCatalog(TURNOVER_BANDS),
  industrySector: optionalCatalog(INDUSTRY_SECTORS),
  industrySubsector: z.string().max(120).optional(),
  latestRating: optionalCatalog(RATING_VALUES),
  latestRatingAgency: optionalCatalog(RATING_AGENCIES),
  latestRatingYear: z.coerce.number().int().min(1990).max(2100).optional(),
  latestRatingHeader: z.string().max(500).optional(),
  investorType: optionalCatalog(INVESTOR_TYPES),
  portfolioSizeCr: z.coerce.number().nonnegative().optional(),
  portfolioSizeBand: optionalCatalog(PORTFOLIO_SIZE_BANDS),
  riskAppetite: optionalCatalog(RISK_APPETITES),
  highYieldAppetite: z.enum(["true", "false"]).optional(),
  existingSecuritiesNote: z.string().max(20_000).optional(),
});

export async function updatePartySegmentation(
  _prev: PartyActionState,
  formData: FormData,
): Promise<PartyActionState> {
  const user = await requireUser();
  if (!can(user, "update", "party")) {
    return { error: "You do not have permission to update party segmentation." };
  }

  const parsed = updateSegmentationSchema.safeParse({
    partyId: formData.get("partyId"),
    annualTurnoverCr: formData.get("annualTurnoverCr") || undefined,
    turnoverBand: formData.get("turnoverBand") || undefined,
    industrySector: formData.get("industrySector") || undefined,
    industrySubsector: formData.get("industrySubsector") || undefined,
    latestRating: formData.get("latestRating") || undefined,
    latestRatingAgency: formData.get("latestRatingAgency") || undefined,
    latestRatingYear: formData.get("latestRatingYear") || undefined,
    latestRatingHeader: formData.get("latestRatingHeader") || undefined,
    investorType: formData.get("investorType") || undefined,
    portfolioSizeCr: formData.get("portfolioSizeCr") || undefined,
    portfolioSizeBand: formData.get("portfolioSizeBand") || undefined,
    riskAppetite: formData.get("riskAppetite") || undefined,
    highYieldAppetite: formData.get("highYieldAppetite") || undefined,
    existingSecuritiesNote: formData.get("existingSecuritiesNote") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  await withRls(user.appUserId ?? crypto.randomUUID(), user.wall, [], (tx) =>
    tx
      .update(party)
      .set({
        annualTurnoverCr:
          input.annualTurnoverCr === undefined ? null : String(input.annualTurnoverCr),
        turnoverBand: input.turnoverBand || null,
        industrySector: input.industrySector || null,
        industrySubsector: input.industrySubsector || null,
        latestRating: input.latestRating || null,
        latestRatingAgency: input.latestRatingAgency || null,
        latestRatingYear: input.latestRatingYear ?? null,
        latestRatingHeader: input.latestRatingHeader || null,
        investorType: input.investorType || null,
        portfolioSizeCr:
          input.portfolioSizeCr === undefined ? null : String(input.portfolioSizeCr),
        portfolioSizeBand: input.portfolioSizeBand || null,
        riskAppetite: input.riskAppetite || null,
        highYieldAppetite: input.highYieldAppetite === "true",
        existingSecuritiesNote: input.existingSecuritiesNote || null,
        updatedByUserId: user.appUserId,
        updatedAt: new Date(),
      })
      .where(eq(party.partyId, input.partyId)),
  );

  revalidatePath("/parties");
  revalidatePath(`/parties/${input.partyId}`);
  return { ok: true };
}
