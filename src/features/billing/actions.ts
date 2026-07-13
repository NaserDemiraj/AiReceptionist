"use server";

import { redirect } from "next/navigation";
import type { PlanTier } from "@prisma/client";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { forbidden, AppError } from "@/lib/errors";
import { getBaseUrl } from "@/lib/base-url";
import {
  createCheckoutSession,
  createPortalSession,
  getPriceId,
  type BillingCycle,
} from "@/lib/billing/stripe";

const checkoutSchema = z.object({
  plan: z.enum(["STARTER", "PROFESSIONAL", "BUSINESS"]),
  cycle: z.enum(["monthly", "yearly"]),
});

export async function startCheckout(formData: FormData): Promise<void> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can manage billing");

  const { plan, cycle } = checkoutSchema.parse({
    plan: formData.get("plan"),
    cycle: formData.get("cycle"),
  });

  const priceId = getPriceId(plan as PlanTier, cycle as BillingCycle);
  if (!priceId) throw new AppError("This plan is not configured for checkout yet.", 400, "plan_not_configured");

  const sub = await prisma.subscription.findUnique({ where: { organizationId: org.id } });
  const base = await getBaseUrl();

  const result = await createCheckoutSession({
    orgId: org.id,
    plan: plan as PlanTier,
    cycle: cycle as BillingCycle,
    priceId,
    customerEmail: org.email ?? user.email,
    existingCustomerId: sub?.stripeCustomerId ?? null,
    successUrl: `${base}/billing?checkout=success`,
    cancelUrl: `${base}/billing?checkout=cancelled`,
  });
  if (!result.ok) throw new AppError(`Could not start checkout: ${result.error}`, 502, "stripe_error");

  redirect(result.data.url);
}

export async function openBillingPortal(): Promise<void> {
  const { org, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can manage billing");

  const sub = await prisma.subscription.findUnique({ where: { organizationId: org.id } });
  if (!sub?.stripeCustomerId) throw new AppError("No billing account yet — subscribe first.", 400, "no_customer");

  const result = await createPortalSession(sub.stripeCustomerId, `${await getBaseUrl()}/billing`);
  if (!result.ok) throw new AppError(`Could not open billing portal: ${result.error}`, 502, "stripe_error");

  redirect(result.data.url);
}
