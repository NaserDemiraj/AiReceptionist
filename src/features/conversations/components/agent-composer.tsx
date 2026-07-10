"use client";

import { useRef, useTransition } from "react";
import { Bot, CheckCheck, Send } from "lucide-react";
import { sendAgentReply, resolveConversation, returnToAi } from "../actions";

export function AgentComposer({
  conversationId,
  status,
}: {
  conversationId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  const resolved = status === "RESOLVED";

  function submit(formData: FormData) {
    startTransition(async () => {
      await sendAgentReply(formData);
      formRef.current?.reset();
    });
  }

  return (
    <div className="shrink-0 border-t border-line bg-card px-4 py-3">
      <form ref={formRef} action={submit} className="flex items-center gap-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <input
          name="text"
          required
          maxLength={4000}
          placeholder={
            resolved ? "Conversation resolved — reply to reopen…" : "Reply as a team member…"
          }
          className="flex-1 h-[40px] px-3.5 bg-canvas border border-line rounded-[10px] text-[13.5px] outline-none focus:border-accent-line"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={isPending}
          className="h-[40px] px-4 bg-accent hover:bg-accent-strong disabled:opacity-50 text-white rounded-[10px] text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Send size={14} />
          {isPending ? "Sending…" : "Send"}
        </button>
      </form>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[11px] text-ink-soft">
          Sending a reply pauses the AI for this conversation.
        </span>
        <div className="flex-1" />
        {status !== "AI_ACTIVE" && !resolved && (
          <form action={returnToAi}>
            <input type="hidden" name="conversationId" value={conversationId} />
            <button
              type="submit"
              className="text-[11.5px] font-medium text-accent hover:text-accent-strong flex items-center gap-1 cursor-pointer"
            >
              <Bot size={12} /> Hand back to AI
            </button>
          </form>
        )}
        {!resolved && (
          <form action={resolveConversation}>
            <input type="hidden" name="conversationId" value={conversationId} />
            <button
              type="submit"
              className="text-[11.5px] font-medium text-positive-strong hover:opacity-80 flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck size={12} /> Resolve
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
