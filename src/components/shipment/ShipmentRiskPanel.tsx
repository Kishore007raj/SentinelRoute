"use client";

import { useState } from "react";
import { RefreshCw, Activity, AlertTriangle } from "lucide-react";

export function ShipmentRiskPanel({ shipmentId }: { shipmentId: string }) {
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<any>(null);
  const [alert, setAlert] = useState<any>(null);

  const handlePoll = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/intelligence/shipments/${shipmentId}/poll`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setPrediction(data.prediction);
        setAlert(data.alert);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel p-6 space-y-4 bg-card border border-border rounded-xl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Predictive Intelligence
        </h3>
        <button
          onClick={handlePoll}
          disabled={loading}
          className="flex items-center gap-2 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Polling..." : "Poll Prediction"}
        </button>
      </div>

      {!prediction ? (
        <div className="text-sm text-muted-foreground">
          No recent prediction polled. Click "Poll Prediction" to trigger the engine.
        </div>
      ) : (
        <div className="space-y-4 mt-4 border-t border-border pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Overall Confidence</p>
              <p className="text-2xl font-bold">{prediction.overallOperationalConfidence}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Delay Risk</p>
              <p className="text-2xl font-bold">{prediction.delayProbability}%</p>
            </div>
          </div>
          
          <div className="bg-muted/30 p-3 rounded-lg text-sm">
            <p className="font-semibold mb-1">Reasoning</p>
            <p className="text-muted-foreground">{prediction.reason}</p>
          </div>

          {alert && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-500">{alert.reason}</p>
                <p className="text-xs text-amber-500/80 mt-1">{alert.recommendedAction}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
