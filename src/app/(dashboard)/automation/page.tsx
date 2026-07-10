import { Workflow } from "lucide-react";
import { ComingSoonScreen } from "@/components/layout/coming-soon";

export const metadata = { title: "Automation" };

export default function AutomationPage() {
  return (
    <ComingSoonScreen
      title="Automation"
      milestone="Milestone 3"
      icon={Workflow}
      description="Your AI follows up so no opportunity slips away — like an employee who never forgets."
      bullets={[
        "Automatic follow-ups when a customer goes quiet",
        "Missed-call recovery: text back within 30 seconds",
        "Appointment reminders and confirmations",
        "Price-drop and back-in-stock alerts for interested leads",
      ]}
    />
  );
}
