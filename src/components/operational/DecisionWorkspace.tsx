"use client";

import { useEffect, useState } from "react";
import { RouteMapView } from "@/components/shipment/RouteMapView";
import { ShieldCheck, Activity } from "lucide-react";
import { OperationalRecommendation, Shipment, RoutePrediction, Route, ShipmentExecution } from "@/lib/types";
import { useStore } from "@/lib/store";
import { LiveCollaborators } from "./LiveCollaborators";
import { CommandActionPanel } from "./CommandActionPanel";
import { cn } from "@/lib/utils";

interface DecisionWorkspaceProps {
  shipment: Shipment;
  prediction?: RoutePrediction;
  routeForMap?: Route;
  execution?: ShipmentExecution | null;
}

export function DecisionWorkspace({ shipment, prediction, routeForMap, execution }: DecisionWorkspaceProps) {
  const { operationalFeed } = useStore();
  const [recommendations, setRecommendations] = useState<OperationalRecommendation[]>([]);
  const loading = !operationalFeed;

  useEffect(() => {
    if (operationalFeed && operationalFeed.recommendations) {
      // Filter recommendations for this specific shipment
      const shipRecs = operationalFeed.recommendations.filter(
        (r: OperationalRecommendation) => r.shipmentId === shipment.id
      );
      setRecommendations(shipRecs);
    }
  }, [operationalFeed, shipment.id]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
      {/* Map */}
      <div className="lg:col-span-2 min-w-0 rounded-xl overflow-hidden border border-border shadow-sm relative h-[420px] lg:h-[500px] bg-card">
        <RouteMapView 
          route={routeForMap}
          routes={routeForMap ? [routeForMap] : []}
          status={shipment.status === "completed" ? "completed" : "active"}
          origin={shipment.origin}
          destination={shipment.destination}
          execution={execution}
        />
        {prediction && (
          <div className="absolute top-4 left-4 z-10 bg-card/90 backdrop-blur-md p-4 rounded-lg shadow-xl border border-border max-w-sm">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-xs text-foreground uppercase tracking-widest">
                Operational Context
              </h3>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Overall Confidence:</span>
                <span className={cn(
                  "font-bold tabular-nums",
                  prediction.overallOperationalConfidence > 70 ? "text-emerald-400" : "text-amber-400"
                )}>
                  {prediction.overallOperationalConfidence}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Disruption Risk:</span>
                <span className={cn(
                  "font-bold tabular-nums",
                  prediction.disruptionProbability > 50 ? "text-red-400" : "text-muted-foreground"
                )}>
                  {prediction.disruptionProbability}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Operational Panel */}
      <div className="panel flex flex-col min-h-[300px] lg:h-[500px] overflow-hidden min-w-0">
        <div className="p-4 pb-3 border-b border-border bg-muted/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Command Workspace</h2>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              AI-driven command lifecycle & execution
            </p>
          </div>
          <LiveCollaborators entityId={shipment.id} />
        </div>
        
        <div className="flex-1 p-0 overflow-hidden bg-card">
          {loading ? (
            <div className="space-y-3 p-4">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse bg-muted/40 h-28 rounded-lg border border-border/50" />
              ))}
            </div>
          ) : (
            <CommandActionPanel recommendations={recommendations} />
          )}
        </div>
      </div>
    </div>
  );
}
