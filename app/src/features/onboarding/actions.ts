"use server";

// Client Onboarding - server actions (mutations).
//
// All writes go through `withRls` so the party / document / kyc_record RLS GUCs
// are set for the transaction. onboarding_meta is read + written as a JSONB blob
// via parameterised raw SQL (the column is not in the frozen Drizzle schema).
// The canonical load → mutate → write helper (`mutateOnboardingMeta`) keeps
// every transition consistent, stamps `updatedAt`, and appends to `stageHistory`
// on every stage change so the SLA clocks stay accurate.
//
// STAGE MACHINE (enforced here - see types.ts ONBOARDING_ALLOWED_TRANSITIONS):
//   initiated ──▶ profile_created            manual (advanceStage)
//   profile_created ──▶ documents_collected  manual (advanceStage)
//   documents_collected ──▶ kyc_verified     GATE: all 7 docs verified AND the
//                                             party's linked kyc_record.status
//                                             = 'approved' (advanceStage)
//   kyc_verified ──▶ compliance_approved      approveCompliance (officer sign-off)
//   compliance_approved ──▶ active            activateClient (flips party.status)
// Compliance may REJECT (rejectCompliance) - the case stays in kyc_verified with
// a rejected compliance flag + note, and can be re-submitted for approval.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

import { can, requireUser } from "@/lib/rbac";
import { withRls } from "@/db/context";
import { db } from "@/db";
import {
  document,
  kycRecord,
  party,
  partyTypeAssignment,
} from "@/db/schema";

import { normalizeOnboarding } from "./queries";
import {
  ONBOARDING_DOC_LABELS,
  ONBOARDING_DOC_ORDER,
  ONBOARDING_DOC_TO_DOCUMENT_TYPE,
  allDocsVerified,
  canTransitionOnboarding,
  type OnboardingClientType,
  type OnboardingDocItem,
  type OnboardingDocKey,
  type OnboardingMeta,
  type OnboardingStage,
} from "./types";

// ---------------------------------------------------------------------------
// Enum value lists (kept in sync with types.ts)
// ---------------------------------------------------------------------------

const CLIENT_TYPES = [
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
  "government",
  "spv",
  "vendor",
] as const;

const STAGES = [
  "initiated",
  "profile_created",
  "documents_collected",
  "kyc_verified",
  "compliance_approved",
  "active",
] as const;

const DOC_KEYS = [
  "incorporation_certificate",
  "pan_card",
  "board_resolution",
  "authorised_signatory_kyc",
  "financial_statements",
  "beneficial_ownership_declaration",
  "consent_form",
] as const;

// ---------------------------------------------------------------------------
// createOnboarding - the wizard's submit. Creates a prospect party with the
// captured profile + contact + document checklist, then stamps onboarding_meta
// at stage='profile_created'. Documents the user marks "in hand" are filed as
// 'uploaded' (verification pending) with a real document row so the document
// table reflects what the client has submitted.
// ---------------------------------------------------------------------------

const createSchema = z.object({
  companyName: z.string().min(2, "Company name is required.").max(200),
  clientType: z.enum(CLIENT_TYPES),
  assignedRm: z.uuidv4().optional(),
  pan: z
    .string()
    .max(10)
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, "PAN must be 10 chars (ABCDE1234F).")
    .optional()
    .or(z.literal("")),
  cin: z.string().max(21).optional().or(z.literal("")),
  gstin: z
    .string()
    .max(15)
    .regex(/^[0-9]{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]$/, "GSTIN must be 15 chars.")
    .optional()
    .or(z.literal("")),
  state: z.string().max(120).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
  // contact
  contactName: z.string().max(160).optional().or(z.literal("")),
  contactTitle: z.string().max(160).optional().or(z.literal("")),
  contactEmail: z.email().optional().or(z.literal("")),
  contactPhone: z.string().max(32).optional().or(z.literal("")),
  // documents in hand - the keys the user marked as submitted in the wizard.
  docsInHand: z.array(z.enum(DOC_KEYS)).optional(),
  notes: z.string().max(4000).optional().or(z.literal("")),
});

