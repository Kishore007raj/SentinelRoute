"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2, Package, Users, AlertTriangle,
  Activity, Database, Server, Clock, Truck, UserCheck, RefreshCw,
} from "lucide-react";
import { fetchApi } from "@/lib/api-client";
import { useUser } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

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
  const { user, loading: authLoading } = useUser();

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
      setError(err instanceof Error ? err.message : "Failed to load dashboard telemetry");
    } finally {
      setLoading(false);
    }
  }, []);

  // Gate on auth so fetchApi always has the token ready
  useEffect(() => {
    if (!authLoading && user) {
      fetchStats();
    }
  }, [authLoading, user, fetchStats]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-border border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="p-8 text-center panel max-w-lg mx-auto">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
        <p className="text-sm text-rose-400 mb-1">{error}</p>
        <p className="text-xs text-muted-foreground mb-4">Unable to retrieve platform metrics from the primary gateway.</p>
        <Button onClick={fetchStats} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Connection
        </Button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Platform Command Center</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Global Telemetry Live
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time cross-tenant health, operational capacity, and platform infrastructure state.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={loading}
          className="gap-1.5 text-xs h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Telemetry</span>
        </Button>
      </div>

      {/* Primary KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tenants */}
        <div className="panel p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="label-meta">Total Tenants</span>
              <div className="p-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded">
                <Building2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
              {stats.companies.total.toLocaleString()}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/50 text-xs flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-emerald-400 font-medium font-mono">{stats.companies.active} active</span>
            {stats.companies.pending > 0 && (
              <>
                <span className="text-border">•</span>
                <span className="text-amber-400 font-medium font-mono">{stats.companies.pending} pending</span>
              </>
            )}
            {stats.companies.suspended > 0 && (
              <>
                <span className="text-border">•</span>
                <span className="text-rose-400 font-medium font-mono">{stats.companies.suspended} suspended</span>
              </>
            )}
            {stats.companies.rejected > 0 && (
              <>
                <span className="text-border">•</span>
                <span className="text-muted-foreground font-medium font-mono">{stats.companies.rejected} rejected</span>
              </>
            )}
          </div>
        </div>

        {/* Platform Users */}
        <div className="panel p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="label-meta">Platform Users</span>
              <div className="p-1.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
              {stats.users.total.toLocaleString()}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
            Registered operator accounts across all tenants
          </div>
        </div>

        {/* Active Shipments */}
        <div className="panel p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="label-meta">Active Shipments</span>
              <div className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                <Package className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
                {stats.shipments.active.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                / {stats.shipments.total.toLocaleString()} total
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
            In-transit or active route executions
          </div>
        </div>

        {/* Open Incidents */}
        <div className="panel p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="label-meta">Active Incidents</span>
              <div className="p-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
              {stats.incidents.active.toLocaleString()}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
            {stats.incidents.active === 0 ? "No open operational blocks" : "Investigating or mitigating"}
          </div>
        </div>
      </div>

      {/* Secondary Operational Capacity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="panel p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="label-meta">Active Driver Workforce</span>
              <p className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-0.5">
                {stats.workforce.activeDrivers.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Assigned to active trips, driving, or paused</p>
            </div>
          </div>
        </div>

        <div className="panel p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <span className="label-meta">Active Fleet Assets</span>
              <p className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-0.5">
                {stats.workforce.activeVehicles.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Assigned vehicles currently dispatched</p>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Health Snapshot */}
      <div className="panel overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            Platform Infrastructure Health
          </h2>
          <span className="text-[10px] font-mono text-muted-foreground">Gateway Status: {stats.health.status}</span>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* DB State */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-400" /> Database Cluster
              </span>
              <span className="font-medium font-mono text-emerald-400">Connected</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-full" />
            </div>
          </div>

          {/* Process Uptime */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Node Process Uptime
              </span>
              <span className="font-medium font-mono text-foreground">
                {Math.floor(stats.health.uptime / 3600)}h {Math.floor((stats.health.uptime % 3600) / 60)}m
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-sky-500 w-full" />
            </div>
          </div>

          {/* Node Heap */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-slate-400" /> Heap Memory Allocated
              </span>
              <span className="font-medium font-mono text-foreground">{stats.health.memoryUsedMb} MB</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500"
                style={{ width: `${Math.min((stats.health.memoryUsedMb / 1024) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
