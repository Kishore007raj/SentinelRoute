"use client";

import { useEffect, useState } from "react";
import { ActivitySquare, Database, Server, Cpu, MemoryStick, Clock, Activity, HardDrive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function PlatformHealthCenter() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/admin/health");
      if (res.ok) {
        setHealth(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, []);

  if (loading && !health) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-border border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!health) {
    return <div className="p-6 text-center text-destructive">Failed to load platform health telemetry.</div>;
  }

  const memUsagePercent = (health.system.memory.used / health.system.memory.total) * 100;
  const heapUsagePercent = (health.system.memory.processHeapUsed / health.system.memory.processHeapTotal) * 100;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ActivitySquare className="w-6 h-6 text-emerald-500" />
            Platform Health & Telemetry
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Deep infrastructure observability and diagnostics.</p>
        </div>
        <div className="flex items-center gap-2">
          {health.status === "healthy" ? (
            <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20 px-3 py-1 text-sm font-medium">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              All Systems Operational
            </Badge>
          ) : (
            <Badge variant="destructive" className="px-3 py-1 text-sm font-medium">
              System Degraded
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5 flex flex-col items-center justify-center text-center space-y-2">
            <Database className="w-8 h-8 text-blue-500" />
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">DB Latency</p>
            <p className="text-3xl font-bold font-mono">{health.database.latencyMs}<span className="text-sm text-muted-foreground">ms</span></p>
          </CardContent>
        </Card>
        
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5 flex flex-col items-center justify-center text-center space-y-2">
            <Activity className="w-8 h-8 text-indigo-500" />
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">DB Connections</p>
            <p className="text-3xl font-bold font-mono">{health.database.connections.current}<span className="text-sm text-muted-foreground"> / {health.database.connections.available}</span></p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5 flex flex-col items-center justify-center text-center space-y-2">
            <Cpu className="w-8 h-8 text-amber-500" />
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">System Load (1m)</p>
            <p className="text-3xl font-bold font-mono">{health.system.loadavg[0].toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5 flex flex-col items-center justify-center text-center space-y-2">
            <Clock className="w-8 h-8 text-emerald-500" />
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Node Uptime</p>
            <p className="text-3xl font-bold font-mono">{Math.floor(health.node.uptime / 3600)}<span className="text-sm text-muted-foreground">h</span> {Math.floor((health.node.uptime % 3600) / 60)}<span className="text-sm text-muted-foreground">m</span></p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MemoryStick className="w-4 h-4 text-primary" />
              Memory Allocation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">System Memory</span>
                <span className="font-medium font-mono">{health.system.memory.used} MB / {health.system.memory.total} MB</span>
              </div>
              <Progress value={memUsagePercent} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">V8 Heap Usage</span>
                <span className="font-medium font-mono">{health.system.memory.processHeapUsed} MB / {health.system.memory.processHeapTotal} MB</span>
              </div>
              <Progress value={heapUsagePercent} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Node RSS</span>
                <span className="font-medium font-mono">{health.system.memory.rss} MB</span>
              </div>
              <Progress value={Math.min((health.system.memory.rss / health.system.memory.total) * 100, 100)} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-500" />
              Environment Specs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-y-4 text-sm border-b border-border/50 pb-4">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Platform</p>
                  <p className="font-medium capitalize">{health.system.platform}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">OS Release</p>
                  <p className="font-medium">{health.system.release}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">CPU Cores</p>
                  <p className="font-medium">{health.system.cpus}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Node Version</p>
                  <p className="font-medium">{health.node.version}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-4 text-sm pt-2">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">MongoDB Version</p>
                  <p className="font-medium">{health.database.version}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Network Requests</p>
                  <p className="font-medium font-mono">{health.database.network.numRequests}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
