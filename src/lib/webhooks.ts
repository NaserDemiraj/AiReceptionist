import { createHmac } from "node:crypto";
import { prisma } from "./prisma";
import { logger } from "./logger";

/**
 * Outbound webhooks — notify external systems (CRMs, Zapier, a CMS) when
 * something happens. Payloads are signed with each endpoint's secret via
 * `X-Webhook-Signature: sha256=<hmac>` so receivers can verify authenticity.
 *
 * Best-effort: a dead endpoint never blocks the caller.
 */

export type WebhookEvent =
  | "lead.created"
  | "appointment.created"
  | "appointment.cancelled"
  | "conversation.needs_human";

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  "lead.created",
  "appointment.created",
  "appointment.cancelled",
  "conversation.needs_human",
];

const TIMEOUT_MS = 4000;

export async function dispatchWebhooks(
  organizationId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId, isActive: true, events: { has: event } },
  });
  if (endpoints.length === 0) return;

  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data });

  await Promise.all(
    endpoints.map(async (endpoint) => {
      const signature = `sha256=${createHmac("sha256", endpoint.secret).update(body, "utf8").digest("hex")}`;
      let status: number | null = null;
      try {
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
            "X-Webhook-Event": event,
          },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        status = res.status;
      } catch (err) {
        logger.warn({ err, url: endpoint.url, event }, "webhook delivery failed");
      }
      await prisma.webhookEndpoint
        .update({
          where: { id: endpoint.id },
          data: { lastStatus: status, lastFiredAt: new Date() },
        })
        .catch(() => {});

      // Alert once per outage: previous delivery was fine, this one wasn't
      const failedNow = status === null || status >= 400;
      const wasHealthy = endpoint.lastStatus !== null && endpoint.lastStatus < 400;
      if (failedNow && wasHealthy) {
        await prisma.notification
          .create({
            data: {
              organizationId,
              type: "SYSTEM",
              title: "A webhook endpoint stopped responding",
              body: `${endpoint.url} returned ${status ?? "no response"} for ${event}. Check Integrations → Webhooks.`,
              payload: { endpointId: endpoint.id, event, status },
            },
          })
          .catch(() => {});
      }
    }),
  );
}
