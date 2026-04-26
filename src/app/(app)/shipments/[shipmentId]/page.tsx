"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Clock, Truck, Package, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RouteMapView } from "@/components/shipment/RouteMapView";
import { getRiskColor, cn, formatRelativeTime } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Shipment } from "@/lib/types";

export default function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const { shipmentId } = use(params);
  const { state, completeShipment } = useStore();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const found = (state.shipments ?? []).find((item) => item.id === shipmentId);
    if (found) { setShipment(found); setLoading(false); }
    else if (!state.loading) { setLoading(false); }
  }, [shipmentId, state.shipments, state.loading]);

  if (loading) {
    return (
      <div className="p-32 text-center flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground uppercase tracking-widest">Loading shipment...</p>
      </div>
    );
  }

  if (!shipment) notFound();

  const handleComplete = () => {
    completeShipment(shipment.id);
    setShipment((prev) =>
      prev ? { ...prev, status: "completed", lastUpdate: new Date().toISOString() } : prev
    );
  };

  // Use stored riskBreakdown only — never fabricate values.
  // If not stored (legacy shipments), show a disclosure instead.
  const hasBreakdown = !!shipment.riskBreakdown;
  const breakdown = shipment.riskBreakdown ?? {
    traffic: 0, weather: 0, disruption: 0, cargoSensitivity: 0,
  };

  const routeForMap = {
    id:            shipment.id,
    label:         shipment.selectedRoute,
    name:          shipment.routeName,
    eta:           shipment.eta,
    etaMinutes:    0,
    distance:      shipment.distance,
    distanceKm:    parseFloat(shipment.distance) || 0,
    riskScore:     shipment.riskScore,
    riskLevel:     shipment.riskLevel,
    recommended:   false,
    summary:       "",
    alerts:        shipment.predictiveAlert ? [shipment.predictiveAlert] : [],
    riskBreakdown: breakdown,
  };

  const statusBadgeClass =
    shipment.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
    shipment.status === "at-risk"   ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
    "bg-primary/10 text-primary border-primary/20";

  // Dynamic decision context based on actual data
  const decisionContext = (() => {
    const label = shipment.selectedRoute;
    const risk  = shipment.riskScore;
    const cargo = shipment.cargoType;

    if (label === "safest") {
      return `Safest route selected for ${cargo} cargo (risk: ${risk}). Longer ETA accepted to minimise disruption probability and protect cargo integrity.`;
    }
    if (label === "fastest") {
      return `Fastest route selected (risk: ${risk}). Speed was prioritised — monitor for congestion and weather alerts during transit.`;
    }
    return `Balanced route selected (risk: ${risk}). Optimal tradeoff between ETA and disruption risk for ${cargo} cargo.`;
  })();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-10">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-5 pb-8 border-b border-border">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Shipment detail</p>
          <h1 className="text-3xl font-bold text-foreground">{shipment.shipmentCode}</h1>
          <p className="text-sm text-muted-foreground">{shipment.origin} → {shipment.destination}</p>
        </div>
        <div className="flex items-center gap-3">
          {(shipment.status === "active" || shipment.status === "at-risk") && (
            <button
              onClick={handleComplete}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              Mark as Completed
            </button>
          )}
          <Link
            href="/shipments"
            className="flex items-center gap-2 border border-border hover:border-border/80 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Shipments
          </Link>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">

        {/* Left */}
        <div className="space-y-6">
          <div className="panel p-7">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 px-3 py-1 text-xs font-semibold">
                {shipment.routeName}
              </Badge>
              <Badge className={cn("px-3 py-1 text-xs font-semibold border", statusBadgeClass)}>
                {shipment.status.replace("-", " ")}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="space-y-1.5">
                <p className="label-meta">ETA</p>
                <p className="text-2xl font-bold text-foreground">{shipment.eta}</p>
              </div>
              <div className="space-y-1.5">
                <p className="label-meta">Risk Score</p>
                <p className={cn("text-2xl font-bold", getRiskColor(shipment.riskLevel))}>
                  {shipment.riskScore}
                  <span className="text-sm font-normal text-muted-foreground ml-1.5 capitalize">/ {shipment.riskLevel}</span>
                </p>
              </div>
            </div>

            <Separator className="my-5 opacity-30" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="truncate">{shipment.origin} → {shipment.destination}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Updated {formatRelativeTime(shipment.lastUpdate)}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4 shrink-0" />
                <span>{shipment.cargoType}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 shrink-0" />
                <span>{shipment.vehicleType}</span>
              </div>
            </div>

            <Separator className="my-5 opacity-30" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="label-meta">Distance</p>
                <p className="text-sm font-semibold text-foreground">{shipment.distance}</p>
              </div>
              <div className="space-y-1">
                <p className="label-meta">Confidence</p>
                <p className="text-sm font-semibold text-foreground">{shipment.confidencePercent}%</p>
              </div>
              <div className="space-y-1">
                <p className="label-meta">Departure</p>
                <p className="text-sm font-semibold text-foreground">{shipment.departureTime}</p>
              </div>
              <div className="space-y-1">
                <p className="label-meta">Shipment Code</p>
                <p className="text-sm font-mono font-semibold text-foreground">{shipment.shipmentCode}</p>
              </div>
            </div>

            {shipment.predictiveAlert && (
              <>
                <Separator className="my-5 opacity-30" />
                <div className="flex items-start gap-3 bg-amber-400/5 border border-amber-400/20 rounded-lg px-4 py-3">
                  <span className="text-amber-400 mt-0.5">⚠</span>
                  <p className="text-sm text-amber-400/90 leading-relaxed">{shipment.predictiveAlert}</p>
                </div>
              </>
            )}
          </div>

          {/* Dynamic decision context */}
          <div className="panel p-7">
            <p className="label-meta mb-4">Decision context</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{decisionContext}</p>
          </div>
        </div>

        {/* Right: map */}
        <div>
          {!hasBreakdown && (
            <p className="text-xs text-muted-foreground/50 mb-3 px-1">
              Risk breakdown unavailable for this shipment.
            </p>
          )}
          <RouteMapView
            route={routeForMap}
            routes={[routeForMap]}
            status={shipment.status === "completed" ? "completed" : "active"}
            origin={shipment.origin}
            destination={shipment.destination}
          />
        </div>
      </div>
    </div>
  );
}
