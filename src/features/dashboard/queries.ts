import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { Organization } from "@prisma/client";
import type { SetupStep } from "./components/setup-checklist";

/** Computes onboarding progress for the dashboard checklist. */
export async function getSetupSteps(org: Organization): Promise<SetupStep[]> {
  const [productCount, knowledgeCount, conversationCount, config, site] = await Promise.all([
    prisma.product.count({ where: { organizationId: org.id } }),
    prisma.knowledgeSource.count({ where: { organizationId: org.id, status: "READY" } }),
    prisma.conversation.count({ where: { organizationId: org.id } }),
    prisma.aiConfig.findUnique({ where: { organizationId: org.id } }),
    prisma.website.findUnique({ where: { organizationId: org.id } }),
  ]);

  return [
    {
      key: "profile",
      label: "Complete your business profile",
      hint: "Address & phone — the AI uses these when talking to customers",
      href: "/settings",
      done: Boolean(org.phone && org.address),
    },
    {
      key: "products",
      label: "Add your products",
      hint: "One by one or import a CSV — the AI recommends only real products",
      href: productCount > 0 ? "/products" : "/products/import",
      done: productCount > 0,
    },
    {
      key: "knowledge",
      label: "Teach the AI your policies",
      hint: "Delivery, payment, warranty — so it answers from facts",
      href: "/knowledge",
      done: knowledgeCount > 0,
    },
    {
      key: "persona",
      label: "Customize your assistant",
      hint: "Name, greeting, tone and business instructions",
      href: "/ai-config",
      done: Boolean(config?.instructions),
    },
    {
      key: "widget",
      label: "Try your AI receptionist",
      hint: "Open the demo page and have your first conversation",
      href: "/demo?org=" + org.slug,
      done: conversationCount > 0,
    },
    {
      key: "website",
      label: "Publish your website (optional)",
      hint: "A free business site with the assistant built in",
      href: "/website",
      done: Boolean(site?.published),
    },
  ];
}

/** % change between two counts, clamped for display. */
function delta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export async function getDashboardData(orgId: string) {
  const now = new Date();
  const weekAgo = subDays(now, 7);
  const twoWeeksAgo = subDays(now, 14);

  const [
    convThis,
    convPrev,
    leadsThis,
    leadsPrev,
    apptsThis,
    apptsPrev,
    responseAgg,
    recentConversations,
    upcomingAppointments,
    recentLeads,
  ] = await Promise.all([
    prisma.conversation.count({
      where: { organizationId: orgId, createdAt: { gte: weekAgo } },
    }),
    prisma.conversation.count({
      where: { organizationId: orgId, createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
    }),
    prisma.lead.count({
      where: { organizationId: orgId, createdAt: { gte: weekAgo } },
    }),
    prisma.lead.count({
      where: { organizationId: orgId, createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
    }),
    prisma.appointment.count({
      where: { organizationId: orgId, createdAt: { gte: weekAgo } },
    }),
    prisma.appointment.count({
      where: { organizationId: orgId, createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
    }),
    prisma.conversation.aggregate({
      where: { organizationId: orgId, firstResponseMs: { not: null } },
      _avg: { firstResponseMs: true },
    }),
    prisma.conversation.findMany({
      where: { organizationId: orgId },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        customer: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.appointment.findMany({
      where: { organizationId: orgId, startsAt: { gte: now }, status: { not: "CANCELLED" } },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: { customer: true, staff: true },
    }),
    prisma.lead.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { customer: true },
    }),
  ]);

  return {
    kpis: {
      conversations: { value: convThis, delta: delta(convThis, convPrev) },
      leads: { value: leadsThis, delta: delta(leadsThis, leadsPrev) },
      appointments: { value: apptsThis, delta: delta(apptsThis, apptsPrev) },
      avgResponseSec: responseAgg._avg.firstResponseMs
        ? Math.round(responseAgg._avg.firstResponseMs / 100) / 10
        : null,
    },
    recentConversations,
    upcomingAppointments,
    recentLeads,
  };
}
