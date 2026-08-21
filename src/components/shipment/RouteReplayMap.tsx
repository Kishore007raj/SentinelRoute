"use client";
import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import { Play, Pause, FastForward, Rewind, Clock } from "lucide-react";
import "leaflet/dist/leaflet.css";

import { ShipmentExecution, DriverLocation } from "@/lib/types";

export function RouteReplayMap({ execution }: { execution: ShipmentExecution }) {
  const [isClient, setIsClient] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const mapRef = useRef<LeafletMap | null>(null);

  const locations = execution.historicalLocations || [];

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

  useEffect(() => {
    if (!isPlaying || locations.length === 0) return;
    const interval = setInterval(() => {
      setCurrentTimeIndex(prev => {
        if (prev >= locations.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / speedMultiplier);
    return () => clearInterval(interval);
  }, [isPlaying, locations.length, speedMultiplier]);

  if (!isClient) return <div className="h-[400px] bg-muted/20 animate-pulse rounded-xl" />;
  if (locations.length === 0) return <div className="p-8 text-center text-muted-foreground border rounded-xl">No historical location data available for route replay.</div>;

  const currentLocation = locations[currentTimeIndex];
  const center: [number, number] = [currentLocation.latitude, currentLocation.longitude];
  const pastPath = locations.slice(0, currentTimeIndex + 1).map(l => [l.latitude, l.longitude] as [number, number]);

  return (
    <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-card space-y-0">
      <div className="h-[400px] w-full relative z-0">
        <MapContainer ref={mapRef} center={center} zoom={8} style={{ height: "100%", width: "100%" }} className="z-0">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <Polyline positions={locations.map(l => [l.latitude, l.longitude])} color="#64748b" weight={3} opacity={0.3} dashArray="5, 10" />
          {pastPath.length > 0 && (
            <Polyline positions={pastPath} color="#ef4444" weight={4} opacity={0.9} />
          )}
          {currentLocation && (
            <Marker position={[currentLocation.latitude, currentLocation.longitude]} icon={DefaultIcon}>
              <Popup>
                <div className="text-xs">
                  <strong>Replay Time:</strong><br/>
                  {new Date(currentLocation.timestamp).toLocaleString()}<br/>
                  <strong>Speed:</strong> {currentLocation.speed || 0} km/h
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <div className="p-4 border-t border-border flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => { setIsPlaying(false); setCurrentTimeIndex(0); }}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Rewind className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSpeedMultiplier(prev => (prev >= 4 ? 1 : prev * 2))}
              className="p-2 text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <FastForward className="w-4 h-4" />
              <span className="text-xs font-mono">{speedMultiplier}x</span>
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="font-mono">{new Date(currentLocation.timestamp).toLocaleString()}</span>
          </div>
        </div>
        
        <input
          type="range"
          min={0}
          max={locations.length - 1}
          value={currentTimeIndex}
          onChange={(e) => {
            setCurrentTimeIndex(parseInt(e.target.value));
            setIsPlaying(false);
          }}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
          <span>{new Date(locations[0].timestamp).toLocaleTimeString()}</span>
          <span>{new Date(locations[locations.length - 1].timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
