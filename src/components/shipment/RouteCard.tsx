"use client";
import { motion } from "framer-motion";
import { Clock, MapPin, Star, AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, getRiskColor, getRiskBgColor } from "@/lib/utils";
import type { Route } from "@/lib/types";

interface RouteCardProps {
  route: Route;
  selected: boolean;
  onSelect: (routeId: string) => void;
  index?: number;
}

const routeLabelColor: Record<string, string> = {
  fastest: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  balanced: "text-primary border-primary/30 bg-primary/10",
  safest: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
};

export function RouteCard({ route, selected, onSelect, index = 0 }: RouteCardProps) {
  const riskColor = getRiskColor(route.riskLevel);
  const riskBg = getRiskBgColor(route.riskLevel);

  return (
    <motion.div
      layoutId={`route-card-${route.id}`}
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.25, layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }}
      whileHover={selected ? {} : { y: -2 }}
      onClick={() => onSelect(route.id)}
      className={cn(
        "relative rounded-xl border cursor-pointer transition-all duration-200 overflow-hidden",
        "bg-card hover:shadow-2xl hover:shadow-black/40",
        selected
          ? "border-primary shadow-xl shadow-primary/10 ring-1 ring-primary/20 scale-[1.02] z-10"
          : "border-border/60 hover:border-border",
      )}
    >
      {selected && (
        <motion.div
          layoutId="card-selected-glow"
          className="absolute inset-0 bg-primary/[0.03] pointer-events-none"
          transition={{ duration: 0.2 }}
        />
      )}

      {route.recommended && (
        <div className="absolute top-4 right-4 z-10">
          <Badge className="text-[10px] font-black bg-primary/15 text-primary border border-primary/25 gap-1 shadow-sm">
            <Star className="w-2.5 h-2.5 fill-primary" />
            RECOMMENDED
          </Badge>
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start gap-3 mb-5">
          <Badge
            variant="outline"
            className={cn("text-[9px] font-black shrink-0 px-2 h-5 tracking-widest", routeLabelColor[route.label])}
          >
            {route.label.toUpperCase()}
          </Badge>
          <div className="min-w-0">
            <p className="text-base font-bold text-foreground truncate">{route.name}</p>
          </div>
        </div>

        <div className={cn("rounded-xl border px-4 py-4 mb-5 text-center shadow-inner bg-opacity-50", riskBg)}>
          <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-1">Risk Assessment</p>
          <p className={cn("text-5xl font-black tabular-nums tracking-tighter", riskColor)}>{route.riskScore}</p>
          <p className={cn("text-[10px] font-black uppercase tracking-[0.2em] mt-1 opacity-80", riskColor)}>
            {route.riskLevel} threat level
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-muted/10 border border-border/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Duration</span>
            </div>
            <p className="text-base font-black text-foreground">{route.durationHours.toFixed(1)}h</p>
          </div>
          <div className="bg-muted/10 border border-border/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Distance</span>
            </div>
            <p className="text-base font-black text-foreground">{route.distanceKm} km</p>
          </div>
        </div>

        <div className="space-y-2.5 mb-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Exposure Vectors</p>
          {Object.entries(route.riskBreakdown || {}).map(([key, val]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-muted-foreground/70 w-24 capitalize shrink-0 truncate">
                {key === "cargoSensitivity" ? "Cargo Sensitivity" : key}
              </span>
              <div className="h-1.5 flex-1 bg-muted/20 rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    (val as number) > 60 ? "bg-red-400" : (val as number) > 35 ? "bg-amber-400" : "bg-emerald-400",
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${val}%` }}
                  transition={{ duration: 0.6, delay: index * 0.08 + 0.3 }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-muted-foreground w-6 text-right">{(val as number)}</span>
            </div>
          ))}
        </div>

        {(route.alerts?.length || 0) > 0 && (
          <div className="mb-6 space-y-1.5">
            {route.alerts?.slice(0, 2).map((alert, i) => (
              <div key={i} className="flex items-start gap-2 text-[10px] text-amber-400/90 font-bold bg-amber-400/5 p-2 rounded-lg border border-amber-400/10">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                <span>{alert}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground leading-relaxed mb-6 font-medium line-clamp-2">{route.summary}</p>

        <Button
          className={cn(
            "w-full text-[11px] font-black uppercase tracking-widest h-11 transition-all rounded-xl",
            selected
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
              : "bg-transparent border border-border/60 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/10",
          )}
        >
          {selected ? "Locked — Inspect Mission" : "Select Manifest"}
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}
