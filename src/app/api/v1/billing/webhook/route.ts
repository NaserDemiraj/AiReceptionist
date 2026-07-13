import { NextRequest, NextResponse } from "next/server";
import type { PlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { mapStripeStatus, verifyStripeSignature } from "@/lib/billing/stripe";

/**
 * POST /api/v1/billing/webhook — Stripe events.
 * Handles checkout completion and subscription lifecycle updates.
 * Configure in Stripe with events: checkout.session.completed,
 * customer.subscription.updated, customer.subscription.deleted.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new NextResponse("Not configured", { status: 503 });

  const rawBody = await req.text();
  if (!verifyStripeSignature(secret, rawBody, req.headers.get("stripe-signature"))) {
    logger.warn("stripe webhook signature mismatch");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          client_reference_id?: string;
          customer?: string;
          subscription?: string;
          metadata?: { orgId?: string; plan?: string; cycle?: string };
        };
        const orgId = session.metadata?.orgId ?? session.client_reference_id;
        if (!orgId) break;

        const plan = (session.metadata?.plan ?? "STARTER") as PlanTier;
        const cycle = session.metadata?.cycle === "yearly" ? "yearly" : "monthly";

        await prisma.subscription.upsert({
          where: { organizationId: orgId },
          create: {
            organizationId: orgId,
            plan,
            status: "ACTIVE",
            billingCycle: cycle,
            stripeCustomerId: session.customer ?? null,
            stripeSubscriptionId: session.subscription ?? null,
          },
          update: {
            plan,
            status: "ACTIVE",
            billingCycle: cycle,
            stripeCustomerId: session.customer ?? null,
            stripeSubscriptionId: session.subscription ?? null,
            trialEndsAt: null,
          },
        });
        await prisma.organization.update({ where: { id: orgId }, data: { planTier: plan } });
        logger.info({ orgId, plan, cycle }, "stripe checkout completed");
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as {
          id: string;
          status: string;
          current_period_end?: number;
          metadata?: { orgId?: string; plan?: string };
        };
        const existing = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
          select: { organizationId: true },
        });
        if (!existing) break;

        const status =
          event.type === "customer.subscription.deleted" ? "CANCELLED" : mapStripeStatus(sub.status);
        const plan = sub.metadata?.plan as PlanTier | undefined;

        await prisma.subscription.update({
          where: { organizationId: existing.organizationId },
          data: {
            status,
            ...(plan ? { plan } : {}),
            ...(sub.current_period_end
              ? { currentPeriodEnd: new Date(sub.current_period_end * 1000) }
              : {}),
          },
        });
        if (plan && status === "ACTIVE") {
          await prisma.organization.update({
            where: { id: existing.organizationId },
            data: { planTier: plan },
          });
        }
        logger.info({ orgId: existing.organizationId, status }, "stripe subscription updated");
        break;
      }

      default:
        break; // ignore everything else
    }
  } catch (err) {
    logger.error({ err, type: event.type }, "stripe webhook processing failed");
    // 500 → Stripe retries, which is what we want for transient DB errors
    return new NextResponse("Processing error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
