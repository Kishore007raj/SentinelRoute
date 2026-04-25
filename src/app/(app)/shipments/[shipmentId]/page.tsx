"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Truck,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RouteMapView } from "@/components/shipment/RouteMapView";
import { getRiskColor, cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Shipment } from "@/lib/types";

function FormattedTime({ date }: { date: string }) {
  const [time, setTime] = useState<string>("");
  useEffect(() => {
    setTime(new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, [date]);
  return <span>{time}</span>;
}

export default function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const { shipmentId } = use(params);
  const { state } = useStore();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const found = (state.shipments || []).find((item) => item.shipmentId === shipmentId);
    if (found) {
      setShipment(found);
      setLoading(false);
    } else if (!state.loading) {
      setLoading(false);
    }
  }, [shipmentId, state.shipments, state.loading]);

  if (loading) return (
    <div className="p-32 text-center flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Retrieving shipment manifest...</p>
    </div>
  );
  
  if (!shipment) notFound();

  const handleComplete = async () => {
    if (!shipment) return;
    try {
      await updateShipmentStatus(shipment.shipmentId, "completed");
    } catch (error) {
      console.error("Failed to complete shipment:", error);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-5 mb-10 pb-8 border-b border-border">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-black">Operational Detail</p>
          <h1 className="text-4xl font-black text-foreground tracking-tighter">{shipment.shipmentId}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground font-bold">
            <span>{shipment.origin}</span>
            <span className="opacity-30">→</span>
            <span>{shipment.destination}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {shipment.status === "in_transit" && (
            <button
              onClick={handleComplete}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl text-[11px] uppercase tracking-widest font-black transition-all shadow-lg shadow-emerald-600/20"
            >
              Mark as Completed
            </button>
          )}
          <Link
            href="/shipments"
            className="bg-muted/10 border border-border/60 hover:border-border px-4 py-2 rounded-xl text-[11px] uppercase tracking-widest font-black flex items-center gap-2 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Fleet
          </Link>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          <div className="bg-card border border-border/80 rounded-[2rem] p-10 shadow-xl">
            <div className="flex flex-wrap items-center gap-3 mb-10">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 h-7 px-3 text-[10px] font-black uppercase tracking-widest">
                {shipment.routeName}
              </Badge>
              <Badge className={cn("h-7 px-3 text-[10px] font-black uppercase tracking-widest", 
                shipment.status === "completed" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                shipment.status === "in_transit" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : 
                "bg-amber-500/10 text-amber-400 border-amber-500/20"
              )}>
                {(shipment.status || "").replace("_", " ")}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-12">
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black">Threat Index</p>
                <p className={cn("text-6xl font-black tracking-tighter tabular-nums", getRiskColor(shipment.riskLevel))}>
                  {shipment.riskScore}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black">Transit Time</p>
                <p className="text-6xl font-black tracking-tighter tabular-nums text-foreground">
                  {(shipment.durationHours || 0).toFixed(1)}<span className="text-2xl ml-1 text-muted-foreground">h</span>
                </p>
              </div>
            </div>

            <Separator className="mb-10 opacity-30" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Package size={14} className="opacity-50" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Cargo Classification</span>
                </div>
                <p className="text-base font-bold text-foreground pl-6.5">{shipment.cargoType}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Truck size={14} className="opacity-50" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Vehicle Asset</span>
                </div>
                <p className="text-base font-bold text-foreground pl-6.5">{shipment.vehicleType}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <MapPin size={14} className="opacity-50" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Calculated Distance</span>
                </div>
                <p className="text-base font-bold text-foreground pl-6.5">{(shipment.distanceKm || 0).toFixed(0)} km</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Clock size={14} className="opacity-50" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Last Telemetry</span>
                </div>
                <p className="text-base font-bold text-foreground pl-6.5">
                  <FormattedTime date={shipment.updatedAt} />
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-5">Decision Intelligence Overview</h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-medium">
              Operational analysis for manifest <span className="text-foreground font-bold">{shipment.shipmentId}</span> indicates a {shipment.riskLevel} threat profile. 
              This dynamic calculation integrates corridor geometry, real-time weather vectors, and cargo-specific exposure variables. 
              All telemetry is cryptographically linked to this manifest for audit compliance.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] overflow-hidden border border-border shadow-2xl h-[600px]">
            <RouteMapView
              route={{
                id: "current",
                name: shipment.routeName,
                label: "balanced",
                riskScore: shipment.riskScore,
                riskLevel: shipment.riskLevel,
                durationHours: shipment.durationHours,
                distanceKm: shipment.distanceKm,
                eta: "N/A",
                summary: "",
                alerts: [],
                riskBreakdown: { weather: 0, road: 0, cargo: 0 },
                routeGeometry: shipment.routeGeometry,
                recommended: true
              }}
              routes={[]}
              status={shipment.status as any}
              origin={shipment.origin}
              destination={shipment.destination}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
