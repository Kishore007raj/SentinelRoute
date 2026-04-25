"use client";
import { useState, useEffect } from "react";
import { motion, LayoutGroup } from "framer-motion";
import {
  Route as RouteIcon,
  ArrowRight,
  Info,
  CheckCircle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RouteCard } from "@/components/shipment/RouteCard";
import { ShipmentPass } from "@/components/shipment/ShipmentPass";
import { RouteMapView } from "@/components/shipment/RouteMapView";
import type { Route } from "@/lib/types";
import Link from "next/link";

// Inlined demo data to remove dependency on mock-data.ts
const demoRoutes: Route[] = [
  {
    id: "route-fastest",
    label: "fastest",
    name: "Primary Highway 101",
    distanceKm: 345,
    durationHours: 6.2,
    riskScore: 42,
    riskLevel: "medium",
    recommended: false,
    summary: "High-speed corridor with moderate traffic density. Optimized for transit velocity.",
    riskBreakdown: { traffic: 65, weather: 15, disruption: 30, cargoSensitivity: 10 },
    alerts: ["Heavy traffic near Bangalore entry"],
    routeGeometry: { type: "LineString", coordinates: [[80.2707, 13.0827], [77.5946, 12.9716]] }
  },
  {
    id: "route-balanced",
    label: "balanced",
    name: "National Corridor B",
    distanceKm: 362,
    durationHours: 7.1,
    riskScore: 24,
    riskLevel: "low",
    recommended: true,
    summary: "Balanced tradeoff between fuel efficiency and predictable travel time.",
    riskBreakdown: { traffic: 25, weather: 12, disruption: 15, cargoSensitivity: 10 },
    alerts: [],
    routeGeometry: { type: "LineString", coordinates: [[80.2707, 13.0827], [78.5, 12.8], [77.5946, 12.9716]] }
  },
  {
    id: "route-safest",
    label: "safest",
    name: "Expressway Bypass",
    distanceKm: 398,
    durationHours: 8.4,
    riskScore: 12,
    riskLevel: "low",
    recommended: false,
    summary: "Longer route but avoids all major congestion zones and high-risk weather areas.",
    riskBreakdown: { traffic: 5, weather: 8, disruption: 5, cargoSensitivity: 10 },
    alerts: [],
    routeGeometry: { type: "LineString", coordinates: [[80.2707, 13.0827], [79.0, 12.5], [77.5946, 12.9716]] }
  }
];

const DEMO_SHIPMENT = {
  origin: "Chennai",
  destination: "Bangalore",
  cargoType: "Electronics",
  vehicleType: "Container Truck",
  urgency: "High",
  shipmentId: "SR-DEMO-001",
};

const STEPS = ["Compare Routes", "Inspect Risk", "Lock Route", "Dispatch"];

