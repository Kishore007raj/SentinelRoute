"use client";
import { AnalyticsPageTemplate } from "@/components/analytics/AnalyticsPageTemplate";
import { AlertTriangle } from "lucide-react";

export default function RiskAnalyticsPage() {
  return <AnalyticsPageTemplate title="Risk Analytics" icon={AlertTriangle} description="Evaluation of overall risk factors including weather, traffic, and security." />;
}
