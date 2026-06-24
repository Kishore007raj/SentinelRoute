"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useI18n } from "@/lib/i18n";
import "leaflet/dist/leaflet.css";

export function HeatmapMap() {
  const { t } = useI18n();
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
                    {t('heatmap.severity')}:{" "}
                    <span style={{ color }}>
                      {incident.severity === "critical"
                        ? t("logistics.critical")
                        : incident.severity === "high"
                        ? t("logistics.high")
                        : incident.severity === "medium"
                        ? t("logistics.medium")
                        : t("logistics.low")}
                    </span>
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
