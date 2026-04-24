"use client";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle,
  Zap,
  AlertTriangle,
  Clock,
  Package,
  PlusSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useStore } from "@/lib/store";
import { cn, getRiskColor } from "@/lib/utils";
import type { Shipment } from "@/lib/mock-data";
import Link from "next/link";

// ─── Status config (mirrors ShipmentStub) ─────────────────────────────────────

const statusConfig = {
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

// ─── Single order row ─────────────────────────────────────────────────────────

function OrderRow({
  shipment,
  index,
}: {
  shipment: Shipment;
  index: number;
}) {
  const status = statusConfig[shipment.status];
  const StatusIcon = status.icon;
  const riskColor = getRiskColor(shipment.riskLevel);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      whileHover={{ y: -1 }}
    >
      <Link href={`/shipments/${shipment.id}`}>
        {/* Shipment-pass stub style: dashed border + tear-edge gradient */}
        <div className="rounded-lg border border-dashed border-border/70 bg-card hover:border-border hover:shadow-md hover:shadow-black/15 transition-all duration-200 overflow-hidden cursor-pointer">
          {/* Tear edge */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-border/50 to-transparent" />

          {/* Header row */}
          <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground min-w-0">
              <span className="truncate">{shipment.origin}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="truncate">{shipment.destination}</span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 shrink-0 border",
                status.bg,
                status.color,
              )}
            >
              <StatusIcon className="w-2.5 h-2.5 mr-1" />
              {status.label}
            </Badge>
          </div>

          {/* Data grid */}
          <div className="px-4 pb-3 grid grid-cols-3 sm:grid-cols-5 gap-3">
            <div>
              <p className="label-meta mb-0.5">Risk</p>
              <p className={cn("text-base font-bold", riskColor)}>
                {shipment.riskScore}
              </p>
            </div>
            <div>
              <p className="label-meta mb-0.5">ETA</p>
              <p className="text-xs font-semibold text-foreground">
                {shipment.eta}
              </p>
            </div>
            <div>
              <p className="label-meta mb-0.5">Route</p>
              <p className="text-xs font-semibold text-foreground capitalize">
                {shipment.routeName}
              </p>
            </div>
            <div className="hidden sm:block">
              <p className="label-meta mb-0.5">Cargo</p>
              <p className="text-xs text-foreground truncate">
                {shipment.cargoType}
              </p>
            </div>
            <div className="hidden sm:block">
              <p className="label-meta mb-0.5">Vehicle</p>
              <p className="text-xs text-foreground truncate">
                {shipment.vehicleType}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 pb-3 flex items-center justify-between gap-2 border-t border-border/30 pt-2">
            <span className="text-[10px] font-mono text-muted-foreground">
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

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  color,
}: {
  title: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <Badge
        variant="outline"
        className={cn("text-[10px] px-1.5 py-0 h-4 min-w-[18px]", color)}
      >
        {count}
      </Badge>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function YourOrdersPage() {
  const { state, activeShipments, completedShipments } = useStore();
  const { shipments } = state;

  const hasAny = shipments.length > 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {shipments.length} total · {activeShipments.length} active ·{" "}
            {completedShipments.length} completed
          </p>
        </div>
        <Link href="/create-shipment">
          <Button size="sm" className="h-8 text-xs gap-1.5">
            <PlusSquare className="w-3.5 h-3.5" />
            New Shipment
          </Button>
        </Link>
      </div>

      {!hasAny ? (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel flex flex-col items-center justify-center gap-4 py-20 text-center"
        >
          <div className="w-12 h-12 rounded-full bg-muted/50 border border-border flex items-center justify-center">
            <Package className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              No orders yet
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Create a shipment, select a route, and confirm dispatch to see
              your orders here.
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
        <div className="space-y-8">
          {/* ── Active Orders ── */}
          {activeShipments.length > 0 && (
            <section>
              <SectionHeader
                title="Active Orders"
                count={activeShipments.length}
                color="text-primary border-primary/30 bg-primary/10"
              />
              <div className="space-y-2">
                {activeShipments.map((s, i) => (
                  <OrderRow key={s.id} shipment={s} index={i} />
                ))}
              </div>
            </section>
          )}

          {activeShipments.length > 0 && completedShipments.length > 0 && (
            <Separator className="opacity-30" />
          )}

          {/* ── Completed Orders ── */}
          {completedShipments.length > 0 && (
            <section>
              <SectionHeader
                title="Completed Orders"
                count={completedShipments.length}
                color="text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
              />
              <div className="space-y-2">
                {completedShipments.map((s, i) => (
                  <OrderRow key={s.id} shipment={s} index={i} />
                ))}
              </div>
            </section>
          )}

          {/* If only active, no completed yet */}
          {activeShipments.length > 0 && completedShipments.length === 0 && (
            <div className="panel py-8 text-center">
              <p className="text-xs text-muted-foreground">
                No completed orders yet. Mark a shipment as completed from the
                route view.
              </p>
            </div>
          )}

          {/* If only completed, no active */}
          {activeShipments.length === 0 && completedShipments.length > 0 && (
            <section>
              <SectionHeader
                title="Active Orders"
                count={0}
                color="text-muted-foreground border-border"
              />
              <div className="panel py-8 text-center">
                <p className="text-xs text-muted-foreground">
                  No active orders. All shipments have been completed.
                </p>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
