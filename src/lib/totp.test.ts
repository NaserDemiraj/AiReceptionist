import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, totpCode, verifyTotp } from "./totp";

// RFC 4226 appendix D test secret: ASCII "12345678901234567890"
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));
// Expected HOTP codes for counters 0..9 (RFC 4226) — TOTP counter = time/30
const RFC_CODES = [
  "755224", "287082", "359152", "969429", "338314",
  "254676", "287922", "162583", "399871", "520489",
];

describe("totp", () => {
  it("matches the RFC 4226 reference vectors", () => {
    for (let counter = 0; counter < RFC_CODES.length; counter++) {
      // totpCode(secret, ms) uses floor(ms/1000/30) as the counter
      expect(totpCode(RFC_SECRET, counter * 30_000)).toBe(RFC_CODES[counter]);
    }
  });

  it("round-trips base32", () => {
    const buf = Buffer.from("hello totp secret!", "utf8");
    expect(base32Decode(base32Encode(buf)).toString("utf8")).toBe("hello totp secret!");
  });

  it("accepts the current code and ±1 step of drift", () => {
    const now = 1_700_000_010_000;
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now), now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now - 30_000), now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now + 30_000), now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now - 90_000), now)).toBe(false);
  });

  it("tolerates spaces and rejects malformed input", () => {
    const now = 1_700_000_010_000;
    const code = totpCode(RFC_SECRET, now);
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, "12345", now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "abcdef", now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "", now)).toBe(false);
  });

  it("generates distinct 32-char base32 secrets", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(a).not.toBe(b);
  });
});
