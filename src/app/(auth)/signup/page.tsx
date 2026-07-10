import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = { title: "Start free trial" };

export default function SignupPage() {
  return (
    <div className="w-full max-w-[440px]">
      <div className="bg-card border border-line rounded-[14px] p-7">
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-ink">
          Hire your AI receptionist
        </h1>
        <p className="text-[13.5px] text-ink-mid mt-1 mb-6">
          14-day free trial · No credit card required.
        </p>
        <SignupForm />
      </div>
      <p className="text-center text-[13px] text-ink-mid mt-5">
        Already have an account?{" "}
        <Link href="/login" className="text-accent font-medium hover:text-accent-strong">
          Sign in
        </Link>
      </p>
    </div>
  );
}
