"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { useUser } from "@/lib/auth-context";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { ReportGenerator } from "@/components/analytics/ReportGenerator";
import { AnalyticsDonutChart } from "@/components/analytics/charts/DonutChart";
import { useAnalyticsFilters } from "@/hooks/use-analytics-filters";

interface DriverAnalyticsData {
  summary: { total: number; avgRating: number };
  statusDistribution: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  active:    "var(--sr-emerald)",
  inactive:  "#6b7280",
  suspended: "var(--sr-danger)",
};

export default function DriverAnalyticsPage() {
  const { company } = useCompany();
  const { user }    = useUser();

  const [data, setData]         = useState<DriverAnalyticsData | null>(null);
  const [isLoading, setLoading] = useState(true);

  const { apiQueryString } = useAnalyticsFilters();

  const fetchData = useCallback(async () => {
    if (!company?.companyId || !user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const qs    = apiQueryString();
      const res   = await fetch(`/api/analytics/drivers${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json() as DriverAnalyticsData);
    } catch {
      // render empty state
    } finally {
      setLoading(false);
    }
  }, [company?.companyId, user, apiQueryString]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const donutData = data
    ? Object.entries(data.statusDistribution).map(([status, count]) => ({
        name:  status.charAt(0).toUpperCase() + status.slice(1),
        value: count,
        color: STATUS_COLORS[status] ?? "#6b7280",
      }))
    : [];

  const activeCount    = data?.statusDistribution["active"]    ?? 0;
  const suspendedCount = data?.statusDistribution["suspended"] ?? 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            Driver Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Analysis of driver performance, availability, and utilization rates.
          </p>
        </motion.div>
        <ReportGenerator type="executive" title="Driver Report" />
      </div>

      <AnalyticsFilters />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Drivers",  value: isLoading ? "—" : String(data?.summary.total ?? 0),   color: "text-primary" },
          { label: "Active Drivers", value: isLoading ? "—" : String(activeCount),                  color: "text-[var(--sr-emerald)]" },
          { label: "Suspended",      value: isLoading ? "—" : String(suspendedCount),               color: suspendedCount > 0 ? "text-[var(--sr-danger)]" : "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{label}</p>
            <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
          </motion.div>
        ))}
      </div>

      {/* Status Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnalyticsDonutChart title="Driver Status Distribution" data={donutData} isLoading={isLoading} />

        {/* Operational status breakdown (derived from drivers API) */}
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm font-semibold mb-4">Status Breakdown</p>
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-8 rounded bg-muted/20 animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {donutData.map(({ name, value, color }) => (
                <div key={name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                    <span className="text-sm text-muted-foreground">{name}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{value}</span>
                </div>
              ))}
              {donutData.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No driver data available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
