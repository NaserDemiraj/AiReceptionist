import type { Channel } from "@prisma/client";
import { prisma } from "../prisma";
import { logger } from "../logger";
import { parseWhatsAppCredentials, sendWhatsAppText } from "./whatsapp";
import { parseTwilioCredentials, sendSms } from "./twilio";
import { parseMessengerCredentials, sendMessengerText } from "./messenger";

/** Channels that deliver through a ChannelIntegration row. */
const EXTERNAL_CHANNELS: Channel[] = ["WHATSAPP", "SMS", "FACEBOOK", "INSTAGRAM"];

/**
 * Delivers an outbound message (AI reply, agent reply, automation) to the
 * customer's external channel. WEB conversations are a no-op — the widget
 * polls for new messages itself.
 *
 * Best-effort by design: a channel outage must never fail the caller, so
 * errors are logged and recorded on the integration instead of thrown.
 */
export async function deliverToChannel(conversationId: string, text: string): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      channel: true,
      organizationId: true,
      customer: { select: { phone: true, visitorId: true } },
    },
  });
  if (!conversation || !EXTERNAL_CHANNELS.includes(conversation.channel)) return;

  const integration = await prisma.channelIntegration.findUnique({
    where: {
      organizationId_channel: {
        organizationId: conversation.organizationId,
        channel: conversation.channel,
      },
    },
  });
  if (!integration || integration.status === "DISCONNECTED") return;

  const result = await send(conversation, integration.credentials);
  if (result === null) return; // missing recipient/credentials — already logged

  await prisma.channelIntegration.update({
    where: { id: integration.id },
    data: result.ok
      ? { lastOutboundAt: new Date(), status: "CONNECTED", lastError: null }
      : { status: "ERROR", lastError: result.error ?? "send_failed" },
  });

  async function send(
    conv: NonNullable<typeof conversation>,
    credentials: unknown,
  ): Promise<{ ok: boolean; error?: string } | null> {
    switch (conv.channel) {
      case "WHATSAPP": {
        const creds = parseWhatsAppCredentials(credentials);
        if (!creds || !conv.customer.phone) return warnSkip("whatsapp");
        return sendWhatsAppText(creds, conv.customer.phone, text);
      }
      case "SMS": {
        const creds = parseTwilioCredentials(credentials);
        if (!creds || !conv.customer.phone) return warnSkip("sms");
        return sendSms(creds, conv.customer.phone, text);
      }
      case "FACEBOOK":
      case "INSTAGRAM": {
        const creds = parseMessengerCredentials(credentials);
        const psid = conv.customer.visitorId?.startsWith("psid:")
          ? conv.customer.visitorId.slice("psid:".length)
          : null;
        if (!creds || !psid) return warnSkip("messenger");
        return sendMessengerText(creds, psid, text);
      }
      default:
        return null;
    }
  }

  function warnSkip(channel: string): null {
    logger.warn({ conversationId, channel }, "outbound delivery skipped (missing recipient or credentials)");
    return null;
  }
}
