"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Clock, Truck, Package, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import dynamic from "next/dynamic";
import { useI18n } from "@/lib/i18n";

import { useCompany } from "@/lib/company-context";
import { useUser } from "@/lib/auth-context";
import { useSearchParams } from "next/navigation";

const RouteMapView = dynamic(() => import("@/components/shipment/RouteMapView").then((mod) => mod.RouteMapView), { ssr: false });
import { getRiskColor, cn, formatRelativeTime, getMeaningfulAlert } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Shipment } from "@/lib/types";
import { ShipmentRiskPanel } from "@/components/shipment/ShipmentRiskPanel";
import { ShipmentTimeline } from "@/components/shipment/ShipmentTimeline";
import { ShipmentCommunication } from "@/components/shipment/ShipmentCommunication";

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

  const { state, completeShipment } = useStore();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const found = (state.shipments ?? []).find((item) => item.id === shipmentId);
    if (found) {
      setShipment(found);
      setLoading(false);
    } else if (isCrossCompany && user) {
      setLoading(true);
      user.getIdToken()
        .then((token) => {
          return fetch(`/api/shipments?companyId=${targetCompanyId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then((data) => {
          const crossFound = (data.shipments ?? []).find((item: any) => item.id === shipmentId);
          if (crossFound) {
            setShipment(crossFound);
          } else {
            setShipment(null);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load cross-company shipment:", err);
          setShipment(null);
          setLoading(false);
        });
    } else if (!state.loading) {
      setLoading(false);
    }
  }, [shipmentId, state.shipments, state.loading, isCrossCompany, targetCompanyId, user]);

  if (loading) {
    return (
      <div className="p-32 text-center flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground uppercase tracking-widest">{t('shipmentDetail.loadingShipment')}</p>
      </div>
    );
  }

  if (!shipment) notFound();

  const handleComplete = () => {
    completeShipment(shipment.id);
    setShipment((prev) =>
      prev ? { ...prev, status: "completed", lastUpdate: new Date().toISOString() } : prev
    );
  };

  // Use stored riskBreakdown only — never fabricate values.
  // If not stored (legacy shipments), show a disclosure instead.
  const hasBreakdown = !!shipment.riskBreakdown;
  const breakdown = shipment.riskBreakdown ?? {
    traffic: 0, weather: 0, disruption: 0, cargoSensitivity: 0,
  };

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

  const statusBadgeClass =
    shipment.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
    shipment.status === "at-risk"   ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
    "bg-primary/10 text-primary border-primary/20";

  // Dynamic decision context based on actual data
  const decisionContext = (() => {
    const label = shipment.selectedRoute;
    const risk  = shipment.riskScore;
    const cargo = shipment.cargoType;

    if (label === "safest") {
      return t('shipmentDetail.safestContext').replace('{cargo}', cargo).replace('{risk}', risk.toString());
    }
    if (label === "fastest") {
      return t('shipmentDetail.fastestContext').replace('{risk}', risk.toString());
    }
    return t('shipmentDetail.balancedContext').replace('{cargo}', cargo).replace('{risk}', risk.toString());
  })();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-10">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-5 pb-8 border-b border-border">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">{t('shipmentDetail.shipmentDetail')}</p>
          <h1 className="text-3xl font-bold text-foreground">{shipment.shipmentCode}</h1>
          <p className="text-sm text-muted-foreground">{shipment.origin} → {shipment.destination}</p>
        </div>
        <div className="flex items-center gap-3">
          {!isCrossCompany && (shipment.status === "active" || shipment.status === "at-risk") && (
            <button
              onClick={handleComplete}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              {t('shipmentDetail.markAsCompleted')}
            </button>
          )}
          <Link
            href="/shipments"
            className="flex items-center gap-2 border border-border hover:border-border/80 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t('shipmentDetail.backToShipments')}
          </Link>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">

        {/* Left */}
        <div className="space-y-6">
          <div className="panel p-7">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 px-3 py-1 text-xs font-semibold">
                {shipment.routeName}
              </Badge>
              <Badge className={cn("px-3 py-1 text-xs font-semibold border", statusBadgeClass)}>
                {shipment.status === 'completed' ? t('logistics.completed') : shipment.status === 'at-risk' ? t('logistics.atRisk') : t('logistics.active')}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="space-y-1.5">
                <p className="label-meta">{t('logistics.eta')}</p>
                <p className="text-2xl font-bold text-foreground">{shipment.eta}</p>
              </div>
              <div className="space-y-1.5">
                <p className="label-meta">{t('logistics.riskScore')}</p>
                <p className={cn("text-2xl font-bold", getRiskColor(shipment.riskLevel))}>
                  {shipment.riskScore}
                  <span className="text-sm font-normal text-muted-foreground ml-1.5 capitalize">
                    / {shipment.riskLevel === 'critical' ? t('logistics.critical') :
                       shipment.riskLevel === 'high' ? t('logistics.high') :
                       shipment.riskLevel === 'medium' ? t('logistics.medium') :
                       t('logistics.low')}
                  </span>
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
                <span>{t('shipmentDetail.updated')} {formatRelativeTime(shipment.lastUpdate)}</span>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="label-meta">{t('logistics.distance')}</p>
                <p className="text-sm font-semibold text-foreground">{shipment.distance}</p>
              </div>
              <div className="space-y-1">
                <p className="label-meta">{t('logistics.confidence')}</p>
                <p className="text-sm font-semibold text-foreground">{shipment.confidencePercent}%</p>
              </div>
              <div className="space-y-1">
                <p className="label-meta">{t('logistics.departure')}</p>
                <p className="text-sm font-semibold text-foreground">{shipment.departureTime}</p>
              </div>
              <div className="space-y-1">
                <p className="label-meta">{t('logistics.shipmentCode')}</p>
                <p className="text-sm font-mono font-semibold text-foreground">{shipment.shipmentCode}</p>
              </div>
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

          {/* Dynamic decision context */}
          <div className="panel p-7">
            <p className="label-meta mb-4">{t('shipmentDetail.decisionContext')}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{decisionContext}</p>
          </div>

          {/* Module 3 Intelligence Panels */}
          <ShipmentRiskPanel shipmentId={shipment.id} />
          <ShipmentTimeline shipmentId={shipment.id} />

        </div>

        {/* Right: map */}
        <div>
          {!hasBreakdown && (
            <p className="text-xs text-muted-foreground/50 mb-3 px-1">
              {t('shipmentDetail.riskBreakdownUnavailable')}
            </p>
          )}
          <RouteMapView
            route={routeForMap}
            routes={[routeForMap]}
            status={shipment.status === "completed" ? "completed" : "active"}
            origin={shipment.origin}
            destination={shipment.destination}
          />
          <div className="mt-6">
            <ShipmentCommunication shipmentId={shipment.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
