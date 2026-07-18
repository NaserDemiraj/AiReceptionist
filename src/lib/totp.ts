import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP two-factor auth (RFC 6238 / RFC 4226) — no dependencies.
 * 6 digits, 30-second steps, HMAC-SHA1 (what Google Authenticator,
 * 1Password, Authy etc. expect), ±1 step of clock drift tolerated.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160-bit random secret, base32 for authenticator apps. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/** Current code — exposed for tests; verification should use verifyTotp. */
export function totpCode(secret: string, atMs = Date.now()): string {
  return hotp(secret, Math.floor(atMs / 1000 / STEP_SECONDS));
}

/** Accepts the current step ±1 to tolerate clock drift and slow typing. */
export function verifyTotp(secret: string, input: string, atMs = Date.now()): boolean {
  const code = input.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
  const given = Buffer.from(code);
  for (const c of [counter, counter - 1, counter + 1]) {
    const expected = Buffer.from(hotp(secret, c));
    if (expected.length === given.length && timingSafeEqual(expected, given)) return true;
  }
  return false;
}

/** otpauth:// URL for authenticator apps (manual entry also works). */
export function totpAuthUrl(secret: string, accountEmail: string, issuer = "AI Receptionist"): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountEmail)}?${params}`;
}
