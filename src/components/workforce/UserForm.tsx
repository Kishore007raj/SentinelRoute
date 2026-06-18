"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ─── Role options (all UserRole values except "driver" and "super_admin") ─────

const INVITABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: "company_manager",    label: "Company Manager" },
  { value: "company_admin",      label: "Company Admin" },
  { value: "fleet_manager",      label: "Fleet Manager" },
  { value: "operations_manager", label: "Operations Manager" },
  { value: "dispatcher",         label: "Dispatcher" },
];

// ─── Field row ────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  htmlFor,
  required,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-amber-400 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function UserForm({ open, onOpenChange, onSuccess }: UserFormProps) {
  const { user } = useUser();

  const [email, setEmail]       = useState("");
  const [role, setRole]         = useState<UserRole | "">("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [roleError, setRoleError]   = useState<string | undefined>();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  // ── Reset form when dialog opens/closes ──────────────────────────────────
  useEffect(() => {
    if (!open) {
      setEmail("");
      setRole("");
      setEmailError(undefined);
      setRoleError(undefined);
      setGlobalError(null);
      setLoading(false);
    }
  }, [open]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    // Client-side validation
    let hasError = false;
    if (!email.trim()) {
      setEmailError("Email is required.");
      hasError = true;
    } else {
      setEmailError(undefined);
    }
    if (!role) {
      setRoleError("Role is required.");
      hasError = true;
    } else {
      setRoleError(undefined);
    }
    if (hasError) return;

    setLoading(true);
    try {
      const token = user ? await user.getIdToken() : null;

      const res = await fetch("/api/workforce/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.field === "email" && data.error) {
          setEmailError(data.error);
        } else if (data.field === "role" && data.error) {
          setRoleError(data.error);
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">

          <FieldRow label="Email" htmlFor="invite-email" required error={emailError}>
            <Input
              id="invite-email"
              type="email"
              placeholder="e.g. user@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(undefined);
              }}
              autoComplete="email"
              disabled={loading}
              aria-invalid={!!emailError}
            />
          </FieldRow>

          <FieldRow label="Role" required error={roleError}>
            <Select
              value={role || undefined}
              onValueChange={(v) => {
                setRole(v as UserRole);
                if (roleError) setRoleError(undefined);
              }}
            >
              <SelectTrigger
                className="w-full h-10 bg-muted/20 border-border text-sm"
                disabled={loading}
                aria-invalid={!!roleError}
              >
                <SelectValue placeholder="Select a role..." />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              {loading ? "Inviting..." : "Invite User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
