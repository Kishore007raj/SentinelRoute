'use client';

import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useUser } from '@/lib/auth-context';

interface CorridorMapPreviewProps {
  origin: { name: string; lat: number; lng: number } | null;
  destination: { name: string; lat: number; lng: number } | null;
}

// ─── Inner component: auto-fits the map to the route bounds ──────────────────
function FitBounds({
  points,
}: {
  points: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length < 2) return;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const L = require('leaflet') as typeof import('leaflet');
      const bounds = L.latLngBounds(points);
      if (bounds && bounds.isValid && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 10 });
      }
    } catch (err) {
      // Silently fall back if Leaflet methods fail during initialization
      console.warn('[CorridorMapPreview] FitBounds error:', err);
    }
  // Re-fit whenever the route changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points.length]);

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CorridorMapPreview({ origin, destination }: CorridorMapPreviewProps) {
  const [isClient, setIsClient] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const { user } = useUser();

  // Real road geometry from Geoapify. Falls back to straight line when null.
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null);
  const [geometryLoading, setGeometryLoading] = useState(false);
  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Force map resize after mount so tiles fill the container
  useEffect(() => {
    if (!mapRef.current) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mapRef.current?.invalidateSize();
      });
    });

    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 150);

    return () => clearTimeout(timer);
  }, [isClient, origin, destination]);

  // Fetch real road geometry whenever origin/destination coords change
  useEffect(() => {
    if (!origin || !destination || !user) {
      setRouteGeometry(null);
      return;
    }

    // Cancel any in-flight request for a previous corridor
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setGeometryLoading(true);
    setRouteGeometry(null);

    const load = async () => {
      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams({
          originLat: String(origin.lat),
          originLng: String(origin.lng),
          destLat:   String(destination.lat),
          destLng:   String(destination.lng),
        });
        const res = await fetch(`/api/geoapify/route?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok || controller.signal.aborted) return;
        const data = await res.json() as { geometry?: [number, number][] };
        if (!controller.signal.aborted) {
          setRouteGeometry(
            Array.isArray(data.geometry) && data.geometry.length >= 2
              ? data.geometry
              : null   // null → fall back to straight line in render
          );
        }
      } catch (err) {
        if ((err as { name?: string }).name !== 'AbortError') {
          // Silently fall back to straight line
          setRouteGeometry(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setGeometryLoading(false);
        }
      }
    };

    load();

    return () => {
      controller.abort();
    };
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, user]);

  // Fix missing marker icons natively in Leaflet
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = typeof window !== 'undefined' ? (require('leaflet') as typeof import('leaflet')) : null;
  const DefaultIcon: import('leaflet').Icon | undefined = L
    ? L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      })
    : undefined;

  if (!isClient) {
    return <div className="h-full w-full bg-muted/20 animate-pulse" />;
  }

  if (!origin || !destination) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted/20">
        <p className="text-xs text-muted-foreground">Select origin and destination to view corridor</p>
      </div>
    );
  }

  // Straight-line fallback used during loading or if Geoapify returns nothing
  const straightLine: [number, number][] = [
    [origin.lat, origin.lng],
    [destination.lat, destination.lng],
  ];

  // Points used for both the Polyline and FitBounds
  const polylinePoints: [number, number][] = routeGeometry ?? straightLine;

  // Fallback map center — midpoint; FitBounds will override immediately
  const mapCenter: [number, number] = [
    (origin.lat + destination.lat) / 2,
    (origin.lng + destination.lng) / 2,
  ];

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer
        ref={mapRef}
        center={mapCenter}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* Auto-fit map to show the full route */}
        <FitBounds points={polylinePoints} />

        {/* Route line — real road path when available, straight line as fallback */}
        <Polyline
          positions={polylinePoints}
          color={routeGeometry ? '#10b981' : '#64748b'}
          weight={routeGeometry ? 3 : 2}
          opacity={routeGeometry ? 0.85 : 0.5}
          dashArray={routeGeometry ? undefined : '6, 8'}
        />

        {/* Origin marker */}
        <Marker position={[origin.lat, origin.lng]} icon={DefaultIcon}>
          <Popup>
            <div className="text-xs font-semibold">
              <p>Origin: {origin.name}</p>
            </div>
          </Popup>
        </Marker>

        {/* Destination marker */}
        <Marker position={[destination.lat, destination.lng]} icon={DefaultIcon}>
          <Popup>
            <div className="text-xs font-semibold">
              <p>Destination: {destination.name}</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Subtle loading indicator while road geometry is being fetched */}
      {geometryLoading && (
        <div className="absolute top-2 right-2 z-[1000] bg-background/80 backdrop-blur-sm border border-border rounded px-2 py-1 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 border border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] text-muted-foreground">Loading route…</span>
        </div>
      )}
    </div>
  );
}
