"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { LeadStatus } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "VISIT_BOOKED", "WON", "LOST"] as const;

export async function setLeadStatus(formData: FormData): Promise<void> {
  const { org, user } = await requireOrg();
  const leadId = z.string().min(1).parse(formData.get("leadId"));
  const status = z.enum(STATUSES).parse(formData.get("status")) as LeadStatus;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: org.id },
    select: { id: true, status: true },
  });
  if (!lead) throw notFound("Lead not found");
  if (lead.status === status) return;

  await prisma.$transaction([
    prisma.lead.update({ where: { id: lead.id }, data: { status } }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "lead.status.change",
        entityType: "Lead",
        entityId: lead.id,
        metadata: { from: lead.status, to: status },
      },
    }),
  ]);

  revalidatePath("/leads");
  revalidatePath("/dashboard");
}
