"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, AlertTriangle, CheckCircle2, Clock, Map, Package, Truck, Users } from "lucide-react";

interface KPIProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  trend?: { direction: "up" | "down" | "flat"; percent: number; isGood: boolean };
  glowColor?: "primary" | "violet" | "emerald" | "amber" | "danger";
}

function SummaryCard({ label, value, subtext, icon, trend, glowColor = "primary" }: KPIProps) {
  const glowClass = `card-glow${glowColor === "violet" ? "-violet" : ""}`;
  
  return (
    <Card className={`bg-card border-border overflow-hidden relative ${glowClass}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {label}
            </span>
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {value}
            </div>
            {subtext && (
              <span className="text-xs text-muted-foreground">{subtext}</span>
            )}
            
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <span 
                  className={`text-xs font-semibold ${
                    trend.isGood ? "text-[var(--sr-emerald)]" : "text-[var(--sr-danger)]"
                  }`}
                >
                  {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} {trend.percent}%
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">vs prev</span>
              </div>
            )}
          </div>
          <div className="p-3 bg-muted/30 rounded-xl text-muted-foreground">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// These interfaces match what KPIEngine returns
export interface KPIs {
  healthScore?: number;
  shipments?: {
    total: number;
    active: number;
    completed: number;
    cancelled: number;
    atRisk: number;
    delayed: number;
    successRate: number;
    deliveryPerformance: number;
  };
  fleet?: { total: number; available: number; assigned: number; maintenance: number; availabilityRate: number; utilizationRate: number };
  drivers?: { total: number; active: number; available: number; assigned: number; offDuty: number; suspended: number; utilizationRate: number };
  incidents?: { total: number; critical: number; high: number; medium: number; low: number };
}

export function ExecutiveSummaryCards({ kpis, isLoading }: { kpis: KPIs | null; isLoading: boolean }) {
  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="bg-card border-border h-32 animate-shimmer bg-gradient-to-r from-card via-muted/10 to-card bg-[length:400%_100%]" />
        ))}
      </div>
    );
  }

  const cards: KPIProps[] = [
    {
      label: "Active Shipments",
      value: kpis.shipments?.active ?? 0,
      subtext: `Out of ${kpis.shipments?.total ?? 0} total`,
      icon: <Package className="w-5 h-5" />,
      glowColor: "primary"
    },
    {
      label: "Shipment Success Rate",
      value: `${kpis.shipments?.successRate ?? 0}%`,
      icon: <CheckCircle2 className="w-5 h-5 text-[var(--sr-emerald)]" />,
      glowColor: "emerald"
    },
    {
      label: "At-Risk Shipments",
      value: kpis.shipments?.atRisk ?? 0,
      icon: <AlertTriangle className="w-5 h-5 text-[var(--sr-danger)]" />,
      glowColor: "danger"
    },
    {
      label: "Fleet Utilization",
      value: `${kpis.fleet?.utilizationRate ?? 0}%`,
      subtext: `${kpis.fleet?.assigned ?? 0} / ${kpis.fleet?.total ?? 0} active`,
      icon: <Truck className="w-5 h-5" />,
      glowColor: "violet"
    },
    {
      label: "Fleet Availability",
      value: `${kpis.fleet?.availabilityRate ?? 0}%`,
      subtext: `${kpis.fleet?.maintenance ?? 0} in maintenance`,
      icon: <Activity className="w-5 h-5 text-[var(--sr-emerald)]" />,
      glowColor: "primary"
    },
    {
      label: "Driver Utilization",
      value: `${kpis.drivers?.utilizationRate ?? 0}%`,
      subtext: `${kpis.drivers?.assigned ?? 0} / ${kpis.drivers?.total ?? 0} assigned`,
      icon: <Users className="w-5 h-5" />,
      glowColor: "violet"
    },
    {
      label: "Total Incidents",
      value: kpis.incidents?.total ?? 0,
      subtext: `${kpis.incidents?.critical ?? 0} critical, ${kpis.incidents?.high ?? 0} high`,
      icon: <Map className="w-5 h-5 text-[var(--sr-amber)]" />,
      glowColor: "amber"
    },
    {
      label: "Delivery Performance",
      value: `${kpis.shipments?.deliveryPerformance ?? 0}%`,
      subtext: `${kpis.shipments?.completed ?? 0} completed shipments`,
      icon: <Clock className="w-5 h-5" />,
      glowColor: "primary"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
        >
          <SummaryCard {...card} />
        </motion.div>
      ))}
    </div>
  );
}
