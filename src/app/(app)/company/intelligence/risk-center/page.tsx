"use client";

import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Activity, AlertTriangle, ShieldAlert, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIntelligence } from "@/hooks/use-intelligence";
import { fetchApi } from "@/lib/api-client";

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
  // Single source of truth - useIntelligence owns kpis, alerts, loading states, and prevRisk.
  const {
    kpis,
    alerts,
    loadingKpis,
    loadingAlerts,
    prevRisk,
    refresh,
    setAlerts,
  } = useIntelligence({ fetchKpis: true, fetchAlerts: true });

  const handleUpdateAlertStatus = async (alertId: string, status: "acknowledged" | "resolved") => {
    // Optimistic update
    setAlerts((prev) => prev.map((a) => (a.alertId === alertId ? { ...a, status } : a)));
    try {
      const res = await fetchApi(`/api/intelligence/alerts/${alertId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
      if (!res.ok) {
        setAlerts((prev) => prev.map((a) => (a.alertId === alertId ? { ...a, status: "active" } : a)));
        console.error("Error updating alert status:", res.status);
      } else {
        refresh();
      }
    } catch (err) {
      setAlerts((prev) => prev.map((a) => (a.alertId === alertId ? { ...a, status: "active" } : a)));
      console.error("Error updating alert status:", err);
    }
  };

  const riskScore = kpis?.avgOperationalRisk ?? 0;
  const riskLabel = riskScore > 70 ? "Critical" : riskScore > 50 ? "High" : riskScore > 25 ? "Medium" : "Low";
  const riskColor = riskScore > 70 ? "text-red-500" : riskScore > 50 ? "text-orange-500" : riskScore > 25 ? "text-amber-500" : "text-emerald-500";

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col gap-2 pb-8 border-b border-border">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Operational Intelligence</p>
        <h1 className="text-3xl font-bold tracking-tight">Risk Center</h1>
        <p className="text-muted-foreground">
          Live operational risk intelligence for your logistics network.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <DashboardCard icon={ShieldAlert} title="Company Risk Score" noPadding className="p-5">
          <p className={cn("text-3xl font-bold mt-2", loadingKpis ? "text-muted-foreground" : riskColor)}>
            {loadingKpis ? "..." : riskScore}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{riskLabel} risk level</p>
        </DashboardCard>

        <DashboardCard icon={Activity} title="Active Alerts" noPadding className="p-5">
          <p className="text-3xl font-bold mt-2">{loadingKpis ? "..." : kpis?.activeAlerts ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">across corridors</p>
        </DashboardCard>

        <DashboardCard icon={AlertTriangle} title="High Risk Shipments" noPadding className="p-5">
          <p className="text-3xl font-bold mt-2">{loadingKpis ? "..." : kpis?.highRiskShipments ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">require attention</p>
        </DashboardCard>

        <DashboardCard icon={TrendingUp} title="Risk Trend" noPadding className="p-5">
          <div className="text-2xl font-bold mt-2">
            {loadingKpis ? (
              <span className="text-muted-foreground text-3xl">...</span>
            ) : (
              <RiskTrendBadge current={riskScore} previous={prevRisk} />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {kpis?.basedOnPredictions
              ? `Based on ${kpis.basedOnPredictions} predictions`
              : "Computed from live predictions"}
          </p>
        </DashboardCard>
      </div>

      {kpis && kpis.basedOnPredictions > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Avg Delay Probability", value: `${kpis.avgDelayProbability}%`, color: kpis.avgDelayProbability > 50 ? "text-red-500" : kpis.avgDelayProbability > 30 ? "text-amber-500" : "text-emerald-500" },
            { label: "Disruption Probability", value: `${kpis.avgDisruptionProbability}%`, color: kpis.avgDisruptionProbability > 40 ? "text-orange-500" : "text-emerald-500" },
            { label: "ETA Confidence", value: `${kpis.avgEtaConfidence}%`, color: kpis.avgEtaConfidence < 60 ? "text-red-500" : kpis.avgEtaConfidence < 80 ? "text-amber-500" : "text-emerald-500" },
          ].map(({ label, value, color }) => (
            <DashboardCard key={label} noPadding className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
              <p className={cn("text-2xl font-bold", color)}>{value}</p>
            </DashboardCard>
          ))}
        </div>
      )}

      <DashboardCard
        icon={AlertTriangle}
        title="Operational Alerts"
        action={<span className="text-xs text-muted-foreground">{alerts.filter((a) => a.status === "active").length} active</span>}
        noPadding
      >
          {loadingAlerts ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No active alerts - all corridors nominal.</div>
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
                      <StatusBadge status={alert.status ?? "active"} />
                      {alert.severity && <StatusBadge status={alert.severity} />}
                    </div>
                    <p className="text-sm text-muted-foreground">Action: {alert.recommendedAction}</p>
                    {alert.shipmentId && (
                      <p className="text-xs text-primary mt-1">Shipment: {alert.shipmentId}</p>
                    )}
                  </div>
                  <div className="text-right flex flex-col items-end gap-2 shrink-0">
                    {alert.confidence !== undefined && (
                      <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {alert.confidence}% confidence
                      </span>
                    )}
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
      </DashboardCard>
    </div>
  );
}
