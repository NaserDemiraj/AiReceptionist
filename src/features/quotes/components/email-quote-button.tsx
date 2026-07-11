"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { emailQuote } from "../actions";

export function EmailQuoteButton({
  quoteId,
  hasEmail,
}: {
  quoteId: string;
  hasEmail: boolean;
}) {
  const [state, formAction, pending] = useActionState(emailQuote, undefined);

  if (!hasEmail) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft"
        title="Customer has no email address"
      >
        <Mail size={13} />
        No email
      </span>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="quoteId" value={quoteId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent hover:text-accent-strong disabled:opacity-50 cursor-pointer"
      >
        <Mail size={13} />
        {pending ? "Sending…" : state?.sent ? "Sent ✓" : "Email"}
      </button>
      {state?.error && (
        <span className="text-[11px] text-danger" title={state.error}>
          failed
        </span>
      )}
    </form>
  );
}
