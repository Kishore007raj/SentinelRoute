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
import type { Driver, UserRole } from "@/lib/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface DriverTableProps {
  drivers: Driver[];
  currentUserRole: UserRole;
  currentUserId: string;
  onEdit: (driver: Driver) => void;
  onSuspend: (driver: Driver) => void;
  onActivate: (driver: Driver) => void;
  onRowClick: (driverId: string) => void;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Driver["status"] }) {
  if (status === "active") {
    return (
      <Badge className="bg-emerald-400/10 text-emerald-600 border-emerald-400/30 dark:text-emerald-400">
        Active
      </Badge>
    );
  }
  if (status === "suspended") {
    return (
      <Badge className="bg-amber-400/10 text-amber-500 border-amber-400/30 dark:text-amber-400">
        Suspended
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

export function DriverTable({
  drivers,
  currentUserRole,
  currentUserId,
  onEdit,
  onSuspend,
  onActivate,
  onRowClick,
}: DriverTableProps) {
  const [suspendTarget, setSuspendTarget] = useState<Driver | null>(null);

  // Write access: dispatchers and operations_managers are read-only
  const canWrite = !["dispatcher", "operations_manager"].includes(currentUserRole);

  // ── Suspend confirm dialog ────────────────────────────────────────────────
  const handleSuspendConfirm = () => {
    if (suspendTarget) {
      onSuspend(suspendTarget);
      setSuspendTarget(null);
    }
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  if (drivers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border border-border rounded-2xl bg-card">
        <p className="text-sm font-medium text-foreground">No drivers found</p>
        <p className="text-xs text-muted-foreground">
          Add a driver or adjust your filters to see results.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">

        {/* Column headers */}
        <div className="hidden lg:grid grid-cols-[1.5fr_1fr_1fr_1.2fr_1fr_0.8fr_1fr_auto] gap-4 px-6 py-3 bg-muted/5 border-b border-border/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Driver Name
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Employee ID
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            License No.
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            License Expiry
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Phone
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Status
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Assigned Vehicle
          </span>
          {canWrite && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black text-right">
              Actions
            </span>
          )}
        </div>

        {/* Rows */}
        {drivers.map((driver) => (
          <div
            key={driver.driverId}
            className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr_1fr_0.8fr_1fr_auto] gap-3 lg:gap-4 px-6 py-4 border-b border-border/30 last:border-0 hover:bg-muted/5 transition-colors cursor-pointer"
            onClick={() => onRowClick(driver.driverId)}
            role="row"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRowClick(driver.driverId);
              }
            }}
            aria-label={`View profile for ${driver.fullName}`}
          >
            {/* Driver Name */}
            <div className="self-center">
              <p className="text-sm font-semibold text-foreground truncate">
                {driver.fullName}
              </p>
              {/* Mobile: show employee ID inline */}
              <p className="text-xs text-muted-foreground font-mono lg:hidden">
                {driver.employeeId || "—"}
              </p>
            </div>

            {/* Employee ID — hidden on mobile (shown inline above) */}
            <div className="hidden lg:flex items-center">
              <p className="text-sm text-muted-foreground font-mono truncate">
                {driver.employeeId || "—"}
              </p>
            </div>

            {/* License Number */}
            <div className="flex items-center gap-1 lg:gap-0">
              <span className="text-xs text-muted-foreground lg:hidden">License:</span>
              <p className="text-sm text-muted-foreground font-mono truncate">
                {driver.licenseNumber}
              </p>
            </div>

            {/* License Expiry + ExpiryBadge */}
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground font-mono">
                {driver.licenseExpiry}
              </p>
              <ExpiryBadge expiry={driver.licenseExpiry} mode="badge" />
            </div>

            {/* Phone */}
            <div className="flex items-center gap-1 lg:gap-0">
              <span className="text-xs text-muted-foreground lg:hidden">Phone:</span>
              <p className="text-sm text-muted-foreground truncate">
                {driver.phone}
              </p>
            </div>

            {/* Status */}
            <div className="flex items-center">
              <StatusBadge status={driver.status} />
            </div>

            {/* Assigned Vehicle */}
            <div className="flex items-center gap-1 lg:gap-0">
              <span className="text-xs text-muted-foreground lg:hidden">Vehicle:</span>
              {driver.assignedVehicleId ? (
                <p className="text-sm text-foreground font-mono truncate">
                  {driver.assignedVehicleId}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>

            {/* Actions */}
            {canWrite && (
              <div
                className="flex items-center justify-start lg:justify-end gap-2"
                // Prevent row click from firing when clicking action buttons
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="group"
                aria-label={`Actions for ${driver.fullName}`}
              >
                {/* Edit */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => onEdit(driver)}
                >
                  Edit
                </Button>

                {/* Suspend — active drivers only */}
                {driver.status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs text-amber-500 border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-500 hover:border-amber-400/60"
                    onClick={() => setSuspendTarget(driver)}
                  >
                    Suspend
                  </Button>
                )}

                {/* Activate — suspended drivers only */}
                {driver.status === "suspended" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs text-emerald-600 border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-600 hover:border-emerald-400/60 dark:text-emerald-400"
                    onClick={() => onActivate(driver)}
                  >
                    Activate
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Suspend confirmation dialog ───────────────────────────────────────── */}
      <Dialog
        open={suspendTarget !== null}
        onOpenChange={(open) => { if (!open) setSuspendTarget(null); }}
      >
        <DialogContent className="max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>Suspend Driver</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to suspend{" "}
            <span className="font-semibold text-foreground">
              {suspendTarget?.fullName}
            </span>
            ? This will unassign them from any vehicle and prevent new assignments
            until they are reactivated.
          </p>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-9 px-4 text-sm"
              onClick={() => setSuspendTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 px-4 text-sm bg-amber-500 hover:bg-amber-600 text-white border-0"
              onClick={handleSuspendConfirm}
            >
              Suspend Driver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
