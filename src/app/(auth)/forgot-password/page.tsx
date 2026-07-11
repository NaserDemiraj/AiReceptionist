import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-[400px]">
      <div className="bg-card border border-line rounded-[14px] p-7">
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-ink">
          Forgot your password?
        </h1>
        <p className="text-[13.5px] text-ink-mid mt-1 mb-6">
          Enter your email and we&apos;ll send you a reset link.
        </p>
        <ForgotPasswordForm />
      </div>
      <p className="text-center text-[13px] text-ink-mid mt-5">
        Remembered it?{" "}
        <Link href="/login" className="text-accent font-medium hover:text-accent-strong">
          Sign in
        </Link>
      </p>
    </div>
  );
}
