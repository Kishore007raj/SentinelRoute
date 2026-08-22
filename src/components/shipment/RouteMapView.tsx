"use client";
import { useEffect, useState, useRef } from "react";
import { Shield, Clock, MapPin, AlertTriangle, Wifi, WifiOff, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Route, Incident, ShipmentExecution } from "@/lib/types";
import { AiInsightBox } from "./AiInsightBox";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useStore } from "@/lib/store";
import { useUser } from "@/lib/auth-context";



// ─── Human-readable risk factor labels ───────────────────────────────────────

function trafficLabel(score: number): string {
  if (score > 65) return "Heavy";
  if (score > 35) return "Moderate";
  return "Light";
}

function weatherLabel(score: number): string {
  if (score > 65) return "Severe";
  if (score > 35) return "Rain risk";
  return "Clear";
}

function disruptionLabel(score: number): string {
  if (score > 65) return "High";
  if (score > 35) return "Moderate";
  return "Low";
}

function cargoLabel(score: number): string {
  if (score > 65) return "High sensitivity";
  if (score > 35) return "Moderate";
  return "Low";
}

function breakdownLabel(key: string, score: number): string {
  switch (key) {
    case "traffic":          return trafficLabel(score);
    case "weather":          return weatherLabel(score);
    case "disruption":       return disruptionLabel(score);
    case "cargoSensitivity": return cargoLabel(score);
    default:                 return score > 50 ? "Elevated" : "Normal";
  }
}

