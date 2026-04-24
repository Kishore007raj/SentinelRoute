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
import { mockShipments, demoRoutes } from "@/lib/mock-data";
import { getRiskColor } from "@/lib/utils";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const resolvedParams = await params;
  const shipment = mockShipments.find((item) => item.id === resolvedParams.shipmentId);

  if (!shipment) {
    notFound();
  }

  const selectedRoute =
    demoRoutes.find((route) => route.label === shipment.selectedRoute) ||
    demoRoutes.find((route) => route.name === shipment.routeName);

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Shipment detail</p>
          <h1 className="text-2xl font-bold text-foreground">{shipment.shipmentCode}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {shipment.origin} → {shipment.destination} · {shipment.status.replace("-", " ")}
          </p>
        </div>
        <Link
          href="/shipments"
          className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to shipments
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.9fr_1fr]">
        <div className="space-y-4">
          <div className="panel p-5 border-border">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge className="text-[10px] bg-primary/10 text-primary border-primary/25">
                {shipment.routeName}
              </Badge>
              <Badge className="text-[10px] border border-border text-muted-foreground">
                {shipment.selectedRoute.replace("-", " ")}
              </Badge>
              <Badge className="text-[10px] bg-emerald-400/10 text-emerald-400 border-emerald-400/25">
                {shipment.status.replace("-", " ")}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="label-meta mb-1">ETA</p>
                <p className="text-lg font-semibold text-foreground">{shipment.eta}</p>
              </div>
              <div>
                <p className="label-meta mb-1">Risk Score</p>
                <p className={getRiskColor(shipment.riskLevel) + " text-lg font-semibold"}>
                  {shipment.riskScore}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="truncate">{shipment.origin} → {shipment.destination}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Last updated {shipment.lastUpdate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 shrink-0" />
                <span>{shipment.cargoType}</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 shrink-0" />
                <span>{shipment.vehicleType}</span>
              </div>
            </div>
            <Separator className="my-4 opacity-30" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] text-muted-foreground">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Confidence</p>
                  <p>{shipment.confidencePercent}%</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Predictive alert</p>
                  <p>{shipment.predictiveAlert ?? "No active alerts"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="panel p-5 border-border">
            <p className="label-meta mb-3 uppercase tracking-[0.22em] text-muted-foreground">Decision context</p>
            <div className="space-y-3 text-[11px] text-muted-foreground leading-relaxed">
              <p>Selected route is justified by a balanced tradeoff between ETA and disruption risk.</p>
              <p>All route decisions are recorded with risk scoring and predictive alert context.</p>
              <p>Use this page to review shipment status, route justification, and operational notes.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selectedRoute ? (
            <RouteMapView
              route={selectedRoute}
              routes={demoRoutes}
              status={shipment.status === "completed" ? "dispatched" : "active"}
            />
          ) : (
            <div className="panel p-5 border-border text-sm text-muted-foreground">
              Route map preview is unavailable for this shipment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
