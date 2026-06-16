"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { CompanyUser, UserRole } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

/** All assignable roles — super_admin is excluded (platform-level only) */
const ASSIGNABLE_ROLES: UserRole[] = [
  "company_manager",
  "company_admin",
  "fleet_manager",
  "operations_manager",
  "dispatcher",
  "driver",
];

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin:         "Super Admin",
  company_admin:       "Company Admin",
  company_manager:     "Company Manager",
  operations_manager:  "Operations Manager",
  fleet_manager:       "Fleet Manager",
  dispatcher:          "Dispatcher",
  driver:              "Driver",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface UserTableProps {
  users:          CompanyUser[];
  currentUserId:  string;
  onChangeRole:   (user: CompanyUser, newRole: UserRole) => void;
  onDisable:      (user: CompanyUser) => void;
  onActivate:     (user: CompanyUser) => void;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return (
      <Badge className="bg-emerald-400/10 text-emerald-600 border-emerald-400/30 dark:text-emerald-400">
        Active
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground border-border">
      Disabled
    </Badge>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UserTable({
  users,
  currentUserId,
  onChangeRole,
  onDisable,
  onActivate,
}: UserTableProps) {
  const [disableTarget, setDisableTarget] = useState<CompanyUser | null>(null);

  // ── Disable confirm ───────────────────────────────────────────────────────
  const handleDisableConfirm = () => {
    if (disableTarget) {
      onDisable(disableTarget);
      setDisableTarget(null);
    }
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <p className="text-sm font-medium text-foreground">No users found</p>
        <p className="text-xs text-muted-foreground">
          Invite users to your company to see them here.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">

        {/* Column headers */}
        <div className="hidden lg:grid grid-cols-[1.5fr_1.5fr_1.5fr_0.8fr_1fr] gap-4 px-6 py-3 bg-muted/5 border-b border-border/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Name
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Email
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Role
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Status
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black text-right">
            Actions
          </span>
        </div>

        {/* Rows */}
        {users.map((user) => {
          const isSelf = user.userId === currentUserId;

          return (
            <div
              key={user.userId}
              className="grid grid-cols-1 lg:grid-cols-[1.5fr_1.5fr_1.5fr_0.8fr_1fr] gap-3 lg:gap-4 px-6 py-4 border-b border-border/30 last:border-0 hover:bg-muted/5 transition-colors"
              role="row"
            >
              {/* Name — userId in monospace (real name lookup is a future enhancement) */}
              <div className="self-center">
                <p className="text-sm font-mono text-foreground truncate">
                  {user.userId}
                </p>
              </div>

              {/* Email — not stored on CompanyUser; lives in Firebase Auth */}
              <div className="flex items-center">
                <p className="text-sm text-muted-foreground">—</p>
              </div>

              {/* Role — inline Select (disabled for self-row) */}
              <div
                className="flex items-center"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {isSelf ? (
                  <span className="text-sm text-muted-foreground">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                ) : (
                  <Select
                    value={user.role}
                    onValueChange={(value) =>
                      onChangeRole(user, value as UserRole)
                    }
                  >
                    <SelectTrigger
                      className="h-8 w-48 text-xs"
                      aria-label={`Change role for ${user.userId}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((role) => (
                        <SelectItem key={role} value={role} className="text-xs">
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Status badge */}
              <div className="flex items-center">
                <StatusBadge active={user.active} />
              </div>

              {/* Actions */}
              <div
                className="flex items-center justify-start lg:justify-end gap-2"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="group"
                aria-label={`Actions for ${user.userId}`}
              >
                {isSelf ? (
                  /* Self-row: no Disable or Change Role actions */
                  <span className="text-xs text-muted-foreground italic">
                    (you)
                  </span>
                ) : (
                  <>
                    {/* Disable — shown only when active */}
                    {user.active && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs text-amber-500 border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-500 hover:border-amber-400/60"
                        onClick={() => setDisableTarget(user)}
                      >
                        Disable
                      </Button>
                    )}

                    {/* Activate — shown only when disabled */}
                    {!user.active && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs text-emerald-600 border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-600 hover:border-emerald-400/60 dark:text-emerald-400"
                        onClick={() => onActivate(user)}
                      >
                        Activate
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Disable confirmation dialog ───────────────────────────────────────── */}
      <Dialog
        open={disableTarget !== null}
        onOpenChange={(open) => { if (!open) setDisableTarget(null); }}
      >
        <DialogContent className="max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>Disable User</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to disable{" "}
            <span className="font-semibold text-foreground font-mono">
              {disableTarget?.userId}
            </span>
            ? They will lose access to the platform until reactivated.
          </p>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-9 px-4 text-sm"
              onClick={() => setDisableTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 px-4 text-sm bg-amber-500 hover:bg-amber-600 text-white border-0"
              onClick={handleDisableConfirm}
            >
              Disable User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
