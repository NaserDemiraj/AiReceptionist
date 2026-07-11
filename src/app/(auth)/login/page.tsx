import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="w-full max-w-[400px]">
      <div className="bg-card border border-line rounded-[14px] p-7">
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-ink">
          Welcome back
        </h1>
        <p className="text-[13.5px] text-ink-mid mt-1 mb-6">
          Sign in to your dashboard.
        </p>
        <LoginForm />
      </div>
      <p className="text-center text-[13px] text-ink-mid mt-5">
        New here?{" "}
        <Link href="/signup" className="text-accent font-medium hover:text-accent-strong">
          Start your free trial
        </Link>
        {" · "}
        <Link href="/forgot-password" className="text-accent font-medium hover:text-accent-strong">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}
