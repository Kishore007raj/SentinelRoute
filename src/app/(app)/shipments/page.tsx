"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Search, AlertTriangle, CheckCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { cn, getRiskColor } from "@/lib/utils";
import type { Shipment, ShipmentStatus } from "@/lib/types";

const statusConfig: Record<ShipmentStatus, { label: string; color: string; dot: string }> = {
  pending: { label: "Pending", color: "text-amber-400", dot: "bg-amber-400" },
  in_transit: { label: "In Transit", color: "text-blue-400", dot: "bg-blue-400" },
  completed: { label: "Completed", color: "text-emerald-400", dot: "bg-emerald-400" },
};

function ShipmentRow({ shipment, index }: { shipment: Shipment; index: number }) {
  const { updateShipmentStatus } = useStore();
  const riskColor = getRiskColor(shipment.riskLevel);
  const status = statusConfig[shipment.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-card border border-border rounded-xl hover:border-border/80 transition-colors"
    >
      <div className="flex items-center gap-6 px-7 py-5">
        <Link href={`/shipments/${shipment.shipmentId}`} className="flex-1 min-w-0">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span>{shipment.origin}</span>
              <ArrowRight size={14} className="text-muted-foreground/50" />
              <span>{shipment.destination}</span>
            </div>
            <p className="text-xs font-mono text-muted-foreground">{shipment.shipmentId}</p>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0 w-32">
          <div className={cn("w-2 h-2 rounded-full", status.dot)} />
          <span className={cn("text-sm font-medium", status.color)}>{status.label}</span>
        </div>

        <div className="w-16 shrink-0 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Risk</p>
          <p className={cn("text-lg font-bold", riskColor)}>{shipment.riskScore}</p>
        </div>

        <div className="w-24 shrink-0 text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Time</p>
          <p className="text-sm font-semibold">{shipment.durationHours.toFixed(1)}h</p>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          {shipment.status === "in_transit" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-2 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10"
              onClick={(e) => {
                e.preventDefault();
                updateShipmentStatus(shipment.shipmentId, "completed");
              }}
            >
              <CheckCircle size={14} />
              Mark as Completed
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function ShipmentsPage() {
  const { state } = useStore();
  const { shipments } = state;
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = shipments.filter((s) => {
    const matchesTab = tab === "all" || s.status === tab;
    const matchesSearch = !search
      || s.origin.toLowerCase().includes(search.toLowerCase())
      || s.destination.toLowerCase().includes(search.toLowerCase())
      || s.shipmentId.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 p-6">
      <div className="flex justify-between items-end border-b border-border pb-8">
        <div>
          <h1 className="text-3xl font-bold">Shipments</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time logistics monitoring</p>
        </div>
        <Link href="/create-shipment">
          <Button className="bg-blue-600 hover:bg-blue-500 rounded-lg h-11 px-6 font-semibold">
            + New Shipment
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            className="pl-10 h-11 bg-muted/20 border-border"
            placeholder="Search shipments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <Tabs value={tab} onValueChange={setTab} className="w-full sm:w-auto">
          <TabsList className="bg-muted/20 p-1">
            <TabsTrigger value="all">All ({shipments.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in_transit">In Transit</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-border rounded-2xl bg-muted/5">
            <p className="text-muted-foreground">No shipments matching your criteria</p>
          </div>
        ) : (
          filtered.map((s, i) => (
            <ShipmentRow key={s.id || s.shipmentId} shipment={s} index={i} />
          ))
        )}
      </div>
    </div>
  );
}
