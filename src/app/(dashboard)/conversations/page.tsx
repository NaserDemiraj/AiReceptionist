import Link from "next/link";
import { format } from "date-fns";
import { MessageSquare } from "lucide-react";
import { Badge, EmptyState, cx } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { AgentComposer } from "@/features/conversations/components/agent-composer";
import { EarlierMessages } from "@/features/conversations/components/earlier-messages";
import { MessageBubble } from "@/features/conversations/components/message-bubble";
import { MESSAGES_PAGE_SIZE } from "@/features/conversations/transcript";
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
  // Only the latest page of the transcript — history loads on demand
  const selected = selectedId
    ? await prisma.conversation.findFirst({
        where: { id: selectedId, organizationId: org.id },
        include: {
          customer: true,
          messages: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: MESSAGES_PAGE_SIZE + 1, // sentinel row → "load earlier" button
            include: { agent: { select: { name: true } } },
          },
        },
      })
    : null;
  const hasEarlier = (selected?.messages.length ?? 0) > MESSAGES_PAGE_SIZE;
  const transcript = (selected?.messages ?? [])
    .slice(0, MESSAGES_PAGE_SIZE)
    .reverse()
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      agentName: m.agent?.name ?? null,
    }));

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
                {hasEarlier && transcript.length > 0 && (
                  <EarlierMessages
                    key={selected.id}
                    conversationId={selected.id}
                    oldestShownId={transcript[0].id}
                  />
                )}
                {transcript.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
              </div>
              <AgentComposer conversationId={selected.id} status={selected.status} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
