import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";

/**
 * GDPR data access: exports everything stored about one customer as JSON.
 * Session-authenticated and org-scoped.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { org, user } = await requireOrg();
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: org.id },
    include: {
      conversations: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            select: { role: true, content: true, createdAt: true },
          },
        },
      },
      leads: { include: { products: { include: { product: { select: { name: true } } } } } },
      appointments: true,
      quotes: true,
    },
  });
  if (!customer) {
    return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  }

  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      action: "customer.gdpr.export",
      entityType: "Customer",
      entityId: customer.id,
    },
  });

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      organization: org.name,
      customer,
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="customer-${customer.id}.json"`,
      },
    },
  );
}
