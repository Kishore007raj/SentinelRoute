"use client";
import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  MapPin,
  Clock,
  Truck,
  Package,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RouteMapView } from "@/components/shipment/RouteMapView";
import { demoRoutes } from "@/lib/mock-data";
import { getRiskColor } from "@/lib/utils";
import { useStore } from "@/lib/store";

export default function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const { shipmentId } = use(params);
  const { state } = useStore();
  const shipment = state.shipments.find((item) => item.id === shipmentId);

  if (!shipment) {
    notFound();
  }

  const selectedRoute =
    demoRoutes.find((route) => route.label === shipment.selectedRoute) ||
    demoRoutes.find((route) => route.name.startsWith(shipment.routeName));

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-5 mb-10 pb-8 border-b border-border">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Shipment detail</p>
          <h1 className="text-3xl font-bold text-foreground">{shipment.shipmentCode}</h1>
          <p className="text-sm text-muted-foreground">
            {shipment.origin} → {shipment.destination} · {shipment.status.replace("-", " ")}
          </p>
        </div>
        <Link
          href="/shipments"
          className="text-sm text-primary hover:underline flex items-center gap-1.5 shrink-0 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to shipments
        </Link>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.9fr_1fr]">
        <div className="space-y-6">
          <div className="panel p-7 border-border">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Badge className="text-[10px] bg-primary/10 text-primary border-primary/25">
                {shipment.routeName}
              </Badge>
              <Badge className="text-[10px] border border-border text-muted-foreground">
                {shipment.selectedRoute.replace("-", " ")}
              </Badge>
              <Badge className={`text-[10px] border ${
                shipment.status === "completed"
                  ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/25"
                  : shipment.status === "at-risk"
                  ? "bg-amber-400/10 text-amber-400 border-amber-400/25"
                  : "bg-primary/10 text-primary border-primary/25"
              }`}>
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
                <p className={getRiskColor(shipment.riskLevel) + " text-2xl font-bold"}>
                  {shipment.riskScore}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="truncate">{shipment.origin} → {shipment.destination}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Last updated {shipment.lastUpdate}</span>
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
            <Separator className="my-6 opacity-30" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Confidence</p>
                  <p>{shipment.confidencePercent}%</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Predictive alert</p>
                  <p>{shipment.predictiveAlert ?? "No active alerts"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="panel p-7 border-border">
            <p className="label-meta mb-4 uppercase tracking-widest text-muted-foreground">Decision context</p>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>Selected route is justified by a balanced tradeoff between ETA and disruption risk.</p>
              <p>All route decisions are recorded with risk scoring and predictive alert context.</p>
              <p>Use this page to review shipment status, route justification, and operational notes.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {selectedRoute ? (
            <RouteMapView
              route={selectedRoute}
              routes={demoRoutes}
              status={shipment.status === "completed" ? "dispatched" : "active"}
              origin={shipment.origin}
              destination={shipment.destination}
            />
          ) : (
            <div className="panel p-7 border-border text-sm text-muted-foreground">
              Route map preview is unavailable for this shipment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
