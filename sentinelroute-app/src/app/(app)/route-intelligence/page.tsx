"use client";
import { motion } from "framer-motion";
import {
  CloudRain, Car, AlertTriangle, Package, TrendingUp,
  ShieldCheck, Zap, Clock, Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const riskFactors = [
  { icon: Car, label: "Traffic Density", score: 62, trend: "rising", detail: "Heavy congestion near Hosur toll on NH44. Urban segments show 40% capacity reduction during peak hours.", color: "text-amber-400", bg: "bg-amber-400/5 border-amber-400/20" },
  { icon: CloudRain, label: "Weather Impact", score: 45, trend: "moderate", detail: "Scattered rainfall predicted along NH48 corridor. Intensity increasing through afternoon. Possible visibility reduction.", color: "text-primary", bg: "bg-primary/5 border-primary/20" },
  { icon: AlertTriangle, label: "Disruption Probability", score: 38, trend: "stable", detail: "Roadwork near Dharmapuri bypass adding estimated 18–22 minutes. Flagged until April 25.", color: "text-amber-400", bg: "bg-amber-400/5 border-amber-400/20" },
  { icon: Package, label: "Cargo Sensitivity", score: 55, trend: "high", detail: "Electronics cargo on active routes flagged for heat exposure risk. Temperature sensitivity above 38°C threshold on 2 segments.", color: "text-red-400", bg: "bg-red-400/5 border-red-400/20" },
];

const predictiveAlerts = [
  { severity: "critical", msg: "NH48 congestion probability 78% between 2–5PM", route: "Route A" },
  { severity: "warning", msg: "Rain intensity increasing — delay possible (30–45 min)", route: "NH44 Corridor" },
  { severity: "info", msg: "Route B shows lowest delay-to-risk ratio this week", route: "Route B" },
  { severity: "info", msg: "Roadwork on Dharmapuri bypass — alternate routing advised", route: "NH44 Alt" },
];

const severityColor: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/20",
  warning: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  info: "text-primary bg-primary/10 border-primary/20",
};

const tradeoffData = [
  { label: "Fastest Route", eta: "4h 20m", risk: 72, disruption: "High", delay: "±45 min" },
  { label: "Balanced Route", eta: "5h 05m", risk: 37, disruption: "Low", delay: "±12 min" },
  { label: "Safest Route", eta: "6h 10m", risk: 14, disruption: "Minimal", delay: "±5 min" },
];

export default function RouteIntelligencePage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Route Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Explainable route reasoning · Real-time risk signals · Predictive tradeoff analysis
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: risk factors */}
        <div className="xl:col-span-2 space-y-4">
          {/* Risk factor cards */}
          <div>
            <p className="label-meta mb-3">Active Risk Factors</p>
            <div className="space-y-3">
              {riskFactors.map((factor, i) => {
                const Icon = factor.icon;
                return (
                  <motion.div
                    key={factor.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className={cn("panel p-4 border", factor.bg)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("w-8 h-8 rounded-md flex items-center justify-center border", factor.bg)}>
                        <Icon className={cn("w-4 h-4", factor.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-foreground">{factor.label}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn("text-[10px]", factor.color, factor.bg.replace("bg-", "border-").replace("/5", "/30"))}>
                              {factor.trend}
                            </Badge>
                            <span className={cn("text-sm font-bold", factor.color)}>{factor.score}</span>
                          </div>
                        </div>
                        <div className="risk-bar mb-2">
                          <motion.div
                            className={cn("h-full rounded-full", factor.score > 60 ? "bg-red-400" : factor.score > 40 ? "bg-amber-400" : "bg-emerald-400")}
                            initial={{ width: 0 }}
                            animate={{ width: `${factor.score}%` }}
                            transition={{ duration: 0.6, delay: i * 0.07 }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{factor.detail}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Safe vs Fast tradeoff */}
          <div className="panel p-4">
            <p className="label-meta mb-3">Route Tradeoff Comparison</p>
            <div className="space-y-0 divide-y divide-border/50">
              {tradeoffData.map((row, i) => (
                <div key={row.label} className={cn("grid grid-cols-5 gap-3 py-3 items-center", i === 1 && "bg-primary/5 -mx-4 px-4 border-y border-primary/15")}>
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-foreground">{row.label}</p>
                    {i === 1 && <span className="text-[10px] text-primary">Recommended</span>}
                  </div>
                  <div>
                    <p className="label-meta">ETA</p>
                    <p className="text-xs font-bold text-foreground">{row.eta}</p>
                  </div>
                  <div>
                    <p className="label-meta">Risk</p>
                    <p className={cn("text-xs font-bold", row.risk > 60 ? "text-red-400" : row.risk > 30 ? "text-amber-400" : "text-emerald-400")}>
                      {row.risk}
                    </p>
                  </div>
                  <div>
                    <p className="label-meta">Delay Var</p>
                    <p className="text-xs text-foreground">{row.delay}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: predictive alerts + reasoning */}
        <div className="space-y-4">
          {/* Alerts */}
          <div className="panel p-4">
            <p className="label-meta mb-3">Predictive Alert Feed</p>
            <div className="space-y-2">
              {predictiveAlerts.map((alert, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className={cn("rounded-md border px-3 py-2.5", severityColor[alert.severity])}
                >
                  <p className="text-[11px] font-medium">{alert.msg}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">{alert.route}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Recommendation logic */}
          <div className="panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Recommendation Logic</p>
            </div>
            <div className="space-y-3 text-[11px] text-muted-foreground leading-relaxed">
              <p>Route B (Balanced) is recommended based on:</p>
              <ul className="space-y-1.5 list-none">
                {[
                  "Lowest combined delay-to-risk ratio",
                  "No critical disruption zones detected",
                  "ETA variance ±12 min (high confidence)",
                  "Cargo sensitivity within acceptable threshold",
                  "Driver fatigue risk: low (5h 05m route)",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Separator className="opacity-30" />
              <p className="text-[10px] text-muted-foreground/70">
                This recommendation is explainable and auditable. No black-box decisions.
              </p>
            </div>
          </div>

          {/* ETA confidence */}
          <div className="panel p-4">
            <p className="label-meta mb-3">ETA Variance Confidence</p>
            <div className="space-y-2">
              {[
                { label: "Route A", confidence: 58, color: "bg-amber-400" },
                { label: "Route B", confidence: 82, color: "bg-primary" },
                { label: "Route C", confidence: 94, color: "bg-emerald-400" },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">{r.label}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className={cn("h-full rounded-full", r.color)}
                      initial={{ width: 0 }}
                      animate={{ width: `${r.confidence}%` }}
                      transition={{ duration: 0.7 }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground w-8 text-right">{r.confidence}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
