"use client";

import { useState, useTransition } from "react";
import { resendVerificationEmail } from "@/features/auth/actions";

export function VerifyEmailBanner({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const resend = () =>
    startTransition(async () => {
      const result = await resendVerificationEmail();
      setMessage(result.sent ? "Sent — check your inbox." : (result.error ?? null));
    });

  return (
    <div className="px-[26px] py-2.5 text-[13px] font-medium flex items-center gap-3 bg-accent-soft text-accent">
      <span className="flex-1">
        Confirm your email address — we sent a link to <strong>{email}</strong>.
      </span>
      {message ? (
        <span className="shrink-0">{message}</span>
      ) : (
        <button
          type="button"
          onClick={resend}
          disabled={pending}
          className="shrink-0 font-semibold underline underline-offset-2 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Resend email"}
        </button>
      )}
    </div>
  );
}
