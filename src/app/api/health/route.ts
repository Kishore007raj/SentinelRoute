import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Simple liveness check — confirms the API layer is reachable.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "SentinelRoute API",
    version: "1.0.0",
  });
}
