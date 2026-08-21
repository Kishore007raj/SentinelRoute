/**
 * socket-server.ts - Server-side Socket.io helpers for API routes.
 *
 * Modified to support Vercel serverless deployment. It emits events by sending
 * an internal REST POST to the separately hosted socket server process.
 */

// Fire and forget fetch to the internal socket webhook
function pushToSocketWebhook(payload: any) {
  // Try to use a configured external socket URL, fallback to localhost for dev
  const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";
  const secret = process.env.INTERNAL_SOCKET_SECRET;
  
  if (!secret) {
    // Optional in local dev / serverless environment - skip emission quietly
    return;
  }
  
  fetch(`${baseUrl}/api/internal/socket-emit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secret}`
    },
    body: JSON.stringify(payload)
  }).catch(err => {
    console.error("[socket-server] Failed to push to socket webhook:", err);
  });
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  pushToSocketWebhook({ target: "user", userId, event, data });
}

export function emitToAll(event: string, data: unknown): void {
  pushToSocketWebhook({ target: "all", event, data });
}

export function emitToCompany(companyId: string, event: string, data: unknown): void {
  pushToSocketWebhook({ target: "company", companyId, event, data });
}

export function emitPresenceUpdate(
  companyId: string,
  presenceData: { userId: string; status: "online" | "offline"; role?: string }
): void {
  emitToCompany(companyId, "presence:updated", presenceData);
}

export function emitAnalyticsRefresh(companyId: string): void {
  emitToCompany(companyId, "analytics:refresh", { ts: Date.now() });
}

export function getSocketIO(): any | null {
  return null;
}