export type CreateOnboardingState = { error?: string } | undefined;

export async function createOnboarding(
  _prev: CreateOnboardingState,
  formData: FormData,
): Promise<CreateOnboardingState> {
  const user = await requireUser();
  if (!can(user, "create", "party")) {
    return { error: "You do not have permission to onboard a client." };
  }

  // docsInHand arrives as repeated form entries ("docsInHand=pan_card&docsInHand=...").
  const docsInHand = formData.getAll("docsInHand") as string[];

  const parsed = createSchema.safeParse({
    companyName: formData.get("companyName"),
    clientType: formData.get("clientType"),
    assignedRm: formData.get("assignedRm") || undefined,
    pan: (formData.get("pan") || "").toString().toUpperCase() || undefined,
    cin: formData.get("cin") || undefined,
    gstin: (formData.get("gstin") || "").toString().toUpperCase() || undefined,
    state: formData.get("state") || undefined,
    city: formData.get("city") || undefined,
    contactName: formData.get("contactName") || undefined,
    contactTitle: formData.get("contactTitle") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    docsInHand: docsInHand.length ? docsInHand : undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;
  const now = new Date().toISOString();

  // Build the checklist: docs in hand → uploaded (verification pending); the
  // rest pending. The document row for each in-hand doc is created inside the
  // txn so the checklist's documentId is populated.
  const inHandSet = new Set(input.docsInHand ?? []);
  const documents: OnboardingDocItem[] = ONBOARDING_DOC_ORDER.map((key) => ({
    key,
    status: inHandSet.has(key) ? "uploaded" : "pending",
    verification: "pending",
    documentId: null, // set inside the txn after the document row is created
    uploadedAt: inHandSet.has(key) ? now : null,
    verifiedAt: null,
    verifiedBy: null,
    rejectionReason: null,
  }));

  const onboardingMeta: OnboardingMeta = {
    stage: "profile_created",
    clientType: input.clientType as OnboardingClientType,
    assignedRm: input.assignedRm ?? null,
    contactName: input.contactName || null,
    contactTitle: input.contactTitle || null,
    contactEmail: input.contactEmail || null,
    contactPhone: input.contactPhone || null,
    pan: input.pan || null,
    cin: input.cin || null,
    gstin: input.gstin || null,
    state: input.state || null,
    city: input.city || null,
    documents,
    kycRecordId: null,
    complianceApprovedBy: null,
    complianceApprovedAt: null,
    complianceRejectedBy: null,
    complianceRejectedAt: null,
    complianceNote: null,
    stageHistory: [{ stage: "initiated", enteredAt: now }, { stage: "profile_created", enteredAt: now }],
    // notes captured in the wizard are stored as the compliance note seed (the
    // compliance officer sees them on review). Free-text notes column is not in
    // the blob schema; we fold the wizard note into complianceNote as context.
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
  };
  // Fold the wizard note into complianceNote as onboarding context (the officer
  // reviews it before sign-off).
  if (input.notes) onboardingMeta.complianceNote = input.notes;

  const partyId = await withRls(
    user.appUserId ?? crypto.randomUUID(),
    user.wall,
    [],
    async (tx) => {
      const [created] = await tx
        .insert(party)
        .values({
          legalName: input.companyName,
          displayName: input.companyName,
          partyNature: "organization",
          countryOfIncorporation: "IN",
          status: "onboarding",
          brandOrigin: "binarybonds",
          source: "manual",
          createdByUserId: user.appUserId,
        })
        .returning({ partyId: party.partyId });
      if (!created) throw new Error("party insert returned no row");
      const pid = created.partyId;

      // Tag the new prospect party with party_type='prospect'.
      await tx.insert(partyTypeAssignment).values({
        partyId: pid,
        partyType: "prospect",
        assignedByUserId: user.appUserId,
      });

      // File a document row for each in-hand checklist item + populate
      // documentId in the blob. Filed as the coarse document_type enum value
      // (the precise onboarding doc key lives in onboarding_meta).
      const filedDocs: OnboardingDocItem[] = await Promise.all(
        onboardingMeta.documents.map(async (d) => {
          if (d.status !== "uploaded") return d;
          const [doc] = await tx
            .insert(document)
            .values({
              partyId: pid,
              documentType:
                ONBOARDING_DOC_TO_DOCUMENT_TYPE[d.key] as (typeof document.$inferInsert)["documentType"],
              fileName: `${ONBOARDING_DOC_LABELS[d.key]}.pdf`,
              uploadedByUserId: user.appUserId,
            })
            .returning({ documentId: document.documentId });
          return { ...d, documentId: doc?.documentId ?? null };
        }),
      );
      onboardingMeta.documents = filedDocs;

      // Stamp onboarding_meta (raw SQL - column not in the typed schema).
      await tx.execute(
        sql`UPDATE party SET onboarding_meta = ${JSON.stringify(onboardingMeta)}::jsonb, updated_at = now() WHERE party_id = ${pid}`,
      );
      return pid;
    },
  );

  revalidatePath("/onboarding");
  revalidatePath("/console/onboarding");
  revalidatePath(`/console/onboarding/${partyId}`);
  redirect(`/onboarding/${partyId}`);
}

// ---------------------------------------------------------------------------
// mutateOnboardingMeta - load → mutate → write inside an RLS transaction.
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function mutateOnboardingMeta(
  tx: Tx,
  partyId: string,
  fn: (m: OnboardingMeta) => OnboardingMeta,
): Promise<OnboardingMeta> {
  const rows = await tx.execute<{ onboarding_meta: unknown }>(sql`
    SELECT onboarding_meta FROM party WHERE party_id = ${partyId} AND deleted_at IS NULL
  `);
  if (rows.length === 0) throw new Error("Onboarding case not found.");
  const current = normalizeOnboarding(rows[0]!.onboarding_meta);
  const next = fn({
    ...current,
    documents: current.documents.map((d) => ({ ...d })),
    stageHistory: [...current.stageHistory],
  });
  const stamped: OnboardingMeta = { ...next, updatedAt: new Date().toISOString() };
  await tx.execute(
    sql`UPDATE party SET onboarding_meta = ${JSON.stringify(stamped)}::jsonb, updated_at = now() WHERE party_id = ${partyId}`,
  );
  return stamped;
}

/** Run an onboarding mutation under RLS and revalidate the onboarding pages.
 *  Returns { ok } on success or { error } on failure. */
async function runOnboardingMutation(
  partyId: string,
  fn: (m: OnboardingMeta) => OnboardingMeta,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  if (!can(user, "update", "party")) {
    return { error: "You do not have permission to update this onboarding case." };
  }
  try {
    await withRls(user.appUserId ?? crypto.randomUUID(), user.wall, [], (tx) =>
      mutateOnboardingMeta(tx, partyId, fn),
    );
    revalidatePath("/onboarding");
    revalidatePath(`/onboarding/${partyId}`);
    revalidatePath("/console/onboarding");
    revalidatePath(`/console/onboarding/${partyId}`);
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not update the onboarding case.",
    };
  }
}

// ---------------------------------------------------------------------------
// advanceStage - move to the next funnel stage, with the documents→KYC gate.
// ---------------------------------------------------------------------------

export type AdvanceStageState =
  | { ok?: boolean; error?: string; stage?: OnboardingStage }
  | undefined;

const advanceSchema = z.object({
  partyId: z.uuidv4(),
  to: z.enum(STAGES),
});

export async function advanceStage(
  _prev: AdvanceStageState,
  formData: FormData,
): Promise<AdvanceStageState> {
  const user = await requireUser();
  if (!can(user, "update", "party")) {
    return { error: "You do not have permission to advance this case." };
  }
  const parsed = advanceSchema.safeParse({
    partyId: formData.get("partyId"),
    to: formData.get("to"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { partyId, to } = parsed.data;
  const target = to as OnboardingStage;

  // Load the current blob (read path) for the gate + adjacency pre-check.
  const rows = await db.execute<{ onboarding_meta: unknown }>(sql`
    SELECT onboarding_meta FROM party WHERE party_id = ${partyId} AND deleted_at IS NULL
  `);
  if (rows.length === 0) return { error: "Onboarding case not found." };
  const current = normalizeOnboarding(rows[0]!.onboarding_meta);
  if (current.stage === target) return { error: "The case is already at that stage." };
  if (!canTransitionOnboarding(current.stage, target)) {
    return { error: `Cannot advance from ${current.stage} to ${target}.` };
  }

  // GATE: documents_collected → kyc_verified requires all docs verified AND an
  // approved linked kyc_record. Read the live KYC status (never a denormalized
  // copy) so the gate can never be bypassed by a stale blob.
  if (current.stage === "documents_collected" && target === "kyc_verified") {
    if (!allDocsVerified(current.documents)) {
      return {
        error:
          "All seven documents must be verified before advancing to KYC.",
      };
    }
    if (!current.kycRecordId) {
      return {
        error:
          "Raise a KYC record and have it approved before advancing to KYC.",
      };
    }
    const kycRows = await db.execute<{ status: string | null }>(sql`
      SELECT status FROM kyc_record
      WHERE kyc_record_id = ${current.kycRecordId} AND deleted_at IS NULL
    `);
    const kycStatus = kycRows[0]?.status ?? null;
    if (kycStatus !== "approved") {
      return {
        error: `KYC must be approved before advancing (current status: ${kycStatus ?? "-"}).`,
      };
    }
  }

  // Stamps the new stage + appends to stageHistory (the SLA clock starts now).
  const res = await runOnboardingMutation(partyId, (m) => {
    const now = new Date().toISOString();
    return {
      ...m,
      stage: target,
      stageHistory: [...m.stageHistory, { stage: target, enteredAt: now }],
    };
  });
  if ("ok" in res) return { ok: true, stage: target };
  return { error: res.error };
}

// ---------------------------------------------------------------------------
// startKyc - raise a kyc_record (CDD, pending) + link it to the onboarding
// case. The actual approval happens in the Compliance module (the officer's
// KYC workspace); the onboarding detail page links there. Re-running on a case
// that already has a linked KYC is a no-op (returns the existing record id).
// ---------------------------------------------------------------------------

export type StartKycState =
  | { ok?: boolean; error?: string; kycRecordId?: string }
  | undefined;

const startKycSchema = z.object({ partyId: z.uuidv4() });

export async function startKyc(
  _prev: StartKycState,
  formData: FormData,
): Promise<StartKycState> {
  const user = await requireUser();
  // Raising a KYC record is part of managing the onboarding case (a party
  // update); the seeded RBAC has no kyc_record:create, so the guard rides
  // party:update (admin + coverage_rm). The compliance officer approves the
  // record separately (kyc:approve) in the Compliance module.
  if (!can(user, "update", "party")) {
    return { error: "You do not have permission to raise a KYC record." };
  }
  const parsed = startKycSchema.safeParse({ partyId: formData.get("partyId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const { partyId } = parsed.data;

  // If a KYC is already linked, return its id (idempotent).
  const existing = await db.execute<{ onboarding_meta: unknown }>(sql`
    SELECT onboarding_meta FROM party WHERE party_id = ${partyId} AND deleted_at IS NULL
  `);
  if (existing.length === 0) return { error: "Onboarding case not found." };
  const current = normalizeOnboarding(existing[0]!.onboarding_meta);
  if (current.kycRecordId) return { ok: true, kycRecordId: current.kycRecordId };

  try {
    const kycRecordId = await withRls(
      user.appUserId ?? crypto.randomUUID(),
      user.wall,
      [],
      async (tx) => {
        const [rec] = await tx
          .insert(kycRecord)
          .values({
            partyId,
            kycType: "CDD",
            status: "pending",
            riskRating: "medium",
          })
          .returning({ kycRecordId: kycRecord.kycRecordId });
        if (!rec) throw new Error("kyc_record insert returned no row");
        const kid = rec.kycRecordId;
        await mutateOnboardingMeta(tx, partyId, (m) => ({
          ...m,
          kycRecordId: kid,
        }));
        return kid;
      },
    );
    revalidatePath("/onboarding");
    revalidatePath(`/onboarding/${partyId}`);
    revalidatePath("/console/onboarding");
    revalidatePath(`/console/onboarding/${partyId}`);
    return { ok: true, kycRecordId };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not raise the KYC record.",
    };
  }
}

// ---------------------------------------------------------------------------
// markDocumentUploaded - file a document row for a pending checklist item and
// mark it uploaded (verification pending). Idempotent on already-uploaded items
// (returns ok without re-inserting).
// ---------------------------------------------------------------------------

export type DocUploadState =
  | { ok?: boolean; error?: string }
  | undefined;

const docUploadSchema = z.object({
  partyId: z.uuidv4(),
  docKey: z.enum(DOC_KEYS),
});

export async function markDocumentUploaded(
  _prev: DocUploadState,
  formData: FormData,
): Promise<DocUploadState> {
  const user = await requireUser();
  // Filing a checklist document is part of managing the onboarding case (a
  // party update); the document table has no dedicated permission in the
  // seeded RBAC, so the guard rides party:update (admin + coverage_rm).
  if (!can(user, "update", "party")) {
    return { error: "You do not have permission to upload a document." };
  }
  const parsed = docUploadSchema.safeParse({
    partyId: formData.get("partyId"),
    docKey: formData.get("docKey"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const { partyId, docKey } = parsed.data;
  const key = docKey as OnboardingDocKey;

  try {
    await withRls(user.appUserId ?? crypto.randomUUID(), user.wall, [], async (tx) => {
      // Create the document row first so we can stamp its id into the checklist.
      const [doc] = await tx
        .insert(document)
        .values({
          partyId,
          documentType:
            ONBOARDING_DOC_TO_DOCUMENT_TYPE[key] as (typeof document.$inferInsert)["documentType"],
          fileName: `${ONBOARDING_DOC_LABELS[key]}.pdf`,
          uploadedByUserId: user.appUserId,
        })
        .returning({ documentId: document.documentId });
      const documentId = doc?.documentId ?? null;
      const now = new Date().toISOString();
      await mutateOnboardingMeta(tx, partyId, (m) => ({
        ...m,
        documents: m.documents.map((d) =>
          d.key === key
            ? {
                ...d,
                status: "uploaded",
                documentId: d.documentId ?? documentId,
                uploadedAt: d.uploadedAt ?? now,
                // re-upload after a rejection resets verification to pending.
                verification: d.verification === "rejected" ? "pending" : d.verification,
                rejectionReason: d.verification === "rejected" ? null : d.rejectionReason,
              }
            : d,
        ),
      }));
    });
    revalidatePath("/onboarding");
    revalidatePath(`/onboarding/${partyId}`);
    revalidatePath("/console/onboarding");
    revalidatePath(`/console/onboarding/${partyId}`);
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not mark the document uploaded.",
    };
  }
}

// ---------------------------------------------------------------------------
// verifyDocument / rejectDocument - the officer's per-document sign-off.
// ---------------------------------------------------------------------------

export type DocVerifyState =
  | { ok?: boolean; error?: string }
  | undefined;

const docVerifySchema = z.object({
  partyId: z.uuidv4(),
  docKey: z.enum(DOC_KEYS),
});

export async function verifyDocument(
  _prev: DocVerifyState,
  formData: FormData,
): Promise<DocVerifyState> {
  const user = await requireUser();
  if (!can(user, "update", "party")) {
    return { error: "You do not have permission to verify documents." };
  }
  const parsed = docVerifySchema.safeParse({
    partyId: formData.get("partyId"),
    docKey: formData.get("docKey"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const { partyId, docKey } = parsed.data;
  const key = docKey as OnboardingDocKey;
  const now = new Date().toISOString();

  const res = await runOnboardingMutation(partyId, (m) => ({
    ...m,
    documents: m.documents.map((d) =>
      d.key === key && d.status === "uploaded"
        ? {
            ...d,
            verification: "verified",
            verifiedAt: now,
            verifiedBy: user.appUserId,
            rejectionReason: null,
          }
        : d,
    ),
  }));
  return "ok" in res ? { ok: true } : { error: res.error };
}

const rejectSchema = z.object({
  partyId: z.uuidv4(),
  docKey: z.enum(DOC_KEYS),
  reason: z.string().min(1, "A rejection reason is required.").max(500),
});

export async function rejectDocument(
  _prev: DocVerifyState,
  formData: FormData,
): Promise<DocVerifyState> {
  const user = await requireUser();
  if (!can(user, "update", "party")) {
    return { error: "You do not have permission to reject documents." };
  }
  const parsed = rejectSchema.safeParse({
    partyId: formData.get("partyId"),
    docKey: formData.get("docKey"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const { partyId, docKey, reason } = parsed.data;
  const key = docKey as OnboardingDocKey;
  const now = new Date().toISOString();

  const res = await runOnboardingMutation(partyId, (m) => ({
    ...m,
    documents: m.documents.map((d) =>
      d.key === key && d.status === "uploaded"
        ? {
            ...d,
            verification: "rejected",
            verifiedAt: now,
            verifiedBy: user.appUserId,
            rejectionReason: reason,
          }
        : d,
    ),
  }));
  return "ok" in res ? { ok: true } : { error: res.error };
}

// ---------------------------------------------------------------------------
// approveCompliance / rejectCompliance - the compliance officer's sign-off.
// approveCompliance is the kyc_verified → compliance_approved transition.
// ---------------------------------------------------------------------------

export type ComplianceState =
  | { ok?: boolean; error?: string }
  | undefined;

const approveComplianceSchema = z.object({ partyId: z.uuidv4() });

export async function approveCompliance(
  _prev: ComplianceState,
  formData: FormData,
): Promise<ComplianceState> {
  const user = await requireUser();
  // Compliance sign-off: the compliance officer (kyc:approve) or an admin
  // (party:update) may approve. kyc:approve is the compliance role's grant;
  // party:update covers the admin/coverage_rm path.
  if (!can(user, "approve", "kyc") && !can(user, "update", "party")) {
    return { error: "You do not have permission to approve compliance." };
  }
  const parsed = approveComplianceSchema.safeParse({ partyId: formData.get("partyId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const { partyId } = parsed.data;

  // Pre-check: the case must be at kyc_verified (compliance reviews an approved
  // -KYC case). The gate is structural - compliance cannot approve a case still
  // collecting documents or with an unapproved KYC.
  const rows = await db.execute<{ onboarding_meta: unknown }>(sql`
    SELECT onboarding_meta FROM party WHERE party_id = ${partyId} AND deleted_at IS NULL
  `);
  if (rows.length === 0) return { error: "Onboarding case not found." };
  const current = normalizeOnboarding(rows[0]!.onboarding_meta);
  if (current.stage !== "kyc_verified") {
    return {
      error: `Compliance can only approve a case at the KYC stage (current: ${current.stage}).`,
    };
  }

  const now = new Date().toISOString();
  const res = await runOnboardingMutation(partyId, (m) => ({
    ...m,
    stage: "compliance_approved" as OnboardingStage,
    stageHistory: [...m.stageHistory, { stage: "compliance_approved" as OnboardingStage, enteredAt: now }],
    complianceApprovedBy: user.appUserId,
    complianceApprovedAt: now,
    // clear any prior rejection on approval.
    complianceRejectedBy: null,
    complianceRejectedAt: null,
  }));
  return "ok" in res ? { ok: true } : { error: res.error };
}

const rejectComplianceSchema = z.object({
  partyId: z.uuidv4(),
  reason: z.string().min(1, "A rejection reason is required.").max(2000),
});

export async function rejectCompliance(
  _prev: ComplianceState,
  formData: FormData,
): Promise<ComplianceState> {
  const user = await requireUser();
  // Compliance rejection mirrors approval: the compliance officer (kyc:approve)
  // or an admin (party:update) may reject.
  if (!can(user, "approve", "kyc") && !can(user, "update", "party")) {
    return { error: "You do not have permission to reject compliance." };
  }
  const parsed = rejectComplianceSchema.safeParse({
    partyId: formData.get("partyId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const { partyId, reason } = parsed.data;
  const now = new Date().toISOString();

  const res = await runOnboardingMutation(partyId, (m) => ({
    ...m,
    // stage stays at kyc_verified - the case awaits re-submission / re-review.
    complianceRejectedBy: user.appUserId,
    complianceRejectedAt: now,
    complianceNote: reason,
  }));
  return "ok" in res ? { ok: true } : { error: res.error };
}

// ---------------------------------------------------------------------------
// activateClient - the final compliance_approved → active transition. Flips
// party.status to 'active' so the client is live across the CRM.
// ---------------------------------------------------------------------------

export type ActivateState =
  | { ok?: boolean; error?: string }
  | undefined;

const activateSchema = z.object({ partyId: z.uuidv4() });

export async function activateClient(
  _prev: ActivateState,
  formData: FormData,
): Promise<ActivateState> {
  const user = await requireUser();
  if (!can(user, "update", "party")) {
    return { error: "You do not have permission to activate this client." };
  }
  const parsed = activateSchema.safeParse({ partyId: formData.get("partyId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const { partyId } = parsed.data;

  // Pre-check: must be at compliance_approved.
  const rows = await db.execute<{ onboarding_meta: unknown }>(sql`
    SELECT onboarding_meta FROM party WHERE party_id = ${partyId} AND deleted_at IS NULL
  `);
  if (rows.length === 0) return { error: "Onboarding case not found." };
  const current = normalizeOnboarding(rows[0]!.onboarding_meta);
  if (current.stage !== "compliance_approved") {
    return {
      error: `Only a compliance-approved case can be activated (current: ${current.stage}).`,
    };
  }

  const now = new Date().toISOString();
  try {
    await withRls(user.appUserId ?? crypto.randomUUID(), user.wall, [], async (tx) => {
      // Flip party.status → active.
      await tx.execute(
        sql`UPDATE party SET status = 'active', updated_at = now() WHERE party_id = ${partyId} AND deleted_at IS NULL`,
      );
      // Stamp the final stage + history.
      await mutateOnboardingMeta(tx, partyId, (m) => ({
        ...m,
        stage: "active" as OnboardingStage,
        stageHistory: [...m.stageHistory, { stage: "active" as OnboardingStage, enteredAt: now }],
      }));
    });
    revalidatePath("/onboarding");
    revalidatePath(`/onboarding/${partyId}`);
    revalidatePath("/parties");
    revalidatePath("/console/onboarding");
    revalidatePath(`/console/onboarding/${partyId}`);
    revalidatePath("/console/parties");
    revalidatePath(`/console/parties/${partyId}`);
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not activate the client.",
    };
  }
}

// ---------------------------------------------------------------------------
// updateAssignedRm - inline edit on the detail panel.
// ---------------------------------------------------------------------------

export type FieldState = { ok?: boolean; error?: string } | undefined;

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
  const res = await runOnboardingMutation(parsed.data.partyId, (m) => ({
    ...m,
    assignedRm: parsed.data.assignedRm ?? null,
  }));
  return "ok" in res ? { ok: true } : { error: res.error };
}

// ---------------------------------------------------------------------------
// deleteOnboarding - stop tracking a case (clears onboarding_meta; the party
// row remains). The party keeps its status (onboarding/active) - clearing the
// blob only removes it from the onboarding board.
// ---------------------------------------------------------------------------

export type DeleteState = { ok?: boolean; error?: string } | undefined;

const deleteSchema = z.object({ partyId: z.uuidv4() });

export async function deleteOnboarding(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const user = await requireUser();
  if (!can(user, "update", "party")) {
    return { error: "You do not have permission to remove this onboarding case." };
  }
  const parsed = deleteSchema.safeParse({ partyId: formData.get("partyId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid." };
  const { partyId } = parsed.data;

  try {
    await withRls(user.appUserId ?? crypto.randomUUID(), user.wall, [], (tx) =>
      tx.execute(
        sql`UPDATE party SET onboarding_meta = NULL, updated_at = now() WHERE party_id = ${partyId} AND deleted_at IS NULL`,
      ),
    );
    revalidatePath("/onboarding");
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not remove the onboarding case.",
    };
  }
}

