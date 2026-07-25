"use client";
import { AnalyticsPageTemplate } from "@/components/analytics/AnalyticsPageTemplate";
import { Activity } from "lucide-react";

export default function OperationalAnalyticsPage() {
  return <AnalyticsPageTemplate title="Operational Analytics" icon={Activity} description="Comprehensive view of operational health scores and performance trends." />;
}
