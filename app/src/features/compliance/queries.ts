// Server-side compliance data access (KYC + DPDP consent + DSR).
//
// All functions are safe to call from Server Components. They run plain SELECTs
// (the GUCs set by withRls are no-ops on tables without RLS enabled yet). The
// KYC detail query joins party, contact, beneficial owners, PEP flags, KYC
// documents, and the audit history for the record.

import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { can, type CrmUser } from "@/lib/rbac";
import {
  appUser,
  auditLog,
  consentRecord,
  contact,
  dataSubjectRequest,
  document,
  kycBeneficialOwner,
  kycRecord,
  party,
} from "@/db/schema";

const KYC_DOC_TYPES = [
  "kyc_pack",
  "pan_card",
  "aadhaar",
  "board_resolution",
  "form60",
  "form61",
  "consent_form",
] as const;

function canReadAllKyc(
  user?: Pick<CrmUser, "roles" | "permissions"> | null,
) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "compliance") ||
    can(user, "read_all", "kyc") ||
    can(user, "manage", "user")
  );
}

function canReadAllPrivacyLedger(
  user?: Pick<CrmUser, "roles" | "permissions"> | null,
) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "compliance") ||
    can(user, "read_all", "consent") ||
    can(user, "read_all", "data_subject_request") ||
    can(user, "manage", "user")
  );
}

function assignedPartyScopeClause(user?: CrmUser | null) {
  const scopedUserId = user?.appUserId;
  if (!scopedUserId) return undefined;
  return or(
    eq(party.assignedUserId, scopedUserId),
    eq(party.dataOwnerUserId, scopedUserId),
    eq(party.createdByUserId, scopedUserId),
  );
}

function consentVisibilityClause(user?: CrmUser | null) {
  const scopedUserId = user?.appUserId;
  if (canReadAllPrivacyLedger(user) || !scopedUserId) return undefined;
  return or(
    assignedPartyScopeClause(user),
    sql`EXISTS (
      SELECT 1
      FROM party_contact pc_scope
      JOIN party p_scope ON p_scope.party_id = pc_scope.party_id
      WHERE pc_scope.contact_id = ${consentRecord.contactId}
        AND pc_scope.deleted_at IS NULL
        AND p_scope.deleted_at IS NULL
        AND (
          p_scope.assigned_user_id = ${scopedUserId}
          OR p_scope.data_owner_user_id = ${scopedUserId}
          OR p_scope.created_by_user_id = ${scopedUserId}
        )
    )`,
  );
}

function dsrVisibilityClause(user?: CrmUser | null) {
  const scopedUserId = user?.appUserId;
  if (canReadAllPrivacyLedger(user) || !scopedUserId) return undefined;
  return or(
    eq(dataSubjectRequest.handledByUserId, scopedUserId),
    assignedPartyScopeClause(user),
    sql`EXISTS (
      SELECT 1
      FROM party_contact pc_scope
      JOIN party p_scope ON p_scope.party_id = pc_scope.party_id
      WHERE pc_scope.contact_id = ${dataSubjectRequest.contactId}
        AND pc_scope.deleted_at IS NULL
        AND p_scope.deleted_at IS NULL
        AND (
          p_scope.assigned_user_id = ${scopedUserId}
          OR p_scope.data_owner_user_id = ${scopedUserId}
          OR p_scope.created_by_user_id = ${scopedUserId}
        )
    )`,
  );
}

// ---------------------------------------------------------------------------
// KYC list + detail
// ---------------------------------------------------------------------------

export interface KycListItem {
  kycRecordId: string;
  partyId: string;
  partyLegalName: string;
  contactId: string | null;
  contactFullName: string | null;
  kycType: string | null;
  status: string | null;
  riskRating: string | null;
  highestBoOwnershipPct: string | null;
  pepStatus: string | null;
  validUntil: string | null;
  rekycDueDate: string | null;
  approvedAt: Date | null;
  createdAt: Date | null;
}

