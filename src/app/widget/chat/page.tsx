import { prisma } from "@/lib/prisma";
import { WidgetChat } from "@/features/widget/widget-chat";

export const metadata = { title: "Chat" };

/**
 * The page loaded inside the widget iframe: /widget/chat?key=<widgetKey>
 * Loads public branding server-side and hands off to the client chat UI.
 */
export default async function WidgetChatPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;

  const org = key
    ? await prisma.organization.findUnique({
        where: { widgetKey: key },
        include: { aiConfig: true },
      })
    : null;

  if (!org) {
    return (
      <div className="h-screen flex items-center justify-center bg-canvas px-6 text-center">
        <p className="text-[13px] text-ink-mid">
          This chat widget is misconfigured (unknown key). Please contact the site owner.
        </p>
      </div>
    );
  }

  return (
    <WidgetChat
      widgetKey={org.widgetKey}
      orgName={org.name}
      assistantName={org.aiConfig?.assistantName ?? "Assistant"}
      greeting={org.aiConfig?.greeting ?? "Hi! How can I help you today?"}
      accentColor={org.aiConfig?.widgetColor ?? "#5B57D4"}
      showBranding={org.aiConfig?.showBranding ?? true}
    />
  );
}
