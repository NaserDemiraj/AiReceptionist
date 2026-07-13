import type { NextRequest } from "next/server";
import type { ChannelIntegration } from "@prisma/client";
import { prisma } from "../prisma";
import { logger } from "../logger";
import { getBaseUrl } from "../base-url";
import { parseTwilioCredentials, verifyTwilioSignature, type TwilioCredentials } from "./twilio";

export interface TwilioWebhookContext {
  integration: ChannelIntegration;
  creds: TwilioCredentials;
  params: Record<string, string>;
}

/**
 * Loads the tenant integration, parses Twilio's form-encoded body, and
 * verifies X-Twilio-Signature against the public URL. Returns null when
 * anything fails — callers respond 403 without leaking which check failed.
 */
export async function readTwilioWebhook(
  req: NextRequest,
  integrationId: string,
  path: string,
): Promise<TwilioWebhookContext | null> {
  const integration = await prisma.channelIntegration.findFirst({
    where: { id: integrationId, channel: "SMS", status: { not: "DISCONNECTED" } },
  });
  const creds = parseTwilioCredentials(integration?.credentials);
  if (!integration || !creds) return null;

  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));

  const url = `${await getBaseUrl()}/api/v1/channels/twilio/${integrationId}/${path}`;
  const signature = req.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature(creds.authToken, url, params, signature)) {
    logger.warn({ integrationId, path }, "twilio signature mismatch");
    return null;
  }

  return { integration, creds, params };
}

/** Twilio sends caller IDs like "+355691234567"; store digits-only like WhatsApp does. */
export function normalizePhone(raw: string | undefined): string | null {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  return digits.length >= 7 ? digits : null;
}