function breakdownColor(score: number): string {
  if (score > 65) return "text-red-400";
  if (score > 35) return "text-amber-400";
  return "text-emerald-400";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RouteMapViewProps {
  route?: Route;
  routes?: Route[];
  status?: "active" | "at-risk" | "dispatched" | "completed" | "in_transit" | "paused" | "cancelled" | "pending";
  origin?: string;
  destination?: string;
  execution?: ShipmentExecution | null;
  aiExplanation?: string | null;
  aiLoading?: boolean;
  cargoType?: string;
  urgency?: string;
  /** "geoapify+openweather" | "geoapify+openweather+tomtom" | "static-fallback" | undefined */
  dataSource?: string;
  isGlobal?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RouteMapView({
  route,
  routes,
  status = "active",
  origin,
  destination,
  aiExplanation,
  aiLoading = false,
  cargoType,
  urgency,
  dataSource,
  isGlobal = false,
  execution,
}: RouteMapViewProps) {
  const [isClient, setIsClient] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const { activeShipments } = useStore();
  const { user } = useUser();
  const [incidents, setIncidents] = useState<Incident[]>([]);

  // Layer toggles
  const [showIncidents, setShowIncidents] = useState(true);
  const [showActiveShipments, setShowActiveShipments] = useState(isGlobal ? true : false);
  const [showActiveRoutes, setShowActiveRoutes] = useState(isGlobal ? true : false);

  useEffect(() => {
    setIsClient(true);
    // Fetch incidents for the operations map
    let isMounted = true;
    const fetchIncidents = async () => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/intelligence/incidents", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) setIncidents(data.incidents || []);
      } catch (err) {
        console.error("Failed to fetch map incidents", err);
      }
    };
    fetchIncidents();
    return () => { isMounted = false; };
  }, [user]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [isClient]);

  // Fix missing marker icons natively in Leaflet
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = typeof window !== "undefined" ? require("leaflet") as typeof import("leaflet") : null;
  const DefaultIcon: import("leaflet").Icon | undefined = L ? L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  }) : undefined;

  // Coordinate normalization: ensure [lat, lng]
  const normPoints = (pts?: [number, number][]): [number, number][] => {
    if (!pts) return [];
    return pts.map(([a, b]) => (a > 50 ? [b, a] : [a, b]));
  };

  // Derive map center from geometry bounds
  let originCoords: [number, number] | null = null;
  let destCoords: [number, number] | null = null;

  const rawRouteGeom = route?.geometry ?? routes?.[0]?.geometry;
  const normalizedRouteGeom = normPoints(rawRouteGeom);

  if (normalizedRouteGeom.length > 1) {
    originCoords = normalizedRouteGeom[0];
    destCoords   = normalizedRouteGeom[normalizedRouteGeom.length - 1];
  }

  const mapCenter: [number, number] =
    originCoords && destCoords
      ? [(originCoords[0] + destCoords[0]) / 2, (originCoords[1] + destCoords[1]) / 2]
      : [22.5937, 78.9629]; // Default India center

  const polylinePoints: [number, number][] = normalizedRouteGeom;

  // Fit the map to the route whenever geometry becomes available.
  // MapContainer's center/zoom are initial-only in react-leaflet v4, so when
  // geometry loads asynchronously (e.g. after a detail API fetch), we must
  // imperatively call fitBounds so the route is actually in the viewport.
  // Dependency: polylinePoints.length — re-runs only when geometry goes from
  // absent (0) to present (N), or changes significantly.
  useEffect(() => {
    if (!mapRef.current) return;
    if (polylinePoints.length < 2) return;
    const map = mapRef.current;
    const timer = setTimeout(() => {
      try {
        if (typeof window !== "undefined") {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const Leaflet = require("leaflet") as typeof import("leaflet");
          const bounds = Leaflet.latLngBounds(polylinePoints);
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [32, 32], maxZoom: 10 });
          }
        }
      } catch {
        // fitBounds is best-effort — never block render
      }
    }, 200);
    return () => clearTimeout(timer);
  // polylinePoints reference is stable within a render; length change is the signal
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polylinePoints.length]);

  const isLiveData = dataSource === "geoapify+openweather" || dataSource === "geoapify+openweather+tomtom";
  const isFallback = dataSource === "static-fallback";

  if (!isClient) {
    return <div className="h-[300px] bg-muted/20 animate-pulse rounded-xl" />;
  }

  return (
    <div className="flex flex-col bg-card space-y-0 h-full w-full flex-1 min-h-0">

      {/* ── Data source banner ─────────────────────────────────────────────── */}
      {dataSource && (
        <div className={cn(
          "flex items-start gap-2.5 px-4 py-3 border-b text-xs font-medium shrink-0",
          isLiveData
            ? "bg-emerald-400/5 border-emerald-400/20 text-emerald-400"
            : isFallback
            ? "bg-amber-400/5 border-amber-400/20 text-amber-400"
            : "bg-muted/20 border-border text-muted-foreground"
        )}>
          {isLiveData ? (
            <div className="flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5 shrink-0" />
              <span>
                Live data - Geoapify routing + OpenWeather
                {dataSource === "geoapify+openweather+tomtom" ? " + TomTom Traffic" : ""}
              </span>
            </div>
          ) : isFallback ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                <span>Limited data mode - using estimated routes</span>
              </div>
              <p className="text-[10px] text-amber-400/70 pl-5 leading-relaxed">
                Live traffic unavailable - ETAs are estimates. Weather scoring less accurate. Treat risk scores as indicative.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Map ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 w-full relative z-0 overflow-hidden min-h-0">
        <MapContainer
          ref={mapRef}
          center={mapCenter}
          zoom={originCoords && destCoords ? 6 : 5}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {routes && routes.length > 0 ? (
            routes.map((r) => {
              const isSelected = r.id === route?.id;
              const pts = normPoints(r.geometry);
              if (pts.length < 2) return null;
              
              let color = "#5eadd4";
              if (r.label === "fastest") color = "#3b82f6";
              else if (r.label === "balanced") color = "#10b981";
              else if (r.label === "safest") color = "#f59e0b";

              return (
                <Polyline 
                  key={r.id} 
                  positions={pts} 
                  color={isSelected ? color : "#64748b"} 
                  weight={isSelected ? 5 : 3} 
                  opacity={isSelected ? 0.9 : 0.4} 
                  dashArray={isSelected ? undefined : "5, 10"}
                />
              );
            })
          ) : polylinePoints.length >= 2 ? (
            <Polyline positions={polylinePoints} color="#5eadd4" weight={4} opacity={0.85} />
          ) : null}

          {normalizedRouteGeom.length >= 2 && (
             <>
               <Marker position={normalizedRouteGeom[0]} icon={DefaultIcon}>
                 <Popup>Origin: {origin ?? "Origin"}</Popup>
               </Marker>
               <Marker position={normalizedRouteGeom[normalizedRouteGeom.length - 1]} icon={DefaultIcon}>
                 <Popup>Destination: {destination ?? "Destination"}</Popup>
               </Marker>
             </>
          )}

          {/* Draw Execution History Path */}
          {execution && execution.historicalLocations && execution.historicalLocations.length > 0 && (
            <Polyline 
              positions={execution.historicalLocations.map(loc => [loc.latitude, loc.longitude])}
              color="#ef4444" // red to show actual path taken
              weight={4} 
              opacity={0.9} 
              dashArray="5, 10"
            />
          )}

          {/* Current Driver Location Marker */}
          {execution && execution.lastKnownLocation && (
             <CircleMarker 
               center={[execution.lastKnownLocation.latitude, execution.lastKnownLocation.longitude]} 
               radius={8} 
               pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1 }}
             >
               <Popup className="text-xs">
                 <strong>Driver Location</strong><br/>
                 Lat: {execution.lastKnownLocation.latitude.toFixed(4)}<br/>
                 Lng: {execution.lastKnownLocation.longitude.toFixed(4)}<br/>
                 Speed: {execution.lastKnownLocation.speed} km/h<br/>
                 Updated: {new Date(execution.lastKnownLocation.timestamp).toLocaleTimeString()}
               </Popup>
             </CircleMarker>
          )}

          {/* Draw active shipment real route lines if toggled and geometry exists */}
          {showActiveRoutes && activeShipments.map(s => {
            if (!s.geometry || s.geometry.length < 2) return null;
            const isAtRisk = s.status === "at-risk" || s.riskLevel === "high";
            const lineColor = isAtRisk ? "#f59e0b" : "#10b981";
            const pts = normPoints(s.geometry);
            return (
              <Polyline
                key={`route-${s.id}`}
                positions={pts}
                color={lineColor}
                weight={2}
                opacity={0.6}
                dashArray={isAtRisk ? "6, 6" : undefined}
              />
            );
          })}

          {/* Draw active shipment origin markers if toggled */}
          {showActiveShipments && activeShipments.map(s => {
            if (!s.originLat || !s.originLng) return null;
            const isAtRisk = s.status === "at-risk" || s.riskLevel === "high";
            const markerColor = isAtRisk ? "#f59e0b" : "#3b82f6";
            const markerRadius = isAtRisk ? 8 : 5;
            return (
              <CircleMarker
                key={s.id}
                center={[s.originLat, s.originLng]}
                radius={markerRadius}
                pathOptions={{ color: markerColor, fillColor: markerColor, fillOpacity: isAtRisk ? 0.85 : 0.65, weight: isAtRisk ? 2 : 1 }}
              >
                <Popup className="text-xs">
                  <strong>{s.shipmentCode}</strong><br/>
                  {s.origin} → {s.destination}<br/>
                  Risk: {s.riskScore} · {s.riskLevel}<br/>
                  Status: {s.status}
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Draw incidents if toggled */}
          {showIncidents && incidents.map(inc => (
            <CircleMarker key={inc.incidentId} center={[inc.latitude, inc.longitude]} radius={8} pathOptions={{ color: inc.severity === "critical" ? "#ef4444" : "#f59e0b", fillColor: inc.severity === "critical" ? "#ef4444" : "#f59e0b", fillOpacity: 0.6 }}>
              <Popup className="text-xs">
                <strong>{inc.title}</strong><br/>
                Severity: {inc.severity}<br/>
                Category: {inc.category}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Map Layers Control */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-background/90 backdrop-blur-md border border-border p-2 rounded-lg shadow-xl">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={showIncidents} onChange={e => setShowIncidents(e.target.checked)} className="rounded border-muted bg-transparent accent-amber-500" />
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 group-hover:text-amber-400 transition-colors" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">Live Incidents</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={showActiveShipments} onChange={e => setShowActiveShipments(e.target.checked)} className="rounded border-muted bg-transparent accent-blue-500" />
              <Truck className="w-3.5 h-3.5 text-blue-500 group-hover:text-blue-400 transition-colors" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">Active Fleet</span>
            </label>
            {isGlobal && (
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={showActiveRoutes} onChange={e => setShowActiveRoutes(e.target.checked)} className="rounded border-muted bg-transparent accent-emerald-500" />
                <MapPin className="w-3.5 h-3.5 text-emerald-500 group-hover:text-emerald-400 transition-colors" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">Active Routes</span>
              </label>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className="absolute top-4 right-4 z-[1000] bg-background/90 backdrop-blur-md border border-border p-3 rounded-lg shadow-xl">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Selected Route</span>
            </div>
            <div className="text-[10px] text-muted-foreground/60 uppercase">{status}</div>
          </div>
        </div>
      </div>

    </div>
  );
}
