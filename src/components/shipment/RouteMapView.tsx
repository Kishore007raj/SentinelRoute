"use client";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Shield, Clock, MapPin, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Route } from "@/lib/types";
import { AiInsightBox } from "./AiInsightBox";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";



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
  route: Route;
  routes: Route[];
  status?: "active" | "at-risk" | "dispatched" | "completed";
  origin?: string;
  destination?: string;
  aiExplanation?: string | null;
  aiLoading?: boolean;
  cargoType?: string;
  urgency?: string;
  /** "mappls+openweather" | "mappls+openweather+tomtom" | "static-fallback" | undefined */
  dataSource?: string;
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
}: RouteMapViewProps) {
  const [isClient, setIsClient] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fix missing marker icons natively in Leaflet
  const DefaultIcon = typeof window !== 'undefined' ? (require("leaflet") as any).icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  }) : null;

  // Derive map center from geometry bounds
  let originCoords: [number, number] | null = null;
  let destCoords: [number, number] | null = null;

  if (route.geometry && route.geometry.length > 1) {
    originCoords = route.geometry[0];
    destCoords   = route.geometry[route.geometry.length - 1];
  }

  const mapCenter: [number, number] =
    originCoords && destCoords
      ? [(originCoords[0] + destCoords[0]) / 2, (originCoords[1] + destCoords[1]) / 2]
      : [20.5937, 78.9629]; // Default India center

  const polylinePoints: [number, number][] = route.geometry ?? [];

  const isLiveData = dataSource === "mappls+openweather" || dataSource === "mappls+openweather+tomtom";
  const isFallback = dataSource === "static-fallback";

  if (!isClient) {
    return <div className="h-[300px] bg-muted/20 animate-pulse rounded-xl" />;
  }

  return (
    <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-card space-y-0">

      {/* ── Data source banner ─────────────────────────────────────────────── */}
      {dataSource && (
        <div className={cn(
          "flex items-start gap-2.5 px-4 py-3 border-b text-xs font-medium",
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
                Live data — Mappls routing + OpenWeather
                {dataSource === "mappls+openweather+tomtom" ? " + TomTom Traffic" : ""}
              </span>
            </div>
          ) : isFallback ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                <span>Limited data mode — using estimated routes</span>
              </div>
              <p className="text-[10px] text-amber-400/70 pl-5 leading-relaxed">
                Live traffic unavailable — ETAs are estimates. Weather scoring less accurate. Treat risk scores as indicative.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Map ───────────────────────────────────────────────────────────── */}
      <div className="h-[300px] w-full relative z-0">
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
          {polylinePoints.length >= 2 && (
            <>
              <Polyline positions={polylinePoints} color="#5eadd4" weight={4} opacity={0.85} />
              <Marker position={polylinePoints[0]} icon={DefaultIcon}>
                <Popup>Origin: {origin}</Popup>
              </Marker>
              <Marker position={polylinePoints[polylinePoints.length - 1]} icon={DefaultIcon}>
                <Popup>Destination: {destination}</Popup>
              </Marker>
            </>
          )}
        </MapContainer>

        {/* Status badge */}
        <div className="absolute top-4 right-4 z-[1000] bg-background/90 backdrop-blur-md border border-border p-3 rounded-lg shadow-xl" style={{ boxShadow: "var(--glow-soft)" }}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Selected Route</span>
            </div>
            <div className="text-[10px] text-muted-foreground/60 uppercase">{status}</div>
          </div>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
        <div className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock size={14} />
            <span className="text-[10px] uppercase tracking-widest font-medium">ETA</span>
          </div>
          <span className="text-lg font-bold text-foreground">{route.eta}</span>
        </div>
        <div className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield size={14} />
            <span className="text-[10px] uppercase tracking-widest font-medium">Weather</span>
          </div>
          <span className={cn("text-lg font-bold", breakdownColor(route.riskBreakdown.weather))}>
            {weatherLabel(route.riskBreakdown.weather)}
          </span>
        </div>
        <div className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin size={14} />
            <span className="text-[10px] uppercase tracking-widest font-medium">Distance</span>
          </div>
          <span className="text-lg font-bold text-foreground">{route.distance}</span>
        </div>
      </div>

      {/* ── Risk breakdown — human-readable ───────────────────────────────── */}
      <div className="px-4 py-4 border-t border-border space-y-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Risk factors</p>
        {Object.entries(route.riskBreakdown).map(([key, val]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-24 shrink-0 capitalize">
              {key === "cargoSensitivity" ? "Cargo" : key}
            </span>
            <div className="flex-1 h-1.5 bg-muted overflow-hidden rounded-full">
              <div
                className={cn("h-full rounded-full", val > 60 ? "bg-red-400" : val > 35 ? "bg-amber-400" : "bg-emerald-400")}
                style={{ width: `${val}%` }}
              />
            </div>
            <span className={cn("text-xs font-medium w-24 text-right shrink-0", breakdownColor(val))}>
              {breakdownLabel(key, val)}
            </span>
          </div>
        ))}
      </div>

      {/* ── Alert ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-4 border-t border-border pt-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {route.alerts.length > 0
              ? route.alerts[0]
              : "Corridor analysis complete. No critical obstructions detected."}
          </p>
        </div>
      </div>

      {/* ── Why this route? ────────────────────────────────────────────────── */}
      <div className="px-4 pb-5 border-t border-border pt-4">
        <AiInsightBox
          explanation={aiExplanation ?? null}
          loading={aiLoading}
          route={route}
          cargoType={cargoType}
          urgency={urgency}
          allRoutes={routes}
        />
      </div>
    </div>
  );
}
