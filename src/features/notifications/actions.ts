"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";

export async function markNotificationRead(formData: FormData): Promise<void> {
  const { org, user } = await requireOrg();
  const id = z.string().min(1).parse(formData.get("notificationId"));

  await prisma.notification.updateMany({
    where: {
      id,
      organizationId: org.id,
      OR: [{ userId: null }, { userId: user.id }],
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead(): Promise<void> {
  const { org, user } = await requireOrg();

  await prisma.notification.updateMany({
    where: {
      organizationId: org.id,
      OR: [{ userId: null }, { userId: user.id }],
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
