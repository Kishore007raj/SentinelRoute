"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapPin, Shield, Clock, AlertTriangle, Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn, getRiskColor } from "@/lib/utils";
import type { Route } from "@/lib/types";
import { AiInsightBox } from "@/components/shipment/AiInsightBox";

// ── City coordinates ──────────────────────────────────────────────────────────
const CITY_COORDS: Record<string, google.maps.LatLngLiteral> = {
  Chennai:    { lat: 13.0827, lng: 80.2707 },
  Bangalore:  { lat: 12.9716, lng: 77.5946 },
  Mumbai:     { lat: 19.0760, lng: 72.8777 },
  Pune:       { lat: 18.5204, lng: 73.8567 },
  Hyderabad:  { lat: 17.3850, lng: 78.4867 },
  Delhi:      { lat: 28.6139, lng: 77.2090 },
  Kolkata:    { lat: 22.5726, lng: 88.3639 },
  Coimbatore: { lat: 11.0168, lng: 76.9558 },
};

// Route color by label
const ROUTE_COLORS: Record<string, string> = {
  fastest:  "#f87171",
  balanced: "#3b82f6",
  safest:   "#34d399",
};

// Dark map style — matches the app's dark theme
const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry",        stylers: [{ color: "#0f1117" }] },
  { elementType: "labels.text.fill",stylers: [{ color: "#6b7280" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f1117" }] },
  { featureType: "road",            elementType: "geometry",       stylers: [{ color: "#1e2433" }] },
  { featureType: "road",            elementType: "geometry.stroke",stylers: [{ color: "#111827" }] },
  { featureType: "road.highway",    elementType: "geometry",       stylers: [{ color: "#1d2d44" }] },
  { featureType: "road.highway",    elementType: "geometry.stroke",stylers: [{ color: "#0f1117" }] },
  { featureType: "road.highway",    elementType: "labels.text.fill",stylers: [{ color: "#4b5563" }] },
  { featureType: "water",           elementType: "geometry",       stylers: [{ color: "#0a0e1a" }] },
  { featureType: "water",           elementType: "labels.text.fill",stylers: [{ color: "#1e3a5f" }] },
  { featureType: "poi",             stylers: [{ visibility: "off" }] },
  { featureType: "transit",         stylers: [{ visibility: "off" }] },
  { featureType: "administrative",  elementType: "geometry",       stylers: [{ color: "#1f2937" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#374151" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#4b5563" }] },
  { featureType: "landscape",       elementType: "geometry",       stylers: [{ color: "#111827" }] },
];

// ── Inner component that draws routes using Directions API ────────────────────
function RoutePolylines({
  routes,
  selectedRoute,
  origin,
  destination,
}: {
  routes: Route[];
  selectedRoute: Route;
  origin: string;
  destination: string;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary("routes");
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (!map || !routesLib) return;

    const originCoords = CITY_COORDS[origin];
    const destCoords   = CITY_COORDS[destination];
    if (!originCoords || !destCoords) return;

    const directionsService = new routesLib.DirectionsService();

    // Clear previous polylines and markers
    polylinesRef.current.forEach((p) => p.setMap(null));
    markersRef.current.forEach((m) => m.setMap(null));
    polylinesRef.current = [];
    markersRef.current = [];

    // Draw each route — selected on top, others faint
    routes.forEach((route) => {
      const isSelected = route.id === selectedRoute.id;
      const color = ROUTE_COLORS[route.label] ?? "#6b7280";

      // Use waypoints to differentiate routes visually
      const waypoints: google.maps.DirectionsWaypoint[] = [];
      if (route.label === "safest" && origin === "Chennai" && destination === "Bangalore") {
        waypoints.push({ location: "Salem, Tamil Nadu", stopover: false });
      } else if (route.label === "balanced" && origin === "Chennai" && destination === "Bangalore") {
        waypoints.push({ location: "Dharmapuri, Tamil Nadu", stopover: false });
      }

      directionsService.route(
        {
          origin: originCoords,
          destination: destCoords,
          waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          avoidHighways: route.label === "safest",
        },
        (result, status) => {
          if (status !== "OK" || !result) return;

          const path = result.routes[0].overview_path;

          const polyline = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: color,
            strokeOpacity: isSelected ? 0.9 : 0.25,
            strokeWeight: isSelected ? 4 : 2,
            map,
            zIndex: isSelected ? 10 : 1,
          });

          polylinesRef.current.push(polyline);

          // Fit bounds to selected route
          if (isSelected) {
            const bounds = new google.maps.LatLngBounds();
            path.forEach((p) => bounds.extend(p));
            map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
          }
        }
      );
    });

    // Origin marker
    const originMarker = new google.maps.Marker({
      position: originCoords,
      map,
      title: origin,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: "#e2e8f0",
        fillOpacity: 1,
        strokeColor: "#94a3b8",
        strokeWeight: 2,
      },
    });

    // Destination marker
    const destMarker = new google.maps.Marker({
      position: destCoords,
      map,
      title: destination,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: ROUTE_COLORS[selectedRoute.label] ?? "#3b82f6",
        fillOpacity: 1,
        strokeColor: "#1e40af",
        strokeWeight: 2,
      },
    });

    markersRef.current = [originMarker, destMarker];

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      markersRef.current.forEach((m) => m.setMap(null));
    };
  }, [map, routesLib, routes, selectedRoute, origin, destination]);

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
interface RouteMapViewProps {
  route: Route;
  routes: Route[];
  status?: "active" | "dispatched";
  origin?: string;
  destination?: string;
  aiExplanation?: string | null;
  aiLoading?: boolean;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export function RouteMapView({
  route,
  routes,
  status = "active",
  origin = "Chennai",
  destination = "Bangalore",
  aiExplanation,
  aiLoading = false,
}: RouteMapViewProps) {
  const riskColor = getRiskColor(route.riskLevel);
  const [mapError, setMapError] = useState(false);

  // Center between origin and destination
  const originCoords = CITY_COORDS[origin] ?? { lat: 13.0827, lng: 80.2707 };
  const destCoords   = CITY_COORDS[destination] ?? { lat: 12.9716, lng: 77.5946 };
  const center = {
    lat: (originCoords.lat + destCoords.lat) / 2,
    lng: (originCoords.lng + destCoords.lng) / 2,
  };

  return (
    <div className="flex flex-col gap-0 border border-border rounded-xl overflow-hidden">

      {/* Status bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2.5">
          <motion.div
            animate={status === "dispatched" ? { scale: [1, 1.3, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            className={cn(
              "w-2 h-2 rounded-full",
              status === "dispatched" ? "bg-emerald-400" : "bg-primary"
            )}
          />
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {status === "dispatched" ? "Active mission" : "Planning"}
          </p>
        </div>
        <p className="text-xs font-semibold text-foreground">{route.name}</p>
      </div>

      {/* Map */}
      <div className="relative h-[220px] sm:h-[260px] md:h-[300px] overflow-hidden">
        {!API_KEY || API_KEY === "YOUR_GOOGLE_MAPS_API_KEY_HERE" || mapError ? (
          // Fallback when no API key
          <FallbackMap
            route={route}
            routes={routes}
            origin={origin}
            destination={destination}
          />
        ) : (
          <APIProvider
            apiKey={API_KEY}
            onError={() => setMapError(true)}
          >
            <Map
              defaultCenter={center}
              defaultZoom={7}
              mapId="sentinelroute-map"
              styles={DARK_MAP_STYLE}
              disableDefaultUI
              gestureHandling="cooperative"
              className="w-full h-full"
            >
              <RoutePolylines
                routes={routes}
                selectedRoute={route}
                origin={origin}
                destination={destination}
              />
            </Map>

            {/* Route legend overlay */}
            <div className="absolute right-3 top-3 bg-black/80 border border-white/10 backdrop-blur-sm px-3 py-2 rounded-lg z-10">
              <div className="space-y-1.5">
                {routes.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <div
                      className="w-4 h-0.5 rounded-full"
                      style={{
                        backgroundColor: ROUTE_COLORS[r.label],
                        opacity: r.id === route.id ? 1 : 0.35,
                      }}
                    />
                    <span className={cn(
                      "text-[9px] uppercase tracking-widest",
                      r.id === route.id ? "text-white font-semibold" : "text-white/40"
                    )}>
                      {r.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </APIProvider>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">ETA</p>
          </div>
          <p className="text-xl font-bold text-foreground">{route.eta}</p>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield className="w-3 h-3 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Risk</p>
          </div>
          <p className={cn("text-xl font-bold", riskColor)}>{route.riskScore}</p>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MapPin className="w-3 h-3 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Distance</p>
          </div>
          <p className="text-xl font-bold text-foreground">{route.distance}</p>
        </div>
      </div>

      {/* Alert strip */}
      <div className="border-t border-border px-5 py-4 bg-card/60">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {route.alerts[0] ?? "No active alerts on this corridor."}
          </p>
        </div>
        <Separator className="my-3 opacity-20" />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/40 uppercase tracking-widest">
          <span>Operational note</span>
          <span>{status === "dispatched" ? "Active" : "Planning"}</span>
        </div>
      </div>

      {/* AI Insight box — shown when explanation is available or loading */}
      {(aiLoading || aiExplanation) && (
        <div className="border-t border-border px-5 py-4 bg-card/40">
          <AiInsightBox explanation={aiExplanation ?? null} loading={aiLoading} />
        </div>
      )}
    </div>
  );
}

// ── Fallback when no API key ──────────────────────────────────────────────────
function FallbackMap({
  route,
  routes,
  origin,
  destination,
}: {
  route: Route;
  routes: Route[];
  origin: string;
  destination: string;
}) {
  const alternates = routes.filter((r) => r.id !== route.id);

  return (
    <div className="w-full h-full bg-slate-950 relative overflow-hidden">
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(56,189,248,0.06),transparent_60%)]" />

      {/* Alternate routes */}
      {alternates.map((alt, i) => (
        <div
          key={alt.id}
          className="absolute h-px rounded-full"
          style={{
            background: ROUTE_COLORS[alt.label],
            opacity: 0.2,
            width: `${42 + i * 8}%`,
            top: `${30 + i * 18}%`,
            left: "12%",
          }}
        />
      ))}

      {/* Selected route */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8, ease: [0.0, 0.0, 0.2, 1.0] }}
        className="absolute h-0.5 rounded-full origin-left"
        style={{
          background: ROUTE_COLORS[route.label],
          width: "64%",
          top: "46%",
          left: "14%",
          boxShadow: `0 0 8px ${ROUTE_COLORS[route.label]}60`,
        }}
      />

      {/* Origin dot */}
      <div className="absolute flex items-center gap-1.5" style={{ left: "12%", top: "36%" }}>
        <div className="w-2 h-2 rounded-full bg-slate-200 border border-slate-500 shrink-0" />
        <div>
          <p className="text-[8px] text-white/30 uppercase tracking-widest">Origin</p>
          <p className="text-[10px] font-semibold text-white/70">{origin}</p>
        </div>
      </div>

      {/* Destination dot */}
      <div className="absolute flex items-center gap-1.5 text-right" style={{ right: "12%", bottom: "28%" }}>
        <div className="text-right">
          <p className="text-[8px] text-white/30 uppercase tracking-widest">Destination</p>
          <p className="text-[10px] font-semibold text-white/70">{destination}</p>
        </div>
        <div
          className="w-2 h-2 rounded-full border shrink-0"
          style={{
            backgroundColor: ROUTE_COLORS[route.label],
            borderColor: ROUTE_COLORS[route.label],
          }}
        />
      </div>

      {/* Legend */}
      <div className="absolute right-3 top-3 bg-black/70 border border-white/10 px-2.5 py-2 rounded-lg">
        <div className="space-y-1.5">
          {routes.map((r) => (
            <div key={r.id} className="flex items-center gap-1.5">
              <div
                className="w-3 h-0.5 rounded-full"
                style={{
                  backgroundColor: ROUTE_COLORS[r.label],
                  opacity: r.id === route.id ? 1 : 0.3,
                }}
              />
              <span className={cn(
                "text-[9px] uppercase tracking-widest",
                r.id === route.id ? "text-white font-semibold" : "text-white/35"
              )}>
                {r.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* No API key notice */}
      {(!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === "YOUR_GOOGLE_MAPS_API_KEY_HERE") && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 border border-white/10 text-[9px] text-white/30 px-3 py-1 rounded-full whitespace-nowrap">
          Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local for live map
        </div>
      )}
    </div>
  );
}
