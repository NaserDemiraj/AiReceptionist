import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { logger } from "../logger";

/**
 * Twilio client for the phone/SMS channel (plain fetch).
 * Powers missed call recovery: the Twilio number forwards to the business's
 * real phone; unanswered calls trigger an instant SMS the AI continues.
 */

export const twilioCredentialsSchema = z.object({
  accountSid: z.string().regex(/^AC[a-zA-Z0-9]{32}$/, "Account SID starts with AC…"),
  authToken: z.string().min(20),
  /** The Twilio phone number, E.164 (e.g. +35569000000) */
  phoneNumber: z.string().regex(/^\+\d{7,15}$/),
  /** The business's real phone that calls are forwarded to, E.164 */
  forwardTo: z.string().regex(/^\+\d{7,15}$/),
});

export type TwilioCredentials = z.infer<typeof twilioCredentialsSchema>;

export function parseTwilioCredentials(json: unknown): TwilioCredentials | null {
  const parsed = twilioCredentialsSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export interface TwilioSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendSms(
  creds: TwilioCredentials,
  to: string,
  body: string,
): Promise<TwilioSendResult> {
  const toE164 = to.startsWith("+") ? to : `+${to.replace(/[^\d]/g, "")}`;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          From: creds.phoneNumber,
          To: toE164,
          Body: body.slice(0, 1600), // Twilio splits long SMS; hard cap regardless
        }).toString(),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn({ status: res.status, body: text.slice(0, 300), to: toE164 }, "twilio sms failed");
      return { ok: false, error: `twilio_${res.status}` };
    }
    const data = (await res.json()) as { sid?: string };
    return { ok: true, messageId: data.sid };
  } catch (err) {
    logger.error({ err, to: toE164 }, "twilio sms threw");
    return { ok: false, error: "network_error" };
  }
}

/**
 * Verifies Twilio's `X-Twilio-Signature`: base64 HMAC-SHA1 of the full
 * request URL followed by each POST param's key+value, keys sorted.
 */
export function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  const received = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(expected);
  if (received.length !== expectedBuf.length) return false;
  try {
    return timingSafeEqual(received, expectedBuf);
  } catch {
    return false;
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** TwiML: forward the call to the business's phone; report the outcome to `actionUrl`. */
export function forwardCallTwiml(forwardTo: string, actionUrl: string, timeoutSeconds = 20): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial action="${escapeXml(actionUrl)}" timeout="${timeoutSeconds}">${escapeXml(forwardTo)}</Dial></Response>`;
}

/** TwiML: empty response (acknowledge without further instructions). */
export function emptyTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
}

/** Dial outcomes that count as a missed call worth recovering. */
export function isMissedCall(dialCallStatus: string | null): boolean {
  return dialCallStatus === "no-answer" || dialCallStatus === "busy" || dialCallStatus === "failed";
}
