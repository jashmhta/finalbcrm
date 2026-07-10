// Server-side document data access (DATA_MODEL §2.20). The document table is
// metadata only - the file blob lives in S3-compatible object storage with
// file_store_ref as the key. KYC documents are encryption-at-rest + access-
// logged separately (ARCHITECTURE §4.3). barrier_id is the information-wall
// tag for RLS; is_mnpi disables download/copy/email-forward in the UI. RLS-
// aware once policies are migrated; until then plain queries. All functions
// are safe to call from Server Components.

import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { can, type CrmUser } from "@/lib/rbac";
import {
  appUser,
  contact,
  deal,
  document,
  documentTypeEnum,
  party,
} from "@/db/schema";

type DocumentTypeValue = (typeof documentTypeEnum.enumValues)[number];

export interface DocumentListItem {
  documentId: string;
  documentType: string | null;
  kycCategory: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  isConfidential: boolean | null;
  isMnpi: boolean | null;
  barrierId: string | null;
  retentionUntil: string | null;
  dealId: string | null;
  dealCode: string | null;
  partyId: string | null;
  partyName: string | null;
  contactId: string | null;
  contactName: string | null;
  uploadedByEmail: string | null;
  createdAt: Date | null;
}

export interface DocumentListResult {
  rows: DocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

function canReadAllDocuments(
  user?: Pick<CrmUser, "roles" | "permissions"> | null,
) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "document") ||
    can(user, "manage", "user")
  );
}

