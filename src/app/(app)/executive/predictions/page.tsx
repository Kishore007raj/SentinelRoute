import { AnalyticsPageTemplate } from "@/components/analytics/AnalyticsPageTemplate";
import { TrendingUp } from "lucide-react";

export default function PredictionAnalyticsPage() {
  return <AnalyticsPageTemplate title="Prediction Analytics" icon={TrendingUp} description="Analysis of route prediction accuracy and confidence trends." />;
}
