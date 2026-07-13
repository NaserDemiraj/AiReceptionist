import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { processCustomerMessage } from "@/lib/ai/engine";
import { deliverToChannel } from "@/lib/channels/deliver";
import {
  extractInboundMessages,
  parseWhatsAppCredentials,
  verifyWebhookSignature,
  type InboundWhatsAppMessage,
} from "@/lib/channels/whatsapp";

/**
 * WhatsApp Cloud API webhook, one URL per tenant:
 * /api/v1/channels/whatsapp/webhook/[integrationId]
 *
 * GET  — Meta's one-time subscription verification handshake.
 * POST — inbound customer messages (signature-verified, retry-safe).
 */

async function loadIntegration(integrationId: string) {
  const integration = await prisma.channelIntegration.findFirst({
    where: { id: integrationId, channel: "WHATSAPP", status: { not: "DISCONNECTED" } },
  });
  if (!integration) return null;
  const creds = parseWhatsAppCredentials(integration.credentials);
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
  const mode = search.get("hub.mode");
  const token = search.get("hub.verify_token");
  const challenge = search.get("hub.challenge");

  if (mode === "subscribe" && token === found.creds.verifyToken && challenge) {
    logger.info({ integrationId }, "whatsapp webhook verified");
    return new NextResponse(challenge, { status: 200 });
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
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(creds.appSecret, rawBody, signature)) {
    logger.warn({ integrationId }, "whatsapp webhook signature mismatch");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const inbound = extractInboundMessages(payload).filter(
    // Route only messages addressed to this tenant's business number
    (m) => m.phoneNumberId === creds.phoneNumberId,
  );

  if (inbound.length > 0) {
    await prisma.channelIntegration.update({
      where: { id: integration.id },
      data: { lastInboundAt: new Date() },
    });
  }

  // Process each message; one failure must not block the rest, and Meta
  // must always get a 200 or it retries the whole batch.
  for (const msg of inbound) {
    try {
      await handleInbound(integration.organizationId, msg);
    } catch (err) {
      logger.error({ err, wamid: msg.wamid, integrationId }, "whatsapp inbound processing failed");
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleInbound(organizationId: string, msg: InboundWhatsAppMessage) {
  // Meta retries webhooks on timeouts — never answer the same message twice.
  const duplicate = await prisma.message.findFirst({
    where: {
      conversation: { organizationId },
      metadata: { path: ["wamid"], equals: msg.wamid },
    },
    select: { id: true },
  });
  if (duplicate) return;

  let customer = await prisma.customer.findFirst({
    where: { organizationId, phone: msg.from },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: { organizationId, phone: msg.from, name: msg.profileName },
    });
  } else if (!customer.name && msg.profileName) {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: { name: msg.profileName },
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      organizationId,
      customerId: customer.id,
      channel: "WHATSAPP",
      status: { not: "RESOLVED" },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        organizationId,
        customerId: customer.id,
        channel: "WHATSAPP",
        status: "AI_ACTIVE",
      },
      select: { id: true },
    });
  }

  const result = await processCustomerMessage(conversation.id, msg.text, {
    messageMetadata: { wamid: msg.wamid },
  });

  // reply is null when a human has taken over or the AI is disabled —
  // the agent's reply gets delivered by sendAgentReply instead.
  if (result.reply) {
    await deliverToChannel(conversation.id, result.reply);
  }
}
