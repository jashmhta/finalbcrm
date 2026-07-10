// Document object storage abstraction.
//
// Production target: S3-compatible (MinIO / AWS S3 / R2) via DOCUMENT_STORAGE.
// Default: local filesystem under DOCUMENT_STORAGE_DIR (or .data/documents)
// so the platform works offline without cloud credentials.
//
// The document table stores only metadata + file_store_ref + sha256; the blob
// never enters Postgres.

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

export type StoredObject = {
  /** Opaque store key persisted as document.file_store_ref. */
  key: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string | null;
  fileName: string;
};

function storageRoot(): string {
  return (
    process.env.DOCUMENT_STORAGE_DIR ||
    path.join(process.cwd(), ".data", "documents")
  );
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180) || "file";
}

/**
 * Persist a binary buffer and return store metadata.
 * Key layout: `yyyy/mm/<uuid>__<safeName>`
 */
export async function putDocumentObject(input: {
  data: Buffer | Uint8Array;
  fileName: string;
  mimeType?: string | null;
}): Promise<StoredObject> {
  const buf = Buffer.isBuffer(input.data)
    ? input.data
    : Buffer.from(input.data);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safe = sanitizeFileName(input.fileName);
  const key = `${yyyy}/${mm}/${randomUUID()}__${safe}`;

  const full = path.join(storageRoot(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf);

  return {
    key,
    sha256,
    sizeBytes: buf.byteLength,
    mimeType: input.mimeType ?? null,
    fileName: input.fileName,
  };
}

/** Read a stored object by key. Throws if missing. */
export async function getDocumentObject(key: string): Promise<Buffer> {
  // Prevent path traversal: key must be relative and not contain `..`.
  if (!key || key.includes("..") || path.isAbsolute(key)) {
    throw new Error("Invalid storage key");
  }
  const full = path.join(storageRoot(), key);
  return readFile(full);
}

/** Best-effort delete (soft-delete of DB row should already have happened). */
export async function deleteDocumentObject(key: string): Promise<void> {
  if (!key || key.includes("..") || path.isAbsolute(key)) return;
  try {
    await unlink(path.join(storageRoot(), key));
  } catch {
    // ignore missing
  }
}

/** Hash a buffer without storing (for client-supplied verification). */
export function sha256Hex(data: Buffer | Uint8Array): string {
  return createHash("sha256")
    .update(Buffer.isBuffer(data) ? data : Buffer.from(data))
    .digest("hex");
}
