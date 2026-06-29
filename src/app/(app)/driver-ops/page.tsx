"use client";
import { fetchApi } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useCompany } from "@/lib/company-context";
import type { Shipment, DriverLocation, ShipmentExecution, ShipmentCheckpoint } from "@/lib/types";
import { Play, Pause, Square, CheckSquare, MapPin, Truck } from "lucide-react";
import { toast } from "sonner";

export default function DriverOpsPage() {
  const { company } = useCompany();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>("");
  const [execution, setExecution] = useState<ShipmentExecution | null>(null);
  
  // Location simulation
  const [simLat, setSimLat] = useState<number>(0);
  const [simLng, setSimLng] = useState<number>(0);

  useEffect(() => {
    if (!company) return;
    
    // Fetch shipments assigned to drivers (status active/draft with assignedDriverId)
    fetchApi(`/api/shipments?companyId=${company.companyId}`)
      .then(res => res.json())
      .then(data => {
        if (data.shipments) {
          const assigned = data.shipments.filter((s: Shipment) => s.assignedDriverId && ["draft", "active", "at-risk", "completed"].includes(s.status));
          setShipments(assigned);
        }
      });
  }, [company]);

  const fetchExecution = async () => {
    try {
      const res = await fetchApi(`/api/execution/${selectedShipmentId}`);
      if (res.ok) {
        const data = await res.json();
        setExecution(data.execution);
        
        if (data.execution && data.execution.lastKnownLocation) {
          setSimLat(data.execution.lastKnownLocation.latitude);
          setSimLng(data.execution.lastKnownLocation.longitude);
        } else if (data.execution && data.execution.plannedRoute && data.execution.plannedRoute.stops?.length > 0) {
          const origin = data.execution.plannedRoute.stops[0].location;
          if (origin) {
            setSimLat(origin.lat);
            setSimLng(origin.lng);
          }
        }
      } else {
        setExecution(null);
      }
    } catch {
      setExecution(null);
    }
  };

  useEffect(() => {
    if (!selectedShipmentId) {
      setExecution(null);
      return;
    }
    fetchExecution();
  }, [selectedShipmentId]);

  const handleAction = async (action: string) => {
    if (!selectedShipmentId) return;
    try {
      const res = await fetchApi(`/api/execution/${selectedShipmentId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: `Driver action: ${action}` })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || await res.text());
      }
      toast.success(`Trip ${action} successful`);
      fetchExecution();
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    }
  };

  const handleCheckpoint = async (checkpointId: string, action: string) => {
    try {
      const res = await fetchApi(`/api/execution/${selectedShipmentId}/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointId, action, notes: `Checkpoint ${action}` })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || await res.text());
      }
      toast.success(`Checkpoint ${action} successful`);
      fetchExecution();
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    }
  };

  const handlePingLocation = async () => {
    try {
      const res = await fetchApi(`/api/execution/${selectedShipmentId}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: Number(simLat),
          longitude: Number(simLng),
          speed: 45,
          accuracy: 10,
          recalculateETA: true
        })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || await res.text());
      }
      toast.success("Location pinged");
      fetchExecution();
    } catch (e: any) {
      toast.error(e.message || "Location ping failed");
    }
  };

  if (!company) return <div className="p-8 text-center text-muted-foreground font-mono text-sm uppercase tracking-wider">Select a company first.</div>;

  const selectedShipment = shipments.find(s => s.id === selectedShipmentId);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-light tracking-tight">Driver Operations</h1>
        <p className="text-muted-foreground">Simulate driver app actions for assigned shipments.</p>
      </div>

      <DashboardCard title="Select Assigned Shipment" icon={Truck}>
        <select
          className="w-full bg-background border border-border focus:border-primary/50 outline-none p-3 rounded-lg font-mono text-sm"
          value={selectedShipmentId}
          onChange={(e) => setSelectedShipmentId(e.target.value)}
        >
          <option value="">-- Select Shipment --</option>
          {shipments.map(s => (
            <option key={s.id} value={s.id}>
              {s.shipmentCode} - {s.originName || s.origin} to {s.destinationName || s.destination} (Driver: {s.assignedDriverName || s.assignedDriverId})
            </option>
          ))}
        </select>
      </DashboardCard>

      {selectedShipment && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <DashboardCard title={selectedShipment.shipmentCode} icon={Truck} action={execution ? <StatusBadge status={execution.status} /> : undefined}>
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                {execution?.currentETA && (
                  <p className="text-sm text-emerald-400 uppercase tracking-wider">Live ETA: {execution.currentETA}</p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => handleAction("start")} disabled={execution?.status && execution.status !== "pending" && execution.status !== "cancelled"}>
                  <Play className="w-4 h-4 mr-2" /> Start Trip
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAction("pause")} disabled={execution?.status !== "driving"}>
                  <Pause className="w-4 h-4 mr-2" /> Pause
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAction("resume")} disabled={execution?.status !== "paused"}>
                  <Play className="w-4 h-4 mr-2" /> Resume
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAction("complete")} disabled={!execution || execution.status === "completed"}>
                  <CheckSquare className="w-4 h-4 mr-2" /> Complete
                </Button>
              </div>
            </div>

            {execution && execution.status === "driving" && (
              <div className="border-t border-border/20 pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Simulate Location Ping</h4>
                <div className="flex gap-4 items-end flex-wrap">
                  <div className="space-y-2 flex-1 min-w-[200px]">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Latitude</label>
                    <input type="number" step="0.0001" className="w-full bg-background border border-border/50 p-2 rounded-md font-mono text-sm focus:border-primary/50 outline-none" value={simLat} onChange={e => setSimLat(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2 flex-1 min-w-[200px]">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Longitude</label>
                    <input type="number" step="0.0001" className="w-full bg-background border border-border/50 p-2 rounded-md font-mono text-sm focus:border-primary/50 outline-none" value={simLng} onChange={e => setSimLng(Number(e.target.value))} />
                  </div>
                  <Button onClick={handlePingLocation} className="shrink-0 bg-primary/10 text-primary hover:bg-primary/20 border-none">
                    <MapPin className="w-4 h-4 mr-2" /> Ping
                  </Button>
                </div>
              </div>
            )}
            
            {execution && execution.checkpoints && (
              <div className="border-t border-border/20 pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Checkpoints</h4>
                <div className="space-y-2">
                  {execution.checkpoints.map((cp: ShipmentCheckpoint, idx: number) => (
                    <motion.div 
                      key={cp.id} 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      transition={{ delay: idx * 0.1 }}
                      className="flex justify-between items-center p-4 bg-muted/10 border border-border/30 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-sm">{cp.name}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-1">Status: {cp.status}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-8" disabled={cp.status !== "pending" || execution.status !== "driving"} onClick={() => handleCheckpoint(cp.id, "arrive")}>
                          Arrive
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" disabled={cp.status !== "arrived" || execution.status !== "driving"} onClick={() => handleCheckpoint(cp.id, "depart")}>
                          Depart
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </DashboardCard>
        </motion.div>
      )}
    </div>
  );
}
