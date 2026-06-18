"use client";

import { useEffect, useState } from "react";
import { Loader2, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/auth-context";
import type { Driver } from "@/lib/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AssignDriverModalProps {
  vehicleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AssignDriverModal({
  vehicleId,
  open,
  onOpenChange,
  onSuccess,
}: AssignDriverModalProps) {
  const { user } = useUser();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // ── Fetch available drivers when the dialog opens ─────────────────────────

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setDrivers([]);
      setSelectedDriverId(null);
      setAssignError(null);
      setFetchError(null);
      return;
    }

    let cancelled = false;

    async function fetchDrivers() {
      setFetchLoading(true);
      setFetchError(null);

      try {
        const token = user ? await user.getIdToken() : null;
        const res = await fetch("/api/workforce/drivers", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Failed to load drivers (${res.status})`);
        }

        const data = await res.json();
        const all: Driver[] = data.drivers ?? [];

        // Client-side filter: active AND not yet assigned to any vehicle
        const available = all.filter(
          (d) => d.status === "active" && d.assignedVehicleId === null
        );

        if (!cancelled) {
          setDrivers(available);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(
            err instanceof Error ? err.message : "Could not load drivers."
          );
        }
      } finally {
        if (!cancelled) setFetchLoading(false);
      }
    }

    fetchDrivers();

    return () => {
      cancelled = true;
    };
  }, [open, user]);

  // ── Assign selected driver to the vehicle ─────────────────────────────────

  async function handleAssign() {
    if (!selectedDriverId) return;

    setAssigning(true);
    setAssignError(null);

    try {
      const token = user ? await user.getIdToken() : null;
      const res = await fetch(`/api/workforce/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentDriverId: selectedDriverId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Assignment failed (${res.status})`);
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setAssignError(
        err instanceof Error ? err.message : "Assignment failed. Please try again."
      );
    } finally {
      setAssigning(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Driver</DialogTitle>
          <DialogDescription>
            Select an available driver to assign to this vehicle.
          </DialogDescription>
        </DialogHeader>

        {/* ── Driver list area ── */}
        <div className="min-h-[160px]">
          {fetchLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading drivers…</span>
            </div>
          )}

          {fetchError && !fetchLoading && (
            <p className="text-sm text-destructive py-6 text-center">{fetchError}</p>
          )}

          {!fetchLoading && !fetchError && drivers.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No available drivers. All active drivers are already assigned.
            </p>
          )}

          {!fetchLoading && !fetchError && drivers.length > 0 && (
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {drivers.map((driver) => {
                const selected = selectedDriverId === driver.driverId;
                return (
                  <li key={driver.driverId}>
                    <button
                      type="button"
                      onClick={() => setSelectedDriverId(driver.driverId)}
                      className={cn(
                        "w-full flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                        selected
                          ? "border-primary/60 bg-primary/8 text-foreground"
                          : "border-border/50 bg-transparent hover:border-border hover:bg-muted/30 text-foreground"
                      )}
                    >
                      <UserCheck
                        className={cn(
                          "mt-0.5 w-4 h-4 shrink-0",
                          selected ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {driver.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {driver.employeeId} · {driver.phone}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Inline 409 / assignment error ── */}
        {assignError && (
          <p className="text-sm text-destructive -mt-1">{assignError}</p>
        )}

        <DialogFooter showCloseButton>
          <Button
            onClick={handleAssign}
            disabled={!selectedDriverId || assigning}
            className="gap-2"
          >
            {assigning && <Loader2 className="w-4 h-4 animate-spin" />}
            {assigning ? "Assigning…" : "Assign Driver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
