"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/errors";

const orgProfileSchema = z.object({
  name: z.string().min(2, "Business name is too short"),
  website: z.string().url("Enter a full URL, e.g. https://example.com").or(z.literal("")),
  phone: z.string().max(30),
  email: z.string().email("Enter a valid email").or(z.literal("")),
  address: z.string().max(200),
  timezone: z.string().min(1),
  currency: z.string().length(3),
});

export type SettingsFormState = { error?: string; success?: boolean } | undefined;

export async function updateOrgProfile(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can edit settings");

  const parsed = orgProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: org.id },
      data: {
        name: d.name,
        website: d.website || null,
        phone: d.phone || null,
        email: d.email || null,
        address: d.address || null,
        timezone: d.timezone,
        currency: d.currency.toUpperCase(),
      },
    }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "org.settings.update",
        entityType: "Organization",
        entityId: org.id,
      },
    }),
  ]);

  revalidatePath("/settings");
  return { success: true };
}
