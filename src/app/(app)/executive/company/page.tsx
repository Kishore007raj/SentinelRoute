"use client";
import { AnalyticsPageTemplate } from "@/components/analytics/AnalyticsPageTemplate";
import { Building } from "lucide-react";

export default function CompanyAnalyticsPage() {
  return <AnalyticsPageTemplate title="Company Analytics" icon={Building} description="Overview of company user distribution and organizational metrics." />;
}
