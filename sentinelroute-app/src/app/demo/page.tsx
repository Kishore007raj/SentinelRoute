"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Route,
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
import { demoRoutes } from "@/lib/mock-data";
import Link from "next/link";

const DEMO_SHIPMENT = {
  origin: "Chennai",
  destination: "Bangalore",
  cargoType: "Electronics",
  vehicleType: "Container Truck",
  shipmentCode: "SR-DEMO-001",
  confidencePercent: 82,
};

const STEPS = ["Compare Routes", "Inspect Risk", "Lock Route", "Dispatch"];

export default function DemoPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [completed, setCompleted] = useState(false);

  const selectedRoute = demoRoutes.find((r) => r.id === selectedId);

  const currentStep = !selectedId
    ? 0
    : !showPass
      ? 1
      : !showMap
        ? 2
        : !completed
          ? 3
          : 3;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setTimeout(() => setShowPass(true), 400);
  };

  const handleConfirm = () => setShowMap(true);

  return (
    <div className="min-h-screen bg-background">
      {/* Demo nav */}
      <header className="h-12 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-30 flex items-center px-6 gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Route className="w-3 h-3 text-primary" />
          </div>
          <span className="font-semibold text-sm text-foreground">
            SentinelRoute
          </span>
        </Link>
        <Badge
          variant="outline"
          className="text-[10px] text-primary border-primary/30 bg-primary/5"
        >
          Live Demo — No Login Required
        </Badge>
        <div className="flex-1" />
        <Button asChild size="sm" className="h-7 text-xs">
          <Link href="/auth/signup">
            Get Started <ArrowRight className="w-3 h-3 ml-1" />
          </Link>
        </Button>
      </header>

      {/* Step progress */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                  i < currentStep
                    ? "bg-emerald-400/20 border-emerald-400 text-emerald-400"
                    : i === currentStep
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-muted/20 border-border text-muted-foreground"
                }`}
              >
                {i < currentStep ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs font-medium ${i === currentStep ? "text-foreground" : "text-muted-foreground"}`}
              >
                {step}
              </span>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-3 h-3 text-muted-foreground/40 ml-1" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <span>{DEMO_SHIPMENT.origin}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span>{DEMO_SHIPMENT.destination}</span>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] text-muted-foreground"
              >
                Pre-filled Demo
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Route Comparison
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {!selectedId
                ? "Select a route to compare tradeoffs and inspect risk"
                : !showPass
                  ? "Inspecting risk factors..."
                  : !showMap
                    ? "Lock the route and dispatch the shipment"
                    : "Route locked · View the live map state and complete the demo"}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-muted/20 border border-border rounded-md px-3 py-2 text-[11px] text-muted-foreground">
            <Info className="w-3.5 h-3.5" />
            <span>
              {currentStep === 0
                ? "Click a route card to select it"
                : currentStep === 1
                  ? "Compare the tradeoff"
                  : currentStep === 2
                    ? "Confirm to trigger dispatch"
                    : "Map view active"}
            </span>
          </div>
        </div>

        {completed ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-6"
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-20 h-20 rounded-full bg-emerald-400/10 border-2 border-emerald-400/30 flex items-center justify-center"
            >
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </motion.div>
            <div className="text-center max-w-md">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Shipment Dispatched
              </h2>
              <p className="text-sm text-muted-foreground">
                Route locked · Decision recorded · Stub saved to dashboard ·
                Audit trail created.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                In the full product, this would be reflected in your dashboard
                and analytics.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="h-9 text-sm gap-2"
                onClick={() => {
                  setSelectedId(null);
                  setShowPass(false);
                  setShowMap(false);
                  setCompleted(false);
                }}
              >
                Try Again
              </Button>
              <Button asChild className="h-9 text-sm gap-2">
                <Link href="/auth/signup">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        ) : showMap && selectedRoute ? (
          <div className="grid gap-6 xl:grid-cols-[1.9fr_1fr]">
            <RouteMapView
              route={selectedRoute}
              routes={demoRoutes}
              status="dispatched"
            />

            <div className="space-y-4">
              <div className="panel p-5 border-border">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    Live mission context
                  </p>
                  <Badge className="text-[10px] bg-primary/10 text-primary border-primary/25">
                    Map Active
                  </Badge>
                </div>
                <p className="text-sm text-foreground font-semibold">
                  Dispatch Decision Locked
                </p>
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                  The selected route is live on the map with predictive alerts
                  and operational insights. Complete the demo to move the
                  shipment into history.
                </p>
              </div>

              <div className="panel p-5 border-border space-y-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-[0.22em]">
                  Route summary
                </div>
                <div className="space-y-2 text-[11px] text-muted-foreground">
                  <p>
                    Selected:{" "}
                    <span className="text-foreground font-semibold">
                      {selectedRoute.name}
                    </span>
                  </p>
                  <p>
                    Risk score:{" "}
                    <span className="text-foreground font-semibold">
                      {selectedRoute.riskScore}
                    </span>
                  </p>
                  <p>
                    Alert:{" "}
                    <span className="text-foreground font-semibold">
                      {selectedRoute.alerts[0] ?? "No new alerts"}
                    </span>
                  </p>
                </div>
                <Button
                  className="w-full h-10 text-sm font-semibold"
                  onClick={() => setCompleted(true)}
                >
                  Complete Demo
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className="w-full h-10 text-sm"
                >
                  <Link href="/dashboard">View Dashboard</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Route cards */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              {demoRoutes.map((route, i) => (
                <motion.div
                  key={route.id}
                  layout
                  animate={
                    selectedId && selectedId !== route.id
                      ? { opacity: 0.5, scale: 0.98 }
                      : { opacity: 1, scale: 1 }
                  }
                  transition={{ duration: 0.2 }}
                >
                  <RouteCard
                    route={route}
                    selected={selectedId === route.id}
                    onSelect={handleSelect}
                    index={i}
                  />
                </motion.div>
              ))}
            </div>

            {/* Pass panel */}
            <AnimatePresence>
              {showPass && selectedRoute && (
                <motion.div
                  layoutId={`route-pass-${selectedRoute.id}`}
                  initial={{ opacity: 0, x: 30, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: 360 }}
                  exit={{ opacity: 0, x: 30, width: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="shrink-0 overflow-hidden"
                  style={{ width: 360 }}
                >
                  <div className="sticky top-20">
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs font-semibold text-foreground">
                        Shipment Pass
                      </p>
                      <Badge
                        variant="outline"
                        className="text-[10px] text-emerald-400 border-emerald-400/30"
                      >
                        Ready to Dispatch
                      </Badge>
                    </div>
                    <ShipmentPass
                      route={selectedRoute}
                      shipment={DEMO_SHIPMENT}
                      onConfirm={handleConfirm}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Conversion footer */}
      {!completed && (
        <div className="border-t border-border bg-card/50 mt-12">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Ready to use SentinelRoute for real?
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Full access to all features. No credit card required.
              </p>
            </div>
            <Button asChild className="h-9 text-sm gap-2">
              <Link href="/auth/signup">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
