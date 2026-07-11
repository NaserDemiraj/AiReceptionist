import { format, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";

// Minimal EN/SQ/DE stopwords for the "common topics" keyword count
const STOPWORDS = new Set(
  (
    "the a an i you we it is are was do does to for of in on and or me my your this that " +
    "can have has how what much under over with need want looking hi hello hey please thanks " +
    "there about would like some any still just also very from be at as if not no yes ok okay " +
    "une unë për per një nje keni dua doja mund është eshte jam nga dhe ose si sa ju në ne te të " +
    "më më po jo faleminderit pershendetje përshëndetje diçka dicka a e i u o sugjero " +
    "der die das den dem ich sie und oder für fur ein eine einen mit ist sind kann haben wie " +
    "viel was zu im auf bitte hallo danke ja nein noch auch bei nach"
  ).split(/\s+/),
);

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
    csatUp,
    csatDown,
    missedOpportunities,
    customerMessages,
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
    prisma.conversation.count({
      where: { organizationId: orgId, createdAt: { gte: since }, csatRating: 1 },
    }),
    prisma.conversation.count({
      where: { organizationId: orgId, createdAt: { gte: since }, csatRating: -1 },
    }),
    // Conversations that never produced a lead = missed opportunities
    prisma.conversation.count({
      where: { organizationId: orgId, createdAt: { gte: since }, leads: { none: {} } },
    }),
    prisma.message.findMany({
      where: {
        role: "CUSTOMER",
        createdAt: { gte: since },
        conversation: { is: { organizationId: orgId } },
      },
      select: { content: true },
      take: 1000,
    }),
  ]);

  // Keyword frequency over customer messages → "most common topics"
  const wordCounts = new Map<string, number>();
  for (const m of customerMessages) {
    const seen = new Set<string>(); // count each word once per message
    for (const raw of m.content.toLowerCase().split(/[^\p{L}]+/u)) {
      if (raw.length < 3 || STOPWORDS.has(raw) || seen.has(raw)) continue;
      seen.add(raw);
      wordCounts.set(raw, (wordCounts.get(raw) ?? 0) + 1);
    }
  }
  const topTopics = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

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
      csat: csatUp + csatDown > 0 ? Math.round((csatUp / (csatUp + csatDown)) * 100) : null,
      csatResponses: csatUp + csatDown,
      missedOpportunities,
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
    topTopics,
  };
}
