import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapStripeStatus, verifyStripeSignature } from "./stripe";

const SECRET = "whsec_test";

function sign(body: string, timestamp: number): string {
  const sig = createHmac("sha256", SECRET).update(`${timestamp}.${body}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

describe("verifyStripeSignature", () => {
  const nowMs = 1_760_000_000_000;
  const ts = Math.floor(nowMs / 1000);

  it("accepts a valid, fresh signature", () => {
    const body = '{"type":"checkout.session.completed"}';
    expect(verifyStripeSignature(SECRET, body, sign(body, ts), 300, nowMs)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = "{}";
    expect(verifyStripeSignature(SECRET, body + "x", sign(body, ts), 300, nowMs)).toBe(false);
  });

  it("rejects stale timestamps (replay protection)", () => {
    const body = "{}";
    expect(verifyStripeSignature(SECRET, body, sign(body, ts - 600), 300, nowMs)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const body = "{}";
    const wrong = `t=${ts},v1=${createHmac("sha256", "other").update(`${ts}.${body}`).digest("hex")}`;
    expect(verifyStripeSignature(SECRET, body, wrong, 300, nowMs)).toBe(false);
  });

  it("rejects missing or malformed headers", () => {
    expect(verifyStripeSignature(SECRET, "{}", null, 300, nowMs)).toBe(false);
    expect(verifyStripeSignature(SECRET, "{}", "garbage", 300, nowMs)).toBe(false);
    expect(verifyStripeSignature(SECRET, "{}", `t=${ts}`, 300, nowMs)).toBe(false);
  });
});

describe("mapStripeStatus", () => {
  it("maps stripe statuses to our enum", () => {
    expect(mapStripeStatus("active")).toBe("ACTIVE");
    expect(mapStripeStatus("trialing")).toBe("TRIALING");
    expect(mapStripeStatus("past_due")).toBe("PAST_DUE");
    expect(mapStripeStatus("unpaid")).toBe("PAST_DUE");
    expect(mapStripeStatus("canceled")).toBe("CANCELLED");
    expect(mapStripeStatus("incomplete_expired")).toBe("CANCELLED");
  });
});
