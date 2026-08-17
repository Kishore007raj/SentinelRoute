"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useCompany } from "@/lib/company-context";
import { useUser } from "@/lib/auth-context";
import { useStore } from "@/lib/store";
import { useSocket } from "@/hooks/use-socket";
import { HealthGauge } from "@/components/analytics/HealthGauge";
import { ExecutiveSummaryCards, type KPIs } from "@/components/analytics/ExecutiveSummaryCards";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { ReportGenerator } from "@/components/analytics/ReportGenerator";
import { AnalyticsLineChart } from "@/components/analytics/charts/LineChart";
import { useAnalyticsFilters } from "@/hooks/use-analytics-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp } from "lucide-react";

interface TrendPoint { date: string; value: number }

export default function ExecutiveDashboardPage() {
  const { company }  = useCompany();
  const { user }     = useUser();
  const { kpis: storeKpis } = useStore();

  const [kpis, setKpis]             = useState<KPIs | null>(null);
  const [trendData, setTrendData]   = useState<TrendPoint[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);

  const { filters, apiQueryString } = useAnalyticsFilters();

  // ── Authenticated fetch helper ──────────────────────────────────────────────
  const authFetch = useCallback(async (url: string) => {
    if (!user) return null;
    const token = await user.getIdToken();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return res.json();
  }, [user]);

  const fetchKPIs = useCallback(async () => {
    if (!company?.companyId || !user) return;
    setIsLoading(true);
    try {
      const qs = apiQueryString();
      const data = await authFetch(`/api/analytics/kpis${qs ? `?${qs}` : ""}`);
      if (data) setKpis(data as KPIs);
    } catch {
      // non-fatal — empty state will render
    } finally {
      setIsLoading(false);
    }
  }, [company?.companyId, user, authFetch, apiQueryString]);

  const fetchTrend = useCallback(async () => {
    if (!company?.companyId || !user) return;
    setTrendLoading(true);
    try {
      const qs = apiQueryString();
      const preset = filters.preset ?? "monthly";
      const granularity = preset === "today" || preset === "daily" || preset === "weekly" ? "daily" : "monthly";
      const data = await authFetch(
        `/api/analytics/trends?metric=shipment_volume&granularity=${granularity}${qs ? `&${qs}` : ""}`
      );
      if (data?.trend) setTrendData(data.trend as TrendPoint[]);
    } catch {
      setTrendData([]);
    } finally {
      setTrendLoading(false);
    }
  }, [company?.companyId, user, authFetch, apiQueryString, filters.preset]);

  // Refetch when filters change
  useEffect(() => {
    fetchKPIs();
    fetchTrend();
  }, [fetchKPIs, fetchTrend]);

  // Sync kpi:updated socket event from StoreProvider into local state
  useEffect(() => {
    if (storeKpis) setKpis(storeKpis as KPIs);
  }, [storeKpis]);

  // Listen for analytics:refresh events (emitted by server when shipment data changes)
  useSocket({
    on: {
      "analytics:refresh": () => {
        fetchKPIs();
        fetchTrend();
      },
      "kpi:updated": (data: unknown) => {
        if (data && typeof data === "object") {
          setKpis(data as KPIs);
        }
      },
    },
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Executive Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time intelligence and operational overview for {company?.companyName ?? "your company"}.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2"
        >
          <ReportGenerator type="executive" title="Executive Report" />
        </motion.div>
      </div>

      {/* Filters */}
      <AnalyticsFilters />

      {/* Main KPI Grid */}
      <ExecutiveSummaryCards kpis={kpis} isLoading={isLoading} />

      {/* Secondary: Health Score + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Operational Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-1"
        >
          <Card className="panel h-full">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Operational Health
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center pt-6 pb-10 h-[calc(100%-4rem)]">
              {isLoading ? (
                <div className="w-48 h-48 rounded-full border-8 border-muted animate-pulse" />
              ) : (
                <HealthGauge score={kpis?.healthScore ?? 0} size="xl" />
              )}
              <p className="text-sm text-center text-muted-foreground mt-8 max-w-[200px]">
                Calculated from delivery performance, risk levels, and fleet availability.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Shipment Volume Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="lg:col-span-2"
        >
          <AnalyticsLineChart
            title="Shipment Volume Trend"
            data={trendData}
            xAxisKey="date"
            lines={[{ key: "value", name: "Shipments", color: "var(--primary)" }]}
            isLoading={trendLoading}
          />
        </motion.div>

      </div>

      {/* KPI breakdown row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="panel">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Quick Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-16 rounded-lg bg-muted/20 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Shipments", value: kpis?.shipments?.total ?? 0, color: "text-primary" },
                  { label: "Success Rate", value: `${kpis?.shipments?.successRate ?? 0}%`, color: "text-[var(--sr-emerald)]" },
                  { label: "At-Risk", value: kpis?.shipments?.atRisk ?? 0, color: "text-[var(--sr-danger)]" },
                  { label: "Incidents", value: kpis?.incidents?.total ?? 0, color: "text-[var(--sr-amber)]" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-muted/10 rounded-lg p-4 border border-border/50">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{label}</p>
                    <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
