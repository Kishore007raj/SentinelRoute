import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth-helpers";
import os from "os";

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const db = await getDb();

    // Measure DB Ping Latency
    const start = performance.now();
    const adminDb = db.admin();
    const pingResult = await adminDb.ping();
    const end = performance.now();
    const dbLatencyMs = Math.round(end - start);

    const serverInfo = await adminDb.serverStatus();
    
    // System Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Process Memory
    const processMem = process.memoryUsage();

    return NextResponse.json({
      status: pingResult.ok === 1 ? "healthy" : "degraded",
      database: {
        latencyMs: dbLatencyMs,
        connections: serverInfo.connections,
        network: serverInfo.network,
        version: serverInfo.version,
        uptime: serverInfo.uptime
      },
      system: {
        platform: os.platform(),
        release: os.release(),
        uptime: os.uptime(),
        memory: {
          total: Math.round(totalMem / 1024 / 1024),
          used: Math.round(usedMem / 1024 / 1024),
          processHeapUsed: Math.round(processMem.heapUsed / 1024 / 1024),
          processHeapTotal: Math.round(processMem.heapTotal / 1024 / 1024),
          rss: Math.round(processMem.rss / 1024 / 1024),
        },
        cpus: os.cpus().length,
        loadavg: os.loadavg()
      },
      node: {
        version: process.version,
        uptime: process.uptime()
      }
    });

  } catch (error) {
    return handleAuthError(error);
  }
}
