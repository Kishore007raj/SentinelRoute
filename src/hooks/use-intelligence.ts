import { useState, useCallback, useRef, useEffect } from "react";
import { fetchApi } from "@/lib/api-client";
import { useUser } from "@/lib/auth-context";

export interface LiveKPIs {
  avgOperationalRisk:       number;
  activeAlerts:             number;
  openIncidents:            number;
  highRiskShipments:        number;
  avgDelayProbability:      number;
  avgDisruptionProbability: number;
  avgEtaConfidence:         number;
  basedOnPredictions:       number;
  computedAt:               string;
}

export interface LiveAlert {
  alertId:           string;
  shipmentId:        string;
  reason:            string;
  recommendedAction: string;
  confidence?:       number;
  severity:          string;
  timestamp:         string;
  status?:           string;
}

export interface LiveIncident {
  incidentId:       string;
  title:            string;
  description:      string;
  category:         string;
  severity:         "low" | "medium" | "high" | "critical";
  latitude:         number;
  longitude:        number;
  startTime:        string;
  lastUpdated:      string;
  source:           string;
  impactScore:      number;
  recommendedAction?: string;
}

export interface IntelligenceOptions {
  pollingIntervalMs?: number;
  fetchKpis?: boolean;
  fetchAlerts?: boolean;
  fetchIncidents?: boolean;
}

export function useIntelligence(options: IntelligenceOptions = {}) {
  const {
    pollingIntervalMs = 60000,
    fetchKpis: shouldFetchKpis = true,
    fetchAlerts: shouldFetchAlerts = false,
    fetchIncidents: shouldFetchIncidents = false,
  } = options;

  const { user } = useUser();
  const [kpis, setKpis] = useState<LiveKPIs | null>(null);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [incidents, setIncidents] = useState<LiveIncident[]>([]);
  
  const [loadingKpis, setLoadingKpis] = useState(shouldFetchKpis);
  const [loadingAlerts, setLoadingAlerts] = useState(shouldFetchAlerts);
  const [loadingIncidents, setLoadingIncidents] = useState(shouldFetchIncidents);
  
  const [prevRisk, setPrevRisk] = useState<number | null>(null);

  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const promises: Promise<void>[] = [];

      if (shouldFetchKpis) {
        promises.push(
          fetchApi("/api/intelligence/kpis")
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (mounted.current && data) {
                setKpis(prev => {
                  if (prev !== null) setPrevRisk(prev.avgOperationalRisk);
                  return data;
                });
              }
              if (mounted.current) setLoadingKpis(false);
            })
            .catch(() => {
              if (mounted.current) setLoadingKpis(false);
            })
        );
      }

      if (shouldFetchAlerts) {
        promises.push(
          fetchApi("/api/intelligence/alerts")
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (mounted.current && data) {
                setAlerts(data.alerts ?? []);
              }
              if (mounted.current) setLoadingAlerts(false);
            })
            .catch(() => {
              if (mounted.current) setLoadingAlerts(false);
            })
        );
      }

      if (shouldFetchIncidents) {
        promises.push(
          fetchApi("/api/intelligence/incidents")
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (mounted.current && data) {
                setIncidents(data.incidents ?? []);
              }
              if (mounted.current) setLoadingIncidents(false);
            })
            .catch(() => {
              if (mounted.current) setLoadingIncidents(false);
            })
        );
      }

      await Promise.all(promises);
    } catch {
      // silent — never block the UI
    }
  }, [user, shouldFetchKpis, shouldFetchAlerts, shouldFetchIncidents]);

  useEffect(() => {
    mounted.current = true;
    void load();
    let id: NodeJS.Timeout | undefined;
    if (pollingIntervalMs > 0) {
      id = setInterval(() => { void load(); }, pollingIntervalMs);
    }
    return () => { 
      mounted.current = false; 
      if (id) clearInterval(id);
    };
  }, [load, pollingIntervalMs]);

  return { 
    kpis, 
    alerts, 
    incidents, 
    loadingKpis, 
    loadingAlerts, 
    loadingIncidents,
    loading: loadingKpis || loadingAlerts || loadingIncidents,
    prevRisk,
    refresh: load,
    setAlerts // Useful for risk-center to immediately optimistic-update alert status
  };
}
