/**
 * use-socket.ts — Socket.io client hook for SentinelRoute.
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
}

interface UseSocketReturn {
  connected: boolean;
  emit: (event: string, data?: unknown) => void;
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
  _socket = io({
    path: "/api/socket",
    transports: ["websocket", "polling"],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    timeout: 10_000,
    autoConnect: true,
  });
  return _socket;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const WS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === "true";

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { user } = useUser();
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(options.on ?? {});
  const socketRef = useRef<unknown>(null);

  useEffect(() => {
    handlersRef.current = options.on ?? {};
  }, [options.on]);

  useEffect(() => {
    // No-op on Vercel / when WebSocket is not enabled
    if (!WS_ENABLED) return;

    let cancelled = false;

    getSocket().then((socket) => {
      if (cancelled) return;
      socketRef.current = socket;

      const onConnect = () => {
        setConnected(true);
        if (user?.uid) socket.emit("join:user", user.uid);
      };
      const onDisconnect = () => setConnected(false);

      // Proxy handlers — delegate to current ref so we don't re-subscribe
      const proxyHandlers: Record<string, (data: unknown) => void> = {};
      const events = Object.keys(handlersRef.current);
      for (const event of events) {
        proxyHandlers[event] = (data: unknown) => handlersRef.current[event]?.(data);
        socket.on(event, proxyHandlers[event]);
      }

      socket.on("connect",    onConnect);
      socket.on("disconnect", onDisconnect);
      if (socket.connected) onConnect();

      return () => {
        socket.off("connect",    onConnect);
        socket.off("disconnect", onDisconnect);
        for (const event of events) socket.off(event, proxyHandlers[event]);
      };
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const emit = useCallback((event: string, data?: unknown) => {
    if (!WS_ENABLED || !socketRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socketRef.current as any).emit(event, data);
  }, []);

  return { connected, emit };
}
