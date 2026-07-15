"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const signupSchema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  businessName: z.string().min(2, "Please enter your business name"),
  industry: z.string().min(1),
});

export type AuthFormState = { error?: string } | undefined;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function signup(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { name, email, password, businessName, industry } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return { error: "An account with this email already exists. Try signing in." };
  }

  const passwordHash = await hash(password, 12);
  const baseSlug = slugify(businessName) || "business";
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: email.toLowerCase(), passwordHash, name },
    });
    const org = await tx.organization.create({
      data: {
        name: businessName,
        slug,
        industry,
        memberships: { create: { userId: user.id, role: "OWNER" } },
        aiConfig: { create: {} },
        subscription: { create: { status: "TRIALING", trialEndsAt } },
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "org.created",
        entityType: "Organization",
        entityId: org.id,
      },
    });
  });

  logger.info({ email: email.toLowerCase(), org: businessName }, "new signup");

  // Establish the session, then send them to the dashboard
  await signIn("credentials", { email, password, redirect: false });
  redirect("/dashboard");
}

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Please enter your password"),
});

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Wrong email or password." };
    }
    throw err;
  }
  redirect("/dashboard");
}

export async function logout() {
  const { signOut } = await import("@/lib/auth");
  await signOut({ redirect: false });
  redirect("/login");
}

/* ---------- Password reset ---------- */

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState & { sent?: boolean }> {
  const email = z.string().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Please enter a valid email" };

  const { headers } = await import("next/headers");
  const { rateLimit } = await import("@/lib/rate-limit");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  const rateLimitResult = await rateLimit(`pwreset:${ip}`, 5, 15 * 60_000);
  if (!rateLimitResult.allowed) {
    return { error: "Too many attempts — try again later." };
  }

  const user = await prisma.user.findUnique({ where: { email: email.data.toLowerCase() } });
  // Always report success so the form can't be used to probe which emails exist
  if (user) {
    const token = await prisma.passwordResetToken.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60_000) },
    });
    const host = (await headers()).get("host") ?? "localhost:3000";
    const proto = host.startsWith("localhost") ? "http" : "https";
    const link = `${proto}://${host}/reset-password/${token.token}`;

    const { sendEmail, emailLayout } = await import("@/lib/email");
    await sendEmail({
      to: user.email,
      subject: "Reset your AI Receptionist password",
      html: emailLayout(
        "Password reset",
        `<p>Hi ${user.name},</p>
         <p>Click the button below to choose a new password. The link is valid for 1 hour.</p>
         <p style="margin:24px 0;"><a href="${link}" style="background:#5B57D4;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold;">Reset password</a></p>
         <p style="color:#9A9AA5;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>`,
      ),
    });
    logger.info({ email: user.email }, "password reset requested");
  }

  return { sent: true };
}

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const token = await prisma.passwordResetToken.findUnique({
    where: { token: parsed.data.token },
    include: { user: true },
  });
  if (!token || token.usedAt || token.expiresAt < new Date()) {
    return { error: "This reset link has expired. Request a new one." };
  }

  const passwordHash = await hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: token.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
  ]);

  logger.info({ email: token.user.email }, "password reset completed");
  redirect("/login");
}
