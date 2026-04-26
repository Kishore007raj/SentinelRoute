"use client";
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { signOut } from "firebase/auth";
import { usePathname } from "next/navigation";
import type { Shipment, ShipmentStatus, RiskLevel, Route, PendingShipment } from "./types";
import { getRiskLabel } from "./utils";
import { useUser } from "./auth-context";
import { auth } from "./firebase";
import { useSocket } from "@/hooks/use-socket";
import { utcNow } from "./time";

export type { PendingShipment } from "./types";

// ─── API resilience helpers ───────────────────────────────────────────────────

const API_TIMEOUT_MS = 9_000;

/**
 * fetch with:
 *  - hard 9s timeout per attempt
 *  - single retry on network errors and 5xx responses
 *  - NO retry on 4xx (except 401 which is handled separately)
 *
 * Each attempt gets its OWN AbortController so the timeout from
 * attempt 1 never fires during attempt 2.
 */
async function fetchWithResilience(
  url: string,
  options: RequestInit
): Promise<Response> {
  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      // Strip any existing signal from options — we own the abort controller
      const { signal: _ignored, ...rest } = options as RequestInit & { signal?: unknown };
      const res = await fetch(url, { ...rest, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  let res: Response;
  try {
    res = await attempt();
  } catch {
    // First attempt failed (network/timeout) — wait then retry once
    await new Promise((r) => setTimeout(r, 800));
    return attempt();
  }

  // Retry once on 5xx
  if (res.status >= 500) {
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
  onAuthFailure: () => void
): Promise<Response> {
  const token = await getToken();
  const headers = {
    ...(options.headers as Record<string, string> ?? {}),
    Authorization: `Bearer ${token}`,
  };

  const res = await fetchWithResilience(url, { ...options, headers });

  if (res.status === 401) {
    // Token may have expired — force refresh once and retry
    const freshToken = await forceRefreshToken();
    if (!freshToken) {
      onAuthFailure();
      return res;
    }
    const retryHeaders = { ...(options.headers as Record<string, string> ?? {}), Authorization: `Bearer ${freshToken}` };
    const retryRes = await fetchWithResilience(url, { ...options, headers: retryHeaders });
    if (retryRes.status === 401) {
      // Still unauthorized after refresh — session is broken
      onAuthFailure();
    }
    return retryRes;
  }

  return res;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface StoreState {
  shipments:       Shipment[];
  pendingShipment: PendingShipment | null;
  loading:         boolean;
}

type Action =
  | { type: "SET_SHIPMENTS";  payload: Shipment[] }
  | { type: "SET_LOADING";    payload: boolean }
  | { type: "SET_PENDING";    payload: PendingShipment }
  | { type: "CLEAR_PENDING" }
  | { type: "ADD_SHIPMENT";   payload: Shipment }
  | { type: "UPDATE_STATUS";  payload: { id: string; status: ShipmentStatus; lastUpdate: string } };

const initialState: StoreState = {
  shipments:       [],
  pendingShipment: null,
  loading:         true,
};

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "SET_SHIPMENTS":
      return { ...state, shipments: action.payload ?? [], loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_PENDING":
      return { ...state, pendingShipment: action.payload };
    case "CLEAR_PENDING":
      return { ...state, pendingShipment: null };
    case "ADD_SHIPMENT":
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
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface StoreContextValue {
  state:               StoreState;
  setPendingShipment:  (data: PendingShipment) => void;
  clearPendingShipment: () => void;
  dispatchShipment:    (opts: { pending: PendingShipment; route: Route; confidencePercent: number }) => Promise<Shipment>;
  completeShipment:    (id: string) => void;
  refreshShipments:    () => Promise<void>;
  activeShipments:     Shipment[];
  completedShipments:  Shipment[];
  atRiskShipments:     Shipment[];
}

const StoreContext = createContext<StoreContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { user, refreshToken } = useUser();
  const pathname = usePathname();

  // Clear pendingShipment when navigating away from /routes
  useEffect(() => {
    if (!pathname.startsWith("/routes")) {
      dispatch({ type: "CLEAR_PENDING" });
    }
  }, [pathname]);

  // ── Auth failure handler — signs out and clears state ─────────────────────
  const handleAuthFailure = useCallback(() => {
    console.warn("[store] Auth failure after token refresh — signing out");
    dispatch({ type: "SET_SHIPMENTS", payload: [] });
    document.cookie = "sr_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    signOut(auth).catch(() => {});
  }, []);

  // ── Token helpers ──────────────────────────────────────────────────────────
  const getToken = useCallback(async (): Promise<string> => {
    if (!user) return "";
    return user.getIdToken();
  }, [user]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchShipments = useCallback(async () => {
    if (!user) { dispatch({ type: "SET_SHIPMENTS", payload: [] }); return; }
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const res = await fetchWithAuth(
        "/api/shipments",
        { method: "GET" },
        getToken,
        refreshToken,
        handleAuthFailure
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      dispatch({ type: "SET_SHIPMENTS", payload: data.shipments ?? [] });
    } catch (err) {
      // 503 = Firebase Admin not configured (expected in dev without service account).
      // Still resolve to empty list — never leave the app in a loading state.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("503")) {
        console.error("[store] fetchShipments:", err);
      }
      dispatch({ type: "SET_SHIPMENTS", payload: [] });
    }
  }, [user, getToken, refreshToken, handleAuthFailure]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const refreshShipments = useCallback(async () => { await fetchShipments(); }, [fetchShipments]);

  // ── Real-time socket updates ───────────────────────────────────────────────
  // Handlers are memoised so useSocket doesn't re-subscribe on every render
  const socketHandlers = useMemo(() => ({
    // A new shipment was created (e.g. from another tab or device)
    "shipment:created": (data: unknown) => {
      const { shipment } = data as { shipment: Shipment };
      if (shipment) dispatch({ type: "ADD_SHIPMENT", payload: shipment });
    },
    // A shipment's status changed (e.g. completed from another tab)
    "shipment:status": (data: unknown) => {
      const { id, status, lastUpdate } = data as {
        id: string; status: ShipmentStatus; lastUpdate: string;
      };
      if (id && status) {
        dispatch({ type: "UPDATE_STATUS", payload: { id, status, lastUpdate: lastUpdate ?? utcNow() } });
      }
    },
    // Full shipment object updated
    "shipment:updated": (data: unknown) => {
      const { shipment } = data as { shipment: Shipment };
      if (shipment) {
        dispatch({ type: "UPDATE_STATUS", payload: {
          id:         shipment.id,
          status:     shipment.status,
          lastUpdate: shipment.lastUpdate,
        }});
      }
    },
  }), []);

  useSocket({ on: socketHandlers });

  // ── Actions ────────────────────────────────────────────────────────────────

  const setPendingShipment  = useCallback((data: PendingShipment) => dispatch({ type: "SET_PENDING",  payload: data }), []);
  const clearPendingShipment = useCallback(() => dispatch({ type: "CLEAR_PENDING" }), []);

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
        routeName:         route.name.split(" — ")[0].trim(),
        riskScore:         route.riskScore,
        riskLevel,
        eta:               route.eta,
        distance:          route.distance,
        confidencePercent,
        // Pass weather and disruption scores for accurate at-risk classification
        weatherScore:      route.riskBreakdown.weather,
        disruptionScore:   route.riskBreakdown.disruption,
        riskBreakdown:     route.riskBreakdown,
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
        throw new Error(`Failed to dispatch shipment: ${message}`);
      }

      const data      = await res.json();
      const persisted: Shipment = data.shipment;
      dispatch({ type: "ADD_SHIPMENT",  payload: persisted });
      dispatch({ type: "CLEAR_PENDING" });
      return persisted;
    },
    [user, getToken, refreshToken, handleAuthFailure]
  );

  const completeShipment = useCallback((id: string) => {
    const now = utcNow();
    dispatch({ type: "UPDATE_STATUS", payload: { id, status: "completed", lastUpdate: now } });
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

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeShipments    = state.shipments.filter((s) => s.status === "active" || s.status === "at-risk");
  const completedShipments = state.shipments.filter((s) => s.status === "completed");
  const atRiskShipments    = state.shipments.filter((s) => s.status === "at-risk");

  return (
    <StoreContext.Provider value={{
      state, setPendingShipment, clearPendingShipment,
      dispatchShipment, completeShipment, refreshShipments,
      activeShipments, completedShipments, atRiskShipments,
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
