"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Zap,
  Clock,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { mockShipments } from "@/lib/mock-data";
import { cn, getRiskColor } from "@/lib/utils";
import type { Shipment, ShipmentStatus } from "@/lib/mock-data";

const tabConfig: {
  value: ShipmentStatus | "all";
  label: string;
  count?: number;
}[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "at-risk", label: "At Risk" },
  { value: "completed", label: "Completed" },
];

const statusIcon = {
  active: <Zap className="w-3 h-3 text-primary" />,
  "at-risk": <AlertTriangle className="w-3 h-3 text-amber-400" />,
  completed: <CheckCircle className="w-3 h-3 text-emerald-400" />,
  pending: <Clock className="w-3 h-3 text-muted-foreground" />,
};

const statusColor: Record<ShipmentStatus, string> = {
  active: "text-primary border-primary/30 bg-primary/10",
  "at-risk": "text-amber-400 border-amber-400/30 bg-amber-400/10",
  completed: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  pending: "text-muted-foreground border-border bg-muted/30",
};

function ShipmentRow({
  shipment,
  index,
}: {
  shipment: Shipment;
  index: number;
}) {
  return (
    <Link href={`/shipments/${shipment.id}`} className="block">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className="panel p-4 hover:border-border/80 hover:shadow-md hover:shadow-black/15 transition-all duration-200 cursor-pointer group"
      >
        <div className="flex items-center gap-4">
          {/* Route */}
          <div className="flex items-center gap-2 min-w-0 w-48 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <span className="truncate">{shipment.origin}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="truncate">{shipment.destination}</span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                {shipment.shipmentCode}
              </p>
            </div>
          </div>

          {/* Status */}
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] shrink-0 border",
              statusColor[shipment.status],
            )}
          >
            {statusIcon[shipment.status]}
            <span className="ml-1 capitalize">
              {shipment.status.replace("-", " ")}
            </span>
          </Badge>

          {/* Risk */}
          <div className="w-24 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="label-meta">Risk</span>
              <span
                className={cn(
                  "text-xs font-bold",
                  getRiskColor(shipment.riskLevel),
                )}
              >
                {shipment.riskScore}
              </span>
            </div>
            <Progress value={shipment.riskScore} className="h-1" />
          </div>

          {/* ETA */}
          <div className="w-20 shrink-0 hidden md:block">
            <p className="label-meta mb-0.5">ETA</p>
            <p className="text-xs font-semibold text-foreground">
              {shipment.eta}
            </p>
          </div>

          {/* Cargo */}
          <div className="flex-1 min-w-0 hidden xl:block">
            <p className="label-meta mb-0.5">Cargo</p>
            <p className="text-xs text-foreground truncate">
              {shipment.cargoType} · {shipment.vehicleType}
            </p>
          </div>

          {/* Alert */}
          {shipment.predictiveAlert && (
            <div className="flex items-start gap-1.5 max-w-48 hidden lg:flex">
              <AlertTriangle className="w-2.5 h-2.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-400/80 leading-relaxed truncate">
                {shipment.predictiveAlert}
              </p>
            </div>
          )}

          {/* Updated */}
          <div className="w-20 shrink-0 text-right hidden sm:block">
            <p className="text-[10px] text-muted-foreground">
              {shipment.lastUpdate}
            </p>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function ShipmentsPage() {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = mockShipments.filter((s) => {
    const matchesTab = tab === "all" || s.status === tab;
    const matchesSearch =
      !search ||
      s.origin.toLowerCase().includes(search.toLowerCase()) ||
      s.destination.toLowerCase().includes(search.toLowerCase()) ||
      s.shipmentCode.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Shipments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mockShipments.length} total shipment records
          </p>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5">
          + New Shipment
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by route or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-muted/30 border-border"
          />
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <Filter className="w-3 h-3" /> Filter
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8 mb-4 bg-muted/30">
          {tabConfig.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="text-xs h-7 px-3"
            >
              {t.label}
              <Badge
                variant="secondary"
                className="ml-1.5 text-[10px] px-1 py-0 h-4 min-w-[18px]"
              >
                {t.value === "all"
                  ? mockShipments.length
                  : mockShipments.filter((s) => s.status === t.value).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-0">
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="panel py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No shipments found
                </p>
              </div>
            ) : (
              filtered.map((s, i) => (
                <ShipmentRow key={s.id} shipment={s} index={i} />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
