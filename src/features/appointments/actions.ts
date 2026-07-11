"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AppointmentStatus } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";

const STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

export async function setAppointmentStatus(formData: FormData): Promise<void> {
  const { org, user } = await requireOrg();
  const id = z.string().min(1).parse(formData.get("appointmentId"));
  const status = z.enum(STATUSES).parse(formData.get("status")) as AppointmentStatus;

  const appointment = await prisma.appointment.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true, status: true },
  });
  if (!appointment) throw notFound("Appointment not found");
  if (appointment.status === status) return;

  await prisma.$transaction([
    prisma.appointment.update({ where: { id: appointment.id }, data: { status } }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "appointment.status.change",
        entityType: "Appointment",
        entityId: appointment.id,
        metadata: { from: appointment.status, to: status },
      },
    }),
  ]);

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}
