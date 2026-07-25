import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

/**
 * GET /api/health
 *
 * Liveness + shallow readiness probe.
 * Used by load balancers, uptime monitors, and container orchestrators.
 *
 * Returns 200 when the API process is alive and the DB connection is healthy.
 * Returns 503 when the DB is unreachable - signals the orchestrator to
 * stop routing traffic to this instance.
 *
 * Response shape:
 *   { status: "ok" | "degraded", db: "ok" | "error", timestamp, uptime, version }
 *
 * Does NOT require authentication - must be reachable by infrastructure.
 */
export async function GET() {
  const start = Date.now();

  // ── DB ping ────────────────────────────────────────────────────────────────
  let dbStatus: "ok" | "error" = "ok";
  let dbLatencyMs = 0;
  try {
    const db = await getDb();
    const t0 = Date.now();
    await db.command({ ping: 1 });
    dbLatencyMs = Date.now() - t0;
  } catch {
    dbStatus = "error";
  }

  const healthy = dbStatus === "ok";

  const body = {
    status:      healthy ? "ok" : "degraded",
    db:          dbStatus,
    dbLatencyMs,
    timestamp:   new Date().toISOString(),
    uptimeSec:   Math.floor(process.uptime()),
    version:     "1.0.0",
    node:        process.version,
    responseMs:  Date.now() - start,
  };

  return NextResponse.json(body, { status: healthy ? 200 : 503 });
}