export interface KycListResult {
  rows: KycListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Paginated KYC list with status / risk / search filters. Sorted by
// rekyc_due_date ascending so due-soon records surface first (the compliance
// officer's working queue); NULLS LAST via a secondary createdAt desc.
 */
export async function listKycRecords({
  q,
  status,
  risk,
  user,
  page = 1,
  pageSize = 25,
}: {
  q?: string;
  status?: string;
  risk?: string;
  user?: CrmUser | null;
  page?: number;
  pageSize?: number;
} = {}): Promise<KycListResult> {
  const conds: (SQL<unknown> | undefined)[] = [isNull(kycRecord.deletedAt)];
  conds.push(
    isNull(party.deletedAt),
    canReadAllKyc(user) ? undefined : assignedPartyScopeClause(user),
  );

  if (status) conds.push(eq(kycRecord.status, status as NonNullable<(typeof kycRecord.$inferSelect)["status"]>));
  if (risk) conds.push(eq(kycRecord.riskRating, risk as NonNullable<(typeof kycRecord.$inferSelect)["riskRating"]>));
  if (q) {
    conds.push(
      or(
        ilike(party.legalName, `%${q}%`),
        ilike(contact.fullName, `%${q}%`),
      ),
    );
  }

  const where = and(...conds);

  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        kycRecordId: kycRecord.kycRecordId,
        partyId: kycRecord.partyId,
        partyLegalName: party.legalName,
        contactId: kycRecord.contactId,
        contactFullName: contact.fullName,
        kycType: kycRecord.kycType,
        status: kycRecord.status,
        riskRating: kycRecord.riskRating,
        highestBoOwnershipPct: kycRecord.highestBoOwnershipPct,
        pepStatus: contact.pepStatus,
        validUntil: kycRecord.validUntil,
        rekycDueDate: kycRecord.rekycDueDate,
        approvedAt: kycRecord.approvedAt,
        createdAt: kycRecord.createdAt,
      })
      .from(kycRecord)
      .innerJoin(party, eq(party.partyId, kycRecord.partyId))
      .leftJoin(contact, eq(contact.contactId, kycRecord.contactId))
      .where(where)
      .orderBy(asc(kycRecord.rekycDueDate), desc(kycRecord.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(kycRecord)
      .innerJoin(party, eq(party.partyId, kycRecord.partyId))
      .leftJoin(contact, eq(contact.contactId, kycRecord.contactId))
      .where(where),
  ]);

  return {
    total: n ?? 0,
    page,
    pageSize,
    rows: rows as KycListItem[],
  };
}

export interface KycBeneficialOwnerRow {
  kycBeneficialOwnerId: string;
  contactId: string;
  contactFullName: string;
  contactPan: string | null;
  contactPepStatus: string | null;
  ownershipPct: string | null;
  declaredAt: Date | null;
  relationshipPath: string | null;
}

export interface KycDocumentRow {
  documentId: string;
  documentType: string | null;
  kycCategory: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  isConfidential: boolean | null;
  isMnpi: boolean | null;
  createdAt: Date | null;
}

export interface KycHistoryRow {
  auditLogId: string;
  operation: string;
  fieldName: string | null;
  occurredAt: Date;
  actorEmail: string | null;
  actorRoleAtTime: string | null;
}

export interface KycDetail {
  record: typeof kycRecord.$inferSelect;
  party: { partyId: string; legalName: string; partyNature: string };
  contact: {
    contactId: string;
    fullName: string;
    pan: string | null;
    pepStatus: string | null;
    pepVerifiedAt: Date | null;
  } | null;
  approver: { userId: string; email: string } | null;
  beneficialOwners: KycBeneficialOwnerRow[];
  documents: KycDocumentRow[];
  history: KycHistoryRow[];
}

/**
 * Full KYC detail: the record, its party + (optional) contact, approver, BO
// junction rows, KYC-category documents anchored to the party/contact, and the
// audit history for this record. Parallel queries after the header fetch -
// no N+1.
 */
