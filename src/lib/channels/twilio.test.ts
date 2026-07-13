import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { forwardCallTwiml, isMissedCall, verifyTwilioSignature } from "./twilio";

const TOKEN = "test-auth-token";
const URL = "https://app.example.com/api/v1/channels/twilio/abc123/voice";

function sign(url: string, params: Record<string, string>): string {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  return createHmac("sha1", TOKEN).update(data, "utf8").digest("base64");
}

describe("verifyTwilioSignature", () => {
  const params = { From: "+355691234567", CallSid: "CA123", CallStatus: "ringing" };

  it("accepts a valid signature", () => {
    expect(verifyTwilioSignature(TOKEN, URL, params, sign(URL, params))).toBe(true);
  });

  it("rejects tampered params", () => {
    const tampered = { ...params, From: "+10000000000" };
    expect(verifyTwilioSignature(TOKEN, URL, tampered, sign(URL, params))).toBe(false);
  });

  it("rejects a different URL", () => {
    expect(verifyTwilioSignature(TOKEN, URL + "x", params, sign(URL, params))).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyTwilioSignature(TOKEN, URL, params, null)).toBe(false);
  });
});

describe("forwardCallTwiml", () => {
  it("dials the forward number with a status action", () => {
    const xml = forwardCallTwiml("+355691234567", "https://x.test/status", 20);
    expect(xml).toContain('<Dial action="https://x.test/status" timeout="20">+355691234567</Dial>');
  });

  it("escapes XML-sensitive characters", () => {
    const xml = forwardCallTwiml("+1", "https://x.test/status?a=1&b=2");
    expect(xml).toContain("a=1&amp;b=2");
  });
});

describe("isMissedCall", () => {
  it("treats no-answer, busy, and failed as missed", () => {
    expect(isMissedCall("no-answer")).toBe(true);
    expect(isMissedCall("busy")).toBe(true);
    expect(isMissedCall("failed")).toBe(true);
  });

  it("treats completed and null as answered", () => {
    expect(isMissedCall("completed")).toBe(false);
    expect(isMissedCall(null)).toBe(false);
  });
});
