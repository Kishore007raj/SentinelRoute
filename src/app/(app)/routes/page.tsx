"use client";
import { useState, useEffect } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { ArrowRight, ChevronLeft, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShipmentPass } from "@/components/shipment/ShipmentPass";
import { RouteMapView } from "@/components/shipment/RouteMapView";
import { DispatchedStub } from "@/components/shipment/ShipmentPass";
import { generateShipmentCode, cn, getRiskColor } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Route } from "@/lib/types";
import {
  recommendationBadge,
  decisionContextText,
  deriveConfidence,
} from "@/lib/route-utils";
import Link from "next/link";

// ─── Human-readable breakdown labels ─────────────────────────────────────────

function breakdownLabel(key: string, score: number): string {
  if (key === "traffic")          return score > 65 ? "Heavy"            : score > 35 ? "Moderate"  : "Light";
  if (key === "weather")          return score > 65 ? "Severe"           : score > 35 ? "Rain risk" : "Clear";
  if (key === "disruption")       return score > 65 ? "High"             : score > 35 ? "Moderate"  : "Low";
  if (key === "cargoSensitivity") return score > 65 ? "High sensitivity" : score > 35 ? "Moderate"  : "Low";
  return score > 50 ? "Elevated" : "Normal";
}

function breakdownLabelColor(score: number): string {
  if (score > 65) return "text-red-400";
  if (score > 35) return "text-amber-400";
  return "text-emerald-400";
}

// ─── Dominant route ───────────────────────────────────────────────────────────

