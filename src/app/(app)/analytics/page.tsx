"use client";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { TrendingDown, TrendingUp, AlertTriangle, Zap } from "lucide-react";

const C = {
  primary: "#5eadd4",   // cyan-blue — matches new --primary oklch(0.68 0.17 210)
  violet:  "#a78bfa",   // violet    — matches new --accent-2 oklch(0.70 0.18 300)
  amber:   "#fbbf24",   // amber     — matches --sr-amber
  emerald: "#34d399",   // green     — matches --sr-emerald
  danger:  "#f87171",   // red       — matches --sr-danger
  muted:   "#6b7280",   // neutral axis labels
  border:  "#1e2a3a",   // dark border for tooltip
  popover: "#0a0f1a",   // tooltip background
  fg:      "#f5f9ff",   // tooltip text
};

const tip = {
  background: C.popover, border: `1px solid ${C.border}`,
  borderRadius: 0, fontSize: 11, color: C.fg,
};

export default function AnalyticsPage() {
  const { state } = useStore();
  const { shipments = [] } = state;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const memoStats = useMemo(() => {
    const total = (shipments || []).length;
    const completed = (shipments || []).filter((s) => s.status === "completed").length;
    const active = (shipments || []).filter((s) => s.status === "active" || s.status === "at-risk").length;
    
    const avgRiskScore = total > 0
      ? Math.round(shipments.reduce((sum, s) => sum + (s.riskScore || 0), 0) / total)
      : 0;
    
    // "High-risk avoided" = non-fastest routes with riskScore > 50
    // (consistent with dashboard definition)
    const highRiskAvoided = (shipments || []).filter(
      (s) => s.selectedRoute !== "fastest" && s.riskScore > 50
    ).length;

    // Volume chart: real per-week bucketing from createdAt, or empty if no data
    const now = Date.now();
    const volumeData = Array.from({ length: 7 }, (_, i) => {
      const weekStart = now - (6 - i) * 7 * 24 * 60 * 60 * 1000;
      const weekEnd   = weekStart + 7 * 24 * 60 * 60 * 1000;
      const weekShipments = (shipments || []).filter((s) => {
        const t = s.createdAt ? new Date(s.createdAt).getTime() : 0;
        return t >= weekStart && t < weekEnd;
      });
      return {
        week: `W${i + 1}`,
        shipments: weekShipments.length,
        highRisk: weekShipments.filter((s) => s.riskLevel === "high" || s.riskLevel === "critical").length,
      };
    });

    // Volume trend: compare last 2 weeks vs prior 2 weeks (real calculation)
    const last2  = volumeData.slice(-2).reduce((s, d) => s + d.shipments, 0);
    const prior2 = volumeData.slice(-4, -2).reduce((s, d) => s + d.shipments, 0);
    const volTrend = last2 - prior2;

    // Risk distribution calculation
    const riskDist = [
      { 
        name: "Low Risk", 
        value: total > 0 ? Math.round(((shipments || []).filter(s => s.riskLevel === "low").length / total) * 100) : 33, 
        color: C.emerald 
      },
      { 
        name: "Medium Risk", 
        value: total > 0 ? Math.round(((shipments || []).filter(s => s.riskLevel === "medium").length / total) * 100) : 33, 
        color: C.violet
      },
      { 
        name: "High Risk", 
        value: total > 0 ? Math.round(((shipments || []).filter(s => s.riskLevel !== "low" && s.riskLevel !== "medium").length / total) * 100) : 34, 
        color: C.amber 
      },
    ];

    return { total, completed, active, avgRiskScore, highRiskAvoided, volumeData, riskDist, volTrend };
  }, [shipments]);

  if (!hydrated) return null;

  const { total, completed, active, avgRiskScore, highRiskAvoided, volumeData, riskDist, volTrend } = memoStats;

  // ── Low-data guard ────────────────────────────────────────────────────────
  // Charts are meaningless with fewer than 5 shipments — show a clear message instead.
  const hasEnoughData = total >= 5;

  return (
    <div className="max-w-7xl mx-auto w-full space-y-10 p-6">
      <div className="pb-8 border-b border-border">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-bold">Operational intelligence</p>
        <h1 className="text-3xl font-bold text-foreground mb-8 tracking-tight">Analytics Dashboard</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Volume trend", value: volTrend >= 0 ? `+${volTrend}` : String(volTrend), sub: "vs prior 2 weeks", icon: volTrend >= 0 ? TrendingUp : TrendingDown, color: volTrend >= 0 ? "text-emerald-400" : "text-amber-400" },
            { label: "Avg risk exposure", value: String(avgRiskScore), sub: avgRiskScore < 40 ? "within safe range" : "elevated", icon: avgRiskScore > 50 ? AlertTriangle : TrendingDown, color: avgRiskScore > 50 ? "text-amber-400" : "text-emerald-400" },
            { label: "High-risk avoided", value: String(highRiskAvoided), sub: `of ${total} total`, icon: TrendingUp, color: "text-primary" },
            { label: "Active fleet", value: String(active), sub: "current operations", icon: Zap, color: "text-[oklch(0.70_0.18_300)]" },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-6 space-y-3 shadow-sm hover:border-border/60 transition-colors">
              <div className="flex items-center gap-2.5">
                <Icon className={cn("w-4 h-4 shrink-0", color)} />
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{label}</p>
              </div>
              <p className={cn("text-4xl font-black tabular-nums tracking-tight", color)}>{value}</p>
              <p className="text-xs text-muted-foreground font-medium">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {!hasEnoughData ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center bg-card border border-border rounded-2xl">
          <p className="text-base font-semibold text-foreground">Not enough data to generate insights yet</p>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            Create and dispatch at least 5 shipments to unlock charts and trend analysis.
            {total > 0 && ` You have ${total} so far.`}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col lg:flex-row gap-8 min-w-0">
            <div className="flex-1 min-w-0 bg-card border border-border rounded-2xl p-7 shadow-sm overflow-hidden">
              <div className="mb-6 space-y-1">
                <p className="text-lg font-bold text-foreground">Shipment Volume</p>
                <p className="text-sm text-muted-foreground font-medium">Last 7 weeks performance tracking</p>
              </div>
              <div className="h-[240px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={volumeData} barGap={3} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tip} labelStyle={{ color: C.fg }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="shipments" name="Total" fill={C.primary} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="highRisk" name="High Risk" fill={C.violet} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:w-80 shrink-0 bg-card border border-border rounded-2xl p-7 shadow-sm overflow-hidden">
              <div className="mb-5 space-y-1">
                <p className="text-lg font-bold text-foreground">Risk Distribution</p>
                <p className="text-sm text-muted-foreground font-medium">System-wide safety metrics</p>
              </div>
              <div className="h-[180px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie data={riskDist} cx="50%" cy="50%" innerRadius={44} outerRadius={64} paddingAngle={4} dataKey="value">
                      {riskDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v}%`, ""]} contentStyle={tip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 mt-5">
                {riskDist.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-sm text-muted-foreground font-medium">{d.name}</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-foreground">{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Data-driven insight cards */}
          {(() => {
            const fastestCount  = (shipments || []).filter((s) => s.selectedRoute === "fastest").length;
            const safestCount   = (shipments || []).filter((s) => s.selectedRoute === "safest").length;
            const balancedCount = (shipments || []).filter((s) => s.selectedRoute === "balanced").length;
            const atRiskCount   = (shipments || []).filter((s) => s.status === "at-risk").length;

            const insights: { title: string; context: string; tag: string; color: string }[] = [];

            if (balancedCount > fastestCount) {
              insights.push({
                title:   "Balanced routing preferred",
                context: `${balancedCount} of ${total} shipments used the balanced route — indicating a preference for risk-adjusted decisions over raw speed.`,
                tag:     "Pattern",
                color:   "blue",
              });
            } else if (fastestCount > 0) {
              insights.push({
                title:   "Speed-first routing detected",
                context: `${fastestCount} of ${total} shipments used the fastest route. Consider balanced routing to reduce disruption exposure.`,
                tag:     "Advisory",
                color:   "amber",
              });
            }

            if (safestCount > 0) {
              insights.push({
                title:   "Conservative routing active",
                context: `${safestCount} shipment${safestCount !== 1 ? "s" : ""} used the safest route — appropriate for sensitive cargo or high-disruption corridors.`,
                tag:     "Safety",
                color:   "green",
              });
            }

            if (atRiskCount > 0) {
              insights.push({
                title:   "Active risk flags",
                context: `${atRiskCount} shipment${atRiskCount !== 1 ? "s are" : " is"} currently at risk. Review predictive alerts and consider route adjustments.`,
                tag:     "Alert",
                color:   "amber",
              });
            }

            if (insights.length === 0) return null;

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {insights.slice(0, 3).map((card, i) => (
                  <div key={i} className="flex bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                    <div className={cn("w-1.5 shrink-0", card.color === "green" ? "bg-emerald-400" : card.color === "blue" ? "bg-primary" : "bg-amber-400")} />
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-foreground">{card.title}</p>
                        <span className={cn("text-[9px] uppercase tracking-widest font-black", card.color === "green" ? "text-emerald-400" : card.color === "blue" ? "text-primary" : "text-amber-400")}>{card.tag}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed font-medium">{card.context}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