function documentVisibilityClause(user?: CrmUser | null) {
  const scopedUserId = user?.appUserId;
  if (canReadAllDocuments(user) || !scopedUserId) return undefined;

  return or(
    eq(document.uploadedByUserId, scopedUserId),
    eq(party.assignedUserId, scopedUserId),
    eq(party.dataOwnerUserId, scopedUserId),
    eq(party.createdByUserId, scopedUserId),
    eq(deal.leadUserId, scopedUserId),
    eq(deal.creditAnalystUserId, scopedUserId),
    eq(deal.createdByUserId, scopedUserId),
    eq(contact.createdByUserId, scopedUserId),
    sql`EXISTS (
      SELECT 1
      FROM deal_party dp_scope
      JOIN party p_scope ON p_scope.party_id = dp_scope.party_id
      WHERE dp_scope.deal_id = ${document.dealId}
        AND dp_scope.deleted_at IS NULL
        AND p_scope.deleted_at IS NULL
        AND (
          p_scope.assigned_user_id = ${scopedUserId}
          OR p_scope.data_owner_user_id = ${scopedUserId}
          OR p_scope.created_by_user_id = ${scopedUserId}
        )
    )`,
    sql`EXISTS (
      SELECT 1
      FROM party_contact pc_scope
      JOIN party p_scope ON p_scope.party_id = pc_scope.party_id
      WHERE pc_scope.contact_id = ${document.contactId}
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

function dealOptionVisibilityClause(user?: CrmUser | null) {
  const scopedUserId = user?.appUserId;
  if (canReadAllDocuments(user) || !scopedUserId) return undefined;

  return or(
    eq(deal.leadUserId, scopedUserId),
    eq(deal.creditAnalystUserId, scopedUserId),
    eq(deal.createdByUserId, scopedUserId),
    sql`EXISTS (
      SELECT 1
      FROM deal_party dp_scope
      JOIN party p_scope ON p_scope.party_id = dp_scope.party_id
      WHERE dp_scope.deal_id = ${deal.dealId}
        AND dp_scope.deleted_at IS NULL
        AND p_scope.deleted_at IS NULL
        AND (
          p_scope.assigned_user_id = ${scopedUserId}
          OR p_scope.data_owner_user_id = ${scopedUserId}
          OR p_scope.created_by_user_id = ${scopedUserId}
        )
    )`,
  );
}

function partyOptionVisibilityClause(user?: CrmUser | null) {
  const scopedUserId = user?.appUserId;
  if (canReadAllDocuments(user) || !scopedUserId) return undefined;
  return or(
    eq(party.assignedUserId, scopedUserId),
    eq(party.dataOwnerUserId, scopedUserId),
    eq(party.createdByUserId, scopedUserId),
  );
}

function contactOptionVisibilityClause(user?: CrmUser | null) {
  const scopedUserId = user?.appUserId;
  if (canReadAllDocuments(user) || !scopedUserId) return undefined;
  return or(
    eq(contact.createdByUserId, scopedUserId),
    sql`EXISTS (
      SELECT 1
      FROM party_contact pc_scope
      JOIN party p_scope ON p_scope.party_id = pc_scope.party_id
      WHERE pc_scope.contact_id = ${contact.contactId}
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

/**
 * Paginated document list, optionally filtered by document_type. Ordered
 * newest first (created_at desc) - the document table is append-only-ish, so
 * this is the natural browse order.
 */
export async function listDocuments({
  documentType,
  partyId,
  dealId,
  contactId,
  mnpiOnly,
  q,
  user,
  page = 1,
  pageSize = 25,
}: {
  documentType?: string;
  partyId?: string;
  dealId?: string;
  contactId?: string;
  mnpiOnly?: boolean;
  q?: string;
  user?: CrmUser | null;
  page?: number;
  pageSize?: number;
} = {}): Promise<DocumentListResult> {
  const where = and(
    isNull(document.deletedAt),
    documentVisibilityClause(user),
    documentType
      ? eq(document.documentType, documentType as DocumentTypeValue)
      : undefined,
    partyId ? eq(document.partyId, partyId) : undefined,
    dealId ? eq(document.dealId, dealId) : undefined,
    contactId ? eq(document.contactId, contactId) : undefined,
    mnpiOnly ? eq(document.isMnpi, true) : undefined,
    q ? ilike(document.fileName, `%${q}%`) : undefined,
  );

  const [rows, [{ n }]] = await Promise.all([
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
        barrierId: document.barrierId,
        retentionUntil: document.retentionUntil,
        dealId: document.dealId,
        dealCode: deal.dealCode,
        partyId: document.partyId,
        partyName: party.legalName,
        contactId: document.contactId,
        contactName: contact.fullName,
        uploadedByEmail: appUser.email,
        createdAt: document.createdAt,
      })
      .from(document)
      .leftJoin(deal, eq(deal.dealId, document.dealId))
      .leftJoin(party, eq(party.partyId, document.partyId))
      .leftJoin(contact, eq(contact.contactId, document.contactId))
      .leftJoin(appUser, eq(appUser.userId, document.uploadedByUserId))
      .where(where)
      .orderBy(desc(document.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(document)
      .leftJoin(deal, eq(deal.dealId, document.dealId))
      .leftJoin(party, eq(party.partyId, document.partyId))
      .leftJoin(contact, eq(contact.contactId, document.contactId))
      .where(where),
  ]);

  return {
    total: n ?? 0,
    page,
    pageSize,
    rows: rows.map((r) => ({
      ...r,
      // bigint mode: "number" → JS number; size_bytes may be null.
      sizeBytes: r.sizeBytes ?? null,
      // retention_until is a `date` column → string.
      retentionUntil: r.retentionUntil ?? null,
    })),
  };
}

export interface DocumentDetail {
  document: typeof document.$inferSelect;
  dealCode: string | null;
  dealName: string | null;
  partyName: string | null;
  contactName: string | null;
  uploadedByEmail: string | null;
}

export async function getDocumentDetail(
  documentId: string,
  user?: CrmUser | null,
): Promise<DocumentDetail | null> {
  const [row] = await db
    .select({
      document: document,
      dealCode: deal.dealCode,
      dealName: deal.dealName,
      partyName: party.legalName,
      contactName: contact.fullName,
      uploadedByEmail: appUser.email,
    })
    .from(document)
    .leftJoin(deal, eq(deal.dealId, document.dealId))
    .leftJoin(party, eq(party.partyId, document.partyId))
    .leftJoin(contact, eq(contact.contactId, document.contactId))
    .leftJoin(appUser, eq(appUser.userId, document.uploadedByUserId))
    .where(
      and(
        eq(document.documentId, documentId),
        isNull(document.deletedAt),
        documentVisibilityClause(user),
      ),
    );
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Form lookups
// ---------------------------------------------------------------------------

export interface DealOption {
  dealId: string;
  dealCode: string | null;
  dealName: string | null;
}
export interface PartyOption {
  partyId: string;
  legalName: string;
}
export interface ContactOption {
  contactId: string;
  fullName: string;
}

export async function listDealOptions({
  q,
  limit = 50,
  user,
}: {
  q?: string;
  limit?: number;
  user?: CrmUser | null;
} = {}): Promise<DealOption[]> {
  const where = and(
    isNull(deal.deletedAt),
    dealOptionVisibilityClause(user),
    q ? or(ilike(deal.dealCode, `%${q}%`), ilike(deal.dealName, `%${q}%`)) : undefined,
  );
  return db
    .select({
      dealId: deal.dealId,
      dealCode: deal.dealCode,
      dealName: deal.dealName,
    })
    .from(deal)
    .where(where)
    .orderBy(asc(deal.dealCode))
    .limit(limit);
}

export async function listPartyOptions({
  q,
  limit = 50,
  user,
}: {
  q?: string;
  limit?: number;
  user?: CrmUser | null;
} = {}): Promise<PartyOption[]> {
  const where = and(
    isNull(party.deletedAt),
    partyOptionVisibilityClause(user),
    q ? ilike(party.legalName, `%${q}%`) : undefined,
  );
  return db
    .select({ partyId: party.partyId, legalName: party.legalName })
    .from(party)
    .where(where)
    .orderBy(asc(party.legalName))
    .limit(limit);
}

export async function listContactOptions({
  q,
  limit = 50,
  user,
}: {
  q?: string;
  limit?: number;
  user?: CrmUser | null;
} = {}): Promise<ContactOption[]> {
  const where = and(
    isNull(contact.deletedAt),
    contactOptionVisibilityClause(user),
    q ? ilike(contact.fullName, `%${q}%`) : undefined,
  );
  return db
    .select({ contactId: contact.contactId, fullName: contact.fullName })
    .from(contact)
    .where(where)
    .orderBy(asc(contact.fullName))
    .limit(limit);
}
