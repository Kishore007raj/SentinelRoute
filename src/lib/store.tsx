"use client";
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
} from "react";
import type { Shipment, ShipmentStatus, Route, PendingShipment } from "./types";
import { useUser } from "./auth-context";

interface StoreState {
  shipments: Shipment[];
  pendingShipment: PendingShipment | null;
  loading: boolean;
}

type Action =
  | { type: "SET_SHIPMENTS"; payload: Shipment[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_PENDING"; payload: PendingShipment }
  | { type: "CLEAR_PENDING" }
  | { type: "UPDATE_STATUS"; payload: { id: string; status: ShipmentStatus } };

const initialState: StoreState = {
  shipments: [],
  pendingShipment: null,
  loading: true,
};

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "SET_SHIPMENTS":
      return { ...state, shipments: action.payload || [], loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_PENDING":
      return { ...state, pendingShipment: action.payload };
    case "CLEAR_PENDING":
      return { ...state, pendingShipment: null };
    case "UPDATE_STATUS":
      return {
        ...state,
        shipments: (state.shipments || []).map((s) =>
          (s.id === action.payload.id || s.shipmentId === action.payload.id)
            ? { ...s, status: action.payload.status, updatedAt: new Date().toISOString() }
            : s
        ),
      };
    default:
      return state;
  }
}

interface StoreContextValue {
  state: StoreState;
  setPendingShipment: (data: PendingShipment) => void;
  clearPendingShipment: () => void;
  dispatchShipment: (opts: {
    pending: PendingShipment;
    route: Route;
  }) => Promise<void>;
  updateShipmentStatus: (id: string, status: ShipmentStatus) => Promise<void>;
  refreshShipments: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { user } = useUser();

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
      dispatch({ type: "SET_SHIPMENTS", payload: [] });
    }
  }, [user?.uid, fetchShipments]);

  const refreshShipments = useCallback(async () => {
    if (user?.uid) await fetchShipments(user.uid);
  }, [user?.uid, fetchShipments]);

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
    }): Promise<void> => {
      if (!user?.uid) return;

      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.uid}`,
        },
        body: JSON.stringify({
          origin: opts.pending.origin,
          destination: opts.pending.destination,
          vehicleType: opts.pending.vehicleType,
          cargoType: opts.pending.cargoType,
          urgency: opts.pending.urgency,
          deadline: opts.pending.deadline,
          route: opts.route,
        }),
      });

      if (res.ok) {
        dispatch({ type: "CLEAR_PENDING" });
        await refreshShipments();
      } else {
        throw new Error(`Dispatch failed: ${res.status}`);
      }
    },
    [user?.uid, refreshShipments]
  );

  const updateShipmentStatus = useCallback(async (id: string, status: ShipmentStatus) => {
    if (!user?.uid) return;

    const res = await fetch(`/api/shipments/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.uid}`,
      },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      dispatch({ type: "UPDATE_STATUS", payload: { id, status } });
    } else {
      throw new Error(`Status update failed: ${res.status}`);
    }
  }, [user?.uid]);

  return (
    <StoreContext.Provider
      value={{
        state,
        setPendingShipment,
        clearPendingShipment,
        dispatchShipment,
        updateShipmentStatus,
        refreshShipments,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
