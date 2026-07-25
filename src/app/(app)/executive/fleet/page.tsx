import { AnalyticsPageTemplate } from "@/components/analytics/AnalyticsPageTemplate";
import { Truck } from "lucide-react";

export default function FleetAnalyticsPage() {
  return <AnalyticsPageTemplate title="Fleet Analytics" icon={Truck} description="Insights into vehicle utilization, maintenance trends, and fleet availability." />;
}
