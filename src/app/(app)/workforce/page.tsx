"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Users, Car, Truck, Activity, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { useI18n } from "@/lib/i18n";
import { calcDaysUntil } from "@/components/workforce/ExpiryBadge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 p-6">
      <div className="pb-6 border-b border-border space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-card border border-border">
            <CardHeader className="pb-2"><Skeleton className="h-3 w-28" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-card border border-border">
        <CardHeader><Skeleton className="h-5 w-36" /></CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2 border-b border-border/30 last:border-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  sub?: string;
  valueColor?: string;
  icon: React.ElementType;
}

function StatCard({ label, value, sub, valueColor, icon: Icon }: StatCardProps) {
  return (
    <Card className="bg-card border border-border rounded-2xl shadow-sm hover:border-border/60 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            {label}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className={cn("text-4xl font-black tabular-nums tracking-tight", valueColor ?? "text-foreground")}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground font-medium">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Event type label ─────────────────────────────────────────────────────────

function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Expiry row badge ─────────────────────────────────────────────────────────

function ExpiryDaysBadge({ daysUntil, t }: { daysUntil: number; t: (k: string) => string }) {
  if (daysUntil < 0) {
    return (
      <Badge className="bg-red-500/10 text-red-500 border-red-500/30 dark:text-red-400 text-xs">
        {t("workforce.expired")}
      </Badge>
    );
  }
  if (daysUntil === 0) {
    return (
      <Badge className="bg-red-500/10 text-red-500 border-red-500/30 dark:text-red-400 text-xs">
        {t("workforce.expiresToday")}
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-400/10 text-amber-500 border-amber-400/30 dark:text-amber-400 text-xs">
      {t("workforce.daysLeft").replace("{n}", String(daysUntil))}
    </Badge>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
      const res = await fetch("/api/workforce/dashboard", {
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
      <div className="max-w-7xl mx-auto w-full p-6">
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-card border border-border rounded-2xl">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">{t("workforce.failedToLoadDashboard")}</p>
            <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          </div>
          <Button variant="outline" className="gap-2 h-10 px-5 text-sm" onClick={fetchDashboard}>
            <RefreshCw className="w-4 h-4" />
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
    <div className="max-w-7xl mx-auto w-full space-y-10 p-6">

      {/* Header */}
      <div className="pb-6 border-b border-border">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-bold">
          {t("workforce.operations")}
        </p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("workforce.dashboard")}</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard label={t("workforce.totalDrivers")} value={data.totalDrivers}
          sub={`${data.activeDrivers} ${t("workforce.active").toLowerCase()}`} icon={Users} />
        <StatCard label={t("workforce.activeDrivers")} value={data.activeDrivers}
          sub={t("workforce.activeOf").replace("{total}", String(data.totalDrivers))}
          icon={Users} valueColor="text-emerald-400" />
        <StatCard label={t("workforce.totalVehicles")} value={data.totalVehicles}
          sub={`${data.availableVehicles} ${t("workforce.available").toLowerCase()}`} icon={Truck} />
        <StatCard label={t("workforce.availableVehicles")} value={data.availableVehicles}
          sub={t("workforce.readyToAssign")} icon={Car} valueColor="text-emerald-400" />
        <StatCard label={t("workforce.assignedVehicles")} value={data.assignedVehicles}
          sub={t("workforce.currentlyInUse")} icon={Truck} valueColor="text-primary" />
        <StatCard label={t("workforce.inactiveVehicles")} value={data.inactiveVehicles}
          sub={t("workforce.offlineOrMaintenance")} icon={Activity}
          valueColor={data.inactiveVehicles > 0 ? "text-amber-400" : "text-muted-foreground"} />
      </div>

      {/* Recent Activity */}
      <Card className="bg-card border border-border rounded-2xl shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-foreground">{t("workforce.recentActivity")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("workforce.lastTenEvents")}</p>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-6">{t("workforce.noRecentActivity")}</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-muted/5 border-b border-border/40">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{t("workforce.event")}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{t("workforce.actor")}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{t("workforce.target")}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black text-right">{t("workforce.when")}</span>
              </div>
              {data.recentActivity.map((event) => (
                <div key={event.auditId}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 sm:gap-4 px-6 py-4 border-b border-border/30 last:border-0 hover:bg-muted/5 transition-colors">
                  <div>
                    <Badge variant="outline" className="text-[10px] font-semibold border-border text-foreground">
                      {formatEventType(event.eventType)}
                    </Badge>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground truncate self-center">{event.actorId}</p>
                  <p className="text-xs font-mono text-muted-foreground truncate self-center">{event.targetId}</p>
                  <p className="text-xs text-muted-foreground whitespace-nowrap self-center text-right">
                    {formatDistanceToNow(parseISO(event.timestamp), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Expirations */}
      <Card className="bg-card border border-border rounded-2xl shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-foreground">{t("workforce.upcomingExpirations")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("workforce.expiringIn30Days")}</p>
        </CardHeader>
        <CardContent>
          {!hasExpirations ? (
            <p className="text-sm text-muted-foreground">{t("workforce.noUpcomingExpirations")}</p>
          ) : (
            <div className="space-y-8">
              {upcomingExpirations.drivers.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-black">
                    {t("workforce.driverLicenses")}
                  </p>
                  <div className="space-y-0">
                    <div className="hidden sm:grid grid-cols-[1fr_1fr_auto] gap-4 py-2 border-b border-border/40">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{t("workforce.driver")}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{t("workforce.expiryDate")}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black text-right">{t("workforce.status")}</span>
                    </div>
                    {upcomingExpirations.drivers.map((driver) => {
                      const days = calcDaysUntil(driver.licenseExpiry);
                      return (
                        <div key={driver.driverId}
                          className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 sm:gap-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/5 transition-colors">
                          <p className="text-sm font-medium text-foreground">{driver.fullName}</p>
                          <p className="text-sm text-muted-foreground font-mono">{driver.licenseExpiry}</p>
                          <div className="flex justify-start sm:justify-end">
                            <ExpiryDaysBadge daysUntil={days} t={t} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {upcomingExpirations.vehicles.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-black">
                    {t("workforce.vehicleDocuments")}
                  </p>
                  <div className="space-y-0">
                    <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr] gap-4 py-2 border-b border-border/40">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{t("workforce.vehicle")}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{t("workforce.insurance")}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{t("workforce.permit")}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{t("workforce.fitness")}</span>
                    </div>
                    {upcomingExpirations.vehicles.map((vehicle) => (
                      <div key={vehicle.vehicleId}
                        className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr] gap-2 sm:gap-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/5 transition-colors">
                        <p className="text-sm font-medium text-foreground font-mono">{vehicle.vehicleNumber}</p>
                        <p className="text-sm text-muted-foreground font-mono">{vehicle.insuranceExpiry ?? "—"}</p>
                        <p className="text-sm text-muted-foreground font-mono">{vehicle.permitExpiry ?? "—"}</p>
                        <p className="text-sm text-muted-foreground font-mono">{vehicle.fitnessExpiry ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
