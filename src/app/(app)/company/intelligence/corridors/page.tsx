"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Activity, MapPin, ArrowRight, Package, AlertTriangle, AlertCircle, Clock, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { CorridorStatistic } from "@/lib/types";
import { Progress } from "@/components/ui/progress";

export default function CorridorsPage() {
  const [corridors, setCorridors] = useState<CorridorStatistic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCorridors() {
      try {
        const res = await fetch("/api/intelligence/corridors");
        if (res.ok) {
          const data = await res.json();
          setCorridors(data.corridors || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchCorridors();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Corridor Intelligence</h1>
        <p className="text-muted-foreground">
          Live statistics and risk aggregation for your active logistics corridors.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted-foreground animate-pulse bg-card border border-border rounded-xl">
          Aggregating live corridor data...
        </div>
      ) : corridors.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-xl">
          No active shipments found to build corridors.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {corridors.map((corridor) => (
            <div key={corridor.corridorId} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col hover:border-blue-500/50 transition-colors">
              <div className="p-5 border-b border-border bg-muted/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-lg font-bold text-foreground">
                    <span className="truncate max-w-[120px]" title={corridor.origin}>{corridor.origin}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[120px]" title={corridor.destination}>{corridor.destination}</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 bg-background rounded-md border border-border shadow-sm">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      corridor.currentOperationalStatus === "optimal" ? "bg-green-500" :
                      corridor.currentOperationalStatus === "warning" ? "bg-amber-500" : "bg-red-500"
                    )} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {corridor.currentOperationalStatus}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-4 text-xs font-medium text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    {corridor.shipmentCount} Shipments
                  </span>
                  <span className="flex items-center gap-1 text-red-500/80">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {corridor.delayedShipments} Delayed
                  </span>
                  <span className="flex items-center gap-1 text-amber-500/80">
                    <Activity className="w-3.5 h-3.5" />
                    {corridor.incidentCount} Incidents
                  </span>
                </div>
              </div>
              
              <div className="p-5 flex-1 grid grid-cols-2 gap-x-4 gap-y-6">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Travel Time
                    </p>
                    <span className="text-xs font-bold">{Math.round((corridor.averageTravelTime || 0) / 60)}h {(corridor.averageTravelTime || 0) % 60}m</span>
                  </div>
                  <Progress value={corridor.averageTravelTime ? 100 : 0} className="h-1.5" />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Avg Delay</p>
                    <span className={cn("text-xs font-bold", corridor.averageDelay > 60 ? "text-red-500" : corridor.averageDelay > 0 ? "text-amber-500" : "text-green-500")}>
                      {corridor.averageDelay > 0 ? `+${corridor.averageDelay}m` : "On Time"}
                    </span>
                  </div>
                  <Progress value={Math.min(100, corridor.averageDelay)} className={cn("h-1.5", corridor.averageDelay > 60 ? "[&>div]:bg-red-500" : corridor.averageDelay > 0 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500")} />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Op Health</p>
                    <span className={cn("text-xs font-bold", corridor.operationalHealth > 80 ? "text-green-500" : corridor.operationalHealth > 40 ? "text-amber-500" : "text-red-500")}>
                      {corridor.operationalHealth}/100
                    </span>
                  </div>
                  <Progress value={corridor.operationalHealth} className={cn("h-1.5", corridor.operationalHealth > 80 ? "[&>div]:bg-green-500" : corridor.operationalHealth > 40 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500")} />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Volatility</p>
                    <span className={cn("text-xs font-bold", corridor.volatilityScore > 70 ? "text-red-500" : corridor.volatilityScore > 30 ? "text-amber-500" : "text-green-500")}>
                      {corridor.volatilityScore}/100
                    </span>
                  </div>
                  <Progress value={corridor.volatilityScore} className={cn("h-1.5", corridor.volatilityScore > 70 ? "[&>div]:bg-red-500" : corridor.volatilityScore > 30 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500")} />
                </div>
              </div>

              <div className="px-5 py-4 bg-muted/20 border-t border-border">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Risk Factors
                </p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-background rounded border border-border p-2">
                    <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Weather</div>
                    <div className={cn("font-bold text-sm", corridor.weatherRisk > 50 ? "text-red-500" : corridor.weatherRisk > 20 ? "text-amber-500" : "text-foreground")}>{corridor.weatherRisk}</div>
                  </div>
                  <div className="bg-background rounded border border-border p-2">
                    <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Traffic</div>
                    <div className={cn("font-bold text-sm", corridor.trafficRisk > 50 ? "text-red-500" : corridor.trafficRisk > 20 ? "text-amber-500" : "text-foreground")}>{corridor.trafficRisk}</div>
                  </div>
                  <div className="bg-background rounded border border-border p-2">
                    <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Festival</div>
                    <div className={cn("font-bold text-sm", corridor.festivalRisk > 50 ? "text-red-500" : corridor.festivalRisk > 20 ? "text-amber-500" : "text-foreground")}>{corridor.festivalRisk}</div>
                  </div>
                  <div className="bg-background rounded border border-border p-2">
                    <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">News</div>
                    <div className={cn("font-bold text-sm", corridor.newsRisk > 50 ? "text-red-500" : corridor.newsRisk > 20 ? "text-amber-500" : "text-foreground")}>{corridor.newsRisk}</div>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
