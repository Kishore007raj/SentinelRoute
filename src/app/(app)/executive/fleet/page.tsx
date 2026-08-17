"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Truck } from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { useUser } from "@/lib/auth-context";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { ReportGenerator } from "@/components/analytics/ReportGenerator";
import { AnalyticsDonutChart } from "@/components/analytics/charts/DonutChart";
import { useAnalyticsFilters } from "@/hooks/use-analytics-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FleetAnalyticsData {
  summary: { total: number };
  statusDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  available:   "var(--sr-emerald)",
  assigned:    "var(--primary)",
  maintenance: "var(--sr-amber)",
  inactive:    "#6b7280",
};

export default function FleetAnalyticsPage() {
  const { company } = useCompany();
  const { user }    = useUser();

  const [data, setData]         = useState<FleetAnalyticsData | null>(null);
  const [isLoading, setLoading] = useState(true);

  const { apiQueryString } = useAnalyticsFilters();

  const fetchData = useCallback(async () => {
    if (!company?.companyId || !user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const qs    = apiQueryString();
      const res   = await fetch(`/api/analytics/fleet${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json() as FleetAnalyticsData);
    } catch {
      // render empty state
    } finally {
      setLoading(false);
    }
  }, [company?.companyId, user, apiQueryString]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusDonut = data
    ? Object.entries(data.statusDistribution).map(([s, c]) => ({
        name: s.charAt(0).toUpperCase() + s.slice(1), value: c,
        color: STATUS_COLORS[s] ?? "#6b7280",
      }))
    : [];

  const typeDonut = data
    ? Object.entries(data.typeDistribution).map(([type, count], i) => ({
        name: type || "Unknown", value: count,
        color: ["var(--primary)", "var(--sr-emerald)", "var(--sr-amber)", "var(--sr-danger)", "#a78bfa"][i % 5],
      }))
    : [];

  const utilRate = data
    ? data.summary.total > 0
      ? Math.round(((data.statusDistribution["assigned"] ?? 0) / data.summary.total) * 100)
      : 0
    : 0;

  const availRate = data
    ? data.summary.total > 0
      ? Math.round(((data.statusDistribution["available"] ?? 0) / data.summary.total) * 100)
      : 0
    : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Truck className="w-8 h-8 text-primary" />
            Fleet Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Insights into vehicle utilization, maintenance trends, and fleet availability.
          </p>
        </motion.div>
        <ReportGenerator type="executive" title="Fleet Report" />
      </div>

      <AnalyticsFilters />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Vehicles",    value: isLoading ? "—" : String(data?.summary.total ?? 0),                color: "text-primary" },
          { label: "Utilization Rate",  value: isLoading ? "—" : `${utilRate}%`,                                  color: "text-[var(--sr-emerald)]" },
          { label: "Availability Rate", value: isLoading ? "—" : `${availRate}%`,                                  color: "text-[var(--sr-emerald)]" },
          { label: "In Maintenance",    value: isLoading ? "—" : String(data?.statusDistribution["maintenance"] ?? 0), color: "text-[var(--sr-amber)]" },
        ].map(({ label, value, color }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{label}</p>
            <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnalyticsDonutChart title="Fleet Status Distribution" data={statusDonut} isLoading={isLoading} />
        <AnalyticsDonutChart title="Fleet Type Distribution"   data={typeDonut}   isLoading={isLoading} />
      </div>

      {/* Legend */}
      {!isLoading && data && (
        <Card className="panel">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Vehicle Type Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(data.typeDistribution).map(([type, count]) => (
                <div key={type} className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">{type || "Unknown"}</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">{count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
