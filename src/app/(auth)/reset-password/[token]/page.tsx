import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  const valid = record && !record.usedAt && record.expiresAt > new Date();

  return (
    <div className="w-full max-w-[400px]">
      <div className="bg-card border border-line rounded-[14px] p-7">
        {valid ? (
          <>
            <h1 className="font-display text-[22px] font-semibold tracking-tight text-ink">
              Choose a new password
            </h1>
            <p className="text-[13.5px] text-ink-mid mt-1 mb-6">At least 8 characters.</p>
            <ResetPasswordForm token={token} />
          </>
        ) : (
          <div className="text-center">
            <h1 className="font-display text-[20px] font-semibold tracking-tight text-ink">
              Link expired
            </h1>
            <p className="text-[13.5px] text-ink-mid mt-2">
              This reset link is no longer valid.{" "}
              <a href="/forgot-password" className="text-accent font-medium">
                Request a new one
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
