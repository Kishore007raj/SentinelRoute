"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { useUser } from "@/lib/auth-context";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { ReportGenerator } from "@/components/analytics/ReportGenerator";
import { AnalyticsLineChart } from "@/components/analytics/charts/LineChart";
import { useAnalyticsFilters } from "@/hooks/use-analytics-filters";

interface RiskAnalyticsData {
  summary: { totalCalculations: number; avgOverallRisk: number };
  riskTrend: { date: string; overall: number; weather: number; traffic: number; security: number }[];
}

export default function RiskAnalyticsPage() {
  const { company } = useCompany();
  const { user }    = useUser();

  const [data, setData]         = useState<RiskAnalyticsData | null>(null);
  const [isLoading, setLoading] = useState(true);

  const { apiQueryString } = useAnalyticsFilters();

  const fetchData = useCallback(async () => {
    if (!company?.companyId || !user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const qs    = apiQueryString();
      const res   = await fetch(`/api/analytics/risk${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json() as RiskAnalyticsData);
    } catch {
      // render empty state
    } finally {
      setLoading(false);
    }
  }, [company?.companyId, user, apiQueryString]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const avgRisk = data?.summary.avgOverallRisk ?? 0;
  const riskColor =
    avgRisk >= 70 ? "text-[var(--sr-danger)]" :
    avgRisk >= 40 ? "text-[var(--sr-amber)]"  : "text-[var(--sr-emerald)]";

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-[var(--sr-amber)]" />
            Risk Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Evaluation of overall risk factors including weather, traffic, and operational hazards.
          </p>
        </motion.div>
        <ReportGenerator type="risk" title="Risk Report" />
      </div>

      <AnalyticsFilters />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "Risk Calculations",  value: isLoading ? "—" : String(data?.summary.totalCalculations ?? 0), color: "text-primary" },
          { label: "Avg Overall Risk",   value: isLoading ? "—" : `${(avgRisk).toFixed(1)}`, color: riskColor },
        ].map(({ label, value, color }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{label}</p>
            <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
          </motion.div>
        ))}
      </div>

      {/* Multi-line risk trend */}
      <AnalyticsLineChart
        title="Risk Factor Trends"
        data={data?.riskTrend ?? []}
        xAxisKey="date"
        lines={[
          { key: "overall",  name: "Overall Risk", color: "var(--sr-danger)" },
          { key: "weather",  name: "Weather Risk",  color: "var(--primary)" },
          { key: "traffic",  name: "Traffic Risk",  color: "var(--sr-amber)" },
          { key: "security", name: "Security Risk", color: "#a78bfa" },
        ]}
        isLoading={isLoading}
      />
    </div>
  );
}
