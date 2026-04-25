"use client";
import { motion } from "framer-motion";
import { PlusSquare, AlertTriangle, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { cn, getRiskColor } from "@/lib/utils";
import Link from "next/link";
import type { Shipment } from "@/lib/types";
import { useEffect, useState } from "react";

function FormattedTime({ date }: { date: string }) {
  const [time, setTime] = useState<string>("");
  
  useEffect(() => {
    setTime(new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [date]);

  return <span>{time}</span>;
}

function ShipmentFeedRow({ shipment, index }: { shipment: Shipment; index: number }) {
  const riskColor = getRiskColor(shipment.riskLevel);
  const isCompleted = shipment.status === "completed";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
    >
      <Link href={`/shipments/${shipment.shipmentId}`}>
        <div className={cn(
          "flex items-stretch border-b border-border/30 hover:bg-muted/10 transition-colors duration-150 cursor-pointer group",
        )}>
          <div className={cn(
            "w-1 shrink-0",
            shipment.status === "in_transit" ? "bg-blue-400" : isCompleted ? "bg-emerald-400/40" : "bg-amber-400/40",
          )} />

          <div className="flex-1 min-w-0 px-6 py-6">
            <div className="flex items-center gap-8">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2.5 text-base font-semibold text-foreground">
                  <span className="truncate">{shipment.origin}</span>
                  <ArrowRight size={14} className="text-muted-foreground/40 shrink-0" />
                  <span className="truncate">{shipment.destination}</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground/50 tracking-wider">
                  {shipment.shipmentId}
                </p>
              </div>

              <div className="w-16 shrink-0 text-center">
                <p className={cn("text-2xl font-bold leading-none", riskColor)}>
                  {shipment.riskScore}
                </p>
                <p className={cn("text-[10px] uppercase tracking-widest font-medium mt-1 opacity-70", riskColor)}>
                  {shipment.riskLevel}
                </p>
              </div>

              <div className="w-28 shrink-0 hidden sm:block space-y-1">
                <p className="text-base font-semibold text-foreground">{shipment.durationHours.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">duration</p>
              </div>

              <div className="flex-1 min-w-0 hidden lg:block space-y-1">
                <p className="text-sm font-medium text-foreground truncate">{shipment.cargoType}</p>
                <p className="text-xs text-muted-foreground truncate">{shipment.vehicleType}</p>
              </div>

              <div className="shrink-0 hidden sm:block w-24 text-right space-y-1">
                <p className="text-xs text-muted-foreground">
                  <FormattedTime date={shipment.updatedAt} />
                </p>
                <p className={cn(
                  "text-[10px] uppercase tracking-widest font-bold",
                  shipment.status === "in_transit" ? "text-blue-400" : isCompleted ? "text-emerald-400" : "text-amber-400",
                )}>
                  {shipment.status.replace("_", " ")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { state } = useStore();
  const { shipments, loading } = state;

  const activeShipments = (shipments || []).filter(s => s.status === "in_transit");
  const pendingShipments = (shipments || []).filter(s => s.status === "pending");
  const completedShipments = (shipments || []).filter(s => s.status === "completed");

  const totalShipments = shipments?.length || 0;
  const avgRisk = (shipments?.length || 0) > 0
    ? Math.round((shipments || []).reduce((sum, s) => sum + (s.riskScore || 0), 0) / (shipments?.length || 1))
    : 0;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto w-full py-32 flex flex-col items-center gap-4">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="w-8 h-8 border-2 border-border border-t-blue-500 rounded-full" />
        <p className="text-sm text-muted-foreground">Loading operational data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full space-y-10 p-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-8 border-b border-border">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-black">Fleet Command</p>
          <h1 className="text-3xl font-bold">Logistics Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {activeShipments.length} in transit · {pendingShipments.length} pending dispatch
          </p>
        </div>
        <Link href="/create-shipment">
          <Button className="bg-blue-600 hover:bg-blue-500 h-11 px-6 font-bold rounded-xl gap-2">
            <PlusSquare size={18} /> New Shipment
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Active Fleet", value: activeShipments.length, sub: "In transit now", color: "text-blue-400" },
          { label: "Avg Risk Index", value: avgRisk, sub: "System health", color: avgRisk > 50 ? "text-amber-400" : "text-emerald-400" },
          { label: "Pending", value: pendingShipments.length, sub: "Awaiting dispatch", color: "text-amber-400" },
          { label: "Completed", value: completedShipments.length, sub: "Total throughput", color: "text-emerald-400" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-6 space-y-2 shadow-sm">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{label}</p>
            <p className={cn("text-4xl font-black tabular-nums", color)}>{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-10">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Shipment Feed</h2>
            <Link href="/shipments" className="text-sm text-blue-500 hover:underline font-bold">View History</Link>
          </div>

          <div className="border border-border rounded-2xl overflow-hidden bg-card/50">
            {(shipments?.length || 0) === 0 ? (
              <div className="py-24 text-center">
                <p className="text-muted-foreground">No shipments recorded yet.</p>
              </div>
            ) : (
              (shipments || []).slice(0, 10).map((s, i) => (
                <ShipmentFeedRow key={s.id || i} shipment={s} index={i} />
              ))
            )}
          </div>
        </div>

        <div className="xl:w-80 space-y-8">
           <div className="bg-blue-600/5 border border-blue-600/10 rounded-2xl p-6">
             <h3 className="text-[10px] font-black uppercase tracking-widest mb-4">Operational Intelligence</h3>
             <p className="text-sm text-muted-foreground leading-relaxed">
               All routes are analyzed using OSRM geometry and cross-referenced with real-time weather data. Risk scores above 75 trigger automatic critical flags.
             </p>
           </div>

           <div className="space-y-4">
             <h3 className="text-sm font-bold uppercase tracking-widest">Recent Activity</h3>
             <div className="space-y-3">
               {(shipments || []).slice(0, 5).map(s => (
                 <div key={s.id} className="flex justify-between items-center text-sm border-b border-border/30 pb-2">
                   <span className="font-mono text-xs text-muted-foreground">{s.shipmentId}</span>
                   <span className="font-bold">{(s.status || "").replace("_", " ")}</span>
                 </div>
               ))}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
