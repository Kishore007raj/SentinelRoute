"use client";
import { useEffect, useState } from "react";
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
  Package,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpiryBadge } from "@/components/workforce/ExpiryBadge";
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import type { Driver, WorkforceAudit } from "@/lib/types";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="max-w-5xl mx-auto w-full space-y-8 p-6">
      {/* Header */}
      <div className="pb-6 border-b border-border space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-card border border-border">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
        {label}
      </p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function DriverStatusBadge({ status }: { status: Driver["status"] }) {
  if (status === "active") {
    return (
      <Badge className="bg-emerald-400/10 text-emerald-600 border-emerald-400/30 dark:text-emerald-400">
        Active
      </Badge>
    );
  }
  if (status === "suspended") {
    return (
      <Badge className="bg-red-500/10 text-red-500 border-red-500/30 dark:text-red-400">
        Suspended
      </Badge>
    );
  }
  return (
    <Badge className="bg-muted/50 text-muted-foreground border-border">
      Inactive
    </Badge>
  );
}

// ─── Event type label ─────────────────────────────────────────────────────────

function formatEventType(eventType: string): string {
  return eventType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DriverProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { userRecord, status: companyStatus } = useCompany();

  const driverId = params?.id as string;

  const [driver, setDriver]               = useState<Driver | null>(null);
  const [audits, setAudits]               = useState<WorkforceAudit[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(false);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  const fetchAudits = async (token: string) => {
    setAuditsLoading(true);
    try {
      const res = await fetch(
        `/api/workforce/audits?targetId=${encodeURIComponent(driverId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return; // Audit failure is non-blocking — silently skip
      const json = await res.json();
      // Sort descending by timestamp (API already does this, but guard client-side too)
      const sorted: WorkforceAudit[] = (json.audits ?? []).sort(
        (a: WorkforceAudit, b: WorkforceAudit) =>
          b.timestamp.localeCompare(a.timestamp)
      );
      setAudits(sorted);
    } catch {
      // Audit fetch failure is non-critical — do not surface to user
    } finally {
      setAuditsLoading(false);
    }
  };

  const fetchDriver = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/workforce/drivers/${driverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));

        // Driver self-guard: if a driver role gets 403, redirect to drivers list
        // (cannot redirect to "own profile" without knowing own driverId,
        //  server-side enforcement via WORKFORCE_READ_ROLES already blocks cross-driver access)
        if (res.status === 403 && userRecord?.role === "driver") {
          router.replace("/workforce/drivers");
          return;
        }

        throw new Error(
          (body as { error?: string }).error ??
            `Request failed with status ${res.status}`
        );
      }

      const json = await res.json();
      const fetchedDriver: Driver = json.driver;
      setDriver(fetchedDriver);

      // Fetch audits in parallel once we have the driver record
      fetchAudits(token);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load driver profile."
      );
    } finally {
      setLoading(false);
    }
  };

  // Driver self-guard (pre-fetch): if role is driver and we know their driverId
  // differs from the URL param, redirect immediately without making the fetch.
  // Note: userRecord.userId is the Firebase UID and is NOT the driverId, so we
  // cannot pre-emptively redirect. The post-fetch guard (403 path above) handles it.
  useEffect(() => {
    if (companyStatus === "loading" || !user) return;
    fetchDriver();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, companyStatus, driverId]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return <ProfileSkeleton />;

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-5xl mx-auto w-full p-6">
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-card border border-border rounded-2xl">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">
              Failed to load driver profile
            </p>
            <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="gap-2 h-10 px-5 text-sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>
            <Button
              variant="outline"
              className="gap-2 h-10 px-5 text-sm"
              onClick={fetchDriver}
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!driver) return null;

  // ── Populated ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto w-full space-y-8 p-6">

      {/* ── Header ── */}
      <div className="pb-6 border-b border-border">
        <Link
          href="/workforce/drivers"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4 uppercase tracking-widest font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Drivers
        </Link>
        <div className="flex flex-wrap items-start gap-3 mt-1">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1 font-bold">
              Driver Profile
            </p>
            <h1 className="text-3xl font-bold text-foreground tracking-tight truncate">
              {driver.fullName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono">
              {driver.driverId}
            </p>
          </div>
          <DriverStatusBadge status={driver.status} />
        </div>
      </div>

      {/* ── Cards grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── 1. Personal Information (Req 12.1) ── */}
        <Card className="bg-card border border-border rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <User className="w-4 h-4 text-muted-foreground" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label="Full Name" value={driver.fullName} />
            <InfoRow
              label="Employee ID"
              value={
                <span className="font-mono">{driver.employeeId || "—"}</span>
              }
            />
            <InfoRow
              label="Phone"
              value={
                <span className="font-mono">{driver.phone || "—"}</span>
              }
            />
            <InfoRow
              label="Email"
              value={
                <span className="font-mono">{driver.email || "—"}</span>
              }
            />
            <InfoRow
              label="Blood Group"
              value={
                driver.bloodGroup ? (
                  <Badge variant="outline" className="font-mono text-xs">
                    {driver.bloodGroup}
                  </Badge>
                ) : (
                  "—"
                )
              }
            />
            <InfoRow
              label="Address"
              value={
                <span className="text-muted-foreground">
                  {driver.address || "—"}
                </span>
              }
            />
            <InfoRow
              label="Languages"
              value={
                driver.languagePreferences &&
                driver.languagePreferences.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {driver.languagePreferences.map((lang) => (
                      <Badge
                        key={lang}
                        variant="outline"
                        className="text-xs border-border text-muted-foreground"
                      >
                        {lang}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  "—"
                )
              }
            />
          </CardContent>
        </Card>

        {/* ── 2. Licence Information (Req 12.2) ── */}
        <Card className="bg-card border border-border rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              Licence Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow
              label="Licence Number"
              value={
                <span className="font-mono">
                  {driver.licenseNumber || "—"}
                </span>
              }
            />
            <InfoRow
              label="Licence Expiry"
              value={
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm">
                    {driver.licenseExpiry || "—"}
                  </span>
                  {driver.licenseExpiry && (
                    <ExpiryBadge
                      expiry={driver.licenseExpiry}
                      mode="indicator"
                    />
                  )}
                </div>
              }
            />
          </CardContent>
        </Card>

        {/* ── 3. Assignment Information (Req 12.3) ── */}
        <Card className="bg-card border border-border rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Truck className="w-4 h-4 text-muted-foreground" />
              Assignment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow
              label="Assigned Vehicle"
              value={
                driver.assignedVehicleId ? (
                  <Link
                    href={`/workforce/vehicles/${driver.assignedVehicleId}`}
                    className="font-mono text-sm text-primary hover:underline underline-offset-4 transition-colors"
                  >
                    {driver.assignedVehicleId}
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    No vehicle assigned
                  </span>
                )
              }
            />
            <InfoRow
              label="Preferred Language"
              value={
                <span className="font-mono">
                  {driver.preferredLanguage || "en"}
                </span>
              }
            />
          </CardContent>
        </Card>

        {/* ── 4. Audit History (Req 12.4) ── */}
        <Card className="bg-card border border-border rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Audit History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditsLoading ? (
              <div className="space-y-3 py-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex gap-4 py-2 border-b border-border/20 last:border-0"
                  >
                    <Skeleton className="h-4 w-32 shrink-0" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-24 shrink-0" />
                  </div>
                ))}
              </div>
            ) : audits.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No audit records found.
              </p>
            ) : (
              <div className="divide-y divide-border/30">
                {audits.map((audit) => (
                  <div
                    key={audit.auditId}
                    className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3"
                  >
                    {/* Event type + actor */}
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
                      {formatDistanceToNow(parseISO(audit.timestamp), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── Placeholder cards (Req 12.5 / 19.5) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Shipment History */}
        <Card className="bg-card border border-border rounded-2xl shadow-sm opacity-60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Package className="w-4 h-4 text-muted-foreground" />
              Shipment History
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Coming in Module 3 — Shipment Lifecycle
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-20 flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
              <p className="text-sm text-muted-foreground">
                Shipment history will be available in Module 3.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Communication Log */}
        <Card className="bg-card border border-border rounded-2xl shadow-sm opacity-60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              Communication Log
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Coming in Module 3 — Shipment Lifecycle
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-20 flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
              <p className="text-sm text-muted-foreground">
                Communication log will be available in Module 3.
              </p>
            </div>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
