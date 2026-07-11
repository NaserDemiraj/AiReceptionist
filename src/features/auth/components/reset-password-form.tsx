"use client";

import { useActionState } from "react";
import { resetPassword } from "../actions";
import { Button, Field, Input } from "@/components/ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password">
        <Input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
        />
      </Field>
      {state?.error && (
        <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full h-[42px]">
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
