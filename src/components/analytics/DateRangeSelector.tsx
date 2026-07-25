"use client";

import { Button } from "@/components/ui/button";
import { DateRangePreset } from "@/lib/analytics/analytics-utils";

interface DateRangeSelectorProps {
  preset?: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
}

export function DateRangeSelector({ preset = "monthly", onPresetChange }: DateRangeSelectorProps) {
  const presets: { label: string; value: DateRangePreset }[] = [
    { label: "Today", value: "today" },
    { label: "7 Days", value: "weekly" },
    { label: "30 Days", value: "monthly" },
    { label: "Quarter", value: "quarterly" },
    { label: "Year", value: "yearly" },
    { label: "All Time", value: "all" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-1 rounded-lg w-fit">
      {presets.map((p) => (
        <Button
          key={p.value}
          variant={preset === p.value ? "default" : "ghost"}
          size="sm"
          className={`h-8 text-xs ${preset === p.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => onPresetChange(p.value)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
