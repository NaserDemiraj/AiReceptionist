import { describe, expect, it } from "vitest";
import { extractMessengerMessages } from "./messenger";

function payload(messaging: unknown[]) {
  return { object: "page", entry: [{ messaging }] };
}

describe("extractMessengerMessages", () => {
  it("extracts inbound text messages", () => {
    const msgs = extractMessengerMessages(
      payload([
        {
          sender: { id: "psid_123" },
          recipient: { id: "page_1" },
          message: { mid: "m1", text: "Hi, is the sofa in stock?" },
        },
      ]),
    );
    expect(msgs).toEqual([
      { mid: "m1", senderPsid: "psid_123", recipientId: "page_1", text: "Hi, is the sofa in stock?" },
    ]);
  });

  it("skips echoes of the page's own messages (prevents reply loops)", () => {
    const msgs = extractMessengerMessages(
      payload([
        {
          sender: { id: "page_1" },
          recipient: { id: "psid_123" },
          message: { mid: "m2", text: "Our reply", is_echo: true },
        },
      ]),
    );
    expect(msgs).toEqual([]);
  });

  it("skips delivery receipts and attachment-only events", () => {
    const msgs = extractMessengerMessages(
      payload([
        { sender: { id: "psid_123" }, recipient: { id: "page_1" }, delivery: { mids: ["m1"] } },
        { sender: { id: "psid_123" }, recipient: { id: "page_1" }, message: { mid: "m3" } },
      ]),
    );
    expect(msgs).toEqual([]);
  });

  it("collects messages across multiple entries", () => {
    const msgs = extractMessengerMessages({
      object: "page",
      entry: [
        {
          messaging: [
            { sender: { id: "a" }, recipient: { id: "p" }, message: { mid: "m1", text: "one" } },
          ],
        },
        {
          messaging: [
            { sender: { id: "b" }, recipient: { id: "p" }, message: { mid: "m2", text: "two" } },
          ],
        },
      ],
    });
    expect(msgs.map((m) => m.mid)).toEqual(["m1", "m2"]);
  });

  it("tolerates junk payloads without throwing", () => {
    expect(extractMessengerMessages(null)).toEqual([]);
    expect(extractMessengerMessages("garbage")).toEqual([]);
    expect(extractMessengerMessages({ entry: [{}] })).toEqual([]);
  });
});
