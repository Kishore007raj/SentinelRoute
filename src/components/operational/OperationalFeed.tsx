"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, AlertTriangle, Clock, Zap } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { OperationalHealthScore, OperationalRecommendation } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/lib/store";

export function OperationalFeed() {
  const { operationalFeed: feedData, operationalHealth: healthScore } = useStore();
  const loading = !feedData || !healthScore;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "warning";
      case "medium": return "secondary";
      default: return "default";
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-emerald-500";
    if (score >= 75) return "text-blue-500";
    if (score >= 50) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <Card className="flex flex-col h-full border shadow-sm col-span-full xl:col-span-1">
      <CardHeader className="pb-3 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Operational Intelligence
            </CardTitle>
            <CardDescription>
              Real-time events and system recommendations
            </CardDescription>
          </div>
          {healthScore && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${getHealthColor(healthScore.score)}`}>
                {healthScore.score}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Health Score
              </div>
            </div>
          )}
        </div>
        {healthScore && (
          <div className="mt-2 space-y-1">
             <Progress value={healthScore.score} className="h-2" />
             <div className="flex justify-between text-xs text-muted-foreground">
               <span>Critical</span>
               <span>Excellent</span>
             </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <Tabs defaultValue="recommendations" className="h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger 
              value="recommendations" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-3"
            >
              Recommendations
              {feedData && feedData.recommendations.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary hover:bg-primary/20">
                  {feedData.recommendations.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="events" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-3"
            >
              Live Feed
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="recommendations" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-[400px] w-full p-4">
              {loading ? (
                <div className="animate-pulse bg-muted h-20 rounded-lg mb-2" />
              ) : feedData?.recommendations && feedData.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {feedData.recommendations.map((rec: OperationalRecommendation) => (
                    <div key={rec.recommendationId} className="p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-sm">{rec.type}</span>
                        <Badge variant={getSeverityColor(rec.severity) as any} className="text-[10px]">
                          {rec.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.reason}</p>
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Activity className="h-3 w-3" /> Shipment: {rec.shipmentId.slice(0,8)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                  <Activity className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No active recommendations</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="events" className="flex-1 m-0 overflow-hidden">
             <ScrollArea className="h-[400px] w-full p-4">
              {loading ? (
                <div className="animate-pulse bg-muted h-20 rounded-lg mb-2" />
              ) : feedData?.events && feedData.events.length > 0 ? (
                <div className="space-y-4">
                  {feedData.events.map((event: any, i: number) => (
                    <div key={i} className="flex gap-3">
                      <div className="mt-0.5">
                        {event.type.includes("Alert") || event.type.includes("Incident") ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Activity className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{event.type}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{event.description}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" /> {formatRelativeTime(event.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                  <Activity className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No recent events</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
