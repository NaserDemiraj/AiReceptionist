import { ChartLine } from "lucide-react";
import { ComingSoonScreen } from "@/components/layout/coming-soon";

export const metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <ComingSoonScreen
      title="Analytics"
      milestone="Milestone 4"
      icon={ChartLine}
      description="See exactly what your AI employee delivers — and what it's worth in revenue."
      bullets={[
        "Daily conversations, conversion rate, booked appointments",
        "Revenue influenced and most-viewed products",
        "Most common questions and missed opportunities",
        "Response times and customer satisfaction",
      ]}
    />
  );
}
