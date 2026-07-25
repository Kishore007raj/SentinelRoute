import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DateRangePreset } from "@/lib/analytics/analytics-utils";

export interface AnalyticsFilters {
  start?: string;
  end?: string;
  preset?: DateRangePreset;
  status?: string;
  driverId?: string;
  vehicleId?: string;
  companyId?: string; // Super admin only
}

export function useAnalyticsFilters(defaultPreset: DateRangePreset = "monthly") {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize state from URL params or defaults
  const [filters, setFilters] = useState<AnalyticsFilters>(() => {
    return {
      start: searchParams.get("start") || undefined,
      end: searchParams.get("end") || undefined,
      preset: (searchParams.get("preset") as DateRangePreset) || defaultPreset,
      status: searchParams.get("status") || undefined,
      driverId: searchParams.get("driverId") || undefined,
      vehicleId: searchParams.get("vehicleId") || undefined,
      companyId: searchParams.get("companyId") || undefined,
    };
  });

  // Sync state back to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    const newQuery = params.toString();
    const currentQuery = searchParams.toString();
    
    if (newQuery !== currentQuery) {
      router.replace(`?${newQuery}`, { scroll: false });
    }
  }, [filters, router, searchParams]);

  const updateFilter = useCallback((key: keyof AnalyticsFilters, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ preset: defaultPreset });
  }, [defaultPreset]);

  // Generate query string for API requests
  const apiQueryString = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  return {
    filters,
    updateFilter,
    clearFilters,
    apiQueryString
  };
}
