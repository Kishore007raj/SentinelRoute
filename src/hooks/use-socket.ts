/**
 * use-socket.ts - Socket.io client hook for SentinelRoute.
 *
 * Works in two modes:
 *  - Local dev with `npm run dev` (custom server) → real WebSocket connection
 *  - Vercel / serverless → gracefully disabled (no-op), store uses polling instead
 *
 * Detection: if NEXT_PUBLIC_ENABLE_WEBSOCKET=true is set, the socket connects.
 * Otherwise it's a no-op so the app works perfectly on Vercel without errors.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@/lib/auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseSocketOptions {
  on?: Record<string, (data: unknown) => void>;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface UseSocketReturn {
  connected: boolean;
  emit: (event: string, data?: unknown) => void;
  reconnect: () => void;
  lastPing: number | null;
}

// ─── Singleton socket ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _socket: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSocket(): Promise<any> {
  if (_socket) return _socket;

  // Dynamically import socket.io-client only when WebSocket is enabled.
  // This keeps it out of the Vercel bundle entirely.
  const { io } = await import("socket.io-client");
  const { auth } = await import("@/lib/firebase");

  // Retrieve current Firebase ID token for socket handshake authentication
  let token = "";
  try {
    if (auth.currentUser) {
      token = await auth.currentUser.getIdToken();
    }
  } catch {
    // Token fetch failed - connection will be rejected by server middleware
    console.warn("[socket] Could not retrieve Firebase token for handshake");
  }

  _socket = io({
    path: "/api/socket",
    transports: ["websocket", "polling"],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    timeout: 10_000,
    autoConnect: true,
    auth: { token },
  });
  return _socket;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const WS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === "true";

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { user } = useUser();
  const [connected, setConnected] = useState(false);
  const [lastPing, setLastPing] = useState<number | null>(null);
  const handlersRef = useRef(options.on ?? {});
  const onConnectRef = useRef(options.onConnect);
  const onDisconnectRef = useRef(options.onDisconnect);
  const socketRef = useRef<unknown>(null);

  useEffect(() => {
    handlersRef.current = options.on ?? {};
    onConnectRef.current = options.onConnect;
    onDisconnectRef.current = options.onDisconnect;
  }, [options.on, options.onConnect, options.onDisconnect]);

  useEffect(() => {
    // No-op on Vercel / when WebSocket is not enabled
    if (!WS_ENABLED) return;

    let cancelled = false;
    let pingInterval: NodeJS.Timeout | null = null;
    // cleanupRef stores the inner async cleanup so it's accessible from the outer return
    const cleanupRef: { fn: (() => void) | null } = { fn: null };

    getSocket().then((socket) => {
      if (cancelled) return;
      socketRef.current = socket;

      const onConnect = () => {
        setConnected(true);
        setLastPing(Date.now());
        if (user?.uid) socket.emit("join:user", user.uid);
        if (onConnectRef.current) onConnectRef.current();

        // Custom ping for presence
        pingInterval = setInterval(() => {
          if (socket.connected) {
            socket.emit("ping:presence");
            setLastPing(Date.now());
          }
        }, 15000);
      };
      
      const onDisconnect = () => {
        setConnected(false);
        if (pingInterval) clearInterval(pingInterval);
        if (onDisconnectRef.current) onDisconnectRef.current();
      };

      // Proxy handlers - delegate to current ref so we don't re-subscribe
      const proxyHandlers: Record<string, (data: unknown) => void> = {};
      const events = Object.keys(handlersRef.current);
      for (const event of events) {
        proxyHandlers[event] = (data: unknown) => handlersRef.current[event]?.(data);
        socket.on(event, proxyHandlers[event]);
      }

      socket.on("connect",    onConnect);
      socket.on("disconnect", onDisconnect);
      if (socket.connected) onConnect();

      // Store cleanup so the outer effect can call it synchronously on unmount
      cleanupRef.fn = () => {
        socket.off("connect",    onConnect);
        socket.off("disconnect", onDisconnect);
        if (pingInterval) clearInterval(pingInterval);
        for (const event of events) socket.off(event, proxyHandlers[event]);
      };
    });

    return () => {
      cancelled = true;
      // Execute inner cleanup if socket resolved before unmount
      if (cleanupRef.fn) cleanupRef.fn();
    };
   
  }, [user?.uid]);

  const emit = useCallback((event: string, data?: unknown) => {
    if (!WS_ENABLED || !socketRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socketRef.current as any).emit(event, data);
  }, []);

  const reconnect = useCallback(() => {
    if (_socket) {
      _socket.disconnect();
      _socket.connect();
    }
  }, []);

  return { connected, emit, reconnect, lastPing };
}
