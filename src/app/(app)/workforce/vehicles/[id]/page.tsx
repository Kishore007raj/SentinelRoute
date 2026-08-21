"use client";

import { fetchApi } from "@/lib/api-client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  ArrowLeft,
  Truck,
  User,
  ShieldCheck,
  FileText,
  AlertTriangle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpiryBadge } from "@/components/workforce/ExpiryBadge";
import { useUser } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import type { Vehicle, WorkforceAudit } from "@/lib/types";

function VehicleStatusBadge({ status, t }: { status: Vehicle["status"]; t: (k: string) => string }) {
  const map: Record<Vehicle["status"], string> = {
    available: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    assigned: "bg-primary/10 text-primary border-primary/20",
    maintenance: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    inactive: "bg-muted/30 text-muted-foreground border-border",
  };
  const labelKey: Record<Vehicle["status"], string> = {
    available: "workforce.available",
    assigned: "workforce.assigned",
    maintenance: "workforce.maintenance",
    inactive: "workforce.inactive",
  };
  return (
    <Badge variant="outline" className={`text-[10px] uppercase font-bold ${map[status]}`}>
      {t(labelKey[status])}
    </Badge>
  );
}

function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2.5 border-b border-border/40 last:border-0">
      <span className="label-meta sm:w-44 shrink-0 pt-0.5">{label}</span>
      <div className="text-xs font-semibold text-foreground">{children}</div>
    </div>
  );
}

function VehicleProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto w-full space-y-7">
      <div className="pb-6 border-b border-border space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-48" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="panel p-5 bg-card space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function VehicleProfilePage() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useUser();
  const { t } = useI18n();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [audits, setAudits] = useState<WorkforceAudit[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudits = useCallback(
    async (token: string) => {
      setAuditsLoading(true);
      try {
        const res = await fetchApi(`/api/workforce/audits?targetId=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setAudits(json.audits ?? []);
        }
      } catch {
        /* non-fatal */
      } finally {
        setAuditsLoading(false);
      }
    },
    [id]
  );

  const fetchVehicle = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetchApi(`/api/workforce/vehicles/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }
      const json = await res.json();
      setVehicle(json.vehicle ?? null);
      fetchAudits(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workforce.failedToLoadVehicleProfile"));
    } finally {
      setLoading(false);
    }
  }, [user, id, fetchAudits, t]);

  useEffect(() => {
    fetchVehicle();
  }, [fetchVehicle]);

  if (loading) return <VehicleProfileSkeleton />;

  if (error || !vehicle) {
    return (
      <div className="max-w-4xl mx-auto w-full space-y-4">
        <Link href="/workforce/vehicles" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("workforce.backToVehicles")}
        </Link>
        <div className="panel p-12 text-center space-y-4 border border-dashed border-border/70">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">{t("workforce.failedToLoadVehicleProfile")}</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error ?? t("workforce.vehicleNotFound")}</p>
          </div>
          <Button variant="outline" className="gap-2 h-9 px-4 text-xs font-bold uppercase tracking-wider" onClick={fetchVehicle}>
            <RefreshCw className="w-3.5 h-3.5" />
            {t("workforce.retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-7 pb-12">
      {/* Back link */}
      <div>
        <Link href="/workforce/vehicles" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("workforce.backToVehicles")}
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground font-mono tracking-tight">{vehicle.vehicleNumber}</h1>
            <VehicleStatusBadge status={vehicle.status} t={t} />
          </div>
          <p className="text-xs text-muted-foreground">
            {vehicle.vehicleType} · {vehicle.fuelType}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Core Specs */}
        <div className="panel p-5 bg-card space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Truck className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">{t("workforce.specifications")}</h3>
          </div>
          <div className="divide-y divide-border/40">
            <DetailRow label={t("workforce.vehicleType")}>{vehicle.vehicleType}</DetailRow>
            <DetailRow label={t("workforce.capacity")}>{vehicle.capacity}</DetailRow>
            <DetailRow label={t("workforce.fuelType")}>{vehicle.fuelType}</DetailRow>
          </div>
        </div>

        {/* Assigned Driver */}
        <div className="panel p-5 bg-card space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <User className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">{t("workforce.assignedDriver")}</h3>
          </div>
          <div>
            {vehicle.currentDriverId ? (
              <Link
                href={`/workforce/drivers/${vehicle.currentDriverId}`}
                className="inline-flex items-center gap-2 font-bold text-xs text-primary hover:underline"
              >
                <User className="w-3.5 h-3.5" />
                {vehicle.currentDriverId}
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">{t("workforce.unassigned")}</p>
            )}
          </div>
        </div>

        {/* Insurance */}
        <div className="panel p-5 bg-card space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">{t("workforce.insurance")}</h3>
          </div>
          <div className="divide-y divide-border/40">
            <DetailRow label={t("workforce.policyNumber")}>
              <span className="font-mono">{vehicle.insuranceNumber ?? "—"}</span>
            </DetailRow>
            <DetailRow label={t("workforce.expiryDate")}>
              {vehicle.insuranceExpiry ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono">{vehicle.insuranceExpiry}</span>
                  <ExpiryBadge expiry={vehicle.insuranceExpiry} mode="badge" />
                </div>
              ) : (
                "—"
              )}
            </DetailRow>
          </div>
        </div>

        {/* Permits & Fitness */}
        <div className="panel p-5 bg-card space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <FileText className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">{t("workforce.permitsAndFitness")}</h3>
          </div>
          <div className="divide-y divide-border/40">
            <DetailRow label={t("workforce.permitExpiry")}>
              {vehicle.permitExpiry ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono">{vehicle.permitExpiry}</span>
                  <ExpiryBadge expiry={vehicle.permitExpiry} mode="badge" />
                </div>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow label={t("workforce.fitnessExpiry")}>
              {vehicle.fitnessExpiry ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono">{vehicle.fitnessExpiry}</span>
                  <ExpiryBadge expiry={vehicle.fitnessExpiry} mode="badge" />
                </div>
              ) : (
                "—"
              )}
            </DetailRow>
          </div>
        </div>

        {/* Audit History */}
        <div className="panel p-5 bg-card space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">{t("workforce.auditHistory")}</h3>
            </div>
            {auditsLoading && <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
          </div>
          <div>
            {audits.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("workforce.noAuditHistory")}</p>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {audits.map((event) => (
                  <div key={event.auditId} className="text-xs border-b border-border/40 pb-2.5 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[9px] font-bold border-border text-foreground uppercase">
                        {formatEventType(event.eventType)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(parseISO(event.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 font-mono truncate">By: {event.actorId}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
