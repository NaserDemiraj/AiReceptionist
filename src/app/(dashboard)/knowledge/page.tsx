import { formatDistanceToNow } from "date-fns";
import {
  BookOpen,
  FileText,
  Globe,
  HelpCircle,
  Trash2,
  Type,
} from "lucide-react";
import type { KnowledgeSourceType } from "@prisma/client";
import { Badge, Card, EmptyState } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { AddKnowledge } from "@/features/knowledge/components/add-knowledge";
import { deleteSource } from "@/features/knowledge/actions";

export const metadata = { title: "Knowledge Base" };

const TYPE_META: Record<
  KnowledgeSourceType,
  { label: string; icon: React.ComponentType<{ size?: number }> }
> = {
  FAQ: { label: "FAQ", icon: HelpCircle },
  MANUAL: { label: "Document", icon: Type },
  DOCUMENT: { label: "PDF", icon: FileText },
  URL: { label: "Web page", icon: Globe },
  CMS: { label: "CMS", icon: Globe },
};

export default async function KnowledgePage() {
  const { org } = await requireOrg();

  const sources = await prisma.knowledgeSource.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { chunks: true } } },
  });

  return (
    <>
      <Topbar title="Knowledge Base" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <div className="grid lg:grid-cols-5 gap-4 max-w-[1100px]">
          {/* Add panel */}
          <Card className="lg:col-span-2 p-5 self-start">
            <h2 className="text-[15px] font-semibold mb-1">Teach your AI</h2>
            <p className="text-[12.5px] text-ink-mid mb-4">
              Everything you add here becomes part of what your receptionist knows — instantly,
              no retraining.
            </p>
            <AddKnowledge />
          </Card>

          {/* Sources list */}
          <Card className="lg:col-span-3 overflow-hidden self-start">
            <div className="px-4 pt-4 pb-3 border-b border-line flex items-center justify-between">
              <span className="text-[14px] font-semibold">Sources</span>
              <span className="font-mono text-[11px] text-ink-soft">{sources.length}</span>
            </div>
            {sources.length === 0 ? (
              <EmptyState
                title="Nothing here yet"
                hint="Add an FAQ or paste your delivery policy — then ask the AI about it in the demo chat."
                icon={<BookOpen size={28} />}
              />
            ) : (
              sources.map((s) => {
                const meta = TYPE_META[s.type];
                const Icon = meta.icon;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3.5 px-4 py-3.5 border-b border-line last:border-0 hover:bg-row-hover"
                  >
                    <div className="w-9 h-9 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{s.title}</div>
                      <div className="text-[11.5px] text-ink-soft">
                        {meta.label} · {s._count.chunks} section{s._count.chunks === 1 ? "" : "s"} ·
                        added {formatDistanceToNow(s.createdAt, { addSuffix: true })}
                        {s.error ? ` · ${s.error}` : ""}
                      </div>
                    </div>
                    {s.status === "READY" ? (
                      <Badge tone="positive">Ready</Badge>
                    ) : s.status === "ERROR" ? (
                      <Badge tone="danger">Error</Badge>
                    ) : (
                      <Badge tone="warn">Indexing</Badge>
                    )}
                    <form action={deleteSource}>
                      <input type="hidden" name="sourceId" value={s.id} />
                      <button
                        type="submit"
                        title="Delete source"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-soft hover:text-danger hover:bg-danger-soft cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </form>
                  </div>
                );
              })
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
