"use client";

import { useActionState, useState, useTransition } from "react";
import {
  confirmTotpEnrollment,
  disableTotp,
  startTotpEnrollment,
} from "@/features/auth/actions";
import { Button, Field, Input } from "@/components/ui";

function Feedback({ error, success }: { error?: string; success?: string }) {
  if (error)
    return (
      <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
        {error}
      </p>
    );
  if (success)
    return (
      <p className="text-[12.5px] text-positive-strong bg-positive-soft border border-positive-line rounded-lg px-3 py-2">
        {success}
      </p>
    );
  return null;
}

export function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const [setup, setSetup] = useState<{ secret: string; authUrl: string } | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();
  const [confirmState, confirmAction, confirming] = useActionState(confirmTotpEnrollment, undefined);
  const [disableState, disableAction, disabling] = useActionState(disableTotp, undefined);

  const begin = () =>
    startTransition(async () => {
      const result = await startTotpEnrollment();
      if (result?.secret && result.authUrl) {
        setSetup({ secret: result.secret, authUrl: result.authUrl });
        setStartError(null);
      } else {
        setStartError(result?.error ?? "Couldn't start setup — try again.");
      }
    });

  const isOn = (enabled || Boolean(confirmState?.success)) && !disableState?.success;

  if (isOn) {
    return (
      <div className="space-y-4">
        <p className="text-[12.5px] text-positive-strong bg-positive-soft border border-positive-line rounded-lg px-3 py-2">
          Two-factor authentication is on. Signing in requires a code from your authenticator app.
        </p>
        <form action={disableAction} className="flex items-end gap-3">
          <div className="flex-1">
            <Field label="Account password">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
          </div>
          <Button type="submit" variant="secondary" disabled={disabling}>
            {disabling ? "Turning off…" : "Turn off 2FA"}
          </Button>
        </form>
        <Feedback error={disableState?.error} />
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="space-y-4">
        <p className="text-[12.5px] text-ink-mid">
          Add a second lock on your account: after your password, you&apos;ll enter a 6-digit code
          from an authenticator app (Google Authenticator, 1Password, Authy…).
        </p>
        <Button onClick={begin} disabled={starting}>
          {starting ? "Preparing…" : "Enable two-factor auth"}
        </Button>
        <Feedback error={startError ?? undefined} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="text-[12.5px] text-ink-mid space-y-1.5 list-decimal pl-4">
        <li>
          In your authenticator app choose <strong>Add account → Enter key manually</strong>.
        </li>
        <li>
          Paste this secret key (or open the setup link on the device with the app):
        </li>
      </ol>
      <code className="block font-mono text-[13px] tracking-[0.15em] bg-hover border border-line rounded-lg px-3 py-2.5 select-all break-all">
        {setup.secret}
      </code>
      <a
        href={setup.authUrl}
        className="inline-block text-[12px] font-medium text-accent hover:underline"
      >
        Open in authenticator app →
      </a>
      <form action={confirmAction} className="flex items-end gap-3">
        <div className="flex-1">
          <Field label="Enter the 6-digit code the app shows">
            <Input
              name="code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={7}
              placeholder="123 456"
              autoComplete="one-time-code"
              required
            />
          </Field>
        </div>
        <Button type="submit" disabled={confirming}>
          {confirming ? "Checking…" : "Verify & enable"}
        </Button>
      </form>
      <Feedback error={confirmState?.error} />
    </div>
  );
}
