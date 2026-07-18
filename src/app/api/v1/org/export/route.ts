import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/errors";
import { errorResponse } from "@/lib/errors";

/**
 * GET /api/v1/org/export — full organization data as a JSON download.
 * GDPR data portability. Owners only. Secrets (channel credentials,
 * API key hashes, webhook secrets, embeddings) are excluded by design.
 */
export async function GET() {
  try {
    const { org, role, user } = await requireOrg();
    if (role !== "OWNER") throw forbidden("Only the owner can export organization data");

    const [
      customers,
      conversations,
      leads,
      products,
      categories,
      appointments,
      quotes,
      knowledgeSources,
      aiConfig,
      subscription,
      memberships,
      website,
      integrations,
    ] = await Promise.all([
      prisma.customer.findMany({ where: { organizationId: org.id } }),
      prisma.conversation.findMany({
        where: { organizationId: org.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      }),
      prisma.lead.findMany({ where: { organizationId: org.id }, include: { products: true } }),
      prisma.product.findMany({ where: { organizationId: org.id } }),
      prisma.productCategory.findMany({ where: { organizationId: org.id } }),
      prisma.appointment.findMany({ where: { organizationId: org.id } }),
      prisma.quote.findMany({ where: { organizationId: org.id } }),
      prisma.knowledgeSource.findMany({
        where: { organizationId: org.id },
        include: { chunks: { select: { heading: true, content: true, position: true } } },
      }),
      prisma.aiConfig.findUnique({ where: { organizationId: org.id } }),
      prisma.subscription.findUnique({ where: { organizationId: org.id } }),
      prisma.membership.findMany({
        where: { organizationId: org.id },
        select: { role: true, createdAt: true, user: { select: { name: true, email: true } } },
      }),
      prisma.website.findUnique({ where: { organizationId: org.id } }),
      prisma.channelIntegration.findMany({
        where: { organizationId: org.id },
        select: { channel: true, status: true, externalId: true, createdAt: true },
      }),
    ]);

    const body = {
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      organization: org,
      subscription,
      aiConfig,
      members: memberships,
      customers,
      conversations,
      leads,
      products,
      categories,
      appointments,
      quotes,
      knowledgeSources,
      website,
      channelIntegrations: integrations,
    };

    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${org.slug}-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
