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

// Demo routes — use canonical Route shape (eta string, etaMinutes number, distance string)
const demoRoutes: Route[] = [
  {
    id: "route-fastest",
    label: "fastest",
    name: "Route A — Fastest",
    eta: "6h 12m",
    etaMinutes: 372,
    distance: "345 km",
    distanceKm: 345,
    riskScore: 72,
    riskLevel: "high",
    recommended: false,
    summary: "High-speed corridor with moderate traffic density. Optimized for transit velocity.",
    riskBreakdown: { traffic: 65, weather: 15, disruption: 30, cargoSensitivity: 10 },
    alerts: ["Heavy traffic near Bangalore entry"],
  },
  {
    id: "route-balanced",
    label: "balanced",
    name: "Route B — Balanced",
    eta: "7h 06m",
    etaMinutes: 426,
    distance: "362 km",
    distanceKm: 362,
    riskScore: 24,
    riskLevel: "low",
    recommended: true,
    summary: "Balanced tradeoff between fuel efficiency and predictable travel time.",
    riskBreakdown: { traffic: 25, weather: 12, disruption: 15, cargoSensitivity: 10 },
    alerts: [],
  },
  {
    id: "route-safest",
    label: "safest",
    name: "Route C — Safest",
    eta: "8h 24m",
    etaMinutes: 504,
    distance: "398 km",
    distanceKm: 398,
    riskScore: 12,
    riskLevel: "low",
    recommended: false,
    summary: "Longer route but avoids all major congestion zones and high-risk weather areas.",
    riskBreakdown: { traffic: 5, weather: 8, disruption: 5, cargoSensitivity: 10 },
    alerts: [],
  },
];

const DEMO_SHIPMENT_CODE = "SR-DEMO-001";

const DEMO_SHIPMENT = {
  origin: "Chennai",
  destination: "Bangalore",
  cargoType: "Electronics",
  vehicleType: "Container Truck",
  urgency: "Standard",
};

const STEPS = ["Compare Routes", "Inspect Risk", "Lock Route", "Dispatch"];

export default function DemoPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"cards" | "pass" | "map">("cards");
  const [completed, setCompleted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

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
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <RouteIcon className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-base text-foreground tracking-tight">SentinelRoute</span>
        </Link>
        <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30 bg-primary/5 px-2 h-6 tracking-widest uppercase">
          Interactive Demo
        </Badge>
        <div className="flex-1" />
        <Link href="/auth/signup">
          <Button size="sm" className="h-9 px-4 text-xs font-semibold gap-2">
            Get Started <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </header>

      {/* Step progress */}
      <div className="border-b border-border bg-muted/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6 overflow-x-auto">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-3 shrink-0">
              <div
                className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                  i < currentStep
                    ? "bg-emerald-400/20 border-emerald-400 text-emerald-400"
                    : i === currentStep
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-muted/20 border-border text-muted-foreground"
                }`}
              >
                {i < currentStep ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${i === currentStep ? "text-foreground" : "text-muted-foreground"}`}>
                {step}
              </span>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
              <span>{DEMO_SHIPMENT.origin}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span>{DEMO_SHIPMENT.destination}</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              {phase === "cards" ? "Route Comparison" : phase === "pass" ? "Confirm Dispatch" : "Active Mission"}
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              {phase === "cards"
                ? "Compare risk scores and operational tradeoffs across 3 route options."
                : phase === "pass"
                  ? "Review route details and confirm dispatch to generate an audit trail."
                  : "Route locked. Monitoring active transit."}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3 bg-muted/20 border border-border rounded-xl px-4 py-3 text-xs text-muted-foreground font-medium">
            <Info className="w-4 h-4 text-primary" />
            <span>
              {currentStep === 0 ? "Click a route card to select it" : currentStep === 2 ? "Confirm to dispatch" : "Demo complete"}
            </span>
          </div>
        </div>

        {/* Completed state */}
        {completed ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-8 bg-card border border-border rounded-xl"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <div className="text-center max-w-md space-y-3">
              <h2 className="text-2xl font-bold text-foreground">Shipment Dispatched</h2>
              <p className="text-sm text-muted-foreground">
                Route locked · Decision recorded · Audit trail created.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                variant="outline"
                className="h-11 px-8 font-semibold rounded-lg"
                onClick={() => { setSelectedId(null); setPhase("cards"); setCompleted(false); }}
              >
                Try Again
              </Button>
              <Link href="/auth/signup">
                <Button className="h-11 px-8 font-semibold rounded-lg gap-2">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </motion.div>

        ) : phase === "map" && selectedRoute ? (
          <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
            <RouteMapView
              route={selectedRoute}
              routes={demoRoutes}
              origin={DEMO_SHIPMENT.origin}
              destination={DEMO_SHIPMENT.destination}
            />

            <div className="space-y-5">
              <div className="bg-card border border-border rounded-xl p-6 space-y-5">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Active Mission</p>
                  <p className="text-base font-semibold text-foreground">{selectedRoute.name}</p>
                  <p className="text-xs font-mono text-muted-foreground">{DEMO_SHIPMENT_CODE}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Risk Score</span>
                    <span className="font-bold text-primary">{selectedRoute.riskScore}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">ETA</span>
                    <span className="font-semibold text-foreground">{selectedRoute.eta}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Distance</span>
                    <span className="font-semibold text-foreground">{selectedRoute.distance}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/20 text-[10px] font-semibold">
                      Dispatched
                    </Badge>
                  </div>
                </div>

                <Button className="w-full h-11 font-semibold rounded-lg" onClick={() => setCompleted(true)}>
                  Complete Demo
                </Button>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                <p className="text-xs text-primary uppercase tracking-widest font-semibold mb-2">Demo Note</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  In the full product, this view shows live weather sampling and disruption monitoring for the active transit corridor.
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
                      {/* ShipmentPass uses `shipment` prop — canonical shape */}
                      <ShipmentPass
                        route={route}
                        shipment={{
                          origin:            DEMO_SHIPMENT.origin,
                          destination:       DEMO_SHIPMENT.destination,
                          cargoType:         DEMO_SHIPMENT.cargoType,
                          vehicleType:       DEMO_SHIPMENT.vehicleType,
                          shipmentCode:      DEMO_SHIPMENT_CODE,
                          confidencePercent: 82,
                        }}
                        onConfirm={handleConfirm}
                        morphLayoutId={`route-card-${route.id}`}
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

      {/* Conversion footer */}
      {!completed && (
        <div className="border-t border-border bg-card/50 mt-16">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Ready to use SentinelRoute for real?</p>
              <p className="text-xs text-muted-foreground">Full access to all features. No credit card required.</p>
            </div>
            <Link href="/auth/signup">
              <Button className="h-10 px-6 font-semibold rounded-lg gap-2">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
