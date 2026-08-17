"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2, Package, Users, AlertTriangle,
  Activity, Database, Server, Clock, Truck, UserCheck,
} from "lucide-react";
import { fetchApi } from "@/lib/api-client";

interface DashboardStats {
  companies: { total: number; active: number; pending: number; suspended: number; rejected: number };
  users:     { total: number };
  shipments: { total: number; active: number };
  incidents: { active: number };
  workforce: { activeDrivers: number; activeVehicles: number };
  health:    { status: string; uptime: number; memoryUsedMb: number };
}

export default function AdminDashboardPage() {
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApi("/api/admin/dashboard");
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server ${res.status}`);
      }
      setStats(await res.json() as DashboardStats);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-border border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive">{error ?? "Failed to load"}</p>
        <button onClick={fetchStats} className="mt-4 text-sm underline text-muted-foreground hover:text-foreground">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Platform Command Center</h1>
        <p className="text-muted-foreground">
          Monitor the health, usage, and status of all SentinelRoute tenants.
        </p>
      </div>

      {/* Primary KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tenants */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Total Tenants</h3>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold">{stats.companies.total.toLocaleString()}</div>
          <div className="mt-2 text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-emerald-500 font-medium">{stats.companies.active} active</span>
            <span className="text-border">•</span>
            <span className="text-amber-500 font-medium">{stats.companies.pending} pending</span>
            {stats.companies.suspended > 0 && (
              <>
                <span className="text-border">•</span>
                <span className="text-rose-500 font-medium">{stats.companies.suspended} suspended</span>
              </>
            )}
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
          <div className="text-3xl font-bold">{stats.users.total.toLocaleString()}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            Registered accounts across all tenants
          </div>
        </div>

        {/* Active Shipments */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Active Shipments</h3>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{stats.shipments.active.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">/ {stats.shipments.total.toLocaleString()}</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Currently in transit or at-risk</div>
        </div>

        {/* Open Incidents */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Active Incidents</h3>
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold">{stats.incidents.active.toLocaleString()}</div>
          <div className="mt-2 text-xs text-muted-foreground">Open, investigating, or mitigating</div>
        </div>
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-lg">
            <UserCheck className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Drivers</p>
            <p className="text-2xl font-bold">{stats.workforce.activeDrivers.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Assigned, driving, or paused</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-violet-500/10 rounded-lg">
            <Truck className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Vehicles</p>
            <p className="text-2xl font-bold">{stats.workforce.activeVehicles.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Currently assigned</p>
          </div>
        </div>
      </div>

      {/* Health panel */}
      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-500" />
            Platform Health Snapshot
          </h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-muted-foreground flex items-center gap-2">
                <Database className="w-3.5 h-3.5" /> Database
              </span>
              <span className="font-medium text-emerald-500">Connected</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-full" />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-muted-foreground flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> Process Uptime
              </span>
              <span className="font-medium">
                {Math.floor(stats.health.uptime / 3600)}h{" "}
                {Math.floor((stats.health.uptime % 3600) / 60)}m
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-full" />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-muted-foreground flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" /> Node Heap
              </span>
              <span className="font-medium">{stats.health.memoryUsedMb} MB</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500"
                style={{ width: `${Math.min((stats.health.memoryUsedMb / 1024) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
