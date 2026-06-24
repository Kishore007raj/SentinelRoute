"use client";

import dynamic from "next/dynamic";
import { useI18n } from "@/lib/i18n";

const Heatmap = dynamic(() => import("./HeatmapMap").then(mod => mod.HeatmapMap), { ssr: false });

export default function HeatmapPage() {
  const { t } = useI18n();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('intelligence.operationalHeatmap')}</h1>
        <p className="text-muted-foreground">
          {t('intelligence.operationalHeatmapSubtitle')}
        </p>
      </div>

      <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm font-medium">{t('intelligence.criticalRisk')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-sm font-medium">{t('intelligence.highRisk')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm font-medium">{t('intelligence.mediumRisk')}</span>
        </div>
      </div>

      <Heatmap />
    </div>
  );
}
