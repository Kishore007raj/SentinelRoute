"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, Building2, Package, Users, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api-client";
import { AnalyticsLineChart } from "@/components/analytics/charts/LineChart";
import { useUser } from "@/lib/auth-context";

interface PlatformAnalyticsData {
  companyGrowth: {
    thisMonth:   number;
    lastMonth:   number;
    delta:       number;
    percentChange: number | null; // null when lastMonth === 0
  };
  shipmentVolume: {
    thisMonth:   number;
    lastMonth:   number;
    delta:       number;
    percentChange: number | null;
  };
  userGrowth: {
    thisMonth:   number;
    lastMonth:   number;
    delta:       number;
    percentChange: number | null;
  };
  dailyShipments: { date: string; value: number }[];
  totalCompanies:  number;
  totalShipments:  number;
  totalUsers:      number;
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return (
    <span className="text-[11px] text-muted-foreground italic font-mono">No prior period data</span>
  );
  if (pct > 0) return (
    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 font-mono">
      <TrendingUp className="w-3.5 h-3.5" /> +{pct.toFixed(1)}% MoM
    </span>
  );
  if (pct < 0) return (
    <span className="flex items-center gap-1 text-xs font-semibold text-rose-400 font-mono">
      <TrendingDown className="w-3.5 h-3.5" /> {pct.toFixed(1)}% MoM
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
      <Minus className="w-3.5 h-3.5" /> No change
    </span>
  );
}

export default function GlobalAnalyticsCenter() {
  const [data, setData]     = useState<PlatformAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const { user, loading: authLoading } = useUser();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi("/api/admin/analytics");
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server ${res.status}`);
      }
      setData(await res.json() as PlatformAnalyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load platform analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  // Gate on auth — fetchApi needs the Firebase token
  useEffect(() => {
    if (!authLoading && user) fetchData();
  }, [authLoading, user, fetchData]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-500" />
              Platform Analytics
            </h1>
            <span className="label-meta bg-muted/40 px-2 py-0.5 rounded border border-border">
              30-Day Aggregation Window
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Cross-tenant throughput, capacity growth, and shipment volume metrics.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="h-8 text-xs gap-1.5 border-border"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Analytics</span>
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-rose-500/20 bg-rose-500/10 text-xs text-rose-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchData} className="underline font-semibold ml-2">retry</button>
        </div>
      )}

      {/* Top-level Growth KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tenant growth */}
        <div className="panel p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="label-meta">Tenants Registered</span>
              <div className="p-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded">
                <Building2 className="w-3.5 h-3.5" />
              </div>
            </div>
            {loading ? (
              <div className="h-9 bg-muted/30 rounded animate-pulse w-24" />
            ) : (
              <>
                <p className="text-2xl sm:text-3xl font-bold font-mono text-foreground tracking-tight">
                  {data?.totalCompanies.toLocaleString() ?? 0}
                </p>
                <div className="mt-2">
                  <TrendBadge pct={data?.companyGrowth.percentChange ?? null} />
                </div>
              </>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground font-mono">
            +{data?.companyGrowth.thisMonth ?? 0} organizations this month
          </div>
        </div>

        {/* Shipment volume */}
        <div className="panel p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="label-meta">Global Shipment Volume</span>
              <div className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                <Package className="w-3.5 h-3.5" />
              </div>
            </div>
            {loading ? (
              <div className="h-9 bg-muted/30 rounded animate-pulse w-24" />
            ) : (
              <>
                <p className="text-2xl sm:text-3xl font-bold font-mono text-foreground tracking-tight">
                  {data?.totalShipments.toLocaleString() ?? 0}
                </p>
                <div className="mt-2">
                  <TrendBadge pct={data?.shipmentVolume.percentChange ?? null} />
                </div>
              </>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground font-mono">
            +{data?.shipmentVolume.thisMonth ?? 0} dispatches this month
          </div>
        </div>

        {/* User growth */}
        <div className="panel p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="label-meta">Platform Users</span>
              <div className="p-1.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            {loading ? (
              <div className="h-9 bg-muted/30 rounded animate-pulse w-24" />
            ) : (
              <>
                <p className="text-2xl sm:text-3xl font-bold font-mono text-foreground tracking-tight">
                  {data?.totalUsers.toLocaleString() ?? 0}
                </p>
                <div className="mt-2">
                  <TrendBadge pct={data?.userGrowth.percentChange ?? null} />
                </div>
              </>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground font-mono">
            +{data?.userGrowth.thisMonth ?? 0} accounts this month
          </div>
        </div>
      </div>

      {/* Daily shipment trend */}
      <div className="panel p-6">
        <AnalyticsLineChart
          title="Daily Platform Shipment Volume (Last 30 Days)"
          data={data?.dailyShipments ?? []}
          xAxisKey="date"
          lines={[{ key: "value", name: "Dispatches", color: "var(--primary)" }]}
          isLoading={loading}
        />
      </div>
    </div>
  );
}
