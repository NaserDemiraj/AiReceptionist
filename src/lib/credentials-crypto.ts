import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * At-rest encryption for channel credentials (WhatsApp tokens, Twilio auth
 * tokens, Meta page tokens) stored in ChannelIntegration.credentials.
 *
 * AES-256-GCM keyed by CREDENTIALS_ENCRYPTION_KEY (any strong random string;
 * it's hashed to 32 bytes). Stored format: "enc:v1:" + base64(iv | tag | ciphertext).
 *
 * Backward + forward compatible by design:
 * - No key configured → objects are stored as plain JSON (dev-friendly).
 * - openCredentials accepts both encrypted strings and legacy plaintext rows,
 *   so enabling the key later needs no data migration — rows re-encrypt the
 *   next time a business saves its integration.
 */

const PREFIX = "enc:v1:";
const IV_LENGTH = 12; // GCM standard nonce size
const TAG_LENGTH = 16;

function getKey(): Buffer | null {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!secret) return null;
  return createHash("sha256").update(secret).digest();
}

export function isCredentialEncryptionConfigured(): boolean {
  return getKey() !== null;
}

/** Prepares a credentials object for storage — encrypts when a key is configured. */
export function sealCredentials(value: unknown): unknown {
  const key = getKey();
  if (!key) return value;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/** Reads stored credentials — decrypts "enc:v1:" strings, passes legacy plaintext through. */
export function openCredentials(stored: unknown): unknown {
  if (typeof stored !== "string" || !stored.startsWith(PREFIX)) return stored;

  const key = getKey();
  if (!key) return null; // encrypted row but no key in env — fail closed

  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    return null; // tampered or wrong key — treat as missing credentials
  }
}
