"use server";

// Compliance Server Actions (KYC lifecycle + DPDP consent/withdraw + DSR).
//
// ARCHITECTURE §3 mutation boundary per action: authenticate (requireUser),
// authorize (can), validate (zod), RLS context (withRls), mutate, write an
// audit_log row, revalidate. The audit_log insert is best-effort - a failure
// to write audit must NOT mask the mutation result, but it SHOULD surface. We
// let it throw (the immutability trigger rejects UPDATE/DELETE; INSERT is the
// only op the app role has).

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod/v4";

import { requireUser, can } from "@/lib/rbac";
import { withRls } from "@/db/context";
import { db } from "@/db";
import {
  auditLog,
  consentRecord,
  contact,
  dataSubjectRequest,
  kycBeneficialOwner,
  kycRecord,
  party,
} from "@/db/schema";

import {
  canTransition as kycCanTransition,
  computeRekycDueDate,
  computeValidUntil,
  shouldEscalateToEdd,
  type KycRisk,
  type KycStatus,
  type KycType,
  type PartyNature,
} from "./kyc";
import {
  canTransitionDsr,
  computeConsentRetentionUntil,
  computeDsrDueDate,
  dsrTypeForWithdrawal,
  type ConsentMethod,
  type ConsentPurpose,
  type DsrStatus,
  type DsrType,
} from "./consent";

// ---------------------------------------------------------------------------
// Permission guard
// ---------------------------------------------------------------------------

