"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { useUser } from "@/lib/auth-context";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { ReportGenerator } from "@/components/analytics/ReportGenerator";
import { AnalyticsDonutChart } from "@/components/analytics/charts/DonutChart";
import { useAnalyticsFilters } from "@/hooks/use-analytics-filters";

interface RecommendationAnalyticsData {
  summary: { total: number; accepted: number; acceptanceRate: number };
  statusDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  accepted: "var(--sr-emerald)",
  rejected: "var(--sr-danger)",
  pending:  "var(--sr-amber)",
  resolved: "var(--primary)",
};

export default function RecommendationAnalyticsPage() {
  const { company } = useCompany();
  const { user }    = useUser();

  const [data, setData]         = useState<RecommendationAnalyticsData | null>(null);
  const [isLoading, setLoading] = useState(true);

  const { apiQueryString } = useAnalyticsFilters();

  const fetchData = useCallback(async () => {
    if (!company?.companyId || !user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const qs    = apiQueryString();
      const res   = await fetch(`/api/analytics/recommendations${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json() as RecommendationAnalyticsData);
    } catch {
      // render empty state
    } finally {
      setLoading(false);
    }
  }, [company?.companyId, user, apiQueryString]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusDonut = data
    ? Object.entries(data.statusDistribution).map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1), value: count,
        color: STATUS_COLORS[status] ?? "#6b7280",
      }))
    : [];

  const typeDonut = data
    ? Object.entries(data.typeDistribution).map(([type, count], i) => ({
        name: type || "Unknown", value: count,
        color: ["var(--primary)", "var(--sr-emerald)", "var(--sr-amber)", "var(--sr-danger)", "#a78bfa", "#34d399"][i % 6],
      }))
    : [];

  const acceptRate = data?.summary.acceptanceRate ?? 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-[var(--sr-amber)]" />
            Recommendation Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Insights into operational recommendation acceptance rates and effectiveness.
          </p>
        </motion.div>
        <ReportGenerator type="executive" title="Recommendation Report" />
      </div>

      <AnalyticsFilters />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Recommendations", value: isLoading ? "—" : String(data?.summary.total ?? 0), color: "text-primary" },
          { label: "Accepted",              value: isLoading ? "—" : String(data?.summary.accepted ?? 0), color: "text-[var(--sr-emerald)]" },
          { label: "Acceptance Rate",       value: isLoading ? "—" : `${acceptRate.toFixed(1)}%`,
            color: acceptRate >= 60 ? "text-[var(--sr-emerald)]" : "text-[var(--sr-amber)]" },
        ].map(({ label, value, color }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{label}</p>
            <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnalyticsDonutChart title="Status Distribution"           data={statusDonut} isLoading={isLoading} />
        <AnalyticsDonutChart title="Recommendation Type Breakdown" data={typeDonut}   isLoading={isLoading} />
      </div>
    </div>
  );
}
