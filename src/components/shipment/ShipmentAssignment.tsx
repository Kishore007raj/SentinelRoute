"use client";
/**
 * ShipmentAssignment - allows dispatchers to assign a driver + vehicle to a shipment.
 *
 * - Fetches available drivers (active, not suspended) and available vehicles from the company
 * - Validates availability client-side before submit
 * - Calls POST /api/shipments/[id]/assign
 * - Propagates the updated shipment upward via onAssigned callback
 */
import { useState, useEffect, useCallback } from "react";
import { User, Truck, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/auth-context";
import type { Shipment, Driver, Vehicle } from "@/lib/types";

interface Props {
  shipment: Shipment;
  onAssigned?: (updated: Shipment) => void;
}

export function ShipmentAssignment({ shipment, onAssigned }: Props) {
  const { user } = useUser();

  const [drivers,  setDrivers]  = useState<Omit<Driver, "aadhaarNumber">[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedDriver,  setSelectedDriver]  = useState<string>(shipment.assignedDriverId  ?? "");
  const [selectedVehicle, setSelectedVehicle] = useState<string>(shipment.assignedVehicleId ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState(false);

  const canEdit =
    shipment.status !== "completed" && shipment.status !== "cancelled";

  const today = new Date().toISOString().split("T")[0];

  const fetchResources = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [dRes, vRes] = await Promise.all([
        fetch("/api/workforce/drivers",  { headers }),
        fetch("/api/workforce/vehicles", { headers }),
      ]);

      if (dRes.ok) {
        const d = await dRes.json();
        setDrivers((d.drivers ?? []).filter((dr: Omit<Driver, "aadhaarNumber">) =>
          dr.status === "active" && dr.licenseExpiry >= today
        ));
      }
      if (vRes.ok) {
        const v = await vRes.json();
        setVehicles((v.vehicles ?? []).filter((vh: Vehicle) =>
          (vh.status === "available" || vh.vehicleId === shipment.assignedVehicleId) &&
          (!vh.insuranceExpiry || vh.insuranceExpiry >= today) &&
          (!vh.fitnessExpiry   || vh.fitnessExpiry   >= today) &&
          (!vh.permitExpiry    || vh.permitExpiry     >= today)
        ));
      }
    } catch {
      // silent - UI degrades gracefully
    } finally {
      setLoadingData(false);
    }
  }, [user, today, shipment.assignedVehicleId]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  const handleSave = async () => {
    if (!user) return;
    if (!selectedDriver && !selectedVehicle) {
      setError("Select at least a driver or vehicle");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/shipments/${shipment.id}/assign`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          driverId:  selectedDriver  || undefined,
          vehicleId: selectedVehicle || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Assignment failed");
        return;
      }

      setSuccess(true);
      onAssigned?.(data.shipment);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Network error - could not save assignment");
    } finally {
      setSubmitting(false);
    }
  };

  const isAlreadyAssigned = !!shipment.assignedDriverId || !!shipment.assignedVehicleId;

  return (
    <div className="panel p-7 space-y-6">
      <div className="flex items-center justify-between">
        <p className="label-meta">Crew &amp; Vehicle Assignment</p>
        {isAlreadyAssigned && (
          <span className="text-[10px] text-emerald-400 border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 rounded-full">
            Assigned
          </span>
        )}
      </div>

      {/* Current assignment summary */}
      {isAlreadyAssigned && (
        <div className="flex flex-wrap gap-4 py-4 border-y border-border/40">
          {shipment.assignedDriverName && (
            <div className="flex items-center gap-2.5 text-sm">
              <User className="w-4 h-4 text-primary shrink-0" />
              <span className="text-foreground font-medium">{shipment.assignedDriverName}</span>
            </div>
          )}
          {shipment.assignedVehicleNumber && (
            <div className="flex items-center gap-2.5 text-sm">
              <Truck className="w-4 h-4 text-primary shrink-0" />
              <span className="text-foreground font-medium">{shipment.assignedVehicleNumber}</span>
            </div>
          )}
        </div>
      )}

      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          Assignment is locked for {shipment.status} shipments.
        </p>
      ) : loadingData ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading available crew…
        </div>
      ) : (
        <div className="space-y-5">
          {/* Driver selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> Driver
            </p>
            {drivers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No active drivers with valid licence available</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {/* Clear option */}
                <button
                  onClick={() => setSelectedDriver("")}
                  className={cn(
                    "px-3 py-2 text-xs font-medium border rounded-lg transition-all",
                    !selectedDriver
                      ? "bg-primary/10 border-primary/50 text-primary"
                      : "bg-transparent border-border/50 text-muted-foreground hover:border-border"
                  )}
                >
                  Unassigned
                </button>
                {drivers.map((d) => (
                  <button
                    key={d.driverId}
                    onClick={() => setSelectedDriver(d.driverId)}
                    className={cn(
                      "px-3 py-2 text-xs font-medium border rounded-lg transition-all",
                      selectedDriver === d.driverId
                        ? "bg-primary/10 border-primary/50 text-primary"
                        : "bg-transparent border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    {selectedDriver === d.driverId && <CheckCircle className="w-3 h-3 inline mr-1" />}
                    {d.fullName}
                    <span className="ml-1 opacity-60">· {d.licenseNumber}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Vehicle selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="w-3.5 h-3.5" /> Vehicle
            </p>
            {vehicles.length === 0 ? (
              <p className="text-xs text-muted-foreground">No available vehicles with valid documents</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedVehicle("")}
                  className={cn(
                    "px-3 py-2 text-xs font-medium border rounded-lg transition-all",
                    !selectedVehicle
                      ? "bg-primary/10 border-primary/50 text-primary"
                      : "bg-transparent border-border/50 text-muted-foreground hover:border-border"
                  )}
                >
                  Unassigned
                </button>
                {vehicles.map((v) => (
                  <button
                    key={v.vehicleId}
                    onClick={() => setSelectedVehicle(v.vehicleId)}
                    className={cn(
                      "px-3 py-2 text-xs font-medium border rounded-lg transition-all",
                      selectedVehicle === v.vehicleId
                        ? "bg-primary/10 border-primary/50 text-primary"
                        : "bg-transparent border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    {selectedVehicle === v.vehicleId && <CheckCircle className="w-3 h-3 inline mr-1" />}
                    {v.vehicleNumber}
                    <span className="ml-1 opacity-60">· {v.vehicleType}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error / success */}
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-400/5 border border-emerald-400/20 rounded-lg px-4 py-3">
              <CheckCircle className="w-4 h-4" /> Assignment saved successfully
            </div>
          )}

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={submitting || (!selectedDriver && !selectedVehicle)}
            className="h-10 px-6 font-semibold rounded-lg text-sm"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
              </span>
            ) : (
              "Save Assignment"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
