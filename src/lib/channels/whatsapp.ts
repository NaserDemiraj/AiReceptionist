import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { logger } from "../logger";
import { openCredentials } from "../credentials-crypto";

/**
 * WhatsApp Business Cloud API client (plain fetch, Graph API).
 * Credentials live per-org on ChannelIntegration.credentials.
 */

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
/** WhatsApp rejects text bodies longer than 4096 chars. */
const MAX_TEXT_LENGTH = 4096;

export const whatsAppCredentialsSchema = z.object({
  /** WhatsApp Business phone number ID (numeric, from Meta's API Setup page) */
  phoneNumberId: z.string().min(5),
  /** Permanent system-user access token with whatsapp_business_messaging */
  accessToken: z.string().min(20),
  /** Meta app secret — used to verify webhook signatures */
  appSecret: z.string().min(10),
  /** Token echoed back during Meta's webhook verification handshake */
  verifyToken: z.string().min(6),
});

export type WhatsAppCredentials = z.infer<typeof whatsAppCredentialsSchema>;

export function parseWhatsAppCredentials(json: unknown): WhatsAppCredentials | null {
  const parsed = whatsAppCredentialsSchema.safeParse(openCredentials(json));
  return parsed.success ? parsed.data : null;
}

export interface WhatsAppSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/** Sends a plain text message to a phone number (E.164 digits, no "+"). */
export async function sendWhatsAppText(
  creds: WhatsAppCredentials,
  to: string,
  text: string,
): Promise<WhatsAppSendResult> {
  try {
    const res = await fetch(`${GRAPH_BASE}/${creds.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/[^\d]/g, ""),
        type: "text",
        text: { preview_url: false, body: text.slice(0, MAX_TEXT_LENGTH) },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, body: body.slice(0, 300), to }, "whatsapp send failed");
      return { ok: false, error: `whatsapp_${res.status}` };
    }
    const data = (await res.json()) as { messages?: Array<{ id: string }> };
    return { ok: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    logger.error({ err, to }, "whatsapp send threw");
    return { ok: false, error: "network_error" };
  }
}

/**
 * Verifies Meta's `X-Hub-Signature-256` header against the raw request body.
 * Constant-time comparison; returns false on any malformed input.
 */
export function verifyWebhookSignature(
  appSecret: string,
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  if (received.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export interface InboundWhatsAppMessage {
  /** WhatsApp message id — used to deduplicate webhook retries */
  wamid: string;
  /** Sender's phone number (wa_id, digits only) */
  from: string;
  /** Sender's WhatsApp profile name, when Meta includes it */
  profileName: string | null;
  /** Business phone number ID the message was sent to */
  phoneNumberId: string;
  text: string;
}

/**
 * Extracts inbound text messages from a webhook payload.
 * Delivery/read status updates and non-text messages are skipped.
 */
export function extractInboundMessages(payload: unknown): InboundWhatsAppMessage[] {
  const messages: InboundWhatsAppMessage[] = [];
  const body = payload as {
    entry?: Array<{
      changes?: Array<{
        field?: string;
        value?: {
          metadata?: { phone_number_id?: string };
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
          messages?: Array<{
            id?: string;
            from?: string;
            type?: string;
            text?: { body?: string };
          }>;
        };
      }>;
    }>;
  };

  for (const entry of body?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      for (const msg of value?.messages ?? []) {
        if (msg.type !== "text" || !msg.text?.body || !msg.id || !msg.from) continue;
        const contact = value?.contacts?.find((c) => c.wa_id === msg.from);
        messages.push({
          wamid: msg.id,
          from: msg.from,
          profileName: contact?.profile?.name ?? null,
          phoneNumberId,
          text: msg.text.body,
        });
      }
    }
  }
  return messages;
}
