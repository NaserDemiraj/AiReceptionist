import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { forwardCallTwiml } from "@/lib/channels/twilio";
import { readTwilioWebhook } from "@/lib/channels/twilio-webhook";

/**
 * POST /api/v1/channels/twilio/[integrationId]/voice
 * Twilio hits this when someone calls the business's Twilio number.
 * We forward the call to their real phone; the dial outcome is reported
 * to /voice-status, which triggers missed call recovery.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await params;
  const ctx = await readTwilioWebhook(req, integrationId, "voice");
  if (!ctx) return new NextResponse("Forbidden", { status: 403 });

  const actionUrl = `${await getBaseUrl()}/api/v1/channels/twilio/${integrationId}/voice-status`;
  return new NextResponse(forwardCallTwiml(ctx.creds.forwardTo, actionUrl), {
    headers: { "Content-Type": "text/xml" },
  });
}
