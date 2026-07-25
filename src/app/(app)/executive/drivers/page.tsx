import { AnalyticsPageTemplate } from "@/components/analytics/AnalyticsPageTemplate";
import { Users } from "lucide-react";

export default function DriverAnalyticsPage() {
  return <AnalyticsPageTemplate title="Driver Analytics" icon={Users} description="Analysis of driver performance, availability, and utilization rates." />;
}
