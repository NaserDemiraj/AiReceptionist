"use client";

import { useActionState } from "react";
import { changePassword } from "@/features/auth/actions";
import { Button, Field, Input } from "@/components/ui";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Current password">
        <Input name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="New password">
          <Input name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Confirm new password">
          <Input name="confirmPassword" type="password" autoComplete="new-password" required />
        </Field>
      </div>

      {state?.error && (
        <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-[12.5px] text-positive-strong bg-positive-soft border border-positive-line rounded-lg px-3 py-2">
          Password updated.
        </p>
      )}

      <div className="pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}
