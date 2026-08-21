"use client";

import { fetchApi } from "@/lib/api-client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useCompany } from "@/lib/company-context";
import type { Shipment, DriverLocation, ShipmentExecution, ShipmentCheckpoint } from "@/lib/types";
import { Play, Pause, CheckSquare, MapPin, Truck, Navigation, Activity } from "lucide-react";
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

    fetchApi(`/api/shipments?companyId=${company.companyId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.shipments) {
          const assigned = data.shipments.filter(
            (s: Shipment) => s.assignedDriverId && ["draft", "active", "at-risk", "completed"].includes(s.status)
          );
          setShipments(assigned);
        }
      });
  }, [company]);

  const fetchExecution = useCallback(async () => {
    if (!selectedShipmentId) return;
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
  }, [selectedShipmentId]);

  useEffect(() => {
    if (selectedShipmentId) {
      fetchExecution();
    }
  }, [selectedShipmentId, fetchExecution]);

  const handleStartTrip = async () => {
    if (!selectedShipmentId) return;
    try {
      const res = await fetchApi(`/api/execution/${selectedShipmentId}/workflow`, {
        method: "POST",
        body: JSON.stringify({ action: "start" }),
      });
      if (res.ok) {
        toast.success("Trip started successfully!");
        fetchExecution();
      } else {
        toast.error("Failed to start trip.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const handlePauseTrip = async () => {
    if (!selectedShipmentId) return;
    try {
      const res = await fetchApi(`/api/execution/${selectedShipmentId}/workflow`, {
        method: "POST",
        body: JSON.stringify({ action: "pause", reason: "Driver rest break" }),
      });
      if (res.ok) {
        toast.info("Trip paused.");
        fetchExecution();
      }
    } catch {
      toast.error("Error pausing trip.");
    }
  };

  const handleResumeTrip = async () => {
    if (!selectedShipmentId) return;
    try {
      const res = await fetchApi(`/api/execution/${selectedShipmentId}/workflow`, {
        method: "POST",
        body: JSON.stringify({ action: "resume" }),
      });
      if (res.ok) {
        toast.success("Trip resumed.");
        fetchExecution();
      }
    } catch {
      toast.error("Error resuming trip.");
    }
  };

  const handleCompleteTrip = async () => {
    if (!selectedShipmentId) return;
    try {
      const res = await fetchApi(`/api/execution/${selectedShipmentId}/workflow`, {
        method: "POST",
        body: JSON.stringify({ action: "complete" }),
      });
      if (res.ok) {
        toast.success("Trip marked complete!");
        fetchExecution();
      }
    } catch {
      toast.error("Error completing trip.");
    }
  };

  const handleSendLocation = async () => {
    if (!selectedShipmentId || !execution) return;
    try {
      const locationPayload: DriverLocation = {
        latitude: simLat,
        longitude: simLng,
        speed: 55,
        timestamp: new Date().toISOString(),
      };

      const res = await fetchApi(`/api/execution/${selectedShipmentId}/location`, {
        method: "POST",
        body: JSON.stringify(locationPayload),
      });

      if (res.ok) {
        toast.success("Location ping sent!");
        fetchExecution();
      }
    } catch {
      toast.error("Failed to send location.");
    }
  };

  const handlePassCheckpoint = async (checkpointId: string) => {
    if (!selectedShipmentId) return;
    try {
      const res = await fetchApi(`/api/execution/${selectedShipmentId}/checkpoint`, {
        method: "POST",
        body: JSON.stringify({ checkpointId, action: "arrive" }),
      });
      if (res.ok) {
        toast.success("Checkpoint recorded!");
        fetchExecution();
      }
    } catch {
      toast.error("Error updating checkpoint.");
    }
  };

  if (!company) {
    return (
      <div className="panel p-12 text-center text-muted-foreground font-mono text-xs uppercase tracking-widest">
        Select a company to load driver execution.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full space-y-7 pb-12">
      {/* Header */}
      <div className="pb-6 border-b border-border">
        <p className="label-meta flex items-center gap-2 mb-2">
          <Truck className="w-3.5 h-3.5 text-primary" />
          Driver Ops & Active Execution Simulator
        </p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Driver Execution</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Simulate location pings, checkpoint arrival, and trip workflow state transitions.
        </p>
      </div>

      {/* Shipment Selector */}
      <div className="panel p-5 bg-card space-y-3">
        <label className="label-meta">Select Assigned Shipment</label>
        <select
          value={selectedShipmentId}
          onChange={(e) => setSelectedShipmentId(e.target.value)}
          className="w-full h-10 bg-muted/20 border border-border text-xs font-semibold rounded-lg px-3.5 focus:border-primary text-foreground"
        >
          <option value="">-- Choose active driver shipment --</option>
          {shipments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.shipmentCode} ({s.origin} → {s.destination}) — {s.status}
            </option>
          ))}
        </select>
      </div>

      {selectedShipmentId && execution && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Main Controls (7 cols) */}
          <div className="md:col-span-7 space-y-6">
            {/* Status & Controls Panel */}
            <div className="panel p-5 bg-card space-y-5">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="space-y-0.5">
                  <p className="label-meta">Trip Workflow State</p>
                  <p className="text-sm font-bold text-foreground capitalize">{execution.status}</p>
                </div>
                <StatusBadge status={execution.status === "driving" ? "active" : execution.status} />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2.5">
                {execution.status === "pending" && (
                  <Button onClick={handleStartTrip} className="h-9 text-xs font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white gap-2">
                    <Play className="w-3.5 h-3.5" /> Start Trip
                  </Button>
                )}

                {execution.status === "driving" && (
                  <Button onClick={handlePauseTrip} variant="outline" className="h-9 text-xs font-bold uppercase tracking-wider gap-2 border-amber-400/40 text-amber-400 hover:bg-amber-400/10">
                    <Pause className="w-3.5 h-3.5" /> Pause Trip
                  </Button>
                )}

                {execution.status === "paused" && (
                  <Button onClick={handleResumeTrip} className="h-9 text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                    <Play className="w-3.5 h-3.5" /> Resume Trip
                  </Button>
                )}

                {(execution.status === "driving" || execution.status === "paused") && (
                  <Button onClick={handleCompleteTrip} variant="outline" className="h-9 text-xs font-bold uppercase tracking-wider gap-2 border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10">
                    <CheckSquare className="w-3.5 h-3.5" /> Complete Trip
                  </Button>
                )}
              </div>
            </div>

            {/* Location Simulator */}
            <div className="panel p-5 bg-card space-y-4">
              <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                <Navigation className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">GPS Location Ping Simulator</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="label-meta">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={simLat}
                    onChange={(e) => setSimLat(parseFloat(e.target.value))}
                    className="w-full h-9 bg-muted/20 border border-border rounded-lg px-3 text-xs font-mono text-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <label className="label-meta">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={simLng}
                    onChange={(e) => setSimLng(parseFloat(e.target.value))}
                    className="w-full h-9 bg-muted/20 border border-border rounded-lg px-3 text-xs font-mono text-foreground"
                  />
                </div>
              </div>

              <Button onClick={handleSendLocation} className="w-full h-9 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground gap-2">
                <MapPin className="w-3.5 h-3.5" /> Send GPS Location Ping
              </Button>
            </div>
          </div>

          {/* Checkpoints & Timeline (5 cols) */}
          <div className="md:col-span-5 space-y-6">
            <div className="panel p-5 bg-card space-y-4">
              <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Route Checkpoints</h3>
              </div>

              <div className="space-y-2.5">
                {execution.checkpoints?.map((cp: ShipmentCheckpoint) => {
                  const isPassed = cp.status === "arrived" || cp.status === "departed";
                  return (
                    <div key={cp.id} className="flex items-center justify-between p-3 bg-muted/10 border border-border/40 rounded-lg text-xs">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-foreground truncate">{cp.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{cp.status}</p>
                      </div>

                      {!isPassed ? (
                        <Button
                          size="sm"
                          onClick={() => handlePassCheckpoint(cp.id)}
                          className="h-7 text-[10px] font-bold uppercase tracking-wider px-2 bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
                        >
                          Pass
                        </Button>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Passed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
