import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractInboundMessages, verifyWebhookSignature } from "./whatsapp";

const SECRET = "test-app-secret";

function sign(body: string): string {
  return `sha256=${createHmac("sha256", SECRET).update(body, "utf8").digest("hex")}`;
}

describe("verifyWebhookSignature", () => {
  it("accepts a valid signature", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(verifyWebhookSignature(SECRET, body, sign(body))).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(verifyWebhookSignature(SECRET, body + "x", sign(body))).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const body = "{}";
    const wrong = `sha256=${createHmac("sha256", "other").update(body).digest("hex")}`;
    expect(verifyWebhookSignature(SECRET, body, wrong)).toBe(false);
  });

  it("rejects missing or malformed headers", () => {
    expect(verifyWebhookSignature(SECRET, "{}", null)).toBe(false);
    expect(verifyWebhookSignature(SECRET, "{}", "md5=abc")).toBe(false);
    expect(verifyWebhookSignature(SECRET, "{}", "sha256=nothex!")).toBe(false);
    expect(verifyWebhookSignature(SECRET, "{}", "sha256=abcd")).toBe(false);
  });
});

describe("extractInboundMessages", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "123",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "35569000000", phone_number_id: "111222333" },
              contacts: [{ profile: { name: "Arben" }, wa_id: "355691234567" }],
              messages: [
                {
                  from: "355691234567",
                  id: "wamid.ABC123",
                  timestamp: "1720000000",
                  type: "text",
                  text: { body: "A keni divan gri?" },
                },
                // Non-text messages are skipped for now
                {
                  from: "355691234567",
                  id: "wamid.IMG456",
                  timestamp: "1720000001",
                  type: "image",
                  image: { id: "media-1" },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  it("extracts text messages with sender profile and routing id", () => {
    const messages = extractInboundMessages(payload);
    expect(messages).toEqual([
      {
        wamid: "wamid.ABC123",
        from: "355691234567",
        profileName: "Arben",
        phoneNumberId: "111222333",
        text: "A keni divan gri?",
      },
    ]);
  });

  it("ignores delivery status updates", () => {
    const statusPayload = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "111222333" },
                statuses: [{ id: "wamid.ABC123", status: "delivered" }],
              },
            },
          ],
        },
      ],
    };
    expect(extractInboundMessages(statusPayload)).toEqual([]);
  });

  it("returns an empty list for junk payloads", () => {
    expect(extractInboundMessages(null)).toEqual([]);
    expect(extractInboundMessages({})).toEqual([]);
    expect(extractInboundMessages({ entry: [{}] })).toEqual([]);
  });
});
