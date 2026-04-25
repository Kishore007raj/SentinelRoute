"use client";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, CheckCircle, Zap, Clock, Package, PlusSquare, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useStore } from "@/lib/store";
import { cn, getRiskColor } from "@/lib/utils";
import type { Shipment, ShipmentStatus } from "@/lib/types";
import Link from "next/link";

// Canonical status config — matches ShipmentStatus: "pending" | "active" | "at-risk" | "completed"
const statusConfig: Record<ShipmentStatus, { label: string; icon: typeof Zap; color: string; bg: string }> = {
  active: {
    label: "Active",
    icon: Zap,
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
  },
  "at-risk": {
    label: "At Risk",
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    color: "text-muted-foreground",
    bg: "bg-muted border-border",
  },
};

function OrderRow({ shipment, index }: { shipment: Shipment; index: number }) {
  // Defensive fallback for any unexpected status value
  const status = statusConfig[shipment.status] ?? statusConfig.pending;
  const StatusIcon = status.icon;
  const riskColor = getRiskColor(shipment.riskLevel);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      whileHover={{ y: -1 }}
    >
      {/* Link uses shipment.id — consistent with dashboard and shipments page */}
      <Link href={`/shipments/${shipment.id}`}>
        <div className="rounded-xl border border-border/50 bg-card hover:border-border hover:shadow-lg hover:shadow-black/20 transition-all duration-200 overflow-hidden cursor-pointer">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-border/50 to-transparent" />

          <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-base font-bold text-foreground min-w-0">
              <span className="truncate">{shipment.origin}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="truncate">{shipment.destination}</span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 shrink-0 border uppercase tracking-widest",
                status.bg, status.color,
              )}
            >
              <StatusIcon className="w-3 h-3 mr-1.5" />
              {status.label}
            </Badge>
          </div>

          <div className="px-6 pb-5 grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Risk</p>
              <p className={cn("text-xl font-bold tabular-nums", riskColor)}>{shipment.riskScore}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">ETA</p>
              <p className="text-sm font-bold text-foreground">{shipment.eta}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Cargo</p>
              <p className="text-sm font-bold text-foreground truncate">{shipment.cargoType}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Vehicle</p>
              <p className="text-sm font-bold text-foreground truncate">{shipment.vehicleType}</p>
            </div>
          </div>

          <div className="px-6 py-3 flex items-center justify-between gap-2 border-t border-border/30 bg-muted/5">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">
              {shipment.shipmentCode}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {shipment.lastUpdate}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <p className="text-sm font-semibold uppercase tracking-widest text-foreground">{title}</p>
      <Badge variant="outline" className={cn("text-[10px] font-semibold px-1.5 py-0 h-4 min-w-[20px] justify-center", color)}>
        {count}
      </Badge>
    </div>
  );
}

export default function YourOrdersPage() {
  const { state } = useStore();
  const { shipments = [], loading } = state;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  // Active = "active" or "at-risk" or "pending" — anything not completed
  const activeShipments   = useMemo(() => shipments.filter((s) => s.status !== "completed"), [shipments]);
  const completedShipments = useMemo(() => shipments.filter((s) => s.status === "completed"), [shipments]);

  if (!hydrated || loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
          className="w-8 h-8 border-2 border-border border-t-primary rounded-full"
        />
        <p className="text-sm text-muted-foreground">Loading your orders...</p>
      </div>
    );
  }

  const hasAny = shipments.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-border">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Order Management</p>
          <h1 className="text-3xl font-bold text-foreground">Your Orders</h1>
          <p className="text-sm text-muted-foreground">
            {shipments.length} total · {activeShipments.length} active · {completedShipments.length} completed
          </p>
        </div>
        <Link href="/create-shipment">
          <Button className="gap-2 px-6 h-11 font-semibold rounded-lg">
            <PlusSquare className="w-4 h-4" /> New Shipment
          </Button>
        </Link>
      </div>

      {!hasAny ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card border border-border border-dashed rounded-xl flex flex-col items-center justify-center gap-6 py-32 text-center"
        >
          <div className="w-16 h-16 rounded-xl bg-muted/30 border border-border flex items-center justify-center">
            <Package className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">No orders yet</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              No shipments found. Create your first shipment to get started.
            </p>
          </div>
          <Link href="/create-shipment">
            <Button className="h-11 px-8 font-semibold rounded-lg gap-2">
              <PlusSquare className="w-4 h-4" /> Create Shipment
            </Button>
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-12">
          {activeShipments.length > 0 && (
            <section>
              <SectionHeader
                title="Active"
                count={activeShipments.length}
                color="text-primary border-primary/30 bg-primary/10"
              />
              <div className="space-y-4">
                {activeShipments.map((s, i) => (
                  <OrderRow key={s.id} shipment={s} index={i} />
                ))}
              </div>
            </section>
          )}

          {activeShipments.length > 0 && completedShipments.length > 0 && (
            <div className="py-2"><Separator className="opacity-10" /></div>
          )}

          {completedShipments.length > 0 && (
            <section>
              <SectionHeader
                title="Completed"
                count={completedShipments.length}
                color="text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
              />
              <div className="space-y-4">
                {completedShipments.map((s, i) => (
                  <OrderRow key={s.id} shipment={s} index={i} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
