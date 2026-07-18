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

export async function rotateWidgetKey(): Promise<void> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can rotate the widget key");

  const { randomUUID } = await import("node:crypto");
  const newKey = `wk_${randomUUID().replace(/-/g, "")}`;

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: org.id },
      data: { widgetKey: newKey },
    }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "widget.key.rotate",
        entityType: "Organization",
        entityId: org.id,
      },
    }),
  ]);

  revalidatePath("/settings");
}

const widgetSchema = z.object({
  widgetColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid color"),
  widgetPosition: z.enum(["right", "left"]),
  showBranding: z.boolean(),
});

export async function updateWidgetSettings(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const { org, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can edit widget settings");

  const parsed = widgetSchema.safeParse({
    widgetColor: formData.get("widgetColor"),
    widgetPosition: formData.get("widgetPosition"),
    showBranding: formData.get("showBranding") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.aiConfig.upsert({
    where: { organizationId: org.id },
    create: { organizationId: org.id, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/settings");
  return { success: true };
}

/* ---------- Danger zone: delete the organization ---------- */

export async function deleteOrganization(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const { org, user, role } = await requireOrg();
  if (role !== "OWNER") throw forbidden("Only the owner can delete the organization");

  const confirmName = String(formData.get("confirmName") ?? "").trim();
  if (confirmName !== org.name) {
    return { error: `Type the business name exactly ("${org.name}") to confirm.` };
  }

  const { compare } = await import("bcryptjs");
  const password = String(formData.get("password") ?? "");
  if (!(await compare(password, user.passwordHash))) {
    return { error: "Wrong password." };
  }

  const { logger } = await import("@/lib/logger");
  logger.warn({ orgId: org.id, slug: org.slug, by: user.email }, "organization deleted by owner");

  // Cascades: memberships, customers, conversations, messages, leads,
  // products, appointments, quotes, knowledge, integrations, webhooks, …
  await prisma.organization.delete({ where: { id: org.id } });

  const { signOut } = await import("@/lib/auth");
  const { redirect } = await import("next/navigation");
  await signOut({ redirect: false });
  redirect("/login");
}
