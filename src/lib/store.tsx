"use client";
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { signOut } from "firebase/auth";
import type { Shipment, ShipmentStatus, RiskLevel, Route, PendingShipment, OperationalRecommendation } from "./types";
import { getRiskLabel } from "./utils";
import { useUser } from "./auth-context";
import { auth } from "./firebase";
import { useSocket } from "@/hooks/use-socket";
import { utcNow } from "./time";
import { useCompany } from "./company-context";

export type { PendingShipment } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PresenceUser {
  userId:    string;
  status:    "online" | "offline";
  role?:     string;
  entityId?: string;
}

/**
 * Operational feed data from /api/operational/feed.
 * Typed loosely to accommodate the Module 7 feed shape without duplicating the
 * full server schema here. All access should be narrowed at the call site.
 */
export interface OperationalFeedData {
  recommendations?: OperationalRecommendation[];
  events?:          { type: string; description?: string; timestamp: string }[];
  alerts?:          unknown[];
  incidents?:       unknown[];
  health?:          unknown;
  [key: string]:    unknown;
}

/**
 * Operational health snapshot from /api/operational/health.
 */
export interface OperationalHealthData {
  score?:               number;
  status?:              string;
  activeShipments?:     number;
  averageRisk?:         number;
  driverAvailability?:  number;
  vehicleAvailability?: number;
  incidentDensity?:     number;
  routeConfidence?:     number;
  delayedShipments?:    number;
  complianceScore?:     number;
  calculatedAt?:        string;
  [key: string]:        unknown;
}

/**
 * Live KPI snapshot stored from the kpi:updated socket event or /api/analytics/kpis.
 */
export interface StoredKPIData {
  shipments?: {
    total:               number;
    active:              number;
    completed:           number;
    cancelled:           number;
    atRisk:              number;
    delayed:             number;
    successRate:         number;
    deliveryPerformance: number;
  };
  fleet?: {
    total:            number;
    available:        number;
    assigned:         number;
    maintenance:      number;
    availabilityRate: number;
    utilizationRate:  number;
  };
  drivers?: {
    total:          number;
    active:         number;
    available:      number;
    assigned:       number;
    offDuty:        number;
    suspended:      number;
    utilizationRate: number;
  };
  incidents?: {
    total:    number;
    critical: number;
    high:     number;
    medium:   number;
    low:      number;
  };
  healthScore?: number;
  [key: string]: unknown;
}

// ─── API resilience helpers ───────────────────────────────────────────────────

const API_TIMEOUT_MS = 15_000;

/**
 * fetch with:
 *  - hard 9s timeout per attempt
 *  - single retry on network errors and 5xx responses
 *  - NO retry on 4xx (except 401 which is handled separately)
 *
 * Each attempt gets its OWN AbortController so the timeout from
 * attempt 1 never fires during attempt 2.
 *
 * An optional `cancelSignal` can be passed to abort both the in-flight
 * request and the timeout immediately (e.g. on effect cleanup).
 */
async function fetchWithResilience(
  url: string,
  options: RequestInit,
  cancelSignal?: AbortSignal
): Promise<Response> {
  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();

    // Forward cancellation from the caller into this attempt's controller
    const onCancel = () => controller.abort();
    cancelSignal?.addEventListener("abort", onCancel);

    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      // Strip any existing signal from options - we own the abort controller
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { signal: _ignored, ...rest } = options as RequestInit & { signal?: unknown };
      const res = await fetch(url, { ...rest, signal: controller.signal });
      clearTimeout(timer);
      cancelSignal?.removeEventListener("abort", onCancel);
      return res;
    } catch (err) {
      clearTimeout(timer);
      cancelSignal?.removeEventListener("abort", onCancel);
      throw err;
    }
  };

  let res: Response;
  try {
    res = await attempt();
  } catch (err) {
    // Don't retry if the caller explicitly cancelled
    if (cancelSignal?.aborted) throw err;
    // First attempt failed (network/timeout) - wait then retry once
    await new Promise((r) => setTimeout(r, 800));
    return attempt();
  }

  // Retry once on 5xx
  if (res.status >= 500) {
    if (cancelSignal?.aborted) return res;
    await new Promise((r) => setTimeout(r, 800));
    try {
      return await attempt();
    } catch {
      return res; // return original 5xx if retry also fails
    }
  }

  return res;
}

