import { Bot } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "AI Configuration" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-line last:border-0">
      <span className="text-[13px] text-ink-mid font-medium">{label}</span>
      <span className="text-[13px] font-semibold text-right">{children}</span>
    </div>
  );
}

export default async function AiConfigPage() {
  const { org } = await requireOrg();

  const config =
    (await prisma.aiConfig.findUnique({ where: { organizationId: org.id } })) ??
    (await prisma.aiConfig.create({ data: { organizationId: org.id } }));

  return (
    <>
      <Topbar title="AI Configuration" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <div className="max-w-[640px] space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-line">
              <div className="w-9 h-9 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center">
                <Bot size={17} />
              </div>
              <div>
                <div className="text-[14px] font-semibold">{config.assistantName}</div>
                <div className="text-[11.5px] text-ink-soft">Your AI receptionist</div>
              </div>
              <div className="flex-1" />
              {config.isEnabled ? (
                <Badge tone="positive">Online</Badge>
              ) : (
                <Badge tone="neutral">Paused</Badge>
              )}
            </div>
            <Row label="Provider">
              <span className="font-mono text-[12.5px]">{config.provider}</span>
            </Row>
            <Row label="Model">
              <span className="font-mono text-[12.5px]">{config.model}</span>
            </Row>
            <Row label="Temperature">
              <span className="font-mono text-[12.5px]">{config.temperature}</span>
            </Row>
            <Row label="Tone">{config.tone}</Row>
            <Row label="Auto language detection">{config.autoDetectLanguage ? "On" : "Off"}</Row>
            <Row label="Human handoff">{config.handoffEnabled ? "Enabled" : "Disabled"}</Row>
          </Card>

          <Card className="p-5">
            <h2 className="text-[14px] font-semibold mb-1.5">Greeting</h2>
            <p className="text-[13.5px] text-ink-mid bg-hover border border-line rounded-[10px] px-3.5 py-3">
              “{config.greeting}”
            </p>
            <p className="text-[11.5px] text-ink-soft mt-3">
              Persona editing, custom instructions, and per-language greetings unlock with the
              chat engine in Milestone 2.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
