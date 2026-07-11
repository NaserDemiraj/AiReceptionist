"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { forbidden } from "@/lib/errors";
import { logger } from "@/lib/logger";

const INVITE_VALID_DAYS = 7;

export async function createInvite(formData: FormData): Promise<void> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can invite members");

  const inviteRole = formData.get("role") === "ADMIN" ? "ADMIN" : "AGENT";

  await prisma.invite.create({
    data: {
      organizationId: org.id,
      role: inviteRole,
      createdById: user.id,
      expiresAt: new Date(Date.now() + INVITE_VALID_DAYS * 24 * 3600_000),
    },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      action: "member.invite.create",
      metadata: { role: inviteRole },
    },
  });
  revalidatePath("/team");
}

export async function revokeInvite(formData: FormData): Promise<void> {
  const { org, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can revoke invites");
  const id = z.string().min(1).parse(formData.get("inviteId"));

  await prisma.invite.deleteMany({ where: { id, organizationId: org.id, usedAt: null } });
  revalidatePath("/team");
}

/* ---------- Accepting an invite (public) ---------- */

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type AcceptInviteState = { error?: string } | undefined;

export async function acceptInvite(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const parsed = acceptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { token, name, email, password } = parsed.data;

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { organization: true },
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return { error: "This invite link is no longer valid. Ask for a new one." };
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return {
      error:
        "An account with this email already exists. Multi-organization accounts arrive later — use a different email for now.",
    };
  }

  const passwordHash = await hash(password, 12);
  await prisma.$transaction([
    prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        memberships: {
          create: { organizationId: invite.organizationId, role: invite.role },
        },
      },
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date(), usedByEmail: email.toLowerCase() },
    }),
    prisma.auditLog.create({
      data: {
        organizationId: invite.organizationId,
        action: "member.invite.accepted",
        metadata: { email: email.toLowerCase(), role: invite.role },
      },
    }),
  ]);

  logger.info({ org: invite.organization.slug, email }, "invite accepted");
  await signIn("credentials", { email, password, redirect: false });
  redirect("/dashboard");
}
