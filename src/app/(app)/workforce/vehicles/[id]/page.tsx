"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  ArrowLeft,
  Truck,
  User,
  ShieldCheck,
  FileText,
  Activity,
  MapPin,
  AlertTriangle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpiryBadge } from "@/components/workforce/ExpiryBadge";
import { useUser } from "@/lib/auth-context";
import type { Vehicle, WorkforceAudit } from "@/lib/types";

// ─── Status badge colours ─────────────────────────────────────────────────────

function VehicleStatusBadge({ status }: { status: Vehicle["status"] }) {
  const map: Record<Vehicle["status"], string> = {
    available:   "bg-emerald-400/10 text-emerald-600 border-emerald-400/30 dark:text-emerald-400",
    assigned:    "bg-primary/10 text-primary border-primary/30",
    maintenance: "bg-amber-400/10 text-amber-500 border-amber-400/30 dark:text-amber-400",
    inactive:    "bg-muted text-muted-foreground border-border",
  };
  const label: Record<Vehicle["status"], string> = {
    available:   "Available",
    assigned:    "Assigned",
    maintenance: "Maintenance",
    inactive:    "Inactive",
  };
  return (
    <Badge className={map[status]}>
      {label[status]}
    </Badge>
  );
}

// ─── Event type label ─────────────────────────────────────────────────────────

function formatEventType(eventType: string): string {
  return eventType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Label / value row ────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-3 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground uppercase tracking-widest font-black w-44 shrink-0 pt-0.5">
        {label}
      </span>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function VehicleProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 p-6">
      {/* Back + header */}
      <div className="pb-6 border-b border-border space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Cards */}
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="bg-card border border-border rounded-2xl">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex gap-4 py-2 border-b border-border/20 last:border-0">
                <Skeleton className="h-4 w-36 shrink-0" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehicleProfilePage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { user } = useUser();

  const [vehicle, setVehicle]         = useState<Vehicle | null>(null);
  const [audits, setAudits]           = useState<WorkforceAudit[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const fetchVehicle = async () => {
    if (!user || !id) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/workforce/vehicles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Request failed with status ${res.status}`);
      }
      const json = await res.json();
      setVehicle(json.vehicle ?? json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vehicle profile.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAudits = async () => {
    if (!user || !id) return;
    setAuditsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/workforce/audits?targetId=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return; // Audit failure is non-blocking — silently skip
      const json = await res.json();
      setAudits(json.audits ?? []);
    } catch {
      // Audit fetch failure is non-critical — do not surface to user
    } finally {
      setAuditsLoading(false);
    }
  };

  useEffect(() => {
    if (user && id) {
      fetchVehicle();
      fetchAudits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return <VehicleProfileSkeleton />;

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !vehicle) {
    return (
      <div className="max-w-4xl mx-auto w-full p-6">
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-card border border-border rounded-2xl">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Failed to load vehicle profile</p>
            <p className="text-sm text-muted-foreground max-w-sm">{error ?? "Vehicle not found."}</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="gap-2 h-10 px-5 text-sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>
            {error && (
              <Button
                variant="outline"
                className="gap-2 h-10 px-5 text-sm"
                onClick={() => { fetchVehicle(); fetchAudits(); }}
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Populated ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 p-6">

      {/* ── Header ── */}
      <div className="pb-6 border-b border-border">
        <Link
          href="/workforce/vehicles"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4 uppercase tracking-widest font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Vehicles
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-foreground tracking-tight font-mono">
            {vehicle.vehicleNumber}
          </h1>
          <VehicleStatusBadge status={vehicle.status} />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {vehicle.vehicleType} · {vehicle.capacity}
        </p>
      </div>

      {/* ── 1. Vehicle Details ── */}
      <Card className="bg-card border border-border rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Truck className="w-4 h-4 text-muted-foreground" />
            Vehicle Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <DetailRow label="Vehicle Number">
            <span className="font-mono">{vehicle.vehicleNumber}</span>
          </DetailRow>
          <DetailRow label="Vehicle Type">{vehicle.vehicleType}</DetailRow>
          <DetailRow label="Capacity">{vehicle.capacity}</DetailRow>
          <DetailRow label="Fuel Type">{vehicle.fuelType || "—"}</DetailRow>
          <DetailRow label="Status">
            <VehicleStatusBadge status={vehicle.status} />
          </DetailRow>
        </CardContent>
      </Card>

      {/* ── 2. Assignment Details ── */}
      <Card className="bg-card border border-border rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <User className="w-4 h-4 text-muted-foreground" />
            Assignment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <DetailRow label="Current Driver">
            {vehicle.currentDriverId ? (
              <Link
                href={`/workforce/drivers/${vehicle.currentDriverId}`}
                className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors font-mono text-sm"
              >
                {vehicle.currentDriverId}
              </Link>
            ) : (
              <span className="text-muted-foreground">No driver assigned</span>
            )}
          </DetailRow>
        </CardContent>
      </Card>

      {/* ── 3. Insurance Information ── */}
      <Card className="bg-card border border-border rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            Insurance Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <DetailRow label="Policy Number">
            <span className="font-mono">{vehicle.insuranceNumber || "—"}</span>
          </DetailRow>
          <DetailRow label="Expiry Date">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{vehicle.insuranceExpiry || "—"}</span>
              {vehicle.insuranceExpiry && (
                <ExpiryBadge expiry={vehicle.insuranceExpiry} mode="indicator" />
              )}
            </div>
          </DetailRow>
        </CardContent>
      </Card>

      {/* ── 4. Permit Information ── */}
      <Card className="bg-card border border-border rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Permit Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <DetailRow label="Permit Expiry">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{vehicle.permitExpiry || "—"}</span>
              {vehicle.permitExpiry && (
                <ExpiryBadge expiry={vehicle.permitExpiry} mode="indicator" />
              )}
            </div>
          </DetailRow>
        </CardContent>
      </Card>

      {/* ── 5. Fitness Information ── */}
      <Card className="bg-card border border-border rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Activity className="w-4 h-4 text-muted-foreground" />
            Fitness Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <DetailRow label="Fitness Expiry">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{vehicle.fitnessExpiry || "—"}</span>
              {vehicle.fitnessExpiry && (
                <ExpiryBadge expiry={vehicle.fitnessExpiry} mode="indicator" />
              )}
            </div>
          </DetailRow>
        </CardContent>
      </Card>

      {/* ── 6. Audit History ── */}
      <Card className="bg-card border border-border rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Audit History
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {auditsLoading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4 py-2 border-b border-border/20 last:border-0">
                  <Skeleton className="h-4 w-32 shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24 shrink-0" />
                </div>
              ))}
            </div>
          ) : audits.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No audit records found.</p>
          ) : (
            <div className="divide-y divide-border/30">
              {audits.map((audit) => (
                <div key={audit.auditId} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3">
                  {/* Event type */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {formatEventType(audit.eventType)}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      by {audit.actorId}
                    </p>
                  </div>
                  {/* Timestamp */}
                  <p
                    className="text-xs text-muted-foreground shrink-0 whitespace-nowrap"
                    title={audit.timestamp}
                  >
                    {formatDistanceToNow(parseISO(audit.timestamp), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 7. Live Tracking placeholder ── */}
      <Card className="bg-card border border-border rounded-2xl shadow-sm opacity-60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            Live Tracking
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Mappls Integration — Coming in Module 4
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-32 flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
            <p className="text-sm text-muted-foreground">
              Real-time GPS tracking will be available in Module 4.
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
