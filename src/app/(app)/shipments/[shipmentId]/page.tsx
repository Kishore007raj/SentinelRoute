"use client";
import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, MapPin, Clock, Truck, Package, CheckCircle, XCircle,
  User, FileText, AlertTriangle, RefreshCw, ShieldCheck, Activity,
  Navigation, CloudRain, MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

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

import { getRiskColor, cn, formatRelativeTime, getMeaningfulAlert } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Shipment, ShipmentExecution } from "@/lib/types";
import { ShipmentRiskPanel } from "@/components/shipment/ShipmentRiskPanel";
import { ShipmentTimeline } from "@/components/shipment/ShipmentTimeline";
import { ShipmentCommunication } from "@/components/shipment/ShipmentCommunication";
import { ShipmentAssignment } from "@/components/shipment/ShipmentAssignment";

// ─── Status configuration ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  active:    { label: "Active",     className: "bg-primary/10 text-primary border-primary/20",         dot: "bg-primary" },
  "at-risk": { label: "At Risk",    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",   dot: "bg-amber-400" },
  completed: { label: "Completed",  className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
  cancelled: { label: "Cancelled",  className: "bg-red-500/10 text-red-400 border-red-500/20",         dot: "bg-red-400" },
  draft:     { label: "Draft",      className: "bg-muted/40 text-muted-foreground border-border",       dot: "bg-muted-foreground" },
};

// ─── Audit tab ────────────────────────────────────────────────────────────────
// Renders intelligence_audits for this shipment from the existing timeline API
// (same data, different presentation — shows action/source/timestamp detail)

function ShipmentAuditTab({ shipmentId, companyId }: { shipmentId: string; companyId?: string }) {
  const { user } = useUser();
  const [events, setEvents]   = useState<any[]>([]);
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
    <div className="panel p-6 text-sm text-muted-foreground animate-pulse">Loading audit trail…</div>
  );
  if (events.length === 0) return (
    <div className="panel p-6 text-sm text-muted-foreground">No audit events recorded yet.</div>
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
                {ev.affectedMetrics?.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/60">
                    affects: {ev.affectedMetrics.join(", ")}
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

  // Reset on open
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
    <div className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">
      {/* Left column */}
      <div className="space-y-6">

        {/* Core info */}
        <div className="panel p-7">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 px-3 py-1 text-xs font-semibold">
              {shipment.routeName}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="space-y-1.5">
              <p className="label-meta">{t("logistics.eta")}</p>
              <p className="text-2xl font-bold text-foreground">{shipment.eta}</p>
            </div>
            <div className="space-y-1.5">
              <p className="label-meta">{t("logistics.riskScore")}</p>
              <p className={cn("text-2xl font-bold", riskColor)}>
                {shipment.riskScore}
                <span className="text-sm font-normal text-muted-foreground ml-1.5 capitalize">/ {shipment.riskLevel}</span>
              </p>
            </div>
          </div>

          <Separator className="my-5 opacity-30" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{shipment.origin} → {shipment.destination}</span>
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

          <Separator className="my-5 opacity-30" />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="label-meta">{t("logistics.distance")}</p>
              <p className="text-sm font-semibold text-foreground">{shipment.distance}</p>
            </div>
            <div className="space-y-1">
              <p className="label-meta">{t("logistics.confidence")}</p>
              <p className="text-sm font-semibold text-foreground">{shipment.confidencePercent}%</p>
            </div>
            <div className="space-y-1">
              <p className="label-meta">{t("logistics.departure")}</p>
              <p className="text-sm font-semibold text-foreground">{shipment.departureTime}</p>
            </div>
            <div className="space-y-1">
              <p className="label-meta">{t("logistics.shipmentCode")}</p>
              <p className="text-sm font-mono font-semibold text-foreground">{shipment.shipmentCode}</p>
            </div>
            {shipment.priority && (
              <div className="space-y-1">
                <p className="label-meta">Priority</p>
                <p className="text-sm font-semibold text-foreground">{shipment.priority}</p>
              </div>
            )}
            {shipment.deadline && (
              <div className="space-y-1">
                <p className="label-meta">Deadline</p>
                <p className="text-sm font-semibold text-foreground">
                  {new Date(shipment.deadline).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {getMeaningfulAlert(shipment.predictiveAlert) && (
            <>
              <Separator className="my-5 opacity-30" />
              <div className="flex items-start gap-3 bg-amber-400/5 border border-amber-400/20 rounded-lg px-4 py-3">
                <span className="text-amber-400 mt-0.5">⚠</span>
                <p className="text-sm text-amber-400/90 leading-relaxed">{getMeaningfulAlert(shipment.predictiveAlert)}</p>
              </div>
            </>
          )}
        </div>

        {/* Driver & Vehicle assignment */}
        {!isCrossCompany && (
          <ShipmentAssignment shipment={shipment} onAssigned={onAssigned} />
        )}
        {isCrossCompany && (shipment.assignedDriverName || shipment.assignedVehicleNumber) && (
          <div className="panel p-7">
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

        {/* Cargo manifest */}
        {(shipment.cargoWeightKg || shipment.cargoVolumeM3 || shipment.insuranceType || shipment.temperatureRequirement) && (
          <div className="panel p-7">
            <p className="label-meta mb-4 flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Cargo Manifest</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {shipment.cargoWeightKg && (
                <div className="space-y-1">
                  <p className="label-meta">Weight</p>
                  <p className="text-sm font-semibold text-foreground">{shipment.cargoWeightKg} kg</p>
                </div>
              )}
              {shipment.cargoVolumeM3 && (
                <div className="space-y-1">
                  <p className="label-meta">Volume</p>
                  <p className="text-sm font-semibold text-foreground">{shipment.cargoVolumeM3} m³</p>
                </div>
              )}
              {shipment.insuranceType && (
                <div className="space-y-1">
                  <p className="label-meta">Insurance</p>
                  <p className="text-sm font-semibold text-foreground">{shipment.insuranceType}</p>
                </div>
              )}
              {shipment.temperatureRequirement && (
                <div className="space-y-1">
                  <p className="label-meta">Temp. Req.</p>
                  <p className="text-sm font-semibold text-foreground">{shipment.temperatureRequirement}</p>
                </div>
              )}
              {shipment.plannedDeparture && (
                <div className="space-y-1">
                  <p className="label-meta">Planned Departure</p>
                  <p className="text-sm font-semibold text-foreground">
                    {new Date(shipment.plannedDeparture).toLocaleString()}
                  </p>
                </div>
              )}
              {shipment.plannedArrival && (
                <div className="space-y-1">
                  <p className="label-meta">Planned Arrival</p>
                  <p className="text-sm font-semibold text-foreground">
                    {new Date(shipment.plannedArrival).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {!isCrossCompany && (shipment.status === "active" || shipment.status === "at-risk") && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onComplete}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
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

      {/* Right column — map */}
      <div>
        {!hasBreakdown && (
          <p className="text-xs text-muted-foreground/50 mb-3 px-1">
            {t("shipmentDetail.riskBreakdownUnavailable")}
          </p>
        )}
        <DecisionWorkspace
          shipment={shipment}
          routeForMap={routeForMap}
          execution={execution}
        />
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

  // Fetch shipment — first try store, then API
  const loadShipment = useCallback(async () => {
    const found = (state.shipments ?? []).find((item) => item.id === shipmentId);
    if (found && !isCrossCompany) {
      setShipment(found);
      setLoading(false);
      return;
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
      if (!res.ok) { setShipment(null); setLoading(false); return; }
      const data = await res.json();
      setShipment(data.shipment ?? null);

      // Also try to load execution data
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
      setShipment(null);
    } finally {
      setLoading(false);
    }
  }, [shipmentId, state.shipments, isCrossCompany, targetCompanyId, user]);

  useEffect(() => {
    if (!state.loading) loadShipment();
  }, [state.loading, loadShipment]);

  // Keep shipment in sync with store updates
  useEffect(() => {
    if (!isCrossCompany) {
      const found = (state.shipments ?? []).find((item) => item.id === shipmentId);
      if (found) setShipment(found);
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
      toast.error("Network error — could not cancel shipment");
    } finally {
      setCancelling(false);
    }
  };

  const handleAssignmentChange = useCallback((updated: Shipment) => {
    setShipment(updated);
    refreshShipments().catch(() => {});
  }, [refreshShipments]);

  if (loading || state.loading) {
    return (
      <div className="p-32 text-center flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground uppercase tracking-widest">
          {t("shipmentDetail.loadingShipment")}
        </p>
      </div>
    );
  }

  if (!shipment) notFound();

  const statusCfg = STATUS_CONFIG[shipment.status] ?? STATUS_CONFIG.active;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={handleCancel}
        submitting={cancelling}
      />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-5 pb-8 border-b border-border">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {t("shipmentDetail.shipmentDetail")}
          </p>
          <h1 className="text-3xl font-bold text-foreground">{shipment.shipmentCode}</h1>
          <p className="text-sm text-muted-foreground">{shipment.origin} → {shipment.destination}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={shipment.status} />
          {cancelling && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Cancelling…
            </div>
          )}
          <Link
            href="/shipments"
            className="flex items-center gap-2 border border-border hover:border-border/80 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t("shipmentDetail.backToShipments")}
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="h-11 bg-muted/20 gap-1 p-1 rounded-lg flex-wrap">
          <TabsTrigger value="overview"      className="text-sm h-9 px-4 rounded-md">Overview</TabsTrigger>
          <TabsTrigger value="route"         className="text-sm h-9 px-4 rounded-md">Route</TabsTrigger>
          <TabsTrigger value="risk"          className="text-sm h-9 px-4 rounded-md">Risk Intelligence</TabsTrigger>
          <TabsTrigger value="timeline"      className="text-sm h-9 px-4 rounded-md">Timeline</TabsTrigger>
          <TabsTrigger value="communication" className="text-sm h-9 px-4 rounded-md">Communication</TabsTrigger>
          <TabsTrigger value="audit" className="text-sm h-9 px-4 rounded-md">Audit</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-8">
          <OverviewTab
            shipment={shipment}
            onComplete={handleComplete}
            onOpenCancel={() => setCancelOpen(true)}
            onAssigned={handleAssignmentChange}
            isCrossCompany={isCrossCompany}
            execution={execution}
          />
        </TabsContent>

        {/* Route */}
        <TabsContent value="route" className="mt-8">
          <div className="space-y-6">
            <DashboardCard icon={Navigation} title="Route Details" noPadding className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="label-meta">Route</p>
                  <p className="text-sm font-semibold text-foreground capitalize">{shipment.selectedRoute}</p>
                </div>
                <div className="space-y-1">
                  <p className="label-meta">Distance</p>
                  <p className="text-sm font-semibold text-foreground">{shipment.distance}</p>
                </div>
                <div className="space-y-1">
                  <p className="label-meta">ETA</p>
                  <p className="text-sm font-semibold text-foreground">{shipment.eta}</p>
                </div>
                <div className="space-y-1">
                  <p className="label-meta">Confidence</p>
                  <p className="text-sm font-semibold text-foreground">{shipment.confidencePercent}%</p>
                </div>
              </div>
            </DashboardCard>
            {/* Risk breakdown */}
            {shipment.riskBreakdown && (
              <DashboardCard icon={AlertTriangle} title="Risk Factors on Route" noPadding className="p-6">
                <div className="space-y-4">
                  {Object.entries(shipment.riskBreakdown).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-36 shrink-0 capitalize">
                        {key === "cargoSensitivity" ? "Cargo Sensitivity" : key}
                      </span>
                      <div className="flex-1 h-2 bg-muted overflow-hidden rounded-full">
                        <div
                          className={cn("h-full rounded-full", val > 60 ? "bg-red-400" : val > 35 ? "bg-amber-400" : "bg-emerald-400")}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono text-muted-foreground w-8 text-right">{val}</span>
                    </div>
                  ))}
                </div>
              </DashboardCard>
            )}
            {/* Map */}
            <div className="rounded-xl overflow-hidden border border-border h-[500px]">
              <RouteMapView
                route={{
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
                }}
                routes={[]}
                status={shipment.status === "completed" ? "completed" : "active"}
                origin={shipment.origin}
                destination={shipment.destination}
                execution={execution}
              />
            </div>
          </div>
        </TabsContent>

        {/* Risk Intelligence */}
        <TabsContent value="risk" className="mt-8">
          <ShipmentRiskPanel shipmentId={shipment.id} />
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-8">
          <ShipmentTimeline shipmentId={shipment.id} />
        </TabsContent>

        {/* Communication */}
        <TabsContent value="communication" className="mt-8">
          <ShipmentCommunication shipmentId={shipment.id} />
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit" className="mt-8">
          <ShipmentAuditTab shipmentId={shipment.id} companyId={isCrossCompany ? (targetCompanyId || undefined) : undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
