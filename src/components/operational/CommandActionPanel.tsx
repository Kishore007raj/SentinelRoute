"use client";

import { OperationalRecommendation } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Clock, Zap, Target, TrendingUp, TrendingDown, ArrowRight, CheckCircle2, Activity } from "lucide-react";
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
      
      if (action === "accept" && rec.type === "Change Route") {
        await fetch(`/api/execution/${rec.shipmentId}/reroute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "AI Recommendation Accepted" })
        });
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

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-400/10 text-red-400 border-red-400/20";
      case "high":
        return "bg-amber-400/10 text-amber-400 border-amber-400/20";
      case "medium":
        return "bg-blue-400/10 text-blue-400 border-blue-400/20";
      default:
        return "bg-muted/30 text-muted-foreground border-border/50";
    }
  };

  const renderRec = (rec: OperationalRecommendation, isActive: boolean) => (
    <div
      key={rec.recommendationId}
      className={cn(
        "panel overflow-hidden transition-all duration-150",
        isActive
          ? "border-primary/40 bg-card shadow-sm"
          : "border-border/60 bg-muted/5 opacity-85 hover:opacity-100"
      )}
    >
      {/* Header */}
      <div className="p-3.5 bg-muted/10 border-b border-border/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 border",
              rec.severity === "critical" ? "bg-red-400/10 text-red-400 border-red-400/20" : 
              rec.severity === "high" ? "bg-amber-400/10 text-amber-400 border-amber-400/20" : "bg-blue-400/10 text-blue-400 border-blue-400/20"
            )}>
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-foreground truncate">{rec.type}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                {rec.reason}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn("uppercase tracking-wider text-[9px] px-2 py-0.5 shrink-0 font-bold", getSeverityBadge(rec.severity))}>
            {rec.severity}
          </Badge>
        </div>
      </div>
      
      {/* Insights */}
      <div className="grid grid-cols-2 divide-x divide-border/50 border-b border-border/50 bg-background/50 text-xs">
        <div className="p-2.5 space-y-1">
          <p className="label-meta">Op Impact</p>
          <p className="font-semibold text-xs text-foreground flex items-center gap-1.5 tabular-nums">
            <TrendingUp className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">{rec.estimatedImpact}</span>
          </p>
        </div>
        <div className="p-2.5 space-y-1">
          <p className="label-meta">Confidence</p>
          <div className="flex flex-col gap-1 mt-0.5">
            <div className="flex items-center justify-between">
              <span className={cn("font-bold text-xs tabular-nums", rec.confidence > 80 ? "text-emerald-400" : "text-amber-400")}>
                {rec.confidence}%
              </span>
            </div>
            <div className="h-1 w-full bg-muted overflow-hidden rounded-full">
              <div
                className={cn("h-full rounded-full", rec.confidence > 80 ? "bg-emerald-400" : "bg-amber-400")}
                style={{ width: `${rec.confidence}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics & Tradeoffs */}
      <div className="p-3.5 space-y-3">
        {rec.affectedMetrics.length > 0 && (
          <div>
            <p className="label-meta mb-1.5">Affected Metrics</p>
            <div className="flex flex-wrap gap-1">
              {rec.affectedMetrics.map((metric) => (
                <span
                  key={metric}
                  className="text-[10px] bg-muted/30 border border-border/50 px-2 py-0.5 rounded text-muted-foreground flex items-center gap-1"
                >
                  <Target className="w-2.5 h-2.5 text-primary/70" />
                  {metric}
                </span>
              ))}
            </div>
          </div>
        )}

        {rec.tradeoffs && rec.tradeoffs.length > 0 && (
          <div>
            <p className="label-meta mb-1.5">Trade-offs</p>
            <ul className="space-y-1">
              {rec.tradeoffs.map((tradeoff, i) => (
                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5 leading-snug">
                  <TrendingDown className="w-3 h-3 shrink-0 text-amber-400/80 mt-0.5" />
                  <span>{tradeoff}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action Buttons or Execution Details */}
      <div className="p-3.5 pt-0">
        {isActive ? (
          <div className="flex gap-2 mt-1">
            <Button 
              size="sm" 
              className="flex-1 h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white" 
              disabled={!!processing} 
              onClick={() => handleAction(rec, "accept")}
            >
              {processing === rec.recommendationId ? "Processing…" : (
                <><Check className="w-3.5 h-3.5 mr-1" /> Approve Action</>
              )}
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1 h-8 text-xs text-muted-foreground hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/5 transition-colors" 
              disabled={!!processing} 
              onClick={() => handleAction(rec, "reject")}
            >
              <X className="w-3.5 h-3.5 mr-1" /> Reject
            </Button>
          </div>
        ) : (
          <div className="bg-muted/20 border border-border/40 rounded-lg p-2.5">
            <div className="flex items-center justify-between">
              <span className="label-meta">Status</span>
              <Badge variant="outline" className={cn("text-[9px] capitalize font-bold", 
                rec.lifecycleStatus === "accepted" || rec.lifecycleStatus === "executed" || rec.lifecycleStatus === "completed"
                  ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                  : "bg-red-400/10 text-red-400 border-red-400/20"
              )}>
                {rec.lifecycleStatus}
              </Badge>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3 text-muted-foreground/60" />
              <span>Created: {formatRelativeTime(rec.createdAt)}</span>
              {rec.resolvedAt && (
                <>
                  <ArrowRight className="w-2.5 h-2.5 opacity-40 mx-0.5" />
                  <span>Resolved: {formatRelativeTime(rec.resolvedAt)}</span>
                </>
              )}
            </div>
            {(rec.lifecycleStatus === "accepted" || rec.lifecycleStatus === "executed") && (
              <div className="mt-2 text-[11px] flex items-center gap-1.5 text-emerald-400 font-medium bg-emerald-400/5 px-2.5 py-1.5 rounded border border-emerald-400/15">
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                Executing commands across fleet network…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Tabs defaultValue="active" className="w-full h-full flex flex-col">
      <div className="px-4 border-b border-border bg-muted/5">
        <TabsList className="w-full grid grid-cols-2 bg-transparent p-0 h-10 gap-0">
          <TabsTrigger
            value="active"
            className="text-xs font-semibold uppercase tracking-wide rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground bg-transparent transition-colors overflow-hidden"
          >
            <span className="truncate">Pending Actions</span>
            {activeRecs.length > 0 && (
              <span className="ml-1.5 bg-primary/20 text-primary px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums">
                {activeRecs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="text-xs font-semibold uppercase tracking-wide rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground bg-transparent transition-colors overflow-hidden"
          >
            <span className="truncate">History</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="active" className="flex-1 p-3.5 m-0 overflow-y-auto max-h-[420px]">
        {activeRecs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground border border-dashed border-border/70 rounded-lg bg-muted/5 p-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-2 opacity-80" />
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">No Pending Actions</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-[220px]">
              Shipment corridor is currently operating within expected parameters.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {activeRecs.map((rec) => renderRec(rec, true))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="history" className="flex-1 p-3.5 m-0 overflow-y-auto max-h-[420px]">
        {historyRecs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground border border-dashed border-border/70 rounded-lg bg-muted/5 p-4">
            <Clock className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">No Decision History</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-[220px]">
              Logged decisions and resolved actions will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {historyRecs.map((rec) => renderRec(rec, false))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
