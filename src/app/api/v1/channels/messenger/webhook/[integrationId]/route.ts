import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { processCustomerMessage } from "@/lib/ai/engine";
import { deliverToChannel } from "@/lib/channels/deliver";
import {
  extractMessengerMessages,
  parseMessengerCredentials,
  verifyWebhookSignature,
  type InboundMessengerMessage,
} from "@/lib/channels/messenger";
import type { Channel } from "@prisma/client";

// Webhook processing runs the LLM reply inside the request — give it room
export const maxDuration = 60;


/**
 * Messenger webhook, one URL per tenant + channel row:
 * /api/v1/channels/messenger/webhook/[integrationId]
 * Serves both FACEBOOK and INSTAGRAM integrations — Meta sends the same
 * payload shape for Page messages and Instagram DMs.
 */

async function loadIntegration(integrationId: string) {
  const integration = await prisma.channelIntegration.findFirst({
    where: {
      id: integrationId,
      channel: { in: ["FACEBOOK", "INSTAGRAM"] },
      status: { not: "DISCONNECTED" },
    },
  });
  if (!integration) return null;
  const creds = parseMessengerCredentials(integration.credentials);
  if (!creds) return null;
  return { integration, creds };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await params;
  const found = await loadIntegration(integrationId);
  if (!found) return new NextResponse("Not found", { status: 404 });

  const search = req.nextUrl.searchParams;
  if (
    search.get("hub.mode") === "subscribe" &&
    search.get("hub.verify_token") === found.creds.verifyToken &&
    search.get("hub.challenge")
  ) {
    logger.info({ integrationId }, "messenger webhook verified");
    return new NextResponse(search.get("hub.challenge"), { status: 200 });
  }
  return new NextResponse("Verification failed", { status: 403 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await params;
  const found = await loadIntegration(integrationId);
  if (!found) return new NextResponse("Not found", { status: 404 });
  const { integration, creds } = found;

  const rawBody = await req.text();
  if (!verifyWebhookSignature(creds.appSecret, rawBody, req.headers.get("x-hub-signature-256"))) {
    logger.warn({ integrationId }, "messenger webhook signature mismatch");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const inbound = extractMessengerMessages(payload);
  if (inbound.length > 0) {
    await prisma.channelIntegration.update({
      where: { id: integration.id },
      data: { lastInboundAt: new Date() },
    });
  }

  for (const msg of inbound) {
    try {
      await handleInbound(integration.organizationId, integration.channel, msg);
    } catch (err) {
      logger.error({ err, mid: msg.mid, integrationId }, "messenger inbound processing failed");
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleInbound(
  organizationId: string,
  channel: Channel,
  msg: InboundMessengerMessage,
) {
  const duplicate = await prisma.message.findFirst({
    where: {
      conversation: { organizationId },
      metadata: { path: ["mid"], equals: msg.mid },
    },
    select: { id: true },
  });
  if (duplicate) return;

  // Page-scoped IDs are stable per user+page; stored on the customer's
  // visitorId slot with a prefix so web visitor ids can't collide.
  const visitorId = `psid:${msg.senderPsid}`;
  let customer = await prisma.customer.findFirst({ where: { organizationId, visitorId } });
  if (!customer) {
    customer = await prisma.customer.create({ data: { organizationId, visitorId } });
  }

  let conversation = await prisma.conversation.findFirst({
    where: { organizationId, customerId: customer.id, channel, status: { not: "RESOLVED" } },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { organizationId, customerId: customer.id, channel, status: "AI_ACTIVE" },
      select: { id: true },
    });
  }

  const result = await processCustomerMessage(conversation.id, msg.text, {
    messageMetadata: { mid: msg.mid },
  });
  if (result.reply) {
    await deliverToChannel(conversation.id, result.reply);
  }
}
