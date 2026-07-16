import { z } from "zod";
import { logger } from "../logger";
import { openCredentials } from "../credentials-crypto";
import { verifyWebhookSignature } from "./whatsapp";

/**
 * Meta Messenger client — covers both Facebook Page messages and
 * Instagram DMs (same Graph API + webhook shape, different channel rows).
 * Webhook signature scheme is identical to WhatsApp's (X-Hub-Signature-256).
 */

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
/** Messenger rejects text over 2000 chars. */
const MAX_TEXT_LENGTH = 2000;

export const messengerCredentialsSchema = z.object({
  /** Facebook Page ID (also used for the linked Instagram account) */
  pageId: z.string().min(5),
  /** Page access token with pages_messaging (and instagram_manage_messages for IG) */
  pageAccessToken: z.string().min(20),
  /** Meta app secret — verifies webhook signatures */
  appSecret: z.string().min(10),
  /** Token echoed back during Meta's webhook verification handshake */
  verifyToken: z.string().min(6),
});

export type MessengerCredentials = z.infer<typeof messengerCredentialsSchema>;

export function parseMessengerCredentials(json: unknown): MessengerCredentials | null {
  const parsed = messengerCredentialsSchema.safeParse(openCredentials(json));
  return parsed.success ? parsed.data : null;
}

export { verifyWebhookSignature };

export interface MessengerSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/** Sends a text reply to a user by their page-scoped ID (PSID). */
export async function sendMessengerText(
  creds: MessengerCredentials,
  psid: string,
  text: string,
): Promise<MessengerSendResult> {
  try {
    const res = await fetch(
      `${GRAPH_BASE}/${creds.pageId}/messages?access_token=${encodeURIComponent(creds.pageAccessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: psid },
          messaging_type: "RESPONSE",
          message: { text: text.slice(0, MAX_TEXT_LENGTH) },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, body: body.slice(0, 300), psid }, "messenger send failed");
      return { ok: false, error: `messenger_${res.status}` };
    }
    const data = (await res.json()) as { message_id?: string };
    return { ok: true, messageId: data.message_id };
  } catch (err) {
    logger.error({ err, psid }, "messenger send threw");
    return { ok: false, error: "network_error" };
  }
}

export interface InboundMessengerMessage {
  /** Meta message id (mid) — used to deduplicate webhook retries */
  mid: string;
  /** Sender's page-scoped ID */
  senderPsid: string;
  /** Page / IG account the message was sent to */
  recipientId: string;
  text: string;
}

/**
 * Extracts inbound text messages from a Messenger/Instagram webhook payload.
 * Echoes of the page's own messages, delivery receipts, and non-text
 * attachments are skipped.
 */
export function extractMessengerMessages(payload: unknown): InboundMessengerMessage[] {
  const messages: InboundMessengerMessage[] = [];
  const body = payload as {
    object?: string;
    entry?: Array<{
      messaging?: Array<{
        sender?: { id?: string };
        recipient?: { id?: string };
        message?: { mid?: string; text?: string; is_echo?: boolean };
      }>;
    }>;
  };

  for (const entry of body?.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const msg = event.message;
      if (!msg?.text || !msg.mid || msg.is_echo) continue;
      if (!event.sender?.id || !event.recipient?.id) continue;
      messages.push({
        mid: msg.mid,
        senderPsid: event.sender.id,
        recipientId: event.recipient.id,
        text: msg.text,
      });
    }
  }
  return messages;
}
