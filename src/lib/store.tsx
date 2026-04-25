"use client";
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
} from "react";
import type { Shipment, ShipmentStatus, RiskLevel, Route, PendingShipment } from "./types";
import { getRiskLabel } from "./utils";
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
  const fetchShipments = useCallback(async () => {
    // No user → clear shipments immediately, don't call API
    if (!user) {
      dispatch({ type: "SET_SHIPMENTS", payload: [] });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/shipments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      dispatch({ type: "SET_SHIPMENTS", payload: data.shipments ?? [] });
    } catch (err) {
      console.error("[store] Failed to fetch shipments:", err);
      dispatch({ type: "SET_SHIPMENTS", payload: [] });
    }
  }, [user]);

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

      // Require auth — no user means no dispatch
      if (!user) {
        throw new Error("Cannot dispatch shipment: user is not authenticated");
      }

      const token = await user.getIdToken();
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const message = (errBody as { error?: string }).error ?? `HTTP ${res.status}`;
        console.error(`[store] POST /api/shipments failed: ${message}`);
        throw new Error(`Failed to dispatch shipment: ${message}`);
      }

      const data = await res.json();
      const persisted: Shipment = data.shipment;
      dispatch({ type: "ADD_SHIPMENT", payload: persisted });
      dispatch({ type: "CLEAR_PENDING" });
      return persisted;
    },
    [user]
  );

  const completeShipment = useCallback((id: string) => {
    // Optimistic local update
    dispatch({ type: "UPDATE_STATUS", payload: { id, status: "completed" } });

    // Persist to API — requires auth
    if (!user) return;

    user.getIdToken().then((token) => {
      fetch(`/api/shipments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "completed" }),
      }).catch((err) => console.error("[store] completeShipment failed:", err));
    }).catch((err) => console.error("[store] getIdToken failed:", err));
  }, [user]);

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
