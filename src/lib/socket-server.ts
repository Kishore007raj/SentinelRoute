/**
 * socket-server.ts — Server-side Socket.io helpers for API routes.
 *
 * API routes import `emitToUser` / `emitToAll` to push real-time
 * events to connected clients without importing the full server.
 *
 * Safe to import in any API route — returns a no-op if Socket.io
 * is not initialised (e.g. during build or in test environments).
 */

import type { Server as SocketIOServer } from "socket.io";

function getIO(): SocketIOServer | null {
  return (global as Record<string, unknown>).__socketio as SocketIOServer ?? null;
}

/**
 * Emit an event to all sockets in a user's room.
 * Room name: `user:<userId>`
 */
export function emitToUser(
  userId: string,
  event: string,
  data: unknown
): void {
  const io = getIO();
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Emit an event to ALL connected clients.
 */
export function emitToAll(event: string, data: unknown): void {
  const io = getIO();
  if (!io) return;
  io.emit(event, data);
}
