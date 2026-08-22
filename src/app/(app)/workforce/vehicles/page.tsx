"use client";

import { fetchApi } from "@/lib/api-client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertTriangle, RefreshCw, Truck } from "lucide-react";
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

function VehicleListSkeleton() {
  return (
    <div className="max-w-7xl mx-auto w-full space-y-7">
      <div className="pb-6 border-b border-border space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Skeleton className="h-10 flex-1 max-w-xs" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="panel p-5 bg-card space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

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
  const [complianceIssues, setComplianceIssues] = useState<any[]>([]);
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
      const res = await fetchApi("/api/workforce/vehicles", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }
      const json = await res.json();
      setVehicles(json.vehicles ?? []);
      
      const compRes = await fetchApi("/api/workforce/vehicles/compliance", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (compRes.ok) {
        const compJson = await compRes.json();
        setComplianceIssues(compJson.complianceIssues ?? []);
      }
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
        await fetchApi(`/api/workforce/vehicles/${vehicleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: newStatus }),
        });
      } catch {
        /* non-fatal */
      } finally {
        fetchVehicles();
      }
    },
    [user, fetchVehicles]
  );

  const handleEdit = (vehicle: Vehicle) => setEditingVehicle(vehicle);
  const handleAssign = (vehicle: Vehicle) => setAssignModalVehicle(vehicle);
  const handleMaintenance = (vehicle: Vehicle) => patchVehicleStatus(vehicle.vehicleId, "maintenance");
  const handleMarkAvailable = (vehicle: Vehicle) => patchVehicleStatus(vehicle.vehicleId, "available");
  const handleRowClick = (vehicleId: string) => router.push(`/workforce/vehicles/${vehicleId}`);

  const filteredVehicles = vehicles.filter((v) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      q === "" ||
      v.vehicleNumber.toLowerCase().includes(q) ||
      v.vehicleType.toLowerCase().includes(q) ||
      v.fuelType.toLowerCase().includes(q);
    return matchesSearch && (statusFilter === "all" || v.status === statusFilter);
  });

  if (loading) return <VehicleListSkeleton />;

  if (error) {
    return (
      <div className="max-w-7xl mx-auto w-full">
        <div className="panel p-12 text-center space-y-4 border border-dashed border-border/70">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">{t("workforce.failedToLoadVehicles")}</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
          </div>
          <Button variant="outline" className="gap-2 h-9 px-4 text-xs font-bold uppercase tracking-wider" onClick={fetchVehicles}>
            <RefreshCw className="w-3.5 h-3.5" />
            {t("workforce.retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full space-y-7 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <p className="label-meta flex items-center gap-2 mb-2">
            <Truck className="w-3.5 h-3.5 text-primary" />
            {t("workforce.workforce")}
          </p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("workforce.vehicles")}</h1>
        </div>

        {canWrite && (
          <Button onClick={() => setAddModalOpen(true)} className="h-10 px-4 text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
            <Plus className="w-3.5 h-3.5" />
            {t("workforce.addVehicle")}
          </Button>
        )}
      </div>

      {complianceIssues.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-5 h-5" />
            Compliance Alerts ({complianceIssues.length} vehicles)
          </div>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {complianceIssues.map(issue => (
              <li key={issue.vehicleId}>
                <span className="font-semibold">{issue.registrationNumber}</span>: {issue.issues.map((i: any) => `${i.type} (${i.status})`).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1 max-w-md">
          <Input
            placeholder={t("workforce.searchVehicles")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 bg-muted/20 border-border text-xs font-medium rounded-lg"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="w-full sm:w-44 h-10 bg-muted/20 border-border text-xs font-medium">
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
        </div>

        <p className="text-xs text-muted-foreground self-center font-mono font-medium">
          {filteredVehicles.length}{" "}
          {filteredVehicles.length === 1 ? t("workforce.vehicle") : t("workforce.vehicles").toLowerCase()}
        </p>
      </div>

      {/* Vehicle table */}
      <div className="panel p-0 overflow-hidden bg-card">
        <VehicleTable
          vehicles={filteredVehicles}
          currentUserRole={role ?? "dispatcher"}
          onEdit={handleEdit}
          onAssignDriver={handleAssign}
          onMarkMaintenance={handleMaintenance}
          onMarkAvailable={handleMarkAvailable}
          onRowClick={handleRowClick}
        />
      </div>

      {/* Add form modal */}
      <VehicleForm
        mode="add"
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={fetchVehicles}
      />

      {/* Edit form modal */}
      {editingVehicle && (
        <VehicleForm
          mode="edit"
          vehicle={editingVehicle}
          open={Boolean(editingVehicle)}
          onOpenChange={(open) => {
            if (!open) setEditingVehicle(null);
          }}
          onSuccess={fetchVehicles}
        />
      )}

      {/* Assign driver modal */}
      {assignModalVehicle && (
        <AssignDriverModal
          vehicleId={assignModalVehicle.vehicleId}
          open={Boolean(assignModalVehicle)}
          onOpenChange={(open) => {
            if (!open) setAssignModalVehicle(null);
          }}
          onSuccess={fetchVehicles}
        />
      )}
    </div>
  );
}
