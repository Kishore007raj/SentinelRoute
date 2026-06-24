"use client";

import dynamic from "next/dynamic";
const Heatmap = dynamic(() => import("./HeatmapMap").then(mod => mod.HeatmapMap), { ssr: false });

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
