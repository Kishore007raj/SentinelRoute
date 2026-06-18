"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUser } from "@/lib/auth-context";
import type { Driver } from "@/lib/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface DriverFormProps {
  mode: "add" | "edit";
  driver?: Driver;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ─── Form state shape ─────────────────────────────────────────────────────────

interface DriverFormFields {
  fullName: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
  employeeId: string;
  email: string;
  aadhaarNumber: string;
  bloodGroup: string;
  address: string;
  languagePreferences: string; // comma-separated input, split on submit
}

const EMPTY_FIELDS: DriverFormFields = {
  fullName: "",
  phone: "",
  licenseNumber: "",
  licenseExpiry: "",
  employeeId: "",
  email: "",
  aadhaarNumber: "",
  bloodGroup: "",
  address: "",
  languagePreferences: "",
};

function driverToFields(driver: Driver): DriverFormFields {
  return {
    fullName: driver.fullName,
    phone: driver.phone,
    licenseNumber: driver.licenseNumber,
    licenseExpiry: driver.licenseExpiry,
    employeeId: driver.employeeId,
    email: driver.email,
    // aadhaarNumber comes back masked ("****") in edit mode for restricted roles
    aadhaarNumber: driver.aadhaarNumber === "****" ? "" : driver.aadhaarNumber,
    bloodGroup: driver.bloodGroup,
    address: driver.address,
    languagePreferences: (driver.languagePreferences ?? []).join(", "),
  };
}

// ─── Field-level error map ────────────────────────────────────────────────────

type FieldErrors = Partial<Record<keyof DriverFormFields | "general", string>>;

// ─── FieldGroup helper ────────────────────────────────────────────────────────

