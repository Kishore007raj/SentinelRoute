"use client";
import { fetchApi } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useCompany } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ArrowRight, Activity, Map, Navigation, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function FleetOpsPage() {
  const { company } = useCompany();
  const [activeExecutions, setActiveExecutions] = useState<any[]>([]);

  useEffect(() => {
    if (!company) return;
    fetchApi(`/api/execution/active`)
      .then(res => res.json())
      .then(data => {
        if (data.executions) {
          setActiveExecutions(data.executions);
        }
      });
  }, [company]);

  if (!company) return <div className="p-8 text-center text-muted-foreground font-mono text-sm uppercase tracking-wider">Select a company first.</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <h1 className="text-3xl font-light tracking-tight">Fleet Operations</h1>
          <p className="text-muted-foreground">Live tracking and execution monitoring across all active trips.</p>
        </div>
        <Link href="/command-center">
          <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5 text-primary">
            <ShieldCheck className="w-4 h-4" /> Go to Command Center
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPI Summary */}
        <div className="lg:col-span-1 space-y-6">
          <DashboardCard title="Fleet Status" icon={Truck}>
            <div className="space-y-6">
              <div>
                <p className="text-4xl font-light tracking-tight">{activeExecutions.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Active Trips</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/20">
                <div>
                  <p className="text-2xl font-light text-primary">{activeExecutions.filter(e => e.status === "driving").length}</p>
                  <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Driving</p>
                </div>
                <div>
                  <p className="text-2xl font-light text-amber-500">{activeExecutions.filter(e => e.status === "paused").length}</p>
                  <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Paused</p>
                </div>
              </div>
            </div>
          </DashboardCard>
          
          <DashboardCard title="Quick Actions" icon={Navigation}>
             <div className="space-y-3">
               <Link href="/driver-ops" className="block">
                 <Button variant="secondary" className="w-full justify-start font-normal bg-muted/30">
                   <Navigation className="w-4 h-4 mr-3 text-primary" /> Simulate Driver App
                 </Button>
               </Link>
             </div>
          </DashboardCard>
        </div>

        {/* Live Trips List */}
        <div className="lg:col-span-2">
          <DashboardCard title="Live Executions" icon={Activity} action={<Activity className="w-4 h-4 text-emerald-400" />} noPadding>
            {activeExecutions.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground font-mono text-sm">
                No active executions found.
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {activeExecutions.map((exec, idx) => (
                  <motion.div
                    key={exec.shipmentId}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-6 hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <Link href={`/shipments/${exec.shipmentId}`} className="text-lg font-medium hover:text-primary transition-colors flex items-center gap-2">
                          {exec.shipmentId.substring(0, 8)}... <ArrowRight className="w-4 h-4 opacity-50" />
                        </Link>
                        <p className="text-sm text-muted-foreground">Driver: {exec.driverId} | Vehicle: {exec.vehicleId}</p>
                      </div>
                      <StatusBadge status={exec.status} />
                    </div>

                    <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Live ETA</p>
                        <p className="font-mono text-sm">{exec.currentETA || "--"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Checkpoints</p>
                        <p className="font-mono text-sm">{exec.completedCheckpoints} / {exec.checkpoints?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Speed</p>
                        <p className="font-mono text-sm">{exec.lastKnownLocation?.speed || 0} km/h</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Last Updated</p>
                        <p className="font-mono text-sm">
                          {exec.lastUpdated ? new Date(exec.lastUpdated).toLocaleTimeString() : "--"}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
