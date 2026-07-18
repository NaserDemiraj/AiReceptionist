import Link from "next/link";
import { format } from "date-fns";
import { MessageSquare } from "lucide-react";
import { Badge, EmptyState, cx } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { AgentComposer } from "@/features/conversations/components/agent-composer";
import { assignConversation, bulkConversations } from "@/features/conversations/actions";
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
  searchParams: Promise<{ c?: string; status?: string; mine?: string }>;
}) {
  const { org, user, role } = await requireOrg();
  const params = await searchParams;

  const statusFilter =
    params.status && params.status in CONVERSATION_STATUS_META
      ? (params.status as keyof typeof CONVERSATION_STATUS_META)
      : undefined;
  const mineOnly = params.mine === "1";

  // Agents only see unassigned conversations plus their own
  const visibility =
    role === "AGENT"
      ? { OR: [{ assignedToId: null }, { assignedToId: user.id }] }
      : {};

  const conversations = await prisma.conversation.findMany({
    where: {
      organizationId: org.id,
      ...visibility,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(mineOnly ? { assignedToId: user.id } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      customer: true,
      assignedTo: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const selectedId = params.c ?? conversations[0]?.id;
  // Only the latest page of the transcript — history loads on demand
  const selected = selectedId
    ? await prisma.conversation.findFirst({
        where: { id: selectedId, organizationId: org.id, ...visibility },
        include: {
          customer: true,
          assignedTo: { select: { id: true, name: true } },
          messages: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: MESSAGES_PAGE_SIZE + 1, // sentinel row → "load earlier" button
            include: { agent: { select: { name: true } } },
          },
        },
      })
    : null;

  // Members list for the assignment dropdown (owners/admins assign anyone)
  const members =
    role === "AGENT"
      ? []
      : await prisma.membership.findMany({
          where: { organizationId: org.id },
          select: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        });
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
    { href: "/conversations", label: "All", active: !statusFilter && !mineOnly },
    { href: "/conversations?mine=1", label: "Mine", active: mineOnly },
    { href: "/conversations?status=AI_ACTIVE", label: "AI handling", active: statusFilter === "AI_ACTIVE" },
    { href: "/conversations?status=NEEDS_HUMAN", label: "Needs human", active: statusFilter === "NEEDS_HUMAN" },
    { href: "/conversations?status=RESOLVED", label: "Resolved", active: statusFilter === "RESOLVED" },
  ];
  const listQuery = `${statusFilter ? `&status=${statusFilter}` : ""}${mineOnly ? "&mine=1" : ""}`;

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
                href={f.href}
                className={cx(
                  "px-2.5 py-1 rounded-lg text-[12px] font-medium",
                  f.active
                    ? "bg-accent-soft text-accent font-semibold"
                    : "text-ink-mid hover:bg-hover",
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <form action={bulkConversations} className="flex-1 flex flex-col min-h-0">
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
                    <div
                      key={c.id}
                      className={cx(
                        "flex items-start gap-2 pl-3 border-b border-line",
                        active ? "bg-accent-soft/50" : "hover:bg-row-hover",
                      )}
                    >
                      <input
                        type="checkbox"
                        name="ids"
                        value={c.id}
                        aria-label="Select conversation"
                        className="mt-4 accent-[var(--color-accent,#5B57D4)] cursor-pointer"
                      />
                      <Link
                        href={`/conversations?c=${c.id}${listQuery}`}
                        className="flex-1 min-w-0 flex gap-3 py-3 pr-4"
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
                            {c.assignedTo && (
                              <span className="ml-auto text-[10px] text-ink-soft truncate max-w-[80px]">
                                {c.assignedTo.id === user.id ? "You" : c.assignedTo.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
            {conversations.length > 0 && (
              <div className="shrink-0 border-t border-line bg-card px-3 py-2 flex items-center gap-1.5">
                <span className="text-[10.5px] text-ink-soft mr-auto">With selected:</span>
                <button
                  type="submit"
                  name="bulkAction"
                  value="resolve"
                  className="text-[11.5px] font-medium text-ink-mid hover:text-ink bg-hover rounded-lg px-2.5 py-1 cursor-pointer"
                >
                  Resolve
                </button>
                {role === "AGENT" ? (
                  <>
                    <input type="hidden" name="memberId" value={user.id} />
                    <button
                      type="submit"
                      name="bulkAction"
                      value="assign"
                      className="text-[11.5px] font-medium text-accent bg-accent-soft hover:bg-accent-soft/70 rounded-lg px-2.5 py-1 cursor-pointer"
                    >
                      Assign to me
                    </button>
                  </>
                ) : (
                  <>
                    <select
                      name="memberId"
                      defaultValue={user.id}
                      className="h-6.5 text-[11px] bg-hover border border-line rounded-lg px-1"
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.id === user.id ? `${m.user.name} (you)` : m.user.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      name="bulkAction"
                      value="assign"
                      className="text-[11.5px] font-medium text-accent bg-accent-soft hover:bg-accent-soft/70 rounded-lg px-2.5 py-1 cursor-pointer"
                    >
                      Assign
                    </button>
                  </>
                )}
              </div>
            )}
          </form>
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
                {role === "AGENT" ? (
                  selected.assignedTo ? (
                    <span className="text-[11.5px] text-ink-mid">Assigned to you</span>
                  ) : (
                    <form action={assignConversation}>
                      <input type="hidden" name="conversationId" value={selected.id} />
                      <input type="hidden" name="memberId" value={user.id} />
                      <button
                        type="submit"
                        className="text-[11.5px] font-medium text-accent bg-accent-soft hover:bg-accent-soft/70 rounded-lg px-2.5 py-1 cursor-pointer"
                      >
                        Claim
                      </button>
                    </form>
                  )
                ) : (
                  <form action={assignConversation} className="flex items-center gap-1.5">
                    <input type="hidden" name="conversationId" value={selected.id} />
                    <select
                      name="memberId"
                      defaultValue={selected.assignedTo?.id ?? ""}
                      className="h-7 text-[11.5px] bg-hover border border-line rounded-lg px-1.5"
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.id === user.id ? `${m.user.name} (you)` : m.user.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="text-[11.5px] font-medium text-accent bg-accent-soft hover:bg-accent-soft/70 rounded-lg px-2.5 py-1 cursor-pointer"
                    >
                      Assign
                    </button>
                  </form>
                )}
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
