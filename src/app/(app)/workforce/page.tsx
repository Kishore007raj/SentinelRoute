"use client";

import { fetchApi } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Users, Car, Truck, Activity, AlertTriangle, RefreshCw, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { useI18n } from "@/lib/i18n";
import { calcDaysUntil } from "@/components/workforce/ExpiryBadge";
import { cn } from "@/lib/utils";

interface DashboardData {
  totalDrivers: number;
  activeDrivers: number;
  totalVehicles: number;
  availableVehicles: number;
  assignedVehicles: number;
  inactiveVehicles: number;
  recentActivity: Array<{
    auditId: string;
    eventType: string;
    actorId: string;
    targetId: string;
    timestamp: string;
  }>;
  upcomingExpirations: {
    drivers: Array<{ driverId: string; fullName: string; licenseExpiry: string }>;
    vehicles: Array<{
      vehicleId: string;
      vehicleNumber: string;
      insuranceExpiry?: string;
      permitExpiry?: string;
      fitnessExpiry?: string;
    }>;
  };
}

function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto w-full space-y-7">
      <div className="pb-6 border-b border-border space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="panel p-5 bg-card border border-border space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  valueColor,
  icon: Icon,
}: {
  label: string;
  value: number;
  sub?: string;
  valueColor?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="panel p-5 bg-card space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="label-meta">{label}</span>
        <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />
      </div>
      <p className={cn("text-3xl font-bold tabular-nums tracking-tight", valueColor ?? "text-foreground")}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground font-medium">{sub}</p>}
    </div>
  );
}

