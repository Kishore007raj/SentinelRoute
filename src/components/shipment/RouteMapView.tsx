"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Shield, Clock, MapPin, AlertTriangle } from "lucide-react";
import { cn, getRiskColor } from "@/lib/utils";
import type { Route } from "@/lib/types";
import "leaflet/dist/leaflet.css";

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((mod) => mod.Polyline), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

interface RouteMapViewProps {
  route: Route;
  routes: Route[];
  status?: "pending" | "in_transit" | "completed";
  origin?: string;
  destination?: string;
}

export function RouteMapView({
  route,
  routes,
  status = "pending",
  origin,
  destination,
}: RouteMapViewProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Fix Leaflet marker icons in Next.js
    import("leaflet").then((L) => {
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });
    });
  }, []);

  if (!isClient) return <div className="h-[300px] bg-slate-900 animate-pulse rounded-xl" />;

  // Convert [lng, lat] to [lat, lng] for Leaflet
  const polylinePoints = route.routeGeometry?.coordinates.map(coord => [coord[1], coord[0]]) as [number, number][] || [];
  
  const startPoint = polylinePoints[0];
  const endPoint = polylinePoints[polylinePoints.length - 1];

  return (
    <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-card">
      {/* Map Section */}
      <div className="h-[300px] w-full relative z-0">
        <MapContainer
          center={startPoint || [20.5937, 78.9629]} // Default to center of India
          zoom={5}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {polylinePoints.length > 0 && (
            <>
              <Polyline positions={polylinePoints} color="#3b82f6" weight={4} opacity={0.8} />
              <Marker position={startPoint}>
                <Popup>Origin: {origin}</Popup>
              </Marker>
              <Marker position={endPoint}>
                <Popup>Destination: {destination}</Popup>
              </Marker>
            </>
          )}
        </MapContainer>

        {/* Legend */}
        <div className="absolute top-4 right-4 z-[1000] bg-slate-900/90 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-xl">
           <div className="flex flex-col gap-2">
             <div className="flex items-center gap-2">
               <div className="w-3 h-3 rounded-full bg-blue-500" />
               <span className="text-[10px] uppercase tracking-wider text-white/70">Selected Route</span>
             </div>
             <div className="text-[10px] text-white/40 uppercase">Mode: {status}</div>
           </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
        <div className="p-4 flex flex-col gap-1 text-center sm:text-left">
          <div className="flex items-center gap-2 text-muted-foreground justify-center sm:justify-start">
            <Clock size={14} />
            <span className="text-[10px] uppercase tracking-widest font-medium">ETA</span>
          </div>
          <span className="text-lg font-bold text-foreground">{route.durationHours.toFixed(1)} hrs</span>
        </div>
        <div className="p-4 flex flex-col gap-1 text-center sm:text-left">
          <div className="flex items-center gap-2 text-muted-foreground justify-center sm:justify-start">
            <Shield size={14} />
            <span className="text-[10px] uppercase tracking-widest font-medium">Weather Impact</span>
          </div>
          <span className={cn("text-lg font-bold", route.riskBreakdown.weather > 50 ? "text-red-400" : route.riskBreakdown.weather > 25 ? "text-amber-400" : "text-emerald-400")}>
            {route.riskBreakdown.weather > 50 ? "Critical" : route.riskBreakdown.weather > 25 ? "Moderate" : "Low"}
          </span>
        </div>
        <div className="p-4 flex flex-col gap-1 text-center sm:text-left">
          <div className="flex items-center gap-2 text-muted-foreground justify-center sm:justify-start">
            <MapPin size={14} />
            <span className="text-[10px] uppercase tracking-widest font-medium">Distance</span>
          </div>
          <span className="text-lg font-bold text-foreground">{route.distanceKm.toFixed(0)} km</span>
        </div>
      </div>

      {/* Alert Section */}
      <div className="p-4 border-t border-border bg-muted/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {(route.alerts?.length || 0) > 0 ? route.alerts?.[0] : "Corridor analysis complete. No critical obstructions reported by OSRM or OpenWeather."}
          </p>
        </div>
      </div>
    </div>
  );
}
