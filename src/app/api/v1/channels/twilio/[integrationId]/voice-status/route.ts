import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { emptyTwiml, isMissedCall, sendSms } from "@/lib/channels/twilio";
import { normalizePhone, readTwilioWebhook } from "@/lib/channels/twilio-webhook";

const MISSED_CALL_TEMPLATES: Record<string, (orgName: string) => string> = {
  en: (org) =>
    `Hi! Sorry we missed your call at ${org}. How can we help? Reply here and we'll answer right away.`,
  sq: (org) =>
    `Përshëndetje! Na vjen keq që humbëm telefonatën tuaj te ${org}. Si mund t'ju ndihmojmë? Na përgjigjuni këtu dhe ju përgjigjemi menjëherë.`,
  de: (org) =>
    `Hallo! Leider haben wir Ihren Anruf bei ${org} verpasst. Wie können wir helfen? Antworten Sie hier — wir melden uns sofort.`,
};

/**
 * POST /api/v1/channels/twilio/[integrationId]/voice-status
 * Dial outcome callback. Unanswered/busy/failed calls trigger the
 * missed call recovery SMS; the AI then handles replies on the SMS channel.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await params;
  const ctx = await readTwilioWebhook(req, integrationId, "voice-status");
  if (!ctx) return new NextResponse("Forbidden", { status: 403 });

  const twimlResponse = new NextResponse(emptyTwiml(), {
    headers: { "Content-Type": "text/xml" },
  });

  if (!isMissedCall(ctx.params.DialCallStatus ?? null)) return twimlResponse;

  const phone = normalizePhone(ctx.params.From);
  const callSid = ctx.params.CallSid;
  if (!phone || !callSid) return twimlResponse; // anonymous caller — nothing to text

  const organizationId = ctx.integration.organizationId;

  try {
    // Twilio retries callbacks — one recovery SMS per call, ever.
    const already = await prisma.message.findFirst({
      where: {
        conversation: { organizationId },
        metadata: { path: ["callSid"], equals: callSid },
      },
      select: { id: true },
    });
    if (already) return twimlResponse;

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true, defaultLanguage: true },
    });
    const lang = org.defaultLanguage in MISSED_CALL_TEMPLATES ? org.defaultLanguage : "en";
    const greeting = MISSED_CALL_TEMPLATES[lang](org.name);

    let customer = await prisma.customer.findFirst({ where: { organizationId, phone } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { organizationId, phone, language: lang },
      });
    }

    let conversation = await prisma.conversation.findFirst({
      where: { organizationId, customerId: customer.id, channel: "SMS", status: { not: "RESOLVED" } },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organizationId,
          customerId: customer.id,
          channel: "SMS",
          status: "AI_ACTIVE",
          language: lang,
          subject: "Missed call recovery",
        },
        select: { id: true },
      });
    }

    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "SYSTEM",
          content: `Missed call from +${phone}`,
          metadata: { callSid },
        },
      }),
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "AI",
          content: greeting,
          metadata: { automation: "missed-call" },
        },
      }),
      prisma.notification.create({
        data: {
          organizationId,
          type: "URGENT",
          title: "Missed call — AI following up",
          body: `+${phone} called and nobody answered. Recovery SMS sent.`,
          payload: { conversationId: conversation.id },
        },
      }),
    ]);

    const result = await sendSms(ctx.creds, phone, greeting);
    await prisma.channelIntegration.update({
      where: { id: ctx.integration.id },
      data: result.ok
        ? { lastOutboundAt: new Date(), status: "CONNECTED", lastError: null }
        : { status: "ERROR", lastError: result.error ?? "send_failed" },
    });
  } catch (err) {
    logger.error({ err, integrationId, callSid }, "missed call recovery failed");
  }

  return twimlResponse;
}
