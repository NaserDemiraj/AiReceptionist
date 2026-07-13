import { format } from "date-fns";
import { Check, CreditCard } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured, getPriceId } from "@/lib/billing/stripe";
import {
  getMonthlyConversationCount,
  getSubscriptionAccess,
  PLAN_LIMITS,
} from "@/lib/billing/plans";
import { openBillingPortal, startCheckout } from "@/features/billing/actions";

export const metadata = { title: "Billing" };

const PLANS = [
  {
    tier: "STARTER" as const,
    label: "Starter",
    monthly: 49,
    features: ["AI receptionist on your website", "500 conversations / month", "Lead capture & appointments", "1 team member"],
  },
  {
    tier: "PROFESSIONAL" as const,
    label: "Professional",
    monthly: 99,
    features: ["Everything in Starter", "WhatsApp channel", "2,000 conversations / month", "Automations & follow-ups", "5 team members"],
  },
  {
    tier: "BUSINESS" as const,
    label: "Business",
    monthly: 199,
    features: ["Everything in Professional", "All channels + missed call recovery", "Unlimited conversations", "REST API & webhooks", "Unlimited team members"],
  },
];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { org, role } = await requireOrg();
  const { checkout } = await searchParams;
  const sub = await prisma.subscription.findUnique({ where: { organizationId: org.id } });
  const currentPlan = sub?.plan ?? org.planTier;
  const stripeReady = isStripeConfigured();
  const canManage = role !== "AGENT";

  const access = await getSubscriptionAccess(org.id);
  const conversationLimit = PLAN_LIMITS[access.planForLimits].conversationsPerMonth;
  const conversationsUsed = await getMonthlyConversationCount(org.id);

  return (
    <>
      <Topbar title="Billing" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10 space-y-6">
        {checkout === "success" && (
          <p className="max-w-[860px] text-[13px] text-positive-strong bg-positive-soft border border-positive/20 rounded-[10px] px-3.5 py-3">
            Payment successful — your subscription is active. Welcome aboard!
          </p>
        )}
        {checkout === "cancelled" && (
          <p className="max-w-[860px] text-[13px] text-ink-mid bg-hover rounded-[10px] px-3.5 py-3">
            Checkout cancelled — no charge was made.
          </p>
        )}

        {/* Current subscription */}
        <Card className="max-w-[860px] p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center">
              <CreditCard size={18} />
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-semibold">
                {PLANS.find((p) => p.tier === currentPlan)?.label ?? "Enterprise"} plan
                <span className="text-ink-mid font-normal"> · {sub?.billingCycle ?? "monthly"}</span>
              </div>
              <div className="text-[12.5px] text-ink-mid">
                {sub?.status === "TRIALING" && sub.trialEndsAt
                  ? `Free trial until ${format(sub.trialEndsAt, "MMMM d, yyyy")}`
                  : sub?.currentPeriodEnd
                    ? `Renews ${format(sub.currentPeriodEnd, "MMMM d, yyyy")}`
                    : "No payment method on file"}
              </div>
            </div>
            {sub?.status === "TRIALING" ? (
              <Badge tone="warn">Free trial</Badge>
            ) : sub?.status === "ACTIVE" ? (
              <Badge tone="positive">Active</Badge>
            ) : sub?.status === "PAST_DUE" ? (
              <Badge tone="danger">Past due</Badge>
            ) : (
              <Badge tone="neutral">{sub?.status ?? "—"}</Badge>
            )}
            {canManage && sub?.stripeCustomerId && (
              <form action={openBillingPortal}>
                <Button type="submit" variant="secondary">Manage billing</Button>
              </form>
            )}
          </div>
          <p className="mt-4 pt-4 border-t border-line text-[12.5px] text-ink-mid">
            <strong className="text-ink">{conversationsUsed}</strong>
            {conversationLimit !== null ? ` / ${conversationLimit}` : ""} conversations used this
            month{conversationLimit === null ? " (unlimited)" : ""}.
          </p>
        </Card>

        {!stripeReady && (
          <p className="max-w-[860px] text-[13px] text-ink-mid bg-warn-soft border border-warn/20 rounded-[10px] px-3.5 py-3">
            Stripe isn&apos;t configured yet (missing <span className="font-mono text-[12px]">STRIPE_SECRET_KEY</span>).
            Plans are shown below — checkout activates once the keys are added.
          </p>
        )}

        {/* Plan cards */}
        <div className="max-w-[860px] grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.tier === currentPlan && sub?.status === "ACTIVE";
            const checkoutReady = stripeReady && Boolean(getPriceId(plan.tier, "monthly"));
            return (
              <Card key={plan.tier} className={`p-5 flex flex-col ${isCurrent ? "border-accent" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[14px] font-semibold">{plan.label}</div>
                  {isCurrent && <Badge tone="accent">Current</Badge>}
                </div>
                <div className="mb-4">
                  <span className="text-[26px] font-semibold tracking-tight">€{plan.monthly}</span>
                  <span className="text-[12.5px] text-ink-mid">/month</span>
                </div>
                <ul className="space-y-2 mb-5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2 text-[12.5px] text-ink-mid">
                      <Check size={14} className="text-positive-strong shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {canManage && !isCurrent && (
                  <div className="space-y-2">
                    <form action={startCheckout}>
                      <input type="hidden" name="plan" value={plan.tier} />
                      <input type="hidden" name="cycle" value="monthly" />
                      <Button type="submit" className="w-full" disabled={!checkoutReady}>
                        Choose {plan.label}
                      </Button>
                    </form>
                    <form action={startCheckout}>
                      <input type="hidden" name="plan" value={plan.tier} />
                      <input type="hidden" name="cycle" value="yearly" />
                      <Button type="submit" variant="ghost" className="w-full" disabled={!checkoutReady}>
                        Yearly — 2 months free
                      </Button>
                    </form>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <p className="max-w-[860px] text-[12.5px] text-ink-soft">
          Need white-label, agency accounts, or custom volume? <strong>Enterprise</strong> is
          sales-led — contact us and we&apos;ll tailor a plan.
        </p>
      </div>
    </>
  );
}
