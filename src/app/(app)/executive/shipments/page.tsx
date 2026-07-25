import { AnalyticsPageTemplate } from "@/components/analytics/AnalyticsPageTemplate";
import { Package } from "lucide-react";

export default function ShipmentsAnalyticsPage() {
  return <AnalyticsPageTemplate title="Shipment Analytics" icon={Package} description="In-depth analysis of shipment volumes, status distribution, and delivery performance." />;
}
