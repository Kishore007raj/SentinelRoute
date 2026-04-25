"use client";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Clock, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, getRiskColor } from "@/lib/utils";
import type { Shipment } from "@/lib/types";
import Link from "next/link";

const statusConfig = {
  in_transit: { label: "In Transit", icon: Zap, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  completed: { label: "Completed", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
  pending: { label: "Pending", icon: Clock, color: "text-muted-foreground", bg: "bg-muted border-border" },
};

interface ShipmentStubProps {
  shipment: Shipment;
  index?: number;
}

export function ShipmentStub({ shipment, index = 0 }: ShipmentStubProps) {
  const status = statusConfig[shipment.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      whileHover={{ y: -1 }}
    >
      <Link href={`/shipments/${shipment.shipmentId}`}>
        <div className="panel p-4 cursor-pointer hover:border-border/80 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 group">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span>{shipment.origin}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              <span>{shipment.destination}</span>
            </div>
            <Badge
              variant="outline"
              className={cn("text-[10px] font-semibold px-1.5 py-0.5 shrink-0 border uppercase tracking-widest", status.bg, status.color)}
            >
              <StatusIcon className="w-2.5 h-2.5 mr-1" />
              {status.label}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">Risk</p>
              <p className={cn("text-lg font-black", getRiskColor(shipment.riskLevel))}>
                {shipment.riskScore}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">ETA</p>
              <p className="text-sm font-bold text-foreground">{shipment.durationHours.toFixed(1)}h</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">Route</p>
              <p className="text-sm font-bold text-foreground capitalize truncate">{shipment.routeName}</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">{shipment.shipmentId}</span>
            <span className="text-[10px] font-medium text-muted-foreground">
              {new Date(shipment.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
