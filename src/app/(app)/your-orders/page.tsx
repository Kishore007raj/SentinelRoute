"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle,
  Zap,
  Package,
  PlusSquare,
  AlertTriangle,
  ShoppingBag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useStore } from "@/lib/store";
import { cn, getRiskColor, formatRelativeTime } from "@/lib/utils";
import type { Shipment } from "@/lib/types";
import Link from "next/link";

const statusConfig: Record<string, { label: string; icon: typeof Zap; color: string; bg: string }> = {
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
  cancelled: {
    label: "Cancelled",
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/20",
  },
  draft: {
    label: "Draft",
    icon: Package,
    color: "text-muted-foreground",
    bg: "bg-muted/30 border-border",
  },
};

function OrderRow({ shipment, index }: { shipment: Shipment; index: number }) {
  const status = statusConfig[shipment.status] ?? statusConfig.active;
  const StatusIcon = status.icon;
  const riskColor = getRiskColor(shipment.riskLevel);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
    >
      <Link href={`/shipments/${shipment.id}`}>
        <div className="panel p-4 bg-card hover:border-border/90 hover:bg-muted/10 transition-all cursor-pointer group">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/40">
            <div className="flex items-center gap-2.5 text-sm font-bold text-foreground min-w-0">
              <span className="truncate">{shipment.origin}</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
              <span className="truncate">{shipment.destination}</span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] font-bold px-2 py-0.5 shrink-0 border uppercase tracking-wider",
                status.bg,
                status.color
              )}
            >
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
          </div>

          <div className="pt-3 pb-1 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="label-meta mb-0.5">Risk Score</p>
              <p className={cn("text-base font-bold tabular-nums", riskColor)}>
                {shipment.riskScore}
                <span className="text-[10px] text-muted-foreground font-normal ml-1 uppercase">
                  ({shipment.riskLevel})
                </span>
              </p>
            </div>
            <div>
              <p className="label-meta mb-0.5">Transit ETA</p>
              <p className="font-bold text-foreground tabular-nums text-xs">{shipment.eta || "Standard"}</p>
            </div>
            <div className="hidden sm:block">
              <p className="label-meta mb-0.5">Cargo</p>
              <p className="font-semibold text-foreground truncate">{shipment.cargoType}</p>
            </div>
            <div className="hidden sm:block">
              <p className="label-meta mb-0.5">Vehicle</p>
              <p className="font-semibold text-foreground truncate">{shipment.vehicleType}</p>
            </div>
          </div>

          <div className="pt-2.5 mt-2 flex items-center justify-between gap-2 border-t border-border/30 text-[10px] text-muted-foreground">
            <span className="font-mono uppercase tracking-wider">{shipment.shipmentCode}</span>
            <span>{formatRelativeTime(shipment.lastUpdate)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <p className="label-meta text-xs uppercase tracking-widest font-bold text-foreground">{title}</p>
      <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0 h-4 min-w-5 justify-center", color)}>
        {count}
      </Badge>
    </div>
  );
}

export default function YourOrdersPage() {
  const { state } = useStore();
  const { shipments = [], loading } = state;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const activeShipments = useMemo(
    () => shipments.filter((s) => s.status === "active" || s.status === "at-risk"),
    [shipments]
  );
  const completedShipments = useMemo(
    () => shipments.filter((s) => s.status === "completed"),
    [shipments]
  );
  const cancelledShipments = useMemo(
    () => shipments.filter((s) => s.status === "cancelled"),
    [shipments]
  );

  if (!hydrated || loading) {
    return (
      <div className="max-w-5xl mx-auto py-24 flex flex-col items-center justify-center gap-3">
        <span className="w-7 h-7 border-2 border-border border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">Loading orders data…</p>
      </div>
    );
  }

  const hasAny = shipments.length > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-7 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <p className="label-meta flex items-center gap-2 mb-2">
            <ShoppingBag className="w-3.5 h-3.5 text-primary" />
            Order Tracking & History
          </p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Your Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {shipments.length} total orders · {activeShipments.length} active · {completedShipments.length} completed
            {cancelledShipments.length > 0 && ` · ${cancelledShipments.length} cancelled`}
          </p>
        </div>

        <Link href="/create-shipment">
          <Button className="h-10 px-4 font-bold text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
            <PlusSquare className="w-3.5 h-3.5" /> New Shipment
          </Button>
        </Link>
      </div>

      {!hasAny ? (
        <div className="panel p-12 text-center space-y-4 border border-dashed border-border/70">
          <div className="w-12 h-12 rounded-xl bg-muted/30 border border-border flex items-center justify-center mx-auto text-muted-foreground/50">
            <Package className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">No orders recorded</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Create your first shipment to generate risk-tracked order corridors.
            </p>
          </div>
          <Link href="/create-shipment">
            <Button className="h-9 px-4 text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
              <PlusSquare className="w-3.5 h-3.5" /> Create Shipment
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {activeShipments.length > 0 && (
            <section>
              <SectionHeader
                title="Active Orders"
                count={activeShipments.length}
                color="text-primary border-primary/30 bg-primary/10"
              />
              <div className="space-y-3">
                {activeShipments.map((s, i) => (
                  <OrderRow key={s.id} shipment={s} index={i} />
                ))}
              </div>
            </section>
          )}

          {activeShipments.length > 0 && completedShipments.length > 0 && (
            <Separator className="opacity-40" />
          )}

          {completedShipments.length > 0 && (
            <section>
              <SectionHeader
                title="Completed Orders"
                count={completedShipments.length}
                color="text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
              />
              <div className="space-y-3">
                {completedShipments.map((s, i) => (
                  <OrderRow key={s.id} shipment={s} index={i} />
                ))}
              </div>
            </section>
          )}

          {cancelledShipments.length > 0 && (
            <>
              <Separator className="opacity-40" />
              <section>
                <SectionHeader
                  title="Cancelled Orders"
                  count={cancelledShipments.length}
                  color="text-red-400 border-red-400/30 bg-red-400/10"
                />
                <div className="space-y-3">
                  {cancelledShipments.map((s, i) => (
                    <OrderRow key={s.id} shipment={s} index={i} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