export default function DemoPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"cards" | "pass" | "map">("cards");
  const [completed, setCompleted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const selectedRoute = demoRoutes.find((r) => r.id === selectedId);
  const currentStep = phase === "cards" ? 0 : phase === "pass" ? 2 : 3;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setTimeout(() => setPhase("pass"), 400);
  };

  const handleConfirm = () => {
    setPhase("map");
  };

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50 flex items-center px-6 gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-600/30 flex items-center justify-center">
            <RouteIcon className="w-4 h-4 text-blue-600" />
          </div>
          <span className="font-bold text-base text-foreground tracking-tight">SentinelRoute</span>
        </Link>
        <Badge variant="outline" className="text-[10px] font-bold text-blue-400 border-blue-400/30 bg-blue-400/5 px-2 h-6 tracking-widest uppercase">
          Interactive Demo
        </Badge>
        <div className="flex-1" />
        <Link href="/auth/signup">
          <Button size="sm" className="h-9 px-4 text-xs font-bold gap-2">
            Get Started <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </header>

      <div className="border-b border-border bg-muted/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6 overflow-x-auto no-scrollbar">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-3 shrink-0">
              <div
                className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-black shrink-0 transition-all ${
                  i < currentStep
                    ? "bg-emerald-400/20 border-emerald-400 text-emerald-400"
                    : i === currentStep
                      ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30"
                      : "bg-muted/20 border-border text-muted-foreground"
                }`}
              >
                {i < currentStep ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${i === currentStep ? "text-foreground" : "text-muted-foreground"}`}>
                {step}
              </span>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm font-bold text-foreground">
              <span>{DEMO_SHIPMENT.origin}</span>
              <ArrowRight size={14} className="text-muted-foreground" />
              <span>{DEMO_SHIPMENT.destination}</span>
            </div>
            <h1 className="text-4xl font-black text-foreground tracking-tighter">
              {phase === "cards" ? "Analyze Routes" : phase === "pass" ? "Mission Briefing" : "Operational Live-View"}
            </h1>
            <p className="text-sm text-muted-foreground font-medium max-w-xl">
              {phase === "cards"
                ? "Compare multi-vector risk scores and operational tradeoffs for the current mission corridor."
                : phase === "pass"
                  ? "Verify mission details and lock the selected route to generate an immutable audit trail."
                  : "Route locked. Access live weather sampling and disruption monitoring for the active transit."}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3 bg-muted/20 border border-border rounded-xl px-4 py-3 text-[11px] text-muted-foreground font-bold">
            <Info className="w-4 h-4 text-blue-500" />
            <span className="uppercase tracking-widest">
              {currentStep === 0 ? "Select a manifest card" : currentStep === 2 ? "Authorize dispatch" : "System live"}
            </span>
          </div>
        </div>

        {completed ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-8 bg-card border border-border rounded-[2.5rem] shadow-xl"
          >
            <div className="w-24 h-24 rounded-full bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-emerald-400" />
            </div>
            <div className="text-center max-w-md space-y-3">
              <h2 className="text-3xl font-black text-foreground tracking-tight">Mission Dispatched</h2>
              <p className="text-sm text-muted-foreground font-medium">
                Route data locked. Operational intent recorded. Audit trail successfully generated for compliance.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                variant="outline"
                className="h-11 px-8 font-bold rounded-xl"
                onClick={() => { setSelectedId(null); setPhase("cards"); setCompleted(false); }}
              >
                Reset Demo
              </Button>
              <Link href="/auth/signup">
                <Button className="h-11 px-8 font-bold rounded-xl gap-2 shadow-lg shadow-blue-600/20">
                  Deploy SentinelRoute <ArrowRight size={18} />
                </Button>
              </Link>
            </div>
          </motion.div>
        ) : phase === "map" && selectedRoute ? (
          <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
             <div className="h-[600px] rounded-[2.5rem] overflow-hidden border border-border shadow-2xl">
                <RouteMapView
                  route={selectedRoute}
                  routes={demoRoutes}
                  origin={DEMO_SHIPMENT.origin}
                  destination={DEMO_SHIPMENT.destination}
                />
             </div>

            <div className="space-y-6">
               <div className="bg-card border border-border rounded-3xl p-8 space-y-6 shadow-xl">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Active Mission</p>
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-foreground">{selectedRoute.name}</p>
                      <p className="text-sm text-muted-foreground font-medium">ID: {DEMO_SHIPMENT.shipmentId}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Risk Score</span>
                      <span className="font-bold text-blue-400">{selectedRoute.riskScore}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">ETA</span>
                      <span className="font-bold">{selectedRoute.durationHours.toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Status</span>
                      <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/20 text-[9px] font-black">LOCKED</Badge>
                    </div>
                  </div>

                  <Button className="w-full h-12 font-black rounded-2xl" onClick={() => setCompleted(true)}>
                    Complete Demo
                  </Button>
               </div>
               
               <div className="bg-blue-600/5 border border-blue-600/10 rounded-3xl p-8">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-3">System Note</p>
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                    This simulation demonstrates the live tracking and risk monitoring dashboard used by fleet managers to maintain operational control.
                  </p>
               </div>
            </div>
          </div>
        ) : (
          <LayoutGroup>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {demoRoutes.map((route, i) => {
                const isSelected = selectedId === route.id;
                const shouldHide = selectedId && !isSelected && phase === "pass";
                if (shouldHide) return null;

                if (isSelected && phase === "pass") {
                  return (
                    <motion.div key={`pass-${route.id}`} layout className="md:col-span-3 max-w-lg mx-auto w-full">
                      <ShipmentPass
                        route={route}
                        pending={DEMO_SHIPMENT}
                        onConfirm={handleConfirm}
                      />
                    </motion.div>
                  );
                }

                return (
                  <motion.div key={route.id} layout transition={{ duration: 0.3 }}>
                    <RouteCard
                      route={route}
                      selected={isSelected}
                      onSelect={handleSelect}
                      index={i}
                    />
                  </motion.div>
                );
              })}
            </div>
          </LayoutGroup>
        )}
      </div>
    </div>
  );
}
