"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound } from "@/lib/errors";
import { deliverToChannel } from "@/lib/channels/deliver";
import { MESSAGES_PAGE_SIZE, type TranscriptMessage } from "./transcript";

async function ownedConversation(conversationId: string) {
  const { org, user, role } = await requireOrg();
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId: org.id },
    select: { id: true, status: true, assignedToId: true },
  });
  if (!conversation) throw notFound("Conversation not found");
  // Agents may only act on their own or unassigned conversations
  if (
    role === "AGENT" &&
    conversation.assignedToId !== null &&
    conversation.assignedToId !== user.id
  ) {
    throw notFound("Conversation not found");
  }
  return { org, user, role, conversation };
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
      data: {
        status: "HUMAN_ACTIVE",
        // Replying claims the conversation if nobody owns it yet
        ...(conversation.assignedToId === null ? { assignedToId: user.id } : {}),
      },
    }),
  ]);

  // Push the reply out to external channels (WhatsApp etc.); no-op for web.
  await deliverToChannel(conversation.id, text.trim());

  revalidatePath("/conversations");
}

/**
 * Fetches the page of messages *before* the given cursor message — the
 * transcript pane renders only the latest page and pulls history on demand.
 */
export async function loadEarlierMessages(
  conversationId: string,
  beforeMessageId: string,
): Promise<{ messages: TranscriptMessage[]; hasMore: boolean }> {
  const { conversation } = await ownedConversation(conversationId);

  const rows = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    cursor: { id: beforeMessageId },
    skip: 1,
    take: MESSAGES_PAGE_SIZE + 1, // one extra to know if more remain
    include: { agent: { select: { name: true } } },
  });

  const hasMore = rows.length > MESSAGES_PAGE_SIZE;
  const page = rows.slice(0, MESSAGES_PAGE_SIZE);
  return {
    hasMore,
    // Rows come newest-first; the transcript wants oldest-first
    messages: page.reverse().map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      agentName: m.agent?.name ?? null,
      metadata: m.metadata,
    })),
  };
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

const assignSchema = z.object({
  conversationId: z.string().min(1),
  // Empty string = unassign
  memberId: z.string(),
});

/** Assign a conversation to a team member. Agents may only claim for
 *  themselves; owners/admins can assign anyone (or unassign). */
export async function assignConversation(formData: FormData): Promise<void> {
  const { conversationId, memberId } = assignSchema.parse({
    conversationId: formData.get("conversationId"),
    memberId: formData.get("memberId") ?? "",
  });
  const { org, user, role, conversation } = await ownedConversation(conversationId);

  const targetId = memberId || null;
  if (role === "AGENT" && targetId !== user.id) {
    throw forbidden("Agents can only assign conversations to themselves");
  }
  if (targetId) {
    const member = await prisma.membership.findFirst({
      where: { organizationId: org.id, userId: targetId },
      select: { userId: true },
    });
    if (!member) throw notFound("That person isn't a member of this workspace");
  }

  await prisma.$transaction([
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { assignedToId: targetId },
    }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: targetId ? "conversation.assign" : "conversation.unassign",
        entityType: "Conversation",
        entityId: conversation.id,
        metadata: targetId ? { assignedToId: targetId } : undefined,
      },
    }),
  ]);
  revalidatePath("/conversations");
}

/**
 * Bulk resolve / bulk assign from the list pane checkboxes.
 * RBAC is enforced in the updateMany WHERE clause: agents can only touch
 * unassigned conversations or their own, and can only assign to themselves.
 */
export async function bulkConversations(formData: FormData): Promise<void> {
  const ids = formData
    .getAll("ids")
    .map(String)
    .filter(Boolean)
    .slice(0, 100);
  if (ids.length === 0) return;

  const action = z.enum(["resolve", "assign"]).parse(formData.get("bulkAction"));
  const { org, user, role } = await requireOrg();

  const visibility =
    role === "AGENT" ? { OR: [{ assignedToId: null }, { assignedToId: user.id }] } : {};
  const scope = { id: { in: ids }, organizationId: org.id, ...visibility };

  if (action === "resolve") {
    const result = await prisma.conversation.updateMany({
      where: scope,
      data: { status: "RESOLVED" as const, endedAt: new Date() },
    });
    if (result.count > 0) {
      await prisma.auditLog.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          action: "conversation.bulk_resolve",
          entityType: "Conversation",
          metadata: { count: result.count },
        },
      });
    }
  } else {
    const memberId = String(formData.get("memberId") ?? "");
    const targetId = memberId || null;
    if (role === "AGENT" && targetId !== user.id) {
      throw forbidden("Agents can only assign conversations to themselves");
    }
    if (targetId) {
      const member = await prisma.membership.findFirst({
        where: { organizationId: org.id, userId: targetId },
        select: { userId: true },
      });
      if (!member) throw notFound("That person isn't a member of this workspace");
    }
    const result = await prisma.conversation.updateMany({
      where: scope,
      data: { assignedToId: targetId },
    });
    if (result.count > 0) {
      await prisma.auditLog.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          action: targetId ? "conversation.bulk_assign" : "conversation.bulk_unassign",
          entityType: "Conversation",
          metadata: { count: result.count, ...(targetId ? { assignedToId: targetId } : {}) },
        },
      });
    }
  }
  revalidatePath("/conversations");
}

const tagSchema = z.object({
  conversationId: z.string().min(1),
  tag: z
    .string()
    .trim()
    .min(1, "Tag can't be empty")
    .max(30, "Keep tags under 30 characters")
    .transform((t) => t.toLowerCase()),
});

export async function addConversationTag(formData: FormData): Promise<void> {
  const { conversationId, tag } = tagSchema.parse({
    conversationId: formData.get("conversationId"),
    tag: formData.get("tag"),
  });
  const { conversation } = await ownedConversation(conversationId);

  const current = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversation.id },
    select: { tags: true },
  });
  if (!current.tags.includes(tag) && current.tags.length < 10) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { tags: [...current.tags, tag] },
    });
  }
  revalidatePath("/conversations");
}

export async function removeConversationTag(formData: FormData): Promise<void> {
  const { conversationId, tag } = tagSchema.parse({
    conversationId: formData.get("conversationId"),
    tag: formData.get("tag"),
  });
  const { conversation } = await ownedConversation(conversationId);

  const current = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversation.id },
    select: { tags: true },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { tags: current.tags.filter((t) => t !== tag) },
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
