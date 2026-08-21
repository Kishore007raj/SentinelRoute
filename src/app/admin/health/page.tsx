"use client";

import { useEffect, useState, useCallback } from "react";
import { ActivitySquare, Database, Server, Cpu, MemoryStick, Clock, Activity, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api-client";

interface HealthData {
  status: string;
  database: {
    latencyMs: number;
    connections: { current: number; available: number };
    network: { numRequests: number };
    version: string;
    uptime: number;
  };
  system: {
    platform: string;
    release: string;
    uptime: number;
    memory: {
      total: number;
      used: number;
      processHeapUsed: number;
      processHeapTotal: number;
      rss: number;
    };
    cpus: number;
    loadavg: number[];
  };
  node: {
    version: string;
    uptime: number;
  };
}

export default function PlatformHealthCenter() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchApi("/api/admin/health");
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server responded with ${res.status}`);
      }
      setHealth(await res.json() as HealthData);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load health telemetry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading && !health) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-border border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="panel p-8 text-center max-w-lg mx-auto">
        <p className="text-xs text-rose-400 mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchHealth} className="gap-2 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Retry Gateway Connection
        </Button>
      </div>
    );
  }

  if (!health) return null;

  const memUsagePercent  = (health.system.memory.used / health.system.memory.total) * 100;
  const heapUsagePercent = (health.system.memory.processHeapUsed / health.system.memory.processHeapTotal) * 100;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ActivitySquare className="w-5 h-5 text-emerald-400" />
              Platform Health & Telemetry
            </h1>
            {health.status === "healthy" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                All Systems Operational
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                System Degraded
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Deep infrastructure telemetry, process resource utilization, and database status.
            {lastFetched && (
              <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                (Synced {lastFetched.toLocaleTimeString()})
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchHealth}
          disabled={loading}
          className="h-8 text-xs gap-1.5 border-border"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Telemetry</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-400">
          Stale telemetry warning: {error}
        </div>
      )}

      {/* Primary Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="panel p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="label-meta">Database Latency</span>
            <div className="p-1.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded">
              <Database className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
              {health.database.latencyMs}
            </span>
            <span className="text-xs text-muted-foreground font-mono">ms</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-emerald-400 font-mono">
            {health.database.latencyMs < 50 ? "Optimal (<50ms)" : "Elevated response time"}
          </div>
        </div>

        <div className="panel p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="label-meta">Connection Pool</span>
            <div className="p-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
              {health.database.connections.current}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              / {health.database.connections.available} available
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-muted-foreground font-mono">
            Active MongoDB pool connections
          </div>
        </div>

        <div className="panel p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="label-meta">System Load (1m)</span>
            <div className="p-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded">
              <Cpu className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
            {health.system.loadavg[0].toFixed(2)}
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-muted-foreground font-mono">
            Across {health.system.cpus} CPU cores
          </div>
        </div>

        <div className="panel p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="label-meta">Node Uptime</span>
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
            {Math.floor(health.node.uptime / 3600)}h {Math.floor((health.node.uptime % 3600) / 60)}m
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-muted-foreground font-mono">
            Continuous process execution
          </div>
        </div>
      </div>

      {/* Memory & Environment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Memory Allocation */}
        <div className="panel p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-5 flex items-center gap-2">
            <MemoryStick className="w-4 h-4 text-amber-500" />
            Memory Allocation & Heap
          </h2>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">System Memory</span>
                <span className="font-medium font-mono text-foreground">
                  {health.system.memory.used} MB / {health.system.memory.total} MB
                </span>
              </div>
              <Progress value={memUsagePercent} className="h-1.5" />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">V8 Process Heap</span>
                <span className="font-medium font-mono text-foreground">
                  {health.system.memory.processHeapUsed} MB / {health.system.memory.processHeapTotal} MB
                </span>
              </div>
              <Progress value={heapUsagePercent} className="h-1.5" />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Node RSS (Resident Set)</span>
                <span className="font-medium font-mono text-foreground">{health.system.memory.rss} MB</span>
              </div>
              <Progress
                value={Math.min((health.system.memory.rss / health.system.memory.total) * 100, 100)}
                className="h-1.5"
              />
            </div>
          </div>
        </div>

        {/* Environment Specs */}
        <div className="panel p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-5 flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            Runtime Environment Specifications
          </h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-y-3 text-xs border-b border-border/50 pb-3">
              <div>
                <span className="label-meta">Operating Platform</span>
                <p className="font-medium capitalize text-foreground mt-0.5">{health.system.platform}</p>
              </div>
              <div>
                <span className="label-meta">OS Kernel Release</span>
                <p className="font-medium font-mono text-foreground mt-0.5">{health.system.release}</p>
              </div>
              <div>
                <span className="label-meta">CPU Hardware</span>
                <p className="font-medium font-mono text-foreground mt-0.5">{health.system.cpus} Logical Cores</p>
              </div>
              <div>
                <span className="label-meta">Node.js Engine</span>
                <p className="font-medium font-mono text-foreground mt-0.5">{health.node.version}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-3 text-xs pt-1">
              <div>
                <span className="label-meta">Database Engine</span>
                <p className="font-medium font-mono text-foreground mt-0.5">MongoDB v{health.database.version}</p>
              </div>
              <div>
                <span className="label-meta">Network Request Ingestion</span>
                <p className="font-medium font-mono text-foreground mt-0.5">{health.database.network.numRequests.toLocaleString()} reqs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