function FieldGroup({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="text-amber-400 ml-1">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      {!error && hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DriverForm({
  mode,
  driver,
  open,
  onOpenChange,
  onSuccess,
}: DriverFormProps) {
  const { user } = useUser();

  const [fields, setFields] = useState<DriverFormFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // ── Pre-populate or reset when dialog opens/closes ────────────────────────
  useEffect(() => {
    if (open) {
      setFields(mode === "edit" && driver ? driverToFields(driver) : EMPTY_FIELDS);
      setErrors({});
    }
  }, [open, mode, driver]);

  // ── Field helper ──────────────────────────────────────────────────────────
  const set = (key: keyof DriverFormFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    // Clear the field-level error as the user types
    if (errors[key]) {
      setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const token = user ? await user.getIdToken() : null;

      const body = {
        fullName: fields.fullName.trim(),
        phone: fields.phone.trim(),
        licenseNumber: fields.licenseNumber.trim(),
        licenseExpiry: fields.licenseExpiry.trim(),
        employeeId: fields.employeeId.trim(),
        email: fields.email.trim(),
        // Only send aadhaar if the user typed something (don't send empty string
        // or the masked placeholder in edit mode)
        ...(fields.aadhaarNumber.trim() ? { aadhaarNumber: fields.aadhaarNumber.trim() } : {}),
        bloodGroup: fields.bloodGroup.trim(),
        address: fields.address.trim(),
        languagePreferences: fields.languagePreferences
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const url =
        mode === "edit" && driver
          ? `/api/workforce/drivers/${driver.driverId}`
          : "/api/workforce/drivers";

      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        // Map field-level errors from the API response
        if (data?.field) {
          setErrors({ [data.field]: data.error ?? "Invalid value." });
        } else {
          setErrors({ general: data?.error ?? "Something went wrong. Please try again." });
        }
        return;
      }

      // Success — notify parent and close
      onSuccess();
      onOpenChange(false);
    } catch {
      setErrors({ general: "Network error. Please check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl max-h-[90vh] overflow-y-auto"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add Driver" : "Edit Driver"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 py-2">

            {/* General error banner */}
            {errors.general && (
              <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-500">
                {errors.general}
              </div>
            )}

            {/* ── Required section ───────────────────────────────────────── */}
            <p className="text-xs text-muted-foreground uppercase tracking-widest pt-1">
              Required
            </p>

            <FieldGroup label="Full Name" htmlFor="fullName" required error={errors.fullName}>
              <Input
                id="fullName"
                value={fields.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                autoComplete="name"
                disabled={submitting}
              />
            </FieldGroup>

            <FieldGroup label="Phone" htmlFor="phone" required error={errors.phone}>
              <Input
                id="phone"
                type="tel"
                value={fields.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="e.g. +91 98765 43210"
                autoComplete="tel"
                disabled={submitting}
              />
            </FieldGroup>

            <FieldGroup label="License Number" htmlFor="licenseNumber" required error={errors.licenseNumber}>
              <Input
                id="licenseNumber"
                value={fields.licenseNumber}
                onChange={(e) => set("licenseNumber", e.target.value)}
                placeholder="e.g. MH1420210012345"
                disabled={submitting}
              />
            </FieldGroup>

            <FieldGroup label="License Expiry" htmlFor="licenseExpiry" required error={errors.licenseExpiry}>
              <Input
                id="licenseExpiry"
                type="date"
                value={fields.licenseExpiry}
                onChange={(e) => set("licenseExpiry", e.target.value)}
                className="scheme-dark"
                disabled={submitting}
              />
            </FieldGroup>

            {/* ── Optional section ────────────────────────────────────────── */}
            <p className="text-xs text-muted-foreground uppercase tracking-widest pt-2">
              Optional
            </p>

            <FieldGroup label="Employee ID" htmlFor="employeeId" error={errors.employeeId}>
              <Input
                id="employeeId"
                value={fields.employeeId}
                onChange={(e) => set("employeeId", e.target.value)}
                placeholder="e.g. EMP-001"
                disabled={submitting}
              />
            </FieldGroup>

            <FieldGroup label="Email" htmlFor="email" error={errors.email}>
              <Input
                id="email"
                type="email"
                value={fields.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="e.g. ramesh@example.com"
                autoComplete="email"
                disabled={submitting}
              />
            </FieldGroup>

            <FieldGroup
              label="Aadhaar Number"
              htmlFor="aadhaarNumber"
              error={errors.aadhaarNumber}
              hint={mode === "edit" ? "Leave blank to keep existing value" : undefined}
            >
              <Input
                id="aadhaarNumber"
                type="password"
                value={fields.aadhaarNumber}
                onChange={(e) => set("aadhaarNumber", e.target.value)}
                placeholder={mode === "edit" ? "••••  (unchanged)" : "12-digit Aadhaar number"}
                autoComplete="off"
                disabled={submitting}
              />
            </FieldGroup>

            <FieldGroup label="Blood Group" htmlFor="bloodGroup" error={errors.bloodGroup}>
              <Input
                id="bloodGroup"
                value={fields.bloodGroup}
                onChange={(e) => set("bloodGroup", e.target.value)}
                placeholder="e.g. O+"
                disabled={submitting}
              />
            </FieldGroup>

            <FieldGroup label="Address" htmlFor="address" error={errors.address}>
              <Input
                id="address"
                value={fields.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="e.g. 12 MG Road, Bengaluru"
                disabled={submitting}
              />
            </FieldGroup>

            <FieldGroup
              label="Language Preferences"
              htmlFor="languagePreferences"
              error={errors.languagePreferences}
              hint="Comma-separated — e.g. English, Hindi, Tamil"
            >
              <Input
                id="languagePreferences"
                value={fields.languagePreferences}
                onChange={(e) => set("languagePreferences", e.target.value)}
                placeholder="English, Hindi"
                disabled={submitting}
              />
            </FieldGroup>
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={submitting} className="min-w-[100px]">
              {submitting
                ? mode === "add" ? "Adding…" : "Saving…"
                : mode === "add" ? "Add Driver" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
