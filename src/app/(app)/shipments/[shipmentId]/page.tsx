"use client";
import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, MapPin, Clock, Truck, Package, CheckCircle, XCircle,
  User, FileText, AlertTriangle, RefreshCw, ShieldCheck, Activity,
  Navigation, CloudRain, MessageSquare, Shield, Radio, ChevronRight,
  Layers, TrendingDown, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { useCompany } from "@/lib/company-context";
import { useUser } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

const RouteMapView = dynamic(
  () => import("@/components/shipment/RouteMapView").then((m) => m.RouteMapView),
  { ssr: false }
);

const DecisionWorkspace = dynamic(
  () => import("@/components/operational/DecisionWorkspace").then((m) => m.DecisionWorkspace),
  { ssr: false }
);

const RouteReplayMap = dynamic(
  () => import("@/components/shipment/RouteReplayMap").then((m) => m.RouteReplayMap),
  { ssr: false }
);

import { getRiskColor, cn, formatRelativeTime, getMeaningfulAlert } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { ShipmentTimelineEvent } from "@/lib/types";
import type { Shipment, ShipmentExecution } from "@/lib/types";
import { ShipmentRiskPanel } from "@/components/shipment/ShipmentRiskPanel";
import { ShipmentTimeline } from "@/components/shipment/ShipmentTimeline";
import { ShipmentCommunication } from "@/components/shipment/ShipmentCommunication";
import { ShipmentAssignment } from "@/components/shipment/ShipmentAssignment";

// ─── Audit tab ────────────────────────────────────────────────────────────────

