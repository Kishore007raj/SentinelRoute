"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { useUser } from "@/lib/auth-context";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { AnalyticsDonutChart } from "@/components/analytics/charts/DonutChart";
import { useAnalyticsFilters } from "@/hooks/use-analytics-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserRole } from "@/lib/types";

interface CompanyAnalyticsData {
  company: { id: string; name: string; status: string; createdAt: string };
  roleDistribution: Record<string, number>;
  totalUsers: number;
}

const ROLE_COLORS: Record<UserRole | string, string> = {
  company_admin:       "var(--primary)",
  operations_manager:  "var(--sr-emerald)",
  fleet_manager:       "var(--sr-amber)",
  dispatcher:          "#a78bfa",
  driver:              "#34d399",
  company_manager:     "#60a5fa",
  super_admin:         "var(--sr-danger)",
};

export default function CompanyAnalyticsPage() {
  const { company, isSuperAdmin } = useCompany();
  const { user }                  = useUser();

  const [data, setData]         = useState<CompanyAnalyticsData | null>(null);
  const [isLoading, setLoading] = useState(true);

  const { apiQueryString } = useAnalyticsFilters();

  const fetchData = useCallback(async () => {
    if (!company?.companyId || !user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const qs    = apiQueryString();
      const res   = await fetch(`/api/analytics/company${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json() as CompanyAnalyticsData);
    } catch {
      // render empty state
    } finally {
      setLoading(false);
    }
  }, [company?.companyId, user, apiQueryString]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Only super_admin can access this page — enforced at sidebar level
  if (!isSuperAdmin) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center h-64">
        <p className="text-muted-foreground">Company-wide analytics are restricted to super administrators.</p>
      </div>
    );
  }

  const roleDonut = data
    ? Object.entries(data.roleDistribution).map(([role, count]) => ({
        name: role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: count,
        color: ROLE_COLORS[role] ?? "#6b7280",
      }))
    : [];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary" />
            Company Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Overview of company user distribution and organisational metrics.
          </p>
        </motion.div>
      </div>

      <AnalyticsFilters />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Company Name",  value: isLoading ? "—" : (data?.company.name ?? "—"),       color: "text-foreground" },
          { label: "Total Users",   value: isLoading ? "—" : String(data?.totalUsers ?? 0),      color: "text-primary" },
          { label: "Company Status",value: isLoading ? "—" : (data?.company.status ?? "—"),      color: "text-[var(--sr-emerald)]" },
        ].map(({ label, value, color }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{label}</p>
            <p className={`text-xl font-bold ${color} truncate`}>{value}</p>
          </motion.div>
        ))}
      </div>

      {/* Role Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnalyticsDonutChart title="User Role Distribution" data={roleDonut} isLoading={isLoading} />

        {/* Role breakdown list */}
        <Card className="panel">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Role Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-8 rounded bg-muted/20 animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {roleDonut.map(({ name, value, color }) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-sm text-muted-foreground">{name}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{value}</span>
                  </div>
                ))}
                {roleDonut.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No user data available</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
