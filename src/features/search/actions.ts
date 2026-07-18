"use server";

import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";

export interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchGroup {
  label: string;
  items: SearchItem[];
}

export async function globalSearch(query: string): Promise<SearchGroup[]> {
  const { org, user, role } = await requireOrg();
  const q = query.trim();
  if (q.length < 2) return [];

  const contains = { contains: q, mode: "insensitive" as const };
  // Same visibility rule as the conversations page: agents only see
  // unassigned conversations and their own
  const conversationVisibility =
    role === "AGENT" ? { OR: [{ assignedToId: null }, { assignedToId: user.id }] } : {};

  const [customers, leads, products, conversations, quotes] = await Promise.all([
    prisma.customer.findMany({
      where: {
        organizationId: org.id,
        OR: [{ name: contains }, { email: contains }, { phone: { contains: q } }],
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.lead.findMany({
      where: {
        organizationId: org.id,
        OR: [{ interestedIn: contains }, { customer: { is: { name: contains } } }],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    }),
    prisma.product.findMany({
      where: { organizationId: org.id, OR: [{ name: contains }, { sku: contains }] },
      take: 5,
      orderBy: { name: "asc" },
    }),
    prisma.conversation.findMany({
      where: {
        organizationId: org.id,
        AND: [
          conversationVisibility,
          {
            OR: [
              { subject: contains },
              { customer: { is: { name: contains } } },
              // Full-text over the transcript (GIN trigram index on content)
              { messages: { some: { content: contains } } },
            ],
          },
        ],
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
      include: {
        customer: true,
        // The matching line, as the result's snippet
        messages: { where: { content: contains }, take: 1, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.quote.findMany({
      where: {
        organizationId: org.id,
        OR: [{ number: contains }, { customer: { is: { name: contains } } }],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    }),
  ]);

  const groups: SearchGroup[] = [
    {
      label: "Customers",
      items: customers.map((c) => ({
        id: c.id,
        title: c.name ?? "Web visitor",
        subtitle: c.phone ?? c.email ?? "",
        href: `/customers?q=${encodeURIComponent(c.name ?? "")}`,
      })),
    },
    {
      label: "Conversations",
      items: conversations.map((c) => ({
        id: c.id,
        title: c.customer.name ?? "Web visitor",
        subtitle: c.messages[0]?.content.slice(0, 80) ?? c.subject ?? "",
        href: `/conversations?c=${c.id}`,
      })),
    },
    {
      label: "Leads",
      items: leads.map((l) => ({
        id: l.id,
        title: l.customer.name ?? "Unknown",
        subtitle: l.interestedIn ?? "",
        href: "/leads",
      })),
    },
    {
      label: "Products",
      items: products.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: `€${Number(p.salePrice ?? p.price)} · stock ${p.stock}`,
        href: `/products/${p.id}/edit`,
      })),
    },
    {
      label: "Quotes",
      items: quotes.map((qt) => ({
        id: qt.id,
        title: qt.number,
        subtitle: qt.customer.name ?? "",
        href: "/quotes",
      })),
    },
  ];

  return groups.filter((g) => g.items.length > 0);
}
