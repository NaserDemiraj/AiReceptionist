"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "../actions";
import { Button, Field, Input } from "@/components/ui";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);

  if (state && "sent" in state && state.sent) {
    return (
      <p className="text-[13px] text-positive-strong bg-positive-soft border border-positive-line rounded-lg px-3.5 py-3">
        If an account exists for that email, a reset link is on its way. Check your inbox
        (and spam folder).
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Email">
        <Input name="email" type="email" placeholder="you@business.com" required autoComplete="email" />
      </Field>
      {state?.error && (
        <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full h-[42px]">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
