import { Bot } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { PersonaForm } from "@/features/ai-config/components/persona-form";

export const metadata = { title: "AI Configuration" };

export default async function AiConfigPage() {
  const { org } = await requireOrg();

  const config =
    (await prisma.aiConfig.findUnique({ where: { organizationId: org.id } })) ??
    (await prisma.aiConfig.create({ data: { organizationId: org.id } }));

  return (
    <>
      <Topbar title="AI Configuration" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <div className="max-w-[680px] space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center">
                <Bot size={18} />
              </div>
              <div className="flex-1">
                <h2 className="text-[15px] font-semibold">{config.assistantName}</h2>
                <p className="text-[12px] text-ink-soft">
                  Persona & behavior — changes apply instantly
                </p>
              </div>
              {config.isEnabled ? (
                <Badge tone="positive">Online</Badge>
              ) : (
                <Badge tone="neutral">Paused</Badge>
              )}
            </div>
            <PersonaForm
              initial={{
                assistantName: config.assistantName,
                greeting: config.greeting,
                tone: config.tone,
                instructions: config.instructions ?? "",
                temperature: config.temperature,
                isEnabled: config.isEnabled,
                handoffEnabled: config.handoffEnabled,
              }}
            />
          </Card>

          <Card className="p-5">
            <h2 className="text-[14px] font-semibold mb-3">Model</h2>
            <div className="flex items-center gap-2 text-[13px]">
              <Badge tone="accent">{config.provider}</Badge>
              <span className="font-mono text-[12.5px] text-ink-mid">{config.model}</span>
            </div>
            <p className="text-[11.5px] text-ink-soft mt-3">
              Provider switching (OpenAI, Anthropic, Google) lands with multi-provider support.
              The engine is already provider-agnostic.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
