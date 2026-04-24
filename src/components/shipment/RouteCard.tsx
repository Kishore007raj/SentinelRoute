"use client";
import { motion } from "framer-motion";
import { Clock, MapPin, Star, AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, getRiskColor, getRiskBgColor } from "@/lib/utils";
import type { Route } from "@/lib/mock-data";

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
      // Every card always has its layoutId — this is what enables the morph
      layoutId={`route-card-${route.id}`}
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.25, layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }}
      whileHover={selected ? {} : { y: -2 }}
      onClick={() => onSelect(route.id)}
      className={cn(
        "relative rounded-lg border cursor-pointer transition-colors duration-200 overflow-hidden",
        "bg-card hover:shadow-xl hover:shadow-black/30",
        selected
          ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20"
          : "border-border hover:border-border/80",
      )}
    >
      {selected && (
        <motion.div
          layoutId="card-selected-glow"
          className="absolute inset-0 bg-primary/3 pointer-events-none"
          transition={{ duration: 0.2 }}
        />
      )}

      {route.recommended && (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="text-[10px] font-semibold bg-primary/15 text-primary border border-primary/25 gap-1">
            <Star className="w-2.5 h-2.5 fill-primary" />
            Recommended
          </Badge>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <Badge
            variant="outline"
            className={cn("text-[10px] font-semibold shrink-0", routeLabelColor[route.label])}
          >
            {route.label.toUpperCase()}
          </Badge>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{route.name}</p>
          </div>
        </div>

        <div className={cn("rounded-md border px-4 py-3 mb-4 text-center", riskBg)}>
          <p className="label-meta mb-1">Risk Score</p>
          <p className={cn("text-4xl font-bold tabular-nums", riskColor)}>{route.riskScore}</p>
          <p className={cn("text-[10px] font-semibold uppercase tracking-wider mt-0.5", riskColor)}>
            {route.riskLevel} risk
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-muted/30 rounded-md px-3 py-2">
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="label-meta">ETA</span>
            </div>
            <p className="text-sm font-bold text-foreground">{route.eta}</p>
          </div>
          <div className="bg-muted/30 rounded-md px-3 py-2">
            <div className="flex items-center gap-1 mb-1">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <span className="label-meta">Distance</span>
            </div>
            <p className="text-sm font-bold text-foreground">{route.distance}</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <p className="label-meta">Risk Breakdown</p>
          {Object.entries(route.riskBreakdown).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-20 capitalize shrink-0">
                {key === "cargoSensitivity" ? "Cargo" : key}
              </span>
              <div className="risk-bar flex-1">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    val > 60 ? "bg-red-400" : val > 35 ? "bg-amber-400" : "bg-emerald-400",
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${val}%` }}
                  transition={{ duration: 0.5, delay: index * 0.08 + 0.2 }}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{val}</span>
            </div>
          ))}
        </div>

        {route.alerts.length > 0 && (
          <div className="mb-4 space-y-1">
            {route.alerts.slice(0, 2).map((alert, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-400/80">
                <AlertTriangle className="w-2.5 h-2.5 shrink-0 mt-0.5" />
                <span>{alert}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">{route.summary}</p>

        <Button
          className={cn(
            "w-full text-xs font-semibold h-9 transition-all",
            selected
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "variant-outline border-border text-muted-foreground hover:text-foreground hover:border-border/80",
          )}
          variant={selected ? "default" : "outline"}
        >
          {selected ? "Selected — Lock Route" : "Select Route"}
          <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
}