/**
 * Wraps fetchWithResilience with 401 token-refresh-and-retry logic.
 * On 401: force-refresh the token, retry once.
 * If still 401 after retry: sign out the user.
 */
async function fetchWithAuth(
  url: string,
  options: RequestInit,
  getToken: () => Promise<string>,
  forceRefreshToken: () => Promise<string | null>,
  onAuthFailure: () => void,
  cancelSignal?: AbortSignal
): Promise<Response> {
  const token = await getToken();
  const headers = {
    ...(options.headers as Record<string, string> ?? {}),
    Authorization: `Bearer ${token}`,
  };

  const res = await fetchWithResilience(url, { ...options, headers }, cancelSignal);

  if (res.status === 401) {
    // Token may have expired - force refresh once and retry
    const freshToken = await forceRefreshToken();
    if (!freshToken) {
      onAuthFailure();
      return res;
    }
    const retryHeaders = { ...(options.headers as Record<string, string> ?? {}), Authorization: `Bearer ${freshToken}` };
    const retryRes = await fetchWithResilience(url, { ...options, headers: retryHeaders }, cancelSignal);
    if (retryRes.status === 401) {
      // Still unauthorized after refresh - session is broken
      onAuthFailure();
    }
    return retryRes;
  }

  return res;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface StoreState {
  shipments:                  Shipment[];
  pendingShipment:            PendingShipment | null;
  /** True once the localStorage restore attempt has completed (success or no-op).
   *  Consumers MUST NOT distinguish "no pending shipment" from "not yet restored"
   *  until this flag is true. */
  pendingShipmentHydrated:    boolean;
  loading:                    boolean;
  operationalFeed:            OperationalFeedData | null;
  operationalHealth:          OperationalHealthData | null;
  presence:                   Record<string, PresenceUser>;
  kpis:                       StoredKPIData | null;
  lastSync:                   number;
  shipmentStats: {
    total: number;
    active: number;
    atRisk: number;
    completed: number;
    avgRisk: number;
    highRiskAvoided: number;
  } | null;
}

type Action =
  | { type: "SET_SHIPMENTS";  payload: { shipments: Shipment[], stats?: StoreState["shipmentStats"] } }
  | { type: "SET_LOADING";    payload: boolean }
  | { type: "SET_PENDING";    payload: PendingShipment }
  | { type: "CLEAR_PENDING" }
  | { type: "SET_PENDING_HYDRATED" }
  | { type: "ADD_SHIPMENT";   payload: Shipment }
  | { type: "UPDATE_STATUS";  payload: { id: string; status: ShipmentStatus; lastUpdate: string } }
  | { type: "SET_OPERATIONAL_DATA"; payload: { feed: OperationalFeedData | null; health: OperationalHealthData | null } }
  | { type: "PRESENCE_UPDATE"; payload: PresenceUser }
  | { type: "PRESENCE_SYNC"; payload: Record<string, PresenceUser> }
  | { type: "KPI_UPDATE"; payload: StoredKPIData };

const initialState: StoreState = {
  shipments:                [],
  pendingShipment:          null,
  pendingShipmentHydrated:  false,
  loading:                  true,
  operationalFeed:          null,
  operationalHealth:        null,
  presence:                 {},
  kpis:                     null,
  lastSync:                 Date.now(),
  shipmentStats:            null,
};

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "SET_SHIPMENTS": {
      // Deduplicate by id - guards against duplicate records from DB or concurrent fetches
      const seen = new Set<string>();
      const unique = (action.payload.shipments ?? []).filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
      return { ...state, shipments: unique, shipmentStats: action.payload.stats ?? null, loading: false };
    }
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_PENDING":
      return { ...state, pendingShipment: action.payload };
    case "CLEAR_PENDING":
      return { ...state, pendingShipment: null };
    case "SET_PENDING_HYDRATED":
      return { ...state, pendingShipmentHydrated: true };
    case "ADD_SHIPMENT":
      // Deduplicate - if the shipment already exists (e.g. from a concurrent fetch),
      // replace it rather than prepend a second copy.
      if (state.shipments.some((s) => s.id === action.payload.id)) {
        return {
          ...state,
          shipments: state.shipments.map((s) =>
            s.id === action.payload.id ? action.payload : s
          ),
        };
      }
      return { ...state, shipments: [action.payload, ...state.shipments] };
    case "UPDATE_STATUS":
      return {
        ...state,
        shipments: state.shipments.map((s) =>
          s.id === action.payload.id
            ? { ...s, status: action.payload.status, lastUpdate: action.payload.lastUpdate }
            : s
        ),
      };
    case "SET_OPERATIONAL_DATA":
      return { ...state, operationalFeed: action.payload.feed, operationalHealth: action.payload.health, lastSync: Date.now() };
    case "PRESENCE_UPDATE": {
      const existing = state.presence[action.payload.userId] || {};
      return {
        ...state,
        presence: {
          ...state.presence,
          [action.payload.userId]: { ...existing, ...action.payload },
        },
      };
    }
    case "PRESENCE_SYNC":
      return { ...state, presence: action.payload };
    case "KPI_UPDATE":
      return { ...state, kpis: action.payload, lastSync: Date.now() };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface StoreContextValue {
  state:                    StoreState;
  pendingShipmentHydrated:  boolean;
  setPendingShipment:       (data: PendingShipment) => void;
  clearPendingShipment:     () => void;
  dispatchShipment:         (opts: { pending: PendingShipment; route: Route; confidencePercent: number }) => Promise<Shipment>;
  completeShipment:         (id: string) => void;
  refreshShipments:         () => Promise<void>;
  activeShipments:          Shipment[];
  completedShipments:       Shipment[];
  atRiskShipments:          Shipment[];
  operationalFeed:          OperationalFeedData | null;
  operationalHealth:        OperationalHealthData | null;
  presence:                 Record<string, PresenceUser>;
  kpis:                     StoredKPIData | null;
  shipmentStats:            StoreState["shipmentStats"];
}

const StoreContext = createContext<StoreContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { user, refreshToken } = useUser();
  const { company, userRecord } = useCompany();

  // NOTE: Do NOT clear pendingShipment based on pathname changes.
  // The pending shipment is cleared explicitly by:
  //   1. dispatchShipment() on success (sets both state and localStorage)
  //   2. clearPendingShipment() manual call
  // Clearing on pathname changes caused race conditions where navigating from
  // /create-shipment → /routes would clear the shipment before routes/page.tsx could use it.

  // ── Auth failure handler - signs out and clears state ─────────────────────
  const handleAuthFailure = useCallback(() => {
    console.warn("[store] Auth failure after token refresh - signing out");
    dispatch({ type: "SET_SHIPMENTS", payload: { shipments: [] } });
    document.cookie = "sr_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    signOut(auth).catch(() => {});
  }, []);

  // ── Token helpers ──────────────────────────────────────────────────────────
  const getToken = useCallback(async (): Promise<string> => {
    if (!user) return "";
    return user.getIdToken();
  }, [user]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchShipments = useCallback(async (cancelSignal?: AbortSignal) => {
    if (!user) { dispatch({ type: "SET_SHIPMENTS", payload: { shipments: [] } }); return; }
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const res = await fetchWithAuth(
        "/api/shipments",
        { method: "GET" },
        getToken,
        refreshToken,
        handleAuthFailure,
        cancelSignal
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      dispatch({ type: "SET_SHIPMENTS", payload: { shipments: data.shipments ?? [], stats: data.stats } });
    } catch (err) {
      // AbortError has two sources:
      //   1. cancelSignal?.aborted === true  → intentional effect cleanup → stay silent
      //   2. cancelSignal?.aborted === false → internal 9 s timeout fired → unblock loading
      if (err instanceof Error && err.name === "AbortError") {
        if (cancelSignal?.aborted) return; // intentional cleanup — stay silent
        // Timeout fired before server responded — unblock loading state without wiping existing shipments
        dispatch({ type: "SET_LOADING", payload: false });
        return;
      }
      // 503 = Firebase Admin not configured (expected in dev without service account).
      // Still resolve to empty list - never leave the app in a loading state.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("503")) {
        console.error("[store] fetchShipments:", err);
      }
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [user, getToken, refreshToken, handleAuthFailure]);

  const fetchOperationalData = useCallback(async (cancelSignal?: AbortSignal) => {
    if (!user) return;
    try {
      const [feedRes, healthRes] = await Promise.all([
        fetchWithAuth("/api/operational/feed",   { method: "GET" }, getToken, refreshToken, handleAuthFailure, cancelSignal),
        fetchWithAuth("/api/operational/health", { method: "GET" }, getToken, refreshToken, handleAuthFailure, cancelSignal)
      ]);
      // Ignore if cancelled between the two awaits
      if (cancelSignal?.aborted) return;
      const feedJson   = feedRes.ok   ? (await feedRes.json()   as { data?: OperationalFeedData })   : null;
      const healthJson = healthRes.ok ? (await healthRes.json() as { data?: OperationalHealthData }) : null;
      dispatch({ 
        type: "SET_OPERATIONAL_DATA", 
        payload: { feed: feedJson?.data ?? null, health: healthJson?.data ?? null } 
      });
    } catch (err) {
      // Silently ignore intentional cancellations (effect cleanup)
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[store] fetchOperationalData:", err);
    }
  }, [user, getToken, refreshToken, handleAuthFailure]);

  useEffect(() => {
    const controller = new AbortController();
    fetchShipments(controller.signal);
    fetchOperationalData(controller.signal);
    return () => controller.abort();
  }, [fetchShipments, fetchOperationalData]);

  const refreshShipments = useCallback(async () => { await fetchShipments(); }, [fetchShipments]);

  // ── Polling fallback (Vercel / serverless - no WebSocket) ─────────────────
  // When WebSocket is disabled, poll every 30s to keep data reasonably fresh.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === "true") return;
    if (!user) return;
    const interval = setInterval(() => {
      const controller = new AbortController();
      fetchShipments(controller.signal);
      fetchOperationalData(controller.signal);
    }, 30_000);
    return () => clearInterval(interval);
  }, [user, fetchShipments, fetchOperationalData]);

  // Ref to latest operational data - avoids stale closure in socketHandlers
  const latestOperational = useRef({ feed: state.operationalFeed, health: state.operationalHealth });
  useEffect(() => {
    latestOperational.current = { feed: state.operationalFeed, health: state.operationalHealth };
  }, [state.operationalFeed, state.operationalHealth]);

  // ── Real-time socket updates ───────────────────────────────────────────────
  // Handlers are memoised so useSocket doesn't re-subscribe on every render
  const socketHandlers = useMemo(() => ({
    // A new shipment was created (e.g. from another tab or device)
    "shipment:created": (data: unknown) => {
      const { shipment } = data as { shipment: Shipment };
      if (shipment) dispatch({ type: "ADD_SHIPMENT", payload: shipment });
    },
    // Full shipment object updated (from change streams)
    "shipment:updated": (data: unknown) => {
      const { shipment } = data as { shipment: Shipment };
      if (shipment) {
        dispatch({ type: "ADD_SHIPMENT", payload: shipment });
      }
    },

    // Driver availability changed — propagate to feed refresh
    "driver:availability": () => {
      void fetchOperationalData();
    },
    // Module 7 & 8: presence
    "presence:updated": (data: unknown) => {
      dispatch({ type: "PRESENCE_UPDATE", payload: data as PresenceUser });
    },
    "presence:entity:joined": (data: unknown) => {
      dispatch({ type: "PRESENCE_UPDATE", payload: { ...(data as PresenceUser), status: "online" } });
    },
    "presence:entity:left": (data: unknown) => {
      dispatch({ type: "PRESENCE_UPDATE", payload: { ...(data as PresenceUser), entityId: undefined } });
    },
    "presence:sync": (data: unknown) => {
      dispatch({ type: "PRESENCE_SYNC", payload: data as Record<string, PresenceUser> });
    },
    // Module 7: operational feed
    "feed:updated": (data: unknown) => {
      dispatch({ type: "SET_OPERATIONAL_DATA", payload: { feed: data as OperationalFeedData, health: latestOperational.current.health } });
    },
    "health:updated": (data: unknown) => {
      dispatch({ type: "SET_OPERATIONAL_DATA", payload: { feed: latestOperational.current.feed, health: data as OperationalHealthData } });
    },
    // Module 7: KPIs
    "kpi:updated": (data: unknown) => {
      if (data && typeof data === "object") {
        dispatch({ type: "KPI_UPDATE", payload: data as StoredKPIData });
      }
    },
    // Module 7: Auto-refresh trigger
    "sync:refresh_feed": () => {
      fetchShipments();
      fetchOperationalData();
    },
    // Module 9: analytics data changed — pages listening for this will re-fetch KPIs
    "analytics:refresh": () => {
      // Propagate via kpi:updated with null to signal pages should refetch
      // Pages subscribe directly to analytics:refresh via useSocket
    }
  }), [fetchShipments, fetchOperationalData]);

  const { emit } = useSocket({
    on: socketHandlers,
    onConnect: () => {
      if (company?.companyId) {
        emit("join:company", {
          companyId: company.companyId,
          userId:    user?.uid ?? "",
          role:      userRecord?.role ?? "user",
        });
        // Force a full refresh when reconnecting to get any missed events
        fetchShipments();
        fetchOperationalData();
      }
    }
  });

  // Re-join if company changes after initial connection
  useEffect(() => {
    if (company?.companyId) {
      emit("join:company", {
        companyId: company.companyId,
        userId:    user?.uid ?? "",
        role:      userRecord?.role ?? "user",
      });
    }
  }, [company?.companyId, user?.uid, userRecord?.role, emit]);

  // ── Persistence helpers ───────────────────────────────────────────────────
  // Saves/removes the pending shipment in localStorage so it survives refresh.
  // All reads/writes are wrapped in try/catch to guard against quota errors or
  // environments where localStorage is unavailable (SSR, private browsing).

  const persistPendingShipment = useCallback((data: PendingShipment | null) => {
    if (typeof window === "undefined") return;
    try {
      if (data === null) {
        window.localStorage.removeItem("sr_pending_shipment");
      } else {
        window.localStorage.setItem("sr_pending_shipment", JSON.stringify(data));
      }
    } catch {
      // Silently handle localStorage quota/permission errors
    }
  }, []);

  // ── Initialize pending shipment from localStorage on mount ─────────────────
  // Runs once after the first render. If a valid pending shipment was saved
  // (e.g. before a page refresh), restore it into the store so Route Selection
  // can resume without the user needing to reconfigure the corridor.
  // SET_PENDING_HYDRATED fires unconditionally (data found OR no data) so that
  // consumers can distinguish "not yet checked" from "checked and empty".
  useEffect(() => {
    if (typeof window === "undefined") {
      dispatch({ type: "SET_PENDING_HYDRATED" });
      return;
    }
    try {
      const stored = window.localStorage.getItem("sr_pending_shipment");
      if (stored) {
        const parsed = JSON.parse(stored) as PendingShipment;
        // Validate the minimum required fields before restoring
        if (parsed && typeof parsed.origin === "string" && parsed.origin.trim() &&
            typeof parsed.destination === "string" && parsed.destination.trim() &&
            typeof parsed.cargoType === "string" && parsed.cargoType.trim() &&
            typeof parsed.vehicleType === "string" && parsed.vehicleType.trim() &&
            typeof parsed.urgency === "string" && parsed.urgency.trim()) {
          dispatch({ type: "SET_PENDING", payload: parsed });
        } else {
          // Malformed data — clear it rather than silently using it
          window.localStorage.removeItem("sr_pending_shipment");
        }
      }
    } catch {
      // Silently handle parse errors — treat as no stored shipment
      try { window.localStorage.removeItem("sr_pending_shipment"); } catch { /* ignore */ }
    } finally {
      // Always mark hydration complete regardless of outcome
      dispatch({ type: "SET_PENDING_HYDRATED" });
    }
  }, []); // intentionally empty — runs once on mount to restore persisted state

  // ── Actions ────────────────────────────────────────────────────────────────

  const setPendingShipment = useCallback((data: PendingShipment) => {
    dispatch({ type: "SET_PENDING", payload: data });
    persistPendingShipment(data);
  }, [persistPendingShipment]);

  const clearPendingShipment = useCallback(() => {
    dispatch({ type: "CLEAR_PENDING" });
    persistPendingShipment(null);
  }, [persistPendingShipment]);

  const dispatchShipment = useCallback(
    async (opts: { pending: PendingShipment; route: Route; confidencePercent: number }): Promise<Shipment> => {
      const { route, pending, confidencePercent } = opts;
      const riskLevel: RiskLevel = getRiskLabel(route.riskScore);

      if (!user) throw new Error("Cannot dispatch shipment: user is not authenticated");

      const body: Record<string, unknown> = {
        origin:            pending.origin,
        destination:       pending.destination,
        vehicleType:       pending.vehicleType,
        cargoType:         pending.cargoType,
        urgency:           pending.urgency || "Standard",
        routeId:           route.id,
        routeName:         route.name.split(" - ")[0].trim(),
        riskScore:         route.riskScore,
        riskLevel,
        eta:               route.eta,
        distance:          route.distance,
        confidencePercent,
        // Pass weather and disruption scores for accurate at-risk classification
        weatherScore:      route.riskBreakdown.weather,
        disruptionScore:   route.riskBreakdown.disruption,
        riskBreakdown:     route.riskBreakdown,
        // Store geometry for map rendering on shipment detail page
        geometry:          route.geometry ?? undefined,
        // Geoapify coordinate data - stored for Module 4 and route intelligence
        originName:         pending.originName,
        originAddress:      pending.originAddress,
        originLat:          pending.originLat,
        originLng:          pending.originLng,
        originPlaceId:      pending.originPlaceId,
        destinationName:    pending.destinationName,
        destinationAddress: pending.destinationAddress,
        destinationLat:     pending.destinationLat,
        destinationLng:     pending.destinationLng,
        destinationPlaceId: pending.destinationPlaceId,
        // Cargo + schedule
        cargoWeightKg:      pending.cargoWeightKg,
        cargoVolumeM3:      pending.cargoVolumeM3,
        plannedDeparture:   pending.plannedDeparture,
        plannedArrival:     pending.plannedArrival,
        // Module 4 operational fields
        priority:               pending.urgency || "Standard",
        insuranceType:          pending.insurance,
        temperatureRequirement: pending.tempSensitive,
        deadline:               pending.deadline,
      };
      // Only include predictiveAlert if it's a non-empty string
      const alert = route.alerts[0];
      if (typeof alert === "string" && alert.length > 0) {
        body.predictiveAlert = alert;
      }

      const res = await fetchWithAuth(
        "/api/shipments",
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(body),
        },
        getToken,
        refreshToken,
        handleAuthFailure
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const message = (errBody as { error?: string }).error ?? `HTTP ${res.status}`;
        // #region agent log
        fetch('http://127.0.0.1:7489/ingest/effe3673-5596-4950-a2c3-f992f902843b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e4c26e'},body:JSON.stringify({sessionId:'e4c26e',runId:'pre-fix',hypothesisId:'E',location:'store.tsx:dispatchShipment:notOk',message:'POST /api/shipments failed',data:{status:res.status,error:message},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        throw new Error(`Failed to dispatch shipment: ${message}`);
      }

      const data      = await res.json();
      const persisted: Shipment = data.shipment;
      // #region agent log
      fetch('http://127.0.0.1:7489/ingest/effe3673-5596-4950-a2c3-f992f902843b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e4c26e'},body:JSON.stringify({sessionId:'e4c26e',runId:'pre-fix',hypothesisId:'C',location:'store.tsx:dispatchShipment:ok',message:'POST /api/shipments succeeded',data:{status:res.status,shipmentId:persisted?.id??null,companyIdOnResponse:(persisted as {companyId?:string})?.companyId??null,shipmentStatus:persisted?.status??null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      dispatch({ type: "ADD_SHIPMENT",  payload: persisted });
      // Clear both in-memory state AND localStorage — the shipment is now in the DB.
      // persistPendingShipment(null) must run here (not just dispatch CLEAR_PENDING)
      // so that a subsequent page refresh does not restore the already-dispatched shipment.
      dispatch({ type: "CLEAR_PENDING" });
      persistPendingShipment(null);
      return persisted;
    },
    [user, getToken, refreshToken, handleAuthFailure, persistPendingShipment]
  );

  const completeShipment = useCallback((id: string) => {
    if (!user) return;
    fetchWithAuth(
      `/api/shipments/${id}`,
      {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "completed" }),
      },
      getToken,
      refreshToken,
      handleAuthFailure
    ).catch((err) => console.error("[store] completeShipment:", err));
  }, [user, getToken, refreshToken, handleAuthFailure]);

  // ── Derived - memoized to prevent recomputation on every render ───────────

  const activeShipments    = useMemo(
    () => state.shipments.filter((s) => s.status === "active" || s.status === "at-risk"),
    [state.shipments]
  );
  const completedShipments = useMemo(
    () => state.shipments.filter((s) => s.status === "completed"),
    [state.shipments]
  );
  const atRiskShipments    = useMemo(
    () => state.shipments.filter((s) => s.status === "at-risk"),
    [state.shipments]
  );

  return (
    <StoreContext.Provider value={{
      state, pendingShipmentHydrated: state.pendingShipmentHydrated,
      setPendingShipment, clearPendingShipment,
      dispatchShipment, completeShipment, refreshShipments,
      activeShipments, completedShipments, atRiskShipments,
      operationalFeed: state.operationalFeed,
      operationalHealth: state.operationalHealth,
      presence: state.presence,
      kpis: state.kpis,
      shipmentStats: state.shipmentStats,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
