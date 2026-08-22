"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Search,
  AlertTriangle,
  PlusSquare,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  ShieldAlert,
  RotateCcw,
  ArrowUpRight,
  ShieldCheck,
  Package,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { useStore } from "@/lib/store";
import { cn, getRiskColor, formatRelativeTime, getMeaningfulAlert } from "@/lib/utils";
import type { Shipment, ShipmentStatus, RiskLevel } from "@/lib/types";

const statusTabs: { value: ShipmentStatus | "all"; label: string }[] = [
  { value: "all",       label: "All Corridors" },
  { value: "active",    label: "Active" },
  { value: "at-risk",   label: "At Risk" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

type SortField = "lastUpdate" | "riskScore" | "eta" | "shipmentCode";

// ─── Mobile Card Component (< 640px) ─────────────────────────────────────────
function MobileShipmentCard({
  shipment,
  index,
}: {
  shipment: Shipment;
  index: number;
}) {
  const riskColor = getRiskColor(shipment.riskLevel);
  const isAtRisk = shipment.status === "at-risk";
  const isCompleted = shipment.status === "completed";
  const alertText = getMeaningfulAlert(shipment.predictiveAlert);

  return (
    <motion.div
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.15 }}
    >
      <Link href={`/shipments/${shipment.id}`} className="block">
        <div
          className={cn(
            "bg-card border border-border rounded-lg p-4 space-y-3.5 hover:border-primary/40 transition-colors cursor-pointer relative overflow-hidden",
            isAtRisk && "bg-[var(--sr-amber)]/[0.02] border-[var(--sr-amber)]/30"
          )}
        >
          {/* Left accent strip */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1",
              isAtRisk
                ? "bg-[var(--sr-amber)]"
                : isCompleted
                ? "bg-[var(--sr-emerald)]"
                : "bg-primary"
            )}
          />

          {/* Top row: ID, Status, Risk */}
          <div className="flex items-center justify-between gap-2 pl-2">
            <span className="font-mono text-xs font-semibold text-foreground">
              {shipment.shipmentCode}
            </span>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-bold tabular-nums", riskColor)}>
                Risk {shipment.riskScore}
              </span>
              <StatusBadge status={shipment.status} />
            </div>
          </div>

          {/* Route Corridor */}
          <div className="pl-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="truncate">{shipment.origin}</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              <span className="truncate">{shipment.destination}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {shipment.routeName || "Standard Corridor"} · {shipment.cargoType || "General Cargo"}
            </p>
          </div>

          {/* Alert if any */}
          {alertText && (
            <div className="flex items-start gap-2 bg-[var(--sr-amber)]/5 border border-[var(--sr-amber)]/20 rounded px-2.5 py-2 text-xs text-[var(--sr-amber)] ml-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p className="leading-snug text-[11px]">{alertText}</p>
            </div>
          )}

          {/* Footer: ETA and Last Update */}
          <div className="flex items-center justify-between pt-2.5 border-t border-border/40 text-[11px] text-muted-foreground pl-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>ETA: <strong className="text-foreground">{shipment.eta || "In Transit"}</strong></span>
              {shipment.confidencePercent ? (
                <span className="text-[10px] text-[var(--sr-steel)]">({shipment.confidencePercent}%)</span>
              ) : null}
            </div>
            <span>{formatRelativeTime(shipment.lastUpdate)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Primary Shipments Page ──────────────────────────────────────────────────
export default function ShipmentsPage() {
  const { state } = useStore();
  const { shipments, loading } = state;

  // Filter & Search State
  const [activeTab, setActiveTab] = useState<ShipmentStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [sortField, setSortField] = useState<SortField>("lastUpdate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Summary counts
  const counts = useMemo(() => {
    const total = shipments.length;
    const active = shipments.filter((s) => s.status === "active").length;
    const atRisk = shipments.filter((s) => s.status === "at-risk").length;
    const completed = shipments.filter((s) => s.status === "completed").length;
    const cancelled = shipments.filter((s) => s.status === "cancelled").length;
    return { total, active, atRisk, completed, cancelled };
  }, [shipments]);

  // Filter and Sort Pipeline
  const filteredShipments = useMemo(() => {
    return shipments
      .filter((s) => {
        // Status filter
        if (activeTab !== "all" && s.status !== activeTab) return false;

        // Risk filter
        if (riskFilter !== "all" && s.riskLevel !== riskFilter) return false;

        // Search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchOrigin = s.origin.toLowerCase().includes(query);
          const matchDest = s.destination.toLowerCase().includes(query);
          const matchCode = (s.shipmentCode ?? "").toLowerCase().includes(query);
          const matchCargo = (s.cargoType ?? "").toLowerCase().includes(query);
          const matchVehicle = (s.vehicleType ?? "").toLowerCase().includes(query);
          const matchRoute = (s.routeName ?? "").toLowerCase().includes(query);
          if (!matchOrigin && !matchDest && !matchCode && !matchCargo && !matchVehicle && !matchRoute) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const modifier = sortOrder === "asc" ? 1 : -1;
        if (sortField === "riskScore") {
          return (a.riskScore - b.riskScore) * modifier;
        }
        if (sortField === "shipmentCode") {
          return a.shipmentCode.localeCompare(b.shipmentCode) * modifier;
        }
        if (sortField === "eta") {
          return (a.eta || "").localeCompare(b.eta || "") * modifier;
        }
        // Default: lastUpdate timestamp
        const timeA = new Date(a.lastUpdate || a.createdAt || 0).getTime();
        const timeB = new Date(b.lastUpdate || b.createdAt || 0).getTime();
        return (timeA - timeB) * modifier;
      });
  }, [shipments, activeTab, riskFilter, searchQuery, sortField, sortOrder]);

  const hasActiveFilters = activeTab !== "all" || riskFilter !== "all" || searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setActiveTab("all");
    setRiskFilter("all");
    setSearchQuery("");
  };

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Loading state with table skeleton
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto w-full space-y-6 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="space-y-2">
            <div className="h-4 bg-muted/20 w-32 rounded" />
            <div className="h-7 bg-muted/20 w-48 rounded" />
            <div className="h-4 bg-muted/20 w-64 rounded" />
          </div>
          <div className="h-9 bg-muted/20 w-36 rounded-lg" />
        </div>
        <div className="h-10 bg-card border border-border rounded-lg" />
        <div className="h-[400px] bg-card border border-border rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">

      {/* ── 1. OPERATIONAL HEADER & QUICK COUNTS ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="flex h-2 w-2 rounded-full bg-primary" />
            <span>Operations Registry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            Shipments
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Monitor, locate, and inspect active and completed corridor dispatches across the enterprise.
          </p>
        </div>

        {/* Action Button */}
        <Link href="/create-shipment">
          <Button size="sm" className="gap-2 h-9 px-4 text-xs font-semibold shrink-0">
            <PlusSquare className="w-4 h-4" /> New Shipment
          </Button>
        </Link>
      </div>

      {/* ── 2. OPERATIONAL SUMMARY METRICS STRIP ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setActiveTab("all")}
          className={cn(
            "p-3 bg-card border rounded-lg cursor-pointer transition-all space-y-1",
            activeTab === "all" ? "border-primary bg-primary/5" : "border-border hover:border-border/80"
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Records
          </span>
          <p className="text-xl font-bold tabular-nums text-foreground">{counts.total}</p>
        </div>

        <div
          onClick={() => setActiveTab("active")}
          className={cn(
            "p-3 bg-card border rounded-lg cursor-pointer transition-all space-y-1",
            activeTab === "active" ? "border-primary bg-primary/5" : "border-border hover:border-border/80"
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Active Corridors
          </span>
          <p className="text-xl font-bold tabular-nums text-primary">{counts.active}</p>
        </div>

        <div
          onClick={() => setActiveTab("at-risk")}
          className={cn(
            "p-3 bg-card border rounded-lg cursor-pointer transition-all space-y-1",
            activeTab === "at-risk" ? "border-[var(--sr-amber)] bg-[var(--sr-amber)]/5" : "border-border hover:border-border/80"
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            At Risk
          </span>
          <p className={cn("text-xl font-bold tabular-nums", counts.atRisk > 0 ? "text-[var(--sr-amber)]" : "text-foreground")}>
            {counts.atRisk}
          </p>
        </div>

        <div
          onClick={() => setActiveTab("completed")}
          className={cn(
            "p-3 bg-card border rounded-lg cursor-pointer transition-all space-y-1",
            activeTab === "completed" ? "border-[var(--sr-emerald)] bg-[var(--sr-emerald)]/5" : "border-border hover:border-border/80"
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Completed
          </span>
          <p className="text-xl font-bold tabular-nums text-[var(--sr-emerald)]">{counts.completed}</p>
        </div>
      </div>

      {/* ── 3. SEARCH + FILTER CONTROL BAR ──────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-3 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-hidden">
            {statusTabs.map((tab) => {
              const count = tab.value === "all" ? counts.total : counts[tab.value as keyof typeof counts] ?? 0;
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground font-bold"
                        : "bg-muted/60 text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search and Secondary Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-0 w-full sm:w-64 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search code, corridor, cargo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs bg-muted/20 border-border rounded-md w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ×
                </button>
              )}
            </div>

            {/* Risk Filter Select */}
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as RiskLevel | "all")}
              aria-label="Filter by Risk Level"
              className="h-8 px-2.5 text-xs bg-muted/20 border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
              <option value="critical">Critical Risk</option>
            </select>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. PRIMARY OPERATIONAL SHIPMENT TABLE (DESKTOP & TABLET) ─────────── */}
      <div className="hidden sm:block bg-card border border-border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/15 border-b border-border">
            <TableRow className="hover:bg-transparent">
              {/* Code */}
              <TableHead
                className="w-36 cursor-pointer select-none text-muted-foreground hover:text-foreground"
                onClick={() => handleSortToggle("shipmentCode")}
              >
                <div className="flex items-center gap-1">
                  <span>Shipment ID</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </TableHead>

              {/* Corridor */}
              <TableHead className="min-w-[220px]">Corridor / Route</TableHead>

              {/* Status */}
              <TableHead className="w-32">Status</TableHead>

              {/* Risk */}
              <TableHead
                className="w-28 text-center cursor-pointer select-none text-muted-foreground hover:text-foreground"
                onClick={() => handleSortToggle("riskScore")}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Risk Score</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </TableHead>

              {/* ETA */}
              <TableHead
                className="w-32 cursor-pointer select-none text-muted-foreground hover:text-foreground"
                onClick={() => handleSortToggle("eta")}
              >
                <div className="flex items-center gap-1">
                  <span>ETA / Conf.</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </TableHead>

              {/* Cargo & Fleet */}
              <TableHead className="min-w-[160px] hidden md:table-cell">Cargo / Fleet</TableHead>

              {/* Threat Signal / Alert */}
              <TableHead className="min-w-[180px] hidden lg:table-cell">Threat Signal</TableHead>

              {/* Last Update */}
              <TableHead
                className="w-28 text-right cursor-pointer select-none text-muted-foreground hover:text-foreground"
                onClick={() => handleSortToggle("lastUpdate")}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Updated</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </TableHead>

              {/* Action */}
              <TableHead className="w-16 text-right pr-4"></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-border/20">
            {filteredShipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Package className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-sm font-semibold text-foreground">
                      {hasActiveFilters ? "No matching shipments found" : "No shipments recorded"}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      {hasActiveFilters
                        ? "Try adjusting your search query, status tab, or risk filter."
                        : "Create a shipment to start routing decisions and live corridor tracking."}
                    </p>
                    {hasActiveFilters ? (
                      <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-2 text-xs">
                        Clear all filters
                      </Button>
                    ) : (
                      <Link href="/create-shipment">
                        <Button size="sm" className="gap-2 mt-2 text-xs">
                          <PlusSquare className="w-3.5 h-3.5" /> Create Shipment
                        </Button>
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredShipments.map((s) => {
                const riskColor = getRiskColor(s.riskLevel);
                const isAtRisk = s.status === "at-risk";
                const isCompleted = s.status === "completed";
                const alertText = getMeaningfulAlert(s.predictiveAlert);

                return (
                  <TableRow
                    key={s.id}
                    className={cn(
                      "group hover:bg-muted/30 transition-colors cursor-pointer",
                      isAtRisk && "bg-[var(--sr-amber)]/[0.02]"
                    )}
                  >
                    {/* Shipment Code with status dot */}
                    <TableCell className="font-mono text-xs font-semibold py-3">
                      <Link href={`/shipments/${s.id}`} className="flex items-center gap-2 text-foreground group-hover:text-primary transition-colors">
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            isAtRisk
                              ? "bg-[var(--sr-amber)]"
                              : isCompleted
                              ? "bg-[var(--sr-emerald)]"
                              : "bg-primary"
                          )}
                        />
                        <span>{s.shipmentCode}</span>
                      </Link>
                    </TableCell>

                    {/* Corridor */}
                    <TableCell className="py-3">
                      <Link href={`/shipments/${s.id}`} className="block space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <span className="truncate max-w-[130px] lg:max-w-[180px]">{s.origin}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                          <span className="truncate max-w-[130px] lg:max-w-[180px]">{s.destination}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                          {s.routeName || "Standard Corridor"}
                        </p>
                      </Link>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      <StatusBadge status={s.status} />
                    </TableCell>

                    {/* Risk Score */}
                    <TableCell className="text-center py-3">
                      <div className="inline-flex flex-col items-center">
                        <span className={cn("text-sm font-bold tabular-nums leading-none", riskColor)}>
                          {s.riskScore}
                        </span>
                        <span className={cn("text-[9px] uppercase tracking-wider font-semibold mt-0.5", riskColor)}>
                          {s.riskLevel}
                        </span>
                      </div>
                    </TableCell>

                    {/* ETA & Confidence */}
                    <TableCell className="py-3">
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-foreground truncate">{s.eta || "In Transit"}</p>
                        {s.confidencePercent ? (
                          <p className="text-[10px] text-[var(--sr-steel)]">
                            {s.confidencePercent}% confidence
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">Estimated</p>
                        )}
                      </div>
                    </TableCell>

                    {/* Cargo / Fleet */}
                    <TableCell className="hidden md:table-cell py-3">
                      <div className="space-y-0.5 text-xs">
                        <p className="text-foreground font-medium truncate max-w-[140px]">{s.cargoType || "General Cargo"}</p>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{s.vehicleType || "Standard Fleet"}</p>
                      </div>
                    </TableCell>

                    {/* Threat Signal / Alert */}
                    <TableCell className="hidden lg:table-cell py-3">
                      {alertText ? (
                        <div className="flex items-center gap-1.5 text-xs text-[var(--sr-amber)] max-w-[200px]">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate text-[11px] font-medium">{alertText}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-[var(--sr-steel)]">
                          <ShieldCheck className="w-3.5 h-3.5 text-[var(--sr-emerald)]/70" />
                          <span className="text-[11px]">Nominal</span>
                        </div>
                      )}
                    </TableCell>

                    {/* Last Update */}
                    <TableCell className="text-right py-3 text-xs text-muted-foreground">
                      {formatRelativeTime(s.lastUpdate)}
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-right pr-4 py-3">
                      <Link
                        href={`/shipments/${s.id}`}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
                        title="Inspect Shipment"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Table Footer */}
        <div className="px-4 py-2.5 border-t border-border bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filteredShipments.length}</strong> of{" "}
            <strong className="text-foreground">{shipments.length}</strong> total shipments
          </span>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">Click any row to inspect route intelligence and execution logs</span>
          </div>
        </div>
      </div>

      {/* ── 5. MOBILE SHIPMENTS FEED (< 640px) ──────────────────────────────── */}
      <div className="sm:hidden space-y-3">
        {filteredShipments.length === 0 ? (
          <div className="border border-border rounded-lg p-8 text-center bg-card space-y-3">
            <Package className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-semibold text-foreground">No matching shipments</p>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters ? "Try clearing active filters." : "Create a shipment to begin."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="text-xs">
                Reset filters
              </Button>
            )}
          </div>
        ) : (
          filteredShipments.map((s, i) => (
            <MobileShipmentCard key={s.id} shipment={s} index={i} />
          ))
        )}
      </div>

    </div>
  );
}
