import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";

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
