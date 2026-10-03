import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Application-level encryption for stored credentials (integration access
 * tokens). AES-256-GCM with a key derived from HOSTOS_ENCRYPTION_KEY, falling
 * back to AUTH_SECRET so an existing deployment keeps working — with a
 * startup warning, because rotating AUTH_SECRET would then also rotate the
 * credential key and orphan every stored token.
 *
 * Format: v1.<iv b64>.<tag b64>.<ciphertext b64>. Versioned so the algorithm
 * can change without a migration.
 */

function keyMaterial(): Buffer | null {
  const explicit = process.env.HOSTOS_ENCRYPTION_KEY?.trim();
  const fallback = process.env.AUTH_SECRET?.trim();
  const source = explicit || fallback;
  if (!source) return null;
  if (!explicit && !warned) {
    warned = true;
    console.warn("[crypto] HOSTOS_ENCRYPTION_KEY is not set; deriving the credential key from AUTH_SECRET. Set a dedicated key before rotating AUTH_SECRET.");
  }
  return createHash("sha256").update(source).digest();
}

let warned = false;

export function isEncryptionConfigured(): boolean {
  return keyMaterial() !== null;
}

export function encryptSecret(plain: string): string {
  const key = keyMaterial();
  if (!key) throw new Error("No encryption key configured (set HOSTOS_ENCRYPTION_KEY or AUTH_SECRET).");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string | null {
  const key = keyMaterial();
  if (!key) return null;
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key (rotated secret) or tampered payload — either way, no credential.
    return null;
  }
}

/** Shows enough of a token to recognise it, never enough to use it. */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) return "••••";
  return `${secret.slice(0, 6)}…${secret.slice(-4)}`;
}
