import { BookOpen } from "lucide-react";
import { ComingSoonScreen } from "@/components/layout/coming-soon";

export const metadata = { title: "Knowledge Base" };

export default function KnowledgePage() {
  return (
    <ComingSoonScreen
      title="Knowledge Base"
      milestone="Milestone 3"
      icon={BookOpen}
      description="Teach your AI receptionist everything about your business — it answers from your own content, never from guesses."
      bullets={[
        "Upload PDFs, Word documents, and price lists",
        "Import FAQs and website pages by URL",
        "Automatic sync from your CMS — no duplicate data entry",
        "Everything is indexed automatically; no manual retraining",
      ]}
    />
  );
}
