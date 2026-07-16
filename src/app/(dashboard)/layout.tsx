import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { VerifyEmailBanner } from "@/features/settings/components/verify-email-banner";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import {
  getMonthlyConversationCount,
  getSubscriptionAccess,
  PLAN_LIMITS,
} from "@/lib/billing/plans";

const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter plan",
  PROFESSIONAL: "Professional plan",
  BUSINESS: "Business plan",
  ENTERPRISE: "Enterprise plan",
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  AGENT: "Agent",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org, user, role } = await requireOrg();
  const access = await getSubscriptionAccess(org.id);

  // Plan banner: blocked subscription (red) or exhausted quota (amber)
  let banner: { text: string; tone: "danger" | "warn" } | null = null;
  if (!access.active) {
    banner = {
      tone: "danger",
      text:
        access.reason === "trial_expired"
          ? "Your free trial has ended — the AI receptionist is paused and customers aren't getting replies."
          : "Your subscription is cancelled — the AI receptionist is paused.",
    };
  } else {
    const limit = PLAN_LIMITS[access.planForLimits].conversationsPerMonth;
    if (limit !== null) {
      const used = await getMonthlyConversationCount(org.id);
      if (used > limit) {
        banner = {
          tone: "warn",
          text: `You've used all ${limit} conversations in your plan this month — the AI is paused until it resets.`,
        };
      }
    }
  }

  const [conversations, leads, appointments, notifications] = await Promise.all([
    prisma.conversation.count({
      where: { organizationId: org.id, status: { in: ["AI_ACTIVE", "NEEDS_HUMAN", "HUMAN_ACTIVE"] } },
    }),
    prisma.lead.count({ where: { organizationId: org.id, status: "NEW" } }),
    prisma.appointment.count({ where: { organizationId: org.id, status: "PENDING" } }),
    prisma.notification.count({
      where: { organizationId: org.id, readAt: null, OR: [{ userId: null }, { userId: user.id }] },
    }),
  ]);

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <Sidebar
        orgName={org.name}
        planLabel={PLAN_LABELS[org.planTier] ?? org.planTier}
        industry={org.industry}
        userName={user.name}
        roleLabel={ROLE_LABELS[role] ?? role}
        counts={{ conversations, leads, appointments, notifications }}
      />
      <main className="flex-1 min-w-0 flex flex-col">
        {banner && (
          <div
            className={`px-[26px] py-2.5 text-[13px] font-medium flex items-center gap-3 ${
              banner.tone === "danger" ? "bg-danger text-white" : "bg-warn-soft text-warn"
            }`}
          >
            <span className="flex-1">{banner.text}</span>
            <Link
              href="/billing"
              className={`shrink-0 font-semibold underline underline-offset-2 ${
                banner.tone === "danger" ? "text-white" : "text-warn"
              }`}
            >
              {role === "AGENT" ? "See plans" : "Upgrade now"}
            </Link>
          </div>
        )}
        {!user.emailVerifiedAt && <VerifyEmailBanner email={user.email} />}
        {children}
      </main>
    </div>
  );
}
