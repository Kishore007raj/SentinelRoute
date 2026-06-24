"use client";
/**
 * Route Intelligence — shows aggregated risk signals from the user's
 * actual shipment history. No hardcoded data.
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { CloudRain, Car, AlertTriangle, Package, ShieldCheck } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn, getRiskColor } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export default function RouteIntelligencePage() {
  const { t } = useI18n();
  const { state, activeShipments, atRiskShipments } = useStore();
  const { shipments } = state;

  const stats = useMemo(() => {
    if (shipments.length === 0) return null;

    const avgTraffic      = Math.round(shipments.reduce((s, sh) => s + (sh.riskBreakdown?.traffic          ?? sh.riskScore * 0.30), 0) / shipments.length);
    const avgWeather      = Math.round(shipments.reduce((s, sh) => s + (sh.riskBreakdown?.weather          ?? sh.riskScore * 0.30), 0) / shipments.length);
    const avgDisruption   = Math.round(shipments.reduce((s, sh) => s + (sh.riskBreakdown?.disruption       ?? sh.riskScore * 0.25), 0) / shipments.length);
    const avgCargo        = Math.round(shipments.reduce((s, sh) => s + (sh.riskBreakdown?.cargoSensitivity ?? sh.riskScore * 0.15), 0) / shipments.length);
    const avgRisk         = Math.round(shipments.reduce((s, sh) => s + sh.riskScore, 0) / shipments.length);

    const fastest  = shipments.filter((s) => s.selectedRoute === "fastest");
    const balanced = shipments.filter((s) => s.selectedRoute === "balanced");
    const safest   = shipments.filter((s) => s.selectedRoute === "safest");

    const avgRiskFastest  = fastest.length  ? Math.round(fastest.reduce((s, sh)  => s + sh.riskScore, 0) / fastest.length)  : null;
    const avgRiskBalanced = balanced.length ? Math.round(balanced.reduce((s, sh) => s + sh.riskScore, 0) / balanced.length) : null;
    const avgRiskSafest   = safest.length   ? Math.round(safest.reduce((s, sh)   => s + sh.riskScore, 0) / safest.length)   : null;

    const atRiskAlerts = atRiskShipments
      .filter((s) => s.predictiveAlert)
      .map((s) => ({ msg: s.predictiveAlert!, route: s.routeName, code: s.shipmentCode }));

    return { avgTraffic, avgWeather, avgDisruption, avgCargo, avgRisk, avgRiskFastest, avgRiskBalanced, avgRiskSafest, atRiskAlerts };
  }, [shipments, atRiskShipments]);

  if (!stats) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{t('intelligence.routeIntelligence')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('intelligence.routeIntelligenceSubtitle')}</p>
        </div>
        <div className="panel p-12 text-center space-y-3">
          <ShieldCheck className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-base font-semibold text-foreground">{t('intelligence.noDataYet')}</p>
          <p className="text-sm text-muted-foreground">{t('intelligence.noDataYetSubtitle')}</p>
        </div>
      </div>
    );
  }

  const riskFactors = [
    { 
      icon: Car, 
      label: t('routeIntelligencePage.trafficDensity'), 
      score: stats.avgTraffic, 
      detail: t('routeIntelligencePage.trafficDetail').replace('{n}', shipments.length.toString()) 
    },
    { 
      icon: CloudRain, 
      label: t('routeIntelligencePage.weatherImpact'), 
      score: stats.avgWeather, 
      detail: t('routeIntelligencePage.weatherDetail') 
    },
    { 
      icon: AlertTriangle, 
      label: t('routeIntelligencePage.disruptionProbability'), 
      score: stats.avgDisruption, 
      detail: t('routeIntelligencePage.disruptionDetail') 
    },
    { 
      icon: Package, 
      label: t('routeIntelligencePage.cargoSensitivity'), 
      score: stats.avgCargo, 
      detail: t('routeIntelligencePage.cargoDetail') 
    },
  ];

  const tradeoffRows = [
    { label: t('logistics.fastest'),  count: shipments.filter((s) => s.selectedRoute === "fastest").length,  avgRisk: stats.avgRiskFastest },
    { label: t('logistics.balanced'), count: shipments.filter((s) => s.selectedRoute === "balanced").length, avgRisk: stats.avgRiskBalanced },
    { label: t('logistics.safest'),   count: shipments.filter((s) => s.selectedRoute === "safest").length,   avgRisk: stats.avgRiskSafest },
  ].filter((r) => r.count > 0);

  const dominantFactor = [...riskFactors].sort((a, b) => b.score - a.score)[0];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('intelligence.routeIntelligence')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('intelligence.routeIntelligenceSubtitle')} · {shipments.length} {t('logistics.shipments')} · {activeShipments.length} {t('logistics.active')}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Left: risk factors */}
        <div className="xl:col-span-2 space-y-4">
          <div>
            <p className="label-meta mb-3">{t('intelligence.avgRiskFactors')}</p>
            <div className="space-y-3">
              {riskFactors.map((factor, i) => {
                const Icon = factor.icon;
                const color = factor.score > 50 ? "text-red-400" : factor.score > 25 ? "text-amber-400" : "text-emerald-400";
                const bg    = factor.score > 50 ? "bg-red-400/5 border-red-400/20" : factor.score > 25 ? "bg-amber-400/5 border-amber-400/20" : "bg-emerald-400/5 border-emerald-400/20";
                return (
                  <motion.div key={factor.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                    className={cn("panel p-4 border", bg)}>
                    <div className="flex items-start gap-3">
                      <div className={cn("w-8 h-8 rounded-md flex items-center justify-center border", bg)}>
                        <Icon className={cn("w-4 h-4", color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-foreground">{factor.label}</p>
                          <span className={cn("text-sm font-bold", color)}>{factor.score}</span>
                        </div>
                        <div className="risk-bar mb-2">
                          <motion.div
                            className={cn("h-full rounded-full", factor.score > 50 ? "bg-red-400" : factor.score > 25 ? "bg-amber-400" : "bg-emerald-400")}
                            initial={{ width: 0 }}
                            animate={{ width: `${factor.score}%` }}
                            transition={{ duration: 0.6, delay: i * 0.07 }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{factor.detail}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Route tradeoff from real data */}
          {tradeoffRows.length > 0 && (
            <div className="panel p-4">
              <p className="label-meta mb-3">{t('intelligence.routeSelectionHistory')}</p>
              <div className="space-y-0 divide-y divide-border/50">
                {tradeoffRows.map((row) => (
                  <div key={row.label} className="grid grid-cols-3 gap-3 py-3 items-center">
                    <p className="text-xs font-semibold text-foreground">{row.label}</p>
                    <div>
                      <p className="label-meta">{t('logistics.shipments')}</p>
                      <p className="text-xs font-bold text-foreground">{row.count}</p>
                    </div>
                    <div>
                      <p className="label-meta">{t('intelligence.avgRiskScore')}</p>
                      <p className={cn("text-xs font-bold", row.avgRisk !== null ? getRiskColor(row.avgRisk > 75 ? "critical" : row.avgRisk > 50 ? "high" : row.avgRisk > 25 ? "medium" : "low") : "text-muted-foreground")}>
                        {row.avgRisk ?? "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: live alerts + recommendation */}
        <div className="space-y-4">

          {/* Live at-risk alerts */}
          <div className="panel p-4">
            <p className="label-meta mb-3">{t('intelligence.activeAlerts')}</p>
            {stats.atRiskAlerts.length === 0 ? (
              <div className="flex items-center gap-2 py-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-xs text-muted-foreground">{t('intelligence.noActiveAlertsShort')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.atRiskAlerts.map((alert, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                    className="rounded-md border px-3 py-2.5 text-amber-400 bg-amber-400/10 border-amber-400/20">
                    <p className="text-[11px] font-medium">{alert.msg}</p>
                    <p className="text-[10px] opacity-70 mt-0.5">{alert.route} · {alert.code}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Recommendation logic from real data */}
          <div className="panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">{t('intelligence.systemInsight')}</p>
            </div>
            <div className="space-y-3 text-[11px] text-muted-foreground leading-relaxed">
              <p>{t('intelligence.basedOnShipments').replace('{n}', shipments.length.toString())}</p>
              <ul className="space-y-1.5 list-none">
                <li className="flex items-start gap-2">
                  <span className={cn("mt-0.5", stats.avgRisk < 40 ? "text-emerald-400" : "text-amber-400")}>
                    {stats.avgRisk < 40 ? "✓" : "⚠"}
                  </span>
                  <span>{t('intelligence.avgRiskScore')}: <strong className="text-foreground">{stats.avgRisk}</strong> ({stats.avgRisk < 40 ? t('intelligence.withinSafeRange') : t('intelligence.elevated')})</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>{t('intelligence.dominantRiskFactor')}: <strong className="text-foreground">{dominantFactor.label}</strong> ({dominantFactor.score})</span>
                </li>
                {stats.atRiskAlerts.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">⚠</span>
                    <span>{stats.atRiskAlerts.length} {t('intelligence.currentlyAtRisk')}</span>
                  </li>
                )}
              </ul>
              <Separator className="opacity-30" />
              <p className="text-[10px] text-muted-foreground/70">
                {t('intelligence.allFiguresDerived')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
