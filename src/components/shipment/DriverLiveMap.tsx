"use client";
import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

import { ShipmentExecution, DriverLocation, Route } from "@/lib/types";

export function DriverLiveMap({ execution }: { execution: ShipmentExecution }) {
  const [isClient, setIsClient] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

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

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return <div className="h-[300px] bg-muted/20 animate-pulse rounded-xl" />;

  const location = execution.lastKnownLocation;
  // geometry is stored as [lng, lat] pairs; Leaflet needs [lat, lng]
  const routeGeometry = execution.currentRoute?.geometry;
  const center: [number, number] = location
    ? [location.latitude, location.longitude]
    : routeGeometry && routeGeometry.length > 0
      ? [routeGeometry[0][1], routeGeometry[0][0]]
      : [0, 0];

  const routePolyline: [number, number][] = routeGeometry?.map((p: [number, number]) => [p[1], p[0]]) ?? [];


  return (
    <div className="h-[300px] w-full rounded-xl overflow-hidden border mt-4">
      <MapContainer 
        center={center} 
        zoom={location ? 14 : 2} 
        className="h-full w-full"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {routePolyline.length > 0 && (
          <Polyline positions={routePolyline} color="blue" weight={4} opacity={0.7} />
        )}
        
        {location && DefaultIcon && (
          <Marker position={[location.latitude, location.longitude]} icon={DefaultIcon}>
            <Popup>Current Location</Popup>
          </Marker>
        )}
        
        {execution.checkpoints.map((cp, idx) => (
          DefaultIcon && (
            <Marker key={cp.id} position={[cp.latitude, cp.longitude]} icon={DefaultIcon}>
              <Popup>
                <strong>{cp.name}</strong><br />
                Status: {cp.status}
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
}
