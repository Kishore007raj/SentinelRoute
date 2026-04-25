"use client";
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
} from "react";
import type { Shipment, ShipmentStatus, RouteLabel, RiskLevel, Route, PendingShipment } from "./types";
import { generateShipmentCode, getRiskLabel } from "./utils";
import { useUser } from "./auth-context";

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type { PendingShipment } from "./types";

export interface ShipmentStubRecord {
  id: string;
  shipmentCode: string;
  origin: string;
  destination: string;
  routeName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  eta: string;
  cargoType: string;
  vehicleType: string;
  confidencePercent: number;
  dispatchedAt: string;
  status: ShipmentStatus;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface StoreState {
  shipments: Shipment[];
  pendingShipment: PendingShipment | null;
  stubs: ShipmentStubRecord[];
  loading: boolean;
}

type Action =
  | { type: "SET_SHIPMENTS"; payload: Shipment[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_PENDING"; payload: PendingShipment }
  | { type: "CLEAR_PENDING" }
  | { type: "ADD_SHIPMENT"; payload: Shipment }
  | { type: "UPDATE_STATUS"; payload: { id: string; status: ShipmentStatus } }
  | { type: "ADD_STUB"; payload: ShipmentStubRecord };

const initialState: StoreState = {
  shipments: [],
  pendingShipment: null,
  stubs: [],
  loading: true,
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
            ? { ...s, status: action.payload.status, lastUpdate: "just now" }
            : s
        ),
      };
    case "ADD_STUB":
      return { ...state, stubs: [action.payload, ...state.stubs] };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface StoreContextValue {
  state: StoreState;
  setPendingShipment: (data: PendingShipment) => void;
  clearPendingShipment: () => void;
  dispatchShipment: (opts: {
    pending: PendingShipment;
    route: Route;
    confidencePercent: number;
  }) => Promise<Shipment>;
  completeShipment: (id: string) => void;
  addStub: (stub: ShipmentStubRecord) => void;
  refreshShipments: () => Promise<void>;
  activeShipments: Shipment[];
  completedShipments: Shipment[];
  atRiskShipments: Shipment[];
}

const StoreContext = createContext<StoreContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { user } = useUser();

  // ── Fetch shipments from API ───────────────────────────────────────────────
  // Layer 1: no auth header required — in-memory API accepts all requests.
  // When user is present, pass uid as Bearer token (ready for Layer 2+).
  const fetchShipments = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const headers: Record<string, string> = {};
      if (user?.uid) headers["Authorization"] = `Bearer ${user.uid}`;

      const res = await fetch("/api/shipments", { headers });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      dispatch({ type: "SET_SHIPMENTS", payload: data.shipments ?? [] });
    } catch (err) {
      console.error("[store] Failed to fetch shipments:", err);
      // Ensure loading is cleared so UI doesn't hang on spinner
      dispatch({ type: "SET_SHIPMENTS", payload: [] });
    }
  }, [user?.uid]);

  // Fetch on mount and whenever auth state changes
  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const refreshShipments = useCallback(async () => {
    await fetchShipments();
  }, [fetchShipments]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const setPendingShipment = useCallback((data: PendingShipment) => {
    dispatch({ type: "SET_PENDING", payload: data });
  }, []);

  const clearPendingShipment = useCallback(() => {
    dispatch({ type: "CLEAR_PENDING" });
  }, []);

  const dispatchShipment = useCallback(
    async (opts: {
      pending: PendingShipment;
      route: Route;
      confidencePercent: number;
    }): Promise<Shipment> => {
      const { route, pending, confidencePercent } = opts;
      const riskLevel: RiskLevel = getRiskLabel(route.riskScore);
      const routeLabel: RouteLabel = route.label;

      // Build body matching CreateShipmentRequest exactly
      const body = {
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
        predictiveAlert:   route.alerts[0] ?? undefined,
      };

      // POST to API — works with or without auth (Layer 1)
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (user?.uid) headers["Authorization"] = `Bearer ${user.uid}`;

        const res = await fetch("/api/shipments", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          const persisted: Shipment = data.shipment;
          dispatch({ type: "ADD_SHIPMENT", payload: persisted });
          dispatch({ type: "CLEAR_PENDING" });
          return persisted;
        }
        console.error("[store] POST /api/shipments failed:", res.status);
      } catch (err) {
        console.error("[store] Failed to persist shipment:", err);
      }

      // Local fallback if API call fails — build complete Shipment explicitly
      const now = new Date().toISOString();
      const shipment: Shipment = {
        id:                `shp-${Date.now()}`,
        shipmentCode:      generateShipmentCode(),
        origin:            pending.origin,
        destination:       pending.destination,
        selectedRoute:     routeLabel,
        routeName:         body.routeName,
        riskScore:         route.riskScore,
        riskLevel,
        eta:               route.eta,
        status:            "active",
        lastUpdate:        "just now",
        cargoType:         pending.cargoType,
        vehicleType:       pending.vehicleType,
        distance:          route.distance,
        departureTime:     new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        confidencePercent,
        predictiveAlert:   route.alerts[0] ?? "Monitoring route conditions",
        createdAt:         now,
        updatedAt:         now,
      };

      dispatch({ type: "ADD_SHIPMENT", payload: shipment });
      dispatch({ type: "CLEAR_PENDING" });
      return shipment;
    },
    [user?.uid]
  );

  const completeShipment = useCallback((id: string) => {
    // Optimistic local update
    dispatch({ type: "UPDATE_STATUS", payload: { id, status: "completed" } });

    // Persist to API — PATCH /api/shipments/[id]
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (user?.uid) headers["Authorization"] = `Bearer ${user.uid}`;

    fetch(`/api/shipments/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "completed" }),
    }).catch((err) => console.error("[store] completeShipment failed:", err));
  }, [user?.uid]);

  const addStub = useCallback((stub: ShipmentStubRecord) => {
    dispatch({ type: "ADD_STUB", payload: stub });
  }, []);

  // ── Derived selectors ──────────────────────────────────────────────────────

  const activeShipments = state.shipments.filter(
    (s) => s.status === "active" || s.status === "at-risk"
  );
  const completedShipments = state.shipments.filter(
    (s) => s.status === "completed"
  );
  const atRiskShipments = state.shipments.filter(
    (s) => s.status === "at-risk"
  );

  return (
    <StoreContext.Provider
      value={{
        state,
        setPendingShipment,
        clearPendingShipment,
        dispatchShipment,
        completeShipment,
        addStub,
        refreshShipments,
        activeShipments,
        completedShipments,
        atRiskShipments,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
