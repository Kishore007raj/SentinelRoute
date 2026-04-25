/**
 * socket-server.ts — Socket.io server singleton.
 *
 * Initialised once per server process. Survives Next.js hot-reloads via the
 * global singleton pattern.
 *
 * Requirements: 10.1 (single init), 10.2 (shipment_created), 10.3 (shipment_updated),
 *               10.4 (emit only after MongoDB write confirmed — enforced by callers)
 */

import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import type { Shipment } from "./types";

// Persist across Next.js hot-reloads in development.
const g = globalThis as typeof globalThis & { __socketIo?: Server };

/**
 * Returns the Socket.io Server singleton, creating it on the first call.
 *
 * @param httpServer - The Node.js HTTP server to attach to. Required on the
 *   first call (from the socket upgrade route handler). Subsequent calls
 *   return the existing instance and ignore this parameter.
 */
export function getSocketServer(httpServer?: HttpServer): Server {
  if (g.__socketIo) return g.__socketIo;

  g.__socketIo = new Server(httpServer, {
    path: "/api/socket",
    cors: { origin: "*" },
  });

  console.log("[socket] Server initialised");
  return g.__socketIo;
}

/**
 * Emits a `shipment_created` event to all connected clients.
 * Must only be called after the MongoDB write is confirmed (Requirement 10.4).
 */
export function emitShipmentCreated(shipment: Shipment): void {
  getSocketServer().emit("shipment_created", shipment);
}

/**
 * Emits a `shipment_updated` event to all connected clients.
 * Must only be called after the MongoDB write is confirmed (Requirement 10.4).
 */
export function emitShipmentUpdated(shipment: Shipment): void {
  getSocketServer().emit("shipment_updated", shipment);
}
