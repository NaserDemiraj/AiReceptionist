import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlanTier, SubscriptionStatus } from "@prisma/client";
import { logger } from "../logger";

/**
 * Thin Stripe client (plain fetch, form-encoded — no SDK).
 * If STRIPE_SECRET_KEY is missing the app keeps working; billing UI
 * shows a "not configured" notice instead of checkout buttons.
 */

const API_BASE = "https://api.stripe.com/v1";

export type BillingCycle = "monthly" | "yearly";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Stripe Price IDs come from env, e.g. STRIPE_PRICE_PROFESSIONAL_MONTHLY.
 * ENTERPRISE is sales-led and has no self-serve price.
 */
export function getPriceId(plan: PlanTier, cycle: BillingCycle): string | null {
  return process.env[`STRIPE_PRICE_${plan}_${cycle.toUpperCase()}`] ?? null;
}

async function stripeRequest<T>(
  path: string,
  params: Record<string, string>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, error: "stripe_not_configured" };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });
    const data = (await res.json()) as T & { error?: { message?: string } };
    if (!res.ok) {
      logger.warn({ path, status: res.status, error: data.error?.message }, "stripe request failed");
      return { ok: false, error: data.error?.message ?? `stripe_${res.status}` };
    }
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, path }, "stripe request threw");
    return { ok: false, error: "network_error" };
  }
}

export interface CheckoutSession {
  id: string;
  url: string;
}

export async function createCheckoutSession(input: {
  orgId: string;
  plan: PlanTier;
  cycle: BillingCycle;
  priceId: string;
  customerEmail: string | null;
  existingCustomerId: string | null;
  successUrl: string;
  cancelUrl: string;
}) {
  const params: Record<string, string> = {
    mode: "subscription",
    client_reference_id: input.orgId,
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": "1",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "metadata[orgId]": input.orgId,
    "metadata[plan]": input.plan,
    "metadata[cycle]": input.cycle,
    "subscription_data[metadata][orgId]": input.orgId,
    "subscription_data[metadata][plan]": input.plan,
    "subscription_data[metadata][cycle]": input.cycle,
  };
  if (input.existingCustomerId) params.customer = input.existingCustomerId;
  else if (input.customerEmail) params.customer_email = input.customerEmail;

  return stripeRequest<CheckoutSession>("/checkout/sessions", params);
}

export async function createPortalSession(stripeCustomerId: string, returnUrl: string) {
  return stripeRequest<{ url: string }>("/billing_portal/sessions", {
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
}

/**
 * Verifies Stripe's `Stripe-Signature` header (t=...,v1=... format):
 * HMAC-SHA256 of "<timestamp>.<rawBody>" with the webhook signing secret.
 * Rejects stale timestamps to block replay attacks.
 */
export function verifyStripeSignature(
  signingSecret: string,
  rawBody: string,
  header: string | null,
  toleranceSeconds = 300,
  nowMs = Date.now(),
): boolean {
  if (!header) return false;
  const parts = new Map(
    header.split(",").map((p) => {
      const idx = p.indexOf("=");
      return [p.slice(0, idx).trim(), p.slice(idx + 1)] as const;
    }),
  );
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return false;

  const age = Math.abs(nowMs / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = createHmac("sha256", signingSecret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  if (signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/** Maps a Stripe subscription status string to our enum. */
export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    default:
      // canceled, incomplete, incomplete_expired, paused
      return "CANCELLED";
  }
}
