import type { Channel, PlanTier, Subscription, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../prisma";

/**
 * Plan limits and subscription access — the single source of truth the
 * AI engine, team invites, channel connects, and dashboard banner all use.
 *
 * Policy:
 * - An active trial gets BUSINESS limits (show the full product, then charge).
 * - PAST_DUE keeps access — Stripe retries cards for ~2 weeks and flips the
 *   subscription to canceled itself if they all fail.
 * - Expired trials and cancelled subscriptions block the AI; the dashboard
 *   stays viewable so the business can upgrade.
 */

export interface PlanLimits {
  /** null = unlimited */
  conversationsPerMonth: number | null;
  /** null = unlimited */
  teamMembers: number | null;
  /** External channels the plan may connect (WEB is always included) */
  channels: Channel[];
}

const ALL_CHANNELS: Channel[] = ["WEB", "WHATSAPP", "SMS", "PHONE", "FACEBOOK", "INSTAGRAM", "TELEGRAM"];

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  STARTER: { conversationsPerMonth: 500, teamMembers: 1, channels: ["WEB"] },
  PROFESSIONAL: { conversationsPerMonth: 2000, teamMembers: 5, channels: ["WEB", "WHATSAPP"] },
  BUSINESS: { conversationsPerMonth: null, teamMembers: null, channels: ALL_CHANNELS },
  ENTERPRISE: { conversationsPerMonth: null, teamMembers: null, channels: ALL_CHANNELS },
};

export type AccessBlockReason = "trial_expired" | "cancelled";

export interface SubscriptionAccess {
  active: boolean;
  reason?: AccessBlockReason;
  /** The tier whose limits apply right now (BUSINESS during an active trial) */
  planForLimits: PlanTier;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
}

/** Pure decision logic — exported for tests. */
export function computeAccess(
  sub: Pick<Subscription, "status" | "plan" | "trialEndsAt">,
  now = new Date(),
): SubscriptionAccess {
  const base = { status: sub.status, trialEndsAt: sub.trialEndsAt };

  switch (sub.status) {
    case "TRIALING": {
      const trialValid = sub.trialEndsAt !== null && sub.trialEndsAt.getTime() > now.getTime();
      return trialValid
        ? { ...base, active: true, planForLimits: "BUSINESS" }
        : { ...base, active: false, reason: "trial_expired", planForLimits: sub.plan };
    }
    case "ACTIVE":
    case "PAST_DUE":
      return { ...base, active: true, planForLimits: sub.plan };
    case "CANCELLED":
      return { ...base, active: false, reason: "cancelled", planForLimits: sub.plan };
  }
}

export function isChannelAllowed(plan: PlanTier, channel: Channel): boolean {
  return PLAN_LIMITS[plan].channels.includes(channel);
}

/** Loads (or self-heals) the org's subscription and computes access. */
export async function getSubscriptionAccess(orgId: string): Promise<SubscriptionAccess> {
  let sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
  if (!sub) {
    // Orgs created before subscriptions existed (e.g. seed data) get a fresh trial
    sub = await prisma.subscription.create({
      data: {
        organizationId: orgId,
        status: "TRIALING",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 3600_000),
      },
    });
  }
  return computeAccess(sub);
}

export async function getMonthlyConversationCount(orgId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return prisma.conversation.count({
    where: { organizationId: orgId, createdAt: { gte: monthStart } },
  });
}

export type AiBlockReason = "subscription_inactive" | "quota_exceeded";

/** The AI engine's gate: may this org's receptionist reply right now? */
export async function checkAiUsage(
  orgId: string,
): Promise<{ allowed: true } | { allowed: false; reason: AiBlockReason }> {
  const access = await getSubscriptionAccess(orgId);
  if (!access.active) return { allowed: false, reason: "subscription_inactive" };

  const limit = PLAN_LIMITS[access.planForLimits].conversationsPerMonth;
  if (limit !== null && (await getMonthlyConversationCount(orgId)) > limit) {
    return { allowed: false, reason: "quota_exceeded" };
  }
  return { allowed: true };
}
