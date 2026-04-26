/**
 * use-socket.ts — Socket.io client hook for SentinelRoute.
 *
 * Features:
 *  - Connects to /api/socket with auto-reconnect
 *  - Joins the authenticated user's room for targeted updates
 *  - Exposes `on` / `off` / `emit` helpers
 *  - Cleans up on unmount
 *  - Works globally — one connection per browser tab
 *
 * Usage:
 *   const { connected } = useSocket({
 *     on: { "shipment:updated": (data) => ... }
 *   });
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { useUser } from "@/lib/auth-context";

// ─── Singleton socket — one per browser tab ───────────────────────────────────
let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket || _socket.disconnected) {
    _socket = io({
      path: "/api/socket",
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      timeout: 10_000,
      autoConnect: true,
    });
  }
  return _socket;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseSocketOptions {
  /** Map of event name → handler. Stable reference recommended (useMemo/useCallback). */
  on?: Record<string, (data: unknown) => void>;
}

interface UseSocketReturn {
  connected: boolean;
  emit: (event: string, data?: unknown) => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { user } = useUser();
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(options.on ?? {});

  // Keep handlers ref up to date without re-subscribing
  useEffect(() => {
    handlersRef.current = options.on ?? {};
  }, [options.on]);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      // Join user room so server can send targeted events
      if (user?.uid) {
        socket.emit("join:user", user.uid);
      }
    };

    const onDisconnect = () => setConnected(false);

    // Proxy handler — delegates to current handlersRef so we don't
    // need to re-subscribe when handlers change
    const proxyHandlers: Record<string, (data: unknown) => void> = {};

    const events = Object.keys(handlersRef.current);
    for (const event of events) {
      proxyHandlers[event] = (data: unknown) => {
        handlersRef.current[event]?.(data);
      };
      socket.on(event, proxyHandlers[event]);
    }

    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);

    // If already connected, fire immediately
    if (socket.connected) onConnect();

    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
      for (const event of events) {
        socket.off(event, proxyHandlers[event]);
      }
    };
  // Re-run when user changes (to re-join the correct room)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const emit = useCallback((event: string, data?: unknown) => {
    getSocket().emit(event, data);
  }, []);

  return { connected, emit };
}
