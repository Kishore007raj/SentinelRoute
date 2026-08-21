"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  PlusSquare,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Building2,
  ShieldCheck,
  Zap,
  Activity,
  Truck,
  MapPin,
  Clock,
  Radio,
  ExternalLink,
  ShieldAlert,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { useStore } from "@/lib/store";
import { useCompany } from "@/lib/company-context";
import { useIntelligence } from "@/hooks/use-intelligence";
import { cn, getRiskColor, formatRelativeTime, getMeaningfulAlert } from "@/lib/utils";
import Link from "next/link";
import type { Shipment } from "@/lib/types";
import { OperationalFeed } from "@/components/operational/OperationalFeed";

// Dynamically import RouteMapView to avoid Leaflet SSR issues
const RouteMapView = dynamic(
  () => import("@/components/shipment/RouteMapView").then((m) => m.RouteMapView),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] bg-card border border-border rounded-lg flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground font-mono">
        <Activity className="w-5 h-5 text-primary animate-spin" />
        <span>INITIALIZING ROUTE INTELLIGENCE MAP...</span>
      </div>
    ),
  }
);

// ─── Compact Shipment Row for Operations Surface ─────────────────────────────
function OperationalShipmentRow({
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
      transition={{ delay: index * 0.03, duration: 0.18 }}
    >
      <Link href={`/shipments/${shipment.id}`} className="block">
        <div
          className={cn(
            "group relative flex items-stretch border-b border-border/40 bg-card hover:bg-muted/30 transition-all duration-150 cursor-pointer overflow-hidden",
            isAtRisk && "bg-[var(--sr-amber)]/[0.02]"
          )}
        >
          {/* Status color indicator bar */}
          <div
            className={cn(
              "w-1 shrink-0 transition-colors",
              isAtRisk
                ? "bg-[var(--sr-amber)]"
                : isCompleted
                ? "bg-[var(--sr-emerald)]"
                : "bg-primary"
            )}
          />

          {/* ── Mobile layout: stacked ──────────────────────────── */}
          <div className="sm:hidden flex-1 min-w-0 px-4 py-3">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground min-w-0">
                  <span className="truncate">{shipment.origin}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                  <span className="truncate">{shipment.destination}</span>
                </div>
                <p className="text-[11px] font-mono text-foreground/70 whitespace-nowrap">{shipment.shipmentCode}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={cn("text-base font-bold tabular-nums leading-none", riskColor)}>{shipment.riskScore}</p>
                <p className={cn("text-[9px] uppercase tracking-widest font-semibold", riskColor)}>{shipment.riskLevel}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-muted-foreground">{shipment.eta || "In Transit"}</span>
              <StatusBadge status={isAtRisk ? "at-risk" : isCompleted ? "completed" : "active"} />
            </div>
            {alertText && (
              <div className="flex items-start gap-2 mt-2 pt-2 border-t border-border/30 text-xs text-[var(--sr-amber)]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p className="leading-snug text-[11px] font-medium">{alertText}</p>
              </div>
            )}
          </div>

          {/* ── Desktop layout: 4-column grid ──────────────────── */}
          <div
            className="hidden sm:grid flex-1 min-w-0 items-start py-3.5 px-4"
            style={{ gridTemplateColumns: "1fr 3.5rem 6rem 7rem" }}
          >
            {/* Col 1: Corridor / Cargo */}
            <div className="min-w-0 space-y-1 pr-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground min-w-0">
                <span className="truncate min-w-0">{shipment.origin}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                <span className="truncate min-w-0">{shipment.destination}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                <span className="font-mono text-foreground/70 whitespace-nowrap shrink-0">{shipment.shipmentCode}</span>
                {shipment.cargoType && (
                  <>
                    <span className="shrink-0">·</span>
                    <span className="truncate">{shipment.cargoType}</span>
                  </>
                )}
                {shipment.vehicleType && (
                  <>
                    <span className="shrink-0 hidden md:inline">·</span>
                    <span className="truncate hidden md:inline">{shipment.vehicleType}</span>
                  </>
                )}
              </div>
              {alertText && (
                <div className="flex items-start gap-1.5 pt-1.5 text-[11px] text-[var(--sr-amber)]">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  <p className="leading-snug font-medium">{alertText}</p>
                </div>
              )}
            </div>

            {/* Col 2: Risk */}
            <div className="text-center pt-0.5">
              <p className={cn("text-lg font-bold tabular-nums leading-none", riskColor)}>
                {shipment.riskScore}
              </p>
              <p className={cn("text-[9px] uppercase tracking-widest font-semibold mt-0.5", riskColor)}>
                {shipment.riskLevel}
              </p>
            </div>

            {/* Col 3: ETA */}
            <div className="text-right pt-0.5">
              <p className="text-xs font-semibold text-foreground whitespace-nowrap">{shipment.eta || "In Transit"}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                {formatRelativeTime(shipment.lastUpdate)}
              </p>
            </div>

            {/* Col 4: Status */}
            <div className="flex items-start justify-end gap-1.5 pt-0.5">
              <StatusBadge status={isAtRisk ? "at-risk" : isCompleted ? "completed" : "active"} />
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors mt-0.5 shrink-0" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Dashboard Page Component ────────────────────────────────────────────────
export default function DashboardPage() {
  const { state, activeShipments, completedShipments, atRiskShipments } = useStore();
  const { company, isSuperAdmin } = useCompany();
  const { shipments, loading: storeLoading } = state;
  const router = useRouter();
  
  // Realtime Intelligence hook
  const { kpis, alerts } = useIntelligence({ fetchKpis: true, fetchAlerts: true });
  const loading = storeLoading;

  // Tab filter for shipment list
  const [feedFilter, setFeedFilter] = useState<"all" | "active" | "at-risk" | "completed">("active");

  useEffect(() => {
    if (isSuperAdmin) {
      router.replace("/admin/companies");
    }
  }, [isSuperAdmin, router]);

  // Aggregated operational calculations from backend
  const { totalShipments, avgRisk, highRiskAvoided, activeCount, atRiskCount, completedCount } = useMemo(() => {
    if (state.shipmentStats) {
      return {
        totalShipments: state.shipmentStats.total,
        avgRisk: state.shipmentStats.avgRisk,
        highRiskAvoided: state.shipmentStats.highRiskAvoided,
        activeCount: state.shipmentStats.active,
        atRiskCount: state.shipmentStats.atRisk,
        completedCount: state.shipmentStats.completed
      };
    }
    // Fallback if stats aren't loaded
    return {
      totalShipments: 0,
      avgRisk: 0,
      highRiskAvoided: 0,
      activeCount: 0,
      atRiskCount: 0,
      completedCount: 0
    };
  }, [state.shipmentStats]);

  // Filtered shipments based on active tab
  const filteredShipments = useMemo(() => {
    switch (feedFilter) {
      case "active":
        return activeShipments;
      case "at-risk":
        return atRiskShipments;
      case "completed":
        return completedShipments;
      case "all":
      default:
        return shipments;
    }
  }, [feedFilter, activeShipments, atRiskShipments, completedShipments, shipments]);

  // Loading skeleton matching command surface
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto w-full space-y-6 animate-pulse">
        <div className="h-16 bg-card border border-border rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-20 bg-card border border-border rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[380px] bg-card border border-border rounded-lg" />
          <div className="h-[380px] bg-card border border-border rounded-lg" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 h-72 bg-card border border-border rounded-lg" />
          <div className="h-72 bg-card border border-border rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">

      {/* ── 1. OPERATIONAL CONTEXT & TENANT HEADER ──────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="flex h-2 w-2 rounded-full bg-primary" />
            <span>OPERATIONS OVERVIEW</span>
            {company && (
              <>
                <span className="text-border">|</span>
                <span className="text-foreground">{company.companyName}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            Logistics Control Room
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            <span className="text-foreground font-medium">{activeCount}</span> active corridors
            {" · "}
            <span className={cn("font-medium", atRiskCount > 0 ? "text-[var(--sr-amber)]" : "text-[var(--sr-emerald)]")}>
              {atRiskCount > 0 ? `${atRiskCount} require attention` : "0 critical deviations"}
            </span>
            {" · "}
            <span>Network Risk: </span>
            <span className="font-mono text-foreground font-semibold">{avgRisk}/100</span>
          </p>
        </div>

        {/* Action button cluster */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/command-center">
            <Button variant="outline" size="sm" className="gap-2 h-9 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5 text-primary" /> Command Center
            </Button>
          </Link>
          <Link href="/fleet-ops">
            <Button variant="outline" size="sm" className="gap-2 h-9 text-xs font-semibold">
              <Truck className="w-3.5 h-3.5 text-[var(--sr-steel)]" /> Fleet Ops
            </Button>
          </Link>
          <Link href="/create-shipment">
            <Button size="sm" className="gap-2 h-9 text-xs font-semibold">
              <PlusSquare className="w-4 h-4" /> New Shipment
            </Button>
          </Link>
        </div>
      </div>

      {/* ── 2. COMPACT OPERATIONAL TELEMETRY STRIP ──────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Active Shipments */}
        <div className="bg-card border border-border rounded-lg p-3.5 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Active Fleet
          </p>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {activeCount}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {totalShipments} total recorded
          </p>
        </div>

        {/* At-Risk Shipments */}
        <div className="bg-card border border-border rounded-lg p-3.5 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Threat Status
          </p>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums",
              atRiskCount > 0 ? "text-[var(--sr-danger)]" : "text-[var(--sr-emerald)]"
            )}
          >
            {atRiskCount}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {atRiskCount > 0 ? "Requires review" : "Nominal flow"}
          </p>
        </div>

        {/* Network Risk Score */}
        <div className="bg-card border border-border rounded-lg p-3.5 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Network Risk
          </p>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums",
              avgRisk > 60 ? "text-[var(--sr-danger)]" : avgRisk > 35 ? "text-[var(--sr-amber)]" : "text-[var(--sr-emerald)]"
            )}
          >
            {avgRisk}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {avgRisk < 35 ? "Safe parameters" : avgRisk < 60 ? "Elevated risk" : "High disruption"}
          </p>
        </div>

        {/* Risk Avoidance Intelligence */}
        <div className="bg-card border border-border rounded-lg p-3.5 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Risk Avoided
          </p>
          <p className="text-2xl font-bold tabular-nums text-[var(--sr-emerald)]">
            {highRiskAvoided}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            Via rerouting
          </p>
        </div>

        {/* Live MongoDB ETA Confidence */}
        <div className="bg-card border border-border rounded-lg p-3.5 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            ETA Confidence
          </p>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums",
              (kpis?.avgEtaConfidence ?? 100) < 70 ? "text-[var(--sr-amber)]" : "text-[var(--sr-emerald)]"
            )}
          >
            {kpis ? `${kpis.avgEtaConfidence}%` : "94%"}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {kpis?.basedOnPredictions ? `${kpis.basedOnPredictions} AI models` : "Live telemetry"}
          </p>
        </div>

        {/* Active Disruptions & Incidents */}
        <div className="bg-card border border-border rounded-lg p-3.5 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Disruptions
          </p>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums",
              (kpis?.openIncidents ?? 0) > 0 ? "text-[var(--sr-amber)]" : "text-foreground"
            )}
          >
            {kpis ? kpis.openIncidents : 0}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {kpis ? `${kpis.activeAlerts} active alerts` : "Corridor events"}
          </p>
        </div>
      </div>

      {/* ── 3. LIVE ROUTE INTELLIGENCE & ATTENTION SECTION ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Live Operations Map Centerpiece (2 Cols) */}
        <div className="lg:col-span-2 flex flex-col bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/10">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Active Fleet Corridors
              </span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                · Live GPS & Risk Telemetry
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/route-intelligence" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                <span>Route Intelligence</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="relative flex-1 min-h-[360px]">
            <RouteMapView isGlobal={true} />
          </div>
        </div>

        {/* Attention Required Panel (1 Col) */}
        <div className="flex flex-col bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/10">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--sr-amber)]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Attention Required
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              {atRiskCount} ITEM{atRiskCount === 1 ? "" : "S"}
            </span>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-[380px] space-y-3">
            {atRiskShipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-2">
                <div className="w-10 h-10 rounded-full bg-[var(--sr-emerald)]/10 border border-[var(--sr-emerald)]/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-[var(--sr-emerald)]" />
                </div>
                <p className="text-sm font-semibold text-foreground">All Operations Nominal</p>
                <p className="text-xs text-muted-foreground max-w-[220px]">
                  Zero critical bottlenecks or active corridor warnings detected.
                </p>
              </div>
            ) : (
              atRiskShipments.map((s) => {
                const alertMsg = getMeaningfulAlert(s.predictiveAlert);
                return (
                  <div
                    key={s.id}
                    className="p-3.5 bg-muted/20 border border-border/80 rounded-lg space-y-2.5 hover:border-[var(--sr-amber)]/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {s.shipmentCode}
                      </span>
                      <Badge
                        variant="destructive"
                        className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5"
                      >
                        Risk {s.riskScore} · {s.riskLevel}
                      </Badge>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {s.origin} → {s.destination}
                      </p>
                      {alertMsg ? (
                        <p className="text-[11px] text-[var(--sr-amber)] mt-1 leading-snug">
                          {alertMsg}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Elevated route variance detected. Review alternative corridors.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px]">
                      <span className="text-muted-foreground">ETA: {s.eta}</span>
                      <Link
                        href={`/shipments/${s.id}`}
                        className="text-primary font-semibold hover:underline flex items-center gap-1"
                      >
                        <span>Inspect</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}

            {/* Live system alerts from MongoDB intelligence if available */}
            {alerts && alerts.length > 0 && atRiskCount > 0 && (
              <div className="pt-2 border-t border-border/30">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  System Threat Signals
                </p>
                <div className="space-y-2">
                  {alerts.slice(0, 2).map((a) => (
                    <div key={a.alertId} className="p-2.5 bg-muted/10 border border-border/40 rounded text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground text-[11px]">{a.reason}</span>
                        <span className="text-[10px] text-muted-foreground">{formatRelativeTime(a.timestamp)}</span>
                      </div>
                      {a.recommendedAction && (
                        <p className="text-[10px] text-primary/90">{a.recommendedAction}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. OPERATIONAL SHIPMENT FEED & WORKFLOW DECISIONS ──────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left Column: Active Shipments Feed (2 Cols) */}
        <div className="xl:col-span-2 flex flex-col bg-card border border-border rounded-lg overflow-hidden">
          
          {/* Feed Header with Navigation Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/10">
            <div>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Corridor Deployments
              </h2>
              <p className="text-xs text-muted-foreground">
                Showing {filteredShipments.length} recorded movements
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-muted/30 p-1 border border-border rounded-md text-xs">
              <button
                onClick={() => setFeedFilter("active")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                  feedFilter === "active"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Active ({activeCount})
              </button>
              <button
                onClick={() => setFeedFilter("at-risk")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                  feedFilter === "at-risk"
                    ? "bg-[var(--sr-amber)] text-[var(--background)] font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                At Risk ({atRiskCount})
              </button>
              <button
                onClick={() => setFeedFilter("completed")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                  feedFilter === "completed"
                    ? "bg-secondary text-secondary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Completed ({completedCount})
              </button>
              <button
                onClick={() => setFeedFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                  feedFilter === "all"
                    ? "bg-secondary text-secondary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All ({totalShipments})
              </button>
            </div>
          </div>

          {/* Table Header Columns */}
          <div className="hidden sm:grid items-center border-b border-border/50 bg-muted/20 px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
            style={{ gridTemplateColumns: "1fr 3.5rem 6rem 7rem" }}>
            <span>Corridor / Cargo</span>
            <span className="text-center">Risk</span>
            <span className="text-right">ETA</span>
            <span className="text-right pr-6">Status</span>
          </div>

          {/* Shipment rows */}
          <div className="divide-y divide-border/20 overflow-y-auto flex-1 min-h-[280px]">
            {filteredShipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center px-6">
                <Truck className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">No shipments in this view</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {feedFilter === "at-risk"
                    ? "No shipments are currently flagged for risk deviations."
                    : "Create a shipment to start route tracking."}
                </p>
                {feedFilter !== "at-risk" && (
                  <Link href="/create-shipment">
                    <Button size="sm" className="gap-2 mt-2">
                      <PlusSquare className="w-4 h-4" /> Create Shipment
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              filteredShipments.map((s, i) => (
                <OperationalShipmentRow key={s.id} shipment={s} index={i} />
              ))
            )}
          </div>

          <div className="p-3 border-t border-border bg-muted/5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Total Managed Corridors: {totalShipments}
            </span>
            <Link
              href="/shipments"
              className="text-primary hover:underline font-medium flex items-center gap-1"
            >
              <span>Full Shipments Registry</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Right Column: Operational Decision Feed & Insights (1 Col) */}
        <div className="flex flex-col space-y-6">
          {/* Operational Feed & AI Recommendations Component */}
          <OperationalFeed />

          {/* Recent Routing Decisions & Strategy Breakdown */}
          <DashboardCard title="Recent Routing Decisions" icon={Activity}>
            <div className="divide-y divide-border/30">
              {shipments.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2.5">
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <span className="text-xs font-mono font-medium text-foreground block truncate">
                      {s.shipmentCode}
                    </span>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {s.origin} → {s.destination}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded border text-[10px] uppercase tracking-wider inline-block",
                        s.selectedRoute === "balanced"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : s.selectedRoute === "fastest"
                          ? "bg-[var(--sr-amber)]/10 text-[var(--sr-amber)] border-[var(--sr-amber)]/20"
                          : "bg-[var(--sr-emerald)]/10 text-[var(--sr-emerald)] border-[var(--sr-emerald)]/20"
                      )}
                    >
                      {s.routeName || s.selectedRoute || "Standard"}
                    </span>
                  </div>
                </div>
              ))}

              {shipments.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No recent routing decisions.
                </p>
              )}
            </div>
          </DashboardCard>
        </div>
      </div>

    </div>
  );
}
