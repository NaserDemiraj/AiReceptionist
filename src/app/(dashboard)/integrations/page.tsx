import { Blocks } from "lucide-react";
import { ComingSoonScreen } from "@/components/layout/coming-soon";

export const metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return (
    <ComingSoonScreen
      title="Integrations"
      milestone="Milestone 4"
      icon={Blocks}
      description="Connect the tools your business already uses."
      bullets={[
        "WhatsApp Business, Instagram & Facebook Messenger",
        "Google Calendar two-way sync",
        "Stripe payments, email & SMS providers",
        "Webhooks and a public REST API",
      ]}
    />
  );
}
