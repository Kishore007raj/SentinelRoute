"use client";
import { AnalyticsPageTemplate } from "@/components/analytics/AnalyticsPageTemplate";
import { Lightbulb } from "lucide-react";

export default function RecommendationAnalyticsPage() {
  return <AnalyticsPageTemplate title="Recommendation Analytics" icon={Lightbulb} description="Insights into operational recommendation acceptance rates and effectiveness." />;
}
