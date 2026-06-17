"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertTriangle, RefreshCw } from "lucide-react";
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
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { useI18n } from "@/lib/i18n";
import { VehicleTable } from "@/components/workforce/VehicleTable";
import { VehicleForm } from "@/components/workforce/VehicleForm";
import { AssignDriverModal } from "@/components/workforce/AssignDriverModal";
import type { Vehicle } from "@/lib/types";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function VehicleListSkeleton() {
  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 p-6">
      <div className="pb-6 border-b border-border space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Skeleton className="h-9 flex-1 sm:max-w-xs" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-32 sm:ml-auto" />
      </div>
      <div className="rounded-md border border-border overflow-hidden">
        <div className="bg-muted/5 border-b border-border px-4 py-3 grid grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-3 w-full" />)}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-4 py-4 grid grid-cols-7 gap-4 border-b border-border/30 last:border-0">
            {Array.from({ length: 7 }).map((_, j) => <Skeleton key={j} className="h-4 w-full" />)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehicleManagementPage() {
  const router = useRouter();
  const { user } = useUser();
  const { userRecord, status } = useCompany();
  const { t } = useI18n();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [assignModalVehicle, setAssignModalVehicle] = useState<Vehicle | null>(null);

  const role = userRecord?.role;
  const canWrite = role !== undefined && !["dispatcher", "operations_manager"].includes(role);

  const fetchVehicles = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/workforce/vehicles", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }
      const json = await res.json();
      setVehicles(json.vehicles ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workforce.failedToLoadVehicles"));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    if (status === "loading" || !user) return;
    fetchVehicles();
  }, [user, status, fetchVehicles]);

  const patchVehicleStatus = useCallback(
    async (vehicleId: string, newStatus: "maintenance" | "available") => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/workforce/vehicles/${vehicleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Status update failed (${res.status})`);
        }
        await fetchVehicles();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Status update failed.");
      }
    },
    [user, fetchVehicles]
  );

  const filtered = vehicles.filter((v) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      q === "" || v.vehicleNumber.toLowerCase().includes(q) || v.vehicleType.toLowerCase().includes(q);
    return matchesSearch && (statusFilter === "all" || v.status === statusFilter);
  });

  if (loading) return <VehicleListSkeleton />;

  if (error) {
    return (
      <div className="max-w-7xl mx-auto w-full p-6">
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-card border border-border rounded-2xl">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">{t("workforce.failedToLoadVehicles")}</p>
            <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          </div>
          <Button variant="outline" className="gap-2 h-10 px-5 text-sm" onClick={fetchVehicles}>
            <RefreshCw className="w-4 h-4" />
            {t("workforce.retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 p-6">

      {/* Header */}
      <div className="pb-6 border-b border-border">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-bold">
          {t("workforce.workforce")}
        </p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          {t("workforce.vehicles")}
        </h1>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <Input
          placeholder={t("workforce.searchVehicles")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder={t("workforce.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("workforce.allStatuses")}</SelectItem>
            <SelectItem value="available">{t("workforce.available")}</SelectItem>
            <SelectItem value="assigned">{t("workforce.assigned")}</SelectItem>
            <SelectItem value="maintenance">{t("workforce.maintenance")}</SelectItem>
            <SelectItem value="inactive">{t("workforce.inactive")}</SelectItem>
          </SelectContent>
        </Select>
        {canWrite && (
          <Button className="sm:ml-auto gap-2 h-9" onClick={() => setAddModalOpen(true)}>
            <Plus className="w-4 h-4" />
            {t("workforce.addVehicle")}
          </Button>
        )}
      </div>

      {/* Vehicle table */}
      <VehicleTable
        vehicles={filtered}
        currentUserRole={role ?? "dispatcher"}
        onEdit={(vehicle) => setEditingVehicle(vehicle)}
        onAssignDriver={(vehicle) => setAssignModalVehicle(vehicle)}
        onMarkMaintenance={(vehicle) => patchVehicleStatus(vehicle.vehicleId, "maintenance")}
        onMarkAvailable={(vehicle) => patchVehicleStatus(vehicle.vehicleId, "available")}
        onRowClick={(vehicleId) => router.push(`/workforce/vehicles/${vehicleId}`)}
      />

      {/* Add vehicle modal */}
      <VehicleForm
        mode="add"
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={() => { setAddModalOpen(false); fetchVehicles(); }}
      />

      {/* Edit vehicle modal */}
      {editingVehicle && (
        <VehicleForm
          mode="edit"
          vehicle={editingVehicle}
          open={!!editingVehicle}
          onOpenChange={(open) => { if (!open) setEditingVehicle(null); }}
          onSuccess={() => { setEditingVehicle(null); fetchVehicles(); }}
        />
      )}

      {/* Assign driver modal */}
      {assignModalVehicle && (
        <AssignDriverModal
          vehicleId={assignModalVehicle.vehicleId}
          open={!!assignModalVehicle}
          onOpenChange={(open) => { if (!open) setAssignModalVehicle(null); }}
          onSuccess={() => { setAssignModalVehicle(null); fetchVehicles(); }}
        />
      )}
    </div>
  );
}
