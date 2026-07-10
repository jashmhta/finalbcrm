"use server";

// Document mutations. Metadata in Postgres; blob in lib/storage (local FS or
// future S3). Accepts either a real File upload (FormData "file") or legacy
// metadata-only fields for API clients.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";

import { can, requireUser } from "@/lib/rbac";
import { runWithUserRls } from "@/lib/rls-user";
import { putDocumentObject } from "@/lib/storage";
import { writeAudit } from "@/lib/audit-write";
import { document } from "@/db/schema";

const DOCUMENT_TYPES = [
  "engagement_letter",
  "mandate_letter",
  "rating_rationale",
  "offering_circular",
  "drhp",
  "information_memorandum",
  "term_sheet",
  "security_document",
  "trustee_deed",
  "kyc_pack",
  "pan_card",
  "aadhaar",
  "board_resolution",
  "form60",
  "form61",
  "financial_statement",
  "financial_model_file",
  "credit_memo",
  "valuation_report",
  "legal_dd_report",
  "site_report",
  "consent_form",
  "other",
] as const;

const KYC_CATEGORIES = [
  "id_proof",
  "address_proof",
  "pan",
  "bo_declaration",
  "pep_declaration",
  "source_of_funds",
  "authority_letter",
] as const;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MiB

const createDocumentSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  kycCategory: z.enum(KYC_CATEGORIES).optional(),
  fileName: z.string().min(1, "File name is required").max(300),
  mimeType: z.string().max(200).optional(),
  sizeBytes: z.number().int().nonnegative().max(MAX_UPLOAD_BYTES).optional(),
  sha256: z.string().length(64).optional(),
  fileStoreRef: z.string().min(1).max(1024).optional(),
  dealId: z.uuid().optional(),
  partyId: z.uuid().optional(),
  contactId: z.uuid().optional(),
  isConfidential: z.boolean().default(false),
  isMnpi: z.boolean().default(false),
  barrierId: z.uuid().optional(),
  retentionUntil: z.iso.date().optional(),
});

export type CreateDocumentState = { error?: string } | undefined;

function parseMeta(formData: FormData) {
  const sizeBytes = formData.get("sizeBytes");
  return {
    documentType: formData.get("documentType") || undefined,
    kycCategory: formData.get("kycCategory") || undefined,
    fileName: formData.get("fileName"),
    mimeType: formData.get("mimeType") || undefined,
    sizeBytes:
      typeof sizeBytes === "string" && sizeBytes ? Number(sizeBytes) : undefined,
    sha256: formData.get("sha256") || undefined,
    fileStoreRef: formData.get("fileStoreRef") || undefined,
    dealId: formData.get("dealId") || undefined,
    partyId: formData.get("partyId") || undefined,
    contactId: formData.get("contactId") || undefined,
    isConfidential: formData.get("isConfidential") === "on",
    isMnpi: formData.get("isMnpi") === "on",
    barrierId: formData.get("barrierId") || undefined,
    retentionUntil: formData.get("retentionUntil") || undefined,
  };
}

/**
 * Create a document row. If FormData includes a `file` blob, it is stored via
 * lib/storage and sha256/size/ref are computed server-side (preferred path).
 */
export async function createDocument(
  _prev: CreateDocumentState,
  formData: FormData,
): Promise<CreateDocumentState> {
  const user = await requireUser();
  if (!can(user, "create", "document")) {
    return { error: "You do not have permission to upload documents." };
  }

  const fileField = formData.get("file");
  let stored: {
    key: string;
    sha256: string;
    sizeBytes: number;
    mimeType: string | null;
    fileName: string;
  } | null = null;

  if (fileField instanceof File && fileField.size > 0) {
    if (fileField.size > MAX_UPLOAD_BYTES) {
      return { error: "File exceeds 25 MB upload limit." };
    }
    const buf = Buffer.from(await fileField.arrayBuffer());
    stored = await putDocumentObject({
      data: buf,
      fileName: fileField.name || "upload.bin",
      mimeType: fileField.type || null,
    });
  }

  const meta = parseMeta(formData);
  if (stored) {
    meta.fileName = stored.fileName;
    meta.mimeType = stored.mimeType ?? undefined;
    meta.sizeBytes = stored.sizeBytes;
    meta.sha256 = stored.sha256;
    meta.fileStoreRef = stored.key;
  }

  const parsed = createDocumentSchema.safeParse(meta);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  if (!input.fileStoreRef && !stored) {
    return {
      error:
        "Upload a file or provide fileStoreRef. Metadata-only without a store key is no longer allowed.",
    };
  }

  const documentId = await runWithUserRls(user, async (tx, { appUserId }) => {
    const [created] = await tx
      .insert(document)
      .values({
        documentType: input.documentType ?? null,
        kycCategory: input.kycCategory ?? null,
        fileName: input.fileName,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? null,
        sha256: input.sha256 ?? null,
        fileStoreRef: input.fileStoreRef ?? null,
        dealId: input.dealId ?? null,
        partyId: input.partyId ?? null,
        contactId: input.contactId ?? null,
        uploadedByUserId: appUserId,
        isConfidential: input.isConfidential,
        isMnpi: input.isMnpi,
        barrierId: input.barrierId ?? null,
        retentionUntil: input.retentionUntil ?? null,
      })
      .returning({ documentId: document.documentId });

    if (!created) throw new Error("Document insert returned no row");
    return created.documentId;
  });

  await writeAudit({
    actor: user,
    entityType: "document",
    entityId: documentId,
    operation: "insert",
    newValue: {
      fileName: input.fileName,
      sha256: input.sha256,
      partyId: input.partyId,
      dealId: input.dealId,
    },
  });

  revalidatePath("/documents");
  revalidatePath("/console/documents");
  const redirectTo = formData.get("redirectTo");
  if (typeof redirectTo === "string" && redirectTo.startsWith("/console")) {
    redirect(redirectTo);
  }
  redirect(`/documents/${documentId}`);
}
