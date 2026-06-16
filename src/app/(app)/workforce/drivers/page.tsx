"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, AlertTriangle, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { DriverTable } from "@/components/workforce/DriverTable";
import { DriverForm } from "@/components/workforce/DriverForm";
import type { Driver } from "@/lib/types";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 p-6">
      {/* Header */}
      <div className="pb-6 border-b border-border space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-56" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Skeleton className="h-10 flex-1 max-w-xs" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32 sm:ml-auto" />
      </div>

      {/* Table rows */}
      <Card className="bg-card border border-border rounded-2xl">
        <CardContent className="p-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-6 py-4 border-b border-border/30 last:border-0"
            >
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16 rounded-full ml-auto" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DriverManagementPage() {
  const router = useRouter();
  const { user } = useUser();
  const { userRecord, status } = useCompany();

  // ── List state ────────────────────────────────────────────────────────────
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | undefined>(undefined);

  // ── Role helpers ──────────────────────────────────────────────────────────
  const role = userRecord?.role;
  const isReadOnly =
    role === "dispatcher" || role === "operations_manager";

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchDrivers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/workforce/drivers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }
      const json = await res.json();
      setDrivers(json.drivers ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load drivers."
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Trigger fetch once auth + company context are resolved
  useEffect(() => {
    if (status === "loading" || !user) return;
    fetchDrivers();
  }, [user, status, fetchDrivers]);

  // ── Suspend ────────────────────────────────────────────────────────────────
  const handleSuspend = async (driver: Driver) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await fetch(`/api/workforce/drivers/${driver.driverId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "suspended" }),
      });
    } catch {
      // Errors are non-fatal — re-fetch will reflect current state
    } finally {
      fetchDrivers();
    }
  };

  // ── Activate ───────────────────────────────────────────────────────────────
  const handleActivate = async (driver: Driver) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await fetch(`/api/workforce/drivers/${driver.driverId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "active" }),
      });
    } catch {
      // Errors are non-fatal — re-fetch will reflect current state
    } finally {
      fetchDrivers();
    }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setModalOpen(true);
  };

  // ── Add ────────────────────────────────────────────────────────────────────
  const handleAdd = () => {
    setEditingDriver(undefined);
    setModalOpen(true);
  };

  // ── Row click → driver profile ─────────────────────────────────────────────
  const handleRowClick = (driverId: string) => {
    router.push(`/workforce/drivers/${driverId}`);
  };

  // ── Client-side filtering ─────────────────────────────────────────────────
  const filteredDrivers = drivers.filter((d) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      q === "" ||
      d.fullName.toLowerCase().includes(q) ||
      d.employeeId.toLowerCase().includes(q) ||
      d.licenseNumber.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "all" || d.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <PageSkeleton />;

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-7xl mx-auto w-full p-6">
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-card border border-border rounded-2xl">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">
              Failed to load drivers
            </p>
            <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          </div>
          <Button
            variant="outline"
            className="gap-2 h-10 px-5 text-sm"
            onClick={fetchDrivers}
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Populated ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 p-6">

      {/* Header */}
      <div className="pb-6 border-b border-border">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-bold">
          Workforce
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <UserCheck className="w-7 h-7 text-muted-foreground shrink-0" />
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Drivers
            </h1>
          </div>

          {/* Add Driver — hidden for read-only roles */}
          {!isReadOnly && (
            <Button
              onClick={handleAdd}
              className="gap-2 h-10 px-5 text-sm self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Add Driver
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar — search + status filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by name, employee ID, or license…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 max-w-md h-10 text-sm"
        />

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-44 h-10 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {/* Result count */}
        <p className="text-sm text-muted-foreground self-center sm:ml-auto whitespace-nowrap">
          {filteredDrivers.length}{" "}
          {filteredDrivers.length === 1 ? "driver" : "drivers"}
        </p>
      </div>

      {/* Driver table */}
      <DriverTable
        drivers={filteredDrivers}
        currentUserRole={role ?? "dispatcher"}
        currentUserId={userRecord?.userId ?? ""}
        onEdit={handleEdit}
        onSuspend={handleSuspend}
        onActivate={handleActivate}
        onRowClick={handleRowClick}
      />

      {/* Add / Edit form dialog */}
      <DriverForm
        mode={editingDriver ? "edit" : "add"}
        driver={editingDriver}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingDriver(undefined);
        }}
        onSuccess={fetchDrivers}
      />
    </div>
  );
}
