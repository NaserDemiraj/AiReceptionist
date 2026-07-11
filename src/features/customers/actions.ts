"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound } from "@/lib/errors";

/**
 * GDPR erasure: deletes the customer and everything attached to them
 * (conversations, messages, leads, appointments, quotes) via FK cascades.
 */
export async function deleteCustomer(formData: FormData): Promise<void> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can delete customer data");

  const id = z.string().min(1).parse(formData.get("customerId"));
  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true, name: true, email: true },
  });
  if (!customer) throw notFound("Customer not found");

  await prisma.$transaction([
    prisma.customer.delete({ where: { id: customer.id } }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "customer.gdpr.delete",
        entityType: "Customer",
        entityId: customer.id,
        metadata: { name: customer.name, email: customer.email },
      },
    }),
  ]);

  revalidatePath("/customers");
}
