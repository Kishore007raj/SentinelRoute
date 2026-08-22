"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CloudRain,
  Car,
  AlertTriangle,
  Package,
  ShieldCheck,
  Activity,
  Cloud,
  Navigation,
  Newspaper,
  Zap,
  Globe,
  MapPin,
  Search,
  Leaf,
  Droplet,
  ArrowRight,
  Play,
  Layers,
  Sliders,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn, getRiskColor } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { useUser } from "@/lib/auth-context";
import { useIntelligence } from "@/hooks/use-intelligence";
import { RouteMapView } from "@/components/shipment/RouteMapView";
import { AiInsightBox } from "@/components/shipment/AiInsightBox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Route, AnalyzeRoutesResponse } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function breakdownColor(score: number): string {
  if (score > 60) return "text-red-400";
  if (score > 35) return "text-amber-400";
  return "text-emerald-400";
}

function breakdownBarColor(score: number): string {
  if (score > 60) return "bg-red-400";
  if (score > 35) return "bg-amber-400";
  return "bg-emerald-400";
}

export default function RouteIntelligencePage() {
  const { t } = useI18n();
  const { user } = useUser();
  const { state, atRiskShipments } = useStore();
  const { shipments, loading } = state;
  const { kpis: liveKPIs } = useIntelligence({ fetchKpis: true, pollingIntervalMs: 30000 });

  // ─── Route Analysis Form State ──────────────────────────────────────────────
  const [origin, setOrigin] = useState("Mumbai, Maharashtra");
  const [destination, setDestination] = useState("Delhi, NCR");
  const [cargoType, setCargoType] = useState("Electronics");
  const [vehicleType, setVehicleType] = useState("Container Truck");
  const [urgency, setUrgency] = useState("Standard");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeRoutesResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [events, setEvents] = useState<{ time: string; msg: string }[]>([]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination || !user) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    setSelectedRouteId(null);
    setEvents([{ time: new Date().toLocaleTimeString(), msg: "Initiated multi-corridor route risk calculation..." }]);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/analyze-routes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ origin, destination, cargoType, vehicleType, urgency }),
      });
      if (res.ok) {
        const data: AnalyzeRoutesResponse = await res.json();
        setAnalysisResult(data);
        const rec = data.routes.find((r) => r.recommended) || data.routes[0];
        if (rec) setSelectedRouteId(rec.id);
        setEvents((prev) => [
          { time: new Date().toLocaleTimeString(), msg: `Analysis complete: ${data.routes.length} candidate corridors evaluated.` },
          ...prev,
        ]);
      } else {
        setEvents((prev) => [
          { time: new Date().toLocaleTimeString(), msg: "Analysis request rejected by server." },
          ...prev,
        ]);
      }
    } catch {
      setEvents((prev) => [
        { time: new Date().toLocaleTimeString(), msg: "Network connection failure during analysis." },
        ...prev,
      ]);
    } finally {
      setAnalyzing(false);
    }
  };

  const selectedRoute = analysisResult?.routes.find((r) => r.id === selectedRouteId) ?? null;

  // ─── Global Aggregate Stats ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (shipments.length === 0) return null;

    const avgTraffic = Math.round(
      shipments.reduce((s, sh) => s + (sh.riskBreakdown?.traffic ?? sh.riskScore * 0.3), 0) / shipments.length
    );
    const avgWeather = Math.round(
      shipments.reduce((s, sh) => s + (sh.riskBreakdown?.weather ?? sh.riskScore * 0.3), 0) / shipments.length
    );
    const avgDisruption = Math.round(
      shipments.reduce((s, sh) => s + (sh.riskBreakdown?.disruption ?? sh.riskScore * 0.25), 0) / shipments.length
    );
    const avgCargo = Math.round(
      shipments.reduce((s, sh) => s + (sh.riskBreakdown?.cargoSensitivity ?? sh.riskScore * 0.15), 0) / shipments.length
    );
    const avgRisk = Math.round(shipments.reduce((s, sh) => s + sh.riskScore, 0) / shipments.length);

    const fastest = shipments.filter((s) => s.selectedRoute === "fastest");
    const balanced = shipments.filter((s) => s.selectedRoute === "balanced");
    const safest = shipments.filter((s) => s.selectedRoute === "safest");

    const avgRiskFastest = fastest.length
      ? Math.round(fastest.reduce((s, sh) => s + sh.riskScore, 0) / fastest.length)
      : null;
    const avgRiskBalanced = balanced.length
      ? Math.round(balanced.reduce((s, sh) => s + sh.riskScore, 0) / balanced.length)
      : null;
    const avgRiskSafest = safest.length
      ? Math.round(safest.reduce((s, sh) => s + sh.riskScore, 0) / safest.length)
      : null;

    const atRiskAlerts = atRiskShipments
      .filter((s) => s.predictiveAlert)
      .map((s) => ({ msg: s.predictiveAlert!, route: s.routeName, code: s.shipmentCode }));

    return {
      avgTraffic,
      avgWeather,
      avgDisruption,
      avgCargo,
      avgRisk,
      avgRiskFastest,
      avgRiskBalanced,
      avgRiskSafest,
      atRiskAlerts,
    };
  }, [shipments, atRiskShipments]);

  const { riskFactors, tradeoffRows, dominantFactor } = useMemo(() => {
    if (!stats) return { riskFactors: [], tradeoffRows: [], dominantFactor: null };
    const factors = [
      {
        icon: Car,
        label: t("routeIntelligencePage.trafficDensity"),
        score: stats.avgTraffic,
        detail: t("routeIntelligencePage.trafficDetail").replace("{n}", shipments.length.toString()),
      },
      {
        icon: CloudRain,
        label: t("routeIntelligencePage.weatherImpact"),
        score: stats.avgWeather,
        detail: t("routeIntelligencePage.weatherDetail"),
      },
      {
        icon: AlertTriangle,
        label: t("routeIntelligencePage.disruptionProbability"),
        score: stats.avgDisruption,
        detail: t("routeIntelligencePage.disruptionDetail"),
      },
      {
        icon: Package,
        label: t("routeIntelligencePage.cargoSensitivity"),
        score: stats.avgCargo,
        detail: t("routeIntelligencePage.cargoDetail"),
      },
    ];
    const tradeoffs = [
      {
        label: t("logistics.fastest"),
        count: shipments.filter((s) => s.selectedRoute === "fastest").length,
        avgRisk: stats.avgRiskFastest,
      },
      {
        label: t("logistics.balanced"),
        count: shipments.filter((s) => s.selectedRoute === "balanced").length,
        avgRisk: stats.avgRiskBalanced,
      },
      {
        label: t("logistics.safest"),
        count: shipments.filter((s) => s.selectedRoute === "safest").length,
        avgRisk: stats.avgRiskSafest,
      },
    ].filter((r) => r.count > 0);

    const dominant = [...factors].sort((a, b) => b.score - a.score)[0];

    return { riskFactors: factors, tradeoffRows: tradeoffs, dominantFactor: dominant };
  }, [stats, shipments, t]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 animate-pulse p-4">
        <div className="space-y-3">
          <div className="h-4 bg-muted/40 w-48 rounded" />
          <div className="h-8 bg-muted/40 w-80 rounded" />
        </div>
        <div className="h-[460px] bg-muted/20 rounded-xl border border-border/50" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-7 pb-12">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="border-b border-border pb-6">
        <p className="label-meta flex items-center gap-2 mb-2">
          <Zap className="w-3.5 h-3.5 text-primary" />
          Decision Workspace & Multi-Route Analysis
        </p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Route Intelligence
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare corridor trade-offs, evaluate composite risk factors, and analyze multi-path route parameters.
        </p>
      </div>

      {/* ── Main Tab Navigation ────────────────────────────────────────────── */}
      <Tabs defaultValue="analysis" className="w-full">
        <TabsList className="h-auto bg-transparent gap-0 p-0 rounded-none border-b border-border w-full flex-wrap justify-start mb-6">
          <TabsTrigger
            value="analysis"
            className={cn(
              "relative h-10 px-5 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent",
              "data-[state=active]:text-foreground data-[state=active]:border-primary",
              "hover:text-foreground/80 transition-colors bg-transparent",
              "flex items-center gap-2"
            )}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            Interactive Route Analysis
          </TabsTrigger>
          <TabsTrigger
            value="global"
            className={cn(
              "relative h-10 px-5 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent",
              "data-[state=active]:text-foreground data-[state=active]:border-primary",
              "hover:text-foreground/80 transition-colors bg-transparent",
              "flex items-center gap-2"
            )}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            Global Intelligence & Signals
          </TabsTrigger>
        </TabsList>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 1: Interactive Route Analysis Workspace ───────────────────── */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="analysis" className="space-y-6 outline-none mt-0">
          {/* Analysis Form Card */}
          <div className="panel p-5 bg-card">
            <div className="flex items-center justify-between gap-2 mb-4">
              <p className="label-meta flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5 text-primary" /> Corridor Parameters
              </p>
              <span className="text-[11px] text-muted-foreground/60 hidden sm:inline">
                Live OSRM Routing + OpenWeather + TomTom Traffic
              </span>
            </div>

            <form onSubmit={handleAnalyze} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
              <div className="space-y-1.5">
                <label className="label-meta">Origin</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/70 pointer-events-none" />
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    required
                    placeholder="e.g. Mumbai"
                    className="flex h-10 w-full rounded-lg border border-border bg-muted/20 pl-9 pr-3 py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="label-meta">Destination</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-400 pointer-events-none" />
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    required
                    placeholder="e.g. Delhi"
                    className="flex h-10 w-full rounded-lg border border-border bg-muted/20 pl-9 pr-3 py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="label-meta">Cargo Sensitivity</label>
                <select
                  value={cargoType}
                  onChange={(e) => setCargoType(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                >
                  <option value="Electronics">Electronics (High Fragility)</option>
                  <option value="Pharmaceuticals">Pharmaceuticals (Cold Chain)</option>
                  <option value="Perishables">Perishables (Time Critical)</option>
                  <option value="General">General Freight (Standard)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="label-meta">Dispatch Priority</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                >
                  <option value="Standard">Standard Schedule</option>
                  <option value="Priority">Priority Express</option>
                  <option value="Critical">Critical (Immediate Delivery)</option>
                </select>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={analyzing}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {analyzing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Evaluating…
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Run Analysis
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Prompt if no analysis run yet */}
          {!analysisResult && !analyzing && (
            <div className="panel p-12 text-center space-y-4 border border-dashed border-border/70">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                <Navigation className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-bold text-foreground">Multi-Path Decision Engine Ready</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter an origin and destination to compute candidate corridors, compare trade-offs, and inspect real-time weather, traffic, and disruption risks.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAnalyze}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 text-xs font-semibold text-foreground transition-colors"
              >
                <Play className="w-3 h-3 text-primary fill-current" />
                Analyze Default Corridor ({origin} → {destination})
              </button>
            </div>
          )}

          {/* Results Area */}
          {analysisResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Context Strip */}
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span className="font-semibold text-foreground">{origin}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
                  <span className="font-semibold text-foreground">{destination}</span>
                  <span className="text-muted-foreground/30">•</span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {analysisResult.routes.length} corridors evaluated
                  </span>
                  <span className="text-muted-foreground/30">•</span>
                  <span className="text-[11px] text-muted-foreground">
                    Source: {analysisResult.source || "Geoapify + OpenWeather"}
                  </span>
                </div>
              </div>

              {/* Split Decision Surface: Map (Left) + Route Option Strips (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ── Left Column: Prominent Interactive Live Map (7 cols) ── */}
                <div className="lg:col-span-7 space-y-4">
                  <div
                    className="rounded-xl overflow-hidden border border-border shadow-sm bg-card relative"
                    style={{ height: "520px" }}
                  >
                    <RouteMapView
                      route={selectedRoute || undefined}
                      routes={analysisResult.routes}
                      origin={origin}
                      destination={destination}
                      dataSource={analysisResult.source}
                    />
                  </div>

                  {/* Active Selected Route Strip Banner */}
                  {selectedRoute && (
                    <div className="panel p-4 bg-muted/10 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold uppercase text-xs">
                          {selectedRoute.label.slice(0, 3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground capitalize">
                              {selectedRoute.name || `${selectedRoute.label} Corridor`}
                            </span>
                            {selectedRoute.recommended && (
                              <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider">
                                Recommended
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {selectedRoute.distance} • {selectedRoute.eta} total transit estimate
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="label-meta">Composite Risk</p>
                          <p className={cn("text-base font-bold tabular-nums", getRiskColor(selectedRoute.riskLevel))}>
                            {selectedRoute.riskScore}
                            <span className="text-xs font-normal text-muted-foreground ml-1 capitalize">
                              ({selectedRoute.riskLevel})
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Right Column: Route Options & Deep Decision Reasoning (5 cols) ── */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="space-y-1">
                    <p className="label-meta">Available Route Corridors</p>
                    <p className="text-xs text-muted-foreground">
                      Click any option below to toggle path geometry on the live map:
                    </p>
                  </div>

                  {/* Route Selection Options */}
                  <div className="space-y-2.5">
                    {analysisResult.routes.map((r) => {
                      const isSelected = selectedRouteId === r.id;
                      const riskClr = getRiskColor(r.riskLevel);
                      return (
                        <div
                          key={r.id}
                          onClick={() => setSelectedRouteId(r.id)}
                          className={cn(
                            "group relative panel p-3.5 cursor-pointer transition-all duration-150 border overflow-hidden",
                            isSelected
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border/70 bg-card hover:bg-muted/20 hover:border-border"
                          )}
                        >
                          {/* Selected Left Indicator Strip */}
                          {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}

                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-xs font-bold uppercase tracking-wider",
                                  isSelected ? "text-primary" : "text-foreground"
                                )}
                              >
                                {r.label}
                              </span>
                              {r.recommended && (
                                <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider">
                                  Recommended
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs font-bold tabular-nums", riskClr)}>
                                Risk {r.riskScore}
                              </span>
                              <span className="text-[10px] text-muted-foreground uppercase">({r.riskLevel})</span>
                            </div>
                          </div>

                          {/* Metric stats row */}
                          <div className="grid grid-cols-3 gap-2 py-1.5 border-y border-border/40 my-2 text-xs">
                            <div>
                              <p className="label-meta">ETA</p>
                              <p className="font-bold text-foreground tabular-nums text-xs">{r.eta}</p>
                            </div>
                            <div>
                              <p className="label-meta">Distance</p>
                              <p className="font-semibold text-foreground text-xs">{r.distance}</p>
                            </div>
                            <div>
                              <p className="label-meta">Confidence</p>
                              <p className="font-semibold text-foreground text-xs">{r.predictionConfidence ?? 85}%</p>
                            </div>
                          </div>

                          {/* Secondary metrics */}
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                            <div className="flex items-center gap-3">
                              {r.fuelEstimate !== undefined && (
                                <span className="flex items-center gap-1">
                                  <Droplet className="w-3 h-3 text-blue-400" />
                                  <span>{r.fuelEstimate}L</span>
                                </span>
                              )}
                              {r.carbonEstimate !== undefined && (
                                <span className="flex items-center gap-1">
                                  <Leaf className="w-3 h-3 text-emerald-400" />
                                  <span>{r.carbonEstimate}kg</span>
                                </span>
                              )}
                            </div>
                            {r.trafficDelay ? (
                              <span className="text-amber-400 text-[10px] font-medium flex items-center gap-1">
                                <Activity className="w-3 h-3" /> +{r.trafficDelay}m delay
                              </span>
                            ) : (
                              <span className="text-emerald-400 text-[10px] font-medium">Clear flow</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected Corridor Deep Breakdown & AI Explanation */}
                  {selectedRoute && (
                    <motion.div
                      key={selectedRoute.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 pt-1"
                    >
                      {/* Risk factor breakdown */}
                      <div className="panel p-4 bg-card space-y-3">
                        <p className="label-meta flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-primary" />
                          Risk Decomposition ({selectedRoute.label.toUpperCase()})
                        </p>
                        <div className="space-y-2.5">
                          {Object.entries(selectedRoute.riskBreakdown).map(([key, val]) => (
                            <div key={key} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground capitalize">
                                  {key === "cargoSensitivity" ? "Cargo Sensitivity" : key}
                                </span>
                                <span className={cn("font-bold tabular-nums", breakdownColor(val as number))}>
                                  {val as number}/100
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-muted overflow-hidden rounded-full">
                                <div
                                  className={cn("h-full rounded-full transition-all duration-500", breakdownBarColor(val as number))}
                                  style={{ width: `${val}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AI Decision Reasoning */}
                      <AiInsightBox
                        explanation={selectedRoute.aiExplanation ?? null}
                        loading={false}
                        route={selectedRoute}
                        cargoType={cargoType}
                        urgency={urgency}
                        allRoutes={analysisResult.routes}
                      />
                    </motion.div>
                  )}
                </div>
              </div>

              {/* ── Bottom Section: Comprehensive Comparison Matrix & Event Log ── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Comparison Matrix Table (8 cols) */}
                <div className="lg:col-span-8 panel p-0 overflow-hidden bg-card">
                  <div className="p-4 border-b border-border bg-muted/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Corridor Comparison Matrix</h3>
                    </div>
                    <span className="label-meta">Direct Metric Comparison</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/15 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Evaluation Metric</th>
                          {analysisResult.routes.map((r) => {
                            const isSelected = selectedRouteId === r.id;
                            return (
                              <th
                                key={r.id}
                                className={cn(
                                  "py-3 px-4 font-bold capitalize text-center",
                                  isSelected ? "text-primary bg-primary/5" : "text-foreground"
                                )}
                              >
                                {r.label}
                                {r.recommended && (
                                  <span className="block text-[9px] text-primary/80 font-normal uppercase">
                                    Recommended
                                  </span>
                                )}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-muted-foreground">Estimated Travel Time</td>
                          {analysisResult.routes.map((r) => (
                            <td
                              key={r.id}
                              className={cn(
                                "py-2.5 px-4 font-bold text-center tabular-nums",
                                selectedRouteId === r.id && "bg-primary/5 text-primary"
                              )}
                            >
                              {r.eta}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-muted-foreground">Total Distance</td>
                          {analysisResult.routes.map((r) => (
                            <td
                              key={r.id}
                              className={cn(
                                "py-2.5 px-4 text-center tabular-nums",
                                selectedRouteId === r.id && "bg-primary/5 font-semibold"
                              )}
                            >
                              {r.distance}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-muted-foreground">Composite Risk Score</td>
                          {analysisResult.routes.map((r) => (
                            <td
                              key={r.id}
                              className={cn(
                                "py-2.5 px-4 text-center font-bold tabular-nums",
                                getRiskColor(r.riskLevel),
                                selectedRouteId === r.id && "bg-primary/5"
                              )}
                            >
                              {r.riskScore}/100
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-muted-foreground">Traffic Delay Impact</td>
                          {analysisResult.routes.map((r) => (
                            <td
                              key={r.id}
                              className={cn(
                                "py-2.5 px-4 text-center tabular-nums",
                                (r.trafficDelay ?? 0) > 30 ? "text-red-400 font-semibold" : "text-muted-foreground",
                                selectedRouteId === r.id && "bg-primary/5"
                              )}
                            >
                              +{r.trafficDelay ?? 0} mins
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-muted-foreground">Weather Severity Index</td>
                          {analysisResult.routes.map((r) => (
                            <td
                              key={r.id}
                              className={cn(
                                "py-2.5 px-4 text-center tabular-nums",
                                breakdownColor(r.riskBreakdown.weather),
                                selectedRouteId === r.id && "bg-primary/5 font-semibold"
                              )}
                            >
                              {r.riskBreakdown.weather} / 100
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-muted-foreground">Historical Reliability</td>
                          {analysisResult.routes.map((r) => (
                            <td
                              key={r.id}
                              className={cn(
                                "py-2.5 px-4 text-center tabular-nums text-emerald-400 font-semibold",
                                selectedRouteId === r.id && "bg-primary/5"
                              )}
                            >
                              {r.historicalReliability ?? 88}%
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-muted-foreground">Fuel & Carbon Consumption</td>
                          {analysisResult.routes.map((r) => (
                            <td
                              key={r.id}
                              className={cn(
                                "py-2.5 px-4 text-center tabular-nums text-muted-foreground",
                                selectedRouteId === r.id && "bg-primary/5 font-semibold text-foreground"
                              )}
                            >
                              {r.fuelEstimate ?? "—"}L · {r.carbonEstimate ?? "—"}kg CO2
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Live Engine Event Log (4 cols) */}
                <div className="lg:col-span-4 panel p-4 bg-card flex flex-col h-full min-h-[260px]">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-foreground">Analysis Audit Feed</h3>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[220px]">
                    {events.map((ev, i) => (
                      <div key={i} className="flex gap-2.5 text-xs items-start">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground/60 tabular-nums">{ev.time}</p>
                          <p className="text-xs text-foreground/90 leading-snug">{ev.msg}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </TabsContent>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 2: Global Intelligence & Fleet Risk Signals ───────────────── */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="global" className="space-y-8 outline-none mt-0">
          {!stats ? (
            <div className="panel p-12 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-base font-semibold text-foreground">{t("intelligence.noDataYet")}</p>
              <p className="text-sm text-muted-foreground">{t("intelligence.noDataYetSubtitle")}</p>
            </div>
          ) : (
            <>
              {/* Global Interactive Route Map */}
              <div className="h-[420px] rounded-xl overflow-hidden shadow-sm border border-border bg-card">
                <RouteMapView isGlobal={true} dataSource="geoapify+openweather" />
              </div>

              {/* Global Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left: risk factors */}
                <div className="xl:col-span-2 space-y-4">
                  <div>
                    <p className="label-meta mb-3">{t("intelligence.avgRiskFactors")}</p>
                    <div className="space-y-3">
                      {riskFactors.map((factor, i) => {
                        const Icon = factor.icon;
                        const color =
                          factor.score > 50
                            ? "text-red-400"
                            : factor.score > 25
                            ? "text-amber-400"
                            : "text-emerald-400";
                        const bg =
                          factor.score > 50
                            ? "bg-red-400/5 border-red-400/20"
                            : factor.score > 25
                            ? "bg-amber-400/5 border-amber-400/20"
                            : "bg-emerald-400/5 border-emerald-400/20";
                        return (
                          <motion.div
                            key={factor.label}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={cn("panel p-4 border", bg)}
                          >
                            <div className="flex items-start gap-3.5">
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border shrink-0", bg)}>
                                <Icon className={cn("w-4 h-4", color)} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-xs font-bold text-foreground">{factor.label}</p>
                                  <span className={cn("text-xs font-bold tabular-nums", color)}>{factor.score}/100</span>
                                </div>
                                <div className="risk-bar mb-2">
                                  <motion.div
                                    className={cn(
                                      "h-full rounded-full",
                                      factor.score > 50
                                        ? "bg-red-400"
                                        : factor.score > 25
                                        ? "bg-amber-400"
                                        : "bg-emerald-400"
                                    )}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${factor.score}%` }}
                                    transition={{ duration: 0.6, delay: i * 0.05 }}
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
                      <p className="label-meta mb-3">{t("intelligence.routeSelectionHistory")}</p>
                      <div className="space-y-0 divide-y divide-border/50">
                        {tradeoffRows.map((row) => (
                          <div key={row.label} className="grid grid-cols-3 gap-3 py-3 items-center text-xs">
                            <p className="font-bold text-foreground capitalize">{row.label}</p>
                            <div>
                              <p className="label-meta">{t("logistics.shipments")}</p>
                              <p className="font-bold text-foreground tabular-nums">{row.count}</p>
                            </div>
                            <div>
                              <p className="label-meta">{t("intelligence.avgRiskScore")}</p>
                              <p
                                className={cn(
                                  "font-bold tabular-nums",
                                  row.avgRisk !== null
                                    ? getRiskColor(
                                        row.avgRisk > 75
                                          ? "critical"
                                          : row.avgRisk > 50
                                          ? "high"
                                          : row.avgRisk > 25
                                          ? "medium"
                                          : "low"
                                      )
                                    : "text-muted-foreground"
                                )}
                              >
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
                    <p className="label-meta mb-3">{t("intelligence.activeAlerts")}</p>
                    {stats.atRiskAlerts.length === 0 ? (
                      <div className="flex items-center gap-2 py-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <p className="text-xs text-muted-foreground">{t("intelligence.noActiveAlertsShort")}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {stats.atRiskAlerts.map((alert, i) => (
                          <div
                            key={i}
                            className="rounded-lg border px-3 py-2.5 text-amber-400 bg-amber-400/10 border-amber-400/20"
                          >
                            <p className="text-[11px] font-medium">{alert.msg}</p>
                            <p className="text-[10px] opacity-70 mt-0.5">
                              {alert.route} · {alert.code}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recommendation logic from real data */}
                  <div className="panel p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">{t("intelligence.systemInsight")}</p>
                    </div>
                    <div className="space-y-3 text-[11px] text-muted-foreground leading-relaxed">
                      <p>{t("intelligence.basedOnShipments").replace("{n}", shipments.length.toString())}</p>
                      <ul className="space-y-2 list-none">
                        <li className="flex items-start gap-2">
                          <span className={cn("mt-0.5", stats.avgRisk < 40 ? "text-emerald-400" : "text-amber-400")}>
                            {stats.avgRisk < 40 ? "✓" : "⚠"}
                          </span>
                          <span>
                            {t("intelligence.avgRiskScore")}: <strong className="text-foreground">{stats.avgRisk}</strong> (
                            {stats.avgRisk < 40 ? t("intelligence.withinSafeRange") : t("intelligence.elevated")})
                          </span>
                        </li>
                        {dominantFactor && (
                          <li className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">✓</span>
                            <span>
                              {t("intelligence.dominantRiskFactor")}:{" "}
                              <strong className="text-foreground">{dominantFactor.label}</strong> ({dominantFactor.score})
                            </span>
                          </li>
                        )}
                        {stats.atRiskAlerts.length > 0 && (
                          <li className="flex items-start gap-2">
                            <span className="text-amber-400 mt-0.5">⚠</span>
                            <span>
                              {stats.atRiskAlerts.length} {t("intelligence.currentlyAtRisk")}
                            </span>
                          </li>
                        )}
                      </ul>
                      <Separator className="opacity-30" />
                      <p className="text-[10px] text-muted-foreground/70">{t("intelligence.allFiguresDerived")}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Intelligence Sources + Live KPI supplement */}
              <div className="space-y-6">
                {liveKPIs && liveKPIs.basedOnPredictions > 0 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                      </span>
                      <p className="text-xs text-primary uppercase tracking-widest font-semibold">
                        Live Prediction Engine Insights
                      </p>
                      <p className="text-[10px] text-muted-foreground/50 ml-auto">
                        {liveKPIs.basedOnPredictions} predictions analysed
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <p className="label-meta">Avg Delay Probability</p>
                        <p
                          className={cn(
                            "text-2xl font-bold tabular-nums mt-1",
                            liveKPIs.avgDelayProbability > 40 ? "text-amber-400" : "text-emerald-400"
                          )}
                        >
                          {liveKPIs.avgDelayProbability}%
                        </p>
                      </div>
                      <div>
                        <p className="label-meta">Disruption Risk</p>
                        <p
                          className={cn(
                            "text-2xl font-bold tabular-nums mt-1",
                            liveKPIs.avgDisruptionProbability > 30 ? "text-amber-400" : "text-emerald-400"
                          )}
                        >
                          {liveKPIs.avgDisruptionProbability}%
                        </p>
                      </div>
                      <div>
                        <p className="label-meta">ETA Confidence</p>
                        <p
                          className={cn(
                            "text-2xl font-bold tabular-nums mt-1",
                            liveKPIs.avgEtaConfidence < 70 ? "text-amber-400" : "text-emerald-400"
                          )}
                        >
                          {liveKPIs.avgEtaConfidence}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="panel p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Active Intelligence Data Connectors</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { name: "OSRM / Geoapify", icon: Navigation, detail: "Geocode + Routing Matrix" },
                      { name: "OpenWeather API", icon: Cloud, detail: "Corridor atmospheric risk" },
                      { name: "TomTom Traffic", icon: Activity, detail: "Real-time congestion vectors" },
                      { name: "NewsAPI Engine", icon: Newspaper, detail: "Disruption signal detection" },
                      {
                        name: "Prediction Engine",
                        icon: Zap,
                        detail: liveKPIs ? `${liveKPIs.basedOnPredictions} predictions` : "Route risk ML",
                      },
                      { name: "Festival Calendar", icon: Globe, detail: "Regional holiday registry" },
                    ].map(({ name, icon: Icon, detail }) => (
                      <div
                        key={name}
                        className="flex items-start gap-3 p-3.5 bg-muted/10 border border-border/60 rounded-lg"
                      >
                        <div className="w-7 h-7 rounded-md bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{detail}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[9px] uppercase tracking-widest font-semibold text-emerald-400">
                              Active
                            </span>
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
