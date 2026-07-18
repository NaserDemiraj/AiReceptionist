import { format } from "date-fns";
import { Bot, User } from "lucide-react";
import { cx } from "@/components/ui";
import type { TranscriptMessage } from "../transcript";

/** One transcript entry — used by the server-rendered page and the
 *  client-side "load earlier" pane, so both render identically. */
export function MessageBubble({ message: m }: { message: TranscriptMessage }) {
  const isCustomer = m.role === "CUSTOMER";
  if (m.role === "SYSTEM") {
    return (
      <div className="text-center">
        <span className="font-mono text-[10.5px] text-ink-soft bg-hover px-3 py-1 rounded-full">
          {m.content}
        </span>
      </div>
    );
  }
  return (
    <div className={cx("flex gap-2.5", !isCustomer && "flex-row-reverse")}>
      <div
        className={cx(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
          isCustomer ? "bg-hover text-ink-mid" : "bg-accent-soft text-accent",
        )}
      >
        {isCustomer ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div className={cx("max-w-[65%]", !isCustomer && "text-right")}>
        <div
          className={cx(
            "inline-block px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed text-left",
            isCustomer
              ? "bg-card border border-line rounded-tl-sm"
              : "bg-accent text-white rounded-tr-sm",
          )}
        >
          {m.content}
        </div>
        <div className="text-[10.5px] text-ink-soft mt-1 px-1">
          {m.role === "AGENT" ? (m.agentName ?? "Agent") : m.role === "AI" ? "AI" : ""}
          {m.role !== "CUSTOMER" ? " · " : ""}
          {format(m.createdAt, "MMM d, HH:mm")}
        </div>
      </div>
    </div>
  );
}
