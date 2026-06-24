"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, MapPin, Calendar, Activity, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIncidents() {
      try {
        const res = await fetch("/api/intelligence/incidents");
        if (res.ok) {
          const data = await res.json();
          setIncidents(data.incidents || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchIncidents();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Incident Center</h1>
        <p className="text-muted-foreground">
          Live tracking of all incidents affecting your logistics operations.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex gap-2">
            <input type="text" placeholder="Search incidents..." className="px-3 py-1.5 text-sm rounded-md border border-input bg-background" />
            <select className="px-3 py-1.5 text-sm rounded-md border border-input bg-background">
              <option>All Severities</option>
              <option>Critical</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
          <span className="text-sm font-medium text-muted-foreground">{incidents.length} Active Incidents</span>
        </div>
        
        {loading ? (
          <div className="p-12 text-center text-muted-foreground animate-pulse">Loading incidents...</div>
        ) : incidents.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No active incidents found.</div>
        ) : (
          <div className="divide-y divide-border">
            {incidents.map((incident) => (
              <div key={incident.incidentId} className="p-5 flex flex-col md:flex-row gap-4 md:items-center hover:bg-muted/10 transition-colors">
                <div className="flex-shrink-0">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    incident.severity === "critical" ? "bg-red-500/10 text-red-500" :
                    incident.severity === "high" ? "bg-orange-500/10 text-orange-500" :
                    incident.severity === "medium" ? "bg-amber-500/10 text-amber-500" :
                    "bg-blue-500/10 text-blue-500"
                  )}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{incident.title}</h3>
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider",
                      incident.severity === "critical" ? "bg-red-500/20 text-red-600" :
                      incident.severity === "high" ? "bg-orange-500/20 text-orange-600" :
                      incident.severity === "medium" ? "bg-amber-500/20 text-amber-600" :
                      "bg-blue-500/20 text-blue-600"
                    )}>
                      {incident.severity}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-2xl">{incident.description}</p>
                  
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {incident.latitude.toFixed(2)}, {incident.longitude.toFixed(2)} ({incident.affectedRadiusKm}km radius)
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5" />
                      {incident.category}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(incident.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 text-right space-y-1 bg-muted/30 p-3 rounded-lg md:w-48">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Impact Score</p>
                  <p className="text-2xl font-bold">{incident.impactScore}/100</p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground mt-1">
                    <Info className="w-3 h-3" />
                    {incident.confidence}% Confidence
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
