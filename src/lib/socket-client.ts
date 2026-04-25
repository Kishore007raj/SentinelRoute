/**
 * socket-client.ts — Socket.io client hook.
 *
 * A module-level singleton ensures a single connection is shared across all
 * re-renders and component instances.
 *
 * Requirements: 10.5 (connects on load), 10.6 (auto-reconnection),
 *               10.7 (shipment_created → onCreated), 10.8 (shipment_updated → onUpdated)
 */

"use client";
import { useEffect } from "react";
import { io, Socket } from "socket.io-client";
import type { Shipment } from "./types";

// Module-level singleton — one connection for the lifetime of the browser tab.
let socket: Socket | null = null;

/**
 * Registers `onCreated` and `onUpdated` listeners on the shared Socket.io
 * connection. The connection is created on the first call and reused on
 * subsequent calls. Listeners are removed on unmount.
 *
 * @param onCreated - Called when a `shipment_created` event is received.
 * @param onUpdated - Called when a `shipment_updated` event is received.
 */
export function useSocket(
  onCreated: (s: Shipment) => void,
  onUpdated: (s: Shipment) => void,
): void {
  useEffect(() => {
    if (!socket) {
      socket = io({ path: "/api/socket", reconnection: true });
    }

    socket.on("shipment_created", onCreated);
    socket.on("shipment_updated", onUpdated);

    return () => {
      socket?.off("shipment_created", onCreated);
      socket?.off("shipment_updated", onUpdated);
      // NOTE: socket is intentionally NOT disconnected here — it is a singleton
      // shared across all consumers and must remain open for the tab lifetime.
    };
  }, [onCreated, onUpdated]);
}
