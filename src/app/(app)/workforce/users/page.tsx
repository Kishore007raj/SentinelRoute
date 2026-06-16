"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserCog, AlertTriangle, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { UserTable } from "@/components/workforce/UserTable";
import { UserForm } from "@/components/workforce/UserForm";
import type { CompanyUser, UserRole } from "@/lib/types";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function UsersSkeleton() {
  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 p-6">
      {/* Header */}
      <div className="pb-6 border-b border-border space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-48" />
      </div>

      {/* Table */}
      <Card className="bg-card border border-border">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3 p-0">
          {/* Header row */}
          <div className="grid grid-cols-5 gap-4 px-6 py-3 bg-muted/40 border-b border-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-20" />
            ))}
          </div>
          {/* Data rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-border/30 last:border-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const router = useRouter();
  const { user } = useUser();
  const { userRecord, status } = useCompany();

  const [users, setUsers]           = useState<CompanyUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  // ── Access guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === "loading") return;
    const role = userRecord?.role;
    if (role !== "company_manager" && role !== "company_admin") {
      toast.error("Company Manager access required");
      router.replace("/workforce");
    }
  }, [userRecord, status, router]);

  // ── Fetch users ─────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/workforce/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }
      const json = await res.json();
      setUsers(json.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Wait for auth + company context to resolve
    if (status === "loading" || !user) return;
    // Don't fetch if the user will be redirected
    const role = userRecord?.role;
    if (role !== "company_manager" && role !== "company_admin") return;
    fetchUsers();
  }, [user, status, userRecord, fetchUsers]);

  // ── Mutation helpers ────────────────────────────────────────────────────────

  const patchUser = useCallback(
    async (userId: string, body: { role?: UserRole; active?: boolean }) => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/workforce/users/${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error ?? "Failed to update user.");
          return;
        }
        // Re-fetch to get fresh list
        await fetchUsers();
      } catch {
        toast.error("Network error. Please try again.");
      }
    },
    [user, fetchUsers]
  );

  const handleChangeRole = useCallback(
    (targetUser: CompanyUser, newRole: UserRole) => {
      patchUser(targetUser.userId, { role: newRole });
    },
    [patchUser]
  );

  const handleDisable = useCallback(
    (targetUser: CompanyUser) => {
      patchUser(targetUser.userId, { active: false });
    },
    [patchUser]
  );

  const handleActivate = useCallback(
    (targetUser: CompanyUser) => {
      patchUser(targetUser.userId, { active: true });
    },
    [patchUser]
  );

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return <UsersSkeleton />;

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-7xl mx-auto w-full p-6">
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-card border border-border rounded-2xl">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Failed to load users</p>
            <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          </div>
          <Button
            variant="outline"
            className="gap-2 h-10 px-5 text-sm"
            onClick={fetchUsers}
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Populated ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto w-full space-y-10 p-6">

      {/* Header */}
      <div className="pb-6 border-b border-border flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-bold">
            Workforce
          </p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <UserCog className="w-7 h-7 text-muted-foreground" />
            User Management
          </h1>
        </div>

        <Button
          className="gap-2 h-10 px-5 text-sm shrink-0 mt-1"
          onClick={() => setInviteOpen(true)}
        >
          <UserPlus className="w-4 h-4" />
          Invite User
        </Button>
      </div>

      {/* User table */}
      <Card className="bg-card border border-border rounded-2xl shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-foreground">
            Company Users
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {users.length} {users.length === 1 ? "user" : "users"} in your company
          </p>
        </CardHeader>
        <CardContent className="p-0 pb-1">
          <UserTable
            users={users}
            currentUserId={user?.uid ?? ""}
            onChangeRole={handleChangeRole}
            onDisable={handleDisable}
            onActivate={handleActivate}
          />
        </CardContent>
      </Card>

      {/* Invite User dialog */}
      <UserForm
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={() => {
          setInviteOpen(false);
          fetchUsers();
        }}
      />
    </div>
  );
}
