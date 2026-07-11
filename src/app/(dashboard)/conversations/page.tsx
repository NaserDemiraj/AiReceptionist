import Link from "next/link";
import { format } from "date-fns";
import { Bot, MessageSquare, User } from "lucide-react";
import { Badge, EmptyState, cx } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { AgentComposer } from "@/features/conversations/components/agent-composer";
import { AutoRefresh } from "@/components/auto-refresh";
import {
  CHANNEL_LABELS,
  CONVERSATION_STATUS_META,
  SENTIMENT_META,
} from "@/features/shared/labels";

export const metadata = { title: "Conversations" };

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; status?: string }>;
}) {
  const { org } = await requireOrg();
  const params = await searchParams;

  const statusFilter =
    params.status && params.status in CONVERSATION_STATUS_META
      ? (params.status as keyof typeof CONVERSATION_STATUS_META)
      : undefined;

  const conversations = await prisma.conversation.findMany({
    where: { organizationId: org.id, ...(statusFilter ? { status: statusFilter } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      customer: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const selectedId = params.c ?? conversations[0]?.id;
  const selected = selectedId
    ? await prisma.conversation.findFirst({
        where: { id: selectedId, organizationId: org.id },
        include: {
          customer: true,
          messages: { orderBy: { createdAt: "asc" }, include: { agent: true } },
        },
      })
    : null;

  const filters = [
    { key: undefined, label: "All" },
    { key: "AI_ACTIVE", label: "AI handling" },
    { key: "NEEDS_HUMAN", label: "Needs human" },
    { key: "RESOLVED", label: "Resolved" },
  ] as const;

  return (
    <>
      <Topbar title="Conversations" />
      <AutoRefresh intervalMs={8000} />
      <div className="flex-1 flex min-h-0">
        {/* List pane */}
        <div className="w-[340px] shrink-0 border-r border-line bg-card flex flex-col min-h-0">
          <div className="flex gap-1.5 p-3 border-b border-line">
            {filters.map((f) => (
              <Link
                key={f.label}
                href={f.key ? `/conversations?status=${f.key}` : "/conversations"}
                className={cx(
                  "px-2.5 py-1 rounded-lg text-[12px] font-medium",
                  statusFilter === f.key || (!statusFilter && !f.key)
                    ? "bg-accent-soft text-accent font-semibold"
                    : "text-ink-mid hover:bg-hover",
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <EmptyState
                title="No conversations"
                hint="Once your AI receptionist starts talking to customers, they show up here."
                icon={<MessageSquare size={28} />}
              />
            ) : (
              conversations.map((c) => {
                const meta = CONVERSATION_STATUS_META[c.status];
                const active = c.id === selected?.id;
                return (
                  <Link
                    key={c.id}
                    href={`/conversations?c=${c.id}${statusFilter ? `&status=${statusFilter}` : ""}`}
                    className={cx(
                      "flex gap-3 px-4 py-3 border-b border-line",
                      active ? "bg-accent-soft/50" : "hover:bg-row-hover",
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[12px] font-semibold shrink-0">
                      {(c.customer.name ?? "V")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold truncate">
                          {c.customer.name ?? "Web visitor"}
                        </span>
                        <span className="ml-auto text-[10.5px] text-ink-soft shrink-0">
                          {format(c.updatedAt, "HH:mm")}
                        </span>
                      </div>
                      <div className="text-[12px] text-ink-mid truncate mt-0.5">
                        {c.messages[0]?.content ?? c.subject ?? "…"}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="font-mono text-[10px] text-ink-soft">
                          {CHANNEL_LABELS[c.channel]}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Transcript pane */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                title="Select a conversation"
                hint="Pick a conversation from the list to read the full transcript."
                icon={<MessageSquare size={28} />}
              />
            </div>
          ) : (
            <>
              <div className="h-[54px] shrink-0 border-b border-line bg-card flex items-center gap-3 px-5">
                <span className="text-[14px] font-semibold">
                  {selected.customer.name ?? "Web visitor"}
                </span>
                <span className="font-mono text-[10.5px] text-ink-soft">
                  {CHANNEL_LABELS[selected.channel]} · {selected.language.toUpperCase()}
                </span>
                <div className="flex-1" />
                <Badge tone={SENTIMENT_META[selected.sentiment].tone}>
                  {SENTIMENT_META[selected.sentiment].label}
                </Badge>
                <Badge tone={CONVERSATION_STATUS_META[selected.status].tone}>
                  {CONVERSATION_STATUS_META[selected.status].label}
                </Badge>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {selected.messages.map((m) => {
                  const isCustomer = m.role === "CUSTOMER";
                  const isSystem = m.role === "SYSTEM";
                  if (isSystem) {
                    return (
                      <div key={m.id} className="text-center">
                        <span className="font-mono text-[10.5px] text-ink-soft bg-hover px-3 py-1 rounded-full">
                          {m.content}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className={cx("flex gap-2.5", !isCustomer && "flex-row-reverse")}>
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
                          {m.role === "AGENT" ? (m.agent?.name ?? "Agent") : m.role === "AI" ? "AI" : ""}
                          {m.role !== "CUSTOMER" ? " · " : ""}
                          {format(m.createdAt, "MMM d, HH:mm")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <AgentComposer conversationId={selected.id} status={selected.status} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
