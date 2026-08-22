"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { TrendingDown, TrendingUp, AlertTriangle, Zap, BarChart2 } from "lucide-react";

const C = {
  primary: "#c05621", // Muted industrial copper / primary
  violet: "#9333ea", // Accent
  amber: "#f59e0b", // Amber warning
  emerald: "#10b981", // Emerald safe
  danger: "#ef4444", // Red critical
  muted: "#71717a", // Neutral axis labels
  border: "#27272a", // Dark border for tooltip
  popover: "#18181b", // Tooltip background
  fg: "#f4f4f5", // Tooltip text
};

const tip = {
  background: C.popover,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  fontSize: 11,
  color: C.fg,
};

// Static timestamp set once when module loads - pure during render
const INITIAL_TIME = Date.now();

export default function AnalyticsPage() {
  const { state } = useStore();
  const { shipments = [] } = state;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const memoStats = useMemo(() => {
    const total = (shipments || []).length;
    const active = (shipments || []).filter((s) => s.status === "active" || s.status === "at-risk").length;

    const avgRiskScore =
      total > 0 ? Math.round(shipments.reduce((sum, s) => sum + (s.riskScore || 0), 0) / total) : 0;

    const highRiskAvoided = (shipments || []).filter(
      (s) => s.selectedRoute !== "fastest" && s.riskScore > 50
    ).length;

    const now = INITIAL_TIME;
    const volumeData = Array.from({ length: 7 }, (_, i) => {
      const weekStart = now - (6 - i) * 7 * 24 * 60 * 60 * 1000;
      const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
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

    const last2 = volumeData.slice(-2).reduce((s, d) => s + d.shipments, 0);
    const prior2 = volumeData.slice(-4, -2).reduce((s, d) => s + d.shipments, 0);
    const volTrend = last2 - prior2;

    const riskDist = [
      {
        name: "Low Risk",
        value:
          total > 0
            ? Math.round(
                ((shipments || []).filter((s) => s.riskLevel === "low").length / total) * 100
              )
            : 33,
        color: C.emerald,
      },
      {
        name: "Medium Risk",
        value:
          total > 0
            ? Math.round(
                ((shipments || []).filter((s) => s.riskLevel === "medium").length / total) * 100
              )
            : 33,
        color: C.amber,
      },
      {
        name: "High Risk",
        value:
          total > 0
            ? Math.round(
                ((shipments || []).filter(
                  (s) => s.riskLevel !== "low" && s.riskLevel !== "medium"
                ).length /
                  total) *
                  100
              )
            : 34,
        color: C.danger,
      },
    ];

    return { total, active, avgRiskScore, highRiskAvoided, volumeData, riskDist, volTrend };
  }, [shipments]);

  if (!hydrated) return null;

  const { total, active, avgRiskScore, highRiskAvoided, volumeData, riskDist, volTrend } = memoStats;
  const hasEnoughData = total >= 5;

  return (
    <div className="max-w-7xl mx-auto w-full space-y-7 pb-12">
      {/* Header */}
      <div className="pb-6 border-b border-border space-y-2">
        <p className="label-meta flex items-center gap-2 mb-2">
          <BarChart2 className="w-3.5 h-3.5 text-primary" />
          Operational Analytics & Decision Support
        </p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historical risk distribution, corridor dispatch volume, and predictive safety trends.
        </p>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Volume Trend",
            value: volTrend >= 0 ? `+${volTrend}` : String(volTrend),
            sub: "vs prior 2 weeks",
            icon: volTrend >= 0 ? TrendingUp : TrendingDown,
            color: volTrend >= 0 ? "text-emerald-400" : "text-amber-400",
          },
          {
            label: "Avg Risk Exposure",
            value: String(avgRiskScore),
            sub: avgRiskScore < 40 ? "within safe range" : "elevated exposure",
            icon: avgRiskScore > 50 ? AlertTriangle : TrendingDown,
            color: avgRiskScore > 50 ? "text-amber-400" : "text-emerald-400",
          },
          {
            label: "High-Risk Avoided",
            value: String(highRiskAvoided),
            sub: `of ${total} total shipments`,
            icon: TrendingUp,
            color: "text-primary",
          },
          {
            label: "Active Fleet",
            value: String(active),
            sub: "current active trips",
            icon: Zap,
            color: "text-amber-400",
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="panel p-5 bg-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="label-meta">{label}</span>
              <Icon className={cn("w-3.5 h-3.5", color)} />
            </div>
            <p className={cn("text-3xl font-bold tabular-nums tracking-tight", color)}>{value}</p>
            <p className="text-[11px] text-muted-foreground font-medium">{sub}</p>
          </div>
        ))}
      </div>

      {!hasEnoughData ? (
        <div className="panel p-12 text-center space-y-3 border border-dashed border-border/70">
          <div className="w-10 h-10 rounded-lg bg-muted/20 border border-border flex items-center justify-center mx-auto text-muted-foreground">
            <BarChart2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Insights require at least 5 shipments</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Create and dispatch candidate shipments to populate route performance charts and risk distribution metrics.
            {total > 0 && ` Currently recorded: ${total}.`}
          </p>
        </div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Volume Bar Chart (8 cols) */}
            <div className="lg:col-span-8 panel p-5 bg-card space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Shipment Volume Trend</h3>
                  <p className="text-[11px] text-muted-foreground">7-week dispatch tracking vs high-risk paths</p>
                </div>
                <span className="label-meta">Weekly Aggregate</span>
              </div>

              <div className="h-60 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                  <BarChart data={volumeData} barGap={4} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={tip} labelStyle={{ color: C.fg }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="shipments" name="Total Volume" fill={C.primary} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="highRisk" name="High Risk" fill={C.amber} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Risk Distribution Pie Chart (4 cols) */}
            <div className="lg:col-span-4 panel p-5 bg-card space-y-4">
              <div className="border-b border-border/40 pb-3">
                <h3 className="text-sm font-semibold text-foreground">Risk Distribution</h3>
                <p className="text-[11px] text-muted-foreground">Corridor safety categorization</p>
              </div>

              <div className="h-44 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={170}>
                  <PieChart>
                    <Pie data={riskDist} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={4} dataKey="value">
                      {riskDist.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v}%`, ""]} contentStyle={tip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/40 text-xs">
                {riskDist.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-bold tabular-nums text-foreground">{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Data Insights */}
          {(() => {
            const fastestCount = (shipments || []).filter((s) => s.selectedRoute === "fastest").length;
            const safestCount = (shipments || []).filter((s) => s.selectedRoute === "safest").length;
            const balancedCount = (shipments || []).filter((s) => s.selectedRoute === "balanced").length;
            const atRiskCount = (shipments || []).filter((s) => s.status === "at-risk").length;

            const insights: { title: string; context: string; tag: string; color: string }[] = [];

            if (balancedCount > fastestCount) {
              insights.push({
                title: "Balanced Routing Preferred",
                context: `${balancedCount} of ${total} shipments selected balanced corridors, prioritizing risk-adjusted reliability.`,
                tag: "Pattern",
                color: "blue",
              });
            } else if (fastestCount > 0) {
              insights.push({
                title: "Speed-First Routing Active",
                context: `${fastestCount} of ${total} shipments selected the fastest route. Consider balanced paths to reduce disruption exposure.`,
                tag: "Advisory",
                color: "amber",
              });
            }

            if (safestCount > 0) {
              insights.push({
                title: "Conservative Routing Active",
                context: `${safestCount} shipment(s) used safest routing — appropriate for high-value or temperature-sensitive freight.`,
                tag: "Safety",
                color: "green",
              });
            }

            if (atRiskCount > 0) {
              insights.push({
                title: "Active Risk Alerts",
                context: `${atRiskCount} shipment(s) currently flagged at risk. Inspect predictive alerts for rerouting recommendations.`,
                tag: "Alert",
                color: "amber",
              });
            }

            if (insights.length === 0) return null;

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {insights.slice(0, 3).map((card, i) => (
                  <div key={i} className="panel p-4 bg-card flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground">{card.title}</p>
                      <span
                        className={cn(
                          "text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border",
                          card.color === "green"
                            ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                            : card.color === "blue"
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-amber-400/10 text-amber-400 border-amber-400/20"
                        )}
                      >
                        {card.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{card.context}</p>
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