export async function getKycDetail(
  kycRecordId: string,
  user?: CrmUser | null,
): Promise<KycDetail | null> {
  const [rec] = await db
    .select({ record: kycRecord })
    .from(kycRecord)
    .innerJoin(party, eq(party.partyId, kycRecord.partyId))
    .where(
      and(
        eq(kycRecord.kycRecordId, kycRecordId),
        isNull(kycRecord.deletedAt),
        isNull(party.deletedAt),
        canReadAllKyc(user) ? undefined : assignedPartyScopeClause(user),
      ),
    );
  if (!rec) return null;
  const record = rec.record;

  const [partyRow, contactRow, approverRow] = await Promise.all([
    db
      .select({
        partyId: party.partyId,
        legalName: party.legalName,
        partyNature: party.partyNature,
      })
      .from(party)
      .where(eq(party.partyId, record.partyId))
      .then((r) => r[0] ?? null),
    record.contactId
      ? db
          .select({
            contactId: contact.contactId,
            fullName: contact.fullName,
            pan: contact.pan,
            pepStatus: contact.pepStatus,
            pepVerifiedAt: contact.pepVerifiedAt,
          })
          .from(contact)
          .where(eq(contact.contactId, record.contactId))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    record.approvedByUserId
      ? db
          .select({ userId: appUser.userId, email: appUser.email })
          .from(appUser)
          .where(eq(appUser.userId, record.approvedByUserId))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);

  if (!partyRow) return null;

  const [bos, docs, history] = await Promise.all([
    db
      .select({
        kycBeneficialOwnerId: kycBeneficialOwner.kycBeneficialOwnerId,
        contactId: kycBeneficialOwner.contactId,
        contactFullName: contact.fullName,
        contactPan: contact.pan,
        contactPepStatus: contact.pepStatus,
        ownershipPct: kycBeneficialOwner.ownershipPct,
        declaredAt: kycBeneficialOwner.declaredAt,
        relationshipPath: kycBeneficialOwner.relationshipPath,
      })
      .from(kycBeneficialOwner)
      .innerJoin(contact, eq(contact.contactId, kycBeneficialOwner.contactId))
      .where(
        and(
          eq(kycBeneficialOwner.kycRecordId, kycRecordId),
          isNull(kycBeneficialOwner.deletedAt),
        ),
      )
      .orderBy(asc(contact.fullName)),
    db
      .select({
        documentId: document.documentId,
        documentType: document.documentType,
        kycCategory: document.kycCategory,
        fileName: document.fileName,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        isConfidential: document.isConfidential,
        isMnpi: document.isMnpi,
        createdAt: document.createdAt,
      })
      .from(document)
      .where(
        and(
          isNull(document.deletedAt),
          or(
            eq(document.partyId, record.partyId),
            record.contactId ? eq(document.contactId, record.contactId) : sql`false`,
          ),
          or(
            isNull(document.kycCategory) ? sql`false` : sql`true`,
            inArray(document.documentType, [...KYC_DOC_TYPES]),
          ),
        ),
      )
      .orderBy(desc(document.createdAt)),
    db
      .select({
        auditLogId: auditLog.auditLogId,
        operation: auditLog.operation,
        fieldName: auditLog.fieldName,
        occurredAt: auditLog.occurredAt,
        actorEmail: appUser.email,
        actorRoleAtTime: auditLog.actorRoleAtTime,
      })
      .from(auditLog)
      .leftJoin(appUser, eq(appUser.userId, auditLog.actorUserId))
      .where(
        and(
          eq(auditLog.entityType, "kyc_record"),
          eq(auditLog.entityId, kycRecordId),
        ),
      )
      .orderBy(asc(auditLog.occurredAt))
      .limit(200),
  ]);

  return {
    record,
    party: partyRow,
    contact: contactRow,
    approver: approverRow,
    beneficialOwners: bos as KycBeneficialOwnerRow[],
    documents: docs as KycDocumentRow[],
    history: history as KycHistoryRow[],
  };
}

// ---------------------------------------------------------------------------
// DPDP consent ledger + DSR
// ---------------------------------------------------------------------------

export interface ConsentListItem {
  consentRecordId: string;
  partyId: string | null;
  partyLegalName: string | null;
  contactId: string | null;
  contactFullName: string | null;
  purpose: string;
  purposeDescription: string | null;
  consentGivenAt: Date | null;
  consentWithdrawnAt: Date | null;
  consentMethod: string | null;
  dataCategories: string[] | null;
  retentionUntil: string | null;
  versionOfPolicy: string | null;
  active: boolean;
}

export interface ConsentListResult {
  rows: ConsentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listConsentRecords({
  q,
  purpose,
  activeOnly,
  user,
  page = 1,
  pageSize = 25,
}: {
  q?: string;
  purpose?: string;
  activeOnly?: boolean;
  user?: CrmUser | null;
  page?: number;
  pageSize?: number;
} = {}): Promise<ConsentListResult> {
  const conds: (SQL<unknown> | undefined)[] = [isNull(consentRecord.deletedAt)];
  conds.push(consentVisibilityClause(user));
  if (purpose) conds.push(eq(consentRecord.purpose, purpose as NonNullable<(typeof consentRecord.$inferSelect)["purpose"]>));
  if (activeOnly) conds.push(isNull(consentRecord.consentWithdrawnAt));
  if (q) {
    conds.push(
      or(
        ilike(party.legalName, `%${q}%`),
        ilike(contact.fullName, `%${q}%`),
        ilike(consentRecord.purposeDescription, `%${q}%`),
      ),
    );
  }
  const where = and(...conds);

  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        consentRecordId: consentRecord.consentRecordId,
        partyId: consentRecord.partyId,
        partyLegalName: party.legalName,
        contactId: consentRecord.contactId,
        contactFullName: contact.fullName,
        purpose: consentRecord.purpose,
        purposeDescription: consentRecord.purposeDescription,
        consentGivenAt: consentRecord.consentGivenAt,
        consentWithdrawnAt: consentRecord.consentWithdrawnAt,
        consentMethod: consentRecord.consentMethod,
        dataCategories: consentRecord.dataCategories,
        retentionUntil: consentRecord.retentionUntil,
        versionOfPolicy: consentRecord.versionOfPolicy,
      })
      .from(consentRecord)
      .leftJoin(party, eq(party.partyId, consentRecord.partyId))
      .leftJoin(contact, eq(contact.contactId, consentRecord.contactId))
      .where(where)
      .orderBy(desc(consentRecord.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(consentRecord)
      .leftJoin(party, eq(party.partyId, consentRecord.partyId))
      .leftJoin(contact, eq(contact.contactId, consentRecord.contactId))
      .where(where),
  ]);

  return {
    total: n ?? 0,
    page,
    pageSize,
    rows: (rows as ConsentListItem[]).map((r) => ({
      ...r,
      active: r.consentWithdrawnAt == null,
    })),
  };
}

