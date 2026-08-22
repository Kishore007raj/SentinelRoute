import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { fetchApi } from "@/lib/api-client";
import { useUser } from "@/lib/auth-context";
import { useSocket } from "@/hooks/use-socket";

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
  commandStatus?:   "open" | "resolved" | "in_progress";
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
  
  const [kpisAvailable, setKpisAvailable] = useState(true);
  const [alertsAvailable, setAlertsAvailable] = useState(true);
  const [incidentsAvailable, setIncidentsAvailable] = useState(true);
  
  const [prevRisk, setPrevRisk] = useState<number | null>(null);

  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const promises: Promise<void>[] = [];

      if (shouldFetchKpis) {
        promises.push(
          fetchApi("/api/intelligence/kpis")
            .then(r => {
              // On 404/403, mark as unavailable but don't error
              if (r.status === 404 || r.status === 403) {
                if (mounted.current) {
                  setKpisAvailable(false);
                  setLoadingKpis(false);
                }
                return null;
              }
              return r.ok ? r.json() : null;
            })
            .then(data => {
              if (mounted.current && data) {
                setKpisAvailable(true);
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
            .then(r => {
              if (r.status === 404 || r.status === 403) {
                if (mounted.current) {
                  setAlertsAvailable(false);
                  setLoadingAlerts(false);
                }
                return null;
              }
              return r.ok ? r.json() : null;
            })
            .then(data => {
              if (mounted.current && data) {
                setAlertsAvailable(true);
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
            .then(r => {
              if (r.status === 404 || r.status === 403) {
                if (mounted.current) {
                  setIncidentsAvailable(false);
                  setLoadingIncidents(false);
                }
                return null;
              }
              return r.ok ? r.json() : null;
            })
            .then(data => {
              if (mounted.current && data) {
                setIncidentsAvailable(true);
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
      // silent - never block the UI
    }
  }, [user, shouldFetchKpis, shouldFetchAlerts, shouldFetchIncidents]);

  const socketHandlers = useMemo(() => ({
    // KPI update: re-fetch for accurate aggregated numbers
    "kpi:updated": () => { if (shouldFetchKpis) void load(); },
    // New alert: prepend to list from payload (no full reload)
    "alert:new": (data: unknown) => {
      if (shouldFetchAlerts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = (data as any)?.alert ?? (data as LiveAlert);
        if (a?.alertId) setAlerts(prev => [a, ...prev.filter(x => x.alertId !== a.alertId)]);
      }
    },
    "alert:created": (data: unknown) => {
      if (shouldFetchAlerts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = (data as any)?.alert ?? (data as LiveAlert);
        if (a?.alertId) setAlerts(prev => [a, ...prev.filter(x => x.alertId !== a.alertId)]);
      }
    },
    // Alert status change: update in list
    "alert:updated": (data: unknown) => {
      if (shouldFetchAlerts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = (data as any)?.alert ?? (data as LiveAlert);
        if (a?.alertId) setAlerts(prev => prev.map(x => x.alertId === a.alertId ? { ...x, ...a } : x));
      }
    },
    // New incident: prepend from payload
    "incident:reported": (data: unknown) => {
      if (shouldFetchIncidents) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inc = (data as any)?.incident ?? (data as LiveIncident);
        if (inc?.incidentId) setIncidents(prev => [inc, ...prev.filter(x => x.incidentId !== inc.incidentId)]);
      }
    },
    "incident:created": (data: unknown) => {
      if (shouldFetchIncidents) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inc = (data as any)?.incident ?? (data as LiveIncident);
        if (inc?.incidentId) setIncidents(prev => [inc, ...prev.filter(x => x.incidentId !== inc.incidentId)]);
      }
    },
    // Incident updated (status change, reassignment)
    "incident:updated": (data: unknown) => {
      if (shouldFetchIncidents) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inc = (data as any)?.incident ?? (data as LiveIncident);
        if (inc?.incidentId) setIncidents(prev => prev.map(x => x.incidentId === inc.incidentId ? { ...x, ...inc } as LiveIncident : x));
      }
    },
    // Escalation: severity/status bump in list
    "incident:escalated": (data: unknown) => {
      if (shouldFetchIncidents) {
        const { incidentId, severity, escalationLevel } = data as { incidentId?: string; severity?: string; escalationLevel?: number };
        if (incidentId) setIncidents(prev => prev.map(x => x.incidentId === incidentId ? { ...x, severity: (severity ?? x.severity) as LiveIncident["severity"] } : x));
      }
    },
    // Resolved: remove from active list
    "incident:resolved": (data: unknown) => {
      if (shouldFetchIncidents) {
        const { incidentId } = data as { incidentId?: string };
        if (incidentId) setIncidents(prev => prev.filter(x => x.incidentId !== incidentId));
      }
    },
  }), [load, shouldFetchKpis, shouldFetchAlerts, shouldFetchIncidents, setAlerts, setIncidents]);

  useSocket({ on: socketHandlers });

  useEffect(() => {
    mounted.current = true;
    void load();
    let id: NodeJS.Timeout | undefined;
    if (pollingIntervalMs > 0 && process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET !== "true") {
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
    kpisAvailable,
    alertsAvailable,
    incidentsAvailable,
    prevRisk,
    refresh: load,
    setAlerts // Useful for risk-center to immediately optimistic-update alert status
  };
}
