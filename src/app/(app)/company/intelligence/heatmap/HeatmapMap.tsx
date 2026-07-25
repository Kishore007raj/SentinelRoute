"use client";

import { fetchApi } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useI18n } from "@/lib/i18n";
import { ShieldAlert, Package, Clock, CloudRain, Car, AlertTriangle, Newspaper, AlertCircle } from "lucide-react";
import "leaflet/dist/leaflet.css";

interface HeatPoint {
  id: string;
  lat: number;
  lng: number;
  intensity: number;
  shipmentCount: number;
  averageDelay: number;
  corridor?: string;
  dominantRisk: string;
  breakdown: {
    weather: number;
    traffic: number;
    festival: number;
    news: number;
    incidents: number;
  };
}

export function HeatmapMap() {
  const { t } = useI18n();
  const [heatPoints, setHeatPoints] = useState<HeatPoint[]>([]);

  useEffect(() => {
    async function fetchHeatmap() {
      try {
        const res = await fetchApi("/api/intelligence/heatmap");
        if (res.ok) {
          const data = await res.json();
          setHeatPoints(data.heatPoints || []);
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchHeatmap();
  }, []);

  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden border border-border relative z-0">
      <MapContainer 
        center={[20.5937, 78.9629]} // India center
        zoom={5} 
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        {/* CartoDB dark tiles — consistent with RouteMapView */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {heatPoints.map((point) => {
          const isCritical = point.intensity > 75;
          const isHigh = point.intensity > 40;
          const color = isCritical ? "#ef4444" : isHigh ? "#f97316" : "#3b82f6";
          
          return (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lng]}
              pathOptions={{ 
                color: color, 
                fillColor: color, 
                fillOpacity: 0.6,
                weight: 1 
              }}
              radius={Math.max(8, (point.intensity / 100) * 20 + (point.shipmentCount * 2))} // visual scaling based on intensity and density
            >
              <Popup className="min-w-[280px]">
                <div className="font-sans text-sm p-1">
                  <h3 className="font-bold text-base border-b pb-2 mb-2 flex items-center justify-between">
                    <span>{point.corridor || "Unknown Route"}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted">
                      Risk: {point.intensity}
                    </span>
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Package className="w-4 h-4 text-blue-500" />
                      <span className="font-semibold text-foreground">{point.shipmentCount}</span>
                      <span className="text-xs">Shipments</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="font-semibold text-foreground">{point.averageDelay > 0 ? `+${point.averageDelay}m` : "On Time"}</span>
                      <span className="text-xs">Avg Delay</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                      <span className="font-semibold text-foreground">{point.dominantRisk}</span>
                      <span className="text-xs">Dominant Risk</span>
                    </div>
                  </div>

                  <div className="bg-muted/30 p-2 rounded-md border border-border">
                    <p className="text-xs font-bold uppercase mb-2 text-muted-foreground tracking-wider">Severity Breakdown</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1"><CloudRain className="w-3 h-3 text-blue-400" /> Weather</span>
                        <span className="font-semibold">{point.breakdown.weather}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1"><Car className="w-3 h-3 text-orange-400" /> Traffic</span>
                        <span className="font-semibold">{point.breakdown.traffic}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-purple-400" /> Festival</span>
                        <span className="font-semibold">{point.breakdown.festival}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1"><Newspaper className="w-3 h-3 text-gray-400" /> News</span>
                        <span className="font-semibold">{point.breakdown.news}</span>
                      </div>
                      <div className="flex items-center justify-between col-span-2 border-t pt-1 mt-1">
                        <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-red-400" /> Incidents Detected</span>
                        <span className="font-semibold text-red-500">{point.breakdown.incidents}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