function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ExpiryDaysBadge({ daysUntil, t }: { daysUntil: number; t: (k: string) => string }) {
  if (daysUntil < 0) {
    return (
      <Badge variant="outline" className="bg-red-400/10 text-red-400 border-red-400/20 text-[10px] uppercase font-bold">
        {t("workforce.expired")}
      </Badge>
    );
  }
  if (daysUntil === 0) {
    return (
      <Badge variant="outline" className="bg-red-400/10 text-red-400 border-red-400/20 text-[10px] uppercase font-bold">
        {t("workforce.expiresToday")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-amber-400/10 text-amber-400 border-amber-400/20 text-[10px] uppercase font-bold">
      {t("workforce.daysLeft").replace("{n}", String(daysUntil))}
    </Badge>
  );
}

export default function WorkforceDashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const { userRecord, status } = useCompany();
  const { t } = useI18n();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "loading" && userRecord?.role === "driver") {
      router.replace("/dashboard");
    }
  }, [userRecord, status, router]);

  const fetchDashboard = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetchApi("/api/workforce/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workforce.failedToLoadDashboard"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading" || !user) return;
    if (userRecord?.role === "driver") return;
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status]);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="max-w-7xl mx-auto w-full">
        <div className="panel p-12 text-center space-y-4 border border-dashed border-border/70">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">{t("workforce.failedToLoadDashboard")}</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
          </div>
          <Button variant="outline" className="gap-2 h-9 px-4 text-xs font-bold uppercase tracking-wider" onClick={fetchDashboard}>
            <RefreshCw className="w-3.5 h-3.5" />
            {t("workforce.retry")}
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { upcomingExpirations } = data;
  const hasExpirations =
    upcomingExpirations.drivers.length > 0 || upcomingExpirations.vehicles.length > 0;

  return (
    <div className="max-w-7xl mx-auto w-full space-y-7 pb-12">
      {/* Header */}
      <div className="pb-6 border-b border-border">
        <p className="label-meta flex items-center gap-2 mb-2">
          <Layers className="w-3.5 h-3.5 text-primary" />
          {t("workforce.operations")}
        </p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("workforce.dashboard")}</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label={t("workforce.totalDrivers")}
          value={data.totalDrivers}
          sub={`${data.activeDrivers} ${t("workforce.active").toLowerCase()}`}
          icon={Users}
        />
        <StatCard
          label={t("workforce.activeDrivers")}
          value={data.activeDrivers}
          sub={t("workforce.activeOf").replace("{total}", String(data.totalDrivers))}
          icon={Users}
          valueColor="text-emerald-400"
        />
        <StatCard
          label={t("workforce.totalVehicles")}
          value={data.totalVehicles}
          sub={`${data.availableVehicles} ${t("workforce.available").toLowerCase()}`}
          icon={Truck}
        />
        <StatCard
          label={t("workforce.availableVehicles")}
          value={data.availableVehicles}
          sub={t("workforce.readyToAssign")}
          icon={Car}
          valueColor="text-emerald-400"
        />
        <StatCard
          label={t("workforce.assignedVehicles")}
          value={data.assignedVehicles}
          sub={t("workforce.currentlyInUse")}
          icon={Truck}
          valueColor="text-primary"
        />
        <StatCard
          label={t("workforce.inactiveVehicles")}
          value={data.inactiveVehicles}
          sub={t("workforce.offlineOrMaintenance")}
          icon={Activity}
          valueColor={data.inactiveVehicles > 0 ? "text-amber-400" : "text-muted-foreground"}
        />
      </div>

      {/* Recent Activity */}
      <div className="panel p-0 overflow-hidden bg-card">
        <div className="p-4 border-b border-border bg-muted/10">
          <h3 className="text-sm font-bold text-foreground">{t("workforce.recentActivity")}</h3>
          <p className="text-[11px] text-muted-foreground">{t("workforce.lastTenEvents")}</p>
        </div>
        <div>
          {data.recentActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4">{t("workforce.noRecentActivity")}</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 bg-muted/15 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                <span>{t("workforce.event")}</span>
                <span>{t("workforce.actor")}</span>
                <span>{t("workforce.target")}</span>
                <span className="text-right">{t("workforce.when")}</span>
              </div>
              {data.recentActivity.map((event) => (
                <div
                  key={event.auditId}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 sm:gap-4 px-4 py-3 border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors text-xs"
                >
                  <div>
                    <Badge variant="outline" className="text-[9px] font-bold border-border text-foreground uppercase">
                      {formatEventType(event.eventType)}
                    </Badge>
                  </div>
                  <p className="font-mono text-muted-foreground truncate self-center text-xs">{event.actorId}</p>
                  <p className="font-mono text-muted-foreground truncate self-center text-xs">{event.targetId}</p>
                  <p className="text-muted-foreground whitespace-nowrap self-center text-right text-[11px]">
                    {formatDistanceToNow(parseISO(event.timestamp), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Expirations */}
      <div className="panel p-5 bg-card space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">{t("workforce.upcomingExpirations")}</h3>
          <p className="text-[11px] text-muted-foreground">{t("workforce.expiringIn30Days")}</p>
        </div>
        <div>
          {!hasExpirations ? (
            <p className="text-xs text-muted-foreground">{t("workforce.noUpcomingExpirations")}</p>
          ) : (
            <div className="space-y-6">
              {upcomingExpirations.drivers.length > 0 && (
                <div className="space-y-2">
                  <p className="label-meta">{t("workforce.driverLicenses")}</p>
                  <div className="space-y-0 border border-border/50 rounded-lg overflow-hidden divide-y divide-border/40 text-xs">
                    {upcomingExpirations.drivers.map((driver) => {
                      const days = calcDaysUntil(driver.licenseExpiry);
                      return (
                        <div key={driver.driverId} className="flex items-center justify-between p-3 bg-muted/5">
                          <p className="font-bold text-foreground">{driver.fullName}</p>
                          <div className="flex items-center gap-3">
                            <p className="text-muted-foreground font-mono text-xs">{driver.licenseExpiry}</p>
                            <ExpiryDaysBadge daysUntil={days} t={t} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {upcomingExpirations.vehicles.length > 0 && (
                <div className="space-y-2">
                  <p className="label-meta">{t("workforce.vehicleDocuments")}</p>
                  <div className="space-y-0 border border-border/50 rounded-lg overflow-hidden divide-y divide-border/40 text-xs">
                    {upcomingExpirations.vehicles.map((vehicle) => (
                      <div key={vehicle.vehicleId} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-muted/5">
                        <p className="font-bold text-foreground font-mono">{vehicle.vehicleNumber}</p>
                        <p className="text-muted-foreground font-mono">Insurance: {vehicle.insuranceExpiry ?? "—"}</p>
                        <p className="text-muted-foreground font-mono">Permit: {vehicle.permitExpiry ?? "—"}</p>
                        <p className="text-muted-foreground font-mono">Fitness: {vehicle.fitnessExpiry ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
