"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, AlertTriangle, ShieldAlert, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPIData {
  avgOperationalRisk:       number;
  activeAlerts:             number;
  highRiskShipments:        number;
  avgDelayProbability:      number;
  avgDisruptionProbability: number;
  avgEtaConfidence:         number;
  basedOnPredictions:       number;
  computedAt:               string;
}

interface Alert {
  alertId:           string;
  shipmentId?:       string;
  reason:            string;
  recommendedAction: string;
  confidence:        number;
  timestamp:         string;
  status:            string;
  severity?:         string;
}

function RiskTrendBadge({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Minus className="w-4 h-4" />
        <span className="text-sm font-medium">No prior data</span>
      </div>
    );
  }
  const delta = current - previous;
  if (Math.abs(delta) < 3) {
    return (
      <div className="flex items-center gap-1 text-emerald-500">
        <Minus className="w-4 h-4" />
        <span className="text-sm font-medium">Stable</span>
      </div>
    );
  }
  if (delta > 0) {
    return (
      <div className="flex items-center gap-1 text-red-500">
        <TrendingUp className="w-4 h-4" />
        <span className="text-sm font-medium">Increasing (+{Math.round(delta)})</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-emerald-500">
      <TrendingDown className="w-4 h-4" />
      <span className="text-sm font-medium">Decreasing ({Math.round(delta)})</span>
    </div>
  );
}

export default function RiskCenterPage() {
  const [alerts, setAlerts]         = useState<Alert[]>([]);
  const [loading, setLoading]       = useState(true);
  const [kpis, setKpis]             = useState<KPIData | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  // Store two consecutive KPI snapshots to compute trend
  const [prevRisk, setPrevRisk]     = useState<number | null>(null);

  const fetchKpis = useCallback(async () => {
    try {
      const res = await fetch("/api/intelligence/kpis");
      if (res.ok) {
        const data: KPIData = await res.json();
        setKpis((prev) => {
          // Keep the previous risk score for trend computation
          if (prev !== null) setPrevRisk(prev.avgOperationalRisk);
          return data;
        });
      }
    } finally {
      setKpisLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/intelligence/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchKpis(), fetchAlerts()]);
    // Refresh KPIs every 60 seconds
    const interval = setInterval(fetchKpis, 60_000);
    return () => clearInterval(interval);
  }, [fetchKpis, fetchAlerts]);

  const handleUpdateAlertStatus = async (alertId: string, status: "acknowledged" | "resolved") => {
    try {
      const res = await fetch(`/api/intelligence/alerts/${alertId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
      if (res.ok) {
        setAlerts((prev) => prev.map((a) => (a.alertId === alertId ? { ...a, status } : a)));
        fetchKpis();
      }
    } catch (err) {
      console.error("Error updating alert status:", err);
    }
  };

  const riskScore = kpis?.avgOperationalRisk ?? 0;
  const riskLabel = riskScore > 70 ? "Critical" : riskScore > 50 ? "High" : riskScore > 25 ? "Medium" : "Low";
  const riskColor = riskScore > 70 ? "text-red-500" : riskScore > 50 ? "text-orange-500" : riskScore > 25 ? "text-amber-500" : "text-emerald-500";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Risk Center</h1>
        <p className="text-muted-foreground">
          Live operational risk intelligence for your logistics network.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Company Risk Score */}
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-destructive/10 text-destructive rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm">Company Risk Score</h3>
          </div>
          <p className={cn("text-3xl font-bold", kpisLoading ? "text-muted-foreground" : riskColor)}>
            {kpisLoading ? "…" : riskScore}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{riskLabel} risk level</p>
        </div>

        {/* Active Alerts */}
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm">Active Alerts</h3>
          </div>
          <p className="text-3xl font-bold">{kpisLoading ? "…" : kpis?.activeAlerts ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">across corridors</p>
        </div>

        {/* Critical Shipments */}
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm">High Risk Shipments</h3>
          </div>
          <p className="text-3xl font-bold">{kpisLoading ? "…" : kpis?.highRiskShipments ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">require attention</p>
        </div>

        {/* Risk Trend — computed from real data */}
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm">Risk Trend</h3>
          </div>
          <div className="text-2xl font-bold">
            {kpisLoading ? (
              <span className="text-muted-foreground text-3xl">…</span>
            ) : (
              <RiskTrendBadge current={riskScore} previous={prevRisk} />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {kpis?.basedOnPredictions
              ? `Based on ${kpis.basedOnPredictions} predictions`
              : "Computed from live predictions"}
          </p>
        </div>
      </div>

      {/* Secondary KPI strip — avg delay, disruption, ETA confidence */}
      {kpis && kpis.basedOnPredictions > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Avg Delay Probability", value: `${kpis.avgDelayProbability}%`, color: kpis.avgDelayProbability > 50 ? "text-red-500" : kpis.avgDelayProbability > 30 ? "text-amber-500" : "text-emerald-500" },
            { label: "Disruption Probability", value: `${kpis.avgDisruptionProbability}%`, color: kpis.avgDisruptionProbability > 40 ? "text-orange-500" : "text-emerald-500" },
            { label: "ETA Confidence", value: `${kpis.avgEtaConfidence}%`, color: kpis.avgEtaConfidence < 60 ? "text-red-500" : kpis.avgEtaConfidence < 80 ? "text-amber-500" : "text-emerald-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
              <p className={cn("text-2xl font-bold", color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Operational Alerts */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border bg-muted/30 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Operational Alerts</h2>
          <span className="text-xs text-muted-foreground">
            {alerts.filter((a) => a.status === "active").length} active
          </span>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading alerts…</div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No active alerts — all corridors nominal.</div>
          ) : (
            <div className="divide-y divide-border">
              {alerts.map((alert) => (
                <div
                  key={alert.alertId}
                  className="p-5 flex items-start justify-between hover:bg-muted/30 transition-colors gap-4"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{alert.reason}</p>
                      <span className={cn(
                        "text-[10px] uppercase font-bold px-2 py-0.5 rounded",
                        alert.status === "active"
                          ? "bg-destructive/10 text-destructive"
                          : alert.status === "acknowledged"
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-green-600/10 text-green-600"
                      )}>
                        {alert.status}
                      </span>
                      {alert.severity && (
                        <span className={cn(
                          "text-[10px] uppercase font-bold px-2 py-0.5 rounded",
                          alert.severity === "critical" ? "bg-red-600/10 text-red-600" :
                          alert.severity === "high"     ? "bg-orange-500/10 text-orange-500" :
                                                          "bg-blue-500/10 text-blue-500"
                        )}>
                          {alert.severity}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Action: {alert.recommendedAction}</p>
                    {alert.shipmentId && (
                      <p className="text-xs text-primary mt-1">Shipment: {alert.shipmentId}</p>
                    )}
                  </div>
                  <div className="text-right flex flex-col items-end gap-2 shrink-0">
                    <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">
                      {alert.confidence}% confidence
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {alert.status === "active" && (
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => handleUpdateAlertStatus(alert.alertId, "acknowledged")}
                          className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium px-2 py-1 rounded transition-colors"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={() => handleUpdateAlertStatus(alert.alertId, "resolved")}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white font-medium px-2 py-1 rounded transition-colors"
                        >
                          Resolve
                        </button>
                      </div>
                    )}
                    {alert.status === "acknowledged" && (
                      <button
                        onClick={() => handleUpdateAlertStatus(alert.alertId, "resolved")}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white font-medium px-2 py-1 rounded transition-colors mt-1"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
