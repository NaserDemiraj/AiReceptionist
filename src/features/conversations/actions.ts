"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { deliverToChannel } from "@/lib/channels/deliver";

async function ownedConversation(conversationId: string) {
  const { org, user } = await requireOrg();
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId: org.id },
    select: { id: true, status: true },
  });
  if (!conversation) throw notFound("Conversation not found");
  return { org, user, conversation };
}

const replySchema = z.object({
  conversationId: z.string().min(1),
  text: z.string().min(1).max(4000),
});

export async function sendAgentReply(formData: FormData): Promise<void> {
  const { conversationId, text } = replySchema.parse({
    conversationId: formData.get("conversationId"),
    text: formData.get("text"),
  });
  const { user, conversation } = await ownedConversation(conversationId);

  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "AGENT",
        content: text.trim(),
        agentId: user.id,
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "HUMAN_ACTIVE" },
    }),
  ]);

  // Push the reply out to external channels (WhatsApp etc.); no-op for web.
  await deliverToChannel(conversation.id, text.trim());

  revalidatePath("/conversations");
}

export async function resolveConversation(formData: FormData): Promise<void> {
  const conversationId = z.string().min(1).parse(formData.get("conversationId"));
  const { conversation } = await ownedConversation(conversationId);

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { status: "RESOLVED", endedAt: new Date() },
  });
  revalidatePath("/conversations");
}

export async function returnToAi(formData: FormData): Promise<void> {
  const conversationId = z.string().min(1).parse(formData.get("conversationId"));
  const { conversation } = await ownedConversation(conversationId);

  await prisma.$transaction([
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "AI_ACTIVE", endedAt: null },
    }),
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "SYSTEM",
        content: "Conversation handed back to the AI",
      },
    }),
  ]);
  revalidatePath("/conversations");
}
