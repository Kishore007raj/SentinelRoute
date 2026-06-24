"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Activity, MapPin, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CorridorsPage() {
  const [corridors, setCorridors] = useState<any[]>([]);
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
          Historical and live statistics for key logistics corridors.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted-foreground animate-pulse bg-card border border-border rounded-xl">
          Loading corridor statistics...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {corridors.map((corridor) => (
            <div key={corridor.corridorId} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-border bg-muted/10 flex flex-col gap-2">
                <div className="flex items-center gap-3 text-lg font-bold text-foreground">
                  <span>{corridor.origin}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <span>{corridor.destination}</span>
                </div>
                <div className="flex items-center gap-2">
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
              
              <div className="p-5 flex-1 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Historical Reliability</p>
                  <p className="text-xl font-bold">{corridor.historicalReliability}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Avg Delay</p>
                  <p className="text-xl font-bold">{corridor.averageDelay} min</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Weather Trend</p>
                  <p className="text-sm font-semibold capitalize">{corridor.weatherTrend}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Road Quality</p>
                  <p className="text-sm font-semibold">{corridor.roadQuality}/100</p>
                </div>
              </div>

              <div className="p-3 bg-muted/30 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Incident Density: {corridor.incidentDensity}%</span>
                <span>{corridor.confidence}% Confidence</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
