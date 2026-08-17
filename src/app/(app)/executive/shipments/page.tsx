"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Package } from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { useUser } from "@/lib/auth-context";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { ReportGenerator } from "@/components/analytics/ReportGenerator";
import { AnalyticsLineChart } from "@/components/analytics/charts/LineChart";
import { AnalyticsDonutChart } from "@/components/analytics/charts/DonutChart";
import { useAnalyticsFilters } from "@/hooks/use-analytics-filters";

interface ShipmentAnalyticsData {
  summary: { total: number; avgDistance: number; avgDuration: number };
  statusDistribution: Record<string, number>;
  dailyVolume: { date: string; volume: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  active:    "var(--primary)",
  "at-risk": "var(--sr-danger)",
  completed: "var(--sr-emerald)",
  cancelled: "var(--muted-foreground)",
  draft:     "#6b7280",
};

export default function ShipmentsAnalyticsPage() {
  const { company } = useCompany();
  const { user }    = useUser();

  const [data, setData]         = useState<ShipmentAnalyticsData | null>(null);
  const [isLoading, setLoading] = useState(true);

  const { apiQueryString } = useAnalyticsFilters();

  const fetchData = useCallback(async () => {
    if (!company?.companyId || !user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const qs    = apiQueryString();
      const res   = await fetch(`/api/analytics/shipments${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json() as ShipmentAnalyticsData;
        setData(json);
      }
    } catch {
      // render empty state
    } finally {
      setLoading(false);
    }
  }, [company?.companyId, user, apiQueryString]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build donut data from statusDistribution
  const donutData = data
    ? Object.entries(data.statusDistribution).map(([status, count]) => ({
        name:  status.charAt(0).toUpperCase() + status.slice(1),
        value: count,
        color: STATUS_COLORS[status] ?? "#6b7280",
      }))
    : [];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Package className="w-8 h-8 text-primary" />
            Shipment Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            In-depth analysis of shipment volumes, status distribution, and delivery performance.
          </p>
        </motion.div>
        <ReportGenerator type="shipment" title="Shipment Report" />
      </div>

      {/* Filters */}
      <AnalyticsFilters
        showStatusFilter
        statusOptions={[
          { label: "Active",    value: "active" },
          { label: "At Risk",   value: "at-risk" },
          { label: "Completed", value: "completed" },
          { label: "Cancelled", value: "cancelled" },
        ]}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Shipments", value: isLoading ? "—" : String(data?.summary.total ?? 0), color: "text-primary" },
          { label: "Avg Distance", value: isLoading ? "—" : `${(data?.summary.avgDistance ?? 0).toFixed(0)} km`, color: "text-[var(--sr-emerald)]" },
          { label: "Statuses Tracked", value: isLoading ? "—" : String(Object.keys(data?.statusDistribution ?? {}).length), color: "text-[var(--sr-amber)]" },
        ].map(({ label, value, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{label}</p>
            <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AnalyticsLineChart
            title="Daily Shipment Volume"
            data={data?.dailyVolume ?? []}
            xAxisKey="date"
            lines={[{ key: "volume", name: "Shipments", color: "var(--primary)" }]}
            isLoading={isLoading}
          />
        </div>
        <div>
          <AnalyticsDonutChart
            title="Status Distribution"
            data={donutData}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
