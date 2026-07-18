"use server";

import { compare, hash } from "bcryptjs";
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

  // Best-effort: verification email — signup must never fail on email trouble
  try {
    await sendVerificationEmail(email.toLowerCase());
  } catch (err) {
    logger.warn({ err, email: email.toLowerCase() }, "verification email failed to send");
  }

  // Establish the session, then send them to the dashboard
  await signIn("credentials", { email, password, redirect: false });
  redirect("/dashboard");
}

/* ---------- Email verification ---------- */

async function sendVerificationEmail(emailAddress: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: emailAddress } });
  if (!user || user.emailVerifiedAt) return;

  const token = await prisma.emailVerificationToken.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) },
  });

  const { getBaseUrl } = await import("@/lib/base-url");
  const link = `${await getBaseUrl()}/verify-email/${token.token}`;

  const { sendEmail, emailLayout } = await import("@/lib/email");
  await sendEmail({
    to: user.email,
    subject: "Confirm your email — AI Receptionist",
    html: emailLayout(
      "Confirm your email",
      `<p>Hi ${user.name},</p>
       <p>Click the button below to confirm this email address. The link is valid for 24 hours.</p>
       <p style="margin:24px 0;"><a href="${link}" style="background:#5B57D4;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold;">Confirm email</a></p>
       <p style="color:#9A9AA5;font-size:12px;">If you didn't create an account, you can safely ignore this email.</p>`,
    ),
  });
}

/** Resend the verification email for the signed-in user (dashboard banner). */
export async function resendVerificationEmail(): Promise<{ sent?: boolean; error?: string }> {
  const { requireOrg } = await import("@/lib/org");
  const { user } = await requireOrg();
  if (user.emailVerifiedAt) return { sent: true };

  const { rateLimit } = await import("@/lib/rate-limit");
  const attempt = await rateLimit(`verify-resend:${user.id}`, 3, 15 * 60_000);
  if (!attempt.allowed) return { error: "Too many attempts — try again in a few minutes." };

  try {
    await sendVerificationEmail(user.email);
    return { sent: true };
  } catch (err) {
    logger.warn({ err, email: user.email }, "verification email resend failed");
    return { error: "Couldn't send the email — try again later." };
  }
}

export async function verifyEmailToken(rawToken: string): Promise<"verified" | "expired" | "invalid"> {
  if (!rawToken) return "invalid";
  const token = await prisma.emailVerificationToken.findUnique({
    where: { token: rawToken },
    include: { user: { select: { id: true, email: true, emailVerifiedAt: true } } },
  });
  if (!token) return "invalid";
  if (token.user.emailVerifiedAt) return "verified"; // already done — treat as success
  if (token.usedAt || token.expiresAt < new Date()) return "expired";

  await prisma.$transaction([
    prisma.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
  ]);
  logger.info({ email: token.user.email }, "email verified");
  return "verified";
}

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Please enter your password"),
  totp: z.string().optional(),
});

export type LoginFormState = (AuthFormState & { totpRequired?: boolean }) | undefined;

export async function login(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Throttle both password guessing and 6-digit code brute-forcing
  const { headers } = await import("next/headers");
  const { rateLimit } = await import("@/lib/rate-limit");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  const attempt = await rateLimit(`login:${ip}:${parsed.data.email.toLowerCase()}`, 10, 15 * 60_000);
  if (!attempt.allowed) {
    return { error: "Too many attempts — try again in a few minutes." };
  }

  // 2FA gate — only after the password checks out, so nothing leaks earlier
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { passwordHash: true, totpSecret: true, totpEnabledAt: true },
  });
  if (user && (await compare(parsed.data.password, user.passwordHash))) {
    if (user.totpEnabledAt && user.totpSecret) {
      if (!parsed.data.totp) {
        return { totpRequired: true };
      }
      const { verifyTotp } = await import("@/lib/totp");
      if (!verifyTotp(user.totpSecret, parsed.data.totp)) {
        return { totpRequired: true, error: "Invalid authentication code." };
      }
    }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      totp: parsed.data.totp ?? "",
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

/* ---------- Password change (logged-in) ---------- */

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm the new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New passwords don't match",
    path: ["confirmPassword"],
  });

export async function changePassword(
  _prev: (AuthFormState & { success?: boolean }) | undefined,
  formData: FormData,
): Promise<AuthFormState & { success?: boolean }> {
  const { requireOrg } = await import("@/lib/org");
  const { user } = await requireOrg();

  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { rateLimit } = await import("@/lib/rate-limit");
  const attempt = await rateLimit(`pwchange:${user.id}`, 5, 15 * 60_000);
  if (!attempt.allowed) return { error: "Too many attempts — try again later." };

  const ok = await compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return { error: "Current password is wrong." };

  const passwordHash = await hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  logger.info({ email: user.email }, "password changed");
  return { success: true };
}

/* ---------- Two-factor auth (TOTP) ---------- */

export type TotpFormState =
  | { error?: string; success?: boolean; secret?: string; authUrl?: string }
  | undefined;

/** Step 1: generate a pending secret and show it for the authenticator app. */
export async function startTotpEnrollment(): Promise<TotpFormState> {
  const { requireOrg } = await import("@/lib/org");
  const { user } = await requireOrg();
  if (user.totpEnabledAt) return { error: "Two-factor auth is already enabled." };

  const { generateTotpSecret, totpAuthUrl } = await import("@/lib/totp");
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
  return { secret, authUrl: totpAuthUrl(secret, user.email) };
}

/** Step 2: the user proves the app works by entering a valid code. */
export async function confirmTotpEnrollment(
  _prev: TotpFormState,
  formData: FormData,
): Promise<TotpFormState> {
  const { requireOrg } = await import("@/lib/org");
  const { user } = await requireOrg();
  if (user.totpEnabledAt) return { error: "Two-factor auth is already enabled." };
  if (!user.totpSecret) return { error: "Start the setup first." };

  const code = String(formData.get("code") ?? "");
  const { verifyTotp } = await import("@/lib/totp");
  if (!verifyTotp(user.totpSecret, code)) {
    return { error: "That code didn't match — check the app and try again." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabledAt: new Date() },
  });
  logger.info({ email: user.email }, "2FA enabled");
  return { success: true };
}

/** Disabling requires the account password, not just a session. */
export async function disableTotp(
  _prev: TotpFormState,
  formData: FormData,
): Promise<TotpFormState> {
  const { requireOrg } = await import("@/lib/org");
  const { user } = await requireOrg();
  if (!user.totpEnabledAt) return { success: true };

  const password = String(formData.get("password") ?? "");
  const ok = await compare(password, user.passwordHash);
  if (!ok) return { error: "Wrong password." };

  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: null, totpEnabledAt: null },
  });
  logger.info({ email: user.email }, "2FA disabled");
  return { success: true };
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
