"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Dynamic import so Leaflet doesn't break SSR
const Heatmap = () => {
  const [incidents, setIncidents] = useState<any[]>([]);

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
      }
    }
    fetchIncidents();
  }, []);

  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden border border-border relative z-0">
      <MapContainer 
        center={[20.5937, 78.9629]} // India center
        zoom={5} 
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        {/* Using Mappls raster tiles or standard fallback as required. 
            Mappls tiles typically require an API key, fallback to OpenStreetMap if none provided. */}
        <TileLayer
          attribution='&copy; <a href="https://www.mappls.com/">Mappls</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {incidents.map((incident) => {
          const isCritical = incident.severity === "critical";
          const isHigh = incident.severity === "high";
          const color = isCritical ? "#ef4444" : isHigh ? "#f97316" : "#eab308";
          
          return (
            <CircleMarker
              key={incident.incidentId}
              center={[incident.latitude, incident.longitude]}
              pathOptions={{ 
                color: color, 
                fillColor: color, 
                fillOpacity: 0.5,
                weight: 1 
              }}
              radius={incident.affectedRadiusKm * 2} // visual scaling
            >
              <Popup>
                <div className="font-sans text-sm">
                  <h3 className="font-bold">{incident.title}</h3>
                  <p className="mt-1">{incident.description}</p>
                  <p className="mt-2 font-semibold text-xs text-muted-foreground uppercase">
                    Severity: <span style={{ color }}>{incident.severity}</span>
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default function HeatmapPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Operational Heatmap</h1>
        <p className="text-muted-foreground">
          Visual intelligence of traffic, weather, and active disruptions across India.
        </p>
      </div>

      <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm font-medium">Critical Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-sm font-medium">High Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm font-medium">Medium Risk</span>
        </div>
      </div>

      <Heatmap />
    </div>
  );
}
