"use client";
import { motion } from "framer-motion";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  analyticsVolumeData,
  analyticsRiskData,
  analyticsEtaRiskData,
  routeCategoryData,
  insightCards,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { TrendingUp, BarChart3, PieChart as PieIcon, Activity } from "lucide-react";

const CHART_COLORS = {
  primary: "#3b82f6",
  amber: "#f59e0b",
  emerald: "#10b981",
  muted: "#6b7280",
  border: "#27272a",
  popover: "#18181b",
  foreground: "#fafafa",
};

const routeCategoryColors = [CHART_COLORS.primary, CHART_COLORS.amber, CHART_COLORS.emerald];

const insightTagColor: Record<string, string> = {
  green: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  blue: "text-primary border-primary/30 bg-primary/10",
  amber: "text-amber-400 border-amber-400/30 bg-amber-400/10",
};

const tooltipStyle = {
  background: CHART_COLORS.popover,
  border: `1px solid ${CHART_COLORS.border}`,
  borderRadius: 6,
  fontSize: 11,
  color: CHART_COLORS.foreground,
};

export default function AnalyticsPage() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Operational intelligence · Weekly performance · Route efficiency
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        {/* Volume trends */}
        <div className="xl:col-span-2 panel p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Shipment Volume Trends</p>
            <Badge variant="outline" className="ml-auto text-[10px]">Last 7 Weeks</Badge>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsVolumeData} barGap={4} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: CHART_COLORS.foreground }}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar dataKey="shipments" name="Total" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
                <Bar dataKey="highRisk" name="High Risk" fill={CHART_COLORS.amber} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.primary }} />
              <span className="text-[10px] text-muted-foreground">Total</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.amber }} />
              <span className="text-[10px] text-muted-foreground">High Risk</span>
            </div>
          </div>
        </div>

        {/* Risk distribution donut */}
        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Risk Distribution</p>
          </div>
          <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analyticsRiskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={68}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {analyticsRiskData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value}%`, ""]}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: CHART_COLORS.foreground }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {analyticsRiskData.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-[10px] text-muted-foreground">{d.name}</span>
                </div>
                <span className="text-[10px] font-mono text-foreground">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
        {/* ETA vs Risk */}
        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Avg ETA vs Risk Score</p>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsEtaRiskData} barGap={8} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                <XAxis
                  dataKey="route"
                  tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: CHART_COLORS.foreground }}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar dataKey="avgRisk" name="Avg Risk" fill={CHART_COLORS.amber} radius={[3, 3, 0, 0]} />
                <Bar dataKey="avgEta" name="Avg ETA (h)" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.amber }} />
              <span className="text-[10px] text-muted-foreground">Avg Risk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.primary }} />
              <span className="text-[10px] text-muted-foreground">Avg ETA (h)</span>
            </div>
          </div>
        </div>

        {/* Route category breakdown */}
        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Route Category Breakdown</p>
            <Badge variant="outline" className="ml-auto text-[10px]">This Period</Badge>
          </div>
          <div className="space-y-3 mt-2">
            {routeCategoryData.map((item, i) => (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground font-medium">{item.name}</span>
                  <span className="text-xs font-bold text-foreground">{item.value}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: routeCategoryColors[i] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.value}%` }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                  />
                </div>
              </div>
            ))}
          </div>
          <Separator className="my-4 opacity-30" />
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">247</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
            <div className="text-center border-x border-border/50">
              <p className="text-xl font-bold text-emerald-400">94%</p>
              <p className="text-[10px] text-muted-foreground">On-Time</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-amber-400">43</p>
              <p className="text-[10px] text-muted-foreground">Risk Avoided</p>
            </div>
          </div>
        </div>
      </div>

      {/* Insight cards */}
      <div>
        <p className="label-meta mb-3">Operational Insights</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {insightCards.map((card, i) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="panel p-4 flex flex-col gap-3"
            >
              <Badge variant="outline" className={cn("text-[10px] w-fit", insightTagColor[card.tagColor])}>
                {card.tag}
              </Badge>
              <p className="text-sm font-semibold text-foreground leading-snug">{card.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{card.context}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
