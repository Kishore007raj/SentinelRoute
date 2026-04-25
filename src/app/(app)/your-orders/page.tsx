"use client";
import { useEffect, useState, useMemo } from "react";
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
import type { Shipment } from "@/lib/types";
import Link from "next/link";

const statusConfig = {
  in_transit: {
    label: "In Transit",
    icon: Zap,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
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

function FormattedTime({ date }: { date: string }) {
  const [time, setTime] = useState<string>("");
  useEffect(() => {
    setTime(new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [date]);
  return <span>{time}</span>;
}

function OrderRow({
  shipment,
  index,
}: {
  shipment: Shipment;
  index: number;
}) {
  const status = statusConfig[shipment.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;
  const riskColor = getRiskColor(shipment.riskLevel);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      whileHover={{ y: -1 }}
    >
      <Link href={`/shipments/${shipment.shipmentId}`}>
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
                "text-[10px] font-black px-2 py-0.5 shrink-0 border uppercase tracking-widest",
                status.bg,
                status.color,
              )}
            >
              <StatusIcon className="w-3 h-3 mr-1.5" />
              {status.label}
            </Badge>
          </div>

          <div className="px-6 pb-5 grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Risk Index</p>
              <p className={cn("text-xl font-black tabular-nums", riskColor)}>
                {shipment.riskScore}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Duration</p>
              <p className="text-sm font-bold text-foreground">
                {shipment.durationHours.toFixed(1)}h
              </p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Cargo Type</p>
              <p className="text-sm font-bold text-foreground truncate">
                {shipment.cargoType}
              </p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Vehicle</p>
              <p className="text-sm font-bold text-foreground truncate">
                {shipment.vehicleType}
              </p>
            </div>
          </div>

          <div className="px-6 py-3 flex items-center justify-between gap-2 border-t border-border/30 bg-muted/5">
            <span className="text-[10px] font-black text-muted-foreground font-mono uppercase tracking-tighter">
              ID: {shipment.shipmentId}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground">
              Last update: <FormattedTime date={shipment.updatedAt} />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

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
    <div className="flex items-center gap-3 mb-4">
      <p className="text-sm font-black uppercase tracking-widest text-foreground">{title}</p>
      <Badge
        variant="outline"
        className={cn("text-[10px] font-black px-1.5 py-0 h-4 min-w-[20px] justify-center", color)}
      >
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

  const activeShipments = useMemo(() => shipments?.filter(s => s.status === "in_transit" || s.status === "pending") || [], [shipments]);
  const completedShipments = useMemo(() => shipments?.filter(s => s.status === "completed") || [], [shipments]);

  if (!hydrated || loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 flex flex-col items-center justify-center gap-4">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="w-8 h-8 border-2 border-border border-t-blue-500 rounded-full" />
        <p className="text-sm text-muted-foreground font-medium italic">Syncing with fleet operations...</p>
      </div>
    );
  }

  const hasAny = shipments?.length > 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-border">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mb-2">Order Management</p>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Your Shipments</h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            {shipments?.length || 0} total · {activeShipments?.length || 0} active · {completedShipments?.length || 0} archived
          </p>
        </div>
        <Link href="/create-shipment">
          <Button className="bg-blue-600 hover:bg-blue-500 h-10 px-6 font-bold rounded-xl gap-2 shadow-lg shadow-blue-600/20">
            <PlusSquare size={16} /> New Shipment
          </Button>
        </Link>
      </div>

      {!hasAny ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card border border-border border-dashed rounded-3xl flex flex-col items-center justify-center gap-6 py-32 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted/30 border border-border flex items-center justify-center">
            <Package className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-bold text-foreground">Manifest Empty</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto font-medium">
              No active or archived shipments found. Start by creating your first logistics route.
            </p>
          </div>
          <Link href="/create-shipment">
            <Button className="h-10 px-8 font-bold rounded-xl gap-2">
              <PlusSquare size={16} /> Create Manifest
            </Button>
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-12">
          {activeShipments.length > 0 && (
            <section>
              <SectionHeader
                title="Active Manifests"
                count={activeShipments.length}
                color="text-blue-400 border-blue-400/30 bg-blue-400/10"
              />
              <div className="space-y-4">
                {activeShipments.map((s, i) => (
                  <OrderRow key={s.id} shipment={s} index={i} />
                ))}
              </div>
            </section>
          )}

          {activeShipments.length > 0 && completedShipments.length > 0 && (
            <div className="py-2">
              <Separator className="opacity-10" />
            </div>
          )}

          {completedShipments.length > 0 && (
            <section>
              <SectionHeader
                title="Archived Operations"
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
