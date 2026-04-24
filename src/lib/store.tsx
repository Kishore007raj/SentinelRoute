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

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "SET_SHIPMENTS":
      return { ...state, shipments: action.payload, loading: false };
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
  // Derived
  activeShipments: Shipment[];
  completedShipments: Shipment[];
  atRiskShipments: Shipment[];
}

const StoreContext = createContext<StoreContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { user } = useUser();

  // ── Fetch shipments from API when user is available ──────────────────────
  const fetchShipments = useCallback(async (uid: string) => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const res = await fetch("/api/shipments", {
        headers: { Authorization: `Bearer ${uid}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      dispatch({ type: "SET_SHIPMENTS", payload: data.shipments ?? [] });
    } catch (err) {
      console.error("[store] Failed to fetch shipments:", err);
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  useEffect(() => {
    if (user?.uid) {
      fetchShipments(user.uid);
    } else {
      // Not signed in — clear shipments
      dispatch({ type: "SET_SHIPMENTS", payload: [] });
    }
  }, [user?.uid, fetchShipments]);

  const refreshShipments = useCallback(async () => {
    if (user?.uid) await fetchShipments(user.uid);
  }, [user?.uid, fetchShipments]);

  // ── Actions ───────────────────────────────────────────────────────────────

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
      const { route } = opts;
      const riskLevel: RiskLevel = getRiskLabel(route.riskScore);
      const routeLabel: RouteLabel = route.label;

      // Build the request body for POST /api/shipments
      const body = {
        origin:           opts.pending.origin,
        destination:      opts.pending.destination,
        vehicleType:      opts.pending.vehicleType,
        cargoType:        opts.pending.cargoType,
        urgency:          opts.pending.urgency,
        routeId:          route.id,
        routeName:        route.name.split(" — ")[0].trim(),
        riskScore:        route.riskScore,
        riskLevel,
        eta:              route.eta,
        distance:         route.distance,
        confidencePercent: opts.confidencePercent,
        predictiveAlert:  route.alerts[0] ?? undefined,
      };

      // Persist to Firestore via API
      if (user?.uid) {
        try {
          const res = await fetch("/api/shipments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${user.uid}`,
            },
            body: JSON.stringify(body),
          });

          if (res.ok) {
            const data = await res.json();
            const persisted: Shipment = data.shipment;
            dispatch({ type: "ADD_SHIPMENT", payload: persisted });
            dispatch({ type: "CLEAR_PENDING" });
            return persisted;
          }
        } catch (err) {
          console.error("[store] Failed to persist shipment:", err);
        }
      }

      // Fallback: local-only if API fails or user not available
      const shipment: Shipment = {
        id: `shp-${Date.now()}`,
        shipmentCode: generateShipmentCode(),
        selectedRoute: routeLabel,
        status: "active",
        lastUpdate: "just now",
        departureTime: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit", minute: "2-digit",
        }),
        ...body,
        routeName: body.routeName,
      };

      dispatch({ type: "ADD_SHIPMENT", payload: shipment });
      dispatch({ type: "CLEAR_PENDING" });
      return shipment;
    },
    [user?.uid]
  );

  const completeShipment = useCallback((id: string) => {
    dispatch({ type: "UPDATE_STATUS", payload: { id, status: "completed" } });
    // Fire-and-forget status update to Firestore via API
    if (user?.uid) {
      fetch(`/api/shipments/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.uid}`,
        },
        body: JSON.stringify({ status: "completed" }),
      }).catch((err) => console.error("[store] Failed to update status:", err));
    }
  }, [user?.uid]);

  const addStub = useCallback((stub: ShipmentStubRecord) => {
    dispatch({ type: "ADD_STUB", payload: stub });
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

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
