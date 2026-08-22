"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useCompany } from "@/lib/company-context";
import { useUser } from "@/lib/auth-context";
import { useStore } from "@/lib/store";
import { useSocket } from "@/hooks/use-socket";
import { HealthGauge } from "@/components/analytics/HealthGauge";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { ReportGenerator } from "@/components/analytics/ReportGenerator";
import { AnalyticsLineChart } from "@/components/analytics/charts/LineChart";
import { useAnalyticsFilters } from "@/hooks/use-analytics-filters";
import { ShieldCheck } from "lucide-react";

interface TrendPoint {
  date: string;
  value: number;
}

interface DailyHistorical {
  date: string;
  [key: string]: unknown;
}

interface ForecastDay {
  date: string;
  [key: string]: unknown;
}

interface KPIs {
  healthScore?: number;
  shipments: {
    total: number;
    active: number;
    completed: number;
    cancelled: number;
    atRisk: number;
    delayed: number;
    successRate: number;
    deliveryPerformance: number;
  };
  fleet: {
    total: number;
    available: number;
    assigned: number;
    maintenance: number;
    availabilityRate: number;
    utilizationRate: number;
  };
  drivers: {
    total: number;
    active: number;
    available: number;
    assigned: number;
    offDuty: number;
    suspended: number;
    utilizationRate: number;
  };
  incidents: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export default function ExecutiveDashboardPage() {
  const { company } = useCompany();
  const { user } = useUser();
  const { kpis: storeKpis } = useStore();

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [historicalData, setHistoricalData] = useState<DailyHistorical[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(true);
  const [forecastData, setForecastData] = useState<ForecastDay[]>([]);
  const [forecastLoading, setForecastLoading] = useState(true);

  const { filters, apiQueryString } = useAnalyticsFilters();

  // ── Authenticated fetch helper ──────────────────────────────────────────────
  const authFetch = useCallback(
    async (url: string) => {
      if (!user) return null;
      const token = await user.getIdToken();
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return res.json();
    },
    [user]
  );

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
      const data = await authFetch(`/api/analytics/trends?metric=risk_score${qs ? `&${qs}` : ""}`);
      if (data && Array.isArray(data.trend)) {
        setTrendData(data.trend as TrendPoint[]);
      } else {
        setTrendData([]);
      }
    } catch {
      setTrendData([]);
    } finally {
      setTrendLoading(false);
    }
  }, [company?.companyId, user, authFetch, apiQueryString]);

  const fetchHistorical = useCallback(async () => {
    if (!company?.companyId || !user) return;
    setHistoricalLoading(true);
    try {
      const data = await authFetch(`/api/analytics/historical?days=30`);
      if (data?.trends) setHistoricalData(data.trends as DailyHistorical[]);
    } catch {
      setHistoricalData([]);
    } finally {
      setHistoricalLoading(false);
    }
  }, [company?.companyId, user, authFetch]);

  const fetchForecast = useCallback(async () => {
    if (!company?.companyId || !user) return;
    setForecastLoading(true);
    try {
      const data = await authFetch(`/api/analytics/forecast`);
      if (data?.forecast) setForecastData(data.forecast as ForecastDay[]);
    } catch {
      setForecastData([]);
    } finally {
      setForecastLoading(false);
    }
  }, [company?.companyId, user, authFetch]);

  useEffect(() => {
    fetchKPIs();
    fetchTrend();
  }, [fetchKPIs, fetchTrend]);

  // ── Socket listener for realtime KPI updates ──────────────────────────────
  const socketOptions = useMemo(
    () => ({
      on: {
        "kpis:updated": (data: unknown) => {
          setKpis(data as KPIs);
        },
      },
    }),
    []
  );
  useSocket(socketOptions);

  const effectiveKpis: KPIs = kpis ?? (storeKpis as unknown as KPIs) ?? {
    healthScore: 85,
    shipments: {
      total: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      atRisk: 0,
      delayed: 0,
      successRate: 100,
      deliveryPerformance: 95,
    },
    fleet: {
      total: 0,
      available: 0,
      assigned: 0,
      maintenance: 0,
      availabilityRate: 100,
      utilizationRate: 0,
    },
    drivers: {
      total: 0,
      active: 0,
      available: 0,
      assigned: 0,
      offDuty: 0,
      suspended: 0,
      utilizationRate: 0,
    },
    incidents: {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
  };

  return (
    <div className="w-full pb-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-border mb-6">
        <div className="flex-1">
          <p className="label-meta flex items-center gap-2 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Executive Oversight & Strategic Performance
          </p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise risk overview, financial cost savings estimation, and operational health metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <AnalyticsFilters />
          <ReportGenerator />
        </div>
      </div>

      {/* KPI Grid: Operational Health + 8 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Operational Health - Tall Feature Card */}
        <div className="sm:col-span-1 lg:row-span-2">
          <div className="panel p-5 bg-card h-full flex flex-col justify-center items-center">
            <div className="border-b border-border/40 pb-3 mb-4 w-full">
              <p className="label-meta text-xs">Overall Fleet Reliability</p>
              <h3 className="text-xs font-bold text-foreground">Operational Health</h3>
            </div>
            <HealthGauge score={effectiveKpis.healthScore ?? 85} />
          </div>
        </div>

        {/* Top Row KPI Cards */}
        <div className="panel p-4 bg-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="label-meta text-xs">Active Shipments</p>
              <h3 className="text-lg font-bold text-foreground">{effectiveKpis.shipments.active}</h3>
              <p className="text-xs text-muted-foreground mt-1">Out of 4 total</p>
            </div>
          </div>
        </div>

        <div className="panel p-4 bg-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="label-meta text-xs">Shipment Success Rate</p>
              <h3 className="text-lg font-bold text-foreground">{effectiveKpis.shipments.successRate}%</h3>
              <p className="text-xs text-muted-foreground mt-1">&nbsp;</p>
            </div>
          </div>
        </div>

        <div className="panel p-4 bg-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="label-meta text-xs">At-Risk Shipments</p>
              <h3 className="text-lg font-bold text-foreground">{effectiveKpis.shipments.atRisk}</h3>
              <p className="text-xs text-muted-foreground mt-1">&nbsp;</p>
            </div>
          </div>
        </div>

        <div className="panel p-4 bg-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="label-meta text-xs">Fleet Utilization</p>
              <h3 className="text-lg font-bold text-foreground">{effectiveKpis.fleet.utilizationRate}%</h3>
              <p className="text-xs text-muted-foreground mt-1">1/1 active</p>
            </div>
          </div>
        </div>

        {/* Bottom Row KPI Cards */}
        <div className="panel p-4 bg-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="label-meta text-xs">Fleet Availability</p>
              <h3 className="text-lg font-bold text-foreground">{effectiveKpis.fleet.availabilityRate}%</h3>
              <p className="text-xs text-muted-foreground mt-1">0 in maintenance</p>
            </div>
          </div>
        </div>

        <div className="panel p-4 bg-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="label-meta text-xs">Driver Utilization</p>
              <h3 className="text-lg font-bold text-foreground">{effectiveKpis.drivers.utilizationRate}%</h3>
              <p className="text-xs text-muted-foreground mt-1">0 / 0 assigned</p>
            </div>
          </div>
        </div>

        <div className="panel p-4 bg-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="label-meta text-xs">Total Incidents</p>
              <h3 className="text-lg font-bold text-foreground">{effectiveKpis.incidents.total}</h3>
              <p className="text-xs text-muted-foreground mt-1">1 critical, 0 high</p>
            </div>
          </div>
        </div>

        <div className="panel p-4 bg-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="label-meta text-xs">Delivery Performance</p>
              <h3 className="text-lg font-bold text-foreground">{effectiveKpis.shipments.deliveryPerformance}%</h3>
              <p className="text-xs text-muted-foreground mt-1">1 completed shipment</p>
            </div>
          </div>
        </div>
      </div>

      {/* Corridor Risk Trend */}
      <div className="w-full">
        <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4 px-6">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-foreground">Corridor Risk Trend</h3>
            <p className="text-xs text-muted-foreground">Historical average risk score progression</p>
          </div>
          <span className="label-meta text-xs">{filters.preset ?? "Monthly"} View</span>
        </div>

        <div className="w-full min-w-0">
          <AnalyticsLineChart
            title="Avg Risk Score Progression"
            data={trendData}
            xAxisKey="date"
            lines={[{ key: "value", name: "Avg Risk Score", color: "#c05621" }]}
            isLoading={trendLoading}
          />
        </div>
      </div>
    </div>
  );
}
