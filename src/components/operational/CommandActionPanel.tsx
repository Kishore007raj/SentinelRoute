"use client";

import { OperationalRecommendation } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, ShieldAlert, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

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
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const activeRecs = recommendations.filter(
    (r) => r.lifecycleStatus === "generated" || r.status === "pending" || r.lifecycleStatus === "viewed"
  );

  if (activeRecs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
        <ShieldAlert className="h-10 w-10 text-green-500 mb-3 opacity-80" />
        <p className="text-sm font-medium">No active commands required</p>
        <p className="text-xs mt-1">Shipment is operating optimally within parameters.</p>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "warning"; // assuming your UI supports it, else default
      case "medium": return "secondary";
      default: return "default";
    }
  };

  return (
    <div className="space-y-4">
      {activeRecs.map((rec) => (
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
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="default" 
                className="flex-1 gap-2" 
                disabled={!!processing} 
                onClick={() => handleAction(rec, "accept")}
              >
                <Check className="h-4 w-4" /> Approve
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 gap-2" 
                disabled={!!processing} 
                onClick={() => handleAction(rec, "reject")}
              >
                <X className="h-4 w-4" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
