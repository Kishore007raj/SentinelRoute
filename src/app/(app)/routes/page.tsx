"use client";
import { useState, useEffect } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { ArrowRight, ChevronLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShipmentPass } from "@/components/shipment/ShipmentPass";
import { RouteMapView } from "@/components/shipment/RouteMapView";
import { cn, getRiskColor } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Route } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
      className={cn(
        "border cursor-pointer transition-colors duration-150 overflow-hidden rounded-2xl bg-card shadow-sm",
        selected ? "border-blue-500 ring-1 ring-blue-500/20" : "border-border hover:border-border/80",
      )}
    >
      <div className={cn("h-1.5 w-full", 
        route.riskLevel === "critical" || route.riskLevel === "high" ? "bg-red-500" : 
        route.riskLevel === "medium" ? "bg-amber-500" : "bg-emerald-500"
      )} />
      <div className="p-10">
        <div className="flex items-start justify-between mb-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 border rounded-md bg-white/5",
                route.label === "fastest" ? "text-amber-400 border-amber-400/20" :
                route.label === "balanced" ? "text-blue-400 border-blue-400/20" :
                "text-emerald-400 border-emerald-400/20"
              )}>{route.label}</span>
              {route.recommended && (
                <span className="text-[10px] text-blue-400 border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 uppercase tracking-widest rounded-md">
                  Recommended
                </span>
              )}
            </div>
            <h2 className="text-3xl font-black text-foreground">{route.name}</h2>
          </div>
          <div className="text-right">
            <p className={cn("text-6xl font-black tabular-nums leading-none", riskColor)}>
              {route.riskScore}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">Risk Index</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10 pb-10 border-b border-border/40">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Est. Duration</p>
            <p className="text-3xl font-bold">{route.durationHours.toFixed(1)}h</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Distance</p>
            <p className="text-3xl font-bold">{route.distanceKm.toFixed(0)} km</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-8">{route.summary}</p>

        <Button
          className={cn(
            "w-full h-12 text-sm font-bold rounded-xl",
            selected ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-muted/30 text-foreground hover:bg-muted/50 border border-border",
          )}
        >
          {selected ? "Confirm Selection" : "Select This Route"}
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
      className={cn(
        "border cursor-pointer transition-colors duration-150 overflow-hidden rounded-xl bg-card",
        selected ? "border-blue-500" : "border-border/60 hover:border-border",
      )}
    >
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="space-y-1">
          <span className={cn("text-[9px] uppercase tracking-widest font-black",
            route.label === "fastest" ? "text-amber-400" :
            route.label === "balanced" ? "text-blue-400" : "text-emerald-400"
          )}>{route.label}</span>
          <p className="text-sm font-bold">{route.durationHours.toFixed(1)}h · {route.distanceKm.toFixed(0)}km</p>
        </div>
        <div className="text-right">
          <p className={cn("text-2xl font-black tabular-nums", riskColor)}>{route.riskScore}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function RoutesPage() {
  const router = useRouter();
  const { state } = useStore();
  const pending = state.pendingShipment;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"cards" | "pass" | "map">("cards");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) {
      router.replace("/create-shipment");
      return;
    }

    const fetchRoutes = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/analyze-routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending),
        });
        if (!res.ok) throw new Error("Failed to analyze routes");
        const data = await res.json();
        setRoutes(data.routes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed");
      } finally {
        setLoading(false);
      }
    };

    fetchRoutes();
  }, [pending, router]);

  if (loading) return (
    <div className="max-w-7xl mx-auto py-32 flex flex-col items-center gap-6">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full" />
      <p className="text-muted-foreground animate-pulse">Running AI corridor analysis...</p>
    </div>
  );

  if (error || !pending) return (
    <div className="max-w-7xl mx-auto py-32 text-center">
      <AlertTriangle className="mx-auto w-10 h-10 text-red-500 mb-4" />
      <h2 className="text-xl font-bold">Analysis Failed</h2>
      <p className="text-muted-foreground mb-8">{error}</p>
      <Link href="/create-shipment"><Button>Restart Analysis</Button></Link>
    </div>
  );

  const selectedRoute = routes.find(r => r.id === selectedId);
  const recommended = routes.find(r => r.recommended) || routes[0];
  const alternatives = routes.filter(r => r.id !== recommended.id);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setPhase("pass");
  };

  return (
    <LayoutGroup>
      <div className="max-w-7xl mx-auto w-full space-y-8 p-6">
        <div className="flex items-center justify-between border-b border-border pb-8">
          <div className="flex items-center gap-6">
            <Link href="/create-shipment">
              <Button variant="ghost" size="sm" className="gap-2"><ChevronLeft size={16}/> Back</Button>
            </Link>
            <div className="flex items-center gap-3 text-xl font-black">
              <span>{pending.origin}</span>
              <ArrowRight size={18} className="text-muted-foreground/40" />
              <span>{pending.destination}</span>
            </div>
          </div>
          <div className="text-sm text-muted-foreground uppercase tracking-widest">3 Corridors Found</div>
        </div>

        {phase === "pass" && selectedRoute ? (
          <div className="py-12">
            <ShipmentPass 
              route={selectedRoute} 
              pending={pending} 
              onConfirm={() => router.push("/shipments")}
            />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-10">
            <div className="flex-1">
              <DominantRoute 
                route={recommended} 
                onSelect={handleSelect} 
                selected={selectedId === recommended.id} 
              />
            </div>
            <div className="lg:w-96 space-y-6">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Alternative Corridors</p>
              {alternatives.map(r => (
                <AlternativeRow 
                  key={r.id} 
                  route={r} 
                  onSelect={handleSelect} 
                  selected={selectedId === r.id} 
                />
              ))}
              
              <div className="bg-blue-600/5 border border-blue-600/20 rounded-2xl p-6">
                <p className="text-xs font-bold text-blue-400 mb-2 uppercase">Operational Intel</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The recommended route balances fuel efficiency with infrastructure stability. Weather patterns along this corridor are currently favorable.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutGroup>
  );
}
