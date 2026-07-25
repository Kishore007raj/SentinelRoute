"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Package, Users, AlertTriangle, Activity, Database, Server, Clock } from "lucide-react";

interface DashboardStats {
  companies: { total: number; active: number; pending: number; };
  users: { total: number; };
  shipments: { total: number; active: number; };
  incidents: { open: number; };
  health: { status: string; uptime: number; memoryUsedMb: number; };
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard stats");
      const data = await res.json();
      setStats(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-border border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 text-center text-destructive">
        <p>{error || "Failed to load"}</p>
        <button onClick={fetchStats} className="mt-4 text-sm underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Platform Command Center</h1>
        <p className="text-muted-foreground">Monitor the health, usage, and status of all SentinelRoute tenants.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Companies */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Total Tenants</h3>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{stats.companies.total.toLocaleString()}</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
            <span className="text-emerald-500 font-medium">{stats.companies.active} active</span>
            <span className="text-border">•</span>
            <span className="text-amber-500 font-medium">{stats.companies.pending} pending</span>
          </div>
        </div>

        {/* Users */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Platform Users</h3>
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{stats.users.total.toLocaleString()}</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Registered accounts across all tenants
          </div>
        </div>

        {/* Shipments */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Active Shipments</h3>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{stats.shipments.active.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground font-medium">/ {stats.shipments.total.toLocaleString()}</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Currently in transit or drafting
          </div>
        </div>

        {/* Incidents */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Open Incidents</h3>
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{stats.incidents.open.toLocaleString()}</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Unresolved operational disruptions
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm flex flex-col min-h-[300px]">
          <div className="p-5 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Global Activity Overview
            </h2>
          </div>
          <div className="flex-1 p-5 flex items-center justify-center text-muted-foreground text-sm">
            Interactive platform usage chart goes here.
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col">
          <div className="p-5 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-500" />
              Platform Health
            </h2>
          </div>
          <div className="p-5 space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground flex items-center gap-2"><Database className="w-3.5 h-3.5" /> Database Status</span>
                <span className="font-medium text-emerald-500">Connected</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Uptime</span>
                <span className="font-medium">{Math.floor(stats.health.uptime / 3600)}h {Math.floor((stats.health.uptime % 3600) / 60)}m</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> Node Memory</span>
                <span className="font-medium">{stats.health.memoryUsedMb} MB</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${Math.min((stats.health.memoryUsedMb / 1024) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