function ShipmentAuditTab({ shipmentId, companyId }: { shipmentId: string; companyId?: string }) {
  const { user } = useUser();
  const [events, setEvents]   = useState<ShipmentTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const token = await user.getIdToken();
        const query = companyId ? `?companyId=${companyId}` : "";
        const res = await fetch(
          `/api/intelligence/shipments/${shipmentId}/timeline${query}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setEvents(data.timeline ?? []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [shipmentId, companyId, user]);

  const getIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("creat") || t.includes("dispatch")) return <Navigation className="w-3.5 h-3.5 text-emerald-400" />;
    if (t.includes("risk") && t.includes("increas")) return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
    if (t.includes("risk") && t.includes("reduc")) return <Activity className="w-3.5 h-3.5 text-emerald-400" />;
    if (t.includes("weather")) return <CloudRain className="w-3.5 h-3.5 text-blue-400" />;
    if (t.includes("complete")) return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    if (t.includes("cancel")) return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    if (t.includes("message") || t.includes("communication")) return <MessageSquare className="w-3.5 h-3.5 text-primary" />;
    return <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  if (loading) return (
    <div className="panel p-8 text-sm text-muted-foreground flex items-center gap-3">
      <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin shrink-0" />
      Loading audit trail…
    </div>
  );
  if (events.length === 0) return (
    <div className="panel p-8 text-sm text-muted-foreground text-center">No audit events recorded yet.</div>
  );

  return (
    <div className="panel p-6 space-y-1">
      <p className="label-meta mb-5 flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5" /> Audit Trail
      </p>
      <div className="space-y-0 divide-y divide-border/40">
        {events.map((ev) => (
          <div key={ev.eventId} className="flex items-start gap-4 py-4">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted/30 border border-border/50 shrink-0 mt-0.5">
              {getIcon(ev.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{ev.type}</p>
                <p className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                  {new Date(ev.timestamp).toLocaleString([], {
                    month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ev.description}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-[10px] px-2 py-0.5 bg-muted/30 border border-border/50 rounded-full text-muted-foreground">
                  {ev.source}
                </span>
                {ev.confidence !== undefined && ev.confidence < 100 && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {ev.confidence}% confidence
                  </span>
                )}
                {(ev.affectedMetrics?.length ?? 0) > 0 && (
                  <span className="text-[10px] text-muted-foreground/60">
                    affects: {ev.affectedMetrics!.join(", ")}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cancel dialog ────────────────────────────────────────────────────────────

function CancelDialog({
  open,
  onOpenChange,
  onConfirm,
  submitting,
}: {
  open:         boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm:    (reason: string) => void;
  submitting:   boolean;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Shipment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            This will move the shipment to Cancelled status. All timeline and audit events will be preserved.
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Reason <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              placeholder="e.g. Client requested cancellation"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-10 bg-muted/20 border-border text-sm"
              disabled={submitting}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={submitting} />}>
            Keep Shipment
          </DialogClose>
          <Button
            className="bg-red-600 hover:bg-red-500 text-white"
            onClick={() => onConfirm(reason)}
            disabled={submitting}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Cancelling…
              </span>
            ) : (
              "Confirm Cancellation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Risk bar row ─────────────────────────────────────────────────────────────

function RiskBar({ label, value }: { label: string; value: number }) {
  const color = value > 60 ? "bg-red-400" : value > 35 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="flex items-center gap-4">
      <span className="text-xs text-muted-foreground w-36 shrink-0 capitalize">
        {label === "cargoSensitivity" ? "Cargo Sensitivity" : label}
      </span>
      <div className="flex-1 h-1.5 bg-muted overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-6 text-right tabular-nums">{value}</span>
    </div>
  );
}

// ─── Stat cell ────────────────────────────────────────────────────────────────

function StatCell({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="label-meta">{label}</p>
      <p className={cn("text-sm font-semibold text-foreground", mono && "font-mono")}>{value}</p>
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  shipment,
  onComplete,
  onOpenCancel,
  onAssigned,
  isCrossCompany,
  execution,
}: {
  shipment: Shipment;
  onComplete:   () => void;
  onOpenCancel: () => void;
  onAssigned:   (updated: Shipment) => void;
  isCrossCompany: boolean;
  execution?: ShipmentExecution | null;
}) {
  const { t } = useI18n();
  const hasBreakdown = !!shipment.riskBreakdown;
  const breakdown = shipment.riskBreakdown ?? { traffic: 0, weather: 0, disruption: 0, cargoSensitivity: 0 };
  const riskColor = getRiskColor(shipment.riskLevel);

  const routeForMap = {
    id:            shipment.id,
    label:         shipment.selectedRoute,
    name:          shipment.routeName,
    eta:           shipment.eta,
    etaMinutes:    0,
    distance:      shipment.distance,
    distanceKm:    parseFloat(shipment.distance) || 0,
    riskScore:     shipment.riskScore,
    riskLevel:     shipment.riskLevel,
    recommended:   false,
    summary:       "",
    alerts:        shipment.predictiveAlert ? [shipment.predictiveAlert] : [],
    riskBreakdown: breakdown,
    geometry:      shipment.geometry ?? undefined,
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_minmax(320px,_400px)] min-w-0">
      {/* ── LEFT COLUMN (65-70%) ────────────────────────────────────────── */}
      <div className="space-y-5 min-w-0">

        {/* OPERATIONAL SNAPSHOT — PRIMARY CONTENT */}
        <div className="panel p-6">
          <p className="label-meta mb-5 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary" /> Operational Snapshot
          </p>

          {/* Primary KPIs */}
          <div className="grid grid-cols-2 gap-5 mb-6">
            <div className="space-y-1.5">
              <p className="label-meta">{t("logistics.eta")}</p>
              <p className="text-2xl font-bold text-foreground tracking-tight">{shipment.eta}</p>
            </div>
            <div className="space-y-1.5">
              <p className="label-meta">{t("logistics.riskScore")}</p>
              <p className={cn("text-2xl font-bold tracking-tight", riskColor)}>
                {shipment.riskScore}
                <span className="text-sm font-normal text-muted-foreground ml-1.5 capitalize">/ {shipment.riskLevel}</span>
              </p>
            </div>
          </div>

          <Separator className="mb-5 opacity-30" />

          {/* Origin → Destination */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm text-muted-foreground mb-5">
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 shrink-0 text-primary/70" />
              <span className="truncate font-medium text-foreground/80">{shipment.origin} → {shipment.destination}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{t("shipmentDetail.updated")} {formatRelativeTime(shipment.lastUpdate)}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Package className="w-4 h-4 shrink-0" />
              <span>{shipment.cargoType}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Truck className="w-4 h-4 shrink-0" />
              <span>{shipment.vehicleType}</span>
            </div>
          </div>

          <Separator className="mb-5 opacity-30" />

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCell label={t("logistics.distance")} value={shipment.distance} />
            <StatCell label={t("logistics.confidence")} value={`${shipment.confidencePercent}%`} />
            <StatCell label={t("logistics.departure")} value={shipment.departureTime} />
            <StatCell label={t("logistics.shipmentCode")} value={shipment.shipmentCode} mono />
            {shipment.priority && <StatCell label="Priority" value={shipment.priority} />}
            {shipment.deadline && (
              <StatCell label="Deadline" value={new Date(shipment.deadline).toLocaleDateString()} />
            )}
          </div>

          {/* Alert banner */}
          {getMeaningfulAlert(shipment.predictiveAlert) && (
            <>
              <Separator className="my-5 opacity-30" />
              <div className="flex items-start gap-3 bg-amber-400/5 border border-amber-400/25 rounded-lg px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-400/90 leading-relaxed">{getMeaningfulAlert(shipment.predictiveAlert)}</p>
              </div>
            </>
          )}
        </div>

        {/* NEWS/ALERT BANNER — if present */}
        {getMeaningfulAlert(shipment.predictiveAlert) && !shipment.riskBreakdown && (
          <div className="flex items-start gap-3 bg-amber-400/5 border border-amber-400/25 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-400/90 leading-relaxed">{getMeaningfulAlert(shipment.predictiveAlert)}</p>
          </div>
        )}

        {/* CREW & VEHICLE ASSIGNMENT */}
        {!isCrossCompany && (
          <ShipmentAssignment shipment={shipment} onAssigned={onAssigned} />
        )}
        {isCrossCompany && (shipment.assignedDriverName || shipment.assignedVehicleNumber) && (
          <div className="panel p-6">
            <p className="label-meta mb-4">Assignment (read-only)</p>
            <div className="grid grid-cols-2 gap-4">
              {shipment.assignedDriverName && (
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="label-meta">Driver</p>
                    <p className="text-sm font-semibold text-foreground">{shipment.assignedDriverName}</p>
                  </div>
                </div>
              )}
              {shipment.assignedVehicleNumber && (
                <div className="flex items-center gap-3">
                  <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="label-meta">Vehicle</p>
                    <p className="text-sm font-semibold text-foreground">{shipment.assignedVehicleNumber}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CARGO MANIFEST */}
        {(shipment.cargoWeightKg || shipment.cargoVolumeM3 || shipment.insuranceType || shipment.temperatureRequirement) && (
          <div className="panel p-6">
            <p className="label-meta mb-4 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Cargo Manifest
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {shipment.cargoWeightKg && <StatCell label="Weight" value={`${shipment.cargoWeightKg} kg`} />}
              {shipment.cargoVolumeM3 && <StatCell label="Volume" value={`${shipment.cargoVolumeM3} m³`} />}
              {shipment.insuranceType && <StatCell label="Insurance" value={shipment.insuranceType} />}
              {shipment.temperatureRequirement && <StatCell label="Temp. Req." value={shipment.temperatureRequirement} />}
              {shipment.plannedDeparture && (
                <StatCell label="Planned Departure" value={new Date(shipment.plannedDeparture).toLocaleString()} />
              )}
              {shipment.plannedArrival && (
                <StatCell label="Planned Arrival" value={new Date(shipment.plannedArrival).toLocaleString()} />
              )}
            </div>
          </div>
        )}

        {/* ACTION BUTTONS */}
        {!isCrossCompany && (shipment.status === "active" || shipment.status === "at-risk") && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onComplete}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm"
            >
              <CheckCircle className="w-4 h-4" /> Mark as Completed
            </button>
            <button
              onClick={onOpenCancel}
              className="flex items-center gap-2 border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-400 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
            >
              <XCircle className="w-4 h-4" /> Cancel Shipment
            </button>
          </div>
        )}

        {shipment.status === "cancelled" && shipment.cancellationReason && (
          <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-400">Cancellation Reason</p>
              <p className="text-sm text-red-400/80 mt-1">{shipment.cancellationReason}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT COLUMN (30-35%): MAP & ROUTE METRICS ──────────────────── */}
      <div className="flex flex-col gap-3 min-w-0">
        
        {/* ROUTE MAP */}
        <div className="w-full h-[360px] rounded-xl overflow-hidden shadow-sm bg-card border border-border relative">
          <RouteMapView
            route={routeForMap}
            routes={routeForMap ? [routeForMap] : []}
            status={shipment.status === "completed" ? "completed" : "active"}
            origin={shipment.origin}
            destination={shipment.destination}
            execution={execution}
          />
        </div>

        {/* Route Info card */}
        <div className="panel p-5 space-y-4">
          <p className="label-meta flex items-center gap-2">
            <Navigation className="w-3.5 h-3.5" /> Route Info
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 min-w-0">
              <p className="label-meta text-[11px]">ETA</p>
              <p className="text-sm font-bold text-foreground truncate">{shipment.eta}</p>
            </div>
            <div className="space-y-1.5 min-w-0">
              <p className="label-meta text-[11px]">WEATHER</p>
              <p className="text-sm font-bold text-emerald-400">Clear</p>
            </div>
            <div className="space-y-1.5 min-w-0">
              <p className="label-meta text-[11px]">DISTANCE</p>
              <p className="text-sm font-bold text-foreground truncate">{shipment.distance}</p>
            </div>
          </div>
        </div>

        {/* RISK FACTORS */}
        {hasBreakdown && (
          <div className="panel p-5">
            <p className="label-meta mb-4 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Risk Factors
            </p>
            <div className="space-y-3">
              {Object.entries(breakdown).map(([key, val]) => (
                <RiskBar key={key} label={key} value={val as number} />
              ))}
            </div>
          </div>
        )}

        {!hasBreakdown && (
          <p className="text-xs text-muted-foreground/50">
            {t("shipmentDetail.riskBreakdownUnavailable")}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const { t } = useI18n();
  const { shipmentId } = use(params);
  const searchParams = useSearchParams();
  const targetCompanyId = searchParams.get("companyId");
  const { isSuperAdmin } = useCompany();
  const { user } = useUser();
  const isCrossCompany = isSuperAdmin && !!targetCompanyId;

  const { state, completeShipment, refreshShipments } = useStore();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [execution, setExecution] = useState<ShipmentExecution | null>(null);
  const [loading, setLoading]   = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  // Fetch shipment — first try store for fast render, then fetch full detail with geometry
  const loadShipment = useCallback(async () => {
    const found = (state.shipments ?? []).find((item) => item.id === shipmentId);
    if (found && !isCrossCompany) {
      setShipment((prev) => (prev?.geometry ? { ...found, geometry: prev.geometry } : found));
      setLoading(false);
      // If store shipment already has geometry (e.g. newly created), no need to re-fetch
      if (found.geometry && found.geometry.length > 0) return;
    }

    if (!user) { setLoading(false); return; }

    try {
      const token = await user.getIdToken();
      const url   = isCrossCompany
        ? `/api/shipments/${shipmentId}?companyId=${targetCompanyId}`
        : `/api/shipments/${shipmentId}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (!found) setShipment(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.shipment) {
        setShipment(data.shipment);
      }

      if (data.shipment && (data.shipment.status === "in_transit" || data.shipment.status === "paused" || data.shipment.status === "active")) {
        const execRes = await fetch(`/api/execution/${shipmentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (execRes.ok) {
          const execData = await execRes.json();
          setExecution(execData.execution ?? null);
        }
      }
    } catch {
      if (!found) setShipment(null);
    } finally {
      setLoading(false);
    }
  }, [shipmentId, state.shipments, isCrossCompany, targetCompanyId, user]);

  useEffect(() => {
    if (!state.loading) loadShipment();
  }, [state.loading, loadShipment]);

  // Keep shipment in sync with store updates without losing geometry
  useEffect(() => {
    if (!isCrossCompany) {
      const found = (state.shipments ?? []).find((item) => item.id === shipmentId);
      if (found) {
        setShipment((prev) => (prev?.geometry ? { ...found, geometry: prev.geometry } : found));
      }
    }
  }, [state.shipments, shipmentId, isCrossCompany]);

  const handleComplete = () => {
    completeShipment(shipmentId);
    setShipment((prev) =>
      prev ? { ...prev, status: "completed", lastUpdate: new Date().toISOString() } : prev
    );
    toast.success("Shipment marked as completed");
  };

  const handleCancel = async (reason: string) => {
    setCancelling(true);
    try {
      const token = await user!.getIdToken();
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ status: "cancelled", cancellationReason: reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to cancel shipment");
        return;
      }
      const data = await res.json();
      setShipment(data.shipment);
      setCancelOpen(false);
      await refreshShipments();
      toast.success("Shipment cancelled");
    } catch {
      toast.error("Network error - could not cancel shipment");
    } finally {
      setCancelling(false);
    }
  };

  const handleAssignmentChange = useCallback((updated: Shipment) => {
    setShipment(updated);
    refreshShipments().catch(() => {});
  }, [refreshShipments]);

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (loading || state.loading) {
    return (
      <div className="p-32 text-center flex flex-col items-center gap-5">
        <div className="relative">
          <div className="w-10 h-10 border-2 border-border rounded-full" />
          <div className="w-10 h-10 border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin absolute inset-0" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground uppercase tracking-widest">
            {t("shipmentDetail.loadingShipment")}
          </p>
          <p className="text-xs text-muted-foreground">Authenticating access to corridor data…</p>
        </div>
      </div>
    );
  }

  if (!shipment) notFound();

  const riskColor = getRiskColor(shipment.riskLevel);
  const isAtRisk  = shipment.status === "at-risk";
  const isActive  = shipment.status === "active";

  // ─── Route for map (used in route tab) ────────────────────────────────────
  const routeForMap = {
    id:            shipment.id,
    label:         shipment.selectedRoute,
    name:          shipment.routeName,
    eta:           shipment.eta,
    etaMinutes:    0,
    distance:      shipment.distance,
    distanceKm:    parseFloat(shipment.distance) || 0,
    riskScore:     shipment.riskScore,
    riskLevel:     shipment.riskLevel,
    recommended:   false,
    summary:       "",
    alerts:        shipment.predictiveAlert ? [shipment.predictiveAlert] : [],
    riskBreakdown: shipment.riskBreakdown ?? { traffic: 0, weather: 0, disruption: 0, cargoSensitivity: 0 },
    geometry:      shipment.geometry ?? undefined,
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-0">
      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={handleCancel}
        submitting={cancelling}
      />

      {/* ── Command Header ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mb-8"
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5">
          <Link href="/shipments" className="hover:text-foreground transition-colors">Shipments</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground/70 font-mono">{shipment.shipmentCode}</span>
        </div>

        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          {/* Title block */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="label-meta flex items-center gap-1.5">
                <Shield className="w-3 h-3" /> {t("shipmentDetail.shipmentDetail")}
              </p>
              <StatusBadge status={shipment.status} />
              {cancelling && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Cancelling…
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              {shipment.shipmentCode}
            </h1>

            {/* Route strip */}
            <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 shrink-0">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-primary/70" />
                <span className="font-medium text-foreground/80">{shipment.origin}</span>
                <span className="text-muted-foreground/50 mx-0.5">→</span>
                <span className="font-medium text-foreground/80">{shipment.destination}</span>
              </span>
              <span className="hidden sm:block w-px h-4 bg-border" />
              <span className="flex items-center gap-1.5 shrink-0">
                <Navigation className="w-3.5 h-3.5 shrink-0" />
                <span className="capitalize">{shipment.routeName}</span>
              </span>
              <span className="hidden sm:block w-px h-4 bg-border" />
              <span className={cn("flex items-center gap-1.5 font-semibold tabular-nums", riskColor)}>
                <Layers className="w-3.5 h-3.5 shrink-0" />
                Risk {shipment.riskScore}
                <span className="text-xs font-normal text-muted-foreground capitalize ml-0.5">({shipment.riskLevel})</span>
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {/* Live indicator for active/at-risk */}
            {(isActive || isAtRisk) && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-400/8 border border-emerald-400/20 text-xs font-semibold text-emerald-400">
                <Radio className="w-3 h-3" />
                <span>LIVE</span>
              </div>
            )}
            <Link
              href="/shipments"
              className="flex items-center gap-2 border border-border hover:border-border/60 hover:bg-muted/20 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {t("shipmentDetail.backToShipments")}
            </Link>
          </div>
        </div>

        {/* Status ribbon for at-risk */}
        {isAtRisk && getMeaningfulAlert(shipment.predictiveAlert) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mt-5 flex items-center gap-3 bg-amber-400/5 border border-amber-400/20 rounded-lg px-4 py-2.5"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-400/90 leading-relaxed">{getMeaningfulAlert(shipment.predictiveAlert)}</p>
          </motion.div>
        )}

        <Separator className="mt-7 opacity-20" />
      </motion.div>

      {/* ── Command Navigation Tabs ────────────────────────────────────────── */}
      <Tabs defaultValue="overview" className="w-full">
        {/* Tab nav */}
        <div className="w-full overflow-x-auto overflow-y-hidden scrollbar-hidden mb-8">
          <TabsList className="h-auto bg-transparent gap-0 p-0 rounded-none border-b border-border w-max min-w-full">
          {[
            { value: "overview",      label: "Overview",          icon: Zap },
            { value: "route",         label: "Route Intelligence", icon: Navigation },
            { value: "risk",          label: "Risk Analysis",     icon: TrendingDown },
            { value: "timeline",      label: "Timeline",          icon: Clock },
            { value: "communication", label: "Communication",     icon: MessageSquare },
            { value: "audit",         label: "Audit",             icon: ShieldCheck },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "relative h-10 px-4 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent",
                "data-[state=active]:text-foreground data-[state=active]:border-primary",
                "hover:text-foreground/80 transition-colors bg-transparent",
                "flex items-center gap-1.5 shrink-0"
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </TabsTrigger>
          ))}
          </TabsList>
        </div>

        {/* ── Overview ─────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-0">
          <OverviewTab
            shipment={shipment}
            onComplete={handleComplete}
            onOpenCancel={() => setCancelOpen(true)}
            onAssigned={handleAssignmentChange}
            isCrossCompany={isCrossCompany}
            execution={execution}
          />
        </TabsContent>

        {/* ── Route Intelligence ────────────────────────────────────────────── */}
        <TabsContent value="route" className="mt-0">
          <div className="space-y-5">

            {/* Route metric strip */}
            <div className="panel p-5">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <p className="label-meta flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5" /> Route Parameters
                </p>
                <Badge variant="outline" className="bg-primary/8 text-primary border-primary/20 text-[10px] px-2 py-0.5 font-semibold capitalize">
                  {shipment.selectedRoute}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                <StatCell label="Route" value={shipment.selectedRoute} />
                <StatCell label="Distance" value={shipment.distance} />
                <StatCell label="ETA" value={shipment.eta} />
                <StatCell label="Confidence" value={`${shipment.confidencePercent}%`} />
              </div>
            </div>

            {/* RISK FACTORS */}
            {shipment.riskBreakdown && (
              <div className="panel p-5">
                <p className="label-meta mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Risk Factors
                </p>
                <div className="space-y-3">
                  {Object.entries(shipment.riskBreakdown).map(([key, val]) => {
                    const factorVal = val as number | undefined;
                    if (factorVal === undefined || factorVal === null) return null;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground capitalize">
                            {key === "cargoSensitivity" ? "Cargo Sensitivity" : key}
                          </span>
                          <span className={cn("font-bold tabular-nums", factorVal > 60 ? "text-red-400" : factorVal > 35 ? "text-amber-400" : "text-emerald-400")}>
                            {factorVal}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted overflow-hidden rounded-full">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", factorVal > 60 ? "bg-red-400" : factorVal > 35 ? "bg-amber-400" : "bg-emerald-400")}
                            style={{ width: `${factorVal}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Map card with footer */}
            <div className="rounded-xl overflow-hidden shadow-sm bg-card border border-border flex flex-col">
              <div className="h-[400px] w-full">
                <RouteMapView
                  route={routeForMap}
                  routes={[]}
                  status={shipment.status === "completed" ? "completed" : "active"}
                  origin={shipment.origin}
                  destination={shipment.destination}
                  execution={execution}
                />
              </div>

              {/* Footer with ETA/Weather/Distance */}
              <div className="grid grid-cols-3 gap-4 p-4 border-t border-border bg-muted/20">
                <div className="text-center space-y-1.5">
                  <p className="label-meta text-[10px]">ETA</p>
                  <p className="text-sm font-bold text-foreground">{shipment.eta}</p>
                </div>
                <div className="text-center space-y-1.5">
                  <p className="label-meta text-[10px]">WEATHER</p>
                  <p className="text-sm font-bold text-emerald-400">Clear</p>
                </div>
                <div className="text-center space-y-1.5">
                  <p className="label-meta text-[10px]">DISTANCE</p>
                  <p className="text-sm font-bold text-foreground">{shipment.distance}</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Risk Analysis ─────────────────────────────────────────────────── */}
        <TabsContent value="risk" className="mt-0">
          <ShipmentRiskPanel shipmentId={shipment.id} />
        </TabsContent>

        {/* ── Timeline ──────────────────────────────────────────────────────── */}
        <TabsContent value="timeline" className="mt-0">
          <ShipmentTimeline shipmentId={shipment.id} />
        </TabsContent>

        {/* ── Communication ─────────────────────────────────────────────────── */}
        <TabsContent value="communication" className="mt-0">
          <ShipmentCommunication shipmentId={shipment.id} status={shipment.status} />
        </TabsContent>

        {/* ── Audit ─────────────────────────────────────────────────────────── */}
        <TabsContent value="audit" className="mt-0">
          <ShipmentAuditTab
            shipmentId={shipment.id}
            companyId={isCrossCompany ? (targetCompanyId || undefined) : undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
