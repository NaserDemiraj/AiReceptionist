import { format } from "date-fns";
import { CreditCard } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Billing" };

const PLAN_META: Record<string, { label: string; price: string }> = {
  STARTER: { label: "Starter", price: "€49/mo" },
  PROFESSIONAL: { label: "Professional", price: "€99/mo" },
  BUSINESS: { label: "Business", price: "€199/mo" },
  ENTERPRISE: { label: "Enterprise", price: "Custom" },
};

export default async function BillingPage() {
  const { org } = await requireOrg();
  const sub = await prisma.subscription.findUnique({ where: { organizationId: org.id } });
  const plan = PLAN_META[sub?.plan ?? org.planTier] ?? PLAN_META.STARTER;

  return (
    <>
      <Topbar title="Billing" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <Card className="max-w-[560px] p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center">
              <CreditCard size={18} />
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-semibold">{plan.label} plan</div>
              <div className="text-[12.5px] text-ink-mid">{plan.price}</div>
            </div>
            {sub?.status === "TRIALING" ? (
              <Badge tone="warn">Free trial</Badge>
            ) : sub?.status === "ACTIVE" ? (
              <Badge tone="positive">Active</Badge>
            ) : (
              <Badge tone="neutral">{sub?.status ?? "—"}</Badge>
            )}
          </div>
          {sub?.status === "TRIALING" && sub.trialEndsAt && (
            <p className="text-[13px] text-ink-mid bg-warn-soft border border-warn/20 rounded-[10px] px-3.5 py-3">
              Your free trial ends on <strong>{format(sub.trialEndsAt, "MMMM d, yyyy")}</strong>.
              Payments via Stripe arrive in Milestone 4 — nothing is charged until then.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
