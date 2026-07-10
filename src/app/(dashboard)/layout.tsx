import { Sidebar } from "@/components/layout/sidebar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";

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
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
    </div>
  );
}
