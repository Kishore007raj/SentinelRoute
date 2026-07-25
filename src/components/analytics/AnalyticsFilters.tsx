"use client";

import { useAnalyticsFilters } from "@/hooks/use-analytics-filters";
import { DateRangeSelector } from "./DateRangeSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnalyticsFiltersProps {
  showStatusFilter?: boolean;
  statusOptions?: { label: string; value: string }[];
  showEntityFilter?: boolean;
  entityOptions?: { label: string; value: string }[];
  entityLabel?: string;
  entityKey?: "driverId" | "vehicleId";
}

export function AnalyticsFilters({
  showStatusFilter = false,
  statusOptions = [],
  showEntityFilter = false,
  entityOptions = [],
  entityLabel = "Entity",
  entityKey = "driverId"
}: AnalyticsFiltersProps) {
  const { filters, updateFilter, clearFilters } = useAnalyticsFilters();

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== "monthly").length;

  return (
    <div className="flex flex-col gap-4 p-4 bg-card border border-border rounded-xl mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="w-4 h-4" />
          Analytics Filters
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <DateRangeSelector 
          preset={filters.preset} 
          onPresetChange={(p) => updateFilter("preset", p)} 
        />

        {showStatusFilter && statusOptions.length > 0 && (
          <div className="min-w-[150px]">
            <Select 
              value={filters.status || "all"} 
              onValueChange={(v) => updateFilter("status", v === "all" ? undefined : v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showEntityFilter && entityOptions.length > 0 && entityKey && (
          <div className="min-w-[200px]">
            <Select 
              value={filters[entityKey] || "all"} 
              onValueChange={(v) => updateFilter(entityKey, v === "all" ? undefined : v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={`All ${entityLabel}s`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {entityLabel}s</SelectItem>
                {entityOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
