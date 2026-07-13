import { describe, expect, it } from "vitest";
import { computeAccess, isChannelAllowed, PLAN_LIMITS } from "./plans";

const NOW = new Date("2026-07-13T12:00:00Z");
const FUTURE = new Date("2026-07-20T12:00:00Z");
const PAST = new Date("2026-07-01T12:00:00Z");

describe("computeAccess", () => {
  it("allows an active trial with full (BUSINESS) limits", () => {
    const access = computeAccess({ status: "TRIALING", plan: "STARTER", trialEndsAt: FUTURE }, NOW);
    expect(access.active).toBe(true);
    expect(access.planForLimits).toBe("BUSINESS");
  });

  it("blocks an expired trial", () => {
    const access = computeAccess({ status: "TRIALING", plan: "STARTER", trialEndsAt: PAST }, NOW);
    expect(access.active).toBe(false);
    expect(access.reason).toBe("trial_expired");
  });

  it("blocks a trial with no end date", () => {
    const access = computeAccess({ status: "TRIALING", plan: "STARTER", trialEndsAt: null }, NOW);
    expect(access.active).toBe(false);
  });

  it("allows active subscriptions with their own plan's limits", () => {
    const access = computeAccess({ status: "ACTIVE", plan: "PROFESSIONAL", trialEndsAt: null }, NOW);
    expect(access.active).toBe(true);
    expect(access.planForLimits).toBe("PROFESSIONAL");
  });

  it("keeps PAST_DUE active (Stripe is still retrying the card)", () => {
    expect(computeAccess({ status: "PAST_DUE", plan: "STARTER", trialEndsAt: null }, NOW).active).toBe(true);
  });

  it("blocks cancelled subscriptions", () => {
    const access = computeAccess({ status: "CANCELLED", plan: "BUSINESS", trialEndsAt: null }, NOW);
    expect(access.active).toBe(false);
    expect(access.reason).toBe("cancelled");
  });
});

describe("plan limits", () => {
  it("gates channels by tier", () => {
    expect(isChannelAllowed("STARTER", "WHATSAPP")).toBe(false);
    expect(isChannelAllowed("PROFESSIONAL", "WHATSAPP")).toBe(true);
    expect(isChannelAllowed("PROFESSIONAL", "SMS")).toBe(false);
    expect(isChannelAllowed("BUSINESS", "SMS")).toBe(true);
    expect(isChannelAllowed("BUSINESS", "INSTAGRAM")).toBe(true);
  });

  it("web chat is included in every plan", () => {
    for (const plan of ["STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"] as const) {
      expect(isChannelAllowed(plan, "WEB")).toBe(true);
    }
  });

  it("matches the advertised quotas", () => {
    expect(PLAN_LIMITS.STARTER.conversationsPerMonth).toBe(500);
    expect(PLAN_LIMITS.PROFESSIONAL.conversationsPerMonth).toBe(2000);
    expect(PLAN_LIMITS.BUSINESS.conversationsPerMonth).toBeNull();
    expect(PLAN_LIMITS.STARTER.teamMembers).toBe(1);
    expect(PLAN_LIMITS.PROFESSIONAL.teamMembers).toBe(5);
  });
});
