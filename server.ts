/**
 * server.ts - Custom Next.js server with Socket.io
 *
 * Run with: node --experimental-strip-types server.ts
 * Or compile first: npx tsc server.ts --outDir .next/server
 *
 * Socket.io events emitted to clients:
 *   shipment:updated  - { shipment: Shipment }
 *   shipment:created  - { shipment: Shipment }
 *   shipment:status   - { id, status, lastUpdate (UTC ISO) }
 *   server:time       - { utc: ISO string } - sent on connect for clock sync
 *
 * All timestamps are UTC ISO strings. Clients display in their local timezone.
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev  = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app     = next({ dev });
const handle  = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  // ── Socket.io setup ────────────────────────────────────────────────────────
  const io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    // Prefer WebSocket, fall back to polling (works behind proxies/Vercel)
    transports: ["websocket", "polling"],
  });

  // Attach io to global so API routes can emit events
  (global as Record<string, unknown>).__socketio = io;

  io.on("connection", (socket) => {
    console.log(`[socket] Client connected: ${socket.id}`);

    // Send server UTC time immediately on connect so clients can verify clock sync
    socket.emit("server:time", { utc: new Date().toISOString() });

    // Client can join a user-specific room for targeted updates
    socket.on("join:user", (userId: string) => {
      if (typeof userId === "string" && userId.length > 0) {
        socket.join(`user:${userId}`);
        console.log(`[socket] ${socket.id} joined room user:${userId}`);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[socket] Client disconnected: ${socket.id} - ${reason}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (${dev ? "dev" : "prod"})`);
    console.log(`> Socket.io listening on /api/socket`);
  });
});

/**
 * Helper used by API routes to emit events to connected clients.
 * Usage:
 *   import { emitToUser } from "@/lib/socket-server";
 *   emitToUser(userId, "shipment:updated", { shipment });
 */
export function getSocketIO(): SocketIOServer | null {
  return (global as Record<string, unknown>).__socketio as SocketIOServer ?? null;
}
