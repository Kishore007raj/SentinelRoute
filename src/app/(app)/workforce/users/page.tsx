"use client";

import { fetchApi } from "@/lib/api-client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserCog, AlertTriangle, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { useI18n } from "@/lib/i18n";
import { UserTable } from "@/components/workforce/UserTable";
import { UserForm } from "@/components/workforce/UserForm";
import type { CompanyUser, UserRole } from "@/lib/types";

function UsersSkeleton() {
  return (
    <div className="max-w-7xl mx-auto w-full space-y-7">
      <div className="pb-6 border-b border-border space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="panel p-5 bg-card space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function UserManagementPage() {
  const router = useRouter();
  const { user } = useUser();
  const { userRecord, status } = useCompany();
  const { t } = useI18n();

  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    const role = userRecord?.role;
    if (role !== "company_manager" && role !== "company_admin") {
      toast.error(t("workforce.companyManagerRequired"));
      router.replace("/workforce");
    }
  }, [userRecord, status, router, t]);

  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetchApi("/api/workforce/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }
      const json = await res.json();
      setUsers(json.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workforce.failedToLoadUsers"));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    if (status === "loading" || !user) return;
    const role = userRecord?.role;
    if (role !== "company_manager" && role !== "company_admin") return;
    fetchUsers();
  }, [user, status, userRecord, fetchUsers]);

  const handleChangeRole = async (targetUser: CompanyUser, newRole: UserRole) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetchApi(`/api/workforce/users/${targetUser.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Role update failed with status ${res.status}`);
      }
      toast.success(t("workforce.roleUpdated"));
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("workforce.roleUpdateFailed"));
    }
  };

  const handleDisable = async (targetUser: CompanyUser) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetchApi(`/api/workforce/users/${targetUser.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: false }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Status update failed with status ${res.status}`);
      }
      toast.success(t("workforce.statusUpdated"));
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("workforce.statusUpdateFailed"));
    }
  };

  const handleActivate = async (targetUser: CompanyUser) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetchApi(`/api/workforce/users/${targetUser.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Status update failed with status ${res.status}`);
      }
      toast.success(t("workforce.statusUpdated"));
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("workforce.statusUpdateFailed"));
    }
  };

  if (loading) return <UsersSkeleton />;

  if (error) {
    return (
      <div className="max-w-7xl mx-auto w-full">
        <div className="panel p-12 text-center space-y-4 border border-dashed border-border/70">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">{t("workforce.failedToLoadUsers")}</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
          </div>
          <Button variant="outline" className="gap-2 h-9 px-4 text-xs font-bold uppercase tracking-wider" onClick={fetchUsers}>
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
            <UserCog className="w-3.5 h-3.5 text-primary" />
            {t("workforce.workforce")}
          </p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("workforce.teamMembers")}</h1>
        </div>

        <Button onClick={() => setInviteOpen(true)} className="h-10 px-4 text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
          <UserPlus className="w-3.5 h-3.5" />
          {t("workforce.addUser")}
        </Button>
      </div>

      {/* User Table Container */}
      <div className="panel p-0 overflow-hidden bg-card">
        <UserTable
          users={users}
          currentUserId={userRecord?.userId ?? ""}
          onChangeRole={handleChangeRole}
          onDisable={handleDisable}
          onActivate={handleActivate}
        />
      </div>

      {/* Add User Modal */}
      <UserForm open={inviteOpen} onOpenChange={setInviteOpen} onSuccess={fetchUsers} />
    </div>
  );
}
