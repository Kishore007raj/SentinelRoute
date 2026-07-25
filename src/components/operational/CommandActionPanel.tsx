"use client";

import { OperationalRecommendation } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, ShieldAlert, Activity, Clock, Zap, Target, TrendingUp, TrendingDown, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function CommandActionPanel({ recommendations }: { recommendations: OperationalRecommendation[] }) {
  const [processing, setProcessing] = useState<string | null>(null);

  const handleAction = async (rec: OperationalRecommendation, action: string) => {
    setProcessing(rec.recommendationId);
    try {
      const res = await fetch(`/api/intelligence/recommendations/${rec.recommendationId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: `Action initiated by user` })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to process action");
      }
      toast.success(`Action ${action} successful`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(null);
    }
  };

  const activeRecs = recommendations.filter(
    (r) => r.lifecycleStatus === "generated" || r.status === "pending" || r.lifecycleStatus === "viewed"
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const historyRecs = recommendations.filter(
    (r) => r.lifecycleStatus === "accepted" || r.lifecycleStatus === "rejected" || r.lifecycleStatus === "executed" || r.lifecycleStatus === "completed"
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "warning";
      case "medium": return "secondary";
      default: return "default";
    }
  };

  const renderRec = (rec: OperationalRecommendation, isActive: boolean) => (
    <Card key={rec.recommendationId} className={cn("border overflow-hidden transition-all", isActive ? "border-primary/40 shadow-sm" : "border-border shadow-none opacity-80 hover:opacity-100")}>
      <CardHeader className="p-4 pb-3 bg-muted/10 border-b border-border/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
              rec.severity === "critical" ? "bg-red-500/10 text-red-500" : 
              rec.severity === "high" ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
            )}>
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">{rec.type}</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {rec.reason}
              </CardDescription>
            </div>
          </div>
          <Badge variant={getSeverityColor(rec.severity) as "destructive" | "secondary" | "default" | "outline"} className="uppercase tracking-wider text-[10px] px-2 py-0.5 shrink-0">
            {rec.severity}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Deep Insights */}
        <div className="grid grid-cols-2 divide-x divide-border/50 border-b border-border/50 bg-background text-xs">
          <div className="p-3 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">ETA / Op Impact</p>
            <p className="font-medium text-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              {rec.estimatedImpact}
            </p>
          </div>
          <div className="p-3 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">AI Confidence</p>
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between">
                <span className={cn("font-semibold", rec.confidence > 80 ? "text-emerald-500" : "text-amber-500")}>
                  {rec.confidence}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", rec.confidence > 80 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${rec.confidence}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Metrics & Tradeoffs */}
        <div className="p-4 space-y-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">Affected Metrics</p>
            <div className="flex flex-wrap gap-1.5">
              {rec.affectedMetrics.map(metric => (
                <Badge key={metric} variant="outline" className="text-[10px] bg-muted/20 hover:bg-muted/40 transition-colors">
                  <Target className="w-3 h-3 mr-1" /> {metric}
                </Badge>
              ))}
            </div>
          </div>

          {rec.tradeoffs && rec.tradeoffs.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">Tradeoffs</p>
              <ul className="space-y-1.5">
                {rec.tradeoffs.map((tradeoff, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <TrendingDown className="w-3.5 h-3.5 shrink-0 text-amber-500/80" />
                    <span className="leading-tight">{tradeoff}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Action or Status */}
        <div className="p-4 pt-0">
          {isActive ? (
            <div className="flex gap-3 mt-2">
              <Button 
                size="sm" 
                variant="default" 
                className="flex-1 font-semibold hover:shadow-md transition-shadow" 
                disabled={!!processing} 
                onClick={() => handleAction(rec, "accept")}
              >
                {processing === rec.recommendationId ? "Processing..." : (
                  <><Check className="w-4 h-4 mr-1.5" /> Approve Action</>
                )}
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 text-muted-foreground hover:text-destructive hover:border-destructive hover:bg-destructive/5 transition-colors" 
                disabled={!!processing} 
                onClick={() => handleAction(rec, "reject")}
              >
                <X className="w-4 h-4 mr-1.5" /> Reject
              </Button>
            </div>
          ) : (
            <div className="bg-muted/20 border border-border/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Execution Progress</span>
                <Badge variant="outline" className={cn("text-[10px] capitalize font-semibold", 
                  rec.lifecycleStatus === "accepted" || rec.lifecycleStatus === "executed" || rec.lifecycleStatus === "completed" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                )}>
                  {rec.lifecycleStatus}
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>Generated: {formatRelativeTime(rec.createdAt)}</span>
                <ArrowRight className="w-3 h-3 mx-1 opacity-50" />
                <span>Resolved: {rec.resolvedAt ? formatRelativeTime(rec.resolvedAt) : "N/A"}</span>
              </div>
              {(rec.lifecycleStatus === 'accepted' || rec.lifecycleStatus === 'executed') && (
                <div className="mt-3 text-xs flex items-center gap-2 text-emerald-500 font-medium bg-emerald-500/5 px-3 py-2 rounded-md border border-emerald-500/10 shadow-sm">
                  <Activity className="w-4 h-4 animate-pulse" />
                  Executing commands across fleet network...
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Tabs defaultValue="active" className="w-full h-full flex flex-col">
      <div className="px-4 pt-4 border-b border-border">
        <TabsList className="w-full grid grid-cols-2 bg-transparent p-0">
          <TabsTrigger value="active" className="text-xs font-semibold uppercase tracking-widest rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3">
            Pending Actions {activeRecs.length > 0 && <span className="ml-2 bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-[10px]">{activeRecs.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs font-semibold uppercase tracking-widest rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3">
            Decision History
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="active" className="flex-1 p-4 m-0">
        {activeRecs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground border border-dashed border-border rounded-xl bg-muted/5">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3 opacity-80" />
            <p className="text-sm font-semibold text-foreground">No pending decisions</p>
            <p className="text-xs mt-1 max-w-[200px]">Shipment is operating optimally within designated parameters.</p>
          </div>
        ) : (
          <div className="space-y-4 pb-10">
            {activeRecs.map(rec => renderRec(rec, true))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="history" className="flex-1 p-4 m-0">
        {historyRecs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground border border-dashed border-border rounded-xl bg-muted/5">
            <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground">No decision history</p>
            <p className="text-xs mt-1 max-w-[200px]">Decisions you make will appear here for tracking.</p>
          </div>
        ) : (
          <div className="space-y-4 pb-10">
            {historyRecs.map(rec => renderRec(rec, false))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
