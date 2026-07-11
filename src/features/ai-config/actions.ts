"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/errors";

export type AiConfigFormState = { error?: string; success?: boolean } | undefined;

const personaSchema = z.object({
  assistantName: z.string().min(2, "Give your assistant a name").max(40),
  greeting: z.string().min(5, "Greeting is too short").max(300),
  tone: z.string().min(2).max(60),
  instructions: z.string().max(4000),
  temperature: z.coerce.number().min(0).max(1),
  isEnabled: z.coerce.boolean(),
  handoffEnabled: z.coerce.boolean(),
});

export async function updateAiConfig(
  _prev: AiConfigFormState,
  formData: FormData,
): Promise<AiConfigFormState> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can change AI settings");

  const parsed = personaSchema.safeParse({
    assistantName: formData.get("assistantName"),
    greeting: formData.get("greeting"),
    tone: formData.get("tone"),
    instructions: formData.get("instructions") ?? "",
    temperature: formData.get("temperature"),
    isEnabled: formData.get("isEnabled") === "on",
    handoffEnabled: formData.get("handoffEnabled") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  await prisma.$transaction([
    prisma.aiConfig.upsert({
      where: { organizationId: org.id },
      create: { organizationId: org.id, ...d, instructions: d.instructions || null },
      update: { ...d, instructions: d.instructions || null },
    }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "ai.config.update",
        entityType: "AiConfig",
      },
    }),
  ]);

  revalidatePath("/ai-config");
  return { success: true };
}

const automationSchema = z.object({
  remindersEnabled: z.coerce.boolean(),
  followUpsEnabled: z.coerce.boolean(),
  followUpAfterHours: z.coerce.number().int().min(1).max(168),
});

export async function updateAutomationSettings(
  _prev: AiConfigFormState,
  formData: FormData,
): Promise<AiConfigFormState> {
  const { org, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can change automation settings");

  const parsed = automationSchema.safeParse({
    remindersEnabled: formData.get("remindersEnabled") === "on",
    followUpsEnabled: formData.get("followUpsEnabled") === "on",
    followUpAfterHours: formData.get("followUpAfterHours"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.aiConfig.upsert({
    where: { organizationId: org.id },
    create: { organizationId: org.id, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/automation");
  return { success: true };
}
