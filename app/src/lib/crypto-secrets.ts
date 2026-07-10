// Application-layer secret encryption for at-rest fields (MFA TOTP secrets).
//
// Uses AES-256-GCM with a key derived from AUTH_SECRET (or MFA_ENCRYPTION_KEY
// when set). Ciphertext format:
//   v1:<iv_b64>:<tag_b64>:<ct_b64>
//
// Plain Base32 MFA secrets written before encryption was enabled are still
// accepted by `decryptSecret` (pass-through) so rollout is non-breaking.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "v1:";
const ALGO = "aes-256-gcm";

function keyBytes(): Buffer {
  const material =
    process.env.MFA_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "";
  if (!material) {
    // Dev fallback - deterministic but not for production. Auth layer should
    // set AUTH_SECRET in every real deploy.
    return createHash("sha256").update("binary-crm-dev-mfa-key").digest();
  }
  return createHash("sha256").update(material).digest();
}

/** Encrypt a UTF-8 string for storage. Returns versioned ciphertext. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBytes(), iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(":");
}

/**
 * Decrypt a versioned ciphertext, or return the input unchanged when it is
 * not version-prefixed (legacy plaintext Base32 TOTP secrets).
 */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX) && !stored.startsWith("v1:")) {
    // Legacy plaintext or already-base32 secret.
    if (!stored.includes(":")) return stored;
  }
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    // Not our envelope - treat as plaintext (legacy).
    return stored;
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const ct = Buffer.from(ctB64, "base64url");
  const decipher = createDecipheriv(ALGO, keyBytes(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString("utf8");
}

/** True when the value looks like an encrypted envelope. */
export function isEncryptedSecret(stored: string): boolean {
  return stored.startsWith("v1:") && stored.split(":").length === 4;
}
