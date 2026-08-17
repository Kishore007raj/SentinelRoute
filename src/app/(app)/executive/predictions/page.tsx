"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { useUser } from "@/lib/auth-context";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { ReportGenerator } from "@/components/analytics/ReportGenerator";
import { AnalyticsLineChart } from "@/components/analytics/charts/LineChart";
import { useAnalyticsFilters } from "@/hooks/use-analytics-filters";

interface PredictionAnalyticsData {
  summary: { total: number; avgConfidence: number };
  confidenceTrend: { date: string; confidence: number; volume: number }[];
}

export default function PredictionAnalyticsPage() {
  const { company } = useCompany();
  const { user }    = useUser();

  const [data, setData]         = useState<PredictionAnalyticsData | null>(null);
  const [isLoading, setLoading] = useState(true);

  const { apiQueryString } = useAnalyticsFilters();

  const fetchData = useCallback(async () => {
    if (!company?.companyId || !user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const qs    = apiQueryString();
      const res   = await fetch(`/api/analytics/predictions${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json() as PredictionAnalyticsData);
    } catch {
      // render empty state
    } finally {
      setLoading(false);
    }
  }, [company?.companyId, user, apiQueryString]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const avgConfidence = data?.summary.avgConfidence ?? 0;
  const confColor =
    avgConfidence >= 80 ? "text-[var(--sr-emerald)]" :
    avgConfidence >= 60 ? "text-[var(--sr-amber)]"   : "text-[var(--sr-danger)]";

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-primary" />
            Prediction Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Analysis of route prediction accuracy and confidence trends.
          </p>
        </motion.div>
        <ReportGenerator type="executive" title="Prediction Report" />
      </div>

      <AnalyticsFilters />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "Total Predictions",    value: isLoading ? "—" : String(data?.summary.total ?? 0),          color: "text-primary" },
          { label: "Avg Confidence Score", value: isLoading ? "—" : `${avgConfidence.toFixed(1)}%`,             color: confColor },
        ].map(({ label, value, color }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{label}</p>
            <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
          </motion.div>
        ))}
      </div>

      {/* Confidence Trend */}
      <AnalyticsLineChart
        title="Prediction Confidence Trend"
        data={data?.confidenceTrend ?? []}
        xAxisKey="date"
        lines={[
          { key: "confidence", name: "Avg Confidence (%)", color: "var(--sr-emerald)" },
          { key: "volume",     name: "Prediction Volume",   color: "var(--primary)" },
        ]}
        isLoading={isLoading}
      />
    </div>
  );
}
