"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Info, ChevronLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RouteCard } from "@/components/shipment/RouteCard";
import { ShipmentPass } from "@/components/shipment/ShipmentPass";
import { RouteMapView } from "@/components/shipment/RouteMapView";
import { demoRoutes } from "@/lib/mock-data";
import { generateShipmentCode, cn } from "@/lib/utils";
import Link from "next/link";

const DEMO_SHIPMENT = {
  origin: "Mumbai",
  destination: "Pune",
  cargoType: "Electronics",
  vehicleType: "Express Van",
  shipmentCode: generateShipmentCode(),
  confidencePercent: 78,
};

export default function RoutesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [completed, setCompleted] = useState(false);

  const selectedRoute = demoRoutes.find((r) => r.id === selectedId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (!showPass) {
      setTimeout(() => setShowPass(true), 300);
    }
  };

  const handleConfirm = () => setConfirmed(true);
  const handleComplete = () => setCompleted(true);

  if (completed && selectedRoute) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center px-4">
        <div className="inline-flex items-center justify-center gap-3 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 px-6 py-5">
          <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
          <div className="text-left">
            <p className="text-lg font-semibold text-foreground">
              Route confirmed and shipment completed
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedRoute.name} for {DEMO_SHIPMENT.origin} → {DEMO_SHIPMENT.destination} has been moved into history and reflected in analytics.
            </p>
          </div>
        </div>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button className="h-10 text-sm gap-2">Go to Dashboard</Button>
          </Link>
          <Link href="/create-shipment">
            <Button variant="outline" className="h-10 text-sm">Create another shipment</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/create-shipment">
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground gap-1 px-2">
                <ChevronLeft className="w-3 h-3" /> Back
              </Button>
            </Link>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ArrowRight className="w-3 h-3" />
              {DEMO_SHIPMENT.origin} → {DEMO_SHIPMENT.destination}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Route Comparison</h1>
          <p className="text-sm text-muted-foreground mt-1">
            3 routes analyzed · Select the best fit for your operational context
          </p>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 border border-border rounded-md px-3 py-1.5">
          <Info className="w-3 h-3" />
          Click a route card to select it
        </div>
      </div>

      {confirmed && selectedRoute ? (
        <div className="grid gap-6 xl:grid-cols-[1.9fr_1fr]">
          <RouteMapView
            route={selectedRoute}
            routes={demoRoutes}
            status="dispatched"
          />

          <div className="space-y-4">
            <div className="panel p-5 border-border">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Dispatch context</p>
                  <h2 className="text-lg font-semibold text-foreground">Selected route locked in</h2>
                </div>
                <Badge className="text-[10px] bg-emerald-400/10 text-emerald-400 border-emerald-400/25">
                  Confirmed
                </Badge>
              </div>
              <div className="space-y-3 text-[11px] text-muted-foreground leading-relaxed">
                <p>Shipment pass has been dispatched. Live route view is active and predictive alerts are monitoring the corridor.</p>
                <p>The selected route is now auditable with risk score justification, ETA projection, and operational notes.</p>
              </div>
            </div>

            <div className="panel p-5 border-border">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground mb-3">Operational notes</p>
              <div className="space-y-2 text-[11px] text-muted-foreground">
                <p>Rain intensity alert is active along NH48 and may increase delay risk by 20–30 min.</p>
                <p>Route B remains the balanced choice with the lowest combined disruption probability.</p>
                <p>Monitor dispatch readiness and verify cargo temperature for electronics cargo.</p>
              </div>
            </div>

            <div className="panel p-5 border-border space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Shipment metrics</p>
                <div className="mt-3 grid gap-3">
                  {[
                    { label: "Risk Score", value: selectedRoute.riskScore, tone: "text-amber-400" },
                    { label: "ETA", value: selectedRoute.eta, tone: "text-foreground" },
                    { label: "Distance", value: selectedRoute.distance, tone: "text-foreground" },
                    { label: "Confidence", value: `${DEMO_SHIPMENT.confidencePercent}%`, tone: "text-primary" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                      <span>{item.label}</span>
                      <span className={cn("font-semibold", item.tone)}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button className="w-full h-10 text-sm font-semibold" onClick={handleComplete}>
                Mark as Completed
              </Button>
              <Link href="/dashboard" className="block">
                <Button variant="outline" className="w-full h-10 text-sm">Go to Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
            {demoRoutes.map((route, i) => (
              <motion.div
                key={route.id}
                layout
                animate={
                  selectedId && selectedId !== route.id
                    ? { opacity: 0.55, scale: 0.98 }
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

          <AnimatePresence>
            {showPass && selectedRoute && (
              <motion.div
                key="shipment-pass"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full xl:w-[360px] shrink-0"
              >
                <div className="sticky top-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-foreground">Shipment Pass</p>
                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">
                      Preview
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
  );
}
