"use client";

import { fetchApi } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ArrowRight, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import type { ShipmentExecution } from "@/lib/types";

export default function FleetOpsPage() {
  const { company } = useCompany();
  const [activeExecutions, setActiveExecutions] = useState<ShipmentExecution[]>([]);

  useEffect(() => {
    if (!company) return;
    fetchApi(`/api/execution/active`)
      .then((res) => res.json())
      .then((data) => {
        if (data.executions) {
          setActiveExecutions(data.executions);
        }
      });
  }, [company]);

  if (!company) {
    return (
      <div className="panel p-12 text-center text-muted-foreground font-mono text-xs uppercase tracking-widest">
        Select a company to load fleet operations.
      </div>
    );
  }

  const drivingCount = activeExecutions.filter((e) => e.status === "driving").length;
  const pausedCount = activeExecutions.filter((e) => e.status === "paused").length;
  const pendingCount = activeExecutions.filter((e) => e.status === "pending").length;

  return (
    <div className="max-w-7xl mx-auto w-full space-y-7 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <p className="label-meta flex items-center gap-2">
            <Truck className="w-3.5 h-3.5 text-primary" />
            Fleet Control & Live Trip Monitoring
          </p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Fleet Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Realtime execution monitoring across all active corridor trips.
          </p>
        </div>

        <Link href="/command-center">
          <Button variant="outline" size="sm" className="h-9 px-3.5 text-xs font-bold uppercase tracking-wider gap-2">
            <ShieldCheck className="w-3.5 h-3.5" /> Command Center
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* KPI Summary (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="panel p-5 bg-card space-y-4">
            <div className="border-b border-border/40 pb-3">
              <span className="label-meta">Active Fleet Status</span>
              <p className="text-3xl font-bold text-foreground tabular-nums mt-1">{activeExecutions.length}</p>
              <p className="text-[11px] text-muted-foreground">Trips currently in transit</p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
              <div>
                <p className="text-xl font-bold text-emerald-400 tabular-nums">{drivingCount}</p>
                <p className="label-meta mt-0.5">Driving</p>
              </div>
              <div>
                <p className="text-xl font-bold text-amber-400 tabular-nums">{pausedCount}</p>
                <p className="label-meta mt-0.5">Paused</p>
              </div>
              <div>
                <p className="text-xl font-bold text-primary tabular-nums">{pendingCount}</p>
                <p className="label-meta mt-0.5">Pending</p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Executions Grid/List (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="panel p-5 bg-card space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-sm font-bold text-foreground">Live Active Trips</h3>
              <span className="label-meta">{activeExecutions.length} active</span>
            </div>

            {activeExecutions.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed border-border/70 rounded-lg">
                <Truck className="w-6 h-6 text-muted-foreground/50 mx-auto" />
                <p className="text-xs font-bold text-foreground">No active trips currently in transit</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  Dispatched shipments with active driver execution will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeExecutions.map((exec) => (
                  <div key={exec.shipmentId} className="panel p-4 bg-muted/5 border border-border/60 hover:border-border transition-colors space-y-3">
                    <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2.5">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={exec.status === "driving" ? "active" : exec.status} />
                        <span className="text-xs font-bold font-mono text-foreground">{exec.shipmentId}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">Driver: {exec.driverId || "Unassigned"}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                      <div>
                        <p className="label-meta mb-0.5">Last Known GPS</p>
                        <p className="font-mono text-foreground font-semibold text-[11px]">
                          {exec.lastKnownLocation
                            ? `${exec.lastKnownLocation.latitude.toFixed(2)}, ${exec.lastKnownLocation.longitude.toFixed(2)}`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="label-meta mb-0.5">Current Speed</p>
                        <p className="font-semibold text-foreground tabular-nums">
                          {exec.lastKnownLocation?.speed ?? 0} km/h
                        </p>
                      </div>
                      <div>
                        <p className="label-meta mb-0.5">Checkpoints Passed</p>
                        <p className="font-bold tabular-nums text-foreground">
                          {exec.completedCheckpoints || 0} / {(exec.checkpoints?.length) || 0}
                        </p>
                      </div>
                      <div className="flex justify-end items-end">
                        <Link href={`/driver-ops`}>
                          <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold uppercase tracking-wider px-2">
                            Simulate <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
