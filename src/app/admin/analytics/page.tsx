"use client";

/**
 * Platform Analytics — derives real metrics from MongoDB via the
 * existing Module 9 TrendEngine and dashboard aggregations.
 *
 * Cross-tenant growth metrics use aggregation pipelines scoped to the
 * last 30 days vs the 30 days prior. No hardcoded percentages.
 */
import { useEffect, useState, useCallback } from "react";
import { BarChart3, Building2, Package, Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  // null = no previous baseline (e.g. first 30 days of activity)
  // This is NOT a -100% decline. Show "New" instead.
  if (pct === null) return (
    <span className="text-xs text-muted-foreground italic">No prior period data</span>
  );
  if (pct > 0) return (
    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500">
      <TrendingUp className="w-3.5 h-3.5" /> +{pct.toFixed(1)}% MoM
    </span>
  );
  if (pct < 0) return (
    <span className="flex items-center gap-1 text-xs font-semibold text-rose-500">
      <TrendingDown className="w-3.5 h-3.5" /> {pct.toFixed(1)}% MoM
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
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
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  // Gate on auth — fetchApi needs the Firebase token
  useEffect(() => {
    if (!authLoading && user) fetchData();
  }, [authLoading, user, fetchData]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-purple-500" />
            Platform Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cross-tenant growth and activity metrics derived from real operational data.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
          {error}{" "}
          <button onClick={fetchData} className="underline ml-2">retry</button>
        </div>
      )}

      {/* Top-level KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tenant growth */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Building2 className="w-4 h-4" /> Tenants Registered
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 bg-muted/30 rounded animate-pulse" />
            ) : (
              <>
                <p className="text-3xl font-bold tabular-nums">
                  {data?.totalCompanies.toLocaleString() ?? 0}
                </p>
                <div className="mt-1.5">
                  <TrendBadge pct={data?.companyGrowth.percentChange ?? null} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  +{data?.companyGrowth.thisMonth ?? 0} this month
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Shipment volume */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Package className="w-4 h-4" /> Shipment Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 bg-muted/30 rounded animate-pulse" />
            ) : (
              <>
                <p className="text-3xl font-bold tabular-nums">
                  {data?.totalShipments.toLocaleString() ?? 0}
                </p>
                <div className="mt-1.5">
                  <TrendBadge pct={data?.shipmentVolume.percentChange ?? null} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  +{data?.shipmentVolume.thisMonth ?? 0} this month
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* User growth */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" /> Platform Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 bg-muted/30 rounded animate-pulse" />
            ) : (
              <>
                <p className="text-3xl font-bold tabular-nums">
                  {data?.totalUsers.toLocaleString() ?? 0}
                </p>
                <div className="mt-1.5">
                  <TrendBadge pct={data?.userGrowth.percentChange ?? null} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  +{data?.userGrowth.thisMonth ?? 0} this month
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily shipment trend */}
      <AnalyticsLineChart
        title="Daily Shipment Volume (Last 30 Days)"
        data={data?.dailyShipments ?? []}
        xAxisKey="date"
        lines={[{ key: "value", name: "Shipments", color: "var(--primary)" }]}
        isLoading={loading}
      />
    </div>
  );
}
