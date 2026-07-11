import { formatDistanceToNow } from "date-fns";
import { BellRing, MessageSquareMore, Workflow } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import {
  AutomationSettingsForm,
  RunNowButton,
} from "@/features/automation/components/automation-panel";

export const metadata = { title: "Automation" };

export default async function AutomationPage() {
  const { org } = await requireOrg();

  const config =
    (await prisma.aiConfig.findUnique({ where: { organizationId: org.id } })) ??
    (await prisma.aiConfig.create({ data: { organizationId: org.id } }));

  const recentActivity = await prisma.message.findMany({
    where: {
      conversation: { is: { organizationId: org.id } },
      OR: [
        { metadata: { path: ["automation"], equals: "followup" } },
        { metadata: { path: ["automation"], equals: "reminder" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { conversation: { include: { customer: true } } },
  });

  return (
    <>
      <Topbar title="Automation" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <div className="grid lg:grid-cols-5 gap-4 max-w-[1100px]">
          <Card className="lg:col-span-2 p-5 self-start">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center">
                <Workflow size={18} />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold">Automations</h2>
                <p className="text-[12px] text-ink-soft">Your AI works even when nobody writes</p>
              </div>
            </div>
            <AutomationSettingsForm
              initial={{
                remindersEnabled: config.remindersEnabled,
                followUpsEnabled: config.followUpsEnabled,
                followUpAfterHours: config.followUpAfterHours,
              }}
            />
            <div className="border-t border-line mt-5 pt-4">
              <RunNowButton />
              <p className="text-[11.5px] text-ink-soft mt-2.5">
                In production this runs automatically every 15 minutes. The button triggers the
                same run manually — safe to press twice, nothing double-sends.
              </p>
            </div>
          </Card>

          <Card className="lg:col-span-3 overflow-hidden self-start">
            <div className="px-4 pt-4 pb-3 border-b border-line">
              <span className="text-[14px] font-semibold">Recent automated messages</span>
            </div>
            {recentActivity.length === 0 ? (
              <EmptyState
                title="No automated messages yet"
                hint="When a reminder or follow-up goes out, it appears here (and in the customer's conversation)."
                icon={<MessageSquareMore size={28} />}
              />
            ) : (
              recentActivity.map((m) => {
                const kind = (m.metadata as { automation?: string } | null)?.automation;
                return (
                  <div
                    key={m.id}
                    className="flex gap-3.5 px-4 py-3.5 border-b border-line last:border-0 hover:bg-row-hover"
                  >
                    <div className="w-9 h-9 rounded-[10px] bg-positive-soft text-positive-strong flex items-center justify-center shrink-0">
                      {kind === "reminder" ? <BellRing size={15} /> : <MessageSquareMore size={15} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold">
                        {kind === "reminder" ? "Appointment reminder" : "Lead follow-up"} →{" "}
                        {m.conversation.customer.name ?? "Web visitor"}
                      </div>
                      <p className="text-[12.5px] text-ink-mid truncate mt-0.5">{m.content}</p>
                      <div className="text-[11px] text-ink-soft mt-1">
                        {formatDistanceToNow(m.createdAt, { addSuffix: true })}
                      </div>
                    </div>
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
