"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { PlusSquare, AlertTriangle, TrendingUp, Zap, Clock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { KPICard } from "@/components/dashboard/KPICard";
import { ShipmentStub } from "@/components/shipment/ShipmentStub";
import { kpiData, mockShipments } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import Link from "next/link";

const recentAlerts = [
  { id: 1, type: "warning", msg: "Rain intensity increasing on NH48 — SR-2026-0041", time: "4 min ago" },
  { id: 2, type: "danger", msg: "Congestion detected near Hosur toll — SR-2026-0039", time: "9 min ago" },
  { id: 3, type: "info", msg: "SR-2026-0037 completed — Pune → Mumbai", time: "2 hrs ago" },
];

export default function DashboardPage() {
  const [showEmpty] = useState(false);

  const activeShipments = mockShipments.filter((s) => s.status === "active" || s.status === "at-risk");
  const completedShipments = mockShipments.filter((s) => s.status === "completed");

  return (
    <div className="flex flex-col xl:flex-row gap-6 min-h-0 w-full">
      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiData.map((kpi, i) => (
            <KPICard key={kpi.label} {...kpi} index={i} />
          ))}
        </div>

        {/* Active shipments header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Active Shipments</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{activeShipments.length} in motion</p>
          </div>
          <Link href="/create-shipment">
            <Button size="sm" className="h-7 text-xs gap-1.5 shrink-0">
              <PlusSquare className="w-3.5 h-3.5" />
              New Shipment
            </Button>
          </Link>
        </div>

        {showEmpty ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel flex-1 flex flex-col items-center justify-center gap-4 py-16 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-muted/50 border border-border flex items-center justify-center">
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Create your first shipment</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Analyze routes, compare risk, and make dispatch decisions with full operational transparency.
              </p>
            </div>
            <Link href="/create-shipment">
              <Button className="h-8 text-xs gap-1.5">
                <PlusSquare className="w-3.5 h-3.5" />
                Create Shipment
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeShipments.map((s, i) => (
              <ShipmentStub key={s.id} shipment={s} index={i} />
            ))}
          </div>
        )}

        {/* Completed */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Recent Completions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedShipments.map((s, i) => (
              <ShipmentStub key={s.id} shipment={s} index={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full xl:w-72 2xl:w-80 shrink-0 flex flex-col gap-4">
        {/* Quick stats */}
        <div className="panel p-4">
          <p className="label-meta mb-3">Quick Stats</p>
          <div className="space-y-3">
            {[
              { icon: Zap, label: "Active Routes", value: "2", color: "text-primary" },
              { icon: AlertTriangle, label: "At-Risk Shipments", value: "1", color: "text-amber-400" },
              { icon: TrendingUp, label: "Risk Avoided (7d)", value: "43", color: "text-emerald-400" },
              { icon: Clock, label: "Avg Decision Time", value: "4.2 min", color: "text-muted-foreground" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={cn("w-3.5 h-3.5 shrink-0", color)} />
                  <span className="text-xs text-muted-foreground truncate">{label}</span>
                </div>
                <span className={cn("text-xs font-bold shrink-0", color)}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="panel p-4">
          <p className="label-meta mb-3">Predictive Alerts</p>
          <div className="space-y-3">
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-2.5">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                  alert.type === "warning" ? "bg-amber-400" : alert.type === "danger" ? "bg-red-400" : "bg-primary"
                )} />
                <div className="min-w-0">
                  <p className="text-[11px] text-foreground leading-relaxed">{alert.msg}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-3 opacity-30" />

          <p className="label-meta mb-3">Recent Decisions</p>
          <div className="space-y-2">
            {mockShipments.slice(2).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-muted-foreground truncate">{s.shipmentCode}</span>
                <Badge variant="outline" className={cn(
                  "text-[9px] shrink-0",
                  s.selectedRoute === "balanced" ? "text-primary border-primary/30" :
                  s.selectedRoute === "fastest" ? "text-amber-400 border-amber-400/30" :
                  "text-emerald-400 border-emerald-400/30"
                )}>
                  {s.routeName}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