function requirePermission(
  user: Awaited<ReturnType<typeof requireUser>>,
  action: string,
  resource: string,
): { ok: true } | { ok: false; error: string } {
  if (!can(user, action, resource)) {
    return {
      ok: false,
      error: `You do not have permission to ${action} ${resource}.`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Audit helper - appends an audit_log row inside the caller's RLS txn.
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function appendAudit(
  tx: Tx,
  input: {
    entityType: string;
    entityId?: string;
    operation: string;
    fieldName?: string;
    oldValue?: unknown;
    newValue?: unknown;
    actorUserId: string | null;
    actorRoleAtTime?: string;
    correlationId?: string;
  },
): Promise<void> {
  await tx.insert(auditLog).values({
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    operation: input.operation as (typeof auditLog.$inferSelect)["operation"],
    fieldName: input.fieldName ?? null,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    actorUserId: input.actorUserId,
    actorRoleAtTime: input.actorRoleAtTime ?? null,
    correlationId: input.correlationId ?? null,
    // ipAddress / userAgent / hash fields are populated by the DB trigger /
    // request middleware; not set here.
  });
}

// ===========================================================================
// KYC actions
// ===========================================================================

const KYC_STATUSES: readonly KycStatus[] = [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "expired",
  "rekyc_due",
  "under_eds_check",
];
const KYC_TYPES: readonly KycType[] = ["CDD", "EDD", "simplified"];
const KYC_RISKS: readonly KycRisk[] = ["low", "medium", "high"];

const createKycSchema = z.object({
  partyId: z.uuid(),
  contactId: z.uuid().optional(),
  kycType: z.enum(KYC_TYPES),
  riskRating: z.enum(KYC_RISKS),
  cddDoneAt: z.iso.datetime().optional(),
});

export type CreateKycState = { error?: string; kycRecordId?: string } | undefined;

/**
 * Create a KYC record in `pending` status with risk-based valid_until +
// rekyc_due_date pre-populated (the schema's trigger would maintain these; we
// also set them on insert so the field is correct before the trigger exists).
 */
export async function createKyc(
  _prev: CreateKycState,
  formData: FormData,
): Promise<CreateKycState> {
  const user = await requireUser();
  const guard = requirePermission(user, "create", "kyc");
  if (!guard.ok) return { error: guard.error };

  const parsed = createKycSchema.safeParse({
    partyId: formData.get("partyId"),
    contactId: formData.get("contactId") || undefined,
    kycType: formData.get("kycType"),
    riskRating: formData.get("riskRating"),
    cddDoneAt: formData.get("cddDoneAt") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;
  const base = input.cddDoneAt ? new Date(input.cddDoneAt) : new Date();
  const validUntil = computeValidUntil(input.riskRating, base);
  const rekycDueDate = computeRekycDueDate(validUntil, input.riskRating);

  const kycRecordId = await withRls(
    user.appUserId ?? crypto.randomUUID(),
    user.wall,
    [],
    async (tx) => {
      const [created] = await tx
        .insert(kycRecord)
        .values({
          partyId: input.partyId,
          contactId: input.contactId ?? null,
          kycType: input.kycType,
          status: "pending",
          riskRating: input.riskRating,
          cddDoneAt: input.cddDoneAt ? base : null,
          validUntil,
          rekycDueDate,
        })
        .returning({ kycRecordId: kycRecord.kycRecordId });
      if (!created) throw new Error("KYC insert returned no row");

      await appendAudit(tx, {
        entityType: "kyc_record",
        entityId: created.kycRecordId,
        operation: "insert",
        newValue: {
          partyId: input.partyId,
          kycType: input.kycType,
          riskRating: input.riskRating,
          validUntil,
          rekycDueDate,
        },
        actorUserId: user.appUserId,
        actorRoleAtTime: user.roles[0] ?? null,
      });
      return created.kycRecordId;
    },
  );

  revalidatePath("/compliance/kyc");
  revalidatePath("/console/compliance/kyc");
  return { kycRecordId };
}

const transitionKycSchema = z.object({
  kycRecordId: z.uuid(),
  toStatus: z.enum(KYC_STATUSES),
  eddReason: z.string().max(1000).optional(),
});

export type TransitionKycState = { error?: string } | undefined;

/**
 * Transition a KYC record's status along the allowed state machine, with
// audit. When the target is `approved`, set approved_at + approved_by_user_id
// and (re)compute valid_until / rekyc_due_date from the risk rating so the
// periodic-refresh clock starts at approval. When the target is
// `under_eds_check`, set kyc_type='EDD' if not already.
 */
export async function transitionKycStatus(
  _prev: TransitionKycState,
  formData: FormData,
): Promise<TransitionKycState> {
  const user = await requireUser();
  const guard = requirePermission(user, "update", "kyc");
  if (!guard.ok) return { error: guard.error };

  const parsed = transitionKycSchema.safeParse({
    kycRecordId: formData.get("kycRecordId"),
    toStatus: formData.get("toStatus"),
    eddReason: formData.get("eddReason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  return withRls(
    user.appUserId ?? crypto.randomUUID(),
    user.wall,
    [],
    async (tx) => {
      const [existing] = await tx
        .select()
        .from(kycRecord)
        .where(
          and(
            eq(kycRecord.kycRecordId, input.kycRecordId),
            isNull(kycRecord.deletedAt),
          ),
        );
      if (!existing) return { error: "KYC record not found." };
      const from = existing.status as KycStatus;
      if (from === input.toStatus) return { error: undefined };

      if (!kycCanTransition(from, input.toStatus)) {
        return {
          error: `Illegal status transition: ${from} → ${input.toStatus}.`,
        };
      }

      const patch: Partial<typeof kycRecord.$inferInsert> = {
        status: input.toStatus,
        updatedAt: new Date(),
      };
      if (input.toStatus === "approved") {
        patch.approvedAt = new Date();
        patch.approvedByUserId = user.appUserId;
        // Start the periodic-refresh clock at approval.
        const base = new Date();
        const vu = computeValidUntil(
          (existing.riskRating ?? "medium") as KycRisk,
          base,
        );
        patch.validUntil = vu;
        patch.rekycDueDate = computeRekycDueDate(
          vu,
          (existing.riskRating ?? "medium") as KycRisk,
        );
      }
      if (input.toStatus === "under_eds_check") {
        patch.kycType = "EDD";
        if (input.eddReason) patch.eddReason = input.eddReason;
      }

      await tx
        .update(kycRecord)
        .set(patch)
        .where(eq(kycRecord.kycRecordId, input.kycRecordId));

      await appendAudit(tx, {
        entityType: "kyc_record",
        entityId: input.kycRecordId,
        operation: "approve",
        fieldName: "status",
        oldValue: { status: from },
        newValue: { status: input.toStatus, ...patch },
        actorUserId: user.appUserId,
        actorRoleAtTime: user.roles[0] ?? null,
      });

      revalidatePath(`/compliance/kyc/${input.kycRecordId}`);
      revalidatePath("/compliance/kyc");
      revalidatePath("/console/compliance/kyc");
      revalidatePath(`/console/compliance/kyc/${input.kycRecordId}`);
      return { error: undefined };
    },
  );
}

const setKycRiskSchema = z.object({
  kycRecordId: z.uuid(),
  riskRating: z.enum(KYC_RISKS),
});

export type SetKycRiskState = { error?: string } | undefined;

/**
 * Re-rate a KYC record's risk and recompute the periodic-refresh schedule
// (valid_until / rekyc_due_date) from the new rating. If the new inputs
// warrant EDD, the action escalates kyc_type to 'EDD'.
 */
export async function setKycRiskRating(
  _prev: SetKycRiskState,
  formData: FormData,
): Promise<SetKycRiskState> {
  const user = await requireUser();
  const guard = requirePermission(user, "update", "kyc");
  if (!guard.ok) return { error: guard.error };

  const parsed = setKycRiskSchema.safeParse({
    kycRecordId: formData.get("kycRecordId"),
    riskRating: formData.get("riskRating"),
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
      const [existing] = await tx
        .select()
        .from(kycRecord)
        .where(eq(kycRecord.kycRecordId, input.kycRecordId));
      if (!existing) throw new Error("KYC record not found");

      // Fetch the party's nature (and the contact's PEP status, if any) so the
      // EDD escalation uses the correct BO threshold per party nature (trust =
      // 15%, organization = 10%) and honours an existing PEP flag, instead of
      // the previous hardcoded `partyNature: "organization"` which
      // mis-evaluated trusts and partnerships. The schema has no legal-form
      // field, so a partnership (modeled as organization) still gets the 10%
      // company threshold here - to be refined when a legal-form field lands.
      const [partyRow] = existing.partyId
        ? await tx
            .select({ partyNature: party.partyNature })
            .from(party)
            .where(eq(party.partyId, existing.partyId))
        : [];
      const [contactRow] = existing.contactId
        ? await tx
            .select({ pepStatus: contact.pepStatus })
            .from(contact)
            .where(eq(contact.contactId, existing.contactId))
        : [];

      const base = new Date();
      const vu = computeValidUntil(input.riskRating, base);
      const due = computeRekycDueDate(vu, input.riskRating);

      const escalate = shouldEscalateToEdd({
        partyNature: (partyRow?.partyNature ?? "organization") as PartyNature,
        highestBoOwnershipPct: existing.highestBoOwnershipPct,
        pepStatus: contactRow?.pepStatus ?? null,
        sanctionsStatus: null,
        riskRating: input.riskRating,
      });

      await tx
        .update(kycRecord)
        .set({
          riskRating: input.riskRating,
          validUntil: vu,
          rekycDueDate: due,
          kycType: escalate ? "EDD" : (existing.kycType ?? "CDD"),
          updatedAt: new Date(),
        })
        .where(eq(kycRecord.kycRecordId, input.kycRecordId));

      await appendAudit(tx, {
        entityType: "kyc_record",
        entityId: input.kycRecordId,
        operation: "update",
        fieldName: "risk_rating",
        oldValue: { riskRating: existing.riskRating },
        newValue: { riskRating: input.riskRating, validUntil: vu, rekycDueDate: due },
        actorUserId: user.appUserId,
        actorRoleAtTime: user.roles[0] ?? null,
      });
    },
  );

  revalidatePath(`/compliance/kyc/${input.kycRecordId}`);
  revalidatePath("/compliance/kyc");
  revalidatePath("/console/compliance/kyc");
  revalidatePath(`/console/compliance/kyc/${input.kycRecordId}`);
  return { error: undefined };
}

const addBoSchema = z.object({
  kycRecordId: z.uuid(),
  contactId: z.uuid(),
  ownershipPct: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).optional(),
  relationshipPath: z.string().max(500).optional(),
});

export type AddBoState = { error?: string } | undefined;

/**
 * Add a beneficial owner to a KYC record (kyc_beneficial_owner junction). After
// insert, recompute highest_bo_ownership_pct (the schema's trigger would do
// this; we mirror it here so the field is current before the trigger exists).
 */
export async function addBeneficialOwner(
  _prev: AddBoState,
  formData: FormData,
): Promise<AddBoState> {
  const user = await requireUser();
  const guard = requirePermission(user, "update", "kyc");
  if (!guard.ok) return { error: guard.error };

  const parsed = addBoSchema.safeParse({
    kycRecordId: formData.get("kycRecordId"),
    contactId: formData.get("contactId"),
    ownershipPct: formData.get("ownershipPct") || undefined,
    relationshipPath: formData.get("relationshipPath") || undefined,
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
      await tx.insert(kycBeneficialOwner).values({
        kycRecordId: input.kycRecordId,
        contactId: input.contactId,
        ownershipPct: input.ownershipPct ?? null,
        relationshipPath: input.relationshipPath ?? null,
        declaredAt: new Date(),
      });

      // Recompute highest_bo_ownership_pct over the (now-updated) BO set.
      const bos = await tx
        .select({ ownershipPct: kycBeneficialOwner.ownershipPct })
        .from(kycBeneficialOwner)
        .where(
          and(
            eq(kycBeneficialOwner.kycRecordId, input.kycRecordId),
            isNull(kycBeneficialOwner.deletedAt),
          ),
        );
      const max = bos
        .map((b) => (b.ownershipPct ? Number(b.ownershipPct) : NaN))
        .filter((n) => Number.isFinite(n))
        .reduce((m, n) => Math.max(m, n), 0);

      await tx
        .update(kycRecord)
        .set({ highestBoOwnershipPct: max.toFixed(2), updatedAt: new Date() })
        .where(eq(kycRecord.kycRecordId, input.kycRecordId));

      await appendAudit(tx, {
        entityType: "kyc_beneficial_owner",
        entityId: input.kycRecordId,
        operation: "insert",
        newValue: { contactId: input.contactId, ownershipPct: input.ownershipPct },
        actorUserId: user.appUserId,
        actorRoleAtTime: user.roles[0] ?? null,
      });
    },
  );

  revalidatePath(`/compliance/kyc/${input.kycRecordId}`);
  revalidatePath("/console/compliance/kyc");
  revalidatePath(`/console/compliance/kyc/${input.kycRecordId}`);
  return { error: undefined };
}

// ===========================================================================
// DPDP consent + DSR actions
// ===========================================================================

const CONSENT_PURPOSES: readonly ConsentPurpose[] = [
  "marketing",
  "advisory_engagement",
  "kyc_processing",
  "credit_analysis",
  "data_sharing_with_rating_agency",
  "data_sharing_with_investors",
  "regulatory_reporting",
  "portfolio_management",
  "secondary_trading_contact",
];
const CONSENT_METHODS: readonly ConsentMethod[] = [
  "digital_sign",
  "checkbox_email",
  "physical_signed",
  "verbal_recorded",
];

const captureConsentSchema = z.object({
  partyId: z.uuid().optional(),
  contactId: z.uuid().optional(),
  purpose: z.enum(CONSENT_PURPOSES),
  purposeDescription: z.string().max(1000).optional(),
  consentMethod: z.enum(CONSENT_METHODS),
  dataCategories: z.array(z.string().max(80)).optional(),
  versionOfPolicy: z.string().max(40).optional(),
}).refine((d) => d.partyId || d.contactId, {
  message: "At least one of partyId / contactId is required.",
});

export type CaptureConsentState =
  | { error?: string; consentRecordId?: string }
  | undefined;

/**
 * Capture a DPDP consent record. retention_until is computed from the purpose
// (purpose-bound retention, research §6). consent_given_at is set to now.
 */
export async function captureConsent(
  _prev: CaptureConsentState,
  formData: FormData,
): Promise<CaptureConsentState> {
  const user = await requireUser();
  const guard = requirePermission(user, "create", "consent");
  if (!guard.ok) return { error: guard.error };

  const parsed = captureConsentSchema.safeParse({
    partyId: formData.get("partyId") || undefined,
    contactId: formData.get("contactId") || undefined,
    purpose: formData.get("purpose"),
    purposeDescription: formData.get("purposeDescription") || undefined,
    consentMethod: formData.get("consentMethod"),
    dataCategories: formData.getAll("dataCategories"),
    versionOfPolicy: formData.get("versionOfPolicy") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;
  const now = new Date();
  const retentionUntil = computeConsentRetentionUntil(input.purpose, now);

  const consentRecordId = await withRls(
    user.appUserId ?? crypto.randomUUID(),
    user.wall,
    [],
    async (tx) => {
      const [created] = await tx
        .insert(consentRecord)
        .values({
          partyId: input.partyId ?? null,
          contactId: input.contactId ?? null,
          purpose: input.purpose,
          purposeDescription: input.purposeDescription ?? null,
          consentGivenAt: now,
          consentMethod: input.consentMethod,
          dataCategories: input.dataCategories ?? null,
          retentionUntil,
          versionOfPolicy: input.versionOfPolicy ?? null,
        })
        .returning({ consentRecordId: consentRecord.consentRecordId });
      if (!created) throw new Error("Consent insert returned no row");

      await appendAudit(tx, {
        entityType: "consent_record",
        entityId: created.consentRecordId,
        operation: "insert",
        newValue: { purpose: input.purpose, method: input.consentMethod, retentionUntil },
        actorUserId: user.appUserId,
        actorRoleAtTime: user.roles[0] ?? null,
      });
      return created.consentRecordId;
    },
  );

  revalidatePath("/compliance/consent");
  return { consentRecordId };
}

const withdrawConsentSchema = z.object({
  consentRecordId: z.uuid(),
});

export type WithdrawConsentState = { error?: string } | undefined;

/**
 * Withdraw a consent_record (set consent_withdrawn_at = now). Per research §6 +
// schema §2.21, withdrawal of a regulated/sharing purpose auto-spawns a DSR
// (restriction/erasure) so the purge/restriction job runs within DPDP
// timelines. kyc_processing / regulatory_reporting → restriction (PMLA s.12 5yr
// minimum overrides erasure within the retention window).
 */
export async function withdrawConsent(
  _prev: WithdrawConsentState,
  formData: FormData,
): Promise<WithdrawConsentState> {
  const user = await requireUser();
  const guard = requirePermission(user, "update", "consent");
  if (!guard.ok) return { error: guard.error };

  const parsed = withdrawConsentSchema.safeParse({
    consentRecordId: formData.get("consentRecordId"),
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
      const [existing] = await tx
        .select()
        .from(consentRecord)
        .where(
          and(
            eq(consentRecord.consentRecordId, input.consentRecordId),
            isNull(consentRecord.deletedAt),
          ),
        );
      if (!existing) throw new Error("Consent record not found");
      if (existing.consentWithdrawnAt) {
        // Idempotent - already withdrawn.
        return;
      }

      const now = new Date();
      await tx
        .update(consentRecord)
        .set({ consentWithdrawnAt: now, updatedAt: now })
        .where(eq(consentRecord.consentRecordId, input.consentRecordId));

      await appendAudit(tx, {
        entityType: "consent_record",
        entityId: input.consentRecordId,
        operation: "update",
        fieldName: "consent_withdrawn_at",
        oldValue: { consentWithdrawnAt: null },
        newValue: { consentWithdrawnAt: now.toISOString() },
        actorUserId: user.appUserId,
        actorRoleAtTime: user.roles[0] ?? null,
      });

      // Auto-spawn a DSR if the purpose's withdrawal triggers one.
      const dsrType = dsrTypeForWithdrawal(existing.purpose as ConsentPurpose);
      if (dsrType) {
        const [dsr] = await tx
          .insert(dataSubjectRequest)
          .values({
            partyId: existing.partyId,
            contactId: existing.contactId,
            requestType: dsrType,
            status: "received",
            requestedAt: now,
            notes: `Auto-created by consent withdrawal (${existing.purpose}).`,
            handledByUserId: user.appUserId,
            triggeringConsentRecordId: input.consentRecordId,
          })
          .returning({ dsrId: dataSubjectRequest.dsrId });
        if (dsr) {
          await appendAudit(tx, {
            entityType: "data_subject_request",
            entityId: dsr.dsrId,
            operation: "insert",
            newValue: { requestType: dsrType, status: "received" },
            actorUserId: user.appUserId,
            actorRoleAtTime: user.roles[0] ?? null,
            correlationId: input.consentRecordId,
          });
        }
      }
    },
  );

  revalidatePath("/compliance/consent");
  return { error: undefined };
}

// Persistable DSR request types. This MUST stay in sync with the `dsr_type`
// Postgres enum in src/db/schema/enums.ts (preserved) and with the `DsrType`
// union in consent.ts. `nomination` (DPDP Act 2023 Section 11(d) right to
// nominate) is a real statutory right but is NOT yet a member of the
// `dsr_type` schema enum, so it is excluded here (and from DsrType) until the
// schema enum is extended via an additive ALTER TYPE + enums.ts update owned
// by the schema agent (src/db/schema/* is preserved). Tracked as a TODO.
const DSR_TYPES: readonly DsrType[] = [
  "access",
  "erasure",
  "rectification",
  "restriction",
  "portability",
  "withdraw_consent",
];
const DSR_STATUSES: readonly DsrStatus[] = [
  "received",
  "in_review",
  "fulfilled",
  "rejected",
  "cancelled",
];

const createDsrSchema = z
  .object({
    partyId: z.uuid().optional(),
    contactId: z.uuid().optional(),
    requestType: z.enum(DSR_TYPES),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => d.partyId || d.contactId, {
    message: "At least one of partyId / contactId is required.",
  });

export type CreateDsrState = { error?: string; dsrId?: string } | undefined;

/**
 * Create a Data Subject Request (DPDP principal-rights workflow stub). The SLA
// due date is computed from the request type but not stored (no column); it is
// surfaced in the UI from computeDsrDueDate.
 */
export async function createDsr(
  _prev: CreateDsrState,
  formData: FormData,
): Promise<CreateDsrState> {
  const user = await requireUser();
  const guard = requirePermission(user, "create", "dsr");
  if (!guard.ok) return { error: guard.error };

  const parsed = createDsrSchema.safeParse({
    partyId: formData.get("partyId") || undefined,
    contactId: formData.get("contactId") || undefined,
    requestType: formData.get("requestType"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;
  const now = new Date();
  // Compute the SLA due date - kept for the audit trail / future column.
  const _due = computeDsrDueDate(input.requestType, now);

  const dsrId = await withRls(
    user.appUserId ?? crypto.randomUUID(),
    user.wall,
    [],
    async (tx) => {
      const [created] = await tx
        .insert(dataSubjectRequest)
        .values({
          partyId: input.partyId ?? null,
          contactId: input.contactId ?? null,
          requestType: input.requestType,
          status: "received",
          requestedAt: now,
          notes: input.notes ?? null,
          handledByUserId: user.appUserId,
        })
        .returning({ dsrId: dataSubjectRequest.dsrId });
      if (!created) throw new Error("DSR insert returned no row");

      await appendAudit(tx, {
        entityType: "data_subject_request",
        entityId: created.dsrId,
        operation: "insert",
        newValue: { requestType: input.requestType, status: "received" },
        actorUserId: user.appUserId,
        actorRoleAtTime: user.roles[0] ?? null,
      });
      return created.dsrId;
    },
  );

  revalidatePath("/compliance/consent");
  return { dsrId };
}

const transitionDsrSchema = z.object({
  dsrId: z.uuid(),
  toStatus: z.enum(DSR_STATUSES),
  notes: z.string().max(2000).optional(),
});

export type TransitionDsrState = { error?: string } | undefined;

/**
 * Transition a DSR's status along the allowed workflow. On `fulfilled` /
// `rejected`, set completed_at.
 */
export async function transitionDsrStatus(
  _prev: TransitionDsrState,
  formData: FormData,
): Promise<TransitionDsrState> {
  const user = await requireUser();
  const guard = requirePermission(user, "update", "dsr");
  if (!guard.ok) return { error: guard.error };

  const parsed = transitionDsrSchema.safeParse({
    dsrId: formData.get("dsrId"),
    toStatus: formData.get("toStatus"),
    notes: formData.get("notes") || undefined,
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
      const [existing] = await tx
        .select()
        .from(dataSubjectRequest)
        .where(eq(dataSubjectRequest.dsrId, input.dsrId));
      if (!existing) throw new Error("DSR not found");
      const from = existing.status as DsrStatus;
      if (from === input.toStatus) return;
      if (!canTransitionDsr(from, input.toStatus)) {
        throw new Error(`Illegal DSR transition: ${from} → ${input.toStatus}`);
      }
      const now = new Date();
      const patch: Partial<typeof dataSubjectRequest.$inferInsert> = {
        status: input.toStatus,
        updatedAt: now,
        handledByUserId: user.appUserId,
      };
      if (input.toStatus === "fulfilled" || input.toStatus === "rejected") {
        patch.completedAt = now;
      }
      if (input.notes) patch.notes = input.notes;

      await tx
        .update(dataSubjectRequest)
        .set(patch)
        .where(eq(dataSubjectRequest.dsrId, input.dsrId));

      await appendAudit(tx, {
        entityType: "data_subject_request",
        entityId: input.dsrId,
        operation: input.toStatus === "fulfilled" ? "approve" : "update",
        fieldName: "status",
        oldValue: { status: from },
        newValue: { status: input.toStatus },
        actorUserId: user.appUserId,
        actorRoleAtTime: user.roles[0] ?? null,
      });
    },
  );

  revalidatePath("/compliance/consent");
  return { error: undefined };
}

// NOTE: a "use server" module may export ONLY async functions (+ inline type
// exports that erase at compile). The previous convenience re-exports of the
// pure helpers (computeDsrDueDate / computeRekycDueDate / computeValidUntil)
// were synchronous VALUE re-exports, which makes the client bundler reject the
// whole module ("no exports at all") the moment a client component imports an
// action from here. They were unused (callers import the helpers directly from
// ./consent and ./kyc), so they've been removed. Import the pure helpers from
// @/features/compliance/consent or @/features/compliance/kyc directly.
