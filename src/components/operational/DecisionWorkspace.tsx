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

  const handleAction = async (rec: OperationalRecommendation) => {
    toast.success(`Action "${rec.type}" initiated.`);
    // Here we would typically call an API to apply the recommendation and update its status
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "warning"; // Assuming warning variant exists, else default
      case "medium": return "secondary";
      default: return "default";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)] min-h-[600px]">
      {/* 1st Half: The Map */}
      <div className="lg:col-span-2 rounded-xl overflow-hidden border shadow-sm relative">
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

      {/* 2nd Half: Operational Panel */}
      <Card className="flex flex-col h-full border-l shadow-none lg:shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Decision Workspace
          </CardTitle>
          <CardDescription>
            AI-driven recommendations and actions
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full p-4">
            {loading ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div key={i} className="animate-pulse bg-muted h-32 rounded-lg" />
                ))}
              </div>
            ) : recommendations.length > 0 ? (
              <div className="space-y-4">
                {recommendations.map((rec) => (
                  <Card key={rec.recommendationId} className="border border-muted-foreground/20">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-semibold">{rec.type}</CardTitle>
                        <Badge variant={getSeverityColor(rec.severity) as any}>
                          {rec.severity}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs text-muted-foreground mt-1">
                        {rec.reason}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex flex-wrap gap-1 mb-3">
                        {rec.affectedMetrics.map(metric => (
                          <Badge key={metric} variant="outline" className="text-[10px] uppercase">
                            {metric}
                          </Badge>
                        ))}
                      </div>
                      <Button size="sm" className="w-full gap-2" onClick={() => handleAction(rec)}>
                        Execute Action <ArrowRight className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                <CheckCircle className="h-10 w-10 text-green-500 mb-3 opacity-80" />
                <p className="text-sm font-medium">No active recommendations</p>
                <p className="text-xs mt-1">Shipment is operating optimally within parameters.</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
