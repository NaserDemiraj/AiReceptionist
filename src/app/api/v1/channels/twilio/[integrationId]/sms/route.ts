import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { processCustomerMessage } from "@/lib/ai/engine";
import { deliverToChannel } from "@/lib/channels/deliver";
import { emptyTwiml } from "@/lib/channels/twilio";
import { normalizePhone, readTwilioWebhook } from "@/lib/channels/twilio-webhook";

// Webhook processing runs the LLM reply inside the request — give it room
export const maxDuration = 60;


/**
 * POST /api/v1/channels/twilio/[integrationId]/sms
 * Inbound SMS from a customer — the AI answers over SMS.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await params;
  const ctx = await readTwilioWebhook(req, integrationId, "sms");
  if (!ctx) return new NextResponse("Forbidden", { status: 403 });

  const twimlResponse = new NextResponse(emptyTwiml(), {
    headers: { "Content-Type": "text/xml" },
  });

  const phone = normalizePhone(ctx.params.From);
  const text = (ctx.params.Body ?? "").trim();
  const smsSid = ctx.params.MessageSid;
  if (!phone || !text || !smsSid) return twimlResponse;

  const organizationId = ctx.integration.organizationId;

  try {
    // Twilio retries on timeouts — never answer the same SMS twice.
    const duplicate = await prisma.message.findFirst({
      where: {
        conversation: { organizationId },
        metadata: { path: ["smsSid"], equals: smsSid },
      },
      select: { id: true },
    });
    if (duplicate) return twimlResponse;

    await prisma.channelIntegration.update({
      where: { id: ctx.integration.id },
      data: { lastInboundAt: new Date() },
    });

    let customer = await prisma.customer.findFirst({ where: { organizationId, phone } });
    if (!customer) {
      customer = await prisma.customer.create({ data: { organizationId, phone } });
    }

    let conversation = await prisma.conversation.findFirst({
      where: { organizationId, customerId: customer.id, channel: "SMS", status: { not: "RESOLVED" } },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { organizationId, customerId: customer.id, channel: "SMS", status: "AI_ACTIVE" },
        select: { id: true },
      });
    }

    const result = await processCustomerMessage(conversation.id, text, {
      messageMetadata: { smsSid },
    });
    if (result.reply) {
      await deliverToChannel(conversation.id, result.reply);
    }
  } catch (err) {
    logger.error({ err, integrationId, smsSid }, "sms inbound processing failed");
  }

  return twimlResponse;
}
