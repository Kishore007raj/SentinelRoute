"use client";
import { motion } from "framer-motion";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Separator } from "@/components/ui/separator";
import {
  analyticsVolumeData, analyticsRiskData,
  analyticsEtaRiskData, routeCategoryData, insightCards,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";

const C = {
  primary: "#3b82f6", amber: "#f59e0b", emerald: "#10b981",
  muted: "#4b5563", border: "#1f2937", popover: "#111827", fg: "#f9fafb",
};

const tip = {
  background: C.popover, border: `1px solid ${C.border}`,
  borderRadius: 0, fontSize: 11, color: C.fg,
};

export default function AnalyticsPage() {
  const { state, completedShipments } = useStore();
  const { shipments } = state;

  const total = shipments.length;
  const completed = completedShipments.length;
  const avgRisk = total > 0
    ? Math.round(shipments.reduce((s, x) => s + x.riskScore, 0) / total)
    : 0;
  const highRiskAvoided = shipments.filter((s) => s.selectedRoute !== "fastest").length;
  const atRisk = shipments.filter((s) => s.status === "at-risk").length;

  // Trend: last 2 weeks vs prior 2 weeks
  const recentVol = analyticsVolumeData.slice(-2).reduce((s, d) => s + d.shipments, 0);
  const priorVol = analyticsVolumeData.slice(-4, -2).reduce((s, d) => s + d.shipments, 0);
  const volTrend = recentVol - priorVol;

  return (
    <div className="max-w-7xl mx-auto w-full space-y-10">

      {/* ── Narrative header ── */}
      <div className="pb-8 border-b border-border">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Operational intelligence</p>
        <h1 className="text-3xl font-bold text-foreground mb-8">Analytics</h1>

        {/* Key narrative */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              label: "Volume trend",
              value: volTrend >= 0 ? `+${volTrend}` : `${volTrend}`,
              sub: "vs prior 2 weeks",
              icon: volTrend >= 0 ? TrendingUp : TrendingDown,
              color: volTrend >= 0 ? "text-emerald-400" : "text-amber-400",
            },
            {
              label: "Avg risk exposure",
              value: String(avgRisk),
              sub: avgRisk < 40 ? "within safe range" : "elevated",
              icon: avgRisk > 50 ? AlertTriangle : TrendingDown,
              color: avgRisk > 50 ? "text-amber-400" : "text-emerald-400",
            },
            {
              label: "High-risk avoided",
              value: String(highRiskAvoided),
              sub: `of ${total} total`,
              icon: TrendingUp,
              color: "text-primary",
            },
            {
              label: "Currently at risk",
              value: String(atRisk),
              sub: atRisk > 0 ? "requires attention" : "all clear",
              icon: atRisk > 0 ? AlertTriangle : TrendingDown,
              color: atRisk > 0 ? "text-amber-400" : "text-emerald-400",
            },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2.5">
                <Icon className={cn("w-4 h-4 shrink-0", color)} />
                <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
              </div>
              <p className={cn("text-4xl font-bold tabular-nums", color)}>{value}</p>
              <p className="text-sm text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="flex flex-col lg:flex-row gap-8">

        {/* Volume */}
        <div className="flex-1 min-w-0 bg-card border border-border rounded-xl p-7">
          <div className="mb-6 space-y-1">
            <p className="text-base font-semibold text-foreground">Shipment volume</p>
            <p className="text-sm text-muted-foreground">
              {volTrend >= 0 ? "↑ Volume increasing" : "↓ Volume declining"} — last 7 weeks
            </p>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsVolumeData} barGap={3} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tip} labelStyle={{ color: C.fg }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="shipments" name="Total" fill={C.primary} radius={[3, 3, 0, 0]} />
                <Bar dataKey="highRisk" name="High Risk" fill={C.amber} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-6 mt-5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: C.primary }} />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: C.amber }} />
              <span className="text-sm text-muted-foreground">High Risk</span>
            </div>
          </div>
        </div>

        {/* Risk distribution */}
        <div className="lg:w-72 shrink-0 bg-card border border-border rounded-xl p-7">
          <div className="mb-5 space-y-1">
            <p className="text-base font-semibold text-foreground">Risk distribution</p>
            <p className="text-sm text-muted-foreground">
              {analyticsRiskData[0].value}% low-risk decisions
            </p>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analyticsRiskData} cx="50%" cy="50%" innerRadius={44} outerRadius={64} paddingAngle={2} dataKey="value">
                  {analyticsRiskData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v}%`, ""]} contentStyle={tip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-5">
            {analyticsRiskData.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-sm text-muted-foreground">{d.name}</span>
                </div>
                <span className="text-sm font-mono text-foreground">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ETA vs Risk + Route breakdown ── */}
      <div className="flex flex-col lg:flex-row gap-8">

        {/* ETA vs Risk */}
        <div className="flex-1 bg-card border border-border rounded-xl p-7">
          <div className="mb-5 space-y-1">
            <p className="text-base font-semibold text-foreground">ETA vs risk tradeoff</p>
            <p className="text-sm text-muted-foreground">
              Balanced routes deliver the best delay-to-risk ratio
            </p>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsEtaRiskData} barGap={6} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
                <XAxis dataKey="route" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tip} labelStyle={{ color: C.fg }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="avgRisk" name="Avg Risk" fill={C.amber} radius={[3, 3, 0, 0]} />
                <Bar dataKey="avgEta" name="Avg ETA (h)" fill={C.primary} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Route category */}
        <div className="lg:w-80 shrink-0 bg-card border border-border rounded-xl p-7">
          <div className="mb-7 space-y-1">
            <p className="text-base font-semibold text-foreground">Route decisions</p>
            <p className="text-sm text-muted-foreground">
              {routeCategoryData[0].value}% chose balanced routing
            </p>
          </div>
          <div className="space-y-5">
            {routeCategoryData.map((item, i) => (
              <div key={item.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                  <span className="text-sm font-bold text-foreground">{item.value}%</span>
                </div>
                <div className="h-2 bg-muted overflow-hidden rounded-full">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: [C.primary, C.amber, C.emerald][i] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.value}%` }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                  />
                </div>
              </div>
            ))}
          </div>
          <Separator className="my-7 opacity-20" />
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1.5">
              <p className="text-3xl font-bold text-foreground">{total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="border-x border-border/40 space-y-1.5">
              <p className="text-3xl font-bold text-emerald-400">{completed}</p>
              <p className="text-xs text-muted-foreground">Done</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-3xl font-bold text-amber-400">{highRiskAvoided}</p>
              <p className="text-xs text-muted-foreground">Avoided</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Insight cards ── */}
      <div className="space-y-5">
        <p className="text-base font-semibold text-foreground">What this means</p>
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {insightCards.map((card) => (
            <div key={card.id} className="flex gap-0">
              <div className={cn(
                "w-1 shrink-0",
                card.tagColor === "green" ? "bg-emerald-400/60" :
                card.tagColor === "blue" ? "bg-primary/60" : "bg-amber-400/60"
              )} />
              <div className="px-7 py-6 flex-1">
                <div className="flex items-start justify-between gap-8">
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-semibold text-foreground leading-snug">{card.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{card.context}</p>
                  </div>
                  <span className={cn(
                    "text-xs uppercase tracking-widest shrink-0 mt-0.5 font-semibold",
                    card.tagColor === "green" ? "text-emerald-400" :
                    card.tagColor === "blue" ? "text-primary" : "text-amber-400"
                  )}>
                    {card.tag}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
