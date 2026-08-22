"use client";

import { fetchApi } from "@/lib/api-client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  User,
  CreditCard,
  Truck,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpiryBadge } from "@/components/workforce/ExpiryBadge";
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { useI18n } from "@/lib/i18n";
import type { Driver, WorkforceAudit } from "@/lib/types";

function ProfileSkeleton() {
  return (
    <div className="max-w-5xl mx-auto w-full space-y-7">
      <div className="pb-6 border-b border-border space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel p-5 bg-card space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="label-meta">{label}</p>
      <div className="text-xs font-semibold text-foreground">{value}</div>
    </div>
  );
}

function DriverStatusBadge({ status, t }: { status: Driver["status"]; t: (k: string) => string }) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="bg-emerald-400/10 text-emerald-400 border-emerald-400/20 text-[10px] uppercase font-bold">
        {t("workforce.active")}
      </Badge>
    );
  }
  if (status === "suspended") {
    return (
      <Badge variant="outline" className="bg-red-400/10 text-red-400 border-red-400/20 text-[10px] uppercase font-bold">
        {t("workforce.suspended")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-muted/30 text-muted-foreground border-border text-[10px] uppercase font-bold">
      {t("workforce.inactive")}
    </Badge>
  );
}

function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DriverProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { userRecord, status: companyStatus } = useCompany();
  const { t } = useI18n();

  const driverId = params?.id as string;

  const [driver, setDriver] = useState<Driver | null>(null);
  const [audits, setAudits] = useState<WorkforceAudit[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudits = useCallback(
    async (token: string) => {
      setAuditsLoading(true);
      try {
        const res = await fetchApi(`/api/workforce/audits?targetId=${encodeURIComponent(driverId)}`, {
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
    [driverId]
  );

  const fetchDriver = useCallback(async () => {
    if (!user || !driverId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetchApi(`/api/workforce/drivers/${encodeURIComponent(driverId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }
      const json = await res.json();
      setDriver(json.driver ?? null);
      fetchAudits(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workforce.failedToLoadDriverProfile"));
    } finally {
      setLoading(false);
    }
  }, [user, driverId, fetchAudits, t]);

  useEffect(() => {
    if (companyStatus !== "loading" && userRecord?.role === "driver") {
      router.replace("/dashboard");
    }
  }, [userRecord, companyStatus, router]);

  useEffect(() => {
    if (companyStatus === "loading" || !user) return;
    if (userRecord?.role === "driver") return;
    fetchDriver();
  }, [user, companyStatus, fetchDriver, userRecord]);

  if (loading) return <ProfileSkeleton />;

  if (error || !driver) {
    return (
      <div className="max-w-5xl mx-auto w-full space-y-4">
        <Link href="/workforce/drivers" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("workforce.backToDrivers")}
        </Link>
        <div className="panel p-12 text-center space-y-4 border border-dashed border-border/70">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">{t("workforce.failedToLoadDriverProfile")}</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error ?? t("workforce.driverNotFound")}</p>
          </div>
          <Button variant="outline" className="gap-2 h-9 px-4 text-xs font-bold uppercase tracking-wider" onClick={fetchDriver}>
            <RefreshCw className="w-3.5 h-3.5" />
            {t("workforce.retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full space-y-7 pb-12">
      {/* Back link */}
      <div>
        <Link href="/workforce/drivers" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("workforce.backToDrivers")}
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">{driver.fullName}</h1>
            <DriverStatusBadge status={driver.status} t={t} />
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            {driver.employeeId} · {driver.phone}
          </p>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal info */}
        <div className="panel p-5 bg-card space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <User className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">{t("workforce.personalInformation")}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label={t("workforce.fullName")} value={driver.fullName} />
            <InfoRow label={t("workforce.employeeId")} value={<span className="font-mono">{driver.employeeId}</span>} />
            <InfoRow label={t("workforce.phone")} value={driver.phone} />
            <InfoRow label={t("workforce.status")} value={<DriverStatusBadge status={driver.status} t={t} />} />
          </div>
        </div>

        {/* License info */}
        <div className="panel p-5 bg-card space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <CreditCard className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">{t("workforce.licenseDetails")}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label={t("workforce.licenseNumber")} value={<span className="font-mono">{driver.licenseNumber}</span>} />
            <InfoRow
              label={t("workforce.expiryDate")}
              value={
                <div className="flex items-center gap-2">
                  <span className="font-mono">{driver.licenseExpiry}</span>
                  <ExpiryBadge expiry={driver.licenseExpiry} mode="badge" />
                </div>
              }
            />
          </div>
        </div>

        {/* Vehicle assignment */}
        <div className="panel p-5 bg-card space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Truck className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">{t("workforce.vehicleAssignment")}</h3>
          </div>
          <div>
            {driver.assignedVehicleId ? (
              <Link
                href={`/workforce/vehicles/${driver.assignedVehicleId}`}
                className="inline-flex items-center gap-2 font-mono text-xs text-primary hover:underline font-bold"
              >
                <Truck className="w-3.5 h-3.5" />
                {driver.assignedVehicleId}
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">{t("workforce.unassigned")}</p>
            )}
          </div>
        </div>

        {/* System audit history */}
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
