"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ShieldAlert, TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function RiskCenterPage() {
  const { t } = useI18n();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<any>(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [alertsRes, kpisRes] = await Promise.all([
          fetch("/api/intelligence/alerts"),
          fetch("/api/intelligence/kpis")
        ]);
        if (alertsRes.ok) {
          const data = await alertsRes.json();
          setAlerts(data.alerts || []);
        }
        if (kpisRes.ok) {
          const data = await kpisRes.json();
          setKpis(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setKpisLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleUpdateAlertStatus = async (alertId: string, status: "acknowledged" | "resolved") => {
    try {
      const res = await fetch(`/api/intelligence/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.alertId === alertId ? { ...a, status } : a))
        );
        // Refresh KPIs to update active alerts counter
        const kpisRes = await fetch("/api/intelligence/kpis");
        if (kpisRes.ok) {
          const data = await kpisRes.json();
          setKpis(data);
        }
      }
    } catch (err) {
      console.error("Error updating alert status:", err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('intelligence.riskCenter')}</h1>
        <p className="text-muted-foreground">
          {t('intelligence.riskCenterSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-destructive/10 text-destructive rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">{t('intelligence.companyRiskScore')}</h3>
          </div>
          <p className="text-3xl font-bold">{kpisLoading ? "..." : (kpis?.avgOperationalRisk ?? 0)}</p>
          <p className="text-sm text-muted-foreground mt-1 text-green-600">{t('riskCenter.downLastWeek')}</p>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">{t('intelligence.activeRisks')}</h3>
          </div>
          <p className="text-3xl font-bold">{kpisLoading ? "..." : (kpis?.activeAlerts ?? 0)}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('riskCenter.acrossCorridors')}</p>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">{t('intelligence.criticalShipments')}</h3>
          </div>
          <p className="text-3xl font-bold">{kpisLoading ? "..." : (kpis?.highRiskShipments ?? 0)}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('riskCenter.requireAttention')}</p>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">{t('intelligence.riskTrend')}</h3>
          </div>
          <p className="text-3xl font-bold">{kpisLoading ? "..." : t('intelligence.stable')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('riskCenter.conditionsNormal')}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border bg-muted/30">
          <h2 className="text-lg font-semibold">{t('intelligence.operationalAlerts')}</h2>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">{t('intelligence.loadingAlerts')}</div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">{t('intelligence.noActiveAlerts')}</div>
          ) : (
            <div className="divide-y divide-border">
              {alerts.map((alert) => (
                <div key={alert.alertId} className="p-5 flex items-start justify-between hover:bg-muted/30 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{alert.reason}</p>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        alert.status === 'active' 
                          ? 'bg-destructive/10 text-destructive' 
                          : alert.status === 'acknowledged'
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-green-600/10 text-green-600'
                      }`}>
                        {alert.status === 'active' 
                          ? t('logistics.active') 
                          : alert.status === 'acknowledged' 
                            ? t('riskCenter.acknowledged') 
                            : t('riskCenter.resolved')}
                      </span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        alert.severity === 'critical' 
                          ? 'bg-red-600/10 text-red-600' 
                          : alert.severity === 'high'
                            ? 'bg-orange-500/10 text-orange-500'
                            : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        {alert.severity === 'critical' 
                          ? t('logistics.critical') 
                          : alert.severity === 'high' 
                            ? t('logistics.high') 
                            : t('logistics.medium')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{t('intelligence.action')}: {alert.recommendedAction}</p>
                    {alert.shipmentId && (
                      <p className="text-xs text-blue-500 mt-2 hover:underline cursor-pointer">
                        {t('riskCenter.shipmentLabel')} {alert.shipmentId}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">
                      {alert.confidence}% {t('intelligence.confidence')}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {alert.status === 'active' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleUpdateAlertStatus(alert.alertId, 'acknowledged')}
                          className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium px-2 py-1 rounded transition-colors"
                        >
                          {t('riskCenter.acknowledge')}
                        </button>
                        <button
                          onClick={() => handleUpdateAlertStatus(alert.alertId, 'resolved')}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white font-medium px-2 py-1 rounded transition-colors"
                        >
                          {t('riskCenter.resolve')}
                        </button>
                      </div>
                    )}
                    {alert.status === 'acknowledged' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleUpdateAlertStatus(alert.alertId, 'resolved')}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white font-medium px-2 py-1 rounded transition-colors"
                        >
                          {t('riskCenter.resolve')}
                        </button>
                      </div>
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
