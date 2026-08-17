"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { useUser } from "@/lib/auth-context";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { ReportGenerator } from "@/components/analytics/ReportGenerator";
import { AnalyticsLineChart } from "@/components/analytics/charts/LineChart";
import { useAnalyticsFilters } from "@/hooks/use-analytics-filters";

interface OperationalData {
  healthTrend: { date: string; score: number }[];
}

export default function OperationalAnalyticsPage() {
  const { company } = useCompany();
  const { user }    = useUser();

  const [data, setData]         = useState<OperationalData | null>(null);
  const [isLoading, setLoading] = useState(true);

  const { filters, apiQueryString } = useAnalyticsFilters();

  const fetchData = useCallback(async () => {
    if (!company?.companyId || !user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const qs    = apiQueryString();
      const res   = await fetch(`/api/analytics/operational${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json() as OperationalData);
    } catch {
      // render empty state
    } finally {
      setLoading(false);
    }
  }, [company?.companyId, user, apiQueryString]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Latest score from trend
  const latestScore = data?.healthTrend?.length
    ? data.healthTrend[data.healthTrend.length - 1].score
    : null;

  const avgScore = data?.healthTrend?.length
    ? Math.round(data.healthTrend.reduce((s, d) => s + d.score, 0) / data.healthTrend.length)
    : null;

  const preset = filters.preset ?? "monthly";
  const granularity = preset === "today" || preset === "daily" || preset === "weekly" ? "daily" : "monthly";

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" />
            Operational Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive view of operational health scores and performance trends.
          </p>
        </motion.div>
        <ReportGenerator type="operational" title="Operational Report" />
      </div>

      <AnalyticsFilters />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Latest Health Score",
            value: isLoading ? "—" : latestScore !== null ? `${latestScore.toFixed(0)}` : "N/A",
            color: latestScore !== null && latestScore >= 70 ? "text-[var(--sr-emerald)]" : "text-[var(--sr-amber)]"
          },
          {
            label: "Avg Health Score",
            value: isLoading ? "—" : avgScore !== null ? `${avgScore}` : "N/A",
            color: "text-primary"
          },
          {
            label: "Data Points",
            value: isLoading ? "—" : String(data?.healthTrend?.length ?? 0),
            color: "text-muted-foreground"
          },
        ].map(({ label, value, color }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{label}</p>
            <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
          </motion.div>
        ))}
      </div>

      {/* Health trend chart */}
      <AnalyticsLineChart
        title={`Operational Health Trend (${granularity})`}
        data={data?.healthTrend ?? []}
        xAxisKey="date"
        lines={[{ key: "score", name: "Health Score", color: "var(--sr-emerald)" }]}
        isLoading={isLoading}
      />
    </div>
  );
}
