"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ShieldAlert, TrendingUp } from "lucide-react";

export default function RiskCenterPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch("/api/intelligence/alerts");
        if (res.ok) {
          const data = await res.json();
          setAlerts(data.alerts || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchAlerts();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Risk Center</h1>
        <p className="text-muted-foreground">
          Live overview of operational risks, critical shipments, and active alerts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-destructive/10 text-destructive rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">Company Risk Score</h3>
          </div>
          <p className="text-3xl font-bold">42</p>
          <p className="text-sm text-muted-foreground mt-1 text-green-600">↓ 5% from last week</p>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">Active Risks</h3>
          </div>
          <p className="text-3xl font-bold">12</p>
          <p className="text-sm text-muted-foreground mt-1">Across 8 corridors</p>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">Critical Shipments</h3>
          </div>
          <p className="text-3xl font-bold">3</p>
          <p className="text-sm text-muted-foreground mt-1">Require immediate attention</p>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">Risk Trend</h3>
          </div>
          <p className="text-3xl font-bold">Stable</p>
          <p className="text-sm text-muted-foreground mt-1">Conditions normal</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border bg-muted/30">
          <h2 className="text-lg font-semibold">Operational Alerts</h2>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No active operational alerts.</div>
          ) : (
            <div className="divide-y divide-border">
              {alerts.map((alert) => (
                <div key={alert.alertId} className="p-5 flex items-start justify-between hover:bg-muted/30 transition-colors">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{alert.reason}</p>
                    <p className="text-sm text-muted-foreground">Action: {alert.recommendedAction}</p>
                    {alert.shipmentId && (
                      <p className="text-xs text-blue-500 mt-2 hover:underline cursor-pointer">
                        Shipment: {alert.shipmentId}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">
                      {alert.confidence}% Confidence
                    </span>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
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
