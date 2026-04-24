"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Search, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { cn, getRiskColor } from "@/lib/utils";
import type { Shipment, ShipmentStatus } from "@/lib/mock-data";

const tabConfig: { value: ShipmentStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "at-risk", label: "At Risk" },
  { value: "completed", label: "Completed" },
];

const statusConfig: Record<ShipmentStatus, { label: string; color: string; dot: string }> = {
  active: { label: "Active", color: "text-primary", dot: "bg-primary" },
  "at-risk": { label: "At Risk", color: "text-amber-400", dot: "bg-amber-400" },
  completed: { label: "Completed", color: "text-emerald-400", dot: "bg-emerald-400" },
  pending: { label: "Pending", color: "text-muted-foreground", dot: "bg-muted-foreground" },
};

// ─── Mobile card ──────────────────────────────────────────────────────────────
function ShipmentCard({ shipment, index }: { shipment: Shipment; index: number }) {
  const riskColor = getRiskColor(shipment.riskLevel);
  const status = statusConfig[shipment.status];
  return (
    <Link href={`/shipments/${shipment.id}`} className="block">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className="bg-card border border-border rounded-xl p-6 hover:border-border/80 transition-colors cursor-pointer space-y-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 text-base font-semibold text-foreground min-w-0">
            <span className="truncate">{shipment.origin}</span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            <span className="truncate">{shipment.destination}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={cn("w-2 h-2 rounded-full", status.dot)} />
            <span className={cn("text-sm font-medium", status.color)}>{status.label}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Risk</p>
            <p className={cn("text-2xl font-bold tabular-nums", riskColor)}>{shipment.riskScore}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">ETA</p>
            <p className="text-sm font-semibold text-foreground">{shipment.eta}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Route</p>
            <p className="text-sm font-semibold text-foreground">{shipment.routeName}</p>
          </div>
        </div>
        {shipment.predictiveAlert && (
          <div className="flex items-start gap-2.5 bg-amber-400/5 border border-amber-400/15 rounded-lg px-4 py-3">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-400/80 leading-relaxed">{shipment.predictiveAlert}</p>
          </div>
        )}
        <div className="flex items-center justify-between pt-4 border-t border-border/30">
          <span className="text-xs font-mono text-muted-foreground">{shipment.shipmentCode}</span>
          <span className="text-xs text-muted-foreground">{shipment.lastUpdate}</span>
        </div>
      </motion.div>
    </Link>
  );
}

// ─── Desktop row ──────────────────────────────────────────────────────────────
function ShipmentRow({ shipment, index }: { shipment: Shipment; index: number }) {
  const riskColor = getRiskColor(shipment.riskLevel);
  const status = statusConfig[shipment.status];
  return (
    <Link href={`/shipments/${shipment.id}`} className="block">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className="bg-card border border-border rounded-xl hover:border-border/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-6 px-7 py-5">
          {/* Route */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="truncate">{shipment.origin}</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              <span className="truncate">{shipment.destination}</span>
            </div>
            <p className="text-xs font-mono text-muted-foreground">{shipment.shipmentCode}</p>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 shrink-0 w-28">
            <div className={cn("w-2 h-2 rounded-full shrink-0", status.dot)} />
            <span className={cn("text-sm font-medium", status.color)}>{status.label}</span>
          </div>

          {/* Risk */}
          <div className="w-20 shrink-0 hidden sm:block space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Risk</p>
            <p className={cn("text-xl font-bold tabular-nums", riskColor)}>{shipment.riskScore}</p>
          </div>

          {/* ETA */}
          <div className="w-24 shrink-0 hidden md:block space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">ETA</p>
            <p className="text-sm font-semibold text-foreground">{shipment.eta}</p>
          </div>

          {/* Cargo */}
          <div className="flex-1 min-w-0 hidden lg:block space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Cargo</p>
            <p className="text-sm text-foreground truncate">{shipment.cargoType} · {shipment.vehicleType}</p>
          </div>

          {/* Alert */}
          {shipment.predictiveAlert && (
            <div className="hidden xl:flex items-start gap-2 max-w-56 shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400/80 truncate">{shipment.predictiveAlert}</p>
            </div>
          )}

          {/* Updated */}
          <div className="shrink-0 hidden sm:block">
            <p className="text-xs text-muted-foreground">{shipment.lastUpdate}</p>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
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
      || s.shipmentCode.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto w-full space-y-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 pb-8 border-b border-border">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Operations</p>
          <h1 className="text-3xl font-bold text-foreground">Shipments</h1>
          <p className="text-sm text-muted-foreground">{shipments.length} total records</p>
        </div>
        <Link href="/create-shipment">
          <Button className="gap-2 px-6 h-11 shrink-0 font-semibold rounded-lg">+ New Shipment</Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-lg">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by route or shipment code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11 h-11 text-sm bg-muted/20 border-border rounded-lg"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-11 bg-muted/20 gap-1 p-1 rounded-lg">
          {tabConfig.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-sm h-9 px-5 rounded-md">
              {t.label}
              <span className="ml-2 text-xs text-muted-foreground">
                {t.value === "all"
                  ? shipments.length
                  : shipments.filter((s) => s.status === t.value).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-8">
          {filtered.length === 0 ? (
            <div className="border border-border rounded-xl py-24 text-center">
              <p className="text-base text-muted-foreground">No shipments found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((s, i) => (
                <div key={s.id}>
                  <div className="sm:hidden"><ShipmentCard shipment={s} index={i} /></div>
                  <div className="hidden sm:block"><ShipmentRow shipment={s} index={i} /></div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
