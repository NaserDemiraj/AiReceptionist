import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openCredentials, sealCredentials } from "./credentials-crypto";

const SAMPLE = {
  phoneNumberId: "1234567890",
  accessToken: "EAAG-very-secret-token-abcdef",
  appSecret: "shhh-app-secret",
  verifyToken: "vt_123456",
};

describe("credentials crypto", () => {
  const originalKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  beforeEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = "test-key-for-unit-tests";
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    else process.env.CREDENTIALS_ENCRYPTION_KEY = originalKey;
  });

  it("round-trips credentials through encrypt + decrypt", () => {
    const sealed = sealCredentials(SAMPLE);
    expect(typeof sealed).toBe("string");
    expect(sealed as string).toMatch(/^enc:v1:/);
    expect(sealed as string).not.toContain("EAAG-very-secret-token");
    expect(openCredentials(sealed)).toEqual(SAMPLE);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    expect(sealCredentials(SAMPLE)).not.toEqual(sealCredentials(SAMPLE));
  });

  it("passes legacy plaintext rows through unchanged", () => {
    expect(openCredentials(SAMPLE)).toEqual(SAMPLE);
  });

  it("stores plaintext when no key is configured", () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    expect(sealCredentials(SAMPLE)).toEqual(SAMPLE);
  });

  it("returns null for tampered ciphertext", () => {
    const sealed = sealCredentials(SAMPLE) as string;
    const tampered = sealed.slice(0, -6) + "AAAAAA";
    expect(openCredentials(tampered)).toBeNull();
  });

  it("returns null for an encrypted row when the key is wrong", () => {
    const sealed = sealCredentials(SAMPLE);
    process.env.CREDENTIALS_ENCRYPTION_KEY = "a-different-key";
    expect(openCredentials(sealed)).toBeNull();
  });
});
