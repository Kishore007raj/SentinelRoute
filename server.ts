import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { validateStartup, logEnvStatus } from "./src/lib/env";
import { adminAuth } from "./src/lib/firebase-admin";

// ── Startup validation — fail fast if critical env vars are missing ──────────
validateStartup();
logEnvStatus();

const dev  = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app     = next({ dev });
const handle  = app.getRequestHandler();

// ── JWT payload decoder (fallback when Admin SDK not configured) ──────────────
function decodeJwtUid(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json    = Buffer.from(payload, "base64").toString("utf8");
    const parsed  = JSON.parse(json) as Record<string, unknown>;
    const iss = typeof parsed.iss === "string" ? parsed.iss : "";
    if (!iss.startsWith("https://securetoken.google.com/")) return null;
    return typeof parsed.sub === "string" ? parsed.sub : null;
  } catch {
    return null;
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  // ── Socket.io setup ────────────────────────────────────────────────────────
  const io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? "*",
      methods: ["GET", "POST"],
    },
    // Prefer WebSocket, fall back to polling (works behind proxies/Vercel)
    transports: ["websocket", "polling"],
  });

  // Attach io to global so API routes can emit events
  (global as Record<string, unknown>).__socketio = io;

  // ── Socket authentication middleware ─────────────────────────────────────
  // Every socket connection must supply a valid Firebase ID token in
  // socket.handshake.auth.token. Unauthenticated sockets are rejected.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token || typeof token !== "string" || !token.startsWith("eyJ")) {
      return next(new Error("Unauthorized: missing or malformed token"));
    }

    try {
      if (adminAuth) {
        // Full cryptographic verification via Firebase Admin SDK
        await adminAuth.verifyIdToken(token);
      } else {
        // Fallback: trust Firebase issuer claim (dev without service account)
        const uid = decodeJwtUid(token);
        if (!uid) return next(new Error("Unauthorized: invalid token issuer"));
      }
      // Attach decoded uid to socket data for downstream handlers
      const uid = adminAuth
        ? (await adminAuth.verifyIdToken(token)).uid
        : decodeJwtUid(token)!;
      socket.data.uid = uid;
      return next();
    } catch {
      return next(new Error("Unauthorized: token verification failed"));
    }
  });

  // ── Presence tracking ─────────────────────────────────────────────────────
  const presence = new Map<string, { companyId: string; userId: string; role: string; lastSeen: number }>();

  io.on("connection", (socket) => {
    console.log(`[socket] Client connected: ${socket.id} uid=${socket.data.uid}`);

    // Send server UTC time immediately on connect so clients can verify clock sync
    socket.emit("server:time", { utc: new Date().toISOString() });

    // Client can join a user-specific room for targeted updates
    socket.on("join:user", (userId: string) => {
      // Only allow joining own user room (uid verified at middleware level)
      if (typeof userId === "string" && userId.length > 0 && userId === socket.data.uid) {
        socket.join(`user:${userId}`);
        console.log(`[socket] ${socket.id} joined room user:${userId}`);
      }
    });

    // Client joins a company room for real-time collaboration updates
    socket.on("join:company", (data: { companyId: string, userId: string, role: string }) => {
      if (data && typeof data.companyId === "string" && data.companyId.length > 0) {
        socket.join(`company:${data.companyId}`);
        presence.set(socket.id, { companyId: data.companyId, userId: data.userId, role: data.role, lastSeen: Date.now() });
        
        io.to(`company:${data.companyId}`).emit("presence:updated", {
          userId: data.userId,
          status: "online",
          role: data.role
        });
        console.log(`[socket] ${socket.id} joined room company:${data.companyId}`);
      }
    });

    // Handle ping for connection health tracking
    socket.on("ping:presence", () => {
      const userPresence = presence.get(socket.id);
      if (userPresence) {
        userPresence.lastSeen = Date.now();
        presence.set(socket.id, userPresence);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[socket] Client disconnected: ${socket.id} - ${reason}`);
      const userPresence = presence.get(socket.id);
      if (userPresence) {
        io.to(`company:${userPresence.companyId}`).emit("presence:updated", {
          userId: userPresence.userId,
          status: "offline",
          role: userPresence.role
        });
        presence.delete(socket.id);
      }
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
