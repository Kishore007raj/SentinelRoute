"use client";

import { useEffect, useState } from "react";
import { Activity, MapPin, Truck, AlertTriangle, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function GlobalOperationalMonitor() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const res = await fetch("/api/admin/operational");
        if (res.ok) {
          const data = await res.json();
          setRoutes(data.activeRoutes || []);
        }
      } catch (err) {
        console.error("Failed to fetch operational data", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRoutes();
    const interval = setInterval(fetchRoutes, 30000); // 30s refresh for admin view
    return () => clearInterval(interval);
  }, []);

  const filteredRoutes = routes.filter(r => 
    r.tenantName.toLowerCase().includes(search.toLowerCase()) || 
    r.shipmentId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-theme(spacing.24))]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-500" />
            Global Operational Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Cross-tenant live tracking and active route overview.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search tenant or shipment ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="p-2 border border-border rounded-md bg-card shadow-sm hidden sm:flex">
            <Filter className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-6">
        {/* Map View Placeholder */}
        <div className="flex-[2] bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col relative">
          <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/-98.5795,39.8283,3.5,0/1200x800?access_token=pk.eyJ1IjoiZHVtbXkiLCJhIjoiY2R1bW15In0.dummy')] bg-cover bg-center opacity-40 mix-blend-luminosity pointer-events-none" />
          
          <div className="relative z-10 flex-1 p-6 flex flex-col">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur-md border border-border rounded-full text-xs font-semibold shadow-sm w-fit">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live Tracking Engine Active
            </div>
            
            <div className="mt-auto bg-background/90 backdrop-blur-md border border-border rounded-lg p-4 shadow-lg max-w-sm">
              <h3 className="font-semibold text-sm mb-3">Global Overview</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Active Routes</p>
                  <p className="font-bold text-lg">{routes.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">At Risk</p>
                  <p className="font-bold text-lg text-rose-500">{routes.filter(r => r.status === "at-risk").length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Routes List */}
        <div className="flex-1 bg-card border border-border rounded-xl shadow-sm flex flex-col min-w-[320px]">
          <div className="p-4 border-b border-border bg-muted/20">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Active Route Stream
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-border border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : filteredRoutes.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-12">
                No active routes match your search.
              </div>
            ) : (
              filteredRoutes.map(route => (
                <div key={route.shipmentId} className="p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors bg-background">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">{route.tenantName}</span>
                      <p className="text-sm font-medium">{route.origin?.name} → {route.destination?.name}</p>
                    </div>
                    {route.status === "at-risk" ? (
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    ) : (
                      <Truck className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  
                  <div className="flex justify-between items-end mt-3">
                    <span className="text-[10px] font-mono text-muted-foreground">{route.shipmentId}</span>
                    <Badge variant="outline" className="text-[10px] py-0 h-5">
                      {route.telemetry ? `${route.telemetry.speed || 0} mph` : "No Signal"}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
