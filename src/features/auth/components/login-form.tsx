"use client";

import { useActionState } from "react";
import { login } from "../actions";
import { Button, Field, Input } from "@/components/ui";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Email">
        <Input name="email" type="email" placeholder="you@business.com" required autoComplete="email" />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
      </Field>
      {state?.error && (
        <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full h-[42px]">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
