"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/lib/auth-context";
import type { Vehicle } from "@/lib/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface VehicleFormProps {
  mode: "add" | "edit";
  vehicle?: Vehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  vehicleNumber: string;
  vehicleType: string;
  capacity: string;
  fuelType: string;
  insuranceNumber: string;
  insuranceExpiry: string;
  fitnessExpiry: string;
  permitExpiry: string;
}

const EMPTY_FORM: FormState = {
  vehicleNumber: "",
  vehicleType: "",
  capacity: "",
  fuelType: "",
  insuranceNumber: "",
  insuranceExpiry: "",
  fitnessExpiry: "",
  permitExpiry: "",
};

// ─── Field row ────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-amber-400 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VehicleForm({
  mode,
  vehicle,
  open,
  onOpenChange,
  onSuccess,
}: VehicleFormProps) {
  const { user } = useUser();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Pre-populate in edit mode; reset when dialog closes ──────────────────

  useEffect(() => {
    if (open && mode === "edit" && vehicle) {
      setForm({
        vehicleNumber:   vehicle.vehicleNumber   ?? "",
        vehicleType:     vehicle.vehicleType     ?? "",
        capacity:        vehicle.capacity        ?? "",
        fuelType:        vehicle.fuelType        ?? "",
        insuranceNumber: vehicle.insuranceNumber ?? "",
        insuranceExpiry: vehicle.insuranceExpiry ?? "",
        fitnessExpiry:   vehicle.fitnessExpiry   ?? "",
        permitExpiry:    vehicle.permitExpiry    ?? "",
      });
    }
    if (!open) {
      setForm(EMPTY_FORM);
      setFieldErrors({});
      setGlobalError(null);
    }
  }, [open, mode, vehicle]);

  // ── Field helpers ─────────────────────────────────────────────────────────

  const set = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear inline error on change
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    // Client-side required field check
    const required: (keyof FormState)[] = ["vehicleNumber", "vehicleType", "capacity"];
    const errors: Partial<Record<keyof FormState, string>> = {};
    for (const field of required) {
      if (!form[field].trim()) {
        errors[field] = "This field is required.";
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const token = user ? await user.getIdToken() : null;
      const url =
        mode === "edit" && vehicle
          ? `/api/workforce/vehicles/${vehicle.vehicleId}`
          : "/api/workforce/vehicles";
      const method = mode === "edit" ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Handle field-level errors returned from the API
        if (data.field && data.error) {
          setFieldErrors({ [data.field]: data.error });
        } else {
          setGlobalError(data.error ?? "Something went wrong. Please try again.");
        }
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch {
      setGlobalError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add Vehicle" : "Edit Vehicle"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* ── Required fields ─────────────────────────────────────────── */}
          <FieldRow
            label="Vehicle Number"
            required
            error={fieldErrors.vehicleNumber}
          >
            <Input
              placeholder="e.g. MH12AB1234"
              value={form.vehicleNumber}
              onChange={(e) => set("vehicleNumber", e.target.value)}
              disabled={loading}
              aria-invalid={!!fieldErrors.vehicleNumber}
            />
          </FieldRow>

          <FieldRow
            label="Vehicle Type"
            required
            error={fieldErrors.vehicleType}
          >
            <Input
              placeholder="e.g. Container Truck"
              value={form.vehicleType}
              onChange={(e) => set("vehicleType", e.target.value)}
              disabled={loading}
              aria-invalid={!!fieldErrors.vehicleType}
            />
          </FieldRow>

          <FieldRow
            label="Capacity"
            required
            error={fieldErrors.capacity}
          >
            <Input
              placeholder="e.g. 10 tonnes"
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              disabled={loading}
              aria-invalid={!!fieldErrors.capacity}
            />
          </FieldRow>

          {/* ── Optional fields ──────────────────────────────────────────── */}
          <FieldRow label="Fuel Type" error={fieldErrors.fuelType}>
            <Input
              placeholder="e.g. Diesel"
              value={form.fuelType}
              onChange={(e) => set("fuelType", e.target.value)}
              disabled={loading}
            />
          </FieldRow>

          <FieldRow
            label="Insurance Number"
            error={fieldErrors.insuranceNumber}
          >
            <Input
              placeholder="e.g. INS-2024-XXXX"
              value={form.insuranceNumber}
              onChange={(e) => set("insuranceNumber", e.target.value)}
              disabled={loading}
            />
          </FieldRow>

          <FieldRow
            label="Insurance Expiry"
            error={fieldErrors.insuranceExpiry}
          >
            <Input
              type="date"
              value={form.insuranceExpiry}
              onChange={(e) => set("insuranceExpiry", e.target.value)}
              disabled={loading}
              className="scheme-dark"
            />
          </FieldRow>

          <FieldRow label="Fitness Expiry" error={fieldErrors.fitnessExpiry}>
            <Input
              type="date"
              value={form.fitnessExpiry}
              onChange={(e) => set("fitnessExpiry", e.target.value)}
              disabled={loading}
              className="scheme-dark"
            />
          </FieldRow>

          <FieldRow label="Permit Expiry" error={fieldErrors.permitExpiry}>
            <Input
              type="date"
              value={form.permitExpiry}
              onChange={(e) => set("permitExpiry", e.target.value)}
              disabled={loading}
              className="scheme-dark"
            />
          </FieldRow>

          {/* ── Global error ─────────────────────────────────────────────── */}
          {globalError && (
            <p className="text-sm text-destructive">{globalError}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? mode === "add"
                  ? "Adding..."
                  : "Saving..."
                : mode === "add"
                  ? "Add Vehicle"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
