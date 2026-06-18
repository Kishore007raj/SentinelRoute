"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ExpiryBadge } from "@/components/workforce/ExpiryBadge";
import type { Vehicle, UserRole } from "@/lib/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface VehicleTableProps {
  vehicles: Vehicle[];
  currentUserRole: UserRole;
  onEdit: (vehicle: Vehicle) => void;
  onAssignDriver: (vehicle: Vehicle) => void;
  onMarkMaintenance: (vehicle: Vehicle) => void;
  onMarkAvailable: (vehicle: Vehicle) => void;
  onRowClick: (vehicleId: string) => void;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Vehicle["status"] }) {
  if (status === "available") {
    return (
      <Badge className="bg-emerald-400/10 text-emerald-600 border-emerald-400/30 dark:text-emerald-400">
        Available
      </Badge>
    );
  }
  if (status === "assigned") {
    return (
      <Badge className="bg-blue-400/10 text-blue-600 border-blue-400/30 dark:text-blue-400">
        Assigned
      </Badge>
    );
  }
  if (status === "maintenance") {
    return (
      <Badge className="bg-amber-400/10 text-amber-500 border-amber-400/30 dark:text-amber-400">
        Maintenance
      </Badge>
    );
  }
  // inactive
  return (
    <Badge variant="outline" className="text-muted-foreground border-border">
      Inactive
    </Badge>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VehicleTable({
  vehicles,
  currentUserRole,
  onEdit,
  onAssignDriver,
  onMarkMaintenance,
  onMarkAvailable,
  onRowClick,
}: VehicleTableProps) {
  const [maintenanceTarget, setMaintenanceTarget] = useState<Vehicle | null>(null);

  // Write access: dispatchers, operations_managers, and drivers are read-only
  const canWrite = !["dispatcher", "operations_manager", "driver"].includes(currentUserRole);

  // ── Maintenance confirm ───────────────────────────────────────────────────
  const handleMaintenanceConfirm = () => {
    if (maintenanceTarget) {
      onMarkMaintenance(maintenanceTarget);
      setMaintenanceTarget(null);
    }
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  if (vehicles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border border-border rounded-2xl bg-card">
        <p className="text-sm font-medium text-foreground">No vehicles found</p>
        <p className="text-xs text-muted-foreground">
          Add a vehicle or adjust your filters to see results.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">

        {/* Column headers */}
        <div className="hidden lg:grid grid-cols-[1.2fr_1fr_0.8fr_1.2fr_1.2fr_1.2fr_0.8fr_auto] gap-4 px-6 py-3 bg-muted/5 border-b border-border/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Vehicle No.
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Type
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Capacity
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Current Driver
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Insurance Expiry
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Permit Expiry
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Status
          </span>
          {canWrite && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black text-right">
              Actions
            </span>
          )}
        </div>

        {/* Rows */}
        {vehicles.map((vehicle) => (
          <div
            key={vehicle.vehicleId}
            className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_0.8fr_1.2fr_1.2fr_1.2fr_0.8fr_auto] gap-3 lg:gap-4 px-6 py-4 border-b border-border/30 last:border-0 hover:bg-muted/5 transition-colors cursor-pointer"
            onClick={() => onRowClick(vehicle.vehicleId)}
            role="row"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRowClick(vehicle.vehicleId);
              }
            }}
            aria-label={`View profile for ${vehicle.vehicleNumber}`}
          >
            {/* Vehicle Number */}
            <div className="self-center">
              <p className="text-sm font-semibold text-foreground font-mono truncate">
                {vehicle.vehicleNumber}
              </p>
              {/* Mobile: show type inline */}
              <p className="text-xs text-muted-foreground lg:hidden">
                {vehicle.vehicleType}
              </p>
            </div>

            {/* Type — hidden on mobile (shown inline above) */}
            <div className="hidden lg:flex items-center">
              <p className="text-sm text-muted-foreground truncate">
                {vehicle.vehicleType}
              </p>
            </div>

            {/* Capacity */}
            <div className="flex items-center gap-1 lg:gap-0">
              <span className="text-xs text-muted-foreground lg:hidden">Capacity:</span>
              <p className="text-sm text-muted-foreground truncate">
                {vehicle.capacity}
              </p>
            </div>

            {/* Current Driver */}
            <div className="flex items-center gap-1 lg:gap-0">
              <span className="text-xs text-muted-foreground lg:hidden">Driver:</span>
              {vehicle.currentDriverId ? (
                <p className="text-sm text-foreground font-mono truncate">
                  {vehicle.currentDriverId}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>

            {/* Insurance Expiry + ExpiryBadge */}
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground font-mono">
                {vehicle.insuranceExpiry}
              </p>
              <ExpiryBadge expiry={vehicle.insuranceExpiry} mode="badge" />
            </div>

            {/* Permit Expiry + ExpiryBadge */}
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground font-mono">
                {vehicle.permitExpiry}
              </p>
              <ExpiryBadge expiry={vehicle.permitExpiry} mode="badge" />
            </div>

            {/* Status */}
            <div className="flex items-center">
              <StatusBadge status={vehicle.status} />
            </div>

            {/* Actions */}
            {canWrite && (
              <div
                className="flex items-center justify-start lg:justify-end gap-2"
                // Prevent row click from firing when clicking action buttons
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="group"
                aria-label={`Actions for ${vehicle.vehicleNumber}`}
              >
                {/* Edit */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => onEdit(vehicle)}
                >
                  Edit
                </Button>

                {/* Assign Driver — available and assigned rows */}
                {(vehicle.status === "available" || vehicle.status === "assigned") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs text-blue-600 border-blue-400/40 hover:bg-blue-400/10 hover:text-blue-600 hover:border-blue-400/60 dark:text-blue-400"
                    onClick={() => onAssignDriver(vehicle)}
                  >
                    Assign Driver
                  </Button>
                )}

                {/* Mark Maintenance — available and assigned rows */}
                {(vehicle.status === "available" || vehicle.status === "assigned") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs text-amber-500 border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-500 hover:border-amber-400/60"
                    onClick={() => setMaintenanceTarget(vehicle)}
                  >
                    Maintenance
                  </Button>
                )}

                {/* Mark Available — maintenance rows only */}
                {vehicle.status === "maintenance" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs text-emerald-600 border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-600 hover:border-emerald-400/60 dark:text-emerald-400"
                    onClick={() => onMarkAvailable(vehicle)}
                  >
                    Mark Available
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Mark Maintenance confirmation dialog ──────────────────────────────── */}
      <Dialog
        open={maintenanceTarget !== null}
        onOpenChange={(open) => { if (!open) setMaintenanceTarget(null); }}
      >
        <DialogContent className="max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>Mark as Maintenance</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to mark{" "}
            <span className="font-semibold text-foreground">
              {maintenanceTarget?.vehicleNumber}
            </span>{" "}
            as under maintenance? This will make it unavailable for new
            assignments until marked available again.
          </p>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-9 px-4 text-sm"
              onClick={() => setMaintenanceTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 px-4 text-sm bg-amber-500 hover:bg-amber-600 text-white border-0"
              onClick={handleMaintenanceConfirm}
            >
              Mark as Maintenance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
