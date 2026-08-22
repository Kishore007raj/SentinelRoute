"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw, Activity, AlertTriangle, TrendingDown,
  TrendingUp, Minus, CheckCircle2, ShieldAlert, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import type { RoutePrediction, OperationalAlert } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskFromConfidence(confidence: number): number {
  return Math.round(100 - confidence);
}

function riskLabelFromScore(score: number): string {
  if (score > 75) return "CRITICAL";
  if (score > 50) return "HIGH";
  if (score > 25) return "MEDIUM";
  return "LOW";
}

function riskColorClass(score: number): string {
  if (score > 75) return "text-red-400";
  if (score > 50) return "text-amber-500";
  if (score > 25) return "text-amber-400";
  return "text-emerald-400";
}

function riskBorderClass(score: number): string {
  if (score > 75) return "border-red-400/20 bg-red-400/[0.04]";
  if (score > 50) return "border-amber-500/20 bg-amber-500/[0.04]";
  if (score > 25) return "border-amber-400/15 bg-amber-400/[0.03]";
  return "border-emerald-400/15 bg-emerald-400/[0.03]";
}

function factorBarColor(value: number): string {
  if (value > 60) return "bg-red-400";
  if (value > 35) return "bg-amber-400";
  return "bg-emerald-400";
}

function buildRecommendation(pred: RoutePrediction): string {
  const confidence = pred.overallOperationalConfidence;
  const delay = pred.delayProbability;
  const disruption = pred.disruptionProbability;

  if (confidence >= 80 && delay < 20 && disruption < 20) {
    return "Corridor conditions are nominal. Proceed with current route and maintain standard monitoring cadence.";
  }
  if (confidence >= 65) {
    return "Minor disruptions detected. Verify incident reports before dispatch and maintain monitoring. No route change required at this time.";
  }
  if (confidence >= 45) {
    const parts = [];
    if (delay > 40) parts.push("significant delay risk");
    if (disruption > 40) parts.push("disruption signals");
    const reason = parts.length > 0 ? ` (${parts.join(", ")})` : "";
    return `Elevated operational risk${reason}. Consider delaying dispatch, reviewing alternate corridors, or escalating to operations manager before departure.`;
  }
  return "High operational risk detected. Recommend immediate route review and driver briefing. Consider rescheduling or switching to the safest route. Escalate to operations manager if cargo is time-sensitive.";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricTile({
  label, value, valueClass,
}: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="space-y-1 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold tabular-nums leading-tight", valueClass ?? "text-foreground")}>{value}</p>
    </div>
  );
}

function FactorBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="text-xs text-muted-foreground w-36 shrink-0 capitalize">{label}</span>
      <div className="flex-1 h-1.5 bg-muted overflow-hidden rounded-full min-w-0">
        <div
          className={cn("h-full rounded-full transition-all duration-700", factorBarColor(value))}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-7 text-right tabular-nums shrink-0">{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ShipmentRiskPanel({ shipmentId }: { shipmentId: string }) {
  const { user } = useUser();
  const { userRecord } = useCompany();
  const [polling, setPolling]               = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [prediction, setPrediction]         = useState<RoutePrediction | null>(null);
  const [alert, setAlert]                   = useState<OperationalAlert | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [pollingSkipped, setPollingSkipped] = useState(false);
  const [skippedReason, setSkippedReason]   = useState<string | null>(null);
  const didAutoLoad                         = useRef(false);

  const isSuperAdmin   = userRecord?.role === "super_admin";
  const isCrossCompany = isSuperAdmin
    && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).has("companyId");

  // Shared fetch helper — used for both auto-load and manual poll
  const callPollEndpoint = useCallback(async () => {
    if (isCrossCompany || !user) return;
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/intelligence/shipments/${shipmentId}/poll`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? `Prediction engine returned ${res.status}`);
        return;
      }
      const data = await res.json() as {
        prediction?:     RoutePrediction;
        alert?:          OperationalAlert;
        pollingSkipped?: boolean;
        reason?:         string;
      };
      setPrediction(data.prediction ?? null);
      setAlert(data.alert ?? null);
      setPollingSkipped(data.pollingSkipped ?? false);
      setSkippedReason(data.reason ?? null);
    } catch {
      setError("Network error — could not reach prediction engine.");
    }
  }, [shipmentId, isCrossCompany, user]);

  // Auto-load on mount (deferred one tick)
  useEffect(() => {
    if (didAutoLoad.current) return;
    didAutoLoad.current = true;
    const timer = setTimeout(async () => {
      try {
        await callPollEndpoint();
      } finally {
        setInitialLoading(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [callPollEndpoint]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual poll handler
  const handleManualPoll = async () => {
    if (polling || isCrossCompany) return;
    setPolling(true);
    try {
      await callPollEndpoint();
    } finally {
      setPolling(false);
    }
  };

  // ── Derived display values ─────────────────────────────────────────────────
  const riskScore   = prediction ? riskFromConfidence(prediction.overallOperationalConfidence) : null;
  const riskLabel   = riskScore !== null ? riskLabelFromScore(riskScore) : null;
  const riskColor   = riskScore !== null ? riskColorClass(riskScore) : "";
  const riskBorder  = riskScore !== null ? riskBorderClass(riskScore) : "";

  const trendIcon = prediction?.riskTrend === "improving"
    ? <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
    : prediction?.riskTrend === "degrading"
    ? <TrendingUp className="w-3.5 h-3.5 text-red-400" />
    : <Minus className="w-3.5 h-3.5 text-muted-foreground" />;

  const trendLabel = prediction?.riskTrend === "improving" ? "Improving"
    : prediction?.riskTrend === "degrading" ? "Degrading"
    : "Stable";

  // Factor bars: convert prediction fields to risk-direction (high = bad)
  const factors = prediction
    ? [
        { label: "Traffic instability",    value: Math.round(Math.max(0, 100 - prediction.trafficStability)) },
        { label: "Weather risk",           value: Math.round(Math.max(0, 100 - prediction.weatherConfidence)) },
        { label: "Delay probability",      value: prediction.delayProbability },
        { label: "Disruption probability", value: prediction.disruptionProbability },
        { label: "Incident density",       value: prediction.incidentDensity },
        { label: "Corridor volatility",    value: prediction.corridorVolatility },
      ]
        .filter(f => f.value > 0)
        .sort((a, b) => b.value - a.value)
    : [];

  const recommendation = prediction ? buildRecommendation(prediction) : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-3xl">

      {/* Header / poll control */}
      <div className="panel p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary shrink-0" />
            Predictive Intelligence
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live risk engine — incorporates incidents, weather, festivals, and news signals
          </p>
        </div>
        <button
          onClick={handleManualPoll}
          disabled={polling || isCrossCompany}
          className="flex items-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={cn("w-3 h-3", polling && "animate-spin")} />
          {polling ? "Polling…" : "Poll Prediction"}
        </button>
      </div>

      {/* Initial loading */}
      {initialLoading && (
        <div className="panel p-8 flex items-center gap-3 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin shrink-0" />
          Checking prediction history…
        </div>
      )}

      {/* Error */}
      {!initialLoading && error && (
        <div className="panel p-5 flex items-start gap-3 border border-red-500/20 bg-red-500/5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Prediction engine error</p>
            <p className="text-xs text-red-400/70 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Skipped banner — shown when shipment is completed/cancelled AND no historical prediction exists */}
      {!initialLoading && !error && pollingSkipped && skippedReason && !prediction && (
        <div className="panel p-5 flex items-start gap-3 border border-amber-400/20 bg-amber-400/5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Live prediction not available</p>
            <p className="text-xs text-amber-400/70 mt-1">{skippedReason}</p>
          </div>
        </div>
      )}

      {/* Empty state — never been polled, active shipment */}
      {!initialLoading && !error && !prediction && !pollingSkipped && (
        <div className="panel p-10 flex flex-col items-center text-center gap-4">
          <div className="w-10 h-10 rounded-full bg-muted/30 border border-border flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-muted-foreground/50" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-foreground">Prediction not generated</p>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              Run the prediction engine to evaluate this shipment against live risk signals — incidents, weather events, festival congestion, and news disruptions.
            </p>
          </div>
          <button
            onClick={handleManualPoll}
            disabled={polling || isCrossCompany}
            className="flex items-center gap-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            Run Prediction
          </button>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {!initialLoading && prediction && riskScore !== null && (
        <>
          {/* Skipped banner when showing historical prediction */}
          {pollingSkipped && skippedReason && (
            <div className="panel px-4 py-2.5 flex items-center gap-2.5 border border-amber-400/15 bg-amber-400/5 text-xs text-amber-400/80">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {skippedReason} — showing last recorded prediction.
            </div>
          )}

          {/* Risk summary */}
          <div className={cn("panel p-5 border", riskBorder)}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Predicted Risk
            </p>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-5xl font-bold tabular-nums leading-none", riskColor)}>
                    {riskScore}
                  </span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>
                <span className={cn("text-xs font-bold uppercase tracking-widest mt-1.5 inline-block", riskColor)}>
                  {riskLabel} RISK
                </span>
              </div>
              <div className="text-right space-y-2.5">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Confidence</p>
                  <p className="text-2xl font-bold text-foreground">{prediction.overallOperationalConfidence}%</p>
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  {trendIcon}
                  <span className="text-xs text-muted-foreground">{trendLabel}</span>
                </div>
              </div>
            </div>

            {/* Secondary metrics */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/30">
              <MetricTile
                label="ETA Confidence"
                value={`${prediction.etaConfidence}%`}
                valueClass={prediction.etaConfidence > 70 ? "text-emerald-400" : "text-amber-400"}
              />
              <MetricTile
                label="Delay Risk"
                value={`${prediction.delayProbability}%`}
                valueClass={prediction.delayProbability > 30 ? "text-amber-400" : "text-foreground"}
              />
              <MetricTile
                label="Disruption Risk"
                value={`${prediction.disruptionProbability}%`}
                valueClass={prediction.disruptionProbability > 30 ? "text-amber-400" : "text-foreground"}
              />
            </div>
          </div>

          {/* Risk factor breakdown */}
          {factors.length > 0 && (
            <div className="panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <TrendingDown className="w-3.5 h-3.5" /> Risk Breakdown
              </p>
              <div className="space-y-3">
                {factors.map(f => (
                  <FactorBar key={f.label} label={f.label} value={f.value} />
                ))}
              </div>
            </div>
          )}

          {/* Key drivers */}
          {prediction.contributingFactors.length > 0 && (
            <div className="panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Key Drivers
              </p>
              <div className="flex flex-wrap gap-2">
                {prediction.contributingFactors.map((f, i) => (
                  <span
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-full bg-muted/30 border border-border/60 text-muted-foreground"
                  >
                    {String(f)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          {recommendation && (
            <div className="panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Recommendation
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed">{recommendation}</p>
            </div>
          )}

          {/* Intelligence alert */}
          {alert && (
            <div className="panel p-4 border border-amber-500/25 bg-amber-500/5 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-500">{alert.reason}</p>
                {alert.recommendedAction && (
                  <p className="text-xs text-amber-500/80 mt-1">{alert.recommendedAction}</p>
                )}
              </div>
            </div>
          )}

          {/* Metadata footer */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/50 px-1">
            <span>
              Polled {new Date(prediction.timestamp).toLocaleString([], {
                month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
            {prediction.sourceApis && prediction.sourceApis.length > 0 && (
              <span className="text-right">Sources: {prediction.sourceApis.join(" · ")}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
