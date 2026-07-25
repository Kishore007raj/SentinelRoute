"use client";
/**
 * Route Intelligence - shows aggregated risk signals from the user's
 * actual shipment history, plus live Route Analysis workspace for Module 5.
 */
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { CloudRain, Car, AlertTriangle, Package, ShieldCheck, Activity, Cloud, Navigation, Newspaper, Zap, Globe, Route as RouteIcon, MapPin, Clock, Search, Info, Leaf, Droplet, ArrowRight, Play, CheckCircle2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, getRiskColor } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { useUser } from "@/lib/auth-context";
import { useIntelligence } from "@/hooks/use-intelligence";
import { RouteMapView } from "@/components/shipment/RouteMapView";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Route, AnalyzeRoutesResponse } from "@/lib/types";


export default function RouteIntelligencePage() {
  const { t } = useI18n();
  const { user } = useUser();
  const { state, activeShipments, atRiskShipments } = useStore();
  const { shipments, loading } = state;
  const { kpis: liveKPIs } = useIntelligence({ fetchKpis: true, pollingIntervalMs: 30000 });

  // --- Route Analysis Form State ---
  const [origin, setOrigin] = useState("Mumbai, Maharashtra");
  const [destination, setDestination] = useState("Delhi, NCR");
  const [cargoType, setCargoType] = useState("Electronics");
  const [vehicleType, setVehicleType] = useState("Container Truck");
  const [urgency, setUrgency] = useState("Standard");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeRoutesResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [events, setEvents] = useState<{time: string, msg: string}[]>([]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination || !user) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    setSelectedRouteId(null);
    setEvents([{ time: new Date().toLocaleTimeString(), msg: "Initiated route intelligence analysis..." }]);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/analyze-routes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ origin, destination, cargoType, vehicleType, urgency })
      });
      if (res.ok) {
        const data: AnalyzeRoutesResponse = await res.json();
        setAnalysisResult(data);
        const rec = data.routes.find(r => r.recommended) || data.routes[0];
        if (rec) setSelectedRouteId(rec.id);
        setEvents(prev => [{ time: new Date().toLocaleTimeString(), msg: `Analysis complete. Evaluated ${data.routes.length} paths.` }, ...prev]);
      } else {
        setEvents(prev => [{ time: new Date().toLocaleTimeString(), msg: "Analysis failed due to server error." }, ...prev]);
      }
    } catch (err) {
      setEvents(prev => [{ time: new Date().toLocaleTimeString(), msg: "Analysis failed due to network error." }, ...prev]);
    } finally {
      setAnalyzing(false);
    }
  };

  // Route analysis relies on manual trigger instead of 30-second polling.

  const selectedRoute = analysisResult?.routes.find(r => r.id === selectedRouteId) ?? null;

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

  const { riskFactors, tradeoffRows, dominantFactor } = useMemo(() => {
    if (!stats) return { riskFactors: [], tradeoffRows: [], dominantFactor: null };
    const factors = [
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
    }
  ];
    const tradeoffs = [
      { label: t('logistics.fastest'),  count: shipments.filter((s) => s.selectedRoute === "fastest").length,  avgRisk: stats.avgRiskFastest },
      { label: t('logistics.balanced'), count: shipments.filter((s) => s.selectedRoute === "balanced").length, avgRisk: stats.avgRiskBalanced },
      { label: t('logistics.safest'),   count: shipments.filter((s) => s.selectedRoute === "safest").length,   avgRisk: stats.avgRiskSafest },
    ].filter((r) => r.count > 0);

    const dominant = [...factors].sort((a, b) => b.score - a.score)[0];

    return { riskFactors: factors, tradeoffRows: tradeoffs, dominantFactor: dominant };
  }, [stats, shipments, t]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-10 animate-pulse">
        <div className="space-y-4">
          <div className="h-8 bg-muted/20 w-64 rounded" />
          <div className="h-4 bg-muted/20 w-48 rounded" />
        </div>
        <div className="h-[400px] bg-muted/20 rounded-xl border border-border" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-foreground">Intelligence Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Predictive routing analysis and global risk signals
        </p>
      </div>

      <Tabs defaultValue="analysis" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="analysis" className="px-4 py-2">Route Analysis</TabsTrigger>
          <TabsTrigger value="global" className="px-4 py-2">Global Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-8 outline-none">
          {/* Analysis Form */}
          <div className="panel p-6 border bg-card">
            <form onSubmit={handleAnalyze} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Origin</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                  <input
                    type="text"
                    value={origin}
                    onChange={e => setOrigin(e.target.value)}
                    required
                    placeholder="e.g. Mumbai"
                    className="flex h-10 w-full rounded-lg border border-border bg-muted/20 pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Destination</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                  <input
                    type="text"
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    required
                    placeholder="e.g. Delhi"
                    className="flex h-10 w-full rounded-lg border border-border bg-muted/20 pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Cargo Type</label>
                <select
                  value={cargoType}
                  onChange={e => setCargoType(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Pharmaceuticals">Pharmaceuticals</option>
                  <option value="Perishables">Perishables</option>
                  <option value="General">General</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Priority</label>
                <select
                  value={urgency}
                  onChange={e => setUrgency(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                >
                  <option value="Standard">Standard</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={analyzing}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {analyzing ? (
                    <><span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Analyzing</>
                  ) : (
                    <><Play className="w-4 h-4" /> Run Analysis</>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Results Area */}
          {analysisResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Left Column: Cards & Map */}
              <div className="xl:col-span-2 space-y-6">
                
                {/* Route Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analysisResult.routes.map(r => {
                    const isSelected = selectedRouteId === r.id;
                    return (
                      <div key={r.id} onClick={() => setSelectedRouteId(r.id)} 
                        className={cn("panel p-4 cursor-pointer transition-all border-2", isSelected ? "border-primary bg-primary/5" : "border-transparent hover:border-border")}>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-foreground capitalize">{r.label}</h3>
                          {r.recommended && <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-widest">Rec</span>}
                        </div>
                        <div className="space-y-1 mb-4">
                          <p className="text-2xl font-bold">{r.eta}</p>
                          <p className="text-xs text-muted-foreground">{r.distance}</p>
                        </div>
                        {/* Expanded Metrics */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] mb-3">
                          <div className="bg-muted/30 p-2 rounded">
                            <span className="text-muted-foreground block">Risk Score</span>
                            <span className={cn("font-bold text-sm", getRiskColor(r.riskLevel))}>{r.riskScore}</span>
                          </div>
                          <div className="bg-muted/30 p-2 rounded">
                            <span className="text-muted-foreground block">Confidence</span>
                            <span className="font-bold text-sm text-foreground">{r.predictionConfidence}%</span>
                          </div>
                          <div className="bg-muted/30 p-2 rounded flex items-center gap-1">
                            <Droplet className="w-3 h-3 text-blue-400" />
                            <span className="font-bold text-foreground">{r.fuelEstimate}L</span>
                          </div>
                          <div className="bg-muted/30 p-2 rounded flex items-center gap-1">
                            <Leaf className="w-3 h-3 text-emerald-400" />
                            <span className="font-bold text-foreground">{r.carbonEstimate}kg</span>
                          </div>
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-2 italic border-t border-border/50 pt-2">
                          &quot;{r.aiExplanation}&quot;
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Map View */}
                <div className="h-[400px] rounded-xl overflow-hidden shadow-sm border border-border">
                  <RouteMapView 
                    route={selectedRoute || undefined} 
                    routes={analysisResult.routes}
                    origin={origin} 
                    destination={destination}
                    dataSource={analysisResult.source}
                  />
                </div>
              </div>

              {/* Right Column: Comparison Table & Timeline */}
              <div className="space-y-6">
                
                {/* Comparison Table */}
                <div className="panel p-0 overflow-hidden bg-card">
                  <div className="px-4 py-3 border-b border-border bg-muted/20">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Search className="w-4 h-4 text-primary" /> Comparison Matrix
                    </h3>
                  </div>
                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/10">
                        <tr>
                          <th className="px-4 py-2 font-medium text-muted-foreground">Metric</th>
                          {analysisResult.routes.map(r => (
                            <th key={r.id} className="px-4 py-2 font-medium text-foreground capitalize">{r.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        <tr>
                          <td className="px-4 py-2 text-muted-foreground">Traffic Delay</td>
                          {analysisResult.routes.map(r => <td key={r.id} className="px-4 py-2">{r.trafficDelay}m</td>)}
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-muted-foreground">Weather Risk</td>
                          {analysisResult.routes.map(r => <td key={r.id} className="px-4 py-2">{r.riskBreakdown.weather}</td>)}
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-muted-foreground">Historical</td>
                          {analysisResult.routes.map(r => <td key={r.id} className="px-4 py-2">{r.historicalReliability}%</td>)}
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-muted-foreground">CO2 Est.</td>
                          {analysisResult.routes.map(r => <td key={r.id} className="px-4 py-2">{r.carbonEstimate}kg</td>)}
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-muted-foreground">Festivals</td>
                          {analysisResult.routes.map(r => <td key={r.id} className="px-4 py-2">{r.riskBreakdown.festival ?? 0}</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Timeline */}
                <div className="panel p-4 bg-card h-[280px] flex flex-col">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" /> Intelligence Timeline
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {events.map((ev, i) => (
                      <div key={i} className="flex gap-3 relative">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-primary mt-1" />
                          {i !== events.length - 1 && <div className="w-px h-full bg-border mt-1" />}
                        </div>
                        <div className="pb-1">
                          <p className="text-[10px] text-muted-foreground mb-0.5">{ev.time}</p>
                          <p className="text-xs text-foreground">{ev.msg}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
              </div>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="global" className="space-y-10 outline-none">
          {!stats ? (
            <div className="panel p-12 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-base font-semibold text-foreground">{t('intelligence.noDataYet')}</p>
              <p className="text-sm text-muted-foreground">{t('intelligence.noDataYetSubtitle')}</p>
            </div>
          ) : (
            <>
              {/* Global Interactive Route Map */}
              <div className="h-[400px] rounded-xl overflow-hidden shadow-sm border border-border">
                <RouteMapView isGlobal={true} dataSource="mappls+openweather" />
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
                        {dominantFactor && (
                          <li className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">✓</span>
                            <span>{t('intelligence.dominantRiskFactor')}: <strong className="text-foreground">{dominantFactor.label}</strong> ({dominantFactor.score})</span>
                          </li>
                        )}
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

              {/* Intelligence Sources + Live KPI supplement */}
              <div className="space-y-6">
                {liveKPIs && liveKPIs.basedOnPredictions > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-primary/5 border border-primary/20 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                      </span>
                      <p className="text-xs text-primary uppercase tracking-widest font-semibold">Live Prediction Engine Insights</p>
                      <p className="text-[10px] text-muted-foreground/50 ml-auto">{liveKPIs.basedOnPredictions} predictions analysed</p>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">Avg Delay Probability</p>
                        <p className={cn("text-3xl font-bold tabular-nums mt-1", liveKPIs.avgDelayProbability > 40 ? "text-amber-400" : "text-emerald-400")}>
                          {liveKPIs.avgDelayProbability}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">Disruption Risk</p>
                        <p className={cn("text-3xl font-bold tabular-nums mt-1", liveKPIs.avgDisruptionProbability > 30 ? "text-amber-400" : "text-emerald-400")}>
                          {liveKPIs.avgDisruptionProbability}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">ETA Confidence</p>
                        <p className={cn("text-3xl font-bold tabular-nums mt-1", liveKPIs.avgEtaConfidence < 70 ? "text-amber-400" : "text-emerald-400")}>
                          {liveKPIs.avgEtaConfidence}%
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="bg-card border border-border rounded-xl p-6 space-y-5">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Active Intelligence Sources</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { name: "Mappls Routing",     icon: Navigation, detail: "Geocode + Distance Matrix" },
                      { name: "OpenWeather API",    icon: Cloud,      detail: "Corridor weather scoring" },
                      { name: "TomTom Traffic",     icon: Activity,   detail: "Real-time flow data" },
                      { name: "NewsAPI",            icon: Newspaper,  detail: "Disruption signal detection" },
                      { name: "Prediction Engine",  icon: Zap,        detail: liveKPIs ? `${liveKPIs.basedOnPredictions} predictions` : "Route risk ML" },
                      { name: "Festival Calendar",  icon: Globe,      detail: "India event registry" },
                    ].map(({ name, icon: Icon, detail }) => (
                      <div key={name} className="flex items-start gap-3 p-4 bg-muted/5 border border-border/50 rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{detail}</p>
                          <div className="flex items-center gap-1 mt-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-[10px] uppercase tracking-widest font-medium text-emerald-400">live</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
