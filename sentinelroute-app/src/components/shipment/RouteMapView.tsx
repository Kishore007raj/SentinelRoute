"use client";

import { motion } from "framer-motion";
import { ArrowRight, MapPin, Shield, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn, getRiskColor } from "@/lib/utils";
import type { Route } from "@/lib/mock-data";

interface RouteMapViewProps {
  route: Route;
  routes: Route[];
  status?: "active" | "dispatched";
}

export function RouteMapView({
  route,
  routes,
  status = "active",
}: RouteMapViewProps) {
  const riskColor = getRiskColor(route.riskLevel);
  const activeRoute = routes.find((item) => item.id === route.id);
  const alternateRoutes = routes.filter((item) => item.id !== route.id);

  return (
    <div className="space-y-4">
      <div className="panel p-4 border-border">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.24em] mb-2">
              Route map view
            </p>
            <h2 className="text-xl font-bold text-foreground">
              Live route projection
            </h2>
          </div>
          <Badge
            className={cn(
              "text-[10px] border px-2 py-1 uppercase tracking-[0.22em]",
              status === "dispatched"
                ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/25"
                : "bg-primary/10 text-primary border-primary/25",
            )}
          >
            {status === "dispatched" ? "Dispatched" : "Pending Dispatch"}
          </Badge>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-slate-950/80 overflow-hidden shadow-[0_0_0_1px_rgba(148,163,184,0.08)]">
        <div className="relative h-[420px] bg-slate-950/95 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(255,186,8,0.08),_transparent_18%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[length:120px_120px]" />

          {/* Alternate routes */}
          {alternateRoutes.map((alt, index) => (
            <div
              key={alt.id}
              className={cn(
                "absolute h-1 rounded-full opacity-40",
                index === 0 ? "bg-slate-500" : "bg-slate-600",
              )}
              style={{
                width: `${40 + index * 12}%`,
                top: `${22 + index * 14}%`,
                left: `${8 + index * 2}%`,
              }}
            />
          ))}

          {/* Selected route */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="absolute h-1.5 rounded-full bg-primary/80"
            style={{ width: "72%", top: "42%", left: "12%" }}
          />

          <div className="absolute left-10 top-16 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-100" />
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">
                Origin
              </p>
              <p className="text-sm font-semibold text-foreground">
                {route.id === routes[0].id ? "Chennai" : "Origin"}
              </p>
            </div>
          </div>

          <div className="absolute right-10 bottom-16 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-100" />
            <div className="text-right">
              <p className="text-[10px] uppercase text-muted-foreground">
                Destination
              </p>
              <p className="text-sm font-semibold text-foreground">
                {route.id === routes[1].id ? "Bangalore" : "Destination"}
              </p>
            </div>
          </div>

          <div className="absolute right-6 top-6 rounded-3xl border border-slate-700/80 bg-slate-950/90 p-3 shadow-lg shadow-slate-950/20">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Route overlay
            </div>
            <div className="space-y-2 text-[11px] text-muted-foreground">
              {alternateRoutes.map((alt, idx) => (
                <div key={alt.id} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-block w-2 h-2 rounded-full",
                      idx === 0 ? "bg-slate-500" : "bg-slate-600",
                    )}
                  />
                  <span>{alt.name}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-primary/70" />
                <span className="font-semibold text-foreground">
                  {route.name}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-card/80 border-t border-border">
          <div className="rounded-2xl border border-border/60 bg-slate-950/80 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                ETA
              </p>
            </div>
            <p className="text-2xl font-bold text-foreground">{route.eta}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Predicted arrival window with confidence adjustment
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-slate-950/80 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Risk score
              </p>
            </div>
            <p className={cn("text-2xl font-bold", riskColor)}>
              {route.riskScore}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Operational risk category: {route.riskLevel}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-slate-950/80 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Distance
              </p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {route.distance}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Planned route length through selected corridor
            </p>
          </div>
        </div>

        <div className="p-4 bg-card/90 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-semibold text-foreground">
                Active disruption overlay
              </p>
            </div>
            <Badge className="text-[10px] bg-amber-400/10 text-amber-400 border-amber-400/20">
              Predictive
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {route.alerts[0] ??
              "No immediate alerts on the selected route. Maintain standard monitoring cadence."}
          </p>
          <Separator className="my-3 opacity-20" />
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>Operational note</span>
            <span>
              {status === "dispatched" ? "Active mission" : "Planning"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
