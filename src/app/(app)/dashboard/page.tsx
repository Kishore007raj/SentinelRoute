"use client";
import { motion } from "framer-motion";
import { PlusSquare, AlertTriangle, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { cn, getRiskColor } from "@/lib/utils";
import Link from "next/link";
import type { Shipment } from "@/lib/types";

// ─── Feed row ─────────────────────────────────────────────────────────────────
function ShipmentFeedRow({ shipment, index }: { shipment: Shipment; index: number }) {
  const riskColor = getRiskColor(shipment.riskLevel);
  const isAtRisk   = shipment.status === "at-risk";
  const isCompleted = shipment.status === "completed";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
    >
      <Link href={`/shipments/${shipment.id}`}>
        <div className={cn(
          "flex items-stretch border-b border-border/30 hover:bg-muted/10 transition-colors duration-150 cursor-pointer group",
        )}>
          {/* Status strip */}
          <div className={cn(
            "w-1 shrink-0",
            isAtRisk ? "bg-amber-400" : isCompleted ? "bg-emerald-400/40" : "bg-primary/40",
          )} />

          <div className="flex-1 min-w-0 px-6 py-6">
            {/* Main row */}
            <div className="flex items-center gap-8">
              {/* Route */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2.5 text-base font-semibold text-foreground">
                  <span className="truncate">{shipment.origin}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  <span className="truncate">{shipment.destination}</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground/50 hidden sm:block tracking-wider">
                  {shipment.shipmentCode}
                </p>
              </div>

              {/* Risk */}
              <div className="w-16 shrink-0 text-center space-y-1">
                <p className={cn("text-2xl font-bold tabular-nums leading-none", riskColor)}>
                  {shipment.riskScore}
                </p>
                <p className={cn("text-[10px] uppercase tracking-widest font-medium", riskColor, "opacity-70")}>
                  {shipment.riskLevel}
                </p>
              </div>

              {/* ETA */}
              <div className="w-28 shrink-0 hidden sm:block space-y-1">
                <p className="text-base font-semibold text-foreground">{shipment.eta}</p>
                <p className="text-xs text-muted-foreground">estimated</p>
              </div>

              {/* Cargo */}
              <div className="flex-1 min-w-0 hidden lg:block space-y-1">
                <p className="text-sm font-medium text-foreground truncate">{shipment.cargoType}</p>
                <p className="text-xs text-muted-foreground truncate">{shipment.vehicleType}</p>
              </div>

              {/* Time */}
              <div className="shrink-0 hidden sm:block w-24 text-right space-y-1">
                <p className="text-xs text-muted-foreground">{shipment.lastUpdate}</p>
                <p className={cn(
                  "text-[10px] uppercase tracking-widest font-medium",
                  isAtRisk ? "text-amber-400" : isCompleted ? "text-emerald-400" : "text-primary",
                )}>
                  {isAtRisk ? "at risk" : isCompleted ? "done" : "active"}
                </p>
              </div>
            </div>

            {/* Alert sub-row */}
            {shipment.predictiveAlert && (
              <div className="flex items-start gap-2.5 mt-4 pt-4 border-t border-border/20">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-400/80 leading-relaxed">{shipment.predictiveAlert}</p>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { state, activeShipments, completedShipments, atRiskShipments } = useStore();
  const { shipments, loading } = state;

  const totalShipments   = shipments.length;
  const avgRisk          = totalShipments > 0
    ? Math.round(shipments.reduce((sum, s) => sum + s.riskScore, 0) / totalShipments)
    : 0;
  const highRiskAvoided  = shipments.filter((s) => s.selectedRoute !== "fastest").length;
  const topAlert         = shipments.find((s) => s.status === "at-risk" && s.predictiveAlert)
    ?? shipments.find((s) => s.predictiveAlert);
  const feedShipments    = [...activeShipments, ...completedShipments.slice(0, 3)];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            className="w-8 h-8 border-2 border-border border-t-primary rounded-full"
          />
          <p className="text-sm text-muted-foreground">Loading shipments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full space-y-10">

      {/* Top summary */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-8 border-b border-border">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Operational overview</p>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {activeShipments.length} active · {atRiskShipments.length} at risk
          </p>
        </div>
        <Link href="/create-shipment">
          <Button className="gap-2 px-6 h-11 font-semibold rounded-lg">
            <PlusSquare className="w-4 h-4" /> New Shipment
          </Button>
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: "Active now",
            value: activeShipments.length,
            sub: atRiskShipments.length > 0 ? `${atRiskShipments.length} at risk` : "all clear",
            subColor: atRiskShipments.length > 0 ? "text-amber-400" : "text-emerald-400",
          },
          {
            label: "Avg risk",
            value: avgRisk,
            sub: avgRisk < 40 ? "within safe range" : "elevated",
            subColor: avgRisk > 50 ? "text-amber-400" : "text-emerald-400",
            valueColor: avgRisk > 60 ? "text-red-400" : avgRisk > 30 ? "text-amber-400" : "text-emerald-400",
          },
          {
            label: "High-risk avoided",
            value: highRiskAvoided,
            sub: `of ${totalShipments} total`,
            subColor: "text-muted-foreground",
            valueColor: "text-emerald-400",
          },
          {
            label: "Completed",
            value: completedShipments.length,
            sub: `${totalShipments} total shipments`,
            subColor: "text-muted-foreground",
          },
        ].map(({ label, value, sub, subColor, valueColor }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-6 space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
            <p className={cn("text-5xl font-bold tabular-nums leading-none", valueColor ?? "text-foreground")}>
              {value}
            </p>
            <p className={cn("text-sm", subColor)}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="flex flex-col xl:flex-row gap-10">

        {/* Feed */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Shipment Feed</h2>
              <p className="text-sm text-muted-foreground">{feedShipments.length} records</p>
            </div>
            <Link href="/shipments">
              <button className="text-sm text-primary hover:underline font-medium">View all</button>
            </Link>
          </div>

          {/* Column headers */}
          <div className="hidden sm:flex items-center border-b border-border/40 bg-muted/5 px-6 py-3 pl-7">
            <div className="flex items-center gap-8 flex-1 min-w-0">
              <span className="text-xs text-muted-foreground uppercase tracking-widest flex-1">Route</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest w-16 text-center shrink-0">Risk</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest w-28 shrink-0 hidden sm:block">ETA</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest flex-1 hidden lg:block">Cargo</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest w-24 text-right shrink-0 hidden sm:block">Status</span>
            </div>
          </div>

          <div className="border border-border border-t-0 rounded-b-xl overflow-hidden">
            {feedShipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-6 py-24 text-center px-8">
                <p className="text-lg font-semibold text-foreground">No shipments yet</p>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                  Create a shipment to begin routing decisions.
                </p>
                <Link href="/create-shipment">
                  <Button className="gap-2 px-6 h-11 rounded-lg">
                    <PlusSquare className="w-4 h-4" /> Create Shipment
                  </Button>
                </Link>
              </div>
            ) : (
              feedShipments.map((s, i) => (
                <ShipmentFeedRow key={s.id} shipment={s} index={i} />
              ))
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="xl:w-80 shrink-0 space-y-8">

          {topAlert && (
            <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-6 space-y-4">
              <p className="text-xs text-amber-400 uppercase tracking-widest">Live alert</p>
              <p className="text-sm text-foreground leading-relaxed">{topAlert.predictiveAlert}</p>
              <p className="text-xs font-mono text-muted-foreground">{topAlert.shipmentCode}</p>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-base font-semibold text-foreground">Needs Attention</h3>
            {atRiskShipments.length === 0 && activeShipments.length === 0 ? (
              <div className="flex items-center gap-3 py-5">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-sm text-muted-foreground">No action required</p>
              </div>
            ) : (
              <div className="space-y-3">
                {atRiskShipments.map((s) => (
                  <Link key={s.id} href={`/shipments/${s.id}`}>
                    <div className="bg-card border border-border rounded-xl p-5 hover:border-amber-400/30 transition-colors cursor-pointer space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground">{s.shipmentCode}</span>
                        <span className="text-base font-bold text-amber-400">{s.riskScore}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{s.origin} → {s.destination}</p>
                      {s.predictiveAlert && (
                        <p className="text-xs text-amber-400/80 leading-relaxed">{s.predictiveAlert}</p>
                      )}
                    </div>
                  </Link>
                ))}
                {activeShipments.filter(s => s.status !== "at-risk").slice(0, 2).map((s) => (
                  <Link key={s.id} href={`/shipments/${s.id}`}>
                    <div className="bg-card border border-border rounded-xl p-5 hover:border-border/80 transition-colors cursor-pointer space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground">{s.shipmentCode}</span>
                        <span className={cn("text-base font-bold", getRiskColor(s.riskLevel))}>{s.riskScore}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{s.origin} → {s.destination}</p>
                      <p className="text-xs text-muted-foreground">{s.eta} · {s.lastUpdate}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-semibold text-foreground">Recent Decisions</h3>
            <div className="space-y-0">
              {shipments.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
                  <span className="text-xs font-mono text-muted-foreground">{s.shipmentCode}</span>
                  <span className={cn(
                    "text-xs font-semibold",
                    s.selectedRoute === "balanced" ? "text-primary" :
                    s.selectedRoute === "fastest"  ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {s.routeName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
