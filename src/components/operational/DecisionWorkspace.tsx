"use client";

import { useEffect, useState } from "react";
import { RouteMapView } from "@/components/shipment/RouteMapView";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Info, CheckCircle, Activity, Map, ArrowRight } from "lucide-react";
import { OperationalRecommendation, Shipment, RoutePrediction } from "@/lib/types";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { LiveCollaborators } from "./LiveCollaborators";
import { CommandActionPanel } from "./CommandActionPanel";

interface DecisionWorkspaceProps {
  shipment: Shipment;
  prediction?: RoutePrediction;
  routeForMap?: any;
  execution?: any;
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

  // Deprecated UI handler since CommandActionPanel now handles transitions
  const handleAction = async (rec: OperationalRecommendation) => {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Map */}
      <div className="lg:col-span-2 rounded-xl overflow-hidden border shadow-sm relative h-[420px] lg:h-[500px]">
        <RouteMapView 
          route={routeForMap}
          routes={routeForMap ? [routeForMap] : []}
          status={shipment.status === "completed" ? "completed" : "active"}
          origin={shipment.origin}
          destination={shipment.destination}
          execution={execution}
        />
        {prediction && (
          <div className="absolute top-4 left-4 z-10 bg-background/90 backdrop-blur p-4 rounded-lg shadow-lg border max-w-sm">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" /> Operational Context
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overall Confidence:</span>
                <span className={`font-medium ${prediction.overallOperationalConfidence > 70 ? 'text-green-500' : 'text-amber-500'}`}>
                  {prediction.overallOperationalConfidence}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Disruption Risk:</span>
                <span className={`font-medium ${prediction.disruptionProbability > 50 ? 'text-red-500' : ''}`}>
                  {prediction.disruptionProbability}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Operational Panel */}
      <Card className="flex flex-col border shadow-sm min-h-[300px] lg:h-[500px]">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Command Workspace
            </CardTitle>
            <LiveCollaborators entityId={shipment.id} />
          </div>
          <CardDescription>
            AI-driven Command Lifecycle and execution
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          {loading ? (
            <div className="space-y-4 p-4">
              {[1, 2].map(i => (
                <div key={i} className="animate-pulse bg-muted h-32 rounded-lg" />
              ))}
            </div>
          ) : (
            <CommandActionPanel recommendations={recommendations} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
