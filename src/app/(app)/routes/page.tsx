"use client";
import { useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { ArrowRight, ChevronLeft, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShipmentPass } from "@/components/shipment/ShipmentPass";
import { RouteMapView } from "@/components/shipment/RouteMapView";
import { DispatchedStub } from "@/components/shipment/ShipmentPass";
import { demoRoutes } from "@/lib/mock-data";
import { generateShipmentCode, cn, getRiskColor } from "@/lib/utils";
import { useStore, type ShipmentStubRecord } from "@/lib/store";
import type { Route } from "@/lib/mock-data";
import Link from "next/link";

const FALLBACK_SHIPMENT = {
  origin: "Chennai", destination: "Bangalore",
  cargoType: "Electronics", vehicleType: "Container Truck",
};

// ─── Dominant route ───────────────────────────────────────────────────────────
function DominantRoute({ route, onSelect, selected }: {
  route: Route; onSelect: (id: string) => void; selected: boolean;
}) {
  const riskColor = getRiskColor(route.riskLevel);
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
                  Recommended
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-foreground">{route.name}</h2>
          </div>
          <div className="text-right shrink-0 ml-8">
            <p className={cn("text-7xl font-bold tabular-nums leading-none", riskColor)}>
              {route.riskScore}
            </p>
            <p className={cn("text-xs uppercase tracking-widest mt-2", riskColor)}>
              {route.riskLevel} risk
            </p>
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
              <span className="text-sm font-mono text-muted-foreground w-8 text-right shrink-0">{val}</span>
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
function AlternativeRow({ route, onSelect, selected }: {
  route: Route; onSelect: (id: string) => void; selected: boolean;
}) {
  const riskColor = getRiskColor(route.riskLevel);
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
  const { state, dispatchShipment, completeShipment, addStub } = useStore();
  const pending = state.pendingShipment;
  const shipmentData = pending ?? FALLBACK_SHIPMENT;
  const [shipmentCode] = useState(() => generateShipmentCode());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dispatchedId, setDispatchedId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [phase, setPhase] = useState<"cards" | "pass" | "tearing" | "map">("cards");

  const selectedRoute = demoRoutes.find((r) => r.id === selectedId) ?? null;
  const confidence = selectedRoute
    ? selectedRoute.label === "balanced" ? 82 : selectedRoute.label === "safest" ? 94 : 61
    : 82;
  const recommended = demoRoutes.find((r) => r.recommended) ?? demoRoutes[1];
  const alternatives = demoRoutes.filter((r) => r.id !== recommended.id);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setTimeout(() => setPhase("pass"), 350);
  };

  const handleConfirm = () => {
    if (!selectedRoute) { setPhase("map"); return; }
    if (pending) {
      const newShipment = dispatchShipment({ pending, routeId: selectedRoute.id, confidencePercent: confidence });
      setDispatchedId(newShipment.id);
      const stub: ShipmentStubRecord = {
        id: newShipment.id, shipmentCode: newShipment.shipmentCode,
        origin: newShipment.origin, destination: newShipment.destination,
        routeName: newShipment.routeName, riskScore: newShipment.riskScore,
        riskLevel: newShipment.riskLevel, eta: newShipment.eta,
        cargoType: newShipment.cargoType, vehicleType: newShipment.vehicleType,
        confidencePercent: newShipment.confidencePercent,
        dispatchedAt: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        status: newShipment.status,
      };
      addStub(stub);
    }
    // Transition to map view
    setPhase("map");
  };

  const handleComplete = () => {
    if (dispatchedId) completeShipment(dispatchedId);
    setCompleted(true);
  };

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

  return (
    <LayoutGroup>
      <div className="max-w-7xl mx-auto w-full space-y-8">

        {/* Header */}
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

        {/* Map view */}
        {phase === "map" && selectedRoute ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col lg:flex-row gap-8"
          >
            <div className="flex-1 min-w-0">
              <RouteMapView
                route={selectedRoute}
                routes={demoRoutes}
                status="dispatched"
                origin={shipmentData.origin}
                destination={shipmentData.destination}
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
          <motion.div
            key="pass-view"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: [0.2, 0, 0.2, 1] }}
            layout
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
              />
            </div>
          </motion.div>

        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 min-w-0">
              <DominantRoute
                route={recommended}
                onSelect={handleSelect}
                selected={selectedId === recommended.id}
              />
            </div>
            <div className="lg:w-80 xl:w-88 shrink-0 space-y-5">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Alternatives</p>
              {alternatives.map((route) => (
                <AlternativeRow
                  key={route.id}
                  route={route}
                  onSelect={handleSelect}
                  selected={selectedId === route.id}
                />
              ))}
              <div className="border border-border/50 rounded-xl p-6 space-y-4">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Decision context</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Fastest route is not always the best. Balanced routes reduce disruption risk without major ETA loss.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutGroup>
  );
}