export interface DsrListItem {
  dsrId: string;
  partyId: string | null;
  partyLegalName: string | null;
  contactId: string | null;
  contactFullName: string | null;
  requestType: string;
  status: string;
  requestedAt: Date;
  completedAt: Date | null;
  handledByEmail: string | null;
  notes: string | null;
}

export interface DsrListResult {
  rows: DsrListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listDataSubjectRequests({
  status,
  requestType,
  user,
  page = 1,
  pageSize = 25,
}: {
  status?: string;
  requestType?: string;
  user?: CrmUser | null;
  page?: number;
  pageSize?: number;
} = {}): Promise<DsrListResult> {
  const conds: (SQL<unknown> | undefined)[] = [isNull(dataSubjectRequest.deletedAt)];
  conds.push(dsrVisibilityClause(user));
  if (status) conds.push(eq(dataSubjectRequest.status, status as NonNullable<(typeof dataSubjectRequest.$inferSelect)["status"]>));
  if (requestType) conds.push(eq(dataSubjectRequest.requestType, requestType as NonNullable<(typeof dataSubjectRequest.$inferSelect)["requestType"]>));
  const where = and(...conds);

  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        dsrId: dataSubjectRequest.dsrId,
        partyId: dataSubjectRequest.partyId,
        partyLegalName: party.legalName,
        contactId: dataSubjectRequest.contactId,
        contactFullName: contact.fullName,
        requestType: dataSubjectRequest.requestType,
        status: dataSubjectRequest.status,
        requestedAt: dataSubjectRequest.requestedAt,
        completedAt: dataSubjectRequest.completedAt,
        handledByEmail: appUser.email,
        notes: dataSubjectRequest.notes,
      })
      .from(dataSubjectRequest)
      .leftJoin(party, eq(party.partyId, dataSubjectRequest.partyId))
      .leftJoin(contact, eq(contact.contactId, dataSubjectRequest.contactId))
      .leftJoin(appUser, eq(appUser.userId, dataSubjectRequest.handledByUserId))
      .where(where)
      .orderBy(desc(dataSubjectRequest.requestedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(dataSubjectRequest)
      .leftJoin(party, eq(party.partyId, dataSubjectRequest.partyId))
      .leftJoin(contact, eq(contact.contactId, dataSubjectRequest.contactId))
      .where(where),
  ]);

  return {
    total: n ?? 0,
    page,
    pageSize,
    rows: rows as DsrListItem[],
  };
}
