"use client";
import React, { createContext, useContext, useReducer, useCallback } from "react";
import {
  mockShipments,
  demoRoutes,
  type Shipment,
  type ShipmentStatus,
  type RouteLabel,
  type RiskLevel,
} from "./mock-data";
import { generateShipmentCode, getRiskLabel } from "./utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingShipment {
  origin: string;
  destination: string;
  vehicleType: string;
  cargoType: string;
  urgency: string;
  deadline?: string;
  insurance?: string;
  tempSensitive?: string;
}

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

interface StoreState {
  shipments: Shipment[];
  pendingShipment: PendingShipment | null;
  stubs: ShipmentStubRecord[];
}

type Action =
  | { type: "SET_PENDING"; payload: PendingShipment }
  | { type: "CLEAR_PENDING" }
  | { type: "ADD_SHIPMENT"; payload: Shipment }
  | { type: "UPDATE_STATUS"; payload: { id: string; status: ShipmentStatus } }
  | { type: "ADD_STUB"; payload: ShipmentStubRecord };

// ─── Initial state seeds with mock data ───────────────────────────────────────

const initialState: StoreState = {
  shipments: mockShipments,
  pendingShipment: null,
  stubs: [],
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
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
    routeId: string;
    confidencePercent: number;
  }) => Shipment;
  completeShipment: (id: string) => void;
  addStub: (stub: ShipmentStubRecord) => void;
  // Derived
  activeShipments: Shipment[];
  completedShipments: Shipment[];
  atRiskShipments: Shipment[];
}

const StoreContext = createContext<StoreContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setPendingShipment = useCallback((data: PendingShipment) => {
    dispatch({ type: "SET_PENDING", payload: data });
  }, []);

  const clearPendingShipment = useCallback(() => {
    dispatch({ type: "CLEAR_PENDING" });
  }, []);

  const dispatchShipment = useCallback(
    (opts: {
      pending: PendingShipment;
      routeId: string;
      confidencePercent: number;
    }): Shipment => {
      const route = demoRoutes.find((r) => r.id === opts.routeId);
      if (!route) throw new Error("Route not found: " + opts.routeId);

      const riskLevel: RiskLevel = getRiskLabel(route.riskScore);
      const routeLabel: RouteLabel = route.label;

      const shipment: Shipment = {
        id: `shp-${Date.now()}`,
        shipmentCode: generateShipmentCode(),
        origin: opts.pending.origin,
        destination: opts.pending.destination,
        selectedRoute: routeLabel,
        routeName: route.name.split(" — ")[0].trim(), // "Route A", "Route B", "Route C"
        riskScore: route.riskScore,
        riskLevel,
        eta: route.eta,
        status: "active",
        lastUpdate: "just now",
        cargoType: opts.pending.cargoType,
        vehicleType: opts.pending.vehicleType,
        distance: route.distance,
        departureTime: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        confidencePercent: opts.confidencePercent,
        predictiveAlert: route.alerts[0],
      };

      dispatch({ type: "ADD_SHIPMENT", payload: shipment });
      dispatch({ type: "CLEAR_PENDING" });
      return shipment;
    },
    []
  );

  const completeShipment = useCallback((id: string) => {
    dispatch({ type: "UPDATE_STATUS", payload: { id, status: "completed" } });
  }, []);

  const addStub = useCallback((stub: ShipmentStubRecord) => {
    dispatch({ type: "ADD_STUB", payload: stub });
  }, []);

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
