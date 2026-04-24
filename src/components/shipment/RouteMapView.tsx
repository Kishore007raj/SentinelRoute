"use client";
import { motion } from "framer-motion";
import { MapPin, Shield, Clock, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn, getRiskColor } from "@/lib/utils";
import type { Route } from "@/lib/mock-data";

interface RouteMapViewProps {
  route: Route;
  routes: Route[];
  status?: "active" | "dispatched";
  origin?: string;
  destination?: string;
}

export function RouteMapView({ route, routes, status = "active", origin, destination }: RouteMapViewProps) {
  const riskColor = getRiskColor(route.riskLevel);
  const alternateRoutes = routes.filter((item) => item.id !== route.id);

  return (
    <div className="flex flex-col gap-0 border border-border rounded-xl overflow-hidden">

      {/* Status bar — thin, not a hero */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-2 h-2 rounded-full",
            status === "dispatched" ? "bg-emerald-400" : "bg-primary"
          )} />
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {status === "dispatched" ? "Active mission" : "Planning"}
          </p>
        </div>
        <p className="text-xs font-semibold text-foreground">{route.name}</p>
      </div>

      {/* Map — responsive height */}
      <div className="relative h-[180px] sm:h-[220px] md:h-[260px] bg-slate-950/95 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_rgba(56,189,248,0.08),_transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,_rgba(255,255,255,0.025)_1px,_transparent_1px),linear-gradient(90deg,_rgba(255,255,255,0.025)_1px,_transparent_1px)] bg-[length:60px_60px]" />

        {/* Alternate routes — very faint */}
        {alternateRoutes.map((alt, index) => (
          <div
            key={alt.id}
            className="absolute h-px rounded-full opacity-25 bg-slate-500"
            style={{
              width: `${38 + index * 10}%`,
              top: `${28 + index * 16}%`,
              left: `${10 + index * 2}%`,
            }}
          />
        ))}

        {/* Selected route — clear */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="absolute h-1 bg-primary/70"
          style={{ width: "68%", top: "46%", left: "14%" }}
        />

        {/* Origin */}
        <div className="absolute left-10 top-12 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-slate-200 border border-slate-400" />
          <div>
            <p className="text-[9px] uppercase text-muted-foreground/60 tracking-widest">Origin</p>
            <p className="text-xs font-semibold text-foreground">{origin ?? "Origin"}</p>
          </div>
        </div>

        {/* Destination */}
        <div className="absolute right-10 bottom-12 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-slate-200 border border-slate-400" />
          <div className="text-right">
            <p className="text-[9px] uppercase text-muted-foreground/60 tracking-widest">Destination</p>
            <p className="text-xs font-semibold text-foreground">{destination ?? "Destination"}</p>
          </div>
        </div>

        {/* Route legend — minimal */}
        <div className="absolute right-3 top-3 bg-slate-950/90 border border-slate-700/60 px-2.5 py-2">
          <div className="space-y-1.5">
            {alternateRoutes.map((alt) => (
              <div key={alt.id} className="flex items-center gap-1.5">
                <div className="w-3 h-px bg-slate-500/50" />
                <span className="text-[9px] text-muted-foreground/60">{alt.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-primary/70" />
              <span className="text-[9px] text-foreground font-semibold">{route.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-widest">ETA</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{route.eta}</p>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Risk</p>
          </div>
          <p className={cn("text-2xl font-bold", riskColor)}>{route.riskScore}</p>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Distance</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{route.distance}</p>
        </div>
      </div>

      {/* Alert strip */}
      <div className="border-t border-border px-6 py-5 bg-card/60">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            {route.alerts[0] ?? "No active alerts on this corridor."}
          </p>
        </div>
        <Separator className="my-4 opacity-20" />
        <div className="flex items-center justify-between text-xs text-muted-foreground/50 uppercase tracking-widest">
          <span>Operational note</span>
          <span>{status === "dispatched" ? "Active" : "Planning"}</span>
        </div>
      </div>
    </div>
  );
}
