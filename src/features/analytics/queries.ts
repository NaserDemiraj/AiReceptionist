import { format, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";

export interface DayPoint {
  label: string; // "Jul 5"
  value: number;
}

export async function getAnalytics(orgId: string, days: number) {
  const since = startOfDay(subDays(new Date(), days - 1));

  const [
    conversations,
    leadCount,
    apptCount,
    resolvedCount,
    responseAgg,
    channelGroups,
    leadGroups,
    topProductGroups,
    influencedAgg,
    wonAgg,
  ] = await Promise.all([
    prisma.conversation.findMany({
      where: { organizationId: orgId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.lead.count({ where: { organizationId: orgId, createdAt: { gte: since } } }),
    prisma.appointment.count({ where: { organizationId: orgId, createdAt: { gte: since } } }),
    prisma.conversation.count({
      where: { organizationId: orgId, createdAt: { gte: since }, status: "RESOLVED" },
    }),
    prisma.conversation.aggregate({
      where: { organizationId: orgId, createdAt: { gte: since }, firstResponseMs: { not: null } },
      _avg: { firstResponseMs: true },
    }),
    prisma.conversation.groupBy({
      by: ["channel"],
      where: { organizationId: orgId, createdAt: { gte: since } },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { organizationId: orgId, createdAt: { gte: since } },
      _count: true,
    }),
    prisma.leadProduct.groupBy({
      by: ["productId"],
      where: { lead: { is: { organizationId: orgId, createdAt: { gte: since } } } },
      _count: true,
      orderBy: { _count: { productId: "desc" } },
      take: 6,
    }),
    prisma.lead.aggregate({
      where: { organizationId: orgId, createdAt: { gte: since } },
      _sum: { estimatedValue: true },
    }),
    prisma.lead.aggregate({
      where: { organizationId: orgId, createdAt: { gte: since }, status: "WON" },
      _sum: { estimatedValue: true },
    }),
  ]);

  // Bucket conversations per day
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    buckets.set(format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd"), 0);
  }
  for (const c of conversations) {
    const key = format(c.createdAt, "yyyy-MM-dd");
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const byDay: DayPoint[] = [...buckets.entries()].map(([date, value]) => ({
    label: format(new Date(date), days > 31 ? "MMM d" : "EEE d"),
    value,
  }));

  const productNames = topProductGroups.length
    ? await prisma.product.findMany({
        where: { id: { in: topProductGroups.map((g) => g.productId) } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(productNames.map((p) => [p.id, p.name]));

  const totalConversations = conversations.length;

  return {
    kpis: {
      conversations: totalConversations,
      leads: leadCount,
      appointments: apptCount,
      conversionRate: totalConversations ? Math.round((leadCount / totalConversations) * 100) : 0,
      resolutionRate: totalConversations
        ? Math.round((resolvedCount / totalConversations) * 100)
        : 0,
      avgResponseSec: responseAgg._avg.firstResponseMs
        ? Math.round(responseAgg._avg.firstResponseMs / 100) / 10
        : null,
      revenueInfluenced: Number(influencedAgg._sum.estimatedValue ?? 0),
      revenueWon: Number(wonAgg._sum.estimatedValue ?? 0),
    },
    byDay,
    channels: channelGroups
      .map((g) => ({ label: g.channel, value: g._count }))
      .sort((a, b) => b.value - a.value),
    funnel: leadGroups.map((g) => ({ label: g.status, value: g._count })),
    topProducts: topProductGroups.map((g) => ({
      label: nameById.get(g.productId) ?? "Unknown",
      value: g._count,
    })),
  };
}
