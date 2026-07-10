import { PanelsTopLeft } from "lucide-react";
import { ComingSoonScreen } from "@/components/layout/coming-soon";

export const metadata = { title: "Website Builder" };

export default function WebsitePage() {
  return (
    <ComingSoonScreen
      title="Website Builder"
      milestone="Milestone 4"
      icon={PanelsTopLeft}
      description="A complete business website with your AI receptionist built in — sold as one bundle."
      bullets={[
        "Landing, about, services, products & contact pages",
        "SEO optimization and Google Maps",
        "Contact forms that feed straight into your leads",
        "Blog for content marketing",
      ]}
    />
  );
}