function DominantRoute({ route, onSelect, selected, cargoType, urgency, allRoutes }: {
  route: Route; onSelect: (id: string) => void; selected: boolean;
  cargoType?: string; urgency?: string; allRoutes?: Route[];
}) {
  const riskColor = getRiskColor(route.riskLevel);
  const recBadge = route.recommended
    ? recommendationBadge(route, cargoType ?? "", urgency ?? "Standard", allRoutes ?? [])
    : null;

  return (
    <motion.div
      layoutId={`route-card-${route.id}`}
      layout
      onClick={() => onSelect(route.id)}
      transition={{ layout: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } }}
      className={cn(
        "border cursor-pointer transition-colors duration-150 overflow-hidden rounded-xl",
        selected ? "border-primary bg-card" : "border-border bg-card hover:border-border/80",
      )}
    >
      <div className={cn("h-1.5 w-full",
        route.riskLevel === "high" || route.riskLevel === "critical" ? "bg-red-400" :
        route.riskLevel === "medium" ? "bg-amber-400" : "bg-emerald-400"
      )} />
      <div className="p-8 lg:p-10">
        <div className="flex items-start justify-between mb-10">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn(
                "text-xs font-semibold uppercase tracking-widest px-3 py-1.5 border rounded-md",
                route.label === "fastest" ? "text-amber-400 border-amber-400/30 bg-amber-400/5" :
                route.label === "balanced" ? "text-primary border-primary/30 bg-primary/5" :
                "text-emerald-400 border-emerald-400/30 bg-emerald-400/5"
              )}>{route.label}</span>
              {route.recommended && (
                <span className="text-xs text-primary border border-primary/30 bg-primary/5 px-3 py-1.5 uppercase tracking-widest rounded-md">
                  {recBadge ?? "Recommended"}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-foreground">{route.name}</h2>
          </div>
          <div className="text-right shrink-0 ml-8">
            <p className={cn("text-7xl font-bold tabular-nums leading-none", riskColor)}>{route.riskScore}</p>
            <p className={cn("text-xs uppercase tracking-widest mt-2", riskColor)}>{route.riskLevel} risk</p>
          </div>
        </div>

        <div className="flex items-center gap-12 mb-10 pb-10 border-b border-border/40">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">ETA</p>
            <p className="text-4xl font-bold text-foreground">{route.eta}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Distance</p>
            <p className="text-4xl font-bold text-foreground">{route.distance}</p>
          </div>
        </div>

        <div className="space-y-4 mb-10">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Risk breakdown</p>
          {Object.entries(route.riskBreakdown).map(([key, val]) => (
            <div key={key} className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-28 shrink-0 capitalize">
                {key === "cargoSensitivity" ? "Cargo" : key}
              </span>
              <div className="flex-1 h-2 bg-muted overflow-hidden rounded-full">
                <motion.div
                  className={cn("h-full rounded-full", val > 60 ? "bg-red-400" : val > 35 ? "bg-amber-400" : "bg-emerald-400")}
                  initial={{ width: 0 }}
                  animate={{ width: `${val}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <span className={cn("text-sm font-medium w-28 text-right shrink-0", breakdownLabelColor(val))}>
                {breakdownLabel(key, val)}
              </span>
            </div>
          ))}
        </div>

        {route.alerts.length > 0 && (
          <div className="space-y-3 mb-10">
            {route.alerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-amber-400/90 bg-amber-400/5 border border-amber-400/15 rounded-lg px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{alert}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-sm text-muted-foreground leading-relaxed mb-10">{route.summary}</p>

        <Button
          className={cn(
            "w-full h-12 text-sm font-semibold rounded-lg",
            selected ? "bg-primary text-primary-foreground" : "bg-muted/30 text-foreground hover:bg-muted/50 border border-border",
          )}
          variant="ghost"
        >
          {selected ? "Selected — Confirm Dispatch" : "Select This Route"}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Alternative row ──────────────────────────────────────────────────────────

function AlternativeRow({ route, onSelect, selected, referenceRoute }: {
  route: Route; onSelect: (id: string) => void; selected: boolean;
  referenceRoute?: Route;
}) {
  const riskColor = getRiskColor(route.riskLevel);

  let riskDelta: number | null = null;
  let etaDelta: number | null = null;
  if (referenceRoute) {
    const rd = route.riskScore - referenceRoute.riskScore;
    const ed = route.etaMinutes - referenceRoute.etaMinutes;
    if (Number.isFinite(rd)) riskDelta = rd;
    if (Number.isFinite(ed)) etaDelta  = ed;
  }

  return (
    <motion.div
      layoutId={`route-card-${route.id}`}
      layout
      onClick={() => onSelect(route.id)}
      transition={{ layout: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } }}
      className={cn(
        "border cursor-pointer transition-colors duration-150 overflow-hidden rounded-xl",
        selected ? "border-primary bg-card" : "border-border/60 bg-card/50 hover:border-border hover:bg-card",
      )}
    >
      <div className={cn("h-1 w-full",
        route.riskLevel === "high" ? "bg-red-400/60" :
        route.riskLevel === "medium" ? "bg-amber-400/60" : "bg-emerald-400/60"
      )} />
      <div className="px-6 py-6 flex items-center gap-6">
        <div className="flex-1 min-w-0 space-y-2">
          <span className={cn("text-xs uppercase tracking-widest font-semibold",
            route.label === "fastest" ? "text-amber-400" :
            route.label === "balanced" ? "text-primary" : "text-emerald-400"
          )}>{route.label}</span>
          <p className="text-sm font-semibold text-foreground">{route.eta} · {route.distance}</p>
          {(riskDelta !== null || etaDelta !== null) && (
            <div className="flex items-center gap-2 flex-wrap">
              {etaDelta !== null && etaDelta !== 0 && (
                <span className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                  etaDelta > 0 ? "text-amber-400/80 bg-amber-400/10" : "text-emerald-400/80 bg-emerald-400/10"
                )}>
                  {etaDelta > 0 ? `+${etaDelta}` : etaDelta} min
                </span>
              )}
              {riskDelta !== null && riskDelta !== 0 && (
                <span className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                  riskDelta > 0 ? "text-red-400/80 bg-red-400/10" : "text-emerald-400/80 bg-emerald-400/10"
                )}>
                  {riskDelta > 0 ? `+${riskDelta}` : riskDelta} risk
                </span>
              )}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={cn("text-3xl font-bold tabular-nums", riskColor)}>{route.riskScore}</p>
          <p className={cn("text-xs uppercase tracking-widest mt-1", riskColor)}>{route.riskLevel}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoutesPage() {
  const { state, dispatchShipment, completeShipment } = useStore();

  // Capture pending shipment at mount time.
  // After dispatch, store clears pendingShipment — if we read it reactively,
  // the map phase falls back to null and shows wrong data.
  // Capturing once at mount guarantees origin/destination stay correct
  // through the entire cards → pass → map flow.
  const [shipmentData] = useState(() => state.pendingShipment ?? null);

  const [shipmentCode] = useState(() => generateShipmentCode());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dispatchedId, setDispatchedId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [phase, setPhase] = useState<"cards" | "pass" | "map">("cards");

  const [routes, setRoutes] = useState<Route[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(!!shipmentData);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [weatherScore, setWeatherScore] = useState(20);
  const [dataSource, setDataSource] = useState<string | undefined>(undefined);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!shipmentData) return;

    const fetchRoutes = async () => {
      setLoadingRoutes(true);
      setRouteError(null);
      try {
        console.log("ROUTE INPUT:", shipmentData.origin, "→", shipmentData.destination);
        const res = await fetch("/api/analyze-routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin:      shipmentData.origin,
            destination: shipmentData.destination,
            cargoType:   shipmentData.cargoType,
            vehicleType: shipmentData.vehicleType,
            urgency:     shipmentData.urgency ?? "Standard",
          }),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        setRoutes(data.routes ?? []);
        setWeatherScore(data.weatherScore ?? 20);
        setDataSource(data.source);
      } catch (err) {
        setRouteError(err instanceof Error ? err.message : "Failed to load routes");
      } finally {
        setLoadingRoutes(false);
      }
    };

    fetchRoutes();
  // shipmentData is captured once at mount — stable reference, no re-runs needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRoute = routes.find((r) => r.id === selectedId) ?? null;
  const confidence = selectedRoute ? deriveConfidence(selectedRoute, routes, dataSource) : 75;
  const recommended = routes.find((r) => r.recommended) ?? routes[1] ?? routes[0];
  const alternatives = routes.filter((r) => r.id !== recommended?.id);
  const urgency = shipmentData?.urgency ?? "Standard";

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setPhase("pass");

    const selected = routes.find((r) => r.id === id);
    if (!selected || !shipmentData) return;
    setAiExplanation(null);
    setAiLoading(true);

    // Hard 10s client-side timeout for AI insight — never leave loading state open
    const aiTimeout = setTimeout(() => {
      setAiLoading(false);
      // explanation stays null → AiInsightBox renders deterministic fallback
    }, 10_000);

    fetch("/api/ai-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin:        shipmentData.origin,
        destination:   shipmentData.destination,
        cargoType:     shipmentData.cargoType,
        vehicleType:   shipmentData.vehicleType,
        urgency,
        selectedRoute: selected,
        allRoutes:     routes,
        weatherScore,
      }),
    })
      .then((r) => r.json())
      .then((data) => setAiExplanation(data.explanation ?? null))
      .catch(() => setAiExplanation(null))
      .finally(() => {
        clearTimeout(aiTimeout);
        setAiLoading(false);
      });
  };

  const handleConfirm = async () => {
    if (!selectedRoute) { setPhase("map"); return; }
    // Use the original pending from the store (still valid at confirm time)
    const pending = state.pendingShipment ?? shipmentData;
    if (pending) {
      const newShipment = await dispatchShipment({
        pending, route: selectedRoute, confidencePercent: confidence,
      });
      setDispatchedId(newShipment.id);
    }
    setPhase("map");
  };

  const handleComplete = () => {
    if (dispatchedId) completeShipment(dispatchedId);
    setCompleted(true);
  };

  // ── Guard: no shipment data ───────────────────────────────────────────────
  if (!shipmentData) {
    return (
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <p className="text-base font-semibold text-foreground">No shipment configured</p>
          <p className="text-sm text-muted-foreground">Start by creating a shipment first.</p>
          <Link href="/create-shipment">
            <Button className="mt-4 h-10 px-6 rounded-lg">Create Shipment</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loadingRoutes) {
    return (
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            className="w-8 h-8 border-2 border-border border-t-primary rounded-full"
          />
          <p className="text-sm text-muted-foreground">Analyzing routes...</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (routeError || routes.length === 0) {
    const handleRetry = () => {
      setRouteError(null);
      setRoutes([]);
      setLoadingRoutes(true);

      fetch("/api/analyze-routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin:      shipmentData.origin,
          destination: shipmentData.destination,
          cargoType:   shipmentData.cargoType,
          vehicleType: shipmentData.vehicleType,
          urgency:     shipmentData.urgency ?? "Standard",
        }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(`API error: ${r.status}`);
          return r.json();
        })
        .then((data) => {
          setRoutes(data.routes ?? []);
          setWeatherScore(data.weatherScore ?? 20);
          setDataSource(data.source);
        })
        .catch((err) => {
          setRouteError(err instanceof Error ? err.message : "Failed to load routes");
        })
        .finally(() => setLoadingRoutes(false));
    };

    return (
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <p className="text-base font-semibold text-foreground">Could not load routes</p>
          <p className="text-sm text-muted-foreground">{routeError ?? "No routes returned"}</p>
          <Button className="mt-4 h-10 px-6 rounded-lg" onClick={handleRetry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Completed ─────────────────────────────────────────────────────────────
  if (completed && selectedRoute) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <div className="inline-flex items-center gap-5 border border-emerald-400/20 bg-emerald-400/5 px-10 py-8 rounded-xl">
          <CheckCircle className="w-7 h-7 text-emerald-400 shrink-0" />
          <div className="text-left space-y-1">
            <p className="text-base font-semibold text-foreground">Shipment completed</p>
            <p className="text-sm text-muted-foreground">
              {selectedRoute.name} · {shipmentData.origin} → {shipmentData.destination}
            </p>
          </div>
        </div>
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/dashboard">
            <Button className="h-11 px-8 w-full sm:w-auto rounded-lg">Go to Dashboard</Button>
          </Link>
          <Link href="/create-shipment">
            <Button variant="outline" className="h-11 px-8 w-full sm:w-auto rounded-lg">New Shipment</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <LayoutGroup>
      <div className="max-w-7xl mx-auto w-full space-y-8">

        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-8 border-b border-border">
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/create-shipment">
              <button className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            </Link>
            <div className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
              <span>{shipmentData.origin}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground/50" />
              <span>{shipmentData.destination}</span>
            </div>
            <span className="text-xs text-muted-foreground border border-border px-3 py-1.5 uppercase tracking-widest rounded-md hidden sm:inline">
              {shipmentData.cargoType}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">3 routes analyzed</p>
        </div>

        {/* ── Map phase ── */}
        {phase === "map" && selectedRoute ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
            className="flex flex-col lg:flex-row gap-8"
          >
            <div className="flex-1 min-w-0">
              <RouteMapView
                route={selectedRoute} routes={routes} status="dispatched"
                origin={shipmentData.origin} destination={shipmentData.destination}
                aiExplanation={aiExplanation} aiLoading={aiLoading}
                cargoType={shipmentData.cargoType}
                urgency={urgency}
                dataSource={dataSource}
              />
            </div>
            <div className="lg:w-80 shrink-0 space-y-5">
              <DispatchedStub
                shipment={{
                  origin: shipmentData.origin, destination: shipmentData.destination,
                  cargoType: shipmentData.cargoType, vehicleType: shipmentData.vehicleType,
                  shipmentCode, confidencePercent: confidence,
                }}
                route={selectedRoute}
              />
              <div className="border border-border rounded-xl p-6 space-y-5">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Active risk</p>
                <div className="space-y-4">
                  {Object.entries(selectedRoute.riskBreakdown).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-24 shrink-0 capitalize">
                        {key === "cargoSensitivity" ? "Cargo" : key}
                      </span>
                      <div className="flex-1 h-2 bg-muted overflow-hidden rounded-full">
                        <div className={cn("h-full rounded-full", val > 60 ? "bg-red-400" : val > 35 ? "bg-amber-400" : "bg-emerald-400")}
                          style={{ width: `${val}%` }} />
                      </div>
                      <span className="text-sm font-mono text-muted-foreground w-6 text-right">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border border-border rounded-xl p-6 space-y-3">
                <Button className="w-full h-11 text-sm font-semibold rounded-lg" onClick={handleComplete}>
                  Mark as Completed
                </Button>
                <Link href="/dashboard" className="block">
                  <Button variant="outline" className="w-full h-11 text-sm rounded-lg">Go to Dashboard</Button>
                </Link>
              </div>
            </div>
          </motion.div>

        ) : phase === "pass" && selectedRoute ? (
          /* ── Pass phase ── */
          <motion.div
            key="pass-view"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0, 0.2, 1] }}
            className="flex justify-center py-8"
          >
            <div className="w-full max-w-lg">
              <ShipmentPass
                route={selectedRoute}
                shipment={{
                  origin: shipmentData.origin, destination: shipmentData.destination,
                  cargoType: shipmentData.cargoType, vehicleType: shipmentData.vehicleType,
                  shipmentCode, confidencePercent: confidence,
                }}
                onConfirm={handleConfirm}
                morphLayoutId={`route-card-${selectedRoute.id}`}
                urgency={urgency}
                allRoutes={routes}
                dataSource={dataSource}
              />
            </div>
          </motion.div>

        ) : (
          /* ── Cards phase ── */
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 min-w-0">
              {dataSource && (
                <div className={cn(
                  "flex items-start gap-2 text-xs font-medium px-4 py-3 rounded-lg border mb-5",
                  dataSource === "osrm+openweather"
                    ? "bg-emerald-400/5 border-emerald-400/20 text-emerald-400"
                    : "bg-amber-400/5 border-amber-400/20 text-amber-400"
                )}>
                  {dataSource === "osrm+openweather" ? (
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-0.5" />
                      <span>Live data — OSRM routing + OpenWeather active</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-0.5" />
                        <span>Estimated routes — live data unavailable</span>
                      </div>
                      <p className="text-[10px] text-amber-400/70 pl-3.5 leading-relaxed">
                        Traffic data not available — verify ETAs before dispatch. Weather scoring is approximate. Use safest route for time-sensitive cargo.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {recommended && (
                <DominantRoute
                  route={recommended}
                  onSelect={handleSelect}
                  selected={selectedId === recommended.id}
                  cargoType={shipmentData.cargoType}
                  urgency={urgency}
                  allRoutes={routes}
                />
              )}
            </div>
            <div className="lg:w-80 xl:w-88 shrink-0 space-y-5">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Alternatives</p>
              {alternatives.map((route) => (
                <AlternativeRow
                  key={route.id}
                  route={route}
                  onSelect={handleSelect}
                  selected={selectedId === route.id}
                  referenceRoute={recommended}
                />
              ))}
              {/* Simulation disclosure — shown when any alternative is a synthesized estimate */}
              {alternatives.some((r) => r.isSimulated) && (
                <p className="text-[10px] text-muted-foreground/50 leading-relaxed px-1">
                  Alternative routes are simulated estimates based on the primary corridor.
                </p>
              )}
              <div className="border border-border/50 rounded-xl p-6 space-y-4">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Decision context</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {decisionContextText(routes)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutGroup>
  );
}
